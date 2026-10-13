// Coleta a carteira de projetos que o Consórcio publica para a COP30 em
// https://www.brazilianamazonprojects.com e grava conteudo/projetos.json, a
// fonte da página /projetos. Ferramenta de trabalho: não entra no build.
//
// Uso: node scripts/coletar-projetos.mjs
//   PLAYWRIGHT_PATH=…   playwright (ou playwright-core) fora do projeto
//   CHROME_PATH=…       executável do Chromium, quando o playwright não acha o seu
//   COLETA_CACHE=…      pasta para guardar o que já foi baixado; rodar de novo
//                       com ela não repete os pedidos ao site
//
// O site é um Wix sem API aberta nem planilha, então a leitura é pelas páginas:
//
//   1. o sitemap dá o endereço de todos os projetos;
//   2. /projetoscop30?estado=UF lista os projetos de cada estado. Esse filtro é
//      aplicado no navegador (o HTML do servidor traz sempre os cem primeiros),
//      por isso o passo precisa de um navegador de verdade. É dele que sai a UF,
//      o único campo estruturado: "beneficiários" é texto livre, com 45 grafias;
//   3. a página de cada projeto dá o texto, de onde sai o resumo, e a foto
//      (a imagem de compartilhamento, `og:image`), quando o projeto tem uma.
//      As fotos são baixadas já reduzidas para public/fotos-projetos/: o
//      painel não busca nada fora dele em tempo de execução.
//
// O tema que o site mostra (Saúde, Educação…) não chega a página nenhuma: o
// clique num tema abre o mapa e o mapa filtra só por estado. O que o painel
// usa no lugar é o eixo da Estratégia (`eixo`), lido aqui por palavras-chave e
// corrigível à mão: rodar de novo preserva `eixo`, `par`, `oculto` e o título
// marcado com `tituloCurado` de quem já está no arquivo.
//
// O site traz cada ficha numa língua só, e a página mostra a do seletor. A
// outra vem de `traducao`, escrita à mão no arquivo: rodar de novo a preserva
// campo a campo, enquanto o texto do site for o mesmo. Projeto novo ou texto
// alterado saem sem ela, e o fim da coleta diz quantos ficaram assim.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPOS_DE_TEXTO, linguasSemTraducao } from '../pipeline/projetos.mjs';

const require = createRequire(import.meta.url);
const SITE = 'https://www.brazilianamazonprojects.com';
const SAIDA = fileURLToPath(new URL('../conteudo/projetos.json', import.meta.url));
const FOTOS = fileURLToPath(new URL('../public/fotos-projetos/', import.meta.url));
const UFS = ['AC', 'AP', 'AM', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO'];
const AGENTE = 'Mozilla/5.0 (painel Estrategia Amazonia 2050; coleta da carteira de projetos)';
const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const apara = (valor) => String(valor ?? '').replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim();

// Um pedido por vez e com folga: o site responde 429 a rajadas. Quando ele
// pede para esperar (Retry-After), espera-se o que ele pediu. `confere` recusa
// a resposta que veio sem o que se foi buscar: um endereço que o site não
// reconhece volta com status 200 e a página vazia.
const FOLGA_MS = 2500;
async function baixa(url, confere = () => true, tentativas = 6) {
  for (let i = 1; ; i += 1) {
    let pausa = 5000 * i;
    try {
      const resposta = await fetch(url, { headers: { 'User-Agent': AGENTE } });
      if (resposta.status === 429) pausa = Math.max(30000 * i, Number(resposta.headers.get('retry-after')) * 1000 || 0);
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      const texto = await resposta.text();
      if (!confere(texto)) { pausa = 30000 * i; throw new Error('resposta incompleta'); }
      return texto;
    } catch (erro) {
      if (i >= tentativas) throw new Error(`${url}: ${erro.message}`);
      await espera(pausa);
    }
  }
}

// Guarda em disco o que já foi lido, para ajustar a leitura sem voltar ao site.
const CACHE = process.env.COLETA_CACHE || '';
const arquivoDoCache = (chave) => join(CACHE, `${createHash('sha1').update(chave).digest('hex').slice(0, 16)}.json`);
async function comCache(chave, busca) {
  if (!CACHE) return busca();
  const guardado = await readFile(arquivoDoCache(chave), 'utf8').then(JSON.parse).catch(() => null);
  if (guardado) return guardado.valor;
  const valor = await busca();
  await mkdir(CACHE, { recursive: true });
  await writeFile(arquivoDoCache(chave), JSON.stringify({ chave, valor }));
  return valor;
}

const desfazEntidades = (texto) => texto
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, codigo) => String.fromCodePoint(Number(codigo)));

