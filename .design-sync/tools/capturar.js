// Trecho para colar no console (ou no javascript_tool do navegador) com uma tela do UI kit aberta
// pelo servidor `design-kit` (servir.mjs, porta 4330). Manda o <body> já renderizado para
// POST /__captura/<nome>, que grava em .design-sync/.cache/capturas/<nome>.json; depois,
// `node .design-sync/tools/montar-canvas.mjs` transforma as capturas em pranchetas.
//
// Estados capturados (nomes esperados pelo montar-canvas.mjs), com a janela em 1440×900:
//   index.html    → vg-1 … vg-5: clique em cada item da trilha e capture com { slide: n, altura: 900 }
//   metas.html    → metas; aba "Trajetória 2050" → metas-trajetoria; aba "Ficha técnica" → metas-ficha
//   panorama.html → panorama; aba "Comparação estadual" → panorama-comparacao
// e em 390×844 (celular): mobile-vg, mobile-metas, mobile-panorama, sem opções.
window.__capturar = async function (nome, opcoes = {}) {
  await new Promise((pronto) => setTimeout(pronto, opcoes.espera || 1200));
  const corpo = document.body.cloneNode(true);
  corpo.querySelectorAll('script').forEach((script) => script.remove());
  // Na Visão Geral o deck rola na horizontal: a prancheta de cada lâmina leva só ela.
  if (opcoes.slide) {
    [...corpo.querySelectorAll('.methodology-article > section')].forEach((secao, indice) => {
      if (indice !== opcoes.slide - 1) secao.remove();
    });
  }
  const dados = {
    nome,
    largura: innerWidth,
    altura: Math.ceil(opcoes.altura || document.documentElement.scrollHeight),
    html: corpo.innerHTML,
    classeBody: document.body.className
  };
  const resposta = await fetch(`/__captura/${nome}`, { method: 'POST', body: JSON.stringify(dados) });
  return { nome, ok: resposta.ok, altura: dados.altura, tamanho: dados.html.length };
};
