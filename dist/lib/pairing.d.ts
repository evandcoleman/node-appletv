import { TVClient } from './tvclient';
export declare class Pairing {
    device: TVClient;
    private srp;
    private key;
    private publicKey;
    private proof;
    private deviceSalt;
    private devicePublicKey;
    private deviceProof;
    constructor(device: TVClient);
    /**
    * Initiates the pairing process
    * @returns A promise that resolves to a callback which takes in the pairing pin from the Apple TV.
    */
    initiatePair(): Promise<(pin: string) => Promise<TVClient>>;
    private completePairing;
    private sendThirdSequence;
    private sendFifthSequence;
}
