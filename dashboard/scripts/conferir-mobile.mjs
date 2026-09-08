// Conferência responsiva das quatro rotas em celular e tablet, incluindo os
// estados que só existem depois de um toque (ficha do indicador, detalhe da
// meta, aba de comparação). Ferramenta de trabalho: não entra no build.
//
// Uso: node scripts/conferir-mobile.mjs
//   BASE=http://localhost:4322  endereço do servidor já no ar
//   PLAYWRIGHT_PATH=…           playwright fora do projeto (cache do npx)
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const BASE = process.env.BASE || 'http://localhost:4322';
const SAIDA = 'd:/Projetos/estratégia-2050/.shots/conferencia';

const APARELHOS = [
  { nome: 'celular-320', width: 320, height: 700 },
  { nome: 'celular-390', width: 390, height: 844 },
  { nome: 'tablet-768', width: 768, height: 1024 },
  { nome: 'tablet-834', width: 834, height: 1112 },
  { nome: 'tablet-1024', width: 1024, height: 768 },
  { nome: 'tablet-1180', width: 1180, height: 820 }
];

// Cada cena é uma rota mais os toques necessários para chegar ao estado a conferir.
const CENAS = [
  { nome: 'panorama', url: '/' },
  { nome: 'panorama-estado', url: '/', acao: async (p) => { await p.click('.state-shape[data-state="PA"]', { force: true }); } },
  { nome: 'panorama-ranking', url: '/', acao: async (p) => { await p.click('[data-panel-view="ranking"]'); } },
  { nome: 'visao-geral', url: '/metodologia' },
  { nome: 'metas', url: '/metas' },
  { nome: 'metas-detalhe', url: '/metas', acao: async (p) => { await p.click('button.goals-row'); } },
  { nome: 'indicadores', url: '/indicadores' },
  { nome: 'indicadores-filtros', url: '/indicadores', acao: async (p) => {
      const botao = p.locator('.filters-toggle');
      if (await botao.isVisible()) await botao.click();
    } },
  { nome: 'indicadores-ficha', url: '/indicadores', acao: async (p) => { await p.click('.indicator-table-row'); } }
];

// Elementos decorativos que estouram de propósito, dentro de um pai que recorta.
const DECORATIVOS = ['.river-ornament', '.legend-ramp'];

const problemas = [];
const anota = (aparelho, cena, texto) => problemas.push(`${aparelho} · ${cena}: ${texto}`);

await mkdir(SAIDA, { recursive: true });
const navegador = await chromium.launch();

