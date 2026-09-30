// Avaliação das metas da Estratégia Amazônia 2050 para a Amazônia Legal.
//
// As metas são da região como um todo: o que se confronta com o alvo é o valor
// da Amazônia Legal, agregado dos nove estados pelo método de cada meta. Os
// valores por estado acompanham a meta como complemento — a página os mostra
// ao lado do regional —, mas não decidem se ela é cumprida.
//
// A parametrização vem de `conteudo/metas.json`: só as metas que podem ser
// confrontadas com os valores coletados na mesma unidade estão lá, e as que não
// podem estão declaradas em `exclusoes` — a lista de exclusões faz parte do
// resultado, não é um silêncio.
//
// Campos de cada parâmetro:
//   codigo      indicador do catálogo
//   alvo        número, ou uma regra sobre a baseline da região:
//               { tipo: 'sobreBaseline', fator, soma } → baseline × fator + soma
//               (fator 0,7 é redução de 30%; soma 100000, em R$ mil, é aumento
//               de R$ 100 milhões)
//   baseline    o ponto de partida, quando a meta o especifica:
//               { ano, valor } → o valor regional da série naquele ano, pelo
//               mesmo método do valor atual; o número declarado só vale quando a
//               série não tem o ano
//               { desde, ate } → a média regional do período
//               Sem `baseline` vale a regra geral: a média dos últimos 10 anos da
//               série regional, ou dos últimos 5 quando ela é mais curta. Com
//               menos de 5 anos de série a meta fica sem baseline.
//   direcao     'maior' | 'menor' | 'categoria'
//   tipo        'declarada' = o número está escrito na meta; 'inferida' = a meta
//               é qualitativa e foi operacionalizada aqui; 'derivada' = o alvo
//               sai da baseline
//   agregacao   como o valor da Amazônia Legal sai dos nove estados (ver
//               ROTULO_AGREGACAO). 'contagem' é a parcela dos estados que atingem
//               o patamar, para as metas que o pedem em todos eles (CAPAG)
//   valorDe     de onde vem o valor por estado: ausente = `valores` do catálogo;
//               'ultimoDaSerie' = último ponto da série; { panorama: chave } =
//               campo do dashboard (I5.4.1 usa o % do PIB já consolidado);
//               { arquivo, serie, ateAno } = a série de um arquivo de detalhe de
//               public/data, até o ano dado — ou o do campo do arquivo com esse
//               nome (I2.2.1: `anoFinal`, o último ano com dados finais do SIM)
//   denominador com agregacao 'razaoDenominador': { arquivo, caminho, fator },
//               o número por UF que divide o valor coletado (I2.2.3: municípios)
//   unidade     sobrepõe a unidade do catálogo quando o valor confrontado está
//               em outra (I5.4.1: % do PIB, não R$ milhões)
//   razao       com agregacao 'razaoCampos': { numerador, denominador, fator }
//               nomes de dois campos auxiliares do CSV; o regional é
//               Σ numerador / Σ denominador × fator (I4.2.1, I4.4.2)
//   alvoSoRegional  true quando o alvo é um total da região e não se repete
//               em cada estado (I3.3.2: 10 mil pessoas)
//   categoriasCumpre, nota, notaAgregacao
//
// A jornada é o percurso desde a baseline: quanto do caminho entre ela e o alvo
// já foi andado. Sem baseline — ou com uma que já estava do lado de lá do alvo —,
// é a posição do valor em relação ao alvo, e o tipo viaja com o número para a
// página rotular cada caso.
//
// `projecoes` (conteudo/projecoes.json) viaja junto de cada meta e de cada
// indicador fora do quadro: as trajetórias pactuadas até 2050. Não entram na
// avaliação — são a referência de percurso, não o valor medido.

import { trajetoriaDaMeta } from './trajetoria.mjs';

function ultimoDaSerie(serie) {
  const anos = Object.entries(serie || {})
    .map(([ano, valor]) => ({ ano: Number(ano), valor }))
    .filter((item) => Number.isFinite(item.ano) && Number.isFinite(item.valor))
    .sort((a, b) => a.ano - b.ano);
  return anos.at(-1) || null;
}

