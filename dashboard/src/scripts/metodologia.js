import { aoEntrarNaPagina, bindMenu, escape, sinalDaPagina } from './shared.js';

function bindSectionNavigation() {
  const links = [...document.querySelectorAll('.methodology-index nav a')];
  const sections = links.map((link) => document.querySelector(link.hash)).filter(Boolean);
  let ticking = false;

  function updateActiveSection() {
    const readingLine = window.scrollY + Math.min(window.innerHeight * 0.3, 240);
    const porLinha = () => sections.reduce((current, section) => section.offsetTop <= readingLine ? section : current, sections[0]);
    // No fim da página a linha de leitura para de subir: a última seção é curta e o
    // documento não rola o bastante para ela cruzar a linha, então ela nunca ficaria
    // ativa mesmo estando inteira na tela. Chegando ao fim, é ela que está sendo lida.
    const noFim = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;
    const active = noFim ? sections.at(-1) : porLinha();
    links.forEach((link) => link.classList.toggle('is-active', link.hash === `#${active.id}`));
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateActiveSection);
  }, { passive: true, signal: sinalDaPagina() });
  window.addEventListener('resize', updateActiveSection, { signal: sinalDaPagina() });
  window.addEventListener('hashchange', updateActiveSection, { signal: sinalDaPagina() });
  updateActiveSection();
}

async function init() {
  bindMenu();
  bindSectionNavigation();
  const response = await fetch('/data/dashboard.json');
  if (!response.ok) throw new Error('Não foi possível carregar a nota metodológica.');
  const data = await response.json();
  document.querySelectorAll('[data-updated]').forEach((element) => { element.textContent = data.updatedAt; });
  document.querySelector('[data-method-sources]').textContent = data.methodology.sources;
}

const ANCORA = '[data-method-sources]';

aoEntrarNaPagina(ANCORA, () => init().catch((error) => {
  document.querySelector('[data-method-sources]').textContent = 'As fontes não puderam ser carregadas.';
}));
