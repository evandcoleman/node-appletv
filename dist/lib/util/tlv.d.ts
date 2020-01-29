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
/// <reference types="node" />
declare function encode(type: any, data: any, ...args: any[]): Buffer;
declare function decode(data: any): {};
declare const _default: {
    Tag: {
        PairingMethod: number;
        Username: number;
        Salt: number;
        PublicKey: number;
        Proof: number;
        EncryptedData: number;
        Sequence: number;
        ErrorCode: number;
        BackOff: number;
        Signature: number;
        MFiCertificate: number;
        MFiSignature: number;
    };
    encode: typeof encode;
    decode: typeof decode;
};
export default _default;
