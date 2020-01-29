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
  initiatePair(): Promise<(pin: string) => Promise<AppleTV>> {
    let that = this;
    let tlvData = tlv.encode(
      tlv.Tag.PairingMethod, 0x00,
      tlv.Tag.Sequence, 0x01,
    );
    let message = {
      status: 0,
      isUsingSystemPairing: true,
      isRetrying: true,
      state: 2,
      pairingData: tlvData
    };
    return this.device
      .sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', message, false)
      .then(() => {
        return that.waitForSequence(0x02);
      })
      .then(message => {
        let pairingData = message.payload.pairingData;
        let tlvData = tlv.decode(pairingData);

        if (tlvData[tlv.Tag.BackOff]) {
          let backOff: Buffer = tlvData[tlv.Tag.BackOff];
          let seconds = backOff.readIntBE(0, backOff.byteLength);
          if (seconds > 0) {
            throw new Error("You've attempt to pair too recently. Try again in " + seconds + " seconds.");
          }
        }
        if (tlvData[tlv.Tag.ErrorCode]) {
          let buffer: Buffer = tlvData[tlv.Tag.ErrorCode];
          throw new Error(that.device.name + " responded with error code " + buffer.readIntBE(0, buffer.byteLength) + ". Try rebooting your Apple TV.");
        }

        that.deviceSalt = tlvData[tlv.Tag.Salt];
        that.devicePublicKey = tlvData[tlv.Tag.PublicKey];

        if (that.deviceSalt.byteLength != 16) {
          throw new Error(`salt must be 16 bytes (but was ${that.deviceSalt.byteLength})`);
        }
        if (that.devicePublicKey.byteLength !== 384) {
          throw new Error(`serverPublicKey must be 384 bytes (but was ${that.devicePublicKey.byteLength})`);
        }

        return Promise.resolve((pin: string) => {
          return that.completePairing(pin);
        });
      });
  }

  private completePairing(pin: string): Promise<AppleTV> {
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

    let that = this;
    let tlvData = tlv.encode(
      tlv.Tag.Sequence, 0x03,
      tlv.Tag.PublicKey, that.publicKey,
      tlv.Tag.Proof, that.proof
    );
    let message = {
      status: 0,
      pairingData: tlvData
    };

    return this.device
      .sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', message, false)
      .then(() => {
        return that.waitForSequence(0x04);
      })
      .then(message => {
        let pairingData = message.payload.pairingData;
        that.deviceProof = tlv.decode(pairingData)[tlv.Tag.Proof];
        // console.log("DEBUG: Device Proof=" + that.deviceProof.toString('hex'));

        that.srp.checkM2(that.deviceProof);

        let seed = crypto.randomBytes(32);
        let keyPair = ed25519.MakeKeypair(seed);
        let privateKey = keyPair.privateKey;
        let publicKey = keyPair.publicKey;
        let sharedSecret = that.srp.computeK();

        let deviceHash = enc.HKDF(
          "sha512",
          Buffer.from("Pair-Setup-Controller-Sign-Salt"),
          sharedSecret,
          Buffer.from("Pair-Setup-Controller-Sign-Info"),
          32
        );
        let deviceInfo = Buffer.concat([deviceHash, Buffer.from(that.device.pairingId), publicKey]);
        let deviceSignature = ed25519.Sign(deviceInfo, privateKey);
        let encryptionKey = enc.HKDF(
          "sha512",
          Buffer.from("Pair-Setup-Encrypt-Salt"),
          sharedSecret,
          Buffer.from("Pair-Setup-Encrypt-Info"),
          32
        );

        let tlvData = tlv.encode(
          tlv.Tag.Username, Buffer.from(that.device.pairingId),
          tlv.Tag.PublicKey, publicKey,
          tlv.Tag.Signature, deviceSignature
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

        return that.device
          .sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', nextMessage, false)
          .then(() => {
            return that.waitForSequence(0x06);
          })
          .then(message => {
            let encryptedData = tlv.decode(message.payload.pairingData)[tlv.Tag.EncryptedData];
            let cipherText = encryptedData.slice(0, -16);
            let hmac = encryptedData.slice(-16);
            let decrpytedData = enc.verifyAndDecrypt(cipherText, hmac, null, Buffer.from('PS-Msg06'), encryptionKey);
            let tlvData = tlv.decode(decrpytedData);
            that.device.credentials = new Credentials(
              that.device.uid,
              tlvData[tlv.Tag.Username],
              that.device.pairingId,
              tlvData[tlv.Tag.PublicKey],
              seed
            );

            return that.device;
          });
      });
  }

  private waitForSequence(sequence: number, timeout: number = 3): Promise<Message> {
    let that = this;
    let handler = (message: Message, resolve: any) => {
      let tlvData = tlv.decode(message.payload.pairingData);
      if (Buffer.from([sequence]).equals(tlvData[tlv.Tag.Sequence])) {
        resolve(message);
      }
    };

    return new Promise<Message>((resolve, reject) => {
      that.device.on('message', (message: Message) => {
        if (message.type == Message.Type.CryptoPairingMessage) {
          handler(message, resolve);
        }
      });
      setTimeout(() => {
        reject(new Error("Timed out waiting for crypto sequence " + sequence));
      }, timeout * 1000);
    })
    .then(value => {
      that.device.removeListener('message', handler);
      return value;
    });
  }
}