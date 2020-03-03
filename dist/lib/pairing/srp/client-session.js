"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ed25519 = require("ed25519");
const curve25519 = require("curve25519-n2");
const base_1 = require("./base");
const encryption_1 = require("../../util/encryption");
class SRPClientSession extends base_1.SRPBase {
    constructor(username) {
        super();
        this.username = username;
        this.privateKey = Buffer.alloc(32);
        curve25519.makeSecretKey(this.privateKey);
        this.publicKey = curve25519.derivePublicKey(this.privateKey);
    }
    setSessionPublicKey(key, ltsk) {
        this.sessionPublicKey = key;
        this.sharedSecret = curve25519.deriveSharedSecret(this.privateKey, key);
        this.encryptionKey = encryption_1.default.HKDF("sha512", Buffer.from("Pair-Verify-Encrypt-Salt"), this.sharedSecret, Buffer.from("Pair-Verify-Encrypt-Info"), 32);
        let material = Buffer.concat([this.publicKey, this.username, key]);
        let keyPair = ed25519.MakeKeypair(ltsk);
        this.signature = ed25519.Sign(material, keyPair);
        this.readKey = encryption_1.default.HKDF("sha512", Buffer.from("MediaRemote-Salt"), this.sharedSecret, Buffer.from("MediaRemote-Read-Encryption-Key"), 32);
        this.writeKey = encryption_1.default.HKDF("sha512", Buffer.from("MediaRemote-Salt"), this.sharedSecret, Buffer.from("MediaRemote-Write-Encryption-Key"), 32);
    }
}
exports.SRPClientSession = SRPClientSession;
