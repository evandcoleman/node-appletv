import * as caporal from 'caporal';
let cli = caporal as any;

import { AppleTV } from '../lib/appletv';
import { TVClient } from '../lib/tvclient';
import { TVServer } from '../lib/tvserver';
import { Credentials } from '../lib/credentials';
import { NowPlayingInfo } from '../lib/now-playing-info';
import { Message } from '../lib/message';
import { scan } from './scan';
import { pair } from './pair';
import { writeFile } from 'fs';
import { promisify } from 'util';

const project = require('../../package.json')

async function openDevice(credentials: Credentials, logger: any): Promise<TVClient> {
  let device = await scan(logger, null, credentials.remoteUid);
  device.on('debug', (message: string) => {
    logger.debug(message);
  });
  device.on('error', (error: Error) => {
    logger.error(error.message);
    logger.debug(error.stack);
  });
  return await device.open(credentials);
}

cli
  .version(project.version)
  .command('serve', 'Host a fake Apple TV')
  .option('--name <name>', 'The name of the Apple TV', cli.STRING) 
  .option('--port <port>', 'The port to run on', cli.INTEGER) 
  .option('--uid <uid>', 'The UUID of the advertised Apple TV', cli.STRING) 
  .action(async (args, options, logger) => {
    try {
      let server = new TVServer(options.name || 'node-appletv', options.port || 49153, options.uid);
      await server.start();
      server.on('debug', (message: string) => {
        logger.debug(message);
      });
      server.on('error', (error: Error) => {
        logger.error(error.message);
        logger.debug(error.stack);
      });
    } catch (error) {
      logger.error(error.message);
      logger.debug(error.stack);
      process.exit();
    }
  });

cli
  .version(project.version)
  .command('pair', 'Pair with an Apple TV')
  .option('--timeout <timeout>', 'The amount of time (in seconds) to scan for Apple TVs', cli.INTEGER) 
  .action(async (args, options, logger) => {
    try {
      let device = await scan(logger, options.timeout);
      device.on('debug', (message: string) => {
        logger.debug(message);
      });
      device.on('error', (error: Error) => {
        logger.error(error.message);
        logger.debug(error.stack);
      });
      let keys = await pair(device, logger);
      logger.info("Credentials: " + device.credentials.toString());
      process.exit();
    } catch (error) {
      logger.error(error.message);
      logger.debug(error.stack);
      process.exit();
    }
  });

cli
  .command('command', 'Send a command to an Apple TV')
  .argument('<command>', 'The command to send', /^up|down|left|right|menu|play|pause|next|previous|suspend|wake|home|volumeup|volumedown$/)
  .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING) 
  .action(async (args, options, logger) => {
    if (!options.credentials) {
      logger.error("Credentials are required. Pair first.");
      process.exit();
    }
    let credentials = Credentials.parse(options.credentials);
    try {
      let device = await openDevice(credentials, logger);
      await device.sendKeyCommand(AppleTV.key(args["command"]))
      logger.info("Success!");
      process.exit();
    } catch (error) {
      logger.error(error.message);
      logger.debug(error.stack);
      process.exit();
    }
  });

cli
  .command('artwork', 'Retreive the artwork for the currently playing item')
  .option('--output <path>', 'Output path for the artwork image', cli.STRING) 
  .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING) 
  .action(async (args, options, logger) => {
    if (!options.credentials) {
      logger.error("Credentials are required. Pair first.");
      process.exit();
    }
    let credentials = Credentials.parse(options.credentials);
    try {
      let device = await openDevice(credentials, logger);
      let data = await device.requestArtwork();
      if (options.output) {
        await promisify(writeFile)(options.output, data);
      } else {
        logger.info(data.toString('hex'));
      }
      process.exit();
    } catch (error) {
      logger.error(error.message);
      logger.debug(error.stack);
      process.exit();
    }
  });

cli
  .command('state', 'Logs the playback state from the Apple TV')
  .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING) 
  .action(async (args, options, logger) => {
    if (!options.credentials) {
      logger.error("Credentials are required. Pair first.");
      process.exit();
    }
    let credentials = Credentials.parse(options.credentials);
    try {
      let device = await openDevice(credentials, logger);

      device.on('nowPlaying', (info: NowPlayingInfo) => {
        logger.info(info.toString());
      });
    } catch (error) {
      logger.error(error.message);
      logger.debug(error.stack);
      process.exit();
    }
  });

cli
  .command('queue', 'Request the playback state from the Apple TV')
  .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING) 
  .option('--location <location>', 'The location in the queue', cli.INTEGER) 
  .option('--length <length>', 'The length of the queue', cli.INTEGER) 
  .option('--metadata', 'Include metadata', cli.BOOLEAN) 
  .option('--lyrics', 'Include lyrics', cli.BOOLEAN) 
  .option('--languages', 'Include language options', cli.BOOLEAN) 
  .action(async (args, options, logger) => {
    if (!options.credentials) {
      logger.error("Credentials are required. Pair first.");
      process.exit();
    }
    let credentials = Credentials.parse(options.credentials);
    try {
      let device = await openDevice(credentials, logger);
      let message = await device
        .requestPlaybackQueue({
          location: options.location || 0,
          length: options.length || 1,
          includeMetadata: options.metadata,
          includeLyrics: options.lyrics,
          includeLanguageOptions: options.languages
        });
      logger.info(message);
    } catch (error) {
      logger.error(error.message);
      logger.debug(error.stack);
      process.exit();
    }
  });

cli
  .command('messages', 'Log all messages sent from the Apple TV')
  .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING) 
  .action(async (args, options, logger) => {
    if (!options.credentials) {
      logger.error("Credentials are required. Pair first.");
      process.exit();
    }
    let credentials = Credentials.parse(options.credentials);
    try {
      let device = await openDevice(credentials, logger);
      device.on('message', (message: Message) => {
        logger.info(JSON.stringify(message.toObject(), null, 2));
      });
    } catch (error) {
      logger.error(error.message);
      logger.debug(error.stack);
      process.exit();
    }
  });

cli.parse(process.argv);