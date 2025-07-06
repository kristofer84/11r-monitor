import { Client } from "ssh2";
import { AccessPointConfig } from "./types";
import { EventEmitter } from "events";

export class SSHLogWatcher extends EventEmitter {
  constructor(private config: AccessPointConfig) {
    super();
  }

  private retryTimeout?: NodeJS.Timeout;

  start() {
    const conn = new Client();
    const [user, host] = this.config.ssh.split("@");
    const password = this.config.password;

    const scheduleRetry = () => {
      if (this.retryTimeout) return;
      console.warn(
        `SSH connection to ${this.config.apName} failed. Retrying in 10s...`
      );
      this.retryTimeout = setTimeout(() => {
        this.retryTimeout = undefined;
        this.start();
      }, 10000);
    };

    conn
      .on("ready", () => {
        conn.exec(`logread -fe hostapd`, (err, stream) => {
          if (err) {
            console.error(`Error executing log command: ${err.message}`);
            scheduleRetry();
            return;
          }

          stream.on("data", (data: Buffer) => {
            const lines = data.toString().split("\n");
            lines.forEach((line) => {
              this.emit("log", this.config.apName, line);
            });
          });

          stream.stderr.on("data", (data: Buffer) => {
            console.error(`STDERR: ${data}`);
          });
        });
      })
      .on("error", (err) => {
        console.error(`SSH connection error: ${err.message}`);
        scheduleRetry();
      })
      .on("close", () => {
        scheduleRetry();
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
}
