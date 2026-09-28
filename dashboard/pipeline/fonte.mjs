// Leitura e escrita da fonte editável do painel: a pasta `conteudo/`.
//
// Tudo o que o painel mostra nasce aqui e só aqui. Os JSONs de `public/data/` e
// os XLSX de `public/downloads/` são derivados no build (`build-static.mjs`) e não
// se editam à mão. A tela de administração grava nestes arquivos; os scripts de
// coleta em Python propõem mudanças para eles.
//
//   catalogo.json   os 59 indicadores por eixo, sem números
//   valores.csv     todo número do painel, um por linha: código, campo, UF, ano
//   metas.json      parametrização das metas confrontáveis e a lista de exclusões
//   panorama.json   estados, métricas do mapa e pesos da síntese
//   textos.json     textos do painel que não são dados
//   painel.json     data de atualização e constantes
//   fichas.json     fichas técnicas (extraídas do .docx)
//   projecoes.json  trajetórias pactuadas até 2050, regionais, por cenário
//
// O CSV de valores é "longo": uma célula por linha. `campo` vazio é o valor
// principal do código; preenchido é um valor auxiliar (o `extra` do catálogo).
// `ano` vazio é o valor atual, sem ano; preenchido é um ponto da série anual.
// `valor` vazio é um nulo registrado de propósito (a UF existe, o dado não).
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const conteudoRoot = join(appRoot, 'conteudo');
export const publicRoot = join(appRoot, 'public');

export const COLUNAS_VALORES = ['codigo', 'campo', 'uf', 'ano', 'valor', 'origem', 'atualizadoEm', 'por', 'nota'];

// Formatos de exibição que o app.js sabe desenhar (src/scripts/app.js, FORMATOS).
export const FORMATOS = new Set(['km2PorMilKm2', 'porMilKm2', 'porCemMil', 'pct0', 'pct1', 'pct2', 'num1', 'num2', 'pontos1', 'reaisBi']);

// ---------- CSV ----------

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value !== '')) rows.push(row);
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((key, index) => [key, values[index] ?? ''])));
}

function escapaCsv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function serializaCsv(rows, colunas = COLUNAS_VALORES) {
  const linhas = [colunas.join(',')];
  for (const row of rows) linhas.push(colunas.map((coluna) => escapaCsv(row[coluna])).join(','));
  return `${linhas.join('\n')}\n`;
}

// O valor de uma célula volta com o tipo que tinha: número quando é um número
// escrito de forma estrita (`12`, `-3.5`), texto em qualquer outro caso ("B+"),
// nulo quando vazio. `Number()` sozinho aceitaria "" e "0x10", por isso a regex.
export function tipaValor(texto) {
  if (texto === null || texto === undefined) return null;
  const limpo = String(texto).trim();
  if (limpo === '') return null;
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(limpo)) return Number(limpo);
  return limpo;
}

export function textoDoValor(valor) {
  if (valor === null || valor === undefined) return '';
  return typeof valor === 'number' ? String(valor) : String(valor);
}

// ---------- índice de valores ----------

// A partir das linhas do CSV monta, por código:
//   atual[uf]            valor sem ano
//   serie[uf][ano]       valores com ano
//   extra[campo][uf]     valores auxiliares (campo preenchido, sem ano)
// Quando existe linha, a chave existe mesmo que o valor seja nulo: é assim que
// o catálogo público distingue "AC: null" de "AC ausente".
export function indexaValores(rows) {
  const porCodigo = new Map();
  for (const row of rows) {
    const codigo = row.codigo.trim();
    if (!codigo) continue;
    if (!porCodigo.has(codigo)) porCodigo.set(codigo, { atual: {}, serie: {}, extra: {}, linhas: [] });
    const entrada = porCodigo.get(codigo);
    entrada.linhas.push(row);
    const uf = row.uf.trim();
    const campo = row.campo.trim();
    const ano = row.ano.trim();
    const valor = tipaValor(row.valor);
    if (campo) {
      (entrada.extra[campo] ||= {})[uf] = valor;
    } else if (ano) {
      (entrada.serie[uf] ||= {})[ano] = valor;
    } else {
      entrada.atual[uf] = valor;
    }
  }
  return porCodigo;
}

export function ordenaValores(rows, ufs) {
  const posUf = new Map(ufs.map((uf, index) => [uf, index]));
  const chave = (row) => [
    row.codigo,
    row.campo || '',
    posUf.has(row.uf) ? String(posUf.get(row.uf)).padStart(2, '0') : `~${row.uf}`,
    row.ano || ''
  ];
  return [...rows].sort((a, b) => {
    const ka = chave(a);
    const kb = chave(b);
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });
}

