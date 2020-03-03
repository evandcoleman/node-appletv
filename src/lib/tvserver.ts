import * as mdns from 'mdns';
import * as path from 'path';
import * as os from 'os';
import { load, Message as ProtoMessage } from 'protobufjs'
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import { createServer, Server, Socket } from 'net';
import { promisify } from 'util';

import { AppleTV } from './appletv';
import { PairingServer, PairState } from './pairing'; 
import { CredentialsStore } from './credentials-store';
import { Credentials } from './credentials';
import { Message } from './message';
import number from './util/number';
import tlv from './util/tlv';
import enc from './util/encryption';

export interface Client {
  uid: string;
  name: string;
  credentials?: Credentials;
  socket: Socket;
  pairingServer?: PairingServer;
}

export class TVServer extends AppleTV {
  public advertisement: mdns.Advertisement;
  public server: Server;
  public clients: Client[] = [];

  private credentialsStore: CredentialsStore;

  constructor(name: string, port: number, uid?: string, server?: Server) {
    super(name, port, uid || uuid());

    this.server = server;
    this.credentialsStore = new CredentialsStore(uid);

    this.on('message', this.didReceiveMessage.bind(this));
  }

  async start(): Promise<this> {
    this.advertisement = mdns.createAdvertisement(mdns.tcp('mediaremotetv'), this.port, {
      name: this.name,
      txtRecord: {
        Name: this.name,
        UniqueIdentifier: this.uid,
        SystemBuildVersion: '17K795',
        BluetoothAddress: '',
        ModelName: 'Apple TV',
        macAddress: os.networkInterfaces().en0[0].mac,
        AllowPairing: 'YES'
      },
      networkInterface: 'en0'
    });
    this.advertisement.start();

    let root = await load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"));
    this.ProtocolMessage = root.lookupType("ProtocolMessage");

    let that = this;
    let listener = (socket) => {
      that.bindClient(socket);
    }
    if (!this.server) {
      this.server = createServer(listener);
    } else {
      this.server.on('connection', listener);
    }

    let listen: (port: number) => void = promisify(this.server.listen);
    await listen.call(this.server, this.port);

    return this;
  }

  async didReceiveMessage(message: Message, socket: Socket) {
    switch (message.type) {
      case Message.Type.DeviceInfoMessage:
        let credentials = await this.credentialsStore.get(message.payload.uniqueIdentifier);
        var newClient: Client = {
          uid: message.payload.uniqueIdentifier,
          name: message.payload.name,
          credentials: credentials,
          socket: socket
        };
        await this.registerClient(newClient, socket, message);
        break;
      case Message.Type.CryptoPairingMessage:
        let client = this.getClient(socket);
        await client.pairingServer.handle(message);
        break;
      default:
        break;
    }
  }

  bindClient(socket: Socket) {
    let that = this;
    socket.on('data', async function(data) {
      try {
        let client = that.getClient(socket);
        await that.handleChunk(data, socket, client?.credentials);
      } catch(error) {
        that.emit('error', error);
      }
    });
  }

  async registerClient(newClient: Client, socket?: Socket, message?: Message) {
    let keyPair = await this.credentialsStore.keyPair();
    newClient.pairingServer = new PairingServer(this, keyPair, newClient);
    newClient.pairingServer.on('clientPaired', (async (client) => {
      await this.credentialsStore.add(client.credentials);
    }).bind(this));
    newClient.pairingServer.on('debug', ((message) => {
      this.emit('debug', message);
      this.emit('pairDebug', message);
    }).bind(this));
    this.clients.push(newClient);

    if (message && socket) {
      await this.sendIntroduction(socket, {
        name: this.name,
        localizedModelName: 'Apple TV',
        systemBuildVersion: '17K795',
        applicationBundleIdentifier: 'com.apple.mediaremoted',
        protocolVersion: 1,
        allowsPairing: true,
        lastSupportedMessageType: 77,
        supportsSystemPairing: true,
      }, message.identifier);
    }
  }

  private getClient(socket: Socket): Client {
    for (var client of this.clients) {
      if (client.socket == socket) {
        return client;
      }
    }
  }

  stop() {
    this.server.close();
    this.advertisement.stop();
  }
}
