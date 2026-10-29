import { aoEntrarNaPagina, bindMenu, bindVista, sinalDaPagina } from './shared.js';

// ---------------------------------------------------------------------------
// Visão Geral editorial (PaginaVisaoGeralEditorial.astro). Todo o conteúdo já
// vem no HTML; aqui ficam só os movimentos: a entrada dos blocos, o parallax
// das fotos, o mapa e os painéis do território, a escada da governança e a
// correnteza da foto do topo. Tudo se desfaz no sinal da página, porque o
// ClientRouter troca de aba sem recarregar e um laço de animação esquecido
// continuaria rodando nas outras abas.
// ---------------------------------------------------------------------------
const ANCORA = '.ve-pagina';
const parado = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cada bloco sobe ao aparecer. Sem JS (ou com movimento reduzido) nada fica escondido.
// Na prévia da administração também não: lá a tela de Textos procura e realça
// o trecho editado, e ele precisa estar à vista mesmo antes de rolar até ele.
function bindEntrada(pagina, signal) {
  if (parado() || window.__interfaceRascunho) return;
  pagina.classList.add('ve-anima');
  const observador = new IntersectionObserver((entradas) => {
    for (const entrada of entradas) {
      if (!entrada.isIntersecting) continue;
      entrada.target.classList.add('is-visto');
      observador.unobserve(entrada.target);
    }
  }, { threshold: 0.12 });
  pagina.querySelectorAll('.ve-surge').forEach((el) => observador.observe(el));
  signal.addEventListener('abort', () => observador.disconnect(), { once: true });
}

// As fotos de fundo andam um pouco mais devagar que a página.
function bindParallax(pagina, signal) {
  if (parado()) return;
  const fotos = [...pagina.querySelectorAll('[data-ve-parallax]')];
  let pedido = 0;
  const move = () => {
    pedido = 0;
    for (const foto of fotos) {
      const caixa = foto.parentElement.getBoundingClientRect();
      if (caixa.bottom < 0 || caixa.top > innerHeight) continue;
      foto.style.transform = `translate3d(0, ${((caixa.top + caixa.height / 2 - innerHeight / 2) * -0.07).toFixed(1)}px, 0)`;
    }
  };
  addEventListener('scroll', () => { if (!pedido) pedido = requestAnimationFrame(move); }, { passive: true, signal });
  signal.addEventListener('abort', () => cancelAnimationFrame(pedido), { once: true });
  move();
}

// Território: abrir um painel (passando o mouse, clicando ou com o teclado) ou
// tocar o estado no mapa troca a ficha. A ficha nunca fica vazia: o texto novo
// entra na hora, com um aceno curto, e a foto do fundo esmaece e volta.
function bindTerritorio(pagina, signal) {
  const secao = pagina.querySelector('[data-ve-territorio]');
  if (!secao) return;
  const ficha = secao.querySelector('[data-ve-ficha]');
  const dados = ficha.querySelector('.ve-ficha-dados');
  const paineis = [...secao.querySelectorAll('.ve-painel')];
  let atual = paineis.find((p) => p.classList.contains('is-aberto'))?.dataset.uf;

  function mostra(uf) {
    const painel = paineis.find((p) => p.dataset.uf === uf);
    if (!painel || uf === atual) return;
    atual = uf;
    paineis.forEach((p) => p.classList.toggle('is-aberto', p === painel));
    ficha.querySelectorAll('path').forEach((p) => p.classList.toggle('is-ativo', p.dataset.uf === uf));
    ficha.querySelector('[data-ve-ficha-bandeira]').src = painel.dataset.bandeira;
    ficha.querySelector('[data-ve-ficha-nome]').textContent = painel.dataset.nome;
    ficha.querySelector('[data-ve-ficha-capital]').textContent = painel.dataset.capital;
    ficha.querySelector('[data-ve-ficha-area]').textContent = painel.dataset.area;
    ficha.style.setProperty('--foto', `url('${painel.dataset.foto}')`);
    ficha.classList.add('is-trocando-foto');
    requestAnimationFrame(() => requestAnimationFrame(() => ficha.classList.remove('is-trocando-foto')));
    dados.classList.remove('is-novo');
    void dados.offsetWidth;
    dados.classList.add('is-novo');
  }

  const comMouse = window.matchMedia('(hover: hover)');
  for (const painel of paineis) {
    painel.addEventListener('mouseenter', () => { if (comMouse.matches) mostra(painel.dataset.uf); }, { signal });
    painel.addEventListener('click', (evento) => {
      if (evento.target instanceof Element && evento.target.closest('a')) return;
      mostra(painel.dataset.uf);
    }, { signal });
    painel.addEventListener('focus', () => mostra(painel.dataset.uf), { signal });
    painel.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') { evento.preventDefault(); mostra(painel.dataset.uf); }
    }, { signal });
  }
  for (const caminho of ficha.querySelectorAll('path')) {
    caminho.addEventListener('mouseenter', () => mostra(caminho.dataset.uf), { signal });
    caminho.addEventListener('click', () => mostra(caminho.dataset.uf), { signal });
  }
}

