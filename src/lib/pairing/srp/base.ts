import enc from '../../util/encryption';

export class SRPBase {
  public encryptionKey: Buffer;
  
  decrypt(data: Buffer, nonce: Buffer): Buffer {
    let cipherText = data.slice(0, -16);
    let hmac = data.slice(-16);

    return enc.verifyAndDecrypt(
      cipherText,
      hmac,
      null,
      nonce,
      this.encryptionKey
    );
  }

  encrypt(data: Buffer, nonce: Buffer): Buffer {
    return Buffer.concat(enc.encryptAndSeal(
      data,
      null,
      nonce,
      this.encryptionKey
    ));
  }
}