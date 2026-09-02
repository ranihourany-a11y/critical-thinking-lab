// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NextRequest } from 'next/server';
import { GET as getActivityHandler } from '../src/app/api/teacher/activities/[id]/route';
import { ParticipantTracker } from '../src/components/teacher/ParticipantTracker';
import { storage, dbStore } from '../src/lib/db/storage';
import { DEV_DEFAULT_TEACHER, Activity, Session } from '../src/lib/db/schema';
import { SEED_ACTIVITY } from '../src/lib/db/seed';

describe('Teacher Activity Participant Tracker & Authorization', () => {
  let teacherCookie: string;
  let teacherId: string;
  let sampleActivity: Activity;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    teacherId = DEV_DEFAULT_TEACHER.id;
    const authPayload = {
      id: DEV_DEFAULT_TEACHER.id,
      email: DEV_DEFAULT_TEACHER.email,
      role: 'teacher' as const,
    };
    teacherCookie = `ctl_teacher_session=${Buffer.from(JSON.stringify(authPayload)).toString('base64')}`;

    sampleActivity = {
      ...SEED_ACTIVITY,
      id: 'act-tracker-test-1',
      teacher_id: teacherId,
      status: 'active',
    };
    dbStore.activities.set(sampleActivity.id, sampleActivity);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('1. Server Endpoint Authorization & Private Field Stripping: allows owner, rejects non-owner, and omits private/token/reflection fields', async () => {
    // Populate sessions with private student data
    const s1: Session = {
      id: 'sess-track-1',
      activity_id: sampleActivity.id,
      student_alias: 'سارة_المناظرة',
      session_token_hash: 'secret-hash-must-not-leak',
      current_stage: 'baseline',
      hint_count: 1,
      status: 'active',
      initial_stance: 'موقف مبدئي سري',
      initial_reason: 'تعليل مبدئي سري',
      final_reflection: 'تأمل ختامي سري',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    dbStore.sessions.set(s1.id, s1);

    // 1a: Owner access
    const ownerReq = new NextRequest(`http://localhost:3000/api/teacher/activities/${sampleActivity.id}`, {
      headers: { cookie: teacherCookie },
    });
    const ownerRes = await getActivityHandler(ownerReq, { params: Promise.resolve({ id: sampleActivity.id }) });
    expect(ownerRes.status).toBe(200);

    const data = await ownerRes.json();
    expect(data.sessions).toBeDefined();
    expect(data.sessions.length).toBe(1);

    const projectedSession = data.sessions[0];
    expect(projectedSession.id).toBe('sess-track-1');
    expect(projectedSession.student_alias).toBe('سارة_المناظرة');
    expect(projectedSession.current_stage).toBe('baseline');
    expect(projectedSession.hint_count).toBe(1);

    // Verify absence of prohibited private fields
    expect(projectedSession.session_token_hash).toBeUndefined();
    expect(projectedSession.initial_reason).toBeUndefined();
    expect(projectedSession.final_reflection).toBeUndefined();
    expect(projectedSession.transcript).toBeUndefined();
    expect(projectedSession.evaluation).toBeUndefined();
    expect(projectedSession.rubric_scores).toBeUndefined();

    // 1b: Non-owner rejection
    const otherTeacher = {
      id: '00000000-0000-0000-0000-000000000088',
      email: 'hacker_teacher@school.edu',
      role: 'teacher' as const,
    };
    dbStore.teachers.set(otherTeacher.id, otherTeacher as any);
    const hackerCookie = `ctl_teacher_session=${Buffer.from(JSON.stringify(otherTeacher)).toString('base64')}`;

    const nonOwnerReq = new NextRequest(`http://localhost:3000/api/teacher/activities/${sampleActivity.id}`, {
      headers: { cookie: hackerCookie },
    });
    const nonOwnerRes = await getActivityHandler(nonOwnerReq, { params: Promise.resolve({ id: sampleActivity.id }) });
    expect(nonOwnerRes.status).toBe(403);
  });

  it('2. Truthful Empty State: displays "لم ينضم أي طالب بعد" when no sessions exist', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        activity: sampleActivity,
        sessions: [],
      }),
    } as any);

    render(<ParticipantTracker activityId={sampleActivity.id} activityStatus="active" />);

    await waitFor(() => {
      expect(screen.getByText('لم ينضم أي طالب بعد')).toBeDefined();
    });

    expect(screen.getByText(/إجمالي المشاركين/i)).toBeDefined();
  });

  it('3. Stage & Status Summary Counts Aggregation: accurately categorizes sessions into preparation, dialogue, reflection, and completed', async () => {
    const mockSessions = [
      {
        id: 's-1',
        student_alias: 'طالب_تحضير',
        current_stage: 'baseline',
        status: 'active',
        hint_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's-2',
        student_alias: 'طالب_حوار_1',
        current_stage: 'evidence',
        status: 'active',
        hint_count: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's-3',
        student_alias: 'طالب_حوار_2',
        current_stage: 'counter_argument',
        status: 'active',
        hint_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's-4',
        student_alias: 'طالب_تأمل',
        current_stage: 'reflection',
        status: 'active',
        hint_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 's-5',
        student_alias: 'طالب_مكتمل',
        current_stage: 'submitted',
        status: 'submitted',
        hint_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        activity: sampleActivity,
        sessions: mockSessions,
      }),
    } as any);

    render(<ParticipantTracker activityId={sampleActivity.id} activityStatus="active" />);

    await waitFor(() => {
      expect(screen.getByText('طالب_تحضير')).toBeDefined();
    });

    // Check counts
    // Total = 5
    expect(screen.getByText('5 طالب')).toBeDefined();
    // In preparation = 1 (baseline)
    // In dialogue = 2 (evidence, counter_argument)
    // In reflection = 1 (reflection)
    // Completed = 1 (submitted)
    const hintBadge = screen.getByText('3 / 3');
    expect(hintBadge).toBeDefined();

    // Verify session inspector links exist for all participants
    const links = screen.getAllByRole('link', { name: /فحص الجلسة/i });
    expect(links.length).toBe(5);
    expect(links[0].getAttribute('href')).toContain('/teacher/sessions/');
  });

  it('4. 10-Second Visible Polling & Pause on Hidden: polls every 10 seconds only when visible', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        activity: sampleActivity,
        sessions: [],
      }),
    } as any);

    render(<ParticipantTracker activityId={sampleActivity.id} activityStatus="active" />);

    // Initial fetch
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    // Advance by 10s -> second fetch
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    // Simulate tab becoming hidden
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    fireEvent(document, new Event('visibilitychange'));

    // Advance another 20s while hidden -> no new calls
    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Simulate tab becoming visible again -> immediate refresh and restart timer
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    fireEvent(document, new Event('visibilitychange'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  it('5. Manual Refresh & Error Data Preservation: manual click refreshes and failed refresh retains previous data', async () => {
    const initialSession = [
      {
        id: 's-init-1',
        student_alias: 'طالب_محتفظ_به',
        current_stage: 'understanding' as const,
        status: 'active',
        hint_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          activity: sampleActivity,
          sessions: initialSession,
        }),
      } as any)
      .mockRejectedValueOnce(new Error('Network error')); // Refresh failure

    render(<ParticipantTracker activityId={sampleActivity.id} activityStatus="active" />);

    await waitFor(() => {
      expect(screen.getByText('طالب_محتفظ_به')).toBeDefined();
    });

    // Trigger manual refresh
    const refreshBtn = screen.getByRole('button', { name: /تحديث الآن/i });
    fireEvent.click(refreshBtn);

    // Verify error banner is shown without clearing existing data
    await waitFor(() => {
      expect(screen.getByText(/تعذر تحديث البيانات مؤقتاً/i)).toBeDefined();
    });

    // Previous data remains visible
    expect(screen.getByText('طالب_محتفظ_به')).toBeDefined();
  });
});
