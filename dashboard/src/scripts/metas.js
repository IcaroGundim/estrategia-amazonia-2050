import { aoEntrarNaPagina, BANDEIRA_REGIAO, bindMenu, bindVista, decimals, escape, flagImage, number, readResponse, sinalDaPagina } from './shared.js';
import { carregaDossie, carregaKatexSeNecessario, exportCsv, normalise, renderFicha, selo, statusOf, STATUS } from './fichas.js';

// A página reúne as duas leituras da mesma matriz: as metas com patamar
// mensurável, que têm jornada e gráfico, e o restante do catálogo, que só tem
// ficha. Eram duas rotas, e cada indicador aparecia nas duas com nome, eixo,
// meta pactuada e fonte escritos de novo. Aqui a meta é a espinha e a ficha é a
// segunda aba do painel de detalhe.
//
// O recorte por estado é sempre o mesmo — a fileira de bandeiras — e vale para a
// jornada, para o gráfico e para o valor da ficha.
const state = {
  data: null,
  codigo: null,
  uf: null,
  aba: 'resultado',
  detalhesAbertos: true,
  animarDetalhe: false,
  anosGrafico: {},
  busca: '',
  eixos: new Set(),
  status: 'all',
  dossie: null,
  katex: null
};
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
  if (String(meta.unidade || '').trim() === '% / ha') return `${number(value, decimals(value))} ha`;
  return number(value, decimals(value));
}

// ---------- o acervo dos 59 ----------

/**
 * Metas e demais indicadores na mesma lista, marcados por `temMeta`. É o que
 * distingue uma linha com barra de uma linha só com selo de coleta — e o que
 * decide qual das duas abas do painel abre primeiro.
 */
function acervo() {
  return [
    ...state.data.metas.map((meta) => ({ ...meta, temMeta: true })),
    ...state.data.foraDoPainel.map((item) => ({ ...item, temMeta: false }))
  ];
}

function itemPorCodigo(codigo) {
  return acervo().find((item) => item.codigo === codigo) || null;
}

function itemAtual() {
  return itemPorCodigo(state.codigo);
}

function passaNoFiltro(item) {
  if (state.eixos.size && !state.eixos.has(String(item.eixo))) return false;
  if (state.status !== 'all' && statusOf(item) !== state.status) return false;
  if (state.busca) {
    const palheiro = normalise([item.codigo, item.nome, item.metaTexto, item.fonte, item.eixoNome, item.linhaAcao].join(' '));
    if (!palheiro.includes(normalise(state.busca))) return false;
  }
  return true;
}

function visiveis() {
  return acervo().filter(passaNoFiltro);
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

// ---------- gráfico por estado ----------

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
      return `<div class="goals-detail-chart-head"><h3>Amazônia Legal e estados</h3>${seletor}</div>
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

  const estados = state.data.estados.map((estado) => {
    const valorEstado = Number(recorte?.valores?.[estado.uf]);
    const alvoEstado = Number(meta.estados?.[estado.uf]?.alvo ?? meta.alvo);
    return Number.isFinite(valorEstado) ? { ...estado, valor: valorEstado, alvo: alvoEstado } : null;
  }).filter(Boolean);
  const valorRegional = Number.isFinite(recorte?.regional) ? recorte.regional : null;
  const alvoRegional = Number(meta.regional?.alvo ?? meta.alvo);
  const linhaRegional = Number.isFinite(valorRegional)
    ? [{ uf: 'AL', name: 'Amazônia Legal', valor: valorRegional, alvo: alvoRegional, regional: true }]
    : [];
  const linhas = [...linhaRegional, ...estados];
  if (!linhas.length) {
    return `<div class="goals-detail-chart-head"><h3>Amazônia Legal e estados</h3>${seletor}</div>
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
    const regional = item.regional ? ' is-regional' : '';
    return `<div class="goals-chart-row${regional}${selecionado}${cumpre ? ' is-met' : ''}" role="listitem" aria-label="${escape(item.name)}: ${escape(valor(meta, item.valor))}">
      <span class="goals-chart-uf">${escape(item.uf)}</span>
      <span class="goals-chart-track" aria-hidden="true">
        <i class="goals-chart-fill" style="width:${largura.toFixed(2)}%"></i>
        ${posicaoAlvo === null ? '' : `<i class="goals-chart-target" style="left:${posicaoAlvo.toFixed(2)}%"></i>`}
      </span>
      <b>${escape(valor(meta, item.valor))}</b>
    </div>`;
  }).join('');

  return `<div class="goals-detail-chart-head"><h3>Amazônia Legal e estados</h3>${seletor}</div>
    <div class="goals-chart-bars" role="list" aria-label="Valor da Amazônia Legal e dos estados em ${escape(ano)}">${barras}</div>
    <p class="goals-chart-legend"><i aria-hidden="true"></i> marcador da meta</p>`;
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

