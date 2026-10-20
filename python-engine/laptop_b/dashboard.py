"""SafeCut defender dashboard — built to be read by a non-expert in ten seconds.

Layout (top to bottom):
  1. STATUS BANNER   plain-language headline of what is happening right now
  2. NETWORK MAP     IT -> Control -> Safety, left to right, with roles labelled
     + TEMPERATURE   live reactor gauge with SAFE / DANGER bands
  3. VERDICT PANEL   how many safety loops survived, in words
  4. LEGEND / KEYS   what the colours mean + controls

Kept in matplotlib so the whole demo is one command with nothing to break.
"""
import matplotlib
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle

from shared import config

matplotlib.rcParams["toolbar"] = "None"
matplotlib.rcParams["font.family"] = "DejaVu Sans"

# palette
BG      = "#0b0f1a"
PANEL   = "#111827"
TXT     = "#f1f5f9"
MUTED   = "#94a3b8"
IT_C    = "#38bdf8"
CTRL_C  = "#a78bfa"
SAFE_C  = "#34d399"
RED     = "#f87171"
RED_HOT = "#ef4444"
AMBER   = "#fbbf24"
GRIDL   = "#1f2937"

# zones: (label, x0, x1, colour)
ZONES = [
    ("ENTERPRISE / IT", 0.4, 3.15, IT_C),
    ("CONTROL NETWORK", 3.55, 6.65, CTRL_C),
    ("SAFETY & PROCESS", 7.05, 9.85, SAFE_C),
]
# key: (x, y, title, role, zone colour)
NODE = {
    "EngWorkstation": (1.78, 7.5, "Engineering\nWorkstation", "remote config", IT_C),
    "Historian":      (1.78, 5.0, "Historian", "data logging", IT_C),
    "HMI":            (1.78, 2.5, "HMI", "operator screen", IT_C),
    "PLC1":           (5.10, 6.1, "PLC 1", "line controller", CTRL_C),
    "PLC2":           (5.10, 3.0, "PLC 2", "line controller", CTRL_C),
    "Sensor_T":       (8.45, 7.5, "Temp Sensor", "reads reactor", SAFE_C),
    "SIS":            (8.45, 5.0, "Safety Controller", "trips cooling", SAFE_C),
    "Actuator_Cool":  (8.45, 2.5, "Cooling Valve", "emergency cooling", SAFE_C),
}
SAFETY_EDGES = {tuple(sorted(("Sensor_T", "SIS"))),
                tuple(sorted(("SIS", "Actuator_Cool")))}
BOX_W, BOX_H = 1.5, 1.15


