// A tabela de valores vista pela administração: quais códigos existem (os do
// catálogo e os do Panorama), como uma grade estados × anos vira linhas do
// CSV e como um lote importado (XLSX ou JSON) é comparado com o que está lá.
import { chaveDaLinha, type LinhaCsv } from './mesclar';
import { ErroDeEdicao, hoje } from './edicao';

export interface Codigo {
  codigo: string;
  nome: string;
  grupo: string;
  unidade?: string;
}

interface Catalogo { eixos: { numero: number; nome: string; indicadores: { codigo: string; nome: string; unidade: string }[] }[] }
interface Panorama {
  estados: Record<string, { name: string }>;
  denominadores: { area: string; populacao: string };
  metricas: { chave: string; tipo: string; codigo?: string; bruto?: string; serieDireta?: string; rotulo?: string }[];
}

/** Todos os códigos que podem ter valores, com nome e grupo para a lista. */
export function codigosDisponiveis(catalogo: Catalogo, panorama: Panorama): Codigo[] {
  const saida: Codigo[] = [];
  for (const eixo of catalogo.eixos) {
    for (const indicador of eixo.indicadores) saida.push({ codigo: indicador.codigo, nome: indicador.nome, unidade: indicador.unidade, grupo: `Eixo ${eixo.numero} · ${eixo.nome}` });
  }
  const vistos = new Set<string>();
  const panoramaCodigo = (codigo: string, nome: string, unidade?: string) => {
    if (vistos.has(codigo)) return;
    vistos.add(codigo);
    saida.push({ codigo, nome, unidade, grupo: 'Panorama (mapa e síntese)' });
  };
  panoramaCodigo(panorama.denominadores.area, 'Área do estado', 'km²');
  panoramaCodigo(panorama.denominadores.populacao, 'População do estado', 'pessoas');
  for (const metrica of panorama.metricas) {
    const rotulo = metrica.rotulo || metrica.chave;
    if (metrica.tipo === 'taxa') {
      if (metrica.bruto) panoramaCodigo(metrica.bruto, `${rotulo} — valor bruto`);
      if (metrica.serieDireta) panoramaCodigo(metrica.serieDireta, `${rotulo} — série já em taxa`);
    } else {
      panoramaCodigo(metrica.codigo || metrica.chave, rotulo);
    }
  }
  return saida;
}

export const ufsDe = (panorama: Panorama) => Object.keys(panorama.estados);

// ---------- grade ----------

export interface Grade {
  anos: string[];
  campos: string[];
  celulas: Record<string, string>; // chave "campo|uf|ano" → texto
  notas: Record<string, string>;
}

export function montaGrade(linhas: LinhaCsv[], codigo: string): Grade {
  const grade: Grade = { anos: [], campos: [], celulas: {}, notas: {} };
  const anos = new Set<string>();
  const campos = new Set<string>();
  for (const linha of linhas) {
    if (linha.codigo !== codigo) continue;
    if (linha.ano) anos.add(linha.ano);
    if (linha.campo) campos.add(linha.campo);
    grade.celulas[`${linha.campo || ''}|${linha.uf}|${linha.ano || ''}`] = linha.valor;
    if (linha.nota) grade.notas[`${linha.campo || ''}|${linha.uf}|${linha.ano || ''}`] = linha.nota;
  }
  grade.anos = [...anos].sort();
  grade.campos = [...campos].sort();
  return grade;
}

export function validaAno(ano: string): string {
  const limpo = String(ano || '').trim();
  if (!limpo) return '';
  if (!/^\d{4}$/.test(limpo) || Number(limpo) < 1900 || Number(limpo) > 2100) throw new ErroDeEdicao(`Ano inválido: "${ano}".`);
  return limpo;
}

export function normalizaValor(texto: string): string {
  const limpo = String(texto ?? '').trim();
  if (limpo === '') return '';
  // Vírgula decimal (1.234,5 ou 12,5) vira ponto, e os pontos de milhar saem.
  // Sem vírgula, o ponto é decimal: "4.116" é quatro vírgula cento e dezesseis,
  // não quatro mil — a tabela tem muitos valores com três casas.
  if (/^-?[\d.]+,\d+$/.test(limpo)) return limpo.replace(/\./g, '').replace(',', '.');
  return limpo;
}

/**
 * Aplica as células enviadas pela grade de um código sobre as linhas da
 * versão lida. Célula vazia remove a linha, salvo se ela já existia vazia
 * (um nulo registrado de propósito), que fica.
 */
export function aplicaGrade(linhas: LinhaCsv[], codigo: string, celulas: Record<string, string>, ufs: string[], autor: string): { linhas: LinhaCsv[]; alteradas: number } {
  const porChave = new Map(linhas.map((linha) => [chaveDaLinha(linha), linha]));
  let alteradas = 0;
  for (const [chave, bruto] of Object.entries(celulas)) {
    const [campo, uf, anoBruto] = chave.split('|');
    if (!ufs.includes(uf)) throw new ErroDeEdicao(`Estado desconhecido: ${uf}.`);
    const ano = validaAno(anoBruto);
    const valor = normalizaValor(bruto);
    const chaveLinha = `${codigo}|${campo || ''}|${uf}|${ano}`;
    const existente = porChave.get(chaveLinha);
    if (valor === '') {
      if (existente && existente.valor !== '') {
        porChave.delete(chaveLinha);
        alteradas += 1;
      }
      continue;
    }
    if (existente && existente.valor === valor) continue;
    porChave.set(chaveLinha, { codigo, campo: campo || '', uf, ano, valor, origem: 'manual', atualizadoEm: hoje(), por: autor, nota: existente?.nota || '' });
    alteradas += 1;
  }
  return { linhas: [...porChave.values()], alteradas };
}

