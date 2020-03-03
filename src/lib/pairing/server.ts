import { v4 as uuid } from 'uuid';
import { load } from 'protobufjs';
import { EventEmitter } from 'events';
import * as path from 'path';

import { TVServer, Client } from '../tvserver';
import { SRPServerAuth, SRPServerSession } from './srp';
import { Credentials } from '../credentials';
import { KeyPair } from '../credentials-store';
import { Message } from '../message';
import tlv from '../util/tlv';

import { PairState, PairSetupState, PairVerifyState } from './types'

export class PairingServer extends EventEmitter {
  public code: string;

  private srp: SRPServerAuth;
  private session: SRPServerSession;

  private clientUsername: Buffer;
  private clientPublicKey: Buffer;

  private nextSetupState: PairSetupState = PairSetupState.M1;
  private nextVerifyState: PairVerifyState = PairVerifyState.M1;

  constructor(public device: TVServer, keyPair: KeyPair, public client: Client) {
    super();

    this.code = Math.floor(1000 + Math.random() * 9000).toString();
    this.srp = new SRPServerAuth(device.uid, keyPair, this.code);
  }

  async handle(message: Message) {
    let pairingData = message.payload.pairingData;
    let decoded = tlv.decode(pairingData);
    let defaultState = this.nextVerifyState != null ? PairState.Verify : PairState.Setup;

    switch (message.payload.state || defaultState) {
      case PairState.Setup:
        await this.handleSetup(decoded);
        break;
      case PairState.Verify:
        await this.handleVerify(decoded);
        break;
    }
  }

  private async handleSetup(data: {}) {
    let sequence = data[tlv.Tag.Sequence].readInt8(0);

    this.emit('debug', `[Server] <<<< Received Setup M${sequence} Payload${sequence == this.nextSetupState ? "" : ` (Expected M${this.nextSetupState})`}`);

    if (sequence != this.nextSetupState && sequence != PairSetupState.M1) {
      return;
    }

    switch (sequence) {
      case PairSetupState.M1:
        await this.pairSetupM1(data);
        this.nextSetupState = PairSetupState.M3;
        await this.pairSetupM2();
        break;      
      case PairSetupState.M3:
        await this.pairSetupM3(data);
        this.nextSetupState = PairSetupState.M5;
        await this.pairSetupM4();
        break;
      case PairSetupState.M5:
        await this.pairSetupM5(data);
        await this.pairSetupM6();
        this.nextSetupState = PairSetupState.M1;
        this.nextVerifyState = PairVerifyState.M1;
        this.emit('clientPaired', this.client);
        this.emit('debug', `[Server] Credentials: ${JSON.stringify(this.client.credentials.toJSON(), null, 2)}`);
        break;
      default:
        break;
    }
  }

  private async handleVerify(data: {}) {
    let sequence = data[tlv.Tag.Sequence].readInt8(0);

    this.emit('debug', `[Server] <<<< Received Verify M${sequence} Payload${sequence == this.nextVerifyState ? "" : ` (Expected M${this.nextVerifyState})`}`);

    if (sequence != this.nextVerifyState && sequence != PairVerifyState.M1) {
      return;
    }

    switch (sequence) {
      case PairVerifyState.M1:
        await this.pairVerifyM1(data);
        this.nextVerifyState = PairVerifyState.M3;
        await this.pairVerifyM2();
        break;      
      case PairVerifyState.M3:
        await this.pairVerifyM3(data);
        this.nextVerifyState = PairVerifyState.M1;
        await this.pairVerifyM4();
        this.emit('debug', `[Server] Credentials: ${JSON.stringify(this.client.credentials.toJSON(true), null, 2)}`);
        break;
      default:
        break;
    }
  }

  private async pairSetupM1(data: {}): Promise<void> {
    
  }

  private async pairSetupM2(): Promise<void> {
    this.emit('debug', `Code for '${this.client.name}' is ${this.code}`);

    let encoded = tlv.encode(
      tlv.Tag.Salt, this.srp.salt,
      tlv.Tag.PublicKey, this.srp.sessionPublicKey,
      tlv.Tag.Sequence, PairSetupState.M2,
    );

    this.emit('debug', `[Server] >>>> Sending Setup M2 Payload`);

    await this.device.sendMessage({
      type: 'CryptoPairingMessage',
      body: {
        status: 0,
        pairingData: encoded
      },
      socket: this.client.socket
    });
  }

