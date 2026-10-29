// Prioridades dos Estados: os projetos que as SEPLANs indicaram para a Estratégia
// (conteudo/prioridades.json) e as regras para mostrá-los na aba Projetos sem
// repetir texto: o número da linha de ação e o eixo não são mostrados, o entrave
// vira uma frase só, a maturidade não repete a situação e o texto igual em mais
// de um projeto do estado aparece uma vez, numa nota acima das colunas.
import dados from '../../conteudo/prioridades.json';

export interface Prioridade {
  uf: string; estado: string; eixo: number; linha: string; projeto: string; resultado: string;
  situacao: string; avancos: string; cortado: boolean; maturidade: string; financiamento: string;
  entrave: string; entraveTexto: string; entraveFinanceiro: string;
}
export const PRIORIDADES = dados.itens as Prioridade[];
export const ATUALIZADO = dados.atualizado;

/** Da mais adiantada à sem informação: é a ordem das colunas e da navegação. */
export const SITUACOES = ['Em conclusão', 'Em execução', 'Em elaboração', 'Não iniciada', 'Sem informação'];
export const COR_SITUACAO: Record<string, string> = { 'Em conclusão': '#0e2b22', 'Em execução': '#4f9a76', 'Em elaboração': '#e0a83c', 'Não iniciada': '#a59a8c', 'Sem informação': '#d8cfc1' };

// ---------- fotos dos projetos ----------
// Uma por projeto, na ordem das colunas de cada estado. Escolhidas no Flickr do
// MTur (domínio público, sem aviso de prazo, conferidas uma a uma), reduzidas
// para public/photos/prioridades. A foto do alto de cada estado é a mesma da
// Visão Geral (ESTADOS em visao-geral.ts). Créditos em public/photos/CREDITS.md.
export interface FotoProjeto { arquivo: string; lugar: string; autor: string; url: string }
const f = (arquivo: string, id: string, lugar: string, autor: string): FotoProjeto =>
  ({ arquivo: `/photos/prioridades/${arquivo}`, lugar, autor: `${autor}/MTur`, url: `https://www.flickr.com/photos/mturdestinos/${id}/` });
export const FOTOS_DOS_PROJETOS: Record<string, FotoProjeto[]> = {
  AC: [f('ac-rio-branco-40628480905.webp', '40628480905', 'Rio Branco (AC)', 'Assis Lima'), f('ac-rio-acre-40821853872.webp', '40821853872', 'Rio Acre, Rio Branco (AC)', 'Marcos Vicentti'), f('ac-rio-branco-40821849432.webp', '40821849432', 'Rio Branco (AC)', 'Assis Lima')],
  AP: [f('ap-curiau-26099519377.webp', '26099519377', 'Quilombo do Curiaú, Macapá (AP)', 'Márcia do Carmo'), f('ap-orla-araxa-27099885948.webp', '27099885948', 'Orla do Araxá, Macapá (AP)', 'Márcia do Carmo'), f('ap-feira-acai-26099441497.webp', '26099441497', 'Feira de Macapá, Macapá (AP)', 'Márcia do Carmo')],
  AM: [f('am-barcelos-40263808814.webp', '40263808814', 'Arquipélago de Mariuá, Barcelos (AM)', 'Ana Claudia Jatahy'), f('am-presidente-figueiredo-40624473760.webp', '40624473760', 'Cachoeira de Lages, Presidente Figueiredo (AM)', 'Mário Oliveira')],
  MA: [f('ma-carolina-chapada-das-mesas-27184853988.webp', '27184853988', 'Chapada das Mesas, Carolina (MA)', 'Jhonatha Conection'), f('ma-carolina-cachoeira-do-itapecuru-27184875678.webp', '27184875678', 'Cachoeiras do Itapecuru, Carolina (MA)', 'Jhonatha Conection'), f('ma-carolina-pedra-caida-41014294122.webp', '41014294122', 'Complexo Pedra Caída, Carolina (MA)', 'Jhonatha Conection')],
  MT: [f('mt-pantanal-pocone-41556754631.webp', '41556754631', 'Pantanal, Poconé (MT)', 'Flávio André'), f('mt-pantanal-aerea-pocone-40958332021.webp', '40958332021', 'Pantanal, Poconé (MT)', 'Flávio André'), f('mt-jaciara-vista-aerea-40261040724.webp', '40261040724', 'Jaciara (MT)', 'Flávio André')],
  PA: [f('pa-belem-40347783444.webp', '40347783444', 'Mangal das Garças, Belém (PA)', 'Bruna Brandão'), f('pa-soure-40266763834.webp', '40266763834', 'Fazenda Bom Jesus, Soure (PA)', 'Bruna Brandão'), f('pa-belem-41014553382.webp', '41014553382', 'Bosque Rodrigues Alves, Belém (PA)', 'Bruna Brandão')],
  RO: [f('ro-jaci-parana-39734190340.webp', '39734190340', 'Jaci-Paraná, Porto Velho (RO)', 'Silva Júnior'), f('ro-abuna-26057389747.webp', '26057389747', 'Abunã, Porto Velho (RO)', 'Silva Júnior'), f('ro-jaci-parana-26057349517.webp', '26057349517', 'Jaci-Paraná, Porto Velho (RO)', 'Silva Júnior'), f('ro-porto-velho-40930823011.webp', '40930823011', 'Feira Tradicional, Porto Velho (RO)', 'Henrique Fotógrafo'), f('ro-porto-velho-40222134384.webp', '40222134384', 'Espaço Alternativo, Porto Velho (RO)', 'Henrique Fotógrafo'), f('ro-porto-velho-40221825784.webp', '40221825784', 'Catedral Metropolitana, Porto Velho (RO)', 'Silva Júnior'), f('ro-porto-velho-27058988888.webp', '27058988888', 'Porto Velho (RO)', 'Silva Júnior'), f('ro-porto-velho-40036382985.webp', '40036382985', 'Rio Madeira, Porto Velho (RO)', 'Silva Júnior'), f('ro-porto-velho-40222011644.webp', '40222011644', 'Feira Tradicional, Porto Velho (RO)', 'Henrique Fotógrafo'), f('ro-porto-velho-40931009551.webp', '40931009551', 'Casa do Artesão, Porto Velho (RO)', 'Henrique Fotógrafo'), f('ro-porto-velho-40888504072.webp', '40888504072', "Três Caixas d'Água, Porto Velho (RO)", 'Silva Júnior')],
  RR: [f('rr-igarape-agua-boa-39266636780.webp', '39266636780', 'Igarapé Água Boa, Boa Vista (RR)', 'Ederson Brito'), f('rr-boa-vista-rio-branco-39266552420.webp', '39266552420', 'Margem do rio Branco, Boa Vista (RR)', 'Ederson Brito')],
  TO: [f('to-palmas-26667449997.webp', '26667449997', 'Praça dos Girassóis, Palmas (TO)', 'Flávio André'), f('to-mateiros-40395840674.webp', '40395840674', 'Cachoeira da Velha, Mateiros (TO)', 'Flávio André'), f('to-mateiros-40395839124.webp', '40395839124', 'Mateiros (TO)', 'Flávio André')]
};

