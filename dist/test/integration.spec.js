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
const tvserver_1 = require("../lib/tvserver");
const tvclient_1 = require("../lib/tvclient");
const message_1 = require("../lib/message");
const appletv_1 = require("../lib/appletv");
const sinon = require("sinon");
const chai_1 = require("chai");
require("mocha");
describe('integration tests', function () {
    var server;
    var client;
    var clientSent;
    var serverSent;
    var clientReceived;
    var serverReceived;
    beforeEach(function () {
        return __awaiter(this, void 0, void 0, function* () {
            let uid = 'server';
            server = new tvserver_1.TVServer('test atv', 12345, uid);
            client = new tvclient_1.TVClient({
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
                    Name: "test atv",
                    LocalAirPlayReceiverPairingIdentity: uid
                }
            });
            client.uid = 'client';
            // sinon.stub(client, 'write').callsFake(function(data: Buffer, socket: Socket) {
            //   serverSocket.emit('data', data);
            // });
            // sinon.stub(server, 'write').callsFake(function(data: Buffer, socket: Socket) {
            //   clientSocket.emit('data', data);
            // });
            clientSent = sinon.spy(client, 'sendProtocolMessage');
            serverSent = sinon.spy(server, 'sendProtocolMessage');
            clientReceived = sinon.spy();
            serverReceived = sinon.spy();
            client.on('message', clientReceived);
            server.on('message', serverReceived);
        });
    });
    it('should succeed', function () {
        return __awaiter(this, void 0, void 0, function* () {
            // server.on('debug', server.log.debug);
            // client.on('debug', client.log.debug);
            yield server.start();
            yield client.open();
            let sendPin = yield client.pair();
            yield sendPin(server.clients[0].pairingServer.code);
            chai_1.expect(server.clients[0].credentials).to.exist;
            chai_1.expect(client.credentials).to.exist;
            chai_1.expect(server.clients[0].credentials.remoteUid).to.equal(client.credentials.localUid);
            chai_1.expect(server.clients[0].credentials.localUid).to.equal(client.credentials.remoteUid);
            chai_1.expect(clientSent.getCall(0).lastArg.message.type).to.equal(message_1.Message.Type.DeviceInfoMessage);
            chai_1.expect(serverSent.getCall(0).lastArg.message.type).to.equal(message_1.Message.Type.DeviceInfoMessage);
            chai_1.expect(clientReceived.getCall(0).args[0].type).to.equal(message_1.Message.Type.DeviceInfoMessage);
            chai_1.expect(serverReceived.getCall(0).args[0].type).to.equal(message_1.Message.Type.DeviceInfoMessage);
            yield client.beginSession();
            yield new Promise(function (resolve) {
                setTimeout(resolve, 100);
            });
            chai_1.expect(server.clients[0].credentials.readKey).to.eql(client.credentials.writeKey);
            chai_1.expect(server.clients[0].credentials.writeKey).to.eql(client.credentials.readKey);
            chai_1.expect(clientSent.lastCall.lastArg.message.type).to.equal(message_1.Message.Type.ClientUpdatesConfigMessage);
            yield client.sendKeyCommand(appletv_1.AppleTV.Key.Menu);
            yield new Promise(function (resolve) {
                setTimeout(resolve, 100);
            });
            chai_1.expect(clientSent.lastCall.lastArg.message.type).to.equal(message_1.Message.Type.SendHidEventMessage);
            chai_1.expect(serverReceived.lastCall.args[0].type).to.equal(message_1.Message.Type.SendHidEventMessage);
        });
    });
});
