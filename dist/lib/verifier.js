"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ed25519 = require("ed25519");
const curve25519 = require("curve25519-n2");
const message_1 = require("./message");
const tlv_1 = require("./util/tlv");
const encryption_1 = require("./util/encryption");
class Verifier {
    constructor(device) {
        this.device = device;
    }
    verify() {
        var verifyPrivate = Buffer.alloc(32);
        curve25519.makeSecretKey(verifyPrivate);
        let verifyPublic = curve25519.derivePublicKey(verifyPrivate);
        let that = this;
        let tlvData = tlv_1.default.encode(tlv_1.default.Tag.Sequence, 0x01, tlv_1.default.Tag.PublicKey, verifyPublic);
        let message = {
            status: 0,
            state: 3,
            isRetrying: true,
            isUsingSystemPairing: true,
            pairingData: tlvData
        };
        return that.device
            .sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', message, false)
            .then(() => {
            return that.waitForSequence(0x02);
        })
            .then(message => {
            let pairingData = message.payload.pairingData;
            let tlvData = tlv_1.default.decode(pairingData);
            let sessionPublicKey = tlvData[tlv_1.default.Tag.PublicKey];
            let encryptedData = tlvData[tlv_1.default.Tag.EncryptedData];
            if (sessionPublicKey.length != 32) {
                throw new Error(`sessionPublicKey must be 32 bytes (but was ${sessionPublicKey.length})`);
            }
            let sharedSecret = curve25519.deriveSharedSecret(verifyPrivate, sessionPublicKey);
            let encryptionKey = encryption_1.default.HKDF("sha512", Buffer.from("Pair-Verify-Encrypt-Salt"), sharedSecret, Buffer.from("Pair-Verify-Encrypt-Info"), 32);
            let cipherText = encryptedData.slice(0, -16);
            let hmac = encryptedData.slice(-16);
            let decryptedData = encryption_1.default.verifyAndDecrypt(cipherText, hmac, null, Buffer.from('PV-Msg02'), encryptionKey);
            let innerTLV = tlv_1.default.decode(decryptedData);
            let identifier = innerTLV[tlv_1.default.Tag.Username];
            let signature = innerTLV[tlv_1.default.Tag.Signature];
            if (!identifier.equals(that.device.credentials.identifier)) {
                throw new Error("Identifier mismatch");
            }
            let deviceInfo = Buffer.concat([sessionPublicKey, Buffer.from(identifier), verifyPublic]);
            if (!ed25519.Verify(deviceInfo, signature, that.device.credentials.publicKey)) {
                throw new Error("Signature verification failed");
            }
            let material = Buffer.concat([verifyPublic, Buffer.from(that.device.credentials.pairingId), sessionPublicKey]);
            let keyPair = ed25519.MakeKeypair(that.device.credentials.encryptionKey);
            let signed = ed25519.Sign(material, keyPair);
            let plainTLV = tlv_1.default.encode(tlv_1.default.Tag.Username, Buffer.from(that.device.credentials.pairingId), tlv_1.default.Tag.Signature, signed);
            let encryptedTLV = Buffer.concat(encryption_1.default.encryptAndSeal(plainTLV, null, Buffer.from('PV-Msg03'), encryptionKey));
            let outerTLV = tlv_1.default.encode(tlv_1.default.Tag.Sequence, 0x03, tlv_1.default.Tag.EncryptedData, encryptedTLV);
            let newMessage = {
                status: 0,
                state: 3,
                isRetrying: false,
                isUsingSystemPairing: true,
                pairingData: outerTLV
            };
            return that.device
                .sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', newMessage, false)
                .then(() => {
                return that.waitForSequence(0x04);
            })
                .then(() => {
                let readKey = encryption_1.default.HKDF("sha512", Buffer.from("MediaRemote-Salt"), sharedSecret, Buffer.from("MediaRemote-Read-Encryption-Key"), 32);
                let writeKey = encryption_1.default.HKDF("sha512", Buffer.from("MediaRemote-Salt"), sharedSecret, Buffer.from("MediaRemote-Write-Encryption-Key"), 32);
                return {
                    readKey: readKey,
                    writeKey: writeKey
                };
            });
        });
    }
    waitForSequence(sequence, timeout = 3) {
        let that = this;
        let handler = (message, resolve) => {
            let tlvData = tlv_1.default.decode(message.payload.pairingData);
            if (Buffer.from([sequence]).equals(tlvData[tlv_1.default.Tag.Sequence])) {
                resolve(message);
            }
        };
        return new Promise((resolve, reject) => {
            that.device.on('message', (message) => {
                if (message.type == message_1.Message.Type.CryptoPairingMessage) {
                    handler(message, resolve);
                }
            });
            setTimeout(() => {
                reject(new Error("Timed out waiting for crypto sequence " + sequence));
            }, timeout * 1000);
        })
            .then(value => {
            that.device.removeListener('message', handler);
            return value;
        });
    }
}
exports.Verifier = Verifier;
