import encryption from './util/encryption';
import number from './util/number';

export class Credentials {
  public readKey: Buffer;
  public writeKey: Buffer;

  private encryptCount: number = 0;
  private decryptCount: number = 0;

  constructor(public uniqueIdentifier: string, public identifier: Buffer, public pairingId: string, public publicKey: Buffer, public encryptionKey: Buffer) {
    
  }

  /**
  * Parse a credentials string into a Credentials object.
  * @param text  The credentials string.
  * @returns A credentials object.
  */
  static parse(text: string): Credentials {
    let parts = text.split(':');
    return new Credentials(
      parts[0],
      Buffer.from(parts[1], 'hex'),
      Buffer.from(parts[2], 'hex').toString(),
      Buffer.from(parts[3], 'hex'),
      Buffer.from(parts[4], 'hex')
    );
  }

  /**
  * Returns a string representation of a Credentials object.
  * @returns A string representation of a Credentials object.
  */
  toString(): string {
    return this.uniqueIdentifier
      + ":"
      + this.identifier.toString('hex')
      + ":"
      + Buffer.from(this.pairingId).toString('hex')
      + ":"
      + this.publicKey.toString('hex')
      + ":"
      + this.encryptionKey.toString('hex');
  }

  encrypt(message: Buffer): Buffer {
    let nonce = number.UInt53toBufferLE(this.encryptCount++)

    return Buffer.concat(encryption.encryptAndSeal(message, null, nonce, this.writeKey));
  }

  decrypt(message: Buffer): Buffer {
    let nonce = number.UInt53toBufferLE(this.decryptCount++);
    let cipherText = message.slice(0, -16);
    let hmac = message.slice(-16);

    return encryption.verifyAndDecrypt(cipherText, hmac, null, nonce, this.readKey);
  }
}