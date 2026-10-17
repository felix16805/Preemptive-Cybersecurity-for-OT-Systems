import type { OTGraph, SafetyLoop, OTNode, OTEdge } from "@/types";
import { INF_CAPACITY } from "@/types";

// ─── 12-node OT Topology Definition ──────────────────────────────────────────
//
//  Node list:
//   PLC_01, PLC_02, PLC_03, PLC_04
//   TEMP_SENSOR, PRESSURE_SENSOR
//   COOL_VALVE, PRESSURE_VALVE
//   HMI, SCADA, HISTORIAN
//   SAFETY_CTRL
//
//  Safety loops (edges with protectedFromCut = true):
//   COOLING_LOOP:      TEMP_SENSOR ↔ SAFETY_CTRL ↔ COOL_VALVE
//   PRESSURE_LOOP:     PRESSURE_SENSOR ↔ SAFETY_CTRL ↔ PRESSURE_VALVE
//   ESD_LOOP:          PLC_04 ↔ SAFETY_CTRL
//   ALARM_LOOP:        SCADA ↔ SAFETY_CTRL
// ─────────────────────────────────────────────────────────────────────────────

export const OT_TOPOLOGY: OTGraph = {
  nodes: [
    { id: "PLC_01",           label: "PLC 01\n(Main Controller)",   type: "PLC",             isSafetyCritical: false, criticality: 3 },
    { id: "PLC_02",           label: "PLC 02\n(Process Ctrl)",      type: "PLC",             isSafetyCritical: false, criticality: 4 },
    { id: "PLC_03",           label: "PLC 03\n(Aux Controller)",    type: "PLC",             isSafetyCritical: false, criticality: 3 },
    { id: "PLC_04",           label: "PLC 04\n(ESD Controller)",    type: "PLC",             isSafetyCritical: true,  criticality: 9 },
    { id: "TEMP_SENSOR",      label: "Temp\nSensor",                type: "Sensor",          isSafetyCritical: true,  criticality: 8 },
    { id: "PRESSURE_SENSOR",  label: "Pressure\nSensor",            type: "Sensor",          isSafetyCritical: true,  criticality: 8 },
    { id: "COOL_VALVE",       label: "Cooling\nValve",              type: "Actuator",        isSafetyCritical: true,  criticality: 8 },
    { id: "PRESSURE_VALVE",   label: "Pressure\nValve",             type: "Actuator",        isSafetyCritical: true,  criticality: 8 },
    { id: "HMI",              label: "HMI",                         type: "HMI",             isSafetyCritical: false, criticality: 5 },
    { id: "SCADA",            label: "SCADA\nServer",               type: "SCADA",           isSafetyCritical: false, criticality: 6 },
    { id: "HISTORIAN",        label: "Historian",                   type: "Historian",       isSafetyCritical: false, criticality: 2 },
    { id: "SAFETY_CTRL",      label: "Safety\nController (SIS)",    type: "SafetyController", isSafetyCritical: true,  criticality: 10 },
  ],

  edges: [
    // ── Normal OT network links (capacity = 1) ──────────────────────────────
    { source: "PLC_01",          target: "PLC_02",          capacity: 1,        isSafetyLoop: false, protectedFromCut: false },
    { source: "PLC_01",          target: "PLC_03",          capacity: 1,        isSafetyLoop: false, protectedFromCut: false },
    { source: "PLC_01",          target: "HMI",             capacity: 1,        isSafetyLoop: false, protectedFromCut: false },
    { source: "PLC_02",          target: "PLC_03",          capacity: 1,        isSafetyLoop: false, protectedFromCut: false },
    { source: "PLC_02",          target: "TEMP_SENSOR",     capacity: 1,        isSafetyLoop: false, protectedFromCut: false },
    { source: "PLC_02",          target: "COOL_VALVE",      capacity: 1,        isSafetyLoop: false, protectedFromCut: false },
    { source: "PLC_03",          target: "PRESSURE_SENSOR", capacity: 1,        isSafetyLoop: false, protectedFromCut: false },
    { source: "PLC_03",          target: "PRESSURE_VALVE",  capacity: 1,        isSafetyLoop: false, protectedFromCut: false },
    { source: "PLC_04",          target: "PLC_01",          capacity: 1,        isSafetyLoop: false, protectedFromCut: false },
    { source: "HMI",             target: "SCADA",           capacity: 1,        isSafetyLoop: false, protectedFromCut: false },
    { source: "SCADA",           target: "HISTORIAN",       capacity: 1,        isSafetyLoop: false, protectedFromCut: false },

    // ── Safety-loop edges (capacity = INF_CAPACITY, protectedFromCut = true) ──
    { source: "TEMP_SENSOR",     target: "SAFETY_CTRL",     capacity: INF_CAPACITY, isSafetyLoop: true,  protectedFromCut: true, safetyLoopId: "COOLING_LOOP"   },
    { source: "COOL_VALVE",      target: "SAFETY_CTRL",     capacity: INF_CAPACITY, isSafetyLoop: true,  protectedFromCut: true, safetyLoopId: "COOLING_LOOP"   },
    { source: "PRESSURE_SENSOR", target: "SAFETY_CTRL",     capacity: INF_CAPACITY, isSafetyLoop: true,  protectedFromCut: true, safetyLoopId: "PRESSURE_LOOP"  },
    { source: "PRESSURE_VALVE",  target: "SAFETY_CTRL",     capacity: INF_CAPACITY, isSafetyLoop: true,  protectedFromCut: true, safetyLoopId: "PRESSURE_LOOP"  },
    { source: "PLC_04",          target: "SAFETY_CTRL",     capacity: INF_CAPACITY, isSafetyLoop: true,  protectedFromCut: true, safetyLoopId: "ESD_LOOP"       },
    { source: "SCADA",           target: "SAFETY_CTRL",     capacity: INF_CAPACITY, isSafetyLoop: true,  protectedFromCut: true, safetyLoopId: "ALARM_LOOP"     },
  ],
};

// ─── Named safety loops with their constituent edges ─────────────────────────

export const SAFETY_LOOPS: SafetyLoop[] = [
  {
    id: "COOLING_LOOP",
    name: "Cooling Loop",
    source: "TEMP_SENSOR",
    controller: "SAFETY_CTRL",
    actuator: "COOL_VALVE",
    required: true,
    edges: [
      { source: "TEMP_SENSOR",  target: "SAFETY_CTRL" },
      { source: "COOL_VALVE",   target: "SAFETY_CTRL" },
    ],
  },
  {
    id: "PRESSURE_LOOP",
    name: "Pressure Control Loop",
    source: "PRESSURE_SENSOR",
    controller: "SAFETY_CTRL",
    actuator: "PRESSURE_VALVE",
    required: true,
    edges: [
      { source: "PRESSURE_SENSOR", target: "SAFETY_CTRL" },
      { source: "PRESSURE_VALVE",  target: "SAFETY_CTRL" },
    ],
  },
  {
    id: "ESD_LOOP",
    name: "Emergency Shutdown Loop",
    source: "PLC_04",
    controller: "SAFETY_CTRL",
    actuator: "PLC_04",
    required: true,
    edges: [{ source: "PLC_04", target: "SAFETY_CTRL" }],
  },
  {
    id: "ALARM_LOOP",
    name: "Alarm & Monitoring Loop",
    source: "SCADA",
    controller: "SAFETY_CTRL",
    actuator: "SCADA",
    required: false,
    edges: [{ source: "SCADA", target: "SAFETY_CTRL" }],
  },
];