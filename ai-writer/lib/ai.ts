import type { ChatMessage } from './openai'

const base = () => (typeof window !== 'undefined' ? (localStorage.getItem('endpoint') || '') : '');

async function call(path: string, body: any) {
  const endpoint = base() || '';
  const url = endpoint ? `${endpoint}${path}` : path; // support Next API or external proxy
  const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

export async function aiTransform(mode: 'intent'|'plan'|'write'|'refine', text: string, profile?: string) {
  return call('/api/transform', { mode, text, profile }) as Promise<{ text: string }>;
}

export async function aiEdit(instruction: string, text: string, profile?: string) {
  return call('/api/edit', { instruction, text, profile }) as Promise<{ text: string }>;
}

export async function aiSuggest(text: string, profile?: string) {
  return call('/api/suggest', { text, profile }) as Promise<{ suggestions: Array<{ type: string, text: string }> }>;
}

export async function aiFormat(target: 'speech'|'blog'|'slides'|'video', text: string, profile?: string) {
  return call('/api/format', { target, text, profile }) as Promise<{ text: string }>;
}

