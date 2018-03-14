"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prompt_1 = require("prompt");
const pairing_1 = require("../lib/pairing");
function pair(device, logger) {
    logger.info("Pairing with " + device.name + ".");
    return device
        .openConnection()
        .then(() => {
        let pairing = new pairing_1.Pairing(device);
        return pairing.initiatePair()
            .then(callback => {
            return new Promise((resolve, reject) => {
                prompt_1.get(['PIN'], (error, result) => {
                    if (error) {
                        reject(error);
                    }
                    else {
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
exports.pair = pair;
