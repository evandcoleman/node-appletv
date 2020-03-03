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
const path = require("path");
const fs = require("fs");
const YAML = require("yaml");
const os = require("os");
const crypto = require("crypto");
const tweetnacl = require("tweetnacl");
const credentials_1 = require("./credentials");
class CredentialsStore {
    constructor(identifier) {
        this.identifier = identifier;
        this.isCreated = false;
        this.isLoaded = false;
        this.storeDirectory = path.join(os.homedir(), '.node-appletv');
        this.storePath = path.join(this.storeDirectory, `${identifier}.yml`);
    }
    keyPair() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.create();
            yield this.load();
            return {
                signPk: Buffer.from(this.store.signPk, 'hex'),
                signSk: Buffer.from(this.store.signSk, 'hex')
            };
        });
    }
    add(credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.create();
            yield this.load();
            this.store.clients[credentials.remoteUid.toString()] = credentials.toJSON();
            yield this.save();
        });
    }
    get(uid) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.create();
            yield this.load();
            let data = this.store.clients[uid];
            if (data) {
                return credentials_1.Credentials.fromJSON(data);
            }
            else {
                return null;
            }
        });
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isLoaded || process.env.IS_CI)
                return;
            try {
                let contents = yield fs.promises.readFile(this.storePath, 'utf8');
                this.store = YAML.parse(contents);
            }
            catch (error) {
                this.store = {
                    clients: {},
                    signPk: null,
                    signSk: null
                };
            }
            if (!this.store.signPk) {
                let seed = crypto.randomBytes(32);
                let { publicKey, secretKey } = tweetnacl.sign.keyPair();
                this.store.signPk = Buffer.from(publicKey).toString('hex');
                this.store.signSk = Buffer.from(secretKey).toString('hex');
            }
            this.isLoaded = true;
        });
    }
    save() {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.env.IS_CI)
                return;
            let contents = YAML.stringify(this.store);
            yield fs.promises.writeFile(this.storePath, contents, 'utf8');
        });
    }
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isCreated || process.env.IS_CI)
                return;
            try {
                let stats = yield fs.promises.stat(this.storeDirectory);
                if (!stats.isDirectory()) {
                    yield fs.promises.mkdir(this.storeDirectory);
                    this.isCreated = true;
                }
            }
            catch (error) {
                yield fs.promises.mkdir(this.storeDirectory);
                this.isCreated = true;
            }
        });
    }
}
exports.CredentialsStore = CredentialsStore;
