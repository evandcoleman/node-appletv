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
const pairing_1 = require("../lib/pairing");
const tvserver_1 = require("../lib/tvserver");
const tvclient_1 = require("../lib/tvclient");
const message_1 = require("../lib/message");
const net_1 = require("net");
const sinon = require("sinon");
const ed25519 = require("ed25519");
const crypto = require("crypto");
const chai_1 = require("chai");
require("mocha");
describe('apple tv pairing', function () {
    var server;
    var client;
    beforeEach(function () {
        return __awaiter(this, void 0, void 0, function* () {
            let socket = new net_1.Socket({});
            let uid = 'server';
            let tvserver = new tvserver_1.TVServer('test atv', 12345, uid);
            let tvclient = new tvclient_1.TVClient({
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
            }, socket);
            tvclient.uid = 'client';
            let seed = crypto.randomBytes(32);
            let { publicKey, privateKey } = ed25519.MakeKeypair(seed);
            let keyPair = {
                signPk: publicKey,
                signSk: privateKey
            };
            server = new pairing_1.PairingServer(tvserver, keyPair, {
                uid: tvclient.uid,
                name: 'test atv',
                socket
            });
            client = new pairing_1.PairingClient(tvclient);
            sinon.stub(tvclient, 'sendProtocolMessage').callsFake(function (options) {
                return __awaiter(this, void 0, void 0, function* () {
                    let message = new message_1.Message(options.message);
                    yield server.handle(message);
                    return null;
                });
            });
            sinon.stub(tvserver, 'sendProtocolMessage').callsFake(function (options) {
                return __awaiter(this, void 0, void 0, function* () {
                    let message = new message_1.Message(options.message);
                    yield client.handle(message);
                    return null;
                });
            });
        });
    });
    it('should pair and verify', function () {
        return __awaiter(this, void 0, void 0, function* () {
            let sendPin = yield client.pair();
            yield sendPin(server.code);
            chai_1.expect(server.client.credentials).to.exist;
            chai_1.expect(client.device.credentials).to.exist;
            chai_1.expect(server.client.credentials.remoteUid).to.equal(client.device.credentials.localUid);
            chai_1.expect(server.client.credentials.localUid).to.equal(client.device.credentials.remoteUid);
            yield client.verify();
            chai_1.expect(server.client.credentials.readKey.toString('hex')).to.equal(client.device.credentials.writeKey.toString('hex'));
            chai_1.expect(server.client.credentials.writeKey.toString('hex')).to.equal(client.device.credentials.readKey.toString('hex'));
        });
    });
});
