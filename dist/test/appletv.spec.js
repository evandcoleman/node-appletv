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
const credentials_1 = require("../lib/credentials");
const appletv_1 = require("../lib/appletv");
const net_1 = require("net");
const sinon = require("sinon");
const chai_1 = require("chai");
require("mocha");
describe('apple tv communication', function () {
    var server;
    var client;
    var messages = {
        client: {
            sent: [],
            received: []
        },
        server: {
            sent: [],
            received: []
        }
    };
    beforeEach(function () {
        return __awaiter(this, void 0, void 0, function* () {
            let clientSocket = new net_1.Socket({});
            let serverSocket = new net_1.Socket({});
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
            }, clientSocket);
            client.uid = 'client';
            client.credentials = new credentials_1.Credentials('client', uid, Buffer.from('bcefd18ff97f3c89bf29c97ddbac05673d10bacdc0e4320eaa42082ca6090ecd', 'hex'), Buffer.from('0482de5dc68271394ff91974f540ac2abbf1baac3a93575c9dd9829f136f5fec', 'hex'));
            server.bindClient(serverSocket);
            server.registerClient({
                uid: 'client',
                name: 'node-appletv',
                credentials: new credentials_1.Credentials(uid, 'client', Buffer.from('9c2b196c9722a2caa21c524b58fa99db267acd8ba7ae8b7cda2ba1cdd284f41a', 'hex'), Buffer.from('bdcb687201a1cda96056c42944e740955af56832c783de6a401c3adc8c903dd0', 'hex')),
                socket: serverSocket
            });
            sinon.stub(client, 'write').callsFake(function (data, socket) {
                serverSocket.emit('data', data);
            });
            sinon.stub(server, 'write').callsFake(function (data, socket) {
                clientSocket.emit('data', data);
            });
            sinon.stub(client, 'sendProtocolMessage').callsFake(function (options) {
                return __awaiter(this, void 0, void 0, function* () {
                    let message = new message_1.Message(options.message);
                    options.socket = clientSocket;
                    messages.client.sent.push(message);
                    messages.server.received.push(message);
                    yield client.sendProtocolMessage.wrappedMethod.bind(client)(message);
                    return null;
                });
            });
            sinon.stub(server, 'sendProtocolMessage').callsFake(function (options) {
                return __awaiter(this, void 0, void 0, function* () {
                    let message = new message_1.Message(options.message);
                    options.socket = serverSocket;
                    messages.client.received.push(message);
                    messages.server.sent.push(message);
                    yield server.sendProtocolMessage.wrappedMethod.bind(server)(message);
                    return null;
                });
            });
        });
    });
    it('should press and release menu', function () {
        var _a, _b, _c, _d;
        return __awaiter(this, void 0, void 0, function* () {
            yield client.sendKeyCommand(appletv_1.AppleTV.Key.Menu);
            chai_1.expect((_a = messages.client.sent[0]) === null || _a === void 0 ? void 0 : _a.type).to.equal(message_1.Message.Type.SendHidEventMessage);
            chai_1.expect((_b = messages.client.sent[1]) === null || _b === void 0 ? void 0 : _b.type).to.equal(message_1.Message.Type.SendHidEventMessage);
            chai_1.expect((_c = messages.server.received[0]) === null || _c === void 0 ? void 0 : _c.type).to.equal(message_1.Message.Type.SendHidEventMessage);
            chai_1.expect((_d = messages.server.received[1]) === null || _d === void 0 ? void 0 : _d.type).to.equal(message_1.Message.Type.SendHidEventMessage);
        });
    });
});
