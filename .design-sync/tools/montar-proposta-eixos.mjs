// Proposta para a rota Metas e indicadores: primeiro os cinco eixos, com o progresso de cada um;
// ao clicar num eixo, a tela dele com os indicadores (a lista e o detalhe reais do site, filtrados).
// Gera Metas-Eixos.dc.html e Metas-Eixo1..5.dc.html no mesmo projeto do canvas e acrescenta uma
// fileira ao índice publicado.
//
// Números: dashboard/public/data/metas.json. "Jornada" é a fração do caminho até o patamar na
// leitura regional (regional.escala); o progresso do eixo é a média simples das jornadas das metas
// que têm escala. Situação da coleta com a mesma regra do site (fichas.js: statusOf).
//
// Uso: node .design-sync/tools/montar-proposta-eixos.mjs <canvas.json publicado> [alturas.json]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SAIDA, CSS, captura, converterAtributos, documento, mapeadorDeUrl, partes } from './montar-canvas.mjs';

const [indicePublicado, arquivoAlturas] = process.argv.slice(2);
const alturas = arquivoAlturas && existsSync(arquivoAlturas) ? JSON.parse(readFileSync(arquivoAlturas, 'utf8')) : {};
const dados = JSON.parse(readFileSync('dashboard/public/data/metas.json', 'utf8'));

// ---------------------------------------------------------------------------
// Números por eixo
const normal = (texto) => String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const situacao = (item) => {
  const texto = normal(item.status);
  if (texto.startsWith('coletado')) return 'coletado';
  if (texto.startsWith('parcial')) return 'parcial';
  return 'pendente';
};
const CURTOS = { 1: 'Território', 2: 'Pessoas', 3: 'Economia', 4: 'Infraestrutura', 5: 'Governança' };
const eixos = {};
for (const item of [...dados.metas.map((meta) => ({ ...meta, ehMeta: true })), ...dados.foraDoPainel]) {
  const e = (eixos[item.eixo] ||= {
    numero: item.eixo, nome: item.eixoNome, total: 0, metas: 0, jornadas: [], semEscala: 0, comValores: 0,
    sit: { coletado: 0, parcial: 0, pendente: 0 }
  });
  e.total += 1;
  e.sit[situacao(item)] += 1;
  if (item.ehMeta) {
    e.metas += 1;
    if (item.regional && Number.isFinite(item.regional.escala)) e.jornadas.push(item.regional.escala);
    else e.semEscala += 1;
  }
  if (item.ehMeta || item.temValores) e.comValores += 1;
}
const listaEixos = Object.values(eixos).sort((a, b) => a.numero - b.numero);
for (const e of listaEixos) e.media = e.jornadas.length ? e.jornadas.reduce((s, v) => s + v, 0) / e.jornadas.length : null;
const todasJornadas = listaEixos.flatMap((e) => e.jornadas);
const geral = {
  total: listaEixos.reduce((s, e) => s + e.total, 0),
  metas: listaEixos.reduce((s, e) => s + e.metas, 0),
  comEscala: todasJornadas.length,
  media: todasJornadas.reduce((s, v) => s + v, 0) / todasJornadas.length
};

const pct = (valor) => `${Math.round(valor * 100)}%`;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const arquivoDoEixo = (n) => `Metas-Eixo${n}.dc.html`;

function notaDaJornada(e) {
  if (!e.metas) return `${e.comValores} de ${e.total} indicadores já têm valores`;
  const base = `média de ${plural(e.jornadas.length, 'meta', 'metas')}`;
  return e.semEscala ? `${base} com escala · ${e.semEscala} sem ponto de partida` : base;
}

// ---------------------------------------------------------------------------
// Peças novas, com os tokens da global.css
const COR_SITUACAO = {
  coletado: 'var(--mata-700)',
  parcial: 'var(--ocre)',
  pendente: 'repeating-linear-gradient(45deg, var(--linha-2) 0 3px, var(--linha) 3px 6px)'
};
const ROTULO_SITUACAO = { coletado: ['coletado', 'coletados'], parcial: ['parcial', 'parciais'], pendente: ['pendente', 'pendentes'] };

