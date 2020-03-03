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

describe('integration tests', function() {
  var server: TVServer;
  var client: TVClient;
  var clientSent;
  var serverSent;
  var clientReceived;
  var serverReceived;

  beforeEach(async function() {
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
    });
    client.uid = 'client';

    // sinon.stub(client, 'write').callsFake(function(data: Buffer, socket: Socket) {
    //   serverSocket.emit('data', data);
    // });

    // sinon.stub(server, 'write').callsFake(function(data: Buffer, socket: Socket) {
    //   clientSocket.emit('data', data);
    // });

    clientSent = sinon.spy(client, 'sendProtocolMessage');
    serverSent = sinon.spy(server, 'sendProtocolMessage');
    clientReceived = sinon.spy();
    serverReceived = sinon.spy();
    client.on('message', clientReceived);
    server.on('message', serverReceived);
  });

  it('should succeed', async function() {
    // server.on('debug', server.log.debug);
    // client.on('debug', client.log.debug);
    await server.start();
    await client.open();
    let sendPin = await client.pair();
    await sendPin(server.clients[0].pairingServer.code);

    expect(server.clients[0].credentials).to.exist;
    expect(client.credentials).to.exist;
    expect(server.clients[0].credentials.remoteUid).to.equal(client.credentials.localUid);
    expect(server.clients[0].credentials.localUid).to.equal(client.credentials.remoteUid);

    expect(clientSent.getCall(0).lastArg.message.type).to.equal(Message.Type.DeviceInfoMessage);
    expect(serverSent.getCall(0).lastArg.message.type).to.equal(Message.Type.DeviceInfoMessage);
    expect(clientReceived.getCall(0).args[0].type).to.equal(Message.Type.DeviceInfoMessage);
    expect(serverReceived.getCall(0).args[0].type).to.equal(Message.Type.DeviceInfoMessage);

    await client.beginSession();

    await new Promise(function(resolve) {
        setTimeout(resolve, 100);
    });

    expect(server.clients[0].credentials.readKey).to.eql(client.credentials.writeKey);
    expect(server.clients[0].credentials.writeKey).to.eql(client.credentials.readKey);

    expect(clientSent.lastCall.lastArg.message.type).to.equal(Message.Type.ClientUpdatesConfigMessage);

    await client.sendKeyCommand(AppleTV.Key.Menu);

    await new Promise(function(resolve) {
        setTimeout(resolve, 100);
    });

    expect(clientSent.lastCall.lastArg.message.type).to.equal(Message.Type.SendHidEventMessage);
    expect(serverReceived.lastCall.args[0].type).to.equal(Message.Type.SendHidEventMessage);
  });
});
