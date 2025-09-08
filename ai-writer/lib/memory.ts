export type Memory = {
  top: string[];
  avg: number;
};

const KEY = 'memoryV3';

export function loadMemory(): Memory {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { top: [], avg: 0 };
    const m = JSON.parse(raw);
    return { top: Array.isArray(m.top) ? m.top : [], avg: typeof m.avg === 'number' ? m.avg : 0 };
  } catch {
    return { top: [], avg: 0 };
  }
}

export function saveMemory(mem: Memory) {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch {}
}

export function updateMemoryFromText(text: string) {
  const words = (text.toLowerCase().match(/[a-zA-Z'][a-zA-Z'\-]*/g) || []).filter(w => w.length > 2);
  const counts: Record<string, number> = {};
  for (const w of words) counts[w] = (counts[w] || 0) + 1;
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, 100).map(([w])=>w);
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const avg = sentences.length ? Math.round(sentences.reduce((a,s)=>a + s.split(/\s+/).length, 0)/sentences.length) : 0;
  saveMemory({ top, avg });
}

export function buildProfile(): string {
  const m = loadMemory();
  const top = m.top.slice(0,20).join(', ');
  const avg = Math.round(m.avg || 0);
  return `Average sentence length: ~${avg} words\nFrequent vocabulary: ${top}\nTone: personal, clear, grounded.`;
}

