import { aoEntrarNaPagina, bindMenu, bindVista, decimals, escape, number, readResponse, sinalDaPagina } from './shared.js';
import { carregaDossie, carregaKatexSeNecessario, exportCsv, normalise, renderFicha, selo, statusOf } from './fichas.js';
import { idiomaAtual, rota, t, tp } from '../i18n/index.js';
import { campo, carregaConteudo, nomeDoEixo } from './conteudo.js';

// Nome e meta pactuada vêm do catálogo, em português, e a versão inglesa entra
// por sobreposição — ver conteudo.js.
function nomeDe(item) { return campo(item.codigo, 'nome', item.nome); }
function metaTextoDe(item) { return campo(item.codigo, 'meta', item.metaTexto); }
function motivoDe(item) { return t(item.motivo || ''); }

// A página reúne as duas leituras da mesma matriz: as metas com patamar
// mensurável, que têm jornada e gráfico, e o restante do catálogo, que só tem
// ficha. Eram duas rotas, e cada indicador aparecia nas duas com nome, eixo,
// meta pactuada e fonte escritos de novo. Aqui a meta é a espinha e a ficha é a
// segunda aba do painel de detalhe.
//
// As metas são da Amazônia Legal como um todo: a jornada dos eixos, a de cada
// meta e o cumprimento são sempre os da região. Os estados aparecem no detalhe,
// ao lado do valor regional, como complemento da leitura.
//
// A rota abre nos cinco eixos (`eixo: null`); escolher um mostra só os
// indicadores dele, e a busca vale dentro do eixo aberto.
const state = {
  data: null,
  eixo: null,
  codigo: null,
  aba: 'resultado',
  detalhesAbertos: true,
  animarDetalhe: false,
  anosGrafico: {},
  busca: '',
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
  if (ehPercentual(meta)) return t('pontos percentuais');
  return t(UNIDADES[String(meta.unidade || '').trim()] || '');
}

function valor(meta, value) {
  if (typeof value === 'string') return value;
  if (!Number.isFinite(value)) return '—';
  // Reais em escala curta, como nos coletados: "R$ 5,11 bi".
  if (String(meta.unidade || '').trim().startsWith('R$')) return valorColetado({ unidadeValor: meta.unidade }, value);
  if (ehPercentual(meta)) return `${number(value)}%`;
  // Área do PRODES, que o INPE publica em km².
  if (String(meta.unidade || '').trim() === 'km²') return `${number(value, decimals(value))} km²`;
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
  if (state.eixo && item.eixo !== state.eixo) return false;
  if (state.busca) {
    const palheiro = normalise([item.codigo, item.nome, nomeDe(item), item.metaTexto, metaTextoDe(item), item.fonte, item.eixoNome, item.linhaAcao].join(' '));
    if (!palheiro.includes(normalise(state.busca))) return false;
  }
  return true;
}

function visiveis() {
  return acervo().filter(passaNoFiltro);
}

// O resultado da meta é o da região. A CAPAG, que é uma classificação por
// estado, chega aqui como a parcela dos nove na faixa pedida.
function dadosDaMeta(meta) {
  const item = meta.regional;
  const progresso = item
    ? (item.cumpre ? 100 : (Number.isFinite(item.escala) ? Math.round(item.escala * 100) : 0))
    : 0;
  const semEscala = Boolean(item && !item.cumpre && !Number.isFinite(item.escala));
  return { item, progresso, semEscala };
}

// De onde partiu a jornada, em uma frase: a média da regra geral, o período
// citado na meta ou o ponto declarado nela.
function textoDaBaseline(meta, regional) {
  const base = regional?.baseline;
  if (!base) return t('não calculada: a série tem menos de 5 anos');
  const numero = valor(meta, base.valor);
  if (base.tipo === 'media') {
    return tp(base.janela === 10 ? '{valor}, média dos últimos 10 anos ({desde}–{ate})' : '{valor}, média dos últimos 5 anos ({desde}–{ate})', { valor: numero, desde: base.desde, ate: base.ate });
  }
  if (base.tipo === 'periodo') return tp('{valor}, média de {desde} a {ate}, o período citado na meta', { valor: numero, desde: base.desde, ate: base.ate });
  if (base.origem === 'atual') return tp('{valor}, o valor de {ano}, ano da baseline citada na meta', { valor: numero, ano: base.ano });
  if (base.origem === 'serie') return tp('{valor}, o valor da região em {ano}, ano da baseline citada na meta', { valor: numero, ano: base.ano });
  return base.ano ? tp('{valor}, declarada na meta ({ano})', { valor: numero, ano: base.ano }) : tp('{valor}, declarada na meta', { valor: numero });
}

function textoDaJornada(regional) {
  if (regional.escalaTipo === 'baseline') return t('quanto do caminho entre a baseline e a meta a região já percorreu.');
  if (!regional.cumpre && !Number.isFinite(regional.escala)) return t('sem escala: não há baseline para medir o caminho até uma meta zero.');
  if (regional.baseline) return t('a baseline já estava além da meta; a jornada é a posição do valor atual em relação a ela.');
  return t('sem baseline, é a posição do valor atual em relação à meta.');
}

function rotuloTipo(tipo) {
  return ({ declarada: t('Meta declarada'), inferida: t('Meta inferida'), derivada: t('Meta derivada da baseline') })[tipo]
    || t('Critério não informado');
}

// ---------- gráfico por estado ----------

function renderGrafico(meta) {
  const historico = Array.isArray(meta.historico) ? meta.historico : [];
  if (!historico.length) return `<p class="goals-chart-empty">${t('Não há valores anuais disponíveis para este indicador.')}</p>`;

  const anos = historico.map((item) => String(item.ano));
  const anoGuardado = String(state.anosGrafico[meta.codigo] || '');
  const ano = anos.includes(anoGuardado) ? anoGuardado : anos.at(-1);
  state.anosGrafico[meta.codigo] = ano;
  const recorte = historico.find((item) => String(item.ano) === ano);
  const opcoes = anos.slice().reverse().map((item) => `<li role="option" tabindex="-1" data-goals-chart-year="${escape(item)}" class="${item === ano ? 'is-selected' : ''}" aria-selected="${item === ano}">${escape(item)}</li>`).join('');
  const seletor = `<div class="goals-chart-year"><span>${t('Ano')}</span><div class="dropdown goals-year-dropdown${anos.length === 1 ? ' is-disabled' : ''}">
    <button type="button" class="dropdown-toggle" data-goals-year-toggle aria-haspopup="listbox" aria-expanded="false"${anos.length === 1 ? ' disabled aria-disabled="true"' : ''}>
      <span data-goals-year-value>${escape(ano)}</span>
      <svg class="dropdown-chevron" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <ul class="dropdown-menu" role="listbox" aria-label="${t('Selecionar ano')}" hidden>${opcoes}</ul>
  </div></div>`;

  if (meta.direcao === 'categoria') {
    const linhas = state.data.estados.map((estado) => {
      const nota = String(recorte?.valores?.[estado.uf] || '').trim().toUpperCase();
      const faixa = faixaCapag(nota);
      return faixa ? { ...estado, nota, faixa } : null;
    }).filter(Boolean);
    if (!linhas.length) {
      return `<div class="goals-detail-chart-head"><h3>${t('Amazônia Legal e estados')}</h3>${seletor}</div>
        <p class="goals-chart-empty">${tp('Não há classificações estaduais disponíveis para {ano}.', { ano: escape(ano) })}</p>`;
    }

    const ultimaFaixa = ESCALA_CAPAG.length - 1;
    const posicaoMeta = ESCALA_CAPAG.indexOf('B') / ultimaFaixa * 100;
    const barras = linhas.map((item) => {
      const largura = ESCALA_CAPAG.indexOf(item.faixa) / ultimaFaixa * 100;
      const cumpre = ESCALA_CAPAG.indexOf(item.faixa) >= ESCALA_CAPAG.indexOf('B');
      return `<div class="goals-chart-row goals-chart-row-category${cumpre ? ' is-met' : ''}" role="listitem" aria-label="${tp('{estado}: classificação {nota}', { estado: escape(item.name), nota: escape(item.nota) })}">
        <span class="goals-chart-uf">${escape(item.uf)}</span>
        <span class="goals-chart-track" aria-hidden="true">
          <i class="goals-chart-fill" style="width:${largura.toFixed(2)}%"></i>
          <i class="goals-chart-target" style="left:${posicaoMeta.toFixed(2)}%"></i>
        </span>
        <b>${escape(item.nota)}</b>
      </div>`;
    }).join('');
    const escala = ESCALA_CAPAG.map((faixa, indice) => `<span style="left:${(indice / ultimaFaixa * 100).toFixed(2)}%">${escape(faixa)}</span>`).join('');

    return `<div class="goals-detail-chart-head"><h3>${t('Valores por estado')}</h3>${seletor}</div>
      <div class="goals-chart-bars" role="list" aria-label="${tp('Classificação CAPAG dos estados em {ano}', { ano: escape(ano) })}">${barras}</div>
      <div class="goals-chart-scale" aria-label="${t('Escala CAPAG, de D a A mais')}">${escala}</div>
      <p class="goals-chart-legend"><i aria-hidden="true"></i> ${t('meta mínima: B')}</p>`;
  }

  // O marcador de cada estado é o mesmo patamar da meta, quando ela tem um que se
  // aplica a cada um; um acréscimo em reais sobre a região não tem.
  const estados = state.data.estados.map((estado) => {
    const valorEstado = Number(recorte?.valores?.[estado.uf]);
    const alvoEstado = meta.estados?.[estado.uf]?.alvo ?? meta.alvo;
    return Number.isFinite(valorEstado) ? { ...estado, valor: valorEstado, alvo: typeof alvoEstado === 'number' ? alvoEstado : NaN } : null;
  }).filter(Boolean);
  const valorRegional = Number.isFinite(recorte?.regional) ? recorte.regional : null;
  const alvoRegional = Number(meta.regional?.alvo ?? meta.alvo);
  const linhaRegional = Number.isFinite(valorRegional)
    ? [{ uf: 'AL', name: 'Amazônia Legal', valor: valorRegional, alvo: alvoRegional, regional: true }]
    : [];
  const linhas = [...linhaRegional, ...estados];
  if (!linhas.length) {
    return `<div class="goals-detail-chart-head"><h3>${t('Amazônia Legal e estados')}</h3>${seletor}</div>
      <p class="goals-chart-empty">${tp('Não há valores estaduais disponíveis para {ano}.', { ano: escape(ano) })}</p>`;
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
    const regional = item.regional ? ' is-regional' : '';
    return `<div class="goals-chart-row${regional}${cumpre ? ' is-met' : ''}" role="listitem" aria-label="${escape(item.name)}: ${escape(valor(meta, item.valor))}">
      <span class="goals-chart-uf">${escape(item.uf)}</span>
      <span class="goals-chart-track" aria-hidden="true">
        <i class="goals-chart-fill" style="width:${largura.toFixed(2)}%"></i>
        ${posicaoAlvo === null ? '' : `<i class="goals-chart-target" style="left:${posicaoAlvo.toFixed(2)}%"></i>`}
      </span>
      <b>${escape(valor(meta, item.valor))}</b>
    </div>`;
  }).join('');

  return `<div class="goals-detail-chart-head"><h3>${t('Amazônia Legal e estados')}</h3>${seletor}</div>
    <div class="goals-chart-bars" role="list" aria-label="${tp('Valor da Amazônia Legal e dos estados em {ano}', { ano: escape(ano) })}">${barras}</div>
    <p class="goals-chart-legend"><i aria-hidden="true"></i> ${t('marcador da meta')}</p>`;
}