function normalizaCapag(nota) {
  return String(nota || '').trim().toUpperCase();
}

function anoDaReferencia(referencia) {
  const encontrado = String(referencia || '').match(/(?:19|20)\d{2}/);
  return encontrado ? encontrado[0] : null;
}

const alvoEhRegra = (parametro) => Boolean(parametro.alvo && typeof parametro.alvo === 'object');

const media = (pontos) => pontos.reduce((soma, ponto) => soma + ponto.valor, 0) / pontos.length;

function caminhoEm(objeto, caminho) {
  return String(caminho || '').split('.').filter(Boolean).reduce((atual, chave) => atual?.[chave], objeto);
}

// Número de uma célula, ou null. `Number(null)` daria zero, e um estado sem
// valor entraria na soma como se não tivesse nada.
function numeroOuNulo(bruto) {
  if (bruto === null || bruto === undefined || bruto === '') return null;
  const numero = Number(bruto);
  return Number.isFinite(numero) ? numero : null;
}

/** Arquivos de detalhe de public/data que as metas leem: o build carrega só estes. */
export function arquivosDasMetas(config) {
  const nomes = new Set();
  for (const parametro of config?.parametros || []) {
    if (parametro.valorDe?.arquivo) nomes.add(parametro.valorDe.arquivo);
    if (parametro.denominador?.arquivo) nomes.add(parametro.denominador.arquivo);
  }
  return [...nomes];
}

function detalheDe(detalhes, nome, codigo) {
  const dados = detalhes[nome];
  if (!dados) throw new Error(`metas.json: ${codigo} lê public/data/${nome}, que o build não carregou`);
  return dados;
}

// A série de um arquivo de detalhe no lugar da do catálogo. O valor atual de
// cada estado passa a ser o último ponto dela até o ano-limite.
function comSerieDoArquivo(indicador, parametro, detalhes, ufs) {
  const origem = parametro.valorDe;
  if (!origem?.arquivo) return indicador;
  const dados = detalheDe(detalhes, origem.arquivo, parametro.codigo);
  const porUf = caminhoEm(dados, origem.serie || 'serie') || {};
  const limite = numeroOuNulo(typeof origem.ateAno === 'string' ? dados[origem.ateAno] : origem.ateAno) ?? Infinity;
  const serieAnual = {};
  const valores = {};
  for (const uf of ufs) {
    const pontos = Object.entries(porUf[uf] || {})
      .map(([ano, valor]) => [Number(ano), numeroOuNulo(valor)])
      .filter(([ano, valor]) => Number.isFinite(ano) && ano <= limite && valor !== null)
      .sort((a, b) => a[0] - b[0]);
    serieAnual[uf] = Object.fromEntries(pontos.map(([ano, valor]) => [String(ano), valor]));
    valores[uf] = pontos.at(-1)?.[1] ?? null;
  }
  return { ...indicador, serieAnual, valores };
}

function denominadorPorUf(parametro, detalhes) {
  if (parametro.agregacao !== 'razaoDenominador') return null;
  const origem = parametro.denominador || {};
  const porUf = caminhoEm(detalheDe(detalhes, origem.arquivo, parametro.codigo), origem.caminho);
  if (!porUf || typeof porUf !== 'object') throw new Error(`metas.json: ${parametro.codigo} não achou "${origem.caminho}" em ${origem.arquivo}`);
  return porUf;
}

// O valor que se confronta com o alvo. Na razão por denominador o dado coletado
// é o numerador (municípios com telessaúde) e a meta fala da parcela (50% dos
// municípios).
function valorConfrontado(parametro, contexto, uf, valor) {
  if (parametro.agregacao !== 'razaoDenominador' || valor === null) return valor;
  const base = numeroOuNulo(contexto.denominador?.[uf]);
  return base ? valor / base * (parametro.denominador.fator ?? 100) : null;
}

function atingeNoEstado(parametro, valor) {
  if (parametro.direcao === 'categoria') return parametro.categoriasCumpre.includes(valor);
  return parametro.direcao === 'menor' ? valor <= parametro.alvo : valor >= parametro.alvo;
}

