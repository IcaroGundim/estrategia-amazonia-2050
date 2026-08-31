import { bindMenu, decimals, escape, number, readResponse } from './shared.js';
import { centroidOf, mapPath, projecaoPara } from './mapa.js';

// `foco` é null (leitura regional, o padrão) ou a sigla de um estado.
const state = { data: null, geo: null, meta: null, foco: null };

const UNIDADES = {
  '% / ha': 'hectares',
  'nº': 'ocorrências',
  'taxa / 100 mil': 'por 100 mil habitantes',
  '0 a 100': 'pontos',
  'pontos (0-100)': 'pontos'
};

function ehPercentual(meta) {
  const unidade = String(meta.unidade || '').trim();
  return unidade.startsWith('%') && !unidade.includes('/');
}

function unidadeCurta(meta) {
  if (ehPercentual(meta)) return 'pontos percentuais';
  return UNIDADES[String(meta.unidade || '').trim()] || '';
}

function valor(meta, value) {
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '—';
  if (ehPercentual(meta)) return `${number(value)}%`;
  return number(value, decimals(value));
}

function metaAtual() {
  return state.data.metas.find((meta) => meta.codigo === state.meta) || state.data.metas[0];
}

function nomeEstado(uf) {
  return state.data.estados.find((estado) => estado.uf === uf)?.name || uf;
}

function contagem(meta) {
  const avaliados = Object.values(meta.estados).filter(Boolean);
  return { cumprem: avaliados.filter((item) => item.cumpre).length, total: avaliados.length };
}

// ---------- leitura em destaque ----------

function renderReading() {
  const meta = metaAtual();
  const { cumprem, total } = contagem(meta);
  const regional = meta.regional;
  const item = state.foco ? meta.estados[state.foco] : regional;
  const titulo = state.foco ? nomeEstado(state.foco) : 'Amazônia Legal';

  const situacao = !item
    ? `<p class="goals-reading-empty">${state.foco ? 'Sem dado coletado para este estado.' : 'Esta meta é uma classificação por estado e não tem valor regional único.'}</p>`
    : `<p class="goals-reading-figure">
        <strong>${escape(valor(meta, item.valor))}</strong>
        <span>hoje</span>
        <b>${escape(valor(meta, item.alvo))}</b>
        <span>meta${meta.prazo ? ` até ${meta.prazo}` : ''}</span>
      </p>
      <p class="goals-reading-status ${item.cumpre ? 'is-met' : 'is-progress'}">
        ${item.cumpre ? 'Meta cumprida' : `Faltam ${number(Math.abs(item.distancia))} ${escape(unidadeCurta(meta))}`}
      </p>`;

  const agregacao = !state.foco && regional?.metodoRotulo
    ? `<p class="goals-reading-note">Valor regional por ${escape(regional.metodoRotulo)}.${regional.nota ? ` ${escape(regional.nota)}` : ''}</p>`
    : '';

  document.querySelector('#goals-reading').innerHTML = `
    <p class="goals-reading-kicker">${escape(titulo)} · ${cumprem} de ${total} estados cumprem</p>
    <h2>${escape(meta.nome)}</h2>
    ${situacao}
    ${agregacao}`;

  const limpar = document.querySelector('#goals-clear');
  limpar.hidden = !state.foco;
  limpar.textContent = 'Voltar à leitura regional';
}

// ---------- mapa ----------

function renderMap() {
  const meta = metaAtual();
  const svg = document.querySelector('#goals-map');
  const width = 720;
  const height = 500;
  const project = projecaoPara(state.geo.features, { width, height });

  const formas = state.geo.features.map((feature) => {
    const uf = feature.properties.uf;
    const item = meta.estados[uf];
    const foco = state.foco === uf;
    const classe = !item ? 'is-empty' : (item.cumpre ? 'is-met' : 'is-progress');
    // Em curso: a opacidade do preenchimento mostra o quanto já foi percorrido.
    const avanco = item && !item.cumpre && Number.isFinite(item.escala) ? item.escala : null;
    const estilo = avanco === null ? '' : ` style="--avanco:${(0.16 + avanco * 0.62).toFixed(2)}"`;
    const [x, y] = project(centroidOf(feature.geometry));
    const leitura = item
      ? `${nomeEstado(uf)}: ${valor(meta, item.valor)}${item.cumpre ? ' · cumpre a meta' : ` · meta ${valor(meta, item.alvo)}`}`
      : `${nomeEstado(uf)}: sem dado`;
    return `<g class="goals-state ${classe}${foco ? ' is-focused' : ''}"${estilo}>
      <path tabindex="0" role="button" aria-pressed="${foco}" aria-label="${escape(leitura)}" data-uf="${uf}" d="${mapPath(feature.geometry, project)}"><title>${escape(leitura)}</title></path>
      <text x="${x}" y="${y}">${uf}</text>
    </g>`;
  }).join('');

  svg.innerHTML = `<title>${escape(meta.nome)}: situação de cada estado</title>${formas}`;
}

