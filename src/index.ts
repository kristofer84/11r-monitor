import { loadConfig } from './configLoader';
import { SSHLogWatcher } from './sshLogWatcher';
import { RoamingTracker } from './roamingTracker';
import { UI } from './ui';
import { DHCPFetcher } from './dhcpFetcher';

const config = loadConfig();
const tracker = new RoamingTracker(config.clients || {});
const ui = new UI();

// Start log watchers
config.accessPoints.forEach(ap => {
  const watcher = new SSHLogWatcher(ap);
  watcher.on('log', (apName, line) => {
    tracker.processLog(apName, line);
  });
  watcher.start();

  // Start DHCP lease fetcher
  const fetcher = new DHCPFetcher(ap);
  fetcher.on('leases', (leases: { [mac: string]: string }) => {
    tracker.updateDHCPLeases(leases);
  });

  // Fetch leases every 60 seconds
  setInterval(() => {
    fetcher.fetchLeases();
  }, 60000);

  fetcher.fetchLeases(); // Initial fetch
});

ui.start(() => tracker.getClientData());
