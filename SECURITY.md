# SafeCut Security Documentation

## Security Model

SafeCut follows a defense-in-depth approach with multiple security layers.

## Threat Model

### Assets Protected
- **OT Network Topology**: 12-node industrial control system graph
- **Safety Functions**: 4 Safety-Instrumented Function (SIF) loops
- **Process Integrity**: CSTR reactor thermal stability
- **Incident Audit Log**: Immutable security event records
- **ML Model Integrity**: Trained model artifacts

### Adversaries
| Type | Capability | Goal |
|------|------------|------|
| External Attacker | Network access, C2 | Disrupt safety systems |
| Insider Threat | Legitimate access | Sabotage/espionage |
| ML Evasion | Crafted traffic | Bypass detection |
| API Abuse | Automated requests | DoS / data exfiltration |

## Security Controls

### 1. Network Security

- **No Direct DB Access**: All Supabase writes via Next.js API routes
- **CORS**: Restricted to application origin
- **Rate Limiting**: Upstash Redis on webhook endpoint (10 req/min/IP)
- **HTTPS Only**: Enforced in production

### 2. Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────┐
│                     ACCESS CONTROL                           │
├─────────────────────┬───────────────────────────────────────┤
│ Role                │ Permissions                            │
├─────────────────────┼───────────────────────────────────────┤
│ service_role        │ Full DB access (server-side only)      │
│ authenticated       │ Read incidents (defenders)             │
│ anonymous           │ No direct DB writes                    │
│ API consumers       │ Validated payloads only                │
└─────────────────────┴───────────────────────────────────────┘
```

### 3. Input Validation

All API routes validate:
- **Schema validation** for request bodies
- **Type checking** for all fields
- **Range validation** (confidence 0-1, IP format, node existence)
- **Length limits** (message length, field sizes)

### 4. Secrets Management

| Secret | Location | Rotation |
|--------|----------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` (server only) | Quarterly |
| `NEO4J_PASSWORD` | `.env.local` | Quarterly |
| `SMTP_PASS` | `.env.local` | Quarterly |
| `UPSTASH_REDIS_REST_TOKEN` | `.env.local` | Quarterly |
| `ML_API_URL` | `.env.local` | N/A |

**Never committed to git**: `.env.local`, `.env`, any `.env.*`

### 5. Database Security (Supabase)

**Row Level Security (RLS) Policies**:
```sql
-- Service role: full access (server-side API)
CREATE POLICY "Service role full access" ON incidents
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated users: read only (defenders)
CREATE POLICY "Authenticated read" ON incidents
FOR SELECT TO authenticated USING (true);

-- Anonymous: no direct writes
CREATE POLICY "Deny anon writes" ON incidents
FOR INSERT TO anon WITH CHECK (false);

-- Immutable audit log
CREATE POLICY "No updates" ON incidents FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "No deletes" ON incidents FOR DELETE TO anon, authenticated USING (false);
```

### 6. ML Security

- **Model artifacts not in git**: `ml/models/*.joblib` in `.gitignore`
- **Dataset not in git**: `ml/data/raw/`, `ml/data/processed/` in `.gitignore`
- **Input validation**: FastAPI Pydantic models
- **Timeout**: 5s prediction timeout
- **Model versioning**: Every prediction includes `model_version`

### 7. Logging & Auditing

**Structured Logging** (no secrets):
```json
{
  "timestamp": "2026-10-05T10:00:00Z",
  "level": "INFO",
  "event": "SAFECUT_COMPLETED",
  "sessionId": "SAFECUT-A1B2",
  "node": "PLC_02",
  "edgesCut": 3,
  "certificateValid": true,
  "reactorStable": true
}
```

**Never Logged**:
- Passwords, API keys, service role keys, tokens
- Raw telemetry payloads
- ML feature vectors

## Secure Development Practices

### Code Review Checklist
- [ ] No hardcoded secrets
- [ ] All API inputs validated
- [ ] Unknown nodes rejected
- [ ] Confidence values range-checked (0-1)
- [ ] Database policies reviewed
- [ ] CORS restricted
- [ ] Error messages don't expose internals
- [ ] Logs contain no secrets
- [ ] Raw dataset not committed
- [ ] Model artifacts not committed
- [ ] Webhook validation implemented
- [ ] Rate limiting on public endpoints

### Dependency Security
- `npm audit` before releases
- `pip-audit` for Python dependencies
- Pin dependency versions in lockfiles
- Update dependencies quarterly

### Incident Response

1. **Detection**: ML alert + Defender Console
2. **Containment**: SafeCut isolation
3. **Eradication**: Session reset + topology restore
4. **Recovery**: Verify CSTR stability + certificate
5. **Lessons Learned**: Update ML training data

## Compliance Considerations

- **NERC CIP**: Audit trail for critical infrastructure
- **IEC 62443**: Safety system separation
- **GDPR**: No personal data in incident logs
- **SOC 2**: Immutable audit logging

## Vulnerability Reporting

Report security issues to: security@safecut.example.com

Include:
- Affected component
- Reproduction steps
- Impact assessment
- Suggested fix

## Security Testing

```bash
# Static analysis
npx tsc --noEmit
npx eslint .

# Dependency audit
npm audit
pip-audit -r ml/requirements.txt

# Runtime (manual)
# - Penetration test API endpoints
# - Fuzz ML prediction endpoint
# - Test RLS policies
# - Verify no secrets in logs
```