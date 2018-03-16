/// <reference types="node" />
declare const _default: {
    Tag: {
        PairingMethod: number;
        Username: number;
        Salt: number;
        PublicKey: number;
        Proof: number;
        EncryptedData: number;
        Sequence: number;
        ErrorCode: number;
        BackOff: number;
        Signature: number;
        MFiCertificate: number;
        MFiSignature: number;
    };
    encode: (type: any, data: any, ...args: any[]) => Buffer;
    decode: (data: any) => {};
};
export default _default;
