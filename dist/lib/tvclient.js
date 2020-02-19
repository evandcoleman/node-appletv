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
const util_1 = require("util");
const appletv_1 = require("./appletv");
const pairing_1 = require("./pairing");
const verifier_1 = require("./verifier");
const now_playing_info_1 = require("./now-playing-info");
const supported_command_1 = require("./supported-command");
const message_1 = require("./message");
const number_1 = require("./util/number");
class TVClient extends appletv_1.AppleTV {
    constructor(service, socket) {
        super(service.txtRecord.Name, service.port, service.txtRecord.UniqueIdentifier);
        this.service = service;
        this.address = service.addresses.filter(x => x.includes('.'))[0];
        this.socket = socket;
        this.setupListeners();
    }
    /**
    * Pair with an already discovered AppleTV.
    * @returns A promise that resolves to the AppleTV object.
    */
    pair() {
        let pairing = new pairing_1.Pairing(this);
        return pairing.initiatePair();
    }
    open(credentials) {
        const _super = Object.create(null, {
            open: { get: () => super.open }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield _super.open.call(this, credentials);
            let open = util_1.promisify(this.socket.connect);
            yield open({
                port: this.port,
                host: this.address
            });
            yield this.sendIntroduction();
            if (credentials) {
                let verifier = new verifier_1.Verifier(this);
                let keys = yield verifier.verify();
                this.credentials.readKey = keys['readKey'];
                this.credentials.writeKey = keys['writeKey'];
                this.emit('debug', "DEBUG: Keys Read=" + this.credentials.readKey.toString('hex') + ", Write=" + this.credentials.writeKey.toString('hex'));
                yield this.sendConnectionState();
            }
            if (credentials) {
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
    close() {
        this.socket.end();
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
    sendConnectionState() {
        let that = this;
        return protobufjs_1.load(path.resolve(__dirname + "/protos/SetConnectionStateMessage.proto"))
            .then(root => {
            let type = root.lookupType('SetConnectionStateMessage');
            let stateEnum = type.lookupEnum('ConnectionState');
            let message = type.create({
                state: stateEnum.values['Connected']
            });
            return this
                .send(message, false, 0, that.credentials);
        });
    }
    sendClientUpdatesConfig(config) {
        return this.sendMessage('ClientUpdatesConfigMessage', 'ClientUpdatesConfigMessage', config, false);
    }
    sendWakeDevice() {
        return this.sendMessage('WakeDeviceMessage', 'WakeDeviceMessage', {}, false);
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
    }
    setupListeners() {
        let that = this;
        this.on('message', (message) => {
            that.onReceiveMessage(message);
        });
    }
}
exports.TVClient = TVClient;
