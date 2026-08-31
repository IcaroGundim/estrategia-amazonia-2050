function escape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

function bindMenu() {
  const menuButton = document.querySelector('.menu-button');
  menuButton.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('menu-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.textContent = isOpen ? 'Fechar' : 'Menu';
  });
  document.querySelectorAll('.topnav a').forEach((link) => link.addEventListener('click', () => {
    document.body.classList.remove('menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = 'Menu';
  }));
}

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
  }, { passive: true });
  window.addEventListener('resize', updateActiveSection);
  window.addEventListener('hashchange', updateActiveSection);
  updateActiveSection();
}

async function init() {
  bindMenu();
  bindSectionNavigation();
  const response = await fetch('/api/dashboard');
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

init().catch((error) => {
  document.querySelector('#method-dimensions').innerHTML = `<p class="load-error">${escape(error.message)} Atualize a página para tentar novamente.</p>`;
  document.querySelector('[data-method-sources]').textContent = 'As fontes não puderam ser carregadas.';
});
