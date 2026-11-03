import { aoEntrarNaPagina, bindMenu, bindVista, decimals, escape, number, readResponse, sinalDaPagina } from './shared.js';
import { idiomaAtual, rota, t, tp } from '../i18n/index.js';
import { carregaConteudo, nomeDoEixo } from './conteudo.js';

// As projeções do Panorama (ver o cabeçalho de PaginaProjecoes.astro). Três vistas:
//
//   - os cinco eixos: a lista numerada à esquerda e o painel do eixo escolhido
//     à direita. O eixo sob o mouse entra no painel; parados, eles se alternam
//     a cada 8 s, com a barra urucum correndo embaixo, como em "Cinco eixos"
//     da Visão Geral;
//   - o eixo aberto (`#eixo-2`): o topo escuro com a trajetória do eixo, a de
//     cada indicador atrás, e um cartão por indicador;
//   - o indicador aberto: o cartão cresce no lugar, como em Projetos, com a
//     série ano a ano e a tabela dos marcos.
//
// Tudo o que este script liga sai na troca de página (sinalDaPagina).
const ANCORA = '[data-projecoes]';
const ANO0 = 2025;
const ANO1 = 2050;
const HOJE = 2026;
const MARCOS = [2030, 2035, 2040, 2045, 2050];
const ANOS = Array.from({ length: ANO1 - ANO0 + 1 }, (_, k) => ANO0 + k);
const TROCA_MS = 8000; // o mesmo tempo da barra no projecoes.css (pj-enche)

const dois = (n) => String(n).padStart(2, '0');
const pct = (fracao) => `${Math.round(fracao * 100)}%`;
const rotuloDoEixo = (n) => tp('Eixo {n}', { n: dois(n) });

// ---------- números ----------

// A partir de um milhão o número vai abreviado ("6,12 mi"), como na trajetória
// da página Metas: em reais, o valor inteiro não cabe no gráfico.
function numeroProjecao(valor) {
  if (!Number.isFinite(valor)) return '–';
  if (Math.abs(valor) >= 1e6) return `${number(valor / 1e6, 2)} ${t('mi')}`;
  return number(valor, Math.abs(valor) >= 1000 ? 0 : decimals(valor));
}

/** O valor com a unidade colada quando ela é curta; as demais vão na linha da unidade. */
function comUnidade(valor, unidade) {
  const u = String(unidade || '');
  if (u.startsWith('%')) return `${numeroProjecao(valor)}%`;
  if (u === 'R$') return `R$ ${numeroProjecao(valor)}`;
  if (u === 'R$ milhões') return `R$ ${numeroProjecao(valor)} ${t('mi')}`;
  if (u === 'R$ bilhões') return `R$ ${numeroProjecao(valor)} ${t('bi')}`;
  if (u.startsWith('R$ privado')) return `${numeroProjecao(valor)}×`;
  return numeroProjecao(valor);
}

// ---------- o caminho: 0 na linha de base, 1 na meta final ----------

const serieDe = (cenario) => Object.entries(cenario.serie).map(([ano, valor]) => [Number(ano), valor]).sort((a, b) => a[0] - b[0]);

function valorEm(serie, ano) {
  if (ano <= serie[0][0]) return serie[0][1];
  if (ano >= serie.at(-1)[0]) return serie.at(-1)[1];
  const k = serie.findIndex(([a]) => a >= ano);
  const [a0, v0] = serie[k - 1];
  const [a1, v1] = serie[k];
  return v0 + ((v1 - v0) * (ano - a0)) / (a1 - a0);
}

// O cenário que vale para a conta: o marcado como central (o da meta do
// catálogo), o único quando só há um, ou a média ano a ano quando há vários e
// nenhum é central (I4.4.1, linear e acelerada).
function centralDe(projecao) {
  const central = projecao.cenarios.find((c) => c.central) || (projecao.cenarios.length === 1 ? projecao.cenarios[0] : null);
  if (central) return serieDe(central);
  const series = projecao.cenarios.map(serieDe);
  return series[0].map(([ano]) => [ano, series.reduce((soma, s) => soma + valorEm(s, ano), 0) / series.length]);
}

function preparaProjecao(projecao, item) {
  const central = centralDe(projecao);
  const base = central[0][1];
  const fim = central.at(-1)[1];
  return {
    ...projecao,
    id: `${projecao.codigo}-${projecao.variante || ''}`,
    eixo: item.eixo,
    central,
    caminho: ANOS.map((ano) => [ano, fim === base ? 1 : Math.min(1, Math.max(0, (valorEm(central, ano) - base) / (fim - base)))])
  };
}

function montaEixos(dados, fotos) {
  const itens = [...dados.metas, ...dados.foraDoPainel];
  const numeros = [...new Set(itens.map((item) => item.eixo))].sort((a, b) => a - b);
  return numeros.map((n) => {
    const doEixo = itens.filter((item) => item.eixo === n);
    const inds = doEixo.flatMap((item) => (item.projecoes || []).map((projecao) => preparaProjecao(projecao, item)));
    if (!inds.length) return null;
    const caminho = ANOS.map((ano, k) => [ano, inds.reduce((soma, p) => soma + p.caminho[k][1], 0) / inds.length]);
    const em = (ano) => caminho[Math.round(ano) - ANO0][1];
    const cruza = (q) => {
      const k = caminho.findIndex(([, f]) => f >= q - 1e-9);
      if (k <= 0) return ANO0;
      const [a0, f0] = caminho[k - 1];
      const [, f1] = caminho[k];
      return Math.round(a0 + (q - f0) / (f1 - f0));
    };
    return {
      n,
      nome: nomeDoEixo(n, doEixo[0].eixoNome),
      total: doEixo.length,
      inds,
      caminho,
      em,
      metade: cruza(0.5),
      chega: cruza(1),
      foto: fotos[n - 1] || null
    };
  }).filter(Boolean);
}

