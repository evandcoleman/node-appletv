import { v4 as uuid } from 'uuid';
import { load } from 'protobufjs';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as ed25519 from 'ed25519';

import { TVClient } from '../tvclient';
import { SRPClientAuth, SRPClientSession } from './srp';
import { Credentials } from '../credentials';
import { Message } from '../message';
import tlv from '../util/tlv';
import { PairState, PairSetupState, PairVerifyState } from './types'

export class PairingClient extends EventEmitter {
  private srp: SRPClientAuth;
  private session: SRPClientSession;

  private nextSetupState: PairSetupState = null;
  private nextVerifyState: PairVerifyState = null;

  private readyForPin: () => void;
  private callback: (TVClient) => void;

  constructor(public device: TVClient) {
    super();
    this.srp = new SRPClientAuth(device.uid);
  }

  async pair(): Promise<(pin: string) => Promise<TVClient>> {
    this.nextSetupState = PairSetupState.M2;
    var resolver;
    var rejecter;
    let promise = new Promise<TVClient>((resolve, reject) => {
      resolver = resolve;
      rejecter = reject;
    });
    this.callback = resolver;
    var readyForPin;
    let pinPromise = new Promise<TVClient>((resolve, reject) => {
      readyForPin = resolve;
    });
    this.readyForPin = readyForPin;
    await this.pairSetupM1();
    await pinPromise;

    return async (pin: string) => {
      await this.pairSetupM3(pin);

      // setTimeout(() => {
      //   rejecter(new Error("Pairing timed out"));
      // }, 5000);

      return promise;
    };
  }

  async verify(): Promise<TVClient> {
    this.nextVerifyState = PairVerifyState.M2;
    var resolver;
    let promise = new Promise<TVClient>((resolve, reject) => {
      resolver = resolve;
    });
    this.callback = resolver;
    await this.pairVerifyM1();

    return promise;
  }

  async handle(message: Message) {
    let pairingData = message.payload.pairingData;
    let data = tlv.decode(pairingData);
    let defaultState = this.nextVerifyState != null ? PairState.Verify : PairState.Setup;

    if (data[tlv.Tag.BackOff]) {
      let backOff: Buffer = data[tlv.Tag.BackOff];
      let seconds = backOff.readIntBE(0, backOff.byteLength);
      if (seconds > 0) {
        throw new Error("You've attempt to pair too recently. Try again in " + seconds + " seconds.");
      }
    }
    if (data[tlv.Tag.ErrorCode]) {
      let buffer: Buffer = data[tlv.Tag.ErrorCode];
      throw new Error(this.device.name + " responded with error code " + buffer.readIntBE(0, buffer.byteLength) + ". Try rebooting your Apple TV.");
    }

    switch (message.payload.state || defaultState) {
      case PairState.Setup:
        await this.handleSetup(data);
        break;
      case PairState.Verify:
        await this.handleVerify(data);
        break;
      default:
        this.emit('debug', `Unknown pairing state ${message.payload.state}. ${JSON.stringify(data, null, 2)}`);
        break;
    }
  }

  private async handleSetup(data: {}) {
    let sequence = data[tlv.Tag.Sequence].readInt8(0);

    this.emit('debug', `[Client] <<<< Received Setup M${sequence} Payload${sequence == this.nextSetupState ? "" : ` (Expected M${this.nextSetupState})`}`);

    if (sequence != this.nextSetupState) {
      return;
    }

    switch (sequence) {
      case PairSetupState.M2:
        this.nextSetupState = PairSetupState.M4;
        await this.pairSetupM2(data);
        this.readyForPin();
        this.readyForPin = null;
        break;      
      case PairSetupState.M4:
        await this.pairSetupM4(data);
        this.nextSetupState = PairSetupState.M6;
        await this.pairSetupM5();
        break;
      case PairSetupState.M6:
        this.device.credentials = await this.pairSetupM6(data);
        this.nextSetupState = null;
        this.callback(this.device);
        this.callback = null;
        this.emit('debug', `[Client] Credentials: ${JSON.stringify(this.device.credentials.toJSON(), null, 2)}`);
        break;
      default:
        break;
    }
  }

