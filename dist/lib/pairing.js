"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const srp = require("fast-srp-hap");
const protobufjs_1 = require("protobufjs");
const path = require("path");
const crypto = require("crypto");
const ed25519 = require("ed25519");
const credentials_1 = require("./credentials");
const message_1 = require("./message");
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
        let that = this;
        return protobufjs_1.load(path.resolve(__dirname + "/protos/CryptoPairingMessage.proto"))
            .then(root => {
            let type = root.lookupType('CryptoPairingMessage');
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.PairingMethod, 0x00, tlv_1.default.Tag.Sequence, 0x01);
            let message = type.create({
                status: 0,
                pairingData: tlvData
            });
            return that.device
                .sendMessage(message, false)
                .then(() => {
                return that.waitForSequence(0x02);
            });
        })
            .then(message => {
            let pairingData = message.payload.pairingData;
            let tlvData = tlv_1.default.decode(pairingData);
            if (tlvData[tlv_1.default.Tag.BackOff]) {
                let backOff = tlvData[tlv_1.default.Tag.BackOff];
                let seconds = backOff.readIntBE(0, backOff.byteLength);
                if (seconds > 0) {
                    throw new Error("You've attempt to pair too recently. Try again in " + seconds + " seconds.");
                }
            }
            if (tlvData[tlv_1.default.Tag.ErrorCode]) {
                let buffer = tlvData[tlv_1.default.Tag.ErrorCode];
                throw new Error(that.device.name + " responded with error code " + buffer.readIntBE(0, buffer.byteLength) + ". Try rebooting your Apple TV.");
            }
            that.deviceSalt = tlvData[tlv_1.default.Tag.Salt];
            that.devicePublicKey = tlvData[tlv_1.default.Tag.PublicKey];
            if (that.deviceSalt.byteLength != 16) {
                throw new Error(`salt must be 16 bytes (but was ${that.deviceSalt.byteLength})`);
            }
            if (that.devicePublicKey.byteLength !== 384) {
                throw new Error(`serverPublicKey must be 384 bytes (but was ${that.devicePublicKey.byteLength})`);
            }
            return Promise.resolve((pin) => {
                return that.completePairing(pin);
            });
        });
    }
    completePairing(pin) {
        this.srp = srp.Client(srp.params['3072'], this.deviceSalt, Buffer.from('Pair-Setup'), Buffer.from(pin), this.key);
        this.srp.setB(this.devicePublicKey);
        this.publicKey = this.srp.computeA();
        this.proof = this.srp.computeM1();
        // console.log("DEBUG: Client Public Key=" + this.publicKey.toString('hex') + "\nProof=" + this.proof.toString('hex'));
        let that = this;
        return protobufjs_1.load(path.resolve(__dirname + "/protos/CryptoPairingMessage.proto"))
            .then(root => {
            let type = root.lookupType('CryptoPairingMessage');
            let tlvData = tlv_1.default.encode(tlv_1.default.Tag.Sequence, 0x03, tlv_1.default.Tag.PublicKey, that.publicKey, tlv_1.default.Tag.Proof, that.proof);
            let message = type.create({
                status: 0,
                pairingData: tlvData
            });
            return that.device
                .sendMessage(message, false)
                .then(() => {
                return that.waitForSequence(0x04);
            })
                .then(message => {
                let pairingData = message.payload.pairingData;
                that.deviceProof = tlv_1.default.decode(pairingData)[tlv_1.default.Tag.Proof];
                // console.log("DEBUG: Device Proof=" + that.deviceProof.toString('hex'));
                that.srp.checkM2(that.deviceProof);
                let seed = crypto.randomBytes(32);
                let keyPair = ed25519.MakeKeypair(seed);
                let privateKey = keyPair.privateKey;
                let publicKey = keyPair.publicKey;
                let sharedSecret = that.srp.computeK();
                let deviceHash = encryption_1.default.HKDF("sha512", Buffer.from("Pair-Setup-Controller-Sign-Salt"), sharedSecret, Buffer.from("Pair-Setup-Controller-Sign-Info"), 32);
                let deviceInfo = Buffer.concat([deviceHash, Buffer.from(that.device.pairingId), publicKey]);
                let deviceSignature = ed25519.Sign(deviceInfo, privateKey);
                let encryptionKey = encryption_1.default.HKDF("sha512", Buffer.from("Pair-Setup-Encrypt-Salt"), sharedSecret, Buffer.from("Pair-Setup-Encrypt-Info"), 32);
                let tlvData = tlv_1.default.encode(tlv_1.default.Tag.Username, Buffer.from(that.device.pairingId), tlv_1.default.Tag.PublicKey, publicKey, tlv_1.default.Tag.Signature, deviceSignature);
                let encryptedTLV = Buffer.concat(encryption_1.default.encryptAndSeal(tlvData, null, Buffer.from('PS-Msg05'), encryptionKey));
                // console.log("DEBUG: Encrypted Data=" + encryptedTLV.toString('hex'));
                let outerTLV = tlv_1.default.encode(tlv_1.default.Tag.Sequence, 0x05, tlv_1.default.Tag.EncryptedData, encryptedTLV);
                let nextMessage = type.create({
                    status: 0,
                    pairingData: outerTLV
                });
                return that.device
                    .sendMessage(nextMessage, false)
                    .then(() => {
                    return that.waitForSequence(0x06);
                })
                    .then(message => {
                    let encryptedData = tlv_1.default.decode(message.payload.pairingData)[tlv_1.default.Tag.EncryptedData];
                    let cipherText = encryptedData.slice(0, -16);
                    let hmac = encryptedData.slice(-16);
                    let decrpytedData = encryption_1.default.verifyAndDecrypt(cipherText, hmac, null, Buffer.from('PS-Msg06'), encryptionKey);
                    let tlvData = tlv_1.default.decode(decrpytedData);
                    that.device.credentials = new credentials_1.Credentials(that.device.uid, tlvData[tlv_1.default.Tag.Username], that.device.pairingId, tlvData[tlv_1.default.Tag.PublicKey], seed);
                    return that.device;
                });
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
exports.Pairing = Pairing;
