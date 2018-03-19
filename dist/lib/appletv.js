"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const protobufjs_1 = require("protobufjs");
const uuid_1 = require("uuid");
const connection_1 = require("./connection");
const pairing_1 = require("./pairing");
const verifier_1 = require("./verifier");
const now_playing_info_1 = require("./now-playing-info");
const supported_command_1 = require("./supported-command");
const typed_events_1 = require("./typed-events");
const message_1 = require("./message");
const number_1 = require("./util/number");
class AppleTV extends typed_events_1.default {
    constructor(service) {
        super();
        this.service = service;
        this.pairingId = uuid_1.v4();
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
        this.connection = new connection_1.Connection(this);
        let that = this;
        this.connection.on('message', (message) => {
            that.emit('message', message);
            if (message.type == message_1.Message.Type.SetStateMessage) {
                if (message.payload == null) {
                    that.emit('nowPlaying', null);
                    return;
                }
                if (message.payload.nowPlayingInfo) {
                    let info = new now_playing_info_1.NowPlayingInfo(message.payload);
                    that.emit('nowPlaying', info);
                }
                if (message.payload.supportedCommands) {
                    let commands = (message.payload.supportedCommands.supportedCommands || [])
                        .map(sc => {
                        return new supported_command_1.SupportedCommand(sc.command, sc.enabled || false, sc.canScrub || false);
                    });
                    that.emit('supportedCommands', commands);
                }
                if (message.payload.playbackQueue) {
                    that.emit('playbackQueue', message.payload.playbackQueue);
                }
            }
        })
            .on('connect', () => {
            that.emit('connect');
        })
            .on('close', () => {
            that.emit('close');
        })
            .on('error', (error) => {
            that.emit('error', error);
        })
            .on('debug', (message) => {
            that.emit('debug', message);
        });
        var queuePollTimer = null;
        this._on('newListener', (event, listener) => {
            if (queuePollTimer == null && (event == 'nowPlaying' || event == 'supportedCommands')) {
                queuePollTimer = setInterval(() => {
                    if (that.connection.isOpen) {
                        that.requestPlaybackQueueWithWait({
                            length: 1,
                            location: 0,
                            artworkSize: {
                                width: -1,
                                height: 368
                            }
                        }, false).then(() => { }).catch(error => { });
                    }
                }, 2000);
            }
        });
        this._on('removeListener', (event, listener) => {
            if (queuePollTimer != null && (event == 'nowPlaying' || event == 'supportedCommands')) {
                let listenerCount = that.listenerCount('nowPlaying') + that.listenerCount('supportedCommands');
                if (listenerCount == 0) {
                    clearInterval(queuePollTimer);
                    queuePollTimer = null;
                }
            }
        });
    }
    /**
    * Pair with an already discovered AppleTV.
    * @returns A promise that resolves to the AppleTV object.
    */
    pair() {
        let pairing = new pairing_1.Pairing(this);
        return pairing.initiatePair();
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
                    that.emit('debug', "DEBUG: Keys Read=" + that.credentials.readKey.toString('hex') + ", Write=" + that.credentials.writeKey.toString('hex'));
                    return that.sendConnectionState();
                });
            }
            else {
                return null;
            }
        })
            .then(() => {
            if (credentials) {
                return that.sendClientUpdatesConfig();
            }
            else {
                return null;
            }
        })
            .then(() => {
            return Promise.resolve(that);
        });
    }
    /**
    * Closes the connection to the Apple TV.
    */
    closeConnection() {
        this.connection.close();
    }
    /**
    * Send a Protobuf message to the AppleTV. This is for advanced usage only.
    * @param definitionFilename  The Protobuf filename of the message type.
    * @param messageType  The name of the message.
    * @param body  The message body
    * @param waitForResponse  Whether or not to wait for a response before resolving the Promise.
    * @returns A promise that resolves to the response from the AppleTV.
    */
    sendMessage(definitionFilename, messageType, body, waitForResponse) {
        return protobufjs_1.load(path.resolve(__dirname + "/protos/" + definitionFilename + ".proto"))
            .then(root => {
            let type = root.lookupType(messageType);
            return type.create(body);
        })
            .then(message => {
            return this.connection
                .send(message, waitForResponse, this.credentials);
        });
    }
    /**
    * Requests the current playback queue from the Apple TV.
    * @param options Options to send
    * @returns A Promise that resolves to a NewPlayingInfo object.
    */
    requestPlaybackQueue(options) {
        return this.requestPlaybackQueueWithWait(options, true);
    }
    /**
    * Send a key command to the AppleTV.
    * @param key The key to press.
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
            case AppleTV.Key.Suspend:
                return this.sendKeyPressAndRelease(1, 0x82);
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
        let time = Buffer.from('438922cf08020000', 'hex');
        let data = Buffer.concat([
            number_1.default.UInt16toBufferBE(usePage),
            number_1.default.UInt16toBufferBE(usage),
            down ? number_1.default.UInt16toBufferBE(1) : number_1.default.UInt16toBufferBE(0)
        ]);
        let body = {
            hidEventData: Buffer.concat([
                time,
                Buffer.from('00000000000000000100000000000000020' + '00000200000000300000001000000000000', 'hex'),
                data,
                Buffer.from('0000000000000001000000', 'hex')
            ])
        };
        let that = this;
        return this.sendMessage("SendHIDEventMessage", "SendHIDEventMessage", body, false)
            .then(() => {
            return that;
        });
    }
    requestPlaybackQueueWithWait(options, waitForResponse) {
        var params = options;
        params.requestID = uuid_1.v4();
        if (options.artworkSize) {
            params.artworkWidth = options.artworkSize.width;
            params.artworkHeight = options.artworkSize.height;
            delete params.artworkSize;
        }
        return this.sendMessage("PlaybackQueueRequestMessage", "PlaybackQueueRequestMessage", params, waitForResponse);
    }
    sendIntroduction() {
        let body = {
            uniqueIdentifier: this.pairingId,
            name: 'node-appletv',
            localizedModelName: 'iPhone',
            systemBuildVersion: '14G60',
            applicationBundleIdentifier: 'com.apple.TVRemote',
            applicationBundleVersion: '273.12',
            protocolVersion: 1
        };
        return this.sendMessage('DeviceInfoMessage', 'DeviceInfoMessage', body, true);
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
                .connection
                .send(message, false, that.credentials);
        });
    }
    sendClientUpdatesConfig() {
        let message = {
            artworkUpdates: true,
            nowPlayingUpdates: true,
            volumeUpdates: true,
            keyboardUpdates: true
        };
        return this.sendMessage('ClientUpdatesConfigMessage', 'ClientUpdatesConfigMessage', message, false);
    }
    sendWakeDevice() {
        return this.sendMessage('WakeDeviceMessage', 'WakeDeviceMessage', {}, false);
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
    }
    AppleTV.key = key;
})(AppleTV = exports.AppleTV || (exports.AppleTV = {}));
