import { aoEntrarNaPagina, bindMenu, bindVista, escape, readResponse, sinalDaPagina } from './shared.js';
import { idiomaAtual, localeDe, rota, t, tp } from '../i18n/index.js';
import { carregaConteudo, nomeDoEixo } from './conteudo.js';

// As projeções do Panorama (ver o cabeçalho de PaginaProjecoes.astro). Três vistas:
//
//   - os cinco eixos: a lista numerada à esquerda e o painel do eixo escolhido
//     à direita. O eixo sob o mouse entra no painel; parados, eles se alternam
//     a cada 8 s, com a barra urucum correndo embaixo, como em "Cinco eixos"
//     da Visão Geral;
//   - o eixo aberto (`#eixo-2`): um cartão claro com o nome do eixo, quatro
//     números e o gráfico do caminho do eixo, em desenho editorial (uma linha,
//     sem área, só os rótulos de 2030 e da meta); embaixo, um cartão por
//     indicador, em fileiras equilibradas;
//   - o indicador aberto: o cartão cresce no lugar, como em Projetos, com o
//     gráfico em escala redonda, a mira que lê qualquer ano e a tabela ano a ano.
//
// Os gráficos do eixo aberto são desenhados na largura real da caixa (para o
// texto sair no tamanho de tela também no celular) e os rótulos procuram uma
// posição livre em volta do ponto: nenhum cruza uma linha nem outro texto.
//
// Tudo o que este script liga sai na troca de página (sinalDaPagina).
const ANCORA = '[data-projecoes]';
const ANO0 = 2025;
const ANO1 = 2050;
const HOJE = 2026;
const MARCOS = [2030, 2035, 2040, 2045, 2050];
const ANOS = Array.from({ length: ANO1 - ANO0 + 1 }, (_, k) => ANO0 + k);
const TROCA_MS = 8000; // o mesmo tempo da barra no projecoes.css (pj-enche)
// Unidades de contagem: a escala do gráfico só usa passos inteiros.
const INTEIROS = ['sistemas', 'municípios', 'óbitos'];
// O traço de cada cenário que não é o central (a legenda e a dica usam o mesmo).
const TRACOS = ['6 4', '2 3', '9 3 2 3'];

const esc = escape;
const dois = (n) => String(n).padStart(2, '0');
const limpa = (x) => +x.toFixed(10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const f1 = (v) => Math.round(v * 10) / 10;
const media = (xs) => xs.reduce((soma, x) => soma + x, 0) / xs.length;
const intervalo = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const reduz = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const rotuloDoEixo = (n) => tp('Eixo {n}', { n: dois(n) });
// % do caminho: arredonda para baixo, para não mostrar 100% antes de chegar.
const pct = (f) => (f >= 1 - 1e-9 ? '100%' : `${Math.floor(f * 100 + 1e-9)}%`);

// ---------- números ----------

const fmt = (v, max, min = 0) => (Math.abs(v) < 1e-12 ? 0 : v).toLocaleString(localeDe(), { maximumFractionDigits: max, minimumFractionDigits: min });

// A partir de um milhão o número vai abreviado ("6,12 mi"): em reais, o valor
// inteiro não cabe no gráfico.
function numero(v) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1e6) return `${fmt(v / 1e6, 2)} ${t('mi')}`;
  if (a >= 1000) return fmt(v, 0);
  if (a >= 100) return fmt(v, 1);
  return fmt(v, 2);
}
const ehPct = (u) => String(u).startsWith('%');
const ehX = (u) => String(u).startsWith('R$ privado');

/** O valor com a unidade colada quando ela é curta; as demais vão na linha da unidade. */
function comUnidade(v, u) {
  if (ehPct(u)) return `${numero(v)}%`;
  if (u === 'R$') return Math.abs(v) < 1e-9 ? 'R$ 0' : `R$ ${numero(v)}`;
  if (u === 'R$ milhões') return Math.abs(v) < 1e-9 ? 'R$ 0' : `R$ ${numero(v)} ${t('mi')}`;
  if (u === 'R$ bilhões') return `R$ ${fmt(v, 1)} ${t('bi')}`;
  if (ehX(u)) return `${numero(v)}×`;
  return numero(v);
}
function casasDe(x) {
  const s = String(+(+x).toPrecision(8));
  return s.includes('e') ? 0 : (s.split('.')[1] || '').length;
}

// Largura medida do texto (canvas), para os rótulos não se encostarem.
let ctx2d = null;
function mede(texto, tam = 11.5, peso = 600) {
  ctx2d ||= document.createElement('canvas').getContext('2d');
  ctx2d.font = `${peso} ${tam}px "Libre Franklin", system-ui, sans-serif`;
  return ctx2d.measureText(String(texto)).width;
}

// ---------- séries e o caminho: 0 na linha de base, 1 na meta final ----------

const serieDe = (cenario) => Object.entries(cenario.serie).map(([ano, valor]) => [Number(ano), valor]).sort((a, b) => a[0] - b[0]);

function valorEm(serie, ano) {
  if (ano <= serie[0][0]) return serie[0][1];
  if (ano >= serie.at(-1)[0]) return serie.at(-1)[1];
  const k = serie.findIndex(([a]) => a >= ano);
  const [a0, v0] = serie[k - 1];
  const [a1, v1] = serie[k];
  return v0 + ((v1 - v0) * (ano - a0)) / (a1 - a0 || 1);
}
const temAno = (serie, ano) => serie.some(([a]) => a === ano);

// O cenário que vale para a conta: o marcado como central (o da meta do
// catálogo), o único quando só há um, ou a média ano a ano quando há vários e
// nenhum é central (I4.4.1, linear e acelerada).
function preparaIndicador(projecao, eixo) {
  const series = projecao.cenarios.map(serieDe);
  const iCentral = series.length === 1 ? 0 : projecao.cenarios.findIndex((c) => c.central);
  const anos = [...new Set(series.flat().map(([a]) => a))].sort((a, b) => a - b);
  const a0 = anos[0];
  const a1 = anos.at(-1);
  const conta = iCentral >= 0 ? series[iCentral] : anos.map((a) => [a, media(series.map((s) => valorEm(s, a)))]);
  const base = conta[0][1];
  const fim = conta.at(-1)[1];
  const frac = (ano) => (ano <= a0 ? 0 : ano >= a1 ? 1 : fim === base ? 1 : clamp((valorEm(conta, ano) - base) / (fim - base), 0, 1));
  // "Ano a ano" quando quase todos os passos são de um ano (I2.3.1 tem uma
  // lacuna 2023 → 2026); senão a planilha só traz marcos.
  const passos = anos.slice(1).map((a, k) => a - anos[k]);
  const anual = passos.filter((x) => x === 1).length >= passos.length * 0.75;
  const fins = series.map((s) => s.at(-1)[1]);
  let k = 0;
  const tracos = series.map((_, j) => (j === iCentral ? null : TRACOS[k++ % TRACOS.length]));
  return {
    ...projecao,
    id: `${projecao.codigo}-${projecao.variante || ''}`,
    eixo,
    series,
    iCentral,
    multi: series.length > 1,
    semCentral: series.length > 1 && iCentral < 0,
    central: iCentral >= 0 ? series[iCentral] : null,
    conta,
    anos,
    a0,
    a1,
    base,
    fim,
    frac,
    anual,
    soMarcos: !anual,
    finsIguais: fins.every((v) => Math.abs(v - fins[0]) < 1e-9),
    tracos
  };
}

// A meta que vale: a central, a comum a todos os cenários, ou a faixa entre eles.
function metaDe(p) {
  const u = p.unidade;
  if (p.central) return { txt: comUnidade(p.fim, u), obs: p.multi ? tp('cenário {nome}, a meta do catálogo', { nome: t(p.cenarios[p.iCentral].nome).toLowerCase() }) : '' };
  const fins = p.series.map((s) => s.at(-1)[1]);
  if (p.finsIguais) return { txt: comUnidade(fins[0], u), obs: tp('igual nos {n} cenários', { n: fins.length }) };
  return { txt: `${numero(Math.min(...fins))}–${comUnidade(Math.max(...fins), u)}`, obs: t('conforme o cenário') };
}

// O caminho do eixo é a média dos indicadores e vai da linha de base mais
// antiga ao último ano com meta: sem platô em 0 antes da base nem em 100%
// depois do fim. A vista dos cinco eixos usa o mesmo caminho estendido a
// 2025–2050 (caminhoTodo), para a linha do tempo de todos os eixos ter a mesma régua.
function montaEixos(dados, fotos) {
  const itens = [...dados.metas, ...dados.foraDoPainel];
  const numeros = [...new Set(itens.map((item) => item.eixo))].sort((a, b) => a - b);
  return numeros.map((n) => {
    const doEixo = itens.filter((item) => item.eixo === n);
    const inds = doEixo.flatMap((item) => (item.projecoes || []).map((projecao) => preparaIndicador(projecao, n)));
    if (!inds.length) return null;
    const ini = Math.min(...inds.map((p) => p.a0));
    const fim = Math.max(...inds.map((p) => p.a1));
    const caminho = intervalo(ini, fim).map((a) => [a, media(inds.map((p) => p.frac(a)))]);
    const em = (ano) => (ano <= ini ? caminho[0][1] : ano >= fim ? caminho.at(-1)[1] : caminho[Math.round(ano) - ini][1]);
    const primeiro = (q) => caminho.find(([, f]) => f >= q - 1e-9)?.[0] ?? fim;
    // Contagem por código: o eixo 2 tem 10 séries, mas 7 indicadores.
    const codigos = [...new Set(inds.map((p) => p.codigo))];
    return {
      n,
      nome: nomeDoEixo(n, doEixo[0].eixoNome),
      total: doEixo.length,
      inds,
      ini,
      fim,
      caminho,
      caminhoTodo: ANOS.map((a) => [a, em(a)]),
      em,
      metade: primeiro(0.5),
      chega: fim,
      codigos,
      series: inds.length > codigos.length,
      foto: fotos[n - 1] || null
    };
  }).filter(Boolean);
}

