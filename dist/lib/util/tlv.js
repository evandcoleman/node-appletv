"use strict";
/**
 * Type Length Value encoding/decoding, used by HAP as a wire format.
 * https://en.wikipedia.org/wiki/Type-length-value
 *
 * Originally based on code from github:KhaosT/HAP-NodeJS@0c8fd88 used
 * used per the terms of the Apache Software License v2.
 *
 * Original code copyright Khaos Tian <khaos.tian@gmail.com>
 *
 * Modifications copyright Zach Bean <zb@forty2.com>
 *  * Reformatted for ES6-style module
 *  * Rewrote encode() to be non-recursive; also simplified the logic
 *  * Rewrote decode()
 */
Object.defineProperty(exports, "__esModule", { value: true });
const Tag = {
    PairingMethod: 0x00,
    Username: 0x01,
    Salt: 0x02,
    // could be either the SRP client public key (384 bytes) or the ED25519 public key (32 bytes), depending on context
    PublicKey: 0x03,
    Proof: 0x04,
    EncryptedData: 0x05,
    Sequence: 0x06,
    ErrorCode: 0x07,
    BackOff: 0x08,
    Signature: 0x0A,
    MFiCertificate: 0x09,
    MFiSignature: 0x0A
};
function encode(type, data, ...args) {
    var encodedTLVBuffer = Buffer.alloc(0);
    // coerce data to Buffer if needed
    if (typeof data === 'number')
        data = Buffer.from([data]);
    else if (typeof data === 'string')
        data = Buffer.from(data);
    if (data.length <= 255) {
        encodedTLVBuffer = Buffer.concat([Buffer.from([type, data.length]), data]);
    }
    else {
        var leftLength = data.length;
        var tempBuffer = Buffer.alloc(0);
        var currentStart = 0;
        for (; leftLength > 0;) {
            if (leftLength >= 255) {
                tempBuffer = Buffer.concat([tempBuffer, Buffer.from([type, 0xFF]), data.slice(currentStart, currentStart + 255)]);
                leftLength -= 255;
                currentStart = currentStart + 255;
            }
            else {
                tempBuffer = Buffer.concat([tempBuffer, Buffer.from([type, leftLength]), data.slice(currentStart, currentStart + leftLength)]);
                leftLength -= leftLength;
            }
        }
        encodedTLVBuffer = tempBuffer;
    }
    // do we have more to encode?
    if (arguments.length > 2) {
        // chop off the first two arguments which we already processed, and process the rest recursively
        var remainingArguments = Array.prototype.slice.call(arguments, 2);
        var remainingTLVBuffer = encode.apply(this, remainingArguments);
        // append the remaining encoded arguments directly to the buffer
        encodedTLVBuffer = Buffer.concat([encodedTLVBuffer, remainingTLVBuffer]);
    }
    return encodedTLVBuffer;
}
function decode(data) {
    var objects = {};
    var leftLength = data.length;
    var currentIndex = 0;
    for (; leftLength > 0;) {
        var type = data[currentIndex];
        var length = data[currentIndex + 1];
        currentIndex += 2;
        leftLength -= 2;
        var newData = data.slice(currentIndex, currentIndex + length);
        if (objects[type]) {
            objects[type] = Buffer.concat([objects[type], newData]);
        }
        else {
            objects[type] = newData;
        }
        currentIndex += length;
        leftLength -= length;
    }
    return objects;
}
exports.default = {
    Tag,
    encode,
    decode
};