// ---------- lista de metas ----------

function renderList() {
  const metas = state.data.metas;
  const { regional } = state.data.resumo;
  document.querySelector('#goals-list-sub').textContent =
    `${regional.cumpridas} das ${regional.comValorRegional} com leitura regional já cumpridas. ${metas.length} de ${state.data.resumo.totalIndicadores} indicadores da matriz têm meta mensurável.`;

  document.querySelector('#goals-list').innerHTML = metas.map((meta) => {
    const item = state.foco ? meta.estados[state.foco] : meta.regional;
    const { cumprem, total } = contagem(meta);
    const escala = item && Number.isFinite(item.escala) ? Math.round(item.escala * 100) : 0;
    const classe = !item ? 'is-empty' : (item.cumpre ? 'is-met' : 'is-progress');
    const numero = item ? valor(meta, item.valor) : `${cumprem}/${total}`;
    return `<li>
      <button type="button" data-meta="${meta.codigo}" class="goals-row ${classe}${meta.codigo === state.meta ? ' is-active' : ''}" aria-pressed="${meta.codigo === state.meta}">
        <span class="goals-row-name">${escape(meta.nome)}<small>Eixo ${meta.eixo} · meta ${meta.direcao === 'categoria' ? 'A ou B' : (meta.alvoPorEstado ? 'por estado' : valor(meta, meta.alvo))}${meta.prazo ? ` até ${meta.prazo}` : ''}</small></span>
        <span class="goals-row-value">${escape(numero)}</span>
        <i class="goals-row-bar" aria-hidden="true"><b style="width:${escala}%"></b></i>
      </button>
    </li>`;
  }).join('');
}

function renderCoverage() {
  const { resumo, foraDoPainel } = state.data;
  const semValores = foraDoPainel.filter((item) => !item.temValores).length;
  const semParametro = foraDoPainel.length - semValores;
  document.querySelector('#goals-coverage-lead').textContent =
    `Dos ${resumo.totalIndicadores} indicadores da matriz de resultados, ${resumo.metasAvaliadas} têm meta com patamar comparável aos valores coletados. `
    + `Ficam de fora ${semValores} sem dados para os nove estados e ${semParametro} que têm dados, mas cuja meta não define patamar confrontável. `
    + `Entre as avaliadas, ${resumo.regional.semValorRegional} não admitem valor regional único e são lidas apenas estado a estado.`;

  const grupos = [
    ['Com dados, sem patamar comparável', foraDoPainel.filter((item) => item.temValores)],
    ['Sem dados coletados', foraDoPainel.filter((item) => !item.temValores)]
  ];
  document.querySelector('#goals-excluded').innerHTML = grupos.map(([titulo, itens]) => `
    <div class="goals-excluded-group">
      <h3>${escape(titulo)} <span>${itens.length}</span></h3>
      <ul>
        ${itens.map((item) => `<li><b>${escape(item.codigo)} · ${escape(item.nome)}</b><small>${escape(item.motivo)}</small></li>`).join('')}
      </ul>
    </div>`).join('');
}

function renderAll() {
  renderReading();
  renderMap();
  renderList();
}

function bindEvents() {
  document.querySelector('#goals-list').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-meta]');
    if (!button) return;
    state.meta = button.dataset.meta;
    renderAll();
  });
  document.querySelector('#goals-map').addEventListener('click', (event) => {
    const forma = event.target.closest('path[data-uf]');
    if (!forma) return;
    state.foco = state.foco === forma.dataset.uf ? null : forma.dataset.uf;
    renderAll();
  });
  document.querySelector('#goals-map').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const forma = event.target.closest('path[data-uf]');
    if (!forma) return;
    event.preventDefault();
    state.foco = state.foco === forma.dataset.uf ? null : forma.dataset.uf;
    renderAll();
  });
  document.querySelector('#goals-clear').addEventListener('click', () => {
    state.foco = null;
    renderAll();
  });
  bindMenu();
}

async function init() {
  const [metas, geo] = await Promise.all([
    fetch('/data/metas.json').then(readResponse),
    fetch('/data/geo.json').then(readResponse)
  ]);
  state.data = metas;
  state.geo = geo;
  state.meta = metas.metas[0]?.codigo || null;
  renderCoverage();
  renderAll();
  bindEvents();
}

init().catch((error) => {
  document.querySelector('#goals-reading').innerHTML = `<p class="load-error">${escape(error.message)} Atualize a página para tentar novamente.</p>`;
});
