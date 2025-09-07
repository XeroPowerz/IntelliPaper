import { NextResponse } from 'next/server'
import { openaiChat, ChatMessage } from '@/lib/openai'

export async function POST(req: Request) {
  const { instruction, text, profile } = await req.json();
  if (!instruction || !text) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const system = [
    'You are a precise copy editor. You only transform the provided span per the instruction.',
    'Preserve meaning, voice, and factual content. Do not add outside facts.',
    'Return JSON only: {"text":"..."} with the edited span. No markdown or code fences.',
  ].join(' ');
  const user = [
    `Instruction: ${instruction}`,
    'Edit only the span between <span>...</span>. Keep length reasonably similar unless brevity is asked.',
    '<span>\n' + text + '\n</span>',
    'Respond ONLY with JSON {"text":"..."}.',
  ].join('\n');
  const messages: ChatMessage[] = [{ role: 'system', content: system }];
  if (profile) messages.push({ role: 'system', content: `User profile (style, vocabulary):\n${profile}` });
  messages.push({ role: 'user', content: user });
  const out = await openaiChat(messages);
  let parsed: any = {};
  try { parsed = JSON.parse(out) } catch {}
  if (typeof parsed?.text !== 'string') return NextResponse.json({ error: 'invalid response' }, { status: 500 });
  return NextResponse.json({ text: parsed.text });
}

