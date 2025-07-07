# WiFi Roaming Tracker

Real-time web-based tracker for monitoring client roaming between Access Points (APs) in an 802.11r (Fast Transition) wireless environment. The backend is built with Node.js/Express and a lightweight Vue frontend provides the UI.

---

## ✨ Features

- 🚐 **Live Monitoring** of client devices across multiple APs.
- ⚡ **802.11r Fast Transition Detection** using hostapd logs.
- 🌐 **Express API** serving live roaming data.
- 💻 **Vue Web UI** that refreshes automatically.
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

### 2. Install Backend Dependencies
```bash
cd backend
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

### 4. Start the Backend
```bash
npm start
```

### 5. Open the Frontend
Simply open `frontend/index.html` in your browser. It will fetch data from `http://localhost:3000/api/clients`.

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

