/// <reference types="node" />
export declare class SRPBase {
    encryptionKey: Buffer;
    decrypt(data: Buffer, nonce: Buffer): Buffer;
    encrypt(data: Buffer, nonce: Buffer): Buffer;
}
