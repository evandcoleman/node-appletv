import enc from '../lib/util/encryption';
import * as crypto from 'crypto';
import { expect } from 'chai';
import 'mocha';

describe('test encryption', function() {
  it('should encrypt and decrypt string', function() {
    let value = Buffer.from("some string");
    let nonce = Buffer.from('Some-Nonce');
    let key = enc.HKDF(
      "sha512",
      Buffer.from("Pair-Setup-Encrypt-Salt"),
      crypto.randomBytes(32),
      Buffer.from("Pair-Setup-Encrypt-Info"),
      32
    );
    let encrypted = enc.encryptAndSeal(value, null, nonce, key)[0];
    let decrypted = enc.verifyAndDecrypt(encrypted, nonce, key);
    
    expect(decrypted.toString()).to.equal(value.toString());
  });
});