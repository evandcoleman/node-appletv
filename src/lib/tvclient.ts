import { Service } from 'mdns';
import * as path from 'path';
import { load, Message as ProtoMessage } from 'protobufjs'
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import { Socket } from 'net';
import { promisify } from 'util';

import { AppleTV, PlaybackQueueRequestOptions, ClientUpdatesConfig } from './appletv';
import { Pairing } from './pairing'; 
import { Verifier } from './verifier';
import { Credentials } from './credentials';
import { NowPlayingInfo } from './now-playing-info';
import { SupportedCommand } from './supported-command';
import { Message } from './message';
import number from './util/number';

export class TVClient extends AppleTV {
  public address: string;
  public socket: Socket;

  constructor(private service: Service, socket?: Socket) {
    super(service.txtRecord.Name, service.port, service.txtRecord.UniqueIdentifier);

    this.address = service.addresses.filter(x => x.includes('.'))[0];
    this.socket = socket;

    this.setupListeners();
  }

  /**
  * Pair with an already discovered AppleTV.
  * @returns A promise that resolves to the AppleTV object.
  */
  pair(): Promise<(pin: string) => Promise<AppleTV>> {
    let pairing = new Pairing(this);
    return pairing.initiatePair();
  }

  async open(credentials?: Credentials): Promise<this> {
    await super.open(credentials);

    let open: any = promisify(this.socket.connect);
    await open(this.port, this.address);
    await this.sendIntroduction();

    if (credentials) {
      let verifier = new Verifier(this);
      let keys = await verifier.verify();
      this.credentials.readKey = keys['readKey'];
      this.credentials.writeKey = keys['writeKey'];
      this.emit('debug', "DEBUG: Keys Read=" + this.credentials.readKey.toString('hex') + ", Write=" + this.credentials.writeKey.toString('hex'));
      await this.sendConnectionState();
    }

    if (credentials) {
      await this.sendClientUpdatesConfig({
        nowPlayingUpdates: true,
        artworkUpdates: true,
        keyboardUpdates: false,
        volumeUpdates: false
      });
    }

    return this;
  }

  close() {
    this.socket.end();
  }

  /**
  * Requests the current playback queue from the Apple TV.
  * @param options Options to send
  * @returns A Promise that resolves to a NewPlayingInfo object.
  */
  requestPlaybackQueue(options: PlaybackQueueRequestOptions): Promise<NowPlayingInfo> {
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
  sendKeyCommand(key: AppleTV.Key): Promise<AppleTV> {
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

  private sendKeyPressAndRelease(usePage: number, usage: number): Promise<AppleTV> {
    let that = this;
    return this.sendKeyPress(usePage, usage, true)
      .then(() => {
        return that.sendKeyPress(usePage, usage, false);
      });
  }

  private sendKeyPress(usePage: number, usage: number, down: boolean): Promise<AppleTV> {
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
    let that = this;
    return this.sendMessage("SendHIDEventMessage", "SendHIDEventMessage", body, false)
      .then(() => {
        return that;
      });
  }

  private requestPlaybackQueueWithWait(options: PlaybackQueueRequestOptions, waitForResponse: boolean): Promise<any> {
    var params: any = options;
    params.requestID = uuid();
    if (options.artworkSize) {
      params.artworkWidth = options.artworkSize.width;
      params.artworkHeight = options.artworkSize.height;
      delete params.artworkSize;
    }
    return this.sendMessage("PlaybackQueueRequestMessage", "PlaybackQueueRequestMessage", params, waitForResponse);
  }

  private sendConnectionState(): Promise<Message> {
    let that = this;
    return load(path.resolve(__dirname + "/protos/SetConnectionStateMessage.proto"))
      .then(root => {
        let type = root.lookupType('SetConnectionStateMessage');
        let stateEnum = type.lookupEnum('ConnectionState');
        let message = type.create({
          state: stateEnum.values['Connected']
        });

        return this
          .send(message, false, 0, that.credentials);
      });
  }

  private sendClientUpdatesConfig(config: ClientUpdatesConfig): Promise<Message> {
    return this.sendMessage('ClientUpdatesConfigMessage', 'ClientUpdatesConfigMessage', config, false);
  }

  private sendWakeDevice(): Promise<Message> {
    return this.sendMessage('WakeDeviceMessage', 'WakeDeviceMessage', {}, false);
  }

  private onReceiveMessage(message: Message) {
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
    }
  }

  private setupListeners() {
    let that = this;

    this.on('message', (message: Message) => {
      that.onReceiveMessage(message);
    });
  }
}
