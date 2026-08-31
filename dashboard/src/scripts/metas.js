import { bindMenu, decimals, escape, flagImage, number, readResponse } from './shared.js';

// `recorte` é 'AL' (Amazônia Legal, a leitura padrão) ou a sigla de um estado.
const state = { data: null, eixo: 'todos', recorte: 'AL' };

const REGIAO = { uf: 'AL', name: 'Amazônia Legal', descricao: 'os nove estados em conjunto' };

// As unidades do catálogo são rótulos de planilha; aqui viram texto de frase.
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

function valorFormatado(meta, value) {
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '—';
  if (ehPercentual(meta)) return `${number(value)}%`;
  return number(value, decimals(value));
}

function metasVisiveis() {
  if (state.eixo === 'todos') return state.data.metas;
  return state.data.metas.filter((meta) => String(meta.eixo) === state.eixo);
}

function naRegiao() {
  return state.recorte === 'AL';
}

function recorteAtual() {
  if (naRegiao()) return REGIAO;
  return state.data.estados.find((estado) => estado.uf === state.recorte) || REGIAO;
}

// Devolve a leitura da meta no recorte ativo, no mesmo formato nos dois casos.
function leitura(meta) {
  return naRegiao() ? meta.regional : meta.estados[state.recorte];
}

function contaEstados(meta) {
  const avaliados = Object.values(meta.estados).filter(Boolean);
  return { cumprem: avaliados.filter((item) => item.cumpre).length, total: avaliados.length };
}

function renderSummary() {
  const metas = state.data.metas;
  const { resumo } = state.data;
  const alvo = document.querySelector('#goals-summary');

  if (naRegiao()) {
    const semRegional = metas.filter((meta) => !meta.regional).length;
    alvo.innerHTML = `
      <article class="is-focus">
        <span>Amazônia Legal</span>
        <strong>${resumo.regional.cumpridas} de ${resumo.regional.comValorRegional}</strong>
        <small>metas cumpridas na leitura regional</small>
      </article>
      <article>
        <span>Metas avaliáveis</span>
        <strong>${resumo.metasAvaliadas}</strong>
        <small>de ${resumo.totalIndicadores} indicadores da matriz</small>
      </article>
      <article>
        <span>Sem valor regional</span>
        <strong>${semRegional}</strong>
        <small>avaliadas apenas estado a estado</small>
      </article>`;
    return;
  }

  const estado = recorteAtual();
  const doEstado = resumo.porEstado[estado.uf] || { cumpridas: 0, avaliadas: 0 };
  const acimaDaRegiao = metas.filter((meta) => {
    const item = meta.estados[estado.uf];
    if (!item || !meta.regional || item.categoria) return false;
    return meta.direcao === 'menor' ? item.valor < meta.regional.valor : item.valor > meta.regional.valor;
  }).length;
  alvo.innerHTML = `
    <article class="is-focus">
      <span>${escape(estado.name)}</span>
      <strong>${doEstado.cumpridas} de ${doEstado.avaliadas}</strong>
      <small>metas cumpridas hoje</small>
    </article>
    <article>
      <span>Na Amazônia Legal</span>
      <strong>${resumo.regional.cumpridas} de ${resumo.regional.comValorRegional}</strong>
      <small>para comparação com a região</small>
    </article>
    <article>
      <span>Melhor que a região</span>
      <strong>${acimaDaRegiao}</strong>
      <small>metas em que o estado está à frente do valor regional</small>
    </article>`;
}

function renderScopeSelect() {
  document.querySelector('#goals-scope').innerHTML = `
    <option value="AL"${naRegiao() ? ' selected' : ''}>Amazônia Legal (todos os estados)</option>
    <optgroup label="Estado">
      ${state.data.estados.map((estado) => `<option value="${estado.uf}"${estado.uf === state.recorte ? ' selected' : ''}>${escape(estado.name)}</option>`).join('')}
    </optgroup>`;
}

