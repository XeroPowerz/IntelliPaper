"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type Suggestion = { type: string; text: string; source?: string; author?: string; year?: number };

export default function Page() {
  const [text, setText] = useState<string>("");
  const [pending, setPending] = useState<{before:string, after:string}|null>(null);
  const [undo, setUndo] = useState<string[]>([]);
  const [redo, setRedo] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState<{ok:boolean, hasKey:boolean}>({ok:false, hasKey:false});
  const [structure, setStructure] = useState<{type:string, confidence:number, markdown:string}>({type:'auto', confidence:0, markdown:''});
  const [showIntent, setShowIntent] = useState(false);
  const [intent, setIntent] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quick, setQuick] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const endpoint = typeof window !== 'undefined' ? (localStorage.getItem('endpoint') || 'http://localhost:3001') : 'http://localhost:3001';

  // Load persisted text
  useEffect(() => {
    const saved = localStorage.getItem('docTextV2') || '';
    setText(saved);
    if (!saved.trim()) setShowIntent(true);
    ping();
  }, []);

  useEffect(() => { localStorage.setItem('docTextV2', text); }, [text]);

  function profile(): string {
    const mem = JSON.parse(localStorage.getItem('memoryV2') || '{"top":[],"avg":0}') as any;
    const top = Array.isArray(mem.top) ? mem.top.slice(0,20).join(', ') : '';
    const avg = Math.round(mem.avg || 0);
    return `Average sentence length: ~${avg} words\nFrequent vocabulary: ${top}\nTone: personal, clear, grounded.`;
  }

  async function ping() {
    try {
      const r = await fetch(`${endpoint}/api/health`);
      const d = await r.json();
      setConnected({ ok: !!d.ok, hasKey: !!d.hasKey });
    } catch {
      setConnected({ ok:false, hasKey:false });
    }
  }

  async function call(path:string, body:any) {
    const r = await fetch(`${endpoint}${path}`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
    if (!r.ok) throw new Error(`${r.status}`);
    return r.json();
  }

  async function draftFromIntent() {
    if (!intent.trim()) return;
    setShowIntent(false); // dissolve
    focusEditorEnd();
    setBusy(true);
    try {
      const { text: out } = await call('/api/transform', { mode:'intent', text:intent, profile: profile() });
      setUndo([]); setRedo([]);
      setText(out);
      updateMemory(out);
      analyze(out);
    } catch (e) { console.error(e); }
    finally { setBusy(false); }
  }

  function focusEditorEnd() {
    const el = editorRef.current; if (!el) return;
    el.focus(); const end = el.value.length; try { el.setSelectionRange(end, end); } catch {}
  }

  function setPendingChange(after:string) {
    setPending({ before: text, after });
  }

  function applyPending() {
    if (!pending) return;
    setUndo(u => [...u, text]); setRedo([]);
    const after = pending.after;
    setText(after);
    setPending(null);
    updateMemory(after);
    analyze(after);
  }

  function discardPending() { setPending(null); }

  function onUndo() {
    if (pending) { setPending(null); return; }
    setRedo(r => [text, ...r]);
    setUndo(u => { const prev = u[u.length-1]; const rest = u.slice(0,-1); if (prev !== undefined) setText(prev); return rest; });
  }
  function onRedo() {
    if (pending) { setPending(null); return; }
    setUndo(u => [...u, text]);
    setRedo(r => { const nxt = r[0]; const rest = r.slice(1); if (nxt !== undefined) setText(nxt); return rest; });
  }

  async function transform(cmd:'plan'|'write'|'refine') {
    setBusy(true);
    try { const { text: out } = await call('/api/transform', { mode:cmd, text, profile: profile() }); setPendingChange(out); }
    catch(e){ console.error(e); }
    finally { setBusy(false); }
  }

  async function inlineEdit(instruction:string) {
    const el = editorRef.current; if (!el) return;
    const start = el.selectionStart ?? 0; const end = el.selectionEnd ?? 0; if (end<=start) return;
    setBusy(true);
    try {
      const span = text.slice(start, end);
      const { text: edited } = await call('/api/edit', { instruction, text: span, profile: profile() });
      const after = text.slice(0,start) + edited + text.slice(end);
      setPendingChange(after);
      setTimeout(applyPending, 10);
    } catch(e){ console.error(e); }
    finally{ setBusy(false); setQuickOpen(false); setQuick(""); }
  }

  async function analyze(src?:string) {
    try { const { type, confidence, markdown } = await call('/api/analyze', { text: (src ?? text), profile: profile() }); setStructure({ type, confidence, markdown }); }
    catch {}
  }

  async function suggest() {
    try {
      const para = currentParagraph(); if (!para.trim()) return setSuggestions([]);
      const { suggestions } = await call('/api/suggest', { text: para, profile: profile() });
      setSuggestions(suggestions || []);
    } catch { setSuggestions([]); }
  }

  function currentParagraph(): string {
    const el = editorRef.current; if (!el) return '';
    const pos = el.selectionStart || 0; const value = el.value;
    const before = value.slice(0,pos); const after = value.slice(pos);
    const s = before.lastIndexOf('\n\n') + 2; const eRel = after.indexOf('\n\n'); const e = eRel === -1 ? value.length : pos + eRel;
    return value.slice(s,e);
  }

  function insertSuggestion(s: Suggestion) {
    const el = editorRef.current; if (!el) return;
    const pos = el.selectionEnd ?? el.selectionStart ?? text.length;
    const insertion = (text[pos-1] && /[\s\n]/.test(text[pos-1]) ? '' : ' ') + s.text + ' ';
    const after = text.slice(0,pos) + insertion + text.slice(pos);
    setPendingChange(after);
    setTimeout(applyPending, 10);
  }

  function updateMemory(t: string) {
    // Lightweight local memory
    const words = (t.toLowerCase().match(/[a-zA-Z'][a-zA-Z'\-]*/g) || []).filter(w => w.length>2);
    const counts: Record<string, number> = {};
    for (const w of words) counts[w] = (counts[w]||0) + 1;
    const top = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0, 100).map(([w,_])=>w);
    const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
    const avg = sentences.length ? Math.round(sentences.reduce((a,s)=>a + s.split(/\s+/).length, 0)/sentences.length) : 0;
    localStorage.setItem('memoryV2', JSON.stringify({ top, avg }));
  }

  // Debounced suggestions while typing
  useEffect(() => {
    const id = setTimeout(() => { if (connected.ok && connected.hasKey) suggest(); }, 700);
    return () => clearTimeout(id);
  }, [text, connected.ok, connected.hasKey]);

  // shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault(); setShowIntent(v => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        const el = editorRef.current; if (!el) return;
        if ((el.selectionEnd ?? 0) > (el.selectionStart ?? 0)) { e.preventDefault(); setQuickOpen(true); setQuick(""); }
      }
      if (e.key === 'Escape') { if (showIntent) setShowIntent(false); if (quickOpen) setQuickOpen(false); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [showIntent, quickOpen]);

  const ready = connected.ok && connected.hasKey;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] h-screen">
      {/* Editor Pane */}
      <main className="flex flex-col">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border bg-black/10">
          <div className="font-semibold tracking-tight">Intelligence Paper</div>
          <div className="flex-1" />
          <button disabled={undo.length===0} onClick={onUndo} className="btn">Undo</button>
          <button disabled={redo.length===0} onClick={onRedo} className="btn">Redo</button>
        </header>

        <div className="relative h-full">
          <textarea ref={editorRef} value={text} onChange={e=>setText(e.target.value)} placeholder="Type or paste. Press Ctrl+J on a selection to edit by instruction."
            className="w-full h-full resize-none outline-none bg-transparent text-text text-[18px] leading-8 p-6" />

          {/* Quick command */}
          {quickOpen && (
            <div className="absolute top-3 right-3 bg-[#141828] border border-border rounded-lg px-3 py-2 shadow-lg">
              <input autoFocus value={quick} onChange={e=>setQuick(e.target.value)} onKeyDown={e=>{
                if (e.key==='Enter' && quick.trim()) inlineEdit(quick.trim()); if (e.key==='Escape') setQuickOpen(false);
              }} placeholder="Describe the edit… e.g., make this more inspiring" className="bg-transparent outline-none w-[320px] text-sm" />
            </div>
          )}

          {/* Suggestion bar */}
          {suggestions.length>0 && (
            <div className="absolute left-3 right-3 bottom-3 bg-[#0f1426cc] border border-border rounded-lg px-2 py-2 flex flex-wrap gap-2 shadow-md">
              {suggestions.slice(0,3).map((s, i)=> (
                <button key={i} onClick={()=>insertSuggestion(s)} className="px-3 py-1 rounded-full text-xs bg-[#16213b] border border-border hover:border-[#2a3352]">
                  {(s.type? `${s.type}: `: '') + s.text}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Intent Overlay */}
        {showIntent && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
            <div className="w-[min(820px,92vw)] bg-panel border border-border rounded-xl p-5">
              <div className="text-lg font-semibold mb-1">What do you want to write?</div>
              <div className="text-muted text-sm mb-3">Describe your intent in plain language. We’ll draft it instantly.</div>
              <textarea value={intent} onChange={e=>setIntent(e.target.value)} rows={6} className="w-full bg-[#12182b] border border-border rounded-lg p-3 outline-none" />
              <div className="mt-3 flex items-center gap-2">
                <button className="btn btn-primary" onClick={draftFromIntent} disabled={!ready || busy}>Create Draft</button>
                <button className="btn" onClick={()=>setShowIntent(false)}>Skip</button>
                <span className="text-muted text-xs">{ready? (busy? 'Working…' : '') : 'Connect local AI proxy'}</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sidebar */}
      <aside className="flex flex-col gap-3 p-3 border-l border-border bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent),theme(colors.panel)]">
        <div className="bg-panel2 border border-border rounded-xl p-3">
          <div className="uppercase text-[11px] tracking-wider text-muted mb-2">Commands</div>
          <div className="grid grid-cols-1 gap-2">
            <button onClick={()=>transform('plan')} className="btn" disabled={!ready || busy}>/plan → Outline</button>
            <button onClick={()=>transform('write')} className="btn" disabled={!ready || busy}>/write → Draft</button>
            <button onClick={()=>transform('refine')} className="btn" disabled={!ready || busy}>/refine → Polish</button>
          </div>
        </div>

        <div className="bg-panel2 border border-border rounded-xl p-3">
          <div className="uppercase text-[11px] tracking-wider text-muted mb-2">Proposed Change</div>
          <div className="flex items-center gap-2 mb-2">
            <button className="btn btn-primary" disabled={!pending} onClick={applyPending}>Apply</button>
            <button className="btn" disabled={!pending} onClick={discardPending}>Discard</button>
            <span className="text-xs text-muted">{busy? 'Working…' : ''}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 border border-border rounded-lg overflow-hidden">
            <div>
              <div className="text-xs text-muted px-2 py-1 border-b border-border bg-[#121729]">Before</div>
              <div className="p-2 text-sm whitespace-pre-wrap min-h-[120px]">{(pending?.before ?? text)}</div>
            </div>
            <div>
              <div className="text-xs text-muted px-2 py-1 border-b border-border bg-[#121729]">After</div>
              <div className="p-2 text-sm whitespace-pre-wrap min-h-[120px]">{(pending?.after ?? text)}</div>
            </div>
          </div>
        </div>

        <div className="bg-panel2 border border-border rounded-xl p-3">
          <div className="uppercase text-[11px] tracking-wider text-muted mb-2">Formats</div>
          <div className="flex flex-wrap gap-2">
            <FormatButton label="Speech" onClick={async()=>{ setBusy(true); try{ const {text:out}=await call('/api/format',{target:'speech', text, profile: profile()}); setPendingChange(out);} finally{ setBusy(false);} }} disabled={!ready||busy} />
            <FormatButton label="Blog" onClick={async()=>{ setBusy(true); try{ const {text:out}=await call('/api/format',{target:'blog', text, profile: profile()}); setPendingChange(out);} finally{ setBusy(false);} }} disabled={!ready||busy} />
            <FormatButton label="Slides" onClick={async()=>{ setBusy(true); try{ const {text:out}=await call('/api/format',{target:'slides', text, profile: profile()}); setPendingChange(out);} finally{ setBusy(false);} }} disabled={!ready||busy} />
            <FormatButton label="Video" onClick={async()=>{ setBusy(true); try{ const {text:out}=await call('/api/format',{target:'video', text, profile: profile()}); setPendingChange(out);} finally{ setBusy(false);} }} disabled={!ready||busy} />
          </div>
        </div>

        <div className="bg-panel2 border border-border rounded-xl p-3">
          <div className="uppercase text-[11px] tracking-wider text-muted mb-2">Export</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={()=>download('document.md', text)}>Export .md</button>
            <button className="btn" onClick={()=>window.print()}>Export .pdf</button>
          </div>
        </div>

        <div className="bg-panel2 border border-border rounded-xl p-3">
          <div className="uppercase text-[11px] tracking-wider text-muted mb-2">Structure</div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs ${structure.type!== 'auto' ? 'text-accent2' : 'text-muted'}`}>{structure.type.replace(/_/g,' ') || 'auto'}</span>
            <div className="flex-1" />
            <button className="btn" disabled={!ready||busy} onClick={()=>analyze()}>Analyze</button>
            <button className="btn btn-primary" disabled={!ready||busy || !structure.markdown} onClick={()=>setPendingChange(structure.markdown)}>Reshape</button>
          </div>
          <div className="border border-border rounded-lg p-2 text-sm min-h-[120px] whitespace-pre-wrap">{structure.markdown}</div>
        </div>
      </aside>
    </div>
  );
}

function FormatButton({label, onClick, disabled}:{label:string; onClick: ()=>void; disabled?:boolean}) {
  return <button className="btn" onClick={onClick} disabled={!!disabled}>{label}</button>
}

function download(name:string, content:string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

