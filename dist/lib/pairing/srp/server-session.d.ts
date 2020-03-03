/// <reference types="node" />
import { SRPBase } from './base';
import { KeyPair } from '../../credentials-store';
export declare class SRPServerSession extends SRPBase {
    private keyPair;
    clientPublicKey: Buffer;
    signature: Buffer;
    username: Buffer;
    signPk: Buffer;
    publicKey: Buffer;
    privateKey: Buffer;
    readKey: Buffer;
    writeKey: Buffer;
    private signSk;
    private sharedSecret;
    constructor(pairingId: string, keyPair: KeyPair, clientPublicKey: Buffer);
}
