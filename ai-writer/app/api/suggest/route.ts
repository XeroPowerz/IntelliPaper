import { NextResponse } from 'next/server'
import { openaiChat, ChatMessage } from '@/lib/openai'

export async function POST(req: Request) {
  const { text, profile } = await req.json();
  if (!text) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  const system = [
    'You propose helpful inline suggestions based on the current draft and user style.',
    'Offer facts, quotes, or references only when reasonably confident; avoid hallucinations. If unsure, prefer style improvements instead.',
    'Return JSON only: {"suggestions":[{"type":"fact|quote|reference|style","text":"...","source":"...","author":"...","year":2020}]}.',
    'Keep suggestions concise; do not modify the draft; do not include markdown or code fences.',
  ].join(' ');
  const user = [
    'Given the current paragraph between <p>...</p>, propose up to 3 useful suggestions the writer may accept.',
    '<p>\n' + text + '\n</p>',
    'Respond ONLY with the JSON format.'
  ].join('\n');
  const messages: ChatMessage[] = [{ role: 'system', content: system }];
  if (profile) messages.push({ role: 'system', content: `User profile (style, vocabulary):\n${profile}` });
  messages.push({ role: 'user', content: user });
  const out = await openaiChat(messages);
  let parsed: any = {};
  try { parsed = JSON.parse(out) } catch {}
  if (!parsed || !Array.isArray(parsed.suggestions)) return NextResponse.json({ suggestions: [] });
  return NextResponse.json({ suggestions: parsed.suggestions });
}

