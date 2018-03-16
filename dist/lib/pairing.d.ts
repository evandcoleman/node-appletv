import { AppleTV } from './appletv';
export declare class Pairing {
    device: AppleTV;
    private srp;
    private key;
    private publicKey;
    private proof;
    private deviceSalt;
    private devicePublicKey;
    private deviceProof;
    constructor(device: AppleTV);
    /**
    * Initiates the pairing process
    * @returns A promise that resolves to a callback which takes in the pairing pin from the Apple TV.
    */
    initiatePair(): Promise<(pin: string) => Promise<AppleTV>>;
    private completePairing(pin);
    private waitForSequence(sequence, timeout?);
}
