import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDashboard } from './server.mjs';

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(appRoot, '..');
const outPath = join(workspaceRoot, 'dados', 'catalogo', 'dashboard_snapshot.json');

const data = await buildDashboard();
const payload = { generatedAt: new Date().toISOString(), ...data };
await writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
console.log(`Snapshot gravado em ${outPath}`);
console.log(`Estados: ${data.states.length} · atualizado em: ${data.updatedAt}`);
