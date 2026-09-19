"""
SafeCut OT Pipeline + Network Graph 3D Model Generator (v4 — Presentation Detail)
=============================================================

Run:
    pip install trimesh numpy
    python generate_safecut_ot_model.py

Output:
    safecut_ot_pipeline_graph.glb

Changes from v1:
  - No ground plane, floor, or backing surface of any kind — pure
    floating geometry (pipes, valves, tanks, pump, sensors, graph).
  - Flanged pipe joints: every bend/junction gets a small collar so
    piping reads as *assembled* segments instead of a bent noodle.
  - Tanks gained a ladder, manway hatch with bolt ring, level-gauge
    strip and a top handrail ring.
  - Pump gained a bolted base, ribbed motor housing, and a coupling
    guard cage instead of a bare sphere.
  - Valves gained bolted flange discs and a compact actuator body
    instead of a plain hand-wheel-on-a-stick.
  - Sensors gained a conduit stub and a lens dome.
  - Network graph nodes now have a soft two-layer glow (solid core +
    translucent emissive shell) and collared edges, so the graph
    reads clearly as a *logical* diagram floating above the physical
    plant.
  - Higher segment counts throughout for smoother silhouettes, and
    material roughness/metalness retuned so steel looks like matte
    brushed metal while the colored channels look like coated,
    slightly glossy status-indicator surfaces.
"""

import math
import os
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

OUTPUT = "safecut_ot_pipeline_graph_v4.glb"

# ---------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------

def material(name, rgb, metallic=0.5, roughness=0.3, emissive=None,
             alpha=1.0, blend=False):
    return PBRMaterial(
        name=name,
        baseColorFactor=(*rgb, alpha),
        metallicFactor=metallic,
        roughnessFactor=roughness,
        emissiveFactor=emissive if emissive else (0.0, 0.0, 0.0),
        alphaMode="BLEND" if blend else "OPAQUE",
        doubleSided=blend,
    )

# Structural / neutral
STEEL = material("Industrial steel", (0.20, 0.23, 0.26), 0.90, 0.42)
STEEL_DARK = material("Dark structural steel", (0.075, 0.085, 0.10), 0.88, 0.45)
DARK = material("Dark equipment", (0.03, 0.04, 0.05), 0.82, 0.35)
BOLT = material("Bolt hardware", (0.55, 0.56, 0.58), 0.95, 0.28)
ALUMINUM = material("Instrument aluminum", (0.52, 0.56, 0.60), 0.94, 0.22)
RUBBER = material("Rubber gasket", (0.012, 0.014, 0.017), 0.05, 0.78)
GLASS = material("Gauge glass", (0.55, 0.85, 0.95), 0.1, 0.05,
                  (0.05, 0.15, 0.2), alpha=0.55, blend=True)

# Status / signal channels — coated, slightly glossy, self-lit
GREEN = material("Protected OT network", (0.03, 0.85, 0.20), 0.25, 0.16,
                  (0.02, 0.95, 0.14))
YELLOW = material("Safety loop", (1.0, 0.62, 0.02), 0.22, 0.16,
                   (1.0, 0.42, 0.0))
RED = material("Attacker / isolated path", (0.95, 0.03, 0.02), 0.20, 0.18,
                (0.95, 0.02, 0.0))
CYAN = material("OT graph", (0.02, 0.58, 1.0), 0.22, 0.14,
                 (0.0, 0.42, 1.0))
WHITE = material("Node highlight", (0.85, 0.92, 0.98), 0.4, 0.14)

# Translucent glow shells for the logical graph nodes
GLOW_RED = material("Attacker glow", (1.0, 0.15, 0.1), 0.0, 0.4,
                     (1.0, 0.15, 0.05), alpha=0.28, blend=True)
GLOW_CYAN = material("OT node glow", (0.1, 0.65, 1.0), 0.0, 0.4,
                      (0.1, 0.55, 1.0), alpha=0.25, blend=True)
GLOW_YELLOW = material("Safety node glow", (1.0, 0.65, 0.05), 0.0, 0.4,
                        (1.0, 0.55, 0.0), alpha=0.28, blend=True)

scene = trimesh.Scene()


# ---------------------------------------------------------------------
# Basic geometry helpers
# ---------------------------------------------------------------------

def add(mesh, mat, name):
    mesh.visual.material = mat
    scene.add_geometry(mesh, geom_name=name)


def _orient(mesh, a, b):
    """Rotate a z-aligned mesh so it points from a to b, in place."""
    direction = b - a
    length = np.linalg.norm(direction)
    if length < 1e-8:
        return length
    direction = direction / length
    z_axis = np.array([0.0, 0.0, 1.0])
    axis = np.cross(z_axis, direction)
    dot = np.clip(np.dot(z_axis, direction), -1.0, 1.0)
    if np.linalg.norm(axis) > 1e-8:
        axis /= np.linalg.norm(axis)
        angle = math.acos(dot)
        mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, axis))
    elif dot < 0:
        mesh.apply_transform(trimesh.transformations.rotation_matrix(math.pi, [1, 0, 0]))
    return length


def cylinder_between(a, b, radius, mat, name, sections=28, taper=None):
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    length = np.linalg.norm(b - a)
    if length < 1e-8:
        return

    if taper is not None:
        mesh = trimesh.creation.cone(radius=radius, height=length, sections=sections) \
            if taper == "cone" else trimesh.creation.cylinder(radius=radius, height=length, sections=sections)
    else:
        mesh = trimesh.creation.cylinder(radius=radius, height=length, sections=sections)

    mesh.apply_translation((0, 0, length / 2.0))
    _orient(mesh, np.array([0.0, 0.0, 0.0]), b - a)
    mesh.apply_translation(a)
    add(mesh, mat, name)


def pipe(points, radius, mat, prefix, flange_scale=1.35, endpoints=False):
    """A multi-segment pipe with small collar spheres at interior joints
    so bends read as bolted/welded fittings rather than a smooth bent tube."""
    for i in range(len(points) - 1):
        cylinder_between(points[i], points[i + 1], radius, mat, f"{prefix}_{i:02d}")

    joint_range = range(len(points)) if endpoints else range(1, len(points) - 1)
    for i in joint_range:
        sphere(points[i], radius * flange_scale, mat, f"{prefix}_joint_{i:02d}", subdiv=1)


