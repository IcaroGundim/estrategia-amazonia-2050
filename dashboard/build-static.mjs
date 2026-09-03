// Gera os artefatos de dados consumidos pelas páginas.
// Roda localmente, onde `dados/`, `entregaveis/`, o shapefile e as bandeiras existem;
// o resultado é versionado em `public/` e o Astro o copia para `dist/` no build.
import { mkdir, writeFile, copyFile, rm, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDashboard, loadGeo, loadCatalogo } from './server.mjs';
import { buildMetas } from './metas.mjs';

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(appRoot, '..');
const publicRoot = join(appRoot, 'public');
const dataOut = join(publicRoot, 'data');
const flagsOut = join(publicRoot, 'flags');
const downloadsOut = join(publicRoot, 'downloads');
const flagsSrc = join(workspaceRoot, 'Bandeiras - Amazônia Legal-20260820T011546Z-1-001', 'Bandeiras - Amazônia Legal');
const deliverablesRoot = join(workspaceRoot, 'entregaveis');

// Arquivos de data/ que este script produz. Só eles são apagados no início: o
// fichas.json vem do extrator do .docx (scripts/extract-fichas.ps1) e sobreviveria
// mal a um rm -rf da pasta inteira.
const DATA_GERADOS = ['dashboard.json', 'geo.json', 'catalogo.json', 'metas.json'];

const kb = (text) => `${(Buffer.byteLength(text) / 1024).toFixed(0)} kB`;

// As coordenadas vêm do shapefile com 15 dígitos. Na escala do mapa (720px para
// 32° de longitude) um pixel vale 0,045°, então 4 casas decimais deslocam a
// geometria em 0,002 pixel e cortam o arquivo pela metade.
function arredondaCoordenadas(geometria, casas = 4) {
  const ajusta = (lista) => {
    if (typeof lista[0] === 'number') {
      lista[0] = Number(lista[0].toFixed(casas));
      lista[1] = Number(lista[1].toFixed(casas));
      return;
    }
    lista.forEach(ajusta);
  };
  ajusta(geometria.coordinates);
  return geometria;
}

async function writeJson(name, payload) {
  const text = JSON.stringify(payload);
  await writeFile(join(dataOut, name), text);
  console.log(`  data/${name} (${kb(text)})`);
}

async function main() {
  for (const dir of [flagsOut, downloadsOut]) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
  }
  await mkdir(dataOut, { recursive: true });
  for (const name of DATA_GERADOS) await rm(join(dataOut, name), { force: true });

  console.log('Gerando JSON do painel...');
  const [dashboard, geo, catalogo] = await Promise.all([buildDashboard(), loadGeo(), loadCatalogo()]);
  await writeJson('dashboard.json', dashboard);
  await writeJson('geo.json', {
    ...geo,
    features: geo.features.map((feature) => ({ ...feature, geometry: arredondaCoordenadas(feature.geometry) }))
  });
  await writeJson('catalogo.json', catalogo);
  await writeJson('metas.json', buildMetas(catalogo, dashboard));

  console.log('Copiando bandeiras...');
  for (const file of (await readdir(flagsSrc)).filter((name) => name.endsWith('.svg'))) {
    await copyFile(join(flagsSrc, file), join(flagsOut, file));
  }

  console.log('Copiando downloads...');
  const downloads = [
    ...(await readdir(deliverablesRoot)).filter((name) => name.endsWith('.xlsx')).map((name) => [name, join(deliverablesRoot, name)]),
    ['RELATORIO_DE_COLETA.md', join(workspaceRoot, 'RELATORIO_DE_COLETA.md')]
  ];
  for (const [name, fullPath] of downloads) await copyFile(fullPath, join(downloadsOut, name));

  // A bandeira da região é desenhada a partir do geo.json recém-gerado, então roda
  // depois dele — e é reposta aqui porque a cópia acima esvazia a pasta de bandeiras.
  console.log('Desenhando a bandeira da região...');
  execFileSync(process.execPath, [join('scripts', 'gerar_bandeira_regiao.mjs')], { cwd: workspaceRoot, stdio: 'inherit' });

  console.log('Pronto. Os artefatos estão em public/ e o Astro os copia para dist/.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
