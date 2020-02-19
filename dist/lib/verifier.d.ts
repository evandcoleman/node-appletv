import { TVClient } from './tvclient';
export declare class Verifier {
    device: TVClient;
    constructor(device: TVClient);
    verify(): Promise<{}>;
    private requestPairingData;
    private completeVerification;
}
