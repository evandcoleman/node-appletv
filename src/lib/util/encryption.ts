import * as chacha20 from './chacha20poly1305';
import * as crypto from 'crypto';

import number from './number';

// i'd really prefer for this to be a direct call to
// Sodium.crypto_aead_chacha20_decrypt()
// but unfortunately the way it constructs the message to
// calculate the HMAC is not compatible with homekit
// (long story short, it uses [ AAD, AAD.length, CipherText, CipherText.length ]
// whereas homekit expects [ AAD, CipherText, AAD.length, CipherText.length ]
function verifyAndDecrypt(cipherText: Buffer, mac: Buffer, AAD: Buffer, nonce: Buffer, key: Buffer): Buffer {
    let addData: Buffer | null | undefined = AAD;
    let plainText: Buffer = Buffer.alloc(cipherText.length);

    let ctx = new chacha20.Chacha20Ctx();
    chacha20.chacha20_keysetup(ctx, key);
    chacha20.chacha20_ivsetup(ctx, nonce);
    let poly1305key = Buffer.alloc(64);
    let zeros = Buffer.alloc(64);
    chacha20.chacha20_update(ctx, poly1305key, zeros, zeros.length);

    let poly1305Contxt = new chacha20.Poly1305Ctx();
    chacha20.poly1305_init(poly1305Contxt, poly1305key);

    let addDataLength = 0;
    if (addData !== undefined && addData !== null) {
      addDataLength = addData.length;
      chacha20.poly1305_update(poly1305Contxt, addData, addData.length);
      if ((addData.length % 16) != 0) {
          chacha20.poly1305_update(poly1305Contxt, Buffer.alloc(16 - (addData.length % 16)), 16 - (addData.length % 16));
      }
    }

    chacha20.poly1305_update(poly1305Contxt, cipherText, cipherText.length);
    if ((cipherText.length % 16) != 0) {
        chacha20.poly1305_update(poly1305Contxt, Buffer.alloc(16 - (cipherText.length % 16)), 16 - (cipherText.length % 16));
    }

    let leAddDataLen = Buffer.alloc(8);
    number.writeUInt64LE(addDataLength, leAddDataLen, 0);
    chacha20.poly1305_update(poly1305Contxt, leAddDataLen, 8);

    let leTextDataLen = Buffer.alloc(8);
    number.writeUInt64LE(cipherText.length, leTextDataLen, 0);
    chacha20.poly1305_update(poly1305Contxt, leTextDataLen, 8);

    let polyOut = [] as unknown as Uint8Array;
    chacha20.poly1305_finish(poly1305Contxt, polyOut);

    if (chacha20.poly1305_verify(mac, polyOut) != 1) {
      throw new Error(`Verification failed`);

      return null;
    } else {
      let written = chacha20.chacha20_update(ctx, plainText, cipherText, cipherText.length);
      chacha20.chacha20_final(ctx, plainText.slice(written, cipherText.length));

      return plainText;
    }
}

// See above about calling directly into libsodium.
function encryptAndSeal(plainText: Buffer, AAD: Buffer, nonce: Buffer, key: Buffer): Buffer[] {
  let plaintext: Buffer = plainText;
  let addData: Buffer | null | undefined = AAD;
  let ciphertext: Buffer = Buffer.alloc(plaintext.length);
  let mac: Buffer = Buffer.alloc(16);

  let ctx = new chacha20.Chacha20Ctx();
  chacha20.chacha20_keysetup(ctx, key);
  chacha20.chacha20_ivsetup(ctx, nonce);
  let poly1305key = Buffer.alloc(64);
  let zeros = Buffer.alloc(64);
  chacha20.chacha20_update(ctx,poly1305key,zeros,zeros.length);

  let written = chacha20.chacha20_update(ctx,ciphertext,plaintext,plaintext.length);
  chacha20.chacha20_final(ctx,ciphertext.slice(written,plaintext.length));

  let poly1305Context = new chacha20.Poly1305Ctx();
  chacha20.poly1305_init(poly1305Context, poly1305key);

  let addDataLength = 0;
  if (addData != undefined) {
    addDataLength = addData.length;
    chacha20.poly1305_update(poly1305Context, addData, addData.length);
    if ((addData.length % 16) != 0) {
      chacha20.poly1305_update(poly1305Context, Buffer.alloc(16 - (addData.length % 16)), 16 - (addData.length % 16));
    }
  }

  chacha20.poly1305_update(poly1305Context, ciphertext, ciphertext.length);
  if ((ciphertext.length % 16) != 0) {
      chacha20.poly1305_update(poly1305Context, Buffer.alloc(16 - (ciphertext.length % 16)), 16 - (ciphertext.length % 16));
  }

  const leAddDataLen = Buffer.alloc(8);
  number.writeUInt64LE(addDataLength, leAddDataLen, 0);
  chacha20.poly1305_update(poly1305Context, leAddDataLen, 8);

  const leTextDataLen = Buffer.alloc(8);
  number.writeUInt64LE(ciphertext.length, leTextDataLen, 0);
  chacha20.poly1305_update(poly1305Context, leTextDataLen, 8);

  chacha20.poly1305_finish(poly1305Context, mac);

  return [ciphertext, mac];
}

function HKDF(hashAlg: string, salt: Buffer, ikm: Buffer, info: Buffer, size: number): Buffer {
  // create the hash alg to see if it exists and get its length
  var hash = crypto.createHash(hashAlg);
  var hashLength = hash.digest().length;

  // now we compute the PRK
  var hmac = crypto.createHmac(hashAlg, salt);
  hmac.update(ikm);
  var prk = hmac.digest();

  var prev = Buffer.alloc(0);
  var output;
  var buffers = [];
  var num_blocks = Math.ceil(size / hashLength);
  info = Buffer.from(info);

  for (var i=0; i<num_blocks; i++) {
    var hmac = crypto.createHmac(hashAlg, prk);

    var input = Buffer.concat([
      prev,
      info,
      Buffer.from(String.fromCharCode(i + 1))
    ]);
    hmac.update(input);
    prev = hmac.digest();
    buffers.push(prev);
  }
  output = Buffer.concat(buffers, size);
  return output.slice(0,size);
}

export default {
    encryptAndSeal,
    verifyAndDecrypt,
    HKDF
}