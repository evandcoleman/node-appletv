"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const encryption_1 = require("../lib/util/encryption");
const crypto = require("crypto");
const chai_1 = require("chai");
require("mocha");
describe('test encryption', function () {
    it('should encrypt and decrypt string', function () {
        let value = Buffer.from("some string");
        let nonce = Buffer.from('PS-Msg06');
        let key = encryption_1.default.HKDF("sha512", Buffer.from("Pair-Setup-Encrypt-Salt"), crypto.randomBytes(32), Buffer.from("Pair-Setup-Encrypt-Info"), 32);
        let encrypted = encryption_1.default.encryptAndSeal(value, null, nonce, key);
        let decrypted = encryption_1.default.verifyAndDecrypt(encrypted[0], encrypted[1], null, nonce, key);
        chai_1.expect(decrypted.toString()).to.equal(value.toString());
    });
});
