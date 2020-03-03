/// <reference types="node" />
import { EventEmitter } from 'events';
import { TVServer, Client } from '../tvserver';
import { KeyPair } from '../credentials-store';
import { Message } from '../message';
export declare class PairingServer extends EventEmitter {
    device: TVServer;
    client: Client;
    code: string;
    private srp;
    private session;
    private clientUsername;
    private clientPublicKey;
    private nextSetupState;
    private nextVerifyState;
    constructor(device: TVServer, keyPair: KeyPair, client: Client);
    handle(message: Message): Promise<void>;
    private handleSetup;
    private handleVerify;
    private pairSetupM1;
    private pairSetupM2;
    private pairSetupM3;
    private pairSetupM4;
    private pairSetupM5;
    private pairSetupM6;
    private pairVerifyM1;
    private pairVerifyM2;
    private pairVerifyM3;
    private pairVerifyM4;
}
