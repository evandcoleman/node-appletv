"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const encryption_1 = require("../../util/encryption");
class SRPBase {
    decrypt(data, nonce) {
        let cipherText = data.slice(0, -16);
        let hmac = data.slice(-16);
        return encryption_1.default.verifyAndDecrypt(cipherText, hmac, null, nonce, this.encryptionKey);
    }
    encrypt(data, nonce) {
        return Buffer.concat(encryption_1.default.encryptAndSeal(data, null, nonce, this.encryptionKey));
    }
}
exports.SRPBase = SRPBase;
