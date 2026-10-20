import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { 
  Database, 
  Cpu, 
  BarChart3, 
  Activity, 
  Terminal, 
  ExternalLink, 
  ShieldCheck, 
  CheckCircle2, 
  Layers, 
  Binary, 
  AlertTriangle,
  ArrowRight
} from "lucide-react";

export const dynamic = "force-dynamic";

const summaryPath = path.join(process.cwd(), "public", "ml-results", "summary.json");

type MetricSet = {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  macro_f1?: number;
  weighted_f1?: number;
  false_positive_rate?: number;
  false_negative_rate?: number;
  roc_auc?: number | null;
  pr_auc?: number | null;
  training_seconds?: number;
  inference_ms_per_sample?: number;
  confusion_matrix?: number[][];
  samples_tested?: number;
};

type ModelResult = { 
  validation?: MetricSet; 
  test?: MetricSet; 
  training_seconds?: number;
};

type Summary = {
  status?: string;
  message?: string;
  dataset?: string;
  is_synthetic?: boolean;
  data_origin?: string;
  data_notice?: string;
  source_file_name?: string;
  target_column?: string;
  label_counts?: { normal?: number; attack?: number };
  rows_used?: number;
  feature_count?: number;
  split_rows?: { train?: number; validation?: number; test?: number };
  best_model?: string;
  selection_metric?: string;
  generated_at_utc?: string;
  models?: Record<string, ModelResult>;
  datasets?: Record<string, { title: string; access: string; url: string }>;
  charts?: Record<string, string>;
};

async function readSummary(): Promise<Summary> {
  try {
    return JSON.parse(await fs.readFile(summaryPath, "utf8")) as Summary;
  } catch {
    return { 
      status: "not_trained", 
      message: "No benchmark results have been generated yet.", 
      models: {} 
    };
  }
}

function pct(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) 
    ? `${(value * 100).toFixed(2)}%` 
    : "—";
}

function num(value?: number | null, digits = 4) {
  return typeof value === "number" && Number.isFinite(value) 
    ? value.toFixed(digits) 
    : "—";
}

function count(value?: number) {
  return typeof value === "number" ? value.toLocaleString("en-US") : "—";
}

