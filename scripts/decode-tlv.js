var tlv = require('../dist/lib/util/tlv').default;

let buffer = Buffer.from("06010103 20a629a8 86bd2028 0f4ef051 62efd291 22bc5cc6 610b26cd a3d704f8 d816c9e2 50".replace(/\s/g, ''), 'hex');
console.log(tlv.decode(buffer));