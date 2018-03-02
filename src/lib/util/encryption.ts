import { api as Sodium } from 'sodium';
import * as crypto from 'crypto';

import number from './number';

function computePoly1305(cipherText: Buffer, AAD: Buffer, nonce: Buffer, key: Buffer): Buffer {
    if (AAD == null) {
        AAD = Buffer.alloc(0);
    }

    const msg =
        Buffer.concat([
            AAD,
            getPadding(AAD, 16),
            cipherText,
            getPadding(cipherText, 16),
            number.UInt53toBufferLE(AAD.length),
            number.UInt53toBufferLE(cipherText.length)
        ])

    const polyKey = Sodium.crypto_stream_chacha20(32, nonce, key);
    const computed_hmac = Sodium.crypto_onetimeauth(msg, polyKey);
    polyKey.fill(0);

    return computed_hmac;
}

// i'd really prefer for this to be a direct call to
// Sodium.crypto_aead_chacha20poly1305_decrypt()
// but unfortunately the way it constructs the message to
// calculate the HMAC is not compatible with homekit
// (long story short, it uses [ AAD, AAD.length, CipherText, CipherText.length ]
// whereas homekit expects [ AAD, CipherText, AAD.length, CipherText.length ]
function verifyAndDecrypt(cipherText: Buffer, mac: Buffer, AAD: Buffer, nonce: Buffer, key: Buffer): Buffer {
    const matches =
        Sodium.crypto_verify_16(
            mac,
            computePoly1305(cipherText, AAD, nonce, key)
        );

    if (matches === 0) {
        return Sodium
            .crypto_stream_chacha20_xor_ic(cipherText, nonce, 1, key);
    }

    return null;
}

// See above about calling directly into libsodium.
function encryptAndSeal(plainText: Buffer, AAD: Buffer, nonce: Buffer, key: Buffer): Buffer[] {
    const cipherText =
        Sodium
            .crypto_stream_chacha20_xor_ic(plainText, nonce, 1, key);

    const hmac =
        computePoly1305(cipherText, AAD, nonce, key);

    return [ cipherText, hmac ];
}

function getPadding(buffer, blockSize) {
    return buffer.length % blockSize === 0
        ? Buffer.alloc(0)
        : Buffer.alloc(blockSize - (buffer.length % blockSize))
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