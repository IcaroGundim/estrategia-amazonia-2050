// Mesclagem a três vias, para dois editores salvarem ao mesmo tempo sem um
// apagar o trabalho do outro.
//
// Quem salva manda a versão que leu (`base`); o depósito tem a versão atual
// (`atual`); a tela manda a nova (`novo`). Chave a chave: o que só um lado
// mudou entra; o que os dois mudaram do mesmo jeito entra; o que os dois
// mudaram de jeitos diferentes é conflito, apontado pelo caminho — e é só
// nesse caso que a gravação para e pede para recarregar.
//
// Listas de objetos com identidade (`codigo`, `chave`, `usuario`, `numero`)
// são mescladas pela identidade, não pela posição; listas de valores simples
// são tratadas como um valor só.

export class Conflito extends Error {
  caminhos: string[];
  constructor(caminhos: string[]) {
    super(`Conflito de edição em: ${caminhos.join(', ')}`);
    this.caminhos = caminhos;
  }
}

type Json = null | boolean | number | string | Json[] | { [chave: string]: Json };

const CHAVES_DE_IDENTIDADE = ['codigo', 'chave', 'usuario', 'numero'];

function ehObjeto(valor: unknown): valor is { [chave: string]: Json } {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

export function iguais(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, indice) => iguais(item, b[indice]));
  }
  if (ehObjeto(a) && ehObjeto(b)) {
    const chavesA = Object.keys(a);
    const chavesB = Object.keys(b);
    if (chavesA.length !== chavesB.length) return false;
    return chavesA.every((chave) => chave in b && iguais(a[chave], b[chave]));
  }
  return false;
}

function identidadeDe(lista: unknown[]): string | null {
  if (!lista.length || !lista.every(ehObjeto)) return null;
  return CHAVES_DE_IDENTIDADE.find((chave) => lista.every((item) => typeof (item as { [k: string]: Json })[chave] === 'string' || typeof (item as { [k: string]: Json })[chave] === 'number')) ?? null;
}

const AUSENTE = Symbol('ausente');
type Talvez = Json | typeof AUSENTE;

function mesclaValor(base: Talvez, atual: Talvez, novo: Talvez, caminho: string, conflitos: string[]): Talvez {
  const iguaisOuAmbosAusentes = (x: Talvez, y: Talvez) => (x === AUSENTE || y === AUSENTE ? x === y : iguais(x, y));
  if (iguaisOuAmbosAusentes(atual, base)) return novo;
  if (iguaisOuAmbosAusentes(novo, base)) return atual;
  if (iguaisOuAmbosAusentes(novo, atual)) return novo;
  if (ehObjeto(atual) && ehObjeto(novo) && (ehObjeto(base) || base === AUSENTE)) {
    return mesclaObjeto(base === AUSENTE ? {} : (base as { [k: string]: Json }), atual, novo, caminho, conflitos);
  }
  if (Array.isArray(atual) && Array.isArray(novo) && (Array.isArray(base) || base === AUSENTE)) {
    const chave = identidadeDe([...atual, ...novo]);
    if (chave) return mesclaLista(base === AUSENTE ? [] : (base as Json[]), atual, novo, chave, caminho, conflitos);
  }
  conflitos.push(caminho);
  return atual;
}

function mesclaObjeto(base: { [k: string]: Json }, atual: { [k: string]: Json }, novo: { [k: string]: Json }, caminho: string, conflitos: string[]): { [k: string]: Json } {
  const saida: { [k: string]: Json } = {};
  const chaves = [...new Set([...Object.keys(atual), ...Object.keys(novo), ...Object.keys(base)])];
  for (const chave of chaves) {
    const resultado = mesclaValor(
      chave in base ? base[chave] : AUSENTE,
      chave in atual ? atual[chave] : AUSENTE,
      chave in novo ? novo[chave] : AUSENTE,
      caminho ? `${caminho}.${chave}` : chave,
      conflitos
    );
    if (resultado !== AUSENTE) saida[chave] = resultado;
  }
  return saida;
}

function mesclaLista(base: Json[], atual: Json[], novo: Json[], chave: string, caminho: string, conflitos: string[]): Json[] {
  const id = (item: Json) => String((item as { [k: string]: Json })[chave]);
  const mapa = (lista: Json[]) => new Map(lista.map((item) => [id(item), item]));
  const mBase = mapa(base);
  const mAtual = mapa(atual);
  const mNovo = mapa(novo);
  // A ordem segue a lista nova; itens que só o outro lado acrescentou entram no fim.
  const ordem = [...new Set([...novo.map(id), ...atual.map(id)])];
  const saida: Json[] = [];
  for (const identidade of ordem) {
    const resultado = mesclaValor(mBase.get(identidade) ?? AUSENTE, mAtual.get(identidade) ?? AUSENTE, mNovo.get(identidade) ?? AUSENTE, `${caminho}[${identidade}]`, conflitos);
    if (resultado !== AUSENTE) saida.push(resultado);
  }
  return saida;
}

/** Mescla três versões de um JSON. Lança `Conflito` quando os dois lados mudaram a mesma coisa. */
export function mesclaJson<T extends Json>(base: T, atual: T, novo: T): T {
  const conflitos: string[] = [];
  const resultado = mesclaValor(base, atual, novo, '', conflitos);
  if (conflitos.length) throw new Conflito(conflitos);
  return resultado as T;
}

// ---------- CSV de valores ----------

export type LinhaCsv = { [coluna: string]: string };

export const chaveDaLinha = (linha: LinhaCsv) => `${linha.codigo}|${linha.campo || ''}|${linha.uf}|${linha.ano || ''}`;

function porChave(linhas: LinhaCsv[]): { [chave: string]: Json } {
  const saida: { [chave: string]: Json } = {};
  for (const linha of linhas) saida[chaveDaLinha(linha)] = { ...linha };
  return saida;
}

/** Mescla três versões da tabela de valores, célula a célula. */
export function mesclaLinhas(base: LinhaCsv[], atual: LinhaCsv[], novo: LinhaCsv[]): LinhaCsv[] {
  const resultado = mesclaJson(porChave(base), porChave(atual), porChave(novo));
  return Object.values(resultado) as LinhaCsv[];
}
