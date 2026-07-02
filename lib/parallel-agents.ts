import { GoogleGenAI } from '@google/genai';

export interface AgentTask {
  id: string;
  systemPrompt: string;
  userMessage: string;
}

export interface AgentResult {
  id: string;
  text: string;
  error?: string;
}

/**
 * Runs multiple Gemini agents in parallel using Promise.all.
 * Failed agents return their error in the result instead of throwing.
 */
export async function runParallelAgents(
  apiKey: string,
  tasks: AgentTask[],
  model = 'gemini-2.5-flash',
): Promise<AgentResult[]> {
  const ai = new GoogleGenAI({ apiKey });

  return Promise.all(
    tasks.map(async (task): Promise<AgentResult> => {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{
            role: 'user',
            parts: [{ text: `${task.systemPrompt}\n\n${task.userMessage}` }],
          }],
        });
        return { id: task.id, text: (response.text ?? '').trim() };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { id: task.id, text: '', error: message };
      }
    }),
  );
}