  private async handleVerify(data: {}) {
    let sequence = data[tlv.Tag.Sequence].readInt8(0);

    this.emit('debug', `[Client] <<<< Received Verify M${sequence} Payload${sequence == this.nextVerifyState ? "" : ` (Expected M${this.nextVerifyState})`}`);

    if (sequence != this.nextVerifyState) {
      return;
    }

    switch (sequence) {
      case PairVerifyState.M2:
        await this.pairVerifyM2(data);
        this.nextVerifyState = PairVerifyState.M4;
        await this.pairVerifyM3();
        break;      
      case PairVerifyState.M4:
        await this.pairVerifyM4(data);
        this.nextVerifyState = null;
        this.emit('debug', `[Client] Credentials: ${JSON.stringify(this.device.credentials.toJSON(true), null, 2)}`);
        this.callback(this.device);
        this.callback = null;
        break;
      default:
        break;
    }
  }

  private async pairSetupM1(): Promise<void> {
    let tlvData = tlv.encode(
      tlv.Tag.PairingMethod, 0x00,
      tlv.Tag.Sequence, PairSetupState.M1,
    );
    let requestMessage = {
      status: 0,
      isUsingSystemPairing: true,
      isRetrying: false,
      state: PairState.Setup,
      pairingData: tlvData
    };

    this.emit('debug', `[Client] >>>> Sending Setup M1 Payload`);

    await this.device.sendMessage({
      type: 'CryptoPairingMessage',
      body: requestMessage
    });
  }

  private async pairSetupM2(data: {}): Promise<void> {
    this.srp.salt = data[tlv.Tag.Salt];
    this.srp.serverSessionPublicKey = data[tlv.Tag.PublicKey];

    if (this.srp.salt.byteLength != 16) {
      throw new Error(`salt must be 16 bytes (but was ${this.srp.salt.byteLength})`);
    }
    if (this.srp.serverSessionPublicKey.byteLength !== 384) {
      throw new Error(`serverSessionPublicKey must be 384 bytes (but was ${this.srp.serverSessionPublicKey.byteLength})`);
    }
  }

  private async pairSetupM3(pin: string): Promise<void> {
    let proof = this.srp.setPassword(pin);

    // this.emit('debug', "DEBUG: Client Public Key=" + this.publicKey.toString('hex') + "\nProof=" + this.proof.toString('hex'));

    let tlvData = tlv.encode(
      tlv.Tag.Sequence, PairSetupState.M3,
      tlv.Tag.PublicKey, this.srp.clientSessionPublicKey,
      tlv.Tag.Proof, proof
    );
    let message = {
      status: 0,
      state: PairState.Setup,
      pairingData: tlvData
    };

    this.emit('debug', `[Client] >>>> Sending Setup M3 Payload`);

    await this.device.sendMessage({
      type: 'CryptoPairingMessage',
      body: message
    });
  }

  private async pairSetupM4(data: {}): Promise<void> {
    let proof = data[tlv.Tag.Proof];
    // this.emit('debug', "DEBUG: Device Proof=" + this.deviceProof.toString('hex'));

    this.srp.verifyProof(proof);
  }

