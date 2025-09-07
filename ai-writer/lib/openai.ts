export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function openaiChat(messages: ChatMessage[]) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.2, response_format: { type: 'json_object' } })
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content || '';
  return content;
}

