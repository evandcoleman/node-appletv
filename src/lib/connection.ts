import { Socket } from 'net';
import { load, Type, Message, Enum } from 'protobufjs'
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import * as varint from 'varint';
import caporal from 'caporal';
import snake = require('snake-case');
import camelcase = require('camelcase');

import { Credentials } from './credentials';
import { AppleTV } from './appletv';
import encryption from './util/encryption';

interface MessageCallback {
  persist: boolean
  responseType: string
  callback: (data: Buffer) => void
}

export class Connection {
  private socket: Socket;
  private callbacks = new Map<String, [MessageCallback]>();
  private rawMessageCallbacks: Array<(string, Buffer) => void> = [];
  private ProtocolMessage: Type;
  private buffer: Buffer = Buffer.alloc(0);

  private unidentifiableMessageTypes: Array<number> = [
    4,
    5,
    34
  ];

  private waitForResponseMessageTypes: Array<number> = [
    3,
    15,
    32,
    34
  ];

  constructor(public device: AppleTV, private log?: (string) => void) {
    this.socket = new Socket();
    let that = this;
    this.socket.on('data', (data) => {
      try {
        that.buffer = Buffer.concat([that.buffer, data]);
        let length = varint.decode(that.buffer);
        let messageBytes = that.buffer.slice(varint.decode.bytes, length + varint.decode.bytes);

        if (messageBytes.length < length) {
          log("Message length mismatch");
          return;
        }

        that.buffer = that.buffer.slice(length + varint.decode.bytes);

        log("DEBUG: <<<< Received Data=" + messageBytes.toString('hex'));
      
        if (device.credentials && device.credentials.readKey) {
          messageBytes = device.credentials.decrypt(messageBytes);
          log("DEBUG: Decrypted Data=" + messageBytes.toString('hex'));
        }
        let message = that.ProtocolMessage.decode(messageBytes);
        let types = that.ProtocolMessage.lookupEnum("Type");
        let name = types.valuesById[message["type"]];
        let identifier = message["identifier"] || "type_" + name;
        if (!that.executeCallbacks(identifier, messageBytes)) {
          log("Missing callback: " + JSON.stringify(message.toJSON(), null, 2))
        }
        if (name) {
          for (var i = 0; i < that.rawMessageCallbacks.length; i++) {
            let id = camelcase(name);
            let fixedId = id.charAt(0).toUpperCase() + id.slice(1)
            that.rawMessageCallbacks[i](fixedId, messageBytes)
          }
        }
      } catch(error) {
        log(error.message);
        log(error.stack);
      }
    });

    this.socket.on('error', (error) => {
      log(error.message);
      log(error.stack);
    });
  }

  private addCallback(identifier: string, persist: boolean, callback: (data: Buffer) => void) {
    if (this.callbacks.has(identifier)) {
      this.callbacks.get(identifier).push(<MessageCallback>{
        persist: persist,
        callback: callback
      });
    } else {
      this.callbacks.set(identifier, [<MessageCallback>{
        persist: persist,
        callback: callback
      }]);
    }
  }

