// Gera a versão portátil do painel: um executável que roda o site sem
// internet e abre o navegador. Ver portatil/LEIA-ME.md.
//
//   npm run portatil                 build do site + executáveis
//   npm run portatil -- --sem-build  reaproveita o último build (.vercel/output)
//
// Passos:
//   1. `npm run build` (dados atuais de conteudo/ → .vercel/output/static);
//   2. junta o site num arquivo só (.cache/site.bin) com os redirecionamentos
//      do config.json da Vercel;
//   3. prepara o blob do executável único do Node (servidor.cjs + site.bin);
//   4. baixa o Node oficial de cada sistema (mesma versão deste Node, com
//      SHA-256 conferido) e injeta o blob nele com o postject.
//
// Os executáveis saem em portatil/saida/. Os downloads do Node ficam em
// portatil/.cache/ e são reaproveitados.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dashboard = path.dirname(aqui);
const cache = path.join(aqui, '.cache');
const saida = path.join(aqui, 'saida');
const estatico = path.join(dashboard, '.vercel', 'output', 'static');
const configVercel = path.join(dashboard, '.vercel', 'output', 'config.json');

const NOME = 'Amazonia2050';
const VERSAO_NODE = process.version; // o blob só roda no Node da mesma versão
const FUSIVEL = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const ALVOS = [
  { id: 'win-x64', arquivo: `${NOME}-Windows.exe`, pacote: `node-${VERSAO_NODE}-win-x64.zip`, binario: `node-${VERSAO_NODE}-win-x64/node.exe` },
  { id: 'darwin-arm64', arquivo: `${NOME}-Mac-AppleSilicon`, pacote: `node-${VERSAO_NODE}-darwin-arm64.tar.gz`, binario: `node-${VERSAO_NODE}-darwin-arm64/bin/node` },
  { id: 'darwin-x64', arquivo: `${NOME}-Mac-Intel`, pacote: `node-${VERSAO_NODE}-darwin-x64.tar.gz`, binario: `node-${VERSAO_NODE}-darwin-x64/bin/node` }
];

const semBuild = process.argv.includes('--sem-build');

function rodar(comando, args, opcoes = {}) {
  execFileSync(comando, args, { stdio: 'inherit', cwd: dashboard, ...opcoes });
}

// ---------------------------------------------------------------------------
// 1. Build do site

if (!semBuild) {
  console.log('\n▸ Build do site com os dados de conteudo/');
  rodar('npm', ['run', 'build']);
}
if (!existsSync(path.join(estatico, 'index.html'))) {
  throw new Error('Não achei .vercel/output/static/index.html. Rode sem --sem-build.');
}

// ---------------------------------------------------------------------------
// 2. O site num arquivo só

async function listar(pasta, base = pasta) {
  const lista = [];
  for (const entrada of await readdir(pasta, { withFileTypes: true })) {
    const completo = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) lista.push(...(await listar(completo, base)));
    else if (entrada.isFile() && entrada.name !== '.DS_Store') lista.push(path.relative(base, completo).split(path.sep).join('/'));
  }
  return lista.sort();
}

console.log('\n▸ Juntando o site num arquivo só');
await mkdir(cache, { recursive: true });

const arquivos = {};
const partes = [];
let posicao = 0;
for (const relativo of await listar(estatico)) {
  const bytes = await readFile(path.join(estatico, relativo));
  arquivos[relativo] = [posicao, bytes.length];
  partes.push(bytes);
  posicao += bytes.length;
}

// Só os redirecionamentos de endereço antigo; a barra no fim e as rotas do
// servidor (administração) o servidor portátil trata por conta própria.
const config = JSON.parse(await readFile(configVercel, 'utf8'));
const redirecionamentos = config.routes
  .filter((r) => r.src && r.headers?.Location && [301, 302, 307, 308].includes(r.status) && r.src !== '^/(.*)/$')
  .map((r) => ({ src: r.src, location: r.headers.Location, status: r.status }));

let commit = '';
try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dashboard, encoding: 'utf8' }).trim();
} catch {}
const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

const indice = Buffer.from(JSON.stringify({ arquivos, redirecionamentos, info: { geradoEm, commit } }), 'utf8');
const tamanhoIndice = Buffer.alloc(4);
tamanhoIndice.writeUInt32LE(indice.length, 0);
const sitePacote = path.join(cache, 'site.bin');
await writeFile(sitePacote, Buffer.concat([tamanhoIndice, indice, ...partes]));
console.log(`  ${Object.keys(arquivos).length} arquivos, ${(posicao / 1048576).toFixed(1)} MB, ${redirecionamentos.length} redirecionamentos`);

// ---------------------------------------------------------------------------
// 3. Blob do executável único