// ---------- os cinco eixos ----------

// Nome curto de cada eixo para as abas do eixo aberto, onde os cinco nomes
// inteiros não cabem numa linha. O nome inteiro vem dos dados (nomeDoEixo) e
// fica no `title` da aba.
function nomeCurtoDoEixo(eixo) {
  return ({ 1: t('Território'), 2: t('Pessoas'), 3: t('Economia'), 4: t('Infraestrutura'), 5: t('Governança') })[eixo]
    || tp('Eixo {n}', { n: eixo });
}

// A jornada de uma meta como fração de 0 a 1, com a mesma regra do cartão da
// meta (dadosDaMeta): cumprida vale 1; sem escala, a meta fica fora da média.
function fracaoDaJornada(meta) {
  const { item } = dadosDaMeta(meta);
  if (!item) return null;
  if (item.cumpre) return 1;
  return Number.isFinite(item.escala) ? item.escala : null;
}

/**
 * O que o cartão e o cabeçalho de um eixo dizem dele: a jornada média das metas
 * com escala, quantas ficaram fora da média, e a situação da coleta de todos os
 * indicadores do eixo. A média é simples — cada meta pesa o mesmo.
 */
function resumoDoEixo(eixo) {
  const itens = acervo().filter((item) => item.eixo === eixo);
  const metas = itens.filter((item) => item.temMeta);
  const fracoes = metas.map(fracaoDaJornada).filter((fracao) => fracao !== null);
  const situacao = { coletado: 0, parcial: 0, pendente: 0 };
  for (const item of itens) situacao[statusOf(item)] += 1;
  return {
    eixo,
    nome: nomeDoEixo(eixo, itens[0]?.eixoNome) || tp('Eixo {n}', { n: eixo }),
    total: itens.length,
    metas: metas.length,
    comEscala: fracoes.length,
    semEscala: metas.length - fracoes.length,
    comValores: itens.filter((item) => item.temMeta || item.temValores).length,
    situacao,
    jornada: fracoes.length ? fracoes.reduce((soma, fracao) => soma + fracao, 0) / fracoes.length : null
  };
}

function eixosDoAcervo() {
  return [...new Set(acervo().map((item) => item.eixo))].sort((a, b) => a - b);
}

const porcentagem = (fracao) => `${Math.round(fracao * 100)}%`;

// Rótulo de duas linhas ao lado do número grande: a primeira palavra em cima.
function rotuloEmDuasLinhas(texto) {
  const [primeira, ...resto] = texto.split(' ');
  return resto.length ? `${escape(primeira)}<br>${escape(resto.join(' '))}` : escape(primeira);
}

function notaDaJornada(resumo) {
  if (!resumo.metas) return tp('{n} de {total} indicadores já têm valores', { n: resumo.comValores, total: resumo.total });
  const media = tp(resumo.comEscala === 1 ? 'média de {n} meta' : 'média de {n} metas', { n: resumo.comEscala });
  return resumo.semEscala ? `${media} · ${tp('{n} sem escala', { n: resumo.semEscala })}` : media;
}

function leituraDaJornada(resumo) {
  const vazio = resumo.jornada === null;
  const rotulo = resumo.metas
    ? `<span>${rotuloEmDuasLinhas(t('Jornada do eixo'))}</span>`
    : `<span class="is-texto">${t('sem meta com patamar mensurável')}</span>`;
  const barra = vazio
    ? '<span class="eixo-barra" aria-hidden="true"></span>'
    : `<span class="eixo-barra" aria-hidden="true"><i class="resta"></i><i class="feito" style="width:${(resumo.jornada * 100).toFixed(1)}%"></i></span>`;
  return `<div class="eixo-leitura"><b${vazio ? ' class="is-vazio"' : ''}>${vazio ? '—' : porcentagem(resumo.jornada)}</b>${rotulo}</div>
    ${barra}
    <p class="eixo-nota">${escape(notaDaJornada(resumo))}</p>`;
}

const ROTULO_SITUACAO = {
  coletado: ['{n} coletado', '{n} coletados'],
  parcial: ['{n} parcial', '{n} parciais'],
  pendente: ['{n} pendente', '{n} pendentes']
};

function situacaoDaColeta(resumo) {
  const presentes = Object.entries(resumo.situacao).filter(([, n]) => n);
  const segmentos = presentes.map(([chave, n]) => `<i class="is-${chave}" style="flex-grow:${n}"></i>`).join('');
  const legenda = presentes.map(([chave, n]) => `<span><i class="is-${chave}"></i>${escape(tp(ROTULO_SITUACAO[chave][n === 1 ? 0 : 1], { n }))}</span>`).join('');
  return `<span class="eixo-coleta-barra" aria-hidden="true">${segmentos}</span>
    <span class="eixo-legenda">${legenda}</span>`;
}

// O que cada eixo é, numa frase: o texto da lâmina "Eixos" da Visão Geral, que a
// página entrega já na língua dela (PaginaMetas.astro, data-textos).
function textosDosEixos(alvo) {
  try {
    return JSON.parse(alvo.dataset.textos || '{}');
  } catch {
    return {};
  }
}

function renderEixos() {
  const alvo = document.querySelector('#eixos-cartoes');
  if (!alvo) return;
  const textos = textosDosEixos(alvo);
  alvo.innerHTML = eixosDoAcervo().map((eixo) => {
    const resumo = resumoDoEixo(eixo);
    // Nome e texto dividem a primeira faixa do cartão: é ela que se alinha entre
    // os vizinhos da mesma fileira (subgrade), então o percentual fica na mesma altura.
    return `<a class="eixo-cartao" href="#eixo-${eixo}" data-ir-eixo="${eixo}">
      <div class="eixo-cartao-cabeca">
        <h3 class="eixo-cartao-nome">${escape(resumo.nome)}</h3>
        ${textos[eixo] ? `<p class="eixo-cartao-texto">${escape(textos[eixo])}</p>` : ''}
      </div>
      <span class="eixo-cartao-jornada">${leituraDaJornada(resumo)}</span>
      <span class="eixo-cartao-coleta">
        <span class="eixo-contagem"><span><b>${resumo.total}</b> ${t('indicadores')}</span><span><b>${resumo.metas}</b> ${t('com meta')}</span></span>
        ${situacaoDaColeta(resumo)}
      </span>
      <span class="eixo-cartao-ver">${escape(tp('Ver os {n} indicadores', { n: resumo.total }))} ›</span>
    </a>`;
  }).join('');
}

function renderCabecalhoDoEixo() {
  const abas = document.querySelector('#eixo-abas');
  const corpo = document.querySelector('#eixo-resumo');
  if (!abas || !corpo || !state.eixo) return;
  abas.innerHTML = eixosDoAcervo().map((eixo) => {
    const resumo = resumoDoEixo(eixo);
    const atual = eixo === state.eixo;
    return `<a class="eixo-aba" href="#eixo-${eixo}" data-ir-eixo="${eixo}" title="${escape(resumo.nome)}"${atual ? ' aria-current="page"' : ''}>${escape(nomeCurtoDoEixo(eixo))}<small>${resumo.jornada === null ? '—' : porcentagem(resumo.jornada)}</small></a>`;
  }).join('');
  // No celular as abas rolam de lado: a do eixo aberto fica no meio da faixa.
  const abaAtual = abas.querySelector('[aria-current]');
  if (abaAtual && abas.scrollWidth > abas.clientWidth) {
    const deslocamento = abaAtual.getBoundingClientRect().left - abas.getBoundingClientRect().left;
    abas.scrollLeft += deslocamento - (abas.clientWidth - abaAtual.offsetWidth) / 2;
  }

  const resumo = resumoDoEixo(state.eixo);
  const coletados = resumo.total ? resumo.situacao.coletado / resumo.total : 0;
  corpo.innerHTML = `<h2 id="eixo-titulo" class="eixo-titulo" tabindex="-1">${escape(resumo.nome)}</h2>
    <div class="eixo-metricas">
      <div class="eixo-metrica">${leituraDaJornada(resumo)}</div>
      <div class="eixo-metrica">
        <div class="eixo-leitura"><b>${porcentagem(coletados)}</b><span>${rotuloEmDuasLinhas(t('Coleta do eixo'))}</span></div>
        ${situacaoDaColeta(resumo)}
      </div>
    </div>`;
}

