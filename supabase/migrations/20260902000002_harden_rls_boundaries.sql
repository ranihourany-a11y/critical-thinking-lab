-- =====================================================================
-- مختبر التفكير الناقد (Critical Thinking Lab) — RLS Hardening Migration
-- Version: 20260902000002
-- Description: Revoke unintended anon grants, enforce FORCE RLS, restrict authenticated teacher access, isolate evaluations
-- =====================================================================

-- 1. Revoke all permissions from anon and public on private tables
REVOKE ALL ON TABLE public.teachers FROM anon, public;
REVOKE ALL ON TABLE public.activities FROM anon, public;
REVOKE ALL ON TABLE public.activity_sources FROM anon, public;
REVOKE ALL ON TABLE public.sessions FROM anon, public;
REVOKE ALL ON TABLE public.messages FROM anon, public;
REVOKE ALL ON TABLE public.evaluations FROM anon, public;

-- 2. Grant explicit CRUD permissions to authenticated users and full access to service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.teachers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.activity_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.evaluations TO authenticated;

GRANT ALL ON TABLE public.teachers TO service_role;
GRANT ALL ON TABLE public.activities TO service_role;
GRANT ALL ON TABLE public.activity_sources TO service_role;
GRANT ALL ON TABLE public.sessions TO service_role;
GRANT ALL ON TABLE public.messages TO service_role;
GRANT ALL ON TABLE public.evaluations TO service_role;

-- 3. Enable and FORCE Row Level Security on all exposed tables
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.teachers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.activity_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations FORCE ROW LEVEL SECURITY;

-- 4. Clean up previous policies to ensure strict reconstitution
DROP POLICY IF EXISTS "Teachers can view own profile" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can update own profile" ON public.teachers;
DROP POLICY IF EXISTS "Teachers manage own activities" ON public.activities;
DROP POLICY IF EXISTS "Teachers manage own activity sources" ON public.activity_sources;
DROP POLICY IF EXISTS "Teachers can view sessions for own activities" ON public.sessions;
DROP POLICY IF EXISTS "Teachers can view messages of own activities" ON public.messages;
DROP POLICY IF EXISTS "Teachers manage evaluations for own activities" ON public.evaluations;

-- 5. Recreate strict RLS policies bound strictly TO authenticated

-- Teachers Table: An authenticated teacher can only select/update their own profile
CREATE POLICY "teachers_self_select_policy"
    ON public.teachers
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "teachers_self_update_policy"
    ON public.teachers
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id);

-- Activities Table: An authenticated teacher can manage ONLY their own activities
CREATE POLICY "activities_owner_all_policy"
    ON public.activities
    FOR ALL
    TO authenticated
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- Activity Sources Table: An authenticated teacher can manage sources belonging to their activities
CREATE POLICY "activity_sources_owner_all_policy"
    ON public.activity_sources
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.activities a
            WHERE a.id = activity_sources.activity_id
            AND a.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.activities a
            WHERE a.id = activity_sources.activity_id
            AND a.teacher_id = auth.uid()
        )
    );

-- Sessions Table: An authenticated teacher can view/manage sessions of their activities
CREATE POLICY "sessions_teacher_owner_all_policy"
    ON public.sessions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.activities a
            WHERE a.id = sessions.activity_id
            AND a.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.activities a
            WHERE a.id = sessions.activity_id
            AND a.teacher_id = auth.uid()
        )
    );

-- Messages Table: An authenticated teacher can view/manage messages for sessions of their activities
CREATE POLICY "messages_teacher_owner_all_policy"
    ON public.messages
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sessions s
            JOIN public.activities a ON a.id = s.activity_id
            WHERE s.id = messages.session_id
            AND a.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sessions s
            JOIN public.activities a ON a.id = s.activity_id
            WHERE s.id = messages.session_id
            AND a.teacher_id = auth.uid()
        )
    );

-- Evaluations Table: STRICT ISOLATION - ONLY the owning authenticated teacher has access
CREATE POLICY "evaluations_teacher_owner_all_policy"
    ON public.evaluations
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.sessions s
            JOIN public.activities a ON a.id = s.activity_id
            WHERE s.id = evaluations.session_id
            AND a.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.sessions s
            JOIN public.activities a ON a.id = s.activity_id
            WHERE s.id = evaluations.session_id
            AND a.teacher_id = auth.uid()
        )
    );
