import { AppleTV } from './appletv';
export declare class Pairing {
    device: AppleTV;
    private srp;
    private key;
    private publicKey;
    private proof;
    private private;
    private deviceSalt;
    private devicePublicKey;
    private deviceProof;
    constructor(device: AppleTV);
    initiatePair(log?: (string) => void): Promise<(pin: string) => Promise<AppleTV>>;
    private completePairing(log, pin);
}
