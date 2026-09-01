import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as shapefile from 'shapefile';
import { buildMetas } from './metas.mjs';

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(appRoot, '..');
const publicRoot = join(appRoot, 'public');
const dataRoot = join(workspaceRoot, 'dados');
const catalogoPath = join(dataRoot, 'catalogo', 'indicadores.json');
const deliverablesRoot = join(workspaceRoot, 'entregaveis');
const shapeRoot = join(workspaceRoot, 'BR_UF_2025 (2)');
const flagsRoot = join(workspaceRoot, 'Bandeiras - Amazônia Legal-20260820T011546Z-1-001', 'Bandeiras - Amazônia Legal');
const port = Number(process.env.PORT || 4173);
const DOWNLOADS = new Map([
  ['Indicadores_Resultado_Eixo1_Amazonia2050.xlsx', join(deliverablesRoot, 'Indicadores_Resultado_Eixo1_Amazonia2050.xlsx')],
  ['Indicadores_Resultado_Eixo2_Amazonia2050.xlsx', join(deliverablesRoot, 'Indicadores_Resultado_Eixo2_Amazonia2050.xlsx')],
  ['Indicadores_Resultado_Eixo3_Amazonia2050.xlsx', join(deliverablesRoot, 'Indicadores_Resultado_Eixo3_Amazonia2050.xlsx')],
  ['Indicadores_Resultado_Eixo4_Amazonia2050.xlsx', join(deliverablesRoot, 'Indicadores_Resultado_Eixo4_Amazonia2050.xlsx')],
  ['Indicadores_Resultado_Eixo5_Amazonia2050.xlsx', join(deliverablesRoot, 'Indicadores_Resultado_Eixo5_Amazonia2050.xlsx')],
  ['RELATORIO_DE_COLETA.md', join(workspaceRoot, 'RELATORIO_DE_COLETA.md')]
]);

const STATES = {
  AC: { name: 'Acre', capital: 'Rio Branco', flag: 'Bandeira_do_Acre.svg' },
  AP: { name: 'Amapá', capital: 'Macapá', flag: 'Bandeira_do_Amapa.svg' },
  AM: { name: 'Amazonas', capital: 'Manaus', flag: 'Bandeira_do_Amazonas.svg' },
  MA: { name: 'Maranhão', capital: 'São Luís', flag: 'Bandeira_do_Maranhao.svg' },
  MT: { name: 'Mato Grosso', capital: 'Cuiabá', flag: 'Bandeira_de_Mato_Grosso.svg' },
  PA: { name: 'Pará', capital: 'Belém', flag: 'Bandeira_do_Para.svg' },
  RO: { name: 'Rondônia', capital: 'Porto Velho', flag: 'Bandeira_de_Rondonia.svg' },
  RR: { name: 'Roraima', capital: 'Boa Vista', flag: 'Bandeira_de_Roraima.svg' },
  TO: { name: 'Tocantins', capital: 'Palmas', flag: 'Bandeira_do_Tocantins.svg' }
};

// Ano que cada indicador com série usa como padrão: o mesmo que o painel já exibia
// antes de existir seletor de ano.
const ANO_DE_REFERENCIA = {
  prodesRate: 2025,
  cvliRate: 2025,
  ibc: 2025,
  pevsBilhoes: 2024,
  piaBilhoes: 2024,
  pdPctPib: 2023
};

// Anos que estão na base mas ainda em curso. O CVLI de 2026 tem cerca de metade do
// volume de 2025 (Pará com 956 contra 1.757), então comparar sem ressalva sugeriria
// uma queda que não aconteceu.
const ANOS_PARCIAIS = { cvliRate: [2026] };

const stateByName = Object.fromEntries(
  Object.entries(STATES).flatMap(([uf, state]) => [
    [normaliseKey(state.name), uf],
    [normaliseKey(`${uf} ${state.name}`), uf]
  ])
);

