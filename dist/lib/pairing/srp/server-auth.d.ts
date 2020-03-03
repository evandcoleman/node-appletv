/// <reference types="node" />
import { SRPBase } from './base';
import { KeyPair } from '../../credentials-store';
export declare class SRPServerAuth extends SRPBase {
    private pairingId;
    keyPair: KeyPair;
    salt: Buffer;
    publicKey: Buffer;
    privateKey: Buffer;
    sessionPublicKey: Buffer;
    signature: Buffer;
    private username;
    private sharedSecret;
    seed: Buffer;
    private srp;
    get serverProof(): Buffer;
    constructor(pairingId: string, keyPair: KeyPair, password: string);
    setClientSessionPublicKey(publicKey: Buffer): void;
    verifyProof(proof: Buffer): void;
    private generateEncryptionKey;
    private generateSignature;
}
