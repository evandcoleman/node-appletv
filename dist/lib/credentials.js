"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const encryption_1 = require("./util/encryption");
const number_1 = require("./util/number");
class Credentials {
    constructor(localUid, remoteUid, ltpk, ltsk) {
        this.localUid = localUid;
        this.remoteUid = remoteUid;
        this.ltpk = ltpk;
        this.ltsk = ltsk;
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
        return new Credentials(parts[0], parts[1], Buffer.from(parts[2], 'hex'), Buffer.from(parts[3], 'hex'));
    }
    /**
    * Returns a string representation of a Credentials object.
    * @returns A string representation of a Credentials object.
    */
    toString() {
        return this.localUid.toLowerCase()
            + ":"
            + this.remoteUid.toLowerCase()
            + ":"
            + this.ltpk.toString('hex')
            + ":"
            + this.ltsk.toString('hex');
    }
    static fromJSON(json) {
        return new Credentials(json.localUid, json.remoteUid, Buffer.from(json.ltpk, 'hex'), Buffer.from(json.ltsk, 'hex'));
    }
    toJSON(extended = false) {
        var out = {
            localUid: this.localUid,
            remoteUid: this.remoteUid,
            ltpk: this.ltpk.toString('hex'),
            ltsk: this.ltsk.toString('hex')
        };
        if (extended) {
            out.readKey = this.readKey.toString('hex');
            out.writeKey = this.writeKey.toString('hex');
        }
        return out;
    }
    encrypt(message) {
        let nonce = number_1.default.UInt53toBufferLE(this.encryptCount++);
        return Buffer.concat(encryption_1.default.encryptAndSeal(message, null, nonce, this.writeKey));
    }
    decrypt(message) {
        let nonce = number_1.default.UInt53toBufferLE(this.decryptCount++);
        let cipherText = message.slice(0, -16);
        let hmac = message.slice(-16);
        return encryption_1.default.verifyAndDecrypt(cipherText, hmac, null, nonce, this.readKey);
    }
}
exports.Credentials = Credentials;
