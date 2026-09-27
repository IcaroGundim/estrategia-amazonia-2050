// Servidor estático mínimo para conferir localmente a cópia do projeto do Claude Design.
// Uso: node .design-sync/tools/servir.mjs [pasta] [porta]
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, relative, resolve, sep } from 'node:path';

const raiz = resolve(process.argv[2] || '.design-sync/projeto');
const porta = Number(process.argv[3] || 4330);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.jsx': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.avif': 'image/avif',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.md': 'text/markdown; charset=utf-8', '.pdf': 'application/pdf'
};

const CAPTURAS = resolve(raiz, '..', '.cache', 'capturas');

createServer((req, res) => {
  // POST /__captura/<nome>: grava o DOM que o capturar.js manda da página (só local).
  const captura = req.method === 'POST' && req.url.match(/^\/__captura\/([a-z0-9-]+)$/);
  if (captura) {
    const partes = [];
    req.on('data', (parte) => partes.push(parte));
    req.on('end', () => {
      mkdirSync(CAPTURAS, { recursive: true });
      writeFileSync(join(CAPTURAS, `${captura[1]}.json`), Buffer.concat(partes));
      res.end('ok');
    });
    return;
  }
  let caminho;
  // /_blob/<id>: assets já enviados ao canvas, servidos da cópia local pelo manifesto.
  const idBlob = req.url.match(/^\/_blob\/([0-9a-f]{32})/);
  if (idBlob) {
    const pastaAssets = resolve(raiz, '..', '.cache', 'canvas-assets');
    const manifesto = JSON.parse(readFileSync(join(pastaAssets, 'manifesto.json'), 'utf8'));
    const local = Object.keys(manifesto).find((chave) => manifesto[chave].endsWith(idBlob[1]));
    if (!local) { res.statusCode = 404; return res.end('404'); }
    res.setHeader('Content-Type', TIPOS[extname(local).toLowerCase()] || 'application/octet-stream');
    return res.end(readFileSync(join(pastaAssets, local)));
  }
  try { caminho = resolve(raiz, '.' + decodeURIComponent(new URL(req.url, 'http://x').pathname)); } catch { res.statusCode = 400; return res.end(); }
  if (!(caminho + sep).startsWith(raiz + sep)) { res.statusCode = 404; return res.end('404'); }
  if (existsSync(caminho) && statSync(caminho).isDirectory()) caminho = join(caminho, 'index.html');
  // O build do painel grava /metas como metas.html (trailingSlash: never).
  if (!existsSync(caminho) && existsSync(`${caminho}.html`)) caminho = `${caminho}.html`;
  // Os ativos binários (logo, bandeiras, fotos) só existem no projeto remoto; localmente,
  // /assets/<x> cai para dashboard/public/<x>, de onde eles vieram.
  const ativo = relative(raiz, caminho).replaceAll('\\', '/').match(/^assets\/([^.][^]*)$/);
  if (ativo && !existsSync(caminho)) {
    const publico = resolve(raiz, '..', '..', 'dashboard', 'public', ativo[1]);
    if (existsSync(publico)) caminho = publico;
  }
  if (!existsSync(caminho) || !statSync(caminho).isFile()) {
    res.statusCode = 404;
    return res.end('404');
  }
  res.setHeader('Content-Type', TIPOS[extname(caminho).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.end(readFileSync(caminho));
}).listen(porta, '127.0.0.1', () => console.log(`servindo ${raiz} em http://127.0.0.1:${porta}/`));
