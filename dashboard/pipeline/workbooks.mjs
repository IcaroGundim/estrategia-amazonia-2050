// Os workbooks de download, um por eixo, montados no build a partir da fonte.
//
// Cada arquivo traz: uma aba "Sobre"; o catálogo do eixo; a matriz UF × indicador
// com os valores atuais; uma aba por indicador com valor atual, série anual e
// campos auxiliares; as tabelas de detalhe (município, mês, divisão CNAE) que
// `public/data/csv/` versiona para aquele eixo; e a aba "Modelo_importacao", que
// é o formato longo de `conteudo/valores.csv` já preenchido com o eixo — quem
// atualiza pode editar essa aba e importá-la na tela de administração.
import ExcelJS from 'exceljs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseCsv, publicRoot, tipaValor } from './fonte.mjs';

const NOME_ARQUIVO = (eixo) => `Indicadores_Resultado_Eixo${eixo}_Amazonia2050.xlsx`;

// Tabelas de detalhe por eixo: arquivo em public/data/csv/ → nome da aba.
const DETALHES = {
  1: [['focos_calor_uf_ano.csv', 'Focos_calor_UF_ano']],
  2: [
    ['aps_uf_mes.csv', 'APS_UF_mes'],
    ['aps_municipio_ultima.csv', 'APS_municipios'],
    ['freq_escolar_15a17_municipio_2022.csv', 'Freq_escolar_municipios'],
    ['ideb_uf_ano.csv', 'IDEB_UF_ano'],
    ['ideb_municipio_ano.csv', 'IDEB_municipios'],
    ['obitos_evitaveis_uf_ano.csv', 'Obitos_evitaveis_UF_ano'],
    ['telessaude_uf_ano.csv', 'Telessaude_UF_ano']
  ],
  3: [
    ['pevs_madeireiro_uf_ano.csv', 'PEVS_madeireiro_UF_ano'],
    ['pevs_por_produto_uf.csv', 'PEVS_produtos_UF'],
    ['pia_divisoes_uf_ano.csv', 'PIA_divisoes_UF_ano'],
    ['rais_estab_uf_divisao_ano.csv', 'RAIS_divisoes_UF_ano']
  ],
  4: [
    ['censos_saneamento_municipio.csv', 'Saneamento_municipios'],
    ['diagnostico_siga_reconstrucao.csv', 'SIGA_diagnostico']
  ],
  5: []
};

const CABECALHO = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E2B22' } } };

function nomeDeAba(texto) {
  return String(texto).replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
}

function abaComTabela(workbook, nome, colunas, linhas) {
  const aba = workbook.addWorksheet(nomeDeAba(nome), { views: [{ state: 'frozen', ySplit: 1 }] });
  aba.columns = colunas.map((coluna) => ({ header: coluna.header, key: coluna.key, width: coluna.width || 14 }));
  aba.getRow(1).font = CABECALHO.font;
  aba.getRow(1).fill = CABECALHO.fill;
  for (const linha of linhas) aba.addRow(linha);
  return aba;
}

function abaSobre(workbook, eixo, fonte) {
  const aba = workbook.addWorksheet('Sobre');
  aba.columns = [{ width: 28 }, { width: 110 }];
  const linhas = [
    ['Estratégia Regional Amazônia 2050', ''],
    ['Eixo', `${eixo.numero} — ${eixo.nome}`],
    ['Painel atualizado em', fonte.painel.atualizadoEm],
    ['Arquivo gerado em', new Date().toISOString().slice(0, 10)],
    ['', ''],
    ['Abas', ''],
    ['Catalogo_Indicadores', 'Os indicadores do eixo: código, linha de ação, nome, meta pactuada, descrição, unidade, fonte, prazo e situação da coleta.'],
    ['Matriz_UF', 'Valor atual de cada indicador coletado, por estado.'],
    ['Uma aba por indicador', 'Valor atual, série anual (uma coluna por ano) e campos auxiliares, por estado. Só os indicadores com números.'],
    ['Tabelas de detalhe', 'Recortes por município, mês ou divisão CNAE que não cabem no painel por estado, quando existem para o eixo.'],
    ['Modelo_importacao', 'Formato longo usado pela tela de administração do painel: uma linha por célula (código, campo, UF, ano, valor). Edite ou acrescente linhas e importe o arquivo na tela.'],
    ['', ''],
    ['Fonte', 'Consórcio Interestadual da Amazônia Legal — painel da Estratégia Amazônia 2050. Os números são derivados dos mesmos arquivos que alimentam o site (conteudo/ no repositório).']
  ];
  for (const linha of linhas) aba.addRow(linha);
  aba.getCell('A1').font = { bold: true, size: 14 };
  aba.getCell('A6').font = { bold: true };
  return aba;
}

