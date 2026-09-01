import { aoEntrarNaPagina, bindMenu, escape, flagImage, readResponse, sinalDaPagina } from './shared.js';
import { centroidOf, mapPath, projecaoPara } from './mapa.js';

const state = { data: null, geo: null, catalogo: null, metric: 'prodesRate', ano: null, selected: null, panelView: 'state' };

const metrics = {
  prodesRate: { label: 'Desmatamento PRODES', subtitle: 'menor taxa = melhor posição', description: 'Área desmatada detectada pelo PRODES, ajustada para cada mil km² do território estadual.', source: 'PRODES/INPE', serie: 'prodesRate', field: 'prodesRate', direction: 'low', formatter: (value) => `${number(value, 2)} km² / mil km²` },
  poverty: { label: 'Pobreza', subtitle: 'menor percentual = melhor posição', description: 'Percentual da população abaixo da linha monetária de pobreza usada na base consolidada.', source: 'IBGE/SIS · referência 2024', field: 'poverty', direction: 'low', formatter: (value) => percent(value, 1) },
  school: { label: 'Frequência escolar 15–17', subtitle: 'maior percentual = melhor posição', description: 'Parcela das pessoas de 15 a 17 anos que frequentam a escola em cada estado.', source: 'IBGE/SIS · referência 2024', field: 'school', direction: 'high', formatter: (value) => percent(value, 1) },
  cvliRate: { label: 'Segurança (CVLI)', subtitle: 'menor taxa = melhor posição', description: 'Crimes violentos letais intencionais registrados para cada 100 mil habitantes.', source: 'Sinesp/MJ', serie: 'cvliRate', field: 'cvliRate', direction: 'low', formatter: (value) => `${number(value, 1)} / 100 mil` },
  esfRate: { label: 'Atenção primária', subtitle: 'mais equipes = melhor posição', description: 'Equipes de Saúde da Família e de Atenção Primária para cada 100 mil habitantes.', source: 'CNES/DATASUS · jul. 2026', field: 'esfRate', direction: 'high', formatter: (value) => `${number(value, 1)} / 100 mil` },
  vulnerability: { label: 'Vulnerabilidade climática', subtitle: 'menor índice = melhor posição', description: 'Média estadual do índice municipal de vulnerabilidade às mudanças climáticas.', source: 'AdaptaBrasil · linha de base 2025', field: 'vulnerability', direction: 'low', formatter: (value) => number(value, 1) },
  conservationManaged: { label: 'Gestão de unidades de conservação', subtitle: 'maior percentual = melhor posição', description: 'Percentual de unidades estaduais com plano de manejo e conselho gestor registrados.', source: 'CNUC/MMA · referência 2026', field: 'conservationManaged', direction: 'high', formatter: (value) => percent(value, 0) },
  ibc: { label: 'Conectividade digital (IBC-AMZ)', subtitle: 'maior índice = melhor posição', description: 'Índice de Conectividade da Amazônia Legal ponderado pela população municipal.', source: 'ANATEL', serie: 'ibc', field: 'ibc', direction: 'high', formatter: (value) => `${number(value, 1)} pts` },
  perRenovavel: { label: 'Renovabilidade da matriz elétrica', subtitle: 'maior percentual = melhor posição', description: 'Participação de fontes renováveis na potência de geração fiscalizada em operação.', source: 'ANEEL/SIGA · base ago. 2026', field: 'perRenovavel', direction: 'high', formatter: (value) => percent(value, 1) },
  isgr: { label: 'Saneamento e gestão de riscos', subtitle: 'maior percentual = melhor posição', description: 'Proxy do ISGR com água e esgoto adequados (Censo 2022) e fatores climáticos e de governança (MUNIC 2024).', source: 'IBGE · Censo 2022 + MUNIC 2024', field: 'isgr', direction: 'high', formatter: (value) => percent(value, 1) },
  pevsBilhoes: { label: 'Produção da sociobioeconomia', subtitle: 'maior valor = melhor posição', description: 'Valor da produção da extração vegetal (PEVS), proxy da sociobioeconomia da Estratégia 2050.', source: 'IBGE/PEVS', serie: 'pevsBilhoes', field: 'pevsBilhoes', direction: 'high', formatter: (value) => `R$ ${number(value, 2)} bi` },
  piaBilhoes: { label: 'Transformação industrial', subtitle: 'maior valor = melhor posição', description: 'Valor da transformação industrial das empresas com 5 ou mais pessoas ocupadas.', source: 'IBGE/PIA-Empresa', serie: 'piaBilhoes', field: 'piaBilhoes', direction: 'high', formatter: (value) => `R$ ${number(value, 2)} bi` },
  pdPctPib: { label: 'P&D estadual (% do PIB)', subtitle: 'maior percentual = melhor posição', description: 'Dispêndio dos governos estaduais em pesquisa e desenvolvimento como parcela do PIB, no último ano disponível de cada estado (2022–2023).', source: 'MCTI + IBGE/SIDRA', serie: 'pdPctPib', field: 'pdPctPib', direction: 'high', formatter: (value) => percent(value, 2) },
  territorio: { label: 'Dimensão · Território e clima', subtitle: 'maior pontuação = melhor posição', description: 'Síntese relativa de desmatamento, focos de calor e gestão de unidades de conservação.', source: 'Cálculo experimental do painel', field: 'dimensions.territorio', direction: 'high', formatter: (value) => `${value} pts` },
  pessoas: { label: 'Dimensão · Pessoas', subtitle: 'maior pontuação = melhor posição', description: 'Síntese relativa de pobreza, frequência escolar e cobertura da atenção primária.', source: 'Cálculo experimental do painel', field: 'dimensions.pessoas', direction: 'high', formatter: (value) => `${value} pts` },
  score: { label: 'Síntese geral', subtitle: 'maior pontuação = melhor posição', description: 'Combinação experimental dos oito indicadores disponíveis em uma escala relativa de 0 a 100.', source: 'Cálculo experimental do painel', field: 'score', direction: 'high', formatter: (value) => `${value} pts` }
};