function svgAspectRatio(svg = '') {
  const tag = svg.match(/<svg[^>]*>/)?.[0] || '';
  const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
  const width = tag.match(/\swidth="([^"]+)"/)?.[1];
  const height = tag.match(/\sheight="([^"]+)"/)?.[1];
  const viewBox = tag.match(/\sviewBox="([^"]+)"/)?.[1];
  const widthValue = toNumber(width);
  const heightValue = toNumber(height);
  if (widthValue > 0 && heightValue > 0) return widthValue / heightValue;
  const parts = String(viewBox || '').trim().split(/[\s,]+/).map(toNumber);
  if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) return parts[2] / parts[3];
  return null;
}

const FLAG_META = Object.fromEntries(Object.entries(STATES).map(([uf, { flag }]) => {
  const fullPath = join(flagsRoot, flag);
  if (!existsSync(fullPath)) return [uf, { flagVersion: null, flagRatio: null }];
  const meta = { flagVersion: Math.floor(statSync(fullPath).mtimeMs) };
  const ratio = svgAspectRatio(readFileSync(fullPath, 'utf8'));
  meta.flagRatio = ratio ? Number(ratio.toFixed(4)) : null;
  return [uf, meta];
}));

function normaliseKey(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function stateFromLabel(label = '') {
  const direct = normaliseKey(label);
  if (STATES[direct]) return direct;
  if (stateByName[direct]) return stateByName[direct];
  for (const [name, uf] of Object.entries(stateByName)) {
    if (direct.endsWith(name)) return uf;
  }
  return null;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === '' || value === '-') return null;
  const source = String(value).trim();
  const clean = source.includes(',') ? source.replace(/\./g, '').replace(',', '.') : source;
  const number = Number(clean);
  return Number.isFinite(number) ? number : null;
}

function parseCsv(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
}

async function readCsv(relativePath, delimiter = ',', skipLines = 0, encoding = 'utf8') {
  const text = await readFile(join(dataRoot, relativePath), encoding);
  const body = skipLines ? text.split(/\r?\n/).slice(skipLines).join('\n') : text;
  return parseCsv(body, delimiter);
}

function asByUf(rows, getUf, mapRow) {
  return rows.reduce((result, row) => {
    const uf = getUf(row);
    if (uf && STATES[uf]) result[uf] = mapRow(row);
    return result;
  }, {});
}

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

function perpendicularDistance(point, start, end) {
  const [x, y] = point; const [x1, y1] = start; const [x2, y2] = end;
  const dx = x2 - x1; const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / lengthSquared;
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + clamped * dx), y - (y1 + clamped * dy));
}

function simplifyRing(points, tolerance) {
  if (points.length <= 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1; keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [start, end] = stack.pop();
    let maxDistance = 0; let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const distance = perpendicularDistance(points[i], points[start], points[end]);
      if (distance > maxDistance) { maxDistance = distance; index = i; }
    }
    if (maxDistance > tolerance && index !== -1) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  const simplified = points.filter((_, i) => keep[i]);
  return simplified.length >= 4 ? simplified : points;
}

function simplifyGeometry(geometry, tolerance) {
  if (geometry.type === 'Polygon') {
    return { ...geometry, coordinates: geometry.coordinates.map((ring) => simplifyRing(ring, tolerance)) };
  }
  if (geometry.type === 'MultiPolygon') {
    return { ...geometry, coordinates: geometry.coordinates.map((polygon) => polygon.map((ring) => simplifyRing(ring, tolerance))) };
  }
  return geometry;
}

let catalogoCache = null;

export async function loadCatalogo() {
  if (catalogoCache) return catalogoCache;
  catalogoCache = JSON.parse(await readFile(catalogoPath, 'utf8'));
  return catalogoCache;
}

let geoCache = null;