function renderAxisFilter() {
  const eixos = [...new Map(state.data.metas.map((meta) => [String(meta.eixo), meta.eixoNome])).entries()];
  const opcoes = [['todos', 'Todos os eixos'], ...eixos.map(([numero, nome]) => [numero, `Eixo ${numero}`, nome])];
  document.querySelector('#goals-axis-filter').innerHTML = opcoes.map(([valor, rotulo, titulo]) => `
    <button type="button" data-axis="${valor}" class="${state.eixo === valor ? 'is-active' : ''}"${titulo ? ` title="${escape(titulo)}"` : ''} aria-pressed="${state.eixo === valor}">${escape(rotulo)}</button>`).join('');
}

function renderDetailHead() {
  const recorte = recorteAtual();
  const metas = metasVisiveis();
  const comLeitura = metas.filter((meta) => leitura(meta));
  const cumpridas = comLeitura.filter((meta) => leitura(meta).cumpre).length;
  const identidade = naRegiao()
    ? '<span class="goals-region-mark" aria-hidden="true">AL</span>'
    : flagImage(recorte, `Bandeira do ${recorte.name}`);
  document.querySelector('.goals-detail-head').innerHTML = `
    <div class="goals-detail-identity">
      ${identidade}
      <div>
        <p class="eyebrow">${naRegiao() ? 'Leitura regional' : 'Recorte estadual'}</p>
        <h2 id="goals-detail-title">Metas ${naRegiao() ? 'da Amazônia Legal' : `de ${escape(recorte.name)}`}</h2>
      </div>
    </div>
    <p class="goals-detail-count"><b>${cumpridas}</b> de ${comLeitura.length} cumpridas${state.eixo === 'todos' ? '' : ' neste eixo'}</p>`;
}

function tirinhaEstados(meta) {
  const { cumprem, total } = contaEstados(meta);
  const pastilhas = state.data.estados.map((estado) => {
    const item = meta.estados[estado.uf];
    const classe = !item ? 'is-empty' : (item.cumpre ? 'is-met' : 'is-progress');
    const rotulo = item ? `${estado.name}: ${valorFormatado(meta, item.valor)}` : `${estado.name}: sem dado`;
    return `<button type="button" class="goal-pill ${classe}" data-uf="${estado.uf}" title="${escape(rotulo)}">${estado.uf}</button>`;
  }).join('');
  return `<div class="goal-states">
    <p><b>${cumprem}</b> de ${total} estados cumprem</p>
    <div class="goal-pills">${pastilhas}</div>
  </div>`;
}

function cartaoMeta(meta) {
  const item = leitura(meta);
  const tipoRotulo = { declarada: 'meta declarada', inferida: 'meta operacionalizada', derivada: 'meta calculada por estado' }[meta.tipo] || meta.tipo;

  if (!item) {
    const { cumprem, total } = contaEstados(meta);
    return `<article class="goal-card is-empty">
      <header><span>${escape(meta.codigo)} · Eixo ${meta.eixo}</span><b>${escape(meta.nome)}</b></header>
      <p class="goal-card-status">${naRegiao() ? 'Sem valor regional' : 'Sem dado para este recorte'}</p>
      <p class="goal-card-gap">${naRegiao() ? `A meta é uma classificação por estado: <b>${cumprem}</b> de ${total} estados cumprem.` : 'O indicador não tem valor coletado para este estado.'}</p>
      ${naRegiao() ? tirinhaEstados(meta) : ''}
      <p class="goal-card-meta">${escape(meta.metaTexto)}</p>
    </article>`;
  }

  const barra = Number.isFinite(item.escala) ? Math.round(item.escala * 100) : 0;
  const distancia = item.cumpre || item.categoria || !Number.isFinite(item.distancia)
    ? ''
    : `<p class="goal-card-gap">Faltam <b>${number(Math.abs(item.distancia))}</b> ${escape(unidadeCurta(meta))} para o patamar da meta.</p>`;
  const escalaRotulo = item.escalaTipo === 'baseline' ? 'do percurso desde a baseline' : 'do patamar da meta';
  const metodo = naRegiao() && item.metodoRotulo
    ? `<p class="goal-card-method"><span>Agregação</span>${escape(item.metodoRotulo)}${item.nota ? ` — ${escape(item.nota)}` : ''}</p>`
    : '';

  return `<article class="goal-card ${item.cumpre ? 'is-met' : 'is-progress'}">
    <header>
      <span>${escape(meta.codigo)} · Eixo ${meta.eixo}</span>
      <b>${escape(meta.nome)}</b>
    </header>
    <div class="goal-card-figures">
      <div><small>${naRegiao() ? 'Amazônia Legal' : 'Valor atual'}</small><strong>${escape(valorFormatado(meta, item.valor))}</strong></div>
      <div><small>Meta${meta.prazo ? ` até ${meta.prazo}` : ''}</small><strong>${escape(valorFormatado(meta, item.alvo))}</strong></div>
      <p class="goal-card-status">${item.cumpre ? 'Cumprida' : 'Em curso'}</p>
    </div>
    ${item.categoria ? '' : `<i class="goal-card-bar" aria-hidden="true"><b style="width:${barra}%"></b></i>
    ${item.cumpre ? '' : `<p class="goal-card-scale">${barra}% ${escalaRotulo}</p>`}`}
    ${distancia}
    ${naRegiao() ? tirinhaEstados(meta) : ''}
    ${metodo}
    <p class="goal-card-meta">${escape(meta.metaTexto)}</p>
    <p class="goal-card-note"><span>${escape(tipoRotulo)}</span>${meta.nota ? escape(meta.nota) : `Fonte: ${escape(meta.fonte || '—')}.`}</p>
  </article>`;
}

