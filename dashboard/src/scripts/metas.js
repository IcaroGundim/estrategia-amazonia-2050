import { aoEntrarNaPagina, BANDEIRA_REGIAO, bindMenu, bindVista, decimals, escape, flagImage, number, readResponse, sinalDaPagina } from './shared.js';
import { centroidOf, mapPath, projecaoPara } from './mapa.js';

// A página é sempre da Amazônia Legal: o mapa mostra a distribuição da meta
// selecionada, mas não é um filtro. Passar o mouse revela o valor do estado.
const state = { data: null, geo: null, meta: null, uf: null, detalhesAbertos: true, animarDetalhe: false, anosGrafico: {} };
let fechamentoDetalhe = 0;
let trocaDetalhe = 0;

const UNIDADES = {
  '% / ha': 'hectares',
  'nº': 'ocorrências',
  'taxa / 100 mil': 'por 100 mil habitantes',
  '0 a 100': 'pontos',
  'pontos (0-100)': 'pontos'
};

const ESCALA_CAPAG = ['D', 'C', 'B', 'B+', 'A', 'A+'];

function faixaCapag(nota) {
  const normalizada = String(nota || '').trim().toUpperCase();
  if (normalizada === 'C*') return 'C';
  return ESCALA_CAPAG.includes(normalizada) ? normalizada : null;
}

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

function dadosDaMeta(meta) {
  const item = state.uf ? meta.estados[state.uf] : meta.regional;
  const { cumprem, total } = contagem(meta);
  const contaEstados = !item && !state.uf && total > 0;
  const progresso = item
    ? (item.cumpre ? 100 : (Number.isFinite(item.escala) ? Math.round(item.escala * 100) : 0))
    : (contaEstados ? Math.round(cumprem / total * 100) : 0);
  const semEscala = Boolean(item && !item.cumpre && !Number.isFinite(item.escala) && !item.categoria);
  return { item, cumprem, total, contaEstados, progresso, semEscala };
}

function rotuloTipo(tipo) {
  return ({ declarada: 'Meta declarada', inferida: 'Meta inferida', derivada: 'Meta derivada da baseline' })[tipo]
    || 'Critério não informado';
}