// ---------- vista 1: os cinco eixos ----------

const pontosEm = (serie, px, py) => serie.map(([a, v]) => `${px(a).toFixed(1)},${py(v).toFixed(1)}`).join(' ');

function caminhoComArea(serie, s) {
  return `<polygon class="pj-area pj-surge" points="${s.px(ANO0)},${s.py(0)} ${pontosEm(serie, s.px, s.py)} ${s.px(ANO1)},${s.py(0)}"/><polyline class="pj-linha pj-desenha" pathLength="1" points="${pontosEm(serie, s.px, s.py)}"/>`;
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
  caixa.innerHTML = paradas.map((p) => `<div class="pj-parada${p.urucum ? ' is-urucum' : ''}"><b>${esc(String(p.valor))}</b><small>${esc(p.rotulo)}</small></div>`).join('');
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
  alvo.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(tp('Trajetória do eixo {nome}', { nome: e.nome }))}">
    <g class="pj-hoje"><line x1="${s.px(HOJE)}" x2="${s.px(HOJE)}" y1="${topo - 6}" y2="${base}"/><text x="${s.px(HOJE) + 5}" y="${topo + 2}">${esc(t('hoje'))}</text></g>
    ${caminhoComArea(e.caminhoTodo, s)}
    <g class="pj-tempo-eixo"><line x1="${m.l}" x2="${w - m.r}" y1="${base}" y2="${base}"/>${anos}</g>
    <g class="pj-surge" style="animation-delay:.7s">${guias}</g>
    <g class="pj-mira"><line y1="${topo - 6}" y2="${base}"/><circle r="5"/><rect rx="4" height="20" width="80"/><text text-anchor="middle"></text></g></svg>`);
  return { s, w, m };
}

function creditoDa(foto) {
  if (!foto) return '';
  return `<a class="pj-cred" href="${esc(foto.url)}" target="_blank" rel="noopener">${esc(foto.lugar)} · ${esc(foto.autor)}</a>`;
}

function rotuloDosIndicadores(eixo) {
  return tp('{n} de {total} indicadores com trajetória', { n: eixo.codigos.length, total: eixo.total });
}

function htmlDaLista(eixos) {
  return `<div class="pj-col">
      <div class="pj-titulos" role="tablist" aria-label="${esc(t('Eixos'))}">${eixos.map((e, i) => `<button type="button" class="pj-titulo${i === 0 ? ' is-ativo' : ''}" role="tab" id="pj-aba-${e.n}" aria-controls="pj-painel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}" data-sel="${e.n}">
        <b>${dois(e.n)}</b>
        <span class="pj-titulo-nome">${esc(e.nome)}<small>${esc(rotuloDosIndicadores(e))}</small></span>
        <span class="pj-titulo-valor"><strong>${pct(e.em(2030))}</strong>${esc(tp('em {ano}', { ano: 2030 }))}</span>
        <span class="pj-prog" aria-hidden="true"><i></i></span>
      </button>`).join('')}</div>
      <div class="pj-titulos-pe"><button type="button" class="pj-pausa" data-pausa>${esc(t('Pausar'))}</button></div>
    </div>
    <div class="pj-painel" id="pj-painel" role="tabpanel">
      <div class="pj-foto">${eixos.map((e, i) => (e.foto ? `<i class="${i === 0 ? 'is-ativo' : ''}" data-foto="${e.n}" style="background-image:url('${esc(e.foto.arquivo)}')"></i>` : '')).join('')}<span data-cred></span><div class="pj-foto-txt" data-foto-txt></div></div>
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
    lado.querySelector('[data-foto-txt]').innerHTML = `<div class="pj-entra"><span class="pj-sobre">${esc(rotuloDoEixo(e.n))}</span><h2>${esc(e.nome)}</h2></div>`;

    const dados = lado.querySelector('[data-dados]');
    dados.innerHTML = '<div class="pj-tempo" data-graf><div class="pj-paradas pj-entra"></div></div>';
    const tempo = linhaDoTempo(dados.firstElementChild, e);
    lado.querySelector('[data-rodape]').innerHTML = `
      <button type="button" class="pj-abrir" data-todos>${esc(e.inds.length === 1 ? t('Ver o indicador do eixo') : e.series ? tp('Ver as {n} séries', { n: e.inds.length }) : tp('Ver os {n} indicadores', { n: e.inds.length }))} <span aria-hidden="true">→</span></button>`;
    lado.querySelector('[data-todos]').addEventListener('click', () => abreEixo(raiz, eixos, e.n, sinal));
    ligaMiraDaLinha(lado.querySelector('[data-graf]'), e, tempo.s, tempo.w, tempo.m);
  };

  // Troca sozinha, como na Visão Geral; o mouse sobre a lista, o foco ou o
  // botão param. Com movimento reduzido, não troca.
  const quieto = reduz();
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

