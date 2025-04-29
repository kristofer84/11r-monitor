import { loadConfig } from "./configLoader";
import { SSHLogWatcher } from "./sshLogWatcher";
import { RoamingTracker } from "./roamingTracker";
import { UI } from "./ui";
import { DHCPFetcher } from "./dhcpFetcher";
import { NetworkFetcher } from "./networkFetcher";

const config = loadConfig();
const tracker = new RoamingTracker(config.clients || {});
const ui = new UI();

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

ui.start(() => tracker.getClientData());