console.log('\n▸ Preparando o executável único do Node');
const blob = path.join(cache, 'sea-prep.blob');
const seaConfig = path.join(cache, 'sea-config.json');
await writeFile(
  seaConfig,
  JSON.stringify(
    {
      main: path.join(aqui, 'servidor.cjs'),
      output: blob,
      disableExperimentalSEAWarning: true,
      // Sem cache de código nem snapshot: o blob fica igual para os três
      // sistemas, que é o que permite gerar o .exe a partir de um Mac.
      useCodeCache: false,
      useSnapshot: false,
      assets: { site: sitePacote }
    },
    null,
    2
  )
);
rodar(process.execPath, ['--experimental-sea-config', seaConfig]);

// ---------------------------------------------------------------------------
// 4. Um executável por sistema

async function baixar(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`${url} respondeu ${resposta.status}`);
  return Buffer.from(await resposta.arrayBuffer());
}

let somas = null;
async function somaEsperada(pacote) {
  if (!somas) somas = (await baixar(`https://nodejs.org/dist/${VERSAO_NODE}/SHASUMS256.txt`)).toString('utf8');
  const linha = somas.split('\n').find((l) => l.trim().endsWith(`  ${pacote}`));
  if (!linha) throw new Error(`${pacote} não está em SHASUMS256.txt`);
  return linha.split(/\s+/)[0];
}

async function nodeOficial(alvo) {
  const pastaAlvo = path.join(cache, 'node', alvo.id);
  const binario = path.join(pastaAlvo, alvo.binario);
  if (existsSync(binario)) return binario;

  const pacote = path.join(cache, 'node', alvo.pacote);
  await mkdir(pastaAlvo, { recursive: true });
  if (!existsSync(pacote)) {
    console.log(`  baixando ${alvo.pacote}`);
    const bytes = await baixar(`https://nodejs.org/dist/${VERSAO_NODE}/${alvo.pacote}`);
    const soma = createHash('sha256').update(bytes).digest('hex');
    if (soma !== (await somaEsperada(alvo.pacote))) throw new Error(`SHA-256 de ${alvo.pacote} não confere`);
    await writeFile(pacote, bytes);
  }
  if (alvo.pacote.endsWith('.zip')) rodar('unzip', ['-q', '-o', pacote, alvo.binario, '-d', pastaAlvo]);
  else rodar('tar', ['-xzf', pacote, '-C', pastaAlvo, alvo.binario]);
  return binario;
}

// Tira a assinatura Authenticode do node.exe oficial antes da injeção: depois
// dela a assinatura deixaria de valer e o arquivo ficaria com uma assinatura
// quebrada, que o Windows trata pior que nenhuma.
async function tirarAssinaturaWindows(arquivo) {
  const pe = await readFile(arquivo);
  const cabecalhoPE = pe.readUInt32LE(0x3c);
  if (pe.toString('latin1', cabecalhoPE, cabecalhoPE + 4) !== 'PE\0\0') throw new Error('node.exe sem cabeçalho PE');
  const opcional = cabecalhoPE + 24;
  const magico = pe.readUInt16LE(opcional);
  const diretorios = opcional + (magico === 0x20b ? 112 : 96);
  const seguranca = diretorios + 4 * 8;
  const inicio = pe.readUInt32LE(seguranca);
  const tamanho = pe.readUInt32LE(seguranca + 4);
  if (!inicio || !tamanho) return;
  if (inicio + tamanho < pe.length - 8) throw new Error('assinatura do node.exe fora do fim do arquivo');
  pe.writeUInt32LE(0, seguranca);
  pe.writeUInt32LE(0, seguranca + 4);
  await writeFile(arquivo, pe.subarray(0, inicio));
}

console.log('\n▸ Gerando os executáveis');
await rm(saida, { recursive: true, force: true });
await mkdir(saida, { recursive: true });
const postject = path.join(dashboard, 'node_modules', '.bin', 'postject');

for (const alvo of ALVOS) {
  const destino = path.join(saida, alvo.arquivo);
  await copyFile(await nodeOficial(alvo), destino);
  await chmod(destino, 0o755);

  const args = [destino, 'NODE_SEA_BLOB', blob, '--sentinel-fuse', FUSIVEL];
  if (alvo.id.startsWith('win')) {
    await tirarAssinaturaWindows(destino);
  } else {
    args.push('--macho-segment-name', 'NODE_SEA');
    if (process.platform === 'darwin') rodar('codesign', ['--remove-signature', destino]);
  }
  rodar(postject, args, { stdio: ['ignore', 'ignore', 'inherit'] });
  // O macOS em Apple Silicon só roda binário assinado; a assinatura ad hoc
  // basta para isso (não substitui a de um desenvolvedor registrado).
  if (alvo.id.startsWith('darwin') && process.platform === 'darwin') {
    rodar('codesign', ['--sign', '-', '--force', destino]);
  }
  console.log(`  ${alvo.arquivo}`);
}

await copyFile(path.join(aqui, 'LEIA-ME.txt'), path.join(saida, 'LEIA-ME.txt'));
console.log(`\n✓ Pronto: ${path.relative(process.cwd(), saida) || saida}/ (dados de ${geradoEm}${commit ? `, versão ${commit}` : ''})\n`);
