import { createServer, Server } from 'net';
import { AppleTV } from '../../lib/appletv';
import { Connection } from '../../lib/connection';
import * as mdns from 'mdns';

export class MockServer {
  public device: Promise<AppleTV>;

  private server?: Server;

  constructor() {
    console.log("1");

    this.device = new Promise<AppleTV>(function(resolve, reject) {
      console.log("2");
      this.server = createServer(function(socket) {
        console.log("3");
        let device = new AppleTV({
          addresses: ['127.0.0.1'],
          port: 65416,
          txtRecord: {
            Name: "Mock Apple TV",
            UniqueIdentifier: "MockAppleTVUUID"
          }
        } as mdns.Service, socket);
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
