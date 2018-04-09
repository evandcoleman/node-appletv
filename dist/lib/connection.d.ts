import { Message as ProtoMessage } from 'protobufjs';
import { Credentials } from './credentials';
import { AppleTV } from './appletv';
import TypedEventEmitter from './typed-events';
import { Message } from './message';
export declare class Connection extends TypedEventEmitter<Connection.Events> {
    device: AppleTV;
    isOpen: boolean;
    private socket;
    private callbacks;
    private ProtocolMessage;
    private buffer;
    constructor(device: AppleTV);
    private addCallback(identifier, callback);
    private executeCallbacks(identifier, message);
    open(): Promise<void>;
    close(): void;
    sendBlank(typeName: string, waitForResponse: boolean, credentials?: Credentials): Promise<Message>;
    send(message: ProtoMessage<{}>, waitForResponse: boolean, priority: number, credentials?: Credentials): Promise<Message>;
    private sendProtocolMessage(message, name, type, waitForResponse, credentials?);
    private decodeMessage(data);
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
