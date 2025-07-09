import { loadConfig, saveConfig } from "./configLoader";
import { SSHLogWatcher } from "./sshLogWatcher";
import { RoamingTracker } from "./roamingTracker";
import { DHCPFetcher } from "./dhcpFetcher";
import { NetworkFetcher } from "./networkFetcher";
import express from "express";
import cors from "cors";
import path from "path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const config = loadConfig();
const tracker = new RoamingTracker(
  config.clients || {},
  config.hosts || {},
  (hosts) => {
    config.hosts = hosts;
    saveConfig(config);
  }
);

// Start log watchers
config.accessPoints.forEach((ap) => {
  const watcher = new SSHLogWatcher(ap);
  watcher.on("log", (apName, line) => {
    tracker.processLog(apName, line);
  });
  watcher.start();

  // Start ARP lease fetcher
  const arpFetcher = new NetworkFetcher(ap);
  arpFetcher.on("arpTable", (arpData) => {
    tracker.updateARPTable(ap.apName, arpData);
  });

  // Start DHCP lease fetcher
  const dhcpFetcher = new DHCPFetcher(ap);
  dhcpFetcher.on("leases", (leaseData) => {
    tracker.updateDHCPLeases(ap.apName, leaseData);
  });

  // Fetch leases every 60 seconds
  setInterval(() => {
    dhcpFetcher.fetchLeases();
  }, 60000);

  dhcpFetcher.fetchLeases(); // Initial fetch
  arpFetcher.fetchARPTable(); // initial fetch
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, "../../frontend")));

app.get("/api/clients", (_req, res) => {
  res.json(tracker.getClientData());
});

app.post("/api/clients/:mac/name", (req, res) => {
  const mac = req.params.mac.toLowerCase();
  const { name } = req.body as { name?: string };
  if (!name) {
    res.status(400).json({ error: "Missing name" });
    return;
  }
  if (!config.clients) {
    config.clients = {};
  }
  config.clients[mac] = name;
  saveConfig(config);
  tracker.setClientName(mac, name);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
