import { AppleTV } from '../lib/appletv';
import { Message } from '../lib/message';
import { expect } from 'chai';
import { Socket } from 'net';
import * as mdns from 'mdns';
import * as sinon from 'sinon';
import 'mocha';

describe('apple tv tests', function() {
  beforeEach(function() {
    let socket = new Socket({});

    sinon.stub(socket, 'write');
    sinon.stub(<any>socket, 'connect').callsFake(function(port: number, host: string, callback: any) {
        callback();
    });

    this.device = new AppleTV({
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
        Name: "Mock Apple TV",
        UniqueIdentifier: "MockAppleTVUUID"
      }
    }, socket);

    this.fake = sinon.stub(this.device.connection, 'sendProtocolMessage');
    this.device.connection.isOpen = true;

    this.sentMessages = function() {
      var messages = [];

      for (var i = 0; i < this.fake.callCount; i++) {
        messages.push(new Message(this.fake.getCall(i).args[0]));
      }

      return messages;
    }
  });

  it('should send introduction', async function() {
    await this.device.openConnection();

    let messages = this.sentMessages();

    expect(messages.length).to.equal(1);
    expect(messages[0].type).to.equal(Message.Type.DeviceInfoMessage);
  });

  it('should request artwork', async function() {
    let width = 640;
    let height = 480;
    await this.device.openConnection();
    try {
      await this.device.requestArtwork(width, height);
    } catch (error) {}

    let messages = this.sentMessages();
    
    expect(messages.length).to.equal(2);
    expect(messages[1].type).to.equal(Message.Type.PlaybackQueueRequestMessage);
    expect(messages[1].payload.artworkWidth).to.equal(width);
    expect(messages[1].payload.artworkHeight).to.equal(height);
    expect(messages[1].payload.length).to.equal(1);
    expect(messages[1].payload.location).to.equal(0);
  });

  it('should press and release menu', async function() {
    await this.device.openConnection();
    await this.device.sendKeyCommand(AppleTV.Key.Menu);

    let messages = this.sentMessages();
    
    expect(messages.length).to.equal(3);
    expect(messages[1].type).to.equal(Message.Type.SendHidEventMessage);
    expect(messages[2].type).to.equal(Message.Type.SendHidEventMessage);
  });

  it('should read now playing', async function() {
    await this.device.openConnection();

    var spy = sinon.spy();
    this.device.on('nowPlaying', spy);
    this.device.connection.emit('message', <Message>require('./fixtures/now-playing.json'));
    
    let messages = this.sentMessages();
    
    expect(messages.length).to.equal(1);
    expect(spy.lastCall.lastArg.title).to.equal('Seinfeld');
    expect(spy.lastCall.lastArg.appDisplayName).to.equal('Hulu');
    expect(spy.lastCall.lastArg.appBundleIdentifier).to.equal('com.hulu.plus');
  });
});
