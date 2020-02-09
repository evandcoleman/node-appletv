// import { Pairing } from '../lib/pairing';
// import { AppleTV } from '../lib/appletv';
// import { Message } from '../lib/message';
// import { MockServer } from './helpers/mock-server';
// import { expect } from 'chai';
// import 'mocha';

// describe('apple tv pairing', function() {
//   beforeEach(function() {
//     this.server = new MockServer();
//     this.device = this.server.device;
//   });

//   afterEach(function() {
//     this.server.close();
//   });

//   it('should send introduction', async function() {
//     this.device.openConnection();
//     let message = await this.server.message;
    
//     expect(message.type).to.equal(Message.Type.DeviceInfoMessage);
//   });
// });