  private async pairSetupM3(data: {}): Promise<void> {
    let publicKey = data[tlv.Tag.PublicKey];
    let proof = data[tlv.Tag.Proof];

    if (proof.byteLength != 64) {
      throw new Error(`proof must be 64 bytes (but was ${proof.byteLength})`);
    }

    if (publicKey.byteLength !== 384) {
      throw new Error(`publicKey must be 384 bytes (but was ${publicKey.byteLength})`);
    }

    this.srp.setClientSessionPublicKey(publicKey);

    try {
      this.srp.verifyProof(proof);
    } catch (error) {
      throw new Error(`Invalid PIN entered.`);
    }
  }

  private async pairSetupM4(): Promise<void> {
    let encoded = tlv.encode(
      tlv.Tag.Proof, this.srp.serverProof,
      tlv.Tag.Sequence, PairSetupState.M4,
    );

    this.emit('debug', `[Server] >>>> Sending Setup M4 Payload`);

    await this.device.sendMessage({
      type: 'CryptoPairingMessage',
      body: {
        status: 0,
        pairingData: encoded
      },
      socket: this.client.socket
    });
  }

  private async pairSetupM5(data: {}): Promise<void> {
    let encryptedData = data[tlv.Tag.EncryptedData];
    let decryptedData = tlv.decode(this.srp.decrypt(encryptedData, Buffer.from('PS-Msg05')));

    let clientUsername = decryptedData[tlv.Tag.Username];
    let clientPublicKey = decryptedData[tlv.Tag.PublicKey];
    let signature = decryptedData[tlv.Tag.Signature];

    let credentials = new Credentials(
      this.device.uid,
      clientUsername.toString(),
      clientPublicKey,
      this.srp.seed
    );
    this.client.credentials = credentials;
  }

  private async pairSetupM6(): Promise<void> {
    let tlvData = tlv.encode(
      tlv.Tag.Username, Buffer.from(this.device.uid),
      tlv.Tag.PublicKey, this.srp.publicKey,
      tlv.Tag.Signature, this.srp.signature
    );
    let encryptedData = this.srp.encrypt(tlvData, Buffer.from('PS-Msg06'));
    let encoded = tlv.encode(
      tlv.Tag.EncryptedData, encryptedData,
      tlv.Tag.Sequence, PairSetupState.M6,
    );

    this.emit('debug', `[Server] >>>> Sending Setup M6 Payload`);

    await this.device.sendMessage({
      type: 'CryptoPairingMessage',
      body: {
        status: 0,
        pairingData: encoded
      },
      socket: this.client.socket
    });
  }

  private async pairVerifyM1(data: {}): Promise<void> {
    let clientPublicKey = data[tlv.Tag.PublicKey];

    if (clientPublicKey.length != 32) {
      throw new Error(`clientPublicKey must be 32 bytes (but was ${clientPublicKey.length})`);
    }

    this.session = new SRPServerSession(this.device.uid, this.srp.keyPair, clientPublicKey);
  }

  private async pairVerifyM2(): Promise<void> {
    let tlvData = tlv.encode(
      tlv.Tag.Username, this.session.username,
      tlv.Tag.Signature, this.session.signature
    );
    let encrypted = this.session.encrypt(tlvData, Buffer.from('PV-Msg02'));
    let encoded = tlv.encode(
      tlv.Tag.PublicKey, this.session.publicKey,
      tlv.Tag.Sequence, PairSetupState.M2,
      tlv.Tag.EncryptedData, encrypted
    );

    this.emit('debug', `[Server] >>>> Sending Verify M2 Payload`);

    await this.device.sendMessage({
      type: 'CryptoPairingMessage',
      body: {
        status: 0,
        pairingData: encoded
      },
      socket: this.client.socket
    });
  }

  private async pairVerifyM3(data: {}): Promise<void> {
    let encryptedData = data[tlv.Tag.EncryptedData];
    let decrypted = this.session.decrypt(encryptedData, Buffer.from('PV-Msg03'));
    let decoded = tlv.decode(decrypted);
    let username = decoded[tlv.Tag.Username];
    let signature = decoded[tlv.Tag.Signature];

    if (signature.length != 64) {
      throw new Error(`signature must be 64 bytes (but was ${signature.length})`);
    }

    this.client.credentials.readKey = this.session.readKey;
    this.client.credentials.writeKey = this.session.writeKey;
  }

  private async pairVerifyM4(): Promise<void> {
    this.emit('debug', `[Server] >>>> Sending Verify M4 Payload`);

    await this.device.sendMessage({
      type: 'CryptoPairingMessage',
      body: {
        status: 0,
        pairingData: tlv.encode(
          tlv.Tag.Sequence, PairVerifyState.M4,
        )
      },
      socket: this.client.socket
    });
  }
}
