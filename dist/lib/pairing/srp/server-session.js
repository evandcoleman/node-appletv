"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
// import * as ed25519 from 'ed25519';
// import * as curve25519 from 'curve25519-n2';
const tweetnacl = require("tweetnacl");
const base_1 = require("./base");
const encryption_1 = require("../../util/encryption");
class SRPServerSession extends base_1.SRPBase {
    constructor(pairingId, keyPair, clientPublicKey) {
        super();
        this.keyPair = keyPair;
        this.clientPublicKey = clientPublicKey;
        let seed = crypto.randomBytes(32);
        let { secretKey, publicKey } = tweetnacl.box.keyPair();
        this.publicKey = Buffer.from(publicKey);
        this.privateKey = Buffer.from(secretKey);
        this.signSk = keyPair.signSk;
        this.signPk = keyPair.signPk;
        this.sharedSecret = Buffer.from(tweetnacl.scalarMult(this.privateKey, this.clientPublicKey));
        this.encryptionKey = encryption_1.default.HKDF('sha512', Buffer.from('Pair-Verify-Encrypt-Salt'), this.sharedSecret, Buffer.from('Pair-Verify-Encrypt-Info'), 32);
        this.username = Buffer.from(pairingId);
        let material = Buffer.concat([
            this.publicKey,
            this.username,
            this.clientPublicKey
        ]);
        this.signature = Buffer.from(tweetnacl.sign.detached(material, this.signSk));
        this.readKey = encryption_1.default.HKDF('sha512', Buffer.from('MediaRemote-Salt'), this.sharedSecret, Buffer.from('MediaRemote-Write-Encryption-Key'), 32);
        this.writeKey = encryption_1.default.HKDF('sha512', Buffer.from('MediaRemote-Salt'), this.sharedSecret, Buffer.from('MediaRemote-Read-Encryption-Key'), 32);
    }
}
exports.SRPServerSession = SRPServerSession;