function barraJornada(media) {
  const hachura = media === null ? '' : '<i style="position: absolute; inset: 0; background: repeating-linear-gradient(45deg, transparent 0 5px, rgba(192, 69, 31, 0.12) 5px 10px)"></i>';
  const feito = media === null ? '' : `<i style="position: absolute; top: 0; bottom: 0; left: 0; width: ${pct(media)}; border-radius: 4px 2px 2px 4px; background: var(--mata-500)"></i>`;
  return `<span aria-hidden="true" style="position: relative; display: block; height: 10px; overflow: hidden; border-radius: 4px; background: var(--linha-2)">${hachura}${feito}</span>`;
}

function coleta(e, altura = 6) {
  const segmentos = Object.entries(e.sit).filter(([, n]) => n)
    .map(([chave, n]) => `<i style="flex: ${n} 1 0; background: ${COR_SITUACAO[chave]}"></i>`).join('');
  const legenda = Object.entries(e.sit).filter(([, n]) => n)
    .map(([chave, n]) => `<span style="display: inline-flex; align-items: center; gap: 5px"><i style="width: 8px; height: 8px; border-radius: 2px; background: ${COR_SITUACAO[chave]}"></i>${n} ${n === 1 ? ROTULO_SITUACAO[chave][0] : ROTULO_SITUACAO[chave][1]}</span>`).join('');
  return `<span aria-hidden="true" style="display: flex; gap: 2px; height: ${altura}px; overflow: hidden; border-radius: ${altura > 6 ? 4 : 3}px">${segmentos}</span>
<span style="display: flex; flex-wrap: wrap; gap: 4px 12px; color: var(--tinta-3); font-size: 10.5px">${legenda}</span>`;
}

function leitura(e, tamanho) {
  const valor = e.media === null ? '—' : pct(e.media);
  const cor = e.media === null ? 'var(--tinta-4)' : 'var(--mata)';
  const rotulo = e.metas
    ? '<span style="padding-bottom: 3px; color: var(--tinta-4); font: 600 10px/1.3 var(--text); letter-spacing: 0.12em; text-transform: uppercase">Jornada<br>do eixo</span>'
    : '<span style="padding-bottom: 2px; color: var(--tinta-4); font-size: 11px; line-height: 1.3">sem meta com patamar<br>mensurável</span>';
  return `<div style="display: flex; align-items: flex-end; gap: 10px">
<b style="color: ${cor}; font: 800 ${tamanho}px/0.9 var(--display); letter-spacing: -0.03em; font-variant-numeric: tabular-nums">${valor}</b>
${rotulo}
</div>
${barraJornada(e.media)}
<p style="margin: 0; color: var(--tinta-4); font-size: 10px">${notaDaJornada(e)}</p>`;
}

function cartaoDoEixo(e) {
  return `<a class="eixo-cartao" href="${arquivoDoEixo(e.numero)}" style="display: flex; flex-direction: column; gap: 16px; min-width: 0; padding: 20px 20px 18px; border: 1px solid var(--linha); border-radius: 14px; background: var(--papel); color: var(--tinta); text-decoration: none">
<h2 style="margin: 0; min-height: 46px; font: 800 19px/1.2 var(--display); letter-spacing: -0.02em; text-wrap: balance">${e.nome}</h2>
<div style="display: grid; gap: 9px">
${leitura(e, 44)}
</div>
<div style="display: grid; gap: 9px; padding-top: 14px; border-top: 1px solid var(--linha-2)">
<span style="display: flex; justify-content: space-between; gap: 8px; color: var(--tinta-3); font-size: 12px"><span><b style="color: var(--mata); font-variant-numeric: tabular-nums">${e.total}</b> indicadores</span><span><b style="color: var(--mata); font-variant-numeric: tabular-nums">${e.metas}</b> com meta</span></span>
${coleta(e)}
</div>
<span style="margin-top: auto; padding-top: 4px; color: var(--urucum); font: 600 12px var(--text)">Ver os ${e.total} indicadores ›</span>
</a>`;
}

