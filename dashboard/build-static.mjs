// Gera os artefatos de dados consumidos pelas páginas a partir de `conteudo/`.
//
// Roda em qualquer clone e no build da Vercel (`npm run build` o chama antes do
// `astro build`): não depende de `dados/`, de shapefile nem de pasta fora do
// repositório. O que ele escreve em `public/` é derivado e está no .gitignore;
// `public/data/geo.json`, os JSONs de detalhe por tema, `public/flags/` e
// `public/downloads/*.md|*.pdf` são fonte versionada e ficam intocados.
//
//   public/data/dashboard.json   Panorama: estados, séries, síntese, resumo
//   public/data/catalogo.json    catálogo com os números
//   public/data/metas.json       metas avaliadas por estado
//   public/data/fichas.json      fichas técnicas
//   public/downloads/*.xlsx      um workbook por eixo, mais o modelo de importação
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { carregaFonte, conteudoRoot, publicRoot } from './pipeline/fonte.mjs';
import { derivaDashboard } from './pipeline/derivar.mjs';
import { montaCatalogoPublico } from './pipeline/catalogo.mjs';
import { buildMetas } from './pipeline/metas.mjs';
import { geraWorkbooks } from './pipeline/workbooks.mjs';

const dataOut = join(publicRoot, 'data');
const downloadsOut = join(publicRoot, 'downloads');
const kb = (text) => `${(Buffer.byteLength(text) / 1024).toFixed(0)} kB`;

async function writeJson(name, payload) {
  const text = JSON.stringify(payload);
  await writeFile(join(dataOut, name), text);
  console.log(`  data/${name} (${kb(text)})`);
}

// A sobreposição em inglês do conteúdo dos indicadores, no formato que
// src/scripts/conteudo.js aplica por cima do português: só o que tem tradução
// entra, e o que falta degrada para o português na página.
export function montaTraducoes({ catalogo, fichas }) {
  const soPreenchidos = (objeto) => Object.fromEntries(Object.entries(objeto || {}).filter(([, valor]) => valor !== null && valor !== undefined && valor !== ''));
  const eixos = {};
  const indicadores = {};
  for (const eixo of catalogo.eixos) {
    if (eixo.en?.nome) eixos[String(eixo.numero)] = eixo.en.nome;
    for (const indicador of eixo.indicadores || []) {
      const campos = soPreenchidos(indicador.en);
      if (Object.keys(campos).length) indicadores[indicador.codigo] = campos;
    }
  }
  const linhasAcao = Object.fromEntries(Object.entries(catalogo.linhasAcao || {}).filter(([, par]) => par?.en).map(([numero, par]) => [numero, par.en]));
  const equacoes = {};
  const notasFormula = {};
  for (const [codigo, ficha] of Object.entries(fichas.fichas || {})) {
    if (ficha.en?.equacoes) equacoes[codigo] = ficha.en.equacoes;
    if (ficha.en?.notasFormula) notasFormula[codigo] = ficha.en.notasFormula;
  }
  return {
    _leia: 'Gerado pelo build a partir dos campos `en` de conteudo/catalogo.json e conteudo/fichas.json. Sobreposto ao português por src/scripts/conteudo.js, campo a campo: o que falta aqui aparece em português na versão inglesa.',
    eixos,
    linhasAcao,
    equacoes,
    notasFormula,
    indicadores
  };
}

// Também usado pelos scripts de conferência, que querem o payload sem gravar.
export async function derivaTudo() {
  const fonte = await carregaFonte();
  const dashboard = await derivaDashboard(fonte);
  const catalogo = montaCatalogoPublico(fonte);
  const metas = buildMetas(catalogo, dashboard, fonte.metas);
  return { fonte, dashboard, catalogo, metas };
}

async function main() {
  await mkdir(dataOut, { recursive: true });
  await mkdir(downloadsOut, { recursive: true });

  console.log('Derivando os dados do painel a partir de conteudo/...');
  const { fonte, dashboard, catalogo, metas } = await derivaTudo();
  await writeJson('dashboard.json', dashboard);
  await writeJson('catalogo.json', catalogo);
  await writeJson('metas.json', metas);
  await copyFile(join(conteudoRoot, 'fichas.json'), join(dataOut, 'fichas.json'));
  console.log('  data/fichas.json (copiado de conteudo/)');
  await mkdir(join(dataOut, 'i18n'), { recursive: true });
  const traducoes = JSON.stringify(montaTraducoes(fonte));
  await writeFile(join(dataOut, 'i18n', 'en.json'), traducoes);
  console.log(`  data/i18n/en.json (${kb(traducoes)})`);

  console.log('Montando os workbooks de download...');
  const arquivos = await geraWorkbooks({ fonte, dashboard, catalogo, metas }, downloadsOut);
  for (const nome of arquivos) console.log(`  downloads/${nome}`);

  console.log('Pronto. Os artefatos estão em public/ e o Astro os copia para dist/.');
}

const invocadoDireto = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invocadoDireto) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
