// Leitura e gravação dos arquivos de `conteudo/` pelas telas de edição.
//
// Toda gravação passa pelo mesmo caminho: lê a versão atual no depósito,
// aplica a mudança da tela sobre a versão que a tela leu, mescla as duas se
// alguém gravou no meio, valida a fonte inteira com as regras do build e só
// então commita. Erro de validação ou conflito volta para a tela como
// mensagem, sem gravar nada.
import { indexaValores, ordenaValores, parseCsv, serializaCsv, validaFonte } from '../../../pipeline/fonte.mjs';
import { deposito, type Autor, type OpcoesDeLeitura, type Versao } from './deposito';
import { Conflito, mesclaJson, mesclaLinhas, type LinhaCsv } from './mesclar';

export const ARQUIVOS = {
  catalogo: 'conteudo/catalogo.json',
  metas: 'conteudo/metas.json',
  panorama: 'conteudo/panorama.json',
  textos: 'conteudo/textos.json',
  interface: 'conteudo/interface.json',
  painel: 'conteudo/painel.json',
  fichas: 'conteudo/fichas.json',
  usuarios: 'conteudo/usuarios.json',
  valores: 'conteudo/valores.csv'
} as const;

export type NomeDeJson = Exclude<keyof typeof ARQUIVOS, 'valores'>;

export class ErroDeEdicao extends Error {}

export interface Lido<T> {
  dados: T;
  versao: string;
}

export async function leJson<T>(nome: NomeDeJson, opcoes?: OpcoesDeLeitura): Promise<Lido<T>> {
  const { texto, versao } = await deposito().le(ARQUIVOS[nome], opcoes);
  return { dados: JSON.parse(texto) as T, versao };
}

export async function leValores(): Promise<Lido<LinhaCsv[]>> {
  const { texto, versao } = await deposito().le(ARQUIVOS.valores);
  return { dados: parseCsv(texto) as LinhaCsv[], versao };
}

const serializaJson = (dados: unknown) => `${JSON.stringify(dados, null, 2)}\n`;

// A fonte inteira, como o build a vê, para validar uma gravação antes de fazê-la.
async function fonteCompleta(substituicoes: Partial<Record<keyof typeof ARQUIVOS, unknown>>) {
  const nomes = Object.keys(ARQUIVOS) as (keyof typeof ARQUIVOS)[];
  const lidos = await Promise.all(nomes.map(async (nome) => {
    if (nome in substituicoes) return [nome, substituicoes[nome]] as const;
    const { texto } = await deposito().le(ARQUIVOS[nome]);
    return [nome, nome === 'valores' ? parseCsv(texto) : JSON.parse(texto)] as const;
  }));
  const fonte = Object.fromEntries(lidos) as Record<keyof typeof ARQUIVOS, any>;
  const linhas = fonte.valores as LinhaCsv[];
  const ufs = Object.keys(fonte.panorama.estados);
  return { ...fonte, linhas, ufs, valores: indexaValores(linhas) };
}

async function descreveConflito(conflito: Conflito): Promise<string> {
  let quem = 'outra pessoa';
  try {
    const estado = await deposito().estado();
    if (estado.head) {
      const minutos = Math.max(0, Math.round((Date.now() - new Date(estado.head.data).getTime()) / 60000));
      quem = `${estado.head.autor} (há ${minutos} min)`;
    }
  } catch {
    // sem estado, a mensagem genérica basta
  }
  const itens = conflito.caminhos.slice(0, 5).join(', ');
  return `${quem} alterou o mesmo que você — ${itens}${conflito.caminhos.length > 5 ? ' e mais' : ''} — depois que esta tela foi aberta. Nada foi gravado. Recarregue a página e refaça a mudança.`;
}

async function versaoBase<T>(caminho: string, versao: string, atual: Versao, converte: (texto: string) => T): Promise<T> {
  if (versao === atual.versao) return converte(atual.texto);
  const texto = await deposito().leVersao(caminho, versao);
  if (texto === null) throw new ErroDeEdicao('Não encontrei a versão que esta tela leu; recarregue a página e refaça a mudança.');
  return converte(texto);
}

/**
 * Grava um JSON de `conteudo/`. `aplica` recebe uma cópia do documento na
 * versão que a tela leu e devolve o documento alterado.
 */
export async function salvaJson<T>(nome: NomeDeJson, versao: string, aplica: (doc: T) => T, mensagem: string, autor: Autor): Promise<string> {
  const caminho = ARQUIVOS[nome];
  const atual = await deposito().le(caminho);
  const atualDoc = JSON.parse(atual.texto) as T;
  const baseDoc = await versaoBase(caminho, versao, atual, (texto) => JSON.parse(texto) as T);
  const novoDoc = aplica(structuredClone(baseDoc));
  let finalDoc: T;
  try {
    finalDoc = versao === atual.versao ? novoDoc : mesclaJson(baseDoc as any, atualDoc as any, novoDoc as any);
  } catch (erro) {
    if (erro instanceof Conflito) throw new ErroDeEdicao(await descreveConflito(erro));
    throw erro;
  }
  await valida({ [nome]: finalDoc });
  return deposito().grava([{ caminho, texto: serializaJson(finalDoc) }], mensagem, autor);
}

/** Grava a tabela de valores. `aplica` recebe as linhas da versão lida e devolve as novas. */
export async function salvaValores(versao: string, aplica: (linhas: LinhaCsv[]) => LinhaCsv[], mensagem: string, autor: Autor, extras: { caminho: string; texto: string | null }[] = []): Promise<string> {
  const caminho = ARQUIVOS.valores;
  const atual = await deposito().le(caminho);
  const atualLinhas = parseCsv(atual.texto) as LinhaCsv[];
  const baseLinhas = await versaoBase(caminho, versao, atual, (texto) => parseCsv(texto) as LinhaCsv[]);
  const novasLinhas = aplica(structuredClone(baseLinhas));
  let finais: LinhaCsv[];
  try {
    finais = versao === atual.versao ? novasLinhas : mesclaLinhas(baseLinhas, atualLinhas, novasLinhas);
  } catch (erro) {
    if (erro instanceof Conflito) throw new ErroDeEdicao(await descreveConflito(erro));
    throw erro;
  }
  const fonte = await valida({ valores: finais });
  return deposito().grava([{ caminho, texto: serializaCsv(ordenaValores(finais, fonte.ufs)) }, ...extras], mensagem, autor);
}

async function valida(substituicoes: Partial<Record<keyof typeof ARQUIVOS, unknown>>) {
  const fonte = await fonteCompleta(substituicoes);
  try {
    validaFonte(fonte);
  } catch (erro) {
    throw new ErroDeEdicao(`A mudança não passou na validação: ${(erro as Error).message.replace(/^conteudo\/: /, '')}`);
  }
  return fonte;
}

// ---------- ajudantes de formulário ----------

export const texto = (dados: FormData, nome: string) => String(dados.get(nome) ?? '').trim();
export const textoOuNulo = (dados: FormData, nome: string) => texto(dados, nome) || null;
export function numeroOuNulo(dados: FormData, nome: string): number | null {
  const valor = texto(dados, nome).replace(',', '.');
  if (valor === '') return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) throw new ErroDeEdicao(`"${nome}" precisa ser um número; recebi "${texto(dados, nome)}".`);
  return numero;
}
export const hoje = () => new Date().toISOString().slice(0, 10);
