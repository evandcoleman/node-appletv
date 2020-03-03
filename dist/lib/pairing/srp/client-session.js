"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tweetnacl = require("tweetnacl");
const base_1 = require("./base");
const encryption_1 = require("../../util/encryption");
class SRPClientSession extends base_1.SRPBase {
    constructor(username) {
        super();
        this.username = username;
        let { publicKey, secretKey } = tweetnacl.box.keyPair();
        this.privateKey = Buffer.from(secretKey);
        this.publicKey = Buffer.from(publicKey);
    }
    setSessionPublicKey(key, ltsk) {
        this.sessionPublicKey = key;
        this.sharedSecret = Buffer.from(tweetnacl.scalarMult(this.privateKey, key));
        this.encryptionKey = encryption_1.default.HKDF("sha512", Buffer.from("Pair-Verify-Encrypt-Salt"), this.sharedSecret, Buffer.from("Pair-Verify-Encrypt-Info"), 32);
        let material = Buffer.concat([this.publicKey, this.username, key]);
        let keyPair = tweetnacl.sign.keyPair.fromSeed(ltsk);
        this.signature = Buffer.from(tweetnacl.sign.detached(material, keyPair.secretKey));
        this.readKey = encryption_1.default.HKDF("sha512", Buffer.from("MediaRemote-Salt"), this.sharedSecret, Buffer.from("MediaRemote-Read-Encryption-Key"), 32);
        this.writeKey = encryption_1.default.HKDF("sha512", Buffer.from("MediaRemote-Salt"), this.sharedSecret, Buffer.from("MediaRemote-Write-Encryption-Key"), 32);
    }
}
exports.SRPClientSession = SRPClientSession;