// Eixos: cada eixo fica 8 s no painel e passa ao próximo, com a barra urucum
// enchendo sob o título (a barra é CSS; o relógio daqui só decide a troca).
// Passar o mouse sobre um título leva a ele e pausa; tirar o mouse retoma de
// onde parou. Fora da tela, nada corre. Com movimento reduzido, não há troca
// automática: os títulos continuam levando a cada eixo.
const TEMPO_DO_EIXO = 8000;

function bindEixos(pagina, signal) {
  const lado = pagina.querySelector('[data-ve-eixos]');
  if (!lado) return;
  const titulos = [...lado.querySelectorAll('[data-eixo]')];
  const fotos = [...lado.querySelectorAll('[data-eixo-foto]')];
  const creditos = [...lado.querySelectorAll('[data-eixo-cred]')];
  const textos = [...lado.querySelectorAll('[data-eixo-texto]')];
  const automatico = !parado();
  let atual = 0;
  let restante = TEMPO_DO_EIXO;
  let inicio = 0;
  let relogio = 0;
  let pausado = false;
  let visivel = false;

  function mostra(i) {
    atual = i;
    titulos.forEach((titulo, j) => { titulo.classList.toggle('is-ativo', j === i); titulo.setAttribute('aria-selected', String(j === i)); });
    fotos.forEach((foto) => foto.classList.toggle('is-ativo', Number(foto.dataset.eixoFoto) === i));
    creditos.forEach((credito) => { credito.hidden = Number(credito.dataset.eixoCred) !== i; });
    textos.forEach((texto) => {
      const ativo = Number(texto.dataset.eixoTexto) === i;
      texto.hidden = !ativo;
      if (ativo) { texto.classList.remove('is-entrando'); void texto.offsetWidth; texto.classList.add('is-entrando'); }
    });
    // a barra recomeça do zero junto com o relógio
    const barra = titulos[i].querySelector('.ve-eixos-progresso i');
    if (barra) { barra.style.animation = 'none'; void barra.offsetWidth; barra.style.animation = ''; }
    restante = TEMPO_DO_EIXO;
    agenda();
  }
  function agenda() {
    clearTimeout(relogio);
    relogio = 0;
    if (!automatico || pausado || !visivel) return;
    inicio = performance.now();
    relogio = setTimeout(() => mostra((atual + 1) % titulos.length), restante);
  }
  function pausa() {
    if (pausado) return;
    pausado = true;
    lado.classList.add('is-pausado');
    if (relogio) restante = Math.max(0, restante - (performance.now() - inicio));
    clearTimeout(relogio);
    relogio = 0;
  }
  function segue() {
    if (!pausado) return;
    pausado = false;
    lado.classList.remove('is-pausado');
    agenda();
  }

  titulos.forEach((titulo) => {
    const vai = () => { if (Number(titulo.dataset.eixo) !== atual) { pausado = false; lado.classList.remove('is-pausado'); mostra(Number(titulo.dataset.eixo)); } };
    titulo.addEventListener('click', vai, { signal });
    titulo.addEventListener('focus', () => { vai(); pausa(); }, { signal });
    titulo.addEventListener('mouseenter', () => { vai(); pausa(); }, { signal });
  });
  lado.addEventListener('mouseenter', pausa, { signal });
  lado.addEventListener('mouseleave', segue, { signal });
  lado.addEventListener('focusout', (evento) => { if (!lado.contains(evento.relatedTarget)) segue(); }, { signal });

  if (!automatico) return;
  lado.classList.add('is-rodando');
  // a contagem só começa quando a seção aparece; na primeira vez, recomeça do zero
  // para a barra e o relógio partirem juntos
  let comecou = false;
  const vista = new IntersectionObserver(([entrada]) => {
    if (!entrada.isIntersecting) { pausa(); visivel = false; return; }
    visivel = true;
    if (!comecou) { comecou = true; pausado = false; lado.classList.remove('is-pausado'); mostra(atual); } else segue();
  }, { threshold: 0.5 });
  vista.observe(lado);
  signal.addEventListener('abort', () => { vista.disconnect(); clearTimeout(relogio); }, { once: true });
}

