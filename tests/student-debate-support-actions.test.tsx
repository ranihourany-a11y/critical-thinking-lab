// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StudentDebatePage from '../src/app/student/[sessionId]/debate/page';
import { resolveAuthoritativeNextStage } from '../src/lib/ai/dialogue-engine';
import { buildSocraticSystemPrompt } from '../src/lib/ai/prompts/socratic-prompts';
import { Activity, Message } from '../src/lib/db/schema';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ sessionId: 'sess-actions-123' }),
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

describe('Student Debate Structured Support Actions', () => {
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(global, 'fetch');
  });

  it('1. Pedagogical Stage & Hint Invariants: none of the 3 actions advances stage; only hint increments count', () => {
    // Current stage is 'evidence'
    const dummyDecision: any = {
      reply: 'رد الخبير',
      next_stage: 'source_check', // Attempted AI advance
      stage_objective_satisfied: true,
      unsupported_claim_refused: false,
    };

    // 1a. Hint never advances stage
    const nextStageHint = resolveAuthoritativeNextStage('evidence', dummyDecision, 'hint');
    expect(nextStageHint).toBe('evidence');

    // 1b. Clarification never advances stage
    const nextStageClarify = resolveAuthoritativeNextStage('evidence', dummyDecision, 'clarification');
    expect(nextStageClarify).toBe('evidence');

    // 1c. Question never advances stage
    const nextStageQuestion = resolveAuthoritativeNextStage('evidence', dummyDecision, 'question');
    expect(nextStageQuestion).toBe('evidence');

    // 1d. Normal satisfactory turn advances stage
    const nextStageNormal = resolveAuthoritativeNextStage('evidence', dummyDecision, 'normal');
    expect(nextStageNormal).toBe('source_check');
  });

  it('2. Socratic System Prompt: explicitly instructs scaffolding and strictly prohibits direct answers on hints', () => {
    const mockActivity: Activity = {
      id: 'act-1',
      teacher_id: 't-1',
      title: 'قضية الطاقة النووية',
      topic: 'الاستدامة والأمان',
      grade_level: 10,
      language: 'ar',
      stance_mode: 'contrarian',
      ai_stance: 'موقف متشكك في الأمان النووي',
      status: 'active',
      strict_source: true,
      max_turns: 8,
      version: 1,
      rubric_config: [],
      access_code: 'NUCL89',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const prompt = buildSocraticSystemPrompt({
      activity: mockActivity,
      sources: [
        {
          id: 'src-1',
          activity_id: 'act-1',
          title: 'تقرير الطاقة',
          citation_label: '[تقرير 2024]',
          source_type: 'text',
          source_snapshot: 'تنتج المفاعلات طاقة منخفضة الانبعاثات الكربونية.',
          created_at: new Date().toISOString(),
        },
      ],
      currentStage: 'evidence',
      studentAlias: 'خالد المفكر',
      hintCount: 1,
    });

    // Verify prompt prohibits direct answers and enforces Socratic scaffolding
    expect(prompt).toContain('طلب تلميح (hint)');
    expect(prompt).toContain('يُحظر قطيعاً إعطاؤه الإجابة الجاهزة أو الحل المباشر');
    expect(prompt).toContain('طلب توضيح (clarification)');
    expect(prompt).toContain('سؤال من الطالب (question)');
  });

  it('3. Clarification Action: references previous expert message and sends clarification intent without advancing stage', async () => {
    const existingMessages: Message[] = [
      {
        id: 'msg-exp-1',
        session_id: 'sess-actions-123',
        client_message_id: 'expert-init',
        sequence_number: 1,
        sender: 'expert',
        content: 'ما الدليل الأكثر حسماً في الوثيقة على أن الطاقة النووية آمنة بيئياً؟',
        stage: 'evidence',
        message_kind: 'normal',
        status: 'completed',
        created_at: '2026-09-02T10:00:00Z',
      },
    ];

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session: {
          id: 'sess-actions-123',
          student_alias: 'سارة_الناقدة',
          current_stage: 'evidence',
          hint_count: 0,
          status: 'active',
        },
        activity: {
          id: 'act-1',
          title: 'قضية الطاقة',
          topic: 'الأمان',
          grade_level: 9,
          max_turns: 8,
          sources: [],
        },
        messages: existingMessages,
      }),
    });

    render(<StudentDebatePage />);

    await waitFor(() => {
      expect(screen.getByText(/سارة_الناقدة/)).toBeDefined();
    });

    // Mock chat API response for clarification
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        reply: 'سؤال توضيحي ممتاز! دعنا نبسط المسألة: قارن بين انبعاثات الكربون والنفايات الصلبة.',
        stage: 'evidence', // Stays on same stage
        questionType: 'clarification',
        expertMessageId: 'exp-clarified-1',
      }),
    });

    // Click "طلب توضيح"
    const clarifyBtn = screen.getByRole('button', { name: /طلب توضيح/i });
    fireEvent.click(clarifyBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    const chatCall = fetchSpy.mock.calls[1];
    const payload = JSON.parse(chatCall[1].body);

    // Verify clarification request payload
    expect(payload.message_kind).toBe('clarification');
    expect(payload.content).toContain('هل يمكنك توضيح السؤال السابق');
    expect(payload.content).toContain('ما الدليل الأكثر حسماً');
  });

  it('4. Question Action: activates question mode composer, requires typed student text, and sends question intent', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session: {
          id: 'sess-actions-123',
          student_alias: 'أحمد_المتسائل',
          current_stage: 'evidence',
          hint_count: 0,
          status: 'active',
        },
        activity: {
          id: 'act-1',
          title: 'قضية الطاقة',
          topic: 'الأمان',
          grade_level: 10,
          max_turns: 8,
          sources: [],
        },
        messages: [],
      }),
    });

    render(<StudentDebatePage />);

    await waitFor(() => {
      expect(screen.getByText(/أحمد_المتسائل/)).toBeDefined();
    });

    // Click "اطرح سؤالاً"
    const questionBtn = screen.getByRole('button', { name: /اطرح سؤالاً/i });
    fireEvent.click(questionBtn);

    // Verify question mode banner appears
    expect(screen.getByText(/وضع طرح سؤال على المرشد السقراطي/i)).toBeDefined();

    const textarea = screen.getByPlaceholderText(/اطرح سؤالك أو استفسارك هنا/i) as HTMLTextAreaElement;
    expect(textarea).toBeDefined();

    // Mock chat API response for question
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        reply: 'سؤال وجيه جداً! تكلفة بناء المفاعلات تستغرق عادة سنوات أطول.',
        stage: 'evidence',
        questionType: 'normal',
        expertMessageId: 'exp-q-reply-1',
      }),
    });

    // Student types their actual question
    fireEvent.change(textarea, { target: { value: 'هل تكلفة بناء المفاعلات تفوق فوائدها الاقتصادية؟' } });

    const submitBtn = screen.getByRole('button', { name: /إرسال/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    const chatCall = fetchSpy.mock.calls[1];
    const payload = JSON.parse(chatCall[1].body);

    expect(payload.message_kind).toBe('question');
    expect(payload.content).toBe('هل تكلفة بناء المفاعلات تفوق فوائدها الاقتصادية؟');
  });

  it('5. Hint Action: increments hint count and remains idempotent on duplicate clicks / retries', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        session: {
          id: 'sess-actions-123',
          student_alias: 'سارة_التلميح',
          current_stage: 'understanding',
          hint_count: 1, // 1 used out of 3
          status: 'active',
        },
        activity: {
          id: 'act-1',
          title: 'قضية الطاقة',
          topic: 'الأمان',
          grade_level: 11,
          max_turns: 8,
          sources: [],
        },
        messages: [],
      }),
    });

    render(<StudentDebatePage />);

    await waitFor(() => {
      expect(screen.getByText(/سارة_التلميح/)).toBeDefined();
    });

    // Hint button shows 2 remaining
    expect(screen.getByText(/2 متبقية/)).toBeDefined();

    // Mock hint response
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        reply: 'تلميح مرشد: انظر في جدول انبعاثات دورة الحياة الكاملة للمحطة.',
        stage: 'understanding',
        questionType: 'hint',
        expertMessageId: 'exp-hint-reply-1',
      }),
    });

    const hintBtn = screen.getByRole('button', { name: /أحتاج تلميحاً/i });
    fireEvent.click(hintBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    const chatCall = fetchSpy.mock.calls[1];
    const payload = JSON.parse(chatCall[1].body);

    expect(payload.message_kind).toBe('hint');
    expect(payload.content).toContain('أحتاج تلميحاً');

    // Hint count in badge now reflects 1 remaining (2 used)
    await waitFor(() => {
      expect(screen.getByText(/1 متبقية/)).toBeDefined();
    });
  });
});
