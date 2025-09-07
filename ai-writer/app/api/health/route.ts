import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ ok: true, model: process.env.OPENAI_MODEL || 'gpt-4o-mini', hasKey: !!process.env.OPENAI_API_KEY })
}

