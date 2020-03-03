"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const srp = require("fast-srp-hap");
const crypto = require("crypto");
const tweetnacl = require("tweetnacl");
const base_1 = require("./base");
const encryption_1 = require("../../util/encryption");
class SRPServerAuth extends base_1.SRPBase {
    constructor(pairingId, keyPair, password) {
        super();
        this.pairingId = pairingId;
        this.keyPair = keyPair;
        this.salt = crypto.randomBytes(16);
        this.privateKey = crypto.randomBytes(384);
        this.username = Buffer.from('Pair-Setup');
        this.seed = crypto.randomBytes(32);
        this.srp = new srp.Server(srp.params[3072], this.salt, this.username, Buffer.from(password), this.privateKey);
        this.sessionPublicKey = this.srp.computeB();
    }
    get serverProof() {
        return this.srp.computeM2();
    }
    setClientSessionPublicKey(publicKey) {
        this.srp.setA(publicKey);
        this.generateEncryptionKey();
        this.generateSignature();
    }
    verifyProof(proof) {
        this.srp.checkM1(proof);
    }
    generateEncryptionKey() {
        if (this.encryptionKey)
            return;
        this.sharedSecret = this.srp.computeK();
        this.encryptionKey = encryption_1.default.HKDF('sha512', Buffer.from('Pair-Setup-Encrypt-Salt'), this.sharedSecret, Buffer.from('Pair-Setup-Encrypt-Info'), 32);
    }
    generateSignature() {
        if (this.signature)
            return;
        this.publicKey = this.keyPair.signPk;
        let serverHash = encryption_1.default.HKDF('sha512', Buffer.from('Pair-Setup-Accessory-Sign-Salt'), this.sharedSecret, Buffer.from('Pair-Setup-Accessory-Sign-Info'), 32);
        let serverInfo = Buffer.concat([
            serverHash,
            Buffer.from(this.pairingId),
            this.publicKey,
        ]);
        this.signature = Buffer.from(tweetnacl.sign.detached(serverInfo, this.keyPair.signSk));
    }
}
exports.SRPServerAuth = SRPServerAuth;
