import fs from "fs";
import path from "path";
import { NodeData, RoamingEvent, LeaseInfo } from "./types";

interface ClientHistory {
  events: RoamingEvent[];
  pendingFT: boolean;
}

export class RoamingTracker {
  private clients: Map<string, ClientHistory> = new Map();
  private historyFile = path.resolve("roaming-history.json");
  private history: RoamingEvent[] = [];
  private macToName: { [mac: string]: string };
  private dhcpLeases: { [apName: string]: { [mac: string]: LeaseInfo } } = {};
  private arpTable: { [apName: string]: { [mac: string]: LeaseInfo } } = {};
  private hostMap: { [ip: string]: string };
  private saveHosts: (hosts: { [ip: string]: string }) => void;

  constructor(
    macToName: { [mac: string]: string },
    hosts: { [ip: string]: string },
    saveHosts: (hosts: { [ip: string]: string }) => void
  ) {
    this.macToName = macToName;
    this.hostMap = hosts;
    this.saveHosts = saveHosts;
    this.loadHistory();
  }

  updateDHCPLeases(apName: string, leases: { [mac: string]: LeaseInfo }) {
    if (!this.dhcpLeases[apName]) {
      this.dhcpLeases[apName] = {};
    }
    Object.keys(leases).forEach((mac) => {
      const current = this.dhcpLeases[apName][mac];
      const incoming = leases[mac];
      this.dhcpLeases[apName][mac] = {
        ip: incoming.ip,
        hostname: incoming.hostname || current?.hostname,
      };
      if (incoming.hostname) {
        this.updateHostMap(incoming.ip, incoming.hostname);
      }
    });
  }

  updateARPTable(apName: string, arp: { [mac: string]: LeaseInfo }) {
    if (!this.arpTable[apName]) {
      this.arpTable[apName] = {};
    }
    Object.keys(arp).forEach((mac) => {
      const current = this.arpTable[apName][mac];
      const incoming = arp[mac];
      this.arpTable[apName][mac] = {
        ip: incoming.ip,
        hostname: incoming.hostname || current?.hostname,
      };
      if (incoming.hostname) {
        this.updateHostMap(incoming.ip, incoming.hostname);
      }
    });
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
        const aps = recentEvents;
        const graph = aps.slice(0, 5).reverse().join(" -> ");

        const ip =
          this.dhcpLeases[current.apName]?.[mac]?.ip ||
          this.arpTable[current.apName]?.[mac]?.ip ||
          this.findInAll(this.dhcpLeases, mac, "ip") ||
          this.findInAll(this.arpTable, mac, "ip") ||
          "Unknown";

        const name =
          this.macToName[mac] ||
          this.dhcpLeases[current.apName]?.[mac]?.hostname ||
          this.arpTable[current.apName]?.[mac]?.hostname ||
          (ip !== "Unknown" ? this.hostMap[ip] : undefined) ||
          this.findInAll(this.dhcpLeases, mac, "hostname") ||
          this.findInAll(this.arpTable, mac, "hostname") ||
          this.findInAll(this.arpTable, mac, "ip") || // fallback to IP
          "Unknown";

        data.push({
          mac,
          name,
          ip,
          currentAp: current.apName,
          fast: current.fastTransition,
          history: aps.slice(0, 5).reverse(),
          graph,
          lastSeen: current.timestamp.toISOString(),
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

  processLog(apName: string, logLine: string) {
    const now = new Date();

    // FT Detection
    const ftMessageRegex = /FT authentication already completed - do not start 4-way handshake/i;
    const macRegex = /([\da-f]{2}(?::[\da-f]{2}){5})/i;
    if (ftMessageRegex.test(logLine)) {
      const macMatch = logLine.match(macRegex);
      if (macMatch) {
        const mac = macMatch[1].toLowerCase();
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
    this.history.push({ ...event, timestamp: event.timestamp });
    fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
  }

  private loadHistory() {
    this.history = this.loadHistoryFile();
    this.history.forEach((event) => {
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

  private updateHostMap(ip: string, hostname: string) {
    if (!ip || !hostname) return;
    if (this.hostMap[ip] !== hostname) {
      this.hostMap[ip] = hostname;
      this.saveHosts(this.hostMap);
    }
  }
}
