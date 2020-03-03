import * as srp from 'fast-srp-hap';
import * as crypto from 'crypto';
import * as tweetnacl from 'tweetnacl';

import { SRPBase } from './base';
import enc from '../../util/encryption';

export class SRPClientSession extends SRPBase {
  public signature: Buffer;
  public publicKey: Buffer;
  public sessionPublicKey: Buffer;

  public readKey: Buffer;
  public writeKey: Buffer;

  private privateKey: Buffer;
  private sharedSecret: Buffer;

  constructor(public username: Buffer) {
    super();
    
    let { publicKey, secretKey } = tweetnacl.box.keyPair();
    this.privateKey = Buffer.from(secretKey);
    this.publicKey = Buffer.from(publicKey);
  }

  setSessionPublicKey(key: Buffer, ltsk: Buffer) {
    this.sessionPublicKey = key;
    this.sharedSecret = Buffer.from(tweetnacl.scalarMult(this.privateKey, key));
    this.encryptionKey = enc.HKDF(
      "sha512",
      Buffer.from("Pair-Verify-Encrypt-Salt"),
      this.sharedSecret,
      Buffer.from("Pair-Verify-Encrypt-Info"),
      32
    );

    let material = Buffer.concat([this.publicKey, this.username, key]);
    let keyPair = tweetnacl.sign.keyPair.fromSeed(ltsk);
    this.signature = Buffer.from(tweetnacl.sign.detached(material, keyPair.secretKey));

    this.readKey = enc.HKDF(
      "sha512",
      Buffer.from("MediaRemote-Salt"),
      this.sharedSecret,
      Buffer.from("MediaRemote-Read-Encryption-Key"),
      32
    );
    this.writeKey = enc.HKDF(
      "sha512",
      Buffer.from("MediaRemote-Salt"),
      this.sharedSecret,
      Buffer.from("MediaRemote-Write-Encryption-Key"),
      32
    );
  }
}