function renderGrafico(meta) {
  const historico = Array.isArray(meta.historico) ? meta.historico : [];
  if (!historico.length) return '<p class="goals-chart-empty">Não há valores anuais disponíveis para este indicador.</p>';

  const anos = historico.map((item) => String(item.ano));
  const anoGuardado = String(state.anosGrafico[meta.codigo] || '');
  const ano = anos.includes(anoGuardado) ? anoGuardado : anos.at(-1);
  state.anosGrafico[meta.codigo] = ano;
  const recorte = historico.find((item) => String(item.ano) === ano);
  const opcoes = anos.slice().reverse().map((item) => `<li role="option" tabindex="-1" data-goals-chart-year="${escape(item)}" class="${item === ano ? 'is-selected' : ''}" aria-selected="${item === ano}">${escape(item)}</li>`).join('');
  const seletor = `<div class="goals-chart-year"><span>Ano</span><div class="dropdown goals-year-dropdown${anos.length === 1 ? ' is-disabled' : ''}">
    <button type="button" class="dropdown-toggle" data-goals-year-toggle aria-haspopup="listbox" aria-expanded="false"${anos.length === 1 ? ' disabled aria-disabled="true"' : ''}>
      <span data-goals-year-value>${escape(ano)}</span>
      <svg class="dropdown-chevron" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <ul class="dropdown-menu" role="listbox" aria-label="Selecionar ano" hidden>${opcoes}</ul>
  </div></div>`;

  if (meta.direcao === 'categoria') {
    const linhas = state.data.estados.map((estado) => {
      const nota = String(recorte?.valores?.[estado.uf] || '').trim().toUpperCase();
      const faixa = faixaCapag(nota);
      return faixa ? { ...estado, nota, faixa } : null;
    }).filter(Boolean);
    if (!linhas.length) {
      return `<div class="goals-detail-chart-head"><h3>Valores por estado</h3>${seletor}</div>
        <p class="goals-chart-empty">Não há classificações estaduais disponíveis para ${escape(ano)}.</p>`;
    }

    const ultimaFaixa = ESCALA_CAPAG.length - 1;
    const posicaoMeta = ESCALA_CAPAG.indexOf('B') / ultimaFaixa * 100;
    const barras = linhas.map((item) => {
      const largura = ESCALA_CAPAG.indexOf(item.faixa) / ultimaFaixa * 100;
      const cumpre = ESCALA_CAPAG.indexOf(item.faixa) >= ESCALA_CAPAG.indexOf('B');
      const selecionado = state.uf === item.uf ? ' is-selected' : '';
      return `<div class="goals-chart-row goals-chart-row-category${selecionado}${cumpre ? ' is-met' : ''}" role="listitem" aria-label="${escape(item.name)}: classificação ${escape(item.nota)}">
        <span class="goals-chart-uf">${escape(item.uf)}</span>
        <span class="goals-chart-track" aria-hidden="true">
          <i class="goals-chart-fill" style="width:${largura.toFixed(2)}%"></i>
          <i class="goals-chart-target" style="left:${posicaoMeta.toFixed(2)}%"></i>
        </span>
        <b>${escape(item.nota)}</b>
      </div>`;
    }).join('');
    const escala = ESCALA_CAPAG.map((faixa, indice) => `<span style="left:${(indice / ultimaFaixa * 100).toFixed(2)}%">${escape(faixa)}</span>`).join('');

    return `<div class="goals-detail-chart-head"><h3>Valores por estado</h3>${seletor}</div>
      <div class="goals-chart-bars" role="list" aria-label="Classificação CAPAG dos estados em ${escape(ano)}">${barras}</div>
      <div class="goals-chart-scale" aria-label="Escala CAPAG, de D a A mais">${escala}</div>
      <p class="goals-chart-legend"><i aria-hidden="true"></i> meta mínima: B</p>`;
  }

  const linhas = state.data.estados.map((estado) => {
    const valorEstado = Number(recorte?.valores?.[estado.uf]);
    const alvoEstado = Number(meta.estados?.[estado.uf]?.alvo ?? meta.alvo);
    return Number.isFinite(valorEstado) ? { ...estado, valor: valorEstado, alvo: alvoEstado } : null;
  }).filter(Boolean);
  if (!linhas.length) {
    return `<div class="goals-detail-chart-head"><h3>Valores por estado</h3>${seletor}</div>
      <p class="goals-chart-empty">Não há valores estaduais disponíveis para ${escape(ano)}.</p>`;
  }

  const maximo = Math.max(...linhas.flatMap((item) => [item.valor, Number.isFinite(item.alvo) ? item.alvo : 0]), 0);
  const barras = linhas.map((item) => {
    const largura = maximo > 0 ? Math.max(0, Math.min(100, item.valor / maximo * 100)) : 0;
    const posicaoAlvo = Number.isFinite(item.alvo) && maximo > 0
      ? Math.max(0.8, Math.min(99.2, item.alvo / maximo * 100))
      : null;
    const cumpre = Number.isFinite(item.alvo)
      ? (meta.direcao === 'menor' ? item.valor <= item.alvo : item.valor >= item.alvo)
      : false;
    const selecionado = state.uf === item.uf ? ' is-selected' : '';
    return `<div class="goals-chart-row${selecionado}${cumpre ? ' is-met' : ''}" role="listitem" aria-label="${escape(item.name)}: ${escape(valor(meta, item.valor))}">
      <span class="goals-chart-uf">${escape(item.uf)}</span>
      <span class="goals-chart-track" aria-hidden="true">
        <i class="goals-chart-fill" style="width:${largura.toFixed(2)}%"></i>
        ${posicaoAlvo === null ? '' : `<i class="goals-chart-target" style="left:${posicaoAlvo.toFixed(2)}%"></i>`}
      </span>
      <b>${escape(valor(meta, item.valor))}</b>
    </div>`;
  }).join('');

  return `<div class="goals-detail-chart-head"><h3>Valores por estado</h3>${seletor}</div>
    <div class="goals-chart-bars" role="list" aria-label="Valores dos estados em ${escape(ano)}">${barras}</div>
    <p class="goals-chart-legend"><i aria-hidden="true"></i> marcador da meta</p>`;
}