def flange_disc(position, direction, radius, thickness, mat, name, bolts=8):
    """A bolted flange disc perpendicular to `direction`, with a bolt ring."""
    position = np.asarray(position, dtype=float)
    direction = np.asarray(direction, dtype=float)
    disc = trimesh.creation.cylinder(radius=radius, height=thickness, sections=24)
    _orient(disc, np.array([0.0, 0.0, 0.0]), direction)
    disc.apply_translation(position)
    add(disc, mat, f"{name}_disc")

    # Local basis perpendicular to direction, for placing bolt heads
    d = direction / (np.linalg.norm(direction) + 1e-9)
    helper = np.array([1.0, 0.0, 0.0]) if abs(d[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
    u = np.cross(d, helper)
    u /= np.linalg.norm(u)
    v = np.cross(d, u)
    for i in range(bolts):
        ang = 2 * math.pi * i / bolts
        offset = (u * math.cos(ang) + v * math.sin(ang)) * (radius * 0.78)
        sphere(position + offset, thickness * 0.55, BOLT, f"{name}_bolt_{i}", subdiv=0)


def box(position, size, mat, name):
    mesh = trimesh.creation.box(extents=size)
    mesh.apply_translation(position)
    add(mesh, mat, name)


def sphere(position, radius, mat, name, subdiv=2):
    mesh = trimesh.creation.icosphere(subdiv=subdiv, radius=radius)
    mesh.apply_translation(position)
    add(mesh, mat, name)


def torus(position, major_radius, minor_radius, mat, name, major_sections=36, minor_sections=12):
    mesh = trimesh.creation.torus(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_sections=major_sections,
        minor_sections=minor_sections,
    )
    mesh.apply_translation(position)
    add(mesh, mat, name)


# ---------------------------------------------------------------------
# No floor / no background surface
# ---------------------------------------------------------------------
# The model is exported as isolated 3D geometry — no ground plane, no
# backing wall, no base plate of any kind — so the host application can
# supply its own background, lighting, grid, or environment.
# ---------------------------------------------------------------------


# ---------------------------------------------------------------------
# Industrial components
# ---------------------------------------------------------------------

def create_tank(x, y, z, radius, height, name):
    body = trimesh.creation.cylinder(radius=radius, height=height, sections=56)
    body.apply_translation((x, y, z + height / 2))
    add(body, STEEL, f"{name}_body")

    # Ribbing bands (thin reinforcement rings)
    for frac in (0.25, 0.5, 0.75):
        torus((x, y, z + height * frac), radius * 0.985, 0.02, STEEL_DARK,
              f"{name}_band_{int(frac * 100)}", major_sections=48, minor_sections=8)

    # Top and bottom structural rings
    torus((x, y, z), radius * 0.94, 0.045, STEEL_DARK, f"{name}_bottom_ring")
    torus((x, y, z + height), radius * 0.94, 0.045, STEEL_DARK, f"{name}_top_ring")

    # Handrail ring near the top (safety rail around the manway)
    torus((x, y, z + height + 0.32), radius * 0.55, 0.02, STEEL, f"{name}_handrail")
    for i in range(6):
        ang = 2 * math.pi * i / 6
        post_pos = (x + radius * 0.55 * math.cos(ang), y + radius * 0.55 * math.sin(ang), z + height + 0.16)
        cylinder_between(
            (post_pos[0], post_pos[1], z + height + 0.02),
            (post_pos[0], post_pos[1], z + height + 0.32),
            0.018, STEEL, f"{name}_rail_post_{i}", sections=8,
        )

    # Four support legs
    for i, (dx, dy) in enumerate([(-0.62, -0.62), (0.62, -0.62), (-0.62, 0.62), (0.62, 0.62)]):
        leg = trimesh.creation.cylinder(radius=0.06, height=0.55, sections=14)
        leg.apply_translation((x + dx * radius, y + dy * radius, z - 0.28))
        add(leg, STEEL_DARK, f"{name}_leg_{i}")
        # foot plate
        box((x + dx * radius, y + dy * radius, z - 0.55), (0.2, 0.2, 0.03), STEEL_DARK, f"{name}_foot_{i}")

    # Top nozzle + bolted manway hatch
    nozzle = trimesh.creation.cylinder(radius=0.13, height=0.35, sections=24)
    nozzle.apply_translation((x, y, z + height + 0.17))
    add(nozzle, STEEL, f"{name}_nozzle")
    flange_disc((x, y, z + height + 0.35), (0, 0, 1), 0.19, 0.035, STEEL_DARK, f"{name}_manway", bolts=10)

    # Vertical access ladder
    ladder_x = x + radius * 0.98
    for r in range(int(height / 0.28)):
        rz = z + 0.15 + r * 0.28
        cylinder_between((ladder_x - 0.02, y - 0.18, rz), (ladder_x - 0.02, y + 0.18, rz),
                          0.018, STEEL_DARK, f"{name}_rung_{r}", sections=8)
    for side, dy in enumerate((-0.18, 0.18)):
        cylinder_between((ladder_x - 0.02, y + dy, z), (ladder_x - 0.02, y + dy, z + height + 0.15),
                          0.022, STEEL_DARK, f"{name}_rail_{side}", sections=8)

    # Level-gauge glass strip on the opposite side
    gauge_x = x - radius * 0.99
    box((gauge_x, y, z + height * 0.5), (0.05, 0.09, height * 0.7), GLASS, f"{name}_gauge_glass")
    for cap_i, cap_z in enumerate((z + height * 0.12, z + height * 0.88)):
        box((gauge_x, y, cap_z), (0.09, 0.13, 0.06), STEEL_DARK, f"{name}_gauge_cap_{cap_i}")


def create_pump(x, y, z, name):
    # Bolted base plate
    base = trimesh.creation.box(extents=(1.65, 0.86, 0.14))
    base.apply_translation((x, y, z))
    add(base, DARK, f"{name}_base")
    for bx, by in [(-0.72, -0.36), (0.72, -0.36), (-0.72, 0.36), (0.72, 0.36)]:
        sphere((x + bx, y + by, z + 0.08), 0.045, BOLT, f"{name}_base_bolt_{bx}_{by}", subdiv=0)

    # Ribbed motor housing (main cylinder + cooling-fin rings)
    motor = trimesh.creation.cylinder(radius=0.34, height=0.82, sections=32)
    motor.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [1, 0, 0]))
    motor.apply_translation((x + 0.20, y, z + 0.35))
    add(motor, CYAN, f"{name}_motor")
    for i, fx in enumerate(np.linspace(-0.30, 0.30, 6)):
        torus((x + 0.20 + fx, y, z + 0.35), 0.355, 0.012, STEEL_DARK,
              f"{name}_fin_{i}", major_sections=28, minor_sections=6)
    # Motor end cap + junction box on top
    box((x + 0.55, y, z + 0.35), (0.06, 0.5, 0.5), STEEL_DARK, f"{name}_motor_cap")
    box((x + 0.20, y, z + 0.72), (0.22, 0.22, 0.16), DARK, f"{name}_junction_box")

    # Pump housing (volute) — tapered ellipsoid
    housing = trimesh.creation.icosphere(subdiv=3, radius=0.32)
    housing.apply_scale([1.25, 0.90, 0.90])
    housing.apply_translation((x - 0.48, y, z + 0.35))
    add(housing, CYAN, f"{name}_housing")
    sphere((x - 0.48, y, z + 0.35), 0.11, WHITE, f"{name}_hub")

    # Coupling guard cage between motor and pump housing
    cage_center = (x - 0.10, y, z + 0.35)
    torus(cage_center, 0.20, 0.018, STEEL_DARK, f"{name}_cage_ring")
    for i in range(6):
        ang = 2 * math.pi * i / 6
        cx = cage_center[1] + 0.20 * math.cos(ang)
        cz = cage_center[2] + 0.20 * math.sin(ang)
        cylinder_between((x - 0.24, cx, cz), (x + 0.04, cx, cz), 0.012, STEEL_DARK,
                          f"{name}_cage_bar_{i}", sections=8)

    # Inlet / outlet pipe stubs with flanges
    flange_disc((x - 0.80, y, z + 0.35), (-1, 0, 0), 0.17, 0.03, STEEL_DARK, f"{name}_inlet_flange", bolts=8)
    flange_disc((x + 0.86, y, z + 0.35), (1, 0, 0), 0.15, 0.03, STEEL_DARK, f"{name}_outlet_flange", bolts=8)


def create_valve(position, mat, name, scale=1.0):
    x, y, z = position

    # Valve body
    body = trimesh.creation.cylinder(radius=0.20 * scale, height=0.38 * scale, sections=24)
    body.apply_transform(trimesh.transformations.rotation_matrix(math.pi / 2, [0, 1, 0]))
    body.apply_translation((x, y, z))
    add(body, mat, f"{name}_body")

    # Bolted flanges on both pipe-facing ends
    flange_disc((x - 0.19 * scale, y, z), (-1, 0, 0), 0.145 * scale, 0.02 * scale, STEEL_DARK,
                f"{name}_flange_a", bolts=6)
    flange_disc((x + 0.19 * scale, y, z), (1, 0, 0), 0.145 * scale, 0.02 * scale, STEEL_DARK,
                f"{name}_flange_b", bolts=6)

    # Stem
    stem = trimesh.creation.cylinder(radius=0.042 * scale, height=0.34 * scale, sections=16)
    stem.apply_translation((x, y, z + 0.25 * scale))
    add(stem, STEEL_DARK, f"{name}_stem")

    # Compact actuator body instead of a bare hand wheel
    actuator = trimesh.creation.cylinder(radius=0.145 * scale, height=0.20 * scale, sections=20)
    actuator.apply_translation((x, y, z + 0.48 * scale))
    add(actuator, DARK, f"{name}_actuator")
    torus((x, y, z + 0.48 * scale + 0.02), 0.10 * scale, 0.018, mat, f"{name}_actuator_band",
          major_sections=20, minor_sections=8)

    # Small ID tag plate
    box((x, y - 0.18 * scale, z), (0.10 * scale, 0.012, 0.06 * scale), WHITE, f"{name}_tag")


def create_sensor(position, name):
    x, y, z = position
    box((x, y, z), (0.34, 0.34, 0.42), CYAN, f"{name}_body")

    # Lens dome facing outward
    dome = trimesh.creation.icosphere(subdiv=2, radius=0.08)
    dome.apply_translation((x, y - 0.20, z))
    add(dome, WHITE, f"{name}_indicator")

    # Conduit stub feeding into the top
    cylinder_between((x, y, z + 0.21), (x, y, z + 0.40), 0.035, STEEL_DARK, f"{name}_conduit", sections=12)
    sphere((x, y, z + 0.41), 0.045, STEEL_DARK, f"{name}_conduit_cap", subdiv=1)


# ---------------------------------------------------------------------
# Physical OT / industrial process
# ---------------------------------------------------------------------

create_tank(-6.0, 1.7, 0.0, 1.15, 2.8, "Process_tank_A")
create_tank(6.0, -1.7, 0.0, 1.05, 2.5, "Process_tank_B")
create_pump(0.0, 1.1, 0.0, "Main_OT_pump")

# Main protected green process pipeline
protected_path = [
    (-4.9, 1.7, 1.15),
    (-3.5, 1.7, 1.15),
    (-3.0, 1.1, 1.15),
    (-1.2, 1.1, 1.15),
    (0.0, 1.1, 1.15),
    (1.3, 1.1, 1.15),
    (2.2, 0.0, 1.15),
    (4.9, -1.7, 1.15),
]
pipe(protected_path, 0.16, GREEN, "Protected_OT_pipeline")

# Closed yellow safety loop — remains physically connected even when
# attacker links are cut.
safety_loop = [
    (-2.8, -2.3, 2.15),
    (0.0, -2.3, 2.15),
    (2.8, -2.3, 2.15),
    (2.8, 1.9, 2.15),
    (0.0, 1.9, 2.15),
    (-2.8, 1.9, 2.15),
    (-2.8, -2.3, 2.15),
]
pipe(safety_loop, 0.105, YELLOW, "Safety_loop")

# Red attacker route
attacker_route = [
    (-6.0, -3.2, 1.0),
    (-4.0, -3.2, 1.0),
    (-2.2, -3.2, 1.0),
]
pipe(attacker_route, 0.14, RED, "Attacker_route", endpoints=True)

