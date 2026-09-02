import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  AIProviderAdapter,
  createAIProviderAdapter,
  AIProviderConfigurationError,
  AIModelPurpose,
} from '../src/lib/ai/provider';
import { SocraticDialogueEngine } from '../src/lib/ai/dialogue-engine';
import { FormativeEvaluationEngine } from '../src/lib/ai/evaluation-engine';
import { SEED_ACTIVITY, CLIMATE_CHANGE_SOURCES } from '../src/lib/db/seed';
import { ActivitySource, Message, Session } from '../src/lib/db/schema';

const mockGenerateObject = vi.fn();

vi.mock('ai', () => ({
  generateObject: (...args: any[]) => mockGenerateObject(...args),
}));

describe('Server-side AI Provider Abstraction & Engine Hardening', () => {
  const mockSources: ActivitySource[] = CLIMATE_CHANGE_SOURCES.map((s, idx) => ({
    id: `src-${idx + 1}`,
    activity_id: SEED_ACTIVITY.id,
    title: s.title,
    source_type: s.source_type,
    source_snapshot: s.source_snapshot,
    source_url: s.source_url || null,
    citation_label: s.citation_label,
    created_at: new Date().toISOString(),
  }));

  const mockSession: Session = {
    id: 'test-session-provider',
    activity_id: SEED_ACTIVITY.id,
    student_alias: 'نور',
    session_token_hash: 'hash-test',
    initial_stance: 'الأنشطة البشرية ترفع درجات الحرارة',
    initial_reason: 'بسبب انبعاثات حرق الوقود الأحفوري',
    initial_confidence: 4,
    final_stance: 'الاحترار العالمي نتيجة مباشرة لانبعاثات الإنسان',
    final_confidence: 5,
    strongest_evidence: 'بيانات نظائر الكربون تثبت بصمة الوقود الأحفوري',
    strongest_counterargument: 'الدورات الطبيعية لا تفسر وتيرة الاحترار الحديثة',
    remaining_uncertainty: 'مدى استيعاب المحيطات للحرارة الفائضة',
    final_reflection: 'التمييز بين الارتباط والسببية جوهري في التفكير العلمي',
    current_stage: 'understanding',
    hint_count: 0,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockTranscript: Message[] = [
    {
      id: 'msg-1',
      session_id: mockSession.id,
      client_message_id: 'client-1',
      sequence_number: 1,
      sender: 'student',
      content: 'أعتقد أن الغازات الدفيئة تسبب الاحترار',
      stage: 'understanding',
      message_kind: 'normal',
      status: 'completed',
      created_at: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Verifies direct provider imports are completely absent from both engines', () => {
    const dialogueEnginePath = path.resolve(__dirname, '../src/lib/ai/dialogue-engine.ts');
    const evaluationEnginePath = path.resolve(__dirname, '../src/lib/ai/evaluation-engine.ts');

    const dialogueCode = fs.readFileSync(dialogueEnginePath, 'utf8');
    const evaluationCode = fs.readFileSync(evaluationEnginePath, 'utf8');

    const forbiddenImports = [
      '@ai-sdk/google',
      '@ai-sdk/anthropic',
      '@ai-sdk/openai',
      'createGoogleGenerativeAI',
      'createAnthropic',
      'createOpenAI',
    ];

    for (const forbidden of forbiddenImports) {
      expect(dialogueCode).not.toContain(forbidden);
      expect(evaluationCode).not.toContain(forbidden);
    }
  });

  it('2. Injects mocked Gemini/Anthropic/OpenAI-compatible adapters and verifies both engines use only the selected adapter with separate model purposes', async () => {
    const providers: Array<'google' | 'anthropic' | 'openai'> = ['google', 'anthropic', 'openai'];

    for (const provider of providers) {
      const dialogueModelMock = { modelId: `${provider}-dialogue-model` } as any;
      const evalModelMock = { modelId: `${provider}-eval-model` } as any;

      const getModelMock = vi.fn((purpose: AIModelPurpose) => {
        if (purpose === 'dialogue') return dialogueModelMock;
        if (purpose === 'evaluation') return evalModelMock;
        throw new Error('Unknown purpose');
      });

      const adapter: AIProviderAdapter = {
        provider,
        isMock: false,
        getModel: getModelMock,
      };

      // 1. Dialogue Engine Turn
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          reply: `رد المرشد السقراطي عبر ${provider}`,
          next_stage: 'evidence',
          question_type: 'evidence_request',
          used_source_ids: [mockSources[0].id],
          unsupported_claim_refused: false,
          stage_objective_satisfied: true,
        },
      } as any);

      const dialogueEngine = new SocraticDialogueEngine(adapter);
      const dialogueDecision = await dialogueEngine.processTurn({
        activity: SEED_ACTIVITY,
        sources: mockSources,
        session: mockSession,
        history: mockTranscript,
        studentMessage: 'أرى أن انبعاثات الوقود الأحفوري ترفع حرارة الغلاف الجوي',
        messageKind: 'normal',
      });

      expect(getModelMock).toHaveBeenCalledWith('dialogue');
      expect(dialogueDecision.reply).toContain(provider);
      expect(mockGenerateObject).toHaveBeenLastCalledWith(
        expect.objectContaining({
          model: dialogueModelMock,
          maxTokens: 1000,
        })
      );

      // 2. Evaluation Engine Turn
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          rubric_scores: [
            {
              criterion_id: 'crit-claim-clarity',
              score: 3,
              rationale: 'وضح الموقف بدقة',
              quotes: ['أعتقد أن الغازات الدفيئة تسبب الاحترار'],
            },
            {
              criterion_id: 'crit-evidence-use',
              score: 3,
              rationale: 'استشهد بالبيانات',
              quotes: [],
            },
            {
              criterion_id: 'crit-source-evaluation',
              score: 2,
              rationale: 'فحص المصدر أولي',
              quotes: [],
            },
            {
              criterion_id: 'crit-counter-arguments',
              score: 2,
              rationale: 'ناقش الرأي المخالف',
              quotes: [],
            },
            {
              criterion_id: 'crit-reflection-synthesis',
              score: 3,
              rationale: 'تأمل تركيبي جيد',
              quotes: [],
            },
          ],
          strengths: ['ادعاء واضح'],
          growth_areas: ['تعميق فحص المصادر'],
          misconceptions: [],
          suggested_feedback: 'استمر في تعميق التحليل ومقارنة البيانات.',
          system_confidence: 0.95,
          verified_quotes: [
            {
              quote: 'أعتقد أن الغازات الدفيئة تسبب الاحترار',
              stage: 'understanding',
              criterion_id: 'crit-claim-clarity',
              relevance: 'تحديد الموقف الابتدائي',
            },
          ],
          overall_feedback: 'أداء نقدي متميز',
        },
      } as any);

      const evaluationEngine = new FormativeEvaluationEngine(adapter);
      const evaluation = await evaluationEngine.evaluateSession({
        activity: SEED_ACTIVITY,
        session: mockSession,
        transcript: mockTranscript,
      });

      expect(getModelMock).toHaveBeenCalledWith('evaluation');
      expect(evaluation.metadata.provider).toBe(provider);
      expect(mockGenerateObject).toHaveBeenLastCalledWith(
        expect.objectContaining({
          model: evalModelMock,
        })
      );
    }
  });

  it('3. Verifies unknown, missing, or unavailable configuration fails before model invocation without leaks', () => {
    // Unknown provider
    expect(() =>
      createAIProviderAdapter({
        AI_PROVIDER: 'unsupported-vendor',
      })
    ).toThrow(AIProviderConfigurationError);

    // Missing provider in production fails closed
    expect(() =>
      createAIProviderAdapter({
        NODE_ENV: 'production',
        AI_PROVIDER: '',
      })
    ).toThrow(AIProviderConfigurationError);

    // Mock provider impossible to select silently in production
    expect(() =>
      createAIProviderAdapter({
        NODE_ENV: 'production',
        AI_PROVIDER: 'mock',
      })
    ).toThrow(AIProviderConfigurationError);

    // Real provider without credentials fails closed
    expect(() =>
      createAIProviderAdapter({
        AI_PROVIDER: 'google',
        AI_DIALOGUE_MODEL: 'gemini-model',
        AI_EVALUATION_MODEL: 'gemini-model',
      })
    ).toThrow(AIProviderConfigurationError);

    // Real provider without model configuration fails closed (no hardcoded model fallbacks)
    expect(() =>
      createAIProviderAdapter({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test-secret-key-12345',
      })
    ).toThrow(AIProviderConfigurationError);

    // Verify error messages do not leak secrets or provider details
    try {
      createAIProviderAdapter({
        AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test-secret-key-12345',
      });
    } catch (err: any) {
      expect(err.message).not.toContain('sk-test-secret-key-12345');
      expect(err.message).not.toContain('openai');
      expect(err.message).toContain('خدمة الذكاء الاصطناعي');
    }
  });

  it('4. Verifies no cross-provider fallback occurs when real provider fails, and client-facing error is sanitized', async () => {
    const failingModel = { modelId: 'test-failing-model' } as any;
    const failingAdapter: AIProviderAdapter = {
      provider: 'google',
      isMock: false,
      getModel: vi.fn(() => failingModel),
    };

    // Simulate provider failure (timeout, network error, upstream error)
    mockGenerateObject.mockRejectedValue(
      new Error('Google Generative AI Upstream 503 Service Unavailable with API Key secret-123')
    );

    // 1. Dialogue Engine must fail closed and NOT fallback to mock
    const dialogueEngine = new SocraticDialogueEngine(failingAdapter);
    await expect(
      dialogueEngine.processTurn({
        activity: SEED_ACTIVITY,
        sources: mockSources,
        session: mockSession,
        history: mockTranscript,
        studentMessage: 'رسالة اختبار الفشل',
        messageKind: 'normal',
      })
    ).rejects.toThrow('AI_PROVIDER_TEMPORARY_ERROR');

    // 2. Evaluation Engine must fail closed and NOT fallback to mock
    const evaluationEngine = new FormativeEvaluationEngine(failingAdapter);
    await expect(
      evaluationEngine.evaluateSession({
        activity: SEED_ACTIVITY,
        session: mockSession,
        transcript: mockTranscript,
      })
    ).rejects.toThrow('AI_PROVIDER_TEMPORARY_ERROR');

    // Verify sanitized error message contains zero provider details, model IDs, or secrets
    try {
      await dialogueEngine.processTurn({
        activity: SEED_ACTIVITY,
        sources: mockSources,
        session: mockSession,
        history: mockTranscript,
        studentMessage: 'رسالة اختبار الفشل',
        messageKind: 'normal',
      });
    } catch (err: any) {
      expect(err.message).not.toContain('Google');
      expect(err.message).not.toContain('secret-123');
      expect(err.message).not.toContain('gemini');
      expect(err.message).toContain('AI_PROVIDER_TEMPORARY_ERROR');
    }
  });
});
