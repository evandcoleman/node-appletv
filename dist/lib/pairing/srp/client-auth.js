"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const srp = require("fast-srp-hap");
const crypto = require("crypto");
const ed25519 = require("ed25519");
const base_1 = require("./base");
const encryption_1 = require("../../util/encryption");
class SRPClientAuth extends base_1.SRPBase {
    constructor(pairingId) {
        super();
        this.pairingId = pairingId;
        this.seed = crypto.randomBytes(32);
        this.username = Buffer.from('Pair-Setup');
    }
    get serverProof() {
        return this.srp.computeM2();
    }
    setPassword(password) {
        this.srp = srp.Client(srp.params['3072'], this.salt, this.username, Buffer.from(password), this.seed);
        this.srp.setB(this.serverSessionPublicKey);
        this.clientSessionPublicKey = this.srp.computeA();
        this.generateEncryptionKey();
        this.generateSignature();
        return this.srp.computeM1(); // proof
    }
    verifyProof(proof) {
        this.srp.checkM2(proof);
    }
    generateEncryptionKey() {
        if (this.encryptionKey)
            return;
        this.sharedSecret = this.srp.computeK();
        this.encryptionKey = encryption_1.default.HKDF("sha512", Buffer.from("Pair-Setup-Encrypt-Salt"), this.sharedSecret, Buffer.from("Pair-Setup-Encrypt-Info"), 32);
    }
    generateSignature() {
        if (this.signature)
            return;
        let { publicKey, privateKey } = ed25519.MakeKeypair(this.seed);
        this.publicKey = publicKey;
        this.sharedSecret = this.srp.computeK();
        let deviceHash = encryption_1.default.HKDF("sha512", Buffer.from("Pair-Setup-Controller-Sign-Salt"), this.sharedSecret, Buffer.from("Pair-Setup-Controller-Sign-Info"), 32);
        let deviceInfo = Buffer.concat([deviceHash, Buffer.from(this.pairingId), publicKey]);
        this.signature = ed25519.Sign(deviceInfo, privateKey);
    }
}
exports.SRPClientAuth = SRPClientAuth;