// ---------- desenho ----------

function escala(w, h, m) {
  return {
    px: (ano) => m.l + ((ano - ANO0) / (ANO1 - ANO0)) * (w - m.l - m.r),
    py: (fracao) => m.t + (1 - fracao) * (h - m.t - m.b)
  };
}
const pontos = (serie, px, py) => serie.map(([a, v]) => `${px(a).toFixed(1)},${py(v).toFixed(1)}`).join(' ');

function moldura(w, h, m, { px, py }) {
  const grade = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${m.l}" x2="${w - m.r}" y1="${py(f)}" y2="${py(f)}"/><text x="${m.l - 8}" y="${py(f) + 3.5}" text-anchor="end">${pct(f)}</text>`).join('');
  const anos = [ANO0, ...MARCOS].map((a) => `<text x="${px(a)}" y="${h - 4}" text-anchor="middle">${a}</text>`).join('');
  const hoje = `<g class="pj-hoje"><line x1="${px(HOJE)}" x2="${px(HOJE)}" y1="${m.t - 4}" y2="${h - m.b}"/><text x="${px(HOJE) + 5}" y="${m.t + 4}">${escape(t('hoje'))}</text></g>`;
  return { grade: `<g class="pj-grade">${grade}</g>`, anos: `<g class="pj-anos">${anos}</g>`, hoje };
}

function caminhoComArea(serie, s) {
  return `<polygon class="pj-area pj-surge" points="${s.px(ANO0)},${s.py(0)} ${pontos(serie, s.px, s.py)} ${s.px(ANO1)},${s.py(0)}"/><polyline class="pj-linha pj-desenha" pathLength="1" points="${pontos(serie, s.px, s.py)}"/>`;
}

function marcosNoGrafico(eixo, s, anos) {
  return anos.map((a, k) => `<g class="pj-surge" style="animation-delay:${0.7 + k * 0.1}s"><circle class="pj-marco" cx="${s.px(a)}" cy="${s.py(eixo.em(a))}" r="4.5"/><text class="pj-marco-txt" x="${s.px(a)}" y="${s.py(eixo.em(a)) - 12}" text-anchor="${a === ANO1 ? 'end' : 'middle'}">${pct(eixo.em(a))}</text></g>`).join('');
}

