"""SafeCut orchestrator. Runs the two scenarios back-to-back with an IDENTICAL
disturbance so the ONLY variable is the cut.

  python -m laptop_b.run                 # stage demo, sim enforcement (bulletproof)
  python -m laptop_b.run --headless      # no GUI, prints result table (for CI)
  python -m laptop_b.run --enforce real  # nftables (Linux + root, two-laptop)

Controls in GUI mode:  N = naive run   S = safecut run   R = reset   Q = quit
"""
import argparse
import sys

from shared import config
from laptop_b.plant import CSTR, sis_control
from laptop_b import topology
from laptop_b.monitor import Monitor
from laptop_b.enforce import Enforcer


def simulate(scenario, enforcer, G):
    """Run one scenario to completion. Returns a trace dict.

    scenario: 'naive' or 'safecut'.
    Attack fires at step 200 in BOTH runs (identical disturbance).
    """
    plant = CSTR()
    mon = Monitor()
    ts, Ts = [], []
    attack_step = 200
    cert = None
    compromised = set()
    cut_edges = []
    sis_alive = True          # sim-enforcement flag: is the SIS path intact?
    breached = False

    for i in range(config.STEPS_PER_RUN):
        t = i * config.SIM_DT

        # --- attacker writes the feed-temp register ---
        if i == attack_step:
            plant.T0 = config.T_FEED_ATTACK
            detected = mon.observe_write(config.REG_FEED)
            compromised = {config.ATTACKER_NODE}
            if detected:
                if scenario == "naive":
                    cut_edges = topology.naive_cut(G)
                    cert = topology.certify(G, cut_edges, 0.0)
                    # naive cut severs the SIS loop -> cooling frozen
                    sis_alive = cert["all_safe"]
                else:
                    cut_edges, ms, feasible = topology.solve_cut(G)
                    cert = topology.certify(G, cut_edges, ms)
                    sis_alive = cert["all_safe"] and feasible
                enforcer.block_attacker()
                compromised = {config.ATTACKER_NODE}

        # --- control: SIS only acts if its loop survived ---
        if sis_alive:
            plant.Tc = sis_control(plant.T, config.T_TRIP)
        # else: Tc frozen at last value -> no emergency cooling

        plant.step(config.SIM_DT)
        if plant.T >= config.T_RUNAWAY:
            breached = True

        ts.append(t); Ts.append(plant.T)

    return {"scenario": scenario, "ts": ts, "Ts": Ts, "cert": cert,
            "cut_edges": cut_edges, "compromised": compromised,
            "breached": breached, "final_T": Ts[-1]}


def headless(enforcer, G):
    rows = []
    for sc in ("naive", "safecut"):
        r = simulate(sc, enforcer, G); enforcer.reset()
        rows.append(r)
        print(f"\n=== {sc.upper()} ===")
        print(f"  final temperature : {r['final_T']:.1f} K")
        print(f"  runaway breached  : {r['breached']}")
        if r["cert"]:
            print(f"  cut size          : {r['cert']['cut_size']}")
            print(f"  solve time        : {r['cert']['solve_ms']} ms")
            print(f"  all loops safe    : {r['cert']['all_safe']}")
    print("\nRESULT:",
          "PASS" if (rows[0]["breached"] and not rows[1]["breached"])
          else "CHECK -- contrast not clean")
    return rows


def gui(enforcer, G):
    import matplotlib.pyplot as plt
    from matplotlib.animation import FuncAnimation
    from laptop_b.dashboard import Dashboard

    dash = Dashboard(G)
    state = {"scenario": None, "trace": None, "frame": 0}

    def load(scenario):
        state["scenario"] = scenario
        state["trace"] = simulate(scenario, enforcer, G)
        enforcer.reset()
        state["frame"] = 0

    def on_key(event):
        if event.key in ("n", "N"): load("naive")
        elif event.key in ("s", "S"): load("safecut")
        elif event.key in ("r", "R"):
            state["scenario"] = None; state["trace"] = None; state["frame"] = 0
        elif event.key in ("q", "Q"): plt.close(dash.fig)

    dash.fig.canvas.mpl_connect("key_press_event", on_key)

    ATTACK_FRAME = 200

    def update(_):
        tr = state["trace"]
        dash.draw_key()

        if tr is None:
            dash.draw_banner("MONITORING",
                             "Industrial network stable. Press N (blind quarantine) "
                             "or S (SafeCut) to launch the same attack.", "idle")
            dash.draw_network()
            dash.draw_process([], [], "idle")
            dash.draw_cert(None, None)
            return

        f = min(state["frame"], len(tr["ts"]))
        attacked = f >= ATTACK_FRAME
        cur_T = tr["Ts"][:f][-1] if f else tr["Ts"][0]
        breached_now = attacked and any(
            T >= config.T_RUNAWAY for T in tr["Ts"][:f])
        naive = tr["scenario"] == "naive"
        safety_lost = attacked and naive
        comp = {config.ATTACKER_NODE} if attacked else set()
        cut = tr["cut_edges"] if attacked else []
        isolated = attacked and not naive

        # banner narrative
        if not attacked:
            head, sub, tone = ("INTRUSION IN PROGRESS",
                               "Malware reached the Engineering Workstation and is "
                               "pushing the reactor toward runaway…", "alert")
        elif naive:
            if breached_now:
                head, sub, tone = ("REACTOR RUNAWAY — DISASTER",
                                   "Blind quarantine severed the safety loop. Cooling "
                                   "is offline and temperature is out of control.", "bad")
            else:
                head, sub, tone = ("BLIND QUARANTINE APPLIED",
                                   "Whole compromised zone cut off — but the safety "
                                   "loop went with it. Watch the temperature.", "bad")
        else:
            head, sub, tone = ("SAFECUT CONTAINED THE ATTACK",
                               "Intruder sealed off. Safety loop preserved, emergency "
                               "cooling engaged, reactor back under control.", "good")

        dash.draw_banner(head, sub, tone)
        dash.draw_network(compromised=comp, cut_edges=cut,
                          isolated_attacker=isolated, safety_lost=safety_lost)
        dash.draw_process(tr["ts"][:f], tr["Ts"][:f], tr["scenario"])
        dash.draw_cert(tr["cert"] if attacked else None, tr["scenario"])
        state["frame"] = f + 8   # accelerate sim clock (~ run in <1 min)

    ani = FuncAnimation(dash.fig, update, interval=config.FRAME_MS,
                        cache_frame_data=False)
    dash._ani = ani
    plt.show()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--enforce", choices=["sim", "real"], default="sim")
    ap.add_argument("--headless", action="store_true")
    args = ap.parse_args()

    G = topology.build_graph()
    enforcer = Enforcer(mode=args.enforce)
    if args.enforce == "real" and enforcer.mode == "sim":
        print("[warn] nft unavailable -> falling back to sim enforcement")

    if args.headless:
        headless(enforcer, G)
    else:
        gui(enforcer, G)


if __name__ == "__main__":
    main()
