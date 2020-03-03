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
const protobufjs_1 = require("protobufjs");
const uuid_1 = require("uuid");
const net_1 = require("net");
const appletv_1 = require("./appletv");
const pairing_1 = require("./pairing");
const now_playing_info_1 = require("./now-playing-info");
const supported_command_1 = require("./supported-command");
const message_1 = require("./message");
const number_1 = require("./util/number");
class TVClient extends appletv_1.AppleTV {
    constructor(service, socket) {
        super(service.txtRecord.Name, service.port);
        this.service = service;
        this.remoteUid = service.txtRecord.LocalAirPlayReceiverPairingIdentity;
        this.address = service.addresses.filter(x => x.includes('.'))[0];
        this.socket = socket || new net_1.Socket();
        this.pairingClient = new pairing_1.PairingClient(this);
        this.pairingClient.on('debug', ((message) => {
            this.emit('debug', message);
            this.emit('pairDebug', message);
        }).bind(this));
        this.setupListeners();
    }
    /**
    * Pair with an already discovered AppleTV.
    * @returns A promise that resolves to the AppleTV object.
    */
    pair() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.pairingClient.pair();
        });
    }
    /**
    * Opens a connection to the AppleTV over the MRP protocol.
    * @param credentials  The credentials object for this AppleTV
    * @returns A promise that resolves to the AppleTV object.
    */
    open(credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            if (credentials) {
                this.uid = credentials.localUid.toString();
            }
            this.credentials = credentials;
            let root = yield protobufjs_1.load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"));
            this.ProtocolMessage = root.lookupType("ProtocolMessage");
            yield this.openSocket();
            yield this.sendIntroduction(this.socket, {
                name: 'node-appletv',
                localizedModelName: 'iPhone',
                systemBuildVersion: '14G60',
                applicationBundleIdentifier: 'com.apple.TVRemote',
                applicationBundleVersion: '320.18',
                protocolVersion: 1,
                allowsPairing: true,
                lastSupportedMessageType: 45,
                supportsSystemPairing: true,
            });
            yield this.beginSession();
            return this;
        });
    }
    beginSession() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.credentials && !this.credentials.readKey) {
                yield this.pairingClient.verify();
                this.emit('debug', "DEBUG: Keys Read=" + this.credentials.readKey.toString('hex') + ", Write=" + this.credentials.writeKey.toString('hex'));
                yield this.sendConnectionState();
                yield this.sendClientUpdatesConfig({
                    nowPlayingUpdates: true,
                    artworkUpdates: true,
                    keyboardUpdates: false,
                    volumeUpdates: false
                });
            }
            return this;
        });
    }
    openSocket() {
        return __awaiter(this, void 0, void 0, function* () {
            let that = this;
            return new Promise((resolve, reject) => {
                that.socket.connect(this.port, this.address, function () {
                    that.socket.on('data', (data) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            yield that.handleChunk(data, that.socket, that.credentials);
                        }
                        catch (error) {
                            that.emit('error', error);
                        }
                    }));
                    resolve();
                });
            });
        });
    }
    close() {
        this.socket.end();
    }
    /**
    * Requests the current playback queue from the Apple TV.
    * @param options Options to send
    * @returns A Promise that resolves to a NewPlayingInfo object.
    */
    requestPlaybackQueue(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.requestPlaybackQueueWithWait(options, true);
        });
    }
    /**
    * Requests the current artwork from the Apple TV.
    * @param width Image width
    * @param height Image height
    * @returns A Promise that resolves to a Buffer of data.
    */
    requestArtwork(width = 400, height = 400) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield this.requestPlaybackQueueWithWait({
                artworkSize: {
                    width: width,
                    height: height
                },
                length: 1,
                location: 0
            }, true);
            let data = (_e = (_d = (_c = (_b = (_a = response) === null || _a === void 0 ? void 0 : _a.payload) === null || _b === void 0 ? void 0 : _b.playbackQueue) === null || _c === void 0 ? void 0 : _c.contentItems) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.artworkData;
            if (data) {
                return data;
            }
            else {
                throw new Error("No artwork available");
            }
        });
    }
    /**
    * Send a key command to the AppleTV.
    * @param key The key to press.
    * @returns A promise that resolves to the AppleTV object after the message has been sent.
    */
    sendKeyCommand(key) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (key) {
                case appletv_1.AppleTV.Key.Up:
                    return this.sendKeyPressAndRelease(1, 0x8C);
                case appletv_1.AppleTV.Key.Down:
                    return this.sendKeyPressAndRelease(1, 0x8D);
                case appletv_1.AppleTV.Key.Left:
                    return this.sendKeyPressAndRelease(1, 0x8B);
                case appletv_1.AppleTV.Key.Right:
                    return this.sendKeyPressAndRelease(1, 0x8A);
                case appletv_1.AppleTV.Key.Menu:
                    return this.sendKeyPressAndRelease(1, 0x86);
                case appletv_1.AppleTV.Key.Play:
                    return this.sendKeyPressAndRelease(12, 0xB0);
                case appletv_1.AppleTV.Key.Pause:
                    return this.sendKeyPressAndRelease(12, 0xB1);
                case appletv_1.AppleTV.Key.Next:
                    return this.sendKeyPressAndRelease(12, 0xB5);
                case appletv_1.AppleTV.Key.Previous:
                    return this.sendKeyPressAndRelease(12, 0xB6);
                case appletv_1.AppleTV.Key.Suspend:
                    return this.sendKeyPressAndRelease(1, 0x82);
                case appletv_1.AppleTV.Key.Select:
                    return this.sendKeyPressAndRelease(1, 0x89);
                case appletv_1.AppleTV.Key.Wake:
                    return this.sendKeyPressAndRelease(1, 0x83);
                case appletv_1.AppleTV.Key.Home:
                    return this.sendKeyPressAndRelease(12, 0x40);
                case appletv_1.AppleTV.Key.VolumeUp:
                    return this.sendKeyPressAndRelease(12, 0xE9);
                case appletv_1.AppleTV.Key.VolumeDown:
                    return this.sendKeyPressAndRelease(12, 0xEA);
            }
        });
    }
    sendMessage(options) {
        const _super = Object.create(null, {
            sendMessage: { get: () => super.sendMessage }
        });
        return __awaiter(this, void 0, void 0, function* () {
            options.socket = this.socket;
            return _super.sendMessage.call(this, options);
        });
    }
    send(options) {
        const _super = Object.create(null, {
            send: { get: () => super.send }
        });
        return __awaiter(this, void 0, void 0, function* () {
            options.socket = this.socket;
            return _super.send.call(this, options);
        });
    }
    sendKeyPressAndRelease(usePage, usage) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.sendKeyPress(usePage, usage, true);
            return this.sendKeyPress(usePage, usage, false);
        });
    }
    sendKeyPress(usePage, usage, down) {
        return __awaiter(this, void 0, void 0, function* () {
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
            yield this.sendMessage({
                type: 'SendHIDEventMessage',
                body: body
            });
            return this;
        });
    }
    requestPlaybackQueueWithWait(options, waitForResponse) {
        return __awaiter(this, void 0, void 0, function* () {
            var params = options;
            params.requestID = uuid_1.v4();
            if (options.artworkSize) {
                params.artworkWidth = options.artworkSize.width;
                params.artworkHeight = options.artworkSize.height;
                delete params.artworkSize;
            }
            return this.sendMessage({
                type: 'PlaybackQueueRequestMessage',
                body: params,
                waitForResponse: waitForResponse
            });
        });
    }
    sendConnectionState() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendMessage({
                type: 'SetConnectionStateMessage',
                bodyBuilder: (type) => {
                    let stateEnum = type.lookupEnum('ConnectionState');
                    return {
                        state: stateEnum.values['Connected']
                    };
                }
            });
        });
    }
    sendClientUpdatesConfig(config) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendMessage({
                type: 'ClientUpdatesConfigMessage',
                body: config
            });
        });
    }
    sendWakeDevice() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendMessage({
                type: 'WakeDeviceMessage',
                body: {}
            });
        });
    }
    onReceiveMessage(message) {
        if (message.type == message_1.Message.Type.SetStateMessage) {
            if (message.payload == null) {
                this.emit('nowPlaying', null);
                return;
            }
            if (message.payload.nowPlayingInfo) {
                let info = new now_playing_info_1.NowPlayingInfo(message.payload);
                this.emit('nowPlaying', info);
            }
            if (message.payload.supportedCommands) {
                let commands = (message.payload.supportedCommands.supportedCommands || [])
                    .map(sc => {
                    return new supported_command_1.SupportedCommand(sc.command, sc.enabled || false, sc.canScrub || false);
                });
                this.emit('supportedCommands', commands);
            }
            if (message.payload.playbackQueue) {
                this.emit('playbackQueue', message.payload.playbackQueue);
            }
        }
        else if (message.type == message_1.Message.Type.CryptoPairingMessage) {
            this.pairingClient.handle(message);
        }
    }
    setupListeners() {
        let that = this;
        this.on('message', (message) => {
            that.onReceiveMessage(message);
        });
    }
}
exports.TVClient = TVClient;
