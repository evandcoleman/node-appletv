# node-appletv

> A node module for interacting with an Apple TV (4th-generation or later) over the MediaRemoteTV protocol.

[![npm version](https://badge.fury.io/js/node-appletv.svg)](https://badge.fury.io/js/node-appletv)
[![License][license-image]][license-url]

## Overview

`node-appletv` is a `node.js` implementation of the MediaRemoteTV protocol which shipped with the 4th-generation Apple TV. This is the protocol that the Apple TV remote app uses, so this should enable the creation of an Apple TV remote app for various platforms. It can also be used in a `homebridge` plugin to connect Apple TV events to HomeKit and vice versa. `node-appletv` can be used as a standalone command line application, or as a module in your own node app. Keep reading for installation and usage instructions.

## Usage

### As a standalone cli

```bash
# Install
$ npm install -g node-appletv

# Display built-in help
$ appletv --help
```

The `appletv` cli supports several commands, such as:

`pair`: Scans for Apple TVs on the local network and initiates the pairing process

`command <command>`: Execute a command on an Apple TV (play, pause, menu, etc.)

`state`: Logs state changes from an Apple TV (now playing info)

`messages`: Logs all raw messages from an Apple TV

`help <command>`: Get help for a specific command


### As a node module

```bash
$ npm install --save node-appletv
```

`node-appletv` makes heavy use of Promises. All functions, except for the observe functions, return Promises.

### Examples

#### Scan for Apple TVs and pair

```typescript
import { scan, Pairing } from 'node-appletv';

return scan()
    .then(devices => {
    	// devices is an array of AppleTV objects
    	let device = devices[0];
    	return device
    		.openConnection()
    		.then(() => {
    			let pairing = new Pairing(device);
    			return pairing.initiatePair();
    		})
    		.then(callback => {
    			// the pin is provided onscreen from the Apple TV
    			callback(pin);
    		});
    })
    .then(device => {
    	// you're paired!
    	let credentials = device.credentials.toString();
    	console.log(credentials);
    })
    .catch(error => {
    	console.log(error);
    });
```

#### Connect to a paired Apple TV

```typescript
import { scan, parseCredentials } from 'node-appletv';

// see example above for how to get the credentials string
let credentials = parseCredentials(credentialsString);

return scan(uniqueIdentifier)
    .then(devices => {
    	let device = devices[0];
    	return device
    		.openConnection(credentials);
    })
    .then(device => {
    	// you're connected!
    	return device.sendKeyCommand(AppleTV.Key.Menu);
    })
    .then(device => {
    	console.log("Sent a menu command!");
    })
    .catch(error => {
    	console.log(error);
    });
```

The `uniqueIdentifier` is advertised by each Apple TV via Bonjour. Use an app like [Bonjour Browser](http://www.tildesoft.com) to find it. The identifier is also the first value in the string value of the `Credentials` object.

## Development

`node-appletv` is written in Typescript. Edit files in the `src` directory and then run `npm link` to clean, build, and create the symlinks to use the library and cli.

## Acknowledgments

`node-appletv` would not have been possible without the work of these people:

* [Jean Regisser](https://github.com/jeanregisser) who reversed the protobuf [spec of the MediaRemoteTV protocol](https://github.com/jeanregisser/mediaremotetv-protocol)
* [Pierre Ståhl](https://github.com/postlund) who [implemented the protocol in Python](https://github.com/postlund/pyatv)
* [Khaos Tian](https://github.com/KhaosT) for [reversing the HomeKit protocol](https://github.com/KhaosT/HAP-NodeJS) which also uses SRP encryption
* [Zach Bean](https://github.com/forty2) for [implementing the HAP client spec](https://github.com/forty2/hap-client)

## Meta

You can find me on Twitter [@edc1591](https://twitter.com/edc1591)

Distributed under the MIT license. See ``LICENSE`` for more information.

[license-image]: https://img.shields.io/badge/License-MIT-blue.svg
[license-url]: LICENSE