// ---------- leitura em destaque ----------

// O card do mapa nasce oculto e só aparece quando há meta com mapa para mostrar.
function cardDoMapaVisivel() {
  const card = document.querySelector('.goals-map-card');
  return Boolean(card && !card.hidden);
}

function renderReading() {
  if (!cardDoMapaVisivel()) return;
  const meta = metaAtual();
  const item = meta.regional;

  const situacao = !item
    ? '<p class="goals-reading-empty">Esta meta é uma classificação por estado e não tem valor regional único.</p>'
    : `<p class="goals-reading-figure">
        <strong>${escape(valor(meta, item.valor))}</strong>
        <span>hoje</span>
        <b>${escape(valor(meta, item.alvo))}</b>
        <span>meta${meta.prazo ? ` até ${meta.prazo}` : ''}</span>
      </p>
      <p class="goals-reading-status ${item.cumpre ? 'is-met' : 'is-progress'}">
        ${item.cumpre ? 'Meta cumprida' : `Faltam ${number(Math.abs(item.distancia))} ${escape(unidadeCurta(meta))}`}
      </p>`;

  const agregacao = item?.metodoRotulo
    ? `<p class="goals-reading-note">Valor regional por ${escape(item.metodoRotulo)}.${item.nota ? ` ${escape(item.nota)}` : ''}</p>`
    : '';

  document.querySelector('#goals-meta-name').textContent = meta.nome;
  document.querySelector('#goals-reading').innerHTML = `
    ${situacao}
    ${agregacao}`;
}

// ---------- mapa ----------

function renderMap() {
  if (!cardDoMapaVisivel() || !state.geo) return;
  const meta = metaAtual();
  const svg = document.querySelector('#goals-map');
  const width = 720;
  const height = 500;
  const project = projecaoPara(state.geo.features, { width, height });

  const formas = state.geo.features.map((feature) => {
    const uf = feature.properties.uf;
    const item = meta.estados[uf];
    const classe = !item ? 'is-empty' : (item.cumpre ? 'is-met' : 'is-progress');
    // Em curso: a opacidade do preenchimento mostra o quanto já foi percorrido.
    const avanco = item && !item.cumpre && Number.isFinite(item.escala) ? item.escala : null;
    const estilo = avanco === null ? '' : ` style="--avanco:${(0.30 + avanco * 0.58).toFixed(2)}"`;
    const [x, y] = project(centroidOf(feature.geometry));
    const leitura = item
      ? `${nomeEstado(uf)}: ${valor(meta, item.valor)}${item.cumpre ? ' · cumpre a meta' : ` · meta ${valor(meta, item.alvo)}`}`
      : `${nomeEstado(uf)}: sem dado`;
    return `<g class="goals-state ${classe}"${estilo}>
      <path aria-label="${escape(leitura)}" d="${mapPath(feature.geometry, project)}"><title>${escape(leitura)}</title></path>
      <text x="${x}" y="${y}">${uf}</text>
    </g>`;
  }).join('');

  svg.innerHTML = `<title>${escape(meta.nome)}: situação de cada estado</title>${formas}`;
}

// ---------- bandeiras de estado ----------

function renderFlags() {
  const wrap = document.querySelector('#goals-flags');
  if (!wrap) return;
  const nome = state.uf
    ? (state.data.estados.find((estado) => estado.uf === state.uf)?.name || state.uf)
    : 'Amazônia Legal (região)';
  wrap.innerHTML = `<span class="goals-flags-nome">${escape(nome)}</span>`
    + `<button type="button" class="goals-flag${state.uf ? '' : ' is-active'}" data-uf="" title="Amazônia Legal — visão regional" aria-label="Amazônia Legal, visão regional" aria-pressed="${state.uf ? 'false' : 'true'}">${flagImage(BANDEIRA_REGIAO, '')}</button>`
    + state.data.estados.map((estado) => `<button type="button" class="goals-flag${state.uf === estado.uf ? ' is-active' : ''}" data-uf="${estado.uf}" title="${escape(estado.name)}" aria-label="${escape(estado.name)}" aria-pressed="${state.uf === estado.uf ? 'true' : 'false'}">${flagImage(estado, '')}</button>`).join('');
}

