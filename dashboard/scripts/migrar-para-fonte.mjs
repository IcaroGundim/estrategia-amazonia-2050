// Migração única: escreve `conteudo/` a partir dos JSONs publicados em
// `public/data/`, que eram a única fonte real dos números quando o pipeline
// antigo (server.mjs sobre CSVs de `dados/`) deixou de rodar.
//
// Depois desta migração a direção inverte: `conteudo/` é a fonte e
// `public/data/` é gerado pelo build. Rodar de novo sobrescreve `conteudo/`
// com o que estiver em `public/data/` — só faz sentido enquanto os dois dizem
// a mesma coisa, ou seja, antes da primeira edição pela tela.
//
//   node scripts/migrar-para-fonte.mjs   (a partir de dashboard/)
import { mkdir, readFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { conteudoRoot, publicRoot, gravaJson, gravaValores } from '../pipeline/fonte.mjs';

const dataRoot = join(publicRoot, 'data');
const le = async (nome) => JSON.parse(await readFile(join(dataRoot, nome), 'utf8'));
const HOJE = new Date().toISOString().slice(0, 10);

const dashboard = await le('dashboard.json');
const catalogo = await le('catalogo.json');
const ufs = dashboard.states.map((estado) => estado.uf).sort();

// ---------- valores.csv ----------

const linhas = [];
const linha = (codigo, { campo = '', uf, ano = '', valor, nota = '' }) => {
  linhas.push({
    codigo,
    campo,
    uf,
    ano: ano === '' ? '' : String(ano),
    valor: valor === null || valor === undefined ? '' : String(valor),
    origem: 'migracao',
    atualizadoEm: HOJE,
    por: 'migracao',
    nota
  });
};

// Indicadores do catálogo: valor atual, série anual e campos auxiliares.
for (const eixo of catalogo.eixos) {
  for (const indicador of eixo.indicadores) {
    for (const [uf, valor] of Object.entries(indicador.valores || {})) linha(indicador.codigo, { uf, valor });
    for (const [uf, serie] of Object.entries(indicador.serieAnual || {})) {
      for (const [ano, valor] of Object.entries(serie || {})) linha(indicador.codigo, { uf, ano, valor });
    }
    for (const [uf, campos] of Object.entries(indicador.extra || {})) {
      for (const [campo, valor] of Object.entries(campos || {})) linha(indicador.codigo, { campo, uf, valor });
    }
  }
}

// Métricas do Panorama. As taxas são guardadas pelo valor bruto (km², focos):
// o bruto do ano de referência existe no payload; os demais anos são
// reconstruídos da taxa pela área, que é constante.
const SERIES_DIRETAS = ['cvliRate', 'poverty', 'school', 'apsCobertura', 'idebAnosIniciais', 'idebAnosFinais', 'idebEnsinoMedio', 'ibc', 'pevsBilhoes', 'piaBilhoes', 'pdPctPib'];
const VALORES_PLANOS = ['vulnerability', 'conservationUnits', 'conservationManaged', 'perRenovavel', 'isgr'];
for (const estado of dashboard.states) {
  const { uf } = estado;
  linha('AREA', { uf, valor: estado.area });
  linha('POP', { uf, ano: 2025, valor: estado.population });
  for (const [ano, taxa] of Object.entries(estado.series.prodesRate)) {
    linha('prodesKm2', { uf, ano, valor: Number(ano) === 2025 ? estado.prodesKm2 : taxa * estado.area / 1000 });
  }
  for (const [ano, taxa] of Object.entries(estado.series.heatRate)) {
    linha('focos', { uf, ano, valor: Number(ano) === 2024 ? estado.heat : taxa * estado.area / 1000 });
  }
  linha('cvli', { uf, ano: 2025, valor: estado.cvli });
  linha('apsEquipes', { uf, ano: 2026, valor: estado.esfTeams });
  for (const chave of SERIES_DIRETAS) {
    for (const [ano, valor] of Object.entries(estado.series[chave] || {})) linha(chave, { uf, ano, valor });
  }
  for (const chave of VALORES_PLANOS) linha(chave, { uf, valor: estado[chave] });
}

// ---------- catalogo.json ----------

const catalogoFonte = {
  eixos: catalogo.eixos.map((eixo) => ({
    numero: eixo.numero,
    nome: eixo.nome,
    indicadores: eixo.indicadores.map(({ codigo, linhaAcao, nome, meta, descricao, unidade, fonte, prazo, status, anoRef }) => ({
      codigo, linhaAcao, nome, meta, descricao, unidade, fonte, prazo, status, anoRef: anoRef ?? null
    }))
  }))
};

// ---------- panorama.json ----------

const ESTADOS = {
  AC: { name: 'Acre', capital: 'Rio Branco', flag: 'Bandeira_do_Acre.svg' },
  AP: { name: 'Amapá', capital: 'Macapá', flag: 'Bandeira_do_Amapa.svg' },
  AM: { name: 'Amazonas', capital: 'Manaus', flag: 'Bandeira_do_Amazonas.svg' },
  MA: { name: 'Maranhão', capital: 'São Luís', flag: 'Bandeira_do_Maranhao.svg' },
  MT: { name: 'Mato Grosso', capital: 'Cuiabá', flag: 'Bandeira_de_Mato_Grosso.svg' },
  PA: { name: 'Pará', capital: 'Belém', flag: 'Bandeira_do_Para.svg' },
  RO: { name: 'Rondônia', capital: 'Porto Velho', flag: 'Bandeira_de_Rondonia.svg' },
  RR: { name: 'Roraima', capital: 'Boa Vista', flag: 'Bandeira_de_Roraima.svg' },
  TO: { name: 'Tocantins', capital: 'Palmas', flag: 'Bandeira_do_Tocantins.svg' }
};

const panorama = {
  _leia: 'Métricas do mapa e da síntese comparativa. tipo: taxa (bruto ÷ denominador × fator), serie (valor por ano, como exibido) ou valor (um número por estado). referencia é o ano exibido por padrão; parciais são anos ainda em curso. rank: low (menor é melhor) ou high. campoBruto/campoVariacao são os nomes dos campos derivados no dashboard.json.',
  estados: ESTADOS,
  denominadores: { area: 'AREA', populacao: 'POP', anoPopulacao: 2025 },
  metricas: [
    { chave: 'prodesRate', codigoCatalogo: 'I1.3.2', tipo: 'taxa', bruto: 'prodesKm2', campoBruto: 'prodesKm2', denominador: 'AREA', fator: 1000, referencia: 2025, parciais: [], campoVariacao: 'prodesVariation', rank: 'low' },
    { chave: 'heatRate', codigoCatalogo: 'I1.3.4', tipo: 'taxa', bruto: 'focos', campoBruto: 'heat', denominador: 'AREA', fator: 1000, referencia: 2024, parciais: [], campoVariacao: 'heatVariation', rank: 'low' },
    { chave: 'cvliRate', codigoCatalogo: 'I2.4.1', tipo: 'taxa', bruto: 'cvli', campoBruto: 'cvli', denominador: 'POP', fator: 100000, referencia: 2025, parciais: [2026], serieDireta: 'cvliRate', rank: 'low' },
    { chave: 'poverty', codigoCatalogo: 'I2.1.1', tipo: 'serie', referencia: 2024, parciais: [], rank: 'low' },
    { chave: 'school', codigoCatalogo: null, tipo: 'serie', referencia: 2024, parciais: [], rank: 'high' },
    { chave: 'esfTeams', codigoCatalogo: 'I2.2.2', tipo: 'valor', codigo: 'apsEquipes', ano: 2026 },
    { chave: 'apsCobertura', codigoCatalogo: 'I2.2.2', tipo: 'serie', referencia: 2026, parciais: [2026], rank: 'high' },
    { chave: 'idebAnosIniciais', codigoCatalogo: 'I2.3.1', tipo: 'serie', referencia: 2025, parciais: [], rank: 'high' },
    { chave: 'idebAnosFinais', codigoCatalogo: 'I2.3.1', tipo: 'serie', referencia: 2025, parciais: [], rank: 'high' },
    { chave: 'idebEnsinoMedio', codigoCatalogo: 'I2.3.1', tipo: 'serie', referencia: 2025, parciais: [], rank: 'high' },
    { chave: 'vulnerability', codigoCatalogo: 'I1.3.1', tipo: 'valor', rank: 'low' },
    { chave: 'conservationUnits', codigoCatalogo: 'I1.1.2', tipo: 'valor' },
    { chave: 'conservationManaged', codigoCatalogo: 'I1.1.2', tipo: 'valor', rank: 'high' },
    { chave: 'pevsBilhoes', codigoCatalogo: 'I3.1.1', tipo: 'serie', referencia: 2024, parciais: [], rank: 'high' },
    { chave: 'piaBilhoes', codigoCatalogo: 'F3.5', tipo: 'serie', referencia: 2024, parciais: [], rank: 'high' },
    { chave: 'ibc', codigoCatalogo: 'I4.1.1', tipo: 'serie', referencia: 2025, parciais: [], rank: 'high' },
    { chave: 'perRenovavel', codigoCatalogo: 'I4.3.2', tipo: 'valor', rank: 'high' },
    { chave: 'isgr', codigoCatalogo: 'I4.4.1', tipo: 'valor', rank: 'high' },
    { chave: 'pdPctPib', codigoCatalogo: 'I5.4.1', tipo: 'serie', referencia: 2023, parciais: [], valorAtual: 'ultimo', campoAno: 'pdPctPibAno', rank: 'high' }
  ],
  sintese: {
    pesos: [
      { chave: 'prodesRate', direcao: 'low', peso: 0.22 },
      { chave: 'heatRate', direcao: 'low', peso: 0.08 },
      { chave: 'conservationManaged', direcao: 'high', peso: 0.10 },
      { chave: 'poverty', direcao: 'low', peso: 0.17 },
      { chave: 'school', direcao: 'high', peso: 0.12 },
      { chave: 'apsCobertura', direcao: 'high', peso: 0.11 },
      { chave: 'cvliRate', direcao: 'low', peso: 0.12 },
      { chave: 'vulnerability', direcao: 'low', peso: 0.08 }
    ],
    dimensoes: {
      territorio: [{ chave: 'prodesRate', peso: 0.55 }, { chave: 'heatRate', peso: 0.2 }, { chave: 'conservationManaged', peso: 0.25 }],
      pessoas: [{ chave: 'poverty', peso: 0.42 }, { chave: 'school', peso: 0.3 }, { chave: 'apsCobertura', peso: 0.28 }],
      seguranca: [{ chave: 'cvliRate', peso: 1 }],
      resiliencia: [{ chave: 'vulnerability', peso: 1 }]
    }
  },
  resumo: { desmatamento: 'prodesRate', focos: 'heatRate', violencia: 'cvliRate', unidadesConservacao: 'conservationUnits' }
};

// ---------- metas.json ----------

const metas = {
  _leia: 'Parametrização das metas confrontáveis (ver pipeline/metas.mjs para o significado de cada campo) e os motivos das que ficam fora do quadro.',
  contexto: { cvli: 'cvli' },
  parametros: [
    {
      codigo: 'I1.1.2', alvo: 40, direcao: 'maior', tipo: 'inferida', agregacao: 'razaoUc',
      nota: 'A meta é regional (40% das UCs estaduais da Amazônia Legal). Aqui ela é aplicada como referência para cada estado, o que não equivale ao compromisso pactuado no agregado.'
    },
    {
      codigo: 'I1.3.1', alvo: 52.1, direcao: 'menor', tipo: 'declarada', agregacao: 'media',
      notaAgregacao: 'Média simples dos nove estados: o catálogo traz a média estadual já consolidada, não o número de municípios prioritários que a compõe.',
      nota: 'Convergência para 52,1 pontos, a média do grupo menos vulnerável. O valor estadual é a média dos municípios prioritários, o mesmo recorte citado na meta.'
    },
    {
      codigo: 'I1.3.2', alvo: 0, direcao: 'menor', tipo: 'declarada', agregacao: 'soma',
      nota: 'A meta é desmatamento ilegal zero e não define ano de partida, então não há percentual de percurso: o que se lê é a área que falta zerar.'
    },
    {
      codigo: 'I1.3.4', alvo: { tipo: 'reducaoSobreMedia', desde: 2015, fator: 0.7 }, direcao: 'menor', tipo: 'derivada', agregacao: 'soma', valorDe: 'ultimoDaSerie',
      nota: 'Redução de 30% sobre a média histórica de cada estado. A meta cita a baseline 2015–2025; a série consolidada termina em 2024, então a janela usada é 2015–2024.'
    },
    { codigo: 'I2.1.1', alvo: 3, direcao: 'menor', tipo: 'declarada', agregacao: 'populacao' },
    {
      codigo: 'I2.3.2', alvo: 100, direcao: 'maior', tipo: 'inferida', agregacao: 'populacao',
      notaAgregacao: 'Ponderação pela população total de cada estado, e não pela população de 4 a 17 anos, que não está na base consolidada.',
      nota: 'A meta fala em universalizar o acesso, sem número. Adotamos 100% de atendimento como leitura da universalização; um patamar de 98%, por exemplo, produziria outro resultado.'
    },
    { codigo: 'I2.4.1', alvo: 10, direcao: 'menor', tipo: 'declarada', agregacao: 'razaoCvli' },
    { codigo: 'I4.1.1', alvo: 80, direcao: 'maior', tipo: 'declarada', agregacao: 'populacao', baselineAno: 2021 },
    {
      codigo: 'I4.3.2', alvo: 80, direcao: 'maior', tipo: 'declarada', agregacao: 'media',
      notaAgregacao: 'Média simples dos nove estados. A leitura regional correta ponderaria pela potência instalada de cada estado, que não está na base consolidada.'
    },
    { codigo: 'I4.4.1', alvo: 80, direcao: 'maior', tipo: 'declarada', unidade: '%', agregacao: 'populacao' },
    {
      codigo: 'I5.4.1', alvo: 1, direcao: 'maior', tipo: 'declarada', valorDe: { panorama: 'pdPctPib' }, unidade: '% do PIB', agregacao: 'media',
      notaAgregacao: 'Média simples dos nove estados. Ponderar pelo PIB exigiria o PIB do mesmo ano de referência em todos os estados, o que a série não oferece.',
      nota: 'Os valores de I5.4.1 no catálogo estão em R$ milhões, não em percentual do PIB. Para confrontar com a meta de 1% do PIB usamos o campo pct_pib da mesma base (MCTI), já consolidado pelo painel.'
    },
    {
      codigo: 'I5.5.1', direcao: 'categoria', tipo: 'declarada', agregacao: 'contagem', categoriasCumpre: ['A+', 'A', 'B+', 'B'],
      nota: 'A meta do indicador é CAPAG A ou B. Notas com sinal (A+, B+) são contadas dentro da faixa correspondente.'
    }
  ],
  exclusoes: {
    'I2.2.1': 'A meta é de redução de 50% na região, sem baseline informada no catálogo. Sem o ponto de partida não há como dizer se um estado está cumprindo.',
    'I2.2.2': 'A meta é de cobertura de 100% da população, mas os valores coletados são o número de equipes de atenção primária, não o percentual de cobertura.',
    'I2.2.3': 'A meta é ter telessaúde em pelo menos 50% dos municípios; o valor coletado é a contagem absoluta de municípios atendidos, sem o total municipal por estado no catálogo.',
    'I3.1.1': 'A meta de aumento de R$ 100 milhões não indica a que baseline se refere nem se é por estado ou regional.',
    'F3.2': 'A ficha define estruturação de cadeias produtivas de forma qualitativa, sem patamar numérico.',
    'F3.5': 'A meta é de crescimento de 10% ao ano em valores nominais. Avaliar cumprimento por um único ano de variação diria mais sobre inflação e base de comparação do que sobre a meta de 2050.'
  }
};

// ---------- textos.json e painel.json ----------

const textos = {
  _leia: 'Textos do painel que não são dados. Cada campo pode ter a versão em inglês ao lado (chave en); quando falta, a página em inglês mostra o português.',
  panorama: { metodologia: dashboard.methodology }
};

const painel = {
  _leia: 'Data de atualização exibida no painel e constantes que não têm fonte por estado.',
  atualizadoEm: dashboard.updatedAt,
  municipios: dashboard.summary.municipalities
};

// ---------- grava ----------

await mkdir(conteudoRoot, { recursive: true });
await gravaValores(linhas, ufs);
await gravaJson('catalogo.json', catalogoFonte);
await gravaJson('panorama.json', panorama);
await gravaJson('metas.json', metas);
await gravaJson('textos.json', textos);
await gravaJson('painel.json', painel);
await copyFile(join(dataRoot, 'fichas.json'), join(conteudoRoot, 'fichas.json'));
console.log(`conteudo/ escrito: ${linhas.length} linhas em valores.csv, ${catalogo.eixos.flatMap((eixo) => eixo.indicadores).length} indicadores no catálogo.`);
