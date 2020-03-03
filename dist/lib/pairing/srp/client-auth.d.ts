/// <reference types="node" />
import { SRPBase } from './base';
export declare class SRPClientAuth extends SRPBase {
    private pairingId;
    salt: Buffer;
    clientSessionPublicKey: Buffer;
    serverSessionPublicKey: Buffer;
    publicKey: Buffer;
    seed: Buffer;
    signature: Buffer;
    private username;
    private sharedSecret;
    private srp;
    get serverProof(): Buffer;
    constructor(pairingId: string);
    setPassword(password: string): Buffer;
    verifyProof(proof: Buffer): void;
    private generateEncryptionKey;
    private generateSignature;
}
