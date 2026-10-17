-- SafeCut Supabase Schema & RLS Policies
-- Execute this in the Supabase SQL Editor

-- 1. Create the incidents table
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_id TEXT NOT NULL,
    threat_node TEXT NOT NULL,
    threat_ip TEXT,
    safecut_triggered BOOLEAN DEFAULT FALSE,
    certificate_issued BOOLEAN DEFAULT FALSE,
    edges_cut INTEGER DEFAULT 0,
    safety_loops_preserved INTEGER DEFAULT 0,
    total_safety_loops INTEGER DEFAULT 0,
    log_messages JSONB DEFAULT '[]'::jsonb,
    attack_type TEXT,
    confidence DOUBLE PRECISION,
    risk_score INTEGER,
    severity TEXT,
    model_version TEXT
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies - SECURE VERSION
-- Only service_role can insert (server-side only, via validated APIs)
CREATE POLICY "Service role full access to incidents"
ON public.incidents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users (defenders) can view incidents
CREATE POLICY "Authenticated users can view incidents"
ON public.incidents
FOR SELECT
TO authenticated
USING (true);

-- Anon users cannot insert directly - must go through validated API routes
-- which use the service_role key server-side
CREATE POLICY "Deny anon direct inserts"
ON public.incidents
FOR INSERT
TO anon
WITH CHECK (false);

-- No one can UPDATE or DELETE incidents (immutable audit log)
CREATE POLICY "Prevent updates to incidents"
ON public.incidents
FOR UPDATE
TO anon, authenticated
USING (false);

CREATE POLICY "Prevent deletes to incidents"
ON public.incidents
FOR DELETE
TO anon, authenticated
USING (false);

-- 4. Set up Realtime
ALTER publication supabase_realtime ADD TABLE public.incidents;

-- 5. Index for performance
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_session_id ON public.incidents(session_id);
CREATE INDEX IF NOT EXISTS idx_incidents_threat_node ON public.incidents(threat_node);