"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const encryption_1 = require("./util/encryption");
const number_1 = require("./util/number");
class Credentials {
    constructor(uniqueIdentifier, identifier, pairingId, publicKey, encryptionKey) {
        this.uniqueIdentifier = uniqueIdentifier;
        this.identifier = identifier;
        this.pairingId = pairingId;
        this.publicKey = publicKey;
        this.encryptionKey = encryptionKey;
        this.encryptCount = 0;
        this.decryptCount = 0;
    }
    /**
    * Parse a credentials string into a Credentials object.
    * @param text  The credentials string.
    * @returns A credentials object.
    */
    static parse(text) {
        let parts = text.split(':');
        return new Credentials(parts[0], Buffer.from(parts[1], 'hex'), Buffer.from(parts[2], 'hex').toString(), Buffer.from(parts[3], 'hex'), Buffer.from(parts[4], 'hex'));
    }
    /**
    * Returns a string representation of a Credentials object.
    * @returns A string representation of a Credentials object.
    */
    toString() {
        return this.uniqueIdentifier
            + ":"
            + this.identifier.toString('hex')
            + ":"
            + Buffer.from(this.pairingId).toString('hex')
            + ":"
            + this.publicKey.toString('hex')
            + ":"
            + this.encryptionKey.toString('hex');
    }
    encrypt(message) {
        let nonce = number_1.default.UInt53toBufferLE(this.encryptCount++);
        return Buffer.concat(encryption_1.default.encryptAndSeal(message, null, nonce, this.writeKey));
    }
    decrypt(message) {
        let nonce = number_1.default.UInt53toBufferLE(this.decryptCount++);
        let cipherText = message.slice(0, -16);
        return encryption_1.default.verifyAndDecrypt(cipherText, nonce, this.readKey);
    }
}
exports.Credentials = Credentials;
