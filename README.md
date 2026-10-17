# SafeCut — Preemptive Cybersecurity for OT Systems

**Safety-Constrained Network Isolation for Industrial Control Systems**

SafeCut is an intelligent cybersecurity system for Operational Technology (OT) / Industrial Control Systems (ICS) that detects cyberattacks and computes the minimum required network isolation while mathematically guaranteeing that all safety-instrumented function (SIF) loops remain intact.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                            │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  Defender    │   Attacker   │  Simulation  │      Console       │
│  Console     │  Simulation  │  Walkthrough │                    │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        NEXT.JS FRONTEND                          │
│  React 19 + Next.js 16 + TypeScript + Tailwind CSS              │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│   SafeCut API    │ │  Quarantine API  │ │  Incident Webhook│
│  /api/safecut    │ │ /api/quarantine  │ │ /api/webhooks/   │
└────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SAFECUT ENGINE (CORE)                         │
│  • Edmonds-Karp Min-Cut (Edmonds-Karp max-flow)                 │
│  • Safety Constraints (INF_CAPACITY / protectedFromCut)         │
│  • Independent Certificate Verifier (BFS reachability)          │
│  • CSTR Reactor Process Verification                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│    Supabase      │ │     Neo4j        │ │   ML Service     │
│  (Incidents,     │ │  (Live Topology) │ │  (FastAPI +      │
│   Audit Log)     │ │                  │ │   Random Forest) │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## Core Components

### 1. SafeCut Algorithm
- **Edmonds-Karp Max-Flow/Min-Cut**: Computes minimum set of network links to sever
- **Safety Constraints**: Safety-critical edges have `protectedFromCut = true` and `INF_CAPACITY`
- **Virtual Super-Sink**: Connects all safety-critical nodes to force cut around them

### 2. Independent Safety Certificate
- **BFS Reachability Verification**: Verifies every SIF loop has a valid path post-cut
- **Independent from Solver**: Does not trust the solver's own output
- **Per-Loop Verification**: Checks each safety loop individually

### 3. CSTR Process Verification
- **Physics-Based Simulation**: Exothermic CSTR with cooling jacket
- **RK4 Integration**: 4th-order Runge-Kutta for numerical accuracy
- **Stability Criteria**: Max temperature < 400K = STABLE, 400-450K = WARNING, >450K = RUNAWAY

### 4. ML Detection Pipeline (Optional)
- **Dataset**: ToN_IoT (OT/IoT cybersecurity dataset)
- **Model**: Random Forest classifier
- **API**: FastAPI inference service on port 8000
- **Integration**: ML → Threat Assessment → SafeCut

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+ (for ML pipeline)
- Supabase account (optional, for incident persistence)
- Neo4j 5.x (optional, for live topology)

### Installation

```bash
# 1. Clone and install Node.js dependencies
cd Preemptive-Cybersecurity-for-OT-Systems
npm ci

# 2. Copy environment template
cp .env.example .env.local
# Edit .env.local with your credentials

# 3. Build and run
npm run build
npm run dev
```

### With ML Pipeline (Optional)