const STATE_ORDER = ['AC', 'AP', 'AM', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO'];
const accentByUf = { TO: '#e0a83c', AP: '#3e6fa8', AM: '#3e6e57', RO: '#8a8078', RR: '#157f72', MT: '#c0451f', AC: '#157f72', PA: '#4a2a6a', MA: '#a8613a' };
function accentOf(uf) { return accentByUf[uf] || '#00766d'; }

const stateDetails = [
  ['prodesRate', 'PRODES 2025', 'km² / mil km²', 'low', 2],
  ['heatRate', 'Focos de calor 2024', 'focos / mil km²', 'low', 2],
  ['conservationManaged', 'UCs com plano e conselho', '%', 'high', 1],
  ['poverty', 'Pobreza monetária', '%', 'low', 1],
  ['school', 'Frequência escolar 15–17', '%', 'high', 1],
  ['esfRate', 'Equipes de atenção primária', '/ 100 mil hab.', 'high', 1],
  ['cvliRate', 'CVLI 2025', '/ 100 mil hab.', 'low', 1],
  ['vulnerability', 'IIVCM municipal médio', 'índice', 'low', 1],
  ['ibc', 'IBC-AMZ ponderado 2025', 'índice', 'high', 1],
  ['perRenovavel', 'Renovabilidade da matriz elétrica', '%', 'high', 1],
  ['isgr', 'Saneamento e gestão de riscos', '%', 'high', 1],
  ['pevsBilhoes', 'Sociobioeconomia (PEVS 2024)', 'R$ bi', 'high', 2],
  ['piaBilhoes', 'Transformação industrial (PIA 2024)', 'R$ bi', 'high', 2],
  ['pdPctPib', 'P&D estadual (% do PIB)', '% do PIB', 'high', 2]
];

const PROFILE_DIMENSIONS = [
  ['territorio', 'Território'], ['pessoas', 'Pessoas'], ['seguranca', 'Segurança'], ['resiliencia', 'Resiliência']
];

function relativePosition(item, key, direction) {
  const value = item[key];
  if (!Number.isFinite(value)) return null;
  const values = state.data.states.map((candidate) => candidate[key]).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 0.5;
  const position = (value - min) / (max - min);
  return direction === 'high' ? position : 1 - position;
}

function valueAt(object, path) { return path.split('.').reduce((value, part) => value?.[part], object); }
function number(value, digits = 0) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value); }
function percent(value, digits = 0) { return `${number(value, digits)}%`; }
function compactPopulation(value) { return `${new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} pessoas`; }
function compactNumber(value) { return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
async function init() {
  const [dashboard, geo, catalogo] = await Promise.all([
    fetch('/data/dashboard.json').then(readResponse),
    fetch('/data/geo.json').then(readResponse),
    fetch('/data/catalogo.json').then(readResponse)
  ]);
  state.data = dashboard;
  state.geo = geo;
  state.catalogo = catalogo;
  state.selected = dashboard.states[0]?.uf;
  ajustaAno();
  populateSelect();
  document.querySelectorAll('[data-updated]').forEach((element) => { element.textContent = dashboard.updatedAt; });
  document.querySelector('[data-population]').textContent = compactPopulation(dashboard.summary.population);
  const regional = dashboard.summary;
  document.querySelector('[data-territorio]').textContent = `${compactNumber(regional.territoryKm2)} km²`;
  document.querySelector('[data-municipios]').textContent = number(regional.municipalities);
  document.querySelector('[data-ucs]').textContent = number(regional.conservationUnits);
  renderAll();
  bindEvents();
  syncSidebarHeight();
}

// O card lateral tem altura do próprio conteúdo, mas nunca ultrapassa a coluna
// da esquerda (mapa + KPIs). O CSS não consegue medir um irmão do grid, então a
// altura da coluna primária vira a variável --sidebar-max.
function syncSidebarHeight() {
  const primary = document.querySelector('.dashboard-primary');
  const grid = document.querySelector('.dashboard-grid');
  if (!primary || !grid || typeof ResizeObserver === 'undefined') return;
  const apply = () => grid.style.setProperty('--sidebar-max', `${Math.round(primary.getBoundingClientRect().height)}px`);
  new ResizeObserver(apply).observe(primary);
  apply();
}

function createDropdown(container, options, initialValue, onChange) {
  container.innerHTML = `<div class="dropdown">
    <button type="button" class="dropdown-trigger" aria-haspopup="listbox" aria-expanded="false">
      <span class="dropdown-trigger-copy"><strong data-trigger-label></strong><small data-trigger-meta></small></span>
      <i class="dropdown-chevron" aria-hidden="true"></i>
    </button>
    <ul class="dropdown-menu" role="listbox" hidden></ul>
  </div>`;
  const root = container.querySelector('.dropdown');
  const trigger = root.querySelector('.dropdown-trigger');
  const label = root.querySelector('[data-trigger-label]');
  const meta = root.querySelector('[data-trigger-meta]');
  const menu = root.querySelector('.dropdown-menu');
  let value = initialValue;

  function paint() {
    const current = options.find((option) => option.value === value);
    label.textContent = current ? current.label : '';
    meta.textContent = current ? current.groupLabel : '';
    let group = '';
    menu.innerHTML = options.map((option) => {
      const heading = option.group !== group ? `<li class="dropdown-group" role="presentation">${escape(option.groupLabel)}</li>` : '';
      group = option.group;
      return `${heading}<li class="dropdown-option ${option.value === value ? 'is-selected' : ''}" tabindex="-1" role="option" aria-selected="${option.value === value}" data-value="${option.value}">
        <span><strong>${escape(option.label)}</strong>${option.sublabel ? `<small>${escape(option.sublabel)}</small>` : ''}</span>
        <i aria-hidden="true">${option.value === value ? '✓' : ''}</i>
      </li>`;
    }).join('');
  }

  function focusOption(direction = 'selected') {
    const entries = [...menu.querySelectorAll('.dropdown-option')];
    const target = direction === 'first' ? entries[0] : direction === 'last' ? entries.at(-1) : menu.querySelector('.is-selected') || entries[0];
    target?.focus();
    target?.scrollIntoView({ block: 'nearest' });
  }
  function open(direction = 'selected') {
    root.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    menu.hidden = false;
    requestAnimationFrame(() => focusOption(direction));
  }
  function close() { root.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false'); menu.hidden = true; }

  trigger.addEventListener('click', () => { root.classList.contains('is-open') ? close() : open(); });
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  });
  menu.addEventListener('click', (event) => {
    const option = event.target.closest('.dropdown-option');
    if (!option) return;
    value = option.dataset.value;
    paint();
    close();
    onChange(value);
  });
  menu.addEventListener('keydown', (event) => {
    const entries = [...menu.querySelectorAll('.dropdown-option')];
    const index = entries.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      entries[(index + offset + entries.length) % entries.length]?.focus();
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      entries[event.key === 'Home' ? 0 : entries.length - 1]?.focus();
    }
    if ((event.key === 'Enter' || event.key === ' ') && document.activeElement?.matches('.dropdown-option')) {
      event.preventDefault();
      document.activeElement.click();
      trigger.focus();
    }
    if (event.key === 'Escape') { close(); trigger.focus(); }
  });
  document.addEventListener('click', (event) => { if (!root.contains(event.target)) close(); }, { signal: sinalDaPagina() });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && root.classList.contains('is-open')) { close(); trigger.focus(); } }, { signal: sinalDaPagina() });

  paint();
  return { setValue(next) { value = next; paint(); } };
}

