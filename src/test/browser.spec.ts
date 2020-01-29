import { Browser } from '../lib/browser';
import { AppleTV } from '../lib/appletv';
import { expect } from 'chai';
import * as mdns from 'mdns';
import 'mocha';

const AppleTVName = "Test Apple TV";
const AppleTVIdentifier = "TestAppleTVIdentifier";

describe('apple tv discovery', function() {
  it('should discover apple tv', async function() {
    this.timeout(5000);

    let ad = mdns.createAdvertisement(mdns.tcp('mediaremotetv'), 54321, {
      name: AppleTVName,
      txtRecord: {
        Name: AppleTVName,
        UniqueIdentifier: AppleTVIdentifier
      }
    });
    ad.start();

    let browser = new Browser();
    let devices = await browser.scan(AppleTVIdentifier);

    expect(devices.length).to.be.greaterThan(0);

    let device = devices[0];

    expect(device.uid).to.equal(AppleTVIdentifier);
    expect(device.name).to.equal(AppleTVName);

    ad.stop();
  });
});

// describe('apple tv pairing', function() {
//   beforeEach(function() { this.mitm = Mitm(); });
//   afterEach(function() { this.mitm.disable(); });

//   it('should pair with apple tv', async function() {
//     this.mitm.on("connection", function(socket) { console.log("Hello back!") });

//     this.timeout(10000);

//     let server = new MockServer();
//     let device = await server.device;

//     await device.openConnection();

//     let callback = await device.pair();

//   });
// });
