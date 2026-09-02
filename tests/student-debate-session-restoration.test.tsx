// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudentDebatePage from '../src/app/student/[sessionId]/debate/page';
import { Message } from '../src/lib/db/schema';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'sess-restore-123' }),
  useRouter: () => ({ push: mockPush }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Authoritative Student Debate Session Restoration', () => {
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  it('1. Authoritative Hydration: restores ordered messages, stage, hint count with no mutations', async () => {
    const mockMessages: Message[] = [
      {
        id: 'msg-db-1',
        session_id: 'sess-restore-123',
        client_message_id: 'client-1',
        sequence_number: 1,
        sender: 'student',
        content: 'أعتقد أن الغازات الدفيئة ترفع حرارة الكوكب.',
        stage: 'understanding',
        message_kind: 'normal',
        status: 'completed',
        created_at: '2026-09-02T10:00:00Z',
      },
      {
        id: 'msg-db-2',
        session_id: 'sess-restore-123',
        client_message_id: 'expert-client-1',
        sequence_number: 2,
        sender: 'expert',
        content: 'ما الدليل الذي يثبت أن هذه الغازات مصدرها بشري؟',
        stage: 'evidence',
        message_kind: 'normal',
        status: 'completed',
        created_at: '2026-09-02T10:00:05Z',
      },
    ];

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session: {
          id: 'sess-restore-123',
          student_alias: 'سارة_المفكرة',
          current_stage: 'evidence',
          hint_count: 2,
          status: 'active',
        },
        activity: {
          id: 'act-1',
          title: 'قضية التغير المناخي',
          topic: 'أسباب الانبعاثات',
          grade_level: 9,
          max_turns: 8,
          ai_stance: 'موقف متشكك علمياً',
          sources: [],
        },
        messages: mockMessages,
      }),
    });

    render(<StudentDebatePage />);

    // Wait for hydration
    await waitFor(() => {
      expect(screen.getByText(/سارة_المفكرة/)).toBeDefined();
    });

    // Verify messages appear in document
    expect(screen.getByText('أعتقد أن الغازات الدفيئة ترفع حرارة الكوكب.')).toBeDefined();
    expect(screen.getByText('ما الدليل الذي يثبت أن هذه الغازات مصدرها بشري؟')).toBeDefined();

    // Verify hint count badge (3 max - 2 used = 1 remaining)
    expect(screen.getByText(/1 متبقية/)).toBeDefined();

    // Verify only 1 GET fetch call was made (no AI provider, no POST inserts)
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/api/student/session');
  });

  it('2. Recoverable State Hydration: restores pending student turn awaiting expert reply and reuses client ID on retry', async () => {
    // Only student message saved, no expert reply exists
    const mockMessages: Message[] = [
      {
        id: 'msg-db-pending-1',
        session_id: 'sess-restore-123',
        client_message_id: 'client-pending-abc',
        sequence_number: 1,
        sender: 'student',
        content: 'التقرير يوضح انبعاثات الوقود الأحفوري بنسبة 80%.',
        stage: 'evidence',
        message_kind: 'normal',
        status: 'completed',
        created_at: '2026-09-02T10:05:00Z',
      },
    ];

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session: {
          id: 'sess-restore-123',
          student_alias: 'أحمد_الناقد',
          current_stage: 'evidence',
          hint_count: 1,
          status: 'active',
        },
        activity: {
          id: 'act-1',
          title: 'قضية التغير المناخي',
          topic: 'أسباب الانبعاثات',
          grade_level: 10,
          max_turns: 8,
          ai_stance: 'موقف متشكك',
          sources: [],
        },
        messages: mockMessages,
      }),
    });

    render(<StudentDebatePage />);

    await waitFor(() => {
      expect(screen.getByText(/أحمد_الناقد/)).toBeDefined();
    });

    // Check that recoverable failure banner is shown
    expect(screen.getByText(/تعذر وصول رد الخبير/i)).toBeDefined();
    const retryBtn = screen.getByRole('button', { name: /إعادة محاولة الرد/i });
    expect(retryBtn).toBeDefined();

    // Mock retry response
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        reply: 'وكيف نتأكد من دقة هذا الرقم مقارنة بالانبعاثات الطبيعية؟',
        stage: 'source_check',
        questionType: 'normal',
        expertMessageId: 'exp-msg-recovered',
      }),
    });

    // Click retry
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    const retryCall = fetchSpy.mock.calls[1];
    const retryPayload = JSON.parse(retryCall[1].body);

    // Verify it reuses the exact same client_message_id and content
    expect(retryPayload.client_message_id).toBe('client-pending-abc');
    expect(retryPayload.content).toBe('التقرير يوضح انبعاثات الوقود الأحفوري بنسبة 80%.');
  });

  it('3. Reflection & Completed Status Handling: disables composer in reflection or completed states', async () => {
    // 3a: Completed session
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session: {
          id: 'sess-restore-123',
          student_alias: 'طالب_مكتمل',
          current_stage: 'reflection',
          hint_count: 3,
          status: 'submitted',
        },
        activity: {
          id: 'act-1',
          title: 'قضية التغير المناخي',
          topic: 'أسباب الانبعاثات',
          grade_level: 11,
          max_turns: 8,
          ai_stance: 'موقف',
          sources: [],
        },
        messages: [],
      }),
    });

    render(<StudentDebatePage />);

    await waitFor(() => {
      expect(screen.getByText('تم إرسال الحوار إلى الأستاذ')).toBeDefined();
    });

    // Verify chat composer textarea is not rendered when completed
    expect(screen.queryByPlaceholderText(/اكتب ردك أو دليلك هنا/i)).toBeNull();
  });

  it('4. Generic Recovery on Invalid Auth/Session: shows safe error without leaking token details', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid token' }),
    });

    render(<StudentDebatePage />);

    await waitFor(() => {
      expect(screen.getAllByText(/تعذر استعادة الجلسة/i).length).toBeGreaterThan(0);
    });

    expect(screen.getByText('تعذر استعادة الجلسة. يرجى التحقق من الرابط أو الانضمام من جديد.')).toBeDefined();
    expect(screen.getByRole('link', { name: /الانضمام لجلسة جديدة/i })).toBeDefined();
  });

  it('5. Temporary Network Error & Retry: preserves state and allows retrying restoration', async () => {
    // First call fails with network error
    fetchSpy.mockRejectedValueOnce(new Error('Network offline'));

    render(<StudentDebatePage />);

    await waitFor(() => {
      expect(screen.getByText(/تعذر استعادة الجلسة/i)).toBeDefined();
    });

    const retryBtn = screen.getByRole('button', { name: /إعادة المحاولة/i });
    expect(retryBtn).toBeDefined();

    // Second call succeeds
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session: {
          id: 'sess-restore-123',
          student_alias: 'سارة_بعد_الانقطاع',
          current_stage: 'understanding',
          hint_count: 0,
          status: 'active',
        },
        activity: {
          id: 'act-1',
          title: 'عنوان النشاط',
          topic: 'الموضوع',
          grade_level: 8,
          max_turns: 8,
          ai_stance: 'موقف',
          sources: [],
        },
        messages: [],
      }),
    });

    // Click retry
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText(/سارة_بعد_الانقطاع/)).toBeDefined();
    });
  });
});
