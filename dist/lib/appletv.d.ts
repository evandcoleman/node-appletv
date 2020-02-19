/// <reference types="node" />
import { Message as ProtoMessage } from 'protobufjs';
import { EventEmitter } from 'events';
import { Credentials } from './credentials';
import { NowPlayingInfo } from './now-playing-info';
import { SupportedCommand } from './supported-command';
import { Message } from './message';
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
    pairingId: string;
    credentials: Credentials;
    private callbacks;
    private ProtocolMessage;
    private buffer;
    constructor(name: string, port: number, uid: string);
    /**
    * Opens a connection to the AppleTV over the MRP protocol.
    * @param credentials  The credentials object for this AppleTV
    * @returns A promise that resolves to the AppleTV object.
    */
    open(credentials?: Credentials): Promise<this>;
    /**
    * Closes the connection to the Apple TV.
    */
    close(): void;
    write(data: Buffer): void;
    /**
    * Send a Protobuf message to the AppleTV. This is for advanced usage only.
    * @param definitionFilename  The Protobuf filename of the message type.
    * @param messageType  The name of the message.
    * @param body  The message body
    * @param waitForResponse  Whether or not to wait for a response before resolving the Promise.
    * @returns A promise that resolves to the response from the AppleTV.
    */
    sendMessage(definitionFilename: string, messageType: string, body: {}, waitForResponse: boolean, priority?: number): Promise<Message>;
    send(message: ProtoMessage<{}>, waitForResponse: boolean, priority: number, credentials?: Credentials): Promise<Message>;
    /**
    * Wait for a single message of a specified type.
    * @param type  The type of the message to wait for.
    * @param timeout  The timeout (in seconds).
    * @returns A promise that resolves to the Message.
    */
    messageOfType(type: Message.Type, timeout?: number): Promise<Message>;
    waitForSequence(sequence: number, timeout?: number): Promise<Message>;
    /**
    * Call this method when a chunk of data is received.
    * @param data  A Buffer of data.
    * @returns A promise that resolves to the Message (if there is one).
    */
    handleChunk(data: Buffer): Promise<Message>;
    private addCallback;
    private executeCallbacks;
    private sendProtocolMessage;
    sendIntroduction(): Promise<Message>;
    private decodeMessage;
}
export declare module AppleTV {
    interface Events {
        connect: void;
        nowPlaying: NowPlayingInfo;
        supportedCommands: SupportedCommand[];
        playbackQueue: any;
        message: Message;
        close: void;
        error: Error;
        debug: string;
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
