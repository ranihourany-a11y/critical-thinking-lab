import { MockEducationalAIProvider } from './mock-provider';

export type AIProviderType = 'mock' | 'google' | 'openai' | 'anthropic';

export interface AIProviderConfig {
  provider: AIProviderType;
  model: string;
  isMock: boolean;
}

export function getAIProviderConfig(): AIProviderConfig {
  const provider = (process.env.AI_PROVIDER?.toLowerCase() || 'mock') as AIProviderType;
  const model = process.env.AI_MODEL || (
    provider === 'google' ? 'gemini-1.5-flash' :
    provider === 'openai' ? 'gpt-4o-mini' :
    provider === 'anthropic' ? 'claude-3-5-sonnet-20241022' :
    'mock-deterministic'
  );

  // If real provider is selected but missing credentials, fall back to mock
  const hasKey =
    (provider === 'google' && !!process.env.GOOGLE_GENERATIVE_AI_API_KEY) ||
    (provider === 'openai' && !!process.env.OPENAI_API_KEY) ||
    (provider === 'anthropic' && !!process.env.ANTHROPIC_API_KEY);

  const isMock = provider === 'mock' || !hasKey;

  return {
    provider: isMock ? 'mock' : provider,
    model,
    isMock,
  };
}

export const mockAIProvider = new MockEducationalAIProvider();
