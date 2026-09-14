import { aoEntrarNaPagina, bindMenu, bindVista, sinalDaPagina } from './shared.js';

// ---------------------------------------------------------------------------
// A Visão Geral tem duas mecânicas para o mesmo conteúdo e o mesmo HTML.
//
// `carrossel` — a partir do tablet: cinco lâminas lado a lado, uma por vez, com
// as demais marcadas `inert`.
//
// `documento` — no celular: as cinco seções viram um texto corrido. O carrossel
// não sobrevive a 390px de largura porque cada lâmina tem altura fixa e o texto
// rola dentro dela; em aparelho de toque essa barra de rolagem interna não é
// desenhada, então a leitura simplesmente terminava cortada no meio de uma frase
// sem nenhum sinal de que havia mais. Aqui a página inteira rola, como qualquer
// outro texto, e a barra de seções vira índice.
//
// A troca entre as duas acontece na virada da consulta de mídia (girar o
// aparelho, por exemplo), então o vínculo é desfeito e refeito.
// ---------------------------------------------------------------------------
const CONSULTA_DOCUMENTO = '(max-width: 620px)';

function bindSectionNavigation() {
  const deck = document.querySelector('.methodology-article');
  const regiao = document.querySelector('.overview-deck');
  const links = [...document.querySelectorAll('.methodology-index nav a')];
  const sections = [...deck.querySelectorAll('.method-section')];
  const previous = document.querySelector('[data-slide-prev]');
  const next = document.querySelector('[data-slide-next]');
  const contador = document.querySelector('[data-slide-count]');
  const titulo = document.querySelector('[data-slide-title]');
  const signal = sinalDaPagina();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const documento = window.matchMedia(CONSULTA_DOCUMENTO);

  sections.forEach((section, i) => {
    section.setAttribute('role', 'group');
    section.setAttribute('aria-roledescription', 'slide');
    section.setAttribute('aria-label', `${i + 1} de ${sections.length}: ${links[i].querySelector('strong').textContent}`);
  });

  let active = 0;
  // Cada modo tem o seu próprio controlador: o sinal da página só é abortado na
  // troca de rota, e usá-lo aqui deixaria os ouvintes do carrossel de pé depois
  // de girar o aparelho — na volta eles seriam vinculados duas vezes e cada
  // clique andaria duas lâminas. `desfazer` guarda o que não é ouvinte.
  let controle = null;
  let desfazer = [];
  const aoDesfazer = (acao) => desfazer.push(acao);

  // Comum aos dois modos: qual seção está em foco no índice e no contador.
  function marca(index) {
    active = index;
    links.forEach((link, i) => {
      link.classList.toggle('is-active', i === index);
      if (i === index) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    contador.textContent = `${String(index + 1).padStart(2, '0')} / ${String(sections.length).padStart(2, '0')}`;
    titulo.textContent = links[index].querySelector('strong').textContent;
    // No celular o índice é uma faixa que rola na horizontal e não cabe inteira:
    // sem isto a seção em leitura ficaria marcada fora da vista.
    if (regiao.dataset.modo === 'documento') {
      const faixa = links[index].closest('.methodology-index');
      if (faixa && faixa.scrollWidth > faixa.clientWidth) {
        links[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }

  function montarCarrossel(modo) {
    regiao.dataset.modo = 'carrossel';
    let scrollTimer;

    function update(index) {
      marca(index);
      sections.forEach((section, i) => {
        section.inert = i !== index;
        section.setAttribute('aria-hidden', String(i !== index));
      });
      previous.disabled = index === 0;
      next.disabled = index === sections.length - 1;
    }

    function go(index, { historyEntry = true, instant = false } = {}) {
      index = Math.max(0, Math.min(sections.length - 1, index));
      update(index);
      deck.scrollTo({ left: index * deck.clientWidth, behavior: instant || reduced.matches ? 'instant' : 'smooth' });
      if (historyEntry && location.hash !== links[index].hash) history.pushState(null, '', links[index].hash);
    }
    function fromHash() {
      const index = links.findIndex((link) => link.hash === location.hash);
      go(index < 0 ? 0 : index, { historyEntry: false, instant: true });
    }

    links.forEach((link, index) => link.addEventListener('click', (event) => {
      event.preventDefault();
      go(index);
    }, { signal: modo }));
    previous.addEventListener('click', () => go(active - 1), { signal: modo });
    next.addEventListener('click', () => go(active + 1), { signal: modo });
    // As setas valem para a página inteira, não só para quem já clicou no carrossel:
    // ele ocupa a tela toda e é o único conteúdo da rota, então exigir um clique
    // prévio só escondia a navegação. O listener é do documento e cai junto com o
    // sinal da página, sem sobreviver à troca de rota do ClientRouter.
    document.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.closest('input, select, textarea, [contenteditable]')) return;
      // Home e End continuam pertencendo à página quando o foco está fora do
      // carrossel; só saltam para a primeira ou a última lâmina quando já está nele.
      const noCarrossel = !!alvo && regiao.contains(alvo);
      const destinos = { ArrowLeft: active - 1, ArrowRight: active + 1 };
      if (noCarrossel) Object.assign(destinos, { Home: 0, End: sections.length - 1 });
      const index = destinos[event.key];
      if (index === undefined) return;
      event.preventDefault();
      go(index);
      // Só recoloca o foco quando ele estava na lâmina que acabou de virar `inert`;
      // fora daí, mexer no foco tiraria o usuário de onde ele estava.
      if (noCarrossel) deck.focus({ preventScroll: true });
    }, { signal: modo });
    deck.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const index = Math.round(deck.scrollLeft / deck.clientWidth);
        if (index !== active) {
          update(index);
          history.replaceState(null, '', links[index].hash);
        }
      }, 140);
    }, { passive: true, signal: modo });
    let deckWidth = deck.clientWidth;
    const observer = new ResizeObserver(() => {
      if (deck.clientWidth === deckWidth) return;
      deckWidth = deck.clientWidth;
      go(active, { historyEntry: false, instant: true });
    });
    observer.observe(deck);
    window.addEventListener('hashchange', fromHash, { signal: modo });
    window.addEventListener('popstate', fromHash, { signal: modo });

    aoDesfazer(() => {
      observer.disconnect();
      clearTimeout(scrollTimer);
      // O modo documento precisa das cinco seções legíveis e focáveis.
      sections.forEach((section) => { section.inert = false; section.removeAttribute('aria-hidden'); });
      previous.disabled = false;
      next.disabled = false;
    });
    fromHash();
  }

  function montarDocumento(modo) {
    regiao.dataset.modo = 'documento';
    // Sem `preventDefault` nos links: o próprio navegador salta para a âncora e
    // registra a entrada no histórico, que é o comportamento esperado de um
    // índice. O que o script faz aqui é só acompanhar a leitura.
    const irPara = (index) => {
      index = Math.max(0, Math.min(sections.length - 1, index));
      sections[index].scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' });
      history.pushState(null, '', links[index].hash);
      marca(index);
    };
    const aoAnterior = () => irPara(active - 1);
    const aoProximo = () => irPara(active + 1);
    previous.addEventListener('click', aoAnterior, { signal: modo });
    next.addEventListener('click', aoProximo, { signal: modo });

    // Marca a seção que ocupa a faixa superior da tela. A margem inferior de
    // -55% impede que duas seções contem como visíveis ao mesmo tempo enquanto
    // a rolagem passa da divisa entre elas.
    const visao = new IntersectionObserver((entradas) => {
      const visivel = entradas.filter((entrada) => entrada.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visivel) return;
      const index = sections.indexOf(visivel.target);
      if (index >= 0 && index !== active) marca(index);
    }, { rootMargin: '-120px 0px -55% 0px', threshold: 0 });
    sections.forEach((section) => visao.observe(section));

    aoDesfazer(() => visao.disconnect());

    const doHash = links.findIndex((link) => link.hash === location.hash);
    marca(doHash < 0 ? 0 : doHash);
  }

  function montar() {
    controle?.abort();
    desfazer.forEach((acao) => acao());
    desfazer = [];
    controle = new AbortController();
    if (documento.matches) montarDocumento(controle.signal);
    else montarCarrossel(controle.signal);
  }

  montar();
  documento.addEventListener('change', montar, { signal });
  signal.addEventListener('abort', () => {
    controle?.abort();
    desfazer.forEach((acao) => acao());
  }, { once: true });
}

function init() {
  bindMenu();
  bindVista();
  bindSectionNavigation();
}

// As fontes consolidadas já vêm no HTML (conteudo/textos.json); nada é buscado.
const ANCORA = '.methodology-article';

aoEntrarNaPagina(ANCORA, init);