// Uma vista de cada vez: os cinco eixos, ou o eixo aberto com a lista e o detalhe.
function renderVista() {
  const visao = document.querySelector('[data-eixos-visao]');
  const aberto = document.querySelector('[data-eixo-aberto]');
  if (visao) visao.hidden = Boolean(state.eixo);
  if (aberto) aberto.hidden = !state.eixo;
}

// ---------- busca e exportação ----------

function renderContagem(lista) {
  const alvo = document.querySelector('[data-lista-resumo]');
  if (!alvo) return;
  const comMeta = lista.filter((item) => item.temMeta).length;
  // O destaque dos números fica aqui, e não no texto editável da administração.
  alvo.innerHTML = tp(lista.length === 1 ? '{total} indicador · {comMeta} com meta mensurável' : '{total} indicadores · {comMeta} com meta mensurável', { total: `<span>${lista.length}</span>`, comMeta: `<span>${comMeta}</span>` });
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
  if (botao) { botao.disabled = true; botao.textContent = t('Preparando…'); }
  try {
    const dossie = await carregaDossie();
    state.dossie = dossie;
    exportCsv(visiveis(), dossie.indicadores);
    abreExport(false);
  } catch {
    if (botao) botao.textContent = t('Não foi possível exportar');
    return;
  } finally {
    if (botao) { botao.disabled = false; if (botao.textContent === t('Preparando…')) botao.textContent = rotulo; }
  }
}

// ---------- painel lateral de detalhes ----------

// As metas com patamar mostram a jornada; os coletados sem meta numérica, o que
// o dado diz sozinho (ver corpoColetado). Um indicador sem valores não tem
// resultado: o painel abre direto na ficha, e a meta pactuada viaja com ela.
function corpoResultado(meta) {
  if (!meta.temMeta) return corpoColetado(meta);
  const { item: regional, progresso, semEscala } = dadosDaMeta(meta);
  const valorAtual = regional ? valor(meta, regional.valor) : t('Sem dado');
  const alvo = regional
    ? `${meta.direcao === 'menor' ? '≤ ' : ''}${valor(meta, regional.alvo)}${meta.prazo ? ` ${tp('até {prazo}', { prazo: meta.prazo })}` : ''}`
    : '—';
  const jornada = semEscala || !regional ? t('Sem escala') : `${progresso}%`;
  const leitura = regional
    ? `<p class="goals-detail-method"><strong>${t('Jornada:')}</strong> ${escape(textoDaJornada(regional))}</p>
      <p class="goals-detail-method"><strong>${t('Leitura regional:')}</strong> ${escape(t(regional.metodoRotulo))}.${regional.nota ? ` ${escape(regional.nota)}` : ''}</p>`
    : '';

  // A meta pactuada abre o painel, no mesmo destaque dos coletados sem meta
  // numérica: é o compromisso que os números abaixo medem.
  const prazo = meta.prazo ? ` · ${tp('até {prazo}', { prazo: meta.prazo })}` : '';

  return `
    <section class="coletado-meta">
      <h3>${t('Meta pactuada')}${escape(prazo)}</h3>
      <p class="coletado-meta-texto">${escape(metaTextoDe(meta) || t('Meta não informada.'))}</p>
    </section>

    <dl class="goals-detail-summary">
      <div><dt>${t('Valor atual')}</dt><dd>${escape(valorAtual)}</dd></div>
      <div><dt>${t('Meta')}</dt><dd>${escape(alvo)}</dd></div>
      <div><dt>${t('Jornada')}</dt><dd>${escape(jornada)}</dd></div>
    </dl>

    <section class="goals-detail-chart">
      ${renderGrafico(meta)}
    </section>

    <section class="goals-detail-section">
      <h3>${t('Critério do patamar')}</h3>
      <dl class="goals-detail-facts">
        <div><dt>${t('Referência')}</dt><dd>${escape(meta.anoRef || t('Não informada'))}</dd></div>
        <div><dt>${t('Critério')}</dt><dd>${escape(rotuloTipo(meta.tipo))}</dd></div>
        ${regional ? `<div class="is-wide"><dt>${t('Baseline')}</dt><dd>${escape(textoDaBaseline(meta, regional))}</dd></div>` : ''}
      </dl>
      ${leitura}
    </section>`;
}

// ---------- coletados sem meta numérica ----------
//
// Têm valores, mas a meta não tem patamar para confrontar (o motivo de cada um
// está em `exclusoes`, conteudo/metas.json). Sem jornada, o cartão e a aba
// Resultado contam o que o dado diz sozinho: quanto a Amazônia Legal soma hoje,
// como chegou até aqui e em que momento cada estado cresceu. O valor regional
// só existe quando `semMeta` declara que ele é a soma dos estados; taxas e
// índices ficam com os nove lado a lado.

const ROTULO_UNIDADE = {
  'nº de vínculos': 'vínculos',
  'nº de municípios': 'municípios',
  'taxa / 100 mil': 'por 100 mil hab.',
  equipes: 'equipes'
};

function ehReais(item) { return String(item.unidadeValor || '').trim().startsWith('R$'); }

// A PEVS e a PIA publicam em mil reais; a página escreve em reais.
function emReais(item, bruto) { return String(item.unidadeValor || '').trim() === 'R$ (mil)' ? bruto * 1000 : bruto; }

function rotuloUnidade(item) {
  if (ehReais(item)) return 'R$';
  const unidade = String(item.unidadeValor || '').trim();
  return t(ROTULO_UNIDADE[unidade] || unidade);
}

function escalaCurta(valorEmReais) {
  const absoluto = Math.abs(valorEmReais);
  if (absoluto >= 1e9) return { divisor: 1e9, sufixo: t('bi') };
  if (absoluto >= 1e6) return { divisor: 1e6, sufixo: t('mi') };
  if (absoluto >= 1e4) return { divisor: 1e3, sufixo: t('mil') };
  return { divisor: 1, sufixo: '' };
}

// "215 bi", "6,19 mi", "40": o número sem a unidade.
function numeroCurto(item, bruto) {
  if (!Number.isFinite(bruto)) return '—';
  const { divisor, sufixo } = escalaCurta(emReais(item, bruto));
  const escalado = emReais(item, bruto) / divisor;
  const absoluto = Math.abs(escalado);
  const casas = divisor === 1
    ? (Number.isInteger(escalado) ? 0 : decimals(escalado))
    : (absoluto >= 100 ? 0 : absoluto >= 10 ? 1 : 2);
  return `${number(escalado, casas)}${sufixo ? ` ${sufixo}` : ''}`;
}

// Com a unidade: "R$ 215 bi", "6,19 mi vínculos".
function valorColetado(item, bruto) {
  if (!Number.isFinite(bruto)) return '—';
  return ehReais(item) ? `R$ ${numeroCurto(item, bruto)}` : `${numeroCurto(item, bruto)} ${rotuloUnidade(item)}`;
}

function nomeDoEstado(uf) {
  return state.data.estados.find((estado) => estado.uf === uf)?.name || uf;
}

function serieDe(porAno) {
  return Object.entries(porAno || {})
    .map(([ano, v]) => ({ ano: Number(ano), valor: v }))
    .filter((ponto) => Number.isFinite(ponto.valor))
    .sort((a, b) => a.ano - b.ano);
}

// A série em foco é a da região, como nas metas; os estados vêm nas faixas.
function focoColetado(item) {
  return { lugar: t('Amazônia Legal'), serie: item.serieRegional || [], atual: item.regionalAtual || null };
}

// Variação do primeiro ao último ano e ritmo composto ao ano. Sem sentido
// quando a série parte de zero ou de um valor negativo (devoluções).
function variacao(serie) {
  if (serie.length < 2 || serie[0].valor <= 0) return null;
  return (serie.at(-1).valor / serie[0].valor - 1) * 100;
}

function ritmo(serie) {
  if (serie.length < 2) return null;
  const primeiro = serie[0], ultimo = serie.at(-1);
  if (primeiro.valor <= 0 || ultimo.valor <= 0 || ultimo.ano === primeiro.ano) return null;
  return ((ultimo.valor / primeiro.valor) ** (1 / (ultimo.ano - primeiro.ano)) - 1) * 100;
}

function textoVariacao(percentual) {
  if (percentual === null) return '—';
  return `${percentual >= 0 ? '+' : '−'}${number(Math.abs(percentual), 0)}%`;
}

function textoRitmo(percentual) {
  if (percentual === null) return '—';
  return `${percentual < 0 ? '−' : ''}${number(Math.abs(percentual), 1)}%`;
}

function anosEntre(series) {
  const anos = series.flatMap((serie) => serie.map((ponto) => ponto.ano));
  if (!anos.length) return [];
  const primeiro = Math.min(...anos);
  return Array.from({ length: Math.max(...anos) - primeiro + 1 }, (_, indice) => primeiro + indice);
}

