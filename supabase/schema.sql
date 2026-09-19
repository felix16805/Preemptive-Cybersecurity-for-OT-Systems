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
    log_messages JSONB DEFAULT '[]'::jsonb
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Anyone (or anon) can INSERT an incident (e.g. from the CLI or simulation)
-- You may restrict this to authenticated users or a specific service role in production
CREATE POLICY "Allow public insert to incidents" 
ON public.incidents 
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);

-- Only authenticated users (defenders) can SELECT incidents
CREATE POLICY "Allow authenticated users to view incidents" 
ON public.incidents 
FOR SELECT 
TO authenticated 
USING (true);

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
-- Enable realtime tracking for the incidents table
alter publication supabase_realtime add table public.incidents;