# Two intentionally separated pieces represent SafeCut link cuts —
# each stub gets its own cut-flange so the break reads as deliberate.
cylinder_between((-2.0, -3.2, 1.0), (-1.35, -3.2, 1.0), 0.14, RED, "Attacker_cut_link_A")
cylinder_between((-0.85, -3.2, 1.0), (-0.25, -3.2, 1.0), 0.14, RED, "Attacker_cut_link_B")
for cut_x in (-2.0, -1.35, -0.85, -0.25):
    flange_disc((cut_x, -3.2, 1.0), (1, 0, 0), 0.175, 0.025, STEEL_DARK, f"Cut_flange_{cut_x}", bolts=6)

# Green process valves
green_valves = [
    (-3.1, 1.1, 1.15),
    (-0.7, 1.1, 1.15),
    (2.2, 0.0, 1.15),
    (4.0, -1.0, 1.15),
]
for i, position in enumerate(green_valves):
    create_valve(position, GREEN, f"Protected_valve_{i}", 0.8)

# Yellow safety valves
safety_valves = [
    (-1.5, -2.3, 2.15),
    (1.2, -2.3, 2.15),
    (2.8, 0.1, 2.15),
    (-1.2, 1.9, 2.15),
]
for i, position in enumerate(safety_valves):
    create_valve(position, YELLOW, f"Safety_valve_{i}", 0.72)

# OT sensors
sensors = [
    (-3.7, 1.7, 1.75),
    (-1.0, 1.1, 1.75),
    (1.8, 0.3, 1.75),
    (4.3, -1.7, 1.75),
]
for i, position in enumerate(sensors):
    create_sensor(position, f"OT_sensor_{i}")


# ---------------------------------------------------------------------
# Floating OT network graph
# ---------------------------------------------------------------------

# Nodes:
#   red    = attacker
#   cyan   = ordinary OT network
#   yellow = protected safety network
graph_nodes = {
    "attacker": (-5.6, -0.4, 4.2),
    "gateway": (-3.3, 0.2, 4.2),
    "plc_1": (-0.9, 1.0, 4.35),
    "plc_2": (1.7, 1.0, 4.35),
    "safety_1": (-0.8, -1.9, 4.45),
    "safety_2": (1.8, -1.9, 4.45),
    "scada": (4.4, 0.3, 4.2),
}

for node_name, position in graph_nodes.items():
    if node_name == "attacker":
        core_mat, glow_mat = RED, GLOW_RED
    elif node_name.startswith("safety"):
        core_mat, glow_mat = YELLOW, GLOW_YELLOW
    else:
        core_mat, glow_mat = CYAN, GLOW_CYAN

    core_radius = 0.20 if node_name.startswith("safety") else 0.17
    sphere(position, core_radius, core_mat, f"Graph_node_{node_name}_core", subdiv=2)
    sphere(position, core_radius * 1.8, glow_mat, f"Graph_node_{node_name}_glow", subdiv=1)

# Network edges — thin core wire + small collars where they meet nodes
graph_edges = [
    ("attacker", "gateway", RED),
    ("gateway", "plc_1", CYAN),
    ("plc_1", "plc_2", CYAN),
    ("plc_2", "scada", CYAN),
    ("gateway", "safety_1", YELLOW),
    ("safety_1", "safety_2", YELLOW),
    ("safety_2", "plc_2", YELLOW),
]

for i, (a, b, edge_material) in enumerate(graph_edges):
    cylinder_between(graph_nodes[a], graph_nodes[b], 0.05, edge_material, f"Graph_edge_{i}", sections=16)

# Visibly broken attacker links — the gaps are intentional: they
# represent SafeCut's selected cuts.
cut_a_start, cut_a_end = graph_nodes["attacker"], (-4.9, -0.4, 4.2)
cut_b_start, cut_b_end = (-4.25, -0.4, 4.2), graph_nodes["gateway"]
cylinder_between(cut_a_start, cut_a_end, 0.05, RED, "Graph_cut_left", sections=16)
cylinder_between(cut_b_start, cut_b_end, 0.05, RED, "Graph_cut_right", sections=16)
sphere(cut_a_end, 0.055, RED, "Graph_cut_left_end", subdiv=1)
sphere(cut_b_start, 0.055, RED, "Graph_cut_right_end", subdiv=1)

# Rings around graph nodes make the network topology easy to read
for i, node_name in enumerate(["gateway", "plc_1", "plc_2", "safety_1", "safety_2", "scada"]):
    node_position = graph_nodes[node_name]
    torus(node_position, 0.34, 0.02, YELLOW if node_name.startswith("safety") else CYAN,
          f"Graph_ring_{i}", major_sections=40, minor_sections=10)


# ---------------------------------------------------------------------
# Safety perimeter
# ---------------------------------------------------------------------

safety_perimeter = [
    (-3.3, -2.8, 2.45),
    (3.3, -2.8, 2.45),
    (3.3, 2.35, 2.45),
    (-3.3, 2.35, 2.45),
    (-3.3, -2.8, 2.45),
]
pipe(safety_perimeter, 0.032, YELLOW, "Safety_protection_perimeter", flange_scale=1.6)


# ---------------------------------------------------------------------

# ---------------------------------------------------------------------
# V3 DETAIL EXPANSION
# ---------------------------------------------------------------------
# The original v2 is intentionally kept as the base. This section adds
# another pass of industrial micro-detail so the model reads more like a
# real OT plant than a collection of primitives.


def detailed_flange(position, direction, radius, thickness, name, bolts=10):
    """High-detail flange with two plates, gasket and visible bolts."""
    position = np.asarray(position, dtype=float)
    direction = np.asarray(direction, dtype=float)
    direction /= np.linalg.norm(direction)

    for j, offset in enumerate((-thickness * 0.60, thickness * 0.60)):
        p = position + direction * offset
        flange_disc(
            p,
            direction,
            radius,
            thickness * 0.72,
            STEEL_DARK,
            f"{name}_plate_{j}",
            bolts=bolts,
        )

    # dark elastomer gasket between the flange plates
    gasket = trimesh.creation.cylinder(radius=radius * 0.86,
                                       height=max(thickness * 0.35, 0.012),
                                       sections=36)
    _orient(gasket, np.array([0.0, 0.0, 0.0]), direction)
    gasket.apply_translation(position)
    add(gasket, RUBBER, f"{name}_gasket")


def instrument_gauge(position, direction, radius, name, accent=CYAN):
    """Detailed round gauge with bezel, glass, tick marks and pointer."""
    position = np.asarray(position, dtype=float)
    direction = np.asarray(direction, dtype=float)
    direction /= np.linalg.norm(direction)

    body = trimesh.creation.cylinder(radius=radius, height=0.12, sections=36)
    _orient(body, np.array([0, 0, 0], dtype=float), direction)
    body.apply_translation(position)
    add(body, ALUMINUM, f"{name}_body")

    bezel = trimesh.creation.torus(major_radius=radius * 0.86,
                                   minor_radius=radius * 0.085,
                                   major_sections=44,
                                   minor_sections=10)
    _orient(bezel, np.array([0, 0, 0], dtype=float), direction)
    bezel.apply_translation(position + direction * 0.068)
    add(bezel, STEEL_DARK, f"{name}_bezel")

    glass = trimesh.creation.cylinder(radius=radius * 0.75,
                                      height=0.012,
                                      sections=40)
    _orient(glass, np.array([0, 0, 0], dtype=float), direction)
    glass.apply_translation(position + direction * 0.078)
    add(glass, GLASS, f"{name}_glass")

    helper = np.array([1., 0., 0.]) if abs(direction[0]) < 0.85 else np.array([0., 1., 0.])
    u = np.cross(direction, helper)
    u /= np.linalg.norm(u)
    v = np.cross(direction, u)

    # Twelve physical tick marks
    for i in range(12):
        a = 2.0 * math.pi * i / 12.0
        outer = position + direction * 0.088 + (u * math.cos(a) + v * math.sin(a)) * radius * 0.58
        inner = position + direction * 0.088 + (u * math.cos(a) + v * math.sin(a)) * radius * 0.46
        cylinder_between(inner, outer, radius * 0.018, STEEL_DARK,
                         f"{name}_tick_{i}", sections=6)

    # Pointer
    pointer_angle = math.radians(305)
    pointer_end = (position + direction * 0.094 +
                   (u * math.cos(pointer_angle) + v * math.sin(pointer_angle)) * radius * 0.52)
    sphere(position + direction * 0.095, radius * 0.075, STEEL_DARK, f"{name}_hub", subdiv=1)
    cylinder_between(position + direction * 0.098, pointer_end, radius * 0.038,
                     accent, f"{name}_pointer", sections=8)


def junction_box(position, accent, name):
    """Small field junction box with cover seam, fasteners and conduit."""
    x, y, z = position
    box((x, y, z), (0.30, 0.24, 0.36), DARK, f"{name}_body")
    box((x, y - 0.128, z), (0.24, 0.012, 0.29), STEEL_DARK, f"{name}_cover")
    # four cover screws
    for i, (dx, dz) in enumerate(((-0.10, -0.11), (0.10, -0.11), (-0.10, 0.11), (0.10, 0.11))):
        sphere((x + dx, y - 0.138, z + dz), 0.014, BOLT, f"{name}_screw_{i}", subdiv=1)
    # status lens
    sphere((x, y - 0.150, z + 0.02), 0.026, accent, f"{name}_status", subdiv=1)
    # top conduit
    cylinder_between((x, y, z + 0.18), (x, y, z + 0.36), 0.025,
                     STEEL_DARK, f"{name}_top_conduit", sections=12)