// ---------- busca, filtros e exportação ----------

// Sem contagem nas pastilhas: quantos indicadores cada eixo tem já está escrito
// no cabeçalho do grupo, na lista, e o total no resumo acima dela. E sem a
// palavra "Eixo" seis vezes seguidas ao lado do rótulo que já diz "Eixo" — só o
// número, que é o que muda de uma pastilha para a outra. O nome inteiro fica no
// `aria-label`, para quem ouve a página em vez de vê-la.
function renderEixoFilters() {
  const alvo = document.querySelector('#goals-eixo-filters');
  if (!alvo) return;
  const eixos = [...new Set(acervo().map((item) => item.eixo))].sort((a, b) => a - b);
  const opcoes = [
    { valor: 'all', rotulo: 'Todos', nome: 'Todos os eixos', ativo: state.eixos.size === 0 },
    ...eixos.map((eixo) => ({
      valor: String(eixo),
      rotulo: String(eixo),
      nome: `Eixo ${eixo}`,
      ativo: state.eixos.has(String(eixo))
    }))
  ];
  alvo.innerHTML = opcoes.map((opcao) => `
    <button type="button" class="status-filter${opcao.ativo ? ' is-active' : ''}" data-eixo="${opcao.valor}" aria-label="${escape(opcao.nome)}" aria-pressed="${opcao.ativo}">${escape(opcao.rotulo)}</button>`).join('');
}

function renderStatusFilters() {
  const alvo = document.querySelector('#goals-status-filters');
  if (!alvo) return;
  const opcoes = [
    { valor: 'all', rotulo: 'Todas' },
    ...Object.entries(STATUS).map(([valor, { label }]) => ({ valor, rotulo: label }))
  ];
  alvo.innerHTML = opcoes.map((opcao) => `
    <button type="button" class="status-filter${state.status === opcao.valor ? ' is-active' : ''}" data-status="${opcao.valor}" aria-pressed="${state.status === opcao.valor}">${escape(opcao.rotulo)}</button>`).join('');
}

// No celular o bloco de filtros fica fechado, então o que está selecionado
// precisa aparecer no botão que o abre — do contrário a lista mostraria um
// recorte sem dizer qual.
function renderFiltersSummary() {
  const resumo = document.querySelector('[data-filters-summary]');
  if (!resumo) return;
  const partes = [];
  if (state.eixos.size) partes.push(`${state.eixos.size} eixo${state.eixos.size > 1 ? 's' : ''}`);
  if (state.status !== 'all') partes.push(STATUS[state.status]?.label ?? state.status);
  if (state.busca) partes.push(`“${state.busca}”`);
  resumo.textContent = partes.length ? partes.join(' · ') : 'Todos os indicadores';
}

function renderContagem(lista) {
  const alvo = document.querySelector('[data-lista-resumo]');
  if (!alvo) return;
  const comMeta = lista.filter((item) => item.temMeta).length;
  alvo.innerHTML = `<span>${lista.length}</span> ${lista.length === 1 ? 'indicador' : 'indicadores'}`
    + ` · <span>${comMeta}</span> com meta mensurável`;
}

// Divulgação simples, e não `role="menu"`: o conteúdo são um botão e cinco
// links comuns, que o Tab já percorre. Um menu ARIA de verdade exigiria
// gerenciar as setas e o foco, sem ganho nenhum para seis itens.
function abreExport(abrir) {
  const grupo = document.querySelector('#export-menu');
  const gatilho = grupo?.querySelector('[data-export-toggle]');
  const menu = document.querySelector('#export-opcoes');
  if (!grupo || !gatilho || !menu) return;
  grupo.classList.toggle('is-open', abrir);
  gatilho.setAttribute('aria-expanded', String(abrir));
  menu.hidden = !abrir;
}

async function baixarCsv() {
  const botao = document.querySelector('#export-csv');
  const rotulo = botao?.textContent;
  if (botao) { botao.disabled = true; botao.textContent = 'Preparando…'; }
  try {
    const dossie = await carregaDossie();
    state.dossie = dossie;
    exportCsv(visiveis(), dossie.indicadores, state.uf);
    abreExport(false);
  } catch {
    if (botao) botao.textContent = 'Não foi possível exportar';
    return;
  } finally {
    if (botao) { botao.disabled = false; if (botao.textContent === 'Preparando…') botao.textContent = rotulo; }
  }
}

