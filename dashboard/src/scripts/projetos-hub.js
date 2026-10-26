import { aoEntrarNaPagina, bindMenu, bindVista, sinalDaPagina } from './shared.js';

// A entrada da página de projetos: o texto sobe, as bandeiras acendem, os fios
// do diagrama se desenham até o Consórcio e o portal, e a foto assenta com um
// recuo leve de zoom. Acontece uma vez, quando o quadro entra na tela. O estado
// escondido só existe com `is-anima`, que este script põe: sem script, ou com
// movimento reduzido, a página aparece já pronta.
const ANCORA = '[data-hub]';

function init() {
  bindMenu();
  bindVista();
  const quadro = document.querySelector(ANCORA);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  quadro.classList.add('is-anima');
  const observador = new IntersectionObserver((entradas) => {
    if (!entradas.some((entrada) => entrada.isIntersecting)) return;
    quadro.classList.add('is-visivel');
    observador.disconnect();
  }, { threshold: 0.2 });
  observador.observe(quadro);
  sinalDaPagina().addEventListener('abort', () => observador.disconnect());
}

aoEntrarNaPagina(ANCORA, init);