def pipe_support_detail(position, radius, name):
    """Industrial saddle support with clamps, gussets and anchor feet."""
    x, y, z = position
    # H-frame
    for side in (-1, 1):
        xx = x + side * 0.32
        cylinder_between((xx, y, z - 0.64), (xx, y, z), 0.045,
                         STEEL_DARK, f"{name}_leg_{side}", sections=12)
        box((xx, y, z - 0.69), (0.22, 0.24, 0.08), STEEL_DARK,
            f"{name}_foot_{side}")
        # gusset plate
        box((x + side * 0.25, y, z - 0.46), (0.13, 0.16, 0.18), STEEL_DARK,
            f"{name}_gusset_{side}")
    cylinder_between((x - 0.38, y, z), (x + 0.38, y, z), 0.052,
                     STEEL, f"{name}_top", sections=12)
    torus((x, y, z + radius * 0.43), radius * 1.05, 0.023,
          STEEL_DARK, f"{name}_saddle", major_sections=32, minor_sections=8)
    # u-bolt shoulders
    for side in (-1, 1):
        cylinder_between((x + side * radius * 0.75, y - 0.06, z),
                         (x + side * radius * 0.75, y + 0.06, z),
                         0.015, ALUMINUM, f"{name}_ubolt_{side}", sections=8)


def equipment_skid(position, width, depth, height, name):
    """Small structural skid for OT cabinets / racks."""
    x, y, z = position
    box((x, y, z), (width, depth, 0.10), DARK, f"{name}_base")
    # perimeter rails
    for yy in (-depth/2 + 0.04, depth/2 - 0.04):
        cylinder_between((x - width/2, y + yy, z + 0.06),
                         (x + width/2, y + yy, z + 0.06),
                         0.022, STEEL_DARK, f"{name}_rail_y_{yy}", sections=10)
    for xx in (-width/2 + 0.04, width/2 - 0.04):
        cylinder_between((x + xx, y - depth/2, z + 0.06),
                         (x + xx, y + depth/2, z + 0.06),
                         0.022, STEEL_DARK, f"{name}_rail_x_{xx}", sections=10)
    # feet
    for xx in (-width/2 + 0.16, width/2 - 0.16):
        for yy in (-depth/2 + 0.12, depth/2 - 0.12):
            cylinder_between((x + xx, y + yy, z),
                             (x + xx, y + yy, z - height),
                             0.035, STEEL_DARK, f"{name}_leg_{xx}_{yy}", sections=10)
            box((x + xx, y + yy, z - height - 0.035),
                (0.16, 0.16, 0.07), STEEL_DARK, f"{name}_foot_{xx}_{yy}")


def control_cabinet(position, width, height, accent, name):
    """Detailed outdoor PLC/safety cabinet."""
    x, y, z = position
    box((x, y, z + height/2), (width, 0.46, height), DARK, f"{name}_body")
    box((x, y - 0.236, z + height/2), (width*0.88, 0.018, height*0.90),
        STEEL_DARK, f"{name}_door")
    # vertical vent slots
    for i in range(10):
        xx = x - width*0.34 + i * (width*0.68 / 9)
        box((xx, y - 0.251, z + height*0.18), (0.018, 0.008, height*0.15),
            STEEL, f"{name}_vent_{i}")
    # hinge cylinders
    for i, zz in enumerate((z + 0.30, z + height - 0.30)):
        cylinder_between((x - width/2 + 0.04, y - 0.27, zz),
                         (x - width/2 + 0.04, y - 0.27, zz + 0.10),
                         0.025, ALUMINUM, f"{name}_hinge_{i}", sections=10)
    # handle + latch
    cylinder_between((x + width*0.25, y - 0.29, z + height*0.48),
                     (x + width*0.25, y - 0.35, z + height*0.48),
                     0.018, ALUMINUM, f"{name}_handle", sections=10)
    box((x + width*0.25, y - 0.355, z + height*0.55), (0.07, 0.018, 0.13),
        BOLT, f"{name}_latch")
    # three status beacons
    for i, dz in enumerate((0.05, 0.0, -0.05)):
        sphere((x + width*0.31, y - 0.27, z + height*0.73 + dz),
               0.018, accent if i == 0 else WHITE,
               f"{name}_beacon_{i}", subdiv=1)


def cable_tray_run(points, width, depth, name):
    """Open cable tray with side rails and repeated crossbars."""
    points = [np.asarray(p, dtype=float) for p in points]
    for i in range(len(points)-1):
        a, b = points[i], points[i+1]
        direction = b - a
        length = np.linalg.norm(direction)
        if length < 1e-9:
            continue
        center = (a+b)/2
        mesh = trimesh.creation.box(extents=(length, width, depth))
        dxy = direction.copy(); dxy[2] = 0
        if np.linalg.norm(dxy) > 1e-9:
            angle = math.atan2(dxy[1], dxy[0])
            mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, [0,0,1]))
        mesh.apply_translation(center)
        add(mesh, STEEL_DARK, f"{name}_tray_{i}")
        # side rails
        for side in (-1, 1):
            offset = np.array([0.0, side*width*0.47, depth*0.35])
            cylinder_between(a + offset, b + offset, 0.015, ALUMINUM,
                             f"{name}_rail_{i}_{side}", sections=8)
        # cross members every run
        cross_count = max(2, int(length / 0.40))
        for j in range(cross_count):
            t = j / max(cross_count - 1, 1)
            p = a*(1-t) + b*t
            # local horizontal rail
            dxyu = dxy / max(np.linalg.norm(dxy), 1e-9)
            perp = np.array([-dxyu[1], dxyu[0], 0])
            cylinder_between(p - perp*(width*0.43) + np.array([0,0,depth*0.28]),
                             p + perp*(width*0.43) + np.array([0,0,depth*0.28]),
                             0.012, STEEL, f"{name}_crossbar_{i}_{j}", sections=8)


# ---------------------------------------------------------------------
# Additional tanks / equipment detail
# ---------------------------------------------------------------------
# The existing vessels get secondary piping, sample lines, vent loops and
# additional field instrumentation.

for tank_x, tank_y, tank_z, tank_r, tank_h, tag in [
    (-6.0, 1.7, 0.0, 1.15, 2.8, "A"),
    (6.0, -1.7, 0.0, 1.05, 2.5, "B"),
]:
    # Vent header / gooseneck
    cylinder_between((tank_x, tank_y, tank_z+tank_h+0.35),
                     (tank_x, tank_y, tank_z+tank_h+0.72),
                     0.055, STEEL, f"Tank_{tag}_vent_vertical", sections=18)
    cylinder_between((tank_x, tank_y, tank_z+tank_h+0.72),
                     (tank_x+0.28, tank_y, tank_z+tank_h+0.82),
                     0.055, STEEL, f"Tank_{tag}_vent_bend", sections=18)
    cylinder_between((tank_x+0.28, tank_y, tank_z+tank_h+0.82),
                     (tank_x+0.46, tank_y, tank_z+tank_h+0.82),
                     0.055, STEEL, f"Tank_{tag}_vent_out", sections=18)
    # Sample/drain line
    cylinder_between((tank_x + tank_r, tank_y - 0.22, tank_z + tank_h*0.35),
                     (tank_x + tank_r + 0.30, tank_y - 0.22, tank_z + tank_h*0.35),
                     0.035, STEEL_DARK, f"Tank_{tag}_sample_line", sections=14)
    # Local junction box
    junction_box((tank_x + tank_r + 0.40, tank_y - 0.22, tank_z + tank_h*0.35),
                 CYAN if tag == "A" else GREEN, f"Tank_{tag}_junction")
    # Secondary pressure gauge
    instrument_gauge((tank_x - tank_r - 0.10, tank_y + 0.18, tank_z+tank_h*0.67),
                     (-1,0,0), 0.11, f"Tank_{tag}_pressure_secondary",
                     GREEN if tag == "A" else RED)


# ---------------------------------------------------------------------
# High-detail heat exchanger cluster
# ---------------------------------------------------------------------
HEX_X, HEX_Y, HEX_Z = 2.0, 0.8, 0.15
# tube sheets / small visible tube mouths
for end_x, sign in ((HEX_X-1.43, -1), (HEX_X+1.43, 1)):
    for row in range(4):
        for col in range(6):
            yy = HEX_Y - 0.27 + row*0.18
            zz = HEX_Z + 0.52 + col*0.10
            # Keep these subtly within the end-cap silhouette
            sphere((end_x, yy, zz), 0.018, ALUMINUM,
                   f"HEX_tube_mouth_{sign}_{row}_{col}", subdiv=1)

