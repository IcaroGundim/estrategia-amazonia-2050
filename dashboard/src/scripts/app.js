import { aoEntrarNaPagina, BANDEIRA_REGIAO, bindMenu, bindVista, escape, flagImage, readResponse, sinalDaPagina } from './shared.js';
import { centroidOf, mapPath, projecaoPara } from './mapa.js';
import { idiomaAtual, localeDe, rota, t, tp } from '../i18n/index.js';
import { campo, carregaConteudo } from './conteudo.js';

/** Descrição da bandeira de um estado, que muda de preposição entre as línguas. */
function bandeiraDe(nome) {
  return tp('Bandeira do {estado}', { estado: nome });
}

/** Os links internos do painel precisam do caminho da língua em curso. */
function rotaVisaoGeral() {
  return rota('metodologia', idiomaAtual());
}

// Ordinal. Em português é º ou ª conforme o gênero da palavra que segue —
// "7º de 9", mas "7ª posição". Em inglês o sufixo não tem gênero e depende do
// último dígito, com a exceção conhecida da dezena do 11 ao 13.
function ordinal(numero, genero = 'm') {
  if (idiomaAtual() !== 'en') return `${numero}${genero === 'f' ? 'ª' : 'º'}`;
  const dezena = numero % 100;
  if (dezena >= 11 && dezena <= 13) return `${numero}th`;
  return `${numero}${({ 1: 'st', 2: 'nd', 3: 'rd' })[numero % 10] || 'th'}`;
}

const state = { data: null, geo: null, catalogo: null, metric: 'prodesRate', ano: null, selected: null, panelView: 'state', spark: null, sparkRef: null };

// As métricas do Panorama vêm de dashboard.json (`panorama.metricas`), que o
// build deriva de conteudo/panorama.json: rótulo, descrição, fonte, direção,
// formato de exibição e método de agregação regional, com o inglês ao lado.
// Os textos são resolvidos para a língua da página uma vez, aqui, e o resto do
// módulo os usa como se fossem constantes.
let metrics = {};
let AGREGACAO = {};

const FORMATOS = {
  km2PorMilKm2: (value) => `${number(value, 2)} km² / ${t('mil km²')}`,
  porMilKm2: (value) => `${number(value, 1)} / ${t('mil km²')}`,
  porCemMil: (value) => `${number(value, 1)} / ${t('100 mil')}`,
  pct0: (value) => percent(value, 0),
  pct1: (value) => percent(value, 1),
  pct2: (value) => percent(value, 2),
  num1: (value) => number(value, 1),
  num2: (value) => number(value, 2),
  pontos1: (value) => `${number(value, 1)} ${t('pts')}`,
  reaisBi: (value) => tp('R$ {valor} bi', { valor: number(value, 2) })
};

// Em inglês prefere o campo `en`; sem ele, cai no dicionário e, por fim, no
// português — um texto novo aparece em português até alguém traduzi-lo.
function naLingua(objeto, campo) {
  const pt = objeto?.[campo] ?? null;
  if (idiomaAtual() !== 'en') return pt;
  return objeto?.en?.[campo] || (pt ? t(pt) : pt);
}

function montaMetricas(panorama) {
  metrics = {};
  AGREGACAO = {};
  for (const metrica of panorama?.metricas || []) {
    metrics[metrica.chave] = {
      label: naLingua(metrica, 'rotulo'),
      subtitle: naLingua(metrica, 'subtitulo'),
      description: naLingua(metrica, 'descricao'),
      source: naLingua(metrica, 'fonte'),
      serie: metrica.serie ? metrica.chave : undefined,
      field: metrica.chave,
      direction: metrica.direcao,
      formatter: FORMATOS[metrica.formato] || FORMATOS.num1
    };
    // Todo indicador do seletor tem agregação. A guarda por ausência segue no
    // painel regional: um indicador novo sem método precisa dizer isso na tela,
    // não inventar um número para a região.
    if (metrica.agregacao) {
      const agregacao = metrica.agregacao;
      AGREGACAO[metrica.chave] = {
        peso: agregacao.peso ?? null,
        metodo: agregacao.metodo,
        rotulo: naLingua(agregacao, 'rotulo'),
        nota: naLingua(agregacao, 'nota'),
        notaSerie: naLingua(agregacao, 'notaSerie')
      };
    }
  }
}

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
    .map((item) => ({ uf: item.uf, item, valor: valorDoIndicador(item, metric) }))
    .filter(({ valor }) => Number.isFinite(valor))
    .sort((a, b) => a.valor - b.valor);
  return valores.length ? { menor: valores[0], maior: valores.at(-1) } : null;
}

