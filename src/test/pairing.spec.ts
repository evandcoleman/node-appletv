import { PairingServer, PairingClient } from '../lib/pairing';
import { TVServer } from '../lib/tvserver';
import { TVClient } from '../lib/tvclient';
import { Message } from '../lib/message';
import { AppleTV, SendProtocolMessageOptions } from '../lib/appletv';
import { Socket, Server } from 'net';
import { v4 as uuid } from 'uuid';
import * as mdns from 'mdns';
import * as sinon from 'sinon';
import * as ed25519 from 'ed25519';
import * as crypto from 'crypto';
import { expect } from 'chai';
import 'mocha';

describe('apple tv pairing', function() {
  var server: PairingServer;
  var client: PairingClient;

  beforeEach(async function() {
    let socket = new Socket({});

    let uid = 'server';
    let tvserver = new TVServer('test atv', 12345, uid);
    let tvclient = new TVClient({
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
    }, socket);
    tvclient.uid = 'client';

    let seed: Buffer = crypto.randomBytes(32);
    let { publicKey, privateKey } = ed25519.MakeKeypair(seed);
    let keyPair = {
      signPk: publicKey,
      signSk: privateKey
    };
    server = new PairingServer(tvserver, keyPair, {
      uid: tvclient.uid,
      name: 'test atv',
      socket
    });
    client = new PairingClient(tvclient);

    sinon.stub(tvclient, 'sendProtocolMessage').callsFake(async function(options: SendProtocolMessageOptions) {
      let message = new Message(options.message);
      await server.handle(message);
      return null;
    });

    sinon.stub(tvserver, 'sendProtocolMessage').callsFake(async function(options: SendProtocolMessageOptions) {
      let message = new Message(options.message);
      await client.handle(message);
      return null;
    });
  });

  it('should pair and verify', async function() {
    let sendPin = await client.pair();
    await sendPin(server.code);
    
    expect(server.client.credentials).to.exist;
    expect(client.device.credentials).to.exist;
    expect(server.client.credentials.remoteUid).to.equal(client.device.credentials.localUid);
    expect(server.client.credentials.localUid).to.equal(client.device.credentials.remoteUid);

    await client.verify();

    expect(server.client.credentials.readKey.toString('hex')).to.equal(client.device.credentials.writeKey.toString('hex'));
    expect(server.client.credentials.writeKey.toString('hex')).to.equal(client.device.credentials.readKey.toString('hex'));
  });
});
