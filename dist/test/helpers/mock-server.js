"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const appletv_1 = require("../../lib/appletv");
class MockServer {
    constructor() {
        console.log("1");
        this.device = new Promise(function (resolve, reject) {
            console.log("2");
            this.server = net_1.createServer(function (socket) {
                console.log("3");
                let device = new appletv_1.AppleTV({
                    addresses: ['127.0.0.1'],
                    port: 65416,
                    txtRecord: {
                        Name: "Mock Apple TV",
                        UniqueIdentifier: "MockAppleTVUUID"
                    }
                }, socket);
                device.on('debug', (message) => {
                    console.log(message);
                });
                device.on('error', (message) => {
                    console.log(message);
                });
                device.on('message', (message) => {
                    console.log(message);
                });
                resolve(device);
            });
            console.log("4");
            this.server.listen(65416);
        }.bind(this));
    }
}
exports.MockServer = MockServer;
