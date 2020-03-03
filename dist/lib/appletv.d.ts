/// <reference types="node" />
import { Type, Message as ProtoMessage } from 'protobufjs';
import { EventEmitter } from 'events';
import { Socket } from 'net';
import { Credentials } from './credentials';
import { NowPlayingInfo } from './now-playing-info';
import { SupportedCommand } from './supported-command';
import { Message } from './message';
export interface SendProtocolMessageOptions {
    message: ProtoMessage<{}>;
    name?: string;
    type?: number;
    priority?: number;
    identifier?: string;
    waitForResponse?: boolean;
    credentials: Credentials;
    socket?: Socket;
}
export interface SendMessageOptions {
    filename?: string;
    type?: string;
    waitForResponse?: boolean;
    identifier?: string;
    body?: any;
    bodyBuilder?: (Type: any) => any;
    priority?: number;
    socket?: Socket;
}
export interface Size {
    width: number;
    height: number;
}
export interface PlaybackQueueRequestOptions {
    location: number;
    length: number;
    includeMetadata?: boolean;
    includeLanguageOptions?: boolean;
    includeLyrics?: boolean;
    artworkSize?: Size;
}
export interface ClientUpdatesConfig {
    artworkUpdates: boolean;
    nowPlayingUpdates: boolean;
    volumeUpdates: boolean;
    keyboardUpdates: boolean;
}
export declare class AppleTV extends EventEmitter {
    name: string;
    port: number;
    uid: string;
    credentials: Credentials;
    ProtocolMessage: Type;
    log: any;
    private callbacks;
    private buffer;
    constructor(name: string, port: number, uid?: string);
    /**
    * Closes the connection to the Apple TV.
    */
    close(): void;
    /**
    * Send a Protobuf message to the AppleTV. This is for advanced usage only.
    * @param definitionFilename  The Protobuf filename of the message type.
    * @param messageType  The name of the message.
    * @param body  The message body
    * @param waitForResponse  Whether or not to wait for a response before resolving the Promise.
    * @param socket  The socket on which to send the message
    * @returns A promise that resolves to the response from the AppleTV.
    */
    sendMessage(options: SendMessageOptions): Promise<Message>;
    send(options: SendProtocolMessageOptions): Promise<Message>;
    /**
    * Wait for a single message of a specified type.
    * @param type  The type of the message to wait for.
    * @param timeout  The timeout (in seconds).
    * @returns A promise that resolves to the Message.
    */
    messageOfType(type: Message.Type, timeout?: number): Promise<Message>;
    waitForSequence(sequence: number, state: number, socket: Socket, timeout?: number): Promise<Message>;
    /**
    * Call this method when a chunk of data is received.
    * @param data  A Buffer of data.
    * @returns A promise that resolves to the Message (if there is one).
    */
    handleChunk(data: Buffer, socket: Socket, credentials?: Credentials): Promise<Message>;
    write(data: Buffer, socket: Socket): void;
    private addCallback;
    private executeCallbacks;
    sendProtocolMessage(options: SendProtocolMessageOptions): Promise<Message>;
    sendIntroduction(socket: Socket, parameters: any, identifier?: string): Promise<Message>;
    private decodeMessage;
}
export declare module AppleTV {
    interface Events {
        connect: void;
        message: Message;
        close: void;
        error: Error;
        string: any;
        nowPlaying: NowPlayingInfo;
        supportedCommands: SupportedCommand[];
        playbackQueue: any;
    }
}
export declare module AppleTV {
    /** An enumeration of key presses available.
    */
    enum Key {
        Up = 0,
        Down = 1,
        Left = 2,
        Right = 3,
        Menu = 4,
        Play = 5,
        Pause = 6,
        Next = 7,
        Previous = 8,
        Suspend = 9,
        Wake = 10,
        Select = 11,
        Home = 12,
        VolumeUp = 13,
        VolumeDown = 14
    }
    /** Convert a string representation of a key to the correct enum type.
    * @param string  The string.
    * @returns The key enum value.
    */
    function key(string: string): AppleTV.Key;
}