// Σ numerador / Σ denominador dos estados presentes, com os campos auxiliares
// nomeados em `parametro.razao`. Nulo se faltar o denominador. Com `ano`, usa
// os campos daquele ano pela convenção do CSV (`atingiram2023`); sem eles, só o
// ano mais recente pode usar os campos sem ano — os demais ficam sem regional,
// em vez de repetir o denominador de outro ano.
function razaoDeCampos(parametro, indicador, entradas, ano = null, maisRecente = true) {
  const { numerador, denominador, fator = 1 } = parametro.razao;
  const temDoAno = ano && entradas.some(([uf]) => indicador.extra?.[uf]?.[`${denominador}${ano}`] !== undefined);
  if (ano && !temDoAno && !maisRecente) return null;
  const nome = (campo) => (temDoAno ? `${campo}${ano}` : campo);
  const soma = (campo) => entradas.reduce((total, [uf]) => total + (Number(indicador.extra?.[uf]?.[nome(campo)]) || 0), 0);
  const base = soma(denominador);
  return base ? soma(numerador) / base * fator : null;
}

/**
 * Valor da Amazônia Legal a partir dos valores de um ano (`valores`: UF → valor
 * já confrontável). O mesmo cálculo serve ao valor atual e a cada ano da série.
 */
function agregaValores(parametro, indicador, valores, contexto, ano = null, maisRecente = true) {
  if (parametro.agregacao === 'contagem') {
    const lidos = Object.values(valores).filter((valor) => valor !== null && valor !== undefined && valor !== '');
    return lidos.length ? lidos.filter((valor) => atingeNoEstado(parametro, valor)).length / lidos.length * 100 : null;
  }
  const entradas = Object.entries(valores).filter(([, valor]) => Number.isFinite(valor));
  if (!entradas.length) return null;
  const soma = (fn) => entradas.reduce((total, entrada) => total + (fn(entrada) || 0), 0);
  const { populacaoPorUf, cvliPorUf, denominador } = contexto;

  if (parametro.agregacao === 'soma') return soma(([, valor]) => valor);
  if (parametro.agregacao === 'media') return soma(([, valor]) => valor) / entradas.length;
  if (parametro.agregacao === 'populacao') {
    const peso = soma(([uf]) => populacaoPorUf[uf]);
    return peso ? soma(([uf, valor]) => valor * (populacaoPorUf[uf] || 0)) / peso : null;
  }
  if (parametro.agregacao === 'razaoUc') {
    // Cada ano da série tem os seus totais (total2018, comAmbos2018...); sem
    // eles, só o ano mais recente usa os campos sem ano.
    const doAno = ano && entradas.some(([uf]) => indicador.extra?.[uf]?.[`total${ano}`] !== undefined);
    if (ano && !doAno && !maisRecente) return null;
    const campo = (nome) => (doAno ? `${nome}${ano}` : nome);
    const total = soma(([uf]) => indicador.extra?.[uf]?.[campo('total')]);
    return total ? soma(([uf]) => indicador.extra?.[uf]?.[campo('comAmbos')]) / total * 100 : null;
  }
  if (parametro.agregacao === 'razaoCvli') {
    const peso = soma(([uf]) => populacaoPorUf[uf]);
    if (!peso) return null;
    // No valor atual, o total de CVLI de cada estado vem do Panorama; na série,
    // a taxa de cada ano já veio convertida e o regional é a média ponderada.
    return ano === null ? soma(([uf]) => cvliPorUf[uf]) / peso * 100000 : soma(([uf, valor]) => valor * (populacaoPorUf[uf] || 0)) / peso;
  }
  if (parametro.agregacao === 'razaoCampos') return razaoDeCampos(parametro, indicador, entradas, ano, maisRecente);
  if (parametro.agregacao === 'razaoDenominador') {
    const peso = soma(([uf]) => numeroOuNulo(denominador?.[uf]));
    return peso ? soma(([uf, valor]) => valor * (numeroOuNulo(denominador?.[uf]) || 0)) / peso : null;
  }
  return null;
}

