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
const appletv_1 = require("../lib/appletv");
const message_1 = require("../lib/message");
const chai_1 = require("chai");
const net_1 = require("net");
const util_1 = require("util");
const sinon = require("sinon");
require("mocha");
describe('apple tv tests', function () {
    beforeEach(function () {
        let socket = new net_1.Socket({});
        sinon.stub(socket, 'write');
        sinon.stub(socket, 'connect').callsFake(function (port, host, callback) {
            callback();
        });
        this.device = new appletv_1.AppleTV({
            addresses: ['127.0.0.1'],
            port: 12345,
            flags: 0,
            fullname: '',
            host: '',
            interfaceIndex: 0,
            networkInterface: '',
            replyDomain: '',
            type: null,
            txtRecord: {
                Name: "Mock Apple TV",
                UniqueIdentifier: "MockAppleTVUUID"
            }
        }, socket);
        this.fake = sinon.stub(this.device.connection, 'sendProtocolMessage');
        this.device.connection.isOpen = true;
        this.sentMessages = function () {
            var messages = [];
            for (var i = 0; i < this.fake.callCount; i++) {
                messages.push(new message_1.Message(this.fake.getCall(i).args[0]));
            }
            return messages;
        };
    });
    it('should send introduction', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.device.openConnection();
            let messages = this.sentMessages();
            chai_1.expect(messages.length).to.equal(1);
            chai_1.expect(messages[0].type).to.equal(message_1.Message.Type.DeviceInfoMessage);
        });
    });
    it('should request artwork', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let width = 640;
            let height = 480;
            yield this.device.openConnection();
            try {
                yield this.device.requestArtwork(width, height);
            }
            catch (error) { }
            let messages = this.sentMessages();
            chai_1.expect(messages.length).to.equal(2);
            chai_1.expect(messages[1].type).to.equal(message_1.Message.Type.PlaybackQueueRequestMessage);
            chai_1.expect(messages[1].payload.artworkWidth).to.equal(width);
            chai_1.expect(messages[1].payload.artworkHeight).to.equal(height);
            chai_1.expect(messages[1].payload.length).to.equal(1);
            chai_1.expect(messages[1].payload.location).to.equal(0);
        });
    });
    it('should press and release menu', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.device.openConnection();
            yield this.device.sendKeyCommand(appletv_1.AppleTV.Key.Menu);
            let messages = this.sentMessages();
            chai_1.expect(messages.length).to.equal(3);
            chai_1.expect(messages[1].type).to.equal(message_1.Message.Type.SendHidEventMessage);
            chai_1.expect(messages[2].type).to.equal(message_1.Message.Type.SendHidEventMessage);
        });
    });
    it('should read now playing', function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.device.openConnection();
            setTimeout(function () {
                this.device.connection.emit('message', require('./fixtures/now-playing.json'));
            }.bind(this), 500);
            let nowPlaying = yield util_1.promisify(this.device.on).bind(this.device)('nowPlaying');
            console.log(nowPlaying);
            let messages = this.sentMessages();
            chai_1.expect(messages.length).to.equal(2);
            chai_1.expect(messages[1].type).to.equal(message_1.Message.Type.SetStateMessage);
        });
    });
});
