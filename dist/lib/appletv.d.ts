/// <reference types="node" />
import { Service } from 'mdns';
import { EventEmitter } from 'events';
import { Connection } from './connection';
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
    private service;
    name: string;
    address: string;
    port: number;
    uid: string;
    pairingId: string;
    credentials: Credentials;
    connection: Connection;
    constructor(service: Service);
    /**
    * Pair with an already discovered AppleTV.
    * @returns A promise that resolves to the AppleTV object.
    */
    pair(): Promise<(pin: string) => Promise<AppleTV>>;
    /**
    * Opens a connection to the AppleTV over the MRP protocol.
    * @param credentials  The credentials object for this AppleTV
    * @returns A promise that resolves to the AppleTV object.
    */
    openConnection(credentials?: Credentials): Promise<AppleTV>;
    /**
    * Closes the connection to the Apple TV.
    */
    closeConnection(): void;
    /**
    * Send a Protobuf message to the AppleTV. This is for advanced usage only.
    * @param definitionFilename  The Protobuf filename of the message type.
    * @param messageType  The name of the message.
    * @param body  The message body
    * @param waitForResponse  Whether or not to wait for a response before resolving the Promise.
    * @returns A promise that resolves to the response from the AppleTV.
    */
    sendMessage(definitionFilename: string, messageType: string, body: {}, waitForResponse: boolean, priority?: number): Promise<Message>;
    /**
    * Wait for a single message of a specified type.
    * @param type  The type of the message to wait for.
    * @param timeout  The timeout (in seconds).
    * @returns A promise that resolves to the Message.
    */
    messageOfType(type: Message.Type, timeout?: number): Promise<Message>;
    /**
    * Requests the current playback queue from the Apple TV.
    * @param options Options to send
    * @returns A Promise that resolves to a NewPlayingInfo object.
    */
    requestPlaybackQueue(options: PlaybackQueueRequestOptions): Promise<NowPlayingInfo>;
    /**
    * Send a key command to the AppleTV.
    * @param key The key to press.
    * @returns A promise that resolves to the AppleTV object after the message has been sent.
    */
    sendKeyCommand(key: AppleTV.Key): Promise<AppleTV>;
    waitForSequence(sequence: number, timeout?: number): Promise<Message>;
    private sendKeyPressAndRelease;
    private sendKeyPress;
    private requestPlaybackQueueWithWait;
    private sendIntroduction;
    private sendConnectionState;
    private sendClientUpdatesConfig;
    private sendWakeDevice;
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
        Select = 10
    }
    /** Convert a string representation of a key to the correct enum type.
    * @param string  The string.
    * @returns The key enum value.
    */
    function key(string: string): AppleTV.Key;
}