function montaHistorico(parametro, indicador, atuais, ufs, contexto) {
  const porAno = new Map();
  // Quando o valor vem do Panorama (I5.4.1, % do PIB), a série do catálogo está
  // em outra unidade e não pode ser misturada ao valor exibido: vale a série da
  // própria métrica do Panorama, que está na unidade da meta.
  const serieCompativel = parametro.valorDe?.panorama ? contexto.seriePanorama : indicador.serieAnual;

  if (serieCompativel) {
    for (const uf of ufs) {
      for (const [ano, valorBruto] of Object.entries(serieCompativel[uf] || {})) {
        let valor = parametro.direcao === 'categoria' ? normalizaCapag(valorBruto) : numeroOuNulo(valorBruto);
        if (parametro.agregacao === 'razaoCvli' && valor !== null) {
          const populacao = contexto.populacaoPorUf[uf];
          valor = populacao ? valor / populacao * 100000 : null;
        }
        if (parametro.direcao !== 'categoria') valor = valorConfrontado(parametro, contexto, uf, valor);
        const valido = parametro.direcao === 'categoria'
          ? Boolean(valor && valor !== 'SUSPENSA')
          : Number.isFinite(valor);
        if (!valido) continue;
        if (!porAno.has(ano)) porAno.set(ano, {});
        porAno.get(ano)[uf] = valor;
      }
    }
  }

  if (!porAno.size) {
    const ano = anoDaReferencia(indicador.anoRef);
    if (ano) {
      const valores = {};
      for (const uf of ufs) {
        if (atuais[uf] !== null && atuais[uf] !== undefined) valores[uf] = atuais[uf];
      }
      if (Object.keys(valores).length) porAno.set(ano, valores);
    }
  }

  const ultimoAno = Math.max(...[...porAno.keys()].map(Number));
  return [...porAno.entries()]
    .map(([ano, valores]) => ({
      ano,
      valores,
      regional: agregaValores(parametro, indicador, valores, contexto, ano, Number(ano) === ultimoAno)
    }))
    .sort((a, b) => Number(a.ano) - Number(b.ano));
}

// Os anos da série regional que servem de baseline: os que têm todos os estados
// que o ano mais recente tem. Um estado faltando mudaria a soma, ou a média, sem
// que nada tivesse mudado na região.
function serieRegionalCompleta(historico) {
  const comValor = historico.filter((ponto) => Number.isFinite(ponto.regional));
  if (!comValor.length) return [];
  const estados = Object.keys(comValor.at(-1).valores).length;
  return comValor
    .filter((ponto) => Object.keys(ponto.valores).length >= estados)
    .map((ponto) => ({ ano: Number(ponto.ano), valor: ponto.regional }));
}

export const JANELAS_DA_BASELINE = [10, 5];

// Ano a que o valor atual se refere: o último da série quando é dela que ele
// sai, senão o ano de referência do catálogo.
function anoDoValorAtual(parametro, indicador) {
  if (parametro.valorDe === 'ultimoDaSerie' || parametro.valorDe?.arquivo) {
    const anos = Object.values(indicador.serieAnual || {}).flatMap((serie) => Object.keys(serie || {}).map(Number));
    return anos.length ? Math.max(...anos) : null;
  }
  const ano = anoDaReferencia(indicador.anoRef);
  return ano ? Number(ano) : null;
}

/**
 * Ponto de partida da região. A declarada na meta vale primeiro; sem ela, a
 * média dos últimos 10 anos da série regional, ou dos últimos 5 quando a série
 * não alcança 10. A janela conta o ano mais recente.
 *
 * Uma baseline declarada num ano é lida pelo mesmo método do valor de hoje:
 * se o dado atual é daquele ano, ele é a baseline (a medição de hoje é a da
 * partida); senão, o valor regional da série naquele ano. O número escrito na
 * meta só vale quando nenhum dos dois existe — ele pode ter saído de outra
 * agregação, e compará-lo com a nossa inventaria um avanço que não houve.
 */