// A mira da linha do tempo: o ano sob o mouse e quanto do caminho o eixo deve ter feito nele.
function ligaMiraDaLinha(alvo, eixo, s, w, m) {
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

// ---------- os gráficos do eixo aberto ----------

// Rótulos que não cruzam nada: cada um testa posições em volta do ponto, na
// ordem, com a largura medida do texto, e fica na primeira que não sai da
// área, não cruza nenhum segmento e não encosta em outro texto ou ponto.
const CAND = {
  inicio: [[8, -10, 'start'], [8, 19, 'start'], [-2, -15, 'start'], [-2, 24, 'start'], [11, 4, 'start'], [2, -27, 'start'], [2, 36, 'start']],
  meio: [[-8, -10, 'end'], [8, 19, 'start'], [8, -10, 'start'], [-8, 19, 'end'], [0, -15, 'middle'], [0, 24, 'middle'], [-11, 4, 'end'], [11, 4, 'start'], [0, -27, 'middle'], [0, 36, 'middle']],
  fim: [[-8, -10, 'end'], [-8, 19, 'end'], [-11, 4, 'end'], [2, -15, 'end'], [2, 24, 'end'], [-2, -27, 'end'], [-2, 36, 'end']]
};
const sobrepoe = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const segmentosDe = (pts) => pts.slice(1).map((q, k) => [pts[k][0], pts[k][1], q[0], q[1]]);
// segmento × retângulo (Liang–Barsky)
function cruzaCaixa([x1, y1, x2, y2], c) {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - c.x0, c.x1 - x1, y1 - c.y0, c.y1 - y1];
  for (let i = 0; i < 4; i += 1) {
    if (Math.abs(p[i]) < 1e-12) {
      if (q[i] < 0) return false;
    } else {
      const r = q[i] / p[i];
      if (p[i] < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
    }
  }
  return true;
}
const caixaDoPonto = (x, y, r) => ({ x0: x - r - 1, x1: x + r + 1, y0: y - r - 1, y1: y + r + 1 });
function colocaRotulos(pedidos, { segs, caixas = [], area }) {
  const ocupados = [...caixas];
  let falhou = false;
  const feitos = pedidos.map((r) => {
    const larg = mede(r.texto, r.tam, r.peso);
    for (const [dx, dy, anc] of CAND[r.tipo]) {
      const tx = r.x + dx;
      const ty = r.y + dy;
      const x0 = anc === 'start' ? tx : anc === 'end' ? tx - larg : tx - larg / 2;
      const c = { x0: x0 - 2, x1: x0 + larg + 2, y0: ty - r.tam * 0.78 - 2, y1: ty + r.tam * 0.24 + 2 };
      if (c.x0 < area.x0 || c.x1 > area.x1 || c.y0 < area.y0 || c.y1 > area.y1) continue;
      if (segs.some((s) => cruzaCaixa(s, c))) continue;
      if (ocupados.some((o) => sobrepoe(o, c))) continue;
      ocupados.push(c);
      return { ...r, tx, ty, anc, ok: true };
    }
    if (!r.opcional) falhou = true;
    return { ...r, ok: false };
  });
  return { feitos, falhou };
}
const textoRot = (r, classe) => `<text class="pj-rot ${classe || ''}" x="${f1(r.tx)}" y="${f1(r.ty)}" text-anchor="${r.anc}">${esc(r.texto)}</text>`;
const pontos = (pts) => pts.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');

// Os anos do eixo X: começo e fim sempre, 2030 com prioridade, depois os
// demais, sem que dois se encostem. Numa série só de marcos, os anos dos
// marcos vêm antes de 2030 (I4.4.1: 2032 e 2042).
function escolheAnos(a0, a1, px, vao, extras, so = false) {
  const fica = [a0, a1];
  const prio = (so ? extras : [2030, ...extras]).filter((a) => a > a0 && a < a1);
  for (const a of prio) if (!fica.includes(a) && fica.every((b) => Math.abs(px(a) - px(b)) >= vao)) fica.push(a);
  return fica.sort((x, y) => x - y);
}

// Cada gráfico é desenhado na largura da caixa e redesenhado quando ela muda e
// quando as fontes terminam de carregar (as larguras medidas mudam).
// `observadores` guarda os ResizeObserver da vista aberta, desligados quando
// ela sai.
let observadores = [];
const redesenhos = new Set();
function monta(alvo, desenha, lista = observadores) {
  let largura = 0;
  let primeira = true;
  const faz = (forca) => {
    if (!alvo.isConnected) return;
    const w = Math.round(alvo.clientWidth);
    if (!w || (w === largura && !forca)) return;
    largura = w;
    desenha(w, primeira);
    primeira = false;
  };
  faz();
  const ro = new ResizeObserver(() => requestAnimationFrame(() => faz()));
  ro.observe(alvo);
  const item = { faz };
  redesenhos.add(item);
  lista.push({ disconnect() { ro.disconnect(); redesenhos.delete(item); } });
}
function soltaObservadores() {
  observadores.forEach((o) => o.disconnect());
  observadores = [];
}

// A mira dos gráficos do eixo aberto: o ano sob o mouse ou o dedo, os pontos e
// a dica. Só anda pelos anos que a série traz (nada de valor inventado entre
// marcos). Com o SVG em foco, ← → (e Home, End) andam de ano em ano.
// `aoMudar` avisa a tabela.
function ligaMira(alvo, { px, anos, pontosDe, textoDe, aoMudar, inicial }) {
  const svg = alvo.querySelector('svg');
  const mira = svg.querySelector('.pj-mira');
  const dica = alvo.querySelector('.pj-dica');
  let atual = null;
  const perto = (a) => anos.reduce((m, b) => (Math.abs(b - a) < Math.abs(m - a) ? b : m), anos[0]);
  const mostra = (ano, origem) => {
    ano = perto(ano);
    atual = ano;
    const x = px(ano);
    const linha = mira.querySelector('line');
    linha.setAttribute('x1', x);
    linha.setAttribute('x2', x);
    const pts = pontosDe(ano);
    mira.querySelector('g').innerHTML = pts.map((p) => `<circle cx="${x}" cy="${p.y}" r="${p.r || 5}" class="${p.classe || ''}"/>`).join('');
    dica.innerHTML = textoDe(ano);
    alvo.classList.add('is-mirando');
    // A dica fica ao lado do ponto, não em cima da linha; troca de lado na borda.
    const W = alvo.clientWidth;
    const H = alvo.clientHeight;
    const larg = dica.offsetWidth;
    const alt = dica.offsetHeight;
    const yMeio = (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2;
    let left = x + 16;
    if (left + larg > W) left = x - 16 - larg;
    dica.style.left = `${clamp(left, 0, Math.max(0, W - larg))}px`;
    dica.style.top = `${clamp(yMeio - alt / 2, 0, Math.max(0, H - alt))}px`;
    aoMudar?.(ano, origem);
  };
  const esconde = () => {
    alvo.classList.remove('is-mirando');
    atual = null;
    aoMudar?.(null);
  };
  svg.addEventListener('pointermove', (evento) => {
    const r = svg.getBoundingClientRect();
    const x = evento.clientX - r.left;
    const a0 = anos[0];
    const a1 = anos.at(-1);
    mostra(a0 + ((x - px(a0)) / (px(a1) - px(a0) || 1)) * (a1 - a0), 'grafico');
  });
  svg.addEventListener('pointerleave', esconde);
  // O foco que vem de um toque não começa em "hoje": o pointermove já mostrou o ano tocado.
  svg.addEventListener('focus', () => { if (svg.matches(':focus-visible')) mostra(inicial, 'teclado'); });
  svg.addEventListener('blur', esconde);
  svg.addEventListener('keydown', (evento) => {
    const k = anos.indexOf(atual ?? inicial);
    const passo = { ArrowLeft: -1, ArrowRight: 1 }[evento.key];
    if (!passo && evento.key !== 'Home' && evento.key !== 'End') return;
    evento.preventDefault();
    evento.stopPropagation();
    const j = evento.key === 'Home' ? 0 : evento.key === 'End' ? anos.length - 1 : clamp(k + passo, 0, anos.length - 1);
    mostra(anos[j], 'teclado');
  });
  return { mostra, esconde };
}

// A amostra do traço de cada cenário (legenda e dica usam a mesma da linha).
function amostra(p, k, claro = true) {
  const central = k === p.iCentral;
  const cor = central ? 'var(--mata-700)' : 'var(--mata-500)';
  const cor2 = claro ? cor : (central ? 'var(--mata-300)' : '#a9bfb1');
  return `<svg width="18" height="6" aria-hidden="true"><line x1="1" x2="17" y1="3" y2="3" stroke="${cor2}" stroke-width="${central ? 2.8 : 1.8}" stroke-linecap="round"${p.tracos[k] ? ` stroke-dasharray="${p.tracos[k]}"` : ''}/></svg>`;
}

function etiquetasDe(p) {
  return `${p.multi ? `<span class="pj-tag">${esc(tp('{n} cenários', { n: p.cenarios.length }))}</span>` : ''}${p.soMarcos ? `<span class="pj-tag is-marcos">${esc(t('Marcos pactuados'))}</span>` : ''}${p.comparavel ? '' : `<span class="pj-tag is-ref">${esc(t('Só referência'))}</span>`}`;
}

// ---------- vista 2: o eixo aberto ----------

// O gráfico do topo, editorial e sóbrio: uma linha, sem área, grade leve, os
// anos principais e só dois rótulos de valor, 2030 e a meta final. Com vários
// indicadores, cada um é um fio claro atrás da média.
function graficoDoEixo(alvo, e, w, anima) {
  const estreito = w < 560;
  const h = Math.round(clamp(w * 0.42, 220, 300));
  const m = { t: 18, r: 14, b: 28, l: 38 };
  const yBase = h - m.b;
  const px = (a) => m.l + ((a - e.ini) / (e.fim - e.ini || 1)) * (w - m.l - m.r);
  const py = (f) => m.t + (1 - f) * (yBase - m.t);
  const fr = estreito ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];
  const grade = fr.map((f) => `<line${f === 0 ? ' class="is-base"' : ''} x1="${m.l}" x2="${w - m.r}" y1="${f1(py(f))}" y2="${f1(py(f))}"/><text x="${m.l - 8}" y="${f1(py(f) + 4)}" text-anchor="end">${pct(f)}</text>`).join('');
  const anosX = escolheAnos(e.ini, e.fim, px, estreito ? 40 : 48, MARCOS);
  const anos = anosX.map((a) => `<text x="${f1(px(a))}" y="${yBase + 19}" text-anchor="${a === e.ini ? 'start' : a === e.fim ? 'end' : 'middle'}">${a}</text>`).join('');
  const segs = [];
  const caixas = [];
  // Hoje: um fio vertical claro, só quando cai dentro do gráfico; quando hoje é
  // o primeiro ano (eixo 1), não precisa de marca.
  let hoje = '';
  if (HOJE > e.ini && HOJE < e.fim) {
    const x = px(HOJE);
    const palavra = t('hoje');
    hoje = `<g class="pj-hoje"><line x1="${f1(x)}" x2="${f1(x)}" y1="${m.t}" y2="${yBase}"/><text x="${f1(x + 5)}" y="${m.t + 10}">${esc(palavra)}</text></g>`;
    caixas.push({ x0: x, x1: x + 9 + mede(palavra, 11, 500), y0: m.t, y1: m.t + 14 });
  }
  const finos = e.inds.length > 1 ? e.inds.map((p) => {
    const s = intervalo(p.a0, p.a1).map((a) => [px(a), py(p.frac(a))]);
    return `<polyline class="pj-fino" data-fino="${esc(p.id)}" points="${pontos(s)}"/>${p.a1 < e.fim ? `<circle class="pj-fino-fim" cx="${f1(px(p.a1))}" cy="${f1(py(1))}" r="2"/>` : ''}`;
  }).join('') : '';
  const pts = e.caminho.map(([a, f]) => [px(a), py(f)]);
  segs.push(...segmentosDe(pts));
  const linha = `<polyline class="pj-linha${anima ? ' pj-desenha' : ''}" pathLength="1" points="${pontos(pts)}"/>`;
  const pedidos = [];
  if (2030 > e.ini && 2030 < e.fim) pedidos.push({ x: px(2030), y: py(e.em(2030)), texto: `${pct(e.em(2030))} ${tp('em {ano}', { ano: 2030 })}`, tipo: 'meio', tam: 12, peso: 600, opcional: true });
  pedidos.push({ x: px(e.fim), y: py(1), texto: tp('meta em {ano}', { ano: e.fim }), tipo: 'fim', tam: 12, peso: 600, fim: true });
  pedidos.forEach((r) => caixas.push(caixaDoPonto(r.x, r.y, 4)));
  const { feitos } = colocaRotulos(pedidos, { segs, caixas, area: { x0: m.l + 2, x1: w - 2, y0: 0, y1: yBase - 2 } });
  const marcas = feitos.map((r) => `<g class="${anima ? 'pj-surge' : ''}" style="animation-delay:1s"><circle class="pj-marco${r.fim ? ' is-fim' : ''}" cx="${f1(r.x)}" cy="${f1(r.y)}" r="3.5"/>${r.ok ? textoRot(r) : ''}</g>`).join('');
  const um = e.inds.length === 1;
  const rotulo = tp('Caminho do eixo {nome} até a meta, de {a0} a {a1}: {pct} em 2030. Use as setas para ler ano a ano.', { nome: e.nome, a0: e.ini, a1: e.fim, pct: pct(e.em(2030)) });
  alvo.innerHTML = `<svg class="pj-sobrio" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" tabindex="0" role="img" aria-label="${esc(rotulo)}">
    <g class="pj-grade">${grade}</g>${hoje}${finos}${linha}${marcas}<g class="pj-anos">${anos}</g>
    <g class="pj-mira"><line y1="${m.t}" y2="${yBase}"/><g></g></g></svg><div class="pj-dica" aria-hidden="true"></div>`;
  return ligaMira(alvo, {
    px,
    anos: intervalo(e.ini, e.fim),
    inicial: HOJE >= e.ini && HOJE <= e.fim ? HOJE : e.ini,
    pontosDe: (ano) => [{ y: py(e.em(ano)) }],
    textoDe: (ano) => {
      let texto = `<b>${ano}</b> · ${esc(tp('{pct} do caminho', { pct: pct(e.em(ano)) }))}`;
      if (um) {
        const p = e.inds[0];
        texto += `<small>${esc(p.codigo)}: ${esc(comUnidade(valorEm(p.conta, ano), p.unidade))}</small>`;
      }
      return texto;
    }
  });
}

function textoDoEixo(e) {
  if (e.inds.length === 1) {
    const p = e.inds[0];
    return tp('Um dos {total} indicadores do eixo tem trajetória pactuada: de {base} em {a0} a {fim} em {a1}.', { total: e.total, base: comUnidade(p.base, p.unidade), a0: p.a0, fim: comUnidade(p.fim, p.unidade), a1: p.a1 });
  }
  return tp('{n} dos {total} indicadores do eixo têm trajetória pactuada. A linha escura é a média do caminho de todos.', { n: e.codigos.length, total: e.total });
}

function htmlDoHeroi(eixos, e) {
  const um = e.inds.length === 1;
  const p0 = e.inds[0];
  // Legenda só quando há mais de uma linha; uma frase curta traduz 0% e 100%.
  const leg = um ? '' : `<span><i></i>${esc(t('Média do eixo'))}</span><span><i class="is-fino"></i>${esc(e.series ? t('Cada série') : t('Cada indicador'))}</span>`;
  const nota = um
    ? tp('0% = {base} em {a0} · 100% = {fim} em {a1}', { base: comUnidade(p0.base, p0.unidade), a0: p0.a0, fim: comUnidade(p0.fim, p0.unidade), a1: p0.a1 })
    : t('0% = linha de base · 100% = meta final de cada indicador');
  const fala = e.series ? `<small class="is-linha">${esc(tp('em {n} séries', { n: e.inds.length }))}</small>` : '';
  return `<div class="pj-heroi"><div class="pj-heroi-in">
    <div class="pj-nav"><button type="button" class="pj-voltar" data-volta><span aria-hidden="true">←</span> ${esc(t('Todos os eixos'))}</button>
      <nav class="pj-abas" aria-label="${esc(t('Eixos'))}">${eixos.map((x) => `<a class="pj-aba" href="#eixo-${x.n}" data-aba="${x.n}" title="${esc(x.nome)}"${x.n === e.n ? ' aria-current="page"' : ''}>${dois(x.n)} · ${esc(x.nome)}</a>`).join('')}</nav></div>
    <div class="pj-heroi-grade">
      <div class="pj-heroi-txt pj-entra">
        <span class="pj-sobre">${esc(tp('{eixo} · trajetória pactuada', { eixo: rotuloDoEixo(e.n) }))}</span>
        <h2 tabindex="-1" data-titulo-eixo>${esc(e.nome)}</h2>
        <p>${esc(textoDoEixo(e))}</p>
        <dl class="pj-kpis">
          <div data-ano="2030"><dt>${esc(t('Em 2030'))}</dt><dd>${pct(e.em(2030))}<small>${esc(t('do caminho'))}</small></dd></div>
          <div data-ano="${e.metade}"><dt>${esc(t('Metade do caminho'))}</dt><dd>${e.metade}</dd></div>
          <div data-ano="${e.fim}"><dt>${esc(t('Meta final'))}</dt><dd>${e.fim}</dd></div>
          <div><dt>${esc(t('Com trajetória'))}</dt><dd>${e.codigos.length}<small>${esc(tp('de {total} indicadores', { total: e.total }))}</small>${fala}</dd></div>
        </dl>
      </div>
      <div class="pj-heroi-graf">
        <div class="pj-graf-cab"><span class="pj-eixo-y">${esc(t('% do caminho até a meta'))}</span>${leg ? `<div class="pj-leg">${leg}</div>` : ''}</div>
        <div class="pj-graf" data-graf-eixo></div>
        <p class="pj-heroi-nota">${esc(nota)}</p>
      </div>
    </div>
  </div></div>`;
}

// Os cartões vão em fileiras equilibradas de até 3 numa grade de 6 trilhas:
// nenhum fica sozinho num canto com dois terços vazios.
function spansDe(n) {
  if (n === 1) return [6];
  const filas = Math.ceil(n / 3);
  const base = Math.floor(n / filas);
  const extra = n % filas;
  const saida = [];
  for (let f = 0; f < filas; f += 1) {
    const nf = base + (f < extra ? 1 : 0);
    for (let k = 0; k < nf; k += 1) saida.push(6 / nf);
  }
  return saida;
}

// O minigráfico escreve base, 2030 e meta, com os anos embaixo. Todos os
// cartões de um eixo usam a mesma régua de anos (`dom`): 2030 cai no mesmo
// lugar em todos. Um ponto sem lugar para o rótulo sai com ele.
function miniGrafico(alvo, p, w, dom, anima) {
  const h = Math.round(clamp(w * 0.22, 112, 150));
  const m = { t: 24, r: 6, b: 22, l: 6 };
  const vals = p.series.flat().map(([, v]) => v);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals) - lo < 1e-9 ? lo + 1 : Math.max(...vals);
  const px = (a) => m.l + ((a - dom[0]) / (dom[1] - dom[0] || 1)) * (w - m.l - m.r);
  const py = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (h - m.t - m.b);
  const ptsDe = (s) => s.map(([a, v]) => [px(a), py(v)]);
  const yEixo = h - m.b;
  const segs = p.series.flatMap((s) => segmentosDe(ptsDe(s)));
  let faixa = '';
  let outros = '';
  if (p.multi) {
    const topo = p.anos.map((a) => [px(a), py(Math.max(...p.series.map((s) => valorEm(s, a))))]);
    const fundo = p.anos.slice().reverse().map((a) => [px(a), py(Math.min(...p.series.map((s) => valorEm(s, a))))]);
    faixa = `<polygon class="pj-faixa" points="${pontos([...topo, ...fundo])}"/>`;
    outros = p.series.map((s, k) => (k === p.iCentral ? '' : `<polyline class="pj-outro" stroke-dasharray="${p.tracos[k]}" points="${pontos(ptsDe(s))}"/>`)).join('');
  }
  const c = p.central;
  const pedidos = [{ x: px(p.a0), y: py(p.base), texto: comUnidade(p.base, p.unidade), tipo: 'inicio', tam: 11, peso: 700, ponto: 'pj-base', r: 4 }];
  // 2030 só com uma série central (em I4.4.1 seria uma média que nenhum cenário tem).
  if (c && p.a0 < 2030 && p.a1 > 2030 && (!p.soMarcos || temAno(c, 2030))) {
    const v = valorEm(c, 2030);
    pedidos.push({ x: px(2030), y: py(v), texto: `${temAno(c, 2030) ? '' : '≈ '}${comUnidade(v, p.unidade)}`, tipo: 'meio', tam: 11, peso: 700, ponto: 'pj-marco', r: 3.4, opcional: true, ano: 2030 });
  }
  if (c || p.finsIguais) {
    const v = p.series[Math.max(0, p.iCentral)].at(-1)[1];
    pedidos.push({ x: px(p.a1), y: py(v), texto: comUnidade(v, p.unidade), tipo: 'fim', tam: 11, peso: 700, ponto: 'pj-fim', r: 5, cls: 'is-fim' });
  }
  const caixas = pedidos.map((q) => caixaDoPonto(q.x, q.y, q.r));
  const { feitos } = colocaRotulos(pedidos, { segs, caixas, area: { x0: 0, x1: w, y0: 0, y1: yEixo - 1 } });
  const vivos = feitos.filter((r) => r.ok || !r.opcional);
  const anosX = [p.a0, ...vivos.filter((r) => r.ano).map((r) => r.ano), p.a1];
  const eixoX = anosX.map((a) => {
    const meia = mede(String(a), 10) / 2 + 1;
    return `<line class="pj-eixo-x" x1="${f1(px(a))}" x2="${f1(px(a))}" y1="${yEixo}" y2="${yEixo + 4}"/><text x="${f1(clamp(px(a), meia, w - meia))}" y="${h - 3}" text-anchor="middle">${a}</text>`;
  }).join('');
  alvo.innerHTML = `<svg class="pj-mini" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <line class="pj-eixo-x" x1="${f1(px(dom[0]))}" x2="${f1(px(dom[1]))}" y1="${yEixo}" y2="${yEixo}"/>
    ${c ? `<polygon class="pj-area" points="${f1(px(p.a0))},${yEixo} ${pontos(ptsDe(c))} ${f1(px(p.a1))},${yEixo}"/>` : ''}${faixa}${outros}
    ${c ? `<polyline class="pj-linha${anima ? ' pj-desenha' : ''}" pathLength="1" points="${pontos(ptsDe(c))}"/>` : ''}
    ${eixoX}
    ${vivos.map((r) => `<circle class="${r.ponto}" cx="${f1(r.x)}" cy="${f1(r.y)}" r="${r.r}"/>`).join('')}
    ${vivos.filter((r) => r.ok).map((r) => textoRot(r, r.cls)).join('')}</svg>`;
}

