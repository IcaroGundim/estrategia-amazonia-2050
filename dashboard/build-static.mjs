// Gera os artefatos de dados consumidos pelas páginas.
// Roda localmente, onde `dados/`, `entregaveis/`, o shapefile e as bandeiras existem;
// o resultado é versionado em `public/` e o Astro o copia para `dist/` no build.
import { mkdir, writeFile, copyFile, rm, readdir } from 'node:fs/promises';
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

const kb = (text) => `${(Buffer.byteLength(text) / 1024).toFixed(0)} kB`;

async function writeJson(name, payload) {
  const text = JSON.stringify(payload);
  await writeFile(join(dataOut, name), text);
  console.log(`  data/${name} (${kb(text)})`);
}

async function main() {
  for (const dir of [dataOut, flagsOut, downloadsOut]) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
  }

  console.log('Gerando JSON do painel...');
  const [dashboard, geo, catalogo] = await Promise.all([buildDashboard(), loadGeo(), loadCatalogo()]);
  await writeJson('dashboard.json', dashboard);
  await writeJson('geo.json', geo);
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

  console.log('Pronto. Os artefatos estão em public/ e o Astro os copia para dist/.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
