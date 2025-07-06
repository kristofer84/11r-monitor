# WiFi Roaming Tracker

Real-time terminal-based tracker for monitoring client roaming between Access Points (APs) in an 802.11r (Fast Transition) wireless environment. Built with Node.js, TypeScript, and a rich terminal UI using **blessed**.

---

## ✨ Features

- 🚐 **Live Monitoring** of client devices across multiple APs.
- ⚡ **802.11r Fast Transition Detection** using hostapd logs.
- 💥 **Interactive Terminal UI** with scrollable views and dynamic updates.
- 🕒 Tracks clients active within the **last 30 minutes**.
- 📜 **Persistent Roaming History** saved to `roaming-history.json`.
- 🧠 **DHCP Integration**: Lookup client names dynamically from DHCP lease files.
- 📊 Visual **Roaming History Graph** (capped at last 5 APs).
- 🛠️ Customizable through `config.json`.

---

## 🚀 Quick Start

### 1. Clone the Repo
```bash
git clone https://github.com/kristofer84/11r-monitor.git
cd 11r-monitor
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure APs and Clients
Edit `config.json`:
```json
{
  "accessPoints": [
    {
      "ssh": "user@192.168.1.2",
      "logPath": "/var/log/hostapd.log",
      "apName": "AP1",
      "dhcpLeasePath": "/var/lib/misc/dnsmasq.leases"
    }
  ],
  "clients": {
    "cc:aa:bb:ff:ff:aa": "Laptop",
    "aa:bb:cc:dd:ee:ff": "Phone"
  }
}
```

- `ssh`: SSH access for tailing logs.
- `logPath`: Path to hostapd log file.
- `dhcpLeasePath`: (optional) Path to DHCP leases for client name resolution.
- `clients`: Optional static MAC-to-name mappings.

### 4. Run the App
```bash
npx tsx src/index.ts
```

---

## 🔑 Controls

- **Q**: Quit the application.
- **Arrow Keys / Mouse**: Scroll through the client list if overflow occurs.

---

## 📂 File Structure
```
wifi-roaming-tracker/
🔁
├── config.json              # AP and Client Configuration
├── roaming-history.json     # Auto-saved roaming history (JSON DB)
├── src/
│   ├── index.ts             # Main app entry
│   ├── configLoader.ts      # Loads configuration
│   ├── sshLogWatcher.ts     # SSH log streaming
│   ├── roamingTracker.ts    # Core roaming logic + FT detection
│   ├── dhcpFetcher.ts       # Fetch DHCP leases for client names
│   ├── ui.ts                # Blessed-based interactive UI
│   └── types.ts             # TypeScript interfaces
```

---

## 🧰 Dependencies
- [ssh2](https://www.npmjs.com/package/ssh2) – SSH log streaming.
- [blessed](https://www.npmjs.com/package/blessed) – Terminal UI framework.
- [chalk](https://www.npmjs.com/package/chalk) – Terminal string styling.
- [TypeScript](https://www.typescriptlang.org/) – Strong typing for Node.js.

---

## 📊 Sample UI Screenshot

```
Client Name              MAC Address         Current AP   Fast?  Last Seen  Roaming History (last 5)
-----------------------------------------------------------------------------------------------
Laptop                   cc:aa:bb:ff:ff:aa   AP1          Yes    12:24:43   AP2 -> AP3 -> AP1
Phone                    aa:bb:cc:dd:ee:ff   AP2          No     12:25:10   AP1 -> AP2
```

---

## 🔍 Fast Transition (802.11r) Detection
- **FT events** are detected via the log message:
  ```
  FT authentication already completed - do not start 4-way handshake
  ```
- The tracker extracts the client's MAC address from anywhere in the line.
- If this message appears **before a client reassociation**, it is marked as a **Fast Transition**.

---

## 📜 License
MIT License © 2025 Kristofer Nilsson

