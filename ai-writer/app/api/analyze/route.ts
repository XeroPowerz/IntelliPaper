import { NextResponse } from 'next/server'
import { openaiChat, ChatMessage } from '@/lib/openai'

export async function POST(req: Request) {
  const { text, profile } = await req.json();
  if (!text) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const system = [
    'You analyze a user\'s current draft and propose a structure suitable for its purpose.',
    'You do not add any new facts or claims; you only reorganize and label what is there.',
    'Return JSON only: {"type":"blog_post|script|email|memo|essay|report|notes","confidence":0..1,"markdown":"..."}.',
    'The markdown should restructure the input with headings, bullets, and section breaks appropriate to the detected type, using only the input text.',
  ].join(' ');
  const user = [
    'Detect the most suitable structure and propose a formatted markdown version.',
    'Keep all substance; preserve voice; do not add content.',
    '<text>\n' + text + '\n</text>',
    'Respond ONLY with JSON as specified.',
  ].join('\n');
  const messages: ChatMessage[] = [{ role: 'system', content: system }];
  if (profile) messages.push({ role: 'system', content: `User profile (style, vocabulary):\n${profile}` });
  messages.push({ role: 'user', content: user });
  const out = await openaiChat(messages);
  let parsed: any = {};
  try { parsed = JSON.parse(out) } catch {}
  if (!parsed || typeof parsed.type !== 'string' || typeof parsed.markdown !== 'string') return NextResponse.json({ error: 'invalid analyze response' }, { status: 500 });
  if (typeof parsed.confidence !== 'number') parsed.confidence = 0.6;
  return NextResponse.json(parsed);
}

