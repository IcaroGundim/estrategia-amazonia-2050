const state = { data: null, eixo: 'todos', uf: null };

function escape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

async function readResponse(response) {
  if (!response.ok) throw new Error('Não foi possível carregar as metas.');
  return response.json();
}

function decimals(value) {
  const absolute = Math.abs(value);
  if (absolute >= 1000) return 0;
  if (absolute >= 100) return 1;
  if (absolute >= 1) return 2;
  return 3;
}

function number(value, casas = decimals(value)) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

function valorFormatado(meta, value) {
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '—';
  if (ehPercentual(meta)) return `${number(value)}%`;
  return number(value);
}

function ehPercentual(meta) {
  const unidade = String(meta.unidade || '').trim();
  return unidade.startsWith('%') && !unidade.includes('/');
}

// As unidades do catálogo são rótulos de planilha; aqui viram texto de frase.
const UNIDADES = {
  '% / ha': 'hectares',
  'nº': 'ocorrências',
  'taxa / 100 mil': 'por 100 mil habitantes',
  '0 a 100': 'pontos',
  'pontos (0-100)': 'pontos'
};

function unidadeCurta(meta) {
  const unidade = String(meta.unidade || '').trim();
  if (ehPercentual(meta)) return 'pontos percentuais';
  return UNIDADES[unidade] || '';
}

function flagImage(estado) {
  const version = estado.flagVersion ? `?v=${estado.flagVersion}` : '';
  const ratio = estado.flagRatio ? ` style="aspect-ratio:${estado.flagRatio}"` : '';
  return `<img src="/flags/${encodeURIComponent(estado.flag)}${version}"${ratio} alt="">`;
}

function metasVisiveis() {
  if (state.eixo === 'todos') return state.data.metas;
  return state.data.metas.filter((meta) => String(meta.eixo) === state.eixo);
}

function estadoAtual() {
  return state.data.estados.find((estado) => estado.uf === state.uf) || state.data.estados[0];
}

function renderSummary() {
  const { resumo, metas } = state.data;
  const estado = estadoAtual();
  const doEstado = resumo.porEstado[estado.uf] || { cumpridas: 0, avaliadas: 0 };
  const totalCelulas = metas.reduce((soma, meta) => soma + meta.avaliados, 0);
  const cumpridas = metas.reduce((soma, meta) => soma + meta.cumpridas, 0);
  document.querySelector('#goals-summary').innerHTML = `
    <article>
      <span>Metas avaliáveis</span>
      <strong>${resumo.metasAvaliadas}</strong>
      <small>de ${resumo.totalIndicadores} indicadores da matriz</small>
    </article>
    <article>
      <span>Cumprimentos registrados</span>
      <strong>${cumpridas}</strong>
      <small>de ${totalCelulas} pares meta × estado</small>
    </article>
    <article class="is-focus">
      <span>${escape(estado.name)}</span>
      <strong>${doEstado.cumpridas} de ${doEstado.avaliadas}</strong>
      <small>metas cumpridas hoje</small>
    </article>`;
}

function renderAxisFilter() {
  const eixos = [...new Map(state.data.metas.map((meta) => [String(meta.eixo), meta.eixoNome])).entries()];
  const opcoes = [['todos', 'Todos os eixos'], ...eixos.map(([numero, nome]) => [numero, `Eixo ${numero}`, nome])];
  document.querySelector('#goals-axis-filter').innerHTML = opcoes.map(([valor, rotulo, titulo]) => `
    <button type="button" data-axis="${valor}" class="${state.eixo === valor ? 'is-active' : ''}"${titulo ? ` title="${escape(titulo)}"` : ''} aria-pressed="${state.eixo === valor}">${escape(rotulo)}</button>`).join('');
}

function renderStateSelect() {
  const select = document.querySelector('#goals-state');
  select.innerHTML = state.data.estados
    .map((estado) => `<option value="${estado.uf}"${estado.uf === state.uf ? ' selected' : ''}>${escape(estado.name)}</option>`)
    .join('');
}

function celula(meta, uf) {
  const item = meta.estados[uf];
  if (!item) return `<div class="goal-cell is-empty" title="Sem dado disponível"><span class="sr-only">Sem dado</span></div>`;
  const escala = Number.isFinite(item.escala) ? item.escala : 0;
  const rotulo = item.cumpre
    ? `${valorFormatado(meta, item.valor)} · meta cumprida`
    : `${valorFormatado(meta, item.valor)} · meta ${valorFormatado(meta, item.alvo)}`;
  const classe = item.cumpre ? 'is-met' : 'is-progress';
  const foco = uf === state.uf ? ' is-focused' : '';
  return `<div class="goal-cell ${classe}${foco}" title="${escape(rotulo)}">
    <i aria-hidden="true"><b style="height:${Math.round(escala * 100)}%"></b></i>
    <span class="sr-only">${escape(rotulo)}</span>
  </div>`;
}

// Uma meta usa a mesma base de escala em todos os estados; basta olhar a primeira célula.
function baseDaEscala(meta) {
  const primeira = Object.values(meta.estados).find(Boolean);
  return primeira?.escalaTipo || null;
}

