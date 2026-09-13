// Gera a nota técnica pública do painel, em PDF, em public/downloads/.
//
// A nota é montada a partir dos mesmos arquivos que alimentam o painel —
// public/data/catalogo.json, metas.json e dashboard.json —, das definições de
// indicador do Panorama (src/scripts/app.js) e dos pesos da síntese
// (conteudo/panorama.json).
// Nenhum número do texto é escrito à mão: quando os dados mudam, basta rodar
// `npm run nota-tecnica` de novo. As conferências do meio do caminho param o
// script se uma contagem deixar de fechar ou se uma definição mudar de lugar,
// para a nota não sair com uma frase velha.
//
// A impressão usa o Edge ou o Chrome sem janela. O caminho do navegador pode ser
// dado em NAVEGADOR_PDF. `--html caminho` grava também o HTML, para conferir no
// navegador; `--sem-pdf` para só nisso.

import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const NOME_PDF = 'nota-tecnica-painel-amazonia-2050.pdf';
const SAIDA = join(RAIZ, 'public', 'downloads', NOME_PDF);

const argumentos = process.argv.slice(2);
const htmlPedido = argumentos.includes('--html') ? argumentos[argumentos.indexOf('--html') + 1] : null;
const semPdf = argumentos.includes('--sem-pdf');