function baselineRegional(parametro, historico, atual) {
  const pontos = serieRegionalCompleta(historico);
  const declarada = parametro.baseline;
  if (declarada?.desde) {
    const janela = pontos.filter((ponto) => ponto.ano >= declarada.desde && ponto.ano <= (declarada.ate ?? Infinity));
    return janela.length ? { valor: media(janela), tipo: 'periodo', desde: janela[0].ano, ate: janela.at(-1).ano } : null;
  }
  if (declarada) {
    const ano = numeroOuNulo(declarada.ano);
    const doAno = ano !== null ? pontos.find((ponto) => ponto.ano === ano) : null;
    let valor = numeroOuNulo(declarada.valor);
    let origem = 'declarado';
    if (ano !== null && ano === atual.ano && Number.isFinite(atual.valor)) { valor = atual.valor; origem = 'atual'; }
    else if (doAno) { valor = doAno.valor; origem = 'serie'; }
    return valor === null ? null : { valor, tipo: 'declarada', ano, declarado: numeroOuNulo(declarada.valor), origem };
  }
  if (!pontos.length) return null;
  const ultimo = pontos.at(-1).ano;
  const extensao = ultimo - pontos[0].ano + 1;
  const anos = JANELAS_DA_BASELINE.find((tamanho) => extensao >= tamanho);
  if (!anos) return null;
  const janela = pontos.filter((ponto) => ponto.ano > ultimo - anos);
  return { valor: media(janela), tipo: 'media', janela: anos, desde: janela[0].ano, ate: ultimo };
}

function alvoRegional(parametro, baseline) {
  if (parametro.agregacao === 'contagem') return 100;
  if (!alvoEhRegra(parametro)) return numeroOuNulo(parametro.alvo);
  const regra = parametro.alvo;
  if (regra.tipo !== 'sobreBaseline') throw new Error(`metas.json: regra de alvo desconhecida "${regra.tipo}" em ${parametro.codigo}`);
  return baseline ? baseline.valor * (regra.fator ?? 1) + (regra.soma ?? 0) : null;
}

// O alvo de um estado só existe como complemento, e quando a meta tem uma parte
// por estado: o mesmo patamar, ou a mesma redução sobre a média do estado no
// período da baseline da região. Um acréscimo em valor absoluto (R$ 100
// milhões) é da região e não se reparte.
function alvoDoEstado(parametro, serie, baseline) {
  // Um total da região (10 mil pessoas) não é patamar de cada estado.
  if (parametro.alvoSoRegional) return null;
  if (!alvoEhRegra(parametro)) return numeroOuNulo(parametro.alvo);
  if (parametro.alvo.soma || !baseline?.desde) return null;
  const pontos = Object.entries(serie || {})
    .map(([ano, valor]) => ({ ano: Number(ano), valor: numeroOuNulo(valor) }))
    .filter((ponto) => ponto.ano >= baseline.desde && ponto.ano <= baseline.ate && ponto.valor !== null);
  return pontos.length ? media(pontos) * (parametro.alvo.fator ?? 1) : null;
}

function progressoEntre(baseline, atual, alvo) {
  if (![baseline, atual, alvo].every(Number.isFinite)) return null;
  const percurso = baseline - alvo;
  if (percurso === 0) return atual === alvo ? 1 : 0;
  const razao = (baseline - atual) / percurso;
  return Math.max(0, Math.min(1, razao));
}

export const ROTULO_AGREGACAO = {
  soma: 'soma dos nove estados',
  populacao: 'média ponderada pela população',
  media: 'média simples dos nove estados',
  razaoUc: 'unidades com plano e conselho sobre o total de unidades',
  razaoCvli: 'total de CVLI sobre a população regional',
  razaoCampos: 'soma dos numeradores sobre a soma dos denominadores dos nove estados',
  razaoDenominador: 'soma dos nove estados sobre o total de referência dos nove',
  contagem: 'parcela dos nove estados que atingem o patamar'
};

// Motivos padrão de um indicador ficar fora do quadro, quando `exclusoes` não
// traz um específico. Texto que chega à tela pelos dados e é traduzido lá.
export const MOTIVO_PADRAO = {
  semPatamar: 'A meta não define um patamar numérico comparável aos valores coletados.',
  semValores: 'O indicador ainda não tem valores coletados para os nove estados.'
};

