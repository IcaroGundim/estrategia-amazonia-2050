// Textos do painel (conteudo/textos.json): a árvore de pares { pt, en } e a
// forma de aplicar o que veio do formulário sobre ela. A tela de edição e a
// prévia ao vivo usam o mesmo caminho, então o que se vê na prévia é o que
// seria salvo.
import { ErroDeEdicao, texto, textoOuNulo } from './edicao';

export type Par = { pt: string; en?: string | null };
export type Arvore = { [chave: string]: unknown };

export const ehPar = (valor: unknown): valor is Par =>
  typeof valor === 'object' && valor !== null && 'pt' in valor && typeof (valor as Par).pt === 'string';

/** Cada folha { pt, en } com o caminho até ela, ex.: visaoGeral.eixos.itens.2.titulo */
export function folhas(no: unknown, caminho: string[] = []): { caminho: string; par: Par }[] {
  if (ehPar(no)) return [{ caminho: caminho.join('.'), par: no }];
  if (Array.isArray(no)) return no.flatMap((item, indice) => folhas(item, [...caminho, String(indice)]));
  if (typeof no === 'object' && no !== null) {
    return Object.entries(no).filter(([chave]) => !chave.startsWith('_')).flatMap(([chave, valor]) => folhas(valor, [...caminho, chave]));
  }
  return [];
}

export function poe(no: unknown, caminho: string[], par: Par) {
  const [cabeca, ...resto] = caminho;
  const alvo = no as { [k: string]: unknown };
  if (!resto.length) { alvo[cabeca] = { ...(alvo[cabeca] as object), ...par }; return; }
  poe(alvo[cabeca], resto, par);
}

/**
 * Sobrescreve a árvore com os campos `t:<caminho>` e `t:<caminho>__en` do
 * formulário. Ao salvar (`estrito`), um português vazio é erro; na prévia ele
 * passa em branco mesmo, para a pessoa ver o buraco.
 */
export function aplicaFormulario<T extends Arvore>(textos: T, dados: FormData, { estrito = true } = {}): T {
  for (const { caminho, par } of folhas(textos)) {
    const nome = `t:${caminho}`;
    if (!dados.has(nome)) continue;
    const pt = texto(dados, nome);
    if (!pt && estrito) throw new ErroDeEdicao(`O texto em português de "${caminho}" não pode ficar vazio.`);
    poe(textos, caminho.split('.'), { pt, en: textoOuNulo(dados, `${nome}__en`) ?? par.en ?? null });
  }
  return textos;
}

/**
 * Os blocos da tela de edição. `caminhos` são os prefixos (ou caminhos exatos)
 * da árvore que entram no bloco; `ancora` é a lâmina da Visão Geral que a
 * prévia abre. O bloco da nota técnica não tem âncora: nenhuma página do
 * painel mostra esses textos, só o PDF gerado à parte.
 */
export interface Grupo { id: string; caminhos: string[]; secao: 'Lâminas' | 'Nota técnica'; titulo: string; descricao: string; ancora?: string; item?: string }
export const GRUPOS: Grupo[] = [
  { id: 'estrategia', caminhos: ['visaoGeral.estrategia'], secao: 'Lâminas', titulo: 'Lâmina 1: Estratégia', descricao: 'Título, abertura, os três números e o fechamento.', ancora: 'a-estrategia' },
  { id: 'visao2050', caminhos: ['visaoGeral.visao2050'], secao: 'Lâminas', titulo: 'Lâmina 2: Visão 2050', descricao: 'A visão regional e como a Estratégia auxilia os estados.', ancora: 'visao-2050' },
  { id: 'eixos', caminhos: ['visaoGeral.eixos'], secao: 'Lâminas', titulo: 'Lâmina 3: Eixos', descricao: 'Os cinco eixos.', ancora: 'eixos-de-implementacao', item: 'Eixo' },
  { id: 'governanca', caminhos: ['visaoGeral.governanca'], secao: 'Lâminas', titulo: 'Lâmina 4: Governança', descricao: 'Os seis blocos e o fluxo de implementação.', ancora: 'governanca', item: 'Bloco' },
  { id: 'ipam', caminhos: ['visaoGeral.estePainel'], secao: 'Lâminas', titulo: 'Lâmina 5: IPAM', descricao: 'O papel do IPAM na construção da Estratégia, a citação dos governadores e o crédito ao instituto.', ancora: 'calculo' },
  { id: 'nota-tecnica', caminhos: ['panorama.metodologia.title', 'panorama.metodologia.text', 'panorama.metodologia.dimensions', 'panorama.metodologia.sources'], secao: 'Nota técnica', titulo: 'Nota técnica: síntese comparativa', descricao: 'Título, texto, dimensões e fontes consolidadas da síntese comparativa. Vão para a nota técnica em PDF, que é gerada à parte (npm run nota-tecnica); nenhuma página do painel os mostra, então a prévia não muda.' }
];

