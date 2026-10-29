import { aoEntrarNaPagina, bindMenu, bindVista, sinalDaPagina } from './shared.js';

// A aba Projetos (Prioridades dos Estados). O HTML chega pronto do servidor,
// com os textos traduzidos; este script só dá movimento:
//
//   - a entrada suave dos blocos ao rolar (só com `pr-anima`, que ele põe: sem
//     script, ou com movimento reduzido, tudo aparece pronto);
//   - o mapa parado que acende o estado que está passando, e o mapa da capa,
//     que mostra os números ao passar o mouse e leva até o estado no clique;
//   - o card que abre: ele cresce do lugar até ocupar a área das colunas, com
//     o conteúdo que veio num <template> ao lado, e ganha anterior, próximo e
//     fechar (também ← → e Esc). A área acompanha a altura do conteúdo aberto
//     enquanto ele estiver aberto (ResizeObserver), para não cortar texto.
//
// Tudo o que este script liga sai na troca de página (sinalDaPagina).
const ANCORA = '[data-prioridades]';
// os mesmos tempos do prioridades.css (.pr-aberto)
const DURACAO = 620;        // abrir
const DURACAO_FECHA = 480;  // fechar

function init() {
  bindMenu();
  bindVista();
  const raiz = document.querySelector(ANCORA);
  const sinal = sinalDaPagina();
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rotulos = JSON.parse(raiz.dataset.rotulos || '{}');

  // ---------- entrada ao rolar ----------
  if (!reduz) {
    raiz.classList.add('pr-anima');
    const revela = new IntersectionObserver((entradas) => entradas.forEach((entrada) => {
      if (!entrada.isIntersecting) return;
      entrada.target.classList.add('is-visivel');
      revela.unobserve(entrada.target);
    }), { rootMargin: '0px 0px -6% 0px' });
    raiz.querySelectorAll('[data-pr-revela]').forEach((el) => revela.observe(el));
    sinal.addEventListener('abort', () => revela.disconnect());
  }

  // ---------- mapa parado: acende o estado que está no meio da tela ----------
  const colado = raiz.querySelector('[data-pr-mapa-colado]');
  const nome = raiz.querySelector('[data-pr-nome]');
  const passo = raiz.querySelector('[data-pr-passo]');
  const total = raiz.querySelectorAll('.pr-estado').length;
  const acende = (secao) => {
    colado.querySelectorAll('[data-uf]').forEach((n) => n.classList.toggle('is-atual', n.dataset.uf === secao.dataset.uf));
    nome.textContent = secao.dataset.nome;
    passo.textContent = (rotulos.conta || '{n} / {total}').replace('{n}', secao.dataset.n).replace('{total}', total);
  };
  const meio = new IntersectionObserver((entradas) => entradas.forEach((entrada) => entrada.isIntersecting && acende(entrada.target)), { rootMargin: '-45% 0px -45% 0px' });
  raiz.querySelectorAll('.pr-estado').forEach((secao) => meio.observe(secao));
  sinal.addEventListener('abort', () => meio.disconnect());
  const vaiPara = (uf) => document.getElementById(`estado-${uf.toLowerCase()}`)?.scrollIntoView({ behavior: reduz ? 'auto' : 'smooth' });
  colado.addEventListener('click', (evento) => { const p = evento.target.closest('path'); if (p) vaiPara(p.dataset.uf); }, { signal: sinal });

  // ---------- mapa da capa: números ao passar o mouse, clique leva ao estado ----------
  const capa = raiz.querySelector('[data-pr-mapa-capa]');
  const dica = capa.querySelector('[data-pr-dica]');
  capa.addEventListener('click', (evento) => { const p = evento.target.closest('path'); if (p) vaiPara(p.dataset.uf); }, { signal: sinal });
  capa.addEventListener('mousemove', (evento) => {
    const p = evento.target.closest('path');
    if (!p) { dica.hidden = true; return; }
    const caixa = capa.getBoundingClientRect();
    dica.replaceChildren(Object.assign(document.createElement('b'), { textContent: p.dataset.titulo }), document.createElement('br'), p.dataset.resumo);
    dica.style.left = `${evento.clientX - caixa.left}px`;
    dica.style.top = `${evento.clientY - caixa.top}px`;
    dica.hidden = false;
  }, { signal: sinal });
  capa.addEventListener('mouseleave', () => { dica.hidden = true; }, { signal: sinal });
  // as <title> do SVG viram a dica nativa do navegador por cima da nossa; tira, já que a nossa diz o mesmo
  capa.querySelectorAll('path > title').forEach((titulo) => titulo.remove());

  // ---------- o card que cresce ----------
  let aberto = null;   // { regiao, placa, idx, ordem, observador }
  const ordemDe = (regiao) => [...regiao.querySelectorAll('.pr-card')].sort((a, b) => a.dataset.idx - b.dataset.idx);
  const navegacao = (idx, quantos) => {
    const nav = document.createElement('div');
    nav.className = 'pr-aberto-nav';
    const botao = (acao, texto, desligado) => Object.assign(document.createElement('button'), { type: 'button', className: `pr-nav-${acao}`, textContent: texto, disabled: desligado, onclick: () => (acao === 'fechar' ? fecha() : abre(aberto.regiao, idx + (acao === 'ant' ? -1 : 1))) });
    const conta = Object.assign(document.createElement('span'), { className: 'pr-nav-conta', textContent: (rotulos.conta || '{n} / {total}').replace('{n}', idx + 1).replace('{total}', quantos) });
    nav.append(botao('ant', rotulos.anterior || '←', idx === 0), conta, botao('prox', rotulos.proximo || '→', idx === quantos - 1), botao('fechar', rotulos.fechar || '×', false));
    return nav;
  };
  // A placa tem três camadas: a foto de capa (cresce de 96 para 150px junto com a
  // placa), o conteúdo aberto (aparece quando a placa já está quase cheia) e o
  // "rosto", uma cópia do card na largura dele, por cima: é o que se vê no
  // primeiro e no último quadro, para a placa nascer e morrer igual ao card.
  const preenche = (placa, regiao, idx) => {
    const modelo = regiao.querySelector(`template[data-pr-modelo="${idx}"]`);
    const card = ordemDe(regiao)[idx];
    const rosto = Object.assign(document.createElement('div'), { className: 'pr-aberto-rosto' });
    rosto.setAttribute('aria-hidden', 'true');
    rosto.style.width = `${card.offsetWidth}px`;
    for (const filho of card.children) if (!filho.classList.contains('pr-card-foto')) rosto.append(filho.cloneNode(true));
    placa.replaceChildren(modelo.content.cloneNode(true), rosto);
    placa.querySelector('.pr-aberto-corpo').append(navegacao(idx, ordemDe(regiao).length));
  };
  // altura da placa cheia: a foto de capa no tamanho final (vem do CSS) mais o conteúdo
  const alturaDe = (placa) => (parseFloat(getComputedStyle(raiz).getPropertyValue('--pr-foto-aberta')) || 150) + placa.querySelector('.pr-aberto-corpo').offsetHeight;
  // só depois que a placa terminou de crescer: durante o crescimento a largura muda a cada quadro
  const ajusta = () => {
    if (!aberto || aberto.fechando || !aberto.pronto) return;
    const altura = Math.max(320, alturaDe(aberto.placa));
    aberto.regiao.style.height = `${altura}px`;
    aberto.placa.style.height = `${altura}px`;
  };
  const noLugarDoCard = (placa, regiao, card) => {
    const caixa = regiao.getBoundingClientRect(), doCard = card.getBoundingClientRect();
    Object.assign(placa.style, { top: `${doCard.top - caixa.top}px`, left: `${doCard.left - caixa.left}px`, width: `${doCard.width}px`, height: `${doCard.height}px` });
  };
  const rolaAte = (regiao) => {
    const topo = regiao.getBoundingClientRect().top;
    if (topo < 70 || topo > innerHeight * 0.5) scrollBy({ top: topo - 90, behavior: reduz ? 'auto' : 'smooth' });
  };

  function abre(regiao, idx) {
    const cards = ordemDe(regiao);
    if (idx < 0 || idx >= cards.length || aberto?.fechando) return;
    if (aberto && aberto.regiao !== regiao) fecha(true);
    const card = cards[idx];
    if (!aberto) {
      // nasce do tamanho e do lugar do card, igual a ele, e cresce
      const placa = document.createElement('div');
      placa.className = 'pr-aberto';
      placa.setAttribute('role', 'region');
      preenche(placa, regiao, idx);
      noLugarDoCard(placa, regiao, card);
      regiao.append(placa);
      placa.setAttribute('aria-label', placa.querySelector('.pr-aberto-titulo').textContent);
      regiao.style.height = `${regiao.offsetHeight}px`;
      // o conteúdo fica na largura final durante o movimento (a placa é uma janela
      // que se abre sobre ele, sem o texto se rearrumar); a altura sai daí
      const corpo = placa.querySelector('.pr-aberto-corpo');
      corpo.style.width = `${regiao.getBoundingClientRect().width}px`;
      const altura = Math.max(320, alturaDe(placa));
      placa.getBoundingClientRect();
      // o card some no mesmo quadro em que a placa aparece por cima dele, igual a ele
      card.classList.add('is-na-placa');
      regiao.classList.add('is-aberta');
      // os cards escondidos atrás da placa não podem receber foco pelo teclado
      regiao.querySelector('.pr-colunas').inert = true;
      regiao.style.height = `${altura}px`;
      Object.assign(placa.style, { top: '0px', left: '0px', width: '100%', height: `${altura}px` });
      placa.classList.add('is-cheia');
      const observador = new ResizeObserver(ajusta);
      observador.observe(placa.querySelector('.pr-aberto-corpo'));
      aberto = { regiao, placa, idx, observador, card, pronto: reduz };
      // aberta: o conteúdo volta a acompanhar a largura (se a janela mudar de tamanho)
      setTimeout(() => { if (aberto?.placa === placa) { corpo.style.width = ''; aberto.pronto = true; ajusta(); } }, reduz ? 0 : DURACAO);
    } else {
      // troca o conteúdo dentro da placa já aberta (a foto e o texto somem e voltam)
      aberto.placa.classList.add('is-trocando');
      setTimeout(() => {
        if (!aberto) return;
        aberto.observador.disconnect();
        preenche(aberto.placa, regiao, idx);
        aberto.placa.setAttribute('aria-label', aberto.placa.querySelector('.pr-aberto-titulo').textContent);
        aberto.observador.observe(aberto.placa.querySelector('.pr-aberto-corpo'));
        aberto.placa.classList.remove('is-trocando');
        ajusta();
        aberto.placa.querySelector('.pr-aberto-titulo').focus({ preventScroll: true });
      }, reduz ? 0 : 200);
      // o card escondido passa a ser o do projeto aberto (é para ele que a placa volta ao fechar)
      aberto.card.classList.remove('is-na-placa');
      card.classList.add('is-na-placa');
      aberto.card = card;
      aberto.idx = idx;
    }
    cards.forEach((c, k) => c.setAttribute('aria-expanded', String(k === idx)));
    setTimeout(() => aberto?.placa.querySelector('.pr-aberto-titulo')?.focus({ preventScroll: true }), reduz ? 0 : DURACAO);
    rolaAte(regiao);
  }

  // Fechar é o caminho de volta: o conteúdo fica na largura em que está (a placa
  // se fecha sobre ele, sem o texto se rearrumar) e some em cruz com o rosto,
  // que reaparece enquanto a placa volta ao lugar do card; no fim o card real
  // toma o lugar dela, igual, sem salto.
  function fecha(imediato = false) {
    if (!aberto || aberto.fechando) return;
    const { regiao, placa, observador, card } = aberto;
    observador.disconnect();
    ordemDe(regiao).forEach((c) => c.setAttribute('aria-expanded', 'false'));
    regiao.querySelector('.pr-colunas').inert = false;
    const termina = () => { placa.remove(); regiao.style.height = ''; card.classList.remove('is-na-placa'); };
    if (imediato || reduz) { aberto = null; regiao.classList.remove('is-aberta'); termina(); card.focus({ preventScroll: true }); return; }
    aberto.fechando = true;
    const corpo = placa.querySelector('.pr-aberto-corpo');
    corpo.style.width = `${corpo.getBoundingClientRect().width}px`;
    placa.classList.add('is-fechando');
    placa.classList.remove('is-cheia');
    regiao.style.height = `${regiao.querySelector('.pr-colunas').offsetHeight}px`;
    noLugarDoCard(placa, regiao, card);
    // os outros cards voltam enquanto a placa pousa
    setTimeout(() => regiao.classList.remove('is-aberta'), DURACAO_FECHA * 0.4);
    setTimeout(() => { aberto = null; termina(); card.focus({ preventScroll: true }); }, DURACAO_FECHA + 30);
  }

  raiz.addEventListener('click', (evento) => {
    const card = evento.target.closest('.pr-card');
    if (!card || card.closest('.is-aberta')) return;
    abre(card.closest('[data-pr-regiao]'), Number(card.dataset.idx));
  }, { signal: sinal });
  document.addEventListener('keydown', (evento) => {
    if (!aberto) return;
    const digitando = evento.target instanceof Element && evento.target.closest('input, textarea, select');
    if (evento.key === 'Escape') fecha();
    else if (evento.key === 'ArrowRight' && !digitando) abre(aberto.regiao, aberto.idx + 1);
    else if (evento.key === 'ArrowLeft' && !digitando) abre(aberto.regiao, aberto.idx - 1);
  }, { signal: sinal });
  sinal.addEventListener('abort', () => { aberto?.observador.disconnect(); aberto = null; });
}

aoEntrarNaPagina(ANCORA, init);
