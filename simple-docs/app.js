// Simple Docs - minimal contenteditable editor (light, Google Docs-like)
const editor = document.getElementById('editor');
const titleInput = document.getElementById('docTitle');

// Load persisted doc
const saved = JSON.parse(localStorage.getItem('simpleDocsV1') || '{}');
if (titleInput) titleInput.value = saved.title || '';
editor.innerHTML = saved.body || '';
document.addEventListener('input', persist);

// --- Lightweight Undo/Redo history for the editor ---
const MAX_HISTORY = 100;
let history = [];
let histIdx = -1;
let applyingSnapshot = false; // suppress history during programmatic restore

function nodePath(node) {
  const path = [];
  let n = node;
  while (n && n !== editor) {
    const p = n.parentNode;
    if (!p) break;
    const idx = Array.prototype.indexOf.call(p.childNodes, n);
    path.push(idx);
    n = p;
  }
  return path.reverse();
}
function nodeFromPath(path) {
  let n = editor;
  for (const idx of path || []) {
    if (!n || !n.childNodes || idx < 0 || idx >= n.childNodes.length) return null;
    n = n.childNodes[idx];
  }
  return n || null;
}
function serializeSelection() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  return {
    sc: nodePath(r.startContainer),
    so: r.startOffset,
    ec: nodePath(r.endContainer),
    eo: r.endOffset
  };
}
function restoreSelectionFrom(desc) {
  if (!desc) return;
  const sc = nodeFromPath(desc.sc);
  const ec = nodeFromPath(desc.ec);
  if (!sc || !ec) return; // content changed too much; skip
  try {
    const r = document.createRange();
    r.setStart(sc, Math.min(desc.so ?? 0, (sc.nodeType === Node.TEXT_NODE ? sc.nodeValue?.length || 0 : sc.childNodes.length)));
    r.setEnd(ec, Math.min(desc.eo ?? 0, (ec.nodeType === Node.TEXT_NODE ? ec.nodeValue?.length || 0 : ec.childNodes.length)));
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  } catch (_) { /* ignore */ }
}
function pushHistory(reason = '') {
  if (applyingSnapshot) return;
  const snap = { html: editor.innerHTML, sel: serializeSelection() };
  // dedupe if identical to current head
  if (histIdx >= 0) {
    const cur = history[histIdx];
    if (cur && cur.html === snap.html) return;
  }
  // truncate redo branch
  if (histIdx < history.length - 1) history = history.slice(0, histIdx + 1);
  history.push(snap);
  if (history.length > MAX_HISTORY) { history.shift(); histIdx--; }
  histIdx = history.length - 1;
}
function applySnapshotAt(idx) {
  if (idx < 0 || idx >= history.length) return;
  const snap = history[idx];
  applyingSnapshot = true;
  editor.innerHTML = snap.html;
  persist();
  setTimeout(() => {
    restoreSelectionFrom(snap.sel);
    applyingSnapshot = false;
  }, 0);
}
function undo() { if (histIdx > 0) { histIdx--; applySnapshotAt(histIdx); setUIState?.(UI?.HIDDEN || 'hidden'); } }
function redo() { if (histIdx < history.length - 1) { histIdx++; applySnapshotAt(histIdx); setUIState?.(UI?.HIDDEN || 'hidden'); } }

// Push initial snapshot after loading persisted doc
pushHistory('init');

// Capture changes from user edits
editor.addEventListener('input', () => pushHistory('input'));

function persist() {
  localStorage.setItem('simpleDocsV1', JSON.stringify({ title: (titleInput?.value || ''), body: editor.innerHTML }));
}

// Toolbar commands
document.querySelectorAll('[data-cmd]').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.getAttribute('data-cmd');
    if (cmd === 'undo') { undo(); editor.focus(); return; }
    if (cmd === 'redo') { redo(); editor.focus(); return; }
    document.execCommand(cmd, false);
    editor.focus();
    // Ensure the action is captured in history
    setTimeout(() => pushHistory('toolbar:' + cmd), 0);
  });
});