/** O resultado da meta: o valor da Amazônia Legal diante do alvo. */
function avaliaRegional(parametro, indicador, atuais, contexto, baseline) {
  if (!parametro.agregacao) return null;
  const valor = agregaValores(parametro, indicador, atuais, contexto);
  const alvo = alvoRegional(parametro, baseline);
  if (!Number.isFinite(valor) || !Number.isFinite(alvo)) return null;

  // A parcela de estados (CAPAG) é um número que sobe até 100%.
  const direcao = parametro.direcao === 'menor' ? 'menor' : 'maior';
  const atinge = (numero) => (direcao === 'menor' ? numero <= alvo : numero >= alvo);
  const cumpre = atinge(valor);
  const partida = baseline && !atinge(baseline.valor) ? baseline.valor : null;
  const posicao = direcao === 'menor'
    ? (alvo > 0 ? Math.min(1, alvo / valor) : null)
    : (alvo > 0 ? Math.min(1, valor / alvo) : null);
  return {
    valor,
    alvo,
    cumpre,
    distancia: direcao === 'menor' ? valor - alvo : alvo - valor,
    escala: cumpre ? 1 : (partida !== null ? progressoEntre(partida, valor, alvo) : posicao),
    escalaTipo: partida !== null ? 'baseline' : 'alvo',
    baseline,
    metodo: parametro.agregacao,
    metodoRotulo: ROTULO_AGREGACAO[parametro.agregacao],
    nota: parametro.notaAgregacao || null
  };
}

// Indicador coletado que não entra no quadro (a meta não tem patamar numérico):
// a página mostra o valor e como ele andou, sem jornada. Viajam os números por
// estado (atual e série) e, quando `conteudo/metas.json > semMeta` declara que
// o valor da região é a soma dos estados, a série regional — só nos anos em que
// os nove têm valor, pelo mesmo motivo do `observadoRegional` abaixo. Sem essa
// declaração (taxas, índices) não há valor regional: somar taxas não é regional.
// `unidade` em `semMeta` corrige a unidade exibida quando o valor coletado não
// está na unidade da meta (APS: equipes, não % de cobertura).
function dadosSemMeta(indicador, config = {}, ufs) {
  const numero = (valor) => (typeof valor === 'number' && Number.isFinite(valor) ? valor : null);
  const valores = Object.fromEntries(ufs.map((uf) => [uf, numero(indicador.valores?.[uf])]));
  const serieAnual = Object.fromEntries(ufs.map((uf) => [uf, Object.fromEntries(
    Object.entries(indicador.serieAnual?.[uf] || {}).map(([ano, valor]) => [ano, numero(valor)]).filter(([, valor]) => valor !== null)
  )]));
  const agregacao = config.agregacao || null;
  let serieRegional = [];
  let regionalAtual = null;
  if (agregacao === 'soma') {
    const anos = [...new Set(ufs.flatMap((uf) => Object.keys(serieAnual[uf])))].sort();
    serieRegional = anos.flatMap((ano) => {
      const doAno = ufs.map((uf) => serieAnual[uf][ano]);
      return doAno.every((valor) => valor !== null && valor !== undefined) ? [{ ano: Number(ano), valor: doAno.reduce((a, b) => a + b, 0) }] : [];
    });
    const atuais = ufs.map((uf) => valores[uf]);
    if (serieRegional.length) regionalAtual = serieRegional.at(-1);
    else if (atuais.every((valor) => valor !== null)) regionalAtual = { ano: Number(anoDaReferencia(indicador.anoRef)) || null, valor: atuais.reduce((a, b) => a + b, 0) };
  }
  return { unidadeValor: config.unidade || indicador.unidade, agregacao, valores, serieAnual, serieRegional, regionalAtual, trajetoria: config.trajetoria || null };
}

