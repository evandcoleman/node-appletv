import { AppleTV } from './appletv';
export declare class Browser {
    private browser;
    private services;
    private uniqueIdentifier;
    private onComplete;
    private onFailure;
    /**
    * Creates a new Browser
    * @param log  An optional function that takes a string to provide verbose logging.
    */
    constructor();
    /**
    * Scans for AppleTVs on the local network.
    * @param uniqueIdentifier  An optional identifier for the AppleTV to scan for. The AppleTV advertises this via Bonjour.
    * @param timeout  An optional timeout value (in seconds) to give up the search after.
    * @returns A promise that resolves to an array of AppleTV objects. If you provide a `uniqueIdentifier` the array is guaranteed to only contain one object.
    */
    scan(uniqueIdentifier?: string, timeout?: number): Promise<AppleTV[]>;
}