// Governança: o clique numa instância mostra o detalhe dela. O ouvinte fica na
// seção, e não nos botões, porque a prévia do admin troca o miolo a cada edição.
function bindGovernanca(pagina, signal) {
  const secao = pagina.querySelector('[data-ve-governanca]');
  if (!secao) return;
  secao.addEventListener('click', (evento) => {
    const botao = evento.target instanceof Element ? evento.target.closest('button[data-instancia]') : null;
    if (!botao) return;
    const id = botao.dataset.instancia;
    secao.querySelectorAll('button[data-instancia]').forEach((item) => item.setAttribute('aria-pressed', String(item.dataset.instancia === id)));
    secao.querySelectorAll('[data-detalhe]').forEach((detalhe) => { detalhe.hidden = detalhe.dataset.detalhe !== id; });
  }, { signal });
}

// ---------- o gráfico do cartão de metas, no "explore o painel" ----------
// Ele estica e encolhe junto com o cartão: o SVG é redesenhado na largura real a
// cada quadro da transição, então a linha alonga e os pontos se afastam, mas
// círculos e textos continuam redondos. A linha usa pathLength=1, e o traçado
// animado pelo CSS vale para qualquer largura.
// Cada ponto: [fração da largura útil, altura de 0 (base) a 1 (meta)].
const TRAJETORIA = [[0, 0.1], [0.155, 0.2], [0.31, 0.26], [0.465, 0.41], [0.62, 0.56], [0.775, 0.74], [0.93, 0.93]];