// Uma célula por ano, do primeiro ao último do eixo, e o ano sem valor fica em
// branco: é o que mantém a faixa da região e as dos estados alinhadas coluna a
// coluna. Cada faixa tem a própria escala — mais escuro, maior valor dela.
function celulasDeCalor(serie, anos, dica = null) {
  const porAno = new Map(serie.map((ponto) => [ponto.ano, ponto.valor]));
  const maximo = Math.max(0, ...serie.map((ponto) => ponto.valor));
  return anos.map((ano) => {
    const v = porAno.get(ano);
    if (!Number.isFinite(v)) return `<i class="is-vazio" data-ano="${ano}"></i>`;
    const fracao = maximo > 0 ? Math.max(0, v) / maximo : 0;
    return `<i data-ano="${ano}" style="background:rgba(14,43,34,${(0.06 + 0.86 * fracao).toFixed(2)})"${dica ? ` data-dica="${escape(dica(ano, v))}"` : ''}></i>`;
  }).join('');
}

// Sem série anual: os nove estados como pontos numa régua, com os extremos nomeados.
function pontosDosEstados(item) {
  const lista = state.data.estados
    .map((estado) => ({ uf: estado.uf, v: item.valores?.[estado.uf] }))
    .filter((ponto) => Number.isFinite(ponto.v));
  if (!lista.length) return '';
  const minimo = Math.min(...lista.map((ponto) => ponto.v));
  const maximo = Math.max(...lista.map((ponto) => ponto.v));
  const posicao = (v) => (maximo > minimo ? 4 + (v - minimo) / (maximo - minimo) * 92 : 50);
  const extremos = maximo > minimo ? [lista.find((p) => p.v === minimo), lista.find((p) => p.v === maximo)] : [];
  return `<span class="coletado-pontos" aria-hidden="true">
    ${lista.map((ponto) => `<i style="left:${posicao(ponto.v).toFixed(1)}%"></i>`).join('')}
    ${extremos.map((ponto) => `<span style="left:${posicao(ponto.v).toFixed(1)}%">${escape(ponto.uf)}</span>`).join('')}
  </span>`;
}

function linhaDeColetado(item) {
  const ativa = state.detalhesAbertos && item.codigo === state.codigo ? ' is-active' : '';
  const expandida = state.detalhesAbertos && item.codigo === state.codigo;
  const { lugar, serie, atual } = focoColetado(item);
  const unidade = escape(rotuloUnidade(item));
  let ler;
  let sub;
  let corpo;
  if (atual) {
    ler = `<span class="goals-row-lugar">${escape(lugar)}</span><b>${escape(numeroCurto(item, atual.valor))}</b><small>${unidade}${atual.ano ? ` · ${atual.ano}` : ''}</small>`;
  } else {
    // Sem valor regional: a amplitude entre os estados.
    const valores = Object.values(item.valores || {}).filter(Number.isFinite);
    const faixa = valores.length ? `${numeroCurto(item, Math.min(...valores))}–${numeroCurto(item, Math.max(...valores))}` : '—';
    ler = `<span class="goals-row-lugar">${t('Estados')}</span><b class="is-faixa">${escape(faixa)}</b><small>${unidade}</small>`;
  }
  if (serie.length >= 2) {
    const percentual = variacao(serie);
    sub = percentual === null
      ? tp('série desde {ano}', { ano: serie[0].ano })
      : tp('{variacao} desde {ano}', { variacao: `<b>${textoVariacao(percentual)}</b>`, ano: serie[0].ano });
    const anos = anosEntre([serie]);
    corpo = `<span class="coletado-calor" aria-hidden="true" style="grid-template-columns:repeat(${anos.length},minmax(0,1fr))">${celulasDeCalor(serie, anos)}</span>`;
  } else {
    sub = item.agregacao ? t('sem série anual') : t('sem valor regional');
    corpo = pontosDosEstados(item);
  }
  return `<button type="button" data-codigo="${item.codigo}" class="goals-row is-coletado${ativa}" aria-expanded="${expandida}" aria-controls="goals-detail">
    <span class="goals-row-ler">${ler}</span>
    <span class="goals-card-body">
      <span class="goals-row-name">${escape(nomeDe(item))}<small>${sub}</small></span>
      ${corpo}
    </span>
  </button>`;
}

// Marcas redondas do eixo Y, a partir do zero. Contagens (municípios, vínculos)
// andam de número inteiro em número inteiro: "12,5 municípios" não existe.
function marcasDoEixo(minimo, maximo, inteiro) {
  const baixo = Math.min(0, minimo);
  const alto = Math.max(0, maximo);
  const amplitude = alto - baixo || 1;
  const bruto = amplitude / 4;
  const ordem = 10 ** Math.floor(Math.log10(bruto));
  const multiplos = inteiro && ordem < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  let passo = multiplos.map((m) => m * ordem).find((p) => p >= bruto * (1 - 1e-9));
  if (inteiro) passo = Math.max(1, passo);
  const inicio = Math.floor(baixo / passo) * passo;
  const fim = Math.max(inicio + passo, Math.ceil(alto / passo) * passo);
  const marcas = [];
  for (let k = 0; inicio + k * passo <= fim + passo * 1e-6; k += 1) marcas.push(Number((inicio + k * passo).toPrecision(12)));
  return { marcas, passo };
}

function marcasDeAno(primeiro, ultimo) {
  const passo = ultimo - primeiro > 20 ? 10 : ultimo - primeiro > 8 ? 5 : 2;
  const marcas = [primeiro];
  for (let ano = Math.ceil(primeiro / passo) * passo; ano < ultimo; ano += passo) {
    // O último ano vai alinhado à direita, então precisa de mais folga à esquerda dele.
    if (ano - primeiro >= passo / 2 && ultimo - ano > passo / 2) marcas.push(ano);
  }
  if (ultimo !== primeiro) marcas.push(ultimo);
  return marcas;
}

// Linha da série em foco com eixo Y. Cada ano tem uma área de toque que leva a
// dica e o marcador até ele (ver mostraDica); pelo teclado, as setas percorrem os anos.
function graficoColetado(item, lugar, serie) {
  const W = 400, H = 196, y0 = 12, y1 = 162, x1 = W - 12;
  const valores = serie.map((ponto) => ponto.valor);
  const { marcas, passo } = marcasDoEixo(Math.min(...valores), Math.max(...valores), valores.every(Number.isInteger));
  // Um só divisor para o eixo inteiro, escolhido pela maior marca: "900 mi" e
  // "1 bi" no mesmo eixo obrigariam a ler duas escalas.
  const { divisor, sufixo } = escalaCurta(Math.max(...marcas.map((v) => Math.abs(emReais(item, v)))));
  const passoEscalado = emReais(item, passo) / divisor;
  const redondo = (x) => Math.abs(x - Math.round(x)) < 1e-9;
  const casas = redondo(passoEscalado) ? 0 : redondo(passoEscalado * 10) ? 1 : 2;
  const rotulo = (v) => (v === 0 ? '0' : `${number(emReais(item, v) / divisor, casas)}${sufixo ? ` ${sufixo}` : ''}`);
  const x0 = Math.max(30, Math.max(...marcas.map((v) => rotulo(v).length)) * 7.4 + 10);
  const primeiro = serie[0].ano, ultimo = serie.at(-1).ano;
  const px = (ano) => x0 + (ano - primeiro) / ((ultimo - primeiro) || 1) * (x1 - x0);
  const vMin = marcas[0], vMax = marcas.at(-1);
  const py = (v) => y1 - (v - vMin) / ((vMax - vMin) || 1) * (y1 - y0);
  const grade = marcas.map((v) => `<line x1="${x0}" x2="${x1}" y1="${py(v).toFixed(1)}" y2="${py(v).toFixed(1)}"${v === 0 ? ' class="is-zero"' : ''}/><text x="${(x0 - 6).toFixed(1)}" y="${(py(v) + 4.5).toFixed(1)}" text-anchor="end">${escape(rotulo(v))}</text>`).join('');
  const pontos = serie.map((ponto) => `${px(ponto.ano).toFixed(1)},${py(ponto.valor).toFixed(1)}`).join(' ');
  const base = py(Math.max(vMin, 0)).toFixed(1);
  const anos = marcasDeAno(primeiro, ultimo).map((ano) => `<text x="${px(ano).toFixed(1)}" y="${H - 8}" text-anchor="${ano === ultimo && ano !== primeiro ? 'end' : 'middle'}">${ano}</text>`).join('');
  const alvos = serie.map((ponto, indice) => {
    const x = px(ponto.ano);
    const antes = indice ? (px(serie[indice - 1].ano) + x) / 2 : x0 - 6;
    const depois = indice < serie.length - 1 ? (x + px(serie[indice + 1].ano)) / 2 : W;
    return `<rect class="coletado-alvo" x="${antes.toFixed(1)}" y="0" width="${(depois - antes).toFixed(1)}" height="${y1 + 6}" data-ano="${ponto.ano}" data-x="${x.toFixed(1)}" data-y="${py(ponto.valor).toFixed(1)}" data-dica="${escape(`${ponto.ano}: ${valorColetado(item, ponto.valor)}`)}"/>`;
  }).join('');
  const fim = serie.at(-1);
  const descricao = tp('{lugar}: {inicio} em {primeiro} e {fim} em {ultimo}. Use as setas para percorrer os anos.', {
    lugar, inicio: valorColetado(item, serie[0].valor), primeiro, fim: valorColetado(item, fim.valor), ultimo
  });
  return `<div class="coletado-interativo coletado-grafico" tabindex="0" role="group" aria-label="${escape(descricao)}">
      <svg class="coletado-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">
        <g class="coletado-grade">${grade}</g>
        <polygon class="coletado-area" points="${px(primeiro).toFixed(1)},${base} ${pontos} ${px(ultimo).toFixed(1)},${base}"/>
        <polyline class="coletado-linha" points="${pontos}"/>
        <circle class="coletado-fim" cx="${px(fim.ano).toFixed(1)}" cy="${py(fim.valor).toFixed(1)}" r="4"/>
        <g class="coletado-marcador"><line y1="${y0 - 4}" y2="${y1}"/><circle r="4.5"/></g>
        <g class="coletado-anos-eixo">${anos}</g>
        ${alvos}
      </svg>
      <div class="coletado-dica" role="status" hidden></div>
    </div>`;
}