// ---------- texto sem repetição ----------
// O entrave numa frase inteira (a ordem das palavras muda em inglês, por isso a
// frase vai pronta para o dicionário, e não montada em pedaços).
const FRASE_DO_ENTRAVE: Record<string, [string, string]> = {
  'Financeiro (recursos insuficientes)': ['Entrave financeiro', 'Entrave financeiro'],
  'Técnico (capacidade ou projeto)': ['Entrave técnico', 'Entrave técnico e financeiro'],
  'Institucional / político': ['Entrave institucional e político', 'Entrave institucional, político e financeiro'],
  'Licenciamento / questão fundiária': ['Entrave de licenciamento e fundiário', 'Entrave de licenciamento, fundiário e financeiro']
};
/** A frase do entrave (chave do dicionário) e se ela fala de dinheiro; null quando não há o que dizer. */
export function fraseDoEntrave(p: Prioridade): { frase: string; financeiro: boolean } | null {
  const fin = p.entraveFinanceiro === 'Sim';
  if (p.entrave === 'Sem entraves') return { frase: 'Sem entraves', financeiro: false };
  if (p.entrave) { const [so, comFin] = FRASE_DO_ENTRAVE[p.entrave]; return { frase: fin ? comFin : so, financeiro: fin || so === 'Entrave financeiro' }; }
  // o texto do estado aparece inteiro quando o projeto abre; aqui só o "financeiro", se houver
  if (p.entraveTexto && fin) return { frase: 'Entrave financeiro', financeiro: true };
  return null;
}
/** Maturidade sem repetir a situação, e o financiamento longo só com a primeira frase (o resto vai no projeto aberto). */
export function maturidadeCurta(p: Prioridade): { curto: string; resto: string } {
  const m = p.maturidade && p.maturidade !== p.situacao ? p.maturidade : '';
  let fin = p.financiamento || '', resto = '';
  const frases = fin.split(/(?<=\.)\s+(?=[A-ZÀ-Ú]|R\$)/);
  if (frases.length > 1) { fin = frases[0].replace(/\.$/, ''); resto = frases.slice(1).join(' '); }
  if (m && /^[A-ZÀ-Ú][a-zà-ú]/.test(fin)) fin = fin.charAt(0).toLowerCase() + fin.slice(1);   // "Em captação" → "em captação"; "R$" fica
  return { curto: [m, fin].filter(Boolean).join(', '), resto };
}
/** Os avanços em parágrafos, quebrando nos marcadores que a planilha usa ("Resultado 1:", "a)", "b.1)", "*"). */
export const paragrafos = (texto: string) =>
  texto.split(/\s(?=Resultado \d+\s*[:–-]|[a-f]\)\s|[a-f]\.\d\)\s|\*\s?[A-ZÀ-Ú])/).map((s) => s.trim()).filter(Boolean);

/** Os projetos de um estado na ordem das colunas, e o texto repetido entre eles. */
export function doEstado(uf: string) {
  const lista = PRIORIDADES.filter((p) => p.uf === uf);
  const situacoes = SITUACOES.filter((s) => lista.some((p) => p.situacao === s));
  const ordem = situacoes.flatMap((s) => lista.filter((p) => p.situacao === s));
  const repetidos: { campo: 'resultado' | 'avancos'; texto: string; projetos: Prioridade[] }[] = [];
  for (const campo of ['resultado', 'avancos'] as const) {
    const grupos = new Map<string, Prioridade[]>();
    for (const p of lista) if (p[campo]) grupos.set(p[campo], [...(grupos.get(p[campo]) || []), p]);
    for (const [texto, projetos] of grupos) if (projetos.length > 1) repetidos.push({ campo, texto, projetos });
  }
  const fora = { resultado: new Set(repetidos.filter((r) => r.campo === 'resultado').map((r) => r.texto)), avancos: new Set(repetidos.filter((r) => r.campo === 'avancos').map((r) => r.texto)) };
  return { lista, situacoes, ordem, repetidos, fora };
}
/** O nome curto do projeto para a nota de texto repetido ("SANGUE.RO – Sistema…" → "SANGUE.RO"). */
export const nomeCurto = (p: Prioridade) => p.projeto.split(/ [–-] /)[0];
