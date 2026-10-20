# SafeCut — Preemptive Cybersecurity for OT Systems (merged build)

SafeCut isolates an industrial network intrusion using a safety-constrained
minimum cut, so the attacker is contained **without** severing the
safety-instrumented loops that keep a plant from running away. This repository
is the merged project: the polished Next.js web platform plus the real
Modbus/TCP Python engine, wired so both can drive the same Defender Console.

See **DEMO_STEPS.txt** for the step-by-step two-laptop live demo.

---

## What is in here

```
app/                 Next.js 16 App Router — marketing site, /console, /simulation, API routes
components/          React UI (consoles, topology, reactor chart, 3D hero, nav)
lib/                 safecut-engine (Edmonds-Karp + certificate), cstr-model, ot-topology,
                     neo4j / supabase / mailer integrations (all optional, graceful fallback)
attacker-cli/        TypeScript adversary terminal, attacks over the local network / hotspot
python-engine/       Real Modbus/TCP plant + attacker + bridge (the industrial-protocol path)
supabase/schema.sql  Optional incident-log schema
```

## Two attack paths, one console

- **Path A: Attacker CLI over the hotspot.** `attacker-cli/` sends session-paired
  events to `/api/attack-event` on the defender's local IP (same Wi-Fi or phone
  hotspot). It asks for the IP, diagnoses connection problems and remembers it.
- **Path B — Real Modbus/TCP.** `python-engine/bridge.py` hosts a genuine Modbus
  plant on the defender laptop; the Python attacker writes a real register from
  the second laptop; the bridge detects it and forwards it to the same console.

Both end up in the Defender Console incident stream with the SafeCut result
(cut edges, per-loop certificate, reactor stability).

## Quick start (single machine)

```bash
npm install
# no .env needed: demo mode is on by default
npm run build && npm start      # http://localhost:3000
```

Open `http://localhost:3000/console`. Drive it with either attack path, or with
the on-page **Trigger SafeCut** / **Blind Quarantine** buttons.


## ML dataset training and evaluation

The ZIP includes a **15,000-row synthetic OT cybersecurity dataset**, the trained Random Forest artifact, held-out test results for five ML classifiers, comparison CSV/JSON files, confusion matrices, and metric charts. Start the web app and open `/ml-lab` to see the included results. To reproduce training on Windows PowerShell, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\RUN_SYNTHETIC_ML.ps1
```

The pipeline compares Logistic Regression, Decision Tree, Random Forest, Extra Trees, and Linear SVM. It reports accuracy, attack precision/recall/F1, macro-F1, false-positive/false-negative rates, ROC-AUC/PR-AUC where available, training/inference time, confusion matrices, and metric plots.

**Academic limitation:** the bundled dataset is generated from project-authored statistical distributions and simulated attack perturbations. It is not captured from a real industrial plant. The scores measure performance only on this synthetic coursework dataset and must not be described as real-world validation. The code also supports optional SWaT and TON_IoT experiments, but their raw data files are not bundled. SWaT requires an iTrust access request; TON_IoT should be obtained under the official use/citation terms.

Read [`python-engine/ml/README.md`](python-engine/ml/README.md) for dataset generation, training commands, optional real dataset sources, and limitations. The benchmark model is not connected to automated isolation because its feature schema does not automatically match the live CSTR/Modbus simulator. Existing rule-based detection, SafeCut safety constraints, and certificate verification remain unchanged.

## What was merged and fixed in this build

**Merged in from the Python engine**
- `python-engine/` — the real Modbus/TCP plant, the scripted attacker, and a new
  `bridge.py` that forwards a real Modbus attack to the Next.js console, so the
  genuine-industrial-protocol demo now drives the polished web UI.

**Bug fixes**
- **Reactor runaway was broken.** The web CSTR model cooled to ~300 K even with
  the jacket off, so the SafeCut-vs-quarantine contrast did not show. Rebuilt the
  model (reactant-depletion-limited exotherm, calibrated against the Python
  reference): stable ~355 K with cooling, runaway to ~880 K without. The
  telemetry chart now shows the contrast.
- **Duplicate suppression never expired.** `event-store` kept seen keys forever,
  so an attack could be run only once per session. Replaced with a real 60 s
  sliding window, plus a `clearSession` used by a new reset endpoint.
- **Two-laptop pairing could not actually pair.** The console only showed a
  truncated token, and the CLI's own `pair` created a different session than the
  one the console polled. Added an opt-in shared demo session
  (`SAFECUT_DEMO_MODE=1`) so console, CLI and Python bridge all land on one
  session with zero copy-paste, and the console now shows the full token with
  copy buttons.
- **Dead console controls.** Wired the Trigger SafeCut / Blind Quarantine buttons
  and the Reset action; added a response status line.
- **Slow polling.** Console incident polling 5 s → 1.5 s for a responsive demo.
- **Offline fragility (venue-WiFi risk).** `next/font/google` and a drei HDR
  environment map were fetched at build/runtime and failed with no internet.
  Both now use local fallbacks, so the app builds and runs fully offline.
- **Attacker CLI infinite error loop** on stdin EOF (`ERR_USE_AFTER_CLOSE`) —
  now exits cleanly.
- Added `laptop_a/check.py` pre-flight connectivity checker and `reset` endpoint.

**Live-demo hardening (latest)**
- Demo mode is now ON by default, so the defender accepts `SAFECUT-DEMO` without
  any `.env.local` file. This was the cause of "Env credentials invalid".
- Session and event stores live on `globalThis`, so every API route shares them.
- New `/api/health` endpoint. The console shows the exact IP the attacker
  should type, filtering out WSL/Hyper-V/VirtualBox adapters.
- The attacker CLI tells apart "cannot reach defender" and "session rejected",
  explains the fix, and saves the working IP. New `demo` and `doctor` commands.
- Server binds to `0.0.0.0:3000`. HSTS header removed (no TLS on a hotspot).
- Duplicate-event window cut from 60 s to 5 s so the attack can be re-run.
- ngrok removed. One-click `START_DEFENDER.bat`, `START_ATTACKER.bat`,
  `ALLOW_FIREWALL.bat`.

All optional integrations (Neo4j, Supabase, Nodemailer) keep their graceful
fallbacks.

## Notes

- The web solver is the connectivity-preserving safety-constrained min-cut
  (Edmonds-Karp) with an independent certificate verifier. The deadline-bounded
  (Process Safety Time) research solver and the SafeCut-Bench corpus live with
  the Python engine and the project report; they are the research contribution,
  while the web app is the live showcase.
- `npm run build` passes with zero type errors.
