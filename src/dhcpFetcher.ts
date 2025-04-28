import { Client } from "ssh2";
import { AccessPointConfig } from "./types";
import { EventEmitter } from "events";

export class DHCPFetcher extends EventEmitter {
  constructor(private config: AccessPointConfig) {
    super();
  }

  fetchLeases() {
    if (!this.config.dhcpLeasePath) return;

    const conn = new Client();
    const [user, host] = this.config.ssh.split("@");
    const password = this.config.password;

    conn
      .on("ready", () => {
        conn.exec(`cat ${this.config.dhcpLeasePath}`, (err, stream) => {
          if (err) throw err;

          let leaseData = "";
          stream.on("data", (data: Buffer) => {
            leaseData += data.toString();
          });

          stream.on("close", () => {
            const leases = this.parseLeases(leaseData);
            this.emit("leases", leases);
            conn.end();
          });

          stream.stderr.on("data", (data: Buffer) => {
            console.error(`STDERR: ${data}`);
          });
        });
      })
      .connect({
        host,
        username: user,
        password,
        tryKeyboard: true,
      });

    conn.on("keyboard-interactive", (name, instructions, lang, prompts, finish) => {
      finish([]);
    });
  }

  private parseLeases(leaseData: string): { [mac: string]: string } {
    const lines = leaseData.split("\n");
    const leaseMap: { [mac: string]: string } = {};

    lines.forEach((line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const mac = parts[1].toLowerCase();
        const hostname = parts[3] || "Unknown";
        leaseMap[mac] = hostname;
      }
    });

    return leaseMap;
  }
}