// ---------- painel lateral de detalhes ----------

function renderDetail() {
  const painel = document.querySelector('#goals-detail');
  const board = document.querySelector('.goals-board');
  const meta = metaAtual();
  if (!painel || !meta || !state.detalhesAbertos) {
    if (painel) painel.hidden = true;
    if (board) board.classList.remove('has-detail');
    return;
  }

  painel.querySelectorAll('.goals-detail-content.is-leaving').forEach((elemento) => elemento.remove());
  painel.classList.remove('is-resizing');
  painel.style.height = '';
  const entradaCompleta = painel.hidden || painel.classList.contains('is-closing');
  const trocarConteudo = state.animarDetalhe && !entradaCompleta;
  const alturaAnterior = trocarConteudo ? painel.getBoundingClientRect().height : 0;
  const conteudoAnterior = trocarConteudo
    ? painel.querySelector('.goals-detail-content')?.cloneNode(true)
    : null;

  const { item, cumprem, total, contaEstados, progresso, semEscala } = dadosDaMeta(meta);
  const valorAtual = item
    ? valor(meta, item.valor)
    : (contaEstados ? `${cumprem} de ${total} estados` : 'Sem dado');
  const alvo = item
    ? `${meta.direcao === 'menor' ? '≤ ' : ''}${valor(meta, item.alvo)}${meta.prazo ? ` até ${meta.prazo}` : ''}`
    : (contaEstados ? `A ou B nos ${total} estados` : '—');
  const jornada = item?.categoria && state.uf
    ? (item.cumpre ? '100%' : '—')
    : (semEscala || (!item && !contaEstados) ? 'Sem escala' : `${progresso}%`);
  const agregacao = !state.uf && item?.metodoRotulo
    ? `<p class="goals-detail-method"><strong>Leitura regional:</strong> ${escape(item.metodoRotulo)}.${item.nota ? ` ${escape(item.nota)}` : ''}</p>`
    : '';
  const grafico = renderGrafico(meta);

  painel.innerHTML = `<div class="goals-detail-content">
      <header class="goals-detail-head">
        <h2 id="goals-detail-title">${escape(meta.nome)}</h2>
        <button class="goals-detail-close" type="button" aria-label="Fechar detalhes da meta">×</button>
      </header>

      <dl class="goals-detail-summary">
        <div><dt>Valor atual</dt><dd>${escape(valorAtual)}</dd></div>
        <div><dt>Meta</dt><dd>${escape(alvo)}</dd></div>
        <div><dt>Jornada</dt><dd>${escape(jornada)}</dd></div>
      </dl>

      <section class="goals-detail-chart">
        ${grafico}
      </section>

      <section class="goals-detail-section">
        <h3>Meta pactuada</h3>
        <p class="goals-detail-meta">${escape(meta.metaTexto || 'Meta não informada.')}</p>
      </section>

      <section class="goals-detail-section">
        <h3>Dados e método</h3>
        <dl class="goals-detail-facts">
          <div><dt>Referência</dt><dd>${escape(meta.anoRef || 'Não informada')}</dd></div>
          <div><dt>Critério</dt><dd>${escape(rotuloTipo(meta.tipo))}</dd></div>
          <div class="is-wide"><dt>Fonte</dt><dd>${escape(meta.fonte || 'Não informada')}</dd></div>
        </dl>
        ${agregacao}
      </section>
    </div>`;
  fechamentoDetalhe += 1;
  painel.classList.remove('is-closing', 'is-opening');
  painel.hidden = false;
  if (board) board.classList.add('has-detail');
  posicionaDetalhe();
  if (state.animarDetalhe) {
    state.animarDetalhe = false;
    if (entradaCompleta) {
      void painel.offsetWidth;
      painel.classList.add('is-opening');
      const limpar = () => painel.classList.remove('is-opening');
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) limpar();
      else {
        painel.addEventListener('animationend', limpar, { once: true });
        setTimeout(limpar, 480);
      }
    } else animarTrocaDeConteudo(painel, conteudoAnterior, alturaAnterior);
  }
}

