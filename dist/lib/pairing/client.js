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
const ed25519 = require("ed25519");
const srp_1 = require("./srp");
const credentials_1 = require("../credentials");
const tlv_1 = require("../util/tlv");
const types_1 = require("./types");
class PairingClient extends events_1.EventEmitter {
    constructor(device) {
        super();
        this.device = device;
        this.nextSetupState = null;
        this.nextVerifyState = null;
        this.srp = new srp_1.SRPClientAuth(device.uid);
    }
    pair() {
        return __awaiter(this, void 0, void 0, function* () {
            this.nextSetupState = types_1.PairSetupState.M2;
            var resolver;
            var rejecter;
            let promise = new Promise((resolve, reject) => {
                resolver = resolve;
                rejecter = reject;
            });
            this.callback = resolver;
            var readyForPin;
            let pinPromise = new Promise((resolve, reject) => {
                readyForPin = resolve;
            });
            this.readyForPin = readyForPin;
            yield this.pairSetupM1();
            yield pinPromise;
            return (pin) => __awaiter(this, void 0, void 0, function* () {
                yield this.pairSetupM3(pin);
                // setTimeout(() => {
                //   rejecter(new Error("Pairing timed out"));
                // }, 5000);
                return promise;
            });
        });
    }
    verify() {
        return __awaiter(this, void 0, void 0, function* () {
            this.nextVerifyState = types_1.PairVerifyState.M2;
            var resolver;
            let promise = new Promise((resolve, reject) => {
                resolver = resolve;
            });
            this.callback = resolver;
            yield this.pairVerifyM1();
            return promise;
        });
    }
    handle(message) {
        return __awaiter(this, void 0, void 0, function* () {
            let pairingData = message.payload.pairingData;
            let data = tlv_1.default.decode(pairingData);
            let defaultState = this.nextVerifyState != null ? types_1.PairState.Verify : types_1.PairState.Setup;
            if (data[tlv_1.default.Tag.BackOff]) {
                let backOff = data[tlv_1.default.Tag.BackOff];
                let seconds = backOff.readIntBE(0, backOff.byteLength);
                if (seconds > 0) {
                    throw new Error("You've attempt to pair too recently. Try again in " + seconds + " seconds.");
                }
            }
            if (data[tlv_1.default.Tag.ErrorCode]) {
                let buffer = data[tlv_1.default.Tag.ErrorCode];
                throw new Error(this.device.name + " responded with error code " + buffer.readIntBE(0, buffer.byteLength) + ". Try rebooting your Apple TV.");
            }
            switch (message.payload.state || defaultState) {
                case types_1.PairState.Setup:
                    yield this.handleSetup(data);
                    break;
                case types_1.PairState.Verify:
                    yield this.handleVerify(data);
                    break;
                default:
                    this.emit('debug', `Unknown pairing state ${message.payload.state}. ${JSON.stringify(data, null, 2)}`);
                    break;
            }
        });
    }
    handleSetup(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let sequence = data[tlv_1.default.Tag.Sequence].readInt8(0);
            this.emit('debug', `[Client] <<<< Received Setup M${sequence} Payload${sequence == this.nextSetupState ? "" : ` (Expected M${this.nextSetupState})`}`);
            if (sequence != this.nextSetupState) {
                return;
            }
            switch (sequence) {
                case types_1.PairSetupState.M2:
                    this.nextSetupState = types_1.PairSetupState.M4;
                    yield this.pairSetupM2(data);
                    this.readyForPin();
                    this.readyForPin = null;
                    break;
                case types_1.PairSetupState.M4:
                    yield this.pairSetupM4(data);
                    this.nextSetupState = types_1.PairSetupState.M6;
                    yield this.pairSetupM5();
                    break;
                case types_1.PairSetupState.M6:
                    this.device.credentials = yield this.pairSetupM6(data);
                    this.nextSetupState = null;
                    this.callback(this.device);
                    this.callback = null;
                    this.emit('debug', `[Client] Credentials: ${JSON.stringify(this.device.credentials.toJSON(), null, 2)}`);
                    break;
                default:
                    break;
            }
        });
    }
    handleVerify(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let sequence = data[tlv_1.default.Tag.Sequence].readInt8(0);
            this.emit('debug', `[Client] <<<< Received Verify M${sequence} Payload${sequence == this.nextVerifyState ? "" : ` (Expected M${this.nextVerifyState})`}`);
            if (sequence != this.nextVerifyState) {
                return;
            }
            switch (sequence) {
                case types_1.PairVerifyState.M2:
                    yield this.pairVerifyM2(data);
                    this.nextVerifyState = types_1.PairVerifyState.M4;
                    yield this.pairVerifyM3();
                    break;
                case types_1.PairVerifyState.M4:
                    yield this.pairVerifyM4(data);
                    this.nextVerifyState = null;
                    this.emit('debug', `[Client] Credentials: ${JSON.stringify(this.device.credentials.toJSON(true), null, 2)}`);
                    this.callback(this.device);
                    this.callback = null;
                    break;
                default:
                    break;
            }
        });
    }
    pairSetupM1() {
        return __awaiter(this, void 0, void 0, function* () {
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.PairingMethod, 0x00, tlv_1.default.Tag.Sequence, types_1.PairSetupState.M1);
            let requestMessage = {
                status: 0,
                isUsingSystemPairing: true,
                isRetrying: false,
                state: types_1.PairState.Setup,
                pairingData: tlvData
            };
            this.emit('debug', `[Client] >>>> Sending Setup M1 Payload`);
            yield this.device.sendMessage({
                type: 'CryptoPairingMessage',
                body: requestMessage
            });
        });
    }
    pairSetupM2(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.srp.salt = data[tlv_1.default.Tag.Salt];
            this.srp.serverSessionPublicKey = data[tlv_1.default.Tag.PublicKey];
            if (this.srp.salt.byteLength != 16) {
                throw new Error(`salt must be 16 bytes (but was ${this.srp.salt.byteLength})`);
            }
            if (this.srp.serverSessionPublicKey.byteLength !== 384) {
                throw new Error(`serverSessionPublicKey must be 384 bytes (but was ${this.srp.serverSessionPublicKey.byteLength})`);
            }
        });
    }
    pairSetupM3(pin) {
        return __awaiter(this, void 0, void 0, function* () {
            let proof = this.srp.setPassword(pin);
            // this.emit('debug', "DEBUG: Client Public Key=" + this.publicKey.toString('hex') + "\nProof=" + this.proof.toString('hex'));
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.Sequence, types_1.PairSetupState.M3, tlv_1.default.Tag.PublicKey, this.srp.clientSessionPublicKey, tlv_1.default.Tag.Proof, proof);
            let message = {
                status: 0,
                state: types_1.PairState.Setup,
                pairingData: tlvData
            };
            this.emit('debug', `[Client] >>>> Sending Setup M3 Payload`);
            yield this.device.sendMessage({
                type: 'CryptoPairingMessage',
                body: message
            });
        });
    }
    pairSetupM4(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let proof = data[tlv_1.default.Tag.Proof];
            // this.emit('debug', "DEBUG: Device Proof=" + this.deviceProof.toString('hex'));
            this.srp.verifyProof(proof);
        });
    }
    pairSetupM5() {
        return __awaiter(this, void 0, void 0, function* () {
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.Username, Buffer.from(this.device.uid), tlv_1.default.Tag.PublicKey, this.srp.publicKey, tlv_1.default.Tag.Signature, this.srp.signature);
            let encryptedTLV = this.srp.encrypt(tlvData, Buffer.from('PS-Msg05'));
            // this.emit('debug', "DEBUG: Encrypted Data=" + encryptedTLV.toString('hex'));
            let outerTLV = tlv_1.default.encode(tlv_1.default.Tag.Sequence, types_1.PairSetupState.M5, tlv_1.default.Tag.EncryptedData, encryptedTLV);
            let nextMessage = {
                status: 0,
                state: types_1.PairState.Setup,
                pairingData: outerTLV
            };
            this.emit('debug', `[Client] >>>> Sending Setup M5 Payload`);
            yield this.device.sendMessage({
                type: 'CryptoPairingMessage',
                body: nextMessage
            });
        });
    }
    pairSetupM6(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let encryptedData = data[tlv_1.default.Tag.EncryptedData];
            let decrpytedData = this.srp.decrypt(encryptedData, Buffer.from('PS-Msg06'));
            let tlvData = tlv_1.default.decode(decrpytedData);
            return new credentials_1.Credentials(this.device.uid, tlvData[tlv_1.default.Tag.Username].toString(), tlvData[tlv_1.default.Tag.PublicKey], this.srp.seed);
        });
    }
    pairVerifyM1() {
        return __awaiter(this, void 0, void 0, function* () {
            this.session = new srp_1.SRPClientSession(Buffer.from(this.device.credentials.localUid));
            let encodedData = tlv_1.default.encode(tlv_1.default.Tag.Sequence, types_1.PairVerifyState.M1, tlv_1.default.Tag.PublicKey, this.session.publicKey);
            let message = {
                status: 0,
                state: types_1.PairState.Verify,
                isRetrying: true,
                isUsingSystemPairing: true,
                pairingData: encodedData
            };
            this.emit('debug', `[Client] >>>> Sending Verify M1 Payload`);
            yield this.device.sendMessage({
                type: 'CryptoPairingMessage',
                body: message
            });
        });
    }
    pairVerifyM2(data) {
        return __awaiter(this, void 0, void 0, function* () {
            let publicKey = data[tlv_1.default.Tag.PublicKey];
            this.session.setSessionPublicKey(publicKey, this.device.credentials.ltsk);
            let encryptedData = data[tlv_1.default.Tag.EncryptedData];
            if (publicKey.length != 32) {
                throw new Error(`serverPublicKey must be 32 bytes (but was ${publicKey.length})`);
            }
            let decryptedData = this.session.decrypt(encryptedData, Buffer.from('PV-Msg02'));
            let tlvData = tlv_1.default.decode(decryptedData);
            let identifier = tlvData[tlv_1.default.Tag.Username];
            let signature = tlvData[tlv_1.default.Tag.Signature];
            if (!identifier.equals(Buffer.from(this.device.credentials.remoteUid))) {
                throw new Error(`Identifier mismatch. Expected ${this.device.credentials.remoteUid} but got ${identifier.toString()}`);
            }
            let deviceInfo = Buffer.concat([publicKey, Buffer.from(identifier), this.session.publicKey]);
            if (!ed25519.Verify(deviceInfo, signature, this.device.credentials.ltpk)) {
                throw new Error("Signature verification failed");
            }
        });
    }
    pairVerifyM3() {
        return __awaiter(this, void 0, void 0, function* () {
            let plainTLV = tlv_1.default.encode(tlv_1.default.Tag.Username, this.session.username, tlv_1.default.Tag.Signature, this.session.signature);
            let encryptedTLV = this.session.encrypt(plainTLV, Buffer.from('PV-Msg03'));
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.Sequence, types_1.PairVerifyState.M3, tlv_1.default.Tag.EncryptedData, encryptedTLV);
            let message = {
                status: 0,
                state: types_1.PairState.Verify,
                isRetrying: false,
                isUsingSystemPairing: true,
                pairingData: tlvData
            };
            this.emit('debug', `[Client] >>>> Sending Verify M3 Payload`);
            yield this.device.sendMessage({
                type: 'CryptoPairingMessage',
                body: message
            });
        });
    }
    pairVerifyM4(data) {
        return __awaiter(this, void 0, void 0, function* () {
            this.device.credentials.readKey = this.session.readKey;
            this.device.credentials.writeKey = this.session.writeKey;
            return this.device.credentials;
        });
    }
}
exports.PairingClient = PairingClient;
