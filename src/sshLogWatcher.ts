import { Client } from "ssh2";
import { AccessPointConfig } from "./types";
import { EventEmitter } from "events";

export class SSHLogWatcher extends EventEmitter {
  constructor(private config: AccessPointConfig) {
    super();
  }

  start() {
    const conn = new Client();
    const [user, host] = this.config.ssh.split("@");
    const password = this.config.password;

    conn
      .on("ready", () => {
        conn.exec(`logread -fe hostapd`, (err, stream) => {
          if (err) throw err;

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
