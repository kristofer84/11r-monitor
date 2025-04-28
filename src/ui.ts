import blessed from "blessed";
import chalk from "chalk";

export class UI {
  private screen: blessed.Widgets.Screen;
  private table: blessed.Widgets.BoxElement;

  constructor() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: "WiFi Roaming Tracker",
    });

    this.screen.key(["q", "C-c"], () => process.exit(0));

    this.table = blessed.box({
      top: 0,
      left: 0,
      width: "100%",
      height: "100%-1",
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
      },
      keys: true,
      vi: true,
      mouse: true,
      border: {
        type: "bg",
      },
      style: {
        border: {
          fg: "#f0f0f0",
        },
      },
    });

    const footer = blessed.box({
      bottom: 0,
      left: 0,
      width: "100%",
      height: 1,
      tags: true,
      content: chalk.blue("Press Q to quit - Showing clients active in the last two hours"),
      style: {
        fg: "white",
        bg: "blue",
      },
    });

    this.screen.append(this.table);
    this.screen.append(footer);
    this.screen.render();
  }

  start(renderFn: () => any[]) {
    setInterval(() => {
      const data = renderFn();

      const widths = {
        name: 25,
        mac: 20,
        ap: 12,
        fast: 6,
        lastSeen: 10,
      };

      // Header
      let content = `{bold}${pad("Client Name", widths.name)} ${pad("MAC Address", widths.mac)} ${pad("Current AP", widths.ap)} ${pad("Fast?", widths.fast)} ${pad(
        "Last Seen",
        widths.lastSeen
      )} Roaming History{/bold}\n`;
      content += "".padEnd(widths.name + widths.mac + widths.ap + widths.fast + widths.lastSeen + 30, "-") + "\n";

      // Rows
      data.forEach((row) => {
        const fastStr = row.fast ? chalk.green("Yes") : chalk.red("No");
        const limitedHistory = row.history.slice(0, 5).reverse().join(" -> "); // CAP to 5 entries
        content += `${pad(row.name, widths.name)} ${pad(row.mac, widths.mac)} ${pad(row.currentAp, widths.ap)} ${pad(fastStr, widths.fast)} ${pad(row.lastSeen, widths.lastSeen)} ${limitedHistory}\n`;

      });

      this.table.setContent(content);
      this.screen.render();
    }, 1000);
  }
}

// Helper to pad strings to fixed width
function pad(str: string, width: number): string {
  const plainStr = str.replace(/\x1B\[[0-9;]*m/g, ""); // Remove ANSI for length calc
  const padLength = Math.max(width - plainStr.length, 0);
  return str + " ".repeat(padLength);
}
