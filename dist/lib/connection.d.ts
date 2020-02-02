/// <reference types="node" />
import { Socket } from 'net';
import { Message as ProtoMessage } from 'protobufjs';
import { EventEmitter } from 'events';
import { Credentials } from './credentials';
import { AppleTV } from './appletv';
import { Message } from './message';
export declare class Connection extends EventEmitter {
    device: AppleTV;
    isOpen: boolean;
    private socket;
    private callbacks;
    private ProtocolMessage;
    private buffer;
    constructor(device: AppleTV, socket?: Socket);
    private addCallback;
    private executeCallbacks;
    open(): Promise<void>;
    close(): void;
    sendBlank(typeName: string, waitForResponse: boolean, credentials?: Credentials): Promise<Message>;
    send(message: ProtoMessage<{}>, waitForResponse: boolean, priority: number, credentials?: Credentials): Promise<Message>;
    private sendProtocolMessage;
    private decodeMessage;
    waitForSequence(sequence: number, timeout?: number): Promise<Message>;
    private setupListeners;
}
export declare module Connection {
    interface Events {
        connect: void;
        message: Message;
        close: void;
        error: Error;
        debug: string;
    }
}
