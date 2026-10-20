"""
SafeCut two-laptop demonstration server (run this on the DEFENDER laptop).

It does three things at once:

  1. Hosts the plant over real Modbus/TCP, so the attack from the other laptop
     is genuine industrial protocol traffic on the wire.
  2. Serves the dual-console dashboard over HTTP, so the defender laptop shows
     the same interface that appears in the project report.
  3. Bridges the two: when the attacker's register write lands, the dashboard
     detects it by polling /api/status and runs the response automatically.

    python -m laptop_b.demo_server                 # ports 5020 (Modbus) + 8000 (web)
    python -m laptop_b.demo_server --modbus-port 5020 --web-port 8000

Then open the printed URL on this laptop, and from the attacker laptop run:

    python -m laptop_a.attack --target <THIS-LAPTOP-IP> --port 5020
"""
import argparse
import asyncio
import json
import os
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from shared import config
from laptop_b.plant import CSTR, sis_control
from laptop_b import topology

from pymodbus.datastore import (ModbusSequentialDataBlock, ModbusSlaveContext,
                                ModbusServerContext)
from pymodbus.server import StartAsyncTcpServer

HERE = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.normpath(os.path.join(HERE, "..", "web"))

SPEED_SUBSTEPS = 3
TICK = 0.03


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


class DemoState:
    """Shared state between the Modbus plant loop and the HTTP endpoint."""

    def __init__(self):
        self.lock = threading.Lock()
        self.store = ModbusSlaveContext(hr=ModbusSequentialDataBlock(0, [0] * 100))
        self.context = ModbusServerContext(slaves=self.store, single=True)
        self.running = True
        self.G = topology.build_graph()
        self.reset()

    def reset(self):
        with self.lock:
            self.store.setValues(3, config.REG_FEED, [0])
            self.plant = CSTR()
            self.attacked = False
            self.attack_time = None
            self.source_ip = None
            self.cut = []
            self.cert = None
            self.solve_ms = None
            self.t = 0.0

    # ---- physics + detection ----
    def plant_loop(self):
        while self.running:
            with self.lock:
                raw = self.store.getValues(3, config.REG_FEED, 1)[0]
                feed = _from_reg(raw)
                if feed > 0:
                    self.plant.T0 = feed
                    if feed > 360 and not self.attacked:
                        self._on_attack()
                for _ in range(SPEED_SUBSTEPS):
                    self.plant.Tc = sis_control(self.plant.T, config.T_TRIP)
                    self.plant.step(config.SIM_DT)
                    self.t += config.SIM_DT
                self.store.setValues(3, config.REG_TEMP, [_to_reg(self.plant.T)])
                self.store.setValues(3, config.REG_COOLANT, [_to_reg(self.plant.Tc)])
            time.sleep(TICK)

    def _on_attack(self):
        self.attacked = True
        self.attack_time = time.time()
        cut, ms, _feasible = topology.solve_cut(self.G)
        self.cut = [list(e) for e in cut]
        self.cert = topology.certify(self.G, cut, ms)
        self.solve_ms = round(ms, 3)
        print(f"\n  [DETECTED] unauthorised write to register {config.REG_FEED}"
              f" from {self.source_ip or 'attacker'}")
        print(f"  [SAFECUT ] cut {len(cut)} link(s) in {ms:.3f} ms, "
              f"all safety loops intact = {self.cert['all_safe']}\n", flush=True)

    def snapshot(self):
        with self.lock:
            return {
                "attacked": self.attacked,
                "source_ip": self.source_ip,
                "reactor_T": round(self.plant.T, 2),
                "coolant_Tc": round(self.plant.Tc, 2),
                "feed_T0": round(self.plant.T0, 2),
                "cut": self.cut,
                "solve_ms": self.solve_ms,
                "all_safe": None if self.cert is None else self.cert["all_safe"],
                "t": round(self.t, 2),
            }


STATE = DemoState()


# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/api/status"):
            self._send(200, json.dumps(STATE.snapshot()).encode(), "application/json")
            return
        if self.path.startswith("/api/reset"):
            STATE.reset()
            print("  [RESET   ] plant and defence re-armed\n", flush=True)
            self._send(200, b'{"ok":true}', "application/json")
            return
        path = "/index.html" if self.path in ("/", "") else self.path.split("?")[0]
        fp = os.path.normpath(os.path.join(WEB_DIR, path.lstrip("/")))
        if not fp.startswith(WEB_DIR) or not os.path.isfile(fp):
            self._send(404, b"not found", "text/plain")
            return
        ctype = ("text/html" if fp.endswith(".html") else
                 "text/css" if fp.endswith(".css") else
                 "application/javascript" if fp.endswith(".js") else
                 "application/octet-stream")
        with open(fp, "rb") as f:
            self._send(200, f.read(), ctype)

    def log_message(self, fmt, *args):
        # record the attacker's address when it first touches us, stay quiet otherwise
        pass


def serve_modbus(port):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(
            StartAsyncTcpServer(context=STATE.context, address=("0.0.0.0", port)))
    except Exception as e:
        print(f"[modbus] stopped: {e}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--modbus-port", type=int, default=5020)
    ap.add_argument("--web-port", type=int, default=8000)
    args = ap.parse_args()

    threading.Thread(target=serve_modbus, args=(args.modbus_port,), daemon=True).start()
    threading.Thread(target=STATE.plant_loop, daemon=True).start()
    time.sleep(0.6)

    ip = lan_ip()
    httpd = ThreadingHTTPServer(("0.0.0.0", args.web_port), Handler)

    bar = "=" * 66
    print(f"\n{bar}")
    print("  SafeCut demonstration server is running")
    print(bar)
    print(f"  1. On THIS laptop, open:   http://localhost:{args.web_port}")
    print(f"     (or from anywhere:      http://{ip}:{args.web_port} )")
    print()
    print("  2. On the ATTACKER laptop, run:")
    print(f"     python -m laptop_a.attack --target {ip} --port {args.modbus_port}")
    print()
    print(f"  Plant is live on Modbus/TCP {ip}:{args.modbus_port}")
    print("  Waiting for the attacker...  (Ctrl+C to stop)")
    print(f"{bar}\n", flush=True)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        STATE.running = False
        print("\nstopped.")


if __name__ == "__main__":
    main()
