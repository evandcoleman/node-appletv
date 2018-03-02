"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const protobufjs_1 = require("protobufjs");
const uuid_1 = require("uuid");
const path = require("path");
const varint = require("varint");
const snake = require("snake-case");
const camelcase = require("camelcase");
class Callback {
    constructor(persist, callback) {
        this.persist = persist;
        this.callback = callback;
    }
}
class Connection {
    constructor(device, log) {
        this.device = device;
        this.log = log;
        this.callbacks = {};
        this.rawMessageCallbacks = [];
        this.buffer = Buffer.alloc(0);
        this.unidentifiableMessageTypes = [
            4,
            5,
            34
        ];
        this.waitForResponseMessageTypes = [
            3,
            15,
            34
        ];
        this.socket = new net_1.Socket();
        let that = this;
        this.socket.on('data', (data) => {
            try {
                that.buffer = Buffer.concat([that.buffer, data]);
                let length = varint.decode(that.buffer);
                let messageBytes = that.buffer.slice(varint.decode.bytes, length + varint.decode.bytes);
                if (messageBytes.length < length) {
                    log("Message length mismatch");
                    return;
                }
                that.buffer = that.buffer.slice(length + varint.decode.bytes);
                log("DEBUG: <<<< Received Data=" + messageBytes.toString('hex'));
                if (device.credentials && device.credentials.readKey) {
                    messageBytes = device.credentials.decrypt(messageBytes);
                    log("DEBUG: Decrypted Data=" + messageBytes.toString('hex'));
                }
                let message = that.ProtocolMessage.decode(messageBytes);
                let types = that.ProtocolMessage.lookupEnum("Type");
                let name = types.valuesById[message["type"]];
                let identifier = message["identifier"] || "type_" + name;
                if (!that.executeCallbacks(identifier, messageBytes)) {
                    log("Missing callback: " + JSON.stringify(message.toJSON(), null, 2));
                }
                if (name) {
                    for (var i = 0; i < that.rawMessageCallbacks.length; i++) {
                        let id = camelcase(name);
                        let fixedId = id.charAt(0).toUpperCase() + id.slice(1);
                        that.rawMessageCallbacks[i](fixedId, messageBytes);
                    }
                }
            }
            catch (error) {
                log(error.message);
                log(error.stack);
            }
        });
        this.socket.on('error', (error) => {
            log(error.message);
            log(error.stack);
        });
    }
    addCallback(identifier, persist, callback) {
        if (this.callbacks[identifier]) {
            this.callbacks[identifier].push(new Callback(persist, callback));
        }
        else {
            this.callbacks[identifier] = [new Callback(persist, callback)];
        }
    }
    executeCallbacks(identifier, data) {
        let callbacks = this.callbacks[identifier];
        if (callbacks) {
            for (var i = 0; i < callbacks.length; i++) {
                let callback = callbacks[i];
                callback.callback(data);
                if (!callback.persist) {
                    this.callbacks[identifier].splice(i, 1);
                }
            }
            return true;
        }
        else {
            return false;
        }
    }
    open() {
        let that = this;
        return protobufjs_1.load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"))
            .then(root => {
            that.ProtocolMessage = root.lookupType("ProtocolMessage");
            return new Promise((resolve, reject) => {
                that.socket.connect(this.device.port, this.device.address, function () {
                    resolve();
                });
            });
        });
    }
    messageOfType(messageType) {
        let that = this;
        return new Promise((resolve, reject) => {
            that.messagesOfType(messageType, (error, message) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve(message);
                }
            }, false);
        });
    }
    messagesOfType(messageType, callback, persist) {
        let that = this;
        protobufjs_1.load(path.resolve(__dirname + "/protos/" + messageType + ".proto"), (error, root) => {
            if (error) {
                callback(error, null);
                return;
            }
            let type = root.lookupType(messageType);
            let ProtocolMessage = type.parent['ProtocolMessage'];
            let cb = (data) => {
                try {
                    let message = ProtocolMessage.decode(data);
                    // that.log("DEBUG: <<<< Received Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
                    let key = "." + messageType.charAt(0).toLowerCase() + messageType.slice(1);
                    callback(null, message[key]);
                }
                catch (error) {
                    callback(error, null);
                }
            };
            let identifier = "type_" + snake(messageType).toUpperCase();
            that.addCallback(identifier, persist == null ? true : persist, cb);
        });
    }
    observeMessages(callback) {
        this.rawMessageCallbacks.push((identifier, data) => {
            protobufjs_1.load(path.resolve(__dirname + "/protos/" + identifier + ".proto"), (error, root) => {
                if (error) {
                    callback(error, identifier, null);
                }
                else {
                    let type = root.lookupType(identifier);
                    let ProtocolMessage = type.parent['ProtocolMessage'];
                    let message = ProtocolMessage.decode(data);
                    callback(null, identifier, message);
                }
            });
        });
    }
    sendBlank(typeName, credentials) {
        let that = this;
        return protobufjs_1.load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"))
            .then(root => {
            let ProtocolMessage = root.lookupType("ProtocolMessage");
            let types = ProtocolMessage.lookupEnum("Type");
            let type = types.values[typeName];
            let name = camelcase(typeName);
            let message = ProtocolMessage.create({
                type: type,
                priority: 0
            });
            return that.sendProtocolMessage(message, name, type, credentials);
        });
    }
    send(message, credentials) {
        let ProtocolMessage = message.$type.parent['ProtocolMessage'];
        let types = ProtocolMessage.lookupEnum("Type");
        let name = message.$type.name;
        let typeName = snake(name).toUpperCase();
        let type = types.values[typeName];
        var outerMessage = ProtocolMessage.create({
            priority: 0,
            type: type
        });
        if (Object.keys(message.toJSON()).length > 0) {
            let field = outerMessage.$type.fieldsArray.filter((f) => { return f.type == message.$type.name; })[0];
            outerMessage[field.name] = message;
        }
        return this.sendProtocolMessage(outerMessage, name, type, credentials);
    }
    sendProtocolMessage(message, name, type, credentials) {
        let that = this;
        return new Promise((resolve, reject) => {
            let ProtocolMessage = message.$type;
            let waitForResponse = that.waitForResponseMessageTypes.indexOf(type) > -1;
            if (waitForResponse) {
                let callback = (data) => {
                    try {
                        let message = ProtocolMessage.decode(data);
                        that.log("DEBUG: <<<< Received Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
                        let key = "." + name.charAt(0).toLowerCase() + name.slice(1);
                        resolve(message[key]);
                    }
                    catch (error) {
                        that.log(error);
                    }
                };
                if (that.unidentifiableMessageTypes.indexOf(type) == -1) {
                    let id = uuid_1.v4();
                    message["identifier"] = id;
                    that.addCallback(id, false, callback);
                }
                else {
                    that.addCallback("type_" + snake(name).toUpperCase(), false, callback);
                }
            }
            let data = ProtocolMessage.encode(message).finish();
            that.log("DEBUG: >>>> Send Data=" + data.toString('hex'));
            if (credentials && credentials.writeKey) {
                let encrypted = credentials.encrypt(data);
                that.log("DEBUG: >>>> Send Encrypted Data=" + encrypted.toString('hex'));
                that.log("DEBUG: >>>> Send Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
                let messageLength = Buffer.from(varint.encode(encrypted.length));
                let bytes = Buffer.concat([messageLength, encrypted]);
                that.socket.write(bytes);
            }
            else {
                that.log("DEBUG: >>>> Send Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
                let messageLength = Buffer.from(varint.encode(data.length));
                let bytes = Buffer.concat([messageLength, data]);
                that.socket.write(bytes);
            }
            if (!waitForResponse) {
                resolve(message);
            }
        });
    }
}
exports.Connection = Connection;