function posicionaDetalhe() {
  const painel = document.querySelector('#goals-detail');
  const board = document.querySelector('.goals-board');
  if (painel && board && painel.parentElement !== board) board.appendChild(painel);
}

function animarTrocaDeConteudo(painel, conteudoAnterior, alturaAnterior) {
  const conteudoNovo = painel.querySelector('.goals-detail-content');
  if (!conteudoNovo) return;
  const ciclo = ++trocaDetalhe;
  painel.style.height = 'auto';
  const alturaNova = painel.getBoundingClientRect().height;

  if (conteudoAnterior) {
    conteudoAnterior.querySelectorAll('[id]').forEach((elemento) => elemento.removeAttribute('id'));
    conteudoAnterior.classList.remove('is-entering');
    conteudoAnterior.classList.add('is-leaving');
    conteudoAnterior.setAttribute('aria-hidden', 'true');
    painel.appendChild(conteudoAnterior);
  }
  conteudoNovo.classList.add('is-entering');

  if (Math.abs(alturaNova - alturaAnterior) > 1) {
    painel.style.height = `${alturaAnterior}px`;
    void painel.offsetHeight;
    painel.classList.add('is-resizing');
    requestAnimationFrame(() => {
      if (ciclo === trocaDetalhe) painel.style.height = `${alturaNova}px`;
    });
  }

  const concluir = () => {
    if (ciclo !== trocaDetalhe) return;
    conteudoAnterior?.remove();
    conteudoNovo.classList.remove('is-entering');
    painel.classList.remove('is-resizing');
    painel.style.height = '';
  };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) concluir();
  else setTimeout(concluir, 420);
}

function fecharDetalheAnimado() {
  const painel = document.querySelector('#goals-detail');
  const board = document.querySelector('.goals-board');
  state.detalhesAbertos = false;
  renderList();
  if (!painel || painel.hidden) {
    if (board) board.classList.remove('has-detail');
    return;
  }

  const ciclo = ++fechamentoDetalhe;
  trocaDetalhe += 1;
  painel.querySelectorAll('.goals-detail-content.is-leaving').forEach((elemento) => elemento.remove());
  painel.classList.remove('is-opening', 'is-resizing');
  painel.style.height = '';
  painel.classList.add('is-closing');
  if (board) board.classList.remove('has-detail');
  const concluir = () => {
    if (ciclo !== fechamentoDetalhe || state.detalhesAbertos) return;
    painel.classList.remove('is-closing');
    painel.hidden = true;
  };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) concluir();
  else {
    painel.addEventListener('animationend', concluir, { once: true });
    setTimeout(concluir, 480);
  }
}

// ---------- lista de metas ----------

// A lista é reconstruída inteira a cada troca de estado, então as barras nasceriam
// já na largura final e nenhuma transição dispararia. Guardamos o preenchimento
// anterior de cada meta, desenhamos a barra partindo dele e só então soltamos o
// valor novo, no quadro seguinte — aí o CSS anima a diferença.
function larguraAtualPorMeta() {
  const mapa = new Map();
  for (const barra of document.querySelectorAll('#goals-list [data-meta-barra]')) {
    mapa.set(barra.dataset.metaBarra, Number(barra.dataset.destino) || 0);
  }
  return mapa;
}

function animaBarras() {
  const barras = [...document.querySelectorAll('#goals-list [data-meta-barra]')];
  if (!barras.length) return;
  // Uma leitura de layout força o navegador a assumir a largura inicial antes da troca.
  void barras[0].offsetWidth;
  requestAnimationFrame(() => {
    for (const barra of barras) {
      const destino = barra.dataset.destino;
      barra.style.width = destino + '%';
      const rotulo = barra.parentElement.querySelector('.goals-row-val');
      if (rotulo) rotulo.style.left = (rotulo.dataset.fixo === 'sim' ? 0 : destino) + '%';
    }
  });
}

