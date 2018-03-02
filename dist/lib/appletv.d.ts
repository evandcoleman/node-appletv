/// <reference types="mdns" />
import { Service } from 'mdns';
import { Message as ProtoMessage } from 'protobufjs';
import { Credentials } from './credentials';
export declare class AppleTV {
    private service;
    private log;
    name: string;
    address: string;
    port: number;
    uid: string;
    pairingId: string;
    credentials: Credentials;
    private connection;
    private stateCallbacks;
    constructor(service: Service, log?: (string) => void);
    /**
    * Pair with an already discovered AppleTV.
    * @param log  An optional function to log debug information.
    * @returns A promise that resolves to the AppleTV object.
    */
    pair(log?: (string) => void): Promise<(pin: string) => Promise<AppleTV>>;
    /**
    * Opens a connection to the AppleTV over the MRP protocol.
    * @param credentials  The credentials object for this AppleTV
    * @returns A promise that resolves to the AppleTV object.
    */
    openConnection(credentials?: Credentials): Promise<AppleTV>;
    /**
    * Send a Protobuf message to the AppleTV. This is for advanced usage only.
    * @param message  The Protobuf message to send.
    * @returns A promise that resolves to the response from the AppleTV.
    */
    sendMessage(message: ProtoMessage<{}>): Promise<ProtoMessage<{}>>;
    /**
    * Observes the now playing state of the AppleTV.
    * @param callback  The callback to send updates to.
    */
    observeState(callback: (Error, NowPlayingInfo) => void): void;
    /**
    * Observes notifications sent from the AppleTV.
    * @param callback  The callback to send notifications to.
    */
    observeNotifications(callback: (Error, Notification) => void): void;
    /**
    * Observes all messages sent from the AppleTV.
    * @param callback  The callback to send messages to.
    */
    observeMessages(callback: (Error, Message) => void): void;
    /**
    * Send a key command to the AppleTV.
    * @param The key to press.
    * @returns A promise that resolves to the AppleTV object after the message has been sent.
    */
    sendKeyCommand(key: AppleTV.Key): Promise<AppleTV>;
    private sendKeyPressAndRelease(usePage, usage);
    private sendKeyPress(usePage, usage, down);
    private sendIntroduction();
    private sendConnectionState();
    private sendReadyState();
    private sendClientUpdatesConfig();
    private sendWakeDevice();
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
    }
    /** Convert a string representation of a key to the correct enum type.
    * @param string  The string.
    * @returns The key enum value.
    */
    function key(string: string): AppleTV.Key;
}
