// A Visão Geral tem dois estilos, com os mesmos textos (conteudo/textos.json):
//
//   'editorial' — página corrida, com as fotografias do MTur incorporadas às
//                 seções (PaginaVisaoGeralEditorial.astro). É o padrão.
//   'laminas'   — o carrossel de cinco lâminas (PaginaVisaoGeral.astro),
//                 guardado para poder voltar.
//
// Trocar aqui troca nas duas línguas e na prévia da administração.
export type EstiloVisaoGeral = 'editorial' | 'laminas';
export const ESTILO_VISAO_GERAL: EstiloVisaoGeral = 'editorial';

/** A classe do <main> de cada estilo: os estilos das lâminas vivem sob `.methodology-page`. */
export const CLASSE_DO_MAIN: Record<EstiloVisaoGeral, string> = {
  editorial: 've-main',
  laminas: 'methodology-page'
};

// ---------- fotografias da Visão Geral editorial ----------
// Todas em public/photos/visao-geral, reduzidas a partir do original. O lugar e
// o autor não se traduzem (topônimo e nome próprio). Créditos e licenças em
// public/photos/CREDITS.md.
export interface Foto { arquivo: string; lugar: string; autor: string; url: string }

const mtur = (id: string, arquivo: string, lugar: string, autor: string): Foto =>
  ({ arquivo: `/photos/visao-geral/${arquivo}`, lugar, autor: `${autor}/MTur`, url: `https://www.flickr.com/photos/mturdestinos/${id}/` });

export const FOTOS = {
  topo: mtur('39164465870', 'barcelos-parque-nacional-39164465870.webp', 'Parque Nacional, Barcelos (AM)', 'Ana Claudia Jatahy'),
  visao: mtur('40163460135', 'combu-belem-40163460135.webp', 'Ilha do Combu, Belém (PA)', 'Bruna Brandão'),
  governanca: mtur('40993767631', 'chapada-cidade-de-pedra-40993767631.webp', 'Chapada dos Guimarães (MT)', 'Flávio André'),
  governancaFundo: mtur('40064777855', 'pantanal-pocone-40064777855.webp', 'Pantanal, Poconé (MT)', 'Flávio André'),
  ipam: mtur('39167467930', 'soure-guaras-39167467930.webp', 'Fazenda Bom Jesus, Soure (PA)', 'Bruna Brandão'),
  explorar: mtur('40064981205', 'flona-tapajos-40064981205.webp', 'Flona do Tapajós, Belterra (PA)', 'Tiago Silveira')
};

/** Uma foto que diz cada eixo, na ordem de visaoGeral.eixos.itens. */
export const FOTOS_DOS_EIXOS: Foto[] = [
  mtur('40438924214', 'manaus-musa-40438924214.webp', 'Floresta perto de Manaus (AM)', 'Mário Oliveira'),
  mtur('40064976735', 'santarem-pintura-indigena-40064976735.webp', 'Pintura indígena, Santarém (PA)', 'Tiago Silveira'),
  mtur('40929011292', 'macapa-acai-40929011292.webp', 'Açaí, Macapá (AP)', 'Márcia do Carmo'),
  mtur('40221863344', 'ponte-rio-madeira-40221863344.webp', 'Ponte do rio Madeira, entre RO e AM', 'Silva Júnior'),
  mtur('41063936792', 'palmas-palacio-araguaia-41063936792.webp', 'Palácio Araguaia, Palmas (TO)', 'Flávio André')
];

/**
 * Os nove estados da faixa do território, na ordem em que aparecem. O nome do
 * lugar vai grande no painel aberto e o município, menor, embaixo.
 */
export interface Estado { uf: string; nome: string; capital: string; bandeira: string; foto: Foto; municipio: string; licenca?: { nome: string; url: string } }
const estado = (uf: string, nome: string, capital: string, bandeira: string, municipio: string, foto: Foto, licenca?: Estado['licenca']): Estado =>
  ({ uf, nome, capital, bandeira: `/flags/${bandeira}`, municipio, foto, licenca });

export const ESTADOS: Estado[] = [
  estado('AM', 'Amazonas', 'Manaus', 'Bandeira_do_Amazonas.svg', 'Barcelos (AM)', mtur('40079605135', 'barcelos-rio-negro-40079605135.webp', 'Rio Negro', 'Mário Oliveira')),
  estado('PA', 'Pará', 'Belém', 'Bandeira_do_Para.svg', 'Santarém (PA)', mtur('40958491901', 'alter-do-chao-40958491901.webp', 'Alter do Chão', 'Tiago Silveira')),
  estado('MA', 'Maranhão', 'São Luís', 'Bandeira_do_Maranhao.svg', 'Barreirinhas (MA)', mtur('27050741838', 'lencois-maranhenses-27050741838.webp', 'Lençóis Maranhenses', 'Biaman Prado')),
  estado('MT', 'Mato Grosso', 'Cuiabá', 'Bandeira_de_Mato_Grosso.svg', 'Chapada dos Guimarães (MT)', mtur('39184231560', 'veu-da-noiva-chapada-39184231560.webp', 'Cachoeira Véu de Noiva', 'Flávio André')),
  estado('TO', 'Tocantins', 'Palmas', 'Bandeira_do_Tocantins.svg', 'Mateiros (TO)', mtur('40211362765', 'jalapao-dunas-40211362765.webp', 'Jalapão', 'Flávio André')),
  // A única que não é do MTur: o Flickr do ministério não tem o rio Crôa. A do
  // Wikimedia Commons tem licença livre, que pede a atribuição e o link dela.
  estado('AC', 'Acre', 'Rio Branco', 'Bandeira_do_Acre.svg', 'Cruzeiro do Sul (AC)',
    { arquivo: '/photos/visao-geral/rio-croa-commons.webp', lugar: 'Rio Crôa', autor: 'Leonardo Honorato Santos', url: 'https://commons.wikimedia.org/wiki/File:Rio_Croa.jpg' },
    { nome: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' }),
  estado('AP', 'Amapá', 'Macapá', 'Bandeira_do_Amapa.svg', 'Macapá (AP)', mtur('27099881288', 'macapa-trapiche-27099881288.webp', 'Rio Amazonas', 'Márcia do Carmo')),
  estado('RO', 'Rondônia', 'Porto Velho', 'Bandeira_de_Rondonia.svg', 'Abunã, Porto Velho (RO)', mtur('27059000208', 'rio-madeira-abuna-27059000208.webp', 'Rio Madeira', 'Silva Júnior')),
  estado('RR', 'Roraima', 'Boa Vista', 'Bandeira_de_Roraima.svg', 'Boa Vista (RR)', mtur('39266486880', 'boa-vista-cacari-39266486880.webp', 'Praia do Caçari', 'Ederson Brito'))
];