function desenhaGrafico(svg) {
  const largura = svg.clientWidth;
  const altura = svg.clientHeight;
  if (!largura || !altura) return;
  svg.setAttribute('viewBox', `0 0 ${largura} ${altura}`);
  const margem = Math.max(22, Math.min(48, largura * 0.07));
  const x0 = margem;
  const x1 = largura - margem;
  const base = altura - 34;
  const meta = 46;
  const X = (fracao) => x0 + 8 + fracao * (x1 - x0 - 8);
  const Y = (valor) => base - valor * (base - meta - 6);
  const pontos = TRAJETORIA.map(([fracao, valor]) => [X(fracao), Y(valor)]);
  const chegada = [X(1), meta + 6];
  const junta = (lista) => lista.map((ponto) => ponto.map((n) => n.toFixed(1)).join(',')).join(' ');
  const poe = (el, atributos) => { for (const [nome, valor] of Object.entries(atributos)) el.setAttribute(nome, typeof valor === 'number' ? valor.toFixed(1) : valor); };
  const passo = (base - meta - 8) / 3;
  svg.querySelectorAll('.grade').forEach((linha, i) => { const y = meta + 8 + (i + 0.5) * passo; poe(linha, { x1: x0, x2: x1, y1: y, y2: y }); });
  poe(svg.querySelector('.eixo-x'), { x1: x0, x2: x1, y1: base, y2: base });
  poe(svg.querySelector('.eixo-y'), { x1: x0, x2: x0, y1: meta - 16, y2: base });
  poe(svg.querySelector('.alvo'), { x1: x0, x2: x1 + margem * 0.6, y1: meta, y2: meta });
  poe(svg.querySelector('.linha'), { points: junta([...pontos, chegada]) });
  poe(svg.querySelector('.area'), { points: junta([...pontos, chegada, [chegada[0], base], [pontos[0][0], base]]) });
  svg.querySelectorAll('.pontos circle').forEach((circulo, i) => poe(circulo, { cx: pontos[i][0], cy: pontos[i][1] }));
  for (const el of svg.querySelectorAll('.pulso, .chegada')) poe(el, { cx: chegada[0], cy: chegada[1] });
  poe(svg.querySelector('.ano-inicio'), { x: x0, y: base + 16 });
  poe(svg.querySelector('.ano-fim'), { x: x1, y: base + 16 });
  poe(svg.querySelector('.rotulo-meta'), { x: x1, y: meta - 10 });
}

function bindGraficoDeMetas(pagina, signal) {
  const graficos = [...pagina.querySelectorAll('[data-ve-grafico]')];
  if (!graficos.length) return;
  const tamanhos = new ResizeObserver((entradas) => entradas.forEach((entrada) => desenhaGrafico(entrada.target)));
  graficos.forEach((svg) => { desenhaGrafico(svg); tamanhos.observe(svg); });
  signal.addEventListener('abort', () => tamanhos.disconnect(), { once: true });
}

// ---------- a correnteza da foto do topo ----------
// Ondas miúdas deitadas no plano do rio, em perspectiva: miúdas lá no fundo,
// mais largas embaixo, e a correnteza leva tudo devagar para a direita. O
// deslocamento é quase todo vertical, o que quebra o reflexo da mata em faixas.
// O céu e a mata ficam parados. Sem WebGL o canvas sai e fica a foto parada;
// com movimento reduzido, desenha um quadro só.
const HORIZONTE = 0.392; // a linha d'água na foto de Barcelos (fração da altura)
const FRAG = `
  precision highp float;
  uniform sampler2D foto; uniform vec2 tela; uniform vec2 imagem; uniform float t; uniform float dpr;
  const float H = ${HORIZONTE.toFixed(3)};
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float ruido(vec2 p){
    vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  vec2 cobre(vec2 q, float ct, float ci){ return ct > ci ? vec2(q.x, .5 + (q.y - .5) * ci / ct) : vec2(.5 + (q.x - .5) * ct / ci, q.y); }
  void main(){
    // a foto em "cover", centrada, como o background da página
    vec2 q = vec2(gl_FragCoord.x / tela.x, 1. - gl_FragCoord.y / tela.y);
    float ct = tela.x / tela.y, ci = imagem.x / imagem.y;
    vec2 uv = cobre(q, ct, ci);
    // a linha d'água cai um pouco à direita, onde a mata termina e aparece a outra margem
    float h = H - .022 * smoothstep(.86, .92, uv.x);
    float d = clamp((uv.y - h) / (1. - h), 0., 1.);
    float agua = smoothstep(0., .01, d);
    // o plano do rio em perspectiva: z cresce para o horizonte, x abre com a distância
    float z = 1. / (d + .06);
    vec2 w = vec2((uv.x - .5) * z, z);
    // pixels de tela por unidade de z, para apagar as ondas pequenas demais lá no fundo
    float pxPorZ = (d + .06) * (d + .06) * (1. - h) * (ct > ci ? tela.x / ci : tela.y);
    vec2 rio = w - vec2(t * .02, 0.);
    vec2 g = vec2(0.);
    #define ONDA(dx, dz, f, a, v, ph) { vec2 k = normalize(vec2(dx, dz)) * f; g += k * a * smoothstep(2.5, 8., 6.2832 / f * pxPorZ) * cos(dot(k, rio) - t * v + ph); }
    ONDA( .15, 1.,  55., .0026, 1.3, 0.)
    ONDA(-.35, 1.,  83., .0014, 1.7, 1.7)
    ONDA( .6,  1., 131., .0007, 2.3, 4.1)
    ONDA(-.1,  1., 211., .0004, 2.9, 2.3)
    ONDA( .9,  .6, 37.,  .0018,  .8, 5.)
    // a força varia em manchas lentas, como o vento batendo em partes do rio
    g *= .45 + 1.1 * ruido(rio * vec2(3., 1.6) + t * .05);
    vec2 desvio = vec2(g.x * 14., g.y * 24.) * pow(d + .06, .6) * dpr * agua;
    vec2 amostra = cobre(q + desvio / tela, ct, ci);
    if (uv.y > h) amostra.y = max(amostra.y, h + .002);
    vec3 cor = texture2D(foto, clamp(amostra, 0., 1.)).rgb;
    cor *= 1. + g.y * .22 * agua;
    gl_FragColor = vec4(cor, 1.);
  }`;