// ---------- carga ----------

async function leJson(nome) {
  return JSON.parse(await readFile(join(conteudoRoot, nome), 'utf8'));
}

function exige(condicao, mensagem) {
  if (!condicao) throw new Error(`conteudo/: ${mensagem}`);
}

export async function carregaFonte() {
  const [catalogo, metas, panorama, textos, interfaceTextos, painel, fichas, projecoes, valoresTexto] = await Promise.all([
    leJson('catalogo.json'),
    leJson('metas.json'),
    leJson('panorama.json'),
    leJson('textos.json'),
    leJson('interface.json'),
    leJson('painel.json'),
    leJson('fichas.json'),
    leJson('projecoes.json'),
    readFile(join(conteudoRoot, 'valores.csv'), 'utf8')
  ]);
  const linhas = parseCsv(valoresTexto);
  const ufs = Object.keys(panorama.estados);
  const fonte = { catalogo, metas, panorama, textos, interface: interfaceTextos, painel, fichas, projecoes, linhas, ufs, valores: indexaValores(linhas) };
  validaFonte(fonte);
  return fonte;
}

/**
 * Arquivos de detalhe de public/data (as coletas versionadas, como a série de
 * óbitos do SIM) pelo nome. As metas que leem uma série ou um denominador de lá
 * dizem qual em `conteudo/metas.json`.
 */
export async function carregaDetalhes(nomes) {
  const pares = await Promise.all(nomes.map(async (nome) => {
    exige(/^[a-z0-9-]+\.json$/.test(nome), `metas.json cita um arquivo de detalhe com nome inválido: "${nome}"`);
    const texto = await readFile(join(publicRoot, 'data', nome), 'utf8').catch(() => null);
    exige(texto !== null, `metas.json cita public/data/${nome}, que não existe`);
    return [nome, JSON.parse(texto)];
  }));
  return Object.fromEntries(pares);
}