function renderCards() {
  const ordenadas = [...metasVisiveis()].sort((a, b) => {
    const cumpreA = leitura(a)?.cumpre ? 0 : 1;
    const cumpreB = leitura(b)?.cumpre ? 0 : 1;
    return cumpreA - cumpreB || a.codigo.localeCompare(b.codigo);
  });
  document.querySelector('#goals-cards').innerHTML = ordenadas.map(cartaoMeta).join('')
    || '<p class="method-loading">Nenhuma meta neste eixo.</p>';
}

// Uma meta usa a mesma base de escala em todos os estados; basta olhar a primeira célula.
function baseDaEscala(meta) {
  return Object.values(meta.estados).find(Boolean)?.escalaTipo || null;
}

function celula(meta, uf) {
  const item = meta.estados[uf];
  if (!item) return '<div class="goal-cell is-empty" title="Sem dado disponível"><span class="sr-only">Sem dado</span></div>';
  const escala = Number.isFinite(item.escala) ? item.escala : 0;
  const rotulo = item.cumpre
    ? `${valorFormatado(meta, item.valor)} · meta cumprida`
    : `${valorFormatado(meta, item.valor)} · meta ${valorFormatado(meta, item.alvo)}`;
  const foco = uf === state.recorte ? ' is-focused' : '';
  return `<div class="goal-cell ${item.cumpre ? 'is-met' : 'is-progress'}${foco}" title="${escape(rotulo)}">
    <i aria-hidden="true"><b style="height:${Math.round(escala * 100)}%"></b></i>
    <span class="sr-only">${escape(rotulo)}</span>
  </div>`;
}