# ---------------------------------------------------------------------
# More pipe supports + U-bolts across the main plant
# ---------------------------------------------------------------------
main_support_positions = [
    (-4.25, 1.70, 1.15),
    (-2.80, 1.10, 1.15),
    (-1.05, 1.10, 1.15),
    (0.55, 1.10, 1.15),
    (1.75, 0.45, 1.15),
    (3.60, -0.95, 1.15),
]
for i, p in enumerate(main_support_positions):
    pipe_support_detail(p, 0.155, f"Detailed_green_support_{i}")

# Yellow loop supports
for i, p in enumerate([
    (-2.10, -2.30, 2.15),
    (0.60, -2.30, 2.15),
    (2.80, -1.15, 2.15),
    (2.80, 0.90, 2.15),
    (0.35, 1.90, 2.15),
    (-2.10, 1.90, 2.15),
]):
    pipe_support_detail(p, 0.105, f"Detailed_safety_support_{i}")

# ---------------------------------------------------------------------
# Additional process instruments
# ---------------------------------------------------------------------
for i, (p, d, acc) in enumerate([
    ((-3.35, 1.10, 1.45), (0,0,1), GREEN),
    ((-0.95, 1.10, 1.45), (0,0,1), GREEN),
    ((2.25, 0.02, 1.45), (0,0,1), GREEN),
    ((-1.48, -2.30, 2.48), (0,0,1), YELLOW),
    ((1.25, -2.30, 2.48), (0,0,1), YELLOW),
]):
    instrument_gauge(p, d, 0.105, f"Field_gauge_{i}", acc)

# ---------------------------------------------------------------------
# OT cabinets / control equipment as actual modeled geometry
# ---------------------------------------------------------------------
equipment_skid((-3.70, 3.10, 0.0), 2.05, 0.78, 0.22, "PLC_skid")
control_cabinet((-4.15, 3.10, 0.05), 0.82, 2.30, CYAN, "PLC_cabinet_left")
control_cabinet((-3.15, 3.10, 0.05), 0.82, 2.30, GREEN, "PLC_cabinet_right")

equipment_skid((3.55, 2.55, 0.0), 2.35, 0.90, 0.22, "Safety_skid")
control_cabinet((3.00, 2.55, 0.05), 0.85, 2.45, YELLOW, "Safety_logic_cabinet")
control_cabinet((4.05, 2.55, 0.05), 0.85, 2.45, CYAN, "SCADA_cabinet")

# Small IO rack beside the cabinets
rack_x, rack_y, rack_z = 5.10, 2.55, 0.10
for side in (-1, 1):
    cylinder_between((rack_x + side*0.30, rack_y, rack_z),
                     (rack_x + side*0.30, rack_y, rack_z+2.10),
                     0.035, STEEL_DARK, f"IO_rack_upright_{side}", sections=10)
for i, zz in enumerate(np.linspace(0.18, 1.95, 6)):
    box((rack_x, rack_y-0.02, zz), (0.48, 0.34, 0.24), DARK, f"IO_rack_module_{i}")
    box((rack_x, rack_y-0.20, zz), (0.38, 0.018, 0.14), CYAN, f"IO_rack_panel_{i}")

# ---------------------------------------------------------------------
# Cable tray network / instrument conduits
# ---------------------------------------------------------------------
cable_tray_run([
    (-4.60, 2.65, 2.00),
    (-1.80, 2.65, 2.00),
    (0.80, 2.30, 2.00),
    (3.20, 1.75, 2.00),
], 0.30, 0.12, "Main_OT_cable_tray")

cable_tray_run([
    (-2.80, -1.10, 2.85),
    (0.20, -1.10, 2.85),
    (3.20, -1.10, 2.85),
], 0.27, 0.11, "Safety_cable_tray_detail")

# Dense small conduits under the main tray
for i, x in enumerate(np.linspace(-4.0, 3.2, 9)):
    y = 2.30 if x < 0 else 1.85
    cylinder_between((x, y, 1.95), (x, y, 1.65), 0.018, STEEL_DARK,
                     f"Tray_drop_conduit_{i}", sections=10)

# ---------------------------------------------------------------------
# Refined physical graph bridge: graph nodes link visually to the plant
# ---------------------------------------------------------------------
graph_nodes_v3 = {
    "attacker": (-5.70, -0.40, 4.25),
    "gateway": (-3.55, 0.10, 4.28),
    "plc1": (-1.20, 1.05, 4.45),
    "plc2": (1.20, 1.05, 4.45),
    "hmi": (3.25, 1.00, 4.38),
    "scada": (4.55, 0.00, 4.28),
    "safe1": (-1.10, -1.95, 4.52),
    "safe2": (1.55, -1.95, 4.52),
    "safe3": (3.10, -1.25, 4.48),
}

for key, pos in graph_nodes_v3.items():
    if key == "attacker":
        core, shell, rad = RED, GLOW_RED, 0.18
    elif key.startswith("safe"):
        core, shell, rad = YELLOW, GLOW_YELLOW, 0.19
    else:
        core, shell, rad = CYAN, GLOW_CYAN, 0.17
    sphere(pos, rad*1.85, shell, f"GraphV3_{key}_halo", subdiv=1)
    sphere(pos, rad, core, f"GraphV3_{key}_core", subdiv=2)
    torus(pos, rad*1.40, rad*0.10, core, f"GraphV3_{key}_ring",
          major_sections=42, minor_sections=9)
    sphere(pos, rad*0.25, WHITE, f"GraphV3_{key}_hotspot", subdiv=1)

# cyan OT backbone
for i, (a,b) in enumerate([
    ("gateway","plc1"), ("plc1","plc2"), ("plc2","hmi"),
    ("hmi","scada"), ("gateway","scada")
]):
    cylinder_between(graph_nodes_v3[a], graph_nodes_v3[b], 0.048, CYAN,
                     f"GraphV3_OT_edge_{i}", sections=18)
    sphere(graph_nodes_v3[a], 0.060, CYAN, f"GraphV3_OT_jointA_{i}", subdiv=1)
    sphere(graph_nodes_v3[b], 0.060, CYAN, f"GraphV3_OT_jointB_{i}", subdiv=1)

# yellow safety cycle remains connected
for i, (a,b) in enumerate([
    ("gateway","safe1"), ("safe1","safe2"), ("safe2","safe3"),
    ("safe3","plc2")
]):
    cylinder_between(graph_nodes_v3[a], graph_nodes_v3[b], 0.056, YELLOW,
                     f"GraphV3_SAFE_edge_{i}", sections=18)

# red attacker path with a deliberate gap
cylinder_between(graph_nodes_v3["attacker"], (-4.95,-0.40,4.25), 0.050, RED,
                 "GraphV3_attacker_stub_A", sections=18)
cylinder_between((-4.20,-0.40,4.25), graph_nodes_v3["gateway"], 0.050, RED,
                 "GraphV3_attacker_stub_B", sections=18)
for i, p in enumerate(((-4.95,-0.40,4.25), (-4.20,-0.40,4.25))):
    torus(p, 0.15, 0.026, RED, f"GraphV3_cut_marker_{i}", major_sections=36, minor_sections=8)

# ---------------------------------------------------------------------
# Finish with a clean detail pass: extra clamps / bolts along high-interest
# bends and joints, while keeping the model usable in a browser.
# ---------------------------------------------------------------------
for i, p in enumerate([
    (-3.0, 1.1, 1.15), (-1.2,1.1,1.15), (1.3,1.1,1.15),
    (2.2,0.0,1.15), (-2.8,-2.3,2.15), (2.8,1.9,2.15),
]):
    torus(p, 0.19 if p[2] < 1.5 else 0.135, 0.016,
          STEEL_DARK, f"Micro_clamp_ring_{i}", major_sections=36, minor_sections=8)





def create_cable_conduit(points, radius, material, prefix):
    """Small segmented conduit / instrumentation cable run."""
    for i in range(len(points)-1):
        cylinder_between(points[i], points[i+1], radius, material,
                         f"{prefix}_{i:02d}", sections=10)
    for i,p in enumerate(points[1:-1], start=1):
        torus(p, radius*1.18, radius*0.35, material,
              f"{prefix}_joint_{i:02d}", major_sections=20, minor_sections=6)


# =====================================================================
# V4 PRESENTATION DETAIL EXPANSION
# =====================================================================
# This pass deliberately favors visible, physically plausible detail over
# minimal geometry. It adds industrial hardware, instrument plumbing,
# skids, cable management, field devices, redundant safety paths, graph
# device silhouettes, and many small fittings that read clearly in a
# cinematic 3D presentation.

# Additional materials for micro-details
BRASS = material("Brass hardware", (0.52, 0.31, 0.08), 0.78, 0.24)
COPPER = material("Copper conductor", (0.58, 0.19, 0.07), 0.78, 0.22)
PAINT_BLUE = material("Equipment blue", (0.035, 0.16, 0.32), 0.70, 0.25)
PAINT_YELLOW = material("Safety yellow paint", (0.88, 0.48, 0.015), 0.55, 0.24)
PAINT_RED = material("Isolation red paint", (0.55, 0.018, 0.012), 0.48, 0.25)
MATTE_WHITE = material("Ceramic white", (0.72, 0.74, 0.76), 0.35, 0.32)


def hex_prism(position, radius, height, mat, name, axis=(0, 0, 1)):
    """Small hex bolt / nut geometry."""
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=6)
    _orient(mesh, np.array([0.0, 0.0, 0.0]), np.asarray(axis, dtype=float))
    mesh.apply_translation(position)
    add(mesh, mat, name)