export function buildMetas(catalogo, dashboard, config, projecoes = null, detalhes = {}) {
  const { parametros, exclusoes } = config;
  const projecoesDe = (codigo) => (projecoes?.projecoes || []).filter((item) => item.codigo === codigo);
  // Fora do quadro não há histórico regional; a projeção comparável que pede
  // `observado: 'soma'` recebe a soma dos estados por ano, só nos anos em que os
  // nove têm valor (um estado faltando faria a soma parecer uma queda).
  const projecoesComObservado = (indicador, ufsDoPainel) => projecoesDe(indicador.codigo).map((item) => {
    if (!item.comparavel || item.observado !== 'soma') return item;
    const anos = new Set(ufsDoPainel.flatMap((uf) => Object.keys(indicador.serieAnual?.[uf] || {})));
    const observadoRegional = [...anos].sort().flatMap((ano) => {
      const valores = ufsDoPainel.map((uf) => Number(indicador.serieAnual?.[uf]?.[ano]));
      return valores.every(Number.isFinite) ? [{ ano: Number(ano), valor: valores.reduce((a, b) => a + b, 0) }] : [];
    });
    return { ...item, observadoRegional };
  });
  const ufs = (dashboard?.states || []).map((estado) => estado.uf);
  const porCodigo = new Map();
  for (const eixo of catalogo?.eixos || []) {
    for (const indicador of eixo.indicadores || []) {
      porCodigo.set(indicador.codigo, { ...indicador, eixo: eixo.numero, eixoNome: eixo.nome });
    }
  }
  const campoDoPanorama = (chave) => Object.fromEntries((dashboard?.states || []).map((estado) => [estado.uf, estado[chave]]));
  const contextoGeral = {
    populacaoPorUf: campoDoPanorama('population'),
    cvliPorUf: campoDoPanorama(config.contexto?.cvli || 'cvli')
  };

  const metas = [];
  for (const parametro of parametros) {
    const doCatalogo = porCodigo.get(parametro.codigo);
    if (!doCatalogo) continue;
    const indicador = comSerieDoArquivo(doCatalogo, parametro, detalhes, ufs);
    const contexto = {
      ...contextoGeral,
      denominador: denominadorPorUf(parametro, detalhes),
      seriePanorama: parametro.valorDe?.panorama
        ? Object.fromEntries((dashboard?.states || []).map((estado) => [estado.uf, estado.series?.[parametro.valorDe.panorama] || {}]))
        : null
    };
    const valoresDoPanorama = parametro.valorDe?.panorama ? campoDoPanorama(parametro.valorDe.panorama) : null;

    // O valor de hoje de cada estado, já na unidade da meta.
    const atuais = {};
    for (const uf of ufs) {
      const serie = indicador.serieAnual?.[uf] || null;
      const bruto = valoresDoPanorama
        ? valoresDoPanorama[uf]
        : (parametro.valorDe === 'ultimoDaSerie' ? (ultimoDaSerie(serie)?.valor ?? null) : indicador.valores?.[uf]);
      if (parametro.direcao === 'categoria') {
        const nota = normalizaCapag(bruto);
        atuais[uf] = nota && nota !== 'SUSPENSA' ? nota : null;
      } else {
        atuais[uf] = valorConfrontado(parametro, contexto, uf, numeroOuNulo(bruto));
      }
    }

    const historico = montaHistorico(parametro, indicador, atuais, ufs, contexto);
    const baseline = baselineRegional(parametro, historico, {
      ano: anoDoValorAtual(parametro, indicador),
      valor: agregaValores(parametro, indicador, atuais, contexto)
    });

    // Os estados diante do mesmo patamar: complemento da leitura regional.
    const estados = {};
    let cumpridas = 0;
    let avaliados = 0;
    for (const uf of ufs) {
      const valor = atuais[uf];
      if (valor === null || valor === undefined) { estados[uf] = null; continue; }
      if (parametro.direcao === 'categoria') {
        const cumpre = atingeNoEstado(parametro, valor);
        avaliados += 1;
        if (cumpre) cumpridas += 1;
        estados[uf] = { valor, alvo: 'A ou B', cumpre, escala: cumpre ? 1 : 0, escalaTipo: 'categoria', categoria: true };
        continue;
      }
      const alvo = alvoDoEstado(parametro, indicador.serieAnual?.[uf], baseline);
      if (!Number.isFinite(alvo)) { estados[uf] = null; continue; }
      const cumpre = parametro.direcao === 'menor' ? valor <= alvo : valor >= alvo;
      avaliados += 1;
      if (cumpre) cumpridas += 1;
      const posicao = parametro.direcao === 'menor'
        ? (alvo > 0 ? Math.min(1, alvo / valor) : null)
        : (alvo > 0 ? Math.min(1, valor / alvo) : null);
      estados[uf] = {
        valor,
        alvo,
        cumpre,
        distancia: parametro.direcao === 'menor' ? valor - alvo : alvo - valor,
        escala: cumpre ? 1 : posicao,
        escalaTipo: 'alvo'
      };
    }

    const meta = {
      codigo: indicador.codigo,
      eixo: indicador.eixo,
      eixoNome: indicador.eixoNome,
      linhaAcao: indicador.linhaAcao,
      nome: indicador.nome,
      metaTexto: indicador.meta,
      unidade: parametro.unidade || indicador.unidade,
      prazo: indicador.prazo,
      anoRef: indicador.anoRef,
      fonte: indicador.fonte,
      // Viaja junto porque a lista única filtra os 59 por situação de coleta, e
      // uma meta sem `status` cairia sempre na faixa de "pendente".
      status: indicador.status,
      direcao: parametro.direcao,
      tipo: parametro.tipo,
      nota: parametro.nota || null,
      // O patamar escrito na meta, quando é um número; o alvo calculado da
      // baseline está no regional.
      alvo: alvoEhRegra(parametro) ? null : (parametro.alvo ?? null),
      estados,
      cumpridas,
      avaliados,
      regional: avaliaRegional(parametro, indicador, atuais, contexto, baseline),
      agregacaoRotulo: ROTULO_AGREGACAO[parametro.agregacao] || null,
      historico,
      projecoes: projecoesDe(indicador.codigo)
    };
    // Depende do histórico e do valor regional, por isso vem depois.
    meta.trajetoria = trajetoriaDaMeta(meta, parametro, ufs);
    metas.push(meta);
  }

  // Os que não entram no quadro não são um resto: são a maior parte do catálogo.
  // A página os lista lado a lado com as metas, então cada um carrega o mesmo
  // que uma linha de meta carrega: eixo, fonte, unidade, ano e quantos dos nove
  // estados já têm valor.
  const codigosAvaliados = new Set(metas.map((meta) => meta.codigo));
  const foraDoPainel = [];
  for (const [, indicador] of porCodigo) {
    if (codigosAvaliados.has(indicador.codigo)) continue;
    const motivo = exclusoes[indicador.codigo]
      || (indicador.valores ? MOTIVO_PADRAO.semPatamar : MOTIVO_PADRAO.semValores);
    const preenchidos = indicador.valores
      ? ufs.filter((uf) => {
        const valor = indicador.valores[uf];
        return valor !== null && valor !== undefined && valor !== '';
      }).length
      : 0;
    foraDoPainel.push({
      codigo: indicador.codigo,
      eixo: indicador.eixo,
      eixoNome: indicador.eixoNome,
      linhaAcao: indicador.linhaAcao,
      nome: indicador.nome,
      metaTexto: indicador.meta,
      unidade: indicador.unidade,
      prazo: indicador.prazo,
      anoRef: indicador.anoRef,
      fonte: indicador.fonte,
      status: indicador.status,
      temValores: Boolean(indicador.valores),
      cobertura: preenchidos,
      motivo,
      projecoes: projecoesComObservado(indicador, ufs),
      ...(indicador.valores ? dadosSemMeta(indicador, config.semMeta?.[indicador.codigo], ufs) : {})
    });
  }

  const comRegional = metas.filter((meta) => meta.regional);

  return {
    updatedAt: dashboard?.updatedAt || null,
    estados: (dashboard?.states || []).map(({ uf, name, capital, flag, flagVersion, flagRatio }) => ({ uf, name, capital, flag, flagVersion, flagRatio })),
    metas,
    foraDoPainel,
    resumo: {
      totalIndicadores: porCodigo.size,
      metasAvaliadas: metas.length,
      comValores: [...porCodigo.values()].filter((indicador) => indicador.valores).length,
      comProjecao: new Set((projecoes?.projecoes || []).map((item) => item.codigo)).size,
      regional: {
        comValorRegional: comRegional.length,
        cumpridas: comRegional.filter((meta) => meta.regional.cumpre).length,
        comBaseline: comRegional.filter((meta) => meta.regional.escalaTipo === 'baseline').length,
        semValorRegional: metas.length - comRegional.length
      }
    }
  };
}