export function validaFonte({ catalogo, metas, panorama, painel, projecoes, linhas, ufs, valores, interface: interfaceTextos }) {
  exige(Array.isArray(catalogo.eixos) && catalogo.eixos.length, 'catalogo.json sem eixos');
  if (interfaceTextos) {
    exige(interfaceTextos.textos && typeof interfaceTextos.textos === 'object', 'interface.json sem textos');
    for (const [chave, par] of Object.entries(interfaceTextos.textos)) {
      exige(par && typeof par.pt === 'string' && par.pt.trim(), `interface.json: "${chave}" sem texto em português`);
    }
    for (const grupo of interfaceTextos.grupos || []) {
      exige(grupo.titulo && Array.isArray(grupo.chaves), `interface.json: grupo sem título ou chaves`);
      for (const chave of grupo.chaves) exige(chave in interfaceTextos.textos, `interface.json: o grupo "${grupo.titulo}" cita um texto que não existe: ${chave}`);
    }
  }
  const codigos = new Set();
  for (const eixo of catalogo.eixos) {
    exige(Number.isInteger(eixo.numero) && eixo.nome, `eixo sem número ou nome: ${JSON.stringify(eixo).slice(0, 80)}`);
    for (const indicador of eixo.indicadores || []) {
      exige(indicador.codigo && indicador.nome, `indicador sem código ou nome no eixo ${eixo.numero}`);
      exige(!codigos.has(indicador.codigo), `código repetido no catálogo: ${indicador.codigo}`);
      codigos.add(indicador.codigo);
    }
  }
  exige(ufs.length >= 1, 'panorama.json sem estados');
  for (const [uf, estado] of Object.entries(panorama.estados)) {
    exige(/^[A-Z]{2}$/.test(uf) && estado.name && estado.flag, `estado ${uf} incompleto em panorama.json`);
  }
  const chaves = new Set();
  for (const metrica of panorama.metricas) {
    exige(metrica.chave && !chaves.has(metrica.chave), `métrica sem chave ou repetida: ${metrica.chave}`);
    chaves.add(metrica.chave);
    exige(['taxa', 'serie', 'valor'].includes(metrica.tipo), `${metrica.chave}: tipo desconhecido "${metrica.tipo}"`);
    if (metrica.tipo === 'taxa') exige(metrica.bruto && metrica.denominador && metrica.fator, `${metrica.chave}: taxa sem bruto, denominador ou fator`);
    if (metrica.rank) exige(['low', 'high'].includes(metrica.rank), `${metrica.chave}: rank precisa ser low ou high`);
    if (metrica.seletor) {
      exige(metrica.rotulo && metrica.subtitulo && metrica.descricao && metrica.fonte, `${metrica.chave}: métrica do seletor sem rótulo, subtítulo, descrição ou fonte`);
      exige(FORMATOS.has(metrica.formato), `${metrica.chave}: formato desconhecido "${metrica.formato}"`);
      exige(metrica.rank, `${metrica.chave}: métrica do seletor precisa de rank (low ou high)`);
      exige(metrica.agregacao?.rotulo, `${metrica.chave}: métrica do seletor sem método de agregação regional`);
      exige(metrica.agregacao.metodo === 'soma' || 'peso' in metrica.agregacao, `${metrica.chave}: agregação precisa de peso (ou null) ou metodo 'soma'`);
    }
  }
  const somaPesos = panorama.sintese.pesos.reduce((soma, item) => soma + item.peso, 0);
  exige(Math.abs(somaPesos - 1) < 1e-9, `os pesos da síntese somam ${somaPesos}, não 1`);
  for (const item of panorama.sintese.pesos) exige(chaves.has(item.chave), `peso de síntese para métrica inexistente: ${item.chave}`);
  for (const [nome, partes] of Object.entries(panorama.sintese.dimensoes)) {
    for (const parte of partes) exige(chaves.has(parte.chave), `dimensão ${nome} cita métrica inexistente: ${parte.chave}`);
  }
  const AGREGACOES = ['soma', 'media', 'populacao', 'razaoUc', 'razaoCvli', 'razaoCampos', 'razaoDenominador', 'contagem'];
  for (const parametro of metas.parametros) {
    exige(codigos.has(parametro.codigo), `metas.json parametriza código fora do catálogo: ${parametro.codigo}`);
    exige(['maior', 'menor', 'categoria'].includes(parametro.direcao), `${parametro.codigo}: direção inválida`);
    exige(AGREGACOES.includes(parametro.agregacao), `${parametro.codigo}: toda meta precisa de um valor regional; agregação "${parametro.agregacao}" desconhecida`);
    exige(parametro.direcao !== 'categoria' || parametro.agregacao === 'contagem', `${parametro.codigo}: meta por categoria se lê na região como a parcela dos estados (agregação 'contagem')`);
    if (parametro.alvo && typeof parametro.alvo === 'object') {
      const regra = parametro.alvo;
      exige(regra.tipo === 'sobreBaseline', `${parametro.codigo}: regra de alvo desconhecida "${regra.tipo}"`);
      exige(Number.isFinite(regra.fator ?? 1) && Number.isFinite(regra.soma ?? 0) && (regra.fator !== undefined || regra.soma !== undefined), `${parametro.codigo}: a regra sobre a baseline precisa de fator ou soma numéricos`);
    } else if (parametro.direcao !== 'categoria') {
      exige(Number.isFinite(parametro.alvo), `${parametro.codigo}: alvo precisa ser um número ou uma regra sobre a baseline`);
    }
    if (parametro.baseline !== undefined) {
      const base = parametro.baseline;
      const periodo = Number.isInteger(base?.desde) && (base.ate === undefined || (Number.isInteger(base.ate) && base.ate >= base.desde));
      const ponto = (base?.ano === undefined || Number.isInteger(base.ano)) && (base?.ano !== undefined || Number.isFinite(base?.valor)) && (base?.valor === undefined || Number.isFinite(base.valor));
      exige(base && typeof base === 'object' && (base.desde !== undefined ? periodo : ponto), `${parametro.codigo}: baseline precisa ser { ano, valor } ou { desde, ate }`);
    }
    if (parametro.agregacao === 'razaoDenominador') {
      exige(parametro.denominador?.arquivo && parametro.denominador?.caminho, `${parametro.codigo}: razão por denominador sem arquivo ou caminho`);
    }
    if (parametro.valorDe && typeof parametro.valorDe === 'object' && !parametro.valorDe.panorama) {
      exige(parametro.valorDe.arquivo, `${parametro.codigo}: valorDe precisa de panorama ou de arquivo`);
    }
    if (parametro.trajetoria) {
      const traj = parametro.trajetoria;
      exige(traj.janela === undefined || (Number.isInteger(traj.janela) && traj.janela >= 3), `${parametro.codigo}: a janela da trajetória precisa ser um inteiro de 3 ou mais`);
      exige(traj.metodo === undefined || ['linear', 'composto'].includes(traj.metodo), `${parametro.codigo}: método da trajetória precisa ser linear ou composto`);
    }
  }
  for (const parametro of metas.parametros.filter((item) => item.agregacao === 'razaoCampos')) {
    const razao = parametro.razao || {};
    exige(razao.numerador && razao.denominador, `${parametro.codigo}: agregação razaoCampos sem numerador ou denominador`);
  }
  if (projecoes) validaProjecoes(projecoes, codigos);
  for (const codigo of Object.keys(metas.exclusoes)) exige(codigos.has(codigo), `metas.json exclui código fora do catálogo: ${codigo}`);
  const parametrizados = new Set(metas.parametros.map((parametro) => parametro.codigo));
  for (const [codigo, item] of Object.entries(metas.semMeta || {})) {
    if (codigo.startsWith('_')) continue;
    exige(codigos.has(codigo), `metas.json > semMeta cita código fora do catálogo: ${codigo}`);
    exige(!parametrizados.has(codigo), `metas.json > semMeta: ${codigo} tem meta no quadro; semMeta é só para os que ficam fora`);
    exige(item.agregacao === undefined || item.agregacao === 'soma', `metas.json > semMeta: ${codigo} com agregação "${item.agregacao}" (só 'soma' ou nenhuma)`);
    exige(item.unidade === undefined || (typeof item.unidade === 'string' && item.unidade.trim()), `metas.json > semMeta: ${codigo} com unidade vazia`);
  }
  exige(painel.atualizadoEm, 'painel.json sem atualizadoEm');
  const ufsConhecidas = new Set(ufs);
  linhas.forEach((row, index) => {
    const numero = index + 2;
    exige(row.codigo, `valores.csv linha ${numero}: sem código`);
    exige(ufsConhecidas.has(row.uf), `valores.csv linha ${numero}: UF desconhecida "${row.uf}"`);
    exige(!row.ano || /^\d{4}$/.test(row.ano), `valores.csv linha ${numero}: ano inválido "${row.ano}"`);
    exige(!row.origem || ['manual', 'script', 'migracao'].includes(row.origem), `valores.csv linha ${numero}: origem inválida "${row.origem}"`);
  });
  for (const codigo of valores.keys()) {
    const conhecido = codigos.has(codigo) || panorama.metricas.some((metrica) => metrica.codigo === codigo || metrica.bruto === codigo || metrica.denominador === codigo || metrica.chave === codigo);
    exige(conhecido, `valores.csv traz o código "${codigo}", que não está no catálogo nem no panorama`);
  }
}

