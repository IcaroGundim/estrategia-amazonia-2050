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
  if (!menuButton) return;
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
