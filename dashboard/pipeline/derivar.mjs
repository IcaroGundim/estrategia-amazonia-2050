// Derivação do Panorama: a partir da fonte (`conteudo/`) monta o payload de
// `public/data/dashboard.json`, com os nove estados, as séries, a síntese
// comparativa e o resumo regional.
//
// Nenhum número é escrito aqui. Cada métrica do mapa está declarada em
// `panorama.json` com o que o cálculo precisa saber: de onde vem a série, se é
// uma taxa sobre área ou população, qual o ano de referência, se entra no
// ranking e com que direção. Este módulo só aplica essas declarações.
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { publicRoot } from './fonte.mjs';

// ---------- bandeiras ----------

function svgAspectRatio(svg = '') {
  const tag = svg.match(/<svg[^>]*>/)?.[0] || '';
  const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);
  const width = toNumber(tag.match(/\swidth="([^"]+)"/)?.[1]);
  const height = toNumber(tag.match(/\sheight="([^"]+)"/)?.[1]);
  if (width > 0 && height > 0) return width / height;
  const parts = String(tag.match(/\sviewBox="([^"]+)"/)?.[1] || '').trim().split(/[\s,]+/).map(toNumber);
  if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) return parts[2] / parts[3];
  return null;
}

// `flagVersion` só serve para furar o cache do navegador quando o SVG muda. Antes
// era a data de modificação do arquivo na máquina do dev; agora é um hash do
// conteúdo, que é o mesmo em qualquer máquina e só muda quando o desenho muda.
export async function metaDasBandeiras(estados) {
  const pasta = join(publicRoot, 'flags');
  const existentes = new Set(await readdir(pasta));
  const saida = {};
  for (const [uf, { flag }] of Object.entries(estados)) {
    if (!existentes.has(flag)) { saida[uf] = { flagVersion: null, flagRatio: null }; continue; }
    const svg = await readFile(join(pasta, flag), 'utf8');
    const hash = createHash('sha1').update(svg).digest('hex').slice(0, 8);
    const ratio = svgAspectRatio(svg);
    saida[uf] = { flagVersion: parseInt(hash, 16), flagRatio: ratio ? Number(ratio.toFixed(4)) : null };
  }
  return saida;
}

// ---------- contas ----------

function minMaxScore(values, direction = 'high') {
  const filtered = values.filter(Number.isFinite);
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  return values.map((value) => {
    if (!Number.isFinite(value)) return null;
    if (max === min) return 50;
    const position = (value - min) / (max - min);
    return Math.round((direction === 'high' ? position : 1 - position) * 1000) / 10;
  });
}

function rankStates(states, key, direction = 'high') {
  const sorted = [...states].sort((a, b) => direction === 'high' ? b[key] - a[key] : a[key] - b[key]);
  sorted.forEach((state, index) => { state.ranks[key] = index + 1; });
}

function weightedAverage(parts) {
  const valid = parts.filter(({ value }) => Number.isFinite(value));
  const totalWeight = valid.reduce((sum, { weight }) => sum + weight, 0);
  return totalWeight ? valid.reduce((sum, { value, weight }) => sum + value * weight, 0) / totalWeight : null;
}

const rate = (value, base, factor) => (Number.isFinite(value) && Number.isFinite(base) && base > 0 ? value / base * factor : null);

const variacao = (atual, anterior) => (Number.isFinite(atual) && Number.isFinite(anterior) && anterior > 0 ? (atual - anterior) / anterior * 100 : null);

function serieNumerica(serie) {
  const saida = {};
  for (const [ano, valor] of Object.entries(serie || {})) {
    if (Number.isFinite(valor)) saida[ano] = valor;
  }
  return saida;
}

function ultimoAno(serie) {
  const anos = Object.keys(serie).map(Number).filter(Number.isFinite);
  return anos.length ? Math.max(...anos) : null;
}

// ---------- montagem ----------