function bindCorrenteza(pagina, signal) {
  const canvas = pagina.querySelector('[data-ve-agua]');
  if (!canvas) return;
  const gl = canvas.getContext('webgl');
  if (!gl) { canvas.remove(); return; }
  const imovel = parado();
  const img = new Image();
  img.decoding = 'async';
  img.addEventListener('load', () => {
    if (signal.aborted) return;
    const shader = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }'));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.remove(); return; }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const local = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(local);
    gl.vertexAttribPointer(local, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    const u = (nome) => gl.getUniformLocation(prog, nome);
    gl.uniform2f(u('imagem'), img.naturalWidth, img.naturalHeight);
    const desenha = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const ajusta = () => {
      const r = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(canvas.clientWidth * r);
      canvas.height = Math.round(canvas.clientHeight * r);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u('tela'), canvas.width, canvas.height);
      gl.uniform1f(u('dpr'), r);
      if (imovel) desenha();
    };
    const tamanho = new ResizeObserver(ajusta);
    tamanho.observe(canvas);
    ajusta();
    signal.addEventListener('abort', () => tamanho.disconnect(), { once: true });
    if (imovel) return;
    // só anima enquanto o topo aparece na tela
    let visivel = true;
    const vista = new IntersectionObserver(([entrada]) => { visivel = entrada.isIntersecting; });
    vista.observe(canvas);
    const inicio = performance.now();
    let pedido = 0;
    const quadro = () => {
      if (visivel) { gl.uniform1f(u('t'), (performance.now() - inicio) / 1000); desenha(); }
      pedido = requestAnimationFrame(quadro);
    };
    quadro();
    signal.addEventListener('abort', () => {
      cancelAnimationFrame(pedido);
      vista.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }, { once: true });
  }, { once: true, signal });
  img.src = canvas.dataset.foto;
}

function init() {
  const pagina = document.querySelector(ANCORA);
  const signal = sinalDaPagina();
  bindMenu();
  bindVista();
  bindEntrada(pagina, signal);
  bindParallax(pagina, signal);
  bindTerritorio(pagina, signal);
  bindEixos(pagina, signal);
  bindGovernanca(pagina, signal);
  bindGraficoDeMetas(pagina, signal);
  bindCorrenteza(pagina, signal);
}

aoEntrarNaPagina(ANCORA, init);
