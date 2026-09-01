"use client";

import React from "react";

export default function TechStackSlide() {
  const protoStack = [
    { name: "Python",      desc: "Core engine language",             color: "bg-[#3776ab]/20 border-[#3776ab]/30 text-[#5aade0]" },
    { name: "NetworkX",    desc: "Graph modeling & algorithms",      color: "bg-purple-900/20 border-purple-500/30 text-purple-400" },
    { name: "pymodbus",    desc: "Modbus/TCP protocol layer",        color: "bg-orange-900/20 border-orange-500/30 text-orange-400" },
    { name: "nftables",    desc: "Live firewall enforcement",        color: "bg-red-900/20 border-red-500/30 text-red-400" },
    { name: "Edmonds-Karp",desc: "Min-cut solver algorithm",         color: "bg-cyan-900/20 border-cyan-500/30 text-cyan-400" },
    { name: "SVG / Canvas",desc: "Prototype visualization",          color: "bg-yellow-900/20 border-yellow-500/30 text-yellow-400" },
  ];

  const prodStack = [
    { name: "Next.js 14",       desc: "SSR + API routes",                 color: "bg-white/5 border-white/10 text-white",            why: "SSR + API in one — server renders the dashboard, API routes run the solver. No separate backend needed." },
    { name: "TypeScript",       desc: "Type-safe across all layers",       color: "bg-blue-900/20 border-blue-500/30 text-blue-400",   why: "Catches graph algorithm bugs at compile time; judges see production-quality code." },
    { name: "Node / Express",   desc: "Web API layer",                     color: "bg-green-900/20 border-green-500/30 text-green-400", why: "Handles HTTP, auth, and routing. The Python engine calls are proxied through here — Express doesn't run the min-cut." },
    { name: "Python FastAPI",   desc: "SafeCut engine service",            color: "bg-[#3776ab]/20 border-[#3776ab]/30 text-[#5aade0]", why: "Keeps NetworkX, SciPy, and nftables bindings in Python where they belong. Node calls this over HTTP." },
    { name: "Neo4j",            desc: "OT topology graph database",        color: "bg-[#018bff]/20 border-[#018bff]/30 text-[#4db8ff]", why: "Graph problem → graph database. Topology lives in Neo4j; min-cut runs against the live graph. Nodes are devices, edges are links." },
    { name: "Supabase",         desc: "Alerts, logs & certificates",       color: "bg-emerald-900/20 border-emerald-500/30 text-emerald-400", why: "Postgres + built-in auth for non-graph data: incident logs, certificates, user accounts, event timeline." },
    { name: "Nodemailer",       desc: "Instant attack alert emails",       color: "bg-indigo-900/20 border-indigo-500/30 text-indigo-400", why: "Server-side SMTP — fires an alert email the moment SafeCut detects an intrusion. EmailJS is client-side; not suited to a security tool." },
    { name: "D3.js",            desc: "Network topology visualization",    color: "bg-orange-900/20 border-orange-500/30 text-orange-400", why: "Force-directed graph rendering for the 12-node OT topology. Industry-standard for interactive network graphs." },
  ];

  return (
    <section className="w-full">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-accent-cyan/20" />
        <h2 className="text-sm font-bold tracking-widest uppercase text-accent-cyan">Production Tech Stack</h2>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-accent-cyan/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier 1: Built */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-accent-green uppercase tracking-widest">✓ Tier 1 — Built (Prototype)</span>
          </div>
          <p className="text-xs text-text-muted mb-4 font-mono">Core SafeCut engine · Validated in lab</p>
          <div className="grid grid-cols-2 gap-2">
            {protoStack.map((tech) => (
              <div key={tech.name} className={`rounded-lg px-3 py-2.5 border ${tech.color}`}>
                <div className="font-bold text-sm">{tech.name}</div>
                <div className="text-xs opacity-70 mt-0.5">{tech.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tier 2: Production Roadmap */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-accent-cyan uppercase tracking-widest">⟶ Tier 2 — Production Roadmap</span>
          </div>
          <p className="text-xs text-text-muted mb-4 font-mono">Web platform · Scalable deployment</p>
          <div className="flex flex-col gap-2">
            {prodStack.map((tech) => (
              <div
                key={tech.name}
                className={`group relative rounded-lg px-3 py-2 border ${tech.color} cursor-default transition-all hover:brightness-125`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{tech.name}</span>
                  <span className="text-[10px] opacity-60">{tech.desc}</span>
                </div>
                {/* Tooltip on hover */}
                <div className="absolute z-50 left-0 right-0 top-full mt-1 glass rounded-lg p-3 text-xs text-text-secondary opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl border border-white/10">
                  {tech.why}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Neo4j callout — the money line */}
      <div className="mt-4 glass rounded-xl p-4 border border-[#018bff]/30">
        <div className="flex items-start gap-3">
          <span className="text-xl mt-0.5">🔵</span>
          <div>
            <p className="text-sm font-bold text-[#4db8ff]">Why Neo4j? A graph problem deserves a graph database.</p>
            <p className="text-xs text-text-secondary mt-1">
              The OT topology is a graph — devices are nodes, network links are edges, and SafeCut is a graph algorithm.
              Storing the topology in Neo4j means the min-cut runs against the live graph: <span className="font-mono text-[#4db8ff]">MATCH path = (compromised)-[*]-(safety_ctrl)</span>.
              When a new device is added, it&apos;s a single <code className="text-[#4db8ff] font-mono">CREATE</code> — the solver picks it up automatically.
            </p>
          </div>
        </div>
      </div>

      {/* TRL + SDG footer */}
      <div className="mt-4 flex flex-wrap gap-3 justify-center">
        {[
          { tag: "TRL 4",  label: "Laboratory-Validated Prototype"            },
          { tag: "SDG 9",  label: "Industry, Innovation & Infrastructure"      },
          { tag: "SDG 12", label: "Responsible Consumption & Production"       },
        ].map((item) => (
          <div key={item.tag} className="glass rounded-lg px-4 py-2 text-xs text-text-secondary">
            <span className="text-accent-cyan font-bold">{item.tag}</span> · {item.label}
          </div>
        ))}
      </div>
    </section>
  );
}