function confere(condicao, mensagem) {
  if (!condicao) throw new Error(`Nota técnica: ${mensagem}`);
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

const lerJson = (nome) => JSON.parse(readFileSync(join(RAIZ, 'public', 'data', nome), 'utf8'));
const catalogo = lerJson('catalogo.json');
const metasDados = lerJson('metas.json');
const painel = lerJson('dashboard.json');

const SITE = readFileSync(join(RAIZ, 'astro.config.mjs'), 'utf8').match(/site:\s*'([^']+)'/)?.[1];
confere(SITE, 'não achei `site` em astro.config.mjs');
const SITE_CURTO = SITE.replace(/^https?:\/\//, '');

// Definições do Panorama: as mesmas de conteudo/panorama.json que o build usa
// para montar dashboard.json — rótulo, descrição, fonte, direção e agregação.
const PANORAMA = JSON.parse(readFileSync(join(RAIZ, 'conteudo', 'panorama.json'), 'utf8'));
const METRICAS = PANORAMA.metricas
  .filter((metrica) => metrica.seletor)
  .map((metrica) => ({ chave: metrica.chave, rotulo: metrica.rotulo, descricao: metrica.descricao, fonte: metrica.fonte, direcao: metrica.rank }));
const AGREGACAO = Object.fromEntries(PANORAMA.metricas
  .filter((metrica) => metrica.agregacao)
  .map((metrica) => [metrica.chave, { rotulo: metrica.agregacao.rotulo, nota: metrica.agregacao.nota ?? null, notaSerie: metrica.agregacao.notaSerie ?? null }]));

confere(METRICAS.length >= 10, `li só ${METRICAS.length} indicadores do Panorama em conteudo/panorama.json`);
for (const metrica of METRICAS) {
  confere(metrica.rotulo && metrica.descricao && metrica.fonte, `${metrica.chave} sem rótulo, descrição ou fonte`);
  confere(['low', 'high'].includes(metrica.direcao), `${metrica.chave} sem direção`);
  confere(AGREGACAO[metrica.chave]?.rotulo, `${metrica.chave} sem método de agregação`);
  confere(metrica.chave in painel.states[0], `${metrica.chave} não existe em dashboard.json`);
}

// Pesos da síntese, na ordem em que conteudo/panorama.json os declara — é o
// mesmo arquivo que o build lê para calcular o score.
const PESOS = JSON.parse(readFileSync(join(RAIZ, 'conteudo', 'panorama.json'), 'utf8')).sintese.pesos
  .map(({ chave, direcao, peso }) => ({ chave, direcao, peso: Number(peso) }));
confere(Math.abs(PESOS.reduce((soma, item) => soma + item.peso, 0) - 1) < 1e-9, 'os pesos da síntese não somam 1');

// Dimensão de cada indicador da síntese, como em server.mjs (state.dimensions).
// A soma dos pesos de cada dimensão tem de bater com o que dashboard.json declara.
const DIMENSAO = {
  prodesRate: 'Território e clima', heatRate: 'Território e clima', conservationManaged: 'Território e clima',
  poverty: 'Pessoas', school: 'Pessoas', apsCobertura: 'Pessoas',
  cvliRate: 'Segurança', vulnerability: 'Resiliência'
};
for (const dimensao of painel.methodology.dimensions) {
  const soma = PESOS.filter((item) => DIMENSAO[item.chave] === dimensao.name).reduce((total, item) => total + item.peso, 0);
  confere(Math.round(soma * 100) === parseInt(dimensao.weight, 10), `a dimensão ${dimensao.name} soma ${soma}, não ${dimensao.weight}`);
}
for (const item of PESOS) confere(DIMENSAO[item.chave], `${item.chave} sem dimensão`);

// Indicador do catálogo que cada série do Panorama representa. `null` quando a
// série é complementar e não corresponde a um código (frequência escolar 15–17).
const CODIGO_DA_METRICA = {
  prodesRate: 'I1.3.2', heatRate: 'I1.3.4', poverty: 'I2.1.1', school: null, cvliRate: 'I2.4.1',
  apsCobertura: 'I2.2.2', vulnerability: 'I1.3.1', conservationManaged: 'I1.1.2', ibc: 'I4.1.1',
  perRenovavel: 'I4.3.2', isgr: 'I4.4.1', pevsBilhoes: 'I3.1.1', piaBilhoes: 'F3.5',
  idebAnosIniciais: 'I2.3.1', idebAnosFinais: 'I2.3.1', idebEnsinoMedio: 'I2.3.1', pdPctPib: 'I5.4.1'
};

const INDICADORES = catalogo.eixos.flatMap((eixo) => eixo.indicadores.map((indicador) => ({ ...indicador, eixo: eixo.numero, eixoNome: eixo.nome })));
const PORCODIGO = new Map(INDICADORES.map((indicador) => [indicador.codigo, indicador]));
for (const metrica of METRICAS) {
  confere(metrica.chave in CODIGO_DA_METRICA, `${metrica.chave} é novo no Panorama: diga em CODIGO_DA_METRICA a que código ele corresponde`);
  const codigo = CODIGO_DA_METRICA[metrica.chave];
  confere(codigo === null || PORCODIGO.has(codigo), `${codigo} não existe no catálogo`);
}

const METAS = metasDados.metas;
const FORA = metasDados.foraDoPainel;
const RESUMO = metasDados.resumo;
const CODIGOS_META = new Set(METAS.map((meta) => meta.codigo));

// Classes de situação, com a mesma regra da ficha técnica (src/scripts/fichas.js).
const semAcento = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
function situacao(indicador) {
  const texto = semAcento(indicador.status);
  if (texto.startsWith('coletado')) return 'coletado';
  if (texto.startsWith('parcial')) return 'parcial';
  if (texto.startsWith('pendente')) return 'pendente';
  return 'manual';
}
const SITUACOES = {
  coletado: { rotulo: 'Coletado', descricao: 'há valores para os estados, obtidos de fonte pública. Em alguns casos o valor é uma medida aproximada (proxy), indicada nas notas da tabela do eixo.' },
  parcial: { rotulo: 'Parcial', descricao: 'parte do indicador foi coletada; o restante depende de uma fonte sem acesso aberto.' },
  pendente: { rotulo: 'Pendente', descricao: 'a fonte está identificada, mas não oferece acesso aberto aos dados, ou o critério de medida ainda não foi definido.' },
  manual: { rotulo: 'Não coletado', descricao: 'depende de informação produzida pelos próprios estados, que não está reunida numa base pública.' }
};

const ehProxy = (indicador) => /proxy/i.test(`${indicador.status} ${indicador.fonte}`);

// O texto entre parênteses do status diz o que foi coletado. Para os indicadores
// com valores ele vira nota da tabela; dois ajustes de redação o tornam legível
// fora do registro de coleta.
function qualificador(indicador) {
  const achado = String(indicador.status || '').match(/\((.*)\)\s*$/s);
  if (!achado) return null;
  return achado[1]
    .replace(/\bPRODES ok\b/, 'PRODES coletado')
    .replace(/exige login/, 'exige acesso autenticado')
    .replace(/LBE <5 anos/, 'lista de causas evitáveis (LBE) para menores de 5 anos')
    .replace(/\s*=>\s*/g, ' → ');
}

// Categorias dos indicadores ainda sem valores, pela mesma leitura do status.
// Um indicador sem valor no catálogo que ainda assim tem série no Panorama (o
// IDEB, cuja ficha pede o percentual que atingiu a meta, não a nota) fica numa
// categoria à parte: dizer só "fonte sem acesso" contradiria a tabela da seção 3.
const CODIGOS_NO_PANORAMA = new Set(Object.values(CODIGO_DA_METRICA).filter(Boolean));
function pendencia(indicador) {
  if (CODIGOS_NO_PANORAMA.has(indicador.codigo)) return 'panorama';
  const texto = semAcento(indicador.status);
  if (texto.startsWith('coleta manual')) return 'estados';
  if (texto.startsWith('pendente (documental')) return 'documental';
  if (texto.startsWith('pendente') || texto.startsWith('parcial')) return 'acesso';
  return null;
}
const PENDENCIAS = {
  estados: { titulo: 'Dependem de informação dos estados', texto: 'Leis, planos, registros administrativos e programas estaduais que não estão reunidos numa base pública. Precisam ser levantados junto a cada estado.', resumo: (n) => `${n} ${n === 1 ? 'depende' : 'dependem'} de informação dos estados` },
  documental: { titulo: 'Dependem de levantamento documental', texto: 'A medida exige leitura de documentos e, em alguns casos, critérios que a Estratégia ainda não definiu publicamente — o que conta como cadeia estruturada ou como projeto com critérios socioambientais, por exemplo.', resumo: (n) => `${n} de levantamento documental` },
  acesso: { titulo: 'Dependem de fonte sem acesso aberto', texto: 'A fonte existe, mas no momento da coleta não oferecia os dados de forma aberta: plataformas em construção, painéis sem interface de dados ou sistemas fora do ar.', resumo: (n) => `${n} de fontes sem acesso aberto` },
  panorama: { titulo: 'Têm só uma série relacionada no Panorama', texto: 'O Panorama mostra uma série da mesma fonte, mas não o valor que a ficha técnica define para o indicador. Por isso o indicador fica sem valor no catálogo e sem meta avaliada.', resumo: (n) => `${n} ${n === 1 ? 'tem' : 'têm'} só uma série relacionada no Panorama` }
};

// Para a categoria `panorama`, a explicação de cada indicador é a nota da série
// correspondente em app.js; se faltar, a nota sairia sem dizer por quê.
function notaDoPanorama(codigo) {
  const chave = Object.keys(CODIGO_DA_METRICA).find((item) => CODIGO_DA_METRICA[item] === codigo && AGREGACAO[item]?.notaSerie);
  confere(chave, `${codigo} tem série no Panorama mas não tem valor no catálogo, e nenhuma notaSerie em app.js explica a diferença`);
  return AGREGACAO[chave].notaSerie;
}

// Nota da nota: acrescentada aqui, e não no dado, porque corrige a leitura da
// unidade. O status de I1.3.2 diz que só o PRODES foi coletado; sem as
// autorizações de supressão, o número é o desmatamento total.
const NOTAS_EXTRA = {
  'I1.3.2': 'O valor é o desmatamento total detectado pelo PRODES, em km². Sem as autorizações de supressão (Sinaflor), que não estão coletadas, não é possível separar a parcela ilegal: o número é o teto do desmatamento ilegal, não a sua medida.'
};
for (const codigo of Object.keys(NOTAS_EXTRA)) confere(CODIGOS_META.has(codigo), `${codigo} tem nota extra mas não é meta avaliada`);

// ---------------------------------------------------------------------------
// Conferências de contagem
// ---------------------------------------------------------------------------

const TOTAL = INDICADORES.length;
const COM_VALORES = INDICADORES.filter((indicador) => indicador.valores);
const FORA_COM_VALORES = FORA.filter((item) => item.temValores);
const SEM_VALORES = FORA.filter((item) => !item.temValores);

confere(TOTAL === RESUMO.totalIndicadores, `catálogo tem ${TOTAL} indicadores, metas.json diz ${RESUMO.totalIndicadores}`);
confere(METAS.length + FORA.length === TOTAL, 'metas avaliadas + fora do painel não fecham com o catálogo');
confere(METAS.length === RESUMO.metasAvaliadas, 'contagem de metas avaliadas diverge do resumo');
confere(COM_VALORES.length === RESUMO.comValores, 'contagem de indicadores com valores diverge do resumo');
confere(FORA_COM_VALORES.length === COM_VALORES.length - METAS.length, 'indicadores com valores sem meta avaliada não fecham');
for (const item of SEM_VALORES) confere(pendencia(PORCODIGO.get(item.codigo)), `${item.codigo} sem categoria de pendência (status: ${item.status})`);
for (const meta of METAS) {
  const cumprem = Object.values(meta.estados).filter((estado) => estado?.cumpre).length;
  confere(cumprem === meta.cumpridas, `${meta.codigo}: ${cumprem} estados cumprem, o arquivo diz ${meta.cumpridas}`);
}
if (metasDados.updatedAt !== painel.updatedAt) console.warn(`Aviso: metas.json (${metasDados.updatedAt}) e dashboard.json (${painel.updatedAt}) têm datas diferentes; a nota usa a do dashboard.`);

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

const esc = (valor) => String(valor ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const nf = (valor, casas = 1) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(valor);
const lista = (itens) => (itens.length < 2 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`);
const MESES = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
const hoje = new Date();
const DATA_NOTA = `${hoje.getDate()} ${MESES[hoje.getMonth()]} ${hoje.getFullYear()}`;
const DATA_DADOS = painel.updatedAt;
const NOME_UF = Object.fromEntries(metasDados.estados.map((estado) => [estado.uf, estado.name]));
const UFS = ['AC', 'AP', 'AM', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO'];
confere(UFS.every((uf) => NOME_UF[uf]), 'metas.json não traz os nove estados');

// Caminhos de arquivo citados nas notas viram endereço público.
const comEndereco = (texto) => String(texto || '').replace(/public\/data\/([\w./-]+)/g, `${SITE_CURTO}/data/$1`);

const ehPercentual = (meta) => { const unidade = String(meta.unidade || '').trim(); return unidade.startsWith('%') && !unidade.includes('/'); };

// Alvos redondos sem casas decimais ("40%", não "40,0%"); valores medidos com elas.
const nfi = (valor, casas) => nf(valor, Number.isInteger(valor) ? 0 : casas);

function valorMeta(meta, valor) {
  if (typeof valor === 'string') return valor;
  const unidade = String(meta.unidade || '').trim();
  if (meta.codigo === 'I1.3.2') return `${nf(valor, 0)} km²`;
  if (unidade === '% do PIB') return `${nfi(valor, 2)}% do PIB`;
  if (ehPercentual(meta)) return `${nfi(valor, 1)}%`;
  if (meta.codigo === 'I1.3.4') return `${nf(valor, 0)} focos`;
  if (unidade === 'taxa / 100 mil') return `${nfi(valor, 1)} por 100 mil hab.`;
  if (unidade === '0 a 100' || unidade.startsWith('pontos')) return `${nfi(valor, 1)} pontos`;
  throw new Error(`Nota técnica: não sei escrever a unidade "${meta.unidade}" de ${meta.codigo}`);
}

function distanciaMeta(meta, valor) {
  if (String(meta.unidade).trim() === '% do PIB') return `${nf(valor, 2)} ponto percentual do PIB`;
  if (ehPercentual(meta)) return `${nf(valor, 1)} pontos percentuais`;
  return valorMeta(meta, valor);
}

const TIPO_META = {
  declarada: { rotulo: 'Meta declarada', texto: 'o número está escrito na meta da Estratégia.' },
  inferida: { rotulo: 'Meta inferida', texto: 'a meta é qualitativa ou regional, e o painel a traduziu num patamar numérico. A tradução é uma leitura do painel, não um compromisso da Estratégia, e vem explicada na nota da meta.' },
  derivada: { rotulo: 'Meta derivada da baseline', texto: 'o alvo de cada estado é calculado a partir da sua própria série histórica — por exemplo, 30% abaixo da média do período de referência.' }
};

const MARCAS = {
  coletado: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="currentColor"/><path d="M4.8 8.5l2.2 2.2 4.2-5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  parcial: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 1.8a6.2 6.2 0 0 0 0 12.4z" fill="currentColor"/></svg>',
  pendente: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 4.6V8l2.2 1.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  manual: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 8h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
};
const selo = (classe) => `<span class="selo is-${classe}">${MARCAS[classe]}${SITUACOES[classe].rotulo}</span>`;

// ---------------------------------------------------------------------------
// Números da nota
// ---------------------------------------------------------------------------

const contagem = (itens, chave) => itens.reduce((mapa, item) => { const valor = chave(item); mapa[valor] = (mapa[valor] || 0) + 1; return mapa; }, {});
const PORSITUACAO = contagem(INDICADORES, situacao);
const PROXIES = COM_VALORES.filter(ehProxy);
const PORPENDENCIA = contagem(SEM_VALORES, (item) => pendencia(PORCODIGO.get(item.codigo)));
const S = painel.summary;

// ---------------------------------------------------------------------------
// Seções
// ---------------------------------------------------------------------------

function capa() {
  const logo = pathToFileURL(join(RAIZ, 'public', 'logo-consorcio-clara.avif')).href;
  return `
  <section class="capa">
    <div class="capa-topo">
      <img class="capa-logo" src="${logo}" alt="Consórcio da Amazônia Legal">
      <span class="marca"><span class="marca-nome"><small>Estratégia Regional</small><strong>Amazônia</strong></span><b class="marca-ano">2050</b></span>
    </div>
    <div class="capa-miolo">
      <p class="capa-tipo">Nota técnica do painel</p>
      <h1>Como o painel lê os dados</h1>
      <p class="capa-sub">Fontes, indicadores, métodos de cálculo e limites do painel de acompanhamento da Estratégia Regional Amazônia 2050 nos nove estados da Amazônia Legal.</p>
    </div>
    <dl class="capa-numeros">
      <div><dt>${TOTAL}</dt><dd>indicadores</dd></div>
      <div><dt>${catalogo.eixos.length}</dt><dd>eixos</dd></div>
      <div><dt>${UFS.length}</dt><dd>estados</dd></div>
      <div><dt>${METAS.length}</dt><dd>metas confrontadas<br>com os dados</dd></div>
    </dl>
    <div class="capa-rodape">
      <span>Dados atualizados em <strong>${esc(DATA_DADOS)}</strong></span>
      <span>Nota gerada em ${esc(DATA_NOTA)}</span>
      <span>${esc(SITE_CURTO)}</span>
    </div>
    <svg class="capa-rios" viewBox="0 0 210 90" preserveAspectRatio="none" aria-hidden="true">
      <path d="M-5 38 C 30 20, 62 58, 100 40 S 168 12, 215 30"/>
      <path d="M-5 52 C 34 34, 70 72, 110 54 S 172 28, 215 46"/>
      <path class="ocre" d="M-5 66 C 38 48, 76 86, 118 68 S 176 44, 215 62"/>
    </svg>
  </section>`;
}

function secaoObjetivo() {
  return `
  <section class="secao">
    <h2><span class="num">1</span>Objetivo do painel e desta nota</h2>
    <p>O painel acompanha a Estratégia Regional Amazônia 2050 nos nove estados da Amazônia Legal — ${lista(UFS.map((uf) => NOME_UF[uf]))}. Ele reúne, num só lugar, os valores que fontes públicas publicam para cada estado, a posição relativa de cada um e, quando a meta permite, a distância entre o valor atual e o alvo fixado na Estratégia.</p>
    <p>Esta nota explica de onde vêm os números, como o painel os organiza, calcula e compara, e o que eles ainda não permitem afirmar. Ela acompanha a versão dos dados de <strong>${esc(DATA_DADOS)}</strong> e é gerada a partir dos mesmos arquivos que alimentam o painel: as contagens e tabelas a seguir são as do painel nessa data.</p>
    <p>O painel não produz dados primários — todos os valores vêm das bases públicas citadas aqui ou são calculados a partir delas, como as taxas por área ou por habitante. Também não é uma avaliação de políticas públicas nem substitui a publicação da Estratégia, onde as metas estão na sua redação original.</p>

    <dl class="numeros">
      <div><dt>${UFS.length}</dt><dd>estados</dd></div>
      <div><dt>${nf(S.municipalities, 0)}</dt><dd>municípios</dd></div>
      <div><dt>${nf(S.population / 1e6, 1)} mi</dt><dd>habitantes (2025)</dd></div>
      <div><dt>${nf(S.territoryKm2 / 1e6, 2)} mi</dt><dd>km² de território</dd></div>
    </dl>

    <div class="caixa">
      <h3>Em resumo</h3>
      <ul>
        <li><strong>${TOTAL} indicadores</strong>, em ${catalogo.eixos.length} eixos, acompanham a Estratégia nos nove estados.</li>
        <li><strong>${COM_VALORES.length} têm valores</strong> para os estados: ${PORSITUACAO.coletado} coletados e ${COM_VALORES.length - PORSITUACAO.coletado} coletados em parte. Em ${PROXIES.length} deles o valor é uma medida aproximada (proxy) do que o indicador define.</li>
        <li><strong>${METAS.length} metas</strong> podem ser confrontadas com os dados na mesma unidade em que foram escritas. Outros ${FORA_COM_VALORES.length} indicadores têm valores, mas a meta ainda não permite essa comparação.</li>
        <li><strong>${SEM_VALORES.length} indicadores ainda não têm valores</strong>: ${esc(lista(Object.entries(PENDENCIAS).filter(([chave]) => PORPENDENCIA[chave]).map(([chave, item]) => item.resumo(PORPENDENCIA[chave]))))}.</li>
        <li>A síntese comparativa do Panorama é <strong>experimental e relativa</strong> aos nove estados: não mede desempenho absoluto nem substitui a avaliação das metas.</li>
      </ul>
    </div>

    <h3>As três páginas do painel</h3>
    <dl class="paginas">
      <div><dt>Panorama</dt><dd>Compara os estados indicador a indicador, com mapa, posição de 1 a 9, série histórica e a síntese comparativa experimental.</dd></div>
      <div><dt>Visão Geral</dt><dd>Apresenta a Estratégia, os seus eixos e o modo de ler os dados do painel.</dd></div>
      <div><dt>Metas e indicadores</dt><dd>Lista os ${TOTAL} indicadores com a ficha técnica de cada um e confronta ${METAS.length} metas com os dados.</dd></div>
    </dl>
  </section>`;
}

function secaoSituacao() {
  const ordem = ['coletado', 'parcial', 'pendente', 'manual'];
  const linhas = catalogo.eixos.map((eixo) => {
    const itens = INDICADORES.filter((indicador) => indicador.eixo === eixo.numero);
    const por = contagem(itens, situacao);
    const metas = itens.filter((indicador) => CODIGOS_META.has(indicador.codigo)).length;
    return `<tr><td><span class="eixo-num">${eixo.numero}</span>${esc(eixo.nome)}</td>${ordem.map((classe) => `<td class="n">${por[classe] || '—'}</td>`).join('')}<td class="n forte">${itens.length}</td><td class="n">${metas || '—'}</td></tr>`;
  }).join('');
  confere(ordem.reduce((soma, classe) => soma + (PORSITUACAO[classe] || 0), 0) === TOTAL, 'as situações não somam o total');
  return `
  <section class="secao junto">
    <h2><span class="num">2</span>Situação dos indicadores</h2>
    <p>Cada indicador do catálogo tem uma situação de coleta, a mesma que aparece no selo da ficha técnica no painel. Um indicador só entra nas comparações entre estados quando tem valores; só tem a meta avaliada quando, além disso, o valor e a meta estão na mesma unidade.</p>
    <table class="tabela situacao">
      <colgroup><col><col style="width:17mm"><col style="width:15mm"><col style="width:17mm"><col style="width:20mm"><col style="width:13mm"><col style="width:20mm"></colgroup>
      <thead><tr><th>Eixo</th>${ordem.map((classe) => `<th class="n">${SITUACOES[classe].rotulo}</th>`).join('')}<th class="n">Total</th><th class="n">Metas avaliadas</th></tr></thead>
      <tbody>${linhas}</tbody>
      <tfoot><tr><td>Total</td>${ordem.map((classe) => `<td class="n">${PORSITUACAO[classe] || '—'}</td>`).join('')}<td class="n">${TOTAL}</td><td class="n">${METAS.length}</td></tr></tfoot>
    </table>
    <dl class="legenda">
      ${ordem.map((classe) => `<div><dt>${selo(classe)}</dt><dd>${esc(SITUACOES[classe].descricao)}</dd></div>`).join('')}
    </dl>
  </section>`;
}

function secaoFontes() {
  const semValor = new Set(SEM_VALORES.map((item) => item.codigo));
  const soNoPanorama = METRICAS.filter((metrica) => semValor.has(CODIGO_DA_METRICA[metrica.chave]));
  const linhas = METRICAS.map((metrica) => {
    const anos = painel.metricYears[metrica.chave];
    const codigo = CODIGO_DA_METRICA[metrica.chave];
    const parciais = (anos?.parciais || []).map(String);
    let serie = 'retrato de um período';
    if (anos?.anos?.length) {
      const numeros = anos.anos.map(Number);
      serie = `${Math.min(...numeros)}–${Math.max(...numeros)}`;
      if (parciais.length) serie += ` <span class="obs">(${esc(lista(parciais))} parcial)</span>`;
    }
    const referencia = anos?.referencia != null ? String(anos.referencia) : (PORCODIGO.get(codigo)?.anoRef ?? '—');
    const refTexto = parciais.includes(referencia) ? `${esc(referencia)} <span class="obs">(parcial)</span>` : esc(referencia);
    return `<tr>
      <td><strong>${esc(metrica.rotulo)}</strong><span class="sub">${esc(metrica.descricao)}</span></td>
      <td>${esc(metrica.fonte)}</td>
      <td class="n">${serie}</td>
      <td class="n">${refTexto}</td>
      <td>${metrica.direcao === 'low' ? 'menor valor' : 'maior valor'}</td>
      <td class="cod">${esc(codigo ?? '—')}</td>
    </tr>`;
  }).join('');
  return `
  <section class="secao">
    <h2><span class="num">3</span>Fontes e períodos</h2>
    <p>Os valores vêm de bases públicas de órgãos federais e de institutos de pesquisa: ${esc(painel.methodology.sources)}</p>
    <p>A tabela lista os ${METRICAS.length} indicadores que o Panorama compara entre estados, com a fonte, os anos disponíveis na série, o ano mostrado por padrão e o sentido em que a posição é ordenada. Os demais indicadores com valores estão nas tabelas por eixo, na seção 4.</p>
    <table class="tabela fontes">
      <colgroup><col><col style="width:31mm"><col style="width:21mm"><col style="width:21mm"><col style="width:20mm"><col style="width:13mm"></colgroup>
      <thead><tr><th>Indicador do Panorama</th><th>Fonte</th><th class="n">Série</th><th class="n">Ano exibido</th><th>Melhor posição</th><th>Código</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table>
    <p class="rodape-tabela">“Parcial” indica um ano ainda em curso ou com dados incompletos na fonte. A frequência escolar de 15 a 17 anos complementa o indicador I2.3.2 (atendimento escolar de 4 a 17 anos) e não corresponde a um código do catálogo.${soNoPanorama.length ? ` ${esc(lista(soNoPanorama.map((metrica) => metrica.rotulo)))} ${soNoPanorama.length === 1 ? 'mostra' : 'mostram'} uma série relacionada a ${esc(lista([...new Set(soNoPanorama.map((metrica) => CODIGO_DA_METRICA[metrica.chave]))]))}, que ainda não tem o valor definido na ficha técnica (seção 8).` : ''}</p>
  </section>`;
}

function secaoEixos() {
  const tabelas = catalogo.eixos.map((eixo) => {
    const itens = INDICADORES.filter((indicador) => indicador.eixo === eixo.numero);
    const notas = [];
    const linhas = itens.map((indicador) => {
      const classe = situacao(indicador);
      let marca = '';
      const texto = indicador.valores ? qualificador(indicador) : null;
      if (texto) { notas.push({ codigo: indicador.codigo, texto }); marca = `<sup>${notas.length}</sup>`; }
      const referencia = indicador.valores && indicador.anoRef ? `<span class="ref">Referência: ${esc(indicador.anoRef)}</span>` : '';
      const extras = [
        CODIGOS_META.has(indicador.codigo) ? '<span class="etiqueta avaliada">Meta avaliada</span>' : '',
        indicador.valores && ehProxy(indicador) ? '<span class="etiqueta proxy">Proxy</span>' : ''
      ].join('');
      return `<tr>
        <td class="cod">${esc(indicador.codigo)}</td>
        <td><strong>${esc(indicador.nome)}</strong><span class="sub">${esc(indicador.meta)}</span></td>
        <td class="fonte">${esc(indicador.fonte)}${referencia}</td>
        <td class="n">${esc(indicador.prazo ?? '—')}</td>
        <td>${selo(classe)}${marca}${extras ? `<span class="etiquetas">${extras}</span>` : ''}</td>
      </tr>`;
    }).join('');
    const comValores = itens.filter((indicador) => indicador.valores).length;
    const metas = itens.filter((indicador) => CODIGOS_META.has(indicador.codigo)).length;
    return `
    <div class="eixo">
      <h3><span class="eixo-num">${eixo.numero}</span>${esc(eixo.nome)}</h3>
      <p class="eixo-conta">${itens.length} indicadores · ${comValores} com valores · ${metas} ${metas === 1 ? 'meta avaliada' : 'metas avaliadas'}</p>
      <table class="tabela eixo-tabela">
        <colgroup><col style="width:12mm"><col><col style="width:40mm"><col style="width:11mm"><col style="width:27mm"></colgroup>
        <thead><tr><th>Código</th><th>Indicador e meta da Estratégia</th><th>Fonte prevista</th><th class="n">Prazo</th><th>Situação</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      ${notas.length ? `<ol class="notas-tabela">${notas.map((nota) => `<li><strong>${esc(nota.codigo)}</strong> — ${esc(nota.texto)}</li>`).join('')}</ol>` : ''}
    </div>`;
  }).join('');
  return `
  <section class="secao quebra">
    <h2><span class="num">4</span>Indicadores por eixo</h2>
    <p>As tabelas listam os ${TOTAL} indicadores na ordem do catálogo da Estratégia, com a meta como está escrita, a fonte prevista na ficha técnica, o prazo e a situação da coleta. Quando há valores, a fonte traz o período de referência dos dados. As notas numeradas dizem o que foi efetivamente coletado quando a medida é aproximada ou incompleta.</p>
    ${tabelas}
  </section>`;
}

function secaoCalculo() {
  const grupos = new Map();
  for (const metrica of METRICAS) {
    const agregacao = AGREGACAO[metrica.chave];
    const chave = `${agregacao.rotulo}|${agregacao.nota || ''}`;
    if (!grupos.has(chave)) grupos.set(chave, { rotulos: [], rotulo: agregacao.rotulo, nota: agregacao.nota });
    grupos.get(chave).rotulos.push(metrica.rotulo);
  }
  const linhasAgregacao = [...grupos.values()].map((grupo) => `<tr>
    <td><strong>${esc(lista(grupo.rotulos))}</strong></td>
    <td>${esc(grupo.rotulo.charAt(0).toUpperCase() + grupo.rotulo.slice(1))}</td>
    <td class="obs-cel">${esc(comEndereco(grupo.nota || '—'))}</td>
  </tr>`).join('');

  const rotuloDe = Object.fromEntries(METRICAS.map((metrica) => [metrica.chave, metrica.rotulo]));
  const linhasPesos = PESOS.map((item) => `<tr>
    <td><strong>${esc(rotuloDe[item.chave])}</strong></td>
    <td>${esc(DIMENSAO[item.chave])}</td>
    <td class="n">${nf(item.peso * 100, 0)}%</td>
    <td>${item.direcao === 'low' ? 'menor valor recebe 100' : 'maior valor recebe 100'}</td>
  </tr>`).join('');
  const dimensoes = painel.methodology.dimensions.map((dimensao) => `<div><dt>${esc(dimensao.weight)}</dt><dd><strong>${esc(dimensao.name)}</strong>${esc(dimensao.indicators)}</dd></div>`).join('');

  return `
  <section class="secao quebra">
    <h2><span class="num">5</span>Como o painel calcula e compara os estados</h2>

    <h3>5.1 Valores por estado e posição</h3>
    <p>Para cada indicador, o Panorama mostra o valor que a fonte publica para cada estado no ano escolhido, sem ajuste nem preenchimento de lacunas: quando a fonte não traz o dado, o estado fica sem valor naquele ano. A posição de 1 a 9 ordena os estados pelo valor, no sentido indicado na tabela da seção 3 — para desmatamento, pobreza ou violência, o menor valor fica em primeiro.</p>
    <p>Parte dos indicadores é uma taxa — por mil km² de território ou por 100 mil habitantes — e permite comparar estados de portes muito diferentes. Outros, como o valor da produção extrativa e o da transformação industrial, são totais em reais e refletem também o tamanho de cada economia; neles, a posição diz mais sobre escala do que sobre desempenho.</p>

    <h3>5.2 Valor da Amazônia Legal</h3>
    <p>Quando o painel mostra um número para a região como um todo, ele é calculado a partir dos nove estados. Para as taxas, a média ponderada equivale a dividir o total da região pelo total da base — área desmatada sobre área da região, mortes sobre população. Quando a ponderação correta exigiria um dado que a base consolidada não tem, o painel usa média simples e diz isso.</p>
    <table class="tabela agregacao">
      <colgroup><col style="width:48mm"><col style="width:44mm"><col></colgroup>
      <thead><tr><th>Indicador</th><th>Como a região é calculada</th><th>Observação</th></tr></thead>
      <tbody>${linhasAgregacao}</tbody>
    </table>

    <h3>5.3 Síntese comparativa experimental</h3>
    <p>${esc(painel.methodology.text)}</p>
    <p>Cada um dos ${PESOS.length} indicadores é convertido numa nota de 0 a 100 pela posição do estado entre o menor e o maior valor dos nove:</p>
    <p class="formula">nota = 100 × (valor − mínimo) ÷ (máximo − mínimo)</p>
    <p>Nos indicadores em que menor é melhor, a escala é invertida: o menor valor recebe 100 e o maior, 0. Se os nove estados tiverem o mesmo valor, todos recebem 50. A síntese é a média das notas ponderada pelos pesos abaixo, arredondada para um número inteiro.</p>
    <table class="tabela pesos">
      <colgroup><col><col style="width:36mm"><col style="width:16mm"><col style="width:40mm"></colgroup>
      <thead><tr><th>Indicador</th><th>Dimensão</th><th class="n">Peso</th><th>Sentido</th></tr></thead>
      <tbody>${linhasPesos}</tbody>
    </table>
    <dl class="dimensoes">${dimensoes}</dl>
    <div class="caixa alerta">
      <h3>Como não ler a síntese</h3>
      <ul>
        <li><strong>100 quer dizer o melhor dos nove, não um bom resultado.</strong> A escala é relativa: se todos os estados estiverem longe da meta, o primeiro colocado ainda recebe 100.</li>
        <li><strong>A nota de um estado muda quando outro estado muda.</strong> Como o mínimo e o máximo vêm dos próprios nove, a melhora ou piora de um estado desloca a nota de todos.</li>
        <li><strong>Os pesos são uma escolha do painel</strong>, não da Estratégia, e os anos de referência dos indicadores não são os mesmos.</li>
        <li><strong>A síntese não avalia as metas.</strong> A distância até cada meta está na seção 6, calculada à parte e sem essa escala.</li>
      </ul>
    </div>
  </section>`;
}

function cartaoMeta(meta) {
  const tipo = TIPO_META[meta.tipo];
  confere(tipo, `${meta.codigo} tem tipo desconhecido "${meta.tipo}"`);
  const anoValor = meta.historico?.at(-1)?.ano ?? meta.anoRef;
  const referencia = /^média/i.test(meta.anoRef || '') || meta.anoRef === anoValor ? anoValor : meta.anoRef;

  let alvo;
  if (meta.direcao === 'categoria') alvo = '<strong>CAPAG A ou B</strong> em cada estado';
  else if (meta.alvoPorEstado) alvo = '<strong>Alvo próprio de cada estado</strong>, calculado a partir da sua série histórica';
  else if (meta.alvo === 0) alvo = '<strong>Zero</strong> em cada estado';
  else alvo = `<strong>${meta.direcao === 'maior' ? '≥' : '≤'} ${esc(valorMeta(meta, meta.alvo))}</strong> em cada estado`;

  const cumprem = UFS.filter((uf) => meta.estados[uf]?.cumpre);
  const estados = cumprem.length ? esc(cumprem.join(', ')) : 'nenhum estado';

  let regional;
  if (meta.regional) {
    const r = meta.regional;
    const situacaoRegional = r.cumpre ? 'atinge o alvo' : `faltam ${esc(distanciaMeta(meta, r.distancia))}`;
    regional = `<p class="valor"><strong>${esc(valorMeta(meta, r.valor))}</strong> <span>alvo ${esc(valorMeta(meta, r.alvo))} · ${situacaoRegional}</span></p><p class="metodo">${esc(r.metodoRotulo.charAt(0).toUpperCase() + r.metodoRotulo.slice(1))}.</p>`;
  } else {
    regional = `<p class="metodo">${esc((meta.agregacaoRotulo || 'sem valor regional').replace(/^./, (letra) => letra.toUpperCase()))}.</p>`;
  }

  const notas = [meta.nota, meta.regional?.nota, NOTAS_EXTRA[meta.codigo]].filter(Boolean);
  return `
  <article class="meta-card">
    <header>
      <span class="cod">${esc(meta.codigo)}</span>
      <h4>${esc(meta.nome)}</h4>
      <span class="tipo tipo-${meta.tipo}">${esc(tipo.rotulo)}</span>
    </header>
    <div class="meta-grade">
      <div>
        <p class="rotulo">Meta da Estratégia · prazo ${esc(meta.prazo)}</p>
        <p class="meta-texto">${esc(meta.metaTexto)}</p>
        <p class="rotulo">Alvo usado pelo painel</p>
        <p>${alvo}</p>
      </div>
      <div class="resultado">
        <p class="rotulo">Estados que atingem o alvo · dados de ${esc(referencia)}</p>
        <p class="valor"><strong>${meta.cumpridas} de ${meta.avaliados}</strong> <span>${estados}</span></p>
        <p class="rotulo">Amazônia Legal</p>
        ${regional}
      </div>
    </div>
    ${notas.length ? `<footer>${notas.map((nota) => `<p>${esc(nota)}</p>`).join('')}</footer>` : ''}
    <p class="meta-fonte">Fonte: ${esc(meta.fonte)}</p>
  </article>`;
}

function secaoMetas() {
  const comRegional = METAS.filter((meta) => meta.regional).length;
  const prazos = [...new Set(METAS.map((meta) => meta.prazo))].sort((a, b) => a - b);
  const prazosTexto = prazos.length < 2 ? String(prazos[0]) : `${prazos.slice(0, -1).join(', ')} ou ${prazos.at(-1)}`;
  return `
  <section class="secao quebra">
    <h2><span class="num">6</span>Metas confrontadas com os dados</h2>
    <p>Dos ${TOTAL} indicadores, o painel confronta a meta de ${METAS.length} com os dados: são os que têm valores para os estados na mesma unidade em que a meta está escrita, ou em que ela pode ser escrita sem arbitrariedade. Os demais aparecem no painel com a ficha técnica e a situação da coleta, sem avaliação. Cada meta avaliada recebe um tipo:</p>
    <dl class="tipos">
      ${Object.entries(TIPO_META).map(([chave, tipo]) => `<div><dt><span class="tipo tipo-${chave}">${esc(tipo.rotulo)}</span></dt><dd>${esc(tipo.texto.charAt(0).toUpperCase() + tipo.texto.slice(1))}</dd></div>`).join('')}
    </dl>
    <p>Um estado atinge o alvo quando o valor mais recente está do lado certo dele — igual ou acima, nas metas de aumento; igual ou abaixo, nas de redução. A distância é quanto falta, na unidade do indicador. Quando existe um ponto de partida comparável, o painel mostra também o percurso já feito desde ele; quando não existe, mostra a posição do valor em relação ao alvo. A meta de capacidade de pagamento (CAPAG) é uma classificação e é lida por faixa.</p>
    <p>O valor da Amazônia Legal usa o método de agregação indicado em cada meta, e ${comRegional} das ${METAS.length} metas têm valor regional. Atingir o alvo no agregado não equivale a atingi-lo em cada estado, e vice-versa.</p>
    <p class="destaque">As metas avaliadas têm prazo em ${prazosTexto}. Comparar o valor de hoje com o alvo mostra a distância a percorrer — não indica descumprimento de uma meta cujo prazo ainda não chegou.</p>
    <div class="metas">${METAS.map(cartaoMeta).join('')}</div>
  </section>`;
}

function secaoLimitacoes() {
  const rotuloDe = Object.fromEntries(METRICAS.map((metrica) => [metrica.chave, metrica.rotulo]));
  const parciaisPorMetrica = METRICAS
    .map((metrica) => ({ rotulo: metrica.rotulo, parciais: (painel.metricYears[metrica.chave]?.parciais || []).map(String) }))
    .filter((item) => item.parciais.length);
  const parciaisPorAno = new Map();
  for (const item of parciaisPorMetrica) {
    for (const ano of item.parciais) {
      if (!parciaisPorAno.has(ano)) parciaisPorAno.set(ano, []);
      parciaisPorAno.get(ano).push(item.rotulo);
    }
  }
  const textoParciais = [...parciaisPorAno.entries()].map(([ano, rotulos]) => `Os dados de ${ano} ainda são parciais em ${lista(rotulos)}.`).join(' ');
  const mediasSimples = METRICAS.filter((metrica) => /^média simples/.test(AGREGACAO[metrica.chave].rotulo)).map((metrica) => metrica.rotulo);
  const inferidas = METAS.filter((meta) => meta.tipo === 'inferida').map((meta) => meta.codigo);
  const derivadas = METAS.filter((meta) => meta.tipo === 'derivada').map((meta) => meta.codigo);
  const escolhas = [
    inferidas.length ? `${inferidas.length} ${inferidas.length === 1 ? 'foi inferida' : 'foram inferidas'} (${lista(inferidas)}), por não trazerem um patamar aplicável a cada estado` : '',
    derivadas.length ? `${derivadas.length} ${derivadas.length === 1 ? 'teve' : 'tiveram'} o alvo de cada estado derivado da série histórica (${lista(derivadas)})` : ''
  ].filter(Boolean);

  const series = new Map();
  for (const metrica of METRICAS) {
    const nota = AGREGACAO[metrica.chave].notaSerie;
    if (!nota) continue;
    if (!series.has(nota)) series.set(nota, []);
    series.get(nota).push(rotuloDe[metrica.chave]);
  }

  return `
  <section class="secao">
    <h2><span class="num">7</span>Limitações</h2>
    <ul class="limites">
      <li><strong>Medidas aproximadas.</strong> Em ${PROXIES.length} indicadores o valor é uma proxy do que a ficha técnica define: ${esc(lista(PROXIES.map((indicador) => `${indicador.codigo} (${indicador.nome})`)))}. A nota de cada um, na seção 4, diz qual é a medida usada.</li>
      <li><strong>Desmatamento ilegal.</strong> ${esc(NOTAS_EXTRA['I1.3.2'])}</li>
      <li><strong>Anos de referência diferentes.</strong> Cada fonte tem o seu calendário de publicação, e o painel mostra o último ano disponível em cada uma. Comparar indicadores entre si é comparar anos diferentes. ${esc(textoParciais)}</li>
      <li><strong>Agregações aproximadas.</strong> Em ${esc(lista(mediasSimples))}, o valor da região é a média simples dos estados, porque o peso correto não está na base consolidada (seção 5.2).</li>
      ${escolhas.length ? `<li><strong>Metas operacionalizadas pelo painel.</strong> ${inferidas.length + derivadas.length} das ${METAS.length} metas avaliadas dependem de uma escolha do painel: ${esc(lista(escolhas))}. Outra leitura da mesma meta pode levar a outro resultado; a nota de cada cartão, na seção 6, explica a escolha.</li>` : ''}
      <li><strong>Síntese relativa.</strong> A síntese comparativa depende dos pesos adotados e da distância entre os nove estados, e não de um padrão externo (seção 5.3).</li>
      <li><strong>Revisões das fontes.</strong> As fontes revisam os seus números. O painel reflete o que estava publicado na data de atualização dos dados, ${esc(DATA_DADOS)}.</li>
    </ul>
    <h3>Particularidades das séries históricas</h3>
    <dl class="series">
      ${[...series.entries()].map(([nota, rotulos]) => `<div><dt>${esc(lista(rotulos))}</dt><dd>${esc(comEndereco(nota))}</dd></div>`).join('')}
    </dl>
  </section>`;
}

function secaoPendencias() {
  const blocos = Object.entries(PENDENCIAS).map(([chave, pendenciaTipo]) => {
    const itens = SEM_VALORES.filter((item) => pendencia(PORCODIGO.get(item.codigo)) === chave);
    if (!itens.length) return '';
    const lista = chave === 'panorama'
      ? `<ul class="codigos explicados">${itens.map((item) => `<li><span class="cod">${esc(item.codigo)}</span><strong>${esc(item.nome)}</strong><span class="sub">${esc(comEndereco(notaDoPanorama(item.codigo)))}</span></li>`).join('')}</ul>`
      : `<ul class="codigos">${itens.map((item) => `<li><span class="cod">${esc(item.codigo)}</span>${esc(item.nome)}</li>`).join('')}</ul>`;
    return `
    <div class="pendencia">
      <h3>${esc(pendenciaTipo.titulo)} <span class="conta">${itens.length}</span></h3>
      <p>${esc(pendenciaTipo.texto)}</p>
      ${lista}
    </div>`;
  }).join('');
  const excluidas = FORA_COM_VALORES.map((item) => {
    const indicador = PORCODIGO.get(item.codigo);
    return `<tr><td class="cod">${esc(item.codigo)}</td><td><strong>${esc(item.nome)}</strong><span class="sub">${esc(item.metaTexto)}</span></td><td>${selo(situacao(indicador))}</td><td>${esc(item.motivo)}</td></tr>`;
  }).join('');
  return `
  <section class="secao quebra">
    <h2><span class="num">8</span>Pendências</h2>
    <p>${SEM_VALORES.length} dos ${TOTAL} indicadores ainda não têm valores para os estados. Eles aparecem no painel com a ficha técnica e o selo de situação. Abaixo, estão agrupados pelo que falta para coletá-los.</p>
    ${blocos}
    <h3>Indicadores com valores, mas sem meta confrontável</h3>
    <p>Nestes ${FORA_COM_VALORES.length} indicadores há valores para os estados, mas a meta, como está escrita, não permite dizer se um estado a atinge. O painel mostra os valores e explica o motivo, em vez de adotar uma leitura própria da meta.</p>
    <table class="tabela excluidas">
      <colgroup><col style="width:12mm"><col style="width:62mm"><col style="width:24mm"><col></colgroup>
      <thead><tr><th>Código</th><th>Indicador e meta</th><th>Situação</th><th>Por que a meta não é avaliada</th></tr></thead>
      <tbody>${excluidas}</tbody>
    </table>
  </section>`;
}

function secaoDados() {
  const readme = readFileSync(join(RAIZ, 'public', 'data', 'csv', 'README.md'), 'utf8');
  const csvs = [...readme.matchAll(/^\| `([^`]+)` \| [^|]+\| ([^|]+) \|$/gm)].map(([, arquivo, conteudo]) => ({ arquivo, conteudo: conteudo.trim() }));
  confere(csvs.length > 0, 'não li nenhum CSV do README de public/data/csv');
  for (const csv of csvs) confere(existsSync(join(RAIZ, 'public', 'data', 'csv', csv.arquivo)), `${csv.arquivo} está no README mas não na pasta`);

  const planilhas = catalogo.eixos
    .map((eixo) => ({ eixo, arquivo: `Indicadores_Resultado_Eixo${eixo.numero}_Amazonia2050.xlsx` }))
    .filter((item) => existsSync(join(RAIZ, 'public', 'downloads', item.arquivo)));

  const jsons = [
    ['catalogo.json', `os ${TOTAL} indicadores, com meta, fonte, prazo, situação e valores por estado`],
    ['metas.json', `as ${METAS.length} metas avaliadas, com o alvo, o resultado por estado e o regional, e os demais indicadores com o motivo`],
    ['dashboard.json', 'os valores e as séries do Panorama por estado e a síntese comparativa'],
    ['fichas.json', 'as fichas técnicas dos indicadores']
  ].filter(([arquivo]) => existsSync(join(RAIZ, 'public', 'data', arquivo)));

  return `
  <section class="secao">
    <h2><span class="num">9</span>Atualização e dados abertos</h2>
    <p>Os dados desta versão foram atualizados em <strong>${esc(DATA_DADOS)}</strong>. Esta nota é gerada a partir dos mesmos arquivos que o painel usa, abertos para consulta e reúso em ${esc(SITE_CURTO)}:</p>
    <table class="tabela arquivos">
      <colgroup><col style="width:80mm"><col></colgroup>
      <thead><tr><th>Endereço</th><th>Conteúdo</th></tr></thead>
      <tbody>
        ${jsons.map(([arquivo, conteudo]) => `<tr><td class="arq">/data/<strong>${esc(arquivo)}</strong></td><td>${esc(conteudo.charAt(0).toUpperCase() + conteudo.slice(1))}</td></tr>`).join('')}
        ${planilhas.map((item) => `<tr><td class="arq">/downloads/<strong>${esc(item.arquivo)}</strong></td><td>Planilha de resultados do eixo ${item.eixo.numero} — ${esc(item.eixo.nome)}</td></tr>`).join('')}
      </tbody>
    </table>
    <h3>Recortes de detalhe</h3>
    <p>Município, divisão da atividade econômica, produto e competência mensal ficam em arquivos CSV à parte, em ${esc(SITE_CURTO)}/data/csv/:</p>
    <table class="tabela arquivos">
      <colgroup><col style="width:58mm"><col></colgroup>
      <thead><tr><th>Arquivo</th><th>Conteúdo</th></tr></thead>
      <tbody>${csvs.map((csv) => `<tr><td class="arq">${esc(csv.arquivo)}</td><td>${esc(csv.conteudo)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="colofao">O painel tem versão em inglês; esta nota está disponível apenas em português. Ela é gerada a partir dos arquivos de dados do painel na data indicada na capa, e as contagens e tabelas refletem essa versão.</p>
  </section>`;
}

// ---------------------------------------------------------------------------
// Estilo
// ---------------------------------------------------------------------------

const cssTexto = (texto) => `"${String(texto).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const CSS = `
@page {
  size: A4;
  margin: 21mm 17mm 19mm;
  @top-left { content: ${cssTexto('Nota técnica · Painel da Estratégia Regional Amazônia 2050')}; font: 500 7pt "Libre Franklin", Arial, sans-serif; color: #5c544c; vertical-align: bottom; padding-bottom: 5mm; }
  @top-right { content: ${cssTexto(`Dados de ${DATA_DADOS}`)}; font: 500 7pt "Libre Franklin", Arial, sans-serif; color: #5c544c; vertical-align: bottom; padding-bottom: 5mm; }
  @bottom-left { content: ${cssTexto(SITE_CURTO)}; font: 500 7pt "Libre Franklin", Arial, sans-serif; color: #5c544c; vertical-align: top; padding-top: 5mm; }
  @bottom-right { content: counter(page) " / " counter(pages); font: 600 7.5pt "Libre Franklin", Arial, sans-serif; color: #0e2b22; vertical-align: top; padding-top: 5mm; }
}
@page :first {
  margin: 0;
  @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; }
}
:root {
  --mata: #0e2b22; --mata-700: #1c4437; --mata-500: #3e6e57; --mata-300: #7fa08c; --mata-100: #c6d2c7;
  --ocre: #e0a83c; --urucum: #c0451f; --areia: #f5f0e8; --tinta: #1a1613; --tinta-3: #5c544c; --linha: #ddd3c6;
  --display: "Bricolage Grotesque", "Segoe UI", Arial, sans-serif;
  --text: "Libre Franklin", "Segoe UI", Arial, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font: 400 9pt/1.5 var(--text); color: var(--tinta); -webkit-print-color-adjust: exact; print-color-adjust: exact; hyphens: auto; }
p { margin: 0 0 2.6mm; max-width: 158mm; orphans: 3; widows: 3; }
strong { font-weight: 600; }

/* Capa */
.capa { position: relative; width: 210mm; height: 297mm; overflow: hidden; break-after: page; background: var(--mata); color: var(--areia); padding: 22mm 20mm 18mm; display: flex; flex-direction: column; }
.capa-topo { display: flex; align-items: center; gap: 7mm; }
.capa-logo { width: 52mm; height: auto; display: block; }
.marca { display: flex; align-items: center; gap: 3.4mm; padding-left: 6mm; border-left: .4mm solid rgba(245, 240, 232, .22); white-space: nowrap; }
.marca-nome { display: grid; gap: 1.2mm; }
.marca-nome small { font: 600 7pt/1 var(--text); letter-spacing: .16em; text-transform: uppercase; color: var(--mata-100); }
.marca-nome strong { font: 800 15pt/1 var(--display); letter-spacing: -.02em; }
.marca-ano { font: 800 33pt/.78 var(--display); letter-spacing: -.045em; color: var(--ocre); }
.capa-miolo { margin-top: 62mm; }
.capa-tipo { margin: 0 0 6mm; font: 600 8.5pt var(--text); letter-spacing: .2em; text-transform: uppercase; color: var(--ocre); }
.capa-tipo::before { content: ""; display: inline-block; width: 10mm; height: .5mm; margin-right: 3.5mm; vertical-align: middle; background: var(--ocre); }
.capa h1 { margin: 0 0 7mm; max-width: 150mm; font: 800 40pt/1.02 var(--display); letter-spacing: -.035em; }
.capa-sub { max-width: 132mm; font: 400 12pt/1.5 var(--text); color: rgba(245, 240, 232, .78); }
.capa-numeros { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, auto); justify-content: start; gap: 12mm; margin: auto 0 11mm; padding-top: 7mm; border-top: .3mm solid rgba(245, 240, 232, .2); }
.capa-numeros div { margin: 0; }
.capa-numeros dt { font: 800 25pt/1 var(--display); letter-spacing: -.03em; color: var(--areia); }
.capa-numeros dd { margin: 1.6mm 0 0; font: 500 7.5pt/1.35 var(--text); letter-spacing: .06em; text-transform: uppercase; color: var(--mata-100); }
.capa-rodape { position: relative; z-index: 1; display: flex; gap: 8mm; font: 400 8pt var(--text); color: rgba(245, 240, 232, .66); }
.capa-rodape strong { color: var(--areia); font-weight: 600; }
.capa-rodape span + span::before { content: ""; display: inline-block; width: 1mm; height: 1mm; margin-right: 8mm; border-radius: 50%; background: var(--ocre); vertical-align: middle; }
.capa-rios { position: absolute; left: 0; right: 0; top: 118mm; width: 210mm; height: 90mm; z-index: 0; fill: none; stroke: rgba(198, 210, 199, .16); stroke-width: .35; }
.capa-rios .ocre { stroke: rgba(224, 168, 60, .42); }

/* Seções */
.secao + .secao { margin-top: 9mm; }
/* Seções longas começam em página nova; a de situação não se parte, para o
   título não ficar sozinho no pé da página. */
.quebra { break-before: page; }
.secao + .secao.quebra { margin-top: 0; }
.junto { break-inside: avoid; }
/* O fio ocre é fundo do próprio título, e não um bloco antes dele: assim os
   dois nunca ficam em páginas diferentes. */
h2 { margin: 0 0 4.5mm; padding-top: 5.1mm; font: 800 17pt/1.15 var(--display); letter-spacing: -.025em; color: var(--mata); background: linear-gradient(var(--ocre), var(--ocre)) no-repeat 0 0 / 12mm 1.1mm; break-after: avoid; break-inside: avoid; }
h2 .num { margin-right: 3mm; color: var(--ocre); }
h3 { margin: 6mm 0 2.4mm; font: 700 11pt/1.25 var(--display); letter-spacing: -.01em; color: var(--mata); break-after: avoid; }
h4 { margin: 0; font: 700 10pt/1.25 var(--display); color: var(--mata); }
.secao > h3:first-of-type { margin-top: 5mm; }

.numeros { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin: 5mm 0 5mm; padding: 4mm 0; border-top: .3mm solid var(--linha); border-bottom: .3mm solid var(--linha); }
.numeros div { margin: 0; }
.numeros dt { font: 800 17pt/1 var(--display); letter-spacing: -.02em; color: var(--mata); }
.numeros dd { margin: 1.4mm 0 0; font: 500 7pt/1.3 var(--text); letter-spacing: .06em; text-transform: uppercase; color: var(--tinta-3); }

.caixa { margin: 4mm 0 2mm; padding: 4mm 5mm 3mm; background: var(--areia); border-left: .9mm solid var(--ocre); break-inside: avoid; }
.caixa h3 { margin: 0 0 2mm; }
.caixa ul { margin: 0; padding-left: 4.2mm; }
.caixa li { margin-bottom: 1.6mm; }
.caixa.alerta { border-left-color: var(--urucum); margin-top: 5mm; }

.paginas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; margin: 0; }
.paginas div { margin: 0; padding-top: 2.4mm; border-top: .5mm solid var(--mata); }
.paginas dt { font: 700 9.5pt var(--display); color: var(--mata); margin-bottom: 1mm; }
.paginas dd { margin: 0; font-size: 8.2pt; color: var(--tinta-3); }

/* Tabelas */
.tabela { width: 100%; border-collapse: collapse; margin: 3mm 0 2.4mm; font-size: 7.7pt; line-height: 1.38; table-layout: fixed; }
.tabela thead { display: table-header-group; }
.tabela tfoot { display: table-row-group; }
.tabela tr { break-inside: avoid; }
.tabela th { text-align: left; vertical-align: bottom; font: 600 6.3pt/1.25 var(--text); letter-spacing: .08em; text-transform: uppercase; color: var(--tinta-3); padding: 0 2mm 1.6mm 0; border-bottom: .45mm solid var(--mata); }
.tabela td { padding: 1.8mm 2mm 1.8mm 0; border-bottom: .2mm solid var(--linha); vertical-align: top; overflow-wrap: anywhere; hyphens: auto; }
.tabela td:last-child, .tabela th:last-child { padding-right: 0; }
.tabela .n { text-align: right; font-variant-numeric: tabular-nums; }
.tabela th.n { text-align: right; }
.tabela strong { font-weight: 600; color: var(--tinta); }
.tabela .sub { display: block; margin-top: .6mm; color: var(--tinta-3); }
.tabela .cod { font: 600 7.2pt var(--text); color: var(--mata-500); white-space: nowrap; }
.tabela .fonte { color: var(--tinta-3); }
.tabela .ref { display: block; margin-top: .8mm; color: var(--mata-700); font-weight: 500; }
.tabela .obs { color: var(--tinta-3); font-size: 6.8pt; }
.tabela .obs-cel { color: var(--tinta-3); }
.tabela .arq { font-size: 7.2pt; color: var(--tinta-3); overflow-wrap: anywhere; }
.tabela .arq strong { color: var(--mata); }
.tabela tfoot td { font-weight: 600; border-top: .45mm solid var(--mata); border-bottom: 0; }
.situacao td:first-child { font-weight: 500; }
.situacao .forte { font-weight: 600; }
.eixo-num { display: inline-flex; align-items: center; justify-content: center; width: 5mm; height: 5mm; margin-right: 2.2mm; border-radius: 50%; background: var(--mata); color: var(--areia); font: 700 7pt/1 var(--display); vertical-align: .3mm; }
h3 .eixo-num { width: 6.2mm; height: 6.2mm; font-size: 8.5pt; vertical-align: .5mm; }
.rodape-tabela { font-size: 7.5pt; color: var(--tinta-3); max-width: none; }
/* A tabela de fontes tem de caber em duas páginas com a nota de rodapé junto. */
.fontes td { padding-top: 1.4mm; padding-bottom: 1.4mm; }

.selo { display: inline-flex; align-items: center; gap: 1.2mm; font-weight: 600; white-space: nowrap; }
.selo svg { width: 3mm; height: 3mm; flex: none; }
.selo.is-coletado { color: var(--mata-700); }
.selo.is-parcial { color: #76550e; }
.selo.is-pendente { color: #8e3213; }
.selo.is-manual { color: var(--tinta-3); }
.tabela sup { font-size: 6pt; font-weight: 600; color: var(--mata-700); margin-left: .6mm; }
.etiquetas { display: flex; flex-wrap: wrap; gap: 1mm; margin-top: 1.2mm; }
.etiqueta { display: inline-block; padding: .3mm 1.4mm; border-radius: .8mm; font: 600 6pt/1.4 var(--text); letter-spacing: .04em; text-transform: uppercase; }
.etiqueta.avaliada { background: var(--mata); color: var(--areia); }
.etiqueta.proxy { background: #f3e6c9; color: #76550e; }

.legenda { display: grid; grid-template-columns: 1fr 1fr; gap: 2.4mm 6mm; margin: 3mm 0 0; font-size: 7.8pt; }
.legenda div { display: grid; grid-template-columns: 25mm 1fr; margin: 0; }
.legenda dt { font-size: 7.7pt; }
.legenda dd { margin: 0; color: var(--tinta-3); }

.eixo { margin-top: 6mm; }
.eixo h3 { margin-bottom: 1mm; }
.eixo-conta { margin: 0 0 1mm; font-size: 7.5pt; color: var(--tinta-3); letter-spacing: .02em; }
.notas-tabela { margin: 1.6mm 0 0; padding-left: 4.5mm; font-size: 7.2pt; line-height: 1.4; color: var(--tinta-3); columns: 1; }
.notas-tabela li { margin-bottom: .9mm; break-inside: avoid; }
.notas-tabela li::marker { font-weight: 600; color: var(--mata-700); }
.notas-tabela strong { color: var(--tinta); }

.formula { margin: 3mm 0 3.4mm; padding: 3mm 0; text-align: center; font: 600 11pt var(--display); color: var(--mata); background: var(--areia); max-width: none; }
.dimensoes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4mm; margin: 3mm 0 0; }
.dimensoes div { margin: 0; padding-top: 2mm; border-top: .5mm solid var(--mata); }
.dimensoes dt { font: 800 15pt/1 var(--display); color: var(--mata); }
.dimensoes dd { margin: 1.4mm 0 0; font-size: 7.4pt; color: var(--tinta-3); }
.dimensoes dd strong { display: block; color: var(--tinta); font-weight: 600; }

/* Metas */
.tipos { margin: 2mm 0 3.4mm; display: grid; gap: 2mm; }
.tipos div { display: grid; grid-template-columns: 42mm 1fr; margin: 0; align-items: start; }
.tipos dd { margin: 0; font-size: 8.4pt; }
.tipo { display: inline-block; padding: .5mm 1.8mm; border-radius: .9mm; font: 600 6.6pt/1.4 var(--text); letter-spacing: .04em; text-transform: uppercase; white-space: nowrap; }
.tipo-declarada { background: #e1eae3; color: var(--mata-700); }
.tipo-inferida { background: #f3e6c9; color: #76550e; }
.tipo-derivada { background: #ebe4f1; color: #4a2a6a; }
.destaque { padding: 2.6mm 4mm; border-left: .9mm solid var(--mata); background: #eef2ee; font-weight: 500; max-width: none; }
.metas { margin-top: 4mm; }
.meta-card { break-inside: avoid; margin: 0 0 3.6mm; padding: 3.2mm 4mm 2.6mm; border: .25mm solid var(--linha); border-top: .8mm solid var(--mata); }
.meta-card header { display: flex; align-items: baseline; gap: 2.6mm; margin-bottom: 2.4mm; }
.meta-card header .cod { font: 600 7.6pt var(--text); color: var(--mata-500); }
.meta-card header h4 { flex: 1; }
.meta-grade { display: grid; grid-template-columns: 1.3fr 1fr; gap: 6mm; }
.meta-grade p { margin: 0 0 1.8mm; font-size: 8.2pt; }
.meta-grade .rotulo { margin: 0 0 .6mm; font: 600 6.2pt/1.3 var(--text); letter-spacing: .08em; text-transform: uppercase; color: var(--tinta-3); }
.meta-texto { color: var(--tinta); }
.resultado { padding-left: 5mm; border-left: .25mm solid var(--linha); }
.resultado .valor strong { font: 800 12.5pt/1.1 var(--display); color: var(--mata); margin-right: 1.4mm; }
.resultado .valor span { color: var(--tinta-3); }
.resultado .metodo { color: var(--tinta-3); font-size: 7.4pt; }
.meta-card footer { margin-top: 1mm; padding-top: 2mm; border-top: .2mm dashed var(--linha); }
.meta-card footer p { margin: 0 0 1.2mm; font-size: 7.6pt; color: var(--tinta-3); max-width: none; }
.meta-card footer p::before { content: "Nota · "; font-weight: 600; color: var(--mata-700); }
.meta-fonte { margin: .6mm 0 0; font-size: 6.9pt; color: var(--mata-300); max-width: none; }

/* Limitações e pendências */
.limites { margin: 0; padding-left: 4.4mm; max-width: 162mm; }
.limites li { margin-bottom: 2.2mm; break-inside: avoid; }
.series { margin: 0; display: grid; gap: 2.4mm; }
.series div { display: grid; grid-template-columns: 40mm 1fr; gap: 4mm; margin: 0; padding-top: 2mm; border-top: .2mm solid var(--linha); break-inside: avoid; }
.series dt { font-weight: 600; font-size: 8pt; color: var(--mata); }
.series dd { margin: 0; font-size: 8pt; color: var(--tinta-3); }
.pendencia { break-inside: avoid; }
.pendencia h3 .conta { display: inline-block; min-width: 6mm; margin-left: 1.6mm; padding: .2mm 1.6mm; border-radius: 3mm; background: var(--mata); color: var(--areia); font: 700 7.5pt/1.5 var(--text); text-align: center; vertical-align: .6mm; }
.pendencia > p { font-size: 8.4pt; color: var(--tinta-3); }
.codigos { list-style: none; margin: 0 0 2mm; padding: 0; columns: 2; column-gap: 7mm; font-size: 7.8pt; }
.codigos li { break-inside: avoid; padding: .8mm 0; border-bottom: .2mm solid var(--linha); }
.codigos .cod { display: inline-block; width: 12mm; font-weight: 600; color: var(--mata-500); }
.codigos.explicados { columns: 1; }
.codigos.explicados li { padding: 1.4mm 0 1.4mm 12mm; text-indent: -12mm; }
.codigos.explicados .sub { display: block; text-indent: 0; margin-top: .6mm; color: var(--tinta-3); font-size: 7.4pt; }
.colofao { margin-top: 6mm; padding-top: 3mm; border-top: .2mm solid var(--linha); font-size: 7.6pt; color: var(--tinta-3); }
`;

const HTML = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Nota técnica · Painel da Estratégia Regional Amazônia 2050</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=Libre+Franklin:wght@400;500;600;700&display=block" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
${capa()}
<main>
${secaoObjetivo()}
${secaoSituacao()}
${secaoFontes()}
${secaoEixos()}
${secaoCalculo()}
${secaoMetas()}
${secaoLimitacoes()}
${secaoPendencias()}
${secaoDados()}
</main>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Saída
// ---------------------------------------------------------------------------

const pastaTemporaria = mkdtempSync(join(tmpdir(), 'nota-tecnica-'));
const arquivoHtml = htmlPedido ? resolve(htmlPedido) : join(pastaTemporaria, 'nota-tecnica.html');
mkdirSync(dirname(arquivoHtml), { recursive: true });
writeFileSync(arquivoHtml, HTML, 'utf8');
console.log(`HTML: ${arquivoHtml}`);

if (!semPdf) {
  const candidatos = [
    process.env.NAVEGADOR_PDF,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  const navegador = candidatos.find((caminho) => existsSync(caminho));
  confere(navegador, 'nenhum Edge ou Chrome encontrado; indique o caminho em NAVEGADOR_PDF');

  mkdirSync(dirname(SAIDA), { recursive: true });
  const antes = existsSync(SAIDA) ? statSync(SAIDA).mtimeMs : 0;
  // Perfil próprio para não se juntar a uma janela do navegador já aberta; o
  // orçamento de tempo dá às fontes do Google a chance de chegar antes da impressão.
  execFileSync(navegador, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--user-data-dir=${join(pastaTemporaria, 'perfil')}`,
    '--no-pdf-header-footer',
    '--virtual-time-budget=20000',
    `--print-to-pdf=${SAIDA}`,
    pathToFileURL(arquivoHtml).href
  ], { stdio: 'inherit' });
  confere(existsSync(SAIDA) && statSync(SAIDA).mtimeMs > antes, 'o navegador não gravou o PDF');
  console.log(`PDF: ${SAIDA} (${Math.round(statSync(SAIDA).size / 1024)} KB)`);
}
