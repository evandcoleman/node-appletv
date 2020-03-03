/// <reference types="node" />
declare function UInt53toBufferLE(number: number): Buffer;
declare function UInt16toBufferBE(number: number): Buffer;
declare function uintHighLow(number: number): [number, number];
declare function writeUInt64LE(number: number, buffer: Buffer, offset?: number): void;
declare const _default: {
    UInt53toBufferLE: typeof UInt53toBufferLE;
    UInt16toBufferBE: typeof UInt16toBufferBE;
    uintHighLow: typeof uintHighLow;
    writeUInt64LE: typeof writeUInt64LE;
};
export default _default;
