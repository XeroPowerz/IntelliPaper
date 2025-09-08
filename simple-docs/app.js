// Simple Docs - minimal contenteditable editor
const editor = document.getElementById('editor');
const titleEl = document.getElementById('title');
const blockFormat = document.getElementById('blockFormat');

// Load persisted doc
const saved = JSON.parse(localStorage.getItem('simpleDocsV1') || '{}');
titleEl.innerHTML = saved.title || '';
editor.innerHTML = saved.body || '';
document.addEventListener('input', persist);

function persist(){
  localStorage.setItem('simpleDocsV1', JSON.stringify({ title: titleEl.innerHTML, body: editor.innerHTML }));
}

// Toolbar commands
document.querySelectorAll('[data-cmd]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const cmd = btn.getAttribute('data-cmd');
    document.execCommand(cmd, false);
    editor.focus();
  });
});

blockFormat.addEventListener('change', ()=>{
  const val = blockFormat.value;
  if (val === 'p') document.execCommand('formatBlock', false, 'p');
  else document.execCommand('formatBlock', false, val);
  editor.focus();
});

document.getElementById('quoteBtn').addEventListener('click', ()=>{
  document.execCommand('formatBlock', false, 'blockquote');
  editor.focus();
});

document.getElementById('linkBtn').addEventListener('click', ()=>{
  const url = prompt('Enter URL');
  if (!url) return;
  document.execCommand('createLink', false, url);
  editor.focus();
});

document.getElementById('clearBtn').addEventListener('click', ()=>{
  document.execCommand('removeFormat', false);
  editor.focus();
});

document.getElementById('newBtn').addEventListener('click', ()=>{
  if (confirm('Start a new document? Unsaved changes will be lost.')){
    titleEl.innerHTML=''; editor.innerHTML=''; persist();
    editor.focus();
  }
});

document.getElementById('exportHtmlBtn').addEventListener('click', ()=>{
  const html = `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${stripHtml(titleEl.innerText)||'Document'}</title></head><body>${editor.innerHTML}</body></html>`;
  download((slug(titleEl.innerText)||'document')+'.html', html);
});

document.getElementById('exportMdBtn').addEventListener('click', ()=>{
  const md = toMarkdown(editor);
  download((slug(titleEl.innerText)||'document')+'.md', md);
});

function slug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$|/g,'').slice(0,50); }
function stripHtml(s){ return (s||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function download(name, content){
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 500);
}

// naive markdown export
function toMarkdown(root){
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
  let out='';
  function text(n){ return n.textContent.replace(/\s+/g,' '); }
  function handle(el){
    const tag = el.tagName?.toLowerCase();
    if (!tag) return;
    if (tag==='h1'||tag==='h2'||tag==='h3') out += `\n\n${'#'.repeat(tag[1])} ${text(el)}\n\n`;
    else if (tag==='p') out += `\n\n${text(el)}\n\n`;
    else if (tag==='blockquote') out += `\n\n> ${text(el)}\n\n`;
    else if (tag==='li') out += `- ${text(el)}\n`;
    else if (tag==='ul'||tag==='ol') {/* lists handled per li */}
    else if (tag==='a') out += `[${text(el)}](${el.getAttribute('href')||''})`;
  }
  function traverse(node){
    if (node.nodeType===Node.TEXT_NODE){ out += node.nodeValue; return; }
    const el = node;
    if (el.tagName) handle(el);
    for (let c = el.firstChild; c; c=c.nextSibling) traverse(c);
  }
  // clone and ensure paragraphs
  const clone = root.cloneNode(true);
  // wrap bare text nodes as paragraphs for export
  traverse(clone);
  return out.trim().replace(/\n{3,}/g,'\n\n');
}

// Keyboard shortcuts for common styles
document.addEventListener('keydown', (e)=>{
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='b'){ e.preventDefault(); document.execCommand('bold'); }
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='i'){ e.preventDefault(); document.execCommand('italic'); }
  if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='u'){ e.preventDefault(); document.execCommand('underline'); }
});