function valueAt(object, path) { return path.split('.').reduce((value, part) => value?.[part], object); }
function number(value, digits = 0) { return new Intl.NumberFormat(localeDe(), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value); }
function percent(value, digits = 0) { return `${number(value, digits)}%`; }
function compactPopulation(value) { return tp('{valor} pessoas', { valor: new Intl.NumberFormat(localeDe(), { notation: 'compact', maximumFractionDigits: 1 }).format(value) }); }
function compactNumber(value) { return new Intl.NumberFormat(localeDe(), { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
async function init() {
  const [dashboard, geo, catalogo] = await Promise.all([
    fetch('/data/dashboard.json').then(readResponse),
    fetch('/data/geo.json').then(readResponse),
    fetch('/data/catalogo.json').then(readResponse)
  ]);
  state.data = dashboard;
  await carregaConteudo();
  montaMetricas(dashboard.panorama);
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
      </li>`;
    }).join('');
  }

  function focusOption(direction = 'selected') {
    const entries = [...menu.querySelectorAll('.dropdown-option')];
    const target = direction === 'first' ? entries[0] : direction === 'last' ? entries.at(-1) : menu.querySelector('.is-selected') || entries[0];
    if (!target) return;
    // `preventScroll` porque abrir o menu num toque movia a página inteira. A
    // rolagem interna do menu continua acontecendo, mas só quando a opção está
    // mesmo fora da caixa visível — que é o caso da navegação por teclado.
    target.focus({ preventScroll: true });
    const acima = target.offsetTop < menu.scrollTop;
    const abaixo = target.offsetTop + target.offsetHeight > menu.scrollTop + menu.clientHeight;
    if (acima || abaixo) target.scrollIntoView({ block: 'nearest' });
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
    label: t(metric.label),
    sublabel: t(metric.subtitle),
    group: 'indicadores',
    groupLabel: t('Indicadores oficiais')
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
  renderTrajetoria();
}

// ---------------------------------------------------------------------------
// Trajetória: para cada meta confrontável, a série observada em linha cheia e
// a tendência em linha tracejada até o alvo, com o traço do prazo. A conta vem
// pronta do build (pipeline/trajetoria.mjs); aqui só se desenha, no recorte
// escolhido no mapa, e se escreve em uma frase o que a conta viu.
// ---------------------------------------------------------------------------
const TRAJ = { largura: 260, altura: 54, topo: 6, base: 44 };
const COR_CLASSE = { noRitmo: '#3e6e57', acelerar: '#e0a83c', contrario: '#c0451f' };

function numeroCurto(valor) {
  if (!Number.isFinite(valor)) return '—';
  if (valor === 0) return '0';
  const magnitude = Math.abs(valor);
  return new Intl.NumberFormat(localeDe(), { maximumFractionDigits: magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2 }).format(valor);
}

// Uma frase por meta, montada por partes para a ordem das palavras poder mudar
// de língua no dicionário. Os números levam a unidade só quando ela é um
// percentual; as demais unidades do catálogo ("nº", "taxa / 100 mil") já estão
// na linha da meta e não cabem numa frase.
function valorDaTrajetoria(valor, unidade) {
  const texto = numeroCurto(valor);
  // "%" e "% do PIB" são percentuais; "% / ha" (área) não é.
  return /^%(\s+d[oa]\s|$)/.test(String(unidade || '').trim()) ? `${texto}%` : texto;
}

function fraseDaTrajetoria(item, meta, fim) {
  const unidade = campo(meta.codigo, 'unidade', meta.unidade);
  const valor = valorDaTrajetoria(item.atual.valor, unidade);
  const alvo = valorDaTrajetoria(item.alvo, unidade);
  const ano = item.atual.ano;
  const nota = item.nota ? ` ${escape(item.nota)}` : '';
  if (item.classe === 'cumprida') return tp('Em {ano}, {valor}: a meta de {alvo} já está cumprida.', { ano, valor, alvo }) + nota;
  if (item.classe === 'desligada') return tp('Em {ano}, {valor}.', { ano, valor }) + (nota || ` ${t('Trajetória desligada para esta meta.')}`);
  if (item.classe === 'semSerie') {
    const serie = item.pontos === 1
      ? t('Há um só ano de dados; a projeção aparece a partir do terceiro.')
      : tp('Há {n} anos de dados; a projeção aparece a partir do terceiro.', { n: item.pontos });
    return `${tp('Em {ano}, {valor}.', { ano, valor })} ${serie}${nota}`;
  }
  const ritmo = valorDaTrajetoria(Math.abs(item.ritmo), unidade);
  if (item.classe === 'contrario') {
    const frase = item.ritmo > 0
      ? tp('A série vem subindo cerca de {ritmo} por ano, afastando-se da meta de {alvo} para {prazo}.', { ritmo, alvo, prazo: meta.prazo })
      : tp('A série vem caindo cerca de {ritmo} por ano, afastando-se da meta de {alvo} para {prazo}.', { ritmo, alvo, prazo: meta.prazo });
    return `${tp('Em {ano}, {valor}.', { ano, valor })} ${frase}${nota}`;
  }
  const abertura = item.ritmo > 0
    ? tp('Em {ano}, {valor}, subindo cerca de {ritmo} por ano.', { ano, valor, ritmo })
    : tp('Em {ano}, {valor}, caindo cerca de {ritmo} por ano.', { ano, valor, ritmo });
  let fecho;
  if (item.classe === 'noRitmo') {
    fecho = item.anoAlcance < meta.prazo
      ? tp('Se o ritmo se mantiver, a meta de {alvo} é alcançada em {anoAlcance}, antes do prazo de {prazo}.', { alvo, anoAlcance: item.anoAlcance, prazo: meta.prazo })
      : tp('Se o ritmo se mantiver, a meta de {alvo} é alcançada em {anoAlcance}, no prazo.', { alvo, anoAlcance: item.anoAlcance });
  } else {
    const vezes = number(item.aceleracao, 1);
    fecho = item.anoAlcance > fim
      ? tp('Nesse ritmo a meta de {alvo} não chega até {fim}; cumprir o prazo de {prazo} exigiria {vezes} vezes esse ritmo.', { alvo, fim, prazo: meta.prazo, vezes })
      : tp('Nesse ritmo a meta de {alvo} só chega em {anoAlcance}; cumprir o prazo de {prazo} exigiria {vezes} vezes esse ritmo.', { alvo, anoAlcance: item.anoAlcance, prazo: meta.prazo, vezes });
  }
  return `${abertura} ${fecho}${nota}`;
}

function graficoDaTrajetoria(item, meta, fim) {
  const serie = item.serie || [];
  if (serie.length < 2) {
    const so = serie[0];
    return `<svg viewBox="0 0 ${TRAJ.largura} ${TRAJ.altura}" aria-hidden="true">
      <line x1="0" y1="30" x2="${TRAJ.largura}" y2="30" stroke="var(--linha-2)"/>
      ${so ? `<circle cx="20" cy="22" r="2.5" fill="var(--mata)"/><text x="30" y="26" class="traj-rotulo">${so.ano}</text>` : ''}
    </svg>`;
  }
  const x0 = serie[0].ano;
  const alcanceVisivel = Number.isFinite(item.anoAlcance) && item.anoAlcance <= fim ? item.anoAlcance : null;
  const x1 = Math.max(meta.prazo, alcanceVisivel || 0, item.atual.ano + 2);
  const valores = serie.map((ponto) => ponto.valor).concat(Number.isFinite(item.alvo) ? [item.alvo] : []);
  let yMin = Math.min(...valores);
  let yMax = Math.max(...valores);
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const px = (ano) => ((ano - x0) / (x1 - x0)) * TRAJ.largura;
  const py = (valor) => TRAJ.base - ((valor - yMin) / (yMax - yMin)) * (TRAJ.base - TRAJ.topo);
  const observado = serie.map((ponto) => `${px(ponto.ano).toFixed(1)},${py(ponto.valor).toFixed(1)}`).join(' ');

  let tendencia = '';
  if (Number.isFinite(item.ritmo) && item.classe !== 'semSerie') {
    const cor = COR_CLASSE[item.classe] || 'var(--tinta-4)';
    let anoFim = alcanceVisivel || x1;
    let valorFim = alcanceVisivel ? item.alvo : item.atual.valor + item.ritmo * (x1 - item.atual.ano);
    // A tendência não sai da área do gráfico: corta onde encosta na borda.
    if (valorFim > yMax || valorFim < yMin) {
      const limite = valorFim > yMax ? yMax : yMin;
      anoFim = item.atual.ano + (limite - item.atual.valor) / item.ritmo;
      valorFim = limite;
    }
    tendencia = `<line x1="${px(item.atual.ano).toFixed(1)}" y1="${py(item.atual.valor).toFixed(1)}" x2="${px(anoFim).toFixed(1)}" y2="${py(valorFim).toFixed(1)}" stroke="${cor}" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  }
  const alvoLinha = Number.isFinite(item.alvo) ? `<line x1="0" y1="${py(item.alvo).toFixed(1)}" x2="${TRAJ.largura}" y2="${py(item.alvo).toFixed(1)}" stroke="var(--linha-2)"/>` : '';
  const prazoX = px(meta.prazo).toFixed(1);
  return `<svg viewBox="0 0 ${TRAJ.largura} ${TRAJ.altura}" aria-hidden="true">
    ${alvoLinha}
    <polyline fill="none" stroke="var(--mata)" stroke-width="1.6" stroke-linejoin="round" points="${observado}"/>
    ${tendencia}
    <line x1="${prazoX}" y1="2" x2="${prazoX}" y2="48" stroke="var(--tinta-3)" stroke-width="1.5"/>
    <text x="${prazoX}" y="53" class="traj-rotulo" text-anchor="${meta.prazo >= x1 ? 'end' : 'middle'}">${meta.prazo}</text>
    <text x="0" y="53" class="traj-rotulo">${x0}</text>
  </svg>`;
}

function renderTrajetoria() {
  const dados = state.data.trajetoria;
  const lista = document.querySelector('[data-trajetoria-lista]');
  if (!dados || !lista) return;
  const escopo = state.selected || 'regional';
  const nomeEscopo = state.selected ? state.data.states.find((item) => item.uf === state.selected)?.name : null;
  document.querySelector('[data-trajetoria-titulo]').textContent = nomeEscopo
    ? tp('Onde {estado} está no caminho até 2050', { estado: nomeEscopo })
    : t('Onde a Amazônia Legal está no caminho até 2050');

  const fim = dados.anoLimite;
  const ordem = { contrario: 0, acelerar: 1, noRitmo: 2, cumprida: 3, semSerie: 4, desligada: 5 };
  const itens = dados.metas
    .map((meta) => ({ meta, item: meta.escopos[escopo] }))
    .sort((a, b) => (ordem[a.item?.classe] ?? 9) - (ordem[b.item?.classe] ?? 9) || a.meta.codigo.localeCompare(b.meta.codigo));

  lista.innerHTML = itens.map(({ meta, item }) => {
    const nome = escape(campo(meta.codigo, 'nome', meta.nome));
    const unidade = escape(campo(meta.codigo, 'unidade', meta.unidade));
    const cabeca = `<div class="trajetoria-meta"><strong>${nome}</strong><small>${escape(tp('meta {alvo} até {prazo}', { alvo: `${numeroCurto(item?.alvo ?? meta.alvo)} ${unidade}`.trim(), prazo: meta.prazo }))}</small></div>`;
    if (!item) {
      return `<li class="trajetoria-item is-vazio">${cabeca}<div></div><div class="trajetoria-ano is-cinza">—</div><p class="trajetoria-frase">${t('Sem valor para este estado.')}</p></li>`;
    }
    let ano;
    let rotulo;
    if (item.classe === 'cumprida') { ano = String(item.atual.ano); rotulo = t('cumprida'); }
    else if (item.classe === 'noRitmo') { ano = String(item.anoAlcance); rotulo = t('no ritmo'); }
    else if (item.classe === 'acelerar') { ano = item.anoAlcance > fim ? `> ${fim}` : String(item.anoAlcance); rotulo = t('abaixo do ritmo'); }
    else if (item.classe === 'contrario') { ano = '—'; rotulo = t('não alcança'); }
    else if (item.classe === 'desligada') { ano = '—'; rotulo = t('desligada'); }
    else { ano = '—'; rotulo = t('sem série'); }
    return `<li class="trajetoria-item is-${item.classe}">
      ${cabeca}
      ${graficoDaTrajetoria(item, meta, fim)}
      <div class="trajetoria-ano">${ano}<small>${rotulo}</small></div>
      <p class="trajetoria-frase">${fraseDaTrajetoria(item, meta, fim)}</p>
    </li>`;
  }).join('') || `<li class="trajetoria-item is-vazio"><p class="trajetoria-frase">${t('Nenhuma meta com trajetória neste recorte.')}</p></li>`;
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
  const caixa = document.querySelector('#year-select');

  // O ClientRouter troca o body mas não reavalia o módulo: ao voltar ao Panorama,
  // `anoMontadoPara` ainda apontava para o indicador atual e o `setValue` pintava no
  // elemento antigo, já descartado, deixando o seletor vazio na tela. Conferir se a
  // caixa atual tem conteúdo cobre esse caso e qualquer outro em que ela seja
  // esvaziada. Não aparecia em desenvolvimento porque ali cada rota recarrega a página.
  if (anoMontadoPara !== state.metric || !caixa.firstElementChild) {
    const options = temSerie
      ? [...anos].reverse().map((ano) => ({
          value: String(ano),
          label: String(ano),
          group: parciais.includes(ano) ? 'parcial' : 'fechado',
          groupLabel: parciais.includes(ano) ? t('Ano em curso') : t('Série histórica')
        }))
      : [{ value: '', label: 'Indisponível', group: 'indisponivel', groupLabel: 'Sem série temporal' }];
    // O componente devolve o valor como texto; o resto do painel trabalha com número.
    yearDropdown = createDropdown(
      caixa,
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
  const fonte = metric.serie && state.ano ? `${t(metric.source)} · ${state.ano}` : t(metric.source);

  document.querySelector('#map-indicator-card').innerHTML = `
    <h3>${escape(t(metric.label))}</h3>
    <p class="map-indicator-description">${escape(t(metric.description))}</p>
    <dl>
      <div><dt>${t('Leitura')}</dt><dd>${escape(t(metric.subtitle))}</dd></div>
      <div><dt>${t('Fonte')}</dt><dd>${escape(fonte)}</dd></div>
    </dl>
    ${parcial ? `<p class="map-year-warning">${t('Ano em curso: a série ainda não fechou, então o valor não é comparável aos anos anteriores.')}</p>` : ''}
    <a href="${rotaVisaoGeral()}#calculo">${t('Entenda o cálculo')} <span aria-hidden="true">↗</span></a>`;
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
  document.querySelector('[data-ranking-title]').textContent = t(metric.label);
  document.querySelector('[data-ranking-subtitle]').textContent = t(metric.subtitle);
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
      <button type="button" class="rank-item ${regiao ? 'is-regiao ' : ''}${ativo ? 'is-selected' : ''}" data-state="${regiao ? '' : item.uf}" aria-pressed="${ativo}">
        <span class="rank-number"${regiao ? ' aria-hidden="true"' : ''}>${regiao ? '' : ++posicao}</span>
        ${flagImage(regiao ? BANDEIRA_REGIAO : item, '')}
        <span class="rank-name">${regiao
          ? `<b>${t('Amazônia Legal')}</b><small>${t('Conjunto dos 9 Estados')}</small>`
          : `<b>${escape(item.name)}</b><small>${item.uf} · ${escape(item.capital)}</small>`}</span>
      ${medida}
      </button>
    </li>`;
  });

  list.innerHTML = linhas.join('');
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
  svg.innerHTML = `<title>${tp('Mapa comparativo da Amazônia Legal para {indicador}', { indicador: escape(t(currentMetric().label)) })}</title>${groups}`;
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
  tooltip.innerHTML = `<strong>${escape(item.name)}</strong><span>${escape(t(metric.label))}${state.ano ? ' · ' + state.ano : ''}</span><b>${textoDoValor(metric, value)}</b>`;
  tooltip.hidden = false;
  positionMapTooltip(clientX, clientY);
}

function hideMapTooltip() {
  const tooltip = document.querySelector('#map-tooltip');
  if (tooltip) tooltip.hidden = true;
}

// No fluxo corrido o painel fica abaixo do mapa fixo: sem rolar, tocar num
// estado não produz resposta visível nenhuma. No desktop o painel está ao lado e
// mover a página seria gratuito, por isso a consulta de largura — feita na hora,
// e não guardada, para acompanhar a rotação do aparelho.
function revelaPainel() {
  if (!window.matchMedia('(max-width: 920px)').matches) return;
  document.querySelector('.dashboard-sidebar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  // No toque, "sair" acontece ao levantar o dedo: o realce sumia no instante
  // em que o usuário terminava de escolher o ano. Só o mouse apaga ao sair.
  painel.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') realcaSpark(null);
  }, sinal);
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
    ? `<div><span>${t('Indicador exibido')}</span><small>${escape(metric.serie && state.ano ? String(state.ano) : t('ano de referência'))}</small></div>
       <strong>${textoDoValor(metric, valor)}</strong>
       <p>${tp('{indicador} · por {metodo}', { indicador: escape(t(metric.label)), metodo: escape(t(agregacao.rotulo)) })}</p>`
    : `<div><span>${t('Indicador exibido')}</span><small>${t('sem valor regional')}</small></div>
       <strong>${t('Não se aplica')}</strong>
       <p>${tp('{indicador} é uma escala relativa entre os nove estados, então a média regional seria sempre próxima de 50 e não descreveria a região.', { indicador: escape(t(metric.label)) })}</p>`;

  // Os pontos ficam no estado: o hover e o teclado os leem sem refazer a agregação.
  state.spark = serie.length > 1 ? pontosDaSpark(serie) : null;
  state.sparkRef = null;
  const grafico = state.spark
    ? `<section class="state-spark-block" aria-label="${t('Série histórica regional')}">
         <div class="state-section-title"><span>${t('Trajetória da região')}</span><small>${serie[0].ano}–${serie.at(-1).ano}</small></div>
         ${sparkline(state.spark, { parciais, anoAtivo: state.ano, escopo: 'regional' })}
       </section>`
    : '';

  // Sem este aviso o CVLI de 2026 (11,1) parece uma queda pela metade sobre 2025
  // (21,1), quando é só um ano que ainda não fechou. O cartão ao lado do mapa já
  // alerta; aqui o número é maior e precisa do mesmo cuidado.
  const notas = [
    parciais.includes(state.ano) ? t('Ano em curso: a série ainda não fechou, então o valor não é comparável aos anos anteriores.') : null,
    agregacao?.nota ? t(agregacao.nota) : null,
    serie.length > 1 && agregacao?.notaSerie ? t(agregacao.notaSerie) : null
  ].filter(Boolean);

  const leitura = agregacao
    ? tp('{regiao} registra {valor} em {indicador}{ano}{faixa}.', {
      regiao: `<strong>${escape(t('A Amazônia Legal'))}</strong>`,
      valor: `<strong>${textoDoValor(metric, valor)}</strong>`,
      indicador: escape(t(metric.label)),
      ano: metric.serie && state.ano ? tp(', em {ano}', { ano: state.ano }) : '',
      faixa: amplitude ? tp(', entre {menor} e {maior}', { menor: escape(amplitude.menor.uf), maior: escape(amplitude.maior.uf) }) : ''
    })
    : t('Escolha um indicador oficial no seletor acima do mapa para ver o valor da Amazônia Legal como um todo.');

  document.querySelector('#state-panel').innerHTML = `
    <div class="state-panel-body">
      <div class="state-panel-kicker">
        <p class="eyebrow">${t('Perspectiva regional')}</p>
      </div>
      <div class="state-identity is-regional">
        ${flagImage(BANDEIRA_REGIAO, t('Bandeira da Amazônia Legal'))}
        <div><h2>${t('Amazônia Legal')}</h2><p>${tp('{estados} estados · {municipios} municípios', { estados: escape(resumo.statesCount), municipios: number(resumo.municipalities) })}</p></div>
      </div>

      <div class="state-summary-grid" aria-label="${t('Resumo da região')}">
        <div><span>${t('População')}</span><b>${compactNumber(resumo.population)}</b><small>${t('projeção IBGE 2025')}</small></div>
        <div><span>${t('Área territorial')}</span><b>${compactNumber(resumo.territoryKm2)} km²</b><small>${t('base cartográfica')}</small></div>
        <div><span>${t('UCs cadastradas')}</span><b>${number(resumo.conservationUnits)}</b><small>${t('federais e estaduais')}</small></div>
      </div>

      <section class="state-metric-block" aria-label="${t('Indicador selecionado na região')}">${bloco}</section>
      ${grafico}
      ${amplitude && agregacao ? `<section class="state-amplitude" aria-label="${t('Amplitude entre os estados')}">
        <div class="state-section-title"><span>${t('Amplitude entre os nove')}</span></div>
        <p><b>${textoDoValor(metric, amplitude.menor.valor)}</b> ${flagImage(amplitude.menor.item, bandeiraDe(amplitude.menor.item.name))} <i aria-hidden="true">→</i> <b>${textoDoValor(metric, amplitude.maior.valor)}</b> ${flagImage(amplitude.maior.item, bandeiraDe(amplitude.maior.item.name))}</p>
      </section>` : ''}

      <div class="state-reading">
        <p>${leitura}</p>
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
    ? `<section class="state-spark-block" aria-label="${tp('Série histórica de {estado}', { estado: escape(item.name) })}">
         <div class="state-section-title"><span>${t('Trajetória do estado')}</span><small>${serie[0].ano}–${serie.at(-1).ano}</small></div>
         ${sparkline(state.spark, { parciais, anoAtivo: state.ano, escopo: `de ${item.name}`, referencia: state.sparkRef, referenciaRotulo: agregacao?.rotulo || '' })}
         ${state.sparkRef ? `<p class="spark-legend"><span class="is-estado">${escape(item.name)}</span><span class="is-regiao">Amazônia Legal · ${escape(t(agregacao.rotulo))}</span></p>` : ''}
       </section>`
    : '';
  document.querySelector('#state-panel').innerHTML = `
    <div class="state-panel-body">
      <div class="state-panel-kicker">
        <p class="eyebrow">${t('Detalhamento do estado')}</p>
        <span>${tp('{posicao} de 9 · ciclo 2025–2026', { posicao: ordinal(metricRank) })}</span>
      </div>
      <div class="state-identity">
        ${flagImage(item, bandeiraDe(item.name))}
        <div><h2>${escape(item.name)}</h2><p>${tp('Capital {cidade}', { cidade: escape(item.capital) })}</p></div>
      </div>

      <div class="state-summary-grid" aria-label="${t('Resumo do estado')}">
        <div><span>${t('População')}</span><b>${compactNumber(item.population)}</b><small>${t('estimativa 2025')}</small></div>
        <div><span>${t('Área territorial')}</span><b>${compactNumber(item.area)} km²</b><small>${t('base cartográfica')}</small></div>
        <div><span>${t('UCs estaduais')}</span><b>${item.conservationUnits}</b><small>${t('unidades cadastradas')}</small></div>
      </div>

      <section class="state-metric-block" aria-label="${t('Indicador selecionado')}">
        <div><span>${t('Indicador exibido')}</span><small>${tp('{posicao} entre os nove estados', { posicao: ordinal(metricRank) })}</small></div>
        <strong>${textoDoValor(metric, metricValue)}</strong>
        <p>${escape(t(metric.label))} · ${escape(t(metric.subtitle))}</p>
      </section>

      ${grafico}

      <div class="state-reading">
        <p>${tp('{estado} está na {posicao} posição entre os nove estados para o indicador exibido.', { estado: `<strong>${escape(item.name)}</strong>`, posicao: ordinal(metricRank, 'f') })}</p>
        ${state.sparkRef && agregacao.notaSerie ? `<p class="state-reading-nota">${escape(t(agregacao.notaSerie))}</p>` : ''}
      </div>
    </div>`;
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const panelViewButton = event.target.closest('[data-panel-view]');
    if (panelViewButton) selectPanelView(panelViewButton.dataset.panelView);
    const stateButton = event.target.closest('[data-state]');
    if (stateButton) {
      const noMapa = !stateButton.closest('#ranking-list');
      if (noMapa) state.panelView = 'state';
      selecionaEscopo(stateButton.dataset.state);
      if (noMapa) revelaPainel();
    }
    if (event.target.closest('#scope-regional')) { selecionaEscopo(null); revelaPainel(); }
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
  // A dica do mapa segue a mesma regra do minigráfico: no toque, esconder ao
  // "sair" apagaria a dica no mesmo gesto que a abriu.
  map.addEventListener('pointermove', (event) => {
    const shape = event.target.closest('.state-shape');
    if (shape) showMapTooltip(shape.dataset.state, event.clientX, event.clientY);
    else if (event.pointerType !== 'touch') hideMapTooltip();
  });
  map.addEventListener('pointerleave', (event) => {
    if (event.pointerType !== 'touch') hideMapTooltip();
  });
  map.addEventListener('focusin', (event) => {
    if (!event.target.matches('.state-shape')) return;
    const bounds = event.target.getBoundingClientRect();
    showMapTooltip(event.target.dataset.state, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
  });
  map.addEventListener('focusout', hideMapTooltip);
  bindSpark();
  bindMenu();
  bindVista();
}

const ANCORA = '#map';

aoEntrarNaPagina(ANCORA, () => init().catch((error) => {
  document.querySelector('#ranking-list').innerHTML = `<li class="load-error">${escape(error.message)} Atualize a página para tentar novamente.</li>`;
}));
