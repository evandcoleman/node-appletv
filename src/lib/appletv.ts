import * as path from 'path';
import * as varint from 'varint';
import { load, Type, Message as ProtoMessage, Enum } from 'protobufjs'
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import { Socket } from 'net';
import snake = require('snake-case');
import camelcase = require('camelcase');

import { Pairing } from './pairing'; 
import { Verifier } from './verifier';
import { Credentials } from './credentials';
import { NowPlayingInfo } from './now-playing-info';
import { SupportedCommand } from './supported-command';
import { Message } from './message';
import number from './util/number';
import tlv from './util/tlv';
import encryption from './util/encryption';

interface MessageCallback {
  responseType: string
  callback: (message: Message) => void
}

interface StateRequestCallback {
  id: string;
  resolve: (any) => void;
  reject: (Error) => void;
}

export interface Size {
  width: number;
  height: number;
}

export interface PlaybackQueueRequestOptions {
  location: number;
  length: number;
  includeMetadata?: boolean;
  includeLanguageOptions?: boolean;
  includeLyrics?: boolean;
  artworkSize?: Size;
}

export interface ClientUpdatesConfig {
  artworkUpdates: boolean;
  nowPlayingUpdates: boolean;
  volumeUpdates: boolean;
  keyboardUpdates: boolean;
}

export class AppleTV extends EventEmitter /* <AppleTV.Events> */ {
  public pairingId: string = uuid();
  public credentials: Credentials;

  private callbacks = new Map<String, [MessageCallback]>();
  private ProtocolMessage: Type;
  private buffer: Buffer = Buffer.alloc(0);

  constructor(public name: string, public port: number, public uid: string) {
    super();
  }

  /**
  * Opens a connection to the AppleTV over the MRP protocol.
  * @param credentials  The credentials object for this AppleTV
  * @returns A promise that resolves to the AppleTV object.
  */
  async open(credentials?: Credentials): Promise<this> {
    if (credentials) {
      this.pairingId = credentials.pairingId;      
    }

    this.credentials = credentials;
    let root = await load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"));
    this.ProtocolMessage = root.lookupType("ProtocolMessage");

    return this;
  }

  /**
  * Closes the connection to the Apple TV.
  */
  close() {
    throw new Error("Subclasses should override this");
  }

  // async 

  /**
  * Send a Protobuf message to the AppleTV. This is for advanced usage only.
  * @param definitionFilename  The Protobuf filename of the message type.
  * @param messageType  The name of the message.
  * @param body  The message body
  * @param waitForResponse  Whether or not to wait for a response before resolving the Promise.
  * @returns A promise that resolves to the response from the AppleTV.
  */
  async sendMessage(definitionFilename: string, messageType: string, body: {}, waitForResponse: boolean, priority: number = 0): Promise<Message> {
    let root = await load(path.resolve(__dirname + "/protos/" + definitionFilename + ".proto"));
    let type = root.lookupType(messageType);
    let message = await type.create(body);

    return this.send(message, waitForResponse, priority, this.credentials);
  }

  send(message: ProtoMessage<{}>, waitForResponse: boolean, priority: number, credentials?: Credentials): Promise<Message> {
    let ProtocolMessage = message.$type.parent['ProtocolMessage'];
    let types = ProtocolMessage.lookupEnum("Type");
    let name = message.$type.name;
    let typeName = snake(name).toUpperCase();
    let innerType = types.values[typeName];
    var outerMessage = ProtocolMessage.create({
      priority: priority,
      type: innerType
    });
    if (Object.keys(message.toJSON()).length > 0) {
      let field = outerMessage.$type.fieldsArray.filter((f) => { return f.type == message.$type.name })[0];
      outerMessage[field.name] = message;
    }

    return this.sendProtocolMessage(outerMessage, name, innerType, waitForResponse, credentials);
  }

  /**
  * Wait for a single message of a specified type.
  * @param type  The type of the message to wait for.
  * @param timeout  The timeout (in seconds).
  * @returns A promise that resolves to the Message.
  */
  messageOfType(type: Message.Type, timeout: number = 5): Promise<Message> {
    let that = this;
    return new Promise<Message>((resolve, reject) => {
      let listener: (message: Message) => void;
      let timer = setTimeout(() => {
        reject(new Error("Timed out waiting for message type " + type));
        that.removeListener('message', listener);
      }, timeout * 1000);
      listener = (message: Message) => {
        if (message.type == type) {
          resolve(message);
          that.removeListener('message', listener);
        }
      };
      that.on('message', listener);
    });
  }

  waitForSequence(sequence: number, timeout: number = 3): Promise<Message> {
    let that = this;
    let handler = (message: Message, resolve: any) => {
      let tlvData = tlv.decode(message.payload.pairingData);
      if (Buffer.from([sequence]).equals(tlvData[tlv.Tag.Sequence])) {
        resolve(message);
      }
    };

    return new Promise<Message>((resolve, reject) => {
      that.on('message', (message: Message) => {
        if (message.type == Message.Type.CryptoPairingMessage) {
          handler(message, resolve);
        }
      });
      setTimeout(() => {
        reject(new Error("Timed out waiting for crypto sequence " + sequence));
      }, timeout * 1000);
    })
    .then(value => {
      that.removeListener('message', handler);
      return value;
    });
  }

