import { Socket } from 'net';
import { load, Type, Message as ProtoMessage, Enum } from 'protobufjs'
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as varint from 'varint';
import snake = require('snake-case');
import camelcase = require('camelcase');

import { Credentials } from './credentials';
import { AppleTV } from './appletv';
import encryption from './util/encryption';
import TypedEventEmitter from './typed-events';
import { Message } from './message';

interface MessageCallback {
  responseType: string
  callback: (message: Message) => void
}

export class Connection extends TypedEventEmitter<Connection.Events> {
  public isOpen: boolean;
  private socket: Socket;
  private callbacks = new Map<String, [MessageCallback]>();
  private ProtocolMessage: Type;
  private buffer: Buffer = Buffer.alloc(0);

  constructor(public device: AppleTV) {
    super();

    this.socket = new Socket();
    let that = this;
    this.socket.on('data', (data) => {
      try {
        that.buffer = Buffer.concat([that.buffer, data]);
        let length = varint.decode(that.buffer);
        let messageBytes = that.buffer.slice(varint.decode.bytes, length + varint.decode.bytes);

        if (messageBytes.length < length) {
          that.emit('debug', "Message length mismatch");
          return;
        }

        that.buffer = that.buffer.slice(length + varint.decode.bytes);

        that.emit('debug', "DEBUG: <<<< Received Data=" + messageBytes.toString('hex'));
      
        if (device.credentials && device.credentials.readKey) {
          messageBytes = device.credentials.decrypt(messageBytes);
          that.emit('debug', "DEBUG: Decrypted Data=" + messageBytes.toString('hex'));
        }
        
        that.decodeMessage(messageBytes)
          .then(protoMessage => {
            let message = new Message(protoMessage);
            that.emit('message', message);
            that.executeCallbacks(message.identifier, message);
          })
          .catch(error => {
            that.emit('error', error);
          });
      } catch(error) {
        that.emit('error', error);
      }
    });

    this.socket.on('connect', () => {
      that.emit('connect');
      that.isOpen = true;
    });

    this.socket.on('close', () => {
      that.emit('close');
      that.isOpen = false;
    });

    this.socket.on('error', (error) => {
      that.emit('error', error);
    });
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

  open(): Promise<void> {
    let that = this;
    return load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"))
      .then(root => {
        that.ProtocolMessage = root.lookupType("ProtocolMessage");
        return new Promise<void>((resolve, reject) => {
          that.socket.connect(this.device.port, this.device.address, function() {
            resolve();
          });
        });
      });
  }

  close() {
    this.socket.end();
  }

  sendBlank(typeName: string, waitForResponse: boolean, credentials?: Credentials): Promise<Message> {
    let that = this;
    return load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"))
      .then(root => {
        let ProtocolMessage = root.lookupType("ProtocolMessage");
        let types = ProtocolMessage.lookupEnum("Type");
        let type = types.values[typeName];
        let name = camelcase(typeName);
        let message = ProtocolMessage.create({
          type: type,
          priority: 0
        });

        return that.sendProtocolMessage(message, name, type, waitForResponse, credentials);
      });
  }

  send(message: ProtoMessage<{}>, waitForResponse: boolean, credentials?: Credentials): Promise<Message> {
    let ProtocolMessage = message.$type.parent['ProtocolMessage'];
    let types = ProtocolMessage.lookupEnum("Type");
    let name = message.$type.name;
    let typeName = snake(name).toUpperCase();
    let type = types.values[typeName];
    var outerMessage = ProtocolMessage.create({
      priority: 0,
      type: type
    });
    if (Object.keys(message.toJSON()).length > 0) {
      let field = outerMessage.$type.fieldsArray.filter((f) => { return f.type == message.$type.name })[0];
      outerMessage[field.name] = message;
    }

    return this.sendProtocolMessage(outerMessage, name, type, waitForResponse, credentials);
  }

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
        that.emit('debug', "DEBUG: >>>> Send Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
        let messageLength = Buffer.from(varint.encode(encrypted.length));
        let bytes = Buffer.concat([messageLength, encrypted]);
        that.socket.write(bytes);
      } else {
        that.emit('debug', "DEBUG: >>>> Send Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
        let messageLength = Buffer.from(varint.encode(data.length));
        let bytes = Buffer.concat([messageLength, data]);
        that.socket.write(bytes);
      }

      if (!waitForResponse) {
        resolve(new Message(message));
      }
    });
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
            that.emit('debug', "DEBUG: <<<< Received Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
            return message;
          });
      });
  }
}

export module Connection {
  export interface Events {
    connect: void;
    message: Message;
    close: void;
    error: Error;
    debug: string;
  }
}
