import * as srp from 'fast-srp-hap';
import * as crypto from 'crypto';
import * as ed25519 from 'ed25519';
import * as curve25519 from 'curve25519-n2';

import { SRPBase } from './base';
import { KeyPair } from '../../credentials-store';
import enc from '../../util/encryption';

export class SRPServerAuth extends SRPBase {
  public salt: Buffer = crypto.randomBytes(16);
  public publicKey: Buffer;
  public privateKey: Buffer = crypto.randomBytes(384);
  public sessionPublicKey: Buffer;
  public signature: Buffer;

  private username: Buffer = Buffer.from('Pair-Setup');
  private sharedSecret: Buffer;
  public seed: Buffer = crypto.randomBytes(32);

  private srp: srp.Server;

  get serverProof(): Buffer {
    return this.srp.computeM2();
  }

  constructor(private pairingId: string, public keyPair: KeyPair, password: string) {
    super();

    this.srp = new srp.Server(srp.params[3072], this.salt, this.username, Buffer.from(password), this.privateKey);
    this.sessionPublicKey = this.srp.computeB();
  }

  setClientSessionPublicKey(publicKey: Buffer) {
    this.srp.setA(publicKey);
    this.generateEncryptionKey();
    this.generateSignature();
  }

  verifyProof(proof: Buffer) {
    this.srp.checkM1(proof);
  }

  private generateEncryptionKey() {
    if (this.encryptionKey) return;

    this.sharedSecret = this.srp.computeK();
    this.encryptionKey = enc.HKDF(
      'sha512',
      Buffer.from('Pair-Setup-Encrypt-Salt'),
      this.sharedSecret,
      Buffer.from('Pair-Setup-Encrypt-Info'),
      32
    );
  }

  private generateSignature() {
    if (this.signature) return;

    this.publicKey = this.keyPair.signPk;
    let serverHash = enc.HKDF(
      'sha512',
      Buffer.from('Pair-Setup-Accessory-Sign-Salt'),
      this.sharedSecret,
      Buffer.from('Pair-Setup-Accessory-Sign-Info'),
      32
    );
    let serverInfo = Buffer.concat([
      serverHash,
      Buffer.from(this.pairingId),
      this.publicKey,
    ]);
    this.signature = ed25519.Sign(serverInfo, this.keyPair.signSk);
  }
}