// Formatting controls removed in favor of AI-driven edits (kept keyboard shortcuts)

document.getElementById('exportHtmlBtn').addEventListener('click', () => {
  const html = `<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"><title>${stripHtml(titleInput?.value) || 'Document'}</title></head><body>${editor.innerHTML}</body></html>`;
  download((slug(titleInput?.value) || 'document') + '.html', html);
});

document.getElementById('exportMdBtn').addEventListener('click', () => {
  const md = toMarkdown(editor);
  download((slug(titleInput?.value) || 'document') + '.md', md);
});

function slug(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50); }
function stripHtml(s) { return (s || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function download(name, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 500);
}

// naive markdown export
function toMarkdown(root) {
  let out = '';
  function text(n) { return n.textContent.replace(/\s+/g, ' ').trim(); }
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) { out += node.nodeValue; return; }
    const tag = node.tagName ? node.tagName.toLowerCase() : '';
    if (tag === 'h1') out += `\n\n# ${text(node)}\n\n`;
    else if (tag === 'h2') out += `\n\n## ${text(node)}\n\n`;
    else if (tag === 'h3') out += `\n\n### ${text(node)}\n\n`;
    else if (tag === 'p') out += `\n\n${text(node)}\n\n`;
    else if (tag === 'blockquote') out += `\n\n> ${text(node)}\n\n`;
    else if (tag === 'li') out += `- ${text(node)}\n`;
    else if (tag === 'a') out += `[${text(node)}](${node.getAttribute('href') || ''})`;
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  }
  walk(root.cloneNode(true));
  return out.trim().replace(/\n{3,}/g, '\n\n');
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  const isMeta = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  // Ignore while typing in the AI prompt
  if (document.activeElement === aiPrompt) return;
  if (isMeta && key === 'b') { e.preventDefault(); document.execCommand('bold'); return; }
  if (isMeta && key === 'i') { e.preventDefault(); document.execCommand('italic'); return; }
  if (isMeta && key === 'u') { e.preventDefault(); document.execCommand('underline'); return; }
  if (isMeta && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (isMeta && key === 'y') { e.preventDefault(); redo(); return; }
});

// Defaults on focus
editor.addEventListener('focus', () => {
  document.execCommand('defaultParagraphSeparator', false, 'p');
});

// Floating selection menu
const floatMenu = document.getElementById('floatMenu');
const askAiBtn = document.getElementById('askAiBtn');
const rewriteBtn = document.getElementById('rewriteBtn');
const summBtn = document.getElementById('summBtn');
const expandBtn = document.getElementById('expandBtn');
const outlineBtn = document.getElementById('outlineBtn');
const boldBtn = document.getElementById('boldBtn');
const italicBtn = document.getElementById('italicBtn');
const caseBtn = document.getElementById('caseBtn');
const aiPrompt = document.getElementById('aiPrompt');
const aiPreview = document.getElementById('aiPreview');
const aiStream = aiPreview.querySelector('.ai-stream');
const aiAcceptBtn = document.getElementById('aiAcceptBtn');
const aiKeepBtn = document.getElementById('aiKeepBtn');
const selectionOverlay = document.getElementById('selectionOverlay');
let lastResult = '';
let menuPinned = false;        // keep menu visible while interacting
let savedRange = null;         // original selection range for AI ops
let overlayVisible = false;    // whether selection overlay is rendered

// Tiny explicit UI state machine for the floating menu lifecycle
const UI = Object.freeze({ HIDDEN: 'hidden', MENU: 'menu', PROMPT: 'prompt', AI: 'ai' });
let uiState = UI.HIDDEN;

