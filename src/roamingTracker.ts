import fs from "fs";
import path from "path";
import { NodeData, RoamingEvent } from "./types";

interface ClientHistory {
  events: RoamingEvent[];
  pendingFT: boolean;
}

export class RoamingTracker {
  private clients: Map<string, ClientHistory> = new Map();
  private historyFile = path.resolve("roaming-history.json");
  private macToName: { [mac: string]: string };
  private dhcpLeases: { [apName: string]: { [mac: string]: { hostname: string; ip: string } } } = {};
  private arpTable: { [apName: string]: { [mac: string]: { hostname: string; ip: string } } } = {};

  constructor(macToName: { [mac: string]: string }) {
    this.macToName = macToName;
    this.loadHistory();
  }

  updateDHCPLeases(apName: string, leases: { [mac: string]: { hostname: string; ip: string } }) {
    this.dhcpLeases[apName] = leases;
  }

  updateARPTable(apName: string, arp: { [mac: string]: { hostname: string; ip: string } }) {
    this.arpTable[apName] = arp;
  }

  getClientData() {
    const now = Date.now();
    const THIRTY_MINUTES = 30 * 60 * 1000;
    const TWO_HOURS = 120 * 50 * 1000;
    const data: NodeData[] = [];

    this.clients.forEach((history, mac) => {
      // Get all events (loaded + live), filter by two hours
      // const recentEvents = history.events.filter((e) => now - new Date(e.timestamp).getTime() <= TWO_HOURS);
      const recentEvents = history.events;
      if (recentEvents.length > 0) {
        const current = recentEvents[0];
        const aps = recentEvents.map((e) => e.apName);
        const graph = aps.slice(0, 5).reverse().join(" -> ");

        const name =
          this.macToName[mac] ||
          this.dhcpLeases[current.apName]?.[mac]?.hostname ||
          this.arpTable[current.apName]?.[mac]?.hostname ||
          this.findInAll(this.dhcpLeases, mac, "hostname") ||
          this.findInAll(this.arpTable, mac, "hostname") ||
          this.findInAll(this.arpTable, mac, "ip") || // fallback to IP
          "Unknown";

        const ip =
          this.dhcpLeases[current.apName]?.[mac]?.ip || this.arpTable[current.apName]?.[mac]?.ip || this.findInAll(this.dhcpLeases, mac, "ip") || this.findInAll(this.arpTable, mac, "ip") || "Unknown";

        const lastSeen = this.formatLastSeen(current.timestamp);

        data.push({
          mac,
          name,
          ip,
          currentAp: current.apName,
          fast: current.fastTransition,
          history: aps.slice(0, 5).reverse(),
          graph,
          lastSeen,
        });
      }
    });

    return data;
  }

  private findInAll(source: { [apName: string]: { [mac: string]: any } }, mac: string, field: string): string | null {
    for (const apName of Object.keys(source)) {
      if (source[apName]?.[mac]?.[field]) {
        return source[apName][mac][field];
      }
    }
    return null;
  }

  private formatLastSeen(timestamp: Date): string {
    const now = Date.now();
    const diffMs = now - timestamp.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  }

  processLog(apName: string, logLine: string) {
    const now = new Date();

    // FT Detection
    const ftRegex = /FT authentication already completed - do not start 4-way handshake.*([\da-f:]{17})?/i;
    const ftMatch = logLine.match(ftRegex);
    if (ftMatch) {
      const mac = ftMatch[1]?.toLowerCase();
      if (mac) {
        if (!this.clients.has(mac)) {
          this.clients.set(mac, { events: [], pendingFT: false });
        }
        this.clients.get(mac)!.pendingFT = true;
      }
    }

    // Association Detection
    const assocRegex = /AP-STA-CONNECTED ([\da-f:]{17})/i;
    const ieeeAssocRegex = /IEEE 802\\.11: associated.*([\da-f:]{17})/i;
    const assocMatch = logLine.match(assocRegex) || logLine.match(ieeeAssocRegex);

    if (assocMatch) {
      const mac = assocMatch[1].toLowerCase();

      if (!this.clients.has(mac)) {
        this.clients.set(mac, { events: [], pendingFT: false });
      }

      const history = this.clients.get(mac)!;
      const fastTransition = history.pendingFT;
      history.pendingFT = false; // Reset after using

      const event: RoamingEvent = { mac, apName, timestamp: now, fastTransition };

      history.events.unshift(event);
      if (history.events.length > 5) {
        history.events = history.events.slice(0, 5);
      }

      this.saveEvent(event);
    }
  }

  private saveEvent(event: RoamingEvent) {
    const history = this.loadHistoryFile();
    history.push({ ...event, timestamp: event.timestamp });
    fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
  }

  private loadHistory() {
    const history = this.loadHistoryFile();
    history.forEach((event) => {
      event.timestamp = new Date(event.timestamp);

      if (!this.clients.has(event.mac)) {
        this.clients.set(event.mac, { events: [], pendingFT: false });
      }

      this.clients.get(event.mac)!.events.push(event);
    });

    // Ensure ordering
    this.clients.forEach((clientHistory) => {
      clientHistory.events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });
  }

  private loadHistoryFile(): RoamingEvent[] {
    if (!fs.existsSync(this.historyFile)) return [];
    return JSON.parse(fs.readFileSync(this.historyFile, "utf-8")) as RoamingEvent[];
  }
}
