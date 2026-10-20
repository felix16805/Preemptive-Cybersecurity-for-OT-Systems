# SafeCut Attacker CLI

Simulated adversary terminal for the SafeCut live demo. It sends controlled,
session-paired attack events to the Defender Console over the local network
(same Wi-Fi or phone hotspot). Nothing here performs real scanning or
exploitation.

## Run

Windows: double-click `START_ATTACKER.bat` in the project root.

Or manually:

```
cd attacker-cli
npm install
npm run dev                 # asks for the defender IP
npm run dev -- 192.168.43.12  # or pass it directly
```

The defender console shows the IP to type under **Attacker Connection**.
Once it connects, the IP is saved to `attacker-cli/.env`.

## Commands

| Command | What it does |
|---|---|
| `exploit` | Compromise the target; the defender runs SafeCut |
| `demo` | Full kill chain: recon, scan, lateral, exploit |
| `recon`, `scan`, `lateral`, `impact` | Individual stages |
| `target <node>` | Change target (PLC_01 ... SAFETY_CTRL) |
| `connect [ip]` | Reconnect, optionally to a new IP |
| `doctor` | Diagnose connection problems |
| `join` | Use a custom session ID + token (only if demo mode is off) |
| `status`, `events`, `clear`, `help`, `exit` | |

## Connection errors

The CLI reports which case you hit:

- **Defender not reachable**: wrong IP, different networks, Windows Firewall
  (run `ALLOW_FIREWALL.bat` on the defender), or phone client isolation (use
  the Windows Mobile Hotspot option in `DEMO_STEPS.txt`).
- **Nothing running on that address**: start the defender server.
- **Session rejected**: the defender is on an old build or has
  `SAFECUT_DEMO_MODE=0`. Restart it with `START_DEFENDER.bat`.
