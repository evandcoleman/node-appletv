/// <reference types="node" />
import { Service } from 'mdns';
import { Socket } from 'net';
import { AppleTV, PlaybackQueueRequestOptions } from './appletv';
import { Credentials } from './credentials';
import { NowPlayingInfo } from './now-playing-info';
export declare class TVClient extends AppleTV {
    private service;
    address: string;
    socket: Socket;
    constructor(service: Service, socket?: Socket);
    /**
    * Pair with an already discovered AppleTV.
    * @returns A promise that resolves to the AppleTV object.
    */
    pair(): Promise<(pin: string) => Promise<AppleTV>>;
    open(credentials?: Credentials): Promise<this>;
    close(): void;
    /**
    * Requests the current playback queue from the Apple TV.
    * @param options Options to send
    * @returns A Promise that resolves to a NewPlayingInfo object.
    */
    requestPlaybackQueue(options: PlaybackQueueRequestOptions): Promise<NowPlayingInfo>;
    /**
    * Requests the current artwork from the Apple TV.
    * @param width Image width
    * @param height Image height
    * @returns A Promise that resolves to a Buffer of data.
    */
    requestArtwork(width?: number, height?: number): Promise<Buffer>;
    /**
    * Send a key command to the AppleTV.
    * @param key The key to press.
    * @returns A promise that resolves to the AppleTV object after the message has been sent.
    */
    sendKeyCommand(key: AppleTV.Key): Promise<AppleTV>;
    private sendKeyPressAndRelease;
    private sendKeyPress;
    private requestPlaybackQueueWithWait;
    private sendConnectionState;
    private sendClientUpdatesConfig;
    private sendWakeDevice;
    private onReceiveMessage;
    private setupListeners;
}
