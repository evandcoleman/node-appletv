import { TVServer } from '../lib/tvserver';
import { TVClient } from '../lib/tvclient';
import { Message } from '../lib/message';
import { Credentials } from '../lib/credentials';
import { AppleTV, SendProtocolMessageOptions } from '../lib/appletv';
import { Socket, Server } from 'net';
import { v4 as uuid } from 'uuid';
import * as mdns from 'mdns';
import * as sinon from 'sinon';
import { expect } from 'chai';
import 'mocha';

interface DeviceMessages {
  sent: Message[];
  received: Message[];
}

interface Messages {
  client: DeviceMessages;
  server: DeviceMessages;
}

describe('apple tv communication', function() {
  var server: TVServer;
  var client: TVClient;
  var messages: Messages = {
    client: {
      sent: [],
      received: []
    },
    server: {
      sent: [],
      received: []
    }
  };

  beforeEach(async function() {
    let clientSocket = new Socket({});
    let serverSocket = new Socket({});

    let uid = 'server';
    server = new TVServer('test atv', 12345, uid);
    client = new TVClient({
      addresses: ['127.0.0.1'],
      port: 12345,
      flags: 0,
      fullname: '',
      host: '',
      interfaceIndex: 0,
      networkInterface: '',
      replyDomain: '',
      type: null,
      txtRecord: {
        Name: "test atv",
        LocalAirPlayReceiverPairingIdentity: uid
      }
    }, clientSocket);
    client.uid = 'client';
    client.credentials = new Credentials(
      'client',
      uid,
      Buffer.from('bcefd18ff97f3c89bf29c97ddbac05673d10bacdc0e4320eaa42082ca6090ecd', 'hex'),
      Buffer.from('0482de5dc68271394ff91974f540ac2abbf1baac3a93575c9dd9829f136f5fec', 'hex')
    );
    server.bindClient(serverSocket);
    server.registerClient({
      uid: 'client',
      name: 'node-appletv',
      credentials: new Credentials(
        uid,
        'client',
        Buffer.from('9c2b196c9722a2caa21c524b58fa99db267acd8ba7ae8b7cda2ba1cdd284f41a', 'hex'),
        Buffer.from('bdcb687201a1cda96056c42944e740955af56832c783de6a401c3adc8c903dd0', 'hex')
      ),
      socket: serverSocket
    });

    sinon.stub(client, 'write').callsFake(function(data: Buffer, socket: Socket) {
      serverSocket.emit('data', data);
    });

    sinon.stub(server, 'write').callsFake(function(data: Buffer, socket: Socket) {
      clientSocket.emit('data', data);
    });

    sinon.stub(client, 'sendProtocolMessage').callsFake(async function(options: SendProtocolMessageOptions) {
      let message = new Message(options.message);
      options.socket = clientSocket;
      messages.client.sent.push(message);
      messages.server.received.push(message);
      await (<any>client.sendProtocolMessage).wrappedMethod.bind(client)(message);
      return null;
    });

    sinon.stub(server, 'sendProtocolMessage').callsFake(async function(options: SendProtocolMessageOptions) {
      let message = new Message(options.message);
      options.socket = serverSocket;
      messages.client.received.push(message);
      messages.server.sent.push(message);
      await (<any>server.sendProtocolMessage).wrappedMethod.bind(server)(message);
      return null;
    });
  });

  it('should press and release menu', async function() {
    await client.sendKeyCommand(AppleTV.Key.Menu);

    expect(messages.client.sent[0]?.type).to.equal(Message.Type.SendHidEventMessage);
    expect(messages.client.sent[1]?.type).to.equal(Message.Type.SendHidEventMessage);
    expect(messages.server.received[0]?.type).to.equal(Message.Type.SendHidEventMessage);
    expect(messages.server.received[1]?.type).to.equal(Message.Type.SendHidEventMessage);
  });
});
