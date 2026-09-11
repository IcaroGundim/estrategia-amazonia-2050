// Ficha técnica de um indicador: situação da coleta, método de cálculo e os
// campos que vêm do documento das fichas. Era o miolo da rota /indicadores, que
// deixou de existir — as metas e os indicadores viraram uma lista só, e a ficha
// passou a ser a segunda aba do painel de detalhe. O que está aqui é o que a
// página das Metas não sabia fazer sozinha; o resto daquela rota (lista,
// paginação, colunas) morreu junto com a duplicação que ela criava.

import { escape } from './shared.js';
import { ehTraducao, t, tp } from '../i18n/index.js';
import { campoDaFicha, equacoesDe, linhaDeAcao, notasDaFormula, sobreposicaoDaFicha } from './conteudo.js';
// `?url` devolve o endereço do arquivo já versionado, sem registrar a folha como
// estilo da página: importada da forma comum, o Astro a promoveria a um <link>
// no <head> de /metas e os 30KB dela seriam baixados e analisados em toda visita,
// inclusive nas que nunca abrem uma ficha. Aqui ela entra junto com o KaTeX.
import enderecoDoKatexCss from 'katex/dist/katex.min.css?url';

const ORDEM_ESTADOS = ['AC', 'AP', 'AM', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO'];

const NOMES_ESTADOS = {
  AC: 'Acre', AP: 'Amapá', AM: 'Amazonas', MA: 'Maranhão', MT: 'Mato Grosso',
  PA: 'Pará', RO: 'Rondônia', RR: 'Roraima', TO: 'Tocantins'
};

export const STATUS = {
  coletado: {
    label: 'Coletado',
    cls: 'is-ok',
    mark: '<svg class="ic solid" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7"/><path class="cut" d="M4.8 8.5l2.2 2.2 4.2-5"/></svg>'
  },
  parcial: {
    label: 'Parcial',
    cls: 'is-partial',
    mark: '<svg class="ic solid" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7"/><path class="cutfill" d="M8 1a7 7 0 0 0 0 14z"/></svg>'
  },
  pendente: {
    label: 'Pendente',
    cls: 'is-pending',
    mark: '<svg class="ic solid" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7"/><path class="cut" d="M8 4.5V8l2.2 1.8"/></svg>'
  },
  manual: {
    label: 'Não coletado',
    cls: 'is-manual',
    mark: '<svg class="ic solid" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7"/><path class="cut" d="M5 8h6"/></svg>'
  }
};

// As fichas escrevem a fórmula como texto do documento original. Estas são as
// mesmas equações em LaTeX, com `skip` dizendo quantas linhas do texto já foram
// absorvidas pelas equações — o que sobra vira legenda dos símbolos.
const FORMULAS = {
  'I1.1.2': { equations: [String.raw`\mathrm{IUCs}=\left(\frac{N_{\mathrm{conformes}}}{N_{\mathrm{total}}}\right)\times100`], skip: 1 },
  'I1.3.1': { equations: [
    String.raw`\mathrm{IIVCM}_{m}=100\left(0{,}60\,V_{\mathrm{geral},m}+0{,}40\,V_{\mathrm{piores25},m}\right)`,
    String.raw`V_t=\operatorname{média}_{m\in M_{\mathrm{prioritários}}}\left(\mathrm{IIVCM}_m\right)`
  ], skip: 3 },
  'I1.3.2': { equations: [String.raw`D_{\mathrm{ilegal}}=D_{\mathrm{total}}-A_{\mathrm{supressão}}`], skip: 1, notes: [
    "Dilegal = área desmatada sem autorização, em hectares.",
    "Dtotal = área total desmatada no ano, medida pelo PRODES/INPE.",
    "Asupressão = área com autorização de supressão vegetal emitida no Sinaflor/IBAMA."
  ] },
  'I1.3.4': { equations: [String.raw`F_{\mathrm{AL}}=\sum_{u\in\mathrm{AL}}F_u`], skip: 1, notes: [
    "FAL = total de focos de calor na Amazônia Legal no ano.",
    "Fu = focos detectados no estado u pelo satélite de referência do programa Queimadas/INPE.",
    "u = cada um dos nove estados da região."
  ] },
  'I2.1.1': { equations: [String.raw`\mathrm{Taxa\ de\ pobreza}=\frac{N_{\mathrm{pessoas\ em\ pobreza}}}{P_{\mathrm{população\ do\ ano}}}\times100`], skip: 1, notes: [
    "Npessoas em pobreza = população em situação de pobreza no ano de referência (IBGE/SIS).",
    "Ppopulação do ano = população total da mesma unidade, no mesmo ano."
  ] },
  'I2.2.1': { equations: [String.raw`\mathrm{Taxa}_{\mathrm{evitáveis}}=\frac{O_{\mathrm{causas\ evitáveis}}}{P_{\mathrm{residente}}}\times100\,000`], skip: 1 },
  'I2.2.2': { equations: [String.raw`\mathrm{Cobertura}_{\mathrm{APS}}=\frac{3\,500n_{\mathrm{eSF}}+1\,750n_{\mathrm{eAP20}}+2\,625n_{\mathrm{eAP30}}+P_{\mathrm{equipes\ especiais}}}{P_{\mathrm{IBGE}}}\times100`], skip: 1, notes: [
    "neSF = equipes de Saúde da Família do estado, com parâmetro de 3.500 pessoas por equipe.",
    "neAP20 e neAP30 = equipes de Atenção Primária de 20h e 30h, com parâmetros de 1.750 e 2.625 pessoas.",
    "Pequipes especiais = população com cadastro vinculado a equipes eCR, eSFR e eAPP, informada no Sisab.",
    "PIBGE = estimativa populacional do IBGE para o conjunto dos municípios do estado."
  ] },
  'I2.2.3': { equations: [String.raw`\mathrm{Cobertura}_{\mathrm{telessaúde}}=\frac{M_{\mathrm{com\ serviço\ ativo}}}{M_{\mathrm{total\ da\ AL}}}\times100`], skip: 1, notes: [
    "Mcom serviço ativo = municípios com estabelecimento de telessaúde ativo no CNES.",
    "Mtotal da AL = os 808 municípios da Amazônia Legal."
  ] },
  'I2.3.1': { equations: [String.raw`\mathrm{Atingimento}_{\mathrm{IDEB}}=\frac{M_{\mathrm{que\ atingiram\ a\ meta}}}{M_{\mathrm{total}}}\times100`], skip: 1, notes: [
    "Mque atingiram a meta = municípios que alcançaram ou superaram a meta do IDEB projetada pelo INEP.",
    "Mtotal = municípios com IDEB divulgado na etapa avaliada — Anos Iniciais, Anos Finais ou Ensino Médio."
  ] },
  'I2.3.2': { equations: [String.raw`\mathrm{Atendimento}_{4\text{–}17}=\frac{N_{\mathrm{matriculados}}}{P_{4\text{–}17}}\times100`], skip: 1, notes: [
    "Nmatriculados = matrículas da educação básica registradas no Censo Escolar/INEP.",
    "P4–17 = projeção populacional do IBGE para a faixa de 4 a 17 anos."
  ] },
  'I2.4.1': { equations: [String.raw`\mathrm{CVLI}_{100\,mil}=\frac{V_{\mathrm{CVLI}}}{P_{\mathrm{residente}}}\times100\,000`], skip: 1, notes: [
    "VCVLI = vítimas de crimes violentos letais intencionais registradas pelo Sinesp/MJ.",
    "Presidente = população residente estimada pelo IBGE para o mesmo ano."
  ] },
  'I3.4.1': { equations: [String.raw`R_{\mathrm{por\ beneficiário}}=\frac{R_{\mathrm{total}}}{N_{\mathrm{beneficiários}}}`], skip: 1, notes: [
    "Rtotal = recursos aplicados nos programas de pagamento por serviços ambientais, em reais.",
    "Nbeneficiários = pessoas ou famílias atendidas pelos programas no mesmo período."
  ] },
  'I3.4.2': { equations: [String.raw`\mathrm{Execução}=\frac{R_{\mathrm{executado}}}{R_{\mathrm{previsto}}}\times100`], skip: 1, notes: [
    "Rexecutado = recursos efetivamente pagos no exercício.",
    "Rprevisto = recursos autorizados no orçamento do mesmo exercício."
  ] },
  'I4.1.1': { equations: [String.raw`\mathrm{IBC}_{\mathrm{ponderado}}=\frac{\sum_m \mathrm{IBC}_m\,P_m}{\sum_m P_m}`], skip: 1 },
  'I4.2.1': { equations: [String.raw`\mathrm{Taxa}_{\mathrm{adequação}}=\frac{E_{\mathrm{efetiva\ ponderada}}}{E_{\mathrm{física\ total}}}\times100`], skip: 1 },
  'I4.3.1': { equations: [
    String.raw`\mathrm{ITEQ}_m=\left(\frac{P_{\mathrm{SIN},m}}{P_{\mathrm{total},m}}R_{\mathrm{SIN,Amz}}+\frac{P_{\mathrm{isolado},m}}{P_{\mathrm{total},m}}R_{\mathrm{isolado},m}\right)F_{\mathrm{dist},m}F_{\mathrm{iso},m}`,
    String.raw`\mathrm{ITEQ}_{\mathrm{regional}}=\frac{\sum_m P_{\mathrm{total},m}\,\mathrm{ITEQ}_m}{\sum_m P_{\mathrm{total},m}}\times100`
  ], skip: 3 },
  'I4.3.2': { equations: [String.raw`\mathrm{PER}=\frac{\sum_k P_k\,w_k}{\sum_k P_k}\times100`], skip: 1, notes: [
    "O valor publicado usa a potência fiscalizada das usinas em operação (SIGA/ANEEL) como proxy da oferta de energia — por isso fica acima do baseline oficial de 65,24%."
  ] },
  'I4.4.1': { equations: [
    String.raw`\mathrm{DOM}_{\mathrm{efetivo},m}=\min\!\left(\mathrm{DOM}_{\mathrm{água},m},\mathrm{DOM}_{\mathrm{esgoto},m}\right)F_{\mathrm{clima},m}F_{\mathrm{gov},m}`,
    String.raw`\mathrm{DOM}_{\mathrm{efetivo},R}=\sum_{m\in\mathrm{AMZ}}\mathrm{DOM}_{\mathrm{efetivo},m}`,
    String.raw`\mathrm{DOM}_{\mathrm{total},R}=\sum_{m\in\mathrm{AMZ}}\mathrm{DOM}_{\mathrm{total},m}`,
    String.raw`\mathrm{ISGR}=\frac{\mathrm{DOM}_{\mathrm{efetivo},R}}{\mathrm{DOM}_{\mathrm{total},R}}\times100`
  ], skip: 4, notes: [
    "O fator FHidro não é publicado pelo IBGE e foi assumido igual a 1 na coleta, o que eleva o resultado frente ao baseline oficial de 41,52%."
  ] },
  'I5.2.1': { equations: [String.raw`\mathrm{Taxa}_{\mathrm{alavancagem}}=\frac{R_{\mathrm{privado\ mobilizado}}}{R_{\mathrm{público\ aportado}}}`], skip: 1, notes: [
    "Rprivado mobilizado = capital privado atraído pelos mecanismos regionais de blended finance.",
    "Rpúblico aportado = recursos públicos aportados nesses mesmos mecanismos.",
    "A taxa indica quantos reais privados cada real público mobiliza."
  ] },
  'I5.2.2': { equations: [String.raw`O(A)=6\,120\,000+483\,566\left(A-2026\right)`], skip: 99, note: 'Projeção linear baseada no histórico de execução financeira do Consórcio entre 2019 e 2026.' },
  'I5.5.1': { equations: [
    String.raw`\mathrm{Endividamento}=\frac{\mathrm{Dívida\ consolidada}}{\mathrm{Receita\ corrente\ líquida}}`,
    String.raw`\mathrm{Poupança\ corrente}=\frac{\mathrm{Despesas\ correntes}}{\mathrm{Receitas\ correntes\ ajustadas}}`,
    String.raw`\mathrm{Liquidez}=\frac{\mathrm{Obrigações\ financeiras}}{\mathrm{Disponibilidade\ de\ caixa}}`
  ], skip: 99, note: 'A classificação final da CAPAG combina as três dimensões financeiras avaliadas pela STN.' }
};

export function normalise(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function statusOf(indicador) {
  const text = normalise(indicador.status);
  if (text.startsWith('coletado')) return 'coletado';
  if (text.startsWith('parcial')) return 'parcial';
  if (text.startsWith('pendente')) return 'pendente';
  return 'manual';
}

export function selo(indicador) {
  const status = STATUS[statusOf(indicador)];
  return `<span class="ind-status ${status.cls}">${status.mark}${t(status.label)}</span>`;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);
}

function valueCell(indicador, uf) {
  if (!indicador.valores) return `<strong>—</strong><small>${t('sem valor coletado')}</small>`;
  const presente = (value) => value !== null && value !== undefined && value !== '';
  if (!uf) {
    const total = ORDEM_ESTADOS.filter((sigla) => presente(indicador.valores[sigla])).length;
    return `<strong>${tp('{n} de 9', { n: total })}</strong><small>${t('estados')} · ${escape(indicador.anoRef ? tp('ref. {ano}', { ano: indicador.anoRef }) : t(indicador.unidade || ''))}</small>`;
  }
  const value = indicador.valores[uf];
  const rendered = typeof value === 'string' ? value : formatNumber(value);
  return `<strong>${rendered}</strong><small>${escape(indicador.unidade || '')}${indicador.anoRef ? ` · ${tp('ref. {ano}', { ano: escape(indicador.anoRef) })}` : ''}</small>`;
}

function detailField(label, value, className = '') {
  const content = String(value ?? '').trim();
  if (!content) return '';
  return `<div class="indicator-detail-field ${className}"><dt>${escape(label)}</dt><dd>${escape(content)}</dd></div>`;
}

function detailScoreField(value) {
  const content = String(value ?? '').trim();
  if (!content || content === '-') return '';
  return `<div class="indicator-detail-field"><dt>${t('Pontuação')}</dt><dd class="has-track"><span>${escape(content)}</span><i class="score-track" aria-hidden="true"></i></dd></div>`;
}

function renderSource(source, references = []) {
  const links = references.map((url, index) => `<a href="${escape(url)}" target="_blank" rel="noreferrer">${tp('Abrir referência{n}', { n: references.length > 1 ? ` ${index + 1}` : '' })}<span aria-hidden="true">↗</span></a>`).join('');
  const label = references.length ? t('Fontes e referências') : t('Fonte');
  return `<div class="indicator-detail-summary-source"><span>${label}</span><strong>${escape(source || t('Não informada'))}</strong>${links ? `<div class="indicator-detail-links">${links}</div>` : ''}</div>`;
}

function renderNote(note) {
  // As fichas escrevem a legenda ora como "símbolo = descrição", ora com dois-pontos.
  // O sinal de igual fica na descrição (é parte da fórmula); os dois-pontos, não.
  const at = note.search(/[=:]/);
  const label = at > 0 ? note.slice(0, at).trim() : '';
  const rest = at > 0 ? note.slice(note[at] === ':' ? at + 1 : at).trim() : '';
  // Linhas de título ("Fontes renováveis:") não têm descrição depois do separador, e
  // rótulo longo é frase corrida, não símbolo — nos dois casos não há o que destacar.
  if (label && rest && label.length <= 42) return `<p><strong>${escape(label)}</strong> ${escape(rest)}</p>`;
  return `<p>${escape(note)}</p>`;
}

// As fichas do Eixo 4 fecham com listas de uma palavra por linha ("Solar", "Eólica").
// Reunidas sob o título que as introduz, elas ocupam uma linha em vez de dez.
function groupNotes(notes) {
  const grouped = [];
  let list = null;
  for (const note of notes) {
    const isItem = note.length <= 24 && !/[=:]/.test(note);
    if (isItem && list) { list.itens.push(note); continue; }
    list = !isItem && note.endsWith(':') ? { titulo: note, itens: [] } : null;
    grouped.push(list ?? note);
  }
  return grouped.map((entry) => (typeof entry === 'string' ? entry : `${entry.titulo} ${entry.itens.join(', ')}`.trim()));
}

// KaTeX pesa 280KB — mais de dez vezes o módulo inteiro desta página — e só é
// necessário quando alguém abre uma ficha que tem equação. Carregado sob demanda
// e guardado, ele sai do caminho da primeira pintura.
let katexPromise = null;

// A folha entra por <link> e não por import para o navegador poder buscá-la em
// paralelo com o módulo. `onload` é aguardado: sem ele a equação apareceria por
// um quadro com a tipografia do documento, o que numa fórmula é ilegível.
function carregaKatexCss() {
  const existente = document.querySelector('link[data-katex]');
  if (existente) return existente.dataset.pronto ? Promise.resolve() : esperaFolha(existente);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = enderecoDoKatexCss;
  link.dataset.katex = '1';
  document.head.appendChild(link);
  return esperaFolha(link);
}

function esperaFolha(link) {
  return new Promise((resolve) => {
    const pronto = () => { link.dataset.pronto = '1'; resolve(); };
    link.addEventListener('load', pronto, { once: true });
    // Uma folha que não carrega não pode travar a ficha: sem ela a equação sai
    // sem a tipografia matemática, o que ainda é melhor do que nada aparecer.
    link.addEventListener('error', pronto, { once: true });
  });
}

function carregaKatex() {
  if (!katexPromise) {
    katexPromise = Promise.all([
      import('katex'),
      carregaKatexCss()
    ]).then(([modulo]) => modulo.default || modulo);
  }
  return katexPromise;
}

/** Há equação para desenhar? Decide se vale acordar o KaTeX. */
function temEquacao(codigo) {
  return Boolean(FORMULAS[codigo]);
}

function renderFormula(indicador, ficha, katex) {
  // A fórmula em texto vem da ficha e as equações em LaTeX vêm daqui — e as duas
  // têm português dentro. `\mathrm{Taxa\ de\ pobreza}` e `\operatorname{média}`
  // são tipografia, não código: numa página em inglês a equação inteira precisa
  // ser outra, e não a mesma com rótulo traduzido por fora.
  const rawFormula = String(campoDaFicha(indicador.codigo, 'formula', ficha?.formula) ?? '').trim();
  const presentation = FORMULAS[indicador.codigo];
  const equacoes = equacoesDe(indicador.codigo) ?? presentation?.equations;
  const hasRawFormula = rawFormula && rawFormula !== '-';
  if (!equacoes && !hasRawFormula) return `<p class="indicator-detail-empty">${t('Fórmula não informada na ficha técnica.')}</p>`;

  if (!equacoes || !katex) {
    // Sem apresentação em LaTeX, ou antes de o KaTeX chegar: o texto da ficha já
    // diz o cálculo, e é o que estava publicado até aqui de qualquer forma.
    const texto = hasRawFormula ? rawFormula : equacoes.join('\n');
    return `<div class="indicator-formula-card is-prose"><p>${escape(texto)}</p></div>`;
  }

  const equations = equacoes.map((equation) => katex.renderToString(equation, {
    displayMode: true,
    throwOnError: false,
    strict: 'ignore',
    output: 'htmlAndMathml'
  })).map((html) => `<div class="indicator-formula-equation">${html}</div>`).join('');

  // As legendas dos símbolos podem vir inteiras da sobreposição; quando vêm, o
  // texto da ficha em português não entra junto, senão a lista sairia bilíngue.
  const legendaTraduzida = notasDaFormula(indicador.codigo);
  const sourceNotes = legendaTraduzida ?? rawFormula.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(presentation?.skip ?? 1);
  const ownNotes = legendaTraduzida ? [] : (presentation?.notes ?? (presentation?.note ? [presentation.note] : []));
  const notes = groupNotes([...ownNotes, ...sourceNotes]);
  const noteHtml = notes.length
    ? `<div class="indicator-formula-notes">${notes.map(renderNote).join('')}</div>`
    : '';
  return `<div class="indicator-formula-card"><div class="indicator-formula-equations">${equations}</div>${noteHtml}</div>`;
}

/**
 * O corpo da ficha técnica. `indicador` é a entrada do catálogo (valores,
 * descrição) fundida com o que a lista já tinha; `ficha` é a entrada de
 * fichas.json, que pode faltar em sete dos 59. `metaTexto` só vem preenchido
 * para os indicadores sem patamar, que não têm a aba de resultado onde a meta
 * pactuada normalmente aparece.
 */
export function renderFicha({ indicador, ficha, uf, katex, metaTexto = null }) {
  const status = STATUS[statusOf(indicador)];
  const rotuloContexto = uf ? tp('Valor em {estado}', { estado: NOMES_ESTADOS[uf] || uf }) : t('Cobertura nos estados');
  const aviso = ficha
    ? ''
    : `<p class="indicator-detail-note"><strong>${t('Ficha técnica não localizada no documento.')}</strong> ${t('Este indicador consta na matriz consolidada; são exibidas abaixo apenas as informações disponíveis no catálogo.')}</p>`;
  // Ordem de preferência, e o inglês inverte a do português.
  //
  // Em português a ficha técnica manda: ela é o documento de origem, e a
  // descrição do catálogo é o resumo. Em inglês, a ficha só manda se alguém a
  // traduziu; sem isso, o texto do catálogo — que está traduzido — vale mais
  // que o mesmo campo em português, porque o leitor consegue lê-lo.
  const daFicha = (nome, doCatalogo, doDocumento) => {
    const traduzido = sobreposicaoDaFicha(indicador.codigo, nome);
    if (traduzido) return traduzido;
    return ehTraducao() ? (doCatalogo || doDocumento) : (doDocumento || doCatalogo);
  };
  const comoMedido = daFicha('indicador', indicador.descricao, ficha?.indicador);
  const fonte = daFicha('fontes', indicador.fonte, ficha?.fontes);
  const referencias = ficha?.referencias?.filter((url) => /^https?:\/\//i.test(url)) || [];
  const meta = metaTexto
    ? `<section class="indicator-detail-block is-goal">
        <div class="indicator-detail-section-heading"><h3>${t('Meta pactuada')}</h3></div>
        <p>${escape(metaTexto)}</p>
      </section>`
    : '';

  return `
    <section class="indicator-detail-summary" aria-label="${t('Resumo do indicador')}">
      <div><span>${escape(rotuloContexto)}</span><div class="indicator-value-cell">${valueCell(indicador, uf)}</div></div>
      <div><span>${t('Situação da coleta')}</span><strong class="ind-status ${status.cls}">${status.mark}${escape(t(status.label))}</strong></div>
      <div><span>${t('Prazo')}</span><strong class="indicator-detail-summary-value">${escape(t(ficha?.prazo || indicador.prazo || '') || '—')}</strong></div>
      <div><span>${t('Frequência')}</span><strong class="indicator-detail-summary-value">${escape(t(campoDaFicha(indicador.codigo, 'frequencia', ficha?.frequencia) || '') || t('Não informada'))}</strong></div>
      ${renderSource(fonte, referencias)}
    </section>
    <div class="indicator-detail-content">
      ${meta}
      <div class="indicator-detail-lower">
        <section class="indicator-detail-block is-method">
          <div class="indicator-detail-section-heading"><h3>${t('Método de cálculo')}</h3></div>
          ${renderFormula(indicador, ficha, katex)}
        </section>
        <aside class="indicator-detail-aside" aria-label="${t('Dados complementares da ficha')}">
          <section class="indicator-detail-block">
            <div class="indicator-detail-section-heading"><h3>${t('Como o indicador é medido')}</h3></div>
            <p>${escape(comoMedido || t('Definição não informada.'))}</p>
          </section>
          <section class="indicator-detail-block">
            <div class="indicator-detail-section-heading"><h3>${t('Dados complementares')}</h3></div>
            <dl class="indicator-detail-grid">
              ${detailField(t('Linha de ação'), linhaDeAcao(ficha?.linhaAcao || indicador.linhaAcao), 'is-wide')}
              ${detailField(t('Unidade'), t(campoDaFicha(indicador.codigo, 'unidade', ficha?.unidade || indicador.unidade) || ''))}
              ${detailScoreField(t(ficha?.pontuacao || ""))}
            </dl>
          </section>
        </aside>
      </div>
    </div>
    ${aviso}`;
}

// ---------------------------------------------------------------------------
// Carga sob demanda
//
// A lista dos 59 é desenhada só com metas.json. O catálogo (valores por estado,
// descrição técnica) e as fichas (fórmula, frequência, referências) só fazem
// falta quando alguém abre a segunda aba do painel ou exporta o CSV — juntos são
// 126KB que não precisam estar na primeira tela.
// ---------------------------------------------------------------------------

let dossiePromise = null;

export function carregaDossie() {
  if (!dossiePromise) {
    dossiePromise = Promise.all([
      fetch('/data/catalogo.json').then((resposta) => {
        if (!resposta.ok) throw new Error(t('Não foi possível carregar o catálogo.'));
        return resposta.json();
      }),
      fetch('/data/fichas.json').then((resposta) => (resposta.ok ? resposta.json() : { fichas: {} }))
    ]).then(([catalogo, fichas]) => ({
      indicadores: Object.fromEntries(
        catalogo.eixos.flatMap((eixo) => eixo.indicadores.map((indicador) => [
          indicador.codigo,
          { ...indicador, eixoNumero: eixo.numero, eixoNome: eixo.nome }
        ]))
      ),
      fichas: fichas.fichas || {}
    })).catch((erro) => {
      // Uma falha de rede não pode congelar a aba para sempre: zerando a promessa,
      // a próxima abertura tenta de novo.
      dossiePromise = null;
      throw erro;
    });
  }
  return dossiePromise;
}

export async function carregaKatexSeNecessario(codigo) {
  if (!temEquacao(codigo)) return null;
  try {
    return await carregaKatex();
  } catch {
    // Sem KaTeX a fórmula cai no texto da ficha, que é legível. Não vale derrubar
    // a aba inteira por causa da tipografia da equação.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

/** `itens` são as linhas visíveis da lista; o catálogo entra para os valores. */
export function exportCsv(itens, catalogo, uf) {
  const rows = [['codigo', 'indicador', 'eixo', 'linha_acao', 'uf', 'valor', 'unidade', 'ano_referencia', 'status', 'meta', 'fonte']];
  for (const item of itens) {
    const indicador = catalogo[item.codigo] || {};
    const ufs = uf ? [uf] : ORDEM_ESTADOS;
    for (const sigla of ufs) {
      rows.push([
        item.codigo, item.nome, `Eixo ${item.eixo} - ${item.eixoNome}`, indicador.linhaAcao ?? item.linhaAcao ?? '',
        sigla, indicador.valores?.[sigla] ?? '', indicador.unidade ?? item.unidade ?? '',
        indicador.anoRef ?? item.anoRef ?? '', indicador.status ?? item.status ?? '',
        item.metaTexto ?? '', indicador.fonte ?? item.fonte ?? ''
      ]);
    }
  }
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `indicadores_amazonia2050_${uf || 'todos_estados'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