// A região no topo, depois os nove estados do maior para o menor valor atual,
// todos no mesmo eixo de anos.
function faixasDosEstados(item) {
  const regional = item.serieRegional || [];
  const estados = state.data.estados
    .map((estado) => ({ uf: estado.uf, serie: serieDe(item.serieAnual?.[estado.uf]), atual: item.valores?.[estado.uf] }))
    .sort((a, b) => (Number.isFinite(b.atual) ? b.atual : -Infinity) - (Number.isFinite(a.atual) ? a.atual : -Infinity));
  const anos = anosEntre([regional, ...estados.map((estado) => estado.serie)]);
  if (anos.length < 2) return '';
  const colunas = `grid-template-columns:repeat(${anos.length},minmax(0,1fr))`;
  const linha = (sigla, nome, serie, classe) => `<div class="coletado-faixa${classe}">
      <span class="uf" title="${escape(nome)}">${escape(sigla)}</span>
      <span class="coletado-cel" style="${colunas}">${celulasDeCalor(serie, anos, (ano, v) => `${nome} · ${ano}: ${valorColetado(item, v)}`)}</span>
      <span class="rt">${serie.length >= 2 ? escape(textoRitmo(ritmo(serie))) : '—'}</span>
    </div>`;
  const linhas = [
    regional.length ? linha('AL', t('Amazônia Legal'), regional, ' is-regional') : '',
    ...estados.map((estado) => linha(estado.uf, nomeDoEstado(estado.uf), estado.serie, ''))
  ].join('');
  return `<section class="goals-detail-section coletado-secao">
      <h3>${regional.length ? t('A região e o momento de cada estado') : t('O momento de cada estado')}<em>${t('ritmo ao ano')}</em></h3>
      <div class="coletado-interativo">
        <div class="coletado-faixas">${linhas}</div>
        <div class="coletado-anos"><span>${anos[0]}</span><span>${anos.at(-1)}</span></div>
        <div class="coletado-dica" role="status" hidden></div>
      </div>
      <p class="goals-detail-method">${t('Cada linha na própria escala: o tom mais escuro é o maior valor dela no período.')}</p>
    </section>`;
}

// Sem série anual (mortalidade evitável, equipes da APS): os nove em barras.
function barrasDosEstados(item) {
  const lista = state.data.estados
    .map((estado) => ({ ...estado, v: item.valores?.[estado.uf] }))
    .filter((estado) => Number.isFinite(estado.v))
    .sort((a, b) => b.v - a.v);
  if (!lista.length) return '';
  const maximo = Math.max(...lista.map((estado) => estado.v), 0);
  const barras = lista.map((estado) => `<div class="goals-chart-row" role="listitem" aria-label="${escape(estado.name)}: ${escape(valorColetado(item, estado.v))}">
      <span class="goals-chart-uf">${escape(estado.uf)}</span>
      <span class="goals-chart-track" aria-hidden="true"><i class="goals-chart-fill" style="width:${(maximo > 0 ? Math.max(0, estado.v) / maximo * 100 : 0).toFixed(2)}%"></i></span>
      <b>${escape(numeroCurto(item, estado.v))}</b>
    </div>`).join('');
  return `<section class="goals-detail-section coletado-secao">
      <h3>${t('Estados')}<em>${escape(rotuloUnidade(item))}${item.anoRef ? ` · ${escape(tp('ref. {ano}', { ano: item.anoRef }))}` : ''}</em></h3>
      <div class="goals-chart-bars" role="list">${barras}</div>
    </section>`;
}

function corpoColetado(item) {
  const { lugar, serie, atual } = focoColetado(item);
  // A meta pactuada é o primeiro destaque: é ela que o indicador acompanha,
  // mesmo sem patamar para medir a distância. O motivo vem logo abaixo.
  const prazo = item.prazo ? ` · ${tp('até {prazo}', { prazo: item.prazo })}` : '';
  const metaTopo = `<section class="coletado-meta">
      <h3>${t('Meta pactuada')}${escape(prazo)}</h3>
      <p class="coletado-meta-texto">${escape(metaTextoDe(item) || t('Meta não informada.'))}</p>
      ${item.motivo ? `<p class="coletado-meta-motivo">${escape(motivoDe(item))}</p>` : ''}
    </section>`;
  const reais = ehReais(item);
  const numero = (v) => (reais ? `R$ ${numeroCurto(item, v)}` : numeroCurto(item, v));
  const unidadePequena = reais ? '' : `<small>${escape(rotuloUnidade(item))}</small>`;
  let resumo;
  if (serie.length >= 2) {
    resumo = `<div><dt>${escape(lugar)} · ${atual.ano}</dt><dd>${escape(numero(atual.valor))}${unidadePequena}</dd></div>
      <div><dt>${tp('Desde {ano}', { ano: serie[0].ano })}</dt><dd>${escape(textoVariacao(variacao(serie)))}</dd></div>
      <div><dt>${t('Ritmo')}</dt><dd>${escape(textoRitmo(ritmo(serie)))}<small>${t('ao ano')}</small></dd></div>`;
  } else {
    const estados = state.data.estados
      .map((estado) => ({ uf: estado.uf, v: item.valores?.[estado.uf] }))
      .filter((estado) => Number.isFinite(estado.v))
      .sort((a, b) => b.v - a.v);
    resumo = `<div><dt>${escape(lugar)}</dt><dd>${atual ? `${escape(numero(atual.valor))}${unidadePequena}` : `—<small>${t('sem valor regional')}</small>`}</dd></div>
      ${estados.length ? `<div><dt>${t('Maior')}</dt><dd>${escape(estados[0].uf)} ${escape(numeroCurto(item, estados[0].v))}</dd></div>
      <div><dt>${t('Menor')}</dt><dd>${escape(estados.at(-1).uf)} ${escape(numeroCurto(item, estados.at(-1).v))}</dd></div>` : ''}`;
  }
  const grafico = serie.length >= 2
    ? `<section class="goals-detail-section coletado-secao">
        <h3>${escape(tp('{lugar} ao longo do tempo', { lugar }))}<em>${escape(rotuloUnidade(item))}</em></h3>
        ${graficoColetado(item, lugar, serie)}
      </section>`
    : '';
  const temSerie = Object.values(item.serieAnual || {}).some((porAno) => Object.keys(porAno).length);
  return `${metaTopo}
    <dl class="coletado-resumo">${resumo}</dl>
    ${grafico}
    ${temSerie ? faixasDosEstados(item) : barrasDosEstados(item)}`;
}

// A dica e o marcador mudam por edição direta: redesenhar o painel a cada
// movimento do ponteiro refaria o conteúdo e dispararia a animação de troca.
function mostraDica(alvo) {
  const caixa = alvo.closest('.coletado-interativo');
  const dica = caixa?.querySelector('.coletado-dica');
  if (!dica) return;
  dica.hidden = false;
  dica.textContent = alvo.dataset.dica;
  const quadro = caixa.getBoundingClientRect();
  let x;
  let y;
  const svg = alvo.ownerSVGElement;
  if (svg && alvo.dataset.x) {
    const area = svg.getBoundingClientRect();
    const escala = area.width / svg.viewBox.baseVal.width;
    x = area.left - quadro.left + Number(alvo.dataset.x) * escala;
    y = area.top - quadro.top + Number(alvo.dataset.y) * escala;
    const marcador = svg.querySelector('.coletado-marcador');
    marcador.querySelector('line').setAttribute('x1', alvo.dataset.x);
    marcador.querySelector('line').setAttribute('x2', alvo.dataset.x);
    marcador.querySelector('circle').setAttribute('cx', alvo.dataset.x);
    marcador.querySelector('circle').setAttribute('cy', alvo.dataset.y);
    marcador.classList.add('is-visivel');
  } else {
    const celula = alvo.getBoundingClientRect();
    x = celula.left - quadro.left + celula.width / 2;
    y = celula.top - quadro.top;
  }
  const largura = dica.offsetWidth;
  const altura = dica.offsetHeight;
  dica.style.left = `${Math.max(0, Math.min(quadro.width - largura, x - largura / 2))}px`;
  dica.style.top = `${y - altura - 10 < 0 ? y + 12 : y - altura - 10}px`;
  caixa.dataset.ano = alvo.dataset.ano;
  marcaAno(alvo.dataset.ano);
}

function escondeDica(caixa) {
  if (!caixa) return;
  const dica = caixa.querySelector('.coletado-dica');
  if (dica) dica.hidden = true;
  caixa.querySelector('.coletado-marcador')?.classList.remove('is-visivel');
  delete caixa.dataset.ano;
  marcaAno(null);
}