export function validaProjecoes(projecoes, codigos) {
  exige(Array.isArray(projecoes.projecoes), 'projecoes.json sem a lista `projecoes`');
  const vistas = new Set();
  for (const item of projecoes.projecoes) {
    const id = `${item.codigo}|${item.variante || ''}`;
    exige(codigos.has(item.codigo), `projecoes.json cita código fora do catálogo: ${item.codigo}`);
    exige(!vistas.has(id), `projecoes.json repete ${id}`);
    vistas.add(id);
    exige(item.nome && item.unidade && item.fonte, `projecoes.json: ${id} sem nome, unidade ou fonte`);
    exige(Array.isArray(item.cenarios) && item.cenarios.length, `projecoes.json: ${id} sem cenários`);
    for (const cenario of item.cenarios) {
      exige(cenario.chave && cenario.nome, `projecoes.json: ${id} tem cenário sem chave ou nome`);
      const anos = Object.entries(cenario.serie || {});
      exige(anos.length >= 2, `projecoes.json: ${id}/${cenario.chave} precisa de dois anos ou mais`);
      for (const [ano, valor] of anos) exige(/^\d{4}$/.test(ano) && Number.isFinite(valor), `projecoes.json: ${id}/${cenario.chave} ${ano} inválido`);
    }
    exige(typeof item.comparavel === 'boolean', `projecoes.json: ${id} sem \`comparavel\``);
    exige(item.comparavel || item.motivo, `projecoes.json: ${id} não é comparável e não diz por quê`);
    exige(item.observado === undefined || item.observado === 'soma', `projecoes.json: ${id} tem observado desconhecido "${item.observado}"`);
  }
}

// ---------- escrita ----------

export async function gravaValores(rows, ufs) {
  await writeFile(join(conteudoRoot, 'valores.csv'), serializaCsv(ordenaValores(rows, ufs)));
}

export async function gravaJson(nome, payload) {
  await writeFile(join(conteudoRoot, nome), `${JSON.stringify(payload, null, 2)}\n`);
}
