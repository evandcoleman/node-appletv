import * as srp from 'fast-srp-hap';
import { api as Sodium } from 'sodium';
import { v4 as uuid } from 'uuid';
import { load, Message } from 'protobufjs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as ed25519 from 'ed25519';

import { AppleTV } from './appletv';
import { Credentials } from './credentials';
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
    return load(path.resolve(__dirname + "/protos/CryptoPairingMessage.proto"))
      .then(root => {
        let type = root.lookupType('CryptoPairingMessage');
        let tlvData = tlv.encode(
          tlv.Tag.PairingMethod, 0x00,
          tlv.Tag.Sequence, 0x01
        );
        let message = type.create({
          status: 0,
          pairingData: tlvData
        });

        return that.device
          .sendMessage(message);
      })
      .then(message => {
        let pairingData = message['pairingData'];
        let tlvData = tlv.decode(pairingData);
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
    return load(path.resolve(__dirname + "/protos/CryptoPairingMessage.proto"))
      .then(root => {
        let type = root.lookupType('CryptoPairingMessage');
        let tlvData = tlv.encode(
          tlv.Tag.Sequence, 0x03,
          tlv.Tag.PublicKey, that.publicKey,
          tlv.Tag.Proof, that.proof
        );
        let message = type.create({
          status: 0,
          pairingData: tlvData
        });

        return that.device
          .sendMessage(message)
          .then(message => {
            let pairingData = message["pairingData"];
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
            let nextMessage = type.create({
              status: 0,
              pairingData: outerTLV
            });

            return that.device
              .sendMessage(nextMessage)
              .then(message => {
                let encryptedData = tlv.decode(message["pairingData"])[tlv.Tag.EncryptedData];
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
      });
  }
}