function abaCatalogo(workbook, eixo) {
  return abaComTabela(workbook, 'Catalogo_Indicadores', [
    { header: 'Código', key: 'codigo', width: 10 },
    { header: 'Linha de ação', key: 'linhaAcao', width: 12 },
    { header: 'Indicador', key: 'nome', width: 48 },
    { header: 'Meta', key: 'meta', width: 60 },
    { header: 'Descrição', key: 'descricao', width: 60 },
    { header: 'Unidade', key: 'unidade', width: 14 },
    { header: 'Fonte', key: 'fonte', width: 40 },
    { header: 'Prazo', key: 'prazo', width: 8 },
    { header: 'Situação da coleta', key: 'status', width: 40 },
    { header: 'Ano de referência', key: 'anoRef', width: 16 }
  ], eixo.indicadores);
}

function abaMatriz(workbook, eixo, ufs) {
  const linhas = eixo.indicadores
    .filter((indicador) => indicador.valores)
    .map((indicador) => ({
      codigo: indicador.codigo,
      nome: indicador.nome,
      unidade: indicador.unidade,
      anoRef: indicador.anoRef,
      ...Object.fromEntries(ufs.map((uf) => [uf, indicador.valores[uf] ?? null]))
    }));
  return abaComTabela(workbook, 'Matriz_UF', [
    { header: 'Código', key: 'codigo', width: 10 },
    { header: 'Indicador', key: 'nome', width: 48 },
    { header: 'Unidade', key: 'unidade', width: 14 },
    { header: 'Ano ref.', key: 'anoRef', width: 12 },
    ...ufs.map((uf) => ({ header: uf, key: uf, width: 10 }))
  ], linhas);
}

function abaIndicador(workbook, indicador, ufs) {
  const anos = [...new Set(Object.values(indicador.serieAnual || {}).flatMap((serie) => Object.keys(serie || {})))].sort();
  const extras = [...new Set(Object.values(indicador.extra || {}).flatMap((campos) => Object.keys(campos || {})))];
  const colunas = [
    { header: 'UF', key: 'uf', width: 6 },
    { header: 'Valor atual', key: 'atual', width: 12 },
    ...anos.map((ano) => ({ header: ano, key: `ano_${ano}`, width: 10 })),
    ...extras.map((campo) => ({ header: campo, key: `extra_${campo}`, width: 16 }))
  ];
  const linhas = ufs.map((uf) => ({
    uf,
    atual: indicador.valores?.[uf] ?? null,
    ...Object.fromEntries(anos.map((ano) => [`ano_${ano}`, indicador.serieAnual?.[uf]?.[ano] ?? null])),
    ...Object.fromEntries(extras.map((campo) => [`extra_${campo}`, indicador.extra?.[uf]?.[campo] ?? null]))
  }));
  const aba = abaComTabela(workbook, indicador.codigo, colunas, linhas);
  aba.addRow([]);
  aba.addRow(['Indicador', indicador.nome]);
  aba.addRow(['Unidade', indicador.unidade]);
  aba.addRow(['Fonte', indicador.fonte]);
  aba.addRow(['Ano de referência', indicador.anoRef]);
  return aba;
}

async function abaDetalhe(workbook, arquivo, nome) {
  let texto;
  try {
    texto = await readFile(join(publicRoot, 'data', 'csv', arquivo), 'utf8');
  } catch {
    return null;
  }
  const linhas = parseCsv(texto);
  if (!linhas.length) return null;
  const colunas = Object.keys(linhas[0]).map((coluna) => ({ header: coluna, key: coluna, width: Math.min(40, Math.max(10, coluna.length + 2)) }));
  return abaComTabela(workbook, nome, colunas, linhas.map((linha) => Object.fromEntries(Object.entries(linha).map(([chave, valor]) => [chave, tipaValor(valor)]))));
}

