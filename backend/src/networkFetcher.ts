import { Client } from 'ssh2';
import { AccessPointConfig, LeaseInfo } from './types';
import { EventEmitter } from 'events';
import dns from 'dns';

export class NetworkFetcher extends EventEmitter {
  private conn: Client | null = null;
  private ready = false;
  constructor(private config: AccessPointConfig) {
    super();
  }

  fetchARPTable() {
    this.ensureConnection();

    const execute = () => {
      this.conn!.exec('cat /proc/net/arp', (err, stream) => {
        if (err) {
          console.error(`Error executing ARP command: ${err.message}`);
          return;
        }

        let arpData = '';
        stream.on('data', (data: Buffer) => {
          arpData += data.toString();
        });

        stream.on('close', async () => {
          const macToInfo = await this.parseARP(arpData);
          this.emit('arpTable', macToInfo);
        });

        stream.stderr.on('data', (data: Buffer) => {
          console.error(`STDERR: ${data}`);
        });
      });
    };

    if (this.ready) {
      execute();
    } else {
      this.conn!.once('ready', execute);
    }
  }

  private ensureConnection() {
    if (this.conn) return;
    this.conn = new Client();
    const [user, host] = this.config.ssh.split('@');
    const password = this.config.password;
    this.conn
      .on('ready', () => {
        this.ready = true;
      })
      .on('error', (err) => {
        console.error(`SSH error fetching ARP table: ${err.message}`);
        this.conn = null;
        this.ready = false;
      })
      .on('close', () => {
        this.conn = null;
        this.ready = false;
      })
      .connect({ host, username: user, password, tryKeyboard: true });

    this.conn.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
      finish([]);
    });
  }

  private async parseARP(arpData: string): Promise<{ [mac: string]: LeaseInfo }> {
    const lines = arpData.split('\n').slice(1); // Skip header line
    const result: { [mac: string]: LeaseInfo } = {};

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6) {
        const ip = parts[0];
        const mac = parts[3].toLowerCase();

        if (mac !== '00:00:00:00:00:00') {
          const hostname = await this.reverseLookup(ip);
          result[mac] = { ip };
          if (hostname) {
            result[mac].hostname = hostname;
          }
        }
      }
    }

    return result;
  }

  private reverseLookup(ip: string): Promise<string | null> {
    return new Promise((resolve) => {
      dns.reverse(ip, (err, hostnames) => {
        if (err || !hostnames.length) {
          resolve(null);
        } else {
          resolve(hostnames[0]);
        }
      });
    });
  }
}