// ---------- painel lateral de detalhes ----------

// Só as 12 com patamar têm resultado a mostrar. Um indicador sem patamar não
// tem jornada nem gráfico, e o que sobraria aqui — o selo de coleta e o motivo —
// já está na linha que se acabou de tocar. Para eles o painel abre direto na
// ficha, sem abas, e a meta pactuada viaja junto com ela.
function corpoResultado(meta) {
  const { item: recorte, cumprem, total, contaEstados, progresso, semEscala } = dadosDaMeta(meta);
  const valorAtual = recorte
    ? valor(meta, recorte.valor)
    : (contaEstados ? `${cumprem} de ${total} estados` : 'Sem dado');
  const alvo = recorte
    ? `${meta.direcao === 'menor' ? '≤ ' : ''}${valor(meta, recorte.alvo)}${meta.prazo ? ` até ${meta.prazo}` : ''}`
    : (contaEstados ? `A ou B nos ${total} estados` : '—');
  const jornada = recorte?.categoria && state.uf
    ? (recorte.cumpre ? '100%' : '—')
    : (semEscala || (!recorte && !contaEstados) ? 'Sem escala' : `${progresso}%`);
  const agregacao = !state.uf && recorte?.metodoRotulo
    ? `<p class="goals-detail-method"><strong>Leitura regional:</strong> ${escape(recorte.metodoRotulo)}.${recorte.nota ? ` ${escape(recorte.nota)}` : ''}</p>`
    : '';

  return `
    <dl class="goals-detail-summary">
      <div><dt>Valor atual</dt><dd>${escape(valorAtual)}</dd></div>
      <div><dt>Meta</dt><dd>${escape(alvo)}</dd></div>
      <div><dt>Jornada</dt><dd>${escape(jornada)}</dd></div>
    </dl>

    <section class="goals-detail-chart">
      ${renderGrafico(meta)}
    </section>

    <section class="goals-detail-section">
      <h3>Meta pactuada</h3>
      <p class="goals-detail-meta">${escape(meta.metaTexto || 'Meta não informada.')}</p>
    </section>

    <section class="goals-detail-section">
      <h3>Critério do patamar</h3>
      <dl class="goals-detail-facts">
        <div><dt>Referência</dt><dd>${escape(meta.anoRef || 'Não informada')}</dd></div>
        <div><dt>Critério</dt><dd>${escape(rotuloTipo(meta.tipo))}</dd></div>
      </dl>
      ${agregacao}
    </section>`;
}

function corpoFicha(item) {
  if (!state.dossie) return '<p class="method-loading">Carregando ficha técnica…</p>';
  // O catálogo é a fonte dos valores por estado, da descrição técnica e da
  // situação de coleta; o que veio da lista preenche o que faltar nele.
  const indicador = { ...item, ...(state.dossie.indicadores[item.codigo] || {}) };
  return renderFicha({
    indicador,
    ficha: state.dossie.fichas[item.codigo] || null,
    uf: state.uf,
    katex: state.katex,
    // Nas 12 com patamar a meta pactuada é a primeira coisa da aba Resultado;
    // repeti-la aqui seria escrevê-la duas vezes no mesmo painel.
    metaTexto: item.temMeta ? null : item.metaTexto
  });
}

// A ficha e o KaTeX chegam depois. Enquanto não chegam, o painel mostra o aviso
// de carregamento; quando chegam, ele é redesenhado sem animação — o conteúdo
// não mudou de assunto, só terminou de carregar.
async function garanteDossie(codigo) {
  try {
    const [dossie, katex] = await Promise.all([carregaDossie(), carregaKatexSeNecessario(codigo)]);
    if (state.codigo !== codigo || state.aba !== 'ficha') return;
    state.dossie = dossie;
    if (katex) state.katex = katex;
    renderDetail();
  } catch (erro) {
    if (state.codigo !== codigo || state.aba !== 'ficha') return;
    const alvo = document.querySelector('#goals-detail .method-loading');
    if (alvo) alvo.outerHTML = `<p class="load-error">${escape(erro.message)} Atualize a página para tentar novamente.</p>`;
  }
}