class Dashboard:
    def __init__(self, G):
        self.G = G
        self.fig = plt.figure(figsize=(16, 9), facecolor=BG)
        try:
            self.fig.canvas.manager.set_window_title("SafeCut — Defender Console")
        except Exception:
            pass
        gs = self.fig.add_gridspec(
            3, 2, height_ratios=[0.8, 4.6, 1.0], width_ratios=[1.55, 1.0],
            hspace=0.18, wspace=0.12,
            left=0.02, right=0.98, top=0.97, bottom=0.03)
        self.ax_banner = self.fig.add_subplot(gs[0, :])
        self.ax_net    = self.fig.add_subplot(gs[1, 0])
        self.ax_proc   = self.fig.add_subplot(gs[1, 1])
        self.ax_cert   = self.fig.add_subplot(gs[2, 0])
        self.ax_key    = self.fig.add_subplot(gs[2, 1])
        for ax in (self.ax_banner, self.ax_net, self.ax_cert, self.ax_key):
            ax.axis("off")

    # ---------- 1. status banner ----------
    def draw_banner(self, headline, sub, tone, badge=None, badge_color=None):
        ax = self.ax_banner
        ax.clear(); ax.axis("off")
        ax.set_xlim(0, 1); ax.set_ylim(0, 1)
        color = {"idle": IT_C, "alert": AMBER, "bad": RED_HOT, "good": SAFE_C}[tone]
        ax.add_patch(Rectangle((0, 0), 1, 1, facecolor=PANEL,
                               edgecolor=color, linewidth=2.5,
                               transform=ax.transAxes))
        ax.add_patch(Rectangle((0, 0), 0.014, 1, facecolor=color,
                               transform=ax.transAxes))
        ax.text(0.03, 0.60, headline, color=color, fontsize=23,
                fontweight="bold", va="center", transform=ax.transAxes)
        ax.text(0.03, 0.20, sub, color=TXT, fontsize=12.5,
                va="center", transform=ax.transAxes)
        if badge:
            bc = badge_color or SAFE_C
            ax.add_patch(FancyBboxPatch(
                (0.775, 0.28), 0.205, 0.44,
                boxstyle="round,pad=0.008,rounding_size=0.06",
                facecolor=PANEL, edgecolor=bc, linewidth=2.0,
                transform=ax.transAxes, zorder=4))
            ax.text(0.8775, 0.50, badge, ha="center", va="center", color=bc,
                    fontsize=13, fontweight="bold", transform=ax.transAxes,
                    zorder=5)

    # ---------- 2a. network map ----------
    def _edge(self, ax, u, v, color, lw, style, glow=False):
        (x0, y0, *_), (x1, y1, *_) = NODE[u], NODE[v]
        if glow:
            ax.plot([x0, x1], [y0, y1], color=color, lw=lw + 5,
                    alpha=0.18, solid_capstyle="round", zorder=1)
        ax.plot([x0, x1], [y0, y1], color=color, lw=lw, linestyle=style,
                solid_capstyle="round", zorder=2)
        return (x0 + x1) / 2, (y0 + y1) / 2

    def _node(self, ax, key, compromised, isolated):
        x, y, title, role, zc = NODE[key]
        if compromised:
            face, edge, lw = "#3b0d0d", RED_HOT, 3.0
        else:
            face, edge, lw = PANEL, zc, 2.2
        ax.add_patch(FancyBboxPatch(
            (x - BOX_W / 2, y - BOX_H / 2), BOX_W, BOX_H,
            boxstyle="round,pad=0.02,rounding_size=0.14",
            facecolor=face, edgecolor=edge, linewidth=lw, zorder=4))
        tcol = RED if compromised else TXT
        ax.text(x, y + 0.16, title, ha="center", va="center", color=tcol,
                fontsize=11.5, fontweight="bold", zorder=5, linespacing=0.9)
        ax.text(x, y - 0.34, role, ha="center", va="center", color=MUTED,
                fontsize=8.5, zorder=5)
        if compromised:
            ax.text(x, y + BOX_H / 2 + 0.26, "! INTRUDER", ha="center",
                    color=RED_HOT, fontsize=10, fontweight="bold", zorder=6)
        if isolated:
            ax.add_patch(Circle((x, y), BOX_W * 0.75, fill=False,
                                edgecolor=RED_HOT, lw=2.2, linestyle=(0, (4, 3)),
                                zorder=3))
            ax.text(x, y - BOX_H / 2 - 0.30, "SEALED OFF", ha="center",
                    color=RED_HOT, fontsize=9.5, fontweight="bold", zorder=6)

    def draw_network(self, compromised=(), cut_edges=(), isolated_attacker=False,
                     safety_lost=False):
        ax = self.ax_net
        ax.clear(); ax.axis("off")
        ax.set_xlim(0, 10.2); ax.set_ylim(0.6, 9.4)
        ax.set_title("LIVE NETWORK MAP", color=TXT, fontsize=13,
                     fontweight="bold", loc="left", pad=6)

        # zone bands + labels
        for label, x0, x1, zc in ZONES:
            ax.add_patch(Rectangle((x0, 1.2), x1 - x0, 7.4, facecolor=zc,
                                   alpha=0.06, edgecolor=zc, linewidth=1.0,
                                   linestyle=(0, (6, 4)), zorder=0))
            ax.text((x0 + x1) / 2, 8.85, label, ha="center", color=zc,
                    fontsize=10.5, fontweight="bold", zorder=1)

        cut_set = {tuple(sorted(e)) for e in cut_edges}
        # edges
        for u, v in self.G.edges():
            e = tuple(sorted((u, v)))
            if e in cut_set:
                mx, my = self._edge(ax, u, v, RED_HOT, 2.4, (0, (3, 3)))
                ax.scatter([mx], [my], s=210, color=BG, zorder=5)
                ax.text(mx, my, "\u2715", ha="center", va="center",
                        color=RED_HOT, fontsize=12, fontweight="bold", zorder=6)
            elif e in SAFETY_EDGES:
                self._edge(ax, u, v, SAFE_C, 3.4, "-", glow=True)
            else:
                self._edge(ax, u, v, "#334155", 1.6, "-")

        # protected-loop status is shown authoritatively in the verdict panel
        for key in NODE:
            self._node(ax, key,
                       compromised=key in compromised,
                       isolated=isolated_attacker and key == config.ATTACKER_NODE)

    # ---------- 2b. temperature gauge ----------
    def draw_process(self, ts, Ts, phase):
        ax = self.ax_proc
        ax.clear()
        ax.set_facecolor(PANEL)
        ax.set_title("REACTOR TEMPERATURE", color=TXT, fontsize=13,
                     fontweight="bold", loc="left", pad=6)
        lo, hi = 340, 410
        # danger / safe bands
        ax.axhspan(config.T_RUNAWAY, hi, color=RED_HOT, alpha=0.14)
        ax.axhspan(lo, config.T_TRIP, color=SAFE_C, alpha=0.08)
        ax.axhline(config.T_TRIP, color=AMBER, lw=1.3, linestyle="--")
        ax.axhline(config.T_RUNAWAY, color=RED_HOT, lw=1.3, linestyle="--")
        ax.text(0.5, config.T_TRIP + 1, "SIS trip point", color=AMBER,
                fontsize=8.5, va="bottom")
        ax.text(0.5, config.T_RUNAWAY + 1, "RUNAWAY / disaster", color=RED_HOT,
                fontsize=8.5, va="bottom", fontweight="bold")
        if ts:
            cur = Ts[-1]
            line_c = RED_HOT if cur >= config.T_RUNAWAY else (
                AMBER if cur >= config.T_TRIP else SAFE_C)
            ax.plot(ts, Ts, color=line_c, lw=2.6)
            ax.scatter([ts[-1]], [cur], s=45, color=line_c, zorder=5)
            # big readout
            shown = min(cur, 999)
            ax.text(0.97, 0.93, f"{shown:.0f} K", transform=ax.transAxes,
                    ha="right", va="top", color=line_c, fontsize=30,
                    fontweight="bold")
            state = ("DISASTER" if cur >= config.T_RUNAWAY else
                     "COOLING" if cur >= config.T_TRIP else "STABLE")
            ax.text(0.97, 0.78, state, transform=ax.transAxes, ha="right",
                    va="top", color=line_c, fontsize=13, fontweight="bold")
        ax.set_xlim(ts[0] if ts else 0, max((ts[-1] if ts else 6), (ts[0] if ts else 0) + 6))
        ax.set_ylim(lo, hi)
        ax.set_xlabel("time (s)", color=MUTED, fontsize=9)
        ax.set_ylabel("temperature (K)", color=MUTED, fontsize=9)
        ax.tick_params(colors=MUTED, labelsize=8)
        for s in ax.spines.values():
            s.set_color(GRIDL)
        ax.grid(True, color=GRIDL, alpha=0.4)

    # ---------- 3. verdict panel ----------
    def draw_cert(self, cert, scenario):
        ax = self.ax_cert
        ax.clear(); ax.axis("off")
        ax.set_xlim(0, 1); ax.set_ylim(0, 1)
        if cert is None:
            ax.add_patch(Rectangle((0, 0), 1, 1, facecolor=PANEL,
                                   edgecolor=GRIDL, lw=1.5, transform=ax.transAxes))
            ax.text(0.5, 0.5, "Awaiting response…  press  N  or  S",
                    ha="center", va="center", color=MUTED, fontsize=12,
                    transform=ax.transAxes)
            return
        safe = cert["all_safe"]
        color = SAFE_C if safe else RED_HOT
        ax.add_patch(Rectangle((0, 0), 1, 1, facecolor=PANEL,
                               edgecolor=color, lw=2.5, transform=ax.transAxes))
        n_ok = sum(1 for s in cert["sifs"] if s["intact"])
        n_tot = len(cert["sifs"])
        mark = "\u2713" if safe else "\u2715"
        verdict = ("SAFETY PRESERVED" if safe else "SAFETY LOOP SEVERED")
        ax.text(0.03, 0.74, f"{mark}  {verdict}", color=color, fontsize=19,
                fontweight="bold", va="center", transform=ax.transAxes)

        if scenario == "naive":
            plain = (f"Blind quarantine cut {cert['cut_size']} links — including the "
                     f"safety loop. Cooling can no longer reach the reactor.")
        else:
            plain = (f"SafeCut cut {cert['cut_size']} links — only the intruder's. "
                     f"All {n_tot} safety loops stay connected.")
        ax.text(0.03, 0.46, plain, color=TXT, fontsize=12, va="center",
                transform=ax.transAxes, wrap=True)
        ax.text(0.03, 0.16,
                f"Safety loops intact: {n_ok}/{n_tot}     "
                f"Solve time: {cert['solve_ms']:.1f} ms     "
                f"(verified independently of the solver)",
                color=MUTED, fontsize=10.5, va="center", transform=ax.transAxes)

    # ---------- 4. legend / controls ----------
    def draw_key(self):
        ax = self.ax_key
        ax.clear(); ax.axis("off")
        ax.set_xlim(0, 1); ax.set_ylim(0, 1)
        ax.add_patch(Rectangle((0, 0), 1, 1, facecolor=PANEL,
                               edgecolor=GRIDL, lw=1.5, transform=ax.transAxes))
        rows = [
            (SAFE_C, "Safety loop (protected, must survive)"),
            (RED_HOT, "Severed link  \u2715"),
            (RED_HOT, "Compromised / isolated node"),
            ("#334155", "Normal network link"),
        ]
        y = 0.86
        for c, label in rows:
            ax.plot([0.05, 0.11], [y, y], color=c, lw=3,
                    transform=ax.transAxes)
            ax.text(0.14, y, label, color=TXT, fontsize=9.5, va="center",
                    transform=ax.transAxes)
            y -= 0.20
        ax.text(0.05, 0.06,
                "N naive quarantine   S SafeCut   R reset   Q quit",
                color=MUTED, fontsize=9.5, va="center", transform=ax.transAxes)