function renderMatrix() {
  const metas = metasVisiveis();
  const estados = state.data.estados;
  const cabecalho = estados.map((estado) => `
    <div class="goal-col-head${estado.uf === state.uf ? ' is-focused' : ''}">
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
    return `<div class="goal-col-total${estado.uf === state.uf ? ' is-focused' : ''}"><b>${cumpridas}</b><small>/${total}</small></div>`;
  }).join('');

  const trilhas = `minmax(210px, 1.4fr) repeat(${estados.length}, minmax(46px, 1fr)) 62px`;
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

function cartaoMeta(meta, uf) {
  const item = meta.estados[uf];
  const tipoRotulo = { declarada: 'meta declarada', inferida: 'meta operacionalizada', derivada: 'meta calculada por estado' }[meta.tipo] || meta.tipo;
  if (!item) {
    return `<article class="goal-card is-empty">
      <header><span>${escape(meta.codigo)}</span><b>${escape(meta.nome)}</b></header>
      <p class="goal-card-status">Sem dado para este estado.</p>
      <p class="goal-card-meta">${escape(meta.metaTexto)}</p>
    </article>`;
  }
  const barra = Number.isFinite(item.escala) ? Math.round(item.escala * 100) : 0;
  const distancia = item.cumpre || item.categoria || !Number.isFinite(item.distancia)
    ? ''
    : `<p class="goal-card-gap">Faltam <b>${number(Math.abs(item.distancia))}</b> ${escape(unidadeCurta(meta))} para o patamar da meta.</p>`;
  const escalaRotulo = item.escalaTipo === 'baseline' ? 'do percurso desde a baseline' : 'do patamar da meta';
  return `<article class="goal-card ${item.cumpre ? 'is-met' : 'is-progress'}">
    <header>
      <span>${escape(meta.codigo)} · Eixo ${meta.eixo}</span>
      <b>${escape(meta.nome)}</b>
    </header>
    <div class="goal-card-figures">
      <div><small>Valor atual</small><strong>${escape(valorFormatado(meta, item.valor))}</strong></div>
      <div><small>Meta${meta.prazo ? ` até ${meta.prazo}` : ''}</small><strong>${escape(valorFormatado(meta, item.alvo))}</strong></div>
      <p class="goal-card-status">${item.cumpre ? 'Cumprida' : 'Em curso'}</p>
    </div>
    ${item.categoria ? '' : `<i class="goal-card-bar" aria-hidden="true"><b style="width:${barra}%"></b></i>
    ${item.cumpre ? '' : `<p class="goal-card-scale">${barra}% ${escalaRotulo}</p>`}`}
    ${distancia}
    <p class="goal-card-meta">${escape(meta.metaTexto)}</p>
    <p class="goal-card-note"><span>${escape(tipoRotulo)}</span>${meta.nota ? escape(meta.nota) : `Fonte: ${escape(meta.fonte || '—')}.`}</p>
  </article>`;
}

function renderCards() {
  const estado = estadoAtual();
  const metas = metasVisiveis();
  const ordenadas = [...metas].sort((a, b) => {
    const cumpreA = a.estados[estado.uf]?.cumpre ? 0 : 1;
    const cumpreB = b.estados[estado.uf]?.cumpre ? 0 : 1;
    return cumpreA - cumpreB || a.codigo.localeCompare(b.codigo);
  });
  document.querySelector('.goals-detail-head').innerHTML = `
    <div class="goals-detail-identity">
      ${flagImage(estado)}
      <div>
        <p class="eyebrow">Detalhe por meta</p>
        <h2 id="goals-detail-title">Metas de ${escape(estado.name)}</h2>
      </div>
    </div>`;
  document.querySelector('#goals-cards').innerHTML = ordenadas.map((meta) => cartaoMeta(meta, estado.uf)).join('');
}

function renderCoverage() {
  const { resumo, foraDoPainel } = state.data;
  const semValores = foraDoPainel.filter((item) => !item.temValores).length;
  const semParametro = foraDoPainel.length - semValores;
  document.querySelector('#goals-coverage-lead').innerHTML =
    `Dos ${resumo.totalIndicadores} indicadores da matriz de resultados, ${resumo.metasAvaliadas} têm meta com patamar comparável aos valores já coletados e aparecem no quadro acima. `
    + `Os demais ficam de fora por dois motivos: ${semValores} ainda não têm dados coletados para os nove estados e ${semParametro} têm dados, mas a meta não define um patamar confrontável com eles.`;

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
  renderMatrix();
  renderCards();
}

function bindEvents() {
  document.querySelector('#goals-axis-filter').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-axis]');
    if (!button) return;
    state.eixo = button.dataset.axis;
    renderAll();
  });
  document.querySelector('#goals-state').addEventListener('change', (event) => {
    state.uf = event.target.value;
    renderAll();
  });
  document.querySelector('#goals-matrix').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-uf]');
    if (!button) return;
    state.uf = button.dataset.uf;
    document.querySelector('#goals-state').value = state.uf;
    renderAll();
  });
  const menuButton = document.querySelector('.menu-button');
  menuButton.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('menu-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.textContent = isOpen ? 'Fechar' : 'Menu';
  });
  document.querySelectorAll('.topnav a').forEach((link) => link.addEventListener('click', () => {
    document.body.classList.remove('menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = 'Menu';
  }));
}

async function init() {
  state.data = await fetch('/api/metas').then(readResponse);
  state.uf = state.data.estados[0]?.uf || null;
  renderStateSelect();
  renderCoverage();
  renderAll();
  bindEvents();
}

init().catch((error) => {
  document.querySelector('#goals-matrix').innerHTML = `<p class="load-error">${escape(error.message)} Atualize a página para tentar novamente.</p>`;
});
