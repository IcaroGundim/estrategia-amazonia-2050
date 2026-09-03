import { aoEntrarNaPagina, bindMenu, bindVista, escape, sinalDaPagina } from './shared.js';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const view = {
  catalogo: null,
  fichas: {},
  indicadores: [],
  eixos: new Set(),
  uf: 'all',
  status: 'all',
  query: '',
  page: 1,
  pageSize: 8,
  detailCode: null
};

const STATE_ORDER = ['AC', 'AP', 'AM', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO'];
const STATE_NAMES = { AC: 'Acre', AP: 'Amapá', AM: 'Amazonas', MA: 'Maranhão', MT: 'Mato Grosso', PA: 'Pará', RO: 'Rondônia', RR: 'Roraima', TO: 'Tocantins' };

const STATUS = {
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

const FORMULA_PRESENTATION = {
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

function normalise(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function statusOf(indicador) {
  const text = normalise(indicador.status);
  if (text.startsWith('coletado')) return 'coletado';
  if (text.startsWith('parcial')) return 'parcial';
  if (text.startsWith('pendente')) return 'pendente';
  return 'manual';
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);
}

function filteredIndicators() {
  const query = normalise(view.query);
  return view.indicadores.filter((indicador) => {
    if (view.eixos.size && !view.eixos.has(String(indicador.eixoNumero))) return false;
    if (view.status !== 'all' && statusOf(indicador) !== view.status) return false;
    if (query) {
      const haystack = normalise([indicador.codigo, indicador.nome, indicador.meta, indicador.fonte, indicador.eixoNome, indicador.linhaAcao].join(' '));
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function renderEixoFilters() {
  const options = [
    { value: 'all', label: 'Todos os eixos', count: view.indicadores.length, active: view.eixos.size === 0 },
    ...view.catalogo.eixos.map((eixo) => ({ value: String(eixo.numero), label: `Eixo ${eixo.numero} · ${eixo.nome}`, count: eixo.indicadores.length, active: view.eixos.has(String(eixo.numero)) }))
  ];
  document.querySelector('#indicator-eixo-filters').innerHTML = options.map((option) => `
    <button type="button" class="filter-option ${option.active ? 'is-active' : ''}" data-eixo="${option.value}" aria-pressed="${option.active}">
      <i aria-hidden="true">${option.active ? '✓' : ''}</i><span>${escape(option.label)}</span><small>${option.count}</small>
    </button>`).join('');
}

function renderStatusFilters() {
  const options = [
    { value: 'all', label: 'Todas' },
    { value: 'coletado', label: 'Coletados' },
    { value: 'parcial', label: 'Parciais' },
    { value: 'pendente', label: 'Pendentes' },
    { value: 'manual', label: 'Não coletados' }
  ];
  document.querySelector('#indicator-status-filters').innerHTML = options.map((option) => `
    <button type="button" class="status-filter ${view.status === option.value ? 'is-active' : ''}" data-status="${option.value}" aria-pressed="${view.status === option.value}">${option.label}</button>`).join('');
}

function valueCell(indicador) {
  if (!indicador.valores) return '<strong>—</strong><small>sem valor coletado</small>';
  const present = (value) => value !== null && value !== undefined && value !== '';
  if (view.uf === 'all') {
    const count = STATE_ORDER.filter((uf) => present(indicador.valores[uf])).length;
    return `<strong>${count} de 9</strong><small>estados · ${escape(indicador.anoRef ? `ref. ${indicador.anoRef}` : indicador.unidade)}</small>`;
  }
  const value = indicador.valores[view.uf];
  const rendered = typeof value === 'string' ? value : formatNumber(value);
  return `<strong>${rendered}</strong><small>${escape(indicador.unidade || '')}${indicador.anoRef ? ` · ref. ${escape(indicador.anoRef)}` : ''}</small>`;
}

function detailField(label, value, className = '') {
  const content = String(value ?? '').trim();
  if (!content) return '';
  return `<div class="indicator-detail-field ${className}"><dt>${escape(label)}</dt><dd>${escape(content)}</dd></div>`;
}

function detailScoreField(value) {
  const content = String(value ?? '').trim();
  if (!content || content === '-') return '';
  return `<div class="indicator-detail-field"><dt>Pontuação</dt><dd class="has-track"><span>${escape(content)}</span><i class="score-track" aria-hidden="true"></i></dd></div>`;
}

function renderSource(source, references = []) {
  const links = references.map((url, index) => `<a href="${escape(url)}" target="_blank" rel="noreferrer">Abrir referência${references.length > 1 ? ` ${index + 1}` : ''}<span aria-hidden="true">↗</span></a>`).join('');
  const label = references.length ? 'Fontes e referências' : 'Fonte';
  return `<div class="indicator-detail-summary-source"><span>${label}</span><strong>${escape(source || 'Não informada')}</strong>${links ? `<div class="indicator-detail-links">${links}</div>` : ''}</div>`;
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

function renderFormula(indicador, ficha) {
  const rawFormula = String(ficha?.formula ?? '').trim();
  const presentation = FORMULA_PRESENTATION[indicador.codigo];
  const hasRawFormula = rawFormula && rawFormula !== '-';
  if (!presentation && !hasRawFormula) return '<p class="indicator-detail-empty">Fórmula não informada na ficha técnica.</p>';

  if (!presentation) {
    return `<div class="indicator-formula-card is-prose"><p>${escape(rawFormula)}</p></div>`;
  }

  const equations = presentation.equations.map((equation) => katex.renderToString(equation, {
    displayMode: true,
    throwOnError: false,
    strict: 'ignore',
    output: 'htmlAndMathml'
  })).map((html) => `<div class="indicator-formula-equation">${html}</div>`).join('');

  const sourceNotes = rawFormula.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(presentation.skip ?? 1);
  const ownNotes = presentation.notes ?? (presentation.note ? [presentation.note] : []);
  const notes = groupNotes([...ownNotes, ...sourceNotes]);
  const noteHtml = notes.length
    ? `<div class="indicator-formula-notes">${notes.map(renderNote).join('')}</div>`
    : '';
  return `<div class="indicator-formula-card"><div class="indicator-formula-equations">${equations}</div>${noteHtml}</div>`;
}

function renderDetail(indicador) {
  const detailView = document.querySelector('#indicator-detail-view');
  const ficha = view.fichas[indicador.codigo] || null;
  const status = STATUS[statusOf(indicador)];
  const contextLabel = view.uf === 'all' ? 'Cobertura nos estados' : `Valor em ${STATE_NAMES[view.uf]}`;
  const fichaNotice = ficha
    ? ''
    : '<p class="indicator-detail-note"><strong>Ficha técnica não localizada no documento.</strong> Este indicador consta na matriz consolidada; são exibidas abaixo apenas as informações disponíveis no catálogo.</p>';
  const meta = ficha?.meta || indicador.meta;
  const technicalIndicator = ficha?.indicador || indicador.descricao;
  const source = ficha?.fontes || indicador.fonte;
  const references = ficha?.referencias?.filter((url) => /^https?:\/\//i.test(url)) || [];

  detailView.querySelector('[data-detail-code]').textContent = indicador.codigo;
  detailView.querySelector('[data-detail-axis]').textContent = `Eixo ${indicador.eixoNumero}`;
  detailView.querySelector('[data-detail-title]').textContent = indicador.nome;
  detailView.querySelector('[data-detail-body]').innerHTML = `
    <section class="indicator-detail-summary" aria-label="Resumo do indicador">
      <div><span>${escape(contextLabel)}</span><div class="indicator-value-cell">${valueCell(indicador)}</div></div>
      <div><span>Situação da coleta</span><strong class="ind-status ${status.cls}">${status.mark}${escape(status.label)}</strong></div>
      <div><span>Prazo</span><strong class="indicator-detail-summary-value">${escape(ficha?.prazo || indicador.prazo || '—')}</strong></div>
      <div><span>Frequência</span><strong class="indicator-detail-summary-value">${escape(ficha?.frequencia || 'Não informada')}</strong></div>
      ${renderSource(source, references)}
    </section>
    <div class="indicator-detail-content">
      <div class="indicator-detail-top">
        <section class="indicator-detail-block is-goal">
          <div class="indicator-detail-section-heading"><h3>Meta pactuada</h3></div>
          <p>${escape(meta || 'Meta não informada.')}</p>
        </section>
        <section class="indicator-detail-block">
          <div class="indicator-detail-section-heading"><h3>Como o indicador é medido</h3></div>
          <p>${escape(technicalIndicator || 'Definição não informada.')}</p>
        </section>
      </div>
      <div class="indicator-detail-lower">
        <section class="indicator-detail-block is-method">
          <div class="indicator-detail-section-heading"><h3>Método de cálculo</h3></div>
          ${renderFormula(indicador, ficha)}
        </section>
        <aside class="indicator-detail-aside" aria-label="Dados complementares da ficha">
          <section class="indicator-detail-block">
            <div class="indicator-detail-section-heading"><h3>Dados complementares</h3></div>
            <dl class="indicator-detail-grid">
              ${detailField('Linha de ação', ficha?.linhaAcao || indicador.linhaAcao, 'is-wide')}
              ${detailField('Unidade', ficha?.unidade || indicador.unidade)}
              ${detailScoreField(ficha?.pontuacao)}
            </dl>
          </section>
        </aside>
      </div>
    </div>
    ${fichaNotice}`;
}

let detailTrigger = null;

function openDetail(indicador, trigger) {
  detailTrigger = trigger;
  view.detailCode = indicador.codigo;
  renderDetail(indicador);
  document.querySelector('#indicator-list-view').hidden = true;
  document.querySelector('#indicator-detail-view').hidden = false;
  document.querySelector('.indicators-table-card').classList.add('is-detail');
  document.querySelector('.indicators-table-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.querySelector('[data-detail-back]').focus({ preventScroll: true });
}

function closeDetail({ restoreFocus = true, scroll = true } = {}) {
  if (!view.detailCode) return;
  view.detailCode = null;
  document.querySelector('#indicator-detail-view').hidden = true;
  document.querySelector('#indicator-list-view').hidden = false;
  document.querySelector('.indicators-table-card').classList.remove('is-detail');
  if (scroll) document.querySelector('.indicators-table-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (restoreFocus) detailTrigger?.focus({ preventScroll: true });
  detailTrigger = null;
}

function renderTable() {
  const filtered = filteredIndicators();
  const pages = Math.max(1, Math.ceil(filtered.length / view.pageSize));
  view.page = Math.min(view.page, pages);
  const start = (view.page - 1) * view.pageSize;
  const rows = filtered.slice(start, start + view.pageSize);
  document.querySelector('[data-filtered-count]').textContent = filtered.length;
  document.querySelector('#indicator-table-body').innerHTML = rows.length ? rows.map((indicador) => {
    const status = STATUS[statusOf(indicador)];
    return `<article class="indicator-table-row" role="row" data-indicator-code="${escape(indicador.codigo)}">
      <div class="indicator-name-cell" role="cell"><button class="indicator-open" type="button" data-indicator-code="${escape(indicador.codigo)}" aria-label="Ver ficha técnica de ${escape(indicador.nome)}"><strong>${escape(indicador.nome)}</strong><span>${escape(indicador.fonte)}</span><small>Ver ficha técnica <i aria-hidden="true">→</i></small></button></div>
      <div class="indicator-axis-cell" role="cell"><strong>Eixo ${indicador.eixoNumero}</strong><span>${escape(indicador.eixoNome)}</span></div>
      <div class="indicator-goal-cell" role="cell"><span>${escape(indicador.meta)}</span></div>
      <div class="indicator-status-cell" role="cell"><span class="ind-status ${status.cls}">${status.mark}${status.label}</span></div>
    </article>`;
  }).join('') : '<div class="indicator-empty">Nenhum indicador corresponde aos filtros selecionados.</div>';

  const end = Math.min(start + view.pageSize, filtered.length);
  document.querySelector('[data-page-summary]').textContent = filtered.length ? `${start + 1}–${end} de ${filtered.length}` : '0 indicadores';
  document.querySelector('[data-page="prev"]').disabled = view.page <= 1;
  document.querySelector('[data-page="next"]').disabled = view.page >= pages;
}

function renderAll() {
  renderEixoFilters();
  renderStatusFilters();
  renderTable();
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function exportCsv() {
  const rows = [['codigo', 'indicador', 'eixo', 'linha_acao', 'uf', 'valor', 'unidade', 'ano_referencia', 'status', 'meta', 'fonte']];
  for (const indicador of filteredIndicators()) {
    const ufs = view.uf === 'all' ? STATE_ORDER : [view.uf];
    for (const uf of ufs) {
      rows.push([
        indicador.codigo, indicador.nome, `Eixo ${indicador.eixoNumero} - ${indicador.eixoNome}`, indicador.linhaAcao,
        uf, indicador.valores?.[uf] ?? '', indicador.unidade ?? '', indicador.anoRef ?? '', indicador.status ?? '', indicador.meta ?? '', indicador.fonte ?? ''
      ]);
    }
  }
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `indicadores_amazonia2050_${view.uf === 'all' ? 'todos_estados' : view.uf}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-detail-back]')) {
      closeDetail();
      return;
    }
    const indicatorRow = event.target.closest('.indicator-table-row[data-indicator-code]');
    if (indicatorRow) {
      const indicador = view.indicadores.find((item) => item.codigo === indicatorRow.dataset.indicatorCode);
      if (indicador) openDetail(indicador, indicatorRow.querySelector('.indicator-open'));
      return;
    }
    const eixo = event.target.closest('[data-eixo]');
    if (eixo) {
      closeDetail({ restoreFocus: false, scroll: false });
      const value = eixo.dataset.eixo;
      if (value === 'all') view.eixos.clear();
      else if (view.eixos.has(value)) view.eixos.delete(value);
      else view.eixos.add(value);
      view.page = 1;
      renderAll();
    }
    const status = event.target.closest('[data-status]');
    if (status) { closeDetail({ restoreFocus: false, scroll: false }); view.status = status.dataset.status; view.page = 1; renderAll(); }
    const page = event.target.closest('[data-page]');
    if (page && !page.disabled) { view.page += page.dataset.page === 'next' ? 1 : -1; renderTable(); document.querySelector('.indicators-table-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }, { signal: sinalDaPagina() });
  const estadoDropdown = document.querySelector('#indicator-state');
  const estadoToggle = estadoDropdown.querySelector('.dropdown-toggle');
  const estadoMenu = estadoDropdown.querySelector('.dropdown-menu');
  const estadoOptions = [['all', 'Todos os nove'], ...STATE_ORDER.map((uf) => [uf, STATE_NAMES[uf]])];
  const setEstadoOpen = (open) => {
    estadoDropdown.classList.toggle('is-open', open);
    estadoToggle.setAttribute('aria-expanded', String(open));
    estadoMenu.hidden = !open;
    if (open) {
      estadoMenu.innerHTML = estadoOptions.map(([value, label]) => `
        <li role="option" tabindex="-1" data-uf="${value}" class="${view.uf === value ? 'is-selected' : ''}" aria-selected="${view.uf === value}">${label}</li>`).join('');
      // Sem `preventScroll` o toque que abre o seletor arrastava a página.
      (estadoMenu.querySelector('.is-selected') || estadoMenu.querySelector('[data-uf]')).focus({ preventScroll: true });
    }
  };
  const applyEstado = (value) => {
    view.uf = value;
    view.page = 1;
    estadoToggle.querySelector('[data-dropdown-value]').textContent = estadoOptions.find(([v]) => v === value)[1];
    estadoMenu.querySelectorAll('[data-uf]').forEach((li) => {
      const selected = li.dataset.uf === value;
      li.classList.toggle('is-selected', selected);
      li.setAttribute('aria-selected', String(selected));
    });
    const indicador = view.indicadores.find((item) => item.codigo === view.detailCode);
    if (indicador) renderDetail(indicador); else renderTable();
  };
  estadoToggle.addEventListener('click', () => setEstadoOpen(estadoMenu.hidden));
  estadoMenu.addEventListener('click', (event) => {
    const li = event.target.closest('[data-uf]');
    if (!li) return;
    applyEstado(li.dataset.uf);
    setEstadoOpen(false);
    estadoToggle.focus();
  });
  estadoMenu.addEventListener('keydown', (event) => {
    const items = [...estadoMenu.querySelectorAll('[data-uf]')];
    const at = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); (items[at + 1] || items[0]).focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); (items[at - 1] || items[items.length - 1]).focus(); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); (items[at] || items[0]).click(); }
    else if (event.key === 'Escape') { setEstadoOpen(false); estadoToggle.focus(); }
  });
  document.addEventListener('click', (event) => {
    if (!estadoDropdown.contains(event.target)) setEstadoOpen(false);
  }, { signal: sinalDaPagina() });
  document.querySelector('#indicator-search').addEventListener('input', (event) => { view.query = event.target.value; view.page = 1; renderTable(); });
  document.querySelector('#export-csv').addEventListener('click', exportCsv);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && view.detailCode) closeDetail();
  }, { signal: sinalDaPagina() });

  bindMenu();
  bindVista();
}

async function init() {
  const [catalogResponse, fichasResponse] = await Promise.all([
    fetch('/data/catalogo.json'),
    fetch('/data/fichas.json')
  ]);
  if (!catalogResponse.ok) throw new Error('Não foi possível carregar o catálogo.');
  view.catalogo = await catalogResponse.json();
  if (fichasResponse.ok) view.fichas = (await fichasResponse.json()).fichas || {};
  view.indicadores = view.catalogo.eixos.flatMap((eixo) => eixo.indicadores.map((indicador) => ({ ...indicador, eixoNumero: eixo.numero, eixoNome: eixo.nome })));
  bindEvents();
  renderAll();
}

const ANCORA = '#indicator-table-body';

aoEntrarNaPagina(ANCORA, () => init().catch((error) => {
  document.querySelector('#indicator-table-body').innerHTML = `<div class="indicator-empty">${escape(error.message)} Atualize a página para tentar novamente.</div>`;
}));
