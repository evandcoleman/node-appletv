/// <reference types="node" />
import { EventEmitter } from 'events';
import { TVClient } from '../tvclient';
import { Message } from '../message';
export declare class PairingClient extends EventEmitter {
    device: TVClient;
    private srp;
    private session;
    private nextSetupState;
    private nextVerifyState;
    private readyForPin;
    private callback;
    constructor(device: TVClient);
    pair(): Promise<(pin: string) => Promise<TVClient>>;
    verify(): Promise<TVClient>;
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
