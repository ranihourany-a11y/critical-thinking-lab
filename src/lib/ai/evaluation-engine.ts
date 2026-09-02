import { Activity, Evaluation, Message, Session } from '@/lib/db/schema';
import { AIProviderAdapter, getAIProviderAdapter, mockAIProvider } from './provider';
import { buildEvaluationSystemPrompt } from './prompts/evaluation-prompts';
import { FormativeEvaluation, FormativeEvaluationSchema } from './schemas';
import { generateObject } from 'ai';
import { storage } from '@/lib/db/storage';

export class FormativeEvaluationEngine {
  private adapter?: AIProviderAdapter;

  constructor(adapter?: AIProviderAdapter) {
    this.adapter = adapter;
  }

  setAdapter(adapter: AIProviderAdapter) {
    this.adapter = adapter;
  }

  /**
   * Strictly verifies whether quoted strings are exact substrings of saved student messages or reflections.
   * Rejects fabricated or expert-authored quotes and associates student message IDs.
   */
  verifyTranscriptQuotes(
    evaluation: FormativeEvaluation,
    session: Session,
    transcript: Message[]
  ): { verifiedEvaluation: FormativeEvaluation; passed: boolean } {
    const studentMessages = transcript.filter((m) => m.sender === 'student');
    const expertMessages = transcript.filter((m) => m.sender === 'expert');

    const studentReflections = [
      session.initial_stance,
      session.initial_reason,
      session.final_stance,
      session.strongest_evidence,
      session.strongest_counterargument,
      session.remaining_uncertainty,
      session.final_reflection,
    ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

    let allVerified = true;

    // Helper: checks if a quote is an exact substring of a student text
    const findStudentMatch = (
      quoteText: string
    ): { matched: boolean; messageId?: string } => {
      if (!quoteText || quoteText.trim().length < 2) {
        return { matched: false };
      }
      const cleanQuote = quoteText.trim();

      // Check if it matches an expert message exclusively (reject expert-authored quotes)
      const isExpertQuote = expertMessages.some((m) => m.content.includes(cleanQuote));

      // Check student messages
      for (const sm of studentMessages) {
        if (sm.content.includes(cleanQuote)) {
          return { matched: true, messageId: sm.id };
        }
      }

      // Check student reflection fields
      for (const sr of studentReflections) {
        if (sr.includes(cleanQuote)) {
          return { matched: true, messageId: 'session-reflection' };
        }
      }

      // If it only matched expert or nothing at all
      if (isExpertQuote) {
        return { matched: false };
      }

      return { matched: false };
    };

    // Filter and enrich verified_quotes
    const verifiedQuotes = evaluation.verified_quotes
      .map((q) => {
        const match = findStudentMatch(q.quote);
        if (!match.matched) {
          allVerified = false;
          return null;
        }
        return {
          ...q,
          message_id: q.message_id || match.messageId,
        };
      })
      .filter((q): q is NonNullable<typeof q> => q !== null);

    // Filter quotes inside rubric_scores
    const verifiedRubricScores = evaluation.rubric_scores.map((scoreObj) => {
      const validScoreQuotes = scoreObj.quotes.filter((q) => {
        const match = findStudentMatch(q);
        if (!match.matched) {
          allVerified = false;
          return false;
        }
        return true;
      });
      return {
        ...scoreObj,
        quotes: validScoreQuotes,
      };
    });

    return {
      verifiedEvaluation: {
        ...evaluation,
        rubric_scores: verifiedRubricScores,
        verified_quotes: verifiedQuotes,
      },
      passed: allVerified && verifiedQuotes.length > 0,
    };
  }

  /**
   * Generates formative evaluation with teacher-grade rubric scoring and strict quote verification.
   * Rejects malformed output without saving partial records.
   */
  async evaluateSession(
    params: {
      activity: Activity;
      session: Session;
      transcript: Message[];
    },
    overrideAdapter?: AIProviderAdapter
  ): Promise<Evaluation> {
    const { activity, session, transcript } = params;
    const adapter = overrideAdapter || this.adapter || getAIProviderAdapter();

    let rawEvaluation: FormativeEvaluation;

    if (adapter.isMock) {
      if (adapter.generateMockEvaluation) {
        rawEvaluation = await adapter.generateMockEvaluation(params);
      } else {
        rawEvaluation = await mockAIProvider.generateEvaluation(params);
      }
    } else {
      const systemPrompt = buildEvaluationSystemPrompt(params);

      try {
        const modelInstance = adapter.getModel('evaluation');

        const result = await generateObject({
          model: modelInstance,
          schema: FormativeEvaluationSchema,
          system: systemPrompt,
          prompt: 'قم بإجراء التقييم التكويني الشامل للجلسة ومطابقة الأدلة وفق المعايير بدقة.',
        });

        rawEvaluation = result.object;
      } catch (err: any) {
        // Strict secret and failure isolation: zero cross-provider fallback, generic application error
        throw new Error('AI_PROVIDER_TEMPORARY_ERROR: تعذر إجراء التقييم التكويني مؤقتاً.');
      }
    }

    // 1. Strict Schema Validation
    const parsed = FormativeEvaluationSchema.safeParse(rawEvaluation);
    if (!parsed.success) {
      throw new Error(`MALFORMED_EVALUATION_OUTPUT: ${JSON.stringify(parsed.error.flatten())}`);
    }

    // 2. Validate configured score ranges and rubric criteria integrity
    const configuredCriteriaIds = new Set(activity.rubric_config.map((c) => c.id));
    for (const scoreObj of rawEvaluation.rubric_scores) {
      if (!configuredCriteriaIds.has(scoreObj.criterion_id)) {
        throw new Error(`INVALID_CRITERION_ID: Score referenced unknown criterion ${scoreObj.criterion_id}`);
      }
      if (scoreObj.score < 0 || scoreObj.score > 4) {
        throw new Error(`SCORE_OUT_OF_RANGE: Score ${scoreObj.score} for criterion ${scoreObj.criterion_id} exceeds 0..4`);
      }
    }

    // 3. Verify transcript quotes (rejecting fabricated or expert-authored quotes)
    const { verifiedEvaluation, passed } = this.verifyTranscriptQuotes(
      rawEvaluation,
      session,
      transcript
    );

    // 4. Construct complete evaluation record with teacher_approved = false
    const evaluationRecord: Evaluation = {
      id: crypto.randomUUID(),
      session_id: session.id,
      rubric_scores: verifiedEvaluation.rubric_scores,
      verified_quotes: verifiedEvaluation.verified_quotes,
      strengths: verifiedEvaluation.strengths,
      misconceptions: verifiedEvaluation.misconceptions,
      suggested_feedback: verifiedEvaluation.suggested_feedback,
      system_confidence: verifiedEvaluation.system_confidence,
      metadata: {
        provider: adapter.provider,
        model: adapter.isMock
          ? 'mock-deterministic'
          : (process.env.AI_EVALUATION_MODEL || process.env.AI_MODEL || 'configured-model'),
        prompt_version: '1.0.0',
        evaluated_at: new Date().toISOString(),
        quote_verification_passed: passed,
      },
      teacher_approved: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return evaluationRecord;
  }
}

export const evaluationEngine = new FormativeEvaluationEngine();
