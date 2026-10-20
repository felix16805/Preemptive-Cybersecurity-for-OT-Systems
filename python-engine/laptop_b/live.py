"""LIVE integrated defender console.

Unlike `run.py` (a self-contained canned demo), this hosts the REAL plant over
Modbus/TCP, watches for the attacker's register write coming from the OTHER
laptop, and fires the SafeCut response on the dashboard automatically — no key
press. Attack laptop A -> this dashboard reacts for real.

  python -m laptop_b.live                 # port 502 (needs admin/root)
  python -m laptop_b.live --port 5020     # unprivileged, recommended for testing

Then from the attacker laptop:
  python -m laptop_a.attack --target <THIS-LAPTOP-IP> --port 5020

Keys:  S arm SafeCut defense (default)   N arm blind-quarantine (legacy)
       R reset / re-arm   Q quit
"""
import argparse
import asyncio
import socket
import threading
import time

from shared import config
from laptop_b.plant import CSTR, sis_control
from laptop_b import topology
from laptop_b.enforce import Enforcer

from pymodbus.datastore import (ModbusSequentialDataBlock, ModbusSlaveContext,
                                ModbusServerContext)
from pymodbus.server import StartAsyncTcpServer


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


SPEED_SUBSTEPS = 3        # sim steps per tick
TICK = 0.03               # wall seconds per tick  -> ~5x real-time physics
PLOT_POINTS = 600         # scrolling history window


class Live:
    def __init__(self, G, port):
        self.G = G
        self.port = port
        self.lock = threading.Lock()
        self.enforcer = Enforcer("sim")
        self.running = True

        self.store = ModbusSlaveContext(
            hr=ModbusSequentialDataBlock(0, [0] * 100))
        self.context = ModbusServerContext(slaves=self.store, single=True)

        self._reset_state()

    # ---- state ----
    def _reset_state(self):
        self.plant = CSTR()
        self.mode = getattr(self, "mode", "safecut")   # keep armed policy
        self.attacked = False
        self.responded = False
        self.attack_t = None
        self.cut_edges = []
        self.cert = None
        self.sis_alive = True
        self.t = 0.0
        self.hist_t = []
        self.hist_T = []

    def reset(self):
        """Reset AND re-arm SafeCut. SafeCut is the sticky default so you can
        never get stuck in the legacy blind-quarantine mode by accident."""
        with self.lock:
            self.store.setValues(3, config.REG_FEED, [0])   # clear malicious feed
            self.mode = "safecut"
            self._reset_state()
            self.enforcer.reset()

    def arm(self, mode):
        with self.lock:
            self.store.setValues(3, config.REG_FEED, [0])
            self.mode = mode
            self._reset_state()
            self.enforcer.reset()

    # ---- response ----
    def _on_attack(self):
        self.attacked = True
        self.attack_t = self.t
        if self.mode == "naive":
            cut, ms = topology.naive_cut(self.G), 0.0
        else:
            cut, ms, _feasible = topology.solve_cut(self.G)
        self.cut_edges = cut
        self.cert = topology.certify(self.G, cut, ms)
        self.sis_alive = self.cert["all_safe"]
        self.responded = True
        self.enforcer.reset()
        self.enforcer.block_attacker()

    # ---- physics + detection loop (background thread) ----
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
                    if self.sis_alive:
                        self.plant.Tc = sis_control(self.plant.T, config.T_TRIP)
                    self.plant.step(config.SIM_DT)
                    self.t += config.SIM_DT
                self.store.setValues(3, config.REG_TEMP, [_to_reg(self.plant.T)])
                self.store.setValues(3, config.REG_COOLANT,
                                     [_to_reg(self.plant.Tc)])
                self.hist_t.append(self.t)
                self.hist_T.append(self.plant.T)
                if len(self.hist_t) > PLOT_POINTS:
                    self.hist_t = self.hist_t[-PLOT_POINTS:]
                    self.hist_T = self.hist_T[-PLOT_POINTS:]
            time.sleep(TICK)

    # ---- modbus server (background thread, own event loop) ----
    def serve(self):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(
                StartAsyncTcpServer(context=self.context,
                                    address=("0.0.0.0", self.port)))
        except Exception as e:
            print(f"[server] stopped: {e}")

    # ---- snapshot for the GUI thread ----
    def snapshot(self):
        with self.lock:
            return dict(attacked=self.attacked, mode=self.mode,
                        cut=list(self.cut_edges), cert=self.cert,
                        ts=list(self.hist_t), Ts=list(self.hist_T),
                        sis_alive=self.sis_alive)