```bash
# 1. Set up Python environment
cd ml
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 2. Download ToN_IoT dataset (see ml/data/README.md)
# Place raw CSVs in ml/data/raw/ton_iot/

# 3. Preprocess and train
python -m ml.src.preprocess
python -m ml.src.train
python -m ml.src.evaluate

# 4. Start ML API (Terminal 2)
python -m uvicorn ml.api.main:app --reload --port 8000

# 5. Start Next.js (Terminal 1)
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes* | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes* | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes* | Supabase service role key |
| `NEO4J_URI` | No | Neo4j Bolt URI (e.g., bolt://localhost:7687) |
| `NEO4J_USER` | No | Neo4j username |
| `NEO4J_PASSWORD` | No | Neo4j password |
| `SMTP_HOST` | No | SMTP server hostname |
| `SMTP_PORT` | No | SMTP port (default 587) |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password |
| `ALERT_TO` | No | Alert recipient email |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token |
| `ML_API_URL` | No | ML service URL (default: http://localhost:8000) |

*Required for incident persistence; optional for simulation-only mode

## Running the Demonstration

### 1. Start the Application
```bash
npm run dev
```
Open http://localhost:3000

### 2. Run a Full Attack-Defend Scenario

**Terminal 1 - Attacker:**
1. Open http://localhost:3000/attacker
2. Enter or auto-generate a Session ID (e.g., `SAFECUT-A1B2`)
3. Click "Join Session"
4. Select a scenario (Reconnaissance → PLC Compromise → Lateral Movement → Safety Impact)
5. Click "▶ RUN SIMULATION" for each scenario

**Terminal 2 - Defender:**
1. Open http://localhost:3000/defender?sessionId=SAFECUT-A1B2
2. Wait for attack events to appear in "Live Incident Alerts"
3. Click on an event to select it
4. Click "SafeCut™" to run safety-constrained isolation
5. Observe: Certificate verification, CSTR reactor stability, topology update

**Compare with Blind Quarantine:**
1. Reset the session
2. Run the same attack scenario
3. Click "Blind Quarantine" instead
3. Observe: Cooling loop severed, reactor thermal runaway

### 3. View Incident Logs
Open http://localhost:3000/console to see:
- Real-time telemetry (ReactorChart)
- Incident stream with full logs
- Session pairing for coordination

## API Reference

### POST /api/safecut
Run SafeCut isolation for a compromised node.

**Request:**
```json
{
  "sessionId": "SAFECUT-A1B2",
  "compromisedNode": "PLC_02",
  "threatIp": "192.168.10.102"
}
```

**Response:**
```json
{
  "success": true,
  "incidentId": "uuid",
  "persistenceStatus": "ok",
  "sessionId": "SAFECUT-A1B2",
  "threatIp": "192.168.10.102",
  "mode": "safecut",
  "compromisedNode": "PLC_02",
  "cutEdges": [{"source": "PLC_01", "target": "PLC_02"}],
  "certificate": {
    "issuedAt": "2026-10-05T10:00:00Z",
    "solverUsed": "Edmonds-Karp",
    "sifResults": [...],
    "allPreserved": true,
    "preservedCount": 4,
    "requiredCount": 4,
    "valid": true
  },
  "solveTimeMs": 2.34,
  "safetyLoopsPreserved": 4,
  "totalSafetyLoops": 4,
  "reactorStable": true,
  "feasible": true,
  "maxReactorTemp": 355.2,
  "processStable": true
}
```

### POST /api/quarantine
Run blind quarantine (indiscriminate edge cutting).

### POST /api/attack-event
Submit an attack event from the attacker simulation.

### POST /api/webhooks/incident
Webhook endpoint for external ML/IDS systems.

### GET /api/topology
Fetch current OT topology (from Neo4j or in-memory fallback).

### GET /api/health
Health check endpoint showing service status.

## Project Structure

```
Preemptive-Cybersecurity-for-OT-Systems/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── contact/       # Contact form
│   │   ├── health/        # Health check
│   │   ├── safecut/       # SafeCut isolation
│   │   ├── quarantine/    # Blind quarantine
│   │   ├── webhooks/      # Incident webhook
│   │   ├── session/       # Session management
│   │   ├── topology/      # Topology fetch
│   │   └── attack-event/  # Attack event submission
│   ├── defender/          # Defender console page
│   ├── attacker/          # Attacker simulation page
│   ├── console/           # Incident console
│   ├── simulation/        # Interactive simulation walkthrough
│   └── (marketing)/       # Landing pages
├── components/            # React components
│   ├── ui/                # UI primitives
│   └── simulation/        # Simulation components
├── lib/                   # Core logic
│   ├── safecut-engine.ts  # Edmonds-Karp + Certificate
│   ├── ot-topology.ts     # 12-node OT graph
│   ├── cstr-model.ts      # CSTR reactor simulation
│   ├── threat-assessment.ts # Risk scoring
│   ├── ml-client.ts       # FastAPI client
│   ├── env.ts             # Environment validation
│   ├── supabase-server.ts # Server-side Supabase
│   ├── neo4j.ts           # Neo4j integration
│   ├── mailer.ts          # Email alerts
│   └── session-store.ts   # In-memory sessions
├── ml/                    # ML Pipeline (Python)
│   ├── api/               # FastAPI service
│   ├── src/               # ML modules
│   ├── data/              # Data directories
│   ├── models/            # Trained models
│   └── notebooks/         # Jupyter notebooks
├── types/                 # TypeScript types
├── supabase/              # Supabase schema
└── public/                # Static assets
```

## Development

```bash
# Install dependencies
npm ci

# Type check
npx tsc --noEmit

# Lint
npx eslint .

# Build
npm run build

# Development server
npm run dev
```

## ML Pipeline Commands

```bash
cd ml

# Preprocess data
python -m ml.src.preprocess

# Train model
python -m ml.src.train

# Evaluate model
python -m ml.src.evaluate

# Start API server
python -m uvicorn ml.api.main:app --reload --port 8000
```

## Security Considerations

- **No Service Role Key in Frontend**: All Supabase writes go through Next.js API routes using `SUPABASE_SERVICE_ROLE_KEY`
- **RLS Policies**: Supabase Row Level Security restricts anonymous access
- **Input Validation**: All API routes validate request payloads
- **No Hardcoded Secrets**: All secrets via environment variables
- **ML Separation**: ML detects, threat engine assesses, SafeCut responds

## License

ISC License

---

**SafeCut** — Isolate the attacker. Preserve the safety system.