/// <reference types="node" />
export declare class Chacha20Ctx {
    input: any[];
    leftover: number;
    buffer: Uint8Array;
    constructor();
}
export declare function load32(x: Uint8Array, i: number): number;
export declare function store32(x: any, i: number, u: number): void;
export declare function plus(v: number, w: number): number;
export declare function rotl32(v: number, c: number): number;
export declare function quarterRound(x: any, a: number, b: number, c: number, d: number): void;
export declare function chacha20_keysetup(ctx: Chacha20Ctx, key: Uint8Array): void;
export declare function chacha20_ivsetup(ctx: Chacha20Ctx, iv: Uint8Array): void;
export declare function chacha20_encrypt(ctx: Chacha20Ctx, dst: Uint8Array, src: Uint8Array, len: number): void;
export declare function chacha20_decrypt(ctx: Chacha20Ctx, dst: Buffer, src: Buffer, len: number): void;
export declare function chacha20_update(ctx: Chacha20Ctx, dst: Buffer, src: Buffer, inlen: number): number;
export declare function chacha20_final(ctx: Chacha20Ctx, dst: Buffer): number;
export declare function chacha20_keystream(ctx: Chacha20Ctx, dst: Buffer, len: number): void;
export declare class Poly1305Ctx {
    buffer: Buffer;
    leftover: number;
    r: any[];
    h: any[];
    pad: any[];
    finished: number;
    constructor();
}
export declare function U8TO16(p: Uint8Array, pos: number): number;
export declare function U16TO8(p: Uint8Array, pos: number, v: number): void;
export declare function poly1305_init(ctx: Poly1305Ctx, key: Buffer): void;
export declare function poly1305_blocks(ctx: Poly1305Ctx, m: Uint8Array, mpos: number, bytes: number): void;
export declare function poly1305_update(ctx: Poly1305Ctx, m: Uint8Array, bytes: number): void;
export declare function poly1305_finish(ctx: Poly1305Ctx, mac: Uint8Array): void;
export declare function poly1305_auth(mac: Uint8Array, m: Uint8Array, bytes: number, key: Buffer): void;
export declare function poly1305_verify(mac1: any, mac2: any): number;
export declare class AeadCtx {
    key: Buffer;
    constructor(key: Buffer);
}
export declare function aead_init(c20ctx: Chacha20Ctx, key: Buffer, nonce: Buffer): any;
export declare function store64(dst: Uint8Array, pos: number, num: number): void;
export declare function aead_mac(key: Buffer, ciphertext: string, data: string): any;
export declare function aead_encrypt(ctx: AeadCtx, nonce: Buffer, input: Buffer, ad: string): any[];
export declare function aead_decrypt(ctx: AeadCtx, nonce: Buffer, ciphertext: any, ad: string): any;