  private executeCallbacks(identifier: string, data: Buffer): boolean {
    let callbacks = this.callbacks.get(identifier);
    if (callbacks) {
      for (var i = 0; i < callbacks.length; i++) {
        let callback = callbacks[i];
        callback.callback(data);
        if (!callback.persist) {
          this.callbacks.get(identifier).splice(i, 1);
        }
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

  messageOfType(messageType: string): Promise<any> {
    let that = this;
    return new Promise<{}>((resolve, reject) => {
      that.messagesOfType(messageType, (error, message) => {
        if (error) {
          reject(error);
        } else {
          resolve(message);
        }
      }, false);
    });
  }

  messagesOfType(messageType: string, callback: (Error, any) => void, persist?: boolean) {
    let that = this;
    load(path.resolve(__dirname + "/protos/" + messageType + ".proto"), (error, root) => {
      if (error) {
        callback(error, null);
        return;
      }
      let type = root.lookupType(messageType);
      let ProtocolMessage = type.parent['ProtocolMessage'];
      let cb = (data: Buffer) => {
        try {
          let message = ProtocolMessage.decode(data);
          // that.log("DEBUG: <<<< Received Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
          let key = "." + messageType.charAt(0).toLowerCase() + messageType.slice(1);
          callback(null, message[key]);
        } catch(error) {
          callback(error, null);
        }
      };
      let identifier = "type_" + snake(messageType).toUpperCase();
      that.addCallback(identifier, persist == null ? true : persist, cb);
    });
  }

  observeMessages(callback: (Error, string, any) => void) {
    this.rawMessageCallbacks.push((identifier, data) => {
      load(path.resolve(__dirname + "/protos/" + identifier + ".proto"), (error, root) => {
        if (error) {
          callback(error, identifier, null);
        } else {
          let type = root.lookupType(identifier);
          let ProtocolMessage = type.parent['ProtocolMessage'];
          let message = ProtocolMessage.decode(data);
          callback(null, identifier, message);
        }
      })
    });
  }

  sendBlank(typeName: string, credentials?: Credentials): Promise<Message<{}>> {
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

        return that.sendProtocolMessage(message, name, type, credentials);
      });
  }

  send(message: Message<{}>, credentials?: Credentials): Promise<Message<{}>> {
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

    return this.sendProtocolMessage(outerMessage, name, type, credentials);
  }

  private sendProtocolMessage(message: Message<{}>, name: string, type: number, credentials?: Credentials): Promise<Message<{}>> {
    let that = this;
    return new Promise<Message<{}>>((resolve, reject) => {
      let ProtocolMessage: any = message.$type;
      let waitForResponse = that.waitForResponseMessageTypes.indexOf(type) > -1;
      if (waitForResponse) {
        let callback = (data: Buffer) => {
          try {
            that.decodeMessage(data)
              .then(message => {
                resolve(message);
              })
              .catch(error => {
                that.log(error);
              });
          } catch(error) {
            that.log(error);
          }
        };
        if (that.unidentifiableMessageTypes.indexOf(type) == -1) {
          let id = uuid();
          message["identifier"] = id;
          that.addCallback(id, false, callback);
        } else {
          that.addCallback("type_" + snake(name).toUpperCase(), false, callback);
        }
      }
      
      
      let data = ProtocolMessage.encode(message).finish();
      that.log("DEBUG: >>>> Send Data=" + data.toString('hex'));

      if (credentials && credentials.writeKey) {
        let encrypted = credentials.encrypt(data);
        that.log("DEBUG: >>>> Send Encrypted Data=" + encrypted.toString('hex'));
        that.log("DEBUG: >>>> Send Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
        let messageLength = Buffer.from(varint.encode(encrypted.length));
        let bytes = Buffer.concat([messageLength, encrypted]);
        that.socket.write(bytes);
      } else {
        that.log("DEBUG: >>>> Send Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
        let messageLength = Buffer.from(varint.encode(data.length));
        let bytes = Buffer.concat([messageLength, data]);
        that.socket.write(bytes);
      }

      if (!waitForResponse) {
        resolve(message);
      }
    });
  }

  private decodeMessage(data: Buffer): Promise<Message<{}>> {
    let that = this;
    return load(path.resolve(__dirname + "/protos/ProtocolMessage.proto"))
      .then(root => {
        let ProtocolMessage = root.lookupType("ProtocolMessage");
        let preMessage = ProtocolMessage.decode(data);
        let type = preMessage.toJSON().type;
        let name = type[0].toUpperCase() + camelcase(type).substring(1);

        return load(path.resolve(__dirname + "/protos/" + name + ".proto"))
          .then(root => {
            let ProtocolMessage = root.lookupType("ProtocolMessage");
            let message = ProtocolMessage.decode(data);
            that.log("DEBUG: <<<< Received Protobuf=" + JSON.stringify(message.toJSON(), null, 2));
            let key = "." + name.charAt(0).toLowerCase() + name.slice(1);
            return message[key];
          });
      });
  }
}