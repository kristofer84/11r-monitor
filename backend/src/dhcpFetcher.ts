import { Client } from "ssh2";
import { AccessPointConfig, LeaseInfo } from "./types";
import { EventEmitter } from "events";

export class DHCPFetcher extends EventEmitter {
  private conn: Client | null = null;
  private ready = false;

  constructor(private config: AccessPointConfig) {
    super();
  }

  fetchLeases() {
    if (!this.config.dhcpLeasePath) return;
    this.ensureConnection();

    const execute = () => {
      this.conn!.exec(`cat ${this.config.dhcpLeasePath}`, (err, stream) => {
        if (err) {
          console.error(`Error executing DHCP command: ${err.message}`);
          return;
        }

        let leaseData = "";
        stream.on("data", (data: Buffer) => {
          leaseData += data.toString();
        });

        stream.on("close", () => {
          const leases = this.parseLeases(leaseData);
          this.emit("leases", leases);
        });

        stream.stderr.on("data", (data: Buffer) => {
          console.error(`STDERR: ${data}`);
        });
      });
    };

    if (this.ready) {
      execute();
    } else {
      this.conn!.once("ready", execute);
    }
  }

  private ensureConnection() {
    if (this.conn) return;
    this.conn = new Client();
    const [user, host] = this.config.ssh.split("@");
    const password = this.config.password;
    this.conn
      .on("ready", () => {
        this.ready = true;
      })
      .on("error", (err) => {
        console.error(`SSH error fetching DHCP leases: ${err.message}`);
        this.conn = null;
        this.ready = false;
      })
      .on("close", () => {
        this.conn = null;
        this.ready = false;
      })
      .connect({ host, username: user, password, tryKeyboard: true });

    this.conn.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => {
      finish([]);
    });
  }

  private parseLeases(leaseData: string): { [mac: string]: LeaseInfo } {
    const lines = leaseData.split("\n");
    const leaseMap: { [mac: string]: LeaseInfo } = {};

    lines.forEach((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const mac = parts[1].toLowerCase();
        const ip = parts[2];
        const hostname = parts[3];
        leaseMap[mac] = { ip };
        if (hostname) {
          leaseMap[mac].hostname = hostname;
        }
      }
    });

    return leaseMap;
  }
}