function seletorDeEixos(atual) {
  const pilulas = listaEixos.map((e) => {
    const ativo = e.numero === atual;
    return `<a href="${arquivoDoEixo(e.numero)}" title="${e.nome}"${ativo ? ' aria-current="page"' : ''} style="display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 14px; border: 1px solid ${ativo ? 'var(--mata)' : 'var(--linha)'}; border-radius: 9px; background: ${ativo ? 'var(--mata)' : 'var(--papel)'}; color: ${ativo ? 'var(--areia)' : 'var(--tinta-2)'}; font: 600 12px var(--text); text-decoration: none; white-space: nowrap">
${CURTOS[e.numero]}<small style="color: ${ativo ? 'rgba(245, 240, 232, 0.72)' : 'var(--tinta-4)'}; font-size: 11px; font-weight: 600; font-variant-numeric: tabular-nums">${e.media === null ? '—' : pct(e.media)}</small></a>`;
  }).join('\n');
  return `<nav aria-label="Eixos" style="display: flex; flex-wrap: wrap; gap: 6px">\n${pilulas}\n</nav>`;
}

function cabecalhoDoEixo(e) {
  return `<section class="card" style="padding: 16px 22px 20px">
<div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap">
<a class="eixo-voltar" href="Metas-Eixos.dc.html" style="display: inline-flex; align-items: center; gap: 8px; min-height: 40px; color: var(--mata); font: 600 12.5px var(--text); text-decoration: none">← Todos os eixos</a>
${seletorDeEixos(e.numero)}
${barraDeFiltros}
</div>
<div style="margin-top: 16px; padding-top: 22px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; gap: 48px; border-top: 1px solid var(--linha-2)">
<h1 style="margin: 0; font: 800 34px/1.05 var(--display); letter-spacing: -0.03em; text-wrap: balance">${e.nome}</h1>
<div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); border-left: 1px solid var(--linha-2)">
<div style="display: grid; gap: 10px; align-content: start; padding: 0 28px">
${leitura(e, 40)}
</div>
<div style="display: grid; gap: 10px; align-content: start; padding-left: 28px; border-left: 1px solid var(--linha-2)">
<div style="display: flex; align-items: flex-end; gap: 10px">
<b style="color: var(--mata); font: 800 40px/0.9 var(--display); letter-spacing: -0.03em; font-variant-numeric: tabular-nums">${pct(e.sit.coletado / e.total)}</b>
<span style="padding-bottom: 3px; color: var(--tinta-4); font: 600 10px/1.3 var(--text); letter-spacing: 0.12em; text-transform: uppercase">Coleta<br>do eixo</span>
</div>
${coleta(e, 10)}
</div>
</div>
</div>
</section>`;
}

// ---------------------------------------------------------------------------
// Marcação reaproveitada do site
function elemento(html, inicio) {
  const tag = html.slice(inicio + 1).match(/^[a-z0-9-]+/)[0];
  const padrao = new RegExp(`<(/?)${tag}(?=[\\s>/])[^>]*>`, 'g');
  padrao.lastIndex = inicio;
  let profundidade = 0;
  for (let achado; (achado = padrao.exec(html));) {
    if (achado[1]) {
      profundidade -= 1;
      if (profundidade === 0) return { inicio, fim: padrao.lastIndex, texto: html.slice(inicio, padrao.lastIndex) };
    } else if (!achado[0].endsWith('/>')) profundidade += 1;
  }
  throw new Error(`<${tag}> sem fechamento`);
}
function achar(html, marca, tag = null) {
  const posicao = html.indexOf(marca);
  if (posicao < 0) throw new Error(`não achei ${marca}`);
  const inicio = tag ? html.lastIndexOf(`<${tag}`, posicao) : html.lastIndexOf('<', posicao);
  return elemento(html, inicio);
}
function tirar(html, marca, tag) {
  let saida = html;
  while (saida.includes(marca)) {
    const { inicio, fim } = achar(saida, marca, tag);
    saida = saida.slice(0, inicio) + saida.slice(fim);
  }
  return saida;
}

