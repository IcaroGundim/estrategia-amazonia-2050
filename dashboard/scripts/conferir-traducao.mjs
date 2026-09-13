// Aponta o que ficou sem inglês.
//
// O dicionário usa o português como chave, o que tem um preço: mudar uma frase
// no código a desliga da tradução em silêncio, e o leitor de inglês vê
// português sem que nada quebre. Este script é o alarme.
//
// Ele faz duas varreduras:
//
//   órfãs    — texto que aparece envolvido em `t(...)`/`tp(...)` no código mas
//              não tem entrada no dicionário. É o caso perigoso: o painel
//              mostra português achando que mostrou inglês.
//   sobras   — entradas do dicionário que nenhum fonte usa mais. Não quebram
//              nada, mas são peso morto e sinal de refatoração inacabada.
//
//   npm run check:i18n

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../src', import.meta.url));
const { en } = await import('../src/i18n/en.js');

function arquivos(dir) {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.(astro|js|ts)$/.test(caminho) && !caminho.includes(`i18n${'/'}`) && !caminho.includes('i18n\\')
      ? [caminho]
      : [];
  });
}

// `t('…')` e `tp('…', …)`, com aspas simples, duplas ou crase.
const CHAMADA = /\bt[p]?\(\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

const usadas = new Map();
const fontes = [];
for (const caminho of arquivos(raiz)) {
  const fonte = readFileSync(caminho, 'utf8');
  fontes.push(fonte);
  for (const achado of fonte.matchAll(CHAMADA)) {
    const texto = achado[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
    if (!usadas.has(texto)) usadas.set(texto, []);
    usadas.get(texto).push(relative(raiz, caminho));
  }
}
const tudo = fontes.join('\n');

// Alguns textos nunca aparecem no código: são valores que vêm dos dados e
// passam pelo `t()` como variável — a frequência de uma ficha ("Anual"), a
// unidade ("Pessoas"), o motivo de um indicador ficar fora do quadro. Procurá-los
// nos JSONs é o que distingue uma entrada viva de uma sobra de verdade.
// `pipeline/metas.mjs` e `conteudo/metas.json` entram juntos porque é deles que
// saem os motivos de um indicador ficar fora do quadro — texto que só chega à
// tela pelos dados, mas que nasce ali, e cujas variantes nem sempre aparecem no
// metas.json de uma dada coleta.
const dados = [
  '../public/data/catalogo.json',
  '../public/data/fichas.json',
  '../public/data/metas.json',
  '../pipeline/metas.mjs',
  '../conteudo/metas.json'
]
  .map((caminho) => {
    try {
      return readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8');
    } catch {
      return '';
    }
  })
  .join('\n');

const orfas = [...usadas.keys()].filter((texto) => !(texto in en)).sort();
// Para a sobra a busca é textual, e não pela chamada: boa parte dos textos
// chega ao `t()` como variável — `TEMAS.map(({ titulo }) => t(titulo))` —, e
// procurar só por literal dentro de `t(...)` os daria todos como não usados.
const sobras = Object.keys(en)
  .filter((texto) => !tudo.includes(texto) && !dados.includes(JSON.stringify(texto).slice(1, -1)))
  .sort();

const corte = (texto) => (texto.length > 72 ? `${texto.slice(0, 69)}…` : texto);

if (orfas.length) {
  console.log(`\nSEM TRADUÇÃO (${orfas.length}) — o inglês mostra o português:\n`);
  for (const texto of orfas) {
    console.log(`  ${corte(texto)}`);
    console.log(`      ${[...new Set(usadas.get(texto))].join(', ')}`);
  }
}

if (sobras.length) {
  console.log(`\nSEM USO (${sobras.length}) — entrada de dicionário que nenhum fonte pede:\n`);
  for (const texto of sobras) console.log(`  ${corte(texto)}`);
}

if (!orfas.length && !sobras.length) {
  console.log(`Dicionário em dia: ${usadas.size} textos, todos traduzidos e todos em uso.`);
} else {
  console.log(`\n${usadas.size} textos no código · ${Object.keys(en).length} no dicionário · ${orfas.length} sem tradução · ${sobras.length} sem uso`);
}

// `--apagar` remove as sobras do dicionário. Cada entrada ocupa uma linha
// (`  'pt': 'en',`) ou duas (valor na linha seguinte), sem comentário no meio;
// o que não casar com esse desenho fica e é avisado, para não estragar o arquivo.
if (sobras.length && process.argv.includes('--apagar')) {
  const caminho = fileURLToPath(new URL('../src/i18n/en.js', import.meta.url));
  let fonte = readFileSync(caminho, 'utf8');
  const escapa = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "\\\\'");
  let apagadas = 0;
  for (const texto of sobras) {
    const padrao = new RegExp(`^  '${escapa(texto)}':\\s*\\n?\\s*'(?:[^'\\\\]|\\\\.)*',?\\n`, 'm');
    if (padrao.test(fonte)) { fonte = fonte.replace(padrao, ''); apagadas += 1; } else console.log(`  não apaguei (desenho diferente): ${corte(texto)}`);
  }
  writeFileSync(caminho, fonte);
  console.log(`\n${apagadas} entrada(s) apagada(s) de src/i18n/en.js.`);
}

// Sem tradução é erro; sobra é só aviso.
process.exitCode = orfas.length ? 1 : 0;
