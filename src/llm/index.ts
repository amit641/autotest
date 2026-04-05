import { ai } from 'aiclientjs';
import type { AutotestConfig } from '../types.js';

export interface LLMResult {
  text: string;
  tokensUsed: number;
}

/**
 * Call the LLM with the system and user prompts.
 * Streams output to stdout for real-time feedback.
 */
export async function generateWithLLM(
  systemPrompt: string,
  userPrompt: string,
  config: AutotestConfig,
  onChunk?: (text: string) => void,
): Promise<LLMResult> {
  if (onChunk) {
    const stream = await ai(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      {
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        stream: true,
      },
    );

    let fullText = '';
    for await (const chunk of stream) {
      fullText += chunk;
      onChunk(chunk);
    }

    const response = await stream.response();
    return {
      text: fullText,
      tokensUsed: response.usage.totalTokens,
    };
  }

  const response = await ai(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    {
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
    },
  );

  return {
    text: response.text,
    tokensUsed: response.usage.totalTokens,
  };
}
