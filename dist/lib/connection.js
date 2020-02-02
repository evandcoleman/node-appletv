"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const protobufjs_1 = require("protobufjs");
const uuid_1 = require("uuid");
const path = require("path");
const varint = require("varint");
const snake = require("snake-case");
const camelcase = require("camelcase");
const events_1 = require("events");
const tlv_1 = require("./util/tlv");
const message_1 = require("./message");
class Connection extends events_1.EventEmitter /* <Connection.Events> */ {
    constructor(device, socket) {
        super();
        this.device = device;
        this.callbacks = new Map();
        this.buffer = Buffer.alloc(0);
        this.socket = socket || new net_1.Socket();
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
                that.decodeMessage(messageBytes)
                    .then(protoMessage => {
                    let message = new message_1.Message(protoMessage);
                    that.emit('message', message);
                    that.executeCallbacks(message.identifier, message);
                })
                    .catch(error => {
                    that.emit('error', error);
                });
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
    executeCallbacks(identifier, message) {
        let callbacks = this.callbacks.get(identifier);
        if (callbacks) {
            for (var i = 0; i < callbacks.length; i++) {
                let callback = callbacks[i];
                callback.callback(message);
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
    send(message, waitForResponse, priority, credentials) {
        let ProtocolMessage = message.$type.parent['ProtocolMessage'];
        let types = ProtocolMessage.lookupEnum("Type");
        let name = message.$type.name;
        let typeName = snake(name).toUpperCase();
        let type = types.values[typeName];
        var outerMessage = ProtocolMessage.create({
            priority: priority,
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
            if (waitForResponse) {
                let identifier = uuid_1.v4();
                message["identifier"] = identifier;
                let callback = (message) => {
                    resolve(message);
                };
                that.addCallback(identifier, callback);
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
            if (!waitForResponse) {
                resolve(new message_1.Message(message));
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
                return message;
            });
        });
    }
    waitForSequence(sequence, timeout = 3) {
        let that = this;
        let handler = (message, resolve) => {
            let tlvData = tlv_1.default.decode(message.payload.pairingData);
            if (Buffer.from([sequence]).equals(tlvData[tlv_1.default.Tag.Sequence])) {
                resolve(message);
            }
        };
        return new Promise((resolve, reject) => {
            that.on('message', (message) => {
                if (message.type == message_1.Message.Type.CryptoPairingMessage) {
                    handler(message, resolve);
                }
            });
            setTimeout(() => {
                reject(new Error("Timed out waiting for crypto sequence " + sequence));
            }, timeout * 1000);
        })
            .then(value => {
            that.removeListener('message', handler);
            return value;
        });
    }
}
exports.Connection = Connection;
