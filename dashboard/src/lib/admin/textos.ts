// Textos do painel (conteudo/textos.json): a árvore de pares { pt, en } e a
// forma de aplicar o que veio do formulário sobre ela. A tela de edição e a
// prévia ao vivo usam o mesmo caminho, então o que se vê na prévia é o que
// seria salvo.
import { ErroDeEdicao, texto, textoOuNulo } from './edicao';

export type Par = { pt: string; en?: string | null };
export type Arvore = { [chave: string]: unknown };

export const ehPar = (valor: unknown): valor is Par =>
  typeof valor === 'object' && valor !== null && 'pt' in valor && typeof (valor as Par).pt === 'string';

/** Cada folha { pt, en } com o caminho até ela, ex.: visaoGeral.temas.itens.2.titulo */
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
export interface Grupo { caminhos: string[]; secao: 'Lâminas' | 'Nota técnica'; titulo: string; descricao: string; ancora?: string }
export const GRUPOS: Grupo[] = [
  { caminhos: ['visaoGeral.estrategia'], secao: 'Lâminas', titulo: 'Lâmina 1: A Estratégia', descricao: 'Título, abertura, os três números e o fechamento.', ancora: 'a-estrategia' },
  { caminhos: ['visaoGeral.visao2050'], secao: 'Lâminas', titulo: 'Lâmina 2: Visão 2050', descricao: 'A visão regional e como a Estratégia auxilia os estados.', ancora: 'visao-2050' },
  { caminhos: ['visaoGeral.temas'], secao: 'Lâminas', titulo: 'Lâmina 3: Temas estratégicos', descricao: 'Os seis temas.', ancora: 'temas-estrategicos' },
  { caminhos: ['visaoGeral.governanca'], secao: 'Lâminas', titulo: 'Lâmina 4: Governança', descricao: 'Os seis blocos e o fluxo de implementação.', ancora: 'governanca' },
  { caminhos: ['visaoGeral.estePainel', 'panorama.metodologia.sources'], secao: 'Lâminas', titulo: 'Lâmina 5: Este painel', descricao: 'Como os dados são lidos e a lista de fontes consolidadas.', ancora: 'calculo' },
  { caminhos: ['panorama.metodologia.title', 'panorama.metodologia.text', 'panorama.metodologia.dimensions'], secao: 'Nota técnica', titulo: 'Nota técnica: síntese comparativa', descricao: 'Título, texto e dimensões da síntese comparativa. Vão para a nota técnica em PDF ("Baixar nota técnica"), que é gerada à parte; nenhuma página do painel os mostra, então a prévia não muda.' }
];

/** Se a folha em `caminho` pertence ao grupo. */
export const pertenceAoGrupo = (grupo: Grupo, caminho: string) =>
  grupo.caminhos.some((prefixo) => caminho === prefixo || caminho.startsWith(`${prefixo}.`));

// ---------- textos de interface (conteudo/interface.json) ----------

export interface Interface {
  _leia?: string;
  grupos: { titulo: string; pagina: 'index' | 'metas' | 'metodologia'; chaves: string[]; alvo?: string; abre?: string }[];
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

export function aplicaFormularioInterface(dicionario: Interface, dados: FormData, { estrito = true } = {}): Interface {
  for (const [chave, par] of Object.entries(dicionario.textos)) {
    const nome = nomeDeInterface(chave);
    if (!dados.has(nome)) continue;
    const pt = texto(dados, nome);
    const en = textoOuNulo(dados, `${nome}__en`) ?? par.en ?? null;
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

/** Nome da página pública, para a barra da prévia. */
export const NOME_DA_PAGINA: Record<Interface['grupos'][number]['pagina'], string> = {
  metodologia: 'Visão Geral',
  index: 'Panorama',
  metas: 'Metas e indicadores'
};
