/// <reference types="node" />
export declare class Credentials {
    localUid: string;
    remoteUid: string;
    ltpk: Buffer;
    ltsk: Buffer;
    readKey: Buffer;
    writeKey: Buffer;
    private encryptCount;
    private decryptCount;
    constructor(localUid: string, remoteUid: string, ltpk: Buffer, ltsk: Buffer);
    /**
    * Parse a credentials string into a Credentials object.
    * @param text  The credentials string.
    * @returns A credentials object.
    */
    static parse(text: string): Credentials;
    /**
    * Returns a string representation of a Credentials object.
    * @returns A string representation of a Credentials object.
    */
    toString(): string;
    static fromJSON(json: any): Credentials;
    toJSON(extended?: boolean): {
        [key: string]: string;
    };
    encrypt(message: Buffer): Buffer;
    decrypt(message: Buffer): Buffer;
}
