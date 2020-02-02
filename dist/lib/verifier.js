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
const ed25519 = require("ed25519");
const curve25519 = require("curve25519-n2");
const tlv_1 = require("./util/tlv");
const encryption_1 = require("./util/encryption");
class Verifier {
    constructor(device) {
        this.device = device;
    }
    verify() {
        return __awaiter(this, void 0, void 0, function* () {
            var verifyPrivate = Buffer.alloc(32);
            curve25519.makeSecretKey(verifyPrivate);
            let verifyPublic = curve25519.derivePublicKey(verifyPrivate);
            let { sessionPublicKey, encryptionKey, sharedSecret, pairingData } = yield this.requestPairingData(verifyPublic, verifyPrivate);
            let tlvData = tlv_1.default.decode(pairingData);
            let identifier = tlvData[tlv_1.default.Tag.Username];
            let signature = tlvData[tlv_1.default.Tag.Signature];
            if (!identifier.equals(this.device.credentials.identifier)) {
                throw new Error("Identifier mismatch");
            }
            let deviceInfo = Buffer.concat([sessionPublicKey, Buffer.from(identifier), verifyPublic]);
            if (!ed25519.Verify(deviceInfo, signature, this.device.credentials.publicKey)) {
                throw new Error("Signature verification failed");
            }
            return yield this.completeVerification(verifyPublic, sessionPublicKey, encryptionKey, sharedSecret);
        });
    }
    requestPairingData(verifyPublic, verifyPrivate) {
        return __awaiter(this, void 0, void 0, function* () {
            let encodedData = tlv_1.default.encode(tlv_1.default.Tag.Sequence, 0x01, tlv_1.default.Tag.PublicKey, verifyPublic);
            let message = {
                status: 0,
                state: 3,
                isRetrying: true,
                isUsingSystemPairing: true,
                pairingData: encodedData
            };
            yield this.device.sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', message, false);
            let pairingDataResponse = yield this.device.waitForSequence(0x02);
            let pairingData = pairingDataResponse.payload.pairingData;
            let decodedData = tlv_1.default.decode(pairingData);
            let sessionPublicKey = decodedData[tlv_1.default.Tag.PublicKey];
            let encryptedData = decodedData[tlv_1.default.Tag.EncryptedData];
            if (sessionPublicKey.length != 32) {
                throw new Error(`sessionPublicKey must be 32 bytes (but was ${sessionPublicKey.length})`);
            }
            let cipherText = encryptedData.slice(0, -16);
            let hmac = encryptedData.slice(-16);
            let sharedSecret = curve25519.deriveSharedSecret(verifyPrivate, sessionPublicKey);
            let encryptionKey = encryption_1.default.HKDF("sha512", Buffer.from("Pair-Verify-Encrypt-Salt"), sharedSecret, Buffer.from("Pair-Verify-Encrypt-Info"), 32);
            let decryptedData = encryption_1.default.verifyAndDecrypt(cipherText, hmac, null, Buffer.from('PV-Msg02'), encryptionKey);
            return {
                sessionPublicKey: sessionPublicKey,
                sharedSecret: sharedSecret,
                encryptionKey: encryptionKey,
                pairingData: decryptedData
            };
        });
    }
    completeVerification(verifyPublic, sessionPublicKey, encryptionKey, sharedSecret) {
        return __awaiter(this, void 0, void 0, function* () {
            let material = Buffer.concat([verifyPublic, Buffer.from(this.device.credentials.pairingId), sessionPublicKey]);
            let keyPair = ed25519.MakeKeypair(this.device.credentials.encryptionKey);
            let signed = ed25519.Sign(material, keyPair);
            let plainTLV = tlv_1.default.encode(tlv_1.default.Tag.Username, Buffer.from(this.device.credentials.pairingId), tlv_1.default.Tag.Signature, signed);
            let encryptedTLV = Buffer.concat(encryption_1.default.encryptAndSeal(plainTLV, null, Buffer.from('PV-Msg03'), encryptionKey));
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.Sequence, 0x03, tlv_1.default.Tag.EncryptedData, encryptedTLV);
            let message = {
                status: 0,
                state: 3,
                isRetrying: false,
                isUsingSystemPairing: true,
                pairingData: tlvData
            };
            yield this.device.sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', message, false);
            yield this.device.waitForSequence(0x04);
            let readKey = encryption_1.default.HKDF("sha512", Buffer.from("MediaRemote-Salt"), sharedSecret, Buffer.from("MediaRemote-Read-Encryption-Key"), 32);
            let writeKey = encryption_1.default.HKDF("sha512", Buffer.from("MediaRemote-Salt"), sharedSecret, Buffer.from("MediaRemote-Write-Encryption-Key"), 32);
            return {
                readKey: readKey,
                writeKey: writeKey
            };
        });
    }
}
exports.Verifier = Verifier;