// A linha do tempo do painel: uma faixa baixa com o caminho do eixo e, em cima,
// as paradas (2030, metade do caminho, meta final), cada uma ligada por uma guia
// ao ponto em que acontece. É desenhada na largura real do painel, para texto e
// guias saírem no tamanho de tela; quando as paradas não cabem lado a lado
// (celular), ficam em fileira e as guias somem.
function linhaDoTempo(alvo, e) {
  const w = Math.max(280, Math.round(alvo.clientWidth));
  const h = 112;
  const m = { l: 6, r: 6 };
  const topo = 30;
  const base = 92;
  const s = {
    px: (ano) => m.l + ((ano - ANO0) / (ANO1 - ANO0)) * (w - m.l - m.r),
    py: (fracao) => base - fracao * (base - topo)
  };
  const paradas = [
    { ano: 2030, f: e.em(2030), valor: pct(e.em(2030)), rotulo: tp('em {ano}', { ano: 2030 }), urucum: true },
    { ano: e.metade, f: 0.5, valor: e.metade, rotulo: t('Metade do caminho') },
    { ano: e.chega, f: 1, valor: e.chega, rotulo: t('Meta final') }
  ];
  // A metade que já cai em 2030 entra na parada de 2030.
  if (e.metade <= 2030) {
    paradas[0].rotulo = `${paradas[0].rotulo} · ${t('já passa da metade')}`;
    paradas.splice(1, 1);
  }
  const caixa = alvo.querySelector('.pj-paradas');
  caixa.innerHTML = paradas.map((p) => `<div class="pj-parada${p.urucum ? ' is-urucum' : ''}"><b>${escape(String(p.valor))}</b><small>${escape(p.rotulo)}</small></div>`).join('');
  const rotulos = [...caixa.children];
  // Cada parada começa no próprio ano, empurrada pela anterior; a última não
  // passa da borda e puxa as anteriores de volta.
  const VAO = 24;
  paradas.forEach((p, k) => {
    p.larg = rotulos[k].offsetWidth;
    p.x = Math.max(s.px(p.ano), k ? paradas[k - 1].x + paradas[k - 1].larg + VAO : 0);
  });
  for (let k = paradas.length - 1; k >= 0; k -= 1) {
    const limite = k === paradas.length - 1 ? w : paradas[k + 1].x - VAO;
    paradas[k].x = Math.min(paradas[k].x, limite - paradas[k].larg);
  }
  const cabe = paradas[0].x >= 0;
  alvo.classList.toggle('is-empilhado', !cabe);
  const guias = paradas.map((p, k) => {
    // A guia desce do ponto do rótulo mais perto do ano; se ele é a borda
    // direita, o rótulo se alinha por ela.
    const pino = Math.min(p.x + p.larg, Math.max(p.x, s.px(p.ano)));
    if (cabe) {
      rotulos[k].style.left = `${p.x}px`;
      rotulos[k].classList.toggle('is-fim', pino >= p.x + p.larg - 0.5);
    }
    return `<path class="pj-guia" d="M${pino},0 L${pino},6 L${s.px(p.ano)},${topo - 8} L${s.px(p.ano)},${s.py(p.f)}"/><circle class="pj-marco" cx="${s.px(p.ano)}" cy="${s.py(p.f)}" r="4.5"/>`;
  }).join('');
  const anos = [ANO0, ...MARCOS].map((a) => `<line x1="${s.px(a)}" x2="${s.px(a)}" y1="${base}" y2="${base + 5}"/><text x="${s.px(a)}" y="${h - 4}" text-anchor="${a === ANO0 ? 'start' : a === ANO1 ? 'end' : 'middle'}">${a}</text>`).join('');
  alvo.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(tp('Trajetória do eixo {nome}', { nome: e.nome }))}">
    <g class="pj-hoje"><line x1="${s.px(HOJE)}" x2="${s.px(HOJE)}" y1="${topo - 6}" y2="${base}"/><text x="${s.px(HOJE) + 5}" y="${topo + 2}">${escape(t('hoje'))}</text></g>
    ${caminhoComArea(e.caminho, s)}
    <g class="pj-tempo-eixo"><line x1="${m.l}" x2="${w - m.r}" y1="${base}" y2="${base}"/>${anos}</g>
    <g class="pj-surge" style="animation-delay:.7s">${guias}</g>
    <g class="pj-mira"><line y1="${topo - 6}" y2="${base}"/><circle r="5"/><rect rx="4" height="20" width="80"/><text text-anchor="middle"></text></g></svg>`);
  return { s, w, m };
}


function creditoDa(foto) {
  if (!foto) return '';
  return `<a class="pj-cred" href="${escape(foto.url)}" target="_blank" rel="noopener">${escape(foto.lugar)} · ${escape(foto.autor)}</a>`;
}

function rotuloDosIndicadores(eixo) {
  return tp('{n} de {total} indicadores com trajetória', { n: eixo.inds.length, total: eixo.total });
}

// ---------- vista 1: os cinco eixos ----------

function htmlDaLista(eixos) {
  return `<div class="pj-col">
      <div class="pj-titulos" role="tablist" aria-label="${escape(t('Eixos'))}">${eixos.map((e, i) => `<button type="button" class="pj-titulo${i === 0 ? ' is-ativo' : ''}" role="tab" id="pj-aba-${e.n}" aria-controls="pj-painel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-sel="${e.n}">
        <b>${dois(e.n)}</b>
        <span class="pj-titulo-nome">${escape(e.nome)}<small>${escape(rotuloDosIndicadores(e))}</small></span>
        <span class="pj-titulo-valor"><strong>${pct(e.em(2030))}</strong>${escape(tp('em {ano}', { ano: 2030 }))}</span>
        <span class="pj-prog" aria-hidden="true"><i></i></span>
      </button>`).join('')}</div>
      <div class="pj-titulos-pe"><button type="button" class="pj-pausa" data-pausa>${escape(t('Pausar'))}</button></div>
    </div>
    <div class="pj-painel" id="pj-painel" role="tabpanel">
      <div class="pj-foto">${eixos.map((e, i) => (e.foto ? `<i class="${i === 0 ? 'is-ativo' : ''}" data-foto="${e.n}" style="background-image:url('${escape(e.foto.arquivo)}')"></i>` : '')).join('')}<span data-cred></span><div class="pj-foto-txt" data-foto-txt></div></div>
      <div class="pj-dados" data-dados></div>
      <div class="pj-rodape" data-rodape></div>
    </div>`;
}

function ligaVisao(raiz, eixos, sinal) {
  const lado = raiz.querySelector('[data-pj-lado]');
  lado.innerHTML = htmlDaLista(eixos);
  const botoes = [...lado.querySelectorAll('[data-sel]')];
  let atual = eixos[0].n;

  const mostra = (n) => {
    atual = n;
    const e = eixos.find((x) => x.n === n);
    botoes.forEach((b) => {
      const sim = Number(b.dataset.sel) === n;
      b.classList.toggle('is-ativo', sim);
      b.setAttribute('aria-selected', String(sim));
      b.tabIndex = sim ? 0 : -1;
      // A barra recomeça do zero no eixo que entra.
      const barra = b.querySelector('.pj-prog i');
      barra.style.animation = 'none';
      void barra.offsetWidth;
      barra.style.animation = '';
    });
    // No celular a lista é uma faixa que rola de lado: o eixo da vez fica à vista.
    const faixa = lado.querySelector('.pj-titulos');
    if (faixa.scrollWidth > faixa.clientWidth) {
      const ativo = botoes.find((botao) => Number(botao.dataset.sel) === n);
      faixa.scrollTo({ left: faixa.scrollLeft + ativo.getBoundingClientRect().left - faixa.getBoundingClientRect().left - 16, behavior: 'smooth' });
    }
    lado.querySelector('#pj-painel').setAttribute('aria-labelledby', `pj-aba-${n}`);
    lado.querySelectorAll('[data-foto]').forEach((f) => f.classList.toggle('is-ativo', Number(f.dataset.foto) === n));
    lado.querySelector('[data-cred]').innerHTML = creditoDa(e.foto);
    lado.querySelector('[data-foto-txt]').innerHTML = `<div class="pj-entra"><span class="pj-sobre">${escape(rotuloDoEixo(e.n))}</span><h2>${escape(e.nome)}</h2></div>`;

    const dados = lado.querySelector('[data-dados]');
    dados.innerHTML = '<div class="pj-tempo" data-graf><div class="pj-paradas pj-entra"></div></div>';
    const tempo = linhaDoTempo(dados.firstElementChild, e);
    lado.querySelector('[data-rodape]').innerHTML = `
      <button type="button" class="pj-abrir" data-todos>${escape(e.inds.length === 1 ? t('Ver o indicador do eixo') : tp('Ver os {n} indicadores', { n: e.inds.length }))} <span aria-hidden="true">→</span></button>`;
    lado.querySelector('[data-todos]').addEventListener('click', () => abreEixo(raiz, eixos, e.n, sinal));
    ligaMira(lado.querySelector('[data-graf]'), e, tempo.s, tempo.w, tempo.m);
  };

  // Troca sozinha, como na Visão Geral; o mouse sobre a lista, o foco ou o
  // botão param. Com movimento reduzido, não troca.
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let travado = false;
  const pausaBotao = lado.querySelector('[data-pausa]');
  if (quieto) pausaBotao.hidden = true;
  else lado.classList.add('is-rodando');
  // O bloco fica abaixo do mapa: a troca só corre enquanto ele está na tela.
  const vigia = new IntersectionObserver(([entrada]) => lado.classList.toggle('is-fora', !entrada.isIntersecting));
  vigia.observe(lado);
  sinal.addEventListener('abort', () => vigia.disconnect());
  const segue = () => {
    const k = eixos.findIndex((e) => e.n === atual);
    mostra(eixos[(k + 1) % eixos.length].n);
  };
  botoes.forEach((b) => b.querySelector('.pj-prog i').addEventListener('animationend', segue));
  const pausa = () => lado.classList.add('is-pausado');
  const solta = () => { if (!travado) lado.classList.remove('is-pausado'); };
  lado.addEventListener('mouseenter', pausa);
  lado.addEventListener('mouseleave', solta);
  lado.addEventListener('focusin', pausa);
  lado.addEventListener('focusout', solta);
  pausaBotao.addEventListener('click', () => {
    travado = !travado;
    pausaBotao.textContent = travado ? t('Retomar') : t('Pausar');
    lado.classList.toggle('is-pausado', travado);
  });

  botoes.forEach((b, k) => {
    // O eixo sob o mouse entra no painel; um instante de espera evita trocas
    // em sequência quando o mouse só atravessa a lista.
    let espera;
    b.addEventListener('mouseenter', () => {
      clearTimeout(espera);
      espera = setTimeout(() => { if (Number(b.dataset.sel) !== atual) mostra(Number(b.dataset.sel)); }, 90);
    });
    b.addEventListener('mouseleave', () => clearTimeout(espera));
    b.addEventListener('click', () => mostra(Number(b.dataset.sel)));
    b.addEventListener('keydown', (evento) => {
      const passo = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[evento.key];
      if (!passo) return;
      evento.preventDefault();
      const proximo = botoes[(k + passo + botoes.length) % botoes.length];
      proximo.focus();
      mostra(Number(proximo.dataset.sel));
    });
  });
  mostra(atual);
}

// A mira: o ano sob o mouse e quanto do caminho o eixo deve ter feito nele.
function ligaMira(alvo, eixo, s, w, m) {
  const svg = alvo.querySelector('svg');
  const mira = svg.querySelector('.pj-mira');
  svg.addEventListener('mousemove', (evento) => {
    const r = svg.getBoundingClientRect();
    const x = ((evento.clientX - r.left) / r.width) * w;
    const ano = Math.min(ANO1, Math.max(ANO0, Math.round(ANO0 + ((x - m.l) / (w - m.l - m.r)) * (ANO1 - ANO0))));
    const cx = s.px(ano);
    const cy = s.py(eixo.em(ano));
    mira.querySelector('line').setAttribute('x1', cx);
    mira.querySelector('line').setAttribute('x2', cx);
    mira.querySelector('circle').setAttribute('cx', cx);
    mira.querySelector('circle').setAttribute('cy', cy);
    const bx = Math.min(w - m.r - 80, Math.max(m.l, cx - 40));
    const by = Math.max(0, cy - 34);
    mira.querySelector('rect').setAttribute('x', bx);
    mira.querySelector('rect').setAttribute('y', by);
    const texto = mira.querySelector('text');
    texto.setAttribute('x', bx + 40);
    texto.setAttribute('y', by + 14);
    texto.textContent = `${ano} · ${pct(eixo.em(ano))}`;
    alvo.classList.add('is-mirando');
  });
  svg.addEventListener('mouseleave', () => alvo.classList.remove('is-mirando'));
}

// ---------- vista 2: o eixo aberto ----------

function miniGrafico(p) {
  const w = 300;
  const h = 110;
  const m = { t: 12, r: 8, b: 18, l: 8 };
  const series = p.cenarios.map(serieDe);
  const valores = series.flat().map(([, v]) => v);
  const folga = (Math.max(...valores) - Math.min(...valores) || 1) * 0.12;
  const lo = Math.min(...valores) - folga;
  const hi = Math.max(...valores) + folga;
  const a0 = Math.min(...series.flat().map(([a]) => a));
  const a1 = Math.max(...series.flat().map(([a]) => a));
  const px = (a) => m.l + ((a - a0) / (a1 - a0 || 1)) * (w - m.l - m.r);
  const py = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (h - m.t - m.b);
  const c = p.central;
  const { faixa, outros } = cenarios(series, px, py, 'pj-outro', 'pj-faixa');
  const marcos = MARCOS.filter((a) => a > a0 && a < a1).map((a) => `<circle class="pj-marco" cx="${px(a)}" cy="${py(valorEm(c, a))}" r="2.6"/>`).join('');
  return `<svg class="pj-mini" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polygon class="pj-area" points="${px(a0)},${h - m.b} ${pontos(c, px, py)} ${px(a1)},${h - m.b}"/>${faixa}${outros}<polyline class="pj-linha pj-desenha" pathLength="1" points="${pontos(c, px, py)}"/>${marcos}<circle class="pj-base" cx="${px(c[0][0])}" cy="${py(c[0][1])}" r="4"/><circle class="pj-fim" cx="${px(c.at(-1)[0])}" cy="${py(c.at(-1)[1])}" r="5"/><text x="${m.l}" y="${h - 2}">${a0}</text><text x="${w - m.r}" y="${h - 2}" text-anchor="end">${a1}</text></svg>`;
}

// Com mais de um cenário, a faixa entre o maior e o menor e cada um tracejado.
function cenarios(series, px, py, classeLinha, classeFaixa) {
  if (series.length < 2) return { faixa: '', outros: '' };
  const anos = series[0].map(([a]) => a);
  const topo = anos.map((a) => [a, Math.max(...series.map((s) => valorEm(s, a)))]);
  const base = anos.slice().reverse().map((a) => [a, Math.min(...series.map((s) => valorEm(s, a)))]);
  return {
    faixa: `<polygon class="${classeFaixa}" points="${pontos([...topo, ...base], px, py)}"/>`,
    outros: series.map((s) => `<polyline class="${classeLinha}" points="${pontos(s, px, py)}"/>`).join('')
  };
}

function textoDoEixo(e) {
  const resto = e.total - e.inds.length;
  if (e.inds.length === 1) {
    return resto
      ? tp('Um indicador do eixo tem trajetória ano a ano até a meta; os outros {resto} ainda não têm projeção.', { resto })
      : t('O indicador do eixo tem trajetória ano a ano até a meta.');
  }
  return resto
    ? tp('{n} indicadores do eixo têm trajetória ano a ano até a meta; os outros {resto} ainda não têm projeção.', { n: e.inds.length, resto })
    : tp('{n} indicadores do eixo têm trajetória ano a ano até a meta.', { n: e.inds.length });
}

// As etiquetas do indicador: cenários e "só referência". No cartão e no aberto.
function etiquetasDe(p) {
  return `${p.cenarios.length > 1 ? `<span class="pj-tag">${escape(tp('{n} cenários', { n: p.cenarios.length }))}</span>` : ''}${p.comparavel ? '' : `<span class="pj-tag is-ref">${escape(t('Só referência'))}</span>`}`;
}

// O topo escuro do eixo, sem foto: o título à esquerda e, à direita, a
// trajetória do eixo com cada marco (2030 a 2050) rotulado no ponto, e a
// linha de cada indicador atrás, que acende quando o mouse passa no cartão dele.
function htmlDoEixo(eixos, e) {
  const w = 640;
  const h = 270;
  const m = { t: 30, r: 22, b: 26, l: 42 };
  const s = escala(w, h, m);
  const f = moldura(w, h, m, s);
  const finos = e.inds.length > 1 ? e.inds.map((p) => `<polyline class="pj-fino" data-fino="${escape(p.id)}" points="${pontos(p.caminho, s.px, s.py)}"/>`).join('') : '';
  return `<div class="pj-heroi">
      <div class="pj-heroi-in">
        <div class="pj-nav"><button type="button" class="pj-voltar" data-volta><span aria-hidden="true">←</span> ${escape(t('Todos os eixos'))}</button>
          <nav class="pj-abas" aria-label="${escape(t('Eixos'))}">${eixos.map((x) => `<a class="pj-aba" href="#eixo-${x.n}" data-aba="${x.n}" title="${escape(x.nome)}"${x.n === e.n ? ' aria-current="page"' : ''}>${dois(x.n)} · ${escape(x.nome)}</a>`).join('')}</nav></div>
        <div class="pj-heroi-grade">
          <div class="pj-entra"><span class="pj-sobre">${escape(tp('{eixo} · trajetória pactuada', { eixo: rotuloDoEixo(e.n) }))}</span><h2 tabindex="-1" data-titulo-eixo>${escape(e.nome)}</h2><p>${escape(textoDoEixo(e))}</p></div>
          <div class="pj-heroi-graf">
            <svg class="pj-escuro" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(tp('Trajetória do eixo {nome}', { nome: e.nome }))}">${f.grade}${f.hoje}${finos}${caminhoComArea(e.caminho, s)}${marcosNoGrafico(e, s, MARCOS)}${f.anos}</svg>
            <div class="pj-leg"><span><i></i>${escape(t('Média do eixo'))}</span>${finos ? `<span><i class="is-fino"></i>${escape(t('Cada indicador'))}</span>` : ''}<span><i class="is-hoje"></i>${escape(tp('Hoje ({ano})', { ano: HOJE }))}</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="pj-corpo">
      <div class="pj-inds-topo"><div><span class="pj-sobre">${escape(t('Indicadores'))}</span><h3>${escape(e.inds.length === 1 ? t('O indicador com trajetória') : tp('Os {n} indicadores com trajetória', { n: e.inds.length }))}</h3></div><p>${escape(t('Clique num indicador para ver ano a ano.'))}</p></div>
      <div class="pj-regiao" data-regiao><div class="pj-cartoes">${e.inds.map((p, k) => `<button type="button" class="pj-ind" data-ind="${escape(p.id)}" data-idx="${k}" aria-expanded="false" style="--k:${k}">
        <span class="pj-ind-topo"><span class="pj-ind-cod">${escape(p.codigo)}</span>${etiquetasDe(p)}</span>
        <span class="pj-ind-nome"><strong>${escape(t(p.nome))}</strong><small>${escape(t(p.unidade))} · ${escape(t('Amazônia Legal'))}</small></span>
        ${miniGrafico(p)}
        <span class="pj-ind-num"><span><small>${p.central[0][0]}</small><b>${escape(comUnidade(p.central[0][1], p.unidade))}</b></span><span class="pj-seta" aria-hidden="true">→</span><span class="is-meta"><small>${p.central.at(-1)[0]}</small><b>${escape(comUnidade(p.central.at(-1)[1], p.unidade))}</b></span><span class="pj-ver">${escape(t('Ver ano a ano'))} <span aria-hidden="true">→</span></span></span>
      </button>`).join('')}</div></div>
    </div>`;
}

function abreEixo(raiz, eixos, n, sinal, { rola = true } = {}) {
  const e = eixos.find((x) => x.n === n);
  if (!e) return;
  const destino = `${location.pathname}${location.search}#eixo-${n}`;
  if (`${location.pathname}${location.search}${location.hash}` !== destino) history.replaceState(history.state, '', destino);
  raiz.querySelector('[data-pj-visao]').hidden = true;
  const vista = raiz.querySelector('[data-pj-eixo]');
  esqueceIndicador();
  vista.hidden = false;
  vista.innerHTML = htmlDoEixo(eixos, e);
  vista.querySelector('[data-volta]').addEventListener('click', () => fechaEixo(raiz));
  vista.querySelectorAll('[data-aba]').forEach((a) => a.addEventListener('click', (evento) => {
    evento.preventDefault();
    abreEixo(raiz, eixos, Number(a.dataset.aba), sinal, { rola: false });
  }));
  vista.querySelectorAll('[data-ind]').forEach((b) => {
    const fino = vista.querySelector(`[data-fino="${CSS.escape(b.dataset.ind)}"]`);
    if (fino) {
      // A linha do indicador sobe para a frente da área, logo atrás da média.
      b.addEventListener('mouseenter', () => { fino.classList.add('is-ativo'); fino.parentNode.insertBefore(fino, vista.querySelector('.pj-heroi .pj-linha')); });
      b.addEventListener('mouseleave', () => fino.classList.remove('is-ativo'));
    }
    b.addEventListener('click', () => abreIndicador(vista, e, Number(b.dataset.idx)));
  });
  if (rola) {
    window.scrollTo({ top: Math.max(0, raiz.getBoundingClientRect().top + scrollY - 70), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    vista.querySelector('[data-titulo-eixo]').focus({ preventScroll: true });
  }
}

function fechaEixo(raiz) {
  history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  const vista = raiz.querySelector('[data-pj-eixo]');
  esqueceIndicador();
  vista.hidden = true;
  vista.innerHTML = '';
  raiz.querySelector('[data-pj-visao]').hidden = false;
  // De volta ao começo do bloco, logo abaixo do mapa, e não ao topo do Panorama.
  window.scrollTo({ top: Math.max(0, raiz.getBoundingClientRect().top + scrollY - 70), behavior: 'auto' });
  raiz.querySelector('.pj-titulo.is-ativo')?.focus({ preventScroll: true });
}

// ---------- o indicador aberto: o cartão cresce no lugar ----------
//
// O mesmo movimento do card de Projetos (prioridades.js): a placa nasce do
// tamanho e do lugar do cartão, igual a ele (o "rosto", uma cópia do cartão por
// cima), e cresce até ocupar a área dos cartões; dentro dela, a série ano a ano,
// a tabela dos marcos e anterior, próximo e fechar (também ← → e Esc). A área
// acompanha a altura do conteúdo enquanto ele está aberto (ResizeObserver).
const DURACAO = 620; // os mesmos tempos do projecoes.css (.pj-placa)
const DURACAO_FECHA = 480;
let aberto = null; // { vista, e, placa, idx, card, observador, pronto, fechando }

function htmlDoIndicador(e, p, idx) {
  const w = 620;
  const h = 270;
  const m = { t: 30, r: 20, b: 26, l: 54 };
  const series = p.cenarios.map(serieDe);
  const valores = series.flat().map(([, v]) => v);
  let lo = Math.min(...valores);
  let hi = Math.max(...valores);
  const folga = (hi - lo || 1) * 0.1;
  hi += folga;
  lo -= folga;
  // Perto do zero, o eixo começa no zero: não exagera a inclinação.
  if (lo > 0 && lo < (hi - lo) * 0.6) lo = 0;
  const a0 = Math.min(...series.flat().map(([a]) => a));
  const a1 = Math.max(...series.flat().map(([a]) => a));
  const px = (a) => m.l + ((a - a0) / (a1 - a0 || 1)) * (w - m.l - m.r);
  const py = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (h - m.t - m.b);
  const c = p.central;
  const grade = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3).map((v) => `<line x1="${m.l}" x2="${w - m.r}" y1="${py(v)}" y2="${py(v)}"/><text x="${m.l - 8}" y="${py(v) + 3.5}" text-anchor="end">${escape(numeroProjecao(v))}</text>`).join('');
  const anosMarco = [a0, ...MARCOS.filter((a) => a > a0 && a < a1), a1];
  const multi = series.length > 1;
  const { faixa, outros } = cenarios(series, px, py, 'pj-outro', 'pj-faixa');
  const marcos = anosMarco.map((a, k) => {
    const v = valorEm(c, a);
    const classe = k === 0 ? ' is-base' : a === a1 ? ' is-fim' : '';
    return `<g class="pj-surge" style="animation-delay:${0.5 + k * 0.1}s"><circle class="pj-ponto${classe}" cx="${px(a)}" cy="${py(v)}" r="${a === a1 ? 6 : 4.5}"/><text class="pj-valor" x="${px(a)}" y="${py(v) - 12}" text-anchor="${k === 0 ? 'start' : a === a1 ? 'end' : 'middle'}">${escape(comUnidade(v, p.unidade))}</text></g>`;
  }).join('');
  const hoje = HOJE > a0 && HOJE < a1 ? `<g class="pj-hoje"><line x1="${px(HOJE)}" x2="${px(HOJE)}" y1="${m.t - 10}" y2="${h - m.b}"/><text x="${px(HOJE) + 5}" y="${m.t - 14}">${escape(t('hoje'))}</text></g>` : '';
  // Na coluna ao lado do gráfico a tabela vai em pé: um marco por linha, um
  // cenário por coluna.
  const cabeca = `<tr><th scope="col">${escape(t('Ano'))}</th>${p.cenarios.map((cenario) => `<th scope="col">${escape(multi ? t(cenario.nome) : t('Meta do ano'))}${cenario.central ? ' ●' : ''}</th>`).join('')}</tr>`;
  const linhas = anosMarco.map((a) => `<tr><th scope="row">${a}</th>${series.map((serie) => `<td>${a >= serie[0][0] && a <= serie.at(-1)[0] ? escape(numeroProjecao(valorEm(serie, a))) : '–'}</td>`).join('')}</tr>`).join('');
  const nomeCentral = multi ? (p.cenarios.find((x) => x.central)?.nome ? t(p.cenarios.find((x) => x.central).nome) : t('Média dos cenários')) : t('Trajetória pactuada');
  const total = e.inds.length;
  return `<div class="pj-placa-corpo">
      <div class="pj-ind-topo"><span class="pj-sobre">${escape(p.codigo)} · ${escape(rotuloDoEixo(e.n))}</span>${etiquetasDe(p)}</div>
      <h3 class="pj-placa-titulo" tabindex="-1">${escape(t(p.nome))}</h3>
      <p class="pj-placa-sub">${escape(t(p.unidade))} · ${escape(t('Amazônia Legal'))}</p>
      <div class="pj-placa-grade">
        <div>
          <svg class="pj-claro" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(tp('Trajetória pactuada de {nome}', { nome: t(p.nome) }))}"><g class="pj-grade">${grade}</g>${hoje}<polygon class="pj-area pj-surge" points="${px(a0)},${h - m.b} ${pontos(c, px, py)} ${px(a1)},${h - m.b}"/>${faixa}${outros}<polyline class="pj-linha pj-desenha" pathLength="1" points="${pontos(c, px, py)}"/>${marcos}<g class="pj-anos">${anosMarco.map((a) => `<text x="${px(a)}" y="${h - 4}" text-anchor="middle">${a}</text>`).join('')}</g></svg>
          <div class="pj-placa-legenda"><span><i class="is-bola"></i>${escape(t('Linha de base'))}</span><span><i></i>${escape(nomeCentral)}</span>${multi ? `<span><i class="is-tracejado"></i>${escape(t('Outros cenários'))}</span>` : ''}</div>
        </div>
        <div>
          <div class="pj-placa-num"><div><small>${escape(tp('Linha de base · {ano}', { ano: c[0][0] }))}</small><b>${escape(comUnidade(c[0][1], p.unidade))}</b></div><div><small>${escape(tp('Meta · {ano}', { ano: c.at(-1)[0] }))}</small><b>${escape(comUnidade(c.at(-1)[1], p.unidade))}</b></div></div>
          <table class="pj-tabela"><thead>${cabeca}</thead><tbody>${linhas}</tbody></table>
          ${p.cenarios.some((x) => x.central) ? `<p class="pj-nota">● ${escape(t('cenário que corresponde à meta do catálogo.'))}</p>` : ''}
          ${p.comparavel ? '' : `<p class="pj-aviso"><strong>${escape(t('Só referência:'))}</strong> ${escape(t(p.motivo || ''))}</p>`}
          ${p.nota ? `<p class="pj-nota">${escape(t(p.nota))}</p>` : ''}
          <a class="pj-ir" href="${rota('metas', idiomaAtual())}#${encodeURIComponent(p.codigo)}">${escape(t('Ver o indicador em Metas e indicadores'))} <span aria-hidden="true">→</span></a>
        </div>
      </div>
      <div class="pj-placa-nav">
        <button type="button" data-passo="-1"${idx === 0 ? ' disabled' : ''}>${escape(t('← Anterior'))}</button>
        <span>${escape(tp('{n} de {total}', { n: idx + 1, total }))}</span>
        <button type="button" data-passo="1"${idx === total - 1 ? ' disabled' : ''}>${escape(t('Próximo →'))}</button>
        <button type="button" class="pj-placa-fechar" data-fecha>${escape(t('Fechar'))} <span aria-hidden="true">×</span></button>
      </div>
    </div>`;
}

