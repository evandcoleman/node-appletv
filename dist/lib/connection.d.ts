import { Message } from 'protobufjs';
import { Credentials } from './credentials';
import { AppleTV } from './appletv';
export declare class Connection {
    device: AppleTV;
    private log;
    private socket;
    private callbacks;
    private rawMessageCallbacks;
    private ProtocolMessage;
    private buffer;
    private unidentifiableMessageTypes;
    private waitForResponseMessageTypes;
    constructor(device: AppleTV, log?: (string) => void);
    private addCallback(identifier, persist, callback);
    private executeCallbacks(identifier, data);
    open(): Promise<void>;
    messageOfType(messageType: string): Promise<{}>;
    messagesOfType(messageType: string, callback: (Error, {}) => void, persist?: boolean): void;
    observeMessages(callback: (Error, string, {}) => void): void;
    sendBlank(typeName: string, credentials?: Credentials): Promise<Message<{}>>;
    send(message: Message<{}>, credentials?: Credentials): Promise<Message<{}>>;
    private sendProtocolMessage(message, name, type, credentials?);
}