for (const aparelho of APARELHOS) {
  const contexto = await navegador.newContext({
    viewport: { width: aparelho.width, height: aparelho.height },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR'
  });
  const pagina = await contexto.newPage();
  pagina.on('pageerror', (erro) => anota(aparelho.nome, 'js', String(erro)));

  for (const cena of CENAS) {
    await pagina.goto(BASE + cena.url, { waitUntil: 'networkidle' });
    await pagina.waitForTimeout(500);
    if (cena.acao) {
      try { await cena.acao(pagina); } catch (erro) { anota(aparelho.nome, cena.nome, `ação falhou — ${erro.message.split('\n')[0]}`); }
      await pagina.waitForTimeout(600);
    }

    const achados = await pagina.evaluate((decorativos) => {
      const saida = [];
      const larguraVisivel = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > larguraVisivel + 1) {
        saida.push(`rolagem horizontal na página (${document.documentElement.scrollWidth} > ${larguraVisivel})`);
      }

      const decorativo = (el) => decorativos.some((sel) => el.closest(sel));
      // Um pai que recorta ou rola absorve o transbordo do filho de propósito.
      const contido = (el) => {
        for (let pai = el.parentElement; pai; pai = pai.parentElement) {
          const estilo = getComputedStyle(pai);
          if (/hidden|auto|scroll|clip/.test(estilo.overflowX + estilo.overflow)) return true;
        }
        return false;
      };

      for (const el of document.querySelectorAll('body *')) {
        const caixa = el.getBoundingClientRect();
        if (caixa.width === 0 || caixa.height === 0) continue;
        if (caixa.right > larguraVisivel + 1 && !decorativo(el) && !contido(el)) {
          saida.push(`transborda à direita: ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (${Math.round(caixa.right)}px)`);
        }
      }

      // Texto cortado: caixa sem rolagem própria cujo conteúdo não cabe. O corte
      // por reticências (`text-overflow`) e o `-webkit-line-clamp` são recursos
      // deliberados e ficam de fora.
      for (const el of document.querySelectorAll('.slide-copy, .state-panel-body, .goals-detail, .indicator-detail-body, .map-indicator-card')) {
        const estilo = getComputedStyle(el);
        if (/auto|scroll/.test(estilo.overflowY)) continue;
        if (el.scrollHeight > el.clientHeight + 2) {
          saida.push(`conteúdo cortado em .${[...el.classList].join('.')} (sobra ${el.scrollHeight - el.clientHeight}px)`);
        }
      }

      // Texto cortado por reticências. A escala tipográfica da camada de celular
      // aumenta o corpo dos rótulos, e o que cabia numa caixa de largura fixa
      // pode deixar de caber — é o efeito colateral direto daquela folha.
      for (const el of document.querySelectorAll('body *')) {
        const estilo = getComputedStyle(el);
        if (estilo.textOverflow !== 'ellipsis' || estilo.whiteSpace !== 'nowrap') continue;
        if (el.getBoundingClientRect().width === 0) continue;
        if (el.scrollWidth > el.clientWidth + 1) {
          saida.push(`texto cortado: ${el.tagName.toLowerCase()}.${[...el.classList].join('.') || '—'} "${el.textContent.trim().slice(0, 34)}"`);
        }
      }

      // Alvos de toque abaixo de 44px.
      const pequenos = new Set();
      // A altura que vale é a da área sensível, que pode ser maior que a caixa:
      // um ::after de inset negativo amplia o alvo sem mexer no desenho, e um
      // <input> dentro de <label> é tocado pela área do rótulo inteiro.
      const alturaSensivel = (el) => {
        let altura = el.getBoundingClientRect().height;
        const rotulo = el.closest('label');
        if (rotulo) altura = Math.max(altura, rotulo.getBoundingClientRect().height);
        const depois = getComputedStyle(el, '::after');
        if (depois.content && depois.content !== 'none' && depois.position === 'absolute') {
          const cima = parseFloat(depois.top), baixo = parseFloat(depois.bottom);
          if (cima < 0) altura -= cima;
          if (baixo < 0) altura -= baixo;
        }
        return altura;
      };
      for (const el of document.querySelectorAll('button, a[href], input, [role="tab"], [role="option"]')) {
        const caixa = el.getBoundingClientRect();
        if (caixa.width === 0 || caixa.height === 0) continue;
        // Link dentro de um parágrafo é texto corrido, não um alvo isolado.
        if (el.tagName === 'A' && el.closest('p, figcaption, .method-list, dd')) continue;
        const altura = alturaSensivel(el);
        if (altura < 40) pequenos.add(`${el.tagName.toLowerCase()}.${[...el.classList].join('.') || '—'} (${Math.round(altura)}px)`);
      }
      if (pequenos.size) saida.push(`alvos de toque baixos: ${[...pequenos].slice(0, 4).join(', ')}`);

      return saida;
    }, DECORATIVOS);

    for (const achado of achados) anota(aparelho.nome, cena.nome, achado);
    await pagina.screenshot({ path: `${SAIDA}/${aparelho.nome}--${cena.nome}.png`, fullPage: true });
  }
  await contexto.close();
}

await navegador.close();

if (problemas.length) {
  console.log(`${problemas.length} achado(s):\n`);
  for (const problema of problemas) console.log('  ' + problema);
  process.exitCode = 1;
} else {
  console.log('Nenhum achado: sem rolagem horizontal, sem transbordo, sem conteúdo cortado, sem texto em reticências, alvos de toque acima de 40px.');
}
console.log(`\nCapturas em ${SAIDA}`);