// O ano apontado no gráfico ou numa faixa ganha contorno em todas as faixas.
function marcaAno(ano) {
  const painel = document.querySelector('#goals-detail');
  painel?.querySelectorAll('.coletado-cel i.is-ano').forEach((celula) => celula.classList.remove('is-ano'));
  if (ano) painel?.querySelectorAll(`.coletado-cel i[data-ano="${ano}"]`).forEach((celula) => celula.classList.add('is-ano'));
}

function passoNoGrafico(caixa, tecla) {
  const alvos = [...caixa.querySelectorAll('.coletado-alvo')];
  if (!alvos.length) return;
  const atual = alvos.findIndex((alvo) => alvo.dataset.ano === caixa.dataset.ano);
  const ultimo = alvos.length - 1;
  let indice = atual < 0 ? ultimo : atual;
  if (tecla === 'ArrowLeft') indice = atual < 0 ? ultimo : Math.max(0, atual - 1);
  else if (tecla === 'ArrowRight') indice = atual < 0 ? ultimo : Math.min(ultimo, atual + 1);
  else if (tecla === 'Home') indice = 0;
  else if (tecla === 'End') indice = ultimo;
  mostraDica(alvos[indice]);
}

function corpoFicha(item) {
  if (!state.dossie) return `<p class="method-loading">${t('Carregando ficha técnica…')}</p>`;
  // O catálogo é a fonte dos valores por estado, da descrição técnica e da
  // situação de coleta; o que veio da lista preenche o que faltar nele.
  // O catálogo traz os valores por estado e a descrição técnica; a
  // sobreposição de idioma entra por último, para a ficha herdar o texto já
  // traduzido em vez de reescrever a mesma regra de precedência.
  const doCatalogo = state.dossie.indicadores[item.codigo] || {};
  const indicador = {
    ...item,
    ...doCatalogo,
    nome: nomeDe(item),
    descricao: campo(item.codigo, 'descricao', doCatalogo.descricao ?? item.descricao),
    fonte: campo(item.codigo, 'fonte', doCatalogo.fonte ?? item.fonte)
  };
  return renderFicha({
    indicador,
    ficha: state.dossie.fichas[item.codigo] || null,
    katex: state.katex,
    // Nas metas com patamar e nos coletados a meta pactuada já está na aba
    // Resultado; repeti-la aqui seria escrevê-la duas vezes no mesmo painel.
    metaTexto: item.temMeta || item.temValores ? null : metaTextoDe(item)
  });
}

// ---------- trajetória pactuada até 2050 ----------
//
// As projeções de conteudo/projecoes.json: metas intermediárias regionais, não
// previsões nem o "ritmo atual" do Panorama. A série medida só é desenhada
// quando `comparavel` (a linha de base é o mesmo número que o painel mede).

const MARCOS = ['2025', '2030', '2035', '2040', '2045', '2050'];

// A partir de um milhão o número vai abreviado ("6,12 mi"): em reais, o valor
// inteiro não cabe no eixo do gráfico nem na tabela de marcos do painel lateral.
function numeroProjecao(valorBruto) {
  if (!Number.isFinite(valorBruto)) return '–';
  if (Math.abs(valorBruto) >= 1e6) return `${number(valorBruto / 1e6, 2)} ${t('mi')}`;
  return number(valorBruto, Math.abs(valorBruto) >= 1000 ? 0 : decimals(valorBruto));
}

function observadosDe(item, projecao) {
  if (!item.temMeta) return projecao.observadoRegional || [];
  return (item.historico || [])
    .filter((ponto) => Number.isFinite(ponto.regional))
    .map((ponto) => ({ ano: Number(ponto.ano), valor: ponto.regional }));
}

function serieOrdenada(serie) {
  return Object.entries(serie).map(([ano, v]) => [Number(ano), v]).sort((a, b) => a[0] - b[0]);
}

