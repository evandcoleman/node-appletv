import * as srp from 'fast-srp-hap';
import * as crypto from 'crypto';
// import * as ed25519 from 'ed25519';
// import * as curve25519 from 'curve25519-n2';
import * as tweetnacl from 'tweetnacl';

import { SRPBase } from './base';
import { KeyPair } from '../../credentials-store';
import enc from '../../util/encryption';

export class SRPServerSession extends SRPBase {
  public signature: Buffer;
  public username: Buffer;
  public signPk: Buffer;
  public publicKey: Buffer;
  public privateKey: Buffer;

  public readKey: Buffer;
  public writeKey: Buffer;

  private signSk: Buffer;
  private sharedSecret: Buffer;

  constructor(pairingId: string, private keyPair: KeyPair, public clientPublicKey: Buffer) {
    super();
    
    let seed: Buffer = crypto.randomBytes(32);
    let { secretKey, publicKey } = tweetnacl.box.keyPair();
    this.publicKey = Buffer.from(publicKey);
    this.privateKey = Buffer.from(secretKey);
    this.signSk = keyPair.signSk;
    this.signPk = keyPair.signPk;
    this.sharedSecret = Buffer.from(tweetnacl.scalarMult(this.privateKey, this.clientPublicKey));
    this.encryptionKey = enc.HKDF(
      'sha512',
      Buffer.from('Pair-Verify-Encrypt-Salt'),
      this.sharedSecret,
      Buffer.from('Pair-Verify-Encrypt-Info'),
      32
    );
    this.username = Buffer.from(pairingId);
    let material = Buffer.concat([
      this.publicKey,
      this.username,
      this.clientPublicKey
    ]);
    this.signature = Buffer.from(tweetnacl.sign.detached(material, this.signSk));
    this.readKey = enc.HKDF(
      'sha512',
      Buffer.from('MediaRemote-Salt'),
      this.sharedSecret,
      Buffer.from('MediaRemote-Write-Encryption-Key'),
      32
    );
    this.writeKey = enc.HKDF(
      'sha512',
      Buffer.from('MediaRemote-Salt'),
      this.sharedSecret,
      Buffer.from('MediaRemote-Read-Encryption-Key'),
      32
    );
  }
}