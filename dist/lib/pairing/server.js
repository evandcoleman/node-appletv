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
const events_1 = require("events");
const srp_1 = require("./srp");
const credentials_1 = require("../credentials");
const tlv_1 = require("../util/tlv");
const types_1 = require("./types");
class PairingServer extends events_1.EventEmitter {
    constructor(device, keyPair, client) {
        super();
        this.device = device;
        this.client = client;
        this.nextSetupState = types_1.PairSetupState.M1;
        this.nextVerifyState = types_1.PairVerifyState.M1;
        this.code = Math.floor(1000 + Math.random() * 9000).toString();
        this.srp = new srp_1.SRPServerAuth(device.uid, keyPair, this.code);
    }
    handle(message) {
        return __awaiter(this, void 0, void 0, function* () {
            let pairingData = message.payload.pairingData;
            let decoded = tlv_1.default.decode(pairingData);
            let defaultState = this.nextVerifyState != null ? types_1.PairState.Verify : types_1.PairState.Setup;
            switch (message.payload.state || defaultState) {
                case types_1.PairState.Setup:
                    yield this.handleSetup(decoded);
                    break;
                case types_1.PairState.Verify:
                    yield this.handleVerify(decoded);
                    break;
            }
        });
    }
    handleSetup(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let sequence = data[tlv_1.default.Tag.Sequence].readInt8(0);
            this.emit('debug', `[Server] <<<< Received Setup M${sequence} Payload${sequence == this.nextSetupState ? "" : ` (Expected M${this.nextSetupState})`}`);
            if (sequence != this.nextSetupState && sequence != types_1.PairSetupState.M1) {
                return;
            }
            switch (sequence) {
                case types_1.PairSetupState.M1:
                    yield this.pairSetupM1(data);
                    this.nextSetupState = types_1.PairSetupState.M3;
                    yield this.pairSetupM2();
                    break;
                case types_1.PairSetupState.M3:
                    yield this.pairSetupM3(data);
                    this.nextSetupState = types_1.PairSetupState.M5;
                    yield this.pairSetupM4();
                    break;
                case types_1.PairSetupState.M5:
                    yield this.pairSetupM5(data);
                    yield this.pairSetupM6();
                    this.nextSetupState = types_1.PairSetupState.M1;
                    this.nextVerifyState = types_1.PairVerifyState.M1;
                    this.emit('clientPaired', this.client);
                    this.emit('debug', `[Server] Credentials: ${JSON.stringify(this.client.credentials.toJSON(), null, 2)}`);
                    break;
                default:
                    break;
            }
        });
    }
    handleVerify(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let sequence = data[tlv_1.default.Tag.Sequence].readInt8(0);
            this.emit('debug', `[Server] <<<< Received Verify M${sequence} Payload${sequence == this.nextVerifyState ? "" : ` (Expected M${this.nextVerifyState})`}`);
            if (sequence != this.nextVerifyState && sequence != types_1.PairVerifyState.M1) {
                return;
            }
            switch (sequence) {
                case types_1.PairVerifyState.M1:
                    yield this.pairVerifyM1(data);
                    this.nextVerifyState = types_1.PairVerifyState.M3;
                    yield this.pairVerifyM2();
                    break;
                case types_1.PairVerifyState.M3:
                    yield this.pairVerifyM3(data);
                    this.nextVerifyState = types_1.PairVerifyState.M1;
                    yield this.pairVerifyM4();
                    this.emit('debug', `[Server] Credentials: ${JSON.stringify(this.client.credentials.toJSON(true), null, 2)}`);
                    break;
                default:
                    break;
            }
        });
    }
    pairSetupM1(data) {
        return __awaiter(this, void 0, void 0, function* () {
        });
    }
    pairSetupM2() {
        return __awaiter(this, void 0, void 0, function* () {
            this.emit('debug', `Code for '${this.client.name}' is ${this.code}`);
            let encoded = tlv_1.default.encode(tlv_1.default.Tag.Salt, this.srp.salt, tlv_1.default.Tag.PublicKey, this.srp.sessionPublicKey, tlv_1.default.Tag.Sequence, types_1.PairSetupState.M2);
            this.emit('debug', `[Server] >>>> Sending Setup M2 Payload`);
            yield this.device.sendMessage({
                type: 'CryptoPairingMessage',
                body: {
                    status: 0,
                    pairingData: encoded
                },
                socket: this.client.socket
            });
        });
    }
    pairSetupM3(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let publicKey = data[tlv_1.default.Tag.PublicKey];
            let proof = data[tlv_1.default.Tag.Proof];
            if (proof.byteLength != 64) {
                throw new Error(`proof must be 64 bytes (but was ${proof.byteLength})`);
            }
            if (publicKey.byteLength !== 384) {
                throw new Error(`publicKey must be 384 bytes (but was ${publicKey.byteLength})`);
            }
            this.srp.setClientSessionPublicKey(publicKey);
            try {
                this.srp.verifyProof(proof);
            }
            catch (error) {
                throw new Error(`Invalid PIN entered.`);
            }
        });
    }
    pairSetupM4() {
        return __awaiter(this, void 0, void 0, function* () {
            let encoded = tlv_1.default.encode(tlv_1.default.Tag.Proof, this.srp.serverProof, tlv_1.default.Tag.Sequence, types_1.PairSetupState.M4);
            this.emit('debug', `[Server] >>>> Sending Setup M4 Payload`);
            yield this.device.sendMessage({
                type: 'CryptoPairingMessage',
                body: {
                    status: 0,
                    pairingData: encoded
                },
                socket: this.client.socket
            });
        });
    }
    pairSetupM5(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let encryptedData = data[tlv_1.default.Tag.EncryptedData];
            let decryptedData = tlv_1.default.decode(this.srp.decrypt(encryptedData, Buffer.from('PS-Msg05')));
            let clientUsername = decryptedData[tlv_1.default.Tag.Username];
            let clientPublicKey = decryptedData[tlv_1.default.Tag.PublicKey];
            let signature = decryptedData[tlv_1.default.Tag.Signature];
            let credentials = new credentials_1.Credentials(this.device.uid, clientUsername.toString(), clientPublicKey, this.srp.seed);
            this.client.credentials = credentials;
        });
    }
    pairSetupM6() {
        return __awaiter(this, void 0, void 0, function* () {
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.Username, Buffer.from(this.device.uid), tlv_1.default.Tag.PublicKey, this.srp.publicKey, tlv_1.default.Tag.Signature, this.srp.signature);
            let encryptedData = this.srp.encrypt(tlvData, Buffer.from('PS-Msg06'));
            let encoded = tlv_1.default.encode(tlv_1.default.Tag.EncryptedData, encryptedData, tlv_1.default.Tag.Sequence, types_1.PairSetupState.M6);
            this.emit('debug', `[Server] >>>> Sending Setup M6 Payload`);
            yield this.device.sendMessage({
                type: 'CryptoPairingMessage',
                body: {
                    status: 0,
                    pairingData: encoded
                },
                socket: this.client.socket
            });
        });
    }
    pairVerifyM1(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let clientPublicKey = data[tlv_1.default.Tag.PublicKey];
            if (clientPublicKey.length != 32) {
                throw new Error(`clientPublicKey must be 32 bytes (but was ${clientPublicKey.length})`);
            }
            this.session = new srp_1.SRPServerSession(this.device.uid, this.srp.keyPair, clientPublicKey);
        });
    }
    pairVerifyM2() {
        return __awaiter(this, void 0, void 0, function* () {
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.Username, this.session.username, tlv_1.default.Tag.Signature, this.session.signature);
            let encrypted = this.session.encrypt(tlvData, Buffer.from('PV-Msg02'));
            let encoded = tlv_1.default.encode(tlv_1.default.Tag.PublicKey, this.session.publicKey, tlv_1.default.Tag.Sequence, types_1.PairSetupState.M2, tlv_1.default.Tag.EncryptedData, encrypted);
            this.emit('debug', `[Server] >>>> Sending Verify M2 Payload`);
            yield this.device.sendMessage({
                type: 'CryptoPairingMessage',
                body: {
                    status: 0,
                    pairingData: encoded
                },
                socket: this.client.socket
            });
        });
    }
    pairVerifyM3(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let encryptedData = data[tlv_1.default.Tag.EncryptedData];
            let decrypted = this.session.decrypt(encryptedData, Buffer.from('PV-Msg03'));
            let decoded = tlv_1.default.decode(decrypted);
            let username = decoded[tlv_1.default.Tag.Username];
            let signature = decoded[tlv_1.default.Tag.Signature];
            if (signature.length != 64) {
                throw new Error(`signature must be 64 bytes (but was ${signature.length})`);
            }
            this.client.credentials.readKey = this.session.readKey;
            this.client.credentials.writeKey = this.session.writeKey;
        });
    }
    pairVerifyM4() {
        return __awaiter(this, void 0, void 0, function* () {
            this.emit('debug', `[Server] >>>> Sending Verify M4 Payload`);
            yield this.device.sendMessage({
                type: 'CryptoPairingMessage',
                body: {
                    status: 0,
                    pairingData: tlv_1.default.encode(tlv_1.default.Tag.Sequence, types_1.PairVerifyState.M4)
                },
                socket: this.client.socket
            });
        });
    }
}
exports.PairingServer = PairingServer;
