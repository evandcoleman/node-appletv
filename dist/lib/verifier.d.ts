import { AppleTV } from './appletv';
export declare class Verifier {
    device: AppleTV;
    constructor(device: AppleTV);
    verify(): Promise<{}>;
    private requestPairingData;
    private completeVerification;
}
