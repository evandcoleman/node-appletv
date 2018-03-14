/// <reference types="mdns" />
import { Service } from 'mdns';
import { Message as ProtoMessage } from 'protobufjs';
import { Credentials } from './credentials';
import { NowPlayingInfo } from './now-playing-info';
import { SupportedCommand } from './supported-command';
import TypedEventEmitter from './typed-events';
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
export declare class AppleTV extends TypedEventEmitter<AppleTV.Events> {
    private service;
    name: string;
    address: string;
    port: number;
    uid: string;
    pairingId: string;
    credentials: Credentials;
    private connection;
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
    * @param message  The Protobuf message to send.
    * @returns A promise that resolves to the response from the AppleTV.
    */
    sendMessage(message: ProtoMessage<{}>, waitForResponse?: boolean): Promise<ProtoMessage<{}>>;
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
    private sendKeyPressAndRelease(usePage, usage);
    private sendKeyPress(usePage, usage, down);
    private requestPlaybackQueueWithWait(options, waitForResponse);
    private sendIntroduction();
    private sendConnectionState();
    private sendClientUpdatesConfig();
    private sendWakeDevice();
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
    }
    /** Convert a string representation of a key to the correct enum type.
    * @param string  The string.
    * @returns The key enum value.
    */
    function key(string: string): AppleTV.Key;
}
