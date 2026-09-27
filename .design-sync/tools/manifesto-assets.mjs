// Monta .design-sync/.cache/canvas-assets/manifesto.json ({"img/x.svg": "/_blob/<id>", ...})
// a partir das respostas dos uploads que ficaram no transcript da sessão.
// Uso: node .design-sync/tools/manifesto-assets.mjs <transcript.jsonl>
import { readFileSync, writeFileSync } from 'node:fs';

const texto = readFileSync(process.argv[2], 'utf8').replace(/\\\\/g, '\\').replace(/\\"/g, '"');
const padrao = /canvas-assets\\+(img|fonts|css)\\+([^"\\]+)" \(\d+ bytes, [^)]+\) → "(\/_blob\/[0-9a-f]{32})"/g;
const manifesto = {};
for (const [, pasta, nome, url] of texto.matchAll(padrao)) manifesto[`${pasta}/${nome}`] = url;
writeFileSync('.design-sync/.cache/canvas-assets/manifesto.json', JSON.stringify(manifesto, null, 1));
console.log(`${Object.keys(manifesto).length} entradas`);
