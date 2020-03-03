"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const caporal = require("caporal");
let cli = caporal;
const appletv_1 = require("../lib/appletv");
const tvserver_1 = require("../lib/tvserver");
const credentials_1 = require("../lib/credentials");
const scan_1 = require("./scan");
const pair_1 = require("./pair");
const fs_1 = require("fs");
const util_1 = require("util");
const project = require('../../package.json');
function openDevice(credentials, logger) {
    return __awaiter(this, void 0, void 0, function* () {
        let device = yield scan_1.scan(logger, null, credentials.remoteUid);
        device.on('debug', (message) => {
            logger.debug(message);
        });
        device.on('error', (error) => {
            logger.error(error.message);
            logger.debug(error.stack);
        });
        return yield device.open(credentials);
    });
}
cli
    .version(project.version)
    .command('serve', 'Host a fake Apple TV')
    .option('--name <name>', 'The name of the Apple TV', cli.STRING)
    .option('--port <port>', 'The port to run on', cli.INTEGER)
    .option('--uid <uid>', 'The UUID of the advertised Apple TV', cli.STRING)
    .action((args, options, logger) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let server = new tvserver_1.TVServer(options.name || 'node-appletv', options.port || 49153, options.uid);
        yield server.start();
        server.on('debug', (message) => {
            logger.debug(message);
        });
        server.on('error', (error) => {
            logger.error(error.message);
            logger.debug(error.stack);
        });
    }
    catch (error) {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    }
}));
cli
    .version(project.version)
    .command('pair', 'Pair with an Apple TV')
    .option('--timeout <timeout>', 'The amount of time (in seconds) to scan for Apple TVs', cli.INTEGER)
    .action((args, options, logger) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let device = yield scan_1.scan(logger, options.timeout);
        device.on('debug', (message) => {
            logger.debug(message);
        });
        device.on('error', (error) => {
            logger.error(error.message);
            logger.debug(error.stack);
        });
        let keys = yield pair_1.pair(device, logger);
        logger.info("Credentials: " + device.credentials.toString());
        process.exit();
    }
    catch (error) {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    }
}));
cli
    .command('command', 'Send a command to an Apple TV')
    .argument('<command>', 'The command to send', /^up|down|left|right|menu|play|pause|next|previous|suspend|wake|home|volumeup|volumedown$/)
    .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING)
    .action((args, options, logger) => __awaiter(void 0, void 0, void 0, function* () {
    if (!options.credentials) {
        logger.error("Credentials are required. Pair first.");
        process.exit();
    }
    let credentials = credentials_1.Credentials.parse(options.credentials);
    try {
        let device = yield openDevice(credentials, logger);
        yield device.sendKeyCommand(appletv_1.AppleTV.key(args["command"]));
        logger.info("Success!");
        process.exit();
    }
    catch (error) {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    }
}));
cli
    .command('artwork', 'Retreive the artwork for the currently playing item')
    .option('--output <path>', 'Output path for the artwork image', cli.STRING)
    .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING)
    .action((args, options, logger) => __awaiter(void 0, void 0, void 0, function* () {
    if (!options.credentials) {
        logger.error("Credentials are required. Pair first.");
        process.exit();
    }
    let credentials = credentials_1.Credentials.parse(options.credentials);
    try {
        let device = yield openDevice(credentials, logger);
        let data = yield device.requestArtwork();
        if (options.output) {
            yield util_1.promisify(fs_1.writeFile)(options.output, data);
        }
        else {
            logger.info(data.toString('hex'));
        }
        process.exit();
    }
    catch (error) {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    }
}));
cli
    .command('state', 'Logs the playback state from the Apple TV')
    .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING)
    .action((args, options, logger) => __awaiter(void 0, void 0, void 0, function* () {
    if (!options.credentials) {
        logger.error("Credentials are required. Pair first.");
        process.exit();
    }
    let credentials = credentials_1.Credentials.parse(options.credentials);
    try {
        let device = yield openDevice(credentials, logger);
        device.on('nowPlaying', (info) => {
            logger.info(info.toString());
        });
    }
    catch (error) {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    }
}));
cli
    .command('queue', 'Request the playback state from the Apple TV')
    .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING)
    .option('--location <location>', 'The location in the queue', cli.INTEGER)
    .option('--length <length>', 'The length of the queue', cli.INTEGER)
    .option('--metadata', 'Include metadata', cli.BOOLEAN)
    .option('--lyrics', 'Include lyrics', cli.BOOLEAN)
    .option('--languages', 'Include language options', cli.BOOLEAN)
    .action((args, options, logger) => __awaiter(void 0, void 0, void 0, function* () {
    if (!options.credentials) {
        logger.error("Credentials are required. Pair first.");
        process.exit();
    }
    let credentials = credentials_1.Credentials.parse(options.credentials);
    try {
        let device = yield openDevice(credentials, logger);
        let message = yield device
            .requestPlaybackQueue({
            location: options.location || 0,
            length: options.length || 1,
            includeMetadata: options.metadata,
            includeLyrics: options.lyrics,
            includeLanguageOptions: options.languages
        });
        logger.info(message);
    }
    catch (error) {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    }
}));
cli
    .command('messages', 'Log all messages sent from the Apple TV')
    .option('--credentials <credentials>', 'The device credentials from pairing', cli.STRING)
    .action((args, options, logger) => __awaiter(void 0, void 0, void 0, function* () {
    if (!options.credentials) {
        logger.error("Credentials are required. Pair first.");
        process.exit();
    }
    let credentials = credentials_1.Credentials.parse(options.credentials);
    try {
        let device = yield openDevice(credentials, logger);
        device.on('message', (message) => {
            logger.info(JSON.stringify(message.toObject(), null, 2));
        });
    }
    catch (error) {
        logger.error(error.message);
        logger.debug(error.stack);
        process.exit();
    }
}));
cli.parse(process.argv);