let metricDropdown = null;

function populateSelect() {
  const experimental = new Set(['territorio', 'pessoas', 'score']);
  const options = Object.entries(metrics).map(([key, metric]) => ({
    value: key,
    label: metric.label,
    sublabel: metric.subtitle,
    group: experimental.has(key) ? 'sinteses' : 'indicadores',
    groupLabel: experimental.has(key) ? 'Sínteses experimentais' : 'Indicadores oficiais'
  }));
  metricDropdown = createDropdown(document.querySelector('#metric-select'), options, state.metric, (value) => { state.metric = value; ajustaAno(); renderAll(); });
}

function currentMetric() { return metrics[state.metric]; }

// Indicadores com série leem o ano selecionado; os demais, o campo plano.
// Devolve null quando o estado não tem dado naquele ano — o P&D de 2021 e 2023,
// por exemplo, não cobre o Acre.
function valorDoIndicador(item, metric) {
  if (!metric.serie) return valueAt(item, metric.field);
  const serie = item.series?.[metric.serie];
  const valor = serie?.[state.ano ?? anosDaMetrica(metric).referencia];
  return Number.isFinite(valor) ? valor : null;
}

function textoDoValor(metric, valor) {
  return valor === null || valor === undefined ? '—' : metric.formatter(valor);
}

