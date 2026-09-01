// Helpers usados por mais de uma página. Antes existiam quatro cópias de `escape`
// e do binding do menu, duas de `readResponse`, `flagImage` e `number`.

export function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]);
}

export async function readResponse(response) {
  if (!response.ok) throw new Error('Não foi possível carregar os dados do painel.');
  return response.json();
}

export function decimals(value) {
  const absolute = Math.abs(value);
  if (absolute >= 1000) return 0;
  if (absolute >= 100) return 1;
  if (absolute >= 1) return 2;
  return 3;
}

export function number(value, casas = decimals(value)) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });
}

export function flagImage(item, alt) {
  const version = item.flagVersion ? `?v=${item.flagVersion}` : '';
  const ratio = item.flagRatio ? ` style="aspect-ratio:${item.flagRatio}"` : '';
  return `<img src="/flags/${encodeURIComponent(item.flag)}${version}"${ratio} alt="${escape(alt || '')}">`;
}

export function bindMenu() {
  const menuButton = document.querySelector('.menu-button');
  // Idempotente: páginas podem ter mais de um módulo chamando bindMenu.
  if (!menuButton || menuButton.dataset.menuBound) return;
  menuButton.dataset.menuBound = '1';
  menuButton.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('menu-open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
    menuButton.textContent = isOpen ? 'Fechar' : 'Menu';
  });
  document.querySelectorAll('.topnav a, .topnav button').forEach((link) => link.addEventListener('click', () => {
    document.body.classList.remove('menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.textContent = 'Menu';
  }));
}

// ---------------------------------------------------------------------------
// Ciclo de vida das páginas com o ClientRouter do Astro.
//
// Na navegação SPA o documento não é recriado: o Astro troca o <body> e mantém
// window, document, CSS e módulos já avaliados. Duas consequências:
//
// 1. O módulo de uma página roda uma vez só. A inicialização precisa acontecer
//    a cada entrada, e o módulo pode ser avaliado antes ou depois do evento
//    astro:page-load, dependendo de já estar no cache. O par abaixo cobre as
//    duas ordens sem inicializar duas vezes.
// 2. Listeners em window/document sobrevivem à troca e se acumulariam a cada
//    navegação. `sinalDaPagina()` devolve um AbortSignal que é cancelado na
//    saída, então basta passá-lo ao addEventListener.
// ---------------------------------------------------------------------------

let ciclo = new AbortController();

// Sem sinal, de propósito: este listener é quem cancela os outros. Com sinal,
// ele se cancelaria na primeira navegação e o ciclo morreria em silêncio.
document.addEventListener('astro:before-swap', () => {
  ciclo.abort();
  ciclo = new AbortController();
});

export function sinalDaPagina() {
  return ciclo.signal;
}

export function aoEntrarNaPagina(seletorAncora, iniciar) {
  let feito = false;
  const executar = () => {
    if (feito || !document.querySelector(seletorAncora)) return;
    feito = true;
    iniciar();
  };
  document.addEventListener('astro:before-swap', () => { feito = false; });
  document.addEventListener('astro:page-load', executar);
  executar();
}
