"use client";

import React, { useState, useRef, useEffect } from "react";
import type { AttackEvent, AttackPhase } from "@/types";

interface Props {
  onAttackStart: (node: string) => void;
  currentPhase: AttackPhase;
  events: AttackEvent[];
  compromisedNode: string;
  addEvent: (phase: AttackPhase, desc: string, target?: string) => void;
  setPhase: (phase: AttackPhase) => void;
}

const TARGET_NODES = ["PLC_02"]; // Forced simulated match as per spec

export default function AttackerConsole({ onAttackStart, currentPhase, events, compromisedNode, addEvent, setPhase }: Props) {
  const [selectedTarget, setSelectedTarget] = useState("PLC_02");
  const [input, setInput] = useState("");
  const [terminalLines, setTerminalLines] = useState<{ text: string; isInput: boolean }[]>([
    { text: "SafeCut Adversary Emulation Shell v1.0", isInput: false },
    { text: "Type 'help' for available commands.", isInput: false },
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLines]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    setTerminalLines(prev => [...prev, { text: `$ ${cmd}`, isInput: true }]);
    setInput("");

    const args = cmd.split(" ");
    const baseCmd = args[0].toLowerCase();

    // Simulated terminal response delay
    setTimeout(() => {
      let output = "";
      switch (baseCmd) {
        case "help":
          output = `Available commands:\n  recon --target <ip>\n  scan --ports\n  exploit --target <ip>\n  lateral --to <node>\n  impact --write <data>\n  status\n  clear\n  help`;
          break;
        case "clear":
          setTerminalLines([]);
          return;
        case "status":
          output = `Current phase: ${currentPhase.toUpperCase()}`;
          break;
        case "recon":
          if (currentPhase === "idle") setPhase("recon");
          output = `[SIMULATED] Discovering node 192.168.10.102 (PLC_02). OS: VxWorks.`;
          addEvent("recon", "Reconnaissance: Target 192.168.10.102 discovered");
          break;
        case "scan":
          if (currentPhase === "recon" || currentPhase === "idle") setPhase("recon");
          output = `[SIMULATED] Port scan complete.\n[OPEN] 192.168.10.102:502 (Modbus/TCP)`;
          addEvent("recon", "Scan: Modbus port 502 open on PLC_02");
          break;
        case "exploit":
          output = `[SIMULATED] Executing payload against 192.168.10.102:502...\n[+] Exploit successful. Root access obtained.`;
          onAttackStart("PLC_02"); // Triggers the detection in dashboard
          break;
        case "lateral":
          const toNode = args.find(a => a.startsWith("--to="))?.split("=")[1] || args[args.indexOf("--to") + 1];
          if (toNode) {
             output = `[SIMULATED] Pivoting to ${toNode}...`;
             // In dashboard, the state handles lateral movement path. We can just add event here if we want manual control.
          } else {
             output = `Usage: lateral --to <node_id>`;
          }
          break;
        case "impact":
          output = `[REAL TRAFFIC] Writing to Modbus register... feed_temp=430`;
          // If we want manual control over the phases, we can invoke addEvent.
          break;
        default:
          output = `Command not recognized: ${baseCmd}`;
      }
      if (output) {
        setTerminalLines(prev => [...prev, { text: output, isInput: false }]);
      }
    }, 400);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Target selector (Simulated restriction) ── */}
      <div className="glass p-4 flex flex-col gap-2 rounded-xl">
        <label className="text-xs text-text-muted uppercase tracking-wider font-semibold">Simulated Target IP</label>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-bg-surface border border-white/10 rounded-lg text-sm font-mono text-text-primary flex-1">
            192.168.10.102 (PLC_02)
          </div>
        </div>
      </div>

      {/* ── Terminal ── */}
      <div className="relative flex-1 glass rounded-xl p-4 font-mono text-xs flex flex-col min-h-[250px]">
        <div className="absolute inset-0 scanlines pointer-events-none opacity-50" />
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-accent-red/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-accent-amber/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-accent-green/60" />
          </div>
          <span className="text-text-muted text-[10px] uppercase tracking-widest ml-2">adversary-shell</span>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 mb-2 pr-2 text-accent-green/90 leading-relaxed text-[11px] pb-4">
          {terminalLines.map((line, i) => (
            <div key={i} className={`whitespace-pre-wrap ${line.isInput ? "text-white" : ""}`}>
              {line.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleCommand} className="relative z-10 flex items-center border-t border-white/10 pt-3 mt-auto">
          <span className="text-accent-green mr-2 text-sm">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={currentPhase === "contained"}
            className="flex-1 bg-transparent border-none outline-none text-white font-mono text-xs placeholder:text-white/20"
            placeholder={currentPhase === "contained" ? "Connection terminated." : "Enter command (e.g. exploit --target 192.168.10.102)"}
            autoComplete="off"
            spellCheck="false"
          />
        </form>
      </div>

      {/* ── Event log ── */}
      <div className="glass rounded-xl p-4 max-h-48 flex flex-col">
        <p className="text-[10px] text-text-muted mb-3 uppercase tracking-widest font-bold">Simulated Event Log</p>
        <div className="flex-1 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-text-muted font-mono opacity-50">Awaiting actions...</p>
          ) : (
            <div className="flex flex-col gap-2">
              {[...events].reverse().map((ev, i) => (
                <div key={i} className="flex items-start gap-3 text-xs border-l-2 border-white/5 pl-3">
                  <span className="text-text-muted font-mono text-[10px] whitespace-nowrap mt-0.5">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour12: false })}
                  </span>
                  <span className={`font-mono text-[11px] ${
                    ev.phase === "exploitation" || ev.phase === "impact" ? "text-accent-red" :
                    ev.phase === "lateral_movement" ? "text-accent-amber" :
                    ev.phase === "contained" ? "text-accent-green" : "text-text-secondary"
                  }`}>
                    {ev.description}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
