/// <reference types="node" />
declare function verifyAndDecrypt(cipherText: Buffer, mac: Buffer, AAD: Buffer, nonce: Buffer, key: Buffer): Buffer;
declare function encryptAndSeal(plainText: Buffer, AAD: Buffer, nonce: Buffer, key: Buffer): Buffer[];
declare function HKDF(hashAlg: string, salt: Buffer, ikm: Buffer, info: Buffer, size: number): Buffer;
declare const _default: {
    encryptAndSeal: typeof encryptAndSeal;
    verifyAndDecrypt: typeof verifyAndDecrypt;
    HKDF: typeof HKDF;
};
export default _default;