function graficoProjecao(projecao, observados) {
  const A = 190, x0 = 44, x1 = 388, y0 = 18, y1 = 160;
  const pontos = projecao.cenarios.flatMap((c) => serieOrdenada(c.serie));
  const valores = [...pontos.map(([, v]) => v), ...observados.map((o) => o.valor)];
  const anos = [...pontos.map(([ano]) => ano), ...observados.map((o) => o.ano)];
  const aMin = Math.min(...anos), aMax = Math.max(...anos, 2050);
  const bruto = [Math.min(...valores), Math.max(...valores)];
  const folga = (bruto[1] - bruto[0] || Math.abs(bruto[1]) || 1) * 0.08;
  const vMin = bruto[0] - folga, vMax = bruto[1] + folga;
  const px = (ano) => x0 + (ano - aMin) / (aMax - aMin || 1) * (x1 - x0);
  const py = (v) => y1 - (v - vMin) / (vMax - vMin || 1) * (y1 - y0);
  const coords = (lista) => lista.map(([ano, v]) => `${px(ano).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const central = projecao.cenarios.find((c) => c.central) || (projecao.cenarios.length === 1 ? projecao.cenarios[0] : null);
  const outros = projecao.cenarios.filter((c) => c !== central);
  let faixa = '';
  if (projecao.cenarios.length > 1) {
    const comuns = serieOrdenada(projecao.cenarios[0].serie).map(([ano]) => ano)
      .filter((ano) => projecao.cenarios.every((c) => Number.isFinite(c.serie[ano])));
    const topo = comuns.map((ano) => [ano, Math.max(...projecao.cenarios.map((c) => c.serie[ano]))]);
    const base = comuns.slice().reverse().map((ano) => [ano, Math.min(...projecao.cenarios.map((c) => c.serie[ano]))]);
    faixa = `<polygon class="projecao-faixa" points="${coords([...topo, ...base])}"/>`;
  }
  const grade = [bruto[0], (bruto[0] + bruto[1]) / 2, bruto[1]].map((v) => `<line x1="${x0}" x2="${x1}" y1="${py(v).toFixed(1)}" y2="${py(v).toFixed(1)}"/><text x="${x0 - 6}" y="${(py(v) + 3.5).toFixed(1)}" text-anchor="end">${escape(numeroProjecao(v))}</text>`).join('');
  const rotulosAno = [...new Set([aMin, 2030, 2040, aMax])].filter((ano) => ano >= aMin && ano <= aMax && (ano === aMin || ano - aMin >= 8))
    .map((ano) => `<text x="${px(ano).toFixed(1)}" y="${A - 8}" text-anchor="middle">${ano}</text>`).join('');
  const serieCentral = central ? serieOrdenada(central.serie) : [];
  const final = serieCentral.at(-1);
  return `<svg class="projecao-grafico" viewBox="0 0 400 ${A}" role="img" aria-label="${escape(tp('Trajetória pactuada de {nome}', { nome: t(projecao.nome) }))}">
      <g class="projecao-grade">${grade}</g>
      ${faixa}
      ${outros.map((c) => `<polyline class="projecao-cenario" points="${coords(serieOrdenada(c.serie))}"/>`).join('')}
      ${central ? `<polyline class="projecao-central" points="${coords(serieCentral)}"/>` : ''}
      ${serieCentral.filter(([ano]) => MARCOS.includes(String(ano))).map(([ano, v]) => `<circle class="projecao-marco" cx="${px(ano).toFixed(1)}" cy="${py(v).toFixed(1)}" r="3"/>`).join('')}
      ${final ? `<text class="projecao-final" x="${px(final[0]).toFixed(1)}" y="${(py(final[1]) - 8).toFixed(1)}" text-anchor="end">${escape(numeroProjecao(final[1]))}</text>` : ''}
      ${observados.map((o) => `<circle class="projecao-medido" cx="${px(o.ano).toFixed(1)}" cy="${py(o.valor).toFixed(1)}" r="5"/>`).join('')}
      <g class="projecao-anos">${rotulosAno}</g>
    </svg>`;
}

function tabelaProjecao(projecao, observados) {
  const primeiro = serieOrdenada(projecao.cenarios[0].serie)[0][0];
  const anos = [...new Set([String(primeiro), ...MARCOS.filter((ano) => projecao.cenarios.some((c) => Number.isFinite(c.serie[ano])))])]
    .sort((a, b) => a - b);
  const multi = projecao.cenarios.length > 1;
  // Tudo em milhões: a tabela mostra o número sem sufixo e diz "mi" uma vez, no
  // cabeçalho, para as colunas caberem na largura do painel.
  const todos = [...projecao.cenarios.flatMap((c) => anos.map((ano) => c.serie[ano])), ...observados.map((o) => o.valor)].filter(Number.isFinite);
  const emMilhoes = todos.length > 0 && todos.every((v) => Math.abs(v) >= 1e6);
  const celula = (v) => (emMilhoes && Number.isFinite(v) ? number(v / 1e6, 2) : numeroProjecao(v));
  const linhas = projecao.cenarios.map((c) => `<tr class="${c.central ? 'is-central' : ''}"><th scope="row">${multi ? escape(t(c.nome)) : t('Meta')}${c.central ? ' ●' : ''}</th>${anos.map((ano) => `<td>${escape(celula(c.serie[ano]))}</td>`).join('')}</tr>`).join('');
  const medido = observados.length
    ? `<tr class="is-medido"><th scope="row">${t('Medido')}</th>${anos.map((ano) => {
      const ponto = observados.find((o) => String(o.ano) === ano);
      return `<td>${ponto ? escape(celula(ponto.valor)) : '–'}</td>`;
    }).join('')}</tr>`
    : '';
  const canto = [multi ? t('Cenário') : '', emMilhoes ? t('mi') : ''].filter(Boolean).join(' · ');
  return `<div class="projecao-tabela-rolagem"><table class="projecao-tabela">
      <thead><tr><th scope="col">${canto}</th>${anos.map((ano) => `<th scope="col">${ano}</th>`).join('')}</tr></thead>
      <tbody>${linhas}${medido}</tbody>
    </table></div>`;
}

function blocoProjecao(item, projecao, varias) {
  const observados = projecao.comparavel ? observadosDe(item, projecao) : [];
  const central = projecao.cenarios.find((c) => c.central) || (projecao.cenarios.length === 1 ? projecao.cenarios[0] : null);
  const outros = projecao.cenarios.filter((c) => c !== central);
  const legenda = [
    central ? `<span><i class="leg-central"></i>${escape(t(central.nome))}</span>` : '',
    outros.length ? `<span><i class="leg-cenario"></i>${escape(outros.map((c) => t(c.nome)).join(' · '))}</span>` : '',
    observados.length ? `<span><i class="leg-medido"></i>${t('Valor medido pelo painel')}</span>` : ''
  ].join('');
  return `<section class="goals-detail-section projecao">
      ${varias ? `<h3>${escape(t(projecao.nome))}</h3>` : ''}
      <p class="projecao-unidade">${escape(t(projecao.unidade))} · ${t('Amazônia Legal')}</p>
      ${graficoProjecao(projecao, observados)}
      <div class="projecao-legenda">${legenda}</div>
      ${tabelaProjecao(projecao, observados)}
      ${projecao.cenarios.some((c) => c.central) ? `<p class="goals-detail-method">● ${t('cenário que corresponde à meta do catálogo.')}</p>` : ''}
      ${projecao.comparavel ? '' : `<p class="projecao-aviso"><strong>${t('Só referência:')}</strong> ${escape(t(projecao.motivo))}</p>`}
      ${projecao.nota ? `<p class="goals-detail-method">${escape(t(projecao.nota))}</p>` : ''}
    </section>`;
}

function corpoTrajetoria(item) {
  const projecoes = item.projecoes || [];
  return `<p class="projecao-lead">${t('Metas intermediárias pactuadas na Estratégia, para a região. Não são previsão nem o ritmo atual calculado no Panorama.')}</p>
    ${projecoes.map((projecao) => blocoProjecao(item, projecao, projecoes.length > 1)).join('')}`;
}

function abasDe(item) {
  return [
    item.temMeta || item.temValores ? { chave: 'resultado', rotulo: t('Resultado') } : null,
    item.projecoes?.length ? { chave: 'trajetoria', rotulo: t('Trajetória 2050') } : null,
    { chave: 'ficha', rotulo: t('Ficha técnica') }
  ].filter(Boolean);
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
    if (alvo) alvo.outerHTML = `<p class="load-error">${escape(erro.message)} ${t('Atualize a página para tentar novamente.')}</p>`;
  }
}

function renderDetail() {
  const painel = document.querySelector('#goals-detail');
  const board = document.querySelector('.goals-board');
  const item = itemAtual();
  if (!painel || !item || !state.detalhesAbertos) {
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

  // Duas abas só quando há duas coisas a dizer. Sem valores não há resultado, e
  // uma aba "Resultado" vazia ao lado da única que tem conteúdo é ruído.
  // A trajetória entra quando há projeção pactuada para o indicador.
  const lista = abasDe(item);
  const aba = lista.some((entrada) => entrada.chave === state.aba) ? state.aba : lista[0].chave;
  const naFicha = aba === 'ficha';
  const abas = lista.length > 1
    ? `<div class="goals-detail-tabs" role="tablist" aria-label="${t('Faces deste indicador')}">
        ${lista.map((entrada) => `<button type="button" role="tab" data-aba="${entrada.chave}" id="goals-aba-${entrada.chave}" aria-selected="${entrada.chave === aba}" aria-controls="goals-detail-painel" class="${entrada.chave === aba ? 'is-active' : ''}">${entrada.rotulo}</button>`).join('')}
      </div>`
    : '';
  const painelAria = lista.length > 1
    ? `role="tabpanel" aria-labelledby="goals-aba-${aba}"`
    : '';
  const corpo = naFicha ? corpoFicha(item) : (aba === 'trajetoria' ? corpoTrajetoria(item) : corpoResultado(item));

  painel.innerHTML = `<div class="goals-detail-content">
      <header class="goals-detail-head">
        <div>
          <h2 id="goals-detail-title">${escape(nomeDe(item))}</h2>
        </div>
        <button class="goals-detail-close" type="button" aria-label="${t('Fechar detalhes do indicador')}">×</button>
      </header>

      ${abas}

      <div id="goals-detail-painel" ${painelAria} class="goals-detail-painel">
        ${corpo}
      </div>
    </div>`;
  fechamentoDetalhe += 1;
  painel.classList.remove('is-closing', 'is-opening');
  painel.hidden = false;
  // As três abas abrem na mesma coluna lateral, ao lado da lista. A ficha usa ali
  // o arranjo estreito (ver .goals-detail-painel em global.css), e a fórmula
  // larga rola de lado dentro do bloco dela.
  if (board) board.classList.add('has-detail');
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

// Abre no resultado quem tem valores; um indicador sem nenhum valor não tem o
// que mostrar ali, e a ficha é o que ele tem a dizer.
function abaInicial(item) {
  return item && (item.temMeta || item.temValores) ? 'resultado' : 'ficha';
}

function abrirItem(codigo, { aba = null, animar = true } = {}) {
  const item = itemPorCodigo(codigo);
  if (!item) return;
  // Um indicador de outro eixo (um link com o código, a prévia da administração)
  // leva junto o eixo dele: o detalhe nunca fala de algo que a lista não mostra.
  if (state.eixo !== item.eixo) {
    entraNoEixo(item.eixo, { endereco: false });
    animar = false;
    renderVista();
    renderEixos();
    renderCabecalhoDoEixo();
  }
  state.codigo = codigo;
  state.detalhesAbertos = true;
  state.animarDetalhe = animar;
  state.aba = aba || abaInicial(item);
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
    }
  });
}

function linhaDeMeta(meta, anterior) {
  const { item, progresso: p, semEscala } = dadosDaMeta(meta);
  const valorHoje = item ? valor(meta, item.valor) : t('sem dado');
  const leitura = !item || semEscala ? '—' : `${p}%`;

  const partida = anterior.has(meta.codigo) ? anterior.get(meta.codigo) : p;
  const classe = item?.cumpre ? 'is-met' : (item ? 'is-progress' : 'is-empty');
  const prefixo = meta.direcao === 'menor' ? '≤ ' : '';
  // Dois números lado a lado, à direita do nome: o valor de hoje e a meta, cada
  // um com chapéu e uma nota miúda embaixo (sem escala; prazo).
  const metaValor = item ? prefixo + valor(meta, item.alvo) : '—';
  const metaNota = meta.prazo ? tp('até {prazo}', { prazo: meta.prazo }) : '';
  const atualNota = semEscala ? t('sem escala') : '';

  const ativa = state.detalhesAbertos && meta.codigo === state.codigo ? ' is-active' : '';
  const expandida = state.detalhesAbertos && meta.codigo === state.codigo;
  // Card: a jornada é o número grande à esquerda; nome, os dois números e a
  // barra ficam ao lado.
  return `<button type="button" data-codigo="${meta.codigo}" class="goals-row ${classe}${ativa}" aria-expanded="${expandida}" aria-controls="goals-detail">
    <span class="goals-row-ler"><b>${leitura}</b><small>${t('jornada')}</small></span>
    <span class="goals-card-body">
      <span class="goals-card-topo">
        <span class="goals-row-name">${escape(nomeDe(meta))}</span>
        <span class="goals-card-numeros">
          <span class="goals-card-stat is-atual"><span>${t('atual')}</span><b>${escape(valorHoje)}</b>${atualNota ? `<small>${atualNota}</small>` : ''}</span>
          <span class="goals-card-stat is-meta"><span>${t('Meta')}</span><b>${escape(metaValor)}</b>${metaNota ? `<small>${escape(metaNota)}</small>` : ''}</span>
        </span>
      </span>
      <span class="goals-row-bar" aria-hidden="true"><i class="resta"></i><i class="feito" data-meta-barra="${meta.codigo}" data-destino="${p}" style="width:${partida}%"></i></span>
    </span>
  </button>`;
}

// Sem valores não há o que desenhar: o que a linha tem a dizer é em que pé
// está a coleta e por que ela não entra no quadro.
function linhaDeCatalogo(item) {
  const ativa = state.detalhesAbertos && item.codigo === state.codigo ? ' is-active' : '';
  const expandida = state.detalhesAbertos && item.codigo === state.codigo;
  return `<button type="button" data-codigo="${item.codigo}" class="goals-row is-catalog${ativa}" aria-expanded="${expandida}" aria-controls="goals-detail">
    <span class="goals-row-name">${escape(nomeDe(item))}<small>${escape(motivoDe(item))}</small></span>
    <span class="goals-row-ler">${selo(item)}</span>
  </button>`;
}

function renderList() {
  const alvo = document.querySelector('#goals-list');
  if (!alvo) return;
  const lista = visiveis();
  const anterior = larguraAtualPorMeta();
  renderContagem(lista);

  if (!lista.length) {
    alvo.innerHTML = `<p class="indicator-empty">${t('Nenhum indicador do eixo corresponde à busca.')}</p>`;
    return;
  }

  // Agrupa por eixo, em ordem numérica: as duas listas de origem chegam separadas
  // e o eixo é o que as recosta uma na outra.
  const grupos = new Map();
  for (const item of lista) {
    if (!grupos.has(item.eixo)) grupos.set(item.eixo, { eixo: item.eixo, eixoNome: item.eixoNome, metas: [], coletados: [], catalogo: [] });
    grupos.get(item.eixo)[item.temMeta ? 'metas' : (item.temValores ? 'coletados' : 'catalogo')].push(item);
  }

  // O nome e os números do eixo estão no cabeçalho acima do quadro; aqui ficam
  // só as faixas. Elas são rótulos, não contadores: o total já está no resumo.
  alvo.innerHTML = [...grupos.values()].sort((a, b) => a.eixo - b.eixo).map(({ metas, coletados, catalogo }) => {
    const faixaMetas = metas.length
      ? `<p class="goals-faixa">${t('Metas com patamar mensurável')}</p>
         <div class="goals-cards">${metas.map((meta) => linhaDeMeta(meta, anterior)).join('')}</div>`
      : '';
    const faixaColetados = coletados.length
      ? `<p class="goals-faixa">${t('Coletados, sem meta numérica')}</p>
         <div class="goals-cards">${coletados.map(linhaDeColetado).join('')}</div>`
      : '';
    const faixaCatalogo = catalogo.length
      ? `<p class="goals-faixa">${metas.length || coletados.length ? t('Demais indicadores do eixo') : t('Indicadores do eixo')}</p>
         <div class="goals-cards">${catalogo.map(linhaDeCatalogo).join('')}</div>`
      : '';
    return `<section class="goals-eixo">
      ${faixaMetas}
      ${faixaColetados}
      ${faixaCatalogo}
    </section>`;
  }).join('');

  animaBarras();
  posicionaDetalhe();
}

function renderAll() {
  renderVista();
  renderEixos();
  renderCabecalhoDoEixo();
  renderList();
  renderDetail();
}

// ---------- navegação entre os eixos ----------

// `#eixo-3` abre o terceiro eixo; sem nada, a rota mostra os cinco.
function eixoDoEndereco() {
  const achado = location.hash.match(/^#eixo-(\d+)$/);
  const eixo = achado ? Number(achado[1]) : null;
  return eixo && eixosDoAcervo().includes(eixo) ? eixo : null;
}

// O primeiro da lista do eixo abre no detalhe: uma meta, se houver; senão um
// coletado; senão o primeiro do catálogo.
function primeiroDoEixo(eixo) {
  const doEixo = acervo().filter((item) => item.eixo === eixo);
  return doEixo.find((item) => item.temMeta) || doEixo.find((item) => item.temValores) || doEixo[0] || null;
}

// Troca o estado para outro eixo (ou para os cinco, com `null`) sem desenhar.
// A busca vale dentro de um eixo, então recomeça a cada troca.
function entraNoEixo(eixo, { endereco = true } = {}) {
  state.eixo = eixo;
  state.busca = '';
  const campo = document.querySelector('#indicator-search');
  if (campo) campo.value = '';
  abreExport(false);
  // O endereço acompanha a vista, para o link poder ser compartilhado. Troca, e
  // não empilha: com entradas próprias no histórico, voltar faria o roteador do
  // Astro redesenhar a página inteira. O estado dele vai junto, intacto. Quem
  // chegou pelo código de um indicador fica com o código no endereço.
  if (!endereco) return;
  const destino = `${location.pathname}${location.search}${eixo ? `#eixo-${eixo}` : ''}`;
  if (`${location.pathname}${location.search}${location.hash}` !== destino) history.replaceState(history.state, '', destino);
}

function mostraEixo(eixo) {
  entraNoEixo(eixo);
  const primeiro = eixo ? primeiroDoEixo(eixo) : null;
  state.codigo = primeiro?.codigo ?? null;
  state.detalhesAbertos = Boolean(primeiro);
  state.aba = abaInicial(primeiro);
  state.animarDetalhe = false;
  renderAll();
  // A troca de vista muda a página inteira: a leitura recomeça do topo, de uma
  // vez — rolar suave por um conteúdo que já não é o mesmo só desorienta. Rolar
  // até o `main` não serve: a barra fixa do topo cobriria o "Todos os eixos".
  if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' });
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
  // Cartões e abas são links (`#eixo-3`) para abrirem em outra aba com o botão
  // do meio ou com Ctrl; o clique simples troca a vista aqui mesmo. Cancelado o
  // clique, o roteador do Astro também não o trata.
  const irParaEixo = (event) => {
    const link = event.target.closest('[data-ir-eixo]');
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const eixo = Number(link.dataset.irEixo);
    if (eixo === state.eixo) return;
    mostraEixo(eixo);
    document.querySelector('#eixo-titulo')?.focus({ preventScroll: true });
  };
  document.querySelector('#eixos-cartoes').addEventListener('click', irParaEixo);
  document.querySelector('#eixo-abas').addEventListener('click', irParaEixo);

  document.querySelector('[data-voltar-eixos]').addEventListener('click', () => {
    const anterior = state.eixo;
    mostraEixo(null);
    document.querySelector(`#eixos-cartoes [data-ir-eixo="${anterior}"]`)?.focus({ preventScroll: true });
  });

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
    // No toque não há "passar por cima": tocar numa célula ou num ano mostra a dica.
    const comDica = event.target.closest('[data-dica]');
    if (comDica) {
      mostraDica(comDica);
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
      const chaves = abasDe(itemAtual()).map((entrada) => entrada.chave);
      const atual = Math.max(0, chaves.indexOf(state.aba));
      state.aba = chaves[(atual + (event.key === 'ArrowRight' ? 1 : chaves.length - 1)) % chaves.length];
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
    const grafico = event.target.closest('.coletado-grafico');
    if (grafico) {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        passoNoGrafico(grafico, event.key);
      } else if (event.key === 'Escape' && grafico.dataset.ano) {
        // O Esc fecha a dica primeiro; o painel fecha no Esc seguinte.
        event.stopPropagation();
        escondeDica(grafico);
      }
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

  // pointerover e pointerout borbulham (pointerenter e pointerleave, não): é o
  // que deixa um só ouvinte no painel servir às áreas redesenhadas a cada troca.
  painelDetalhe.addEventListener('pointerover', (event) => {
    const alvo = event.target.closest?.('[data-dica]');
    if (alvo) mostraDica(alvo);
  });
  painelDetalhe.addEventListener('pointerout', (event) => {
    if (event.pointerType === 'touch') return;
    const de = event.target.closest?.('[data-dica]');
    if (!de) return;
    const caixa = de.closest('.coletado-interativo');
    const para = event.relatedTarget?.closest?.('[data-dica]');
    if (para && para.closest('.coletado-interativo') === caixa) return;
    if (caixa?.matches(':focus-visible')) return;
    escondeDica(caixa);
  });
  painelDetalhe.addEventListener('focusin', (event) => {
    const grafico = event.target.closest?.('.coletado-grafico');
    if (grafico && !grafico.dataset.ano && grafico.matches(':focus-visible')) passoNoGrafico(grafico, 'End');
  });
  painelDetalhe.addEventListener('focusout', (event) => {
    const grafico = event.target.closest?.('.coletado-grafico');
    if (grafico && !grafico.contains(event.relatedTarget)) escondeDica(grafico);
  });

  document.addEventListener('click', (event) => {
    const dropdown = painelDetalhe.querySelector('.goals-year-dropdown.is-open');
    if (!dropdown || dropdown.contains(event.target)) return;
    dropdown.classList.remove('is-open');
    dropdown.querySelector('[data-goals-year-toggle]')?.setAttribute('aria-expanded', 'false');
    dropdown.querySelector('.dropdown-menu').hidden = true;
  }, { signal: sinalDaPagina() });

  document.querySelector('#indicator-search').addEventListener('input', (event) => {
    state.busca = event.target.value;
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
  // outro código (ou para `#eixo-2`) dentro da própria página não faria nada.
  // Outras âncoras, como a do "pular para o conteúdo", não mexem na vista.
  window.addEventListener('hashchange', () => {
    const codigo = codigoDoEndereco();
    if (codigo) {
      if (codigo !== state.codigo || !state.detalhesAbertos) abrirItem(codigo);
      return;
    }
    const eixo = eixoDoEndereco();
    if (eixo && eixo !== state.eixo) mostraEixo(eixo);
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
  const [dados] = await Promise.all([fetch('/data/metas.json').then(readResponse), carregaConteudo()]);
  state.data = dados;
  state.busca = '';
  // Sem nada no endereço, a rota abre nos cinco eixos. `#eixo-2` abre o eixo
  // com o primeiro indicador dele no detalhe; o código de um indicador abre o
  // eixo dele com aquele indicador.
  const doEndereco = codigoDoEndereco();
  state.eixo = doEndereco ? itemPorCodigo(doEndereco).eixo : eixoDoEndereco();
  const aberto = doEndereco ? itemPorCodigo(doEndereco) : (state.eixo ? primeiroDoEixo(state.eixo) : null);
  state.codigo = aberto?.codigo ?? null;
  state.detalhesAbertos = Boolean(aberto);
  // A regra de qual aba abre é a mesma de um clique na lista, e mora num lugar só.
  state.aba = abaInicial(aberto);
  bindEvents();
  renderAll();
  if (doEndereco) {
    document.querySelector('#goals-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

const ANCORA = '#goals-list';

aoEntrarNaPagina(ANCORA, () => init().catch((error) => {
  const alvo = document.querySelector('#goals-list');
  if (alvo) alvo.innerHTML = `<p class="load-error">${escape(error.message)} ${t('Atualize a página para tentar novamente.')}</p>`;
}));
