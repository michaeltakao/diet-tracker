import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODEL, generateWithRetry } from '@/lib/gemini';

export interface AgentTask {
  id: string;
  systemPrompt: string;
  userMessage: string;
}

export interface AgentResult {
  id: string;
  text: string;
  /**
   * Billed tokens for this agent's call (`usageMetadata.totalTokenCount`),
   * 0 on error. Assumption: failed attempts (429/503) are not billed by
   * Gemini, so retries add nothing beyond the successful attempt's count.
   */
  tokens: number;
  error?: string;
}

/**
 * Runs multiple Gemini agents in parallel using Promise.all.
 * Failed agents return their error in the result instead of throwing.
 */
export async function runParallelAgents(
  apiKey: string,
  tasks: AgentTask[],
  model = GEMINI_MODEL,
): Promise<AgentResult[]> {
  const ai = new GoogleGenAI({ apiKey });

  return Promise.all(
    tasks.map(async (task): Promise<AgentResult> => {
      try {
        // Same transient-failure retry (503/429) as every other Gemini call.
        const response = await generateWithRetry(ai, {
          model,
          contents: [{
            role: 'user',
            parts: [{ text: `${task.systemPrompt}\n\n${task.userMessage}` }],
          }],
        });
        return {
          id: task.id,
          text: (response.text ?? '').trim(),
          tokens: response.usageMetadata?.totalTokenCount ?? 0,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { id: task.id, text: '', tokens: 0, error: message };
      }
    }),
  );
}
