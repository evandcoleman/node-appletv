/// <reference types="node" />
declare const _default: {
    encryptAndSeal: (plainText: Buffer, AAD: Buffer, nonce: Buffer, key: Buffer) => Buffer[];
    verifyAndDecrypt: (cipherText: Buffer, mac: Buffer, AAD: Buffer, nonce: Buffer, key: Buffer) => Buffer;
    HKDF: (hashAlg: string, salt: Buffer, ikm: Buffer, info: Buffer, size: number) => Buffer;
};
export default _default;
