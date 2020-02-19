import { prompt } from 'inquirer';
import * as caporal from 'caporal';
import * as ora from 'ora';

import { TVClient } from '../lib/tvclient';
import { Browser } from '../lib/browser';

export function scan(logger: Logger, timeout?: number, uniqueIdentifier?: string): Promise<TVClient> {
  let browser = new Browser();
  let spinner = ora('Scanning for Apple TVs...').start();
  return browser
    .scan(uniqueIdentifier, timeout)
    .then(devices => {
      spinner.stop();
      if (devices.length == 1) {
        return devices[0];
      }

      if (devices.length == 0) {
        throw new Error("No Apple TVs found on the network. Try again.");
      } else {
        return prompt<{}>([{
          type: 'list',
          name: 'device',
          message: 'Which Apple TV would you like to pair with?',
          choices: devices.map(device => {
            return {
              name: device.name + " (" + device.address + ":" + device.port + ")",
              value: device.uid
            };
          })
        }])
        .then(answers => {
          let uid = answers['device'];
          return devices.filter(device => { return device.uid == uid; })[0];
        });
      }
    });
}