/** Se a folha em `caminho` pertence ao grupo. */
export const pertenceAoGrupo = (grupo: Grupo, caminho: string) =>
  grupo.caminhos.some((prefixo) => caminho === prefixo || caminho.startsWith(`${prefixo}.`));

// Como cada pedaço do caminho se lê na tela. Uma chave que não está aqui sai
// com o próprio nome, separado em palavras, para não ficar sem rótulo.
const NOME_DO_CAMPO: Record<string, string> = {
  tituloLinha1: 'título, linha 1', tituloLinha2: 'título, linha 2', abertura: 'abertura', fechamento: 'fechamento',
  chapeu: 'chapéu', titulo: 'título', selo: 'selo', subChapeu: 'chapéu da segunda parte', subTitulo: 'título da segunda parte',
  texto: 'texto', rotulo: 'rótulo', autor: 'autor', title: 'título', text: 'texto', sources: 'fontes', name: 'nome', indicators: 'indicadores',
  citacao: 'citação', botaoPdf: 'botão do PDF', contribuicao: 'crédito'
};
const NOME_DA_LISTA: Record<string, string> = {
  numeros: 'Número', itens: 'Item', paragrafos: 'Parágrafo', lista: 'Item da lista', fluxo: 'Etapa do fluxo', dimensions: 'Dimensão'
};
const emPalavras = (chave: string) => chave.replace(/([a-z])([A-Z0-9])/g, '$1 $2').toLowerCase();
const maiuscula = (valor: string) => valor.charAt(0).toUpperCase() + valor.slice(1);

/**
 * Rótulo de um campo das lâminas, a partir do caminho dele dentro do grupo:
 * `visaoGeral.eixos.itens.2.titulo` vira "Eixo 3 · título".
 */
export function rotuloDoCaminho(grupo: Grupo, caminho: string): string {
  const prefixo = grupo.caminhos.filter((item) => caminho === item || caminho.startsWith(`${item}.`)).sort((a, b) => b.length - a.length)[0] || '';
  // Um grupo feito de caminhos exatos (a nota técnica) guarda o último pedaço, que é o nome do campo.
  const resto = (caminho === prefixo ? caminho.split('.').slice(-1) : caminho.slice(prefixo.length + 1).split('.'));
  // Quando o próprio prefixo é a lista (`…dimensions`), o resto começa no número.
  if (/^\d+$/.test(resto[0])) resto.unshift(prefixo.split('.').pop() || '');
  const partes: string[] = [];
  for (let i = 0; i < resto.length; i += 1) {
    const parte = resto[i];
    if (/^\d+$/.test(resto[i + 1] ?? '')) {
      const nome = (parte === 'itens' && grupo.item) || NOME_DA_LISTA[parte] || maiuscula(emPalavras(parte));
      partes.push(`${nome} ${Number(resto[i + 1]) + 1}`);
      i += 1;
    } else partes.push(NOME_DO_CAMPO[parte] || emPalavras(parte));
  }
  return maiuscula(partes.join(' · '));
}

