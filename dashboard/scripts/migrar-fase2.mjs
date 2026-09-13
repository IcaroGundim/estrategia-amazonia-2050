// Migração única da fase 2: leva para `conteudo/` o que ainda estava em código.
//
//   panorama.json   ganha, por métrica, rótulo, subtítulo, descrição, fonte,
//                   formato de exibição, método de agregação e as notas — tudo
//                   com o inglês ao lado (chave `en`), tirado do dicionário.
//   textos.json     ganha os textos da Visão Geral e a metodologia com inglês.
//   catalogo.json   ganha o inglês dos eixos, das linhas de ação e dos indicadores
//                   (antes em public/data/i18n/en.json).
//   fichas.json     ganha o inglês das equações e notas de fórmula por ficha.
//
// Lê o `metrics` e o `AGREGACAO` de src/scripts/app.js pelo texto, como a nota
// técnica fazia, e o inglês de src/i18n/en.js e public/data/i18n/en.json.
//
//   node scripts/migrar-fase2.mjs   (a partir de dashboard/)
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appRoot, conteudoRoot, gravaJson, publicRoot } from '../pipeline/fonte.mjs';
import { en } from '../src/i18n/en.js';

const leJson = async (caminho) => JSON.parse(await readFile(caminho, 'utf8'));
const ingles = (pt) => (pt && en[pt] && en[pt] !== pt ? en[pt] : null);
const par = (pt) => ({ pt, en: ingles(pt) });
const movidas = new Set();
const move = (pt) => { if (ingles(pt)) movidas.add(pt); return ingles(pt); };

// ---------- panorama.json ----------

