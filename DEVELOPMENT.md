# SafeCut Development Guide

## Prerequisites

- **Node.js**: 18+
- **npm**: 9+
- **Python**: 3.10+ (for ML pipeline)
- **Git**: 2.30+

## Quick Start

```bash
# 1. Clone repository
cd Preemptive-Cybersecurity-for-OT-Systems

# 2. Install Node.js dependencies
npm ci

# 3. Copy environment template
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Build and verify
npm run build
npx tsc --noEmit
npx eslint .

# 5. Start development server
npm run dev
```

Open http://localhost:3000

## Project Structure

```
Preemptive-Cybersecurity-for-OT-Systems/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (route handlers)
│   ├── (marketing)/       # Marketing pages
│   ├── defender/          # Defender console
│   ├── attacker/          # Attacker simulation
│   ├── console/           # Incident console
│   └── simulation/        # Interactive walkthrough
├── components/            # React components
│   ├── ui/                # UI primitives
│   └── simulation/        # Simulation-specific
├── lib/                   # Core TypeScript logic
│   ├── safecut-engine.ts  # Edmonds-Karp + Certificate
│   ├── ot-topology.ts     # 12-node OT graph
│   ├── cstr-model.ts      # CSTR reactor simulation
│   ├── threat-assessment.ts
│   ├── ml-client.ts
│   ├── env.ts
│   ├── supabase-server.ts
│   ├── neo4j.ts
│   ├── mailer.ts
│   └── session-store.ts
├── ml/                    # Python ML pipeline
├── types/                 # TypeScript definitions
├── supabase/              # SQL schema
└── public/                # Static assets
```

## Development Workflow

### 1. Making Changes

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes
# ...

# Run checks
npx tsc --noEmit      # Type check
npx eslint .          # Lint
npm run build         # Full build

# Commit
git add .
git commit -m "feat: your feature description"
```

### 2. Adding New API Routes

Create `app/api/your-route/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // 1. Parse & validate body
  // 2. Business logic
  // 3. Return typed response
}

export async function GET(req: NextRequest) {
  // ...
}
```

**Validation Pattern**:
```typescript
let body: unknown;
try {
  body = await req.json();
} catch {
  return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
}

if (!body || typeof body !== "object") {
  return NextResponse.json({ error: "Invalid body" }, { status: 400 });
}

// Validate required fields...
```

### 3. Adding React Components

Create `components/YourComponent.tsx`:

```tsx
"use client";

import React from "react";

interface YourComponentProps {
  // props
}

export function YourComponent({ prop }: YourComponentProps) {
  return (
    <div className="your-classes">
      {/* JSX */}
    </div>
  );
}
```

**Styling**: Use Tailwind CSS utility classes.

### 4. TypeScript Guidelines

- **Strict mode enabled**: `strict: true` in tsconfig.json
- **No `any`**: Use proper types or `unknown`
- **Export types**: From `types/index.ts` for shared types
- **Path aliases**: Use `@/*` for imports

```typescript
// Good
import type { OTGraph } from "@/types";
import { computeSafeCut } from "@/lib/safecut-engine";

// Avoid
import { something } from "../../lib/something";
```

### 5. Environment Variables

| File | Purpose |
|------|---------|
| `.env.example` | Template (committed) |
| `.env.local` | Local overrides (gitignored) |
| `.env.production` | Production (gitignored) |

**Never commit**: `.env.local`, `.env`, `.env.*.local`

### 6. ML Pipeline Development

```bash
cd ml

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download ToN_IoT dataset to ml/data/raw/ton_iot/
# See ml/data/README.md

# Preprocess
python -m ml.src.preprocess

# Train
python -m ml.src.train

# Evaluate
python -m ml.src.evaluate

# Start API
python -m uvicorn ml.api.main:app --reload --port 8000
```

**Adding ML Features**:
1. Update `ml/src/preprocess.py` feature identification
2. Retrain: `python -m ml.src.train`
3. Update `ml/api/main.py` if new features added
4. Update `lib/ml-client.ts` types if response changes

## Testing

### TypeScript/Next.js

```bash
# Type check
npx tsc --noEmit

# Lint
npx eslint .

# Build (includes type check)
npm run build

# Unit tests (if configured)
npm test
```

### Python ML

```bash
cd ml
python -m pytest          # Unit tests
python -m compileall ml   # Syntax check
python -m ml.src.evaluate # Model evaluation
```

### Manual Testing Checklist

- [ ] `/` - Home page loads
- [ ] `/simulation` - Walkthrough scrolls correctly
- [ ] `/attacker` - Join session, run scenarios
- [ ] `/defender` - Join same session, see events, run SafeCut/Quarantine
- [ ] `/console` - Shows telemetry + incident stream
- [ ] `/api/health` - Returns service status
- [ ] `/api/safecut` - Returns valid response with certificate
- [ ] `/api/quarantine` - Returns broken safety loops
- [ ] ML API `/health` - Returns model_loaded: true
- [ ] ML API `/predict` - Returns prediction with confidence

## Debugging

### Next.js
```bash
# Debug build
DEBUG=* npm run build

# Debug dev server
DEBUG=* npm run dev
```

### VS Code Debug Config (`.vscode/launch.json`)
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

### Python ML
```bash
# Debug FastAPI
python -m debugpy --listen 5678 --wait-for-client -m uvicorn ml.api.main:app --reload --port 8000
```

## Common Issues

### Build Fails: "Export doesn't exist"
Check import paths - use `@/types` for shared types, not `@/lib/*`

### TypeScript: "Property missing"
Run `npx tsc --noEmit` to see all errors

### ML Model Not Found
Run `python -m ml.src.train` first

### Port Conflicts
- Next.js: 3000 (configurable via PORT env)
- ML API: 8000
- Neo4j: 7474/7687

### Supabase Connection
- Verify `.env.local` has correct credentials
- Check Supabase project is active
- RLS policies may block writes

## Code Style

### TypeScript
- 2 spaces indentation
- Semicolons required
- Single quotes
- Trailing commas
- Arrow functions for callbacks

### Python
- 4 spaces indentation
- Type hints on all functions
- Black formatter: `black ml/src/`
- Ruff linter: `ruff check ml/`

### Git Commits
```
feat: add new feature
fix: bug fix
refactor: code restructuring
docs: documentation updates
test: add tests
chore: maintenance
```

## Performance Profiling

```bash
# Next.js build analysis
ANALYZE=true npm run build

# Python profiling
python -m cProfile -o profile.stats -m ml.src.train
python -c "import pstats; p = pstats.Stats('profile.stats'); p.sort_stats('cumulative').print_stats(20)"
```

## Release Checklist

- [ ] All tests pass
- [ ] `npm run build` succeeds
- [ ] `npx tsc --noEmit` passes
- [ ] `npx eslint .` passes
- [ ] `python -m ml.src.evaluate` meets metrics
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Version bumped in package.json
- [ ] Git tag created

## Useful Commands

```bash
# Clean install
rm -rf node_modules .next
npm ci

# Reset ML artifacts
rm -rf ml/models/*.joblib ml/data/processed/*.npy ml/reports/*.json

# View bundle size
npm run build && npx next-bundle-analyzer

# Check for circular dependencies
npx madge --circular --extensions ts,tsx app lib components
```

## Resources

- [Next.js 16 Docs](https://nextjs.org/docs)
- [React 19 Docs](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Docs](https://supabase.com/docs)
- [Neo4j JS Driver](https://neo4j.com/docs/javascript-manual/current/)
- [scikit-learn](https://scikit-learn.org/stable/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [ToN_IoT Dataset](https://research.unsw.edu.au/projects/toniot-datasets)