const cartoesDe = (vista) => [...vista.querySelectorAll('.pj-ind')];

// A placa: o conteúdo aberto e, por cima, o rosto, uma cópia do cartão na
// largura dele, que é o que se vê no primeiro e no último quadro.
function preencheIndicador(placa, vista, e, idx) {
  const card = cartoesDe(vista)[idx];
  const rosto = Object.assign(document.createElement('div'), { className: 'pj-rosto', innerHTML: card.innerHTML });
  rosto.setAttribute('aria-hidden', 'true');
  rosto.style.width = `${card.offsetWidth}px`;
  placa.innerHTML = htmlDoIndicador(e, e.inds[idx], idx);
  placa.append(rosto);
  placa.setAttribute('aria-label', t(e.inds[idx].nome));
  placa.querySelectorAll('[data-passo]').forEach((b) => b.addEventListener('click', () => abreIndicador(vista, e, idx + Number(b.dataset.passo))));
  placa.querySelector('[data-fecha]').addEventListener('click', () => fechaIndicador());
}

function noLugarDoCartao(placa, regiao, card) {
  const caixa = regiao.getBoundingClientRect();
  const doCard = card.getBoundingClientRect();
  Object.assign(placa.style, { top: `${doCard.top - caixa.top}px`, left: `${doCard.left - caixa.left}px`, width: `${doCard.width}px`, height: `${doCard.height}px` });
}