// No detalhe de uma meta com patamar, a meta pactuada sobe para o topo do painel, no mesmo bloco
// verde-mata que o site já usa para os coletados sem meta numérica (.coletado-meta).
function metaPactuadaEmDestaque(html) {
  const secao = /<section class="goals-detail-section">\s*<h3>Meta pactuada<\/h3>\s*<p class="goals-detail-meta">([\s\S]*?)<\/p>\s*<\/section>\s*/;
  const achado = html.match(secao);
  if (!achado) return html;
  const prazo = (html.match(/<dt>Meta<\/dt><dd>[^<]*?(até \d{4})<\/dd>/) || [])[1];
  const bloco = `<section class="coletado-meta">
      <h3>Meta pactuada${prazo ? ` · ${prazo}` : ''}</h3>
      <p class="coletado-meta-texto">${achado[1]}</p>
    </section>

    `;
  const semSecao = html.replace(secao, '');
  if (!semSecao.includes('<dl class="goals-detail-summary">')) throw new Error('detalhe sem o resumo da meta');
  return semSecao.replace('<dl class="goals-detail-summary">', `${bloco}<dl class="goals-detail-summary">`);
}

const principalDe = (nome) => partes(converterAtributos(captura(nome).html, mapeadorDeUrl(false))).principal;
// Sem o filtro de eixo: os eixos passam a ser a navegação da rota.
// Só busca e Baixar: os filtros de eixo e de coleta saem. A barra vive dentro do card do eixo,
// à direita das abas; na tela dos cinco eixos ela não aparece.
const barraDeFiltros = tirar(achar(principalDe('metas'), 'class="goals-toolbar').texto, 'class="filter-linhas"', 'div class="filter-linhas"')
  .replace('<div class="goals-toolbar filters-card card">', '<div class="goals-toolbar filters-card card" style="flex: 0 1 440px; margin: 0 0 0 auto">');
const bandeiras = achar(principalDe('metas'), 'id="goals-flags"').texto;

const ESTILO_EXTRA = `a.eixo-cartao { transition: border-color 150ms ease, box-shadow 150ms ease; }
a.eixo-cartao:hover { border-color: var(--mata-300); box-shadow: 0 4px 14px rgba(14, 43, 34, 0.09); }
a.eixo-voltar:hover { color: var(--urucum); }`;

function prancheta({ arquivo, titulo, principal, altura }) {
  const corpo = `<dc-import name="Topbar" ativo="metas" hint-size="100%,84px"></dc-import>
${principal}
<dc-import name="Rodape" ativo="metas" hint-size="100%,120px"></dc-import>`;
  let html = documento({
    titulo, css: CSS.base, largura: 1440, altura, corpo, props: {},
    logica: 'class Component extends DCLogic {\n  renderVals() {\n    return {};\n  }\n}',
    raiz: `position: relative; width: 1440px; height: ${altura}px; overflow: hidden; background: #e8e0d6`
  });
  html = html.replace('<style>body{margin:0}</style>', `<style>body{margin:0}\n${ESTILO_EXTRA}</style>`);
  writeFileSync(join(SAIDA, arquivo), html);
  return { w: 1440, h: altura, title: titulo, is_interactive: true };
}

const novas = {};