function renderList() {
  const metas = state.data.metas;
  const anterior = larguraAtualPorMeta();

  // Agrupa pela ordem em que os eixos aparecem no catálogo.
  const grupos = [];
  for (const meta of metas) {
    let grupo = grupos[grupos.length - 1];
    if (!grupo || grupo.eixo !== meta.eixo) {
      grupo = { eixo: meta.eixo, nome: meta.eixoNome, itens: [] };
      grupos.push(grupo);
    }
    grupo.itens.push(meta);
  }

  document.querySelector('#goals-list').innerHTML = grupos.map(({ eixo, eixoNome, itens }) => `
    <section class="goals-eixo">
      <header class="goals-eixo-head">
        <span class="num" aria-hidden="true">${eixo}</span>
        <h3>${escape(eixoNome || `Eixo ${eixo}`)}</h3>
        <span>${itens.length} ${itens.length === 1 ? 'meta' : 'metas'}</span>
      </header>
      ${itens.map((meta) => {
        const { item, cumprem, total, contaEstados, progresso: p, semEscala } = dadosDaMeta(meta);
        // Não ter valor regional único não quer dizer não ter progresso: a CAPAG é uma
        // classificação por estado e o patamar da meta são os nove em A ou B, então a
        // jornada da região é quantos já chegaram lá. Na visão de um estado o vazio
        // continua vazio — ali a ausência é falta de dado, não uma contagem.
        let valorHoje;
        let leitura;
        if (!item) {
          if (state.uf) { valorHoje = 'sem dado'; leitura = '—'; }
          else { valorHoje = `${cumprem} de ${total}`; leitura = `${cumprem}/${total}`; }
        } else if (item.categoria) {
          valorHoje = valor(meta, item.valor);
          leitura = item.cumpre ? '✓' : (state.uf ? '—' : `${cumprem}/${total}`);
        } else {
          valorHoje = valor(meta, item.valor);
          leitura = semEscala ? '—' : `${p}%`;
        }

        const partida = anterior.has(meta.codigo) ? anterior.get(meta.codigo) : p;
        const rotulo = semEscala
          ? `<em class="goals-row-val sem fora" data-fixo="sim" style="left:0%">${escape(valorHoje)} · sem escala</em>`
          : (p >= 22
            ? `<em class="goals-row-val dentro" style="left:${partida}%">${escape(valorHoje)}</em>`
            : `<em class="goals-row-val fora" style="left:${partida}%">${escape(valorHoje)}</em>`);

        const classe = item?.cumpre || (contaEstados && cumprem === total)
          ? 'is-met'
          : (item || contaEstados ? 'is-progress' : 'is-empty');
        const prefixo = meta.direcao === 'menor' ? '≤ ' : '';
        const patamar = item
          ? `<b>${escape(prefixo + valor(meta, item.alvo))}</b>`
          : (state.uf ? '<b>—</b>' : '<b>A ou B</b> nos 9 estados');

        const ativa = state.detalhesAbertos && meta.codigo === state.meta ? ' is-active' : '';
        const expandida = state.detalhesAbertos && meta.codigo === state.meta;
        return `<button type="button" data-meta="${meta.codigo}" class="goals-row ${classe}${ativa}" aria-expanded="${expandida}" aria-controls="goals-detail">
          <span class="goals-row-name">${escape(meta.nome)}<small>meta ${patamar}${meta.prazo ? ` até ${meta.prazo}` : ''}</small></span>
          <span class="goals-row-bar" aria-hidden="true"><i class="resta"></i><i class="feito" data-meta-barra="${meta.codigo}" data-destino="${p}" style="width:${partida}%"></i>${rotulo}</span>
          <span class="goals-row-ler"><b>${leitura}</b><small>jornada</small></span>
          <span class="goals-row-open" aria-hidden="true">›</span>
        </button>`;
      }).join('')}
    </section>`).join('');

  animaBarras();
  posicionaDetalhe();
}

function renderAll() {
  renderReading();
  renderMap();
  renderList();
  renderDetail();
}

