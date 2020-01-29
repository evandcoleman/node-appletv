"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const browser_1 = require("../lib/browser");
const chai_1 = require("chai");
const mdns = require("mdns");
require("mocha");
const AppleTVName = "Test Apple TV";
const AppleTVIdentifier = "TestAppleTVIdentifier";
describe('apple tv discovery', function () {
    it('should discover apple tv', function () {
        return __awaiter(this, void 0, void 0, function* () {
            this.timeout(5000);
            let ad = mdns.createAdvertisement(mdns.tcp('mediaremotetv'), 54321, {
                name: AppleTVName,
                txtRecord: {
                    Name: AppleTVName,
                    UniqueIdentifier: AppleTVIdentifier
                }
            });
            ad.start();
            let browser = new browser_1.Browser();
            let devices = yield browser.scan(AppleTVIdentifier);
            chai_1.expect(devices.length).to.be.greaterThan(0);
            let device = devices[0];
            chai_1.expect(device.uid).to.equal(AppleTVIdentifier);
            chai_1.expect(device.name).to.equal(AppleTVName);
            ad.stop();
        });
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
