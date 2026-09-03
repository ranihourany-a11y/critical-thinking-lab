import { describe, it, expect, afterEach } from 'vitest';
import { getAuthenticatedTeacher, getSafeTeacherRedirect, DEV_DEFAULT_TEACHER } from '../src/lib/auth/teacher-auth';
import { storage } from '../src/lib/db/storage';
import { isSupabaseConfigured, createClient } from '../src/lib/supabase/client';

describe('Supabase Magic Link & Teacher Authorization Flow', () => {
  it('1. should recognize and authenticate an authorized teacher record', async () => {
    const teacher = await storage.getTeacher(DEV_DEFAULT_TEACHER.id);
    expect(teacher).not.toBeNull();
    expect(teacher?.email).toBe('teacher@ctl.school.edu');
    expect(teacher?.role).toBe('teacher');

    // Verify session decoding for authorized teacher
    const validCookie = Buffer.from(
      JSON.stringify({ id: teacher!.id, email: teacher!.email, role: 'teacher' })
    ).toString('base64');

    const authTeacher = await getAuthenticatedTeacher({
      get: (name) => (name === 'ctl_teacher_session' ? { value: validCookie } : undefined),
    });

    expect(authTeacher).not.toBeNull();
    expect(authTeacher?.id).toBe(teacher!.id);
    expect(authTeacher?.email).toBe(teacher!.email);
  });

  it('2. should reject unknown/unverified email without leaking database existence', async () => {
    const unknownTeacher = await storage.getTeacherByEmail('unknown_random_user@domain.com');
    expect(unknownTeacher).toBeNull();

    const invalidCookie = Buffer.from(
      JSON.stringify({ id: 'non-existent-id-999', email: 'unknown_random_user@domain.com', role: 'teacher' })
    ).toString('base64');

    const authResult = await getAuthenticatedTeacher({
      get: (name) => (name === 'ctl_teacher_session' ? { value: invalidCookie } : undefined),
    });

    expect(authResult).toBeNull();
  });

  it('3. should explicitly deny authenticated non-teacher users (e.g. students or unauthorized roles)', async () => {
    // User is authenticated in identity provider, but not listed in authorized teachers table
    const nonTeacherCookie = Buffer.from(
      JSON.stringify({ id: 'student-auth-id-123', email: 'student@school.edu', role: 'student' })
    ).toString('base64');

    const authResult = await getAuthenticatedTeacher({
      get: (name) => (name === 'ctl_teacher_session' ? { value: nonTeacherCookie } : undefined),
    });

    expect(authResult).toBeNull();
  });

  it('4. should sanitize unsafe next URLs and preserve valid teacher-only relative paths', () => {
    // Unsafe URLs must be sanitized to default /teacher
    expect(getSafeTeacherRedirect('https://evil.com/phishing')).toBe('/teacher');
    expect(getSafeTeacherRedirect('http://evil.com')).toBe('/teacher');
    expect(getSafeTeacherRedirect('//evil.com/bypass')).toBe('/teacher');
    expect(getSafeTeacherRedirect('/\\evil.com')).toBe('/teacher');
    expect(getSafeTeacherRedirect('/student/session-123')).toBe('/teacher');
    expect(getSafeTeacherRedirect('')).toBe('/teacher');
    expect(getSafeTeacherRedirect(null)).toBe('/teacher');

    // Valid relative teacher paths must be preserved
    expect(getSafeTeacherRedirect('/teacher/activities/new')).toBe('/teacher/activities/new');
    expect(getSafeTeacherRedirect('/teacher/activities/CLIM89')).toBe('/teacher/activities/CLIM89');
    expect(getSafeTeacherRedirect('/teacher/sessions/sess-1?tab=eval')).toBe('/teacher/sessions/sess-1?tab=eval');
  });

  describe('Supabase Client Configuration Boundaries', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('5. should support NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY when anon key is absent', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_pub_test_key_12345';

      expect(isSupabaseConfigured()).toBe(true);
      const client = createClient();
      expect(client).not.toBeNull();
    });

    it('6. should fall back to NEXT_PUBLIC_SUPABASE_ANON_KEY when publishable key is absent', () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example-project.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_anon_test_key_67890';

      expect(isSupabaseConfigured()).toBe(true);
      const client = createClient();
      expect(client).not.toBeNull();
    });

    it('7. should fail closed when configuration is missing', () => {
      // Missing URL
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'sb_anon_test_key_67890';
      expect(isSupabaseConfigured()).toBe(false);
      expect(createClient()).toBeNull();

      // Missing both keys
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example-project.supabase.co';
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      expect(isSupabaseConfigured()).toBe(false);
      expect(createClient()).toBeNull();

      // Missing everything
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      expect(isSupabaseConfigured()).toBe(false);
      expect(createClient()).toBeNull();
    });
  });
});
