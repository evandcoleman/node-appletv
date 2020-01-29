"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const appletv_1 = require("../../lib/appletv");
const connection_1 = require("../../lib/connection");
const message_1 = require("../../lib/message");
class MockServer {
    constructor() {
        let port = 65416;
        this.device = new appletv_1.AppleTV({
            addresses: ['127.0.0.1'],
            port: port,
            txtRecord: {
                Name: "Mock Apple TV",
                UniqueIdentifier: "MockAppleTVUUID"
            }
        });
        let d = this.device;
        this.server = net_1.createServer(function (socket) {
            let connection = new connection_1.Connection(d, socket);
            d.connection = connection;
            connection.on('message', function (message) {
                switch (message.type) {
                    case message_1.Message.Type.DeviceInfoMessage:
                        this.handleDeviceInfoMessage(d);
                }
            });
        });
        this.server.listen(port);
        // this.device.on('message', (message) => {
        //   console.log(message);
        // });
    }
    handleDeviceInfoMessage(device) {
        let body = {
            uniqueIdentifier: device.pairingId,
            name: device.name,
            localizedModelName: 'iPhone',
            systemBuildVersion: '14G60',
            applicationBundleIdentifier: 'com.apple.TVRemote',
            applicationBundleVersion: '320.18',
            protocolVersion: 1,
            allowsPairing: true,
            lastSupportedMessageType: 45,
            supportsSystemPairing: true,
        };
        return device.sendMessage('DeviceInfoMessage', 'DeviceInfoMessage', body, true);
    }
}
exports.MockServer = MockServer;
