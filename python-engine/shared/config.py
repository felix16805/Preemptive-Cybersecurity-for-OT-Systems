"""Shared configuration for SafeCut. Imported by both laptops."""

# ---- Network (direct Ethernet cable, static IPs, no gateway) ----
BLUE_IP = "10.0.0.2"      # defender: plant + solver + enforcement
RED_IP  = "10.0.0.1"      # attacker
MODBUS_PORT = 502          # needs root on Linux; use 5020 for unprivileged dev

# ---- Modbus register map (holding registers) ----
# Values are scaled x10 and stored as ints, since Modbus registers are 16-bit ints.
REG_TEMP    = 0    # sensor:   reactor temperature T   (read by SIS + attacker)
REG_COOLANT = 1    # actuator: coolant temp Tc         (written by SIS)
REG_FEED    = 10   # disturbance: feed temp T0         (written by ATTACKER)
SCALE = 10.0       # register_value = real_value * SCALE

# Registers an external client is NEVER allowed to write. A write here = attack.
FORBIDDEN_WRITES = {REG_FEED}

# ---- Process safety thresholds (deg K) ----
T_SETPOINT = 350.0
T_TRIP     = 355.0   # SIS trips above this
T_RUNAWAY  = 400.0   # "explosion" / disaster threshold for scoring
T_FEED_ATTACK = 430.0  # value attacker slams into the feed-temp register

# ---- Demo timing ----
SIM_DT   = 0.05      # integration step (s of process time)
STEPS_PER_RUN = 1200 # ~ one scenario
FRAME_MS = 20        # dashboard frame interval (wall-clock)

# ---- OT topology: nodes and links (capacity 1 = a normal severable link) ----
# The safety instrumented loop is Sensor_T -> SIS -> Actuator_Cool.
# Realistic TRITON/TRISIS vector: the engineering workstation has a management
# link straight to the safety controller (that's how TRITON reached Triconex).
# Blindly quarantining the EWS "zone" therefore also tears down the SIS's links
# to its sensor and actuator -> safety loop dies. SafeCut instead cuts only the
# EWS's links while the SIF edges are protected, routing containment around them.
NODES = [
    "EngWorkstation", "Historian", "HMI",
    "PLC1", "PLC2", "Sensor_T", "Actuator_Cool", "SIS",
]

# (u, v, capacity). INF-capacity edges are set inside the solver for the SIF paths.
LINKS = [
    ("EngWorkstation", "HMI", 1),
    ("EngWorkstation", "Historian", 1),
    ("EngWorkstation", "SIS", 1),      # management link -- the TRITON vector
    ("HMI", "PLC1", 1),
    ("HMI", "PLC2", 1),
    ("Historian", "PLC1", 1),
    ("PLC1", "Sensor_T", 1),
    ("PLC2", "Actuator_Cool", 1),
    ("Sensor_T", "SIS", 1),            # SIF edge (protected in SafeCut)
    ("SIS", "Actuator_Cool", 1),       # SIF edge (protected in SafeCut)
    ("PLC1", "PLC2", 1),
]

# Where an intruder lands after lateral movement (entry foothold).
ATTACKER_NODE = "EngWorkstation"

# Critical assets that must remain reachable from the safety controller.
CRITICAL = ["Sensor_T", "Actuator_Cool"]

# Safety Instrumented Functions: (node_a, node_b) paths that MUST survive any cut.
SIF_PATHS = [("SIS", "Sensor_T"), ("SIS", "Actuator_Cool")]
