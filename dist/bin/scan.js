"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prompt_1 = require("prompt");
const browser_1 = require("../lib/browser");
function scan(logger, uniqueIdentifier) {
    let browser = new browser_1.Browser(logger.debug);
    return browser
        .scan(uniqueIdentifier)
        .then(devices => {
        if (devices.length == 1) {
            return devices[0];
        }
        return new Promise((resolve, reject) => {
            if (devices.length == 0) {
                reject(new Error("No Apple TVs found on the network."));
            }
            else {
                logger.info("Found " + devices.length + " Apple TVs:");
                for (var i = 0; i < devices.length; i++) {
                    let device = devices[i];
                    logger.info((i + 1) + ": " + device.name + " (" + device.address + ")");
                }
                prompt_1.get(['Device'], (error, result) => {
                    if (error) {
                        reject(error);
                    }
                    else {
                        resolve(devices[parseInt(result.Device) - 1]);
                    }
                });
            }
        });
    });
}
exports.scan = scan;