export async function derivaDashboard(fonte) {
  const { panorama, painel, textos, valores, ufs } = fonte;
  const bandeiras = await metaDasBandeiras(panorama.estados);
  const leitura = (codigo) => valores.get(codigo) || { atual: {}, serie: {}, extra: {} };

  // Denominadores: área (sem ano) e população (por ano; o ano de referência vale
  // como população "atual" do estado).
  const area = leitura(panorama.denominadores.area);
  const populacao = leitura(panorama.denominadores.populacao);
  const anoPopulacao = panorama.denominadores.anoPopulacao;

  const states = ufs.map((uf) => {
    const identidade = panorama.estados[uf];
    const areaUf = area.atual[uf] ?? null;
    const populacaoUf = populacao.serie[uf]?.[anoPopulacao] ?? populacao.atual[uf] ?? null;
    const state = {
      uf,
      name: identidade.name,
      capital: identidade.capital,
      flag: identidade.flag,
      flagVersion: bandeiras[uf]?.flagVersion ?? null,
      flagRatio: bandeiras[uf]?.flagRatio ?? null,
      population: populacaoUf,
      area: areaUf,
      series: {},
      ranks: {}
    };

    for (const metrica of panorama.metricas) {
      const codigo = metrica.codigo || metrica.chave;
      if (metrica.tipo === 'valor') {
        const origem = leitura(codigo);
        state[metrica.chave] = metrica.ano ? (origem.serie[uf]?.[metrica.ano] ?? null) : (origem.atual[uf] ?? null);
        continue;
      }
      if (metrica.tipo === 'serie') {
        const serie = serieNumerica(leitura(codigo).serie[uf]);
        state.series[metrica.chave] = serie;
        if (metrica.valorAtual === 'ultimo') {
          const ano = ultimoAno(serie);
          state[metrica.chave] = ano ? serie[ano] : null;
          if (metrica.campoAno) state[metrica.campoAno] = ano;
        } else {
          state[metrica.chave] = serie[metrica.referencia] ?? null;
        }
        continue;
      }
      // taxa: valor bruto (km², focos, ocorrências) sobre área ou população.
      const bruto = serieNumerica(leitura(metrica.bruto).serie[uf]);
      const denominadorPorAno = (ano) => {
        if (metrica.denominador === panorama.denominadores.area) return areaUf;
        return populacao.serie[uf]?.[ano] ?? null;
      };
      const brutoRef = bruto[metrica.referencia] ?? null;
      if (metrica.campoBruto) state[metrica.campoBruto] = brutoRef;
      state[metrica.chave] = rate(brutoRef, metrica.denominador === panorama.denominadores.area ? areaUf : populacaoUf, metrica.fator);
      if (metrica.campoVariacao) state[metrica.campoVariacao] = variacao(brutoRef, bruto[metrica.referencia - 1] ?? null);
      if (metrica.serieDireta) {
        // A série já vem como taxa (quando o denominador por ano não está na fonte).
        state.series[metrica.chave] = serieNumerica(leitura(metrica.serieDireta).serie[uf]);
      } else {
        const serie = {};
        for (const [ano, valor] of Object.entries(bruto)) {
          const taxa = rate(valor, denominadorPorAno(ano), metrica.fator);
          if (Number.isFinite(taxa)) serie[ano] = taxa;
        }
        state.series[metrica.chave] = serie;
      }
    }
    return state;
  });

  // Síntese comparativa: cada métrica vira uma posição de 0 a 100 entre os
  // estados; o score é a média ponderada e as dimensões, recortes dela.
  const { pesos, dimensoes } = panorama.sintese;
  const scores = Object.fromEntries(pesos.map(({ chave, direcao }) => [chave, minMaxScore(states.map((state) => state[chave]), direcao)]));
  // Uma dimensão pode citar uma métrica que não pesa no score geral; nesse caso
  // a posição dela é calculada aqui, com a direção do ranking.
  for (const partes of Object.values(dimensoes)) {
    for (const parte of partes) {
      if (!scores[parte.chave]) {
        const direcao = panorama.metricas.find((metrica) => metrica.chave === parte.chave)?.rank || 'high';
        scores[parte.chave] = minMaxScore(states.map((state) => state[parte.chave]), direcao);
      }
    }
  }
  states.forEach((state, index) => {
    state.score = Math.round(weightedAverage(pesos.map(({ chave, peso }) => ({ value: scores[chave][index], weight: peso }))));
    state.dimensions = Object.fromEntries(Object.entries(dimensoes).map(([nome, partes]) => [
      nome,
      Math.round(weightedAverage(partes.map(({ chave, peso }) => ({ value: scores[chave][index], weight: peso }))))
    ]));
  });
  rankStates(states, 'score');
  for (const metrica of panorama.metricas) {
    if (metrica.rank) rankStates(states, metrica.chave, metrica.rank);
  }

  // Resumo regional.
  const soma = (fn) => states.reduce((total, state) => total + (fn(state) || 0), 0);
  const metricaPorChave = Object.fromEntries(panorama.metricas.map((metrica) => [metrica.chave, metrica]));
  const totalBruto = (chave, deslocamento = 0) => {
    const metrica = metricaPorChave[chave];
    const ano = metrica.referencia + deslocamento;
    return ufs.reduce((total, uf) => total + (serieNumerica(leitura(metrica.bruto).serie[uf])[ano] || 0), 0);
  };
  const { resumo } = panorama;
  const totalPopulation = soma((state) => state.population);
  const prodesKm2Total = totalBruto(resumo.desmatamento);
  const prodesKm2TotalPrev = totalBruto(resumo.desmatamento, -1);
  const cvliTotal = totalBruto(resumo.violencia);
  const metricYears = Object.fromEntries(panorama.metricas
    .filter((metrica) => metrica.tipo !== 'valor')
    .map((metrica) => {
      const anos = [...new Set(states.flatMap((state) => Object.keys(state.series[metrica.chave] || {}).map(Number)))].sort((a, b) => a - b);
      return [metrica.chave, { anos, referencia: metrica.referencia, parciais: metrica.parciais || [] }];
    }));

  return {
    updatedAt: painel.atualizadoEm,
    metricYears,
    states: states.sort((a, b) => a.ranks.score - b.ranks.score),
    summary: {
      population: totalPopulation,
      statesCount: states.length,
      territoryKm2: soma((state) => state.area),
      municipalities: painel.municipios,
      conservationUnits: soma((state) => state[resumo.unidadesConservacao]),
      prodesKm2: prodesKm2Total,
      prodesKm2Variation: prodesKm2TotalPrev > 0 ? (prodesKm2Total - prodesKm2TotalPrev) / prodesKm2TotalPrev * 100 : null,
      heatTotal: totalBruto(resumo.focos),
      cvliTotal,
      cvliRate: totalPopulation > 0 ? cvliTotal / totalPopulation * 100000 : null,
      averageScore: Math.round(states.reduce((total, state) => total + state.score, 0) / states.length),
      lowestDeforestation: [...states].sort((a, b) => a[resumo.desmatamento] - b[resumo.desmatamento])[0]?.uf,
      lowestViolence: [...states].sort((a, b) => a[resumo.violencia] - b[resumo.violencia])[0]?.uf
    },
    methodology: montaMetodologia(textos.panorama.metodologia),
    // Apresentação das métricas do seletor, para o app.js montar o menu, os
    // rótulos e o método de agregação regional sem constantes no código.
    panorama: {
      metricas: panorama.metricas.filter((metrica) => metrica.seletor).map((metrica) => ({
        chave: metrica.chave,
        codigoCatalogo: metrica.codigoCatalogo ?? null,
        serie: metrica.tipo !== 'valor',
        direcao: metrica.rank || 'high',
        rotulo: metrica.rotulo,
        subtitulo: metrica.subtitulo,
        descricao: metrica.descricao,
        fonte: metrica.fonte,
        formato: metrica.formato,
        en: metrica.en || {},
        agregacao: metrica.agregacao || null
      }))
    }
  };
}

// A metodologia da síntese vai em português no formato de sempre, com o inglês
// num bloco `en` ao lado — a página escolhe pela língua.
function montaMetodologia(fonte) {
  const pt = (par) => (par && typeof par === 'object' ? par.pt : par);
  const en = (par) => (par && typeof par === 'object' ? par.en : null);
  return {
    title: pt(fonte.title),
    text: pt(fonte.text),
    dimensions: fonte.dimensions.map((dimensao) => ({ name: pt(dimensao.name), weight: dimensao.weight, indicators: pt(dimensao.indicators) })),
    sources: pt(fonte.sources),
    en: {
      title: en(fonte.title),
      text: en(fonte.text),
      dimensions: fonte.dimensions.map((dimensao) => ({ name: en(dimensao.name), indicators: en(dimensao.indicators) })),
      sources: en(fonte.sources)
    }
  };
}
