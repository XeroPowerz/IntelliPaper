// Minimal AI backend for Intelligent Paper
// POST /api/ai/transform { action, text, instruction?, docContext?, systemHint? }
// Streams SSE or returns JSON { result }

const http = require('http');
const { URL } = require('url');

// Load .env (no dependency) BEFORE loading provider
(function loadDotEnv(){
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const s = line.trim();
        if (!s || s.startsWith('#')) continue;
        const i = s.indexOf('=');
        if (i === -1) continue;
        const k = s.slice(0, i).trim();
        let v = s.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!(k in process.env)) process.env[k] = v;
      }
    }
  } catch (_) { /* ignore */ }
})();

const llm = require('./llm');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

function sendJson(res, status, obj){
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  });
  res.end(body);
}

function sendSSEHeaders(res){
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
}

function parseBody(req){
  return new Promise((resolve, reject)=>{
    let data='';
    req.on('data', c=>{ data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', ()=>{ try{ resolve(data? JSON.parse(data):{}); } catch(e){ reject(e); } });
    req.on('error', reject);
  });
}

function buildPrompt({ action, text, instruction, docContext, systemHint }){
  const caps = {
    rewrite: 'Rewrite the following text to improve clarity and flow. Keep meaning.',
    summarize: 'Summarize the following text concisely.',
    expand: 'Expand the following text with 2-3 useful details.',
    outline: 'Produce a hierarchical outline of the following text.',
  };
  const base = (action === 'freeform') ? (instruction || 'Improve the following text.') : (caps[action] || 'Improve the following text.');
  let prompt = `${base}\n\n[text]\n${text}\n[/text]`;
  if (docContext) prompt += `\n\n[context]\n${String(docContext).slice(0, 2000)}\n[/context]`;
  const system = systemHint || 'You are Intelligent Paper. Be concise. Return only the transformed text.';
  return { system, prompt };
}

const server = http.createServer(async (req, res)=>{
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    });
    return res.end();
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/transform'){
    try{
      const body = await parseBody(req);
      const action = String(body.action || 'freeform');
      const text = String(body.text || '');
      const instruction = typeof body.instruction === 'string' ? body.instruction : '';
      const docContext = typeof body.docContext === 'string' ? body.docContext : '';
      const systemHint = typeof body.systemHint === 'string' ? body.systemHint : '';
      if (!text) return sendJson(res, 400, { error: 'text required' });
      const { system, prompt } = buildPrompt({ action, text, instruction, docContext, systemHint });

      const wantsStream = /text\/event-stream/.test(req.headers['accept'] || '');
      const hasKey = !!process.env.OPENAI_API_KEY;

      if (wantsStream && hasKey){
        sendSSEHeaders(res);
        try{
          for await (const token of await llm.stream({ system, prompt })){
            res.write(`data: ${JSON.stringify(token)}\n\n`);
          }
          res.write('data: [DONE]\n\n');
        } catch(e){
          res.write(`data: ${JSON.stringify('\n[ERROR]') }\n\n`);
        }
        return res.end();
      } else {
        // Fallback or mock
        const result = hasKey ? await llm.complete({ system, prompt }) : `[MOCK] ${prompt.slice(0,80)}`;
        return sendJson(res, 200, { result });
      }
    } catch(e){
      return sendJson(res, 500, { error: e.message || 'error' });
    }
  }

  // Health
  if (req.method === 'GET' && url.pathname === '/api/ai/health'){
    return sendJson(res, 200, { ok: true, provider: process.env.MODEL_PROVIDER || 'openai', model: process.env.MODEL_NAME || 'gpt-4o-mini', hasKey: !!process.env.OPENAI_API_KEY });
  }

  res.writeHead(404, { 'Content-Type':'application/json', 'Access-Control-Allow-Origin':'*' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, ()=> console.log(`AI server on http://localhost:${PORT}`));
