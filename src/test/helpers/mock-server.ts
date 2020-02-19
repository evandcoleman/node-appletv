// import { createServer, Server } from 'net';
// import { AppleTV } from '../../lib/appletv';
// import { Connection } from '../../lib/connection';
// import { Message } from '../../lib/message';
// import * as mdns from 'mdns';

// export class MockServer {
//   public device: AppleTV;
//   public message: Promise<Message>;

//   private server: Server;

//   constructor() {
//     let port = 65416;
//     this.device = new AppleTV({
//       addresses: ['127.0.0.1'],
//       port: port,
//       txtRecord: {
//         Name: "Mock Apple TV",
//         UniqueIdentifier: "MockAppleTVUUID"
//       }
//     } as mdns.Service);
//     let d = this.device;
//     let that = this;

//     this.message = new Promise<Message>(function(resolve, reject) {
//       that.server = createServer(function(socket) {
//         let connection = new Connection(d, socket);
//         d.connection = connection;
//         d.on('message', function(message) {
//           resolve(message);
//         });
//       });

//       that.server.listen(port);
//     });
//   }

//   close() {
//     this.server.close();
//     this.device.connection.close();
//   }
// }
