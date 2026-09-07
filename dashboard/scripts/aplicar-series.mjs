// Injeta no public/data/dashboard.json versionado as séries que o server.mjs passou
// a produzir, sem passar pelo build-static.mjs.
//
// Por que existe: o `npm run build:static` só roda onde `dados/`, `entregaveis/`, o
// shapefile e as bandeiras existem — a máquina de trabalho. Em qualquer clone feito
// por `git pull` essas pastas não vêm (estão no .gitignore), então lá não há como
// reassar o dashboard.json e as séries novas nunca chegariam à tela. Este script faz
// o mesmo cálculo do server.mjs lendo só arquivos versionados: as séries saem dos
// JSONs de public/data e os demais indicadores saem do próprio dashboard.json.
//
// Cobre três indicadores, e recalcula a síntese comparativa uma vez só no fim —
// rodar um de cada vez daria score intermediário errado:
//   school       ← frequencia-escolar-15a17.json   (PNADc, SIDRA 7138)
//   apsCobertura ← atencao-primaria.json           (e-Gestor, cobertura APS)
//   pdPctPib     ← pd-estadual.json                (MCTI + SIDRA t5938)
//
// O pdPctPib não entra na síntese comparativa (a lista SCORING não o inclui) e o valor
// plano segue a regra do server.mjs — o ano mais recente com valor em cada UF, que não é
// o mesmo em todas —, então injetá-lo só acrescenta série e não mexe em score nem ranking.
//
// O resultado é o mesmo que o build:static produz depois das ligações feitas no
// server.mjs, então rodar o build na máquina de trabalho sobrescreve este arquivo
// com conteúdo equivalente — não é um remendo que precise ser desfeito antes.
//
// É idempotente: rodar de novo recalcula a partir dos mesmos insumos e não acumula.
//
//   node scripts/aplicar-series.mjs   (a partir de dashboard/)
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = join(appRoot, 'public', 'data');

// Precisa espelhar o ANO_DE_REFERENCIA e o ANOS_PARCIAIS do server.mjs.
const REFERENCIA = { school: 2024, apsCobertura: 2026, pdPctPib: 2023 };
const PARCIAIS = { school: [], apsCobertura: [2026], pdPctPib: [] };

// --- réplicas fiéis do server.mjs (linhas 161-182) ---
function minMaxScore(values, direction = 'high') {
  const filtered = values.filter(Number.isFinite);
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  return values.map((value) => {
    if (!Number.isFinite(value)) return null;
    if (max === min) return 50;
    const position = (value - min) / (max - min);
    return Math.round((direction === 'high' ? position : 1 - position) * 1000) / 10;
  });
}

function rankStates(states, key, direction = 'high') {
  const sorted = [...states].sort((a, b) => direction === 'high' ? b[key] - a[key] : a[key] - b[key]);
  sorted.forEach((state, index) => { state.ranks[key] = index + 1; });
}

function weightedAverage(parts) {
  const valid = parts.filter(({ value }) => Number.isFinite(value));
  const totalWeight = valid.reduce((sum, { weight }) => sum + weight, 0);
  return totalWeight ? valid.reduce((sum, { value, weight }) => sum + value * weight, 0) / totalWeight : null;
}

const SCORING = [
  ['prodesRate', 'low', 0.22],
  ['heatRate', 'low', 0.08],
  ['conservationManaged', 'high', 0.10],
  ['poverty', 'low', 0.17],
  ['school', 'high', 0.12],
  ['apsCobertura', 'high', 0.11],
  ['cvliRate', 'low', 0.12],
  ['vulnerability', 'low', 0.08]
];

const leia = async (nome) => JSON.parse(await readFile(join(dataRoot, nome), 'utf8'));
const dashboard = await leia('dashboard.json');
const escolar = await leia('frequencia-escolar-15a17.json');
const aps = await leia('atencao-primaria.json');
const pd = await leia('pd-estadual.json');
const { states } = dashboard;

const antes = Object.fromEntries(states.map((s) => [s.uf, {
  score: s.score, pessoas: s.dimensions.pessoas, rankScore: s.ranks.score,
  aps: s.apsCobertura ?? s.esfRate, rankAps: s.ranks.apsCobertura ?? s.ranks.esfRate
}]));

// Só os anos com valor: o `serieDe` do server.mjs descarta valor não-finito, então
// 2020 e 2021 da frequência escolar ficam de fora do mesmo jeito.
const soComValor = (serie) => Object.fromEntries(Object.entries(serie || {}).filter(([, v]) => Number.isFinite(v)));

