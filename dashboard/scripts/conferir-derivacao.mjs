// Confere a derivação de `conteudo/` contra uma versão de referência dos JSONs
// publicados: por padrão a de `git HEAD`, ou uma pasta passada como argumento.
//
// Compara valor a valor, ignorando a ordem das chaves, com tolerância relativa
// para números (as taxas são reconstruídas do valor bruto e a última casa pode
// oscilar). `flagVersion` fica de fora: era a data do arquivo na máquina do dev
// e passou a ser um hash do conteúdo — muda por definição, e só fura cache.
//
//   node scripts/conferir-derivacao.mjs            (contra git HEAD)
//   node scripts/conferir-derivacao.mjs ../pasta   (contra JSONs numa pasta)
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { derivaTudo } from '../build-static.mjs';
import { appRoot } from '../pipeline/fonte.mjs';

const TOLERANCIA = 1e-9;
const IGNORAR = new Set(['flagVersion']);
const ARQUIVOS = { 'dashboard.json': 'dashboard', 'catalogo.json': 'catalogo', 'metas.json': 'metas' };

async function referencia(nome) {
  const pasta = process.argv[2];
  if (pasta) return JSON.parse(await readFile(join(resolve(pasta), nome), 'utf8'));
  const texto = execFileSync('git', ['show', `HEAD:dashboard/public/data/${nome}`], { cwd: appRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(texto);
}

function compara(esperado, obtido, caminho, diferencas) {
  if (typeof esperado === 'number' && typeof obtido === 'number') {
    const escala = Math.max(Math.abs(esperado), Math.abs(obtido), 1);
    if (Math.abs(esperado - obtido) / escala > TOLERANCIA) diferencas.push(`${caminho}: ${esperado} → ${obtido}`);
    return;
  }
  if (esperado === null || obtido === null || typeof esperado !== 'object' || typeof obtido !== 'object') {
    if (esperado !== obtido) diferencas.push(`${caminho}: ${JSON.stringify(esperado)} → ${JSON.stringify(obtido)}`);
    return;
  }
  if (Array.isArray(esperado) !== Array.isArray(obtido)) {
    diferencas.push(`${caminho}: tipos diferentes`);
    return;
  }
  const chaves = new Set([...Object.keys(esperado), ...Object.keys(obtido)]);
  for (const chave of chaves) {
    if (IGNORAR.has(chave)) continue;
    const sub = Array.isArray(esperado) ? `${caminho}[${chave}]` : `${caminho}.${chave}`;
    if (!(chave in esperado)) { diferencas.push(`${sub}: só no novo (${JSON.stringify(obtido[chave]).slice(0, 60)})`); continue; }
    if (!(chave in obtido)) { diferencas.push(`${sub}: só na referência (${JSON.stringify(esperado[chave]).slice(0, 60)})`); continue; }
    compara(esperado[chave], obtido[chave], sub, diferencas);
  }
}

const gerado = await derivaTudo();
let total = 0;
for (const [nome, chave] of Object.entries(ARQUIVOS)) {
  const diferencas = [];
  compara(await referencia(nome), gerado[chave], nome.replace('.json', ''), diferencas);
  total += diferencas.length;
  console.log(`${nome}: ${diferencas.length ? `${diferencas.length} diferença(s)` : 'idêntico'}`);
  for (const linha of diferencas.slice(0, 40)) console.log(`  ${linha}`);
  if (diferencas.length > 40) console.log(`  ... e mais ${diferencas.length - 40}`);
}
process.exitCode = total ? 1 : 0;
