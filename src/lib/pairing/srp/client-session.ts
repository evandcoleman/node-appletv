import * as srp from 'fast-srp-hap';
import * as crypto from 'crypto';
import * as ed25519 from 'ed25519';
import * as curve25519 from 'curve25519-n2';

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
    
    this.privateKey = Buffer.alloc(32);
    curve25519.makeSecretKey(this.privateKey);
    this.publicKey = curve25519.derivePublicKey(this.privateKey);
  }

  setSessionPublicKey(key: Buffer, ltsk: Buffer) {
    this.sessionPublicKey = key;
    this.sharedSecret = curve25519.deriveSharedSecret(this.privateKey, key);
    this.encryptionKey = enc.HKDF(
      "sha512",
      Buffer.from("Pair-Verify-Encrypt-Salt"),
      this.sharedSecret,
      Buffer.from("Pair-Verify-Encrypt-Info"),
      32
    );

    let material = Buffer.concat([this.publicKey, this.username, key]);
    let keyPair = ed25519.MakeKeypair(ltsk);
    this.signature = ed25519.Sign(material, keyPair);

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