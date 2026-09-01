import type { OTGraph, SafetyLoop } from "@/types";

// ─── 12-node OT Topology Definition ──────────────────────────────────────────
//
//  Node list:
//   PLC_01, PLC_02, PLC_03, PLC_04
//   TEMP_SENSOR, PRESSURE_SENSOR
//   COOL_VALVE, PRESSURE_VALVE
//   HMI, SCADA, HISTORIAN
//   SAFETY_CTRL
//
//  Safety loops (edges pinned to Infinity capacity):
//   COOLING_LOOP:      TEMP_SENSOR ↔ SAFETY_CTRL ↔ COOL_VALVE
//   PRESSURE_LOOP:     PRESSURE_SENSOR ↔ SAFETY_CTRL ↔ PRESSURE_VALVE
//   ESD_LOOP:          PLC_04 ↔ SAFETY_CTRL
//   ALARM_LOOP:        SCADA ↔ SAFETY_CTRL
// ─────────────────────────────────────────────────────────────────────────────

export const OT_TOPOLOGY: OTGraph = {
  nodes: [
    { id: "PLC_01",           label: "PLC 01\n(Main Controller)",   type: "PLC",             isSafetyCritical: false },
    { id: "PLC_02",           label: "PLC 02\n(Process Ctrl)",      type: "PLC",             isSafetyCritical: false },
    { id: "PLC_03",           label: "PLC 03\n(Aux Controller)",    type: "PLC",             isSafetyCritical: false },
    { id: "PLC_04",           label: "PLC 04\n(ESD Controller)",    type: "PLC",             isSafetyCritical: true  },
    { id: "TEMP_SENSOR",      label: "Temp\nSensor",                type: "Sensor",          isSafetyCritical: true  },
    { id: "PRESSURE_SENSOR",  label: "Pressure\nSensor",            type: "Sensor",          isSafetyCritical: true  },
    { id: "COOL_VALVE",       label: "Cooling\nValve",              type: "Actuator",        isSafetyCritical: true  },
    { id: "PRESSURE_VALVE",   label: "Pressure\nValve",             type: "Actuator",        isSafetyCritical: true  },
    { id: "HMI",              label: "HMI",                         type: "HMI",             isSafetyCritical: false },
    { id: "SCADA",            label: "SCADA\nServer",               type: "SCADA",           isSafetyCritical: false },
    { id: "HISTORIAN",        label: "Historian",                   type: "Historian",       isSafetyCritical: false },
    { id: "SAFETY_CTRL",      label: "Safety\nController (SIS)",    type: "SafetyController", isSafetyCritical: true },
  ],

  edges: [
    // ── Normal OT network links (capacity = 1) ──────────────────────────────
    { source: "PLC_01",          target: "PLC_02",          capacity: 1,        isSafetyLoop: false },
    { source: "PLC_01",          target: "PLC_03",          capacity: 1,        isSafetyLoop: false },
    { source: "PLC_01",          target: "HMI",             capacity: 1,        isSafetyLoop: false },
    { source: "PLC_02",          target: "PLC_03",          capacity: 1,        isSafetyLoop: false },
    { source: "PLC_02",          target: "TEMP_SENSOR",     capacity: 1,        isSafetyLoop: false },
    { source: "PLC_02",          target: "COOL_VALVE",      capacity: 1,        isSafetyLoop: false },
    { source: "PLC_03",          target: "PRESSURE_SENSOR", capacity: 1,        isSafetyLoop: false },
    { source: "PLC_03",          target: "PRESSURE_VALVE",  capacity: 1,        isSafetyLoop: false },
    { source: "PLC_04",          target: "PLC_01",          capacity: 1,        isSafetyLoop: false },
    { source: "HMI",             target: "SCADA",           capacity: 1,        isSafetyLoop: false },
    { source: "SCADA",           target: "HISTORIAN",       capacity: 1,        isSafetyLoop: false },

    // ── Safety-loop edges (capacity = Infinity — cannot be cut) ────────────
    { source: "TEMP_SENSOR",     target: "SAFETY_CTRL",     capacity: Infinity, isSafetyLoop: true,  safetyLoopId: "COOLING_LOOP"   },
    { source: "COOL_VALVE",      target: "SAFETY_CTRL",     capacity: Infinity, isSafetyLoop: true,  safetyLoopId: "COOLING_LOOP"   },
    { source: "PRESSURE_SENSOR", target: "SAFETY_CTRL",     capacity: Infinity, isSafetyLoop: true,  safetyLoopId: "PRESSURE_LOOP"  },
    { source: "PRESSURE_VALVE",  target: "SAFETY_CTRL",     capacity: Infinity, isSafetyLoop: true,  safetyLoopId: "PRESSURE_LOOP"  },
    { source: "PLC_04",          target: "SAFETY_CTRL",     capacity: Infinity, isSafetyLoop: true,  safetyLoopId: "ESD_LOOP"       },
    { source: "SCADA",           target: "SAFETY_CTRL",     capacity: Infinity, isSafetyLoop: true,  safetyLoopId: "ALARM_LOOP"     },
  ],
};

// ─── Named safety loops with their constituent edges ─────────────────────────

export const SAFETY_LOOPS: SafetyLoop[] = [
  {
    id: "COOLING_LOOP",
    name: "Cooling Loop",
    edges: [
      { source: "TEMP_SENSOR",  target: "SAFETY_CTRL" },
      { source: "COOL_VALVE",   target: "SAFETY_CTRL" },
    ],
  },
  {
    id: "PRESSURE_LOOP",
    name: "Pressure Control Loop",
    edges: [
      { source: "PRESSURE_SENSOR", target: "SAFETY_CTRL" },
      { source: "PRESSURE_VALVE",  target: "SAFETY_CTRL" },
    ],
  },
  {
    id: "ESD_LOOP",
    name: "Emergency Shutdown Loop",
    edges: [{ source: "PLC_04", target: "SAFETY_CTRL" }],
  },
  {
    id: "ALARM_LOOP",
    name: "Alarm & Monitoring Loop",
    edges: [{ source: "SCADA", target: "SAFETY_CTRL" }],
  },
];
