// Conteúdo dos indicadores na língua da página.
//
// A interface é traduzida por dicionário compilado junto com o código; o
// conteúdo — nome dos 59 indicadores, texto das metas pactuadas, definição
// técnica, fontes — vem dos mesmos JSONs que alimentam o painel e é traduzido
// por sobreposição: `public/data/i18n/en.json` traz, por código de indicador, os
// campos em inglês, e este módulo os aplica por cima do português.
//
// É sobreposição, e não um segundo `catalogo.json`, por dois motivos. O catálogo
// é gerado pelo `server.mjs` a partir de planilhas que não estão no repositório,
// então uma cópia traduzida sairia do ar na primeira atualização de dados. E a
// falta de uma entrada tem de degradar para o português, não para vazio: um
// indicador novo aparece em português na versão inglesa até alguém traduzi-lo,
// que é feio mas verdadeiro — melhor que sumir da lista.

import { ehTraducao } from '../i18n/index.js';

let promessa = null;
let sobreposicao = null;

/**
 * Baixa a sobreposição, uma vez por visita. Em português não há o que baixar.
 * O `<link rel=preload>` do layout já pôs o arquivo no cache, então esta busca
 * costuma resolver sem ida à rede.
 */
export function carregaConteudo() {
  if (!ehTraducao()) return Promise.resolve(null);
  if (!promessa) {
    promessa = fetch('/data/i18n/en.json')
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados) => {
        sobreposicao = dados;
        return dados;
      })
      .catch(() => {
        // Sem a sobreposição o painel mostra o conteúdo em português. É a
        // degradação certa: o número continua correto e a fonte continua
        // rastreável; só o texto fica na língua de origem.
        promessa = null;
        return null;
      });
  }
  return promessa;
}

/** Campo de um indicador, em inglês quando houver. */
export function campo(codigo, nome, valorPt) {
  return sobreposicao?.indicadores?.[codigo]?.[nome] ?? valorPt;
}

/** Campo da ficha técnica de um indicador. */
export function campoDaFicha(codigo, nome, valorPt) {
  return sobreposicao?.fichas?.[codigo]?.[nome] ?? valorPt;
}

/** O campo traduzido da ficha, ou nada — para quem precisa distinguir os dois. */
export function sobreposicaoDaFicha(codigo, nome) {
  return sobreposicao?.fichas?.[codigo]?.[nome] ?? null;
}

/**
 * Linha de ação. São 25 frases longas compartilhadas pelos 59 indicadores —
 * "1.1. Fortalecer a implementação da política de Zoneamento…" —, então a
 * sobreposição as guarda uma vez, pelo número, em vez de repetir a mesma frase
 * em cada ficha que a cita.
 */
export function linhaDeAcao(valorPt) {
  const numero = String(valorPt ?? '').match(/^(\d+\.\d+)/)?.[1];
  return (numero && sobreposicao?.linhasAcao?.[numero]) ?? valorPt;
}

/** Nome do eixo, que aparece no cabeçalho de cada grupo da lista. */
export function nomeDoEixo(numero, valorPt) {
  return sobreposicao?.eixos?.[String(numero)] ?? valorPt;
}

/**
 * As equações em LaTeX têm português dentro — `\mathrm{Taxa\ de\ pobreza}`,
 * `\operatorname{média}`. A sobreposição pode trocar a lista inteira de
 * equações de um indicador.
 */
export function equacoesDe(codigo) {
  return sobreposicao?.equacoes?.[codigo] ?? null;
}

/** Legendas dos símbolos que acompanham a fórmula. */
export function notasDaFormula(codigo) {
  return sobreposicao?.notasFormula?.[codigo] ?? null;
}