function anosDaMetrica(metric) {
  return state.data?.metricYears?.[metric.serie] || { anos: [], referencia: null, parciais: [] };
}

// Ao trocar de indicador o ano corrente pode não existir na nova série.
function ajustaAno() {
  const metric = currentMetric();
  if (!metric.serie) { state.ano = null; return; }
  const { anos, referencia } = anosDaMetrica(metric);
  if (!anos.includes(state.ano)) state.ano = anos.includes(referencia) ? referencia : anos.at(-1) ?? null;
}
function statesByMetric() {
  const metric = currentMetric();
  return [...state.data.states].sort((a, b) => {
    const first = valorDoIndicador(a, metric);
    const second = valorDoIndicador(b, metric);
    if (first === null || second === null) return (first === null ? 1 : 0) - (second === null ? 1 : 0);
    return metric.direction === 'high' ? second - first : first - second;
  });
}

const PANEL_VIEWS = ['state', 'ranking', 'profile'];

function renderAll() {
  renderYearSelect();
  renderIndicatorCard();
  renderMap();
  renderStatePanel();
  renderProfile();
  renderPanelView();
  renderRanking();
}

function renderYearSelect() {
  const metric = currentMetric();
  const { anos, parciais } = anosDaMetrica(metric);
  const temSerie = Boolean(metric.serie) && anos.length > 1;
  const wrap = document.querySelector('#year-select-wrap');
  wrap.hidden = !temSerie;
  if (!temSerie) return;
  document.querySelector('#year-select').innerHTML = [...anos].reverse()
    .map((ano) => `<option value="${ano}"${ano === state.ano ? ' selected' : ''}>${ano}${parciais.includes(ano) ? ' · parcial' : ''}</option>`)
    .join('');
}

