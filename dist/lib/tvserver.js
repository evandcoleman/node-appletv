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
const mdns = require("mdns");
const path = require("path");
const os = require("os");
const protobufjs_1 = require("protobufjs");
const uuid_1 = require("uuid");
const net_1 = require("net");
const util_1 = require("util");
const appletv_1 = require("./appletv");
const pairing_1 = require("./pairing");
const credentials_store_1 = require("./credentials-store");
const message_1 = require("./message");
class TVServer extends appletv_1.AppleTV {
    constructor(name, port, uid, server) {
        super(name, port, uid || uuid_1.v4());
        this.clients = [];
        this.server = server;
        this.credentialsStore = new credentials_store_1.CredentialsStore(uid);
        this.on('message', this.didReceiveMessage.bind(this));
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            this.advertisement = mdns.createAdvertisement(mdns.tcp('mediaremotetv'), this.port, {
                name: this.name,
                txtRecord: {
                    Name: this.name,
                    UniqueIdentifier: this.uid,
                    SystemBuildVersion: '17K795',
                    BluetoothAddress: '',
                    ModelName: 'Apple TV',
                    macAddress: os.networkInterfaces().en0[0].mac,
                    AllowPairing: 'YES'
                },
                networkInterface: 'en0'
            });
            this.advertisement.start();
            let root = yield protobufjs_1.load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"));
            this.ProtocolMessage = root.lookupType("ProtocolMessage");
            let that = this;
            let listener = (socket) => {
                that.bindClient(socket);
            };
            if (!this.server) {
                this.server = net_1.createServer(listener);
            }
            else {
                this.server.on('connection', listener);
            }
            let listen = util_1.promisify(this.server.listen);
            yield listen.call(this.server, this.port);
            return this;
        });
    }
    didReceiveMessage(message, socket) {
        return __awaiter(this, void 0, void 0, function* () {
            switch (message.type) {
                case message_1.Message.Type.DeviceInfoMessage:
                    let credentials = yield this.credentialsStore.get(message.payload.uniqueIdentifier);
                    var newClient = {
                        uid: message.payload.uniqueIdentifier,
                        name: message.payload.name,
                        credentials: credentials,
                        socket: socket
                    };
                    yield this.registerClient(newClient, socket, message);
                    break;
                case message_1.Message.Type.CryptoPairingMessage:
                    let client = this.getClient(socket);
                    yield client.pairingServer.handle(message);
                    break;
                default:
                    break;
            }
        });
    }
    bindClient(socket) {
        let that = this;
        socket.on('data', function (data) {
            var _a;
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    let client = that.getClient(socket);
                    yield that.handleChunk(data, socket, (_a = client) === null || _a === void 0 ? void 0 : _a.credentials);
                }
                catch (error) {
                    that.emit('error', error);
                }
            });
        });
    }
    registerClient(newClient, socket, message) {
        return __awaiter(this, void 0, void 0, function* () {
            let keyPair = yield this.credentialsStore.keyPair();
            newClient.pairingServer = new pairing_1.PairingServer(this, keyPair, newClient);
            newClient.pairingServer.on('clientPaired', ((client) => __awaiter(this, void 0, void 0, function* () {
                yield this.credentialsStore.add(client.credentials);
            })).bind(this));
            newClient.pairingServer.on('debug', ((message) => {
                this.emit('debug', message);
                this.emit('pairDebug', message);
            }).bind(this));
            this.clients.push(newClient);
            if (message && socket) {
                yield this.sendIntroduction(socket, {
                    name: this.name,
                    localizedModelName: 'Apple TV',
                    systemBuildVersion: '17K795',
                    applicationBundleIdentifier: 'com.apple.mediaremoted',
                    protocolVersion: 1,
                    allowsPairing: true,
                    lastSupportedMessageType: 77,
                    supportsSystemPairing: true,
                }, message.identifier);
            }
        });
    }
    getClient(socket) {
        for (var client of this.clients) {
            if (client.socket == socket) {
                return client;
            }
        }
    }
    stop() {
        this.server.close();
        this.advertisement.stop();
    }
}
exports.TVServer = TVServer;
