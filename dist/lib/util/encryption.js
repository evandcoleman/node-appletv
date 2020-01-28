"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chacha20 = require("chacha20");
const crypto = require("crypto");
const number_1 = require("./number");
function computePoly1305(cipherText, AAD, nonce, key) {
    if (AAD == null) {
        AAD = Buffer.alloc(0);
    }
    const msg = Buffer.concat([
        AAD,
        getPadding(AAD, 16),
        cipherText,
        getPadding(cipherText, 16),
        number_1.default.UInt53toBufferLE(AAD.length),
        number_1.default.UInt53toBufferLE(cipherText.length)
    ]);
    return chacha20.encrypt(key, nonce, msg);
}
// i'd really prefer for this to be a direct call to
// Sodium.crypto_aead_chacha20poly1305_decrypt()
// but unfortunately the way it constructs the message to
// calculate the HMAC is not compatible with homekit
// (long story short, it uses [ AAD, AAD.length, CipherText, CipherText.length ]
// whereas homekit expects [ AAD, CipherText, AAD.length, CipherText.length ]
function verifyAndDecrypt(cipherText, nonce, key) {
    return chacha20.decrypt(key, nonce, cipherText);
}
// See above about calling directly into libsodium.
function encryptAndSeal(plainText, AAD, nonce, key) {
    const cipherText = chacha20.encrypt(key, nonce, plainText);
    const hmac = computePoly1305(cipherText, AAD, nonce, key);
    return [cipherText, hmac];
}
function getPadding(buffer, blockSize) {
    return buffer.length % blockSize === 0
        ? Buffer.alloc(0)
        : Buffer.alloc(blockSize - (buffer.length % blockSize));
}
function HKDF(hashAlg, salt, ikm, info, size) {
    // create the hash alg to see if it exists and get its length
    var hash = crypto.createHash(hashAlg);
    var hashLength = hash.digest().length;
    // now we compute the PRK
    var hmac = crypto.createHmac(hashAlg, salt);
    hmac.update(ikm);
    var prk = hmac.digest();
    var prev = Buffer.alloc(0);
    var output;
    var buffers = [];
    var num_blocks = Math.ceil(size / hashLength);
    info = Buffer.from(info);
    for (var i = 0; i < num_blocks; i++) {
        var hmac = crypto.createHmac(hashAlg, prk);
        var input = Buffer.concat([
            prev,
            info,
            Buffer.from(String.fromCharCode(i + 1))
        ]);
        hmac.update(input);
        prev = hmac.digest();
        buffers.push(prev);
    }
    output = Buffer.concat(buffers, size);
    return output.slice(0, size);
}
exports.default = {
    encryptAndSeal,
    verifyAndDecrypt,
    HKDF
};
