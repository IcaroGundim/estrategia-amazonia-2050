import { aoEntrarNaPagina, bindMenu, escape, sinalDaPagina } from './shared.js';

function bindSectionNavigation() {
  const links = [...document.querySelectorAll('.methodology-index nav a')];
  const sections = links.map((link) => document.querySelector(link.hash)).filter(Boolean);
  let ticking = false;

  function updateActiveSection() {
    const readingLine = window.scrollY + Math.min(window.innerHeight * 0.3, 240);
    const active = sections.reduce((current, section) => section.offsetTop <= readingLine ? section : current, sections[0]);
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
  document.querySelector('#method-dimensions').innerHTML = data.methodology.dimensions.map((dimension, index) => `
    <article style="--dimension-index:${index}">
      <b>${escape(dimension.weight)}</b>
      <div>
        <h3>${escape(dimension.name)}</h3>
        <p>${escape(dimension.indicators)}</p>
      </div>
    </article>`).join('');
}

const ANCORA = '#method-dimensions';

aoEntrarNaPagina(ANCORA, () => init().catch((error) => {
  document.querySelector('#method-dimensions').innerHTML = `<p class="load-error">${escape(error.message)} Atualize a página para tentar novamente.</p>`;
  document.querySelector('[data-method-sources]').textContent = 'As fontes não puderam ser carregadas.';
}));