def create_bolt_circle(position, direction, radius, bolt_radius, count, mat, name):
    """Dense circular bolt pattern around a flange, hatch, or cover."""
    direction = np.asarray(direction, dtype=float)
    direction /= np.linalg.norm(direction)
    helper = np.array([1.0, 0.0, 0.0]) if abs(direction[0]) < 0.85 else np.array([0.0, 1.0, 0.0])
    u = np.cross(direction, helper); u /= np.linalg.norm(u)
    v = np.cross(direction, u)
    for i in range(count):
        a = 2.0 * math.pi * i / count
        p = np.asarray(position, dtype=float) + (u * math.cos(a) + v * math.sin(a)) * radius
        hex_prism(p, bolt_radius, bolt_radius * 1.5, mat, f"{name}_{i}", direction)


def create_pipe_clamp(position, pipe_radius, direction, name, accent=STEEL_DARK):
    """Two-piece pipe clamp with mounting studs."""
    position = np.asarray(position, dtype=float)
    direction = np.asarray(direction, dtype=float); direction /= np.linalg.norm(direction)
    # paired clamp rings
    for off in (-pipe_radius * 0.32, pipe_radius * 0.32):
        torus(position + direction * off, pipe_radius * 1.08, pipe_radius * 0.08,
              accent, f"{name}_ring_{off}", major_sections=32, minor_sections=8)
    # mounting studs
    helper = np.array([0.,0.,1.]) if abs(direction[2]) < .85 else np.array([1.,0.,0.])
    u = np.cross(direction, helper); u /= np.linalg.norm(u)
    for side in (-1, 1):
        p = position + u * (pipe_radius * 1.55) * side
        cylinder_between(p, p + np.array([0,0,-0.28]), 0.028, STEEL_DARK,
                         f"{name}_stud_{side}", sections=10)
        hex_prism(p + np.array([0,0,-0.17]), 0.055, 0.06, BOLT,
                  f"{name}_nut_{side}", axis=(0,0,1))


def create_sampling_station(position, channel, name):
    """Small process sample station: isolation valve, needle valve, gauge, drain."""
    x,y,z = position
    cylinder_between((x,y,z), (x+0.20,y,z), 0.042, STEEL,
                     f"{name}_inlet", sections=16)
    create_valve((x+0.28,y,z), channel, f"{name}_isolation", 0.38)
    cylinder_between((x+0.37,y,z), (x+0.58,y,z), 0.025, STEEL_DARK,
                     f"{name}_sample_line", sections=14)
    create_valve((x+0.64,y,z), BRASS, f"{name}_needle", 0.28)
    instrument_gauge((x+0.63,y-0.16,z+0.20),(0,-1,0),0.075,
                     f"{name}_gauge",channel)
    cylinder_between((x+0.52,y,z), (x+0.52,y,z-0.22), 0.022, STEEL_DARK,
                     f"{name}_drain", sections=10)


def create_sight_glass(position, direction, name):
    """Short inline sight-glass assembly."""
    position = np.asarray(position, dtype=float)
    direction = np.asarray(direction, dtype=float); direction /= np.linalg.norm(direction)
    body_len = 0.28
    cylinder_between(position-direction*body_len/2, position+direction*body_len/2,
                     0.075, GLASS, f"{name}_glass", sections=28)
    detailed_flange(position-direction*(body_len/2+0.035), direction, 0.105, 0.025,
                  f"{name}_flange_A", bolts=8)
    detailed_flange(position+direction*(body_len/2+0.035), direction, 0.105, 0.025,
                  f"{name}_flange_B", bolts=8)
    for side in (-1,1):
        torus(position + direction*side*0.08, 0.082, 0.012, STEEL,
              f"{name}_retainer_{side}", major_sections=28, minor_sections=7)


def create_pressure_switch(position, direction, name, accent=RED):
    """Compact pressure switch/transmitter used on critical cut/safety paths."""
    position = np.asarray(position, dtype=float)
    direction = np.asarray(direction, dtype=float); direction /= np.linalg.norm(direction)
    cylinder_between(position, position + direction*0.16, 0.05, ALUMINUM,
                     f"{name}_neck", sections=18)
    sphere(position + direction*0.25, 0.105, DARK, f"{name}_body", subdiv=2)
    sphere(position + direction*0.35, 0.025, accent, f"{name}_status", subdiv=1)
    cylinder_between(position + direction*0.18, position + direction*0.18 + np.array([0,0,0.20]),
                     0.018, STEEL_DARK, f"{name}_conduit", sections=10)


def create_led_beacon(position, name, mat=RED):
    """Stack-light / alarm beacon."""
    x,y,z = position
    cylinder_between((x,y,z), (x,y,z+0.18), 0.034, STEEL_DARK,
                     f"{name}_stem", sections=12)
    sphere((x,y,z+0.25),0.075,mat,f"{name}_dome",subdiv=2)
    torus((x,y,z+0.24),0.075,0.012,STEEL_DARK,f"{name}_base_ring",major_sections=28,minor_sections=7)


def create_platform(position, width, depth, z_height, name, rail_height=0.65):
    """Open grating-style service platform with stairs and handrails."""
    x,y,z = position
    # platform frame
    for xx in (-width/2, width/2):
        cylinder_between((x+xx,y-depth/2,z), (x+xx,y+depth/2,z), 0.034,
                         STEEL_DARK, f"{name}_frame_x_{xx}", sections=10)
    for yy in (-depth/2, depth/2):
        cylinder_between((x-width/2,y+yy,z), (x+width/2,y+yy,z), 0.034,
                         STEEL_DARK, f"{name}_frame_y_{yy}", sections=10)
    # grating strips
    for i, xx in enumerate(np.linspace(-width/2+0.05,width/2-0.05,10)):
        cylinder_between((x+xx,y-depth/2+0.04,z+0.015),(x+xx,y+depth/2-0.04,z+0.015),
                         0.012, STEEL, f"{name}_grating_{i}", sections=8)
    # rails
    for side, yy in enumerate((-depth/2, depth/2)):
        cylinder_between((x-width/2,yy,z),(x-width/2,yy,z+rail_height),0.022,STEEL,
                         f"{name}_post_a_{side}",sections=8)
        cylinder_between((x+width/2,yy,z),(x+width/2,yy,z+rail_height),0.022,STEEL,
                         f"{name}_post_b_{side}",sections=8)
        cylinder_between((x-width/2,yy,z+rail_height),(x+width/2,yy,z+rail_height),0.022,STEEL,
                         f"{name}_toprail_{side}",sections=8)
    # side rails at ends
    for xx in (-width/2,width/2):
        cylinder_between((x+xx,y-depth/2,z+rail_height),(x+xx,y+depth/2,z+rail_height),
                         0.018,STEEL,f"{name}_crossrail_{xx}",sections=8)


def create_ladder_cage(position, height, width, name):
    """Fixed vertical ladder with safety cage."""
    x,y,z = position
    for side in (-1,1):
        yy = y + side*width/2
        cylinder_between((x,yy,z),(x,yy,z+height),0.022,STEEL_DARK,
                         f"{name}_rail_{side}",sections=10)
    count = max(5,int(height/0.26))
    for i in range(count):
        zz = z+0.12+i*(height-0.24)/max(count-1,1)
        cylinder_between((x,y-width/2,zz),(x,y+width/2,zz),0.014,STEEL_DARK,
                         f"{name}_rung_{i}",sections=8)
    # cage hoops at intervals
    for i, frac in enumerate(np.linspace(0.12,0.92,5)):
        zz = z + height*frac
        torus((x,y,zz),width*0.72,0.017,STEEL,f"{name}_cage_{i}",major_sections=28,minor_sections=7)


def create_handwheel(position, radius, name, mat=STEEL_DARK):
    """Classic valve handwheel detail for manual isolation valves."""
    x,y,z = position
    torus((x,y,z),radius,0.03,mat,f"{name}_rim",major_sections=32,minor_sections=8)
    for i in range(6):
        a=2*math.pi*i/6
        cylinder_between((x,y,z),(x+radius*0.84*math.cos(a),y+radius*0.84*math.sin(a),z),
                         0.012,mat,f"{name}_spoke_{i}",sections=7)
    sphere((x,y,z),0.04,ALUMINUM,f"{name}_hub",subdiv=1)


def create_server_appliance(position, width, height, depth, accent, name):
    """Detailed logical/OT server appliance for the floating graph."""
    x,y,z=position
    box((x,y,z+height/2),(width,depth,height),DARK,f"{name}_body")
    # Front rails
    box((x,y-depth/2-0.012,z+height/2),(width*0.86,0.018,height*0.90),STEEL_DARK,
        f"{name}_front")
    # Drive bays / modules
    bay_count=max(4,int(width/0.16))
    for i in range(bay_count):
        xx=x-width*0.36+i*(width*0.72/max(bay_count-1,1))
        box((xx,y-depth/2-0.025,z+height*0.52),(0.075,0.014,height*0.18),accent,
            f"{name}_bay_{i}")
        sphere((xx,y-depth/2-0.038,z+height*0.24),0.012,WHITE,f"{name}_led_{i}",subdiv=1)
    # rack ears and feet
    for sx in (-1,1):
        box((x+sx*width*0.46,y-depth/2-0.02,z+height*0.12),(0.045,0.025,0.12),ALUMINUM,
            f"{name}_rack_ear_{sx}")


