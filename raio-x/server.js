// Servidor local sem dependências. Em produção (Vercel) os arquivos de api/
// viram funções e o index.html é servido como estático.
const http = require('http');
const fs = require('fs');
const path = require('path');

try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const routes = { '/api/raio-x': require('./api/raio-x'), '/api/lead': require('./api/lead') };
const index = path.join(__dirname, 'index.html');

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  res.status = code => { res.statusCode = code; return res; };
  res.json = obj => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };

  const handler = routes[url.pathname];
  if (handler) {
    req.query = Object.fromEntries(url.searchParams);
    if (req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) { raw += chunk; if (raw.length > 10000) break; }
      try { req.body = JSON.parse(raw || '{}'); } catch { req.body = {}; }
    }
    return handler(req, res);
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return fs.createReadStream(index).pipe(res);
  }
  res.status(404).end('Not found');
}).listen(process.env.PORT || 3000, () => {
  console.log(`Raio-X em http://localhost:${process.env.PORT || 3000}` + (process.env.GOOGLE_PLACES_KEY ? '' : ' (modo demonstração)'));
});
