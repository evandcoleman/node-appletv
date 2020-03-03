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
const signale = require("signale");
const message_1 = require("./message");
const tlv_1 = require("./util/tlv");
class AppleTV extends events_1.EventEmitter /* <AppleTV.Events> */ {
    constructor(name, port, uid) {
        super();
        this.name = name;
        this.port = port;
        this.callbacks = new Map();
        this.buffer = Buffer.alloc(0);
        this.log = signale.scope('📺', name);
        this.uid = uid || uuid_1.v4();
        if (process.env.DEBUG) {
            this.on('debug', this.log.debug);
        }
    }
    /**
    * Closes the connection to the Apple TV.
    */
    close() {
        throw new Error("Subclasses should override this");
    }
    /**
    * Send a Protobuf message to the AppleTV. This is for advanced usage only.
    * @param definitionFilename  The Protobuf filename of the message type.
    * @param messageType  The name of the message.
    * @param body  The message body
    * @param waitForResponse  Whether or not to wait for a response before resolving the Promise.
    * @param socket  The socket on which to send the message
    * @returns A promise that resolves to the response from the AppleTV.
    */
    sendMessage(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let root = yield protobufjs_1.load(path.resolve(__dirname + "/protos/" + (options.filename || options.type) + ".proto"));
            let type = root.lookupType(options.type || options.filename);
            var body;
            if (options.body) {
                body = options.body;
            }
            else if (options.bodyBuilder) {
                body = options.bodyBuilder(type);
            }
            else {
                throw new Error("Must specify either body or bodyBuilder");
            }
            let message = yield type.create(body);
            return this.send({
                message: message,
                waitForResponse: options.waitForResponse,
                identifier: options.identifier,
                priority: options.priority,
                credentials: options.credentials,
                socket: options.socket
            });
        });
    }
    send(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let ProtocolMessage = options.message.$type.parent['ProtocolMessage'];
            let types = ProtocolMessage.lookupEnum("Type");
            let name = options.message.$type.name;
            let typeName = snake(name).toUpperCase();
            let innerType = types.values[typeName];
            var outerMessage = ProtocolMessage.create({
                priority: options.priority || 0,
                type: innerType
            });
            if (Object.keys(options.message.toJSON()).length > 0) {
                let field = outerMessage.$type.fieldsArray.filter((f) => { return f.type == options.message.$type.name; })[0];
                outerMessage[field.name] = options.message;
            }
            options.message = outerMessage;
            return this.sendProtocolMessage(options);
        });
    }
    /**
    * Wait for a single message of a specified type.
    * @param type  The type of the message to wait for.
    * @param timeout  The timeout (in seconds).
    * @returns A promise that resolves to the Message.
    */
    messageOfType(type, timeout = 5) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    waitForSequence(sequence, state, socket, timeout = 3) {
        return __awaiter(this, void 0, void 0, function* () {
            let that = this;
            let handler = (message, resolve) => {
                let tlvData = tlv_1.default.decode(message.payload.pairingData);
                if (Buffer.from([sequence]).equals(tlvData[tlv_1.default.Tag.Sequence]) && message.payload.state == state) {
                    resolve(message);
                }
            };
            return new Promise((resolve, reject) => {
                that.on('message', (message, messageSocket) => {
                    if (message.type == message_1.Message.Type.CryptoPairingMessage && messageSocket == socket) {
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
        });
    }
    /**
    * Call this method when a chunk of data is received.
    * @param data  A Buffer of data.
    * @returns A promise that resolves to the Message (if there is one).
    */
    handleChunk(data, socket, credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            this.buffer = Buffer.concat([this.buffer, data]);
            let length = varint.decode(this.buffer);
            let messageBytes = this.buffer.slice(varint.decode.bytes, length + varint.decode.bytes);
            if (messageBytes.length < length) {
                this.emit('debug', "Message length mismatch");
                return null;
            }
            this.buffer = this.buffer.slice(length + varint.decode.bytes);
            this.emit('debug', "<<<< Received Data=" + messageBytes.toString('hex'));
            if (credentials && credentials.readKey) {
                messageBytes = credentials.decrypt(messageBytes);
                this.emit('debug', "<<<< Received Decrypted Data=" + messageBytes.toString('hex'));
            }
            let protoMessage = yield this.decodeMessage(messageBytes);
            let message = new message_1.Message(protoMessage);
            if (message) {
                this.emit('message', message, socket);
                this.executeCallbacks(message.identifier, message);
            }
            return message;
        });
    }
    write(data, socket) {
        socket.write(data);
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
    sendProtocolMessage(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let that = this;
            return new Promise((resolve, reject) => {
                let ProtocolMessage = options.message.$type;
                if (options.waitForResponse && !options.identifier) {
                    let uid = uuid_1.v4();
                    options.message["identifier"] = uid;
                    let callback = (message) => {
                        resolve(message);
                    };
                    that.addCallback(uid, callback);
                }
                else if (options.identifier) {
                    options.message["identifier"] = options.identifier;
                }
                let data = ProtocolMessage.encode(options.message).finish();
                that.emit('debug', ">>>> Send Data=" + data.toString('hex'));
                let message = new message_1.Message(options.message);
                if (options.credentials && options.credentials.writeKey) {
                    let encrypted = options.credentials.encrypt(data);
                    that.emit('debug', ">>>> Send Encrypted Data=" + encrypted.toString('hex'));
                    that.emit('debug', ">>>> Send Protobuf=" + message.toString());
                    let messageLength = Buffer.from(varint.encode(encrypted.length));
                    let bytes = Buffer.concat([messageLength, encrypted]);
                    that.write(bytes, options.socket);
                }
                else {
                    that.emit('debug', ">>>> Send Protobuf=" + message.toString());
                    let messageLength = Buffer.from(varint.encode(data.length));
                    let bytes = Buffer.concat([messageLength, data]);
                    that.write(bytes, options.socket);
                }
                if (!options.waitForResponse) {
                    resolve(message);
                }
            });
        });
    }
    sendIntroduction(socket, parameters, identifier) {
        return __awaiter(this, void 0, void 0, function* () {
            let body = Object.assign({ uniqueIdentifier: this.uid }, parameters);
            return this.sendMessage({
                filename: 'DeviceInfoMessage',
                body: body,
                waitForResponse: true,
                identifier: identifier,
                socket: socket
            });
        });
    }
    decodeMessage(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let outerRoot = yield protobufjs_1.load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"));
            let ProtocolMessage = outerRoot.lookupType("ProtocolMessage");
            let preMessage = ProtocolMessage.decode(data);
            let type = preMessage.toJSON().type;
            if (type == null) {
                console.warn(`Missing message type: ${JSON.stringify(preMessage, null, 2)}`);
                return preMessage;
            }
            let name = type[0].toUpperCase() + camelcase(type).substring(1);
            let root = yield protobufjs_1.load(path.resolve(__dirname + "/protos/" + name + ".proto"));
            let message = root.lookupType("ProtocolMessage").decode(data);
            this.emit('debug', "<<<< Received Protobuf=" + (new message_1.Message(message).toString()));
            return message;
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
