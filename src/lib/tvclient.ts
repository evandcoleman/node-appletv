import { Service } from 'mdns';
import * as path from 'path';
import { load, Message as ProtoMessage } from 'protobufjs'
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import { Socket } from 'net';
import { promisify } from 'util';

import { AppleTV, PlaybackQueueRequestOptions, ClientUpdatesConfig, SendProtocolMessageOptions, SendMessageOptions } from './appletv';
import { PairingClient } from './pairing'; 
import { Credentials } from './credentials';
import { NowPlayingInfo } from './now-playing-info';
import { SupportedCommand } from './supported-command';
import { Message } from './message';
import number from './util/number';

export class TVClient extends AppleTV {
  public address: string;
  public socket: Socket;
  public remoteUid: string;

  private pairingClient: PairingClient;

  constructor(private service: Service, socket?: Socket) {
    super(service.txtRecord.Name, service.port);

    this.remoteUid = service.txtRecord.LocalAirPlayReceiverPairingIdentity;
    this.address = service.addresses.filter(x => x.includes('.'))[0];
    this.socket = socket || new Socket();
    this.pairingClient = new PairingClient(this);
    this.pairingClient.on('debug', ((message) => {
      this.emit('debug', message);
      this.emit('pairDebug', message);
    }).bind(this));

    this.setupListeners();
  }

  /**
  * Pair with an already discovered AppleTV.
  * @returns A promise that resolves to the AppleTV object.
  */
  async pair(): Promise<(pin: string) => Promise<TVClient>> {
    return this.pairingClient.pair();
  }

  /**
  * Opens a connection to the AppleTV over the MRP protocol.
  * @param credentials  The credentials object for this AppleTV
  * @returns A promise that resolves to the AppleTV object.
  */
  async open(credentials?: Credentials): Promise<this> {
    if (credentials) {
      this.uid = credentials.localUid.toString();      
    }

    this.credentials = credentials;
    let root = await load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"));
    this.ProtocolMessage = root.lookupType("ProtocolMessage");

    await this.openSocket();
    await this.sendIntroduction(this.socket, {
      name: 'node-appletv',
      localizedModelName: 'iPhone',
      systemBuildVersion: '14G60',
      applicationBundleIdentifier: 'com.apple.TVRemote',
      applicationBundleVersion: '320.18',
      protocolVersion: 1,
      allowsPairing: true,
      lastSupportedMessageType: 45,
      supportsSystemPairing: true,
    });

    await this.beginSession();

    return this;
  }

  async beginSession(): Promise<this> {
    if (this.credentials && !this.credentials.readKey) {
      await this.pairingClient.verify();
      
      this.emit('debug', "DEBUG: Keys Read=" + this.credentials.readKey.toString('hex') + ", Write=" + this.credentials.writeKey.toString('hex'));
      
      await this.sendConnectionState();

      await this.sendClientUpdatesConfig({
        nowPlayingUpdates: true,
        artworkUpdates: true,
        keyboardUpdates: false,
        volumeUpdates: false
      });
    }

    return this;
  }

  private async openSocket(): Promise<any> {
    let that = this;
    return new Promise<void>((resolve, reject) => {
      that.socket.connect(this.port, this.address, function() {
        that.socket.on('data', async (data) => {
          try {
            await that.handleChunk(data, that.socket, that.credentials);
          } catch(error) {
            that.emit('error', error);
          }
        });

        resolve();
      });
    });
  }

  close() {
    this.socket.end();
  }

  /**
  * Requests the current playback queue from the Apple TV.
  * @param options Options to send
  * @returns A Promise that resolves to a NewPlayingInfo object.
  */
  async requestPlaybackQueue(options: PlaybackQueueRequestOptions): Promise<NowPlayingInfo> {
    return this.requestPlaybackQueueWithWait(options, true);
  }

  /**
  * Requests the current artwork from the Apple TV.
  * @param width Image width
  * @param height Image height
  * @returns A Promise that resolves to a Buffer of data.
  */
  async requestArtwork(width: number = 400, height: number = 400): Promise<Buffer> {
    let response = await this.requestPlaybackQueueWithWait({
      artworkSize: {
        width: width,
        height: height
      },
      length: 1,
      location: 0
    }, true);
    
    let data = response?.payload?.playbackQueue?.contentItems?.[0]?.artworkData;

    if (data) {
      return data;
    } else {
      throw new Error("No artwork available");
    }
  }

