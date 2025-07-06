import { Client } from 'ssh2';
import { AccessPointConfig } from './types';
import { EventEmitter } from 'events';
import dns from 'dns';

export class NetworkFetcher extends EventEmitter {
  constructor(private config: AccessPointConfig) {
    super();
  }

  fetchARPTable() {
    const conn = new Client();
    const [user, host] = this.config.ssh.split('@');
    const password = this.config.password;

    conn.on('ready', () => {
      conn.exec('cat /proc/net/arp', (err, stream) => {
        if (err) throw err;

        let arpData = '';
        stream.on('data', (data: Buffer) => {
          arpData += data.toString();
        });

        stream.on('close', async () => {
          const macToInfo = await this.parseARP(arpData);
          this.emit('arpTable', macToInfo);
          conn.end();
        });

        stream.stderr.on('data', (data: Buffer) => {  
          console.error(`STDERR: ${data}`);
        });
      });
    })
    .on('error', (err) => {
      console.error(`SSH error fetching ARP table: ${err.message}`);
    })
    .connect({
      host,
      username: user,
      password,
      tryKeyboard: true
    });

    conn.on('keyboard-interactive', (name, instructions, lang, prompts, finish) => {
      finish([]);
    });
  }

  private async parseARP(arpData: string): Promise<{ [mac: string]: { ip: string, hostname: string } }> {
    const lines = arpData.split('\n').slice(1); // Skip header line
    const result: { [mac: string]: { ip: string, hostname: string } } = {};

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6) {
        const ip = parts[0];
        const mac = parts[3].toLowerCase();

        if (mac !== '00:00:00:00:00:00') {
          const hostname = await this.reverseLookup(ip);
          result[mac] = {
            ip,
            hostname: hostname || ip // fallback to IP if no hostname
          };
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
