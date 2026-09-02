import { Activity, ActivitySource, Message, PedagogicalStage, Session } from '@/lib/db/schema';
import { AIProviderAdapter, getAIProviderAdapter, mockAIProvider } from './provider';
import { buildSocraticSystemPrompt } from './prompts/socratic-prompts';
import { DialogueDecision, DialogueDecisionSchema } from './schemas';
import { generateObject } from 'ai';

export const SOCRATIC_STAGE_SEQUENCE: PedagogicalStage[] = [
  'understanding',
  'evidence',
  'source_check',
  'counter_argument',
  'reflection',
];

/**
 * Enforces server-owned stage progression rules:
 * - Fixed sequence: understanding -> evidence -> source_check -> counter_argument -> reflection
 * - At most 1 stage advance per turn
 * - Weak / unsupported answers stay on same stage
 * - Hints & clarifications never advance
 * - Forged skips or reverse stages are rejected
 */
export function resolveAuthoritativeNextStage(
  currentStage: PedagogicalStage,
  decision: DialogueDecision,
  messageKind: string
): PedagogicalStage {
  // 1. Hints, clarifications, and student questions must never advance the stage
  if (messageKind === 'hint' || messageKind === 'clarification' || messageKind === 'question') {
    return currentStage === 'baseline' ? 'understanding' : currentStage;
  }

  // 2. Weak, unsupported, or unverified claims must remain at current stage
  if (decision.unsupported_claim_refused || decision.stage_objective_satisfied === false) {
    return currentStage === 'baseline' ? 'understanding' : currentStage;
  }

  // 3. Normalized starting stage
  if (currentStage === 'baseline') {
    return 'understanding';
  }

  if (currentStage === 'causal_reasoning') {
    return 'counter_argument';
  }

  const currentIndex = SOCRATIC_STAGE_SEQUENCE.indexOf(currentStage);

  if (currentIndex === -1) {
    return 'understanding';
  }

  // 4. If already at final reflection stage
  if (currentIndex >= SOCRATIC_STAGE_SEQUENCE.length - 1) {
    return 'reflection';
  }

  // 5. Strictly clamp advance to at most ONE stage forward
  return SOCRATIC_STAGE_SEQUENCE[currentIndex + 1];
}

export interface RunDialogueParams {
  activity: Activity;
  sources: ActivitySource[];
  session: Session;
  history: Message[];
  studentMessage: string;
  messageKind: 'normal' | 'clarification' | 'question' | 'hint';
}

export class SocraticDialogueEngine {
  private adapter?: AIProviderAdapter;

  constructor(adapter?: AIProviderAdapter) {
    this.adapter = adapter;
  }

  setAdapter(adapter: AIProviderAdapter) {
    this.adapter = adapter;
  }

  /**
   * Generates the next Socratic turn decision and enforces server-owned stage progression.
   */
  async processTurn(
    params: RunDialogueParams,
    overrideAdapter?: AIProviderAdapter
  ): Promise<DialogueDecision> {
    const adapter = overrideAdapter || this.adapter || getAIProviderAdapter();
    const serverCurrentStage = params.session.current_stage;

    let rawDecision: DialogueDecision;

    if (adapter.isMock) {
      if (adapter.generateMockDialogueTurn) {
        rawDecision = await adapter.generateMockDialogueTurn(params);
      } else {
        rawDecision = await mockAIProvider.generateDialogueTurn(params);
      }
    } else {
      const systemPrompt = buildSocraticSystemPrompt({
        activity: params.activity,
        sources: params.sources,
        currentStage: serverCurrentStage,
        studentAlias: params.session.student_alias,
        initialStance: params.session.initial_stance,
        initialReason: params.session.initial_reason,
        hintCount: params.session.hint_count,
      });

      const conversationHistory = params.history.map((m) => ({
        role: (m.sender === 'student' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

      try {
        const modelInstance = adapter.getModel('dialogue');

        const result = await generateObject({
          model: modelInstance,
          schema: DialogueDecisionSchema,
          system: systemPrompt,
          maxTokens: 1000,
          abortSignal: AbortSignal.timeout(15000),
          messages: [
            ...conversationHistory,
            {
              role: 'user',
              content: `[نوع الرسالة: ${params.messageKind}]\n${params.studentMessage}`,
            },
          ],
        });

        rawDecision = result.object;
      } catch (error: any) {
        // Strict secret and failure isolation: zero cross-provider fallback, generic application error
        throw new Error('AI_PROVIDER_TEMPORARY_ERROR: تعذر الاتصال بمزود الخدمة الذكي مؤقتاً.');
      }
    }

    // Enforce authoritative server-owned stage transition
    const authoritativeNextStage = resolveAuthoritativeNextStage(
      serverCurrentStage,
      rawDecision,
      params.messageKind
    );

    return {
      ...rawDecision,
      next_stage: authoritativeNextStage,
    };
  }
}

export const dialogueEngine = new SocraticDialogueEngine();
