import * as caporal from 'caporal';
let cli = caporal as any;

import { AppleTV } from '../lib/appletv';
import { Credentials } from '../lib/credentials';
import { scan } from './scan';
import { pair } from './pair';

cli
  .version('1.0.0')
  .command('pair', 'Pair with an AppleTV')
  .action((args, options, logger) => {
    scan(logger)
      .then(device => {
        return pair(device, logger)
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
  .argument('<command>', 'The command to send', /^up|down|left|right|menu|play|pause|next|previous|suspend$/)
  .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING) 
  .action((args, options, logger) => {
    if (!options.credentials) {
      logger.error("Credentials are required. Pair first.");
      process.exit();
    }
    let credentials = Credentials.parse(options.credentials);
    scan(logger, credentials.uniqueIdentifier)
      .then(device => {
        return device
          .openConnection(credentials)
          .then(() => {
            return device
              .sendKeyCommand(AppleTV.key(args["command"]))
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
    let credentials = Credentials.parse(options.credentials);
    scan(logger, credentials.uniqueIdentifier)
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
            } else {
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
    let credentials = Credentials.parse(options.credentials);
    scan(logger, credentials.uniqueIdentifier)
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
            } else {
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
    let credentials = Credentials.parse(options.credentials);
    scan(logger, credentials.uniqueIdentifier)
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
            } else {
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