// ---------- importação ----------

export interface LinhaImportada {
  codigo: string;
  campo?: string;
  uf: string;
  ano?: string | number;
  valor?: string | number | null;
  nota?: string;
}

export interface Diferenca {
  chave: string;
  codigo: string;
  campo: string;
  uf: string;
  ano: string;
  antes: string | null;
  depois: string;
  situacao: 'nova' | 'alterada' | 'igual' | 'invalida';
  aviso?: string;
}

/** Limpa e valida um lote importado; devolve as linhas boas e os problemas. */
export function normalizaLote(bruto: unknown, codigosConhecidos: Set<string>, ufs: string[], origem: 'manual' | 'script' = 'manual'): { linhas: LinhaCsv[]; problemas: string[] } {
  if (!Array.isArray(bruto)) throw new ErroDeEdicao('Esperava uma lista de linhas (codigo, campo, uf, ano, valor).');
  const linhas: LinhaCsv[] = [];
  const problemas: string[] = [];
  bruto.forEach((item, indice) => {
    const numero = indice + 2;
    const registro = (item || {}) as LinhaImportada;
    const codigo = String(registro.codigo ?? '').trim();
    const uf = String(registro.uf ?? '').trim().toUpperCase();
    const campo = String(registro.campo ?? '').trim();
    let ano = '';
    try {
      ano = validaAno(registro.ano === null || registro.ano === undefined ? '' : String(registro.ano).replace(/\.0$/, ''));
    } catch (erro) {
      problemas.push(`linha ${numero}: ${(erro as Error).message}`);
      return;
    }
    if (!codigo) { problemas.push(`linha ${numero}: sem código`); return; }
    if (!codigosConhecidos.has(codigo)) { problemas.push(`linha ${numero}: código desconhecido "${codigo}"`); return; }
    if (!ufs.includes(uf)) { problemas.push(`linha ${numero}: estado desconhecido "${registro.uf}"`); return; }
    const valor = registro.valor === null || registro.valor === undefined ? '' : normalizaValor(String(registro.valor));
    linhas.push({ codigo, campo, uf, ano, valor, origem, atualizadoEm: hoje(), por: '', nota: String(registro.nota ?? '').trim() });
  });
  return { linhas, problemas };
}

/** Compara um lote com as linhas atuais, célula a célula. */
export function comparaLote(lote: LinhaCsv[], atuais: LinhaCsv[]): Diferenca[] {
  const porChave = new Map(atuais.map((linha) => [chaveDaLinha(linha), linha]));
  const seriePorCodigo = new Map<string, Map<string, number>>();
  for (const linha of atuais) {
    if (!linha.ano || linha.campo) continue;
    const numero = Number(linha.valor);
    if (!Number.isFinite(numero)) continue;
    const chave = `${linha.codigo}|${linha.uf}`;
    if (!seriePorCodigo.has(chave)) seriePorCodigo.set(chave, new Map());
    seriePorCodigo.get(chave)!.set(linha.ano, numero);
  }
  return lote.map((linha) => {
    const chave = chaveDaLinha(linha);
    const existente = porChave.get(chave);
    const base: Diferenca = { chave, codigo: linha.codigo, campo: linha.campo, uf: linha.uf, ano: linha.ano, antes: existente ? existente.valor : null, depois: linha.valor, situacao: 'nova' };
    if (existente) base.situacao = existente.valor === linha.valor ? 'igual' : 'alterada';
    // Aviso, não bloqueio: variação grande contra o ano anterior da série. Só
    // para o que muda — o que já está gravado igual não precisa de alerta.
    const numero = Number(linha.valor);
    if (base.situacao !== 'igual' && linha.ano && !linha.campo && Number.isFinite(numero)) {
      const serie = seriePorCodigo.get(`${linha.codigo}|${linha.uf}`);
      const anterior = serie ? [...serie.entries()].filter(([ano]) => ano < linha.ano).sort().at(-1) : null;
      if (anterior && anterior[1] !== 0 && Math.abs(numero - anterior[1]) / Math.abs(anterior[1]) > 0.5) {
        base.aviso = `varia mais de 50% em relação a ${anterior[0]} (${anterior[1]})`;
      }
    }
    return base;
  });
}

/** Aplica um lote sobre as linhas da versão lida: cada linha do lote substitui a célula. */
export function aplicaLote(linhas: LinhaCsv[], lote: LinhaCsv[], autor: string): { linhas: LinhaCsv[]; alteradas: number } {
  const porChave = new Map(linhas.map((linha) => [chaveDaLinha(linha), linha]));
  let alteradas = 0;
  for (const linha of lote) {
    const chave = chaveDaLinha(linha);
    const existente = porChave.get(chave);
    if (existente && existente.valor === linha.valor && (!linha.nota || existente.nota === linha.nota)) continue;
    porChave.set(chave, { ...linha, por: autor, nota: linha.nota || existente?.nota || '' });
    alteradas += 1;
  }
  return { linhas: [...porChave.values()], alteradas };
}