function setUIState(next, opts = {}) {
  if (uiState === next) {
    // Still ensure position/visual refresh for sticky states
    if (next === UI.MENU) {
      const rect = selectionRect(); if (rect) positionMenu(rect); else next = UI.HIDDEN;
    } else if (next === UI.PROMPT) {
      if (savedRange) {
        const r = rangeRect(savedRange); if (r) positionMenu(r);
        drawSelectionOverlay();
      }
    } else if (next === UI.AI) {
      // Keep preview anchored to savedRange if available
      if (!aiPreview.hidden && savedRange) {
        const r = rangeRect(savedRange); if (r) positionPreview(r);
      }
    }
    uiState = next; // in case MENU -> HIDDEN fallback above
    return;
  }

  // Always clean slate first
  floatMenu.classList.remove('prompt-active');
  aiPrompt.hidden = true;
  aiPrompt.value = '';
  floatMenu.hidden = true;
  // Do not automatically hide preview here; hide per-state below
  clearSelectionOverlay();
  menuPinned = false;

  if (next === UI.HIDDEN) {
    // Hide everything and optionally drop the range
    closePreview();
    if (!opts.keepRange) savedRange = null;
  }
  else if (next === UI.MENU) {
    closePreview();
    const rect = selectionRect();
    if (!rect) { // nothing to show
      uiState = UI.HIDDEN;
      if (!opts.keepRange) savedRange = null;
      return;
    }
    positionMenu(rect);
    floatMenu.hidden = false;
  }
  else if (next === UI.PROMPT) {
    // Ensure we have a range and anchor UI to it
    if (!savedRange) captureRange();
    if (savedRange) {
      restoreSavedRange();
      const r = rangeRect(savedRange); if (r) positionMenu(r);
    }
    floatMenu.classList.add('prompt-active');
    floatMenu.hidden = false;
    aiPrompt.hidden = false;
    drawSelectionOverlay();
    // focus after DOM updates
    setTimeout(() => aiPrompt.focus(), 0);
  }
  else if (next === UI.AI) {
    // Enter AI/preview mode: keep savedRange for anchoring replacement
    // Overlay removed; menu hidden; preview will be shown by streamAI
    // Ensure preview anchors near the saved range if we can
    if (savedRange) {
      const r = rangeRect(savedRange); if (r) positionPreview(r);
    }
  }

  uiState = next;
}

function selectionRect() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0).cloneRange();
  // Use bounding rect for multi-line selections; fallback to first rect
  const bounding = range.getBoundingClientRect?.();
  if (bounding && (bounding.width || bounding.height)) return bounding;
  const rects = range.getClientRects();
  if (!rects || rects.length === 0) return null;
  return rects[0];
}

function positionMenu(rect) {
  // Ensure menu is measurable
  floatMenu.hidden = false;
  floatMenu.style.visibility = 'hidden';
  floatMenu.style.top = '-9999px';
  floatMenu.style.left = '-9999px';

  // Measure after making it visible (but hidden)
  const menuW = floatMenu.offsetWidth;
  const menuH = floatMenu.offsetHeight;
  const viewportW = document.documentElement.clientWidth;
  const viewportH = document.documentElement.clientHeight;

  // Try above; if not enough space, place below
  let topPx = window.scrollY + rect.top - menuH - 8;
  if (topPx < window.scrollY + 8) {
    topPx = window.scrollY + rect.bottom + 8;
  }
  let leftPx = window.scrollX + (rect.left + rect.width / 2) - menuW / 2;
  // Clamp horizontally to viewport with 8px margin
  const minLeft = window.scrollX + 8;
  const maxLeft = window.scrollX + viewportW - menuW - 8;
  leftPx = Math.max(minLeft, Math.min(maxLeft, leftPx));

  // If menu goes off bottom, nudge above
  if (topPx + menuH > window.scrollY + viewportH - 8) {
    topPx = Math.max(window.scrollY + 8, window.scrollY + rect.top - menuH - 8);
  }

  floatMenu.style.top = topPx + 'px';
  floatMenu.style.left = leftPx + 'px';
  floatMenu.style.visibility = '';
}

