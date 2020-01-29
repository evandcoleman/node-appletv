"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const net_1 = require("net");
const appletv_1 = require("../../lib/appletv");
const connection_1 = require("../../lib/connection");
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
        let that = this;
        this.message = new Promise(function (resolve, reject) {
            that.server = net_1.createServer(function (socket) {
                let connection = new connection_1.Connection(d, socket);
                d.connection = connection;
                d.on('message', function (message) {
                    resolve(message);
                });
            });
            that.server.listen(port);
        });
    }
    close() {
        this.server.close();
        this.device.connection.close();
    }
}
exports.MockServer = MockServer;