function abaModelo(workbook, eixo, fonte) {
  const codigos = new Set(eixo.indicadores.map((indicador) => indicador.codigo));
  const linhas = fonte.linhas
    .filter((linha) => codigos.has(linha.codigo))
    .map(({ codigo, campo, uf, ano, valor, nota }) => ({ codigo, campo, uf, ano: ano ? Number(ano) : null, valor: tipaValor(valor), nota }));
  return abaComTabela(workbook, 'Modelo_importacao', [
    { header: 'codigo', key: 'codigo', width: 10 },
    { header: 'campo', key: 'campo', width: 18 },
    { header: 'uf', key: 'uf', width: 6 },
    { header: 'ano', key: 'ano', width: 8 },
    { header: 'valor', key: 'valor', width: 14 },
    { header: 'nota', key: 'nota', width: 40 }
  ], linhas);
}

// Modelo de importação avulso, com a tabela inteira: quem atualiza baixa,
// edita ou acrescenta linhas no Excel e envia na tela de administração.
async function geraModelo(fonte, pastaSaida) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Painel Estratégia Amazônia 2050';
  const leia = workbook.addWorksheet('Leia-me');
  leia.columns = [{ width: 110 }];
  for (const linha of [
    'Modelo de importação de valores — painel da Estratégia Amazônia 2050',
    '',
    'A aba "Valores" tem uma linha por célula: codigo, campo, uf, ano, valor, nota.',
    'codigo: o indicador (I1.1.2, F3.2…) ou a métrica do Panorama (prodesKm2, focos, POP, AREA…).',
    'campo: vazio para o valor principal; preenchido para um campo auxiliar (total, comAmbos…).',
    'uf: sigla do estado. ano: vazio para o valor atual (sem ano) ou o ano da série, com quatro dígitos.',
    'valor: número (ponto ou vírgula como decimal) ou texto quando o indicador é categórico (A+, B…). Vazio apaga o valor.',
    'nota: observação livre, opcional.',
    '',
    'Edite as linhas ou acrescente novas, salve e envie o arquivo em Administração → Valores → Importar em lote.',
    `Gerado em ${new Date().toISOString().slice(0, 10)} a partir de conteudo/valores.csv.`
  ]) leia.addRow([linha]);
  leia.getCell('A1').font = { bold: true, size: 13 };
  abaComTabela(workbook, 'Valores', [
    { header: 'codigo', key: 'codigo', width: 12 },
    { header: 'campo', key: 'campo', width: 18 },
    { header: 'uf', key: 'uf', width: 6 },
    { header: 'ano', key: 'ano', width: 8 },
    { header: 'valor', key: 'valor', width: 14 },
    { header: 'nota', key: 'nota', width: 40 }
  ], fonte.linhas.map(({ codigo, campo, uf, ano, valor, nota }) => ({ codigo, campo, uf, ano: ano ? Number(ano) : null, valor: tipaValor(valor), nota })));
  const nome = 'modelo-importacao.xlsx';
  await workbook.xlsx.writeFile(join(pastaSaida, nome));
  return nome;
}

export async function geraWorkbooks({ fonte, catalogo }, pastaSaida) {
  const arquivos = [await geraModelo(fonte, pastaSaida)];
  for (const eixo of catalogo.eixos) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Painel Estratégia Amazônia 2050';
    abaSobre(workbook, eixo, fonte);
    abaCatalogo(workbook, eixo);
    abaMatriz(workbook, eixo, fonte.ufs);
    for (const indicador of eixo.indicadores) {
      if (indicador.valores || indicador.serieAnual || indicador.extra) abaIndicador(workbook, indicador, fonte.ufs);
    }
    for (const [arquivo, nome] of DETALHES[eixo.numero] || []) await abaDetalhe(workbook, arquivo, nome);
    abaModelo(workbook, eixo, fonte);
    const nome = NOME_ARQUIVO(eixo.numero);
    await workbook.xlsx.writeFile(join(pastaSaida, nome));
    arquivos.push(nome);
  }
  return arquivos;
}