function bindEvents() {
  const flags = document.querySelector('#goals-flags');
  if (flags) {
    flags.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-uf]');
      if (!button) return;
      state.uf = button.dataset.uf || null;
      renderFlags();
      renderList();
      renderDetail();
    });
  }
  document.querySelector('#goals-list').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-meta]');
    if (!button) return;
    const mesmaMeta = state.meta === button.dataset.meta;
    if (mesmaMeta && state.detalhesAbertos) {
      fecharDetalheAnimado();
      return;
    }
    state.meta = button.dataset.meta;
    state.detalhesAbertos = true;
    state.animarDetalhe = true;
    renderAll();
  });
  const painelDetalhe = document.querySelector('#goals-detail');
  painelDetalhe.addEventListener('click', (event) => {
    if (event.target.closest('.goals-detail-close')) {
      fecharDetalheAnimado();
      return;
    }
    const toggle = event.target.closest('[data-goals-year-toggle]');
    if (toggle) {
      const dropdown = toggle.closest('.goals-year-dropdown');
      const abrir = !dropdown.classList.contains('is-open');
      dropdown.classList.toggle('is-open', abrir);
      toggle.setAttribute('aria-expanded', String(abrir));
      const menu = dropdown.querySelector('.dropdown-menu');
      menu.hidden = !abrir;
      if (abrir) requestAnimationFrame(() => (menu.querySelector('.is-selected') || menu.querySelector('[data-goals-chart-year]'))?.focus({ preventScroll: true }));
      return;
    }
    const opcao = event.target.closest('[data-goals-chart-year]');
    if (!opcao) return;
    state.anosGrafico[state.meta] = opcao.dataset.goalsChartYear;
    state.animarDetalhe = true;
    renderDetail();
    requestAnimationFrame(() => painelDetalhe.querySelector('[data-goals-year-toggle]')?.focus({ preventScroll: true }));
  });
  painelDetalhe.addEventListener('keydown', (event) => {
    const toggle = event.target.closest('[data-goals-year-toggle]');
    if (toggle && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const dropdown = toggle.closest('.goals-year-dropdown');
      const menuAno = dropdown.querySelector('.dropdown-menu');
      dropdown.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      menuAno.hidden = false;
      const itensAno = [...menuAno.querySelectorAll('[data-goals-chart-year]')];
      const destino = event.key === 'ArrowDown' ? itensAno[0] : itensAno.at(-1);
      requestAnimationFrame(() => destino?.focus({ preventScroll: true }));
      return;
    }
    const menu = event.target.closest('.goals-year-dropdown .dropdown-menu');
    if (!menu) return;
    const itens = [...menu.querySelectorAll('[data-goals-chart-year]')];
    const atual = itens.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const passo = event.key === 'ArrowDown' ? 1 : -1;
      itens[(atual + passo + itens.length) % itens.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      itens[event.key === 'Home' ? 0 : itens.length - 1]?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      itens[atual]?.click();
    } else if (event.key === 'Escape') {
      const dropdown = menu.closest('.goals-year-dropdown');
      dropdown.classList.remove('is-open');
      menu.hidden = true;
      const toggle = dropdown.querySelector('[data-goals-year-toggle]');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    }
  });
  document.addEventListener('click', (event) => {
    const dropdown = painelDetalhe.querySelector('.goals-year-dropdown.is-open');
    if (!dropdown || dropdown.contains(event.target)) return;
    dropdown.classList.remove('is-open');
    dropdown.querySelector('[data-goals-year-toggle]')?.setAttribute('aria-expanded', 'false');
    dropdown.querySelector('.dropdown-menu').hidden = true;
  }, { signal: sinalDaPagina() });
  bindMenu();
  bindVista();
}

async function init() {
  const visivel = cardDoMapaVisivel();
  const pedidos = [fetch('/data/metas.json').then(readResponse)];
  if (visivel) pedidos.push(fetch('/data/geo.json').then(readResponse));
  const [metas, geo] = await Promise.all(pedidos);
  state.data = metas;
  state.geo = geo || null;
  state.meta = metas.metas[0]?.codigo || null;
  state.uf = null;
  renderFlags();
  renderAll();
  bindEvents();
}

const ANCORA = '#goals-list';

aoEntrarNaPagina(ANCORA, () => init().catch((error) => {
  const alvo = document.querySelector('#goals-list');
  if (alvo) alvo.innerHTML = `<p class="load-error">${escape(error.message)} Atualize a página para tentar novamente.</p>`;
}));