  private async pairSetupM5(): Promise<void> {
    let tlvData = tlv.encode(
      tlv.Tag.Username, Buffer.from(this.device.uid),
      tlv.Tag.PublicKey, this.srp.publicKey,
      tlv.Tag.Signature, this.srp.signature
    );
    let encryptedTLV = this.srp.encrypt(tlvData, Buffer.from('PS-Msg05'));
    // this.emit('debug', "DEBUG: Encrypted Data=" + encryptedTLV.toString('hex'));
    let outerTLV = tlv.encode(
      tlv.Tag.Sequence, PairSetupState.M5,
      tlv.Tag.EncryptedData, encryptedTLV
    );
    let nextMessage = {
      status: 0,
      state: PairState.Setup,
      pairingData: outerTLV
    };

    this.emit('debug', `[Client] >>>> Sending Setup M5 Payload`);

    await this.device.sendMessage({
      type: 'CryptoPairingMessage',
      body: nextMessage
    });
  }

  private async pairSetupM6(data: {}): Promise<Credentials> {
    let encryptedData = data[tlv.Tag.EncryptedData];
    let decrpytedData = this.srp.decrypt(encryptedData, Buffer.from('PS-Msg06'));
    let tlvData = tlv.decode(decrpytedData);

    return new Credentials(
      this.device.uid,
      tlvData[tlv.Tag.Username].toString(),
      tlvData[tlv.Tag.PublicKey],
      this.srp.seed
    );
  }

  private async pairVerifyM1(): Promise<void> {
    this.session = new SRPClientSession(Buffer.from(this.device.credentials.localUid));
    let encodedData = tlv.encode(
      tlv.Tag.Sequence, PairVerifyState.M1,
      tlv.Tag.PublicKey, this.session.publicKey
    );
    let message = {
      status: 0,
      state: PairState.Verify,
      isRetrying: true,
      isUsingSystemPairing: true,
      pairingData: encodedData
    };

    this.emit('debug', `[Client] >>>> Sending Verify M1 Payload`);

    await this.device.sendMessage({
      type: 'CryptoPairingMessage',
      body: message
    });
  }

  private async pairVerifyM2(data: {}): Promise<void> {
    let publicKey = data[tlv.Tag.PublicKey];
    this.session.setSessionPublicKey(publicKey, this.device.credentials.ltsk);
    let encryptedData = data[tlv.Tag.EncryptedData];

    if (publicKey.length != 32) {
      throw new Error(`serverPublicKey must be 32 bytes (but was ${publicKey.length})`);
    }

    let decryptedData = this.session.decrypt(encryptedData, Buffer.from('PV-Msg02'));
    let tlvData = tlv.decode(decryptedData);
    let identifier = tlvData[tlv.Tag.Username];
    let signature = tlvData[tlv.Tag.Signature];

    if (!identifier.equals(Buffer.from(this.device.credentials.remoteUid))) {
      throw new Error(`Identifier mismatch. Expected ${this.device.credentials.remoteUid} but got ${identifier.toString()}`);
    }

    let deviceInfo = Buffer.concat([publicKey, Buffer.from(identifier), this.session.publicKey]);
    if (!ed25519.Verify(deviceInfo, signature, this.device.credentials.ltpk)) {
      throw new Error("Signature verification failed");
    }
  }

  private async pairVerifyM3(): Promise<void> {
    let plainTLV = tlv.encode(
      tlv.Tag.Username, this.session.username,
      tlv.Tag.Signature, this.session.signature
    );
    let encryptedTLV = this.session.encrypt(plainTLV, Buffer.from('PV-Msg03'));
    let tlvData = tlv.encode(
      tlv.Tag.Sequence, PairVerifyState.M3,
      tlv.Tag.EncryptedData, encryptedTLV
    );
    let message = {
      status: 0,
      state: PairState.Verify,
      isRetrying: false,
      isUsingSystemPairing: true,
      pairingData: tlvData
    };

    this.emit('debug', `[Client] >>>> Sending Verify M3 Payload`);

    await this.device.sendMessage({
      type: 'CryptoPairingMessage',
      body: message
    });
  }

  private async pairVerifyM4(data: {}): Promise<Credentials> {
    this.device.credentials.readKey = this.session.readKey;
    this.device.credentials.writeKey = this.session.writeKey;

    return this.device.credentials;
  }
}