function renderIndicatorCard() {
  const metric = currentMetric();
  const { parciais } = anosDaMetrica(metric);
  const parcial = parciais.includes(state.ano);
  const fonte = metric.serie && state.ano ? `${metric.source} · ${state.ano}` : metric.source;

  document.querySelector('#map-indicator-card').innerHTML = `
    <h3>${escape(metric.label)}</h3>
    <p class="map-indicator-description">${escape(metric.description)}</p>
    <dl>
      <div><dt>Leitura</dt><dd>${escape(metric.subtitle)}</dd></div>
      <div><dt>Fonte</dt><dd>${escape(fonte)}</dd></div>
    </dl>
    ${parcial ? '<p class="map-year-warning">Ano em curso: a série ainda não fechou, então o valor não é comparável aos anos anteriores.</p>' : ''}
    <a href="/metodologia#calculo">Entenda o cálculo <span aria-hidden="true">↗</span></a>`;
}

function renderPanelView() {
  const sections = { state: 'state-panel', ranking: 'ranking', profile: 'state-profile' };
  PANEL_VIEWS.forEach((view) => {
    const section = document.querySelector(`#${sections[view]}`);
    if (section) section.hidden = state.panelView !== view;
  });
  document.querySelectorAll('[data-panel-view]').forEach((button) => {
    const isActive = button.dataset.panelView === state.panelView;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });
}

function selectPanelView(view) {
  if (!PANEL_VIEWS.includes(view)) return;
  state.panelView = view;
  renderPanelView();
  if (view === 'ranking') renderRanking();
  if (view === 'profile') renderProfile();
}

function renderRanking() {
  const metric = currentMetric();
  const ordered = statesByMetric();
  const values = ordered.map((item) => valorDoIndicador(item, metric)).filter((value) => value !== null);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const list = document.querySelector('#ranking-list');
  const previousMarker = list.querySelector('.rank-selection-marker');
  const previousTop = Number(previousMarker?.dataset.top);
  const previousHeight = Number(previousMarker?.dataset.height);
  document.querySelector('[data-ranking-title]').textContent = metric.label;
  document.querySelector('[data-ranking-subtitle]').textContent = metric.subtitle;
  list.innerHTML = ordered.map((item, index) => {
    const value = valorDoIndicador(item, metric);
    const positive = value === null ? 0 : (metric.direction === 'high' ? (value - min) / (max - min || 1) : (max - value) / (max - min || 1));
    return `<li>
      <button type="button" class="rank-item ${state.selected === item.uf ? 'is-selected' : ''}" data-state="${item.uf}" aria-pressed="${state.selected === item.uf}" style="--accent:${accentOf(item.uf)}">
        <span class="rank-number">${index + 1}</span>
        ${flagImage(item, '')}
        <span class="rank-name"><b>${escape(item.name)}</b><small>${item.uf} · ${escape(item.capital)}</small></span>
        <span class="rank-measure"><b>${textoDoValor(metric, value)}</b><i><em style="width:${value === null ? 0 : (Math.min(9, Math.max(1, Math.ceil(positive * 9))) / 9) * 100}%"></em></i></span>
      </button>
    </li>`;
  }).join('') + '<li class="rank-selection-marker" role="presentation" aria-hidden="true"></li>';

  const selectedRow = list.querySelector('.rank-item.is-selected')?.closest('li');
  const marker = list.querySelector('.rank-selection-marker');
  if (!selectedRow || !marker) return;
  const nextTop = selectedRow.offsetTop;
  const nextHeight = selectedRow.offsetHeight;
  marker.style.transform = `translateY(${Number.isFinite(previousTop) ? previousTop : nextTop}px)`;
  marker.style.height = `${Number.isFinite(previousHeight) ? previousHeight : nextHeight}px`;
  marker.getBoundingClientRect();
  marker.classList.add('is-animated');
  marker.style.transform = `translateY(${nextTop}px)`;
  marker.style.height = `${nextHeight}px`;
  marker.dataset.top = String(nextTop);
  marker.dataset.height = String(nextHeight);
}

