import { aoEntrarNaPagina, bindMenu, escape, sinalDaPagina } from './shared.js';

const view = {
  catalogo: null,
  indicadores: [],
  eixo: 'all',
  uf: 'all',
  status: 'all',
  query: '',
  page: 1,
  pageSize: 8
};

const STATE_ORDER = ['AC', 'AP', 'AM', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO'];

const STATUS = {
  coletado: { label: 'Coletado', cls: 'is-ok' },
  parcial: { label: 'Parcial', cls: 'is-partial' },
  pendente: { label: 'Pendente', cls: 'is-pending' },
  manual: { label: 'Não coletado', cls: 'is-manual' }
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
    if (view.eixo !== 'all' && String(indicador.eixoNumero) !== view.eixo) return false;
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
    { value: 'all', label: 'Todos os eixos', count: view.indicadores.length },
    ...view.catalogo.eixos.map((eixo) => ({ value: String(eixo.numero), label: `Eixo ${eixo.numero} · ${eixo.nome}`, count: eixo.indicadores.length }))
  ];
  document.querySelector('#indicator-eixo-filters').innerHTML = options.map((option) => `
    <button type="button" class="filter-option ${view.eixo === option.value ? 'is-active' : ''}" data-eixo="${option.value}" aria-pressed="${view.eixo === option.value}">
      <i aria-hidden="true">${view.eixo === option.value ? '✓' : ''}</i><span>${escape(option.label)}</span><small>${option.count}</small>
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

function renderTable() {
  const filtered = filteredIndicators();
  const pages = Math.max(1, Math.ceil(filtered.length / view.pageSize));
  view.page = Math.min(view.page, pages);
  const start = (view.page - 1) * view.pageSize;
  const rows = filtered.slice(start, start + view.pageSize);
  document.querySelector('[data-filtered-count]').textContent = filtered.length;
  document.querySelector('#indicator-table-body').innerHTML = rows.length ? rows.map((indicador) => {
    const status = STATUS[statusOf(indicador)];
    return `<article class="indicator-table-row" role="row">
      <div class="indicator-name-cell" role="cell"><strong>${escape(indicador.nome)}</strong><span>${escape(indicador.fonte)}</span></div>
      <div class="indicator-axis-cell" role="cell"><strong>Eixo ${indicador.eixoNumero}</strong><span>${escape(indicador.eixoNome)}</span></div>
      <div class="indicator-value-cell" role="cell">${valueCell(indicador)}</div>
      <div class="indicator-goal-cell" role="cell"><span>${escape(indicador.meta)}</span></div>
      <div class="indicator-status-cell" role="cell"><span class="ind-status ${status.cls}">${status.label}</span></div>
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
    const eixo = event.target.closest('[data-eixo]');
    if (eixo) { view.eixo = eixo.dataset.eixo; view.page = 1; renderAll(); }
    const status = event.target.closest('[data-status]');
    if (status) { view.status = status.dataset.status; view.page = 1; renderAll(); }
    const page = event.target.closest('[data-page]');
    if (page && !page.disabled) { view.page += page.dataset.page === 'next' ? 1 : -1; renderTable(); document.querySelector('.indicators-table-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }, { signal: sinalDaPagina() });
  document.querySelector('#indicator-state').addEventListener('change', (event) => { view.uf = event.target.value; view.page = 1; renderTable(); });
  document.querySelector('#indicator-search').addEventListener('input', (event) => { view.query = event.target.value; view.page = 1; renderTable(); });
  document.querySelector('#export-csv').addEventListener('click', exportCsv);

  bindMenu();
}

async function init() {
  const response = await fetch('/data/catalogo.json');
  if (!response.ok) throw new Error('Não foi possível carregar o catálogo.');
  view.catalogo = await response.json();
  view.indicadores = view.catalogo.eixos.flatMap((eixo) => eixo.indicadores.map((indicador) => ({ ...indicador, eixoNumero: eixo.numero, eixoNome: eixo.nome })));
  bindEvents();
  renderAll();
}

const ANCORA = '#indicator-table-body';

aoEntrarNaPagina(ANCORA, () => init().catch((error) => {
  document.querySelector('#indicator-table-body').innerHTML = `<div class="indicator-empty">${escape(error.message)} Atualize a página para tentar novamente.</div>`;
}));