export async function loadGeo() {
  if (geoCache) return geoCache;
  const fileBase = join(shapeRoot, 'BR_UF_2025');
  const geo = await shapefile.read(`${fileBase}.shp`, `${fileBase}.dbf`, { encoding: 'utf-8' });
  const simplifyTolerance = 0.006;
  const features = geo.features
    .map((feature) => {
      const properties = feature.properties || {};
      const uf = properties.SIGLA_UF || properties.SIGLA || properties.UF || stateFromLabel(properties.NM_UF || properties.NOME || '');
      return { ...feature, properties: { ...properties, uf }, geometry: simplifyGeometry(feature.geometry, simplifyTolerance) };
    })
    .filter((feature) => STATES[feature.properties.uf]);
  geoCache = { type: 'FeatureCollection', features };
  return geoCache;
}

export async function buildDashboard() {
  const [populationRows, prodesRows, focusRows, cvliRows, povertyRows, schoolRows, teamRows, vulnerabilityRows, conservationRows, pevsRows, piaRows, ibcRows, perRows, isgrRows, pdRows, geo] = await Promise.all([
    readCsv('ibge_pop/populacao_uf_ano.csv'),
    readCsv('prodes/prodes_rates_uf.csv'),
    readCsv('focos/focos_calor_uf_ano.csv'),
    readCsv('sinesp/cvli_uf_ano.csv'),
    readCsv('ibge_sis/sis_pobreza_uf.csv'),
    readCsv('ibge_sis/sis_freq_escolar_uf.csv'),
    readCsv('cnes/cnes_equipes_uf.csv', ';', 3, 'latin1'),
    readCsv('iivcm/iivcm.csv'),
    readCsv('cnuc/cnuc.csv', ';', 0, 'latin1'),
    readCsv('eixo3/pevs_total_uf_ano.csv'),
    readCsv('eixo3/pia_industria_uf_ano.csv'),
    readCsv('anatel/ibc_uf_ano.csv'),
    readCsv('aneel/per_uf.csv'),
    readCsv('saneamento/isgr_uf.csv'),
    readCsv('eixo5/pd_uf_ano.csv'),
    loadGeo()
  ]);

  const population = asByUf(populationRows.filter((row) => Number(row.ano) === 2025), (row) => row.uf, (row) => parseNumber(row.populacao));
  const populationByYear = {};
  for (const row of populationRows) {
    const uf = row.uf;
    const ano = Number(row.ano);
    const valor = parseNumber(row.populacao);
    if (!STATES[uf] || !Number.isFinite(ano) || !Number.isFinite(valor)) continue;
    (populationByYear[uf] ||= {})[ano] = valor;
  }
  const prodes = Object.groupBy(prodesRows, (row) => row.uf);
  const focos = Object.groupBy(focusRows, (row) => row.uf);
  const cvli = Object.groupBy(cvliRows, (row) => row.uf);
  const poverty = asByUf(povertyRows, (row) => row.uf, (row) => parseNumber(row.pct_pobreza_usd365));
  const school = asByUf(schoolRows, (row) => row.uf, (row) => parseNumber(row['15_17']));

  const latestByUf = (rows, year, pick) => {
    const map = {};
    for (const row of rows) {
      if (Number(row.ano) !== year) continue;
      const uf = row.uf;
      if (!STATES[uf]) continue;
      const value = pick(row);
      if (Number.isFinite(value)) map[uf] = value;
    }
    return map;
  };
  const pevsByUf = Object.groupBy(pevsRows, (row) => row.uf);
  const piaByUf = Object.groupBy(piaRows.filter((row) => row.cnae_nome === 'Total'), (row) => row.uf);
  const ibcByUf = Object.groupBy(ibcRows, (row) => row.uf);
  const pdByUf = Object.groupBy(pdRows, (row) => row.uf);
  const pevs = latestByUf(pevsRows, 2024, (row) => parseNumber(row.valor_mil_rs));
  const pia = latestByUf(piaRows.filter((row) => row.cnae_nome === 'Total'), 2024, (row) => parseNumber(row.valor_transf_ind_mil_rs));
  const ibc = latestByUf(ibcRows, 2025, (row) => parseNumber(row.ibc_ponderado_pop));
  const perRenovavel = asByUf(perRows, (row) => row.uf, (row) => parseNumber(row.per_renovaveis_pct));
  const isgr = asByUf(isgrRows, (row) => row.uf, (row) => parseNumber(row.isgr_pct));
  const pdLatest = {};
  for (const row of pdRows) {
    const uf = row.uf;
    const value = parseNumber(row.pct_pib);
    if (!STATES[uf] || !Number.isFinite(value)) continue;
    const ano = Number(row.ano);
    if (!pdLatest[uf] || ano > pdLatest[uf].ano) pdLatest[uf] = { ano, value };
  }
  const pdPctPib = Object.fromEntries(Object.entries(pdLatest).map(([uf, entry]) => [uf, entry.value]));
  const pdPctPibAno = Object.fromEntries(Object.entries(pdLatest).map(([uf, entry]) => [uf, entry.ano]));

  const teams = {};
  for (const row of teamRows) {
    const uf = stateFromLabel(row['Unidade da Federação']);
    if (!uf) continue;
    const esf = parseNumber(row['01 ESF - EQUIPE DE SAUDE DA FAMILIA']) || 0;
    const esfLegacy = parseNumber(row['70 ESF - EQUIPE DE SAUDE DA FAMILIA']) || 0;
    const eap = parseNumber(row['76 EAP - EQUIPE DE ATENCAO PRIMARIA']) || 0;
    teams[uf] = esf + esfLegacy + eap;
  }

  const vulnerabilityByUf = {};
  for (const row of vulnerabilityRows) {
    const uf = row.uf;
    const value = parseNumber(row.adaptabrasil_iivcm);
    if (!STATES[uf] || !Number.isFinite(value)) continue;
    if (!vulnerabilityByUf[uf]) vulnerabilityByUf[uf] = [];
    vulnerabilityByUf[uf].push(value);
  }

  const conservationByUf = Object.fromEntries(Object.keys(STATES).map((uf) => [uf, { total: 0, managed: 0 }]));
  for (const row of conservationRows) {
    const states = String(row.UF || '').split(',').map((value) => value.trim()).filter((value) => STATES[value]);
    for (const uf of states) {
      conservationByUf[uf].total += 1;
      if (normaliseKey(row['Plano de Manejo']) === 'SIM' && normaliseKey(row['Conselho Gestor']) === 'SIM') {
        conservationByUf[uf].managed += 1;
      }
    }
  }

  const areaByUf = Object.fromEntries(geo.features.map((feature) => {
    const props = feature.properties;
    const candidates = [props.AREA_KM2, props.AREA_KM2_2, props.AREA, props.AREA_KM];
    const area = candidates.map(parseNumber).find(Number.isFinite) || null;
    return [props.uf, area];
  }));

  const states = Object.entries(STATES).map(([uf, identity]) => {
    const latest = (rows, year) => (rows?.find((row) => Number(row.ano) === year));
    const deforestation = parseNumber(latest(prodes[uf], 2025)?.taxa_km2);
    const deforestation2024 = parseNumber(latest(prodes[uf], 2024)?.taxa_km2);
    const heat = parseNumber(latest(focos[uf], 2024)?.focos_sat_ref);
    const heat2023 = parseNumber(latest(focos[uf], 2023)?.focos_sat_ref);
    const violence = parseNumber(latest(cvli[uf], 2025)?.cvli);
    const populationValue = population[uf];
    const area = areaByUf[uf];
    const rate = (value, base, factor = 100000) => Number.isFinite(value) && Number.isFinite(base) && base > 0 ? value / base * factor : null;
    const serieDe = (rows, campo, derivar) => {
      const saida = {};
      for (const row of rows || []) {
        const ano = Number(row.ano);
        const valor = parseNumber(row[campo]);
        if (!Number.isFinite(ano) || !Number.isFinite(valor)) continue;
        const derivado = derivar(valor, ano);
        if (Number.isFinite(derivado)) saida[ano] = derivado;
      }
      return saida;
    };
    const conservation = conservationByUf[uf];
    return {
      uf,
      ...identity,
      flagVersion: FLAG_META[uf]?.flagVersion ?? null,
      flagRatio: FLAG_META[uf]?.flagRatio ?? null,
      population: populationValue,
      area,
      prodesKm2: deforestation,
      prodesRate: rate(deforestation, area, 1000),
      prodesVariation: Number.isFinite(deforestation) && Number.isFinite(deforestation2024) && deforestation2024 > 0 ? (deforestation - deforestation2024) / deforestation2024 * 100 : null,
      heat: heat,
      heatRate: rate(heat, area, 1000),
      heatVariation: Number.isFinite(heat) && Number.isFinite(heat2023) && heat2023 > 0 ? (heat - heat2023) / heat2023 * 100 : null,
      cvli: violence,
      cvliRate: rate(violence, populationValue),
      poverty: poverty[uf],
      school: school[uf],
      esfTeams: teams[uf] ?? null,
      esfRate: rate(teams[uf], populationValue),
      vulnerability: vulnerabilityByUf[uf] ? vulnerabilityByUf[uf].reduce((sum, value) => sum + value, 0) / vulnerabilityByUf[uf].length : null,
      conservationUnits: conservation.total,
      conservationManaged: conservation.total ? conservation.managed / conservation.total * 100 : null,
      pevsBilhoes: pevs[uf] != null ? pevs[uf] / 1e6 : null,
      piaBilhoes: pia[uf] != null ? pia[uf] / 1e6 : null,
      ibc: ibc[uf] ?? null,
      perRenovavel: perRenovavel[uf] ?? null,
      isgr: isgr[uf] ?? null,
      pdPctPib: pdPctPib[uf] ?? null,
      pdPctPibAno: pdPctPibAno[uf] ?? null,
      // Valores por ano dos indicadores com histórico, já na unidade do campo plano
      // acima. Derivar aqui evita repetir no cliente a conta das taxas — e cvliRate
      // depende da população do ano exibido, não da de 2025.
      series: {
        prodesRate: serieDe(prodes[uf], 'taxa_km2', (valor) => rate(valor, area, 1000)),
        cvliRate: serieDe(cvli[uf], 'cvli', (valor, ano) => rate(valor, populationByYear[uf]?.[ano])),
        ibc: serieDe(ibcByUf[uf], 'ibc_ponderado_pop', (valor) => valor),
        pevsBilhoes: serieDe(pevsByUf[uf], 'valor_mil_rs', (valor) => valor / 1e6),
        piaBilhoes: serieDe(piaByUf[uf], 'valor_transf_ind_mil_rs', (valor) => valor / 1e6),
        pdPctPib: serieDe(pdByUf[uf], 'pct_pib', (valor) => valor)
      },
      ranks: {}
    };
  });

  const scoring = [
    ['prodesRate', 'low', 0.22],
    ['heatRate', 'low', 0.08],
    ['conservationManaged', 'high', 0.10],
    ['poverty', 'low', 0.17],
    ['school', 'high', 0.12],
    ['esfRate', 'high', 0.11],
    ['cvliRate', 'low', 0.12],
    ['vulnerability', 'low', 0.08]
  ];
  const scores = Object.fromEntries(scoring.map(([key, direction]) => [key, minMaxScore(states.map((state) => state[key]), direction)]));
  states.forEach((state, index) => {
    state.score = Math.round(weightedAverage(scoring.map(([key, _direction, weight]) => ({ value: scores[key][index], weight }))));
    state.dimensions = {
      territorio: Math.round(weightedAverage([{ value: scores.prodesRate[index], weight: .55 }, { value: scores.heatRate[index], weight: .2 }, { value: scores.conservationManaged[index], weight: .25 }])),
      pessoas: Math.round(weightedAverage([{ value: scores.poverty[index], weight: .42 }, { value: scores.school[index], weight: .3 }, { value: scores.esfRate[index], weight: .28 }])),
      seguranca: Math.round(scores.cvliRate[index]),
      resiliencia: Math.round(scores.vulnerability[index])
    };
  });
  rankStates(states, 'score');
  rankStates(states, 'prodesRate', 'low');
  rankStates(states, 'heatRate', 'low');
  rankStates(states, 'conservationManaged');
  rankStates(states, 'poverty', 'low');
  rankStates(states, 'school');
  rankStates(states, 'esfRate');
  rankStates(states, 'cvliRate', 'low');
  rankStates(states, 'vulnerability', 'low');
  rankStates(states, 'ibc');
  rankStates(states, 'perRenovavel');
  rankStates(states, 'isgr');
  rankStates(states, 'pevsBilhoes');
  rankStates(states, 'piaBilhoes');
  rankStates(states, 'pdPctPib');

  const totalPopulation = states.reduce((sum, state) => sum + (state.population || 0), 0);
  const sumByYear = (rows, year, field) => rows
    .filter((row) => Number(row.ano) === year && STATES[row.uf])
    .reduce((sum, row) => sum + (parseNumber(row[field]) || 0), 0);
  const prodesKm2Total = sumByYear(prodesRows, 2025, 'taxa_km2');
  const prodesKm2TotalPrev = sumByYear(prodesRows, 2024, 'taxa_km2');
  const heatTotal = sumByYear(focusRows, 2024, 'focos_sat_ref');
  const cvliTotal = sumByYear(cvliRows, 2025, 'cvli');
  const territoryKm2 = states.reduce((sum, state) => sum + (state.area || 0), 0);
  const municipalities = new Set(vulnerabilityRows.filter((row) => STATES[row.uf]).map((row) => String(row.codigo_ibge || row.nome_municipio))).size;
  const conservationUnits = Object.values(conservationByUf).reduce((sum, item) => sum + item.total, 0);

  const metricYears = Object.fromEntries(Object.keys(ANO_DE_REFERENCIA).map((metrica) => {
    const anos = [...new Set(states.flatMap((estado) => Object.keys(estado.series[metrica] || {}).map(Number)))].sort((a, b) => a - b);
    return [metrica, { anos, referencia: ANO_DE_REFERENCIA[metrica], parciais: ANOS_PARCIAIS[metrica] || [] }];
  }));

  return {
    updatedAt: '30 ago. 2026',
    metricYears,
    states: states.sort((a, b) => a.ranks.score - b.ranks.score),
    summary: {
      population: totalPopulation,
      statesCount: Object.keys(STATES).length,
      territoryKm2,
      municipalities,
      conservationUnits,
      prodesKm2: prodesKm2Total,
      prodesKm2Variation: prodesKm2TotalPrev > 0 ? (prodesKm2Total - prodesKm2TotalPrev) / prodesKm2TotalPrev * 100 : null,
      heatTotal,
      cvliTotal,
      cvliRate: totalPopulation > 0 ? cvliTotal / totalPopulation * 100000 : null,
      averageScore: Math.round(states.reduce((sum, state) => sum + state.score, 0) / states.length),
      lowestDeforestation: [...states].sort((a, b) => a.prodesRate - b.prodesRate)[0]?.uf,
      lowestViolence: [...states].sort((a, b) => a.cvliRate - b.cvliRate)[0]?.uf
    },
    methodology: {
      title: 'Síntese comparativa experimental',
      text: 'A síntese padroniza oito indicadores disponíveis em uma escala relativa de 0 a 100 entre os nove estados. Ela serve para leitura exploratória e não substitui metas oficiais, auditorias ou avaliação de políticas.',
      dimensions: [
        { name: 'Território e clima', weight: '40%', indicators: 'taxa PRODES 2025, focos de calor 2024 e gestão de UCs' },
        { name: 'Pessoas', weight: '40%', indicators: 'pobreza, frequência escolar 15–17 e equipes de atenção primária' },
        { name: 'Segurança', weight: '12%', indicators: 'CVLI por 100 mil habitantes' },
        { name: 'Resiliência', weight: '8%', indicators: 'IIVCM municipal médio' }
      ],
      sources: 'PRODES/INPE, INPE Queimadas, CNUC/MMA, IBGE (SIS, PEVS, PIA-Empresa, Censo 2022/MUNIC), Sinesp/MJ, RAIS/MTE, CNES/DATASUS, ANATEL, ANEEL SIGA, AdaptaBrasil, MCTI e STN. Períodos variam conforme a fonte.'
    }
  };
}

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.md': 'text/markdown; charset=utf-8'
};