function htmlDosCartoes(e) {
  const n = e.inds.length;
  const nc = e.codigos.length;
  const sd = spansDe(n);
  const titulo = n === 1 ? t('O indicador com trajetória') : e.series ? tp('As {n} séries com trajetória', { n }) : tp('Os {n} indicadores com trajetória', { n });
  const sub = n === 1
    ? tp('{n} de {total} indicadores do eixo · clique no cartão para abrir a série.', { n: nc, total: e.total })
    : e.series
      ? tp('{n} de {total} indicadores do eixo, em {series} séries · clique num cartão para abrir a série.', { n: nc, total: e.total, series: n })
      : tp('{n} de {total} indicadores do eixo · clique num cartão para abrir a série.', { n: nc, total: e.total });
  return `<div class="pj-corpo">
    <div class="pj-inds-topo"><span class="pj-sobre">${esc(t('Indicadores'))}</span>
      <h3>${esc(titulo)}</h3>
      <p>${esc(sub)}</p></div>
    <div class="pj-regiao" data-regiao><div class="pj-cartoes">${e.inds.map((p, k) => {
      const meta = metaDe(p);
      // No tablet a grade tem duas colunas: o último de uma fileira ímpar ocupa a linha.
      const largoT = n > 1 && n % 2 === 1 && k === n - 1;
      const sobreMeta = p.multi ? ` · ${p.central ? t(p.cenarios[p.iCentral].nome).toLowerCase() : tp('{n} cenários', { n: p.series.length })}` : '';
      return `<button type="button" class="pj-ind${n === 1 ? ' is-largo' : ''}${largoT ? ' is-largo-t' : ''}" data-ind="${esc(p.id)}" data-idx="${k}" aria-expanded="false" style="--k:${k};--sd:${sd[k]};--st:${n === 1 || largoT ? 2 : 1}">
      <span class="pj-ind-txt"><span class="pj-ind-topo"><span class="pj-ind-cod">${esc(p.codigo)}</span>${etiquetasDe(p)}</span>
        <span class="pj-ind-nome"><strong>${esc(t(p.nome))}</strong><small>${esc(t(p.unidade))} · ${esc(t('Amazônia Legal'))}</small></span></span>
      <span class="pj-mini-caixa" data-mini></span>
      <span class="pj-ind-num"><span><small>${p.a0}</small><b>${esc(comUnidade(p.base, p.unidade))}</b></span><span class="pj-seta" aria-hidden="true">→</span><span class="is-meta"><small>${p.a1}${esc(sobreMeta)}</small><b>${esc(meta.txt)}</b></span><span class="pj-ver">${esc(p.anual ? t('Ver ano a ano') : t('Ver os marcos'))} <span aria-hidden="true">→</span></span></span>
    </button>`;
    }).join('')}</div></div>
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
  soltaObservadores();
  vista.hidden = false;
  vista.innerHTML = htmlDoHeroi(eixos, e) + htmlDosCartoes(e);
  const grafEixo = vista.querySelector('[data-graf-eixo]');
  let miraEixo = null;
  monta(grafEixo, (w, primeira) => { miraEixo = graficoDoEixo(grafEixo, e, w, primeira && !reduz()); });
  // Os números do topo acendem o ano deles no gráfico.
  vista.querySelectorAll('.pj-kpis [data-ano]').forEach((d) => {
    d.addEventListener('pointerenter', () => miraEixo?.mostra(Number(d.dataset.ano)));
    d.addEventListener('pointerleave', () => miraEixo?.esconde());
  });
  const dom = e.inds.length === 1 ? [e.inds[0].a0, e.inds[0].a1] : [e.ini, e.fim];
  vista.querySelectorAll('.pj-ind').forEach((b) => {
    const p = e.inds[Number(b.dataset.idx)];
    const mini = b.querySelector('[data-mini]');
    monta(mini, (w, primeira) => miniGrafico(mini, p, w, dom, primeira && !reduz()));
    // O cartão sob o mouse acende o fio do indicador no gráfico do topo.
    b.addEventListener('mouseenter', () => {
      const fino = vista.querySelector(`[data-fino="${CSS.escape(p.id)}"]`);
      if (!fino) return;
      fino.classList.add('is-ativo');
      fino.parentNode.insertBefore(fino, vista.querySelector('.pj-heroi .pj-linha'));
    });
    b.addEventListener('mouseleave', () => vista.querySelector(`[data-fino="${CSS.escape(p.id)}"]`)?.classList.remove('is-ativo'));
    b.addEventListener('click', () => abreIndicador(vista, e, Number(b.dataset.idx)));
  });
  vista.querySelector('[data-volta]').addEventListener('click', () => fechaEixo(raiz));
  vista.querySelectorAll('[data-aba]').forEach((a) => a.addEventListener('click', (evento) => {
    evento.preventDefault();
    abreEixo(raiz, eixos, Number(a.dataset.aba), sinal, { rola: false });
  }));
  // No celular a aba da vez fica à vista dentro da faixa.
  const abas = vista.querySelector('.pj-abas');
  const atual = abas.querySelector('[aria-current]');
  if (atual && abas.scrollWidth > abas.clientWidth) abas.scrollLeft = atual.offsetLeft - 16;
  if (rola) {
    window.scrollTo({ top: Math.max(0, raiz.getBoundingClientRect().top + scrollY - 70), behavior: reduz() ? 'auto' : 'smooth' });
    vista.querySelector('[data-titulo-eixo]').focus({ preventScroll: true });
  }
}

function fechaEixo(raiz) {
  history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  const vista = raiz.querySelector('[data-pj-eixo]');
  esqueceIndicador();
  soltaObservadores();
  vista.hidden = true;
  vista.innerHTML = '';
  raiz.querySelector('[data-pj-visao]').hidden = false;
  // De volta ao começo do bloco, logo abaixo do mapa, e não ao topo do Panorama.
  window.scrollTo({ top: Math.max(0, raiz.getBoundingClientRect().top + scrollY - 70), behavior: 'auto' });
  raiz.querySelector('.pj-titulo.is-ativo')?.focus({ preventScroll: true });
}

// ---------- o indicador aberto ----------

// Escala redonda: o passo é 1, 2, 2,5 ou 5 × 10^k (contagens: só inteiros).
function proximoPasso(p, inteiro) {
  const k = Math.floor(Math.log10(p) + 1e-9);
  const b = 10 ** k;
  const seq = inteiro && b < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  const i = seq.findIndex((x) => Math.abs(x - p / b) < 1e-6);
  return limpa(seq[i + 1] * b);
}
function passoRedondo(bruto, inteiro) {
  const k = Math.floor(Math.log10(bruto));
  const b = 10 ** k;
  const seq = inteiro && b < 10 ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  const p = limpa(seq.map((x) => x * b).find((x) => x >= bruto - 1e-12));
  return inteiro ? Math.max(1, p) : p;
}
// Todas as escalas redondas possíveis, de 3 a 6 linhas, com ou sem um passo a
// mais em cima ou embaixo. Onde um passo a mais passaria de 100% (percentual)
// ou ficaria abaixo de 0, entra uma folga sem linha.
function escalasPossiveis(min, max, { teto, inteiro }) {
  const amp = max - min || Math.abs(max) || 1;
  const saida = [];
  let p = passoRedondo(amp / 6, inteiro);
  for (let k = 0; k < 7; k += 1, p = proximoPasso(p, inteiro)) {
    let tlo = limpa(Math.floor(min / p + 1e-9) * p);
    let thi = limpa(Math.ceil(max / p - 1e-9) * p);
    if (thi <= tlo) thi = limpa(tlo + p);
    // Perto do zero, o eixo começa no zero: não exagera a inclinação.
    if (min >= 0 && min < amp * 0.6) tlo = 0;
    for (const [ec, eb] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      let hi = thi;
      let lo = tlo;
      let cimaPx = 0;
      let baixoPx = 0;
      if (ec) {
        if (teto != null && hi + p > teto + 1e-9) cimaPx = 22;
        else hi = limpa(hi + p);
      }
      if (eb) {
        if (min >= 0 && lo - p < -1e-9) baixoPx = 22;
        else lo = limpa(lo - p);
      }
      const n = Math.round((hi - lo) / p) + 1;
      if (n < 3 || n > 6) continue;
      saida.push({ tlo: lo, thi: hi, passo: p, cimaPx, baixoPx, n, ticks: Array.from({ length: n }, (_, j) => limpa(lo + j * p)) });
    }
  }
  return saida;
}
function rotuloTick(v, u, passo, emMi) {
  if (Math.abs(v) < 1e-12) return ehPct(u) ? '0%' : ehX(u) ? '0×' : '0';
  const txt = emMi ? `${fmt(v / 1e6, casasDe(passo / 1e6))} ${t('mi')}` : fmt(v, casasDe(passo));
  return ehPct(u) ? `${txt}%` : ehX(u) ? `${txt}×` : txt;
}
// O nome do eixo Y: a unidade sai dos ticks e vem para cá.
const TITULO_DA_UNIDADE = {
  '%': 'Percentual (%)',
  'R$': 'Reais (mi = milhões)',
  '0 a 100': 'Índice de 0 a 100',
  'por 100 mil hab.': 'Por 100 mil habitantes',
  óbitos: 'Óbitos',
  municípios: 'Municípios',
  sistemas: 'Sistemas',
  'R$ privado por R$ público': 'R$ privado por R$ público (×)'
};
const tituloUnidade = (u) => t(TITULO_DA_UNIDADE[u] || u);
// "A e B", "A, B e C".
const lista = (xs) => (xs.length > 1 ? tp('{a} e {b}', { a: xs.slice(0, -1).join(', '), b: xs.at(-1) }) : xs[0]);
// Os cenários que terminam no mesmo valor dividem o rótulo (I4.4.1: Linear e Acelerada, 80%).
function gruposFinais(p) {
  const grupos = [];
  p.series.forEach((s, k) => {
    const v = s.at(-1)[1];
    const g = grupos.find((x) => Math.abs(x.v - v) < 1e-9);
    const nome = t(p.cenarios[k].nome);
    if (g) {
      g.nomes.push(nome);
      g.central ||= k === p.iCentral;
    } else grupos.push({ v, nomes: [nome], central: k === p.iCentral });
  });
  return grupos.map((g) => ({ ...g, valor: comUnidade(g.v, p.unidade) }));
}

function graficoDoIndicador(alvo, p, w, anima, aoMudar) {
  const estreito = w < 520;
  const h = Math.round(clamp(w * 0.5, 250, 340));
  const u = p.unidade;
  const vals = p.series.flat().map(([, v]) => v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const teto = ehPct(u) && max <= 100 + 1e-9 ? 100 : null;
  const c = p.central;
  // Com cenários, o nome e o valor final de cada um no fim da própria linha;
  // no celular só o valor, e a legenda diz qual é qual.
  const finais = p.multi ? gruposFinais(p) : [];
  const txtFinal = (g) => (estreito ? g.valor : `${lista(g.nomes)} · ${g.valor}`);
  const mr = finais.length ? Math.ceil(Math.max(...finais.map((g) => mede(txtFinal(g), 11.5, g.central ? 700 : 500)))) + 16 : 18;
  const m = { t: 12, r: mr, b: 42, l: 40 };
  const plotH = h - m.t - m.b;
  const yChao = h - m.b;

  // Entre as escalas redondas, fica a que aproveita mais a altura e ainda cabe
  // todos os rótulos sem cruzar nada.
  const tenta = (s) => {
    const emMi = Math.max(Math.abs(s.thi), Math.abs(s.tlo)) >= 1e6;
    const rots = s.ticks.map((v) => rotuloTick(v, u, s.passo, emMi));
    const ml = Math.ceil(Math.max(...rots.map((r) => mede(r, 10.5, 600)))) + 14;
    const xr = w - m.r;
    const px = (a) => ml + ((a - p.a0) / (p.a1 - p.a0 || 1)) * (xr - ml);
    const topo = m.t + s.cimaPx;
    const alt = plotH - s.cimaPx - s.baixoPx;
    const py = (v) => topo + (1 - (v - s.tlo) / (s.thi - s.tlo)) * alt;
    const ptsDe = (serie) => serie.map(([a, v]) => [px(a), py(v)]);
    const segs = p.series.flatMap((serie) => segmentosDe(ptsDe(serie)));
    const ped = [{ x: px(p.a0), y: py(p.base), texto: comUnidade(p.base, u), tipo: 'inicio', tam: 11.5, peso: 600, cls: 'is-base', ponto: 'is-base', r: 4.5 }];
    if (c && p.a0 < 2030 && p.a1 > 2030 && (!p.soMarcos || temAno(c, 2030))) {
      const v = valorEm(c, 2030);
      ped.push({ x: px(2030), y: py(v), texto: `${temAno(c, 2030) ? '' : '≈ '}${comUnidade(v, u)}`, tipo: 'meio', tam: 11.5, peso: 600, ponto: '', r: 4.5 });
    }
    // Séries só de marcos: cada marco ganha o valor (I4.4.1: 2032 e 2042 nos dois cenários).
    if (p.soMarcos) {
      p.series.forEach((serie) => serie.slice(1, -1).forEach(([a, v]) => {
        if (c && serie === c && a === 2030) return;
        ped.push({ x: px(a), y: py(v), texto: comUnidade(v, u), tipo: 'meio', tam: 11, peso: 500, cls: 'is-marco', ponto: 'is-marco', r: 3.2, opcional: true });
      }));
    }
    if (!p.multi) ped.push({ x: px(p.a1), y: py(p.fim), texto: comUnidade(p.fim, u), tipo: 'fim', tam: 11.5, peso: 700, cls: 'is-fim', ponto: 'is-fim', r: 6 });
    const caixas = ped.map((q) => caixaDoPonto(q.x, q.y, q.r));
    p.series.forEach((serie) => caixas.push(caixaDoPonto(px(serie.at(-1)[0]), py(serie.at(-1)[1]), 5)));
    const r = colocaRotulos(ped, { segs, caixas, area: { x0: ml + 1, x1: p.multi ? xr + 2 : w - 4, y0: m.t, y1: yChao - 1 } });
    return { s, rots, ml, xr, px, py, ptsDe, ...r };
  };
  const cands = escalasPossiveis(min, max, { teto, inteiro: INTEIROS.includes(u) });
  cands.forEach((s) => {
    const ppu = (plotH - s.cimaPx - s.baixoPx) / (s.thi - s.tlo);
    s.nota = 1 - ((max - min) * ppu) / plotH + (s.n < 4 ? 0.12 : 0) + (s.cimaPx || s.baixoPx ? 0.04 : 0);
  });
  cands.sort((a, b) => a.nota - b.nota);
  let g = null;
  for (const s of cands) {
    const r = tenta(s);
    if (!r.falhou) {
      g = r;
      break;
    }
  }
  if (!g) g = tenta(cands[0]);
  const { s, rots, ml, xr, px, py, ptsDe, feitos } = g;

  const grade = s.ticks.map((v, k) => `<line class="${Math.abs(v) < 1e-12 ? 'is-zero' : ''}" x1="${ml}" x2="${f1(xr)}" y1="${f1(py(v))}" y2="${f1(py(v))}"/><text x="${ml - 8}" y="${f1(py(v) + 3.5)}" text-anchor="end">${esc(rots[k])}</text>`).join('');
  // Anos do eixo X: começo, fim e 2030 sempre; numa série só de marcos, os anos
  // dos marcos; senão os múltiplos de 5, ou todos numa série curta.
  const extras = p.soMarcos ? p.anos : p.a1 - p.a0 <= 12 ? p.anos : MARCOS;
  const anosX = escolheAnos(p.a0, p.a1, px, estreito ? 38 : 46, extras, p.soMarcos);
  const yAno = yChao + 17;
  let anos = anosX.map((a) => {
    const meia = mede(String(a), 10.5) / 2 + 1;
    return `<text x="${f1(clamp(px(a), ml - 6 + meia, w - meia))}" y="${yAno}" text-anchor="middle">${a}</text>`;
  }).join('');
  // Hoje é uma marca no eixo dos anos, com a palavra embaixo: uma linha
  // atravessando o gráfico cruzava o rótulo da linha de base.
  if (HOJE >= p.a0 && HOJE <= p.a1) {
    const x = px(HOJE);
    const palavra = t('hoje');
    const meia = mede(palavra.toUpperCase(), 9.5) / 2 + 4;
    anos += `<path class="pj-hoje-marca" d="M${f1(x - 4)},${yChao + 6} L${f1(x)},${yChao + 1} L${f1(x + 4)},${yChao + 6} Z"/><text class="is-hoje" x="${f1(clamp(x, ml - 6 + meia, w - meia))}" y="${yAno + 15}" text-anchor="middle">${esc(palavra)}</text>`;
  }
  let faixa = '';
  let outros = '';
  if (p.multi) {
    const topoF = p.anos.map((a) => [px(a), py(Math.max(...p.series.map((x) => valorEm(x, a))))]);
    const fundoF = p.anos.slice().reverse().map((a) => [px(a), py(Math.min(...p.series.map((x) => valorEm(x, a))))]);
    faixa = `<polygon class="pj-faixa" points="${pontos([...topoF, ...fundoF])}"/>`;
    outros = p.series.map((serie, k) => (k === p.iCentral ? '' : `<polyline class="pj-outro" stroke-dasharray="${p.tracos[k]}" points="${pontos(ptsDe(serie))}"/>`)).join('');
  }
  // Os finais dos cenários na margem direita, afastados entre si.
  let fins = '';
  if (p.multi) {
    const fs = finais.map((f) => ({ ...f, y: py(f.v) + 4 })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < fs.length; k += 1) fs[k].y = Math.max(fs[k].y, fs[k - 1].y + 15);
    const sobra = fs.length ? fs.at(-1).y - (yChao - 2) : 0;
    if (sobra > 0) fs.forEach((f) => { f.y -= sobra; });
    fins = fs.map((f) => `<text class="pj-rot is-cen${f.central ? ' is-central' : ''}" x="${f1(xr + 9)}" y="${f1(f.y)}">${esc(txtFinal(f))}${f.central && !estreito ? ' ●' : ''}</text>`).join('')
      + p.series.map((serie, k) => `<circle class="pj-ponto ${k === p.iCentral || (p.semCentral && p.finsIguais) ? 'is-fim' : 'is-fim-outro'}" cx="${f1(xr)}" cy="${f1(py(serie.at(-1)[1]))}" r="${k === p.iCentral ? 6 : 4}"/>`).join('');
  }
  const vivos = feitos.filter((r) => r.ok || !r.opcional);
  const pontosHtml = vivos.map((r) => `<circle class="pj-ponto ${r.ponto}" cx="${f1(r.x)}" cy="${f1(r.y)}" r="${r.r}"/>`).join('');
  const rotHtml = vivos.filter((r) => r.ok).map((r) => textoRot(r, r.cls)).join('');
  const rotulo = tp('{nome}: de {base} em {a0} a {meta} em {a1}. Use as setas para ler ano a ano.', { nome: t(p.nome), base: comUnidade(p.base, u), a0: p.a0, meta: metaDe(p).txt, a1: p.a1 });
  alvo.innerHTML = `<svg class="pj-claro" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" tabindex="0" role="img" aria-label="${esc(rotulo)}">
    <g class="pj-grade">${grade}</g>
    ${c ? `<polygon class="pj-area${anima ? ' pj-surge' : ''}" points="${f1(px(p.a0))},${yChao} ${pontos(ptsDe(c))} ${f1(px(p.a1))},${yChao}"/>` : ''}${faixa}${outros}
    ${c ? `<polyline class="pj-linha${anima ? ' pj-desenha' : ''}" pathLength="1" points="${pontos(ptsDe(c))}"/>` : ''}
    <g class="${anima ? 'pj-surge' : ''}" style="animation-delay:.5s">${pontosHtml}${fins}${rotHtml}</g>
    <g class="pj-anos">${anos}</g>
    <g class="pj-mira"><line y1="${m.t}" y2="${yChao}"/><g></g></g></svg><div class="pj-dica" aria-hidden="true"></div>`;
  return ligaMira(alvo, {
    px,
    anos: p.anos,
    aoMudar,
    inicial: p.anos.includes(HOJE) ? HOJE : p.anos.includes(2030) ? 2030 : p.a0,
    pontosDe: (ano) => (p.multi
      ? p.series.map((serie, k) => ({ y: py(valorEm(serie, ano)), r: k === p.iCentral ? 5 : 4, classe: k === p.iCentral ? '' : 'is-outro' }))
      : [{ y: py(valorEm(c, ano)) }]),
    textoDe: (ano) => {
      const tags = [ano === p.a0 && t('linha de base'), ano === HOJE && t('hoje'), ano === p.a1 && t('meta')].filter(Boolean);
      const cab = `<b>${ano}</b>${tags.length ? ` <i>· ${esc(tags.join(' · '))}</i>` : ''}`;
      const caminho = c ? `<small>${esc(tp('{pct} do caminho até a meta', { pct: pct(p.frac(ano)) }))}</small>` : '';
      if (!p.multi) return `${cab}<span><em style="padding:0">${esc(comUnidade(valorEm(c, ano), u))}</em></span>${caminho}`;
      return cab + p.cenarios.map((cen, k) => `<span class="${k === p.iCentral ? 'is-central' : ''}">${amostra(p, k, false)}${esc(t(cen.nome))}${k === p.iCentral ? ' ●' : ''}<em>${temAno(p.series[k], ano) ? esc(comUnidade(valorEm(p.series[k], ano), u)) : '–'}</em></span>`).join('') + caminho;
    }
  });
}

// A tabela tem todos os anos da série (ou só os marcos, dito com todas as
// letras), as mesmas casas decimais em toda a coluna e a unidade no cabeçalho.
const UNIDADE_DA_TABELA = {
  'R$': 'em R$ milhões',
  'R$ milhões': 'em R$ milhões',
  'R$ bilhões': 'em R$ bilhões',
  '0 a 100': 'índice de 0 a 100',
  'por 100 mil hab.': 'por 100 mil habitantes',
  'R$ privado por R$ público': 'R$ privado por R$ público',
  óbitos: 'número de óbitos',
  municípios: 'número de municípios',
  sistemas: 'número de sistemas'
};
function formatoTabela(p) {
  const vals = p.series.flat().map(([, v]) => v);
  const div = Math.max(...vals.map(Math.abs)) >= 1e6 ? 1e6 : 1;
  const casas = Math.min(2, Math.max(...vals.map((v) => casasDe(v / div))));
  const suf = ehPct(p.unidade) ? '%' : ehX(p.unidade) ? '×' : '';
  const un = UNIDADE_DA_TABELA[p.unidade] ? t(UNIDADE_DA_TABELA[p.unidade]) : tp('em {unidade}', { unidade: t(p.unidade) });
  return { v: (x) => `${fmt(x / div, casas, casas)}${suf}`, un };
}
function htmlDaTabela(p) {
  const F = formatoTabela(p);
  const cab = `<tr><th scope="col">${esc(t('Ano'))}</th>${p.multi ? p.cenarios.map((cen, k) => `<th scope="col" title="${esc(t(cen.nome))}">${esc(t(cen.nome))}${k === p.iCentral ? ' ●' : ''}</th>`).join('') : `<th scope="col">${esc(t('Meta do ano'))}</th>`}</tr>`;
  const linhas = [];
  p.anos.forEach((a, k) => {
    const ant = p.anos[k - 1];
    if (p.anual && ant && a - ant > 1) {
      const vao = a - ant > 2 ? `${ant + 1}–${a - 1}` : String(ant + 1);
      linhas.push(`<tr class="is-lacuna"><td colspan="${p.series.length + 1}">${esc(tp('{anos}: sem valor na planilha', { anos: vao }))}</td></tr>`);
    }
    // Numa série só de marcos, todo ano da tabela é um marco pactuado (2032 e 2042 de I4.4.1 inclusive).
    const marco = p.soMarcos || a === p.a0 || a === p.a1 || a % 5 === 0;
    const tags = [a === p.a0 && t('base'), a === HOJE && t('hoje'), a === p.a1 && t('meta')].filter(Boolean).join(' · ');
    const marcas = tags ? `<small>${esc(tags)}</small>` : '';
    linhas.push(`<tr data-ano="${a}" class="${marco ? 'is-marco' : ''}"><th scope="row">${a}${marcas}</th>${p.series.map((serie, j) => `<td class="${p.multi && j === p.iCentral ? 'is-central' : ''}">${temAno(serie, a) ? esc(F.v(valorEm(serie, a))) : '–'}</td>`).join('')}</tr>`);
  });
  const titulo = p.anual ? t('Ano a ano') : t('Marcos pactuados');
  const sub = p.anual
    ? tp('{a0}–{a1} · {n} valores · {unidade}', { a0: p.a0, a1: p.a1, n: p.anos.length, unidade: F.un })
    : tp('{n} marcos · {unidade} · entre eles não há valor pactuado', { n: p.anos.length, unidade: F.un });
  return `<div class="pj-tab-cab"><b>${esc(titulo)}</b><small>${esc(sub)}</small></div>
    <div class="pj-tab-caixa" data-caixa><div class="pj-tab-rola" data-rola tabindex="0" aria-label="${esc(tp('Tabela: {titulo}', { titulo: titulo.toLowerCase() }))}"><table class="pj-tabela"><thead>${cab}</thead><tbody>${linhas.join('')}</tbody></table></div></div>`;
}

function htmlDoIndicador(e, p, idx) {
  const total = e.inds.length;
  const u = p.unidade;
  const meta = metaDe(p);
  const c = p.central;
  const rotuloBase = p.baseline?.rotulo;
  const fonte = rotuloBase && rotuloBase !== 'linha de base' ? ` · ${tp('Linha de base: {rotulo}', { rotulo: t(rotuloBase) })}` : '';
  // A legenda fica na linha de cima do gráfico; com cenários, um traço por
  // cenário igual ao da linha.
  const legenda = `<span><i></i>${esc(t('Linha de base'))}</span>${p.multi
    ? p.cenarios.map((cen, k) => `<span>${amostra(p, k)}${esc(k === p.iCentral ? tp('{nome} (meta do catálogo)', { nome: t(cen.nome) }) : t(cen.nome))}</span>`).join('')
    : `<span>${amostra(p, 0)}${esc(t(p.cenarios[0].nome))}</span>`}<span><i class="is-meta"></i>${esc(t('Meta'))}</span>`;
  const notas = `${p.comparavel ? '' : `<p class="pj-aviso"><strong>${esc(t('Só referência:'))}</strong> ${esc(t(p.motivo || ''))}</p>`}${p.nota ? `<p class="pj-nota">${esc(t(p.nota))}</p>` : ''}${p.semCentral ? `<p class="pj-nota">${esc(t('Nenhum dos cenários é a meta do catálogo: no caminho do eixo entra a média deles.'))}</p>` : ''}`;
  const num = [`<div><dt>${esc(tp('Linha de base · {ano}', { ano: p.a0 }))}</dt><dd>${esc(comUnidade(p.base, u))}</dd></div>`];
  if (c && p.a0 < 2030 && p.a1 > 2030 && temAno(c, 2030)) {
    const dt = p.multi ? tp('Em 2030 · {cenario}', { cenario: t(p.cenarios[p.iCentral].nome).toLowerCase() }) : t('Em 2030');
    num.push(`<div><dt>${esc(dt)}</dt><dd>${esc(comUnidade(valorEm(c, 2030), u))}</dd></div>`);
  }
  num.push(`<div class="is-meta"><dt>${esc(tp('Meta · {ano}', { ano: p.a1 }))}</dt><dd>${esc(meta.txt)}${meta.obs ? `<small>${esc(meta.obs)}</small>` : ''}</dd></div>`);
  // Com um indicador, sem "Anterior · 1 de 1 · Próximo"; com vários, só os
  // botões que levam a algum lugar, com o código do vizinho.
  const ant = e.inds[idx - 1];
  const prox = e.inds[idx + 1];
  const nav = total > 1
    ? `${ant ? `<button type="button" data-passo="-1" title="${esc(t(ant.nome))}">← <span class="pj-pe-txt">${esc(t('Anterior'))}</span> <b>${esc(ant.codigo)}</b></button>` : ''}<span class="pj-conta">${esc(tp('{n} de {total}', { n: idx + 1, total }))}</span>${prox ? `<button type="button" data-passo="1" title="${esc(t(prox.nome))}"><span class="pj-pe-txt">${esc(t('Próximo'))}</span> <b>${esc(prox.codigo)}</b> →</button>` : ''}`
    : '';
  return `<div class="pj-placa-corpo">
    <div class="pj-placa-cab">
      <div>
        <div class="pj-ind-topo"><span class="pj-sobre">${esc(p.codigo)} · ${esc(rotuloDoEixo(e.n))}</span>${etiquetasDe(p)}</div>
        <h3 class="pj-placa-titulo" tabindex="-1">${esc(t(p.nome))}</h3>
        <p class="pj-placa-sub">${esc(t(u))} · ${esc(t('Amazônia Legal'))}${esc(fonte)}</p>
      </div>
      <dl class="pj-placa-num">${num.join('')}</dl>
    </div>
    <div class="pj-placa-grade">
      <div class="pj-placa-graf">
        <div class="pj-graf-cab"><span class="pj-eixo-y">${esc(tituloUnidade(u))}</span><div class="pj-placa-legenda">${legenda}</div></div>
        <div class="pj-graf" data-graf-ind></div>
      </div>
      <div class="pj-placa-tab">${htmlDaTabela(p)}</div>
    </div>
    ${notas ? `<div class="pj-placa-notas">${notas}</div>` : ''}
    <div class="pj-placa-pe">
      <a class="pj-ir" href="${rota('metas', idiomaAtual())}#${encodeURIComponent(p.codigo)}">${esc(t('Ver o indicador em Metas e indicadores'))} <span aria-hidden="true">→</span></a>
      <div class="pj-pe-dir">${nav}<button type="button" class="pj-fechar" data-fecha aria-label="${esc(t('Fechar'))}"><span class="pj-pe-txt">${esc(t('Fechar'))}</span> <span aria-hidden="true">×</span></button></div>
    </div>
  </div>`;
}

// Liga gráfico e tabela: a mira acende a linha do ano; passar na tabela move a
// mira. O degradê do pé da tabela some quando ela chega ao fim.
function ligaIndicador(raiz, p, anima, lista) {
  const graf = raiz.querySelector('[data-graf-ind]');
  const rola = raiz.querySelector('[data-rola]');
  const caixa = raiz.querySelector('[data-caixa]');
  const linhas = [...rola.querySelectorAll('tr[data-ano]')];
  let mira = null;
  const fimDaTabela = () => caixa.classList.toggle('is-fim', rola.scrollTop + rola.clientHeight >= rola.scrollHeight - 2);
  rola.addEventListener('scroll', fimDaTabela, { passive: true });
  const aoMudar = (ano, origem) => {
    linhas.forEach((tr) => tr.classList.toggle('is-mira', Number(tr.dataset.ano) === ano));
    if (ano == null || origem === 'tabela') return;
    const tr = linhas.find((x) => Number(x.dataset.ano) === ano);
    if (tr && rola.scrollHeight > rola.clientHeight) rola.scrollTop = Math.max(0, tr.offsetTop - rola.clientHeight / 2);
  };
  monta(graf, (w, primeira) => {
    mira = graficoDoIndicador(graf, p, w, anima && primeira, aoMudar);
    fimDaTabela();
  }, lista);
  const ro = new ResizeObserver(fimDaTabela);
  ro.observe(rola);
  lista.push(ro);
  linhas.forEach((tr) => {
    tr.addEventListener('pointerenter', () => mira?.mostra(Number(tr.dataset.ano), 'tabela'));
    tr.addEventListener('pointerleave', () => mira?.esconde());
  });
}

// O cartão cresce no lugar, com o mesmo movimento do card de Projetos
// (prioridades.js): a placa nasce do tamanho e do lugar do cartão e cresce até
// ocupar a área dos cartões; dentro dela, o gráfico, a tabela e anterior,
// próximo e fechar (também ← → e Esc). A área acompanha a altura do conteúdo
// enquanto ele está aberto (ResizeObserver).
const DURACAO = 620; // os mesmos tempos do projecoes.css (.pj-placa)
const DURACAO_FECHA = 480;
let aberto = null; // { vista, e, placa, idx, card, ros, obs, pronto, fechando }

const cartoesDe = (vista) => [...vista.querySelectorAll('.pj-ind')];

function noLugarDoCartao(placa, regiao, card) {
  const caixa = regiao.getBoundingClientRect();
  const doCard = card.getBoundingClientRect();
  Object.assign(placa.style, { top: `${doCard.top - caixa.top}px`, left: `${doCard.left - caixa.left}px`, width: `${doCard.width}px`, height: `${doCard.height}px` });
}

function preencheIndicador(placa, vista, e, idx, anima, largura) {
  aberto?.ros?.forEach((ro) => ro.disconnect());
  const ros = [];
  placa.innerHTML = htmlDoIndicador(e, e.inds[idx], idx);
  // O conteúdo já na largura final durante o movimento: o gráfico é desenhado uma vez.
  if (largura) placa.querySelector('.pj-placa-corpo').style.width = `${largura}px`;
  placa.setAttribute('aria-label', t(e.inds[idx].nome));
  ligaIndicador(placa, e.inds[idx], anima, ros);
  placa.querySelectorAll('[data-passo]').forEach((b) => b.addEventListener('click', () => abreIndicador(vista, e, idx + Number(b.dataset.passo))));
  placa.querySelector('[data-fecha]').addEventListener('click', fechaIndicador);
  return ros;
}

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
  const rapido = reduz();
  const card = cards[idx];
  if (!aberto) {
    const placa = document.createElement('div');
    placa.className = 'pj-placa';
    placa.setAttribute('role', 'region');
    noLugarDoCartao(placa, regiao, card);
    regiao.append(placa);
    regiao.style.height = `${regiao.offsetHeight}px`;
    // A largura de dentro da placa (sem a borda): igual à que ela terá aberta, para
    // o gráfico não ser redesenhado (e perder a animação) quando a largura fixa sai.
    const borda = placa.offsetWidth - placa.clientWidth;
    const ros = preencheIndicador(placa, vista, e, idx, !rapido, regiao.getBoundingClientRect().width - borda);
    const corpo = placa.querySelector('.pj-placa-corpo');
    const altura = corpo.offsetHeight + 2;
    placa.getBoundingClientRect();
    card.classList.add('is-na-placa');
    regiao.classList.add('is-aberta');
    regiao.querySelector('.pj-cartoes').inert = true;
    regiao.style.height = `${altura}px`;
    Object.assign(placa.style, { top: '0px', left: '0px', width: '100%', height: `${altura}px` });
    placa.classList.add('is-cheia');
    const obs = new ResizeObserver(ajustaIndicador);
    obs.observe(corpo);
    aberto = { vista, e, placa, idx, card, ros, obs, pronto: rapido };
    setTimeout(() => {
      if (aberto?.placa !== placa || aberto.fechando) return;
      corpo.style.width = '';
      aberto.pronto = true;
      ajustaIndicador();
      placa.querySelector('.pj-placa-titulo').focus({ preventScroll: true });
    }, rapido ? 0 : DURACAO);
  } else {
    // Troca o conteúdo dentro da placa já aberta: ele some e volta.
    const { placa } = aberto;
    placa.classList.add('is-trocando');
    setTimeout(() => {
      if (aberto?.placa !== placa || aberto.fechando) return;
      aberto.obs.disconnect();
      aberto.ros = preencheIndicador(placa, vista, e, idx, !rapido);
      aberto.obs.observe(placa.querySelector('.pj-placa-corpo'));
      placa.classList.remove('is-trocando');
      ajustaIndicador();
      placa.querySelector('.pj-placa-titulo').focus({ preventScroll: true });
    }, rapido ? 0 : 200);
    // O cartão escondido passa a ser o do indicador aberto: é para ele que a placa volta.
    aberto.card.classList.remove('is-na-placa');
    card.classList.add('is-na-placa');
    Object.assign(aberto, { card, idx });
  }
  cards.forEach((x, k) => x.setAttribute('aria-expanded', String(k === idx)));
  const topo = regiao.getBoundingClientRect().top;
  if (topo < 70 || topo > innerHeight * 0.5) scrollBy({ top: topo - 90, behavior: rapido ? 'auto' : 'smooth' });
}

// Fechar é o caminho de volta: o conteúdo some e a placa volta ao lugar do
// cartão; no fim o cartão real toma o lugar dela.
function fechaIndicador() {
  if (!aberto || aberto.fechando) return;
  const { vista, placa, card, obs, ros } = aberto;
  const regiao = vista.querySelector('[data-regiao]');
  const rapido = reduz();
  obs.disconnect();
  ros.forEach((ro) => ro.disconnect());
  aberto.fechando = true;
  cartoesDe(vista).forEach((x) => x.setAttribute('aria-expanded', 'false'));
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
    // Se nesse meio-tempo o eixo mudou ou outro indicador abriu, ele fica como está.
    if (aberto?.placa !== placa) return;
    regiao.style.height = '';
    card.classList.remove('is-na-placa');
    card.focus({ preventScroll: true });
    aberto = null;
  }, rapido ? 0 : DURACAO_FECHA);
}

// Ao trocar de eixo, voltar aos cinco ou sair da página, a placa sai junto com a vista.
function esqueceIndicador() {
  aberto?.obs.disconnect();
  aberto?.ros?.forEach((ro) => ro.disconnect());
  aberto = null;
}

// ---------- entrada ----------

let fontesLigadas = false;

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

  // As larguras medidas mudam quando as fontes terminam de carregar: redesenha.
  if (!fontesLigadas && document.fonts && document.fonts.status !== 'loaded') {
    fontesLigadas = true;
    document.fonts.ready.then(() => redesenhos.forEach((item) => item.faz(true)));
  }

  // Com um indicador aberto: Esc fecha, as setas passam ao anterior e ao
  // próximo (menos quando o foco está num gráfico ou na tabela, que usam as setas).
  document.addEventListener('keydown', (evento) => {
    if (!aberto || evento.target.closest('input, textarea, select')) return;
    if (evento.key === 'Escape') fechaIndicador();
    else if (evento.target.closest('svg, [data-rola]')) return;
    else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowRight') abreIndicador(aberto.vista, aberto.e, aberto.idx + (evento.key === 'ArrowLeft' ? -1 : 1));
  }, { signal: sinal });
  sinal.addEventListener('abort', () => {
    esqueceIndicador();
    soltaObservadores();
  });

  // `#eixo-3` abre o terceiro eixo, como em Metas.
  const doEndereco = Number(location.hash.match(/^#eixo-(\d+)$/)?.[1]);
  if (doEndereco) abreEixo(raiz, eixos, doEndereco, sinal, { rola: false });
}

aoEntrarNaPagina(ANCORA, () => init().catch((erro) => {
  const alvo = document.querySelector('[data-pj-lado]');
  if (alvo) alvo.innerHTML = `<p class="load-error">${escape(erro.message)} ${escape(t('Atualize a página para tentar novamente.'))}</p>`;
}));
