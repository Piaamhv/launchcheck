import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { check } from './src/pipeline.js';
const PORT = process.env.PORT || 3000;
http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/check') {
      let b = ''; for await (const c of req) { b += c; if (b.length > 1e6) throw new Error('too large'); }
      const out = await check(JSON.parse(b)); res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(out));
    }
    const f = req.url === '/' ? 'index.html' : req.url.replace(/^\/+/, '').replace(/\.\./g, '');
    const data = await readFile(new URL(f.startsWith('fixtures/') ? f : `public/${f}`, import.meta.url));
    res.writeHead(200, { 'Content-Type': f.endsWith('.json') ? 'application/json' : 'text/html' }); res.end(data);
  } catch (e) { res.writeHead(e.code === 'ENOENT' ? 404 : 500); res.end(String(e.message)); }
}).listen(PORT, () => console.log(`LaunchCheck on http://localhost:${PORT} (${process.env.CLOCKED_API_KEY ? 'LIVE' : 'MOCK'} mode)`));
