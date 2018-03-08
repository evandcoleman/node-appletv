import { Service } from 'mdns';
import * as path from 'path';
import { load, Message as ProtoMessage } from 'protobufjs'
import { v4 as uuid } from 'uuid';

import { Connection } from './connection';
import { Pairing } from './pairing'; 
import { Verifier } from './verifier';
import { Credentials } from './credentials';
import { NowPlayingInfo } from './now-playing-info';
import { Message } from './message';
import number from './util/number';

interface StateRequestCallback {
  id: string
  resolve: (any) => void
  reject: (Error) => void
}

export class AppleTV {
  public name: string;
  public address: string;
  public port: number;
  public uid: string;
  public pairingId: string = uuid();
  public credentials: Credentials;

  private connection: Connection;
  private stateCallbacks: Array<(Error, NowPlayingInfo) => void> = [];
  private stateRequestCallbacks: StateRequestCallback[] = [];

  constructor(private service: Service, private log?: (string) => void) {
    this.log = log || ((text) => {});
    this.service = service;
    this.name = service.txtRecord.Name;
    if (service.addresses.length > 1) {
      this.address = service.addresses[1];
    } else {
      this.address = service.addresses[0];
    }
    this.port = service.port;
    this.uid = service.txtRecord.UniqueIdentifier;
    this.connection = new Connection(this, this.log);
  }

  /**
  * Pair with an already discovered AppleTV.
  * @param log  An optional function to log debug information.
  * @returns A promise that resolves to the AppleTV object.
  */
  pair(log?: (string) => void): Promise<(pin: string) => Promise<AppleTV>> {
    let logFunc = log || ((text) => {});
    let pairing = new Pairing(this);
    return pairing.initiatePair(logFunc);
  }

  /**
  * Opens a connection to the AppleTV over the MRP protocol.
  * @param credentials  The credentials object for this AppleTV
  * @returns A promise that resolves to the AppleTV object.
  */
  openConnection(credentials?: Credentials): Promise<AppleTV> {
    let that = this;

    if (credentials) {
      this.pairingId = credentials.pairingId;

      var timestamp = 0;
      this.connection
        .messagesOfType("SetStateMessage", (error, message) => {
          if (that.stateCallbacks.length == 0 && that.stateRequestCallbacks.length == 0) { return; }
          if (error) {
            that.stateCallbacks.forEach(cb => {
              cb(error, null);
            });
          } else if (message) {
            let info = new NowPlayingInfo(message);
            if (info.timestamp >= timestamp) {
              timestamp = info.timestamp;
              that.stateCallbacks.forEach(cb => {
                cb(null, info);
              });
            }
            if (message.playbackQueue != null && message.playbackQueue.requestID != null) {
              that.stateRequestCallbacks.forEach(cb => {
                if (cb.id == message.playbackQueue.requestID) {
                  cb.resolve(info);
                }
              });
            }
          }
        });
    }
    
    return this.connection
      .open()
      .then(() => {
        return that.sendIntroduction();
      })
      .then(() => {
        that.credentials = credentials;
        if (credentials) {
          let verifier = new Verifier(that);
          return verifier.verify()
            .then(keys => {
              that.credentials.readKey = keys['readKey'];
              that.credentials.writeKey = keys['writeKey'];
              that.log("DEBUG: Keys Read=" + that.credentials.readKey.toString('hex') + ", Write=" + that.credentials.writeKey.toString('hex'));
              return that.sendConnectionState();
            });
        } else {
          return that.sendConnectionState();
        }
      })
      .then(() => {
        return that.sendClientUpdatesConfig();
      })
      .then(() => {
        return that.sendWakeDevice();
      })
      .then(() => {
        return Promise.resolve(that);
      });
  }

  /**
  * Closes the connection to the Apple TV.
  */
  closeConnection() {
    this.connection.close();
    this.stateCallbacks = [];
    this.stateRequestCallbacks = [];
  }

  /**
  * Send a Protobuf message to the AppleTV. This is for advanced usage only.
  * @param message  The Protobuf message to send.
  * @returns A promise that resolves to the response from the AppleTV.
  */
  sendMessage(message: ProtoMessage<{}>): Promise<ProtoMessage<{}>> {
    return this.connection
      .send(message, this.credentials);
  }

  /**
  * Observes the now playing state of the AppleTV.
  * @param callback  The callback to send updates to.
  */
  observeState(callback: (Error, NowPlayingInfo) => void) {
    this.stateCallbacks.push(callback);
  }

  /**
  * Observes all messages sent from the AppleTV.
  * @param callback  The callback to send messages to.
  */
  observeMessages(callback: (Error, Message) => void) {
    this.connection
      .observeMessages((error, type, message) => {
        if (error) {
          callback(error, null);
        } else if (message && type) {
          callback(null, new Message(type, message));
        }
      });
  }

