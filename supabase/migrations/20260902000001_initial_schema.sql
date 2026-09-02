-- =====================================================================
-- مختبر التفكير الناقد (Critical Thinking Lab) — Schema & RLS Migration
-- Version: 20260902000001
-- Description: Complete initial schema with RLS policies, constraints, indexes
-- =====================================================================

-- Enable UUID extension if not present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Teachers Table (references auth.users)
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Activities Table
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    grade_level INT NOT NULL CHECK (grade_level BETWEEN 7 AND 12),
    language TEXT NOT NULL DEFAULT 'ar',
    stance_mode TEXT NOT NULL CHECK (stance_mode IN ('contrarian', 'advocate', 'adaptive')),
    ai_stance TEXT NOT NULL,
    strict_source BOOLEAN NOT NULL DEFAULT TRUE,
    rubric_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    access_code TEXT NOT NULL UNIQUE,
    max_turns INT NOT NULL DEFAULT 8,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Activity Sources Table (Verified Snapshots)
CREATE TABLE IF NOT EXISTS public.activity_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('text', 'url')),
    source_snapshot TEXT NOT NULL,
    source_url TEXT,
    citation_label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Sessions Table (Students)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
    student_alias TEXT NOT NULL,
    session_token_hash TEXT NOT NULL UNIQUE,
    initial_stance TEXT,
    initial_reason TEXT,
    initial_confidence INT CHECK (initial_confidence BETWEEN 1 AND 5),
    final_stance TEXT,
    final_confidence INT CHECK (final_confidence BETWEEN 1 AND 5),
    strongest_evidence TEXT,
    strongest_counterargument TEXT,
    remaining_uncertainty TEXT,
    final_reflection TEXT,
    current_stage TEXT NOT NULL DEFAULT 'baseline' CHECK (
        current_stage IN (
            'baseline',
            'understanding',
            'evidence',
            'source_check',
            'causal_reasoning',
            'counter_argument',
            'reflection',
            'submitted'
        )
    ),
    hint_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'locked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Messages Table (Atomic chat turns)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
    client_message_id TEXT NOT NULL,
    sequence_number INT NOT NULL,
    sender TEXT NOT NULL CHECK (sender IN ('student', 'expert')),
    content TEXT NOT NULL,
    stage TEXT NOT NULL,
    message_kind TEXT NOT NULL DEFAULT 'normal' CHECK (message_kind IN ('normal', 'clarification', 'question', 'hint')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_client_msg UNIQUE (session_id, client_message_id),
    CONSTRAINT uq_session_sequence UNIQUE (session_id, sequence_number)
);

-- 6. Evaluations Table (Formative AI evaluation - teacher private)
CREATE TABLE IF NOT EXISTS public.evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL UNIQUE REFERENCES public.sessions(id) ON DELETE CASCADE,
    rubric_scores JSONB NOT NULL,
    verified_quotes JSONB NOT NULL DEFAULT '[]'::jsonb,
    strengths TEXT[] NOT NULL DEFAULT '{}',
    misconceptions TEXT[] NOT NULL DEFAULT '{}',
    suggested_feedback TEXT NOT NULL,
    system_confidence NUMERIC(3,2) NOT NULL CHECK (system_confidence >= 0.0 AND system_confidence <= 1.0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    teacher_approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- Indexes for Performance & Queries
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_activities_teacher_id ON public.activities(teacher_id);
CREATE INDEX IF NOT EXISTS idx_activities_access_code ON public.activities(access_code);
CREATE INDEX IF NOT EXISTS idx_activity_sources_activity_id ON public.activity_sources(activity_id);
CREATE INDEX IF NOT EXISTS idx_sessions_activity_id ON public.sessions(activity_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON public.sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_messages_session_seq ON public.messages(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_evaluations_session_id ON public.evaluations(session_id);

-- =====================================================================
-- Row Level Security (RLS)
-- =====================================================================
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Teachers RLS: only self access
CREATE POLICY "Teachers can view own profile"
    ON public.teachers FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Teachers can update own profile"
    ON public.teachers FOR UPDATE
    USING (auth.uid() = id);

-- Activities RLS: teachers have full CRUD on their own activities
CREATE POLICY "Teachers manage own activities"
    ON public.activities FOR ALL
    USING (auth.uid() = teacher_id);

-- Activity Sources RLS: teachers have full CRUD on sources of their activities
CREATE POLICY "Teachers manage own activity sources"
    ON public.activity_sources FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.activities a
            WHERE a.id = activity_sources.activity_id
            AND a.teacher_id = auth.uid()
        )
    );

-- Sessions RLS: teachers can view sessions for their activities
CREATE POLICY "Teachers can view sessions for own activities"
    ON public.sessions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.activities a
            WHERE a.id = sessions.activity_id
            AND a.teacher_id = auth.uid()
        )
    );

-- Messages RLS: teachers can view messages for sessions of their activities
CREATE POLICY "Teachers can view messages of own activities"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sessions s
            JOIN public.activities a ON a.id = s.activity_id
            WHERE s.id = messages.session_id
            AND a.teacher_id = auth.uid()
        )
    );

-- Evaluations RLS: teachers have full view & update permissions on evaluations for their activities
CREATE POLICY "Teachers manage evaluations for own activities"
    ON public.evaluations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.sessions s
            JOIN public.activities a ON a.id = s.activity_id
            WHERE s.id = evaluations.session_id
            AND a.teacher_id = auth.uid()
        )
    );

-- Note: Students have NO direct table access via RLS.
-- All student operations occur through server Route Handlers validating the session token hash.