/** Quantos textos mudaram entre duas versões da árvore, para o aviso de "salvo". */
export function mudancasDeTextos(antes: Arvore, depois: Arvore): number {
  const de = new Map(folhas(antes).map(({ caminho, par }) => [caminho, par]));
  return folhas(depois).filter(({ caminho, par }) => {
    const era = de.get(caminho);
    return !era || era.pt !== par.pt || (era.en || null) !== (par.en || null);
  }).length;
}

// ---------- textos de interface (conteudo/interface.json) ----------

export type Pagina = 'index' | 'metas' | 'metodologia' | 'projetos';

export interface Interface {
  _leia?: string;
  grupos: { titulo: string; pagina: Pagina; chaves: string[]; alvo?: string; abre?: string }[];
  textos: Record<string, Par>;
}

/** Nome do campo de formulário de um texto de interface; a chave é o texto original, então vai codificada. */
export const nomeDeInterface = (chave: string) => `i:${encodeURIComponent(chave)}`;

/**
 * Sobrescreve os textos de interface com os campos `i:<chave>` e
 * `i:<chave>__en` do formulário. Mesma regra dos textos das lâminas: ao
 * salvar, português vazio é erro; na prévia, passa.
 */
/** Lacunas de uma frase, como `{total}`: o painel as troca pelo valor na hora de exibir. */
export const lacunasDe = (frase: string) => [...new Set(frase.match(/\{\w+\}/g) || [])];

// O formulário apara as pontas, mas há frase que termina em espaço porque o
// código cola outra logo depois ("Panorama - " + "Amazônia Legal."). A borda
// da chave é reposta, senão as duas saem grudadas na página.
const comBordas = (chave: string, valor: string) =>
  valor ? `${chave.match(/^\s*/)![0]}${valor}${chave.match(/\s*$/)![0]}` : valor;

export function aplicaFormularioInterface(dicionario: Interface, dados: FormData, { estrito = true } = {}): Interface {
  for (const [chave, par] of Object.entries(dicionario.textos)) {
    const nome = nomeDeInterface(chave);
    if (!dados.has(nome)) continue;
    const pt = comBordas(chave, texto(dados, nome));
    const enDoFormulario = textoOuNulo(dados, `${nome}__en`);
    const en = enDoFormulario ? comBordas(chave, enDoFormulario) : par.en ?? null;
    if (estrito) {
      if (!pt) throw new ErroDeEdicao(`O texto em português de "${chave}" não pode ficar vazio.`);
      // Uma lacuna apagada some da frase publicada (o número não aparece).
      const lacunas = lacunasDe(chave);
      const faltaPt = lacunas.filter((lacuna) => !pt.includes(lacuna));
      const faltaEn = en ? lacunas.filter((lacuna) => !en.includes(lacuna)) : [];
      if (faltaPt.length) throw new ErroDeEdicao(`O texto em português de "${chave}" perdeu ${faltaPt.join(', ')}. Os trechos entre chaves precisam continuar na frase.`);
      if (faltaEn.length) throw new ErroDeEdicao(`O texto em inglês de "${chave}" perdeu ${faltaEn.join(', ')}. Os trechos entre chaves precisam continuar na frase.`);
    }
    dicionario.textos[chave] = { pt, en };
  }
  return dicionario;
}

/** Quantos textos de interface mudaram entre duas versões do dicionário. */
export function mudancasDeInterface(antes: Interface, depois: Interface): number {
  return Object.entries(depois.textos).filter(([chave, par]) => {
    const era = antes.textos[chave];
    return !era || era.pt !== par.pt || (era.en || null) !== (par.en || null);
  }).length;
}

/** Nome da página pública, para a barra da prévia. */
export const NOME_DA_PAGINA: Record<Pagina, string> = {
  metodologia: 'Visão Geral',
  index: 'Panorama',
  metas: 'Metas e indicadores',
  projetos: 'Projetos'
};