// Só depois que a placa terminou de crescer: durante o crescimento a largura muda a cada quadro.
function ajustaIndicador() {
  if (!aberto?.pronto || aberto.fechando) return;
  const altura = aberto.placa.querySelector('.pj-placa-corpo').offsetHeight + 2;
  aberto.vista.querySelector('[data-regiao]').style.height = `${altura}px`;
  aberto.placa.style.height = `${altura}px`;
}

function abreIndicador(vista, e, idx) {
  const regiao = vista.querySelector('[data-regiao]');
  const cards = cartoesDe(vista);
  if (idx < 0 || idx >= cards.length || aberto?.fechando) return;
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const card = cards[idx];
  if (!aberto) {
    const placa = document.createElement('div');
    placa.className = 'pj-placa';
    placa.setAttribute('role', 'region');
    preencheIndicador(placa, vista, e, idx);
    noLugarDoCartao(placa, regiao, card);
    regiao.append(placa);
    regiao.style.height = `${regiao.offsetHeight}px`;
    // O conteúdo fica na largura final durante o movimento (a placa é uma janela
    // que se abre sobre ele, sem o texto se rearrumar); a altura sai daí.
    const corpo = placa.querySelector('.pj-placa-corpo');
    corpo.style.width = `${regiao.getBoundingClientRect().width}px`;
    const altura = corpo.offsetHeight + 2;
    placa.getBoundingClientRect();
    card.classList.add('is-na-placa');
    regiao.classList.add('is-aberta');
    regiao.querySelector('.pj-cartoes').inert = true;
    regiao.style.height = `${altura}px`;
    Object.assign(placa.style, { top: '0px', left: '0px', width: '100%', height: `${altura}px` });
    placa.classList.add('is-cheia');
    const observador = new ResizeObserver(ajustaIndicador);
    observador.observe(corpo);
    aberto = { vista, e, placa, idx, card, observador, pronto: reduz };
    setTimeout(() => {
      if (aberto?.placa !== placa) return;
      corpo.style.width = '';
      aberto.pronto = true;
      ajustaIndicador();
      placa.querySelector('.pj-placa-titulo').focus({ preventScroll: true });
    }, reduz ? 0 : DURACAO);
  } else {
    // Troca o conteúdo dentro da placa já aberta: ele some e volta.
    const { placa } = aberto;
    placa.classList.add('is-trocando');
    setTimeout(() => {
      if (aberto?.placa !== placa) return;
      aberto.observador.disconnect();
      preencheIndicador(placa, vista, e, idx);
      aberto.observador.observe(placa.querySelector('.pj-placa-corpo'));
      placa.classList.remove('is-trocando');
      ajustaIndicador();
      placa.querySelector('.pj-placa-titulo').focus({ preventScroll: true });
    }, reduz ? 0 : 200);
    // O cartão escondido passa a ser o do indicador aberto: é para ele que a placa volta.
    aberto.card.classList.remove('is-na-placa');
    card.classList.add('is-na-placa');
    Object.assign(aberto, { card, idx });
  }
  cards.forEach((c, k) => c.setAttribute('aria-expanded', String(k === idx)));
  const topo = regiao.getBoundingClientRect().top;
  if (topo < 70 || topo > innerHeight * 0.5) scrollBy({ top: topo - 90, behavior: reduz ? 'auto' : 'smooth' });
}

