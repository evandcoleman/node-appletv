import { get as prompt } from 'prompt';
import caporal from 'caporal';

import { AppleTV } from '../lib/appletv';
import { Pairing } from '../lib/pairing';
import { Verifier } from '../lib/verifier';

export function pair(device: AppleTV, logger: Logger): Promise<AppleTV> {
  logger.info("Pairing with " + device.name +".");
  return device
    .openConnection()
    .then(() => {
      let pairing = new Pairing(device);
      
      return pairing.initiatePair(logger.debug)
        .then(callback => {
          return new Promise<string>((resolve, reject) => {
            prompt(['PIN'], (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result.PIN);
              }
            });
          })
          .then(pin => {
            return callback(pin);
          });
        });
    });
}