const appJs = await readFile(join(appRoot, 'src', 'scripts', 'app.js'), 'utf8');
function bloco(abertura) {
  const inicio = appJs.indexOf(abertura);
  if (inicio < 0) throw new Error(`não achei "${abertura}" em app.js`);
  return appJs.slice(inicio, appJs.indexOf('\n};', inicio));
}
function campo(linha, nome) {
  const achado = linha.match(new RegExp(`\\b${nome}: '((?:[^'\\\\]|\\\\.)*)'`));
  return achado ? achado[1].replace(/\\'/g, "'") : null;
}
const FORMATO = {
  prodesRate: 'km2PorMilKm2', heatRate: 'porMilKm2', poverty: 'pct1', school: 'pct1', cvliRate: 'porCemMil',
  apsCobertura: 'pct1', vulnerability: 'num1', conservationManaged: 'pct0', ibc: 'pontos1', perRenovavel: 'pct1',
  isgr: 'pct1', pevsBilhoes: 'reaisBi', piaBilhoes: 'reaisBi', idebAnosIniciais: 'num1', idebAnosFinais: 'num1',
  idebEnsinoMedio: 'num1', pdPctPib: 'pct2'
};
const apresentacao = new Map(bloco('const metrics = {').split('\n')
  .filter((linha) => /^\s+\w+: \{ label:/.test(linha))
  .map((linha) => {
    const chave = linha.match(/^\s+(\w+):/)[1];
    const rotulo = campo(linha, 'label');
    const subtitulo = campo(linha, 'subtitle');
    const descricao = campo(linha, 'description');
    const fonte = campo(linha, 'source');
    if (!FORMATO[chave]) throw new Error(`sem formato para ${chave}`);
    return [chave, {
      rotulo, subtitulo, descricao, fonte, formato: FORMATO[chave],
      en: { rotulo: move(rotulo), subtitulo: move(subtitulo), descricao: move(descricao), fonte: move(fonte) }
    }];
  }));
const agregacoes = new Map(bloco('const AGREGACAO = {').split('\n')
  .filter((linha) => /^\s+\w+: \{ (peso|metodo):/.test(linha))
  .map((linha) => {
    const chave = linha.match(/^\s+(\w+):/)[1];
    const pesoBruto = linha.match(/\bpeso: (null|'(\w+)')/);
    const metodo = campo(linha, 'metodo');
    const rotulo = campo(linha, 'rotulo');
    const nota = campo(linha, 'nota');
    const notaSerie = campo(linha, 'notaSerie');
    const agregacao = { rotulo };
    if (metodo) agregacao.metodo = metodo; else agregacao.peso = pesoBruto?.[2] ?? null;
    if (nota) agregacao.nota = nota;
    if (notaSerie) agregacao.notaSerie = notaSerie;
    // O rótulo do método é compartilhado com as metas e continua no dicionário;
    // só as notas, que são só do Panorama, saem dele.
    agregacao.en = { rotulo: ingles(rotulo), nota: nota ? move(nota) : null, notaSerie: notaSerie ? move(notaSerie) : null };
    return [chave, agregacao];
  }));

const panorama = await leJson(join(conteudoRoot, 'panorama.json'));
const ordemSeletor = [...apresentacao.keys()];
const porChave = new Map(panorama.metricas.map((metrica) => [metrica.chave, metrica]));
const metricas = [];
for (const chave of ordemSeletor) {
  const base = porChave.get(chave);
  if (!base) throw new Error(`${chave} está no seletor mas não em panorama.json`);
  metricas.push({ ...base, seletor: true, ...apresentacao.get(chave), agregacao: agregacoes.get(chave) });
}
for (const metrica of panorama.metricas) {
  if (!apresentacao.has(metrica.chave)) metricas.push({ ...metrica, seletor: false });
}
panorama._leia = 'Métricas do mapa e da síntese comparativa. Cada métrica declara o cálculo (tipo taxa/serie/valor, referência, parciais, rank), a apresentação (rotulo, subtitulo, descricao, fonte, formato) e a agregação regional (peso ou metodo, rotulo, nota, notaSerie), com o inglês em `en`. A ordem do array é a ordem do seletor; seletor:false tira a métrica do menu. formato: km2PorMilKm2, porMilKm2, porCemMil, pct0, pct1, pct2, num1, num2, pontos1, reaisBi.';
panorama.metricas = metricas;
await gravaJson('panorama.json', panorama);

// ---------- textos.json ----------

const textos = await leJson(join(conteudoRoot, 'textos.json'));
const metodologia = textos.panorama.metodologia;
textos.panorama.metodologia = {
  title: par(metodologia.title), text: par(metodologia.text), sources: par(metodologia.sources),
  dimensions: metodologia.dimensions.map((dimensao) => ({ name: par(dimensao.name), weight: dimensao.weight, indicators: par(dimensao.indicators) }))
};
for (const pt of [metodologia.title, metodologia.text, metodologia.sources, ...metodologia.dimensions.flatMap((d) => [d.name, d.indicators])]) move(pt);

const lista = (itens) => itens.map((item) => Object.fromEntries(Object.entries(item).map(([k, v]) => [k, typeof v === 'string' && !/^\d+$/.test(v) ? par(v) : v])));
const marca = (itens) => itens.forEach((item) => Object.values(item).forEach((v) => typeof v === 'string' && move(v)));
const P = (pt) => { move(pt); return par(pt); };
textos.visaoGeral = {
  estrategia: {
    tituloLinha1: P('Estratégia Regional'),
    tituloLinha2: P('Amazônia 2050'),
    abertura: P('O instrumento de planejamento de longo prazo da Amazônia Legal. Define uma visão compartilhada para 2050, organizada por temas e eixos estratégicos, metas, indicadores e uma estrutura de governança para orientar investimentos e políticas públicas nos nove estados.'),
    numeros: [
      { valor: '09', rotulo: P('estados consorciados') },
      { valor: '06', rotulo: P('temas estratégicos') },
      { valor: '2050', rotulo: P('horizonte pactuado') }
    ],
    fechamento: P('A Estratégia consolida uma agenda sistêmica orientada por resultados, capaz de alinhar desenvolvimento produtivo, conservação ambiental e bem-estar social.'),
    botaoPdf: { rotulo: P('Abrir a Estratégia em PDF'), href: 'https://7a98d2b3-3159-4136-8ede-0281e5e3b6ee.filesusr.com/ugd/8edb8f_58edf9f14c4f4be6bd8eb47156aa448b.pdf' }
  },
  visao2050: {
    chapeu: P('O horizonte'),
    titulo: P('A visão regional para 2050'),
    selo: P('Visão 2050'),
    paragrafos: [
      P('Em 2050, a Amazônia Legal terá alcançado o desenvolvimento regional sustentável e a resiliência climática, conciliando conservação ambiental, crescimento econômico e justiça social. A região será reconhecida pelo equilíbrio entre produção e conservação, pela valorização de seus ativos ambientais e pela melhoria dos indicadores socioeconômicos.'),
      P('Os saberes e modos de vida dos povos e comunidades tradicionais serão preservados, assegurando qualidade de vida, inclusão e contribuição efetiva para a estabilidade climática global.')
    ],
    subChapeu: P('Na prática'),
    subTitulo: P('Como a Estratégia auxilia os estados'),
    lista: [
      P('Alinha a visão de longo prazo ao planejamento governamental de médio prazo.'),
      P('Subsidia a revisão e a formulação de PPAs, LDOs e planos setoriais.'),
      P('Dá coerência entre as prioridades estaduais e a agenda regional.'),
      P('Fortalece a articulação com a União, organismos multilaterais e financiadores.'),
      P('Qualifica a priorização de investimentos estruturantes.')
    ]
  },
  temas: {
    chapeu: P('Estrutura da Estratégia'),
    titulo: P('Seis temas estratégicos'),
    abertura: P('Os temas organizam as prioridades regionais e servem de referência para a leitura dos indicadores deste painel.'),
    itens: lista([
      { numero: '01', titulo: 'Integração regional', texto: 'Ordenamento territorial, segurança fundiária, conectividade física e digital e cooperação interestadual e transfronteiriça.' },
      { numero: '02', titulo: 'Sistemas produtivos sustentáveis', texto: 'Uma economia de baixo carbono, inovadora e centrada na sociobiodiversidade, gerando valor e renda a partir da floresta em pé.' },
      { numero: '03', titulo: 'Soluções baseadas na natureza', texto: 'Valorização econômica dos ativos ambientais, com conservação, restauração e uso sustentável dos ecossistemas.' },
      { numero: '04', titulo: 'Transição energética', texto: 'A Amazônia como polo de inovação em energia limpa, ampliando o acesso à energia renovável.' },
      { numero: '05', titulo: 'Inclusão social e resiliência', texto: 'Redução de desigualdades, acesso a serviços essenciais e resiliência das populações frente às mudanças climáticas.' },
      { numero: '06', titulo: 'Infraestrutura sustentável', texto: 'Infraestrutura física, logística e digital integrada e resiliente, respeitando os limites socioambientais.' }
    ])
  },
  governanca: {
    chapeu: P('Implementação'),
    titulo: P('Governança e próximos passos'),
    itens: lista([
      { titulo: 'Priorização e aderência', texto: 'Consolidar e validar as prioridades estaduais, com aderência à realidade de cada território.' },
      { titulo: 'Qualificação de projetos', texto: 'Mapear os projetos prioritários, identificando maturidade, gargalos e oportunidades.' },
      { titulo: 'Compatibilização institucional', texto: 'Integrar a Estratégia aos PPAs, LDOs, LOAs e planos setoriais.' },
      { titulo: 'Articulação transversal', texto: 'Articular secretarias finalísticas e áreas técnicas entre as agendas.' },
      { titulo: 'Interdependência regional', texto: 'Incorporar a lógica regional ao planejamento estadual.' },
      { titulo: 'Monitoramento e avaliação', texto: 'Acompanhar a Estratégia e manter indicadores e metas atualizados.' }
    ]),
    fluxo: [
      P('Definição de prioridades regionais'),
      P('Compatibilização com os PPAs estaduais'),
      P('Desdobramento em LDO, LOA e planos setoriais'),
      P('Monitoramento e avaliação regional')
    ]
  },
  estePainel: {
    chapeu: P('Este painel'),
    titulo: P('Como os dados são lidos aqui'),
    abertura: P('O painel organiza indicadores de fontes públicas para comparar os nove estados. Ele antecipa uma leitura enquanto a metodologia de monitoramento da Estratégia não é definida.'),
    itens: lista([
      { titulo: 'Períodos diferentes', texto: 'Cada base entra com seu período mais recente, então os anos de referência não são uniformes entre indicadores.' }
    ]),
    fontesRotulo: P('Fontes consolidadas')
  }
};
marca(textos.visaoGeral.temas.itens.flatMap((i) => [{ a: i.titulo.pt, b: i.texto.pt }]));
marca(textos.visaoGeral.governanca.itens.flatMap((i) => [{ a: i.titulo.pt, b: i.texto.pt }]));
marca(textos.visaoGeral.estePainel.itens.flatMap((i) => [{ a: i.titulo.pt, b: i.texto.pt }]));
textos._leia = 'Textos do painel que não são dados. Cada texto é um par { pt, en }; quando en está vazio, a página em inglês mostra o português. visaoGeral: as cinco lâminas. panorama.metodologia: a síntese comparativa, exibida em dashboard.json.';
await gravaJson('textos.json', textos);

// ---------- catalogo.json e fichas.json ----------

const enJson = await leJson(join(publicRoot, 'data', 'i18n', 'en.json'));
const catalogo = await leJson(join(conteudoRoot, 'catalogo.json'));
const fichas = await leJson(join(conteudoRoot, 'fichas.json'));
for (const eixo of catalogo.eixos) {
  eixo.en = { nome: enJson.eixos[String(eixo.numero)] ?? null };
  for (const indicador of eixo.indicadores) {
    const traducao = enJson.indicadores[indicador.codigo] || {};
    indicador.en = { nome: traducao.nome ?? null, meta: traducao.meta ?? null, descricao: traducao.descricao ?? null, fonte: traducao.fonte ?? null, unidade: traducao.unidade ?? null };
  }
}
const linhasPt = {};
for (const ficha of Object.values(fichas.fichas)) {
  const numero = String(ficha.linhaAcao || '').match(/^(\d+\.\d+)/)?.[1];
  if (numero && !linhasPt[numero]) linhasPt[numero] = ficha.linhaAcao;
}
catalogo.linhasAcao = Object.fromEntries(Object.keys({ ...linhasPt, ...enJson.linhasAcao }).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
  .map((numero) => [numero, { pt: linhasPt[numero] ?? null, en: enJson.linhasAcao[numero] ?? null }]));
catalogo._leia = 'Os 59 indicadores por eixo, só texto; os números ficam em valores.csv. Cada eixo e cada indicador traz o inglês em `en`. linhasAcao: as 25 linhas de ação citadas pelas fichas, com o inglês.';
await gravaJson('catalogo.json', catalogo);

for (const [codigo, ficha] of Object.entries(fichas.fichas)) {
  const en = {};
  if (enJson.equacoes[codigo]) en.equacoes = enJson.equacoes[codigo];
  if (enJson.notasFormula[codigo]) en.notasFormula = enJson.notasFormula[codigo];
  if (Object.keys(en).length) ficha.en = en;
}
for (const codigo of [...Object.keys(enJson.equacoes), ...Object.keys(enJson.notasFormula)]) {
  if (!fichas.fichas[codigo]) console.warn(`aviso: en.json traduz ${codigo}, que não tem ficha; tradução descartada`);
}
fichas._leia = 'Fichas técnicas extraídas do .docx (scripts/extract-fichas.ps1), por código. `en` por ficha guarda equações e notas de fórmula em inglês; as equações em LaTeX trazem português dentro, por isso a lista inteira é traduzida.';
await gravaJson('fichas.json', fichas);

console.log(`panorama: ${metricas.length} métricas; textos: Visão Geral e metodologia; catálogo: inglês de ${catalogo.eixos.flatMap((e) => e.indicadores).length} indicadores e ${Object.keys(catalogo.linhasAcao).length} linhas de ação; fichas: ${Object.values(fichas.fichas).filter((f) => f.en).length} com inglês.`);
console.log(`\nEntradas do dicionário que passaram a viver em conteudo/ (${movidas.size}):`);
for (const pt of movidas) console.log(`  ${JSON.stringify(pt)}`);
