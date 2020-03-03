/// <reference types="node" />
import { Credentials } from './credentials';
export interface KeyPair {
    signPk: Buffer;
    signSk: Buffer;
}
export declare class CredentialsStore {
    identifier: string;
    private storePath;
    private storeDirectory;
    private store;
    private isCreated;
    private isLoaded;
    constructor(identifier: string);
    keyPair(): Promise<KeyPair>;
    add(credentials: Credentials): Promise<void>;
    get(uid: string): Promise<Credentials>;
    private load;
    private save;
    private create;
}
