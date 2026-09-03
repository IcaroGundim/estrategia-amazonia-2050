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

// A região não tem bandeira oficial: esta é a silhueta dos nove estados, gerada
// a partir da mesma malha do mapa (scripts/gerar_bandeira_regiao.mjs), para a
// Amazônia Legal aparecer ao lado dos estados em vez de virar um rótulo de texto.
export const BANDEIRA_REGIAO = { flag: 'Bandeira_da_Amazonia_Legal.svg', flagRatio: '3 / 2' };

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

// Alterna entre o fluxo corrido e o layout de computador. Quem faz o trabalho é
// a meta viewport, não o CSS: com `width=1280` as media queries passam a avaliar
// contra 1280px e o desktop aparece inteiro, com zoom e arrasto — que é o que
// "ver como no computador" significa num navegador móvel. A alternativa seria
// prefixar as quase cem regras responsivas com um seletor de modo.
export function bindVista() {
  const botao = document.querySelector('[data-vista-toggle]');
  if (!botao || botao.dataset.vistaBound) return;
  botao.dataset.vistaBound = '1';
  botao.addEventListener('click', () => {
    const desktop = document.documentElement.dataset.vista !== 'desktop';
    try { localStorage.setItem('vista', desktop ? 'desktop' : 'fluxo'); } catch (erro) { /* modo privado: vale só para esta visita */ }
    // Recarrega em vez de mudar o viewport ao vivo: a mutação em tempo de
    // execução é tratada de formas diferentes por cada navegador móvel, e o
    // script inline da <head> pinta a página já no modo certo.
    location.reload();
  });
}

// O ClientRouter troca a <head> e os atributos do <html>. Sem copiar a
// preferência para o documento que está entrando, a segunda página abriria no
// fluxo corrido mesmo com o modo de computador ligado. Sem sinal, de propósito:
// precisa valer por toda a sessão, como o listener que gira o `ciclo`.
document.addEventListener('astro:before-swap', (evento) => {
  const novo = evento.newDocument;
  if (!novo) return;
  novo.documentElement.dataset.vista = document.documentElement.dataset.vista || 'fluxo';
  const metaAtual = document.querySelector('meta[name="viewport"]');
  const metaNova = novo.querySelector('meta[name="viewport"]');
  if (metaAtual && metaNova) metaNova.content = metaAtual.content;
});

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
