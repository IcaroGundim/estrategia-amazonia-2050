// Duas línguas, uma fonte.
//
// A chave de tradução é o próprio texto em português — o mesmo arranjo do
// gettext. Não é preguiça: o painel foi escrito em português e continua sendo
// mantido em português, então um dicionário de chaves abstratas (`mapa.legenda.
// menor`) obrigaria a ler dois arquivos para saber o que uma tela diz. Com o
// original como chave, o código continua legível sem consulta, o diff da
// tradução não toca a lógica, e um texto sem correspondência cai no português
// em vez de mostrar a chave crua ao leitor.
//
// O preço é que mudar uma frase no código a desliga da tradução em silêncio.
// `scripts/conferir-traducao.mjs` existe para isso: ele varre os fontes e
// aponta o que ficou sem par.

import { en } from './en.js';

const DICIONARIOS = { en };

/** Idioma padrão; é o que responde na raiz do site. */
export const IDIOMA_PADRAO = 'pt-BR';

// A bandeira acompanha a sigla no seletor porque "PT" e "EN" só se distinguem
// depois de lidos, e quem procura a troca varre a barra de olho. O inglês não
// tem bandeira: a mesclada de Estados Unidos e Reino Unido é a convenção dos
// seletores de idioma, e evita escolher de qual dos dois ingleses o painel fala.
// A proporção vem junto porque as duas imagens têm forma diferente e o `img`
// precisa reservar o espaço certo antes de a folha carregar.
//
// Elas moram em `public/idiomas/`, e não com as dos estados em `public/flags/`:
// aquela pasta é gerada — o `build-static.mjs` apaga e recopia da pasta de
// bandeiras do Consórcio a cada rodada —, e um arquivo escrito à mão ali
// desapareceria na primeira atualização de dados.
export const IDIOMAS = [
  {
    codigo: 'pt-BR',
    rotulo: 'Português',
    curto: 'PT',
    prefixo: '',
    bandeira: 'Bandeira_do_Brasil.svg',
    bandeiraRatio: '10 / 7'
  },
  {
    codigo: 'en',
    rotulo: 'English',
    curto: 'EN',
    prefixo: '/en',
    bandeira: 'Bandeira_EUA_Reino_Unido.svg',
    bandeiraRatio: '3 / 2'
  }
];

/**
 * Tradutor preso a um idioma. Usado no frontmatter das páginas, onde não há
 * `document` para consultar.
 */
export function traduzirCom(idioma) {
  const dicionario = DICIONARIOS[idioma];
  if (!dicionario) return (texto) => texto;
  return (texto) => dicionario[texto] ?? texto;
}

/**
 * Idioma da página em curso, lido do documento. O `lang` do <html> é escrito
 * pelo layout e sobrevive à troca de rotas do ClientRouter.
 */
export function idiomaAtual() {
  if (typeof document === 'undefined') return IDIOMA_PADRAO;
  return document.documentElement.lang === 'en' ? 'en' : IDIOMA_PADRAO;
}

/** Tradutor para os módulos de cliente, que descobrem o idioma sozinhos. */
export function t(texto) {
  return traduzirCom(idiomaAtual())(texto);
}

/**
 * Frase com lacunas. Existe porque a ordem das palavras muda de língua: em
 * "registra 1,13 km² em Desmatamento" o valor vem antes do indicador, e em
 * "records 1.13 km² for deforestation" a preposição é outra. Interpolar direto
 * no template obrigaria a frase inteira a ter a forma do português.
 *
 *   tp('{regiao} registra {valor} em {indicador}.', { regiao, valor, indicador })
 */
export function tp(texto, valores) {
  return t(texto).replace(/\{(\w+)\}/g, (_, chave) => valores[chave] ?? '');
}

/** Em inglês o painel é uma cortesia; o texto que vale é o português. */
export function ehTraducao(idioma = idiomaAtual()) {
  return idioma !== IDIOMA_PADRAO;
}

// ---------------------------------------------------------------------------
// Números e datas
//
// Não é tradução, é correção: `29,7 mi` e `1,13 km²` trocam a vírgula pelo
// ponto em inglês, e um leitor de língua inglesa lê "1,13" como mil e cento e
// trinta. Todo lugar do painel que formata número passa por aqui.
// ---------------------------------------------------------------------------

export function localeDe(idioma = idiomaAtual()) {
  return idioma === 'en' ? 'en-US' : 'pt-BR';
}

/** Sufixos de escala. Em português "mi" e "bi"; em inglês "M" e "B", colados. */
export function escalaDe(idioma = idiomaAtual()) {
  return idioma === 'en'
    ? { mil: 'K', milhao: 'M', bilhao: 'B', junto: true }
    : { mil: 'mil', milhao: 'mi', bilhao: 'bi', junto: false };
}

// ---------------------------------------------------------------------------
// Rotas
//
// Os endereços em inglês têm caminho próprio — `/en/goals` e não `/en/metas` —
// porque quem lê em inglês também lê a barra de endereço. O par vive aqui, num
// lugar só, porque o seletor de idioma precisa saber para onde levar e o
// `hreflang` precisa saber o que anunciar.
// ---------------------------------------------------------------------------

export const ROTAS = [
  { chave: 'index', 'pt-BR': '/', en: '/en' },
  { chave: 'metodologia', 'pt-BR': '/metodologia', en: '/en/overview' },
  { chave: 'metas', 'pt-BR': '/metas', en: '/en/goals' }
];

export function rota(chave, idioma = IDIOMA_PADRAO) {
  return ROTAS.find((item) => item.chave === chave)?.[idioma] ?? '/';
}

/** O mesmo lugar na outra língua, preservando âncora e busca. */
export function rotaEquivalente(chave, idioma, sufixo = '') {
  return rota(chave, idioma) + sufixo;
}