// ---------- 1. sitemap ----------
async function enderecos() {
  const indice = await baixa(`${SITE}/sitemap.xml`);
  const doSitemap = [...indice.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).find((loc) => loc.includes('projetoscop30'));
  if (!doSitemap) throw new Error('O sitemap não lista mais a coleção de projetos.');
  const xml = await baixa(doSitemap);
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => desfazEntidades(m[1]));
}
// O endereço vem ora codificado, ora não; o trecho depois da última barra, decodificado, identifica o projeto.
const idDe = (url) => {
  const trecho = url.slice(url.indexOf('/projetoscop30/') + '/projetoscop30/'.length);
  try { return decodeURIComponent(trecho); } catch { return trecho; }
};

// ---------- 2. cartões por estado (navegador) ----------
const ROTULOS = { 'Leading entity': 'entidade', Beneficiaries: 'beneficiarios', 'Priority areas': 'areas', Duration: 'duracao', 'Budget Range (USD)': 'orcamento' };

const cartoesPorEstado = async () => new Map(await comCache('cartoes-por-estado', async () => [...(await leCartoesPorEstado())]));

async function leCartoesPorEstado() {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const pagina = await browser.newPage({ viewport: { width: 1280, height: 900 }, userAgent: AGENTE });
  const porId = new Map();
  try {
    for (const uf of UFS) {
      await pagina.goto(`${SITE}/projetoscop30?estado=${uf}`, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
      // O filtro entra depois da carga: a lista começa com os cem primeiros e encolhe.
      let cartoes = [];
      for (let volta = 0; volta < 20; volta += 1) {
        await pagina.waitForTimeout(1500);
        const agora = await pagina.evaluate(() => [...document.querySelectorAll('.wixui-repeater__item')].map((item) => ({
          linhas: item.innerText.split('\n').map((linha) => linha.trim()).filter(Boolean),
          url: item.querySelector('a[href*="/projetoscop30/"]')?.href || ''
        })));
        const estavel = agora.length === cartoes.length && agora.length < 100;
        cartoes = agora;
        if (estavel && volta >= 3) break;
      }
      if (cartoes.length >= 100) throw new Error(`${uf}: o filtro por estado não entrou (a lista ficou com ${cartoes.length} itens).`);
      for (const { linhas, url } of cartoes) {
        if (!url) continue;
        const id = idDe(url);
        const cartao = porId.get(id) || { ufs: [] };
        // O cartão é uma pilha de rótulos e valores; título e valores podem
        // quebrar em várias linhas, então cada trecho vai até o rótulo seguinte.
        let campo = 'titulo';
        const trechos = { titulo: [] };
        for (const linha of linhas) {
          if (linha === 'Title') continue;
          if (linha === 'Read More') break;
          if (ROTULOS[linha]) { campo = ROTULOS[linha]; trechos[campo] = []; continue; }
          trechos[campo].push(linha);
        }
        for (const [nome, partes] of Object.entries(trechos)) cartao[nome] = apara(partes.join(' '));
        if (!cartao.ufs.includes(uf)) cartao.ufs.push(uf);
        porId.set(id, cartao);
      }
      console.log(`  ${uf}: ${cartoes.length} projetos`);
    }
  } finally {
    await browser.close();
  }
  return porId;
}

// ---------- 3. página do projeto ----------
function linhasDaPagina(html) {
  const corpo = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ');
  return desfazEntidades(corpo.replace(/<[^>]+>/g, '\n')).split('\n').map(apara).filter(Boolean);
}
const temCorpo = (html) => linhasDaPagina(html).includes('< Back');
function leProjeto(html) {
  const linhas = linhasDaPagina(html);
  const inicio = linhas.indexOf('< Back');
  let fim = linhas.indexOf('Previous', inicio);
  if (fim < 0) fim = linhas.indexOf('Next', inicio);
  if (fim < 0) fim = linhas.findIndex((linha) => linha.startsWith('Consórcio Amazônia Legal -'));
  const miolo = inicio >= 0 ? linhas.slice(inicio + 1, fim > inicio ? fim : undefined) : [];
  return { titulo: miolo[0] || '', entidade: miolo[1] || '', texto: miolo.slice(2) };
}

// A foto do projeto é a imagem de compartilhamento da página. O endereço traz
// o identificador da mídia no Wix, e o próprio servidor de imagens a devolve
// recortada e reduzida: 800×450 basta para o cartão e pesa dezenas de kB, onde
// o original passa de 2 mil pixels.
function fotoDe(html) {
  const meta = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  const midia = meta && desfazEntidades(meta[1]).match(/static\.wixstatic\.com\/media\/([^/]+)\//);
  return midia ? midia[1] : null;
}
const arquivoDaFoto = (midia) => `${midia.replace(/~mv2\.\w+$/, '')}.jpg`;
async function baixaFoto(midia) {
  const destino = join(FOTOS, arquivoDaFoto(midia));
  const jaTem = await readFile(destino).then(() => true).catch(() => false);
  if (jaTem) return;
  const resposta = await fetch(`https://static.wixstatic.com/media/${midia}/v1/fill/w_800,h_450,al_c,q_78/foto.jpg`, { headers: { 'User-Agent': AGENTE } });
  if (!resposta.ok || !(resposta.headers.get('content-type') || '').startsWith('image/')) throw new Error(`foto ${midia}: HTTP ${resposta.status}`);
  await mkdir(FOTOS, { recursive: true });
  await writeFile(destino, Buffer.from(await resposta.arrayBuffer()));
  await espera(400);
}

// Cabeçalhos do formulário da carteira, nas duas línguas: o resumo é o que vem depois de "Objetivo".
const EH_OBJETIVO = /^(\d+\.\s*)?(objetivo|objective)\b/i;
const EH_CABECALHO = /^(\d+\.\s*)?(desafio|challenge|contexto|context|objetivo|objective|n[ií]ve(l|is)|levels?|impact|resultad|result|produto|output|governan|projetos\/|related|integra[cç][aã]o de g[eê]nero|gender|sustainable development)/i;
// Instrução do próprio formulário, que alguns proponentes deixaram no texto.
const INSTRUCAO = /^(briefly present|apresente brevemente|descreva brevemente|briefly describe)[^.]*\.\s*/i;
// Rótulo que sobra no começo do parágrafo ("Objetivo principal: …", "a) Objective …").
const ROTULO_INICIAL = /^(\w\)\s*)?(objetivo principal|objetivo geral|main objective|objective|objetivo|impact level|n[ií]vel de impacto)\s*:?\s+/i;
const LIMITE_DO_RESUMO = 360;
function resumoDe(texto) {
  const linhas = texto.filter((linha) => linha.length > 2);
  const posicao = linhas.findIndex((linha) => EH_OBJETIVO.test(linha));
  let trecho = [];
  if (posicao >= 0) {
    // O cabeçalho às vezes já traz o texto ("Objetivo: implantar…"); quando é só
    // o título da seção ("Objetivo, impacto esperado, resultados"), não entra.
    const cabeca = linhas[posicao];
    const depois = cabeca.includes(':') ? apara(cabeca.slice(cabeca.indexOf(':') + 1)) : '';
    if (depois.length > 40) trecho.push(depois);
    for (const linha of linhas.slice(posicao + 1)) {
      if (EH_CABECALHO.test(linha) && linha.length < 120) { if (trecho.length) break; continue; }
      trecho.push(linha);
      if (trecho.join(' ').length > LIMITE_DO_RESUMO + 80) break;
    }
  }
  if (trecho.join(' ').length < 60) trecho = linhas.filter((linha) => linha.length > 60 && !EH_CABECALHO.test(linha)).slice(0, 2);
  const limpo = apara(trecho.join(' ').replace(/^[:,\-–\s]+/, '').replace(INSTRUCAO, '').replace(ROTULO_INICIAL, ''));
  const junto = limpo.charAt(0).toUpperCase() + limpo.slice(1);
  if (junto.length <= LIMITE_DO_RESUMO) return junto;
  const corte = junto.slice(0, LIMITE_DO_RESUMO);
  const fimDeFrase = corte.lastIndexOf('. ');
  if (fimDeFrase > 160) return corte.slice(0, fimDeFrase + 1);
  return `${corte.slice(0, corte.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
}

// ---------- normalização ----------
const numeroDe = (pedaco) => Number(pedaco.replace(/[.,]\d{2}$/, '').replace(/[.,\s]/g, ''));
/**
 * As seis faixas do formulário da carteira. O campo é texto livre no site
 * (44 grafias, com erros como "$3,5000,000"), então a faixa é lida pelo piso
 * quando há dois números e pelo teto quando há um só.
 */
export const FAIXAS = [
  { chave: 'ate-500k', teto: 500_000 },
  { chave: '500k-1m', teto: 1_000_000 },
  { chave: '1m-3.5m', teto: 3_500_000 },
  { chave: '3.5m-5m', teto: 5_000_000 },
  { chave: '5m-10m', teto: 10_000_000 },
  { chave: 'acima-10m', teto: Infinity }
];
export function faixaDe(texto) {
  let limpo = apara(texto);
  // "R$ 80.000,00 ≈ USD 13.865,00": vale o valor em dólar.
  if (/R\$/.test(limpo) && /USD/i.test(limpo)) limpo = limpo.slice(limpo.search(/USD/i));
  const numeros = (limpo.match(/\d[\d.,]*\d|\d/g) || []).map(numeroDe).filter((n) => Number.isFinite(n) && n > 0)
    // "Até $500.000,000" é 500 mil com um zero a mais; nenhuma faixa passa de dezenas de milhões.
    .map((n) => (n > 100_000_000 ? n / 1000 : n));
  if (!numeros.length) return null;
  if (/acima|above|over|more than/i.test(limpo)) return 'acima-10m';
  if (numeros.length >= 2) {
    const piso = numeros[0];
    return [...FAIXAS].reverse().find((faixa, i, lista) => piso > (lista[i + 1]?.teto ?? 0))?.chave || 'ate-500k';
  }
  return FAIXAS.find((faixa) => numeros[0] <= faixa.teto).chave;
}
export function mesesDe(texto) {
  const achado = apara(texto).match(/\d+/);
  if (!achado) return null;
  const numero = Number(achado[0]);
  return numero > 0 && numero <= 240 ? numero : null;
}
const PORTUGUES = /[ãõçáàâéêíóôú]|\b(de|da|do|das|dos|para|com|e|em|na|no|projeto|programa)\b/i;
const idiomaDe = (texto) => {
  const palavras = apara(texto).toLowerCase().split(' ');
  const pt = palavras.filter((p) => /[ãõç]|^(de|da|do|das|dos|para|com|em|na|no|projeto|programa|uma|que|ao|à|pelo|pela)$/.test(p)).length;
  const en = palavras.filter((p) => /^(the|of|and|for|in|with|to|project|program|through|by|on|from)$/.test(p)).length;
  if (pt === en) return PORTUGUES.test(texto) && !/\b(the|of|and)\b/i.test(texto) ? 'pt' : 'en';
  return pt > en ? 'pt' : 'en';
};

// Leitura do eixo por palavras-chave, na ordem: o primeiro grupo que casar
// vale. É uma primeira passada; o que ficar errado se corrige no JSON.
const EIXOS = [
  [5, /fiscal|tribut|tax |planejamento|planning|governan[çc]a (?!da terra|ambiental|e restaura)|transpar|comunica[çc][ãa]o|communication|anti.?money|lavagem/i],
  [4, /saneamento|sanitation|res[íi]duos|waste|energia|energy|conectividade|connectivity|satelital|transporte|transport|log[íi]stic|infraestrutura|infrastructure|[áa]gua para todos|water for all|po[çc]os|wells|biodigest|irriga[çc]/i],
  [1, /inc[êe]ndio|wildfire|fire|queimada|floresta|forest|ambient|environment|clima|climate|fundi[áa]ri|land |territ[óo]ri|car[- ]pct|redd|reflorest|reforest|conserva[çc]|biodiversidade|biodiversity|bacia|watershed|nascentes|spring|peixe.?boi|manatee|sentinel|biomas/i],
  [3, /agricultur|agro|cacau|cocoa|caf[ée]|coffee|bioeconomi|pesca|fish|aquicultur|oyster|ostra|turismo|tourism|inova[çc][ãa]o|innovation|export|produtor|biof[áa]brica|biojoias|cadeias|value chains|economia criativa|creative economy|desenvolvimento rural/i],
  [2, /sa[úu]de|health|educa[çc]|school|escola|seguran[çc]a|security|pol[íi]cia|police|ind[íi]gena|indigenous|cultur|mulheres|women|falciforme|hemoterapia|alfabetiza/i]
];
const eixoDe = (projeto) => {
  const texto = `${projeto.titulo} ${projeto.entidade} ${projeto.resumo}`;
  return EIXOS.find(([, padrao]) => padrao.test(texto))?.[0] ?? null;
};

// A tradução vale para o texto que foi traduzido: o campo cujo texto mudou no
// site perde a dele, nas duas línguas.
function traducaoQueVale(antes, projeto) {
  const saida = {};
  for (const [lingua, campos] of Object.entries(antes?.traducao || {})) {
    const validos = Object.entries(campos).filter(([campo]) => CAMPOS_DE_TEXTO.includes(campo) && antes[campo] === projeto[campo]);
    if (validos.length) saida[lingua] = Object.fromEntries(validos);
  }
  return Object.keys(saida).length ? saida : null;
}

// ---------- montagem ----------
async function main() {
  const anterior = await readFile(SAIDA, 'utf8').then(JSON.parse).catch(() => ({ projetos: [] }));
  const curadoria = new Map((anterior.projetos || []).map((projeto) => [projeto.id, projeto]));

  console.log('Lendo o sitemap...');
  const urls = await enderecos();
  console.log(`  ${urls.length} projetos`);

  console.log('Lendo os cartões por estado (navegador)...');
  const cartoes = await cartoesPorEstado();

  console.log('Lendo a página de cada projeto...');
  const projetos = [];
  for (const [i, url] of urls.entries()) {
    const id = idDe(url);
    let daRede = false;
    // O endereço vai como o sitemap o publica: recodificá-lo estraga os que têm
    // vírgula ou dois-pontos, e o site responde 200 com a página sem o projeto.
    const html = await comCache(`pagina:${id}`, () => { daRede = true; return baixa(url, temCorpo); });
    const pagina = leProjeto(html);
    const cartao = cartoes.get(id) || { ufs: [] };
    let titulo = apara(cartao.titulo || pagina.titulo);
    let texto = pagina.texto;
    // Algumas fichas têm o texto inteiro colado no campo do título; aí o projeto
    // é apresentado pelo órgão. Um título só comprido não é esse caso.
    const tituloEhTexto = titulo.length > 400;
    if (tituloEhTexto) { texto = [titulo, ...texto]; titulo = ''; }
    const entidade = apara(cartao.entidade || pagina.entidade);
    const resumo = resumoDe(texto);
    const projeto = {
      id,
      url,
      titulo,
      tituloAusente: tituloEhTexto || !titulo || undefined,
      entidade,
      ufs: cartao.ufs,
      beneficiarios: cartao.beneficiarios || '',
      areas: cartao.areas || '',
      duracaoMeses: mesesDe(cartao.duracao || ''),
      duracaoOriginal: cartao.duracao || '',
      faixa: faixaDe(cartao.orcamento || ''),
      orcamentoOriginal: cartao.orcamento || '',
      resumo,
      idioma: idiomaDe(`${titulo} ${resumo}`)
    };
    const midia = fotoDe(html);
    if (midia) {
      await baixaFoto(midia);
      projeto.foto = `/fotos-projetos/${arquivoDaFoto(midia)}`;
    }
    const antes = curadoria.get(id);
    projeto.eixo = antes?.eixo ?? eixoDe(projeto);
    if (antes?.par) projeto.par = antes.par;
    if (antes?.oculto) projeto.oculto = antes.oculto;
    if (antes?.tituloCurado) { projeto.titulo = antes.titulo; projeto.tituloCurado = true; delete projeto.tituloAusente; }
    const traducao = traducaoQueVale(antes, projeto);
    if (traducao) projeto.traducao = traducao;
    projetos.push(projeto);
    if ((i + 1) % 20 === 0) console.log(`  ${i + 1} de ${urls.length}`);
    if (daRede) await espera(FOLGA_MS);
  }

  const saida = {
    _leia: 'Carteira de projetos que o Consórcio da Amazônia Legal publica para a COP30, lida do site em `fonte.url` por scripts/coletar-projetos.mjs. O texto é o do site, na língua em que cada projeto foi escrito (`idioma`); `traducao` traz, por língua (`pt`, `en`), o `titulo`, a `entidade` e o `resumo` que o site não escreveu nela, e é do painel, escrita à mão: a página mostra só a língua do seletor. `ufs`, `faixa` e `duracaoMeses` são a leitura normalizada; `foto` aponta a cópia reduzida em public/fotos-projetos/ (só parte dos projetos tem foto no site); `beneficiarios`, `orcamentoOriginal` e `duracaoOriginal` guardam o que o site diz. `eixo` é a leitura do painel (o site não publica o tema de cada projeto) e pode ser corrigido aqui: rodar a coleta de novo preserva `eixo`, `par` (o id do mesmo projeto escrito na outra língua), `oculto`, o título marcado com `tituloCurado` e a `traducao` dos campos cujo texto não mudou no site.',
    fonte: { nome: 'Brazilian Amazon Projects — Consórcio Interestadual da Amazônia Legal', url: SITE, coletadoEm: new Date().toLocaleDateString('sv-SE') },
    projetos
  };
  await writeFile(SAIDA, `${JSON.stringify(saida, null, 2)}\n`);
  const semUf = projetos.filter((projeto) => !projeto.ufs.length).length;
  console.log(`Gravado conteudo/projetos.json: ${projetos.length} projetos, ${projetos.filter((p) => p.foto).length} com foto, ${semUf} sem estado, ${projetos.filter((p) => !p.faixa).length} sem faixa de orçamento, ${projetos.filter((p) => p.eixo === null).length} sem eixo.`);
  const semTraducao = projetos.filter((projeto) => linguasSemTraducao(projeto).length);
  if (semTraducao.length) {
    console.log(`${semTraducao.length} sem tradução (aparecem na língua do site, com o aviso, até \`traducao\` ser preenchida):`);
    for (const projeto of semTraducao) console.log(`  [${projeto.idioma}] ${projeto.titulo || projeto.id}`);
  }
}

const invocadoDireto = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invocadoDireto) {
  main().catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  });
}
