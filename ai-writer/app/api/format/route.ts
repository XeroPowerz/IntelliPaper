import { NextResponse } from 'next/server'
import { openaiChat, ChatMessage } from '@/lib/openai'

export async function POST(req: Request) {
  const { target, text, profile } = await req.json();
  if (!text || !target) return NextResponse.json({ error: 'bad request' }, { status: 400 });
  if (!['speech','blog','slides','video'].includes(target)) return NextResponse.json({ error: 'invalid target' }, { status: 400 });
  const system = [
    'You transform the provided draft into another format while preserving voice and meaning.',
    'Target formats: speech|blog|slides|video. No external facts; reorganize and adapt tone and structure to the format.',
    'Return JSON only: {"text":"..."} with the transformed content. No markdown fences; slides may use simple headings and bullets.'
  ].join(' ');
  const user = [
    `Target format: ${target}`,
    '<text>\n' + text + '\n</text>',
    'Respond ONLY with JSON {"text":"..."}.'
  ].join('\n');
  const messages: ChatMessage[] = [{ role:'system', content: system }];
  if (profile) messages.push({ role: 'system', content: `User profile (style, vocabulary):\n${profile}` });
  messages.push({ role:'user', content: user });
  const out = await openaiChat(messages);
  let parsed: any = {};
  try { parsed = JSON.parse(out) } catch {}
  if (typeof parsed?.text !== 'string') return NextResponse.json({ error: 'invalid response' }, { status: 500 });
  return NextResponse.json({ text: parsed.text });
}

