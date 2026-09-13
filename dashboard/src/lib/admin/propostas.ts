// Propostas dos scripts de coleta: leitura, comparação com a tabela de
// valores, aceitação (parcial ou total) e rejeição. Aceitar grava as células
// escolhidas em valores.csv com origem `script` e move o arquivo para
// `aplicadas/`, no mesmo commit; rejeitar move para `rejeitadas/`.
import { deposito, type Autor } from './deposito';
import { ErroDeEdicao, leJson, leValores, salvaValores } from './edicao';
import { aplicaLote, codigosDisponiveis, comparaLote, normalizaLote, ufsDe, type Diferenca } from './valores';
import type { LinhaCsv } from './mesclar';

export const PASTA_PROPOSTAS = 'conteudo/propostas';

export interface PropostaDados {
  id: string;
  geradoEm: string;
  script: string;
  fonte?: string;
  descricao?: string;
  valores: unknown[];
}

export interface Proposta {
  nome: string;
  caminho: string;
  dados: PropostaDados;
  versao: string;
}

const nomeSeguro = (nome: string) => /^[\w.-]+\.json$/.test(nome) && !nome.includes('..');

export async function leProposta(nome: string): Promise<Proposta> {
  if (!nomeSeguro(nome)) throw new ErroDeEdicao('Nome de proposta inválido.');
  const caminho = `${PASTA_PROPOSTAS}/${nome}`;
  const { texto, versao } = await deposito().le(caminho);
  const dados = JSON.parse(texto) as PropostaDados;
  if (!Array.isArray(dados.valores)) throw new ErroDeEdicao('A proposta não tem a lista `valores`.');
  return { nome, caminho, dados, versao };
}

export interface Comparacao {
  linhas: LinhaCsv[];
  problemas: string[];
  diferencas: Diferenca[];
  versaoValores: string;
}

/** As células da proposta comparadas com a tabela atual. */
export async function comparaProposta(proposta: Proposta): Promise<Comparacao> {
  const [{ dados: catalogo }, { dados: panorama }, atuais] = await Promise.all([leJson<any>('catalogo'), leJson<any>('panorama'), leValores()]);
  const codigos = new Set(codigosDisponiveis(catalogo, panorama).map((item) => item.codigo));
  const { linhas, problemas } = normalizaLote(proposta.dados.valores, codigos, ufsDe(panorama), 'script');
  return { linhas, problemas, diferencas: comparaLote(linhas, atuais.dados), versaoValores: atuais.versao };
}

function textoDoArquivo(proposta: Proposta, extra: Record<string, unknown>) {
  return `${JSON.stringify({ ...proposta.dados, ...extra }, null, 2)}\n`;
}

/** Aceita as células cujas chaves estão em `chaves` (todas, se vazio). */
export async function aceitaProposta(proposta: Proposta, chaves: Set<string>, versaoValores: string, autor: Autor): Promise<number> {
  const { linhas, problemas } = await comparaProposta(proposta);
  const escolhidas = chaves.size ? linhas.filter((linha) => chaves.has(`${linha.codigo}|${linha.campo || ''}|${linha.uf}|${linha.ano || ''}`)) : linhas;
  if (!escolhidas.length) throw new ErroDeEdicao('Nenhuma célula selecionada.');
  if (problemas.length && !chaves.size) throw new ErroDeEdicao(`A proposta tem ${problemas.length} linha(s) inválida(s); aceite só as válidas, marcando-as.`);
  let alteradas = 0;
  const parcial = chaves.size > 0 && escolhidas.length < linhas.length;
  const registro = textoDoArquivo(proposta, { decisao: parcial ? 'aceita em parte' : 'aceita', decididoEm: new Date().toISOString(), por: autor.usuario, celulasAceitas: escolhidas.length });
  await salvaValores(versaoValores, (atuais) => {
    const resultado = aplicaLote(atuais, escolhidas, autor.usuario);
    alteradas = resultado.alteradas;
    return resultado.linhas;
  }, `aceita a proposta ${proposta.dados.id} (${escolhidas.length} célula(s))`, autor, [
    { caminho: proposta.caminho, texto: null },
    { caminho: `${PASTA_PROPOSTAS}/aplicadas/${proposta.nome}`, texto: registro }
  ]);
  return alteradas;
}

export async function rejeitaProposta(proposta: Proposta, motivo: string, autor: Autor): Promise<void> {
  const registro = textoDoArquivo(proposta, { decisao: 'rejeitada', decididoEm: new Date().toISOString(), por: autor.usuario, motivo: motivo || null });
  await deposito().grava([
    { caminho: proposta.caminho, texto: null },
    { caminho: `${PASTA_PROPOSTAS}/rejeitadas/${proposta.nome}`, texto: registro }
  ], `rejeita a proposta ${proposta.dados.id}`, autor);
}
