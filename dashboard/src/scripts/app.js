import { aoEntrarNaPagina, BANDEIRA_REGIAO, bindMenu, escape, flagImage, readResponse, sinalDaPagina } from './shared.js';
import { centroidOf, mapPath, projecaoPara } from './mapa.js';

const state = { data: null, geo: null, catalogo: null, metric: 'prodesRate', ano: null, selected: null, panelView: 'state', spark: null, sparkRef: null };

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
  pdPctPib: { label: 'P&D estadual (% do PIB)', subtitle: 'maior percentual = melhor posição', description: 'Dispêndio dos governos estaduais em pesquisa e desenvolvimento como parcela do PIB, no último ano disponível de cada estado (2022–2023).', source: 'MCTI + IBGE/SIDRA', serie: 'pdPctPib', field: 'pdPctPib', direction: 'high', formatter: (value) => percent(value, 2) }
};

const STATE_ORDER = ['AC', 'AP', 'AM', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO'];
const accentByUf = { TO: '#e0a83c', AP: '#3e6fa8', AM: '#3e6e57', RO: '#8a8078', RR: '#157f72', MT: '#c0451f', AC: '#157f72', PA: '#4a2a6a', MA: '#a8613a' };
function accentOf(uf) { return accentByUf[uf] || '#00766d'; }

// ---------------------------------------------------------------------------
// Valor da Amazônia Legal como um todo.
//
// Toda métrica vira uma média ponderada por um peso — e para as taxas isso não é
// uma aproximação, é o total sobre o total. A taxa do PRODES é km²/área×1000, logo
// Σ(taxa×área)/Σárea = 1000×Σkm²/Σárea. O mesmo vale para CVLI e atenção primária
// (peso população) e para a gestão de UCs (peso número de unidades). Conferido
// contra os totais que o build calcula por conta própria a partir dos CSVs: bate
// com summary.cvliRate e summary.prodesKm2 até a sexta casa.
//
// `peso: null` é média simples; `metodo: 'soma'` soma os nove valores. O rótulo
// segue o vocabulário de metas.mjs (ROTULO_AGREGACAO), para que os dois lugares do
// site que produzem número regional descrevam o método da mesma forma.
// ---------------------------------------------------------------------------
const AGREGACAO = {
  prodesRate: { peso: 'area', rotulo: 'área desmatada dos nove estados sobre a área da região' },
  cvliRate: { peso: 'population', rotulo: 'total de CVLI sobre a população regional', notaSerie: 'Nos anos anteriores a ponderação usa a população de 2025, a única que o painel carrega; o ano de referência é exato.' },
  esfRate: { peso: 'population', rotulo: 'total de equipes sobre a população regional' },
  poverty: { peso: 'population', rotulo: 'média ponderada pela população' },
  school: { peso: 'population', rotulo: 'média ponderada pela população', nota: 'Ponderação pela população total de cada estado, e não pela população de 15 a 17 anos, que não está na base consolidada.' },
  isgr: { peso: 'population', rotulo: 'média ponderada pela população' },
  ibc: { peso: 'population', rotulo: 'média ponderada pela população', notaSerie: 'Nos anos anteriores a ponderação usa a população de 2025, a única que o painel carrega; o ano de referência é exato.' },
  conservationManaged: { peso: 'conservationUnits', rotulo: 'unidades com plano e conselho sobre o total de unidades' },
  vulnerability: { peso: null, rotulo: 'média simples dos nove estados', nota: 'Média simples dos nove estados. A leitura correta ponderaria pelo número de municípios de cada estado, que não está na base consolidada.' },
  perRenovavel: { peso: null, rotulo: 'média simples dos nove estados', nota: 'Média simples dos nove estados. A leitura regional correta ponderaria pela potência instalada de cada estado, que não está na base consolidada.' },
  pdPctPib: { peso: null, rotulo: 'média simples dos nove estados', nota: 'Média simples dos nove estados. Ponderar pelo PIB exigiria o PIB do mesmo ano de referência em todos os estados, o que a série não oferece.', notaSerie: 'Em 2021 e 2023 só oito estados têm valor, então a média desses anos não é composta pelos mesmos estados dos demais.' },
  pevsBilhoes: { metodo: 'soma', rotulo: 'soma dos nove estados' },
  piaBilhoes: { metodo: 'soma', rotulo: 'soma dos nove estados' }
  // Todo indicador do seletor tem entrada aqui. A guarda por ausência segue no
  // painel regional: um indicador novo sem método de agregação definido precisa
  // dizer isso na tela, não inventar um número para a região.
};

function agregacaoDe(metricKey) { return AGREGACAO[metricKey] || null; }

// `leitor` devolve o valor de um estado; muda entre o campo plano e um ano da série.
function agregaEstados(agregacao, leitor) {
  const uteis = state.data.states
    .map((item) => ({ valor: leitor(item), peso: agregacao.peso ? item[agregacao.peso] : 1 }))
    .filter(({ valor, peso }) => Number.isFinite(valor) && Number.isFinite(peso));
  if (!uteis.length) return null;
  if (agregacao.metodo === 'soma') return uteis.reduce((total, { valor }) => total + valor, 0);
  const pesoTotal = uteis.reduce((total, { peso }) => total + peso, 0);
  if (!pesoTotal) return null;
  return uteis.reduce((total, { valor, peso }) => total + valor * peso, 0) / pesoTotal;
}

// Valor regional do indicador ativo, no ano ativo quando há série.
function valorRegional(metricKey = state.metric) {
  const agregacao = agregacaoDe(metricKey);
  if (!agregacao) return null;
  const metric = metrics[metricKey];
  return agregaEstados(agregacao, (item) => valorDoIndicador(item, metric));
}

function serieRegional(metricKey = state.metric) {
  const metric = metrics[metricKey];
  const agregacao = agregacaoDe(metricKey);
  if (!agregacao || !metric.serie) return [];
  return anosDaMetrica(metric).anos
    .map((ano) => ({ ano, valor: agregaEstados(agregacao, (item) => item.series?.[metric.serie]?.[ano]) }))
    .filter(({ valor }) => Number.isFinite(valor));
}

// Mantém os anos na mesma ordem do seletor e ignora lacunas do estado. Isso é
// importante para P&D: o Acre, por exemplo, não tem observação em 2021 e 2023.
function serieDoEstado(item, metric = currentMetric()) {
  if (!metric.serie) return [];
  return anosDaMetrica(metric).anos
    .map((ano) => ({ ano, valor: item.series?.[metric.serie]?.[ano] }))
    .filter(({ valor }) => Number.isFinite(valor));
}

// Menor e maior valor entre os nove, para situar o número regional.
function amplitudeEstados(metric) {
  const valores = state.data.states
    .map((item) => ({ uf: item.uf, valor: valorDoIndicador(item, metric) }))
    .filter(({ valor }) => Number.isFinite(valor))
    .sort((a, b) => a.valor - b.valor);
  return valores.length ? { menor: valores[0], maior: valores.at(-1) } : null;
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
  // null = Amazônia Legal. A região é a perspectiva de entrada; o estado é o recorte.
  state.selected = null;
  ajustaAno();
  populateSelect();
  document.querySelectorAll('[data-updated]').forEach((element) => { element.textContent = dashboard.updatedAt; });
  const regional = dashboard.summary;
  document.querySelector('[data-population]').textContent = compactPopulation(regional.population);
  document.querySelector('[data-territorio]').textContent = `${compactNumber(regional.territoryKm2)} km²`;
  document.querySelector('[data-municipios]').textContent = number(regional.municipalities);
  document.querySelector('[data-ucs]').textContent = number(regional.conservationUnits);
  renderAll();
  bindEvents();
}

function createDropdown(container, options, initialValue, onChange, { disabled = false, disabledReason = '' } = {}) {
  container.innerHTML = `<div class="dropdown${disabled ? ' is-disabled' : ''}">
    <button type="button" class="dropdown-trigger" aria-haspopup="listbox" aria-expanded="false"${disabled ? ' disabled aria-disabled="true"' : ''}>
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
  if (disabledReason) trigger.title = disabledReason;

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
    if (disabled) return;
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
  const options = Object.entries(metrics).map(([key, metric]) => ({
    value: key,
    label: metric.label,
    sublabel: metric.subtitle,
    group: 'indicadores',
    groupLabel: 'Indicadores oficiais'
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

const PANEL_VIEWS = ['state', 'ranking'];

function renderAll() {
  renderYearSelect();
  renderIndicatorCard();
  renderMap();
  renderScopeButton();
  renderPainelPrincipal();
  renderPanelView();
  renderRanking();
}

// A perspectiva regional mora no próprio mapa: escolher um estado já é clicar nele,
// então só falta a volta para a região. O botão fica aceso enquanto a leitura é
// regional e serve de rótulo do que está no painel ao lado.
function renderScopeButton() {
  const botao = document.querySelector('#scope-regional');
  if (!botao) return;
  const regional = !state.selected;
  // `is-active` é o que o chip das Metas usa para o estado aceso; o aria-pressed
  // carrega a mesma informação para quem não vê o estilo.
  botao.classList.toggle('is-active', regional);
  botao.setAttribute('aria-pressed', String(regional));
  botao.title = regional ? 'Amazônia Legal — o painel mostra a região como um todo' : 'Amazônia Legal — voltar à leitura da região';
}

let yearDropdown = null;
let anoMontadoPara = null;

// Mesmo componente do seletor de indicador. Ele é remontado só quando a lista de
// anos muda, isto é, quando o indicador muda — recriar a cada render acumularia
// listeners de clique fora no document.
function renderYearSelect() {
  const metric = currentMetric();
  const { anos, parciais } = anosDaMetrica(metric);
  const temSerie = Boolean(metric.serie) && anos.length > 1;

  if (anoMontadoPara !== state.metric) {
    const options = temSerie
      ? [...anos].reverse().map((ano) => ({
          value: String(ano),
          label: String(ano),
          group: parciais.includes(ano) ? 'parcial' : 'fechado',
          groupLabel: parciais.includes(ano) ? 'Ano em curso' : 'Série histórica'
        }))
      : [{ value: '', label: 'Indisponível', group: 'indisponivel', groupLabel: 'Sem série temporal' }];
    // O componente devolve o valor como texto; o resto do painel trabalha com número.
    yearDropdown = createDropdown(
      document.querySelector('#year-select'),
      options,
      temSerie ? String(state.ano) : '',
      (valor) => { state.ano = Number(valor); renderAll(); },
      { disabled: !temSerie, disabledReason: 'Este indicador não possui série temporal.' }
    );
    anoMontadoPara = state.metric;
    return;
  }
  yearDropdown.setValue(temSerie ? String(state.ano) : '');
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
  const sections = { state: 'state-panel', ranking: 'ranking' };
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
  // A largura do medidor é sempre relativa aos nove estados. A região entra como
  // régua e não pode mexer nessa escala, então `min` e `max` continuam vindo só
  // deles — como no minigráfico, uma média ponderada cai dentro desse intervalo.
  const barra = (value) => {
    const positive = value === null ? 0 : (metric.direction === 'high' ? (value - min) / (max - min || 1) : (max - value) / (max - min || 1));
    return value === null ? 0 : (Math.min(9, Math.max(1, Math.ceil(positive * 9))) / 9) * 100;
  };

  // A Amazônia Legal entra na ordenação junto com os estados, na posição que o valor
  // dela ocupa entre eles — é isso que mostra quantos estão acima e quantos abaixo.
  // Fica de fora em 'soma' (PEVS e PIA), onde o total dos nove não é um par dos
  // estados e encostaria o medidor no fim da escala sem significar desempenho.
  const agregacao = agregacaoDe(state.metric);
  const valorAL = agregacao && agregacao.metodo !== 'soma' ? valorRegional(state.metric) : null;
  const entradas = ordered.map((item) => ({ item, value: valorDoIndicador(item, metric) }));
  if (valorAL !== null) {
    const acima = entradas.filter(({ value }) => (
      value !== null && (metric.direction === 'high' ? value > valorAL : value < valorAL)
    )).length;
    entradas.splice(acima, 0, { regiao: true, value: valorAL });
  }

  // A numeração continua sendo a dos estados: a região ocupa o lugar dela na ordem
  // mas não recebe posição, então quem está abaixo dela não pula um número.
  let posicao = 0;
  const linhas = entradas.map(({ item, value, regiao }) => {
    // data-state vazio já é o escopo regional: `selecionaEscopo` normaliza para null.
    const ativo = regiao ? !state.selected : state.selected === item.uf;
    const medida = `<span class="rank-measure"><b>${textoDoValor(metric, value)}</b><i><em style="width:${barra(value)}%"></em></i></span>`;
    return `<li>
      <button type="button" class="rank-item ${regiao ? 'is-regiao ' : ''}${ativo ? 'is-selected' : ''}" data-state="${regiao ? '' : item.uf}" aria-pressed="${ativo}"${regiao ? '' : ` style="--accent:${accentOf(item.uf)}"`}>
        <span class="rank-number"${regiao ? ' aria-hidden="true"' : ''}>${regiao ? '' : ++posicao}</span>
        ${flagImage(regiao ? BANDEIRA_REGIAO : item, '')}
        <span class="rank-name">${regiao
          ? '<b>Amazônia Legal</b><small>Conjunto dos 9 Estados</small>'
          : `<b>${escape(item.name)}</b><small>${item.uf} · ${escape(item.capital)}</small>`}</span>
      ${medida}
      </button>
    </li>`;
  });

  list.innerHTML = linhas.join('') + '<li class="rank-selection-marker" role="presentation" aria-hidden="true"></li>';

  const selectedRow = list.querySelector('.rank-item.is-selected')?.closest('li');
  const marker = list.querySelector('.rank-selection-marker');
  if (!marker) return;
  // Na perspectiva regional quem fica marcado é a linha da própria região. Quando
  // nem ela está na lista — indicadores de 'soma' — não há linha selecionada, e sem
  // isto o marcador ficaria sem altura definida, encostado no topo.
  marker.hidden = !selectedRow;
  if (!selectedRow) return;
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

// `uf` vazia ou nula devolve a perspectiva à Amazônia Legal.
function selecionaEscopo(uf) {
  const alvo = uf || null;
  if (alvo && !state.data.states.some((item) => item.uf === alvo)) return;
  hideMapTooltip();
  state.selected = alvo;
  renderAll();
}

// Minigráfico da série do escopo atual. SVG à mão, como o resto dos gráficos.
// A escala é min–max da própria série: o que se lê é a forma da trajetória, não a
// distância até o zero — por isso o eixo não é rotulado com valores.
const SPARK = { largura: 240, altura: 46, margem: 4 };

// Posição de cada ponto, em unidades do viewBox e em porcentagem. Como o SVG é
// esticado nos dois eixos (preserveAspectRatio="none"), a porcentagem vale
// igualmente para a sobreposição em HTML, que é quem desenha o ponto e a guia do
// hover — um <circle> no SVG viraria elipse.
// União das séries desenhadas juntas. Duas linhas só se comparam se dividirem
// a mesma escala nos dois eixos.
function dominioDaSpark(...series) {
  const pontos = series.flat();
  const valores = pontos.map(({ valor }) => valor);
  const anos = pontos.map(({ ano }) => Number(ano));
  return { min: Math.min(...valores), max: Math.max(...valores), primeiroAno: Math.min(...anos), ultimoAno: Math.max(...anos) };
}

function pontosDaSpark(serie, dominio = dominioDaSpark(serie)) {
  const { largura, altura, margem } = SPARK;
  const { min, max, primeiroAno, ultimoAno } = dominio;
  return serie.map((ponto) => {
    // A posição vem do ano, não do índice. Assim uma lacuna de dois anos
    // ocupa o dobro do espaço de um intervalo anual, mesmo depois de filtrada.
    const x = margem + ((Number(ponto.ano) - primeiroAno) / ((ultimoAno - primeiroAno) || 1)) * (largura - margem * 2);
    const y = max === min ? altura / 2 : altura - margem - ((ponto.valor - min) / (max - min)) * (altura - margem * 2);
    return { ...ponto, x, y, xPct: x / largura * 100, yPct: y / altura * 100 };
  });
}

function sparkline(pontos, { parciais = [], anoAtivo = null, escopo = 'regional', referencia = null, referenciaRotulo = '' } = {}) {
  if (pontos.length < 2) return '';
  const { largura, altura } = SPARK;
  const linha = pontos.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = `${linha}L${pontos.at(-1).x.toFixed(1)},${altura}L${pontos[0].x.toFixed(1)},${altura}Z`;
  // A referência tem guarda própria: a série regional pode ter menos de dois
  // pontos mesmo quando a do estado tem trinta. Nesse caso some a linha, não o gráfico.
  const ref = referencia && referencia.length > 1
    ? `<path class="spark-ref" d="${referencia.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')}" />`
    : '';
  // Traço vertical com non-scaling-stroke: marca o ano sem deformar no esticamento.
  const ativo = pontos.find(({ ano }) => ano === anoAtivo);
  const marcador = ativo
    ? `<line class="spark-marker ${parciais.includes(ativo.ano) ? 'is-parcial' : ''}" x1="${ativo.x.toFixed(1)}" y1="${ativo.y.toFixed(1)}" x2="${ativo.x.toFixed(1)}" y2="${altura}" />`
    : '';
  return `<div class="spark-wrap" tabindex="0" role="group" aria-label="Trajetória ${escape(escopo)} de ${pontos[0].ano} a ${pontos.at(-1).ano}.${ref ? ` Uma segunda linha, tracejada, traz a Amazônia Legal por ${escape(referenciaRotulo)}, na mesma escala.` : ''} Use as setas para mudar o ano exibido.">
    <svg class="spark" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="none" aria-hidden="true">
      <path class="spark-area" d="${area}" />
      ${ref}
      <path class="spark-line" d="${linha}" />
      ${marcador}
    </svg>
    <i class="spark-guia" hidden aria-hidden="true"></i>
    <i class="spark-ponto" hidden aria-hidden="true"></i>
    <div class="spark-tip" hidden role="status"></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Interação do minigráfico. O painel é remontado por innerHTML a cada render, então
// os listeners vivem no #state-panel, que é estático, e leem os pontos de
// `state.spark` — recalculá-los no hover repetiria a agregação a cada pixel.
// ---------------------------------------------------------------------------

function pontoMaisProximo(wrap, clientX) {
  const pontos = state.spark;
  if (!pontos?.length) return null;
  const caixa = wrap.getBoundingClientRect();
  const posicaoPct = (clientX - caixa.left) / (caixa.width || 1) * 100;
  // Não pressupõe espaçamento uniforme: estados podem ter anos sem observação.
  return pontos.reduce((maisProximo, ponto) => (
    Math.abs(ponto.xPct - posicaoPct) < Math.abs(maisProximo.xPct - posicaoPct) ? ponto : maisProximo
  ));
}

function realcaSpark(ponto) {
  const wrap = document.querySelector('.spark-wrap');
  if (!wrap) return;
  const guia = wrap.querySelector('.spark-guia');
  const marca = wrap.querySelector('.spark-ponto');
  const tip = wrap.querySelector('.spark-tip');
  for (const elemento of [guia, marca, tip]) elemento.hidden = !ponto;
  if (!ponto) return;
  const metric = currentMetric();
  const parcial = anosDaMetrica(metric).parciais.includes(ponto.ano);
  guia.style.left = `${ponto.xPct}%`;
  marca.style.left = `${ponto.xPct}%`;
  marca.style.top = `${ponto.yPct}%`;
  marca.classList.toggle('is-parcial', parcial);
  const referencia = state.sparkRef?.find(({ ano }) => ano === ponto.ano);
  tip.innerHTML = `<b>${ponto.ano}${parcial ? ' · em curso' : ''}</b><span>${escape(textoDoValor(metric, ponto.valor))}</span>`
    + (referencia ? `<em>AL ${escape(textoDoValor(metric, referencia.valor))}</em>` : '');
  // A dica acompanha o ponto na horizontal e encosta nas bordas sem transbordar.
  tip.style.left = `${ponto.xPct}%`;
  tip.classList.toggle('is-inicio', ponto.xPct < 22);
  tip.classList.toggle('is-fim', ponto.xPct > 78);
}

function bindSpark() {
  const painel = document.querySelector('#state-panel');
  if (!painel) return;
  const sinal = { signal: sinalDaPagina() };
  painel.addEventListener('pointermove', (event) => {
    const wrap = event.target.closest('.spark-wrap');
    realcaSpark(wrap ? pontoMaisProximo(wrap, event.clientX) : null);
  }, sinal);
  painel.addEventListener('pointerleave', () => realcaSpark(null), sinal);
  painel.addEventListener('click', (event) => {
    const wrap = event.target.closest('.spark-wrap');
    const ponto = wrap && pontoMaisProximo(wrap, event.clientX);
    if (ponto) selecionaAno(ponto.ano);
  }, sinal);
  painel.addEventListener('keydown', (event) => {
    if (!event.target.matches('.spark-wrap') || !state.spark?.length) return;
    const passos = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity };
    const passo = passos[event.key];
    if (passo === undefined) return;
    event.preventDefault();
    const atual = state.spark.findIndex(({ ano }) => ano === state.ano);
    const base = atual < 0 ? state.spark.length - 1 : atual;
    const alvo = Math.max(0, Math.min(state.spark.length - 1, passo === -Infinity ? 0 : passo === Infinity ? state.spark.length - 1 : base + passo));
    selecionaAno(state.spark[alvo].ano);
  }, sinal);
  painel.addEventListener('focusout', (event) => {
    if (event.target.matches('.spark-wrap')) realcaSpark(null);
  }, sinal);
}

// O render recria o gráfico, então o foco precisa voltar para ele — sem isso a
// segunda seta do teclado não teria alvo.
function selecionaAno(ano) {
  if (ano === state.ano) return;
  state.ano = ano;
  const tinhaFoco = document.activeElement?.matches('.spark-wrap');
  renderAll();
  if (tinhaFoco) document.querySelector('.spark-wrap')?.focus();
  realcaSpark(state.spark?.find((ponto) => ponto.ano === ano) || null);
}

function renderPainelPrincipal() {
  if (state.selected) renderPainelEstado();
  else renderPainelRegional();
}

function renderPainelRegional() {
  const metric = currentMetric();
  const agregacao = agregacaoDe(state.metric);
  const resumo = state.data.summary;
  const valor = valorRegional();
  const serie = serieRegional();
  const { parciais } = anosDaMetrica(metric);
  const amplitude = amplitudeEstados(metric);

  // Sem entrada em AGREGACAO o indicador é uma síntese relativa entre os nove
  // estados: a média dela é ~50 por construção. Dizer isso vale mais que um número.
  const bloco = agregacao
    ? `<div><span>Indicador exibido</span><small>${escape(metric.serie && state.ano ? String(state.ano) : 'ano de referência')}</small></div>
       <strong>${textoDoValor(metric, valor)}</strong>
       <p>${escape(metric.label)} · por ${escape(agregacao.rotulo)}</p>`
    : `<div><span>Indicador exibido</span><small>sem valor regional</small></div>
       <strong>Não se aplica</strong>
       <p>${escape(metric.label)} é uma escala relativa entre os nove estados, então a média regional seria sempre próxima de 50 e não descreveria a região.</p>`;

  // Os pontos ficam no estado: o hover e o teclado os leem sem refazer a agregação.
  state.spark = serie.length > 1 ? pontosDaSpark(serie) : null;
  state.sparkRef = null;
  const grafico = state.spark
    ? `<section class="state-spark-block" aria-label="Série histórica regional">
         <div class="state-section-title"><span>Trajetória da região</span><small>${serie[0].ano}–${serie.at(-1).ano}</small></div>
         ${sparkline(state.spark, { parciais, anoAtivo: state.ano, escopo: 'regional' })}
       </section>`
    : '';

  // Sem este aviso o CVLI de 2026 (11,1) parece uma queda pela metade sobre 2025
  // (21,1), quando é só um ano que ainda não fechou. O cartão ao lado do mapa já
  // alerta; aqui o número é maior e precisa do mesmo cuidado.
  const notas = [
    parciais.includes(state.ano) ? 'Ano em curso: a série ainda não fechou, então o valor não é comparável aos anos anteriores.' : null,
    agregacao?.nota,
    serie.length > 1 ? agregacao?.notaSerie : null
  ].filter(Boolean);

  document.querySelector('#state-panel').innerHTML = `
    <div class="state-panel-body">
      <div class="state-panel-kicker">
        <p class="eyebrow">Perspectiva regional</p>
      </div>
      <div class="state-identity is-regional">
        ${flagImage(BANDEIRA_REGIAO, 'Bandeira da Amazônia Legal')}
        <div><h2>Amazônia Legal</h2><p>${escape(resumo.statesCount)} estados · ${number(resumo.municipalities)} municípios</p></div>
      </div>

      <div class="state-summary-grid" aria-label="Resumo da região">
        <div><span>População</span><b>${compactNumber(resumo.population)}</b><small>projeção IBGE 2025</small></div>
        <div><span>Área territorial</span><b>${compactNumber(resumo.territoryKm2)} km²</b><small>base cartográfica</small></div>
        <div><span>UCs cadastradas</span><b>${number(resumo.conservationUnits)}</b><small>federais e estaduais</small></div>
      </div>

      <section class="state-metric-block" aria-label="Indicador selecionado na região">${bloco}</section>
      ${grafico}
      ${amplitude && agregacao ? `<section class="state-amplitude" aria-label="Amplitude entre os estados">
        <div class="state-section-title"><span>Amplitude entre os nove</span></div>
        <p><b>${textoDoValor(metric, amplitude.menor.valor)}</b> ${escape(amplitude.menor.uf)} <i aria-hidden="true">→</i> <b>${textoDoValor(metric, amplitude.maior.valor)}</b> ${escape(amplitude.maior.uf)}</p>
      </section>` : ''}

      <div class="state-reading">
        <p>${agregacao
          ? `A <strong>Amazônia Legal</strong> registra <strong>${textoDoValor(metric, valor)}</strong> em ${escape(metric.label)}${metric.serie && state.ano ? `, em ${state.ano}` : ''}${amplitude ? `, entre ${escape(amplitude.menor.uf)} e ${escape(amplitude.maior.uf)}` : ''}.`
          : 'Escolha um indicador oficial no seletor acima do mapa para ver o valor da Amazônia Legal como um todo.'}</p>
        ${notas.map((nota) => `<p class="state-reading-nota">${escape(nota)}</p>`).join('')}
      </div>
    </div>`;
}

function renderPainelEstado() {
  const item = state.data.states.find((candidate) => candidate.uf === state.selected);
  if (!item) return;
  const metric = currentMetric();
  const metricValue = valorDoIndicador(item, metric);
  const metricRank = statesByMetric().findIndex((candidate) => candidate.uf === item.uf) + 1;
  const serie = serieDoEstado(item, metric);
  const { parciais } = anosDaMetrica(metric);
  const agregacao = agregacaoDe(state.metric);
  // A região entra como linha de comparação, mas só quando o valor regional é uma
  // média: em 'soma' (PEVS e PIA) o total dos nove é uma ordem de grandeza acima do
  // estado e achataria a linha dele contra o eixo, comparando coisas diferentes.
  const serieRef = agregacao && agregacao.metodo !== 'soma' ? serieRegional(state.metric) : [];
  const dominio = dominioDaSpark(serie, serieRef.length > 1 ? serieRef : []);
  state.spark = serie.length > 1 ? pontosDaSpark(serie, dominio) : null;
  state.sparkRef = state.spark && serieRef.length > 1 ? pontosDaSpark(serieRef, dominio) : null;
  const grafico = state.spark
    ? `<section class="state-spark-block" aria-label="Série histórica de ${escape(item.name)}">
         <div class="state-section-title"><span>Trajetória do estado</span><small>${serie[0].ano}–${serie.at(-1).ano}</small></div>
         ${sparkline(state.spark, { parciais, anoAtivo: state.ano, escopo: `de ${item.name}`, referencia: state.sparkRef, referenciaRotulo: agregacao?.rotulo || '' })}
         ${state.sparkRef ? `<p class="spark-legend"><span class="is-estado">${escape(item.name)}</span><span class="is-regiao">Amazônia Legal · ${escape(agregacao.rotulo)}</span></p>` : ''}
       </section>`
    : '';
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

      ${grafico}

      <div class="state-reading">
        <p><strong>${escape(item.name)}</strong> está na ${metricRank}ª posição entre os nove estados para o indicador exibido.</p>
        ${state.sparkRef && agregacao.notaSerie ? `<p class="state-reading-nota">${escape(agregacao.notaSerie)}</p>` : ''}
      </div>
    </div>`;
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const panelViewButton = event.target.closest('[data-panel-view]');
    if (panelViewButton) selectPanelView(panelViewButton.dataset.panelView);
    const stateButton = event.target.closest('[data-state]');
    if (stateButton) {
      if (!stateButton.closest('#ranking-list')) state.panelView = 'state';
      selecionaEscopo(stateButton.dataset.state);
    }
    if (event.target.closest('#scope-regional')) selecionaEscopo(null);
    const metricButton = event.target.closest('[data-metric]');
    if (metricButton) { state.metric = metricButton.dataset.metric; metricDropdown?.setValue(state.metric); ajustaAno(); renderAll(); document.querySelector('#ranking').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }, { signal: sinalDaPagina() });
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.state-shape')) { event.preventDefault(); state.panelView = 'state'; selecionaEscopo(event.target.dataset.state); }
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
  bindSpark();
  bindMenu();
}

const ANCORA = '#map';

aoEntrarNaPagina(ANCORA, () => init().catch((error) => {
  document.querySelector('#ranking-list').innerHTML = `<li class="load-error">${escape(error.message)} Atualize a página para tentar novamente.</li>`;
}));
