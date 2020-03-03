import { prompt } from 'inquirer';
import * as caporal from 'caporal';
import * as ora from 'ora';

import { TVClient } from '../lib/tvclient';
import { PairingClient } from '../lib/pairing';

export function pair(device: TVClient, logger: Logger): Promise<TVClient> {
  let spinner = ora("Connecting to " + device.name).start()
  return device
    .open()
    .then(() => {
      spinner.succeed().start('Initiating Pairing')      
      return device.pair()
        .then(callback => {
          spinner.succeed();
          return prompt([{
            type: 'input',
            name: 'pin',
            message: "Enter the 4-digit pin that's currently being displayed on " + device.name,
            validate: (input) => {
              let isValid = /^\d+$/.test(input);

              return isValid ? true : 'Pin must be 4-digits and all numbers.';
            }
          }])
          .then(answers => {
            spinner.start('Completing Pairing');
            return callback(answers['pin']);
          });
        })
        .then(device => {
          spinner.succeed();
          return device;
        })
        .catch(error => {
          spinner.fail();
          throw error;
        });
    });
}