const resumo = `<p class="goals-list-summary" style="margin-top: 8px; font-size: 13px"><span>${geral.total}</span> indicadores em cinco eixos · <span>${geral.metas}</span> com meta mensurável · jornada média de <span>${pct(geral.media)}</span> nas ${geral.comEscala} metas com escala</p>`;
const visaoGeral = `<main id="conteudo" class="goals-page"><div class="section-shell">
<h1 class="sr-only">Metas e indicadores por eixo</h1>
<section class="card" style="padding: 22px 26px 26px">
<div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 14px 24px; flex-wrap: wrap; padding-bottom: 18px; border-bottom: 1px solid var(--linha)">
<div><h2 style="margin: 0; font: 800 clamp(26px, 2.2vw, 40px)/0.96 var(--display); letter-spacing: -0.03em">Metas - <em style="color: var(--urucum); font-style: normal">Amazônia Legal.</em></h2></div>
${bandeiras}
</div>
<div style="margin-top: 22px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px">
${listaEixos.map(cartaoDoEixo).join('\n')}
</div>
</section>
</div></main>`;
novas['Metas-Eixos.dc.html'] = prancheta({ arquivo: 'Metas-Eixos.dc.html', titulo: 'Proposta · Metas por eixos', principal: visaoGeral, altura: alturas['Metas-Eixos.dc.html'] || 1400 });

for (const e of listaEixos) {
  const principal = principalDe(`metas-eixo-${e.numero}`);
  const quadro = metaPactuadaEmDestaque(tirar(achar(principal, 'class="goals-board').texto, 'class="goals-eixo-head"', 'header'));
  const tela = `<main id="conteudo" class="goals-page"><div class="section-shell">
<h1 class="sr-only">Metas e indicadores · Eixo ${e.numero}</h1>
${cabecalhoDoEixo(e)}
<div style="margin-top: 16px">
${quadro}
</div>
</div></main>`;
  const arquivo = arquivoDoEixo(e.numero);
  novas[arquivo] = prancheta({ arquivo, titulo: `Proposta · Eixo ${e.numero} aberto`, principal: tela, altura: alturas[arquivo] || 2400 });
}

// ---------------------------------------------------------------------------
// Índice: a fileira nova vai à direita da fileira atual das Metas, com título e uma nota.
const indice = JSON.parse(readFileSync(indicePublicado, 'utf8'));
const linhaDasMetas = indice.boards['Metas.dc.html'];
const fimDasMetas = Math.max(...Object.values(indice.boards).filter((b) => b.y === linhaDasMetas.y).map((b) => b.x + b.w));
let x = fimDasMetas + 240;
const inicioDaProposta = x;
for (const [arquivo, quadro] of Object.entries(novas)) {
  indice.boards[arquivo] = { x, y: linhaDasMetas.y, ...quadro };
  if (!indice.order.includes(arquivo)) indice.order.push(arquivo);
  x += quadro.w + 80;
}
indice.notes['proposta-eixos'] = { x: inicioDaProposta, y: linhaDasMetas.y - 300, text: 'Proposta · Metas por eixos', kind: 'title1', maxW: x - 80 - inicioDaProposta };
indice.notes['proposta-eixos-como'] = {
  x: inicioDaProposta, y: linhaDasMetas.y + Math.max(...Object.values(novas).map((q) => q.h)) + 60, w: 520, maxH: 400,
  text: 'Protótipo navegável (Play): a primeira tela mostra os cinco eixos com o progresso de cada um; clicar num eixo abre os indicadores dele, com o detalhe ao lado. "← Todos os eixos" volta, e as pílulas trocam de eixo sem voltar. Progresso do eixo = média simples da jornada regional das metas com patamar e ponto de partida.'
};
writeFileSync(join(SAIDA, 'canvas.json'), JSON.stringify(indice, null, 1));

for (const e of listaEixos) console.log(`Eixo ${e.numero}: ${e.total} indicadores, ${e.metas} metas, jornada ${e.media === null ? '—' : pct(e.media)} (${e.jornadas.length} com escala), coleta ${JSON.stringify(e.sit)}`);
console.log(`Geral: ${geral.total} indicadores, ${geral.metas} metas, ${geral.comEscala} com escala, jornada média ${pct(geral.media)}`);
console.log(Object.entries(novas).map(([a, q]) => `${a} ${q.w}x${q.h}`).join('\n'));