function renderMatrix() {
  const metas = metasVisiveis();
  const estados = state.data.estados;
  const trilhas = `minmax(210px, 1.4fr) repeat(${estados.length}, minmax(46px, 1fr)) 62px`;

  const cabecalho = estados.map((estado) => `
    <div class="goal-col-head${estado.uf === state.recorte ? ' is-focused' : ''}">
      <button type="button" data-uf="${estado.uf}" title="${escape(estado.name)}">${estado.uf}</button>
    </div>`).join('');

  const linhas = metas.map((meta) => `
    <div class="goal-row">
      <div class="goal-row-head">
        <b>${escape(meta.nome)}</b>
        <small>${escape(meta.codigo)} · meta ${meta.direcao === 'categoria' ? 'A ou B' : (meta.alvoPorEstado ? 'por estado' : valorFormatado(meta, meta.alvo))}${meta.prazo ? ` até ${meta.prazo}` : ''}${baseDaEscala(meta) === 'baseline' ? ' · avanço desde a baseline' : ''}</small>
      </div>
      ${estados.map((estado) => celula(meta, estado.uf)).join('')}
      <div class="goal-row-count"><b>${meta.cumpridas}</b><small>/${meta.avaliados}</small></div>
    </div>`).join('');

  const contagem = estados.map((estado) => {
    const total = metas.filter((meta) => meta.estados[estado.uf]).length;
    const cumpridas = metas.filter((meta) => meta.estados[estado.uf]?.cumpre).length;
    return `<div class="goal-col-total${estado.uf === state.recorte ? ' is-focused' : ''}"><b>${cumpridas}</b><small>/${total}</small></div>`;
  }).join('');

  document.querySelector('#goals-matrix').innerHTML = `
    <div class="goal-grid" style="--goal-tracks:${trilhas}">
      <div class="goal-row is-head">
        <div class="goal-row-head"><small>Meta</small></div>
        ${cabecalho}
        <div class="goal-row-count"><small>Cumpre</small></div>
      </div>
      ${linhas || '<p class="method-loading">Nenhuma meta neste eixo.</p>'}
      <div class="goal-row is-total">
        <div class="goal-row-head"><small>Metas cumpridas por estado</small></div>
        ${contagem}
        <div class="goal-row-count"></div>
      </div>
    </div>`;
}

function renderCoverage() {
  const { resumo, foraDoPainel } = state.data;
  const semValores = foraDoPainel.filter((item) => !item.temValores).length;
  const semParametro = foraDoPainel.length - semValores;
  document.querySelector('#goals-coverage-lead').innerHTML =
    `Dos ${resumo.totalIndicadores} indicadores da matriz de resultados, ${resumo.metasAvaliadas} têm meta com patamar comparável aos valores já coletados e aparecem neste painel. `
    + `Os demais ficam de fora por dois motivos: ${semValores} ainda não têm dados coletados para os nove estados e ${semParametro} têm dados, mas a meta não define um patamar confrontável com eles. `
    + `Entre as ${resumo.metasAvaliadas} avaliadas, ${resumo.regional.semValorRegional} não admitem um valor regional único e são lidas apenas estado a estado.`;

  const grupos = [
    ['Com dados, sem patamar comparável', foraDoPainel.filter((item) => item.temValores)],
    ['Sem dados coletados', foraDoPainel.filter((item) => !item.temValores)]
  ];
  document.querySelector('#goals-excluded').innerHTML = grupos.map(([titulo, itens]) => `
    <div class="goals-excluded-group">
      <h3>${escape(titulo)} <span>${itens.length}</span></h3>
      <ul>
        ${itens.map((item) => `<li>
          <b>${escape(item.codigo)} · ${escape(item.nome)}</b>
          <small>${escape(item.motivo)}</small>
        </li>`).join('')}
      </ul>
    </div>`).join('');
}

function renderAll() {
  renderSummary();
  renderAxisFilter();
  renderDetailHead();
  renderCards();
  renderMatrix();
}

function trocaRecorte(valor) {
  state.recorte = valor;
  document.querySelector('#goals-scope').value = valor;
  renderAll();
}

function bindEvents() {
  document.querySelector('#goals-axis-filter').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-axis]');
    if (!button) return;
    state.eixo = button.dataset.axis;
    renderAll();
  });
  document.querySelector('#goals-scope').addEventListener('change', (event) => trocaRecorte(event.target.value));
  // As siglas nos cartões e no quadro levam ao recorte daquele estado.
  document.querySelector('.goals-detail').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-uf]');
    if (button) trocaRecorte(button.dataset.uf);
  });
  document.querySelector('#goals-matrix').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-uf]');
    if (button) trocaRecorte(button.dataset.uf);
  });
  bindMenu();
}

async function init() {
  state.data = await fetch('/data/metas.json').then(readResponse);
  renderScopeSelect();
  renderCoverage();
  renderAll();
  bindEvents();
}

init().catch((error) => {
  document.querySelector('#goals-cards').innerHTML = `<p class="load-error">${escape(error.message)} Atualize a página para tentar novamente.</p>`;
});