def create_plc_module(position, color, name):
    """PLC / safety PLC module with terminals and I/O cards."""
    x,y,z=position
    box((x,y,z),(0.50,0.25,0.42),DARK,f"{name}_body")
    box((x,y-0.132,z),(0.42,0.018,0.34),color,f"{name}_face")
    # I/O slots
    for i in range(6):
        xx=x-0.15+i*0.06
        box((xx,y-0.146,z+0.02),(0.035,0.010,0.22),STEEL_DARK,f"{name}_slot_{i}")
    # terminals
    for i in range(8):
        yy=y-0.15
        sphere((x-0.17+i*0.048,yy,z-0.14),0.010,ALUMINUM,f"{name}_terminal_{i}",subdiv=1)
    # status LEDs
    for i in range(4):
        sphere((x+0.16,y-0.153,z+0.12-i*0.07),0.012,color if i==0 else WHITE,
               f"{name}_led_{i}",subdiv=1)


def create_attacker_device(position,name):
    """Abstract attacker endpoint represented as a small laptop/router, no person."""
    x,y,z=position
    # laptop body
    box((x,y,z),(0.70,0.44,0.08),DARK,f"{name}_base")
    # raised display
    screen=trimesh.creation.box(extents=(0.62,0.04,0.38))
    screen.apply_translation((x,y-0.18,z+0.22))
    add(screen,RED,f"{name}_screen")
    box((x,y-0.205,z+0.22),(0.50,0.012,0.27),GLOW_RED,f"{name}_screen_glow")
    # router antennae / cables
    for i,dy in enumerate((-0.15,0.15)):
        cylinder_between((x+0.22,y+dy,z+0.05),(x+0.22,y+dy,z+0.26),0.012,RED,
                         f"{name}_antenna_{i}",sections=8)
        sphere((x+0.22,y+dy,z+0.28),0.025,RED,f"{name}_antenna_tip_{i}",subdiv=1)


# ---------------------------------------------------------------------
# 1. Make the physical process genuinely interconnected with more lines.
# ---------------------------------------------------------------------
# Pump suction / discharge risers connect the visual pipe system into the pump.
cylinder_between((-0.86,1.10,0.38),(-0.86,1.10,1.10),0.115,GREEN,
                 "Pump_suction_riser",sections=24)
cylinder_between((0.86,1.10,0.38),(0.86,1.10,1.10),0.115,GREEN,
                 "Pump_discharge_riser",sections=24)
detailed_flange((-0.86,1.10,0.38),(-1,0,0),0.145,0.035,"Pump_suction_detail",bolts=8)
detailed_flange((0.86,1.10,0.38),(1,0,0),0.145,0.035,"Pump_discharge_detail",bolts=8)

# Additional branch piping around heat exchanger.
pipe([
    (0.72,1.25,1.30),(0.72,1.80,1.30),(1.20,2.10,1.30),(2.20,2.10,1.30)
],0.10,YELLOW,"HEX_upper_branch")
pipe([
    (3.20,0.35,1.30),(3.20,-0.10,1.30),(2.80,-0.60,1.30),(2.20,-0.60,1.30)
],0.09,CYAN,"HEX_lower_branch")

for i,p in enumerate([(1.15,2.10,1.30),(2.60,2.10,1.30),(3.20,-0.10,1.30),(2.55,-0.60,1.30)]):
    create_pipe_clamp(p,0.10 if i<2 else 0.09,(0,0,1),f"HEX_pipe_clamp_{i}")

create_sight_glass((2.55,2.10,1.30),(1,0,0),"HEX_hot_sight_glass")
create_sight_glass((2.55,-0.60,1.30),(-1,0,0),"HEX_cold_sight_glass")

# ---------------------------------------------------------------------
# 2. Detailed tank top assemblies: relief valve, vent stack, sample tap,
#    instrument manifold, and platform / ladder cage.
# ---------------------------------------------------------------------
for tank_x, tank_y, tank_z, tank_r, tank_h, tag, accent in [
    (-6.0,1.7,0,1.15,2.8,"A",GREEN),
    (6.0,-1.7,0,1.05,2.5,"B",RED),
]:
    topz=tank_z+tank_h
    # relief valve and bonnet
    cylinder_between((tank_x,tank_y,topz+0.34),(tank_x,tank_y,topz+0.62),0.075,STEEL,
                     f"Tank_{tag}_relief_neck",sections=20)
    create_valve((tank_x,tank_y,topz+0.68),accent,f"Tank_{tag}_relief_valve",0.52)
    torus((tank_x,tank_y,topz+0.68),0.16,0.018,BRASS,f"Tank_{tag}_relief_ring",major_sections=28,minor_sections=8)
    # vent cap
    cylinder_between((tank_x+0.40,tank_y,topz+0.80),(tank_x+0.40,tank_y,topz+1.18),0.045,STEEL_DARK,
                     f"Tank_{tag}_vent_stack",sections=18)
    box((tank_x+0.40,tank_y,topz+1.22),(0.16,0.16,0.06),ALUMINUM,f"Tank_{tag}_vent_cap")
    # top instrument manifold: four miniature branches
    for j,dy in enumerate((-0.18,-0.06,0.06,0.18)):
        cylinder_between((tank_x+0.24,tank_y+dy,topz+0.10),(tank_x+0.46,tank_y+dy,topz+0.10),
                         0.018,STEEL_DARK,f"Tank_{tag}_manifold_line_{j}",sections=10)
        create_valve((tank_x+0.48,tank_y+dy,topz+0.10),accent,f"Tank_{tag}_manifold_valve_{j}",0.22)
    # service platform around the tank top (offset to avoid a full surface plane)
    create_platform((tank_x,tank_y,topz+0.04),tank_r*1.45,tank_r*1.05,0.04,
                    f"Tank_{tag}_top_service_platform",rail_height=0.50)
    create_ladder_cage((tank_x+tank_r*0.99,tank_y,0.0),tank_h+0.20,0.38,
                       f"Tank_{tag}_fixed_ladder")
    # beacon
    create_led_beacon((tank_x+tank_r*0.70,tank_y,topz+0.05),f"Tank_{tag}_beacon",accent)

    # sample station off the lower side
    create_sampling_station((tank_x+tank_r+0.32,tank_y-0.28,tank_h*0.30),accent,
                            f"Tank_{tag}_sample_station")

# ---------------------------------------------------------------------
# 3. Add field instrumentation on every major pipeline region.
# ---------------------------------------------------------------------
field_instruments = [
    ((-3.35,1.10,1.45),(0,0,1),GREEN,"Flow_meter_A"),
    ((-0.95,1.10,1.45),(0,0,1),GREEN,"Pressure_transmitter_B"),
    ((2.25,0.02,1.45),(0,0,1),GREEN,"Temperature_transmitter_C"),
    ((3.82,-1.00,1.45),(0,0,1),RED,"Isolation_monitor_D"),
    ((-1.48,-2.30,2.48),(0,0,1),YELLOW,"Safety_pressure_E"),
    ((1.25,-2.30,2.48),(0,0,1),YELLOW,"Safety_pressure_F"),
    ((2.80,0.30,2.48),(0,0,1),YELLOW,"Safety_temperature_G"),
]
for p,d,a,n in field_instruments:
    instrument_gauge(p,d,0.115,n,a)
    create_pressure_switch((p[0]+0.14,p[1]+0.02,p[2]-0.06),(0,0,-1),f"{n}_switch",a)

# ---------------------------------------------------------------------
# 4. Add mechanical clamps and support hardware to the most visible pipe runs.
# ---------------------------------------------------------------------
clamp_runs = [
    (protected_path if 'protected_path' in globals() else [(-4.9,1.7,1.15),(-3.5,1.7,1.15),(-3.0,1.1,1.15),(-1.2,1.1,1.15),(0,1.1,1.15),(1.3,1.1,1.15),(2.2,0,1.15),(4.9,-1.7,1.15)],0.155,"Main_green_clamp"),
    (safety_loop if 'safety_loop' in globals() else [(-2.8,-2.3,2.15),(0,-2.3,2.15),(2.8,-2.3,2.15),(2.8,1.9,2.15),(0,1.9,2.15),(-2.8,1.9,2.15),(-2.8,-2.3,2.15)],0.105,"Safety_clamp"),
]
for pts,r,prefix in clamp_runs:
    for i,p in enumerate(pts[1:-1],start=1):
        create_pipe_clamp(p,r,(0,0,1),f"{prefix}_{i}")

# ---------------------------------------------------------------------
# 5. Expand the OT control area into a visually recognizable control bay.
# ---------------------------------------------------------------------
# More cabinets
for i,(x,accent) in enumerate([(-5.00,CYAN),(-4.15,GREEN),(-3.30,CYAN),(2.75,YELLOW),(3.80,CYAN)]):
    equipment_skid((x,3.20,0.0),0.72,0.70,0.20,f"Cabinet_skid_{i}")
    control_cabinet((x,3.20,0.03),0.62,2.20,accent,f"Control_cabinet_{i}")
    # top beacon and side conduit
    create_led_beacon((x,3.20,2.33),f"Cabinet_{i}_beacon",accent)
    create_cable_conduit = globals().get("create_cable_conduit")
    if create_cable_conduit:
        create_cable_conduit([(x-0.32,3.20,1.80),(x-0.54,3.20,1.80),(x-0.54,2.88,1.80)],0.018,
                             STEEL_DARK,f"Cabinet_{i}_conduit")

