import { get as prompt } from 'prompt';
import caporal from 'caporal';

import { AppleTV } from '../lib/appletv';
import { Browser } from '../lib/browser';

export function scan(logger: Logger, uniqueIdentifier?: string): Promise<AppleTV> {
  let browser = new Browser(logger.debug);
  return browser
    .scan(uniqueIdentifier)
    .then(devices => {
      if (devices.length == 1) {
        return devices[0];
      }

      return new Promise<AppleTV>((resolve, reject) => {
        if (devices.length == 0) {
          reject(new Error("No Apple TVs found on the network."));
        } else {
          logger.info("Found " + devices.length + " Apple TVs:");
          for (var i = 0; i < devices.length; i++) {
            let device = devices[i];
            logger.info((i + 1) + ": " + device.name + " (" + device.address + ")");
          }
          prompt(['Device'], (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(devices[parseInt(result.Device) - 1]);
            }
          });
        }
      });
    });
}