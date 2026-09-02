import { aoEntrarNaPagina, BANDEIRA_REGIAO, bindMenu, decimals, escape, flagImage, number, readResponse, sinalDaPagina } from './shared.js';
import { centroidOf, mapPath, projecaoPara } from './mapa.js';

// A página é sempre da Amazônia Legal: o mapa mostra a distribuição da meta
// selecionada, mas não é um filtro. Passar o mouse revela o valor do estado.
const state = { data: null, geo: null, meta: null, uf: null };

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
        const item = state.uf ? meta.estados[state.uf] : meta.regional;
        const { cumprem, total } = contagem(meta);
        // Não ter valor regional único não quer dizer não ter progresso: a CAPAG é uma
        // classificação por estado e o patamar da meta são os nove em A ou B, então a
        // jornada da região é quantos já chegaram lá. Na visão de um estado o vazio
        // continua vazio — ali a ausência é falta de dado, não uma contagem.
        const contaEstados = !item && !state.uf && total > 0;
        const p = item
          ? (item.cumpre ? 100 : (Number.isFinite(item.escala) ? Math.round(item.escala * 100) : 0))
          : (contaEstados ? Math.round(cumprem / total * 100) : 0);
        const semEscala = item && !item.cumpre && !Number.isFinite(item.escala) && !item.categoria;

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

        // Linhas só são clicáveis quando existe um mapa ligado à seleção.
        const interativo = cardDoMapaVisivel();
        const tag = interativo ? 'button' : 'div';
        const atributos = interativo
          ? ` type="button" data-meta="${meta.codigo}"${meta.codigo === state.meta ? ' aria-pressed="true"' : ''}`
          : '';
        const ativa = interativo && meta.codigo === state.meta ? ' is-active' : '';
        return `<${tag}${atributos} class="goals-row ${classe}${ativa}">
          <span class="goals-row-name">${escape(meta.nome)}<small>meta ${patamar}${meta.prazo ? ` até ${meta.prazo}` : ''}</small></span>
          <span class="goals-row-bar" aria-hidden="true"><i class="resta"></i><i class="feito" data-meta-barra="${meta.codigo}" data-destino="${p}" style="width:${partida}%"></i>${rotulo}</span>
          <span class="goals-row-ler"><b>${leitura}</b><small>jornada</small></span>
        </${tag}>`;
      }).join('')}
    </section>`).join('');

  animaBarras();
}

function renderAll() {
  renderReading();
  renderMap();
  renderList();
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
    });
  }
  if (cardDoMapaVisivel()) {
    document.querySelector('#goals-list').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-meta]');
      if (!button) return;
      state.meta = button.dataset.meta;
      renderAll();
    });
  }
  bindMenu();
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