function performance(uf) {
  const metric = currentMetric();
  const values = state.data.states.map((item) => valorDoIndicador(item, metric)).filter((value) => value !== null);
  const value = valorDoIndicador(state.data.states.find((item) => item.uf === uf), metric);
  if (value === null || !values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const position = (value - min) / (max - min || 1);
  return metric.direction === 'high' ? position : 1 - position;
}

function colorAt(t) {
  const start = [237, 230, 220];
  const end = [28, 68, 55];
  const factor = Math.max(0, Math.min(1, t));
  return `rgb(${start.map((item, index) => Math.round(item + (end[index] - item) * factor)).join(',')})`;
}

function renderMap() {
  const svg = document.querySelector('#map');
  const width = 720; const height = 500;
  const project = projecaoPara(state.geo.features, { width, height });
  const groups = state.geo.features.map((feature) => {
    const uf = feature.properties.uf;
    const item = state.data.states.find((candidate) => candidate.uf === uf);
    const selected = state.selected === uf;
    const [x, y] = project(centroidOf(feature.geometry));
    const distance = Math.hypot(x - width / 2, y - height / 2) || 1;
    const jump = 7;
    const jumpX = ((x - width / 2) / distance * jump).toFixed(2);
    const jumpY = ((y - height / 2) / distance * jump).toFixed(2);
    const desempenho = performance(uf);
    const preenchimento = desempenho === null ? 'var(--linha-2)' : colorAt(desempenho);
    const leitura = textoDoValor(currentMetric(), valorDoIndicador(item, currentMetric()));
    const labelColor = desempenho !== null && desempenho > 0.48 ? '#f5f0e8' : '#0e2b22';
    return `<g class="state-group ${selected ? 'is-selected' : ''}" style="--jump-x:${jumpX}px;--jump-y:${jumpY}px">
      <path tabindex="0" role="button" aria-pressed="${selected}" aria-label="${escape(item.name)}: ${leitura}. Selecionar estado." data-state="${uf}" class="state-shape ${selected ? 'is-selected' : ''}" style="fill:${preenchimento}" d="${mapPath(feature.geometry, project)}"></path>
      <text class="state-label" x="${x}" y="${y}" fill="${labelColor}">${uf}</text>
    </g>`;
  }).join('');
  svg.innerHTML = `<title>Mapa comparativo da Amazônia Legal para ${escape(currentMetric().label)}</title>${groups}`;
}

function positionMapTooltip(clientX, clientY) {
  const canvas = document.querySelector('.map-canvas');
  const tooltip = document.querySelector('#map-tooltip');
  const bounds = canvas.getBoundingClientRect();
  const margin = 8;
  let left = clientX - bounds.left + 14;
  let top = clientY - bounds.top - tooltip.offsetHeight - 14;
  if (top < margin) top = clientY - bounds.top + 16;
  left = Math.max(margin, Math.min(left, bounds.width - tooltip.offsetWidth - margin));
  top = Math.max(margin, Math.min(top, bounds.height - tooltip.offsetHeight - margin));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function showMapTooltip(uf, clientX, clientY) {
  const item = state.data.states.find((candidate) => candidate.uf === uf);
  if (!item) return;
  const metric = currentMetric();
  const value = valorDoIndicador(item, metric);
  const tooltip = document.querySelector('#map-tooltip');
  tooltip.innerHTML = `<strong>${escape(item.name)}</strong><span>${escape(metric.label)}${state.ano ? ' · ' + state.ano : ''}</span><b>${textoDoValor(metric, value)}</b>`;
  tooltip.hidden = false;
  positionMapTooltip(clientX, clientY);
}

function hideMapTooltip() {
  const tooltip = document.querySelector('#map-tooltip');
  if (tooltip) tooltip.hidden = true;
}

function radarChart(item) {
  const axes = [['Território', item.dimensions.territorio], ['Pessoas', item.dimensions.pessoas], ['Segurança', item.dimensions.seguranca], ['Resiliência', item.dimensions.resiliencia]];
  const avg = ['territorio', 'pessoas', 'seguranca', 'resiliencia'].map((key) => state.data.states.reduce((sum, candidate) => sum + candidate.dimensions[key], 0) / state.data.states.length);
  const size = 220; const center = size / 2; const radius = 78;
  const pointFor = (index, value) => {
    const angle = (-90 + index * (360 / axes.length)) * Math.PI / 180;
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };
  const polygon = (values) => values.map((value, index) => pointFor(index, value).join(',')).join(' ');
  const grid = [25, 50, 75, 100].map((tick) => `<polygon points="${axes.map((_, index) => pointFor(index, tick).join(',')).join(' ')}" class="radar-grid" />`).join('');
  const spokes = axes.map((_, index) => { const [x, y] = pointFor(index, 100); return `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" class="radar-spoke" />`; }).join('');
  const labels = axes.map(([label], index) => { const [x, y] = pointFor(index, 124); return `<text x="${x}" y="${y}" class="radar-label" text-anchor="middle">${label}</text>`; }).join('');
  return `<svg viewBox="0 0 ${size} ${size}" class="radar-chart" role="img" aria-label="Perfil de ${escape(item.name)} comparado à média da Amazônia Legal">
    ${grid}${spokes}
    <polygon points="${polygon(avg)}" class="radar-avg" />
    <polygon points="${polygon(axes.map(([, value]) => value))}" class="radar-state" style="--accent:${accentOf(item.uf)}" />
    ${labels}
  </svg>`;
}

function selectState(uf) {
  if (!state.data.states.some((item) => item.uf === uf)) return;
  hideMapTooltip();
  state.selected = uf;
  renderAll();
}

function renderStatePanel() {
  const item = state.data.states.find((candidate) => candidate.uf === state.selected);
  if (!item) return;
  const metric = currentMetric();
  const metricValue = valorDoIndicador(item, metric);
  const metricRank = statesByMetric().findIndex((candidate) => candidate.uf === item.uf) + 1;
  const dimensions = [
    ['Território e clima', item.dimensions.territorio],
    ['Pessoas', item.dimensions.pessoas],
    ['Segurança', item.dimensions.seguranca],
    ['Resiliência', item.dimensions.resiliencia]
  ];
  const strongestDimension = [...dimensions].sort((a, b) => b[1] - a[1])[0];
  document.querySelector('#state-panel').innerHTML = `
    <div class="state-panel-body">
      <div class="state-panel-kicker">
        <p class="eyebrow">Detalhamento do estado</p>
        <span>${metricRank}º de 9 · ciclo 2025–2026</span>
      </div>
      <div class="state-identity">
        ${flagImage(item, `Bandeira do ${item.name}`)}
        <div><h2>${escape(item.name)}</h2><p>Capital ${escape(item.capital)}</p></div>
      </div>

      <div class="state-summary-grid" aria-label="Resumo do estado">
        <div><span>População</span><b>${compactNumber(item.population)}</b><small>estimativa 2025</small></div>
        <div><span>Área territorial</span><b>${compactNumber(item.area)} km²</b><small>base cartográfica</small></div>
        <div><span>UCs estaduais</span><b>${item.conservationUnits}</b><small>unidades cadastradas</small></div>
      </div>

      <section class="state-metric-block" aria-label="Indicador selecionado">
        <div><span>Indicador exibido</span><small>${metricRank}º entre os nove estados</small></div>
        <strong>${textoDoValor(metric, metricValue)}</strong>
        <p>${escape(metric.label)} · ${escape(metric.subtitle)}</p>
      </section>

      <section class="state-dimensions" aria-label="Síntese por dimensão">
        <div class="state-section-title"><span>Síntese por dimensão</span><small>escala relativa 0–100</small></div>
        ${dimensions.map(([label, value]) => `<div class="state-dimension-row">
          <span>${label}</span><i aria-hidden="true"><b style="width:${value}%"></b></i><strong>${value}</strong>
        </div>`).join('')}
      </section>

      <div class="state-reading">
        <p><strong>${escape(item.name)}</strong> está na ${metricRank}ª posição para o indicador exibido. Seu maior resultado relativo na síntese é <strong>${strongestDimension[0]}</strong>, com ${strongestDimension[1]} pontos.</p>
      </div>

      <button type="button" class="state-panel-button" data-panel-view="profile">Ver perfil completo</button>
    </div>`;
}

function renderProfile() {
  const item = state.data.states.find((candidate) => candidate.uf === state.selected);
  const container = document.querySelector('#state-profile');
  if (!item || !container) return;
  const rows = stateDetails.map(([key, label, unit, direction, digits]) => {
    const value = item[key];
    const position = relativePosition(item, key, direction);
    return `<div class="profile-row">
      <div class="profile-row-head">
        <div class="profile-row-label"><span>${label}</span><small>${direction === 'low' ? '↓ menor é melhor' : '↑ maior é melhor'}</small></div>
        <div class="profile-row-value"><b>${number(value, digits)}</b><small>${unit}</small><i title="posição entre os nove estados">${item.ranks[key] ?? '—'}º</i></div>
      </div>
      <div class="profile-row-bar" aria-hidden="true"><b style="width:${Math.max(4, Math.round((position ?? 0) * 100))}%"></b></div>
    </div>`;
  }).join('');
  container.innerHTML = `
    <header class="profile-head">
      ${flagImage(item, `Bandeira do ${item.name}`)}
      <div class="profile-head-copy"><p class="eyebrow">${item.uf} · ${escape(item.capital)}</p><h3>${escape(item.name)}</h3></div>
      <div class="profile-head-score"><b>${item.score}</b><span>${item.ranks.score}º de 9 · síntese</span></div>
    </header>
    <div class="profile-overview">
      <div class="profile-radar" style="--accent:${accentOf(item.uf)}">${radarChart(item)}<span class="radar-legend"><i class="is-state"></i>${escape(item.name)}<i class="is-avg"></i>Média AL</span></div>
      <div class="profile-dimensions" aria-label="Pontuação por dimensão">
        ${PROFILE_DIMENSIONS.map(([key, label]) => `<div class="profile-dim"><span>${label}</span><i aria-hidden="true"><b style="width:${item.dimensions[key]}%"></b></i><strong>${item.dimensions[key]}</strong></div>`).join('')}
      </div>
    </div>
    <div class="profile-list">
      <p class="profile-list-title">Indicadores do estado<small>posição relativa entre os nove</small></p>
      ${rows}
    </div>
    <p class="profile-note">Valores, unidades e períodos variam por fonte — o valor original continua sendo a referência principal, disponível no catálogo de indicadores.</p>`;
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const panelViewButton = event.target.closest('[data-panel-view]');
    if (panelViewButton) selectPanelView(panelViewButton.dataset.panelView);
    const stateButton = event.target.closest('[data-state]');
    if (stateButton) {
      if (!stateButton.closest('#ranking-list')) state.panelView = 'state';
      selectState(stateButton.dataset.state);
    }
    const metricButton = event.target.closest('[data-metric]');
    if (metricButton) { state.metric = metricButton.dataset.metric; metricDropdown?.setValue(state.metric); ajustaAno(); renderAll(); document.querySelector('#ranking').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }, { signal: sinalDaPagina() });
  document.addEventListener('change', (event) => {
    if (!event.target.matches('[data-map-year]')) return;
    state.ano = Number(event.target.value);
    renderAll();
  }, { signal: sinalDaPagina() });
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.state-shape')) { event.preventDefault(); state.panelView = 'state'; selectState(event.target.dataset.state); }
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && event.target.matches('[data-panel-view]')) {
      event.preventDefault();
      const offset = event.key === 'ArrowRight' ? 1 : -1;
      const nextView = PANEL_VIEWS[(PANEL_VIEWS.indexOf(event.target.dataset.panelView) + offset + PANEL_VIEWS.length) % PANEL_VIEWS.length];
      selectPanelView(nextView);
      document.querySelector(`[data-panel-view="${nextView}"]`).focus();
    }
  }, { signal: sinalDaPagina() });
  const map = document.querySelector('#map');
  map.addEventListener('pointermove', (event) => {
    const shape = event.target.closest('.state-shape');
    if (shape) showMapTooltip(shape.dataset.state, event.clientX, event.clientY);
    else hideMapTooltip();
  });
  map.addEventListener('pointerleave', hideMapTooltip);
  map.addEventListener('focusin', (event) => {
    if (!event.target.matches('.state-shape')) return;
    const bounds = event.target.getBoundingClientRect();
    showMapTooltip(event.target.dataset.state, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  });
  map.addEventListener('focusout', hideMapTooltip);
  bindMenu();
}

const ANCORA = '#map';

aoEntrarNaPagina(ANCORA, () => init().catch((error) => {
  document.querySelector('#ranking-list').innerHTML = `<li class="load-error">${escape(error.message)} Atualize a página para tentar novamente.</li>`;
}));