// Fechar é o caminho de volta: o conteúdo some, o rosto reaparece e a placa
// volta ao lugar do cartão; no fim o cartão real toma o lugar dela.
function fechaIndicador() {
  if (!aberto || aberto.fechando) return;
  const { vista, placa, card, observador } = aberto;
  const regiao = vista.querySelector('[data-regiao]');
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  observador.disconnect();
  aberto.fechando = true;
  cartoesDe(vista).forEach((c) => c.setAttribute('aria-expanded', 'false'));
  regiao.querySelector('.pj-cartoes').inert = false;
  const corpo = placa.querySelector('.pj-placa-corpo');
  corpo.style.width = `${corpo.getBoundingClientRect().width}px`;
  placa.classList.add('is-fechando');
  placa.classList.remove('is-cheia');
  regiao.classList.remove('is-aberta');
  regiao.style.height = `${regiao.querySelector('.pj-cartoes').offsetHeight}px`;
  noLugarDoCartao(placa, regiao, card);
  setTimeout(() => {
    placa.remove();
    regiao.style.height = '';
    card.classList.remove('is-na-placa');
    card.focus({ preventScroll: true });
    aberto = null;
  }, reduz ? 0 : DURACAO_FECHA);
}

// Ao trocar de eixo ou voltar aos cinco, a placa sai junto com a vista.
function esqueceIndicador() {
  aberto?.observador.disconnect();
  aberto = null;
}

