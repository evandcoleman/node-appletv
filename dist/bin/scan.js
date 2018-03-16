"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const inquirer_1 = require("inquirer");
const ora = require("ora");
const browser_1 = require("../lib/browser");
function scan(logger, timeout, uniqueIdentifier) {
    let browser = new browser_1.Browser();
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
        }
        else {
            return inquirer_1.prompt([{
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
exports.scan = scan;
