import { Activity, ActivitySource, Message, PedagogicalStage, Session } from '@/lib/db/schema';
import { getAIProviderConfig, mockAIProvider } from './provider';
import { buildSocraticSystemPrompt } from './prompts/socratic-prompts';
import { DialogueDecision, DialogueDecisionSchema } from './schemas';
import { generateObject, streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

export interface RunDialogueParams {
  activity: Activity;
  sources: ActivitySource[];
  session: Session;
  history: Message[];
  studentMessage: string;
  messageKind: 'normal' | 'clarification' | 'question' | 'hint';
}

export class SocraticDialogueEngine {
  /**
   * Generates the next Socratic turn decision
   */
  async processTurn(params: RunDialogueParams): Promise<DialogueDecision> {
    const config = getAIProviderConfig();

    if (config.isMock) {
      return await mockAIProvider.generateDialogueTurn(params);
    }

    // When real AI credentials are provided
    const systemPrompt = buildSocraticSystemPrompt({
      activity: params.activity,
      sources: params.sources,
      currentStage: params.session.current_stage,
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
        schema: DialogueDecisionSchema,
        system: systemPrompt,
        messages: [
          ...conversationHistory,
          {
            role: 'user',
            content: `[نوع الرسالة: ${params.messageKind}]\n${params.studentMessage}`,
          },
        ],
      });

      return result.object;
    } catch (error) {
      console.warn('Real AI provider invocation failed, falling back to mock provider:', error);
      return await mockAIProvider.generateDialogueTurn(params);
    }
  }
}

export const dialogueEngine = new SocraticDialogueEngine();
