export interface AccessPointConfig {
  ssh: string;
  apName: string;
  password: string;
  dhcpLeasePath?: string;
}

export interface Config {
  accessPoints: AccessPointConfig[];
  clients?: { [mac: string]: string }; // Optional map of MAC to names
  hosts?: { [ip: string]: string }; // Optional map of IP to hostnames
}

export interface LeaseInfo {
  ip: string;
  hostname?: string;
}

export interface RoamingEvent {
  mac: string;
  apName: string;
  timestamp: Date;
  fastTransition: boolean;
}

export interface NodeData {
  mac: string;
  name: string;
  ip: string;
  currentAp: string;
  fast: boolean;
  history: RoamingEvent[];
  graph: string;
  lastSeen: string;
}
