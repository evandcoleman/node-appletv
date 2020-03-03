"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inquirer_1 = require("inquirer");
const ora = require("ora");
function pair(device, logger) {
    let spinner = ora("Connecting to " + device.name).start();
    return device
        .open()
        .then(() => {
        spinner.succeed().start('Initiating Pairing');
        return device.pair()
            .then(callback => {
            spinner.succeed();
            return inquirer_1.prompt([{
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
exports.pair = pair;
