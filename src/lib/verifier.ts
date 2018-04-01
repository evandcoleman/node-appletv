import { load } from 'protobufjs';
import * as path from 'path';
import * as ed25519 from 'ed25519';
import * as crypto from 'crypto';
import * as curve25519 from 'curve25519-n2';

import { AppleTV } from './appletv';
import { Credentials } from './credentials';
import { Message } from './message';
import tlv from './util/tlv';
import enc from './util/encryption';

export class Verifier {
  constructor(public device: AppleTV) {

  }

  verify(): Promise<{}> {
    var verifyPrivate = Buffer.alloc(32);
    curve25519.makeSecretKey(verifyPrivate);
    let verifyPublic = curve25519.derivePublicKey(verifyPrivate)

    let that = this;
    let tlvData = tlv.encode(
      tlv.Tag.Sequence, 0x01,
      tlv.Tag.PublicKey, verifyPublic
    );
    let message = {
      status: 0,
      state: 3,
      isRetrying: true,
      isUsingSystemPairing: true,
      pairingData: tlvData
    };

    return that.device
      .sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', message, false)
      .then(() => {
        return that.waitForSequence(0x02);
      })
      .then(message => {
        let pairingData = message.payload.pairingData;
        let tlvData = tlv.decode(pairingData);
        let sessionPublicKey = tlvData[tlv.Tag.PublicKey];
        let encryptedData = tlvData[tlv.Tag.EncryptedData];

        if (sessionPublicKey.length != 32) {
          throw new Error(`sessionPublicKey must be 32 bytes (but was ${sessionPublicKey.length})`);
        }

        let sharedSecret = curve25519.deriveSharedSecret(verifyPrivate, sessionPublicKey);
        let encryptionKey = enc.HKDF(
          "sha512",
          Buffer.from("Pair-Verify-Encrypt-Salt"),
          sharedSecret,
          Buffer.from("Pair-Verify-Encrypt-Info"),
          32
        );
        let cipherText = encryptedData.slice(0, -16);
        let hmac = encryptedData.slice(-16);
        let decryptedData = enc.verifyAndDecrypt(cipherText, hmac, null, Buffer.from('PV-Msg02'), encryptionKey);
        let innerTLV = tlv.decode(decryptedData);
        let identifier = innerTLV[tlv.Tag.Username];
        let signature = innerTLV[tlv.Tag.Signature];

        if (!identifier.equals(that.device.credentials.identifier)) {
          throw new Error("Identifier mismatch");
        }

        let deviceInfo = Buffer.concat([sessionPublicKey, Buffer.from(identifier), verifyPublic]);
        if (!ed25519.Verify(deviceInfo, signature, that.device.credentials.publicKey)) {
          throw new Error("Signature verification failed");
        }

        let material = Buffer.concat([verifyPublic, Buffer.from(that.device.credentials.pairingId), sessionPublicKey]);
        let keyPair = ed25519.MakeKeypair(that.device.credentials.encryptionKey);
        let signed = ed25519.Sign(material, keyPair);
        let plainTLV = tlv.encode(
          tlv.Tag.Username, Buffer.from(that.device.credentials.pairingId),
          tlv.Tag.Signature, signed
        );
        let encryptedTLV = Buffer.concat(enc.encryptAndSeal(plainTLV, null, Buffer.from('PV-Msg03'), encryptionKey));
        let outerTLV = tlv.encode(
          tlv.Tag.Sequence, 0x03,
          tlv.Tag.EncryptedData, encryptedTLV
        );
        let newMessage = {
          status: 0,
          state: 3,
          isRetrying: false,
          isUsingSystemPairing: true,
          pairingData: outerTLV
        };

        return that.device
          .sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', newMessage, false)
          .then(() => {
            return that.waitForSequence(0x04);
          })
          .then(() => {
            let readKey = enc.HKDF(
              "sha512",
              Buffer.from("MediaRemote-Salt"),
              sharedSecret,
              Buffer.from("MediaRemote-Read-Encryption-Key"),
              32
            );
            let writeKey = enc.HKDF(
              "sha512",
              Buffer.from("MediaRemote-Salt"),
              sharedSecret,
              Buffer.from("MediaRemote-Write-Encryption-Key"),
              32
            );

            return {
              readKey: readKey,
              writeKey: writeKey
            };
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