  /**
  * Call this method when a chunk of data is received.
  * @param data  A Buffer of data.
  * @returns A promise that resolves to the Message (if there is one).
  */
  async handleChunk(data: Buffer): Promise<Message> {
    this.buffer = Buffer.concat([this.buffer, data]);
    let length = varint.decode(this.buffer);
    let messageBytes = this.buffer.slice(varint.decode.bytes, length + varint.decode.bytes);

    if (messageBytes.length < length) {
      this.emit('debug', "Message length mismatch");
      return null;
    }

    this.buffer = this.buffer.slice(length + varint.decode.bytes);

    this.emit('debug', "DEBUG: <<<< Received Data=" + messageBytes.toString('hex'));
  
    if (this.credentials && this.credentials.readKey) {
      messageBytes = this.credentials.decrypt(messageBytes);
      this.emit('debug', "DEBUG: Decrypted Data=" + messageBytes.toString('hex'));
    }
    
    let protoMessage = await this.decodeMessage(messageBytes);
    let message = new Message(protoMessage);

    if (message) {
      this.emit('message', message);
      this.executeCallbacks(message.identifier, message);
    }
    
    return message;
  }

  write(data: Buffer) {
    throw new Error("Subclasses must override this")
  }

  private addCallback(identifier: string, callback: (message: Message) => void) {
    if (this.callbacks.has(identifier)) {
      this.callbacks.get(identifier).push(<MessageCallback>{
        callback: callback
      });
    } else {
      this.callbacks.set(identifier, [<MessageCallback>{
        callback: callback
      }]);
    }
  }

  private executeCallbacks(identifier: string, message: Message): boolean {
    let callbacks = this.callbacks.get(identifier);
    if (callbacks) {
      for (var i = 0; i < callbacks.length; i++) {
        let callback = callbacks[i];
        callback.callback(message);
        this.callbacks.get(identifier).splice(i, 1);
      }
      return true;
    } else {
      return false;
    }
  }

  // private sendBlank(typeName: string, waitForResponse: boolean, credentials?: Credentials): Promise<Message> {
  //   let that = this;
  //   return load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"))
  //     .then(root => {
  //       let ProtocolMessage = root.lookupType("ProtocolMessage");
  //       let types = ProtocolMessage.lookupEnum("Type");
  //       let type = types.values[typeName];
  //       let name = camelcase(typeName);
  //       let message = ProtocolMessage.create({
  //         type: type,
  //         priority: 0
  //       });

  //       return that.sendProtocolMessage(message, name, type, waitForResponse, credentials);
  //     });
  // }

  private sendProtocolMessage(message: ProtoMessage<{}>, name: string, type: number, waitForResponse: boolean, credentials?: Credentials): Promise<Message> {
    let that = this;
    return new Promise<Message>((resolve, reject) => {
      let ProtocolMessage: any = message.$type;

      if (waitForResponse) {
        let identifier = uuid();
        message["identifier"] = identifier;
        let callback = (message: Message) => {
          resolve(message);
        }; 
        that.addCallback(identifier, callback);
      }
      
      let data = ProtocolMessage.encode(message).finish();
      that.emit('debug', "DEBUG: >>>> Send Data=" + data.toString('hex'));

      if (credentials && credentials.writeKey) {
        let encrypted = credentials.encrypt(data);
        that.emit('debug', "DEBUG: >>>> Send Encrypted Data=" + encrypted.toString('hex'));
        that.emit('debug', "DEBUG: >>>> Send Protobuf=" + JSON.stringify(new Message(message), null, 2));
        let messageLength = Buffer.from(varint.encode(encrypted.length));
        let bytes = Buffer.concat([messageLength, encrypted]);
        that.write(bytes);
      } else {
        that.emit('debug', "DEBUG: >>>> Send Protobuf=" + JSON.stringify(new Message(message), null, 2));
        let messageLength = Buffer.from(varint.encode(data.length));
        let bytes = Buffer.concat([messageLength, data]);
        that.write(bytes);
      }

      if (!waitForResponse) {
        resolve(new Message(message));
      }
    });
  }

  sendIntroduction(): Promise<Message> {
    let body = {
      uniqueIdentifier: this.pairingId,
      name: 'node-appletv',
      localizedModelName: 'iPhone',
      systemBuildVersion: '14G60',
      applicationBundleIdentifier: 'com.apple.TVRemote',
      applicationBundleVersion: '320.18',
      protocolVersion: 1,
      allowsPairing: true,
      lastSupportedMessageType: 45,
      supportsSystemPairing: true,
    };
    return this.sendMessage('DeviceInfoMessage', 'DeviceInfoMessage', body, true);
  }

  private decodeMessage(data: Buffer): Promise<ProtoMessage<{}>> {
    let that = this;
    return load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"))
      .then(root => {
        let ProtocolMessage = root.lookupType("ProtocolMessage");
        let preMessage = ProtocolMessage.decode(data);
        let type = preMessage.toJSON().type;
        if (type == null) {
          return Promise.resolve(preMessage);
        }
        let name = type[0].toUpperCase() + camelcase(type).substring(1);

        return load(path.resolve(__dirname + "/protos/" + name + ".proto"))
          .then(root => {
            let ProtocolMessage = root.lookupType("ProtocolMessage");
            let message = ProtocolMessage.decode(data);
            that.emit('debug', "DEBUG: <<<< Received Protobuf=" + JSON.stringify(new Message(message), null, 2));
            return message;
          });
      });
  }
}

export module AppleTV {
  export interface Events {
    connect: void;
    nowPlaying: NowPlayingInfo;
    supportedCommands: SupportedCommand[];
    playbackQueue: any;
    message: Message
    close: void;
    error: Error;
    debug: string;
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
    Suspend,
    Wake,
    Select,
    Home,
    VolumeUp,
    VolumeDown
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
    } else if (string == "select") {
      return AppleTV.Key.Select;
    } else if (string == "wake") {
      return AppleTV.Key.Wake;
    } else if (string == "home") {
      return AppleTV.Key.Home;
    } else if (string == "volumeup") {
      return AppleTV.Key.VolumeUp;
    } else if (string == "volumedown") {
      return AppleTV.Key.VolumeDown;
    }
  }
}
