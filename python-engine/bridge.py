"""
SafeCut Modbus-to-Console bridge  (run this on the DEFENDER laptop).

This is the "real industrial protocol" half of the merged project. It hosts a
genuine Modbus/TCP plant, so the attack from the second laptop is real protocol
traffic on the wire. When the attacker writes the protected feed-temperature
register, the bridge detects it and POSTs an `exploit` event to the Next.js
Defender Console's /api/attack-event endpoint. The polished web console then
reacts live, exactly as it does for the TypeScript attacker CLI.

  Attacker laptop  --real Modbus/TCP-->  bridge.py  --HTTP /api/attack-event-->  Next.js console

Usage (defender laptop, alongside `npm start`):

  python bridge.py --console http://localhost:3000

By default it uses the shared demo session SAFECUT-DEMO (demo mode is on by
default on the Next.js server). You can also pass --session-id / --session-token to target a
specific session shown on the console screen.

Then, on the ATTACKER laptop, run the real Modbus attack:

  python -m laptop_a.attack --target <DEFENDER-LAN-IP> --port 5020
"""
import argparse
import asyncio
import json
import socket
import threading
import time
import urllib.request
import urllib.error

from shared import config
from laptop_b.plant import CSTR, sis_control
from laptop_b import topology

from pymodbus.datastore import (ModbusSequentialDataBlock, ModbusSlaveContext,
                                ModbusServerContext)
from pymodbus.server import StartAsyncTcpServer

SPEED_SUBSTEPS = 3
TICK = 0.03

# Map this engine's attacker node onto a node the Next.js topology understands,
# so the web console highlights a real device.
CONSOLE_TARGET_NODE = "PLC_02"


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80)); ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def _to_reg(v):
    return max(0, min(65535, int(v * config.SCALE)))


def _from_reg(v):
    return v / config.SCALE


class Bridge:
    def __init__(self, console_url, session_id, session_token, modbus_port):
        self.console_url = console_url.rstrip("/")
        self.session_id = session_id
        self.session_token = session_token
        self.modbus_port = modbus_port
        self.lock = threading.Lock()
        self.store = ModbusSlaveContext(hr=ModbusSequentialDataBlock(0, [0] * 100))
        self.context = ModbusServerContext(slaves=self.store, single=True)
        self.G = topology.build_graph()
        self.running = True
        self.fired = False
        self.plant = CSTR()

    # ---- HTTP helpers (stdlib only, no extra pip deps) ----
    def _post(self, path, body):
        data = json.dumps(body).encode()
        req = urllib.request.Request(
            self.console_url + path, data=data,
            headers={"Content-Type": "application/json",
                     "User-Agent": "SafeCut-Modbus-Bridge/1.0"},
            method="POST")
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status, json.loads(r.read().decode() or "{}")

    def ensure_session(self):
        """If no session was supplied, mint one from the console (demo mode gives
        the shared SAFECUT-DEMO session)."""
        if self.session_id and self.session_token:
            return True
        try:
            status, data = self._post("/api/session", {})
            if data.get("ok"):
                self.session_id = data["sessionId"]
                self.session_token = data["sessionToken"]
                print(f"  [bridge] paired session {self.session_id}"
                      f"{' (shared demo session)' if data.get('demo') else ''}")
                return True
            print(f"  [bridge] could not create session: {data}")
        except Exception as e:
            print(f"  [bridge] console not reachable at {self.console_url}: {e}")
        return False

    def forward_exploit(self):
        body = {
            "sessionId": self.session_id,
            "sessionToken": self.session_token,
            "eventType": "exploit",
            "targetNode": CONSOLE_TARGET_NODE,
            "description": "Real Modbus/TCP write to protected feed-temp register "
                           f"(reg {config.REG_FEED}) detected by the plant bridge",
        }
        try:
            status, data = self._post("/api/attack-event", body)
            r = data.get("safecutResult")
            if r:
                print(f"  [bridge] console responded: cut {len(r['cutEdges'])} link(s) in "
                      f"{r['solveTimeMs']:.3f} ms, safety loops "
                      f"{r['safetyLoopsPreserved']}/{r['totalSafetyLoops']}, "
                      f"reactor {'STABLE' if r['reactorStable'] else 'AT RISK'}")
            else:
                print(f"  [bridge] event forwarded (HTTP {status})")
        except urllib.error.HTTPError as e:
            print(f"  [bridge] console rejected event: HTTP {e.code} {e.read().decode()[:200]}")
        except Exception as e:
            print(f"  [bridge] failed to forward to console: {e}")

    # ---- real Modbus plant loop ----
    def plant_loop(self):
        while self.running:
            with self.lock:
                feed = _from_reg(self.store.getValues(3, config.REG_FEED, 1)[0])
                if feed > 0:
                    self.plant.T0 = feed
                    if feed > 360 and not self.fired:
                        self.fired = True
                        print(f"\n  [DETECTED] real Modbus write to register "
                              f"{config.REG_FEED} = {feed:.0f}K  ->  forwarding to console\n")
                        threading.Thread(target=self.forward_exploit, daemon=True).start()
                for _ in range(SPEED_SUBSTEPS):
                    self.plant.Tc = sis_control(self.plant.T, config.T_TRIP)
                    self.plant.step(config.SIM_DT)
                self.store.setValues(3, config.REG_TEMP, [_to_reg(self.plant.T)])
                self.store.setValues(3, config.REG_COOLANT, [_to_reg(self.plant.Tc)])
            time.sleep(TICK)

    def serve_modbus(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(
                StartAsyncTcpServer(context=self.context,
                                    address=("0.0.0.0", self.modbus_port)))
        except Exception as e:
            print(f"[bridge] modbus server stopped: {e}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--console", default="http://localhost:3000",
                    help="Base URL of the Next.js Defender Console (normally http://localhost:3000)")
    ap.add_argument("--modbus-port", type=int, default=5020)
    ap.add_argument("--session-id", default="")
    ap.add_argument("--session-token", default="")
    args = ap.parse_args()

    b = Bridge(args.console, args.session_id.upper(), args.session_token, args.modbus_port)

    print("=" * 66)
    print("  SafeCut Modbus bridge")
    print("=" * 66)
    print(f"  Console URL : {b.console_url}")
    if not b.ensure_session():
        print("\n  Could not pair with the console. Is `npm start` running, and")
        print("  (for the shared demo session) SAFECUT_DEMO_MODE=1 set on it?")
        print("  You can also pass --session-id / --session-token from the console screen.\n")
        return

    threading.Thread(target=b.serve_modbus, daemon=True).start()
    threading.Thread(target=b.plant_loop, daemon=True).start()
    time.sleep(0.6)

    ip = lan_ip()
    print(f"  Plant live on real Modbus/TCP  {ip}:{args.modbus_port}")
    print(f"  Session       {b.session_id}")
    print()
    print("  On the ATTACKER laptop run:")
    print(f"    python -m laptop_a.attack --target {ip} --port {args.modbus_port}")
    print()
    print("  Waiting for the attacker...  (Ctrl+C to stop)")
    print("=" * 66, flush=True)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        b.running = False
        print("\nstopped.")


if __name__ == "__main__":
    main()