def gui(live):
    import matplotlib as mpl
    import matplotlib.pyplot as plt
    from matplotlib.animation import FuncAnimation
    from laptop_b.dashboard import Dashboard, SAFE_C, RED_HOT

    # Stop matplotlib's built-in single-key shortcuts (s=save, q=quit, etc.)
    # from stealing our keys.
    for k in list(mpl.rcParams):
        if k.startswith("keymap."):
            mpl.rcParams[k] = []

    ip = lan_ip()
    dash = Dashboard(live.G)

    def on_key(e):
        k = (e.key or "").lower()
        if k in ("r", " ", "space", "backspace", "enter", "return"):
            live.reset()
        elif k == "n":
            live.arm("naive")
        elif k == "s":
            live.arm("safecut")
        elif k == "q":
            live.running = False; plt.close(dash.fig)

    dash.fig.canvas.mpl_connect("key_press_event", on_key)

    def update(_):
        s = live.snapshot()
        dash.draw_key()
        attacked, mode = s["attacked"], s["mode"]
        ts, Ts = s["ts"], s["Ts"]
        naive = mode == "naive"
        breached = attacked and any(T >= config.T_RUNAWAY for T in Ts)
        comp = {config.ATTACKER_NODE} if attacked else set()

        if naive:
            badge, bcol = "MODE: BLIND\nQUARANTINE", RED_HOT
        else:
            badge, bcol = "MODE: SAFECUT", SAFE_C

        if not attacked:
            armed = "SafeCut (recommended)" if not naive else "blind quarantine (legacy)"
            head = f"DEFENSE ARMED — {armed}"
            sub = (f"Plant live at {ip}:{live.port} — waiting for the attacker.   "
                   f"Keys:  S SafeCut   N legacy   SPACE/R reset")
            tone = "idle"
        elif naive:
            if breached:
                head, sub, tone = ("REACTOR RUNAWAY — DISASTER",
                                   "Blind quarantine severed the safety loop. Press "
                                   "SPACE to reset — that re-arms SafeCut.", "bad")
            else:
                head, sub, tone = ("BLIND QUARANTINE APPLIED",
                                   "Whole zone cut — safety loop went with it. Watch "
                                   "the temperature climb.", "bad")
        else:
            head, sub, tone = ("SAFECUT CONTAINED THE ATTACK",
                               "Real intrusion detected and isolated. Safety loop "
                               "preserved, cooling engaged, reactor holding. "
                               "SPACE to run again.", "good")

        dash.draw_banner(head, sub, tone, badge=badge, badge_color=bcol)
        dash.draw_network(compromised=comp, cut_edges=s["cut"] if attacked else [],
                          isolated_attacker=attacked and not naive,
                          safety_lost=attacked and naive)
        dash.draw_process(ts, Ts, mode)
        dash.draw_cert(s["cert"] if attacked else None, mode)

    ani = FuncAnimation(dash.fig, update, interval=config.FRAME_MS,
                        cache_frame_data=False)
    dash._ani = ani
    print(f"[live] dashboard up. Plant serving on {ip}:{live.port}")
    print(f"[live] SafeCut is armed by default. Attacker command:\n"
          f"       python -m laptop_a.attack --target {ip} --port {live.port}")
    print(f"[live] keys: S=SafeCut  N=legacy blind-quarantine  SPACE/R=reset  Q=quit")
    plt.show()
    live.running = False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=config.MODBUS_PORT,
                    help="use 5020 to avoid needing admin/root")
    args = ap.parse_args()

    G = topology.build_graph()
    live = Live(G, args.port)
    threading.Thread(target=live.serve, daemon=True).start()
    threading.Thread(target=live.plant_loop, daemon=True).start()
    time.sleep(0.5)
    gui(live)


if __name__ == "__main__":
    main()
