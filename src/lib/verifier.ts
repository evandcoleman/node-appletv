import { load, Message } from 'protobufjs';
import * as path from 'path';
import * as ed25519 from 'ed25519';
import * as crypto from 'crypto';
import { api as Sodium } from 'sodium';
import * as curve25519 from 'curve25519-n2';

import { AppleTV } from './appletv';
import { Credentials } from './credentials';
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
    return load(path.resolve(__dirname + "/protos/CryptoPairingMessage.proto"))
      .then(root => {
        let type = root.lookupType('CryptoPairingMessage');
        let tlvData = tlv.encode(
          tlv.Tag.Sequence, 0x01,
          tlv.Tag.PublicKey, verifyPublic
        );
        let message = type.create({
          status: 0,
          pairingData: tlvData
        });

        return that.device
          .sendMessage(message)
          .then(message => {
            let pairingData = message['pairingData'];
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
            let newMessage = type.create({
              status: 0,
              pairingData: outerTLV
            });

            return that.device
              .sendMessage(newMessage)
              .then(message => {
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

                return Promise.resolve({
                  readKey: readKey,
                  writeKey: writeKey
                });
              });
          });
      });
  }
}