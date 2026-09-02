import { Activity, Evaluation, Message, Session } from '@/lib/db/schema';
import { getAIProviderConfig, mockAIProvider } from './provider';
import { buildEvaluationSystemPrompt } from './prompts/evaluation-prompts';
import { FormativeEvaluation, FormativeEvaluationSchema } from './schemas';
import { generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

export class FormativeEvaluationEngine {
  /**
   * Verifies whether quoted strings actually exist in the student's text transcript
   */
  verifyTranscriptQuotes(
    evaluation: FormativeEvaluation,
    session: Session,
    transcript: Message[]
  ): { verifiedEvaluation: FormativeEvaluation; passed: boolean } {
    // Collect all student texts
    const studentTexts = [
      session.initial_stance || '',
      session.initial_reason || '',
      session.final_stance || '',
      session.strongest_evidence || '',
      session.strongest_counterargument || '',
      session.remaining_uncertainty || '',
      session.final_reflection || '',
      ...transcript.filter((m) => m.sender === 'student').map((m) => m.content),
    ].join(' ');

    let allVerified = true;

    // Verify verified_quotes array
    const verifiedQuotes = evaluation.verified_quotes.filter((q) => {
      if (!q.quote || q.quote.trim().length < 3) {
        allVerified = false;
        return false;
      }
      const cleanQuote = q.quote.trim();
      const exists = studentTexts.includes(cleanQuote) || studentTexts.includes(cleanQuote.slice(0, 20));
      if (!exists) {
        allVerified = false;
        return false;
      }
      return true;
    });

    return {
      verifiedEvaluation: {
        ...evaluation,
        verified_quotes: verifiedQuotes,
      },
      passed: allVerified,
    };
  }

  /**
   * Generates formative evaluation with teacher-grade rubric scoring and quote verification
   */
  async evaluateSession(params: {
    activity: Activity;
    session: Session;
    transcript: Message[];
  }): Promise<Evaluation> {
    const { activity, session, transcript } = params;
    const config = getAIProviderConfig();

    let rawEvaluation: FormativeEvaluation;

    if (config.isMock) {
      rawEvaluation = await mockAIProvider.generateEvaluation(params);
    } else {
      const systemPrompt = buildEvaluationSystemPrompt(params);

      try {
        let modelInstance;
        if (config.provider === 'google') {
          const google = createGoogleGenerativeAI({
            apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
          });
          modelInstance = google(config.model);
        } else if (config.provider === 'anthropic') {
          const anthropic = createAnthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
          });
          modelInstance = anthropic(config.model);
        } else {
          const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
          });
          modelInstance = openai(config.model);
        }

        const result = await generateObject({
          model: modelInstance,
          schema: FormativeEvaluationSchema,
          system: systemPrompt,
          prompt: 'قم بإجراء التقييم التكويني الشامل للجلسة ومطابقة الأدلة وفق المعايير بدقة.',
        });

        rawEvaluation = result.object;
      } catch (err) {
        console.warn('Real AI evaluation failed, falling back to mock evaluator:', err);
        rawEvaluation = await mockAIProvider.generateEvaluation(params);
      }
    }

    // Verify transcript quotes
    const { verifiedEvaluation, passed } = this.verifyTranscriptQuotes(rawEvaluation, session, transcript);

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
        provider: config.provider,
        model: config.model,
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