# PLC I/O modules inside the visual bay
for i, x in enumerate(np.linspace(-5.00,4.05,8)):
    create_plc_module((x,2.72,0.62), GREEN if i%3 else CYAN, f"PLC_IO_module_{i}")

# Server appliances above/behind cabinets (still floating geometry)
create_server_appliance((-4.20,2.40,2.58),0.70,0.48,0.32,CYAN,"Historian_server")
create_server_appliance((-3.20,2.40,2.58),0.70,0.48,0.32,GREEN,"Engineering_server")
create_server_appliance((3.10,2.15,2.68),0.78,0.52,0.34,YELLOW,"Safety_server")
create_server_appliance((4.20,2.15,2.68),0.78,0.52,0.34,CYAN,"SCADA_server")

# ---------------------------------------------------------------------
# 6. Cable-management density: additional conduit bundles and cable glands.
# ---------------------------------------------------------------------
# Bundled data cables from field devices back to control bay.
for i, (start,end,mat,name) in enumerate([
    ((-3.75,1.78,1.88),(-4.50,2.65,2.02),GREEN,"Instrument_bundle_A"),
    ((-1.05,1.18,1.88),(-3.50,2.65,2.02),GREEN,"Instrument_bundle_B"),
    ((1.82,0.38,1.88),(0.00,2.30,2.02),CYAN,"Instrument_bundle_C"),
    ((4.30,-1.62,1.88),(2.60,1.75,2.02),RED,"Instrument_bundle_D"),
]):
    # parallel cable cores
    s=np.asarray(start,float); e=np.asarray(end,float)
    direction=e-s
    length=np.linalg.norm(direction)
    if length>0:
        perp=np.cross(direction,np.array([0,0,1],dtype=float))
        if np.linalg.norm(perp)<1e-6: perp=np.array([1,0,0],dtype=float)
        perp/=np.linalg.norm(perp)
        for j in (-2,-1,0,1,2):
            offset=perp*j*0.012
            cylinder_between(s+offset,e+offset,0.008,mat,f"{name}_core_{j}",sections=7)
        # glands at both ends
        sphere(s,0.040,STEEL_DARK,f"{name}_gland_A",subdiv=1)
        sphere(e,0.040,STEEL_DARK,f"{name}_gland_B",subdiv=1)

# ---------------------------------------------------------------------
# 7. Mechanical details on the attacker / isolation route.
# ---------------------------------------------------------------------
create_attacker_device((-5.50,-3.72,1.42),"Intrusion_endpoint")
create_led_beacon((-4.65,-3.20,1.55),"Intrusion_beacon",RED)
create_sampling_station((-3.85,-3.20,1.0),RED,"Attacker_path_monitor")

# Add small isolation actuator bodies immediately adjacent to each cut.
for i,x in enumerate((-2.0,-1.35,-0.85,-0.25)):
    box((x,-3.20,1.36),(0.18,0.20,0.14),DARK,f"Cut_actuator_{i}")
    create_led_beacon((x,-3.31,1.47),f"Cut_status_{i}",RED)

# ---------------------------------------------------------------------
# 8. Denser graph devices: logical icons rather than only spheres.
# ---------------------------------------------------------------------
# Place small logical device bodies just behind the graph node cores.
logical_devices = {
    "gateway":((-3.55,0.18,4.30),CYAN,"Graph_gateway_box"),
    "plc1":((-1.20,1.23,4.45),GREEN,"Graph_PLC_A"),
    "plc2":((1.20,1.23,4.45),GREEN,"Graph_PLC_B"),
    "hmi":((3.25,1.18,4.38),CYAN,"Graph_HMI"),
    "scada":((4.55,0.18,4.28),CYAN,"Graph_SCADA"),
    "safe1":((-1.10,-2.12,4.52),YELLOW,"Graph_Safety_A"),
    "safe2":((1.55,-2.12,4.52),YELLOW,"Graph_Safety_B"),
    "safe3":((3.10,-1.42,4.48),YELLOW,"Graph_Safety_C"),
}
for key,(p,accent,nm) in logical_devices.items():
    create_server_appliance((p[0],p[1]+0.16,p[2]-0.18),0.26,0.18,0.18,accent,nm)

create_attacker_device((-5.70,-0.58,4.05),"Graph_attacker_endpoint")

# ---------------------------------------------------------------------
# 9. Safety redundancy: add a second logical safety ring in the graph.
# ---------------------------------------------------------------------
if 'graph_nodes_v3' in globals():
    redundant_safety = [
        (graph_nodes_v3['safe1'], np.array((-1.10,-1.55,4.86))),
        (np.array((-1.10,-1.55,4.86)), np.array((1.55,-1.55,4.86))),
        (np.array((1.55,-1.55,4.86)), graph_nodes_v3['safe2']),
        (graph_nodes_v3['safe2'], graph_nodes_v3['safe3']),
    ]
    for i,(a,b) in enumerate(redundant_safety):
        cylinder_between(a,b,0.034,YELLOW,f"Redundant_safety_edge_{i}",sections=14)
        sphere(a,0.045,YELLOW,f"Redundant_safety_joint_A_{i}",subdiv=1)
        sphere(b,0.045,YELLOW,f"Redundant_safety_joint_B_{i}",subdiv=1)

# ---------------------------------------------------------------------
# 10. Add small structural cross braces to support frames.
# ---------------------------------------------------------------------
for i,(x,y) in enumerate([(-4.25,1.70),(-2.80,1.10),(-1.05,1.10),(0.55,1.10),(1.75,0.45),(3.60,-0.95)]):
    z0=0.52
    cylinder_between((x-0.30,y,z0),(x+0.30,y,1.05),0.015,STEEL_DARK,
                     f"Frame_brace_A_{i}",sections=8)
    cylinder_between((x+0.30,y,z0),(x-0.30,y,1.05),0.015,STEEL_DARK,
                     f"Frame_brace_B_{i}",sections=8)

# ---------------------------------------------------------------------
# 11. Physical safety-loop termination boxes and cable glands.
# ---------------------------------------------------------------------
for i,(x,y,z) in enumerate([
    (-2.8,-2.3,2.15),(0.0,-2.3,2.15),(2.8,-2.3,2.15),
    (2.8,1.9,2.15),(0.0,1.9,2.15),(-2.8,1.9,2.15)
]):
    junction_box((x,y,z+0.28),YELLOW,f"Safety_loop_box_{i}")
    for j,dy in enumerate((-0.045,0.045)):
        cylinder_between((x,y+dy,z+0.44),(x,y+dy,z+0.58),0.010,YELLOW,
                         f"Safety_loop_lead_{i}_{j}",sections=7)

# ---------------------------------------------------------------------
# 12. Miniature drains, vents, relief lines, and unions near major equipment.
# ---------------------------------------------------------------------
for i,(x,y,z,acc) in enumerate([
    (-4.88,1.70,0.62,GREEN),(-4.88,1.45,0.78,GREEN),
    (4.88,-1.70,0.48,RED),(4.88,-1.45,0.66,RED),
    (0.00,1.10,0.82,GREEN),(2.20,0.80,0.55,YELLOW)
]):
    cylinder_between((x,y,z),(x+0.18,y,z),0.025,STEEL_DARK,f"Mini_branch_{i}",sections=10)
    create_valve((x+0.23,y,z),acc,f"Mini_branch_valve_{i}",0.26)
    torus((x+0.20,y,z),0.045,0.010,ALUMINUM,f"Mini_union_{i}",major_sections=20,minor_sections=6)

# ---------------------------------------------------------------------
# 13. Final presentation micro-detail: repeat small bolts around major
#     equipment covers and cabinet bases.
# ---------------------------------------------------------------------
for i,(p,d,r) in enumerate([
    ((-6.0,1.7,2.80),(0,0,1),0.18),
    ((6.0,-1.7,2.50),(0,0,1),0.17),
    ((2.0,0.8,0.91),(1,0,0),0.47),
]):
    create_bolt_circle(p,d,r,0.020,12,ALUMINUM,f"Major_cover_bolts_{i}")

# ---------------------------------------------------------------------
# 14. Preserve the core SafeCut visual semantics explicitly.
# ---------------------------------------------------------------------
# Green = protected OT process connectivity
# Yellow = safety-critical redundant loop
# Red = attacker path and deliberately severed links
# Cyan = logical OT graph / supervisory network
# No floor or backing plane is added.


# ---------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------
print("Building SafeCut OT presentation-detail 3D model v4...")
print(f"Geometry objects before export: {len(scene.geometry)}")

scene.export(OUTPUT, file_type="glb")

loaded = trimesh.load(OUTPUT, force="scene")
if not loaded.geometry:
    raise RuntimeError("GLB export verification failed.")

file_size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
print()
print("SUCCESS")
print(f"GLB path: {os.path.abspath(OUTPUT)}")
print(f"Geometry objects: {len(loaded.geometry)}")
print(f"File size: {file_size_mb:.2f} MB")
print("No floor, ground plane, wall, or background surface was generated.")
