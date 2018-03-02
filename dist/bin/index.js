"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const caporal = require("caporal");
let cli = caporal;
const appletv_1 = require("../lib/appletv");
const credentials_1 = require("../lib/credentials");
const scan_1 = require("./scan");
const pair_1 = require("./pair");
cli
    .version('1.0.0')
    .command('pair', 'Pair with an AppleTV')
    .action((args, options, logger) => {
    scan_1.scan(logger)
        .then(device => {
        return pair_1.pair(device, logger)
            .then(keys => {
            logger.info("Success! Credentials: " + device.credentials.toString());
            process.exit();
        });
    })
        .catch(error => {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    });
});
cli
    .version('1.0.0')
    .command('command', 'Send a command to an AppleTV')
    .argument('<command>', 'The command to send', /^up|down|left|right|menu|play|pause|next|previous$/)
    .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING)
    .action((args, options, logger) => {
    if (!options.credentials) {
        logger.error("Credentials are required. Pair first.");
        process.exit();
    }
    let credentials = credentials_1.Credentials.parse(options.credentials);
    scan_1.scan(logger, credentials.uniqueIdentifier)
        .then(device => {
        return device
            .openConnection(credentials)
            .then(() => {
            return device
                .sendKeyCommand(appletv_1.AppleTV.key(args["command"]))
                .then(result => {
                logger.info("Success!");
                process.exit();
            });
        });
    })
        .catch(error => {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    });
});
cli
    .version('1.0.0')
    .command('state', 'Observes the playback state of the AppleTV')
    .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING)
    .action((args, options, logger) => {
    if (!options.credentials) {
        logger.error("Credentials are required. Pair first.");
        process.exit();
    }
    let credentials = credentials_1.Credentials.parse(options.credentials);
    scan_1.scan(logger, credentials.uniqueIdentifier)
        .then(device => {
        return device
            .openConnection(credentials);
    })
        .then(device => {
        device
            .observeState((error, result) => {
            if (error) {
                logger.error(error.message);
                logger.debug(error.stack);
            }
            else {
                logger.info(result);
            }
        });
    })
        .catch(error => {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    });
});
cli
    .version('1.0.0')
    .command('notifications', 'Watch for notifications from the AppleTV')
    .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING)
    .action((args, options, logger) => {
    if (!options.credentials) {
        logger.error("Credentials are required. Pair first.");
        process.exit();
    }
    let credentials = credentials_1.Credentials.parse(options.credentials);
    scan_1.scan(logger, credentials.uniqueIdentifier)
        .then(device => {
        return device
            .openConnection(credentials);
    })
        .then(device => {
        device
            .observeNotifications((error, result) => {
            if (error) {
                logger.error(error.message);
                logger.debug(error.stack);
            }
            else {
                logger.info(result);
            }
        });
    })
        .catch(error => {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    });
});
cli
    .version('1.0.0')
    .command('messages', 'Log all messages sent from the AppleTV')
    .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING)
    .action((args, options, logger) => {
    if (!options.credentials) {
        logger.error("Credentials are required. Pair first.");
        process.exit();
    }
    let credentials = credentials_1.Credentials.parse(options.credentials);
    scan_1.scan(logger, credentials.uniqueIdentifier)
        .then(device => {
        return device
            .openConnection(credentials);
    })
        .then(device => {
        device
            .observeMessages((error, message) => {
            if (error) {
                logger.error(error.message);
                logger.debug(error.stack);
            }
            else {
                logger.info(message.type);
                // logger.info(JSON.stringify(message.toObject(), null, 2));
            }
        });
    })
        .catch(error => {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    });
});
cli.parse(process.argv);
