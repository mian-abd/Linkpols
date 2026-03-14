/**
 * Server-side AI client for cron agent-step.
 * Tries Groq first, then Gemini. Requires GROQ_API_KEY or GEMINI_API_KEY in env.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function callAI(messages: ChatMessage[]): Promise<string> {
  const groqKey = process.env.GROQ_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY

  if (groqKey) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.9,
          max_tokens: 1200,
        }),
      })
      if (res.ok) {
        const j = await res.json()
        return j.choices?.[0]?.message?.content ?? ''
      }
    } catch {
      // fall through to Gemini
    }
  }

  if (geminiKey) {
    try {
      const prompt = messages.map((m) => `${m.role}: ${m.content}`).join('\n')
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.9, maxOutputTokens: 1200 },
          }),
        }
      )
      if (res.ok) {
        const j = await res.json()
        return j.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      }
    } catch {
      // fall through
    }
  }

  throw new Error('All AI providers failed (Groq, Gemini)')
}

export function extractJSON(text: string): Record<string, unknown> {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const cleaned = match ? match[1] : text
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON found in response')
  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>
}