  /**
  * Requests the current playback queue from the Apple TV.
  * @returns A Promise that resolves to a NewPlayingInfo object.
  */
  requestPlaybackQueue(location: number = 0, length: number = 100): Promise<NowPlayingInfo> {
    let that = this;
    return load(path.resolve(__dirname + "/protos/PlaybackQueueRequestMessage.proto"))
      .then(root => {
        let type = root.lookupType('PlaybackQueueRequestMessage');
        let message = type.create({
          location: location,
          length: length,
          includeMetadata: true,
          includeLanguageOptions: true,
          includeLyrics: true,
          requestID: uuid()
        });

        return that
          .sendMessage(message)
          .then(message => {
            return new NowPlayingInfo(message);
          });
      });
  }

  /**
  * Send a key command to the AppleTV.
  * @param The key to press.
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
    let that = this;
    return load(path.resolve(__dirname + "/protos/SendHIDEventMessage.proto"))
      .then(root => {
        let time = Buffer.from('438922cf08020000', 'hex');
        let data = Buffer.concat([
          number.UInt16toBufferBE(usePage),
          number.UInt16toBufferBE(usage),
          down ? number.UInt16toBufferBE(1) : number.UInt16toBufferBE(0)
        ]);

        let type = root.lookupType('SendHIDEventMessage');
        let message = type.create({
          hidEventData: Buffer.concat([
            time,
            Buffer.from('00000000000000000100000000000000020' + '00000200000000300000001000000000000', 'hex'),
            data,
            Buffer.from('0000000000000001000000', 'hex')
          ])
        });

        return that.sendMessage(message)
          .then(() => {
            return that;
          });
      });
  }

  private sendIntroduction(): Promise<ProtoMessage<{}>> {
    let that = this;
    return load(path.resolve(__dirname + "/protos/DeviceInfoMessage.proto"))
      .then(root => {
        let type = root.lookupType('DeviceInfoMessage');
        let message = type.create({
          uniqueIdentifier: that.pairingId,
          name: 'node-appletv',
          localizedModelName: 'iPhone',
          systemBuildVersion: '14G60',
          applicationBundleIdentifier: 'com.apple.TVRemote',
          applicationBundleVersion: '273.12',
          protocolVersion: 1
        });

        return that
          .sendMessage(message);
      });
  }

  private sendConnectionState(): Promise<ProtoMessage<{}>> {
    let that = this;
    return load(path.resolve(__dirname + "/protos/SetConnectionStateMessage.proto"))
      .then(root => {
        let type = root.lookupType('SetConnectionStateMessage');
        let stateEnum = type.lookupEnum('ConnectionState');
        let message = type.create({
          state: stateEnum.values['Connected']
        });

        return that
          .sendMessage(message);
      });
  }

  private sendClientUpdatesConfig(): Promise<ProtoMessage<{}>> {
    let that = this;
    return load(path.resolve(__dirname + "/protos/ClientUpdatesConfigMessage.proto"))
      .then(root => {
        let type = root.lookupType('ClientUpdatesConfigMessage');
        let message = type.create({
          artworkUpdates: true,
          nowPlayingUpdates: true,
          volumeUpdates: true,
          keyboardUpdates: true
        });

        return that
          .sendMessage(message);
      });
  }

  private sendWakeDevice(): Promise<ProtoMessage<{}>> {
    let that = this;
    return load(path.resolve(__dirname + "/protos/WakeDeviceMessage.proto"))
      .then(root => {
        let type = root.lookupType('WakeDeviceMessage');
        let message = type.create({});

        return that
          .sendMessage(message);
      });
  }
}

export module AppleTV {
  /** An enumeration of key presses available.
  */
  export enum Key {
    Up,
    Down,
    Left,
    Right,
    Menu,
    Play,
    Pause,
    Next,
    Previous,
    Suspend
  }

  /** Convert a string representation of a key to the correct enum type.
  * @param string  The string.
  * @returns The key enum value.
  */
  export function key(string: string): AppleTV.Key {
    if (string == "up") {
      return AppleTV.Key.Up;
    } else if (string == "down") {
      return AppleTV.Key.Down;
    } else if (string == "left") {
      return AppleTV.Key.Left;
    } else if (string == "right") {
      return AppleTV.Key.Right;
    } else if (string == "menu") {
      return AppleTV.Key.Menu;
    } else if (string == "play") {
      return AppleTV.Key.Play;
    } else if (string == "pause") {
      return AppleTV.Key.Pause;
    } else if (string == "next") {
      return AppleTV.Key.Next;
    } else if (string == "previous") {
      return AppleTV.Key.Previous;
    } else if (string == "suspend") {
      return AppleTV.Key.Suspend;
    }
  }
}