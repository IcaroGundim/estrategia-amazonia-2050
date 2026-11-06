// Baixa as fontes do painel do Google Fonts para public/fonts/ e escreve
// public/fonts/fontes.css com @font-face apontando para os arquivos locais.
//
// O painel servia as fontes direto do Google; com elas dentro do site ele
// abre com a letra certa sem internet (versão portátil) e economiza duas idas
// a domínios de terceiros no site publicado. Só é preciso rodar de novo para
// trocar de família ou de peso: o resultado fica versionado.
//
//   node scripts/baixar-fontes.mjs

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const destino = path.join(raiz, 'public', 'fonts');

const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Libre+Franklin:wght@400;500;600&display=swap';
// Com um navegador atual o Google devolve woff2 variável, cortado por alfabeto
// (unicode-range): o navegador baixa só o que a página usa.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const resposta = await fetch(CSS_URL, { headers: { 'User-Agent': UA } });
if (!resposta.ok) throw new Error(`Google Fonts respondeu ${resposta.status}`);
let css = await resposta.text();

await rm(destino, { recursive: true, force: true });
await mkdir(destino, { recursive: true });

const urls = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)]+/g) ?? [])];
for (const url of urls) {
  const arquivo = await fetch(url);
  if (!arquivo.ok) throw new Error(`${url} respondeu ${arquivo.status}`);
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const familia = url.split('/s/')[1].split('/')[0];
  const nome = `${familia}-${createHash('sha1').update(bytes).digest('hex').slice(0, 10)}.woff2`;
  await writeFile(path.join(destino, nome), bytes);
  css = css.split(url).join(`/fonts/${nome}`);
}

const cabecalho =
  '/* Gerado por scripts/baixar-fontes.mjs a partir do Google Fonts. Não editar à mão. */\n';
await writeFile(path.join(destino, 'fontes.css'), cabecalho + css);
console.log(`${urls.length} arquivos de fonte em public/fonts/`);
