"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const protobufjs_1 = require("protobufjs");
const uuid_1 = require("uuid");
const path = require("path");
const varint = require("varint");
const snake = require("snake-case");
const camelcase = require("camelcase");
const typed_events_1 = require("./typed-events");
const message_1 = require("./message");
class Connection extends typed_events_1.default {
    constructor(device) {
        super();
        this.device = device;
        this.callbacks = new Map();
        this.buffer = Buffer.alloc(0);
        this.unidentifiableMessageTypes = [
            4,
            5,
            34
        ];
        this.waitForResponseMessageTypes = [
            3,
            15,
            32,
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
                    that.emit('debug', "Message length mismatch");
                    return;
                }
                that.buffer = that.buffer.slice(length + varint.decode.bytes);
                that.emit('debug', "DEBUG: <<<< Received Data=" + messageBytes.toString('hex'));
                if (device.credentials && device.credentials.readKey) {
                    messageBytes = device.credentials.decrypt(messageBytes);
                    that.emit('debug', "DEBUG: Decrypted Data=" + messageBytes.toString('hex'));
                }
                let message = that.ProtocolMessage.decode(messageBytes);
                let types = that.ProtocolMessage.lookupEnum("Type");
                let name = types.valuesById[message["type"]];
                let identifier = message["identifier"] || "type_" + name;
                if (!that.executeCallbacks(identifier, messageBytes)) {
                    that.emit('debug', "DEBUG: <<<< Received Protobuf=" + JSON.stringify(that.decodeMessage(messageBytes), null, 2));
                }
                if (name) {
                    let id = camelcase(name);
                    let fixedId = id.charAt(0).toUpperCase() + id.slice(1);
                    protobufjs_1.load(path.resolve(__dirname + "/protos/" + fixedId + ".proto"), (error, root) => {
                        if (error) {
                            that.emit('error', error);
                        }
                        else {
                            let type = root.lookupType(fixedId);
                            let ProtocolMessage = type.parent['ProtocolMessage'];
                            let message = new message_1.Message(fixedId, ProtocolMessage.decode(messageBytes).toJSON());
                            that.emit('message', message);
                        }
                    });
                }
            }
            catch (error) {
                that.emit('error', error);
            }
        });
        this.socket.on('connect', () => {
            that.emit('connect');
            that.isOpen = true;
        });
        this.socket.on('close', () => {
            that.emit('close');
            that.isOpen = false;
        });
        this.socket.on('error', (error) => {
            that.emit('error', error);
        });
    }
    addCallback(identifier, callback) {
        if (this.callbacks.has(identifier)) {
            this.callbacks.get(identifier).push({
                callback: callback
            });
        }
        else {
            this.callbacks.set(identifier, [{
                    callback: callback
                }]);
        }
    }
    executeCallbacks(identifier, data) {
        let callbacks = this.callbacks.get(identifier);
        if (callbacks) {
            for (var i = 0; i < callbacks.length; i++) {
                let callback = callbacks[i];
                callback.callback(data);
                this.callbacks.get(identifier).splice(i, 1);
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
    close() {
        this.socket.end();
    }
    sendBlank(typeName, waitForResponse, credentials) {
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
            return that.sendProtocolMessage(message, name, type, waitForResponse, credentials);
        });
    }
    send(message, waitForResponse, credentials) {
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
        return this.sendProtocolMessage(outerMessage, name, type, waitForResponse, credentials);
    }
    sendProtocolMessage(message, name, type, waitForResponse, credentials) {
        let that = this;
        return new Promise((resolve, reject) => {
            let ProtocolMessage = message.$type;
            let shouldWaitForResponse = that.waitForResponseMessageTypes.indexOf(type) > -1 && waitForResponse;
            if (that.unidentifiableMessageTypes.indexOf(type) == -1 && shouldWaitForResponse) {
                message["identifier"] = uuid_1.v4();
            }
            if (shouldWaitForResponse) {
                let callback = (data) => {
                    try {
                        that.decodeMessage(data)
                            .then(message => {
                            resolve(message);
                        })
                            .catch(error => {
                            that.emit('error', error);
                        });
                    }
                    catch (error) {
                        that.emit('error', error);
                    }
                };
                if (that.unidentifiableMessageTypes.indexOf(type) == -1) {
                    that.addCallback(message["identifier"], callback);
                }
                else {
                    that.addCallback("type_" + snake(name).toUpperCase(), callback);
                }
            }
            let data = ProtocolMessage.encode(message).finish();
            that.emit('debug', "DEBUG: >>>> Send Data=" + data.toString('hex'));
            if (credentials && credentials.writeKey) {
                let encrypted = credentials.encrypt(data);
                that.emit('debug', "DEBUG: >>>> Send Encrypted Data=" + encrypted.toString('hex'));
                that.emit('debug', "DEBUG: >>>> Send Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
                let messageLength = Buffer.from(varint.encode(encrypted.length));
                let bytes = Buffer.concat([messageLength, encrypted]);
                that.socket.write(bytes);
            }
            else {
                that.emit('debug', "DEBUG: >>>> Send Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
                let messageLength = Buffer.from(varint.encode(data.length));
                let bytes = Buffer.concat([messageLength, data]);
                that.socket.write(bytes);
            }
            if (!shouldWaitForResponse) {
                resolve(message);
            }
        });
    }
    decodeMessage(data) {
        let that = this;
        return protobufjs_1.load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"))
            .then(root => {
            let ProtocolMessage = root.lookupType("ProtocolMessage");
            let preMessage = ProtocolMessage.decode(data);
            let type = preMessage.toJSON().type;
            if (type == null) {
                return Promise.resolve(preMessage);
            }
            let name = type[0].toUpperCase() + camelcase(type).substring(1);
            return protobufjs_1.load(path.resolve(__dirname + "/protos/" + name + ".proto"))
                .then(root => {
                let ProtocolMessage = root.lookupType("ProtocolMessage");
                let message = ProtocolMessage.decode(data);
                that.emit('debug', "DEBUG: <<<< Received Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
                let key = "." + name.charAt(0).toLowerCase() + name.slice(1);
                return message[key];
            });
        });
    }
}
exports.Connection = Connection;
