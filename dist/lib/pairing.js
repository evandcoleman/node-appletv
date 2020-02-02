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
const srp = require("fast-srp-hap");
const crypto = require("crypto");
const ed25519 = require("ed25519");
const credentials_1 = require("./credentials");
const tlv_1 = require("./util/tlv");
const encryption_1 = require("./util/encryption");
class Pairing {
    constructor(device) {
        this.device = device;
        this.key = crypto.randomBytes(32);
    }
    /**
    * Initiates the pairing process
    * @returns A promise that resolves to a callback which takes in the pairing pin from the Apple TV.
    */
    initiatePair() {
        return __awaiter(this, void 0, void 0, function* () {
            let that = this;
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.PairingMethod, 0x00, tlv_1.default.Tag.Sequence, 0x01);
            let requestMessage = {
                status: 0,
                isUsingSystemPairing: true,
                isRetrying: true,
                state: 2,
                pairingData: tlvData
            };
            yield this.device.sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', requestMessage, false);
            let message = yield this.device.waitForSequence(0x02);
            let pairingData = message.payload.pairingData;
            let decodedData = tlv_1.default.decode(pairingData);
            if (decodedData[tlv_1.default.Tag.BackOff]) {
                let backOff = decodedData[tlv_1.default.Tag.BackOff];
                let seconds = backOff.readIntBE(0, backOff.byteLength);
                if (seconds > 0) {
                    throw new Error("You've attempt to pair too recently. Try again in " + seconds + " seconds.");
                }
            }
            if (decodedData[tlv_1.default.Tag.ErrorCode]) {
                let buffer = decodedData[tlv_1.default.Tag.ErrorCode];
                throw new Error(this.device.name + " responded with error code " + buffer.readIntBE(0, buffer.byteLength) + ". Try rebooting your Apple TV.");
            }
            this.deviceSalt = decodedData[tlv_1.default.Tag.Salt];
            this.devicePublicKey = decodedData[tlv_1.default.Tag.PublicKey];
            if (this.deviceSalt.byteLength != 16) {
                throw new Error(`salt must be 16 bytes (but was ${this.deviceSalt.byteLength})`);
            }
            if (this.devicePublicKey.byteLength !== 384) {
                throw new Error(`serverPublicKey must be 384 bytes (but was ${this.devicePublicKey.byteLength})`);
            }
            return (pin) => {
                return that.completePairing(pin);
            };
        });
    }
    completePairing(pin) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.sendThirdSequence(pin);
            let message = yield this.device.waitForSequence(0x04);
            let pairingData = message.payload.pairingData;
            this.deviceProof = tlv_1.default.decode(pairingData)[tlv_1.default.Tag.Proof];
            // console.log("DEBUG: Device Proof=" + this.deviceProof.toString('hex'));
            this.srp.checkM2(this.deviceProof);
            let seed = crypto.randomBytes(32);
            let keyPair = ed25519.MakeKeypair(seed);
            let privateKey = keyPair.privateKey;
            let publicKey = keyPair.publicKey;
            let sharedSecret = this.srp.computeK();
            let deviceHash = encryption_1.default.HKDF("sha512", Buffer.from("Pair-Setup-Controller-Sign-Salt"), sharedSecret, Buffer.from("Pair-Setup-Controller-Sign-Info"), 32);
            let deviceInfo = Buffer.concat([deviceHash, Buffer.from(this.device.pairingId), publicKey]);
            let deviceSignature = ed25519.Sign(deviceInfo, privateKey);
            let encryptionKey = encryption_1.default.HKDF("sha512", Buffer.from("Pair-Setup-Encrypt-Salt"), sharedSecret, Buffer.from("Pair-Setup-Encrypt-Info"), 32);
            yield this.sendFifthSequence(publicKey, deviceSignature, encryptionKey);
            let newMessage = yield this.device.waitForSequence(0x06);
            let encryptedData = tlv_1.default.decode(newMessage.payload.pairingData)[tlv_1.default.Tag.EncryptedData];
            let cipherText = encryptedData.slice(0, -16);
            let hmac = encryptedData.slice(-16);
            let decrpytedData = encryption_1.default.verifyAndDecrypt(cipherText, hmac, null, Buffer.from('PS-Msg06'), encryptionKey);
            let tlvData = tlv_1.default.decode(decrpytedData);
            this.device.credentials = new credentials_1.Credentials(this.device.uid, tlvData[tlv_1.default.Tag.Username], this.device.pairingId, tlvData[tlv_1.default.Tag.PublicKey], seed);
            return this.device;
        });
    }
    sendThirdSequence(pin) {
        return __awaiter(this, void 0, void 0, function* () {
            this.srp = srp.Client(srp.params['3072'], this.deviceSalt, Buffer.from('Pair-Setup'), Buffer.from(pin), this.key);
            this.srp.setB(this.devicePublicKey);
            this.publicKey = this.srp.computeA();
            this.proof = this.srp.computeM1();
            // console.log("DEBUG: Client Public Key=" + this.publicKey.toString('hex') + "\nProof=" + this.proof.toString('hex'));
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.Sequence, 0x03, tlv_1.default.Tag.PublicKey, this.publicKey, tlv_1.default.Tag.Proof, this.proof);
            let message = {
                status: 0,
                pairingData: tlvData
            };
            return yield this.device.sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', message, false);
        });
    }
    sendFifthSequence(publicKey, signature, encryptionKey) {
        return __awaiter(this, void 0, void 0, function* () {
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.Username, Buffer.from(this.device.pairingId), tlv_1.default.Tag.PublicKey, publicKey, tlv_1.default.Tag.Signature, signature);
            let encryptedTLV = Buffer.concat(encryption_1.default.encryptAndSeal(tlvData, null, Buffer.from('PS-Msg05'), encryptionKey));
            // console.log("DEBUG: Encrypted Data=" + encryptedTLV.toString('hex'));
            let outerTLV = tlv_1.default.encode(tlv_1.default.Tag.Sequence, 0x05, tlv_1.default.Tag.EncryptedData, encryptedTLV);
            let nextMessage = {
                status: 0,
                pairingData: outerTLV
            };
            return yield this.device.sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', nextMessage, false);
        });
    }
}
exports.Pairing = Pairing;
