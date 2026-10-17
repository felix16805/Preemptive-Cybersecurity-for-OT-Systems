# SafeCut Architecture Documentation

## System Overview

SafeCut is a safety-constrained network isolation system for Industrial Control Systems (ICS/OT). It detects cyberattacks and computes the minimum set of network links to sever while mathematically guaranteeing that all Safety-Instrumented Function (SIF) loops remain operational.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SAFECUT SYSTEM                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │   TELEMETRY  │───▶│    ML IDS    │───▶│ THREAT ENGINE│───▶│  SAFECUT  │ │
│  │   (OT/IT)    │    │  (FastAPI)   │    │  (Risk/Act)  │    │  (Min-Cut)│ │
│  └──────────────┘    └──────────────┘    └──────────────┘    └─────┬─────┘ │
│                                                                       │       │
│                                                                       ▼       │
│                                                          ┌─────────────────────┐ │
│                                                          │  SAFETY CERTIFICATE │ │
│                                                          │  (BFS Verification) │ │
│                                                          └──────────┬──────────┘ │
│                                                                       │          │
│                                                                       ▼          │
│                                                          ┌─────────────────────┐ │
│                                                          │  CSTR PROCESS CHECK │ │
│                                                          │  (Thermal Runaway?) │ │
│                                                          └──────────┬──────────┘ │
│                                                                       │          │
│                                                                       ▼          │
│                                                           ┌──────────────────────┐│
│                                                           │  INCIDENT PERSISTED  ││
│                                                           │  (Supabase + Neo4j)  ││
│                                                           └──────────────────────┘│
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Frontend (Next.js 16 + React 19)

| Page | Route | Purpose |
|------|-------|---------|
| Marketing Home | `/` | Product landing page |
| Defender Console | `/defender` | Operator response interface |
| Attacker Sim | `/attacker` | Adversary simulation |
| Incident Console | `/console` | Telemetry + incident history |
| Simulation | `/simulation` | Interactive 5-step walkthrough |

**Tech Stack**: TypeScript, Tailwind CSS, Framer Motion, D3.js, React Three Fiber

### 2. Backend API (Next.js Route Handlers)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/safecut` | POST | Run Edmonds-Karp min-cut |
| `/api/quarantine` | POST | Run blind quarantine |
| `/api/attack-event` | POST | Submit attack event |
| `/api/webhooks/incident` | POST | External ML/IDS webhook |
| `/api/session` | GET/POST | Session management |
| `/api/topology` | GET | Fetch OT topology |
| `/api/health` | GET | Service health check |
| `/api/contact` | POST | Contact form |

### 3. Core Engine (TypeScript)

```
lib/
├── safecut-engine.ts      # Edmonds-Karp + Certificate Verifier
├── ot-topology.ts         # 12-node OT graph definition
├── cstr-model.ts          # CSTR reactor physics simulation
├── threat-assessment.ts   # Risk scoring engine
├── ml-client.ts           # FastAPI HTTP client
├── env.ts                 # Environment validation
├── supabase-server.ts     # Server-side Supabase (service role)
├── neo4j.ts               # Neo4j graph operations
├── mailer.ts              # Nodemailer email alerts
└── session-store.ts       # In-memory session state
```

#### SafeCut Engine (`safecut-engine.ts`)

**Algorithm**: Edmonds-Karp (BFS-based Edmonds-Karp max-flow/min-cut)

**Safety Constraints**:
- Edges with `protectedFromCut: true` get `INF_CAPACITY = Number.MAX_SAFE_INTEGER`
- Algorithm mathematically forced to route cut around safety edges
- Virtual super-sink connects all safety-critical nodes

**Certificate Verification**:
- Independent BFS reachability check (does NOT trust solver)
- Verifies each SIF loop has valid path post-cut
- Returns per-loop preservation status + overall validity

### 4. ML Pipeline (Python/FastAPI)

```
ml/
├── api/main.py           # FastAPI endpoints
├── src/
│   ├── config.py         # Config constants
│   ├── preprocess.py     # Data preprocessing (ColumnTransformer)
│   ├── train.py          # RandomForest training
│   ├── evaluate.py       # Model evaluation
│   └── predict.py        # Inference helpers
├── models/               # .joblib artifacts (not in git)
├── data/processed/       # .npy arrays (not in git)
└── reports/              # JSON metrics
```

**Model**: RandomForestClassifier (200 trees, balanced class weights)
**Dataset**: ToN_IoT (UNSW Canberra Cyber)
**Split**: Temporal 70/15/15 to prevent leakage
**Metrics Target**: Recall >90%, FNR <10%, FPR <5%

### 5. External Services

