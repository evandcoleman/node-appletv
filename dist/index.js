"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const credentials_1 = require("./lib/credentials");
exports.Credentials = credentials_1.Credentials;
const appletv_1 = require("./lib/appletv");
exports.AppleTV = appletv_1.AppleTV;
const tvclient_1 = require("./lib/tvclient");
exports.TVClient = tvclient_1.TVClient;
const browser_1 = require("./lib/browser");
exports.Browser = browser_1.Browser;
const now_playing_info_1 = require("./lib/now-playing-info");
exports.NowPlayingInfo = now_playing_info_1.NowPlayingInfo;
const message_1 = require("./lib/message");
exports.Message = message_1.Message;
const supported_command_1 = require("./lib/supported-command");
exports.SupportedCommand = supported_command_1.SupportedCommand;
/**
* A convenience function to scan for AppleTVs on the local network.
* @param uniqueIdentifier  An optional identifier for the AppleTV to scan for. The AppleTV advertises this via Bonjour.
* @param timeout  An optional timeout value (in seconds) to give up the search after.
* @returns A promise that resolves to an array of AppleTV objects. If you provide a `uniqueIdentifier` the array is guaranteed to only contain one object.
*/
function scan(uniqueIdentifier, timeout) {
    let browser = new browser_1.Browser();
    return browser.scan(uniqueIdentifier, timeout);
}
exports.scan = scan;
/**
* A convenience function to parse a credentials string into a Credentials object.
* @param text  The credentials string.
* @returns A credentials object.
*/
function parseCredentials(text) {
    return credentials_1.Credentials.parse(text);
}
exports.parseCredentials = parseCredentials;