function json(res, payload, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function sendStatic(req, res, pathname, origin) {
  const safePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const resolved = normalize(join(publicRoot, safePath));
  if (!resolved.startsWith(publicRoot) || !existsSync(resolved)) return false;
  const file = await stat(resolved);
  if (!file.isFile()) return false;
  const etag = `"${Math.floor(file.mtimeMs)}-${file.size}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304);
    res.end();
    return true;
  }
  if (extname(resolved) === '.html') {
    const html = await readFile(resolved, 'utf8');
    res.writeHead(200, { 'Content-Type': mime['.html'], 'Cache-Control': 'no-cache', ETag: etag });
    res.end(html.replaceAll('{{OG_IMAGE_URL}}', `${origin}/og.png`));
    return true;
  }
  res.writeHead(200, { 'Content-Type': mime[extname(resolved)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag });
  createReadStream(resolved).pipe(res);
  return true;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/dashboard') return json(res, await buildDashboard());
    if (url.pathname === '/api/geo') return json(res, await loadGeo());
    if (url.pathname === '/api/catalogo') return json(res, await loadCatalogo());
    if (url.pathname === '/api/metas') return json(res, buildMetas(await loadCatalogo(), await buildDashboard()));
    if (url.pathname.startsWith('/downloads/')) {
      const fileName = decodeURIComponent(url.pathname.slice('/downloads/'.length));
      if (!DOWNLOADS.has(fileName)) return json(res, { error: 'Arquivo não encontrado.' }, 404);
      const fullPath = DOWNLOADS.get(fileName);
      if (!existsSync(fullPath)) return json(res, { error: 'Arquivo não encontrado.' }, 404);
      res.writeHead(200, {
        'Content-Type': mime[extname(fullPath)] || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=300'
      });
      createReadStream(fullPath).pipe(res);
      return;
    }
    if (url.pathname.startsWith('/flags/')) {
      const fileName = normalize(url.pathname.slice('/flags/'.length));
      const fullPath = join(flagsRoot, fileName);
      if (!fullPath.startsWith(flagsRoot) || !existsSync(fullPath)) return json(res, { error: 'Bandeira não encontrada.' }, 404);
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
      createReadStream(fullPath).pipe(res);
      return;
    }
    const routeAliases = new Map([
      ['/indicadores', '/indicadores.html'],
      ['/indicadores/', '/indicadores.html'],
      ['/metodologia', '/metodologia.html'],
      ['/metodologia/', '/metodologia.html'],
      ['/metas', '/metas.html'],
      ['/metas/', '/metas.html']
    ]);
    const pagePath = routeAliases.get(url.pathname) || url.pathname;
    if (!(await sendStatic(req, res, pagePath, url.origin))) json(res, { error: 'Página não encontrada.' }, 404);
  } catch (error) {
    console.error(error);
    json(res, { error: 'Não foi possível carregar os dados do painel.' }, 500);
  }
});

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  if (process.argv.includes('--validate')) {
    buildDashboard().then((data) => {
      console.log(`Dados validados: ${data.states.length} estados e ${data.updatedAt}.`);
    }).catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  } else {
    server.listen(port, () => console.log(`Observatório Amazônia 2050 em http://localhost:${port}`));
  }
}
