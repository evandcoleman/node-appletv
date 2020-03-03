import * as path from 'path';
import * as varint from 'varint';
import { load, Type, Message as ProtoMessage, Enum } from 'protobufjs'
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import { Socket } from 'net';
import snake = require('snake-case');
import camelcase = require('camelcase');
import * as signale from 'signale';

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

export interface SendProtocolMessageOptions {
  message: ProtoMessage<{}>;
  name?: string;
  type?: number;
  priority?: number;
  identifier?: string;
  waitForResponse?: boolean;
  credentials: Credentials;
  socket?: Socket;
}

export interface SendMessageOptions {
  filename?: string;
  type?: string;
  waitForResponse?: boolean;
  identifier?: string
  body?: any;
  bodyBuilder?: (Type) => any;
  priority?: number;
  socket?: Socket;
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
  public uid: string;
  public credentials: Credentials;
  public ProtocolMessage: Type;

  public log: any;

  private callbacks = new Map<String, [MessageCallback]>();
  private buffer: Buffer = Buffer.alloc(0);

  constructor(public name: string, public port: number, uid?: string) {
    super();

    this.log = signale.scope('📺', name);
    this.uid = uid || uuid();

    if (process.env.DEBUG) {
      this.on('debug', this.log.debug);
    }
  }

  /**
  * Closes the connection to the Apple TV.
  */
  close() {
    throw new Error("Subclasses should override this");
  }

  /**
  * Send a Protobuf message to the AppleTV. This is for advanced usage only.
  * @param definitionFilename  The Protobuf filename of the message type.
  * @param messageType  The name of the message.
  * @param body  The message body
  * @param waitForResponse  Whether or not to wait for a response before resolving the Promise.
  * @param socket  The socket on which to send the message
  * @returns A promise that resolves to the response from the AppleTV.
  */
  async sendMessage(options: SendMessageOptions): Promise<Message> {
    let root = await load(path.resolve(__dirname + "/protos/" + (options.filename || options.type) + ".proto"));
    let type = root.lookupType(options.type || options.filename);
    var body;
    if (options.body) {
      body = options.body;
    } else if (options.bodyBuilder) {
      body = options.bodyBuilder(type);
    } else {
      throw new Error("Must specify either body or bodyBuilder");
    }
    let message = await type.create(body);

    return this.send({
      message: message,
      waitForResponse: options.waitForResponse,
      identifier: options.identifier,
      priority: options.priority,
      credentials: this.credentials,
      socket: options.socket
    });
  }

  async send(options: SendProtocolMessageOptions): Promise<Message> {
    let ProtocolMessage = options.message.$type.parent['ProtocolMessage'];
    let types = ProtocolMessage.lookupEnum("Type");
    let name = options.message.$type.name;
    let typeName = snake(name).toUpperCase();
    let innerType = types.values[typeName];
    var outerMessage = ProtocolMessage.create({
      priority: options.priority || 0,
      type: innerType
    });
    if (Object.keys(options.message.toJSON()).length > 0) {
      let field = outerMessage.$type.fieldsArray.filter((f) => { return f.type == options.message.$type.name })[0];
      outerMessage[field.name] = options.message;
    }
    options.message = outerMessage;

    return this.sendProtocolMessage(options);
  }