  /**
  * Send a key command to the AppleTV.
  * @param key The key to press.
  * @returns A promise that resolves to the AppleTV object after the message has been sent.
  */
  async sendKeyCommand(key: AppleTV.Key): Promise<AppleTV> {
    switch (key) {
      case AppleTV.Key.Up:
        return this.sendKeyPressAndRelease(1, 0x8C);
      case AppleTV.Key.Down:
        return this.sendKeyPressAndRelease(1, 0x8D);
      case AppleTV.Key.Left:
        return this.sendKeyPressAndRelease(1, 0x8B);
      case AppleTV.Key.Right:
        return this.sendKeyPressAndRelease(1, 0x8A);
      case AppleTV.Key.Menu:
        return this.sendKeyPressAndRelease(1, 0x86);
      case AppleTV.Key.Play:
        return this.sendKeyPressAndRelease(12, 0xB0);
      case AppleTV.Key.Pause:
        return this.sendKeyPressAndRelease(12, 0xB1);
      case AppleTV.Key.Next:
        return this.sendKeyPressAndRelease(12, 0xB5);
      case AppleTV.Key.Previous:
        return this.sendKeyPressAndRelease(12, 0xB6);
      case AppleTV.Key.Suspend:
        return this.sendKeyPressAndRelease(1, 0x82);
      case AppleTV.Key.Select:
        return this.sendKeyPressAndRelease(1, 0x89);
      case AppleTV.Key.Wake:
        return this.sendKeyPressAndRelease(1, 0x83);
      case AppleTV.Key.Home:
        return this.sendKeyPressAndRelease(12, 0x40);
      case AppleTV.Key.VolumeUp:
        return this.sendKeyPressAndRelease(12, 0xE9);
      case AppleTV.Key.VolumeDown:
        return this.sendKeyPressAndRelease(12, 0xEA);
    }
  }

  async sendMessage(options: SendMessageOptions): Promise<Message> {
    options.socket = this.socket;
    return super.sendMessage(options);
  }

  async send(options: SendProtocolMessageOptions): Promise<Message> {
    options.socket = this.socket;
    return super.send(options);
  }

  private async sendKeyPressAndRelease(usePage: number, usage: number): Promise<AppleTV> {
    await this.sendKeyPress(usePage, usage, true)
    return this.sendKeyPress(usePage, usage, false)
  }

  private async sendKeyPress(usePage: number, usage: number, down: boolean): Promise<AppleTV> {
    let time = Buffer.from('438922cf08020000', 'hex');
    let data = Buffer.concat([
      number.UInt16toBufferBE(usePage),
      number.UInt16toBufferBE(usage),
      down ? number.UInt16toBufferBE(1) : number.UInt16toBufferBE(0)
    ]);

    let body = {
      hidEventData: Buffer.concat([
        time,
        Buffer.from('00000000000000000100000000000000020' + '00000200000000300000001000000000000', 'hex'),
        data,
        Buffer.from('0000000000000001000000', 'hex')
      ])
    };
    await this.sendMessage({
      type: 'SendHIDEventMessage',
      body: body
    });

    return this;
  }

  private async requestPlaybackQueueWithWait(options: PlaybackQueueRequestOptions, waitForResponse: boolean): Promise<any> {
    var params: any = options;
    params.requestID = uuid();
    if (options.artworkSize) {
      params.artworkWidth = options.artworkSize.width;
      params.artworkHeight = options.artworkSize.height;
      delete params.artworkSize;
    }
    return this.sendMessage({
      type: 'PlaybackQueueRequestMessage',
      body: params,
      waitForResponse: waitForResponse
    });
  }

  private async sendConnectionState(): Promise<Message> {
    return this.sendMessage({
      type: 'SetConnectionStateMessage',
      bodyBuilder: (type) => {
        let stateEnum = type.lookupEnum('ConnectionState');

        return {
          state: stateEnum.values['Connected']
        };
      }
    });
  }

  private async sendClientUpdatesConfig(config: ClientUpdatesConfig): Promise<Message> {
    return this.sendMessage({
      type: 'ClientUpdatesConfigMessage',
      body: config
    });
  }

  private async sendWakeDevice(): Promise<Message> {
    return this.sendMessage({
      type: 'WakeDeviceMessage',
      body: {}
    });
  }

  onReceiveMessage(message: Message) {
    if (message.type == Message.Type.SetStateMessage) {
      if (message.payload == null) {
        this.emit('nowPlaying', null);
        return;
      }
      if (message.payload.nowPlayingInfo) {
        let info = new NowPlayingInfo(message.payload);
        this.emit('nowPlaying', info);
      }
      if (message.payload.supportedCommands) {
        let commands = (message.payload.supportedCommands.supportedCommands || [])
          .map(sc => {
            return new SupportedCommand(sc.command, sc.enabled || false, sc.canScrub || false);
          });
        this.emit('supportedCommands', commands);
      }
      if (message.payload.playbackQueue) {
        this.emit('playbackQueue', message.payload.playbackQueue);
      }
    } else if (message.type == Message.Type.CryptoPairingMessage) {
      this.pairingClient.handle(message);
    }
  }

  private setupListeners() {
    let that = this;

    this.on('message', (message: Message) => {
      that.onReceiveMessage(message);
    });
  }
}
