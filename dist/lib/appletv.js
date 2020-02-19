"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const varint = require("varint");
const protobufjs_1 = require("protobufjs");
const uuid_1 = require("uuid");
const events_1 = require("events");
const snake = require("snake-case");
const camelcase = require("camelcase");
const message_1 = require("./message");
const tlv_1 = require("./util/tlv");
class AppleTV extends events_1.EventEmitter /* <AppleTV.Events> */ {
    constructor(name, port, uid) {
        super();
        this.name = name;
        this.port = port;
        this.uid = uid;
        this.pairingId = uuid_1.v4();
        this.callbacks = new Map();
        this.buffer = Buffer.alloc(0);
    }
    /**
    * Opens a connection to the AppleTV over the MRP protocol.
    * @param credentials  The credentials object for this AppleTV
    * @returns A promise that resolves to the AppleTV object.
    */
    open(credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            if (credentials) {
                this.pairingId = credentials.pairingId;
            }
            this.credentials = credentials;
            let root = yield protobufjs_1.load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"));
            this.ProtocolMessage = root.lookupType("ProtocolMessage");
            return this;
        });
    }
    /**
    * Closes the connection to the Apple TV.
    */
    close() {
        throw new Error("Subclasses should override this");
    }
    write(data) {
        throw new Error("Subclasses must override this");
    }
    /**
    * Send a Protobuf message to the AppleTV. This is for advanced usage only.
    * @param definitionFilename  The Protobuf filename of the message type.
    * @param messageType  The name of the message.
    * @param body  The message body
    * @param waitForResponse  Whether or not to wait for a response before resolving the Promise.
    * @returns A promise that resolves to the response from the AppleTV.
    */
    sendMessage(definitionFilename, messageType, body, waitForResponse, priority = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            let root = yield protobufjs_1.load(path.resolve(__dirname + "/protos/" + definitionFilename + ".proto"));
            let type = root.lookupType(messageType);
            let message = yield type.create(body);
            return this.send(message, waitForResponse, priority, this.credentials);
        });
    }
    send(message, waitForResponse, priority, credentials) {
        let ProtocolMessage = message.$type.parent['ProtocolMessage'];
        let types = ProtocolMessage.lookupEnum("Type");
        let name = message.$type.name;
        let typeName = snake(name).toUpperCase();
        let innerType = types.values[typeName];
        var outerMessage = ProtocolMessage.create({
            priority: priority,
            type: innerType
        });
        if (Object.keys(message.toJSON()).length > 0) {
            let field = outerMessage.$type.fieldsArray.filter((f) => { return f.type == message.$type.name; })[0];
            outerMessage[field.name] = message;
        }
        return this.sendProtocolMessage(outerMessage, name, innerType, waitForResponse, credentials);
    }
    /**
    * Wait for a single message of a specified type.
    * @param type  The type of the message to wait for.
    * @param timeout  The timeout (in seconds).
    * @returns A promise that resolves to the Message.
    */
    messageOfType(type, timeout = 5) {
        let that = this;
        return new Promise((resolve, reject) => {
            let listener;
            let timer = setTimeout(() => {
                reject(new Error("Timed out waiting for message type " + type));
                that.removeListener('message', listener);
            }, timeout * 1000);
            listener = (message) => {
                if (message.type == type) {
                    resolve(message);
                    that.removeListener('message', listener);
                }
            };
            that.on('message', listener);
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
    /**
    * Call this method when a chunk of data is received.
    * @param data  A Buffer of data.
    * @returns A promise that resolves to the Message (if there is one).
    */
    handleChunk(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.buffer = Buffer.concat([this.buffer, data]);
            let length = varint.decode(this.buffer);
            let messageBytes = this.buffer.slice(varint.decode.bytes, length + varint.decode.bytes);
            if (messageBytes.length < length) {
                this.emit('debug', "Message length mismatch");
                return null;
            }
            this.buffer = this.buffer.slice(length + varint.decode.bytes);
            this.emit('debug', "DEBUG: <<<< Received Data=" + messageBytes.toString('hex'));
            if (this.credentials && this.credentials.readKey) {
                messageBytes = this.credentials.decrypt(messageBytes);
                this.emit('debug', "DEBUG: Decrypted Data=" + messageBytes.toString('hex'));
            }
            let protoMessage = yield this.decodeMessage(messageBytes);
            let message = new message_1.Message(protoMessage);
            if (message) {
                this.emit('message', message);
                this.executeCallbacks(message.identifier, message);
            }
            return message;
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
    // private sendBlank(typeName: string, waitForResponse: boolean, credentials?: Credentials): Promise<Message> {
    //   let that = this;
    //   return load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"))
    //     .then(root => {
    //       let ProtocolMessage = root.lookupType("ProtocolMessage");
    //       let types = ProtocolMessage.lookupEnum("Type");
    //       let type = types.values[typeName];
    //       let name = camelcase(typeName);
    //       let message = ProtocolMessage.create({
    //         type: type,
    //         priority: 0
    //       });
    //       return that.sendProtocolMessage(message, name, type, waitForResponse, credentials);
    //     });
    // }
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
                that.emit('debug', "DEBUG: >>>> Send Protobuf=" + JSON.stringify(new message_1.Message(message), null, 2));
                let messageLength = Buffer.from(varint.encode(encrypted.length));
                let bytes = Buffer.concat([messageLength, encrypted]);
                that.write(bytes);
            }
            else {
                that.emit('debug', "DEBUG: >>>> Send Protobuf=" + JSON.stringify(new message_1.Message(message), null, 2));
                let messageLength = Buffer.from(varint.encode(data.length));
                let bytes = Buffer.concat([messageLength, data]);
                that.write(bytes);
            }
            if (!waitForResponse) {
                resolve(new message_1.Message(message));
            }
        });
    }
    sendIntroduction() {
        let body = {
            uniqueIdentifier: this.pairingId,
            name: 'node-appletv',
            localizedModelName: 'iPhone',
            systemBuildVersion: '14G60',
            applicationBundleIdentifier: 'com.apple.TVRemote',
            applicationBundleVersion: '320.18',
            protocolVersion: 1,
            allowsPairing: true,
            lastSupportedMessageType: 45,
            supportsSystemPairing: true,
        };
        return this.sendMessage('DeviceInfoMessage', 'DeviceInfoMessage', body, true);
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
                that.emit('debug', "DEBUG: <<<< Received Protobuf=" + JSON.stringify(new message_1.Message(message), null, 2));
                return message;
            });
        });
    }
}
exports.AppleTV = AppleTV;
(function (AppleTV) {
    /** An enumeration of key presses available.
    */
    let Key;
    (function (Key) {
        Key[Key["Up"] = 0] = "Up";
        Key[Key["Down"] = 1] = "Down";
        Key[Key["Left"] = 2] = "Left";
        Key[Key["Right"] = 3] = "Right";
        Key[Key["Menu"] = 4] = "Menu";
        Key[Key["Play"] = 5] = "Play";
        Key[Key["Pause"] = 6] = "Pause";
        Key[Key["Next"] = 7] = "Next";
        Key[Key["Previous"] = 8] = "Previous";
        Key[Key["Suspend"] = 9] = "Suspend";
        Key[Key["Wake"] = 10] = "Wake";
        Key[Key["Select"] = 11] = "Select";
        Key[Key["Home"] = 12] = "Home";
        Key[Key["VolumeUp"] = 13] = "VolumeUp";
        Key[Key["VolumeDown"] = 14] = "VolumeDown";
    })(Key = AppleTV.Key || (AppleTV.Key = {}));
    /** Convert a string representation of a key to the correct enum type.
    * @param string  The string.
    * @returns The key enum value.
    */
    function key(string) {
        if (string == "up") {
            return AppleTV.Key.Up;
        }
        else if (string == "down") {
            return AppleTV.Key.Down;
        }
        else if (string == "left") {
            return AppleTV.Key.Left;
        }
        else if (string == "right") {
            return AppleTV.Key.Right;
        }
        else if (string == "menu") {
            return AppleTV.Key.Menu;
        }
        else if (string == "play") {
            return AppleTV.Key.Play;
        }
        else if (string == "pause") {
            return AppleTV.Key.Pause;
        }
        else if (string == "next") {
            return AppleTV.Key.Next;
        }
        else if (string == "previous") {
            return AppleTV.Key.Previous;
        }
        else if (string == "suspend") {
            return AppleTV.Key.Suspend;
        }
        else if (string == "select") {
            return AppleTV.Key.Select;
        }
        else if (string == "wake") {
            return AppleTV.Key.Wake;
        }
        else if (string == "home") {
            return AppleTV.Key.Home;
        }
        else if (string == "volumeup") {
            return AppleTV.Key.VolumeUp;
        }
        else if (string == "volumedown") {
            return AppleTV.Key.VolumeDown;
        }
    }
    AppleTV.key = key;
})(AppleTV = exports.AppleTV || (exports.AppleTV = {}));
