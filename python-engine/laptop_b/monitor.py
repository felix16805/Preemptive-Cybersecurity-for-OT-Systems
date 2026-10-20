"""Policy-based detection. Honest and simple by design.

A write to a forbidden register (the feed-temp disturbance) is the trip signal.
We do NOT dress this up as an ML IDS -- say "policy-based detection, IDS is out
of scope for this demo" when a judge asks.
"""
from shared import config


class Monitor:
    def __init__(self):
        self.triggered = False
        self.reason = None

    def observe_write(self, register, source_ip=config.RED_IP):
        """Call whenever a client writes a register. Returns True on detection."""
        if register in config.FORBIDDEN_WRITES:
            self.triggered = True
            self.reason = (f"forbidden write to reg {register} "
                           f"from {source_ip}")
            return True
        return False

    def reset(self):
        self.triggered = False
        self.reason = None
