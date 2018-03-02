"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const protobufjs_1 = require("protobufjs");
const uuid_1 = require("uuid");
const connection_1 = require("./connection");
const pairing_1 = require("./pairing");
const verifier_1 = require("./verifier");
const now_playing_info_1 = require("./now-playing-info");
const notification_1 = require("./notification");
const message_1 = require("./message");
const number_1 = require("./util/number");
class AppleTV {
    constructor(service, log) {
        this.service = service;
        this.log = log;
        this.pairingId = uuid_1.v4();
        this.stateCallbacks = [];
        this.log = log || ((text) => { });
        this.service = service;
        this.name = service.txtRecord.Name;
        if (service.addresses.length > 1) {
            this.address = service.addresses[1];
        }
        else {
            this.address = service.addresses[0];
        }
        this.port = service.port;
        this.uid = service.txtRecord.UniqueIdentifier;
        this.connection = new connection_1.Connection(this, this.log);
    }
    /**
    * Pair with an already discovered AppleTV.
    * @param log  An optional function to log debug information.
    * @returns A promise that resolves to the AppleTV object.
    */
    pair(log) {
        let logFunc = log || ((text) => { });
        let pairing = new pairing_1.Pairing(this);
        return pairing.initiatePair(logFunc);
    }
    /**
    * Opens a connection to the AppleTV over the MRP protocol.
    * @param credentials  The credentials object for this AppleTV
    * @returns A promise that resolves to the AppleTV object.
    */
    openConnection(credentials) {
        let that = this;
        if (credentials) {
            this.pairingId = credentials.pairingId;
            var timestamp = 0;
            this.connection
                .messagesOfType("SetStateMessage", (error, message) => {
                if (that.stateCallbacks.length == 0) {
                    return;
                }
                if (error) {
                    that.stateCallbacks.forEach(cb => {
                        cb(error, null);
                    });
                }
                else if (message) {
                    let info = new now_playing_info_1.NowPlayingInfo(message);
                    if (info.timestamp >= timestamp) {
                        timestamp = info.timestamp;
                        that.stateCallbacks.forEach(cb => {
                            cb(null, info);
                        });
                    }
                }
            });
        }
        return this.connection
            .open()
            .then(() => {
            return that.sendIntroduction();
        })
            .then(() => {
            that.credentials = credentials;
            if (credentials) {
                let verifier = new verifier_1.Verifier(that);
                return verifier.verify()
                    .then(keys => {
                    that.credentials.readKey = keys['readKey'];
                    that.credentials.writeKey = keys['writeKey'];
                    that.log("DEBUG: Keys Read=" + that.credentials.readKey.toString('hex') + ", Write=" + that.credentials.writeKey.toString('hex'));
                    return that.sendReadyState();
                });
            }
            else {
                return that.sendReadyState();
            }
        })
            .then(() => {
            return that.sendClientUpdatesConfig();
        })
            .then(() => {
            return that.sendWakeDevice();
        })
            .then(() => {
            return Promise.resolve(that);
        });
    }
    /**
    * Send a Protobuf message to the AppleTV. This is for advanced usage only.
    * @param message  The Protobuf message to send.
    * @returns A promise that resolves to the response from the AppleTV.
    */
    sendMessage(message) {
        return this.connection
            .send(message, this.credentials);
    }
    /**
    * Observes the now playing state of the AppleTV.
    * @param callback  The callback to send updates to.
    */
    observeState(callback) {
        this.stateCallbacks.push(callback);
    }
    /**
    * Observes notifications sent from the AppleTV.
    * @param callback  The callback to send notifications to.
    */
    observeNotifications(callback) {
        this.connection
            .messagesOfType("NotificationMessage", (error, message) => {
            if (error) {
                callback(error, null);
            }
            else if (message) {
                callback(null, new notification_1.Notification(message));
            }
        });
    }
    /**
    * Observes all messages sent from the AppleTV.
    * @param callback  The callback to send messages to.
    */
    observeMessages(callback) {
        this.connection
            .observeMessages((error, type, message) => {
            if (error) {
                callback(error, null);
            }
            else if (message && type) {
                callback(null, new message_1.Message(type, message));
            }
        });
    }
    /**
    * Send a key command to the AppleTV.
    * @param The key to press.
    * @returns A promise that resolves to the AppleTV object after the message has been sent.
    */
    sendKeyCommand(key) {
        switch (key) {
            case AppleTV.Key.Up:
                return this.sendKeyPressAndRelease(1, 0x8C);
            case AppleTV.Key.Down:
                return this.sendKeyPressAndRelease(1, 0x8D);
            case AppleTV.Key.Left:
                return this.sendKeyPressAndRelease(1, 0x8B);
            case AppleTV.Key.Right:
                return this.sendKeyPressAndRelease(1, 0x8A);
            case AppleTV.Key.Menu:
                return this.sendKeyPressAndRelease(1, 0x86);
            case AppleTV.Key.Play:
                return this.sendKeyPressAndRelease(12, 0xB0);
            case AppleTV.Key.Pause:
                return this.sendKeyPressAndRelease(12, 0xB1);
            case AppleTV.Key.Next:
                return this.sendKeyPressAndRelease(12, 0xB5);
            case AppleTV.Key.Previous:
                return this.sendKeyPressAndRelease(12, 0xB6);
        }
    }
    sendKeyPressAndRelease(usePage, usage) {
        let that = this;
        return this.sendKeyPress(usePage, usage, true)
            .then(() => {
            return that.sendKeyPress(usePage, usage, false);
        });
    }
    sendKeyPress(usePage, usage, down) {
        let that = this;
        return protobufjs_1.load(path.resolve(__dirname + "/protos/SendHIDEventMessage.proto"))
            .then(root => {
            let time = Buffer.from('438922cf08020000', 'hex');
            let data = Buffer.concat([
                number_1.default.UInt16toBufferBE(usePage),
                number_1.default.UInt16toBufferBE(usage),
                down ? number_1.default.UInt16toBufferBE(1) : number_1.default.UInt16toBufferBE(0)
            ]);
            let type = root.lookupType('SendHIDEventMessage');
            let message = type.create({
                hidEventData: Buffer.concat([
                    time,
                    Buffer.from('00000000000000000100000000000000020' + '00000200000000300000001000000000000', 'hex'),
                    data,
                    Buffer.from('0000000000000001000000', 'hex')
                ])
            });
            return that.sendMessage(message)
                .then(() => {
                return that;
            });
        });
    }
    sendIntroduction() {
        let that = this;
        return protobufjs_1.load(path.resolve(__dirname + "/protos/DeviceInfoMessage.proto"))
            .then(root => {
            let type = root.lookupType('DeviceInfoMessage');
            let message = type.create({
                uniqueIdentifier: that.pairingId,
                name: 'node-appletv',
                localizedModelName: 'iPhone',
                systemBuildVersion: '14G60',
                applicationBundleIdentifier: 'com.apple.TVRemote',
                applicationBundleVersion: '273.12',
                protocolVersion: 1
            });
            return that
                .sendMessage(message);
        });
    }
    sendConnectionState() {
        let that = this;
        return protobufjs_1.load(path.resolve(__dirname + "/protos/SetConnectionStateMessage.proto"))
            .then(root => {
            let type = root.lookupType('SetConnectionStateMessage');
            let stateEnum = type.lookupEnum('ConnectionState');
            let message = type.create({
                state: stateEnum.values['Connected']
            });
            return that
                .sendMessage(message);
        });
    }
    sendReadyState() {
        return this.connection
            .sendBlank("SET_READY_STATE_MESSAGE", this.credentials);
    }
    sendClientUpdatesConfig() {
        let that = this;
        return protobufjs_1.load(path.resolve(__dirname + "/protos/ClientUpdatesConfigMessage.proto"))
            .then(root => {
            let type = root.lookupType('ClientUpdatesConfigMessage');
            let message = type.create({
                artworkUpdates: true,
                nowPlayingUpdates: true,
                volumeUpdates: true,
                keyboardUpdates: true
            });
            return that
                .sendMessage(message);
        });
    }
    sendWakeDevice() {
        let that = this;
        return protobufjs_1.load(path.resolve(__dirname + "/protos/WakeDeviceMessage.proto"))
            .then(root => {
            let type = root.lookupType('WakeDeviceMessage');
            let message = type.create({});
            return that
                .sendMessage(message);
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
    }
    AppleTV.key = key;
})(AppleTV = exports.AppleTV || (exports.AppleTV = {}));
