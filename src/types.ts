export interface AccessPointConfig {
  ssh: string;
  apName: string;
  password: string;
  dhcpLeasePath?: string;
}

export interface Config {
  accessPoints: AccessPointConfig[];
  clients?: { [mac: string]: string }; // Optional map of MAC to names
}

export interface RoamingEvent {
  mac: string;
  apName: string;
  timestamp: Date;
  fastTransition: boolean;
}
