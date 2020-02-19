// import { Service } from 'mdns';
// import * as path from 'path';
// import { load, Message as ProtoMessage } from 'protobufjs'
// import { v4 as uuid } from 'uuid';
// import { EventEmitter } from 'events';
// import { Socket } from 'net';
// import { Connection } from './connection';
// import { Pairing } from './pairing'; 
// import { Verifier } from './verifier';
// import { Credentials } from './credentials';
// import { NowPlayingInfo } from './now-playing-info';
// import { SupportedCommand } from './supported-command';
// import { Message } from './message';
// import number from './util/number';
// interface StateRequestCallback {
//   id: string;
//   resolve: (any) => void;
//   reject: (Error) => void;
// }
// export interface Size {
//   width: number;
//   height: number;
// }
// export interface PlaybackQueueRequestOptions {
//   location: number;
//   length: number;
//   includeMetadata?: boolean;
//   includeLanguageOptions?: boolean;
//   includeLyrics?: boolean;
//   artworkSize?: Size;
// }
// export interface ClientUpdatesConfig {
//   artworkUpdates: boolean;
//   nowPlayingUpdates: boolean;
//   volumeUpdates: boolean;
//   keyboardUpdates: boolean;
// }
// export class AppleTV extends EventEmitter /* <AppleTV.Events> */ {
//   public name: string;
//   public address: string;
//   public port: number;
//   public uid: string;
//   public pairingId: string = uuid();
//   public credentials: Credentials;
//   public connection: Connection;
//   private queuePollTimer?: any;
//   constructor(private service: Service, socket?: Socket) {
//     super();
//     this.service = service;
//     this.name = service.txtRecord.Name;
//     this.address = service.addresses.filter(x => x.includes('.'))[0];
//     this.port = service.port;
//     this.uid = service.txtRecord.UniqueIdentifier;
//     this.connection = new Connection(this, socket);
//     this.setupListeners();
//   }
//   /**
//   * Pair with an already discovered AppleTV.
//   * @returns A promise that resolves to the AppleTV object.
//   */
//   pair(): Promise<(pin: string) => Promise<AppleTV>> {
//     let pairing = new Pairing(this);
//     return pairing.initiatePair();
//   }
//   /**
//   * Opens a connection to the AppleTV over the MRP protocol.
//   * @param credentials  The credentials object for this AppleTV
//   * @returns A promise that resolves to the AppleTV object.
//   */
//   async open(credentials?: Credentials): Promise<AppleTV> {
//     if (credentials) {
//       this.pairingId = credentials.pairingId;      
//     }
//     await this.connection.open();
//     await this.sendIntroduction();
//     this.credentials = credentials;
//     if (credentials) {
//       let verifier = new Verifier(this);
//       let keys = await verifier.verify();
//       this.credentials.readKey = keys['readKey'];
//       this.credentials.writeKey = keys['writeKey'];
//       this.emit('debug', "DEBUG: Keys Read=" + this.credentials.readKey.toString('hex') + ", Write=" + this.credentials.writeKey.toString('hex'));
//       await this.sendConnectionState();
//     }
//     if (credentials) {
//       await this.sendClientUpdatesConfig({
//         nowPlayingUpdates: true,
//         artworkUpdates: true,
//         keyboardUpdates: false,
//         volumeUpdates: false
//       });
//     }
//     return this;
//   }
//   /**
//   * Closes the connection to the Apple TV.
//   */
//   closeConnection() {
//     this.connection.close();
//   }
//   *
//   * Send a Protobuf message to the AppleTV. This is for advanced usage only.
//   * @param definitionFilename  The Protobuf filename of the message type.
//   * @param messageType  The name of the message.
//   * @param body  The message body
//   * @param waitForResponse  Whether or not to wait for a response before resolving the Promise.
//   * @returns A promise that resolves to the response from the AppleTV.
//   async sendMessage(definitionFilename: string, messageType: string, body: {}, waitForResponse: boolean, priority: number = 0): Promise<Message> {
//     let root = await load(path.resolve(__dirname + "/protos/" + definitionFilename + ".proto"));
//     let type = root.lookupType(messageType);
//     let message = await type.create(body);
//     return this.connection.send(message, waitForResponse, priority, this.credentials);
//   }
//   /**
//   * Wait for a single message of a specified type.
//   * @param type  The type of the message to wait for.
//   * @param timeout  The timeout (in seconds).
//   * @returns A promise that resolves to the Message.
//   */
//   messageOfType(type: Message.Type, timeout: number = 5): Promise<Message> {
//     let that = this;
//     return new Promise<Message>((resolve, reject) => {
//       let listener: (message: Message) => void;
//       let timer = setTimeout(() => {
//         reject(new Error("Timed out waiting for message type " + type));
//         that.removeListener('message', listener);
//       }, timeout * 1000);
//       listener = (message: Message) => {
//         if (message.type == type) {
//           resolve(message);
//           that.removeListener('message', listener);
//         }
//       };
//       that.on('message', listener);
//     });
//   }
//   waitForSequence(sequence: number, timeout: number = 3): Promise<Message> {
//     return this.connection.waitForSequence(sequence, timeout);
//   }
//   private sendIntroduction(): Promise<Message> {
//     let body = {
//       uniqueIdentifier: this.pairingId,
//       name: 'node-appletv',
//       localizedModelName: 'iPhone',
//       systemBuildVersion: '14G60',
//       applicationBundleIdentifier: 'com.apple.TVRemote',
//       applicationBundleVersion: '320.18',
//       protocolVersion: 1,
//       allowsPairing: true,
//       lastSupportedMessageType: 45,
//       supportsSystemPairing: true,
//     };
//     return this.sendMessage('DeviceInfoMessage', 'DeviceInfoMessage', body, true);
//   }
//   private onReceiveMessage(message: Message) {
//     this.emit('message', message);
//     if (message.type == Message.Type.SetStateMessage) {
//       if (message.payload == null) {
//         this.emit('nowPlaying', null);
//         return;
//       }
//       if (message.payload.nowPlayingInfo) {
//         let info = new NowPlayingInfo(message.payload);
//         this.emit('nowPlaying', info);
//       }
//       if (message.payload.supportedCommands) {
//         let commands = (message.payload.supportedCommands.supportedCommands || [])
//           .map(sc => {
//             return new SupportedCommand(sc.command, sc.enabled || false, sc.canScrub || false);
//           });
//         this.emit('supportedCommands', commands);
//       }
//       if (message.payload.playbackQueue) {
//         this.emit('playbackQueue', message.payload.playbackQueue);
//       }
//     }
//   }
//   private setupListeners() {
//     let that = this;
//     this.connection.on('message', (message: Message) => {
//       that.onReceiveMessage(message);
//     })
//     .on('connect', () => {
//       that.emit('connect');
//     })
//     .on('close', () => {
//       that.emit('close');
//     })
//     .on('error', (error) => {
//       that.emit('error', error);
//     })
//     .on('debug', (message) => {
//       that.emit('debug', message);
//     });
//   }
// }
