"""Enforcement layer.

Two modes:
  real -> applies a live nftables ruleset dropping the attacker's IP (Linux+root).
          Pair with `tshark -i <iface>` in a panel to show writes stop on the wire.
  sim  -> sets an in-process flag the SIS loop honours. Bulletproof on any OS;
          use this for the stage demo so nothing depends on venue permissions.

The poster states which parts are real. That honesty is a feature, not a hedge.
"""
import shutil
import subprocess

from shared import config

TABLE = "safecut"


def real_available():
    return shutil.which("nft") is not None


def enforce_real(attacker_ip=config.RED_IP):
    ruleset = f"""
table inet {TABLE} {{
  chain input {{
    type filter hook input priority 0; policy accept;
    ip saddr {attacker_ip} tcp dport {config.MODBUS_PORT} drop;
  }}
}}
"""
    subprocess.run(["nft", "flush", "table", "inet", TABLE],
                   capture_output=True, text=True)
    r = subprocess.run(["nft", "-f", "-"], input=ruleset,
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"nft failed: {r.stderr.strip()}")
    return ruleset.strip()


def clear_real():
    subprocess.run(["nft", "delete", "table", "inet", TABLE],
                   capture_output=True, text=True)


class Enforcer:
    """Unified handle the orchestrator uses regardless of mode."""

    def __init__(self, mode="sim"):
        self.mode = mode if (mode == "sim" or real_available()) else "sim"
        self.attacker_blocked = False   # the flag sim mode exposes

    def block_attacker(self):
        self.attacker_blocked = True
        if self.mode == "real":
            return enforce_real()
        return f"[sim] dropping {config.RED_IP} -> Modbus writes"

    def reset(self):
        self.attacker_blocked = False
        if self.mode == "real":
            clear_real()