export default async function MlLabPage() {
  const summary = await readSummary();
  const trained = summary.status === "trained" && Object.keys(summary.models ?? {}).length > 0;
  const models = Object.entries(summary.models ?? {}).sort(
    ([, a], [, b]) => (b.test?.macro_f1 ?? -1) - (a.test?.macro_f1 ?? -1)
  );

  return (
    <main className="flex-1 py-28 relative">
      <div className="container mx-auto px-6 max-w-5xl">

        {/* ── Page Header ── */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono uppercase tracking-wider mb-4">
            <Cpu size={14} />
            <span>Research Workbench · ML Evaluation</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-semibold mb-6 tracking-tight">
            OT Threat Detection Models
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed font-sans max-w-3xl">
            Offline machine learning benchmark training and held-out evaluation for industrial cybersecurity telemetry. These classifiers evaluate anomaly detection efficacy, separate from SafeCut&apos;s real-time Edmonds-Karp min-cut physical containment engine.
          </p>
        </div>

        {!trained ? (
          /* ── Uninitialized State ── */
          <section className="mb-16">
            <Card className="p-8 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 text-primary font-mono text-xs uppercase tracking-wider mb-3">
                <AlertTriangle size={16} />
                Awaiting Dataset Training
              </div>
              <h2 className="text-2xl font-display font-medium mb-3">No benchmark results generated yet</h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6 font-sans">
                {summary.message ?? "Download an authorized dataset and execute the Python training pipeline. This page will dynamically render the held-out metrics, ROC/PR curves, and confusion matrices."}
              </p>
              
              <div className="bg-black/60 border border-white/10 p-6 rounded-sm font-mono text-xs overflow-x-auto text-primary mb-6">
                <div className="text-muted-foreground mb-2"># 1. Install dependencies and synthesize dataset</div>
                <div className="text-foreground mb-4">$ cd python-engine &amp;&amp; py -m pip install -r requirements.txt</div>
                <div className="text-muted-foreground mb-2"># 2. Run multi-model benchmark training</div>
                <div className="text-foreground">$ py -m ml.train --dataset synthetic_ot --data &quot;datasets/synthetic_ot/ot_cybersecurity_synthetic_15000.csv&quot; --target-col label</div>
              </div>
            </Card>
          </section>
        ) : (
          <>
            {/* ── Section 1: Overview & Scope ── */}
            <section className="mb-16">
              <h2 className="text-2xl font-display font-medium mb-6 border-b border-white/10 pb-4 flex items-center justify-between">
                <span>1. Benchmark Scope &amp; Architecture</span>
                <span className="text-xs font-mono text-muted-foreground font-normal uppercase tracking-wider">
                  Dataset: {summary.dataset?.toUpperCase() ?? "SYNTHETIC_OT"}
                </span>
              </h2>

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card className="p-5 bg-card/60">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Database size={13} className="text-primary" /> Dataset Rows
                  </div>
                  <div className="text-2xl font-semibold font-mono text-foreground">
                    {count(summary.rows_used)}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1">
                    Normal: {count(summary.label_counts?.normal)} | Attack: {count(summary.label_counts?.attack)}
                  </div>
                </Card>

                <Card className="p-5 bg-card/60">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Binary size={13} className="text-primary" /> Feature Space
                  </div>
                  <div className="text-2xl font-semibold font-mono text-foreground">
                    {count(summary.feature_count)}
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1">
                    Modbus, ODE physics &amp; network flows
                  </div>
                </Card>

                <Card className="p-5 bg-card/60">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Layers size={13} className="text-primary" /> Split Ratio
                  </div>
                  <div className="text-2xl font-semibold font-mono text-foreground">
                    70 / 15 / 15
                  </div>
                  <div className="text-[11px] font-mono text-muted-foreground mt-1">
                    {count(summary.split_rows?.train)} / {count(summary.split_rows?.validation)} / {count(summary.split_rows?.test)}
                  </div>
                </Card>

                <Card className="p-5 border-primary/40 bg-primary/5">
                  <div className="text-xs font-mono uppercase tracking-wider text-primary flex items-center gap-1.5 mb-2">
                    <ShieldCheck size={13} /> Top Model
                  </div>
                  <div className="text-2xl font-semibold font-mono text-foreground truncate">
                    {summary.best_model ?? "Random Forest"}
                  </div>
                  <div className="text-[11px] font-mono text-primary mt-1">
                    Selected by {summary.selection_metric ?? "macro-F1"}
                  </div>
                </Card>
              </div>

              {/* Academic Coursework & Separation Notice */}
              <Card className="p-6 border-l-4 border-l-primary bg-card/40">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded bg-primary/10 text-primary mt-0.5">
                    <Activity size={20} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-foreground font-display">
                      Synthetic Coursework Dataset &amp; Decoupled Architecture
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-sans">
                      {summary.data_notice ?? "These metrics are derived from synthesized OT attack data designed for coursework benchmarking and evaluation pipeline verification."}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono leading-relaxed pt-1">
                      SafeCut deliberately isolates statistical ML detection from automated network cuts: offline ML generates anomaly signals for operator awareness, while the core SafeCut algorithm relies strictly on graph topology and deterministic reachability proofs.
                    </p>
                  </div>
                </div>
              </Card>
            </section>

            {/* ── Section 2: Multi-Model Held-Out Benchmark ── */}
            <section className="mb-16">
              <h2 className="text-2xl font-display font-medium mb-6 border-b border-white/10 pb-4 flex items-center justify-between">
                <span>2. Multi-Model Benchmark Comparison</span>
                <span className="text-xs font-mono text-muted-foreground font-normal uppercase tracking-wider">
                  Test Split (2,250 samples)
                </span>
              </h2>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-sans">
                Each model was evaluated on a held-out test split not seen during training or hyperparameter selection. Models are sorted by held-out Macro-F1 score.
              </p>

              <div className="overflow-x-auto rounded-sm border border-white/10 bg-black/40">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-muted-foreground uppercase text-[11px] tracking-wider">
                      <th className="py-3.5 px-4 font-semibold text-foreground">Model Architecture</th>
                      <th className="py-3.5 px-3 font-semibold text-right">Accuracy</th>
                      <th className="py-3.5 px-3 font-semibold text-right">Precision</th>
                      <th className="py-3.5 px-3 font-semibold text-right">Recall</th>
                      <th className="py-3.5 px-3 font-semibold text-right">F1-Score</th>
                      <th className="py-3.5 px-3 font-semibold text-right text-primary">Macro-F1</th>
                      <th className="py-3.5 px-3 font-semibold text-right">FPR</th>
                      <th className="py-3.5 px-3 font-semibold text-right">FNR</th>
                      <th className="py-3.5 px-3 font-semibold text-right">ROC-AUC</th>
                      <th className="py-3.5 px-3 font-semibold text-right">Latency (ms)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {models.map(([name, item]) => {
                      const isBest = name === summary.best_model;
                      return (
                        <tr 
                          key={name}
                          className={`transition-colors hover:bg-white/[0.02] ${
                            isBest ? "bg-primary/[0.07]" : ""
                          }`}
                        >
                          <td className="py-3 px-4 font-medium text-foreground flex items-center gap-2">
                            {name}
                            {isBest && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary border border-primary/30 uppercase font-mono">
                                <CheckCircle2 size={10} /> Top
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right tabular-nums text-foreground">{pct(item.test?.accuracy)}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-foreground">{pct(item.test?.precision)}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-foreground">{pct(item.test?.recall)}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-foreground">{pct(item.test?.f1)}</td>
                          <td className="py-3 px-3 text-right tabular-nums font-bold text-primary">{pct(item.test?.macro_f1)}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">{pct(item.test?.false_positive_rate)}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">{pct(item.test?.false_negative_rate)}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-foreground">{num(item.test?.roc_auc)}</td>
                          <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">{num(item.test?.inference_ms_per_sample, 4)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Section 3: Comparative Evaluation Curves ── */}
            <section className="mb-16">
              <h2 className="text-2xl font-display font-medium mb-6 border-b border-white/10 pb-4 flex items-center justify-between">
                <span>3. Comparative Metric Curves</span>
                <span className="text-xs font-mono text-muted-foreground font-normal uppercase tracking-wider">
                  Generated Visualizations
                </span>
              </h2>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-sans">
                Performance curves generated by the Python evaluation runbook, contrasting ensemble trees against linear classifiers across five core classification metrics.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  {
                    title: "Macro F1-Score (Balanced Class Metric)",
                    file: "macro-f1.png",
                    desc: "Equally weights normal plant telemetry and rare multi-stage attack vectors, eliminating majority-class skew.",
                  },
                  {
                    title: "Attack Detection Recall",
                    file: "recall.png",
                    desc: "Measures sensitivity to unauthorized Modbus writes and thermal excursions. Minimizes false negative rate.",
                  },
                  {
                    title: "Attack Detection Precision",
                    file: "precision.png",
                    desc: "Probability that an alert corresponds to genuine adversary intrusion, minimizing operational disruption.",
                  },
                  {
                    title: "Overall Test Accuracy",
                    file: "accuracy.png",
                    desc: "Aggregate proportion of correctly classified normal and attack observations across 2,250 held-out samples.",
                  },
                ].map((chart) => (
                  <Card key={chart.file} className="p-5 flex flex-col justify-between bg-card/60">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold font-display text-foreground">{chart.title}</h3>
                        <span className="text-[10px] font-mono text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                          {chart.file}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-sans mb-4 leading-relaxed">
                        {chart.desc}
                      </p>
                    </div>
                    <div className="rounded border border-white/10 overflow-hidden bg-black/60 p-2">
                      <img 
                        src={`/ml-results/${chart.file}`} 
                        alt={chart.title}
                        className="w-full h-auto object-contain rounded"
                      />
                    </div>
                  </Card>
                ))}
              </div>
            </section>

            {/* ── Section 4: Confusion Matrices ── */}
            <section className="mb-16">
              <h2 className="text-2xl font-display font-medium mb-6 border-b border-white/10 pb-4 flex items-center justify-between">
                <span>4. Confusion Matrices</span>
                <span className="text-xs font-mono text-muted-foreground font-normal uppercase tracking-wider">
                  True vs Predicted Classes
                </span>
              </h2>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-sans">
                Detailed classification distribution on 2,250 test observations. Rows indicate actual plant state (Normal / Attack), and columns represent model predictions.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {models.map(([name]) => {
                  const slug = name.toLowerCase().replace(/\s+/g, "-");
                  const isBest = name === summary.best_model;
                  return (
                    <Card 
                      key={name} 
                      className={`p-4 flex flex-col justify-between bg-card/60 ${
                        isBest ? "border-primary/40 ring-1 ring-primary/20" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold font-display text-foreground">{name}</span>
                        {isBest && (
                          <span className="text-[10px] font-mono text-primary uppercase font-bold">Top Choice</span>
                        )}
                      </div>
                      <div className="rounded border border-white/10 overflow-hidden bg-black/60 p-2 mb-3">
                        <img 
                          src={`/ml-results/confusion-${slug}.png`} 
                          alt={`${name} Confusion Matrix`}
                          className="w-full h-auto object-contain rounded"
                        />
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground text-center">
                        Rows: True Class · Cols: Predicted Class
                      </p>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* ── Section 5: Academic Runbook & Benchmark Datasets ── */}
            <section className="mb-16">
              <h2 className="text-2xl font-display font-medium mb-6 border-b border-white/10 pb-4 flex items-center justify-between">
                <span>5. Academic Runbook &amp; External Datasets</span>
                <span className="text-xs font-mono text-muted-foreground font-normal uppercase tracking-wider">
                  Reproducible Pipeline
                </span>
              </h2>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6 font-sans">
                To replicate benchmark numbers or train against external industrial datasets (e.g., SWaT water treatment testbed or UNSW TON_IoT), execute the reproducible pipeline commands below.
              </p>

              {/* Terminal Snippet */}
              <div className="bg-black/70 border border-white/10 p-6 rounded-sm font-mono text-xs overflow-x-auto text-primary mb-8">
                <div className="flex items-center gap-2 text-muted-foreground pb-3 mb-3 border-b border-white/10 text-[11px]">
                  <Terminal size={14} />
                  <span>POWERSHELL REPRODUCIBILITY HARNESS</span>
                </div>
                <div className="text-muted-foreground mb-1"># Navigate to Python ML engine and install dependencies</div>
                <div className="text-foreground mb-4">$ cd python-engine &amp;&amp; py -m pip install -r requirements.txt</div>

                <div className="text-muted-foreground mb-1"># Optional: Generate synthetic 15,000-row OT dataset</div>
                <div className="text-foreground mb-4">$ py -m ml.generate_synthetic_ot --rows 15000</div>

                <div className="text-muted-foreground mb-1"># Run multi-model benchmark and render charts into public/ml-results/</div>
                <div className="text-foreground mb-2">$ py -m ml.train --dataset synthetic_ot --data &quot;datasets/synthetic_ot/ot_cybersecurity_synthetic_15000.csv&quot; --target-col label --max-rows 0</div>
              </div>

              {/* External Datasets Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card className="p-6 bg-card/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold font-display text-foreground">
                        SWaT (Secure Water Treatment)
                      </h3>
                      <span className="text-xs font-mono text-muted-foreground uppercase">iTrust / SUTD</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed font-sans mb-6">
                      A physical water treatment testbed coordinated by Singapore University of Technology and Design. Features 51 physical sensors and actuators subjected to 36 physical attack scenarios.
                    </p>
                  </div>
                  <a 
                    href="https://itrust.sutd.edu.sg/itrust-labs/datasets/"
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-mono text-primary hover:underline"
                  >
                    <span>Request Academic Access from iTrust SUTD</span>
                    <ExternalLink size={13} />
                  </a>
                </Card>

                <Card className="p-6 bg-card/60 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold font-display text-foreground">
                        TON_IoT Industrial Dataset
                      </h3>
                      <span className="text-xs font-mono text-muted-foreground uppercase">UNSW Canberra</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed font-sans mb-6">
                      Heterogeneous industrial IoT testbed developed by the Cyber Range Lab at UNSW Canberra. Includes telemetry from Modbus, operating systems, and network packet traces under diverse cyberattacks.
                    </p>
                  </div>
                  <a 
                    href="https://research.unsw.edu.au/projects/toniot-datasets"
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-mono text-primary hover:underline"
                  >
                    <span>Official UNSW TON_IoT Project Page</span>
                    <ExternalLink size={13} />
                  </a>
                </Card>
              </div>

              {/* Navigation Back link */}
              <div className="mt-12 flex items-center justify-between pt-6 border-t border-white/10 text-xs font-mono text-muted-foreground">
                <span>Generated: {summary.generated_at_utc ?? "2026-03-31 UTC"}</span>
                <Link 
                  href="/simulation"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <span>Explore Interactive Simulation</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </section>
          </>
        )}

      </div>
    </main>
  );
}
