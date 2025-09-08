const DEFAULT_MODEL = process.env.MODEL_NAME || 'gpt-4o-mini';

async function openaiStream({ system, prompt, model }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const body = {
    model: model || DEFAULT_MODEL,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    stream: true,
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(body)
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(()=> '');
    throw new Error(`OpenAI ${res.status}: ${t}`);
  }
  // Return async iterator over tokens (very simple SSE-like parser for OpenAI streaming)
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  async function* iterator(){
    let buffer = '';
    while(true){
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream:true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const ln of lines){
        const line = ln.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.replace(/^data:\s*/, '');
        if (data === '[DONE]') return;
        try {
          const j = JSON.parse(data);
          const token = j.choices?.[0]?.delta?.content || '';
          if (token) yield token;
        } catch {}
      }
    }
  }
  return iterator();
}

async function openaiComplete({ system, prompt, model }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return `[MOCK] ${prompt.slice(0, 80)}`;
  const body = {
    model: model || DEFAULT_MODEL,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }, body: JSON.stringify(body)
  });
  if (!res.ok) { const t = await res.text().catch(()=> ''); throw new Error(`OpenAI ${res.status}: ${t}`); }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

module.exports = {
  stream: openaiStream,
  complete: openaiComplete,
};