| Service | Purpose | Required |
|---------|---------|----------|
| Supabase | Incident persistence + Realtime | Yes (for production) |
| Neo4j | Live OT topology graph | No (fallback to in-memory) |
| SMTP/Nodemailer | Email alerts | No |
| Upstash Redis | Webhook rate limiting | No |
| ML API (FastAPI) | Intrusion detection | No (demo mode available) |

## Data Flow

### Attack-Defend Sequence

```
1. Attacker runs scenario (e.g., PLC_02 exploit)
         │
         ▼
2. POST /api/attack-event {sessionId, targetNode, threatIp, eventType}
         │
         ▼
3. Session store updates phase → "impact"
         │
         ▼
4. Defender Console polls /api/session → detects threat
         │
         ▼
5. (Optional) ML Pipeline analyzes telemetry
         │
         ▼
6. Defender clicks "SafeCut™"
         │
         ▼
7. POST /api/safecut {sessionId, compromisedNode, threatIp}
         │
         ▼
8. Edmonds-Karp computes min-cut
         │
         ▼
9. Certificate verifier checks SIF loops
         │
         ▼
10. CSTR simulation checks reactor stability
         │
         ▼
11. If allPreserved && reactorStable → Isolation approved
         │
         ▼
12. Incident persisted to Supabase
         │
         ▼
13. Topology updated (edges severed)
         │
         ▼
14. Defender UI shows: Certificate, Reactor Chart, Cut Edges
```

### Blind Quarantine Comparison

Same flow but:
- Cuts ALL edges connected to compromised node
- Certificate shows broken SIF loops
- CSTR simulation shows thermal runaway
- Demonstrates why blind quarantine fails in OT

## Type System

Key TypeScript interfaces (`types/index.ts`):

```typescript
// Graph
OTNode { id, label, type, isSafetyCritical, criticality }
OTEdge { source, target, capacity, isSafetyLoop, protectedFromCut }
OTGraph { nodes: OTNode[], edges: OTEdge[] }

// Safety
SafetyLoop { id, name, source, controller, actuator, required, edges }
SIFResult { loopId, loopName, preserved, path }
Certificate { issuedAt, solverUsed, sifResults, allPreserved, 
              preservedCount, requiredCount, valid }

// ML
MLPrediction { prediction, confidence, attackType, modelVersion }
ThreatAssessment { riskScore, severity, recommendedAction, reasoning }

// Incident
SecurityIncident { id, timestamp, attackType, confidence, targetNode,
                   riskScore, severity, response, certificateValid, 
                   reactorStable, modelVersion }
```

## Security Architecture

### Defense in Depth

1. **Input Validation**: All API routes validate payloads (Zod-ready schemas)
2. **No Service Role in Browser**: Server-only Supabase client
3. **RLS Policies**: Supabase Row Level Security
   - Service role: Full access
   - Authenticated: Read only
   - Anonymous: No direct writes
4. **No Hardcoded Secrets**: All via environment variables
5. **Rate Limiting**: Upstash Redis on webhook endpoint
5. **ML Separation**: ML detects → Threat Engine assesses → SafeCut responds

### Threat Model

| Threat | Mitigation |
|--------|------------|
| API abuse | Input validation + rate limiting |
| DB injection | Parameterized queries (Supabase) |
| ML evasion | Ensemble + temporal split |
| Session hijack | Session isolation + short TTL |
| C2 compromise | Air-gapped OT network simulation |

## Deployment

### Development
```bash
npm run dev          # Next.js on :3000
python -m uvicorn ml.api.main:app --reload --port 8000
```

### Production Build
```bash
npm run build
npm start
```

### Docker (Optional)
```yaml
# docker-compose.yml
services:
  nextjs:
    build: .
    ports: ["3000:3000"]
    env_file: .env.production
  ml-api:
    build: ./ml
    ports: ["8000:8000"]
  neo4j:
    image: neo4j:5.26
    ports: ["7474:7474", "7687:7687"]
```

## Testing

```bash
# TypeScript
npx tsc --noEmit

# Lint
npx eslint .

# Build
npm run build

# Python ML
python -m pytest ml/tests/
python -m compileall ml
```

## Performance

| Metric | Target |
|--------|--------|
| SafeCut solve time | <50ms (12-node graph) |
| Certificate verification | <10ms |
| CSTR simulation (120s) | <100ms |
| API response (safecut) | <200ms |
| ML prediction | <100ms |

## Future Enhancements

- [ ] Multi-node threat cluster isolation
- [ ] Formal verification (TLA+/Z3)
- [ ] Graph neural network for topology learning
- [ ] Distributed session store (Redis)
- [ ] Real-time Supabase subscriptions
- [ ] Hardware-in-the-loop (HIL) integration