function showMenu() {
  const rect = selectionRect();
  if (!rect) { hideMenu(); return; }
  positionMenu(rect);
}
function hideMenu() {
  setUIState(UI.HIDDEN);
}

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (!sel) return;
  const within = editor.contains(sel.anchorNode) && editor.contains(sel.focusNode);
  // Guarded: ignore selection changes during prompt/AI flows
  if (menuPinned || uiState === UI.PROMPT || uiState === UI.AI) return;
  if (within && !sel.isCollapsed) setUIState(UI.MENU); else setUIState(UI.HIDDEN);
});

// Preserve selection when clicking any menu button
;[askAiBtn, rewriteBtn, summBtn, expandBtn, outlineBtn, boldBtn, italicBtn, caseBtn].forEach(btn => {
  if (!btn) return;
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault(); // prevent focus from moving away and collapsing selection
    captureRange();
    menuPinned = true; // keep menu until action starts/finishes
  });
});

boldBtn.addEventListener('click', () => { restoreSavedRange(); document.execCommand('bold'); editor.focus(); setTimeout(() => { menuPinned = false; showMenu(); }, 0); });
italicBtn.addEventListener('click', () => { restoreSavedRange(); document.execCommand('italic'); editor.focus(); setTimeout(() => { menuPinned = false; showMenu(); }, 0); });
caseBtn.addEventListener('click', () => {
  restoreSavedRange();
  const sel = window.getSelection(); if (!sel || sel.isCollapsed) { menuPinned = false; hideMenu(); return; }
  const text = sel.toString();
  replaceSelection(cycleCase(text));
  setTimeout(() => { menuPinned = false; showMenu(); }, 0);
});
askAiBtn.addEventListener('click', () => {
  const sel = window.getSelection();
  if (sel && sel.rangeCount) { savedRange = sel.getRangeAt(0).cloneRange(); }
  setUIState(UI.PROMPT);
});
aiPrompt.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const instruction = aiPrompt.value.trim(); if (!instruction) return;
    // Prefer saved range text so Enter works after focusing input
    const text = getRangeText(); if (!text) return;
    setUIState(UI.AI, { keepRange: true });
    await runAI({ action: 'freeform', text, instruction });
    editor.focus();
  } else if (e.key === 'Escape') {
    setUIState(UI.HIDDEN);
  }
});

rewriteBtn.addEventListener('click', async () => { captureRange(); const t = getRangeText(); if (t) { menuPinned = true; await runAI({ action: 'rewrite', text: t }); } });
summBtn.addEventListener('click', async () => { captureRange(); const t = getRangeText(); if (t) { menuPinned = true; await runAI({ action: 'summarize', text: t }); } });
expandBtn.addEventListener('click', async () => { captureRange(); const t = getRangeText(); if (t) { menuPinned = true; await runAI({ action: 'expand', text: t }); } });
outlineBtn.addEventListener('click', async () => { captureRange(); const t = getRangeText(); if (t) { menuPinned = true; await runAI({ action: 'outline', text: t }); } });

