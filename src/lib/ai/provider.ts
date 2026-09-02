import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { MockEducationalAIProvider } from './mock-provider';
import type { LanguageModelV1 } from '@ai-sdk/provider';

export type AIProviderType = 'google' | 'anthropic' | 'openai' | 'mock';
export type AIModelPurpose = 'dialogue' | 'evaluation';

export const ALLOWED_PROVIDERS: readonly AIProviderType[] = ['google', 'anthropic', 'openai', 'mock'] as const;

export class AIProviderConfigurationError extends Error {
  constructor(message = 'خدمة الذكاء الاصطناعي غير مهيأة أو غير متوفرة حالياً.') {
    super(message);
    this.name = 'AIProviderConfigurationError';
  }
}

export interface AIProviderAdapter {
  readonly provider: AIProviderType;
  readonly isMock: boolean;
  getModel(purpose: AIModelPurpose): LanguageModelV1;
  generateMockDialogueTurn?(params: any): Promise<any>;
  generateMockEvaluation?(params: any): Promise<any>;
}

export const mockAIProvider = new MockEducationalAIProvider();

export class MockAIProviderAdapter implements AIProviderAdapter {
  readonly provider: AIProviderType = 'mock';
  readonly isMock = true;

  getModel(_purpose: AIModelPurpose): LanguageModelV1 {
    throw new AIProviderConfigurationError('خدمة الذكاء الاصطناعي غير متوفرة حالياً.');
  }

  async generateMockDialogueTurn(params: any): Promise<any> {
    return mockAIProvider.generateDialogueTurn(params);
  }

  async generateMockEvaluation(params: any): Promise<any> {
    return mockAIProvider.generateEvaluation(params);
  }
}

export class RealAIProviderAdapter implements AIProviderAdapter {
  readonly provider: AIProviderType;
  readonly isMock = false;
  private dialogueModel: LanguageModelV1;
  private evaluationModel: LanguageModelV1;

  constructor(
    provider: AIProviderType,
    dialogueModel: LanguageModelV1,
    evaluationModel: LanguageModelV1
  ) {
    this.provider = provider;
    this.dialogueModel = dialogueModel;
    this.evaluationModel = evaluationModel;
  }

  getModel(purpose: AIModelPurpose): LanguageModelV1 {
    if (purpose === 'dialogue') {
      return this.dialogueModel;
    }
    if (purpose === 'evaluation') {
      return this.evaluationModel;
    }
    throw new AIProviderConfigurationError('خدمة الذكاء الاصطناعي غير متوفرة حالياً.');
  }
}

/**
 * Server-only provider adapter factory.
 * Resolves credentials and separate dialogue/evaluation models from server environment.
 * Fails closed on missing or unknown configuration; strictly disallows mock in production.
 */
export function createAIProviderAdapter(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): AIProviderAdapter {
  // Guard against browser execution
  if (typeof window !== 'undefined') {
    throw new AIProviderConfigurationError('AI provider is server-only.');
  }

  const isProduction = env.NODE_ENV === 'production';
  const rawProvider = env.AI_PROVIDER?.trim().toLowerCase();

  // In production, mock or missing configuration is strictly prohibited
  if (isProduction) {
    if (!rawProvider || rawProvider === 'mock') {
      throw new AIProviderConfigurationError('خدمة الذكاء الاصطناعي غير متوفرة حالياً.');
    }
  }

  // If no provider set in non-production, default to mock
  if (!rawProvider) {
    return new MockAIProviderAdapter();
  }

  // Validate allowed provider identifiers
  if (!ALLOWED_PROVIDERS.includes(rawProvider as AIProviderType)) {
    throw new AIProviderConfigurationError('خدمة الذكاء الاصطناعي غير متوفرة حالياً.');
  }

  const providerType = rawProvider as AIProviderType;

  if (providerType === 'mock') {
    if (isProduction) {
      throw new AIProviderConfigurationError('خدمة الذكاء الاصطناعي غير متوفرة حالياً.');
    }
    return new MockAIProviderAdapter();
  }

  // Real provider: check credentials
  let apiKey: string | undefined;
  if (providerType === 'google') {
    apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  } else if (providerType === 'anthropic') {
    apiKey = env.ANTHROPIC_API_KEY?.trim();
  } else if (providerType === 'openai') {
    apiKey = env.OPENAI_API_KEY?.trim();
  }

  if (!apiKey) {
    throw new AIProviderConfigurationError('خدمة الذكاء الاصطناعي غير متوفرة حالياً.');
  }

  // Separate model settings for dialogue and evaluation (no hardcoded models)
  const dialogueModelId = env.AI_DIALOGUE_MODEL?.trim() || env.AI_MODEL?.trim();
  const evaluationModelId = env.AI_EVALUATION_MODEL?.trim() || env.AI_MODEL?.trim();

  if (!dialogueModelId || !evaluationModelId) {
    throw new AIProviderConfigurationError('خدمة الذكاء الاصطناعي غير متوفرة حالياً.');
  }

  // Instantiate provider-specific models without cross-provider fallback
  let dialogueModel: LanguageModelV1;
  let evaluationModel: LanguageModelV1;

  if (providerType === 'google') {
    const google = createGoogleGenerativeAI({ apiKey });
    dialogueModel = google(dialogueModelId);
    evaluationModel = google(evaluationModelId);
  } else if (providerType === 'anthropic') {
    const anthropic = createAnthropic({ apiKey });
    dialogueModel = anthropic(dialogueModelId);
    evaluationModel = anthropic(evaluationModelId);
  } else {
    const openai = createOpenAI({ apiKey });
    dialogueModel = openai(dialogueModelId);
    evaluationModel = openai(evaluationModelId);
  }

  return new RealAIProviderAdapter(providerType, dialogueModel, evaluationModel);
}

export function getAIProviderAdapter(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): AIProviderAdapter {
  return createAIProviderAdapter(env);
}

export interface AIProviderConfig {
  provider: AIProviderType;
  model: string;
  isMock: boolean;
}

export function getAIProviderConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): AIProviderConfig {
  const adapter = getAIProviderAdapter(env);
  return {
    provider: adapter.provider,
    model: env.AI_MODEL || env.AI_DIALOGUE_MODEL || '',
    isMock: adapter.isMock,
  };
}
