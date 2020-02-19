import { load } from 'protobufjs';
import * as path from 'path';
import * as ed25519 from 'ed25519';
import * as crypto from 'crypto';
import * as curve25519 from 'curve25519-n2';

import { TVClient } from './tvclient';
import { Credentials } from './credentials';
import { Message } from './message';
import tlv from './util/tlv';
import enc from './util/encryption';

type PairingData = {
  sessionPublicKey: Buffer;
  sharedSecret: Buffer;
  encryptionKey: Buffer;
  pairingData: Buffer;
}

export class Verifier {
  constructor(public device: TVClient) {

  }

  async verify(): Promise<{}> {
    var verifyPrivate = Buffer.alloc(32);
    curve25519.makeSecretKey(verifyPrivate);
    let verifyPublic = curve25519.derivePublicKey(verifyPrivate);
    let { sessionPublicKey, encryptionKey, sharedSecret, pairingData } = await this.requestPairingData(verifyPublic, verifyPrivate);
    
    let tlvData = tlv.decode(pairingData);
    let identifier = tlvData[tlv.Tag.Username];
    let signature = tlvData[tlv.Tag.Signature];

    if (!identifier.equals(this.device.credentials.identifier)) {
      throw new Error("Identifier mismatch");
    }

    let deviceInfo = Buffer.concat([sessionPublicKey, Buffer.from(identifier), verifyPublic]);
    if (!ed25519.Verify(deviceInfo, signature, this.device.credentials.publicKey)) {
      throw new Error("Signature verification failed");
    }

    return await this.completeVerification(verifyPublic, sessionPublicKey, encryptionKey, sharedSecret);
  }

  private async requestPairingData(verifyPublic: Buffer, verifyPrivate: Buffer): Promise<PairingData> {
    let encodedData = tlv.encode(
      tlv.Tag.Sequence, 0x01,
      tlv.Tag.PublicKey, verifyPublic
    );
    let message = {
      status: 0,
      state: 3,
      isRetrying: true,
      isUsingSystemPairing: true,
      pairingData: encodedData
    };

    await this.device.sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', message, false);
    let pairingDataResponse = await this.device.waitForSequence(0x02);
    let pairingData = pairingDataResponse.payload.pairingData;
    let decodedData = tlv.decode(pairingData);
    let sessionPublicKey = decodedData[tlv.Tag.PublicKey];
    let encryptedData = decodedData[tlv.Tag.EncryptedData];

    if (sessionPublicKey.length != 32) {
      throw new Error(`sessionPublicKey must be 32 bytes (but was ${sessionPublicKey.length})`);
    }

    let cipherText = encryptedData.slice(0, -16);
    let hmac = encryptedData.slice(-16);
    let sharedSecret = curve25519.deriveSharedSecret(verifyPrivate, sessionPublicKey);
    let encryptionKey = enc.HKDF(
      "sha512",
      Buffer.from("Pair-Verify-Encrypt-Salt"),
      sharedSecret,
      Buffer.from("Pair-Verify-Encrypt-Info"),
      32
    );
    let decryptedData = enc.verifyAndDecrypt(cipherText, hmac, null, Buffer.from('PV-Msg02'), encryptionKey);

    return {
      sessionPublicKey: sessionPublicKey,
      sharedSecret: sharedSecret,
      encryptionKey: encryptionKey,
      pairingData: decryptedData
    };
  }

  private async completeVerification(verifyPublic: Buffer, sessionPublicKey: Buffer, encryptionKey: Buffer, sharedSecret: Buffer): Promise<{}> {
    let material = Buffer.concat([verifyPublic, Buffer.from(this.device.credentials.pairingId), sessionPublicKey]);
    let keyPair = ed25519.MakeKeypair(this.device.credentials.encryptionKey);
    let signed = ed25519.Sign(material, keyPair);
    let plainTLV = tlv.encode(
      tlv.Tag.Username, Buffer.from(this.device.credentials.pairingId),
      tlv.Tag.Signature, signed
    );
    let encryptedTLV = Buffer.concat(enc.encryptAndSeal(plainTLV, null, Buffer.from('PV-Msg03'), encryptionKey));
    let tlvData = tlv.encode(
      tlv.Tag.Sequence, 0x03,
      tlv.Tag.EncryptedData, encryptedTLV
    );
    let message = {
      status: 0,
      state: 3,
      isRetrying: false,
      isUsingSystemPairing: true,
      pairingData: tlvData
    };

    await this.device.sendMessage('CryptoPairingMessage', 'CryptoPairingMessage', message, false);
    await this.device.waitForSequence(0x04);
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
  }
}