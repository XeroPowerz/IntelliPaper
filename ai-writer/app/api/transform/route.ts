import { NextResponse } from 'next/server'
import { openaiChat, ChatMessage } from '@/lib/openai'

export async function POST(req: Request) {
  const { mode, text, profile } = await req.json();
  if (!text || !mode) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const system = [
    'You are a careful writing assistant that only restructures or polishes the provided text.',
    'Never add facts, claims, numbers, or details not present in the input.',
    'Preserve the writer\'s voice and meaning. Keep content grounded strictly in the input.',
    'Return only compact JSON: {"text":"..."} with the transformed text. No markdown or code fences.',
  ].join(' ');
  const instructions: Record<string, string> = {
    plan: 'Turn rough notes into a simple, flat outline. Keep order and phrasing; use hyphen bullets. No added content.',
    write: 'Expand a bullet outline into a readable draft. Convert bullets into sentences; group into short paragraphs. No new facts; preserve voice.',
    refine: 'Improve clarity, structure, and flow without changing meaning. Fix spacing, punctuation, repeated words; keep tone.',
    intent: 'Turn the user\'s intent into a grounded first draft. Use only provided ideas; 1–3 concise paragraphs; preserve voice.'
  }
  const user = [
    `Mode: ${mode}`,
    instructions[mode] || '',
    'Input text between <text>...</text>.',
    '<text>\n' + text + '\n</text>',
    'Respond ONLY with JSON {"text":"..."}.',
  ].filter(Boolean).join('\n');
  const messages: ChatMessage[] = [{ role: 'system', content: system }];
  if (profile) messages.push({ role: 'system', content: `User profile (style, vocabulary):\n${profile}` });
  messages.push({ role: 'user', content: user });
  const out = await openaiChat(messages);
  let parsed: any = {};
  try { parsed = JSON.parse(out) } catch {}
  if (typeof parsed?.text !== 'string') return NextResponse.json({ error: 'invalid response' }, { status: 500 });
  return NextResponse.json({ text: parsed.text });
}