// ---------- entrada ----------

async function init() {
  bindMenu();
  bindVista();
  const raiz = document.querySelector(ANCORA);
  const sinal = sinalDaPagina();
  const fotos = JSON.parse(raiz.dataset.fotos || '[]');
  const [dados] = await Promise.all([fetch('/data/metas.json').then(readResponse), carregaConteudo()]);
  if (sinal.aborted) return;
  const eixos = montaEixos(dados, fotos);
  ligaVisao(raiz, eixos, sinal);

  // Com um indicador aberto: Esc fecha, as setas passam ao anterior e ao próximo.
  document.addEventListener('keydown', (evento) => {
    if (!aberto || evento.target.closest('input, textarea, select')) return;
    if (evento.key === 'Escape') fechaIndicador();
    else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') abreIndicador(aberto.vista, aberto.e, aberto.idx + (evento.key === 'ArrowLeft' ? -1 : 1));
  }, { signal: sinal });
  sinal.addEventListener('abort', esqueceIndicador);

  // `#eixo-3` abre o terceiro eixo, como em Metas.
  const doEndereco = Number(location.hash.match(/^#eixo-(\d+)$/)?.[1]);
  if (doEndereco) abreEixo(raiz, eixos, doEndereco, sinal, { rola: false });
}

aoEntrarNaPagina(ANCORA, () => init().catch((erro) => {
  const alvo = document.querySelector('[data-pj-lado]');
  if (alvo) alvo.innerHTML = `<p class="load-error">${escape(erro.message)} ${escape(t('Atualize a página para tentar novamente.'))}</p>`;
}));
