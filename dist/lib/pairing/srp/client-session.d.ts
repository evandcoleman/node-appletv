/// <reference types="node" />
import { SRPBase } from './base';
export declare class SRPClientSession extends SRPBase {
    username: Buffer;
    signature: Buffer;
    publicKey: Buffer;
    sessionPublicKey: Buffer;
    readKey: Buffer;
    writeKey: Buffer;
    private privateKey;
    private sharedSecret;
    constructor(username: Buffer);
    setSessionPublicKey(key: Buffer, ltsk: Buffer): void;
}
