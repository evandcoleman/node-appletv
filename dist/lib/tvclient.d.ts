/// <reference types="node" />
import { Service } from 'mdns';
import { Socket } from 'net';
import { AppleTV, PlaybackQueueRequestOptions, SendProtocolMessageOptions, SendMessageOptions } from './appletv';
import { Credentials } from './credentials';
import { NowPlayingInfo } from './now-playing-info';
import { Message } from './message';
export declare class TVClient extends AppleTV {
    private service;
    address: string;
    socket: Socket;
    remoteUid: string;
    private pairingClient;
    constructor(service: Service, socket?: Socket);
    /**
    * Pair with an already discovered AppleTV.
    * @returns A promise that resolves to the AppleTV object.
    */
    pair(): Promise<(pin: string) => Promise<TVClient>>;
    /**
    * Opens a connection to the AppleTV over the MRP protocol.
    * @param credentials  The credentials object for this AppleTV
    * @returns A promise that resolves to the AppleTV object.
    */
    open(credentials?: Credentials): Promise<this>;
    beginSession(): Promise<this>;
    private openSocket;
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
    sendMessage(options: SendMessageOptions): Promise<Message>;
    send(options: SendProtocolMessageOptions): Promise<Message>;
    private sendKeyPressAndRelease;
    private sendKeyPress;
    private requestPlaybackQueueWithWait;
    private sendConnectionState;
    private sendClientUpdatesConfig;
    private sendWakeDevice;
    onReceiveMessage(message: Message): void;
    private setupListeners;
}
