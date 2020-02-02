import * as srp from 'fast-srp-hap';
import { v4 as uuid } from 'uuid';
import { load } from 'protobufjs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as ed25519 from 'ed25519';

import { AppleTV } from './appletv';
import { Credentials } from './credentials';
import { Message } from './message';
import tlv from './util/tlv';
import enc from './util/encryption';

export class Pairing {
  private srp: srp.Client;

  private key: Buffer = crypto.randomBytes(32);
  private publicKey: Buffer;
  private proof: Buffer;

  private deviceSalt: Buffer;
  private devicePublicKey: Buffer;
  private deviceProof: Buffer;

  constructor(public device: AppleTV) {
    
  }

  /**
  * Initiates the pairing process
  * @returns A promise that resolves to a callback which takes in the pairing pin from the Apple TV.
  */
  async initiatePair(): Promise<(pin: string) => Promise<AppleTV>> {
    let that = this;
    let tlvData = tlv.encode(
      tlv.Tag.PairingMethod, 0x00,
      tlv.Tag.Sequence, 0x01,
    );
    let requestMessage = {
      status: 0,
      isUsingSystemPairing: true,
      isRetrying: true,
      state: 2,
      pairingData: tlvData
    };
    await this.device.sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', requestMessage, false);
    let message = await this.device.waitForSequence(0x02);
    let pairingData = message.payload.pairingData;
    let decodedData = tlv.decode(pairingData);

    if (decodedData[tlv.Tag.BackOff]) {
      let backOff: Buffer = decodedData[tlv.Tag.BackOff];
      let seconds = backOff.readIntBE(0, backOff.byteLength);
      if (seconds > 0) {
        throw new Error("You've attempt to pair too recently. Try again in " + seconds + " seconds.");
      }
    }
    if (decodedData[tlv.Tag.ErrorCode]) {
      let buffer: Buffer = decodedData[tlv.Tag.ErrorCode];
      throw new Error(this.device.name + " responded with error code " + buffer.readIntBE(0, buffer.byteLength) + ". Try rebooting your Apple TV.");
    }

    this.deviceSalt = decodedData[tlv.Tag.Salt];
    this.devicePublicKey = decodedData[tlv.Tag.PublicKey];

    if (this.deviceSalt.byteLength != 16) {
      throw new Error(`salt must be 16 bytes (but was ${this.deviceSalt.byteLength})`);
    }
    if (this.devicePublicKey.byteLength !== 384) {
      throw new Error(`serverPublicKey must be 384 bytes (but was ${this.devicePublicKey.byteLength})`);
    }

    return (pin: string) => {
      return that.completePairing(pin);
    };
  }

  private async completePairing(pin: string): Promise<AppleTV> {
    await this.sendThirdSequence(pin);
    let message = await this.device.waitForSequence(0x04);
    let pairingData = message.payload.pairingData;
    this.deviceProof = tlv.decode(pairingData)[tlv.Tag.Proof];
    // console.log("DEBUG: Device Proof=" + this.deviceProof.toString('hex'));

    this.srp.checkM2(this.deviceProof);

    let seed = crypto.randomBytes(32);
    let keyPair = ed25519.MakeKeypair(seed);
    let privateKey = keyPair.privateKey;
    let publicKey = keyPair.publicKey;
    let sharedSecret = this.srp.computeK();

    let deviceHash = enc.HKDF(
      "sha512",
      Buffer.from("Pair-Setup-Controller-Sign-Salt"),
      sharedSecret,
      Buffer.from("Pair-Setup-Controller-Sign-Info"),
      32
    );
    let deviceInfo = Buffer.concat([deviceHash, Buffer.from(this.device.pairingId), publicKey]);
    let deviceSignature = ed25519.Sign(deviceInfo, privateKey);
    let encryptionKey = enc.HKDF(
      "sha512",
      Buffer.from("Pair-Setup-Encrypt-Salt"),
      sharedSecret,
      Buffer.from("Pair-Setup-Encrypt-Info"),
      32
    );

    await this.sendFifthSequence(publicKey, deviceSignature, encryptionKey);
    let newMessage = await this.device.waitForSequence(0x06);
    let encryptedData = tlv.decode(newMessage.payload.pairingData)[tlv.Tag.EncryptedData];
    let cipherText = encryptedData.slice(0, -16);
    let hmac = encryptedData.slice(-16);
    let decrpytedData = enc.verifyAndDecrypt(cipherText, hmac, null, Buffer.from('PS-Msg06'), encryptionKey);
    let tlvData = tlv.decode(decrpytedData);
    this.device.credentials = new Credentials(
      this.device.uid,
      tlvData[tlv.Tag.Username],
      this.device.pairingId,
      tlvData[tlv.Tag.PublicKey],
      seed
    );

    return this.device;
  }

  private async sendThirdSequence(pin: string): Promise<Message> {
    this.srp = srp.Client(
      srp.params['3072'],
      this.deviceSalt,
      Buffer.from('Pair-Setup'),
      Buffer.from(pin),
      this.key
    );
    this.srp.setB(this.devicePublicKey);
    this.publicKey = this.srp.computeA();
    this.proof = this.srp.computeM1();

    // console.log("DEBUG: Client Public Key=" + this.publicKey.toString('hex') + "\nProof=" + this.proof.toString('hex'));

    let tlvData = tlv.encode(
      tlv.Tag.Sequence, 0x03,
      tlv.Tag.PublicKey, this.publicKey,
      tlv.Tag.Proof, this.proof
    );
    let message = {
      status: 0,
      pairingData: tlvData
    };

    return await this.device.sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', message, false);
  }

  private async sendFifthSequence(publicKey: Buffer, signature: Buffer, encryptionKey: Buffer): Promise<Message> {
    let tlvData = tlv.encode(
      tlv.Tag.Username, Buffer.from(this.device.pairingId),
      tlv.Tag.PublicKey, publicKey,
      tlv.Tag.Signature, signature
    );
    let encryptedTLV = Buffer.concat(enc.encryptAndSeal(tlvData, null, Buffer.from('PS-Msg05'), encryptionKey));
    // console.log("DEBUG: Encrypted Data=" + encryptedTLV.toString('hex'));
    let outerTLV = tlv.encode(
      tlv.Tag.Sequence, 0x05,
      tlv.Tag.EncryptedData, encryptedTLV
    );
    let nextMessage = {
      status: 0,
      pairingData: outerTLV
    };

    return await this.device.sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', nextMessage, false);
  }
}