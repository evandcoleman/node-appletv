import * as srp from 'fast-srp-hap';
import * as crypto from 'crypto';
import * as tweetnacl from 'tweetnacl';

import { SRPBase } from './base';
import enc from '../../util/encryption';

export class SRPClientAuth extends SRPBase {
  public salt: Buffer;
  public clientSessionPublicKey: Buffer;
  public serverSessionPublicKey: Buffer;
  public publicKey: Buffer;
  public seed: Buffer = crypto.randomBytes(32);
  public signature: Buffer;

  private username: Buffer = Buffer.from('Pair-Setup');
  private sharedSecret: Buffer;

  private srp: srp.Client;

  get serverProof(): Buffer {
    return this.srp.computeM2();
  }

  constructor(private pairingId: string) {
    super();
  }

  setPassword(password: string): Buffer {
    this.srp = srp.Client(
      srp.params['3072'],
      this.salt,
      this.username,
      Buffer.from(password),
      this.seed
    );
    this.srp.setB(this.serverSessionPublicKey);
    this.clientSessionPublicKey = this.srp.computeA();

    this.generateEncryptionKey();
    this.generateSignature();

    return this.srp.computeM1(); // proof
  }

  verifyProof(proof: Buffer) {
    this.srp.checkM2(proof);
  }

  private generateEncryptionKey() {
    if (this.encryptionKey) return;

    this.sharedSecret = this.srp.computeK();
    this.encryptionKey = enc.HKDF(
      "sha512",
      Buffer.from("Pair-Setup-Encrypt-Salt"),
      this.sharedSecret,
      Buffer.from("Pair-Setup-Encrypt-Info"),
      32
    );
  }

  private generateSignature() {
    if (this.signature) return;

    let { publicKey, secretKey } = tweetnacl.sign.keyPair();
    this.publicKey = Buffer.from(publicKey);
    this.sharedSecret = this.srp.computeK();
    let deviceHash = enc.HKDF(
      "sha512",
      Buffer.from("Pair-Setup-Controller-Sign-Salt"),
      this.sharedSecret,
      Buffer.from("Pair-Setup-Controller-Sign-Info"),
      32
    );
    let deviceInfo = Buffer.concat([deviceHash, Buffer.from(this.pairingId), Buffer.from(publicKey)]);
    this.signature = Buffer.from(tweetnacl.sign.detached(deviceInfo, Buffer.from(secretKey)));
  }
}