function captureRange() { const sel = window.getSelection(); if (sel && sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange(); }
function getSelectionText() { const sel = window.getSelection(); if (!sel || sel.isCollapsed) return ''; return sel.toString(); }
function getRangeText() { if (!savedRange) return getSelectionText(); return savedRange.toString(); }
function restoreSavedRange() {
  if (!savedRange) return;
  const sel = window.getSelection(); if (!sel) return;
  sel.removeAllRanges(); sel.addRange(savedRange.cloneRange());
}

// Compute a rect for a given Range (bounding or first client rect)
function rangeRect(range) {
  if (!range) return null;
  const bounding = range.getBoundingClientRect?.();
  if (bounding && (bounding.width || bounding.height)) return bounding;
  const rects = range.getClientRects?.();
  if (rects && rects.length) return rects[0];
  return null;
}

// Overlay: draw translucent rectangles for each client rect of savedRange
function drawSelectionOverlay() {
  if (!selectionOverlay) return;
  selectionOverlay.innerHTML = '';
  const r = savedRange;
  if (!r) { selectionOverlay.hidden = true; overlayVisible = false; return; }
  const rects = r.getClientRects ? r.getClientRects() : null;
  if (!rects || rects.length === 0) { selectionOverlay.hidden = true; overlayVisible = false; return; }
  for (const rect of rects) {
    const el = document.createElement('div');
    el.className = 'sel-rect';
    el.style.top = rect.top + 'px';
    el.style.left = rect.left + 'px';
    el.style.width = rect.width + 'px';
    el.style.height = rect.height + 'px';
    selectionOverlay.appendChild(el);
  }
  selectionOverlay.hidden = false;
  overlayVisible = true;
}
function clearSelectionOverlay() {
  if (!selectionOverlay) return;
  selectionOverlay.innerHTML = '';
  selectionOverlay.hidden = true;
  overlayVisible = false;
}

function replaceSelection(str) {
  const range = savedRange && savedRange.cloneRange ? savedRange.cloneRange() : (function () { const s = window.getSelection(); return (s && s.rangeCount) ? s.getRangeAt(0).cloneRange() : null; })();
  if (!range) return;
  range.deleteContents();
  const node = document.createTextNode(str);
  range.insertNode(node);
  const sel = window.getSelection();
  sel.removeAllRanges();
  const r = document.createRange(); r.selectNode(node); sel.addRange(r);
  savedRange = r.cloneRange();
  pushHistory('replaceSelection');
  persist();
}
function cycleCase(s) {
  if (!s) return s;
  if (s === s.toUpperCase()) return s.toLowerCase();
  if (s === s.toLowerCase()) return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return s.toUpperCase();
}

async function aiEdit(text, instruction) {
  const ep = getEndpoint();
  const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'freeform', text, instruction }) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return typeof data?.result === 'string' ? data.result : '';
}
function getEndpoint() {
  let ep = localStorage.getItem('aiEndpoint');
  if (!ep) { ep = prompt('Enter AI endpoint (POST /api/ai/transform):', 'http://localhost:3000/api/ai/transform') || ''; localStorage.setItem('aiEndpoint', ep); }
  return ep;
}

async function runAI({ action, text, instruction }) {
  // try streaming first
  const ep = getEndpoint();
  try {
    await streamAI(ep, { action, text, instruction });
  } catch (e) {
    // fallback non-stream
    try {
      const res = await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, text, instruction }) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      lastResult = data?.result || '';
      if (lastResult) { replaceSelection(lastResult); menuPinned = false; hideMenu(); }
    } catch (err) { alert('AI request failed'); console.error(err); }
  }
}

async function streamAI(ep, payload) {
  setUIState(UI.AI, { keepRange: true });
  const rect = savedRange ? savedRange.getBoundingClientRect ? savedRange.getBoundingClientRect() : selectionRect() : selectionRect();
  if (!rect) throw new Error('no selection');
  positionPreview(rect);
  aiPreview.hidden = false; aiStream.textContent = '';
  lastResult = '';
  const res = await fetch(ep, { method: 'POST', headers: { 'Accept': 'text/event-stream', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error('stream failed');
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  // If it's not actually an SSE stream, treat as JSON/text fallback here
  if (!ct.includes('text/event-stream') || !res.body) {
    try {
      // Try JSON first
      const data = await res.clone().json();
      lastResult = data?.result || data?.text || '';
    } catch (_) {
      // Then raw text
      const t = await res.text();
      lastResult = t || '';
    }
    if (lastResult) { replaceSelection(lastResult); menuPinned = false; hideMenu(); }
    return; // handled without SSE
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      const ln = line.trim();
      if (!ln.startsWith('data:')) continue;
      const data = ln.replace(/^data:\s*/, '');
      if (data === '[DONE]') break;
      let tokenAppend = '';
      try {
        const parsed = JSON.parse(data);
        if (typeof parsed === 'string') tokenAppend = parsed;
        else if (parsed && typeof parsed.token === 'string') tokenAppend = parsed.token;
        else if (parsed && typeof parsed.text === 'string') tokenAppend = parsed.text;
        else if (parsed && typeof parsed.result === 'string') tokenAppend = parsed.result;
        else if (parsed && parsed.choices && parsed.choices[0]?.delta?.content) tokenAppend = parsed.choices[0].delta.content;
      } catch {
        // Not JSON — treat the data payload as raw text
        if (data && data !== '[DONE]') tokenAppend = data;
      }
      if (tokenAppend) { lastResult += tokenAppend; aiStream.textContent = lastResult; }
    }
  }
  // after stream finishes, apply inline automatically
  if (lastResult) { replaceSelection(lastResult); menuPinned = false; hideMenu(); }
}

function positionPreview(rect) {
  const top = window.scrollY + rect.bottom + 8;
  const left = window.scrollX + rect.left;
  aiPreview.style.top = top + 'px';
  aiPreview.style.left = left + 'px';
}
function showPreview(text) {
  const rect = selectionRect(); if (!rect) return;
  positionPreview(rect);
  aiStream.textContent = text; aiPreview.hidden = false;
}

aiAcceptBtn.addEventListener('click', () => { if (lastResult) replaceSelection(lastResult); closePreview(); menuPinned = false; hideMenu(); });
aiKeepBtn.addEventListener('click', () => { closePreview(); menuPinned = false; hideMenu(); });
function closePreview() { aiPreview.hidden = true; lastResult = ''; }

// Hide menu when clicking outside or on scroll/resize if selection disappears
document.addEventListener('mousedown', (e) => {
  const t = e.target;
  if (floatMenu.contains(t) || editor.contains(t)) return; // keep when interacting with menu/editor
  // Clicking outside dismisses any UI state
  setUIState(UI.HIDDEN);
});
window.addEventListener('scroll', () => {
  if (uiState === UI.PROMPT) {
    if (savedRange) {
      const r = rangeRect(savedRange); if (r) positionMenu(r);
      if (overlayVisible) drawSelectionOverlay();
    }
    return;
  }
  if (uiState === UI.MENU) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setUIState(UI.HIDDEN); return; }
    if (!menuPinned) setUIState(UI.MENU);
    return;
  }
  if (uiState === UI.AI) {
    if (!aiPreview.hidden && savedRange) {
      const r = rangeRect(savedRange); if (r) positionPreview(r);
    }
    return;
  }
});
window.addEventListener('resize', () => {
  if (uiState === UI.PROMPT) {
    if (savedRange) {
      const r = rangeRect(savedRange); if (r) positionMenu(r);
      if (overlayVisible) drawSelectionOverlay();
    }
    return;
  }
  if (uiState === UI.MENU) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setUIState(UI.HIDDEN); return; }
    if (!menuPinned) setUIState(UI.MENU);
    return;
  }
  if (uiState === UI.AI) {
    if (!aiPreview.hidden && savedRange) {
      const r = rangeRect(savedRange); if (r) positionPreview(r);
    }
    return;
  }
});

// Extra guards: hide after mouseup and on editor blur
document.addEventListener('mouseup', () => {
  setTimeout(() => {
    // Do not hide during prompt or AI preview
    if (uiState === UI.PROMPT || uiState === UI.AI) return;
    const active = document.activeElement;
    if (floatMenu.contains(active) || active === aiPrompt) return;
    const sel = window.getSelection();
    const within = sel && editor.contains(sel.anchorNode) && editor.contains(sel.focusNode);
    if (!sel || sel.isCollapsed || !within) setUIState(UI.HIDDEN);
    else setUIState(UI.MENU);
  }, 0);
});
editor.addEventListener('blur', () => {
  // If focus left the editor and no prompt is active, hide
  if (document.activeElement !== aiPrompt && uiState !== UI.PROMPT && uiState !== UI.AI) setUIState(UI.HIDDEN);
});
