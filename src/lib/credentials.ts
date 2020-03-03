import encryption from './util/encryption';
import number from './util/number';

export class Credentials {
  public readKey: Buffer;
  public writeKey: Buffer;

  private encryptCount: number = 0;
  private decryptCount: number = 0;

  constructor(public localUid: string, public remoteUid: string, public ltpk: Buffer, public ltsk: Buffer) {
    
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
      parts[1],
      Buffer.from(parts[2], 'hex'),
      Buffer.from(parts[3], 'hex')
    );
  }

  /**
  * Returns a string representation of a Credentials object.
  * @returns A string representation of a Credentials object.
  */
  toString(): string {
    return this.localUid.toLowerCase()
      + ":"
      + this.remoteUid.toLowerCase()
      + ":"
      + this.ltpk.toString('hex')
      + ":"
      + this.ltsk.toString('hex');
  }

  static fromJSON(json: any): Credentials {
    return new Credentials(
      json.localUid,
      json.remoteUid,
      Buffer.from(json.ltpk, 'hex'),
      Buffer.from(json.ltsk, 'hex')
    );
  }

  toJSON(extended: boolean = false): { [key: string]: string; } {
    var out: any = {
      localUid: this.localUid,
      remoteUid: this.remoteUid,
      ltpk: this.ltpk.toString('hex'),
      ltsk: this.ltsk.toString('hex')
    };
    if (extended) {
      out.readKey = this.readKey.toString('hex');
      out.writeKey = this.writeKey.toString('hex');
    }
    return out;
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