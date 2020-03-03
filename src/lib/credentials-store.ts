import * as path from 'path';
import * as fs from 'fs';
import * as YAML from 'yaml';
import * as os from 'os';
import * as crypto from 'crypto';
import * as ed25519 from 'ed25519';

import { Credentials } from './credentials';

interface Store {
  signPk: string;
  signSk: string;
  clients: { [key: string]: { [key: string]: string; }; };
}

export interface KeyPair {
  signPk: Buffer;
  signSk: Buffer;
}

export class CredentialsStore {
  private storePath: string;
  private storeDirectory: string;
  private store: Store;

  private isCreated: boolean = false;
  private isLoaded: boolean = false;

  constructor(public identifier: string) {
    this.storeDirectory = path.join(os.homedir(), '.node-appletv');
    this.storePath = path.join(this.storeDirectory, `${identifier}.yml`);
  }

  async keyPair(): Promise<KeyPair> {
    await this.create();
    await this.load();

    return {
      signPk: Buffer.from(this.store.signPk, 'hex'),
      signSk: Buffer.from(this.store.signSk, 'hex')
    };
  }

  async add(credentials: Credentials) {
    await this.create();
    await this.load();

    this.store.clients[credentials.remoteUid.toString()] = credentials.toJSON();

    await this.save();
  }

  async get(uid: string): Promise<Credentials> {
    await this.create();
    await this.load();

    let data = this.store.clients[uid];

    if (data) {
      return Credentials.fromJSON(data);
    } else {
      return null;
    }
  }

  private async load() {
    if (this.isLoaded) return;

    try {
      let contents = await fs.promises.readFile(this.storePath, 'utf8');
      this.store = YAML.parse(contents);
    } catch (error) {
      this.store = {
        clients: {},
        signPk: null,
        signSk: null
      };
    }
    if (!this.store.signPk) {
      let seed = crypto.randomBytes(32);
      let keyPair = ed25519.MakeKeypair(seed);
      this.store.signPk = keyPair.publicKey.toString('hex');
      this.store.signSk = keyPair.privateKey.toString('hex');
    }
    this.isLoaded = true;
  }

  private async save() {
    let contents = YAML.stringify(this.store);

    await fs.promises.writeFile(this.storePath, contents, 'utf8');
  }

  private async create() {
    if (this.isCreated) return;

    try {
      let stats = await fs.promises.stat(this.storeDirectory);
      if (!stats.isDirectory()) {
        await fs.promises.mkdir(this.storeDirectory);
        this.isCreated = true;
      }
    } catch (error) {
      await fs.promises.mkdir(this.storeDirectory);
      this.isCreated = true;
    }
  }
}