function renderDetail() {
  const painel = document.querySelector('#goals-detail');
  const board = document.querySelector('.goals-board');
  const item = itemAtual();
  if (!painel || !item || !state.detalhesAbertos) {
    if (painel) painel.hidden = true;
    if (board) board.classList.remove('has-detail', 'has-ficha');
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

  // Duas abas só quando há duas coisas a dizer. Sem patamar não há resultado, e
  // uma aba "Resultado" vazia ao lado da única que tem conteúdo é ruído.
  const naFicha = !item.temMeta || state.aba === 'ficha';
  const abas = item.temMeta
    ? `<div class="goals-detail-tabs" role="tablist" aria-label="Faces deste indicador">
        <button type="button" role="tab" data-aba="resultado" id="goals-aba-resultado" aria-selected="${!naFicha}" aria-controls="goals-detail-painel" class="${naFicha ? '' : 'is-active'}">Resultado</button>
        <button type="button" role="tab" data-aba="ficha" id="goals-aba-ficha" aria-selected="${naFicha}" aria-controls="goals-detail-painel" class="${naFicha ? 'is-active' : ''}">Ficha técnica</button>
      </div>`
    : '';
  const painelAria = item.temMeta
    ? `role="tabpanel" aria-labelledby="goals-aba-${naFicha ? 'ficha' : 'resultado'}"`
    : '';

  painel.innerHTML = `<div class="goals-detail-content">
      <header class="goals-detail-head">
        <div>
          <p class="goals-detail-kicker">${escape(item.codigo)}</p>
          <h2 id="goals-detail-title">${escape(item.nome)}</h2>
        </div>
        <button class="goals-detail-close" type="button" aria-label="Fechar detalhes do indicador">×</button>
      </header>

      ${abas}

      <div id="goals-detail-painel" ${painelAria} class="goals-detail-painel">
        ${naFicha ? corpoFicha(item) : corpoResultado(item)}
      </div>
    </div>`;
  fechamentoDetalhe += 1;
  painel.classList.remove('is-closing', 'is-opening');
  painel.hidden = false;
  if (board) {
    board.classList.add('has-detail');
    // A ficha traz equações e uma legenda de símbolos que não cabem nos ~314px
    // da coluna lateral. Aqui a lista recolhe e o painel fica com a largura
    // toda, pela mesma transição de grade que abre e fecha o detalhe.
    board.classList.toggle('has-ficha', naFicha);
  }
  posicionaDetalhe();
  if (naFicha && !state.dossie) garanteDossie(item.codigo);

  if (state.animarDetalhe) {
    state.animarDetalhe = false;
    // No fluxo de uma coluna o detalhe é o último bloco da página, abaixo das
    // metas: sem levar a tela até ele, tocar numa linha não parecia ter feito
    // nada. A condição é a mesma do painel do Panorama em app.js.
    if (window.matchMedia('(max-width: 920px)').matches) {
      painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
  state.aba = 'resultado';
  renderList();
  if (board) board.classList.remove('has-ficha');
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

function abrirItem(codigo, { aba = null, animar = true } = {}) {
  const item = itemPorCodigo(codigo);
  if (!item) return;
  state.codigo = codigo;
  state.detalhesAbertos = true;
  state.animarDetalhe = animar;
  // Um indicador sem patamar não tem jornada nem gráfico: a ficha é o que ele
  // tem a dizer, e é ela que abre.
  state.aba = aba || (item.temMeta ? 'resultado' : 'ficha');
  renderList();
  renderDetail();
}

// ---------- lista ----------

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

function linhaDeMeta(meta, anterior) {
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

  const ativa = state.detalhesAbertos && meta.codigo === state.codigo ? ' is-active' : '';
  const expandida = state.detalhesAbertos && meta.codigo === state.codigo;
  return `<button type="button" data-codigo="${meta.codigo}" class="goals-row ${classe}${ativa}" aria-expanded="${expandida}" aria-controls="goals-detail">
    <span class="goals-row-name">${escape(meta.nome)}<small>meta ${patamar}${meta.prazo ? ` até ${meta.prazo}` : ''}</small></span>
    <span class="goals-row-bar" aria-hidden="true"><i class="resta"></i><i class="feito" data-meta-barra="${meta.codigo}" data-destino="${p}" style="width:${partida}%"></i>${rotulo}</span>
    <span class="goals-row-ler"><b>${leitura}</b><small>jornada</small></span>
    <span class="goals-row-open" aria-hidden="true">›</span>
  </button>`;
}

// Sem patamar não há barra a desenhar: o que a linha tem a dizer é em que pé
// está a coleta e por que ela não entra no quadro.
function linhaDeCatalogo(item) {
  const ativa = state.detalhesAbertos && item.codigo === state.codigo ? ' is-active' : '';
  const expandida = state.detalhesAbertos && item.codigo === state.codigo;
  return `<button type="button" data-codigo="${item.codigo}" class="goals-row is-catalog${ativa}" aria-expanded="${expandida}" aria-controls="goals-detail">
    <span class="goals-row-name">${escape(item.nome)}<small>${escape(item.motivo)}</small></span>
    <span class="goals-row-ler">${selo(item)}</span>
    <span class="goals-row-open" aria-hidden="true">›</span>
  </button>`;
}

function renderList() {
  const alvo = document.querySelector('#goals-list');
  if (!alvo) return;
  const lista = visiveis();
  const anterior = larguraAtualPorMeta();
  renderContagem(lista);

  if (!lista.length) {
    alvo.innerHTML = '<p class="indicator-empty">Nenhum indicador corresponde aos filtros selecionados.</p>';
    return;
  }

  // Agrupa por eixo, em ordem numérica: as duas listas de origem chegam separadas
  // e o eixo é o que as recosta uma na outra.
  const grupos = new Map();
  for (const item of lista) {
    if (!grupos.has(item.eixo)) grupos.set(item.eixo, { eixo: item.eixo, eixoNome: item.eixoNome, metas: [], catalogo: [] });
    grupos.get(item.eixo)[item.temMeta ? 'metas' : 'catalogo'].push(item);
  }

  alvo.innerHTML = [...grupos.values()].sort((a, b) => a.eixo - b.eixo).map(({ eixo, eixoNome, metas, catalogo }) => {
    const total = metas.length + catalogo.length;
    // As faixas são rótulos, não contadores: o total do eixo está no cabeçalho
    // logo acima, e escrever "4" e "19" ao lado dele seria dizer 23 três vezes.
    const faixaMetas = metas.length
      ? `<p class="goals-faixa">Metas com patamar mensurável</p>
         ${metas.map((meta) => linhaDeMeta(meta, anterior)).join('')}`
      : '';
    const faixaCatalogo = catalogo.length
      ? `<p class="goals-faixa">${metas.length ? 'Demais indicadores do eixo' : 'Indicadores do eixo'}</p>
         ${catalogo.map(linhaDeCatalogo).join('')}`
      : '';
    return `<section class="goals-eixo">
      <header class="goals-eixo-head">
        <span class="num" aria-hidden="true">${eixo}</span>
        <h3>${escape(eixoNome || `Eixo ${eixo}`)}</h3>
        <span>${total} ${total === 1 ? 'indicador' : 'indicadores'}</span>
      </header>
      ${faixaMetas}
      ${faixaCatalogo}
    </section>`;
  }).join('');

  animaBarras();
  posicionaDetalhe();
}

function renderAll() {
  renderEixoFilters();
  renderStatusFilters();
  renderFiltersSummary();
  renderList();
  renderDetail();
}

// Um filtro pode esconder o item aberto. Fechar o painel nesse caso evita o
// estado em que o detalhe fala de algo que a lista não mostra mais.
function aplicaFiltros() {
  if (state.codigo && !visiveis().some((item) => item.codigo === state.codigo)) {
    state.detalhesAbertos = false;
    state.aba = 'resultado';
  }
  renderAll();
}

// ---------- eventos ----------

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
    const button = event.target.closest('button[data-codigo]');
    if (!button) return;
    const mesmoItem = state.codigo === button.dataset.codigo;
    if (mesmoItem && state.detalhesAbertos) {
      fecharDetalheAnimado();
      return;
    }
    abrirItem(button.dataset.codigo);
  });

  const painelDetalhe = document.querySelector('#goals-detail');
  painelDetalhe.addEventListener('click', (event) => {
    if (event.target.closest('.goals-detail-close')) {
      fecharDetalheAnimado();
      return;
    }
    const aba = event.target.closest('[data-aba]');
    if (aba && aba.dataset.aba !== state.aba) {
      state.aba = aba.dataset.aba;
      state.animarDetalhe = true;
      renderDetail();
      requestAnimationFrame(() => painelDetalhe.querySelector(`[data-aba="${state.aba}"]`)?.focus({ preventScroll: true }));
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
    state.anosGrafico[state.codigo] = opcao.dataset.goalsChartYear;
    state.animarDetalhe = true;
    renderDetail();
    requestAnimationFrame(() => painelDetalhe.querySelector('[data-goals-year-toggle]')?.focus({ preventScroll: true }));
  });

  painelDetalhe.addEventListener('keydown', (event) => {
    const aba = event.target.closest('[data-aba]');
    if (aba && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      event.preventDefault();
      state.aba = state.aba === 'ficha' ? 'resultado' : 'ficha';
      state.animarDetalhe = true;
      renderDetail();
      requestAnimationFrame(() => painelDetalhe.querySelector(`[data-aba="${state.aba}"]`)?.focus({ preventScroll: true }));
      return;
    }
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

  document.querySelector('#goals-eixo-filters').addEventListener('click', (event) => {
    const botao = event.target.closest('[data-eixo]');
    if (!botao) return;
    const valor = botao.dataset.eixo;
    if (valor === 'all') state.eixos.clear();
    else if (state.eixos.has(valor)) state.eixos.delete(valor);
    else state.eixos.add(valor);
    aplicaFiltros();
  });

  document.querySelector('#goals-status-filters').addEventListener('click', (event) => {
    const botao = event.target.closest('[data-status]');
    if (!botao) return;
    state.status = botao.dataset.status;
    aplicaFiltros();
  });

  document.querySelector('#indicator-search').addEventListener('input', (event) => {
    state.busca = event.target.value;
    renderFiltersSummary();
    aplicaFiltros();
  });

  document.querySelector('#export-csv').addEventListener('click', baixarCsv);

  const exportGatilho = document.querySelector('[data-export-toggle]');
  exportGatilho.addEventListener('click', () => abreExport(document.querySelector('#export-opcoes').hidden));
  // Um link do menu leva para fora da página; o menu não pode ficar aberto por
  // baixo ao voltar pelo histórico.
  document.querySelector('#export-opcoes').addEventListener('click', (event) => {
    if (event.target.closest('a')) abreExport(false);
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#export-menu')) abreExport(false);
  }, { signal: sinalDaPagina() });

  // O botão só é exibido no celular, mas o vínculo é feito sempre: girar o
  // aparelho não recarrega a página, e o CSS é quem decide quando ele aparece.
  const filtros = document.querySelector('.filters-toggle');
  filtros.addEventListener('click', () => {
    const aberto = filtros.closest('.filters-card').classList.toggle('is-open');
    filtros.setAttribute('aria-expanded', String(aberto));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // O menu de downloads fecha primeiro: ele está por cima, e quem o abriu não
    // espera que o Esc feche o painel de detalhe atrás dele.
    if (!document.querySelector('#export-opcoes').hidden) {
      abreExport(false);
      exportGatilho.focus();
      return;
    }
    if (state.detalhesAbertos) fecharDetalheAnimado();
  }, { signal: sinalDaPagina() });

  // Trocar só o `#` não recarrega o documento: sem isto, seguir um link para
  // outro código dentro da própria página não faria nada.
  window.addEventListener('hashchange', () => {
    const codigo = codigoDoEndereco();
    if (codigo && codigo !== state.codigo) abrirItem(codigo);
  }, { signal: sinalDaPagina() });

  bindMenu();
  bindVista();
}

// ---------- entrada ----------

// `/metas#I1.3.2` abre a ficha daquele indicador. É o que sustenta o
// redirecionamento da antiga rota de indicadores, que apontava para códigos.
function codigoDoEndereco() {
  const bruto = decodeURIComponent(location.hash.replace(/^#/, '')).trim();
  return bruto && itemPorCodigo(bruto) ? bruto : null;
}

async function init() {
  state.data = await fetch('/data/metas.json').then(readResponse);
  state.uf = null;
  const doEndereco = codigoDoEndereco();
  state.codigo = doEndereco || state.data.metas[0]?.codigo || state.data.foraDoPainel[0]?.codigo || null;
  // A regra de qual aba abre é a mesma de um clique na lista, e mora num lugar só.
  state.aba = itemAtual()?.temMeta === false ? 'ficha' : 'resultado';
  renderFlags();
  bindEvents();
  renderAll();
  if (doEndereco) {
    document.querySelector('#goals-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

const ANCORA = '#goals-list';

aoEntrarNaPagina(ANCORA, () => init().catch((error) => {
  const alvo = document.querySelector('#goals-list');
  if (alvo) alvo.innerHTML = `<p class="load-error">${escape(error.message)} Atualize a página para tentar novamente.</p>`;
}));