  /**
  * Wait for a single message of a specified type.
  * @param type  The type of the message to wait for.
  * @param timeout  The timeout (in seconds).
  * @returns A promise that resolves to the Message.
  */
  async messageOfType(type: Message.Type, timeout: number = 5): Promise<Message> {
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

  async waitForSequence(sequence: number, state: number, socket: Socket, timeout: number = 3): Promise<Message> {
    let that = this;
    let handler = (message: Message, resolve: any) => {
      let tlvData = tlv.decode(message.payload.pairingData);
      if (Buffer.from([sequence]).equals(tlvData[tlv.Tag.Sequence]) && message.payload.state == state) {
        resolve(message);
      }
    };

    return new Promise<Message>((resolve, reject) => {
      that.on('message', (message: Message, messageSocket: Socket) => {
        if (message.type == Message.Type.CryptoPairingMessage && messageSocket == socket) {
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
  async handleChunk(data: Buffer, socket: Socket, credentials?: Credentials): Promise<Message> {
    this.buffer = Buffer.concat([this.buffer, data]);
    let length = varint.decode(this.buffer);
    let messageBytes = this.buffer.slice(varint.decode.bytes, length + varint.decode.bytes);

    if (messageBytes.length < length) {
      this.emit('debug', "Message length mismatch");
      return null;
    }

    this.buffer = this.buffer.slice(length + varint.decode.bytes);

    this.emit('debug', "<<<< Received Data=" + messageBytes.toString('hex'));
  
    if (credentials && credentials.readKey) {
      messageBytes = credentials.decrypt(messageBytes);
      this.emit('debug', "<<<< Received Decrypted Data=" + messageBytes.toString('hex'));
    }
    
    let protoMessage = await this.decodeMessage(messageBytes);
    let message = new Message(protoMessage);

    if (message) {
      this.emit('message', message, socket);
      this.executeCallbacks(message.identifier, message);
    }
    
    return message;
  }

  write(data: Buffer, socket: Socket) {
    socket.write(data);
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

  async sendProtocolMessage(options: SendProtocolMessageOptions): Promise<Message> {
    let that = this;
    return new Promise<Message>((resolve, reject) => {
      let ProtocolMessage: any = options.message.$type;

      if (options.waitForResponse && !options.identifier) {
        let uid = uuid();
        options.message["identifier"] = uid;
        let callback = (message: Message) => {
          resolve(message);
        }; 
        that.addCallback(uid, callback);
      } else if (options.identifier) {
        options.message["identifier"] = options.identifier;
      }
      
      let data = ProtocolMessage.encode(options.message).finish();
      that.emit('debug', ">>>> Send Data=" + data.toString('hex'));
      let message = new Message(options.message);

      if (options.credentials && options.credentials.writeKey) {
        let encrypted = options.credentials.encrypt(data);
        that.emit('debug', ">>>> Send Encrypted Data=" + encrypted.toString('hex'));
        that.emit('debug', ">>>> Send Protobuf=" + message.toString());
        let messageLength = Buffer.from(varint.encode(encrypted.length));
        let bytes = Buffer.concat([messageLength, encrypted]);
        that.write(bytes, options.socket);
      } else {
        that.emit('debug', ">>>> Send Protobuf=" + message.toString());
        let messageLength = Buffer.from(varint.encode(data.length));
        let bytes = Buffer.concat([messageLength, data]);
        that.write(bytes, options.socket);
      }

      if (!options.waitForResponse) {
        resolve(message);
      }
    });
  }

  async sendIntroduction(socket: Socket, parameters: any, identifier?: string): Promise<Message> {
    let body = {
      uniqueIdentifier: this.uid,
      ...parameters
    };
    return this.sendMessage({
      filename: 'DeviceInfoMessage',
      body: body,
      waitForResponse: true,
      identifier: identifier,
      socket: socket
    });
  }

  private async decodeMessage(data: Buffer): Promise<ProtoMessage<{}>> {
    let outerRoot = await load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"));
    let ProtocolMessage = outerRoot.lookupType("ProtocolMessage");
    let preMessage = ProtocolMessage.decode(data);
    let type = preMessage.toJSON().type;

    if (type == null) {
      console.warn(`Missing message type: ${preMessage}`);
      return preMessage;
    }

    let name = type[0].toUpperCase() + camelcase(type).substring(1);
    let root = await load(path.resolve(__dirname + "/protos/" + name + ".proto"));
    let message = root.lookupType("ProtocolMessage").decode(data);

    this.emit('debug', "<<<< Received Protobuf=" + (new Message(message).toString()));

    return message;
  }
}

export module AppleTV {
  export interface Events {
    connect: void;
    message: Message
    close: void;
    error: Error;
    string;

    // client events
    nowPlaying: NowPlayingInfo;
    supportedCommands: SupportedCommand[];
    playbackQueue: any;

    // server events
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