for (const state of states) {
  const school = soComValor(escolar.serieAnual[state.uf]);
  const cobertura = soComValor(aps.series.coberturaPct[state.uf]);
  const equipes = soComValor(aps.series.equipes[state.uf]);
  if (!Object.keys(school).length || !Object.keys(cobertura).length) throw new Error(`sem série para ${state.uf}`);
  state.series.school = school;
  state.series.apsCobertura = cobertura;
  // O P&D estadual segue a regra do server.mjs: valor plano é o ano mais recente com
  // dado em cada UF, porque o MCTI não publica todos os anos para todos os estados —
  // o Acre, por exemplo, não tem 2021 nem 2023.
  const pdSerie = soComValor(pd.seriePctPib[state.uf]);
  if (Object.keys(pdSerie).length) {
    state.series.pdPctPib = pdSerie;
    const ultimo = Math.max(...Object.keys(pdSerie).map(Number));
    state.pdPctPib = pdSerie[String(ultimo)];
    state.pdPctPibAno = ultimo;
  }
  state.school = school[String(REFERENCIA.school)];
  state.apsCobertura = cobertura[String(REFERENCIA.apsCobertura)];
  state.esfTeams = equipes[String(REFERENCIA.apsCobertura)] ?? null;
  // O painel deixou de exibir densidade de equipes; o campo antigo sai do payload
  // para não sobrar um número sem dono que ninguém recalcula.
  delete state.esfRate;
  delete state.ranks.esfRate;
  // O pdPctPib fica de fora: seu valor plano é o ano mais recente com dado, não o de
  // referência, e nem toda UF tem 2023.
  for (const chave of ['school', 'apsCobertura']) {
    if (!Number.isFinite(state[chave])) throw new Error(`${state.uf} sem ${chave} no ano de referência`);
  }
}

const scores = Object.fromEntries(SCORING.map(([key, direction]) => [key, minMaxScore(states.map((state) => state[key]), direction)]));
states.forEach((state, index) => {
  state.score = Math.round(weightedAverage(SCORING.map(([key, , weight]) => ({ value: scores[key][index], weight }))));
  state.dimensions.pessoas = Math.round(weightedAverage([
    { value: scores.poverty[index], weight: .42 },
    { value: scores.school[index], weight: .3 },
    { value: scores.apsCobertura[index], weight: .28 }
  ]));
});
rankStates(states, 'score');
rankStates(states, 'school');
rankStates(states, 'apsCobertura');
rankStates(states, 'pdPctPib');
dashboard.summary.averageScore = Math.round(states.reduce((sum, state) => sum + state.score, 0) / states.length);
states.sort((a, b) => a.ranks.score - b.ranks.score);

for (const [chave, ano] of Object.entries(REFERENCIA)) {
  const anos = [...new Set(states.flatMap((state) => Object.keys(state.series[chave]).map(Number)))].sort((a, b) => a - b);
  dashboard.metricYears[chave] = { anos, referencia: ano, parciais: PARCIAIS[chave] };
  console.log(`metricYears.${chave}: ${anos.length} anos (${anos[0]}-${anos.at(-1)}), referência ${ano}`);
}
const pessoas = dashboard.methodology.dimensions.find((d) => d.name === 'Pessoas');
if (pessoas) pessoas.indicators = 'pobreza, frequência escolar 15–17 e cobertura da atenção primária';

await writeFile(join(dataRoot, 'dashboard.json'), JSON.stringify(dashboard));

console.log('\nUF   atenção primária        score        dim. pessoas   rank APS');
const delta = (novo, velho) => (novo === velho ? '   =' : ` ${novo > velho ? '+' : ''}${novo - velho}`);
for (const state of states) {
  const a = antes[state.uf];
  console.log(
    `${state.uf}   ${a.aps.toFixed(1).padStart(5)} → ${state.apsCobertura.toFixed(1).padStart(6)}%   ` +
    `${String(state.score).padStart(3)}${delta(state.score, a.score)}   ` +
    `${String(state.dimensions.pessoas).padStart(3)}${delta(state.dimensions.pessoas, a.pessoas)}      ` +
    `${state.ranks.apsCobertura}º${delta(state.ranks.apsCobertura, a.rankAps)}`
  );
}
console.log(`\naverageScore: ${dashboard.summary.averageScore}`);
