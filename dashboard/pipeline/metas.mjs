// Avaliação das metas da Estratégia Amazônia 2050 por estado.
//
// A parametrização vem de `conteudo/metas.json`: só as metas que podem ser
// confrontadas com os valores coletados na mesma unidade estão lá, e as que não
// podem estão declaradas em `exclusoes` — a lista de exclusões faz parte do
// resultado, não é um silêncio.
//
// Campos de cada parâmetro:
//   codigo      indicador do catálogo
//   alvo        número, ou uma regra: { tipo: 'reducaoSobreMedia', desde, fator }
//               calcula o alvo por estado a partir da própria série
//   direcao     'maior' | 'menor' | 'categoria'
//   tipo        'declarada' = o número está escrito na meta; 'inferida' = a meta
//               é qualitativa ou regional e foi operacionalizada aqui;
//               'derivada' = calculada por estado a partir de uma baseline
//   agregacao   como o valor da Amazônia Legal sai dos nove estados
//   valorDe     de onde vem o valor por estado: ausente = `valores` do catálogo;
//               'ultimoDaSerie' = último ponto da série; { panorama: chave } =
//               campo do dashboard (I5.4.1 usa o % do PIB já consolidado)
//   baselineAno primeiro ano da série considerado como ponto de partida
//   unidade     sobrepõe a unidade do catálogo quando o valor confrontado está
//               em outra (I5.4.1: % do PIB, não R$ milhões)
//   razao       com agregacao 'razaoCampos': { numerador, denominador, fator }
//               nomes de dois campos auxiliares do CSV; o regional é
//               Σ numerador / Σ denominador × fator (I4.2.1, I4.4.2)
//   categoriasCumpre, nota, notaAgregacao
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

function primeiroDaSerie(serie, anoMinimo) {
  const anos = Object.entries(serie || {})
    .map(([ano, valor]) => ({ ano: Number(ano), valor }))
    .filter((item) => Number.isFinite(item.ano) && Number.isFinite(item.valor) && (!anoMinimo || item.ano >= anoMinimo))
    .sort((a, b) => a.ano - b.ano);
  return anos[0] || null;
}

function normalizaCapag(nota) {
  return String(nota || '').trim().toUpperCase();
}

function anoDaReferencia(referencia) {
  const encontrado = String(referencia || '').match(/(?:19|20)\d{2}/);
  return encontrado ? encontrado[0] : null;
}

const alvoEhRegra = (parametro) => Boolean(parametro.alvo && typeof parametro.alvo === 'object');

function alvoPorEstado(parametro, serie) {
  const regra = parametro.alvo;
  if (regra.tipo === 'reducaoSobreMedia') {
    const anos = Object.entries(serie || {}).filter(([ano, valor]) => Number(ano) >= (regra.desde || 0) && Number.isFinite(valor));
    if (!anos.length) return null;
    const media = anos.reduce((soma, [, valor]) => soma + valor, 0) / anos.length;
    return media * regra.fator;
  }
  throw new Error(`metas.json: regra de alvo desconhecida "${regra.tipo}" em ${parametro.codigo}`);
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

function agregaHistorico(parametro, indicador, valores, contexto, ano = null, maisRecente = true) {
  const entradas = Object.entries(valores).filter(([, valor]) => Number.isFinite(valor));
  if (!entradas.length || parametro.agregacao === 'contagem') return null;
  const soma = (fn) => entradas.reduce((total, entrada) => total + (fn(entrada) || 0), 0);

  if (parametro.agregacao === 'soma') return soma(([, valor]) => valor);
  if (parametro.agregacao === 'media') return soma(([, valor]) => valor) / entradas.length;
  if (parametro.agregacao === 'populacao') {
    const peso = soma(([uf]) => contexto.populacaoPorUf[uf]);
    return peso ? soma(([uf, valor]) => valor * (contexto.populacaoPorUf[uf] || 0)) / peso : null;
  }
  if (parametro.agregacao === 'razaoUc') {
    const total = soma(([uf]) => indicador.extra?.[uf]?.total);
    return total ? soma(([uf]) => indicador.extra?.[uf]?.comAmbos) / total * 100 : null;
  }
  if (parametro.agregacao === 'razaoCvli') {
    const peso = soma(([uf]) => contexto.populacaoPorUf[uf]);
    return peso ? soma(([uf, valor]) => valor * (contexto.populacaoPorUf[uf] || 0)) / peso : null;
  }
  if (parametro.agregacao === 'razaoCampos') return razaoDeCampos(parametro, indicador, entradas, ano, maisRecente);
  return null;
}

function montaHistorico(parametro, indicador, estados, ufs, contexto) {
  const porAno = new Map();
  // Quando o valor vem do Panorama (I5.4.1, % do PIB), a série do catálogo está
  // em outra unidade e não pode ser misturada ao valor exibido.
  const serieCompativel = parametro.valorDe?.panorama ? null : indicador.serieAnual;

  if (serieCompativel) {
    for (const uf of ufs) {
      for (const [ano, valorBruto] of Object.entries(serieCompativel[uf] || {})) {
        let valor = parametro.direcao === 'categoria' ? normalizaCapag(valorBruto) : Number(valorBruto);
        if (parametro.agregacao === 'razaoCvli' && Number.isFinite(valor)) {
          const populacao = contexto.populacaoPorUf[uf];
          valor = populacao ? valor / populacao * 100000 : null;
        }
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
        if (estados[uf]) valores[uf] = estados[uf].valor;
      }
      if (Object.keys(valores).length) porAno.set(ano, valores);
    }
  }

  const ultimoAno = Math.max(...[...porAno.keys()].map(Number));
  return [...porAno.entries()]
    .map(([ano, valores]) => ({
      ano,
      valores,
      regional: agregaHistorico(parametro, indicador, valores, contexto, ano, Number(ano) === ultimoAno)
    }))
    .sort((a, b) => Number(a.ano) - Number(b.ano));
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
  contagem: 'sem valor regional: a meta é lida estado a estado'
};

// Motivos padrão de um indicador ficar fora do quadro, quando `exclusoes` não
// traz um específico. Texto que chega à tela pelos dados e é traduzido lá.
export const MOTIVO_PADRAO = {
  semPatamar: 'A meta não define um patamar numérico comparável aos valores coletados.',
  semValores: 'O indicador ainda não tem valores coletados para os nove estados.'
};

// Valor da Amazônia Legal como um todo. Devolve null quando a agregação não é
// defensável — nesse caso a página mostra apenas a contagem de estados.
function agregaRegional(parametro, indicador, estados, contexto) {
  const { populacaoPorUf, cvliPorUf } = contexto;
  const celulas = Object.entries(estados).filter(([, item]) => item && !item.categoria);
  if (!parametro.agregacao || parametro.agregacao === 'contagem' || !celulas.length) return null;

  const soma = (fn) => celulas.reduce((total, entrada) => total + (fn(entrada) || 0), 0);
  let valor = null;
  let alvo = alvoEhRegra(parametro) ? null : (parametro.alvo ?? null);

  if (parametro.agregacao === 'soma') {
    valor = soma(([, item]) => item.valor);
    alvo = soma(([, item]) => item.alvo);
  } else if (parametro.agregacao === 'populacao') {
    const peso = soma(([uf]) => populacaoPorUf[uf]);
    if (!peso) return null;
    valor = soma(([uf, item]) => item.valor * (populacaoPorUf[uf] || 0)) / peso;
  } else if (parametro.agregacao === 'media') {
    valor = soma(([, item]) => item.valor) / celulas.length;
  } else if (parametro.agregacao === 'razaoUc') {
    const total = soma(([uf]) => indicador.extra?.[uf]?.total);
    if (!total) return null;
    valor = soma(([uf]) => indicador.extra?.[uf]?.comAmbos) / total * 100;
  } else if (parametro.agregacao === 'razaoCvli') {
    const peso = soma(([uf]) => populacaoPorUf[uf]);
    if (!peso) return null;
    valor = soma(([uf]) => cvliPorUf[uf]) / peso * 100000;
  } else if (parametro.agregacao === 'razaoCampos') {
    valor = razaoDeCampos(parametro, indicador, celulas);
  }

  if (!Number.isFinite(valor) || !Number.isFinite(alvo)) return null;

  const cumpre = parametro.direcao === 'menor' ? valor <= alvo : valor >= alvo;
  const razao = parametro.direcao === 'menor'
    ? (alvo > 0 ? Math.min(1, alvo / valor) : null)
    : (alvo > 0 ? Math.min(1, valor / alvo) : null);
  return {
    valor,
    alvo,
    cumpre,
    distancia: parametro.direcao === 'menor' ? valor - alvo : alvo - valor,
    escala: cumpre ? 1 : razao,
    escalaTipo: 'alvo',
    metodo: parametro.agregacao,
    metodoRotulo: ROTULO_AGREGACAO[parametro.agregacao],
    nota: parametro.notaAgregacao || null
  };
}

// Indicador coletado que não entra no quadro (a meta não tem patamar numérico):
// a página mostra o valor e como ele andou, sem jornada. Viajam os números por
// estado (atual e série) e, quando `conteudo/metas.json > semMeta` declara que
// o valor da região é a soma dos estados, a série regional — só nos anos em que
// os nove têm valor, pelo mesmo motivo do `observadoRegional` acima. Sem essa
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
  return { unidadeValor: config.unidade || indicador.unidade, agregacao, valores, serieAnual, serieRegional, regionalAtual };
}

export function buildMetas(catalogo, dashboard, config, projecoes = null) {
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
  const contexto = {
    populacaoPorUf: campoDoPanorama('population'),
    cvliPorUf: campoDoPanorama(config.contexto?.cvli || 'cvli')
  };

  const metas = [];
  for (const parametro of parametros) {
    const indicador = porCodigo.get(parametro.codigo);
    if (!indicador) continue;

    const valoresDoPanorama = parametro.valorDe?.panorama ? campoDoPanorama(parametro.valorDe.panorama) : null;
    const estados = {};
    let cumpridas = 0;
    let avaliados = 0;

    for (const uf of ufs) {
      const serie = indicador.serieAnual?.[uf] || null;
      const valorBruto = valoresDoPanorama
        ? valoresDoPanorama[uf]
        : (parametro.valorDe === 'ultimoDaSerie' ? (ultimoDaSerie(serie)?.valor ?? null) : indicador.valores?.[uf]);

      if (parametro.direcao === 'categoria') {
        const nota = normalizaCapag(valorBruto);
        if (!nota || nota === 'SUSPENSA') { estados[uf] = null; continue; }
        const cumpre = parametro.categoriasCumpre.includes(nota);
        avaliados += 1;
        if (cumpre) cumpridas += 1;
        estados[uf] = { valor: nota, alvo: 'A ou B', cumpre, escala: cumpre ? 1 : 0, escalaTipo: 'categoria', categoria: true };
        continue;
      }

      const valor = Number(valorBruto);
      const alvo = alvoEhRegra(parametro) ? alvoPorEstado(parametro, serie) : parametro.alvo;
      if (!Number.isFinite(valor) || !Number.isFinite(alvo)) { estados[uf] = null; continue; }

      const cumpre = parametro.direcao === 'menor' ? valor <= alvo : valor >= alvo;
      const baseline = parametro.baselineAno
        ? primeiroDaSerie(serie, parametro.baselineAno)?.valor
        : (alvoEhRegra(parametro) ? primeiroDaSerie(serie)?.valor : null);
      avaliados += 1;
      if (cumpre) cumpridas += 1;
      // Duas escalas possíveis: quando existe baseline comparável, o avanço percorrido
      // desde ela; senão, a posição do valor em relação ao alvo. Nunca as duas juntas,
      // e o tipo viaja com o número para a página poder rotular corretamente.
      const temBaseline = Number.isFinite(baseline);
      const avanco = temBaseline ? (cumpre ? 1 : progressoEntre(baseline, valor, alvo)) : null;
      const razao = parametro.direcao === 'menor'
        ? (alvo > 0 ? Math.min(1, alvo / valor) : null)
        : (alvo > 0 ? Math.min(1, valor / alvo) : null);
      estados[uf] = {
        valor,
        alvo,
        cumpre,
        distancia: parametro.direcao === 'menor' ? valor - alvo : alvo - valor,
        escala: avanco ?? (cumpre ? 1 : razao),
        escalaTipo: temBaseline ? 'baseline' : 'alvo'
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
      alvo: alvoEhRegra(parametro) ? null : (parametro.alvo ?? null),
      alvoPorEstado: alvoEhRegra(parametro),
      estados,
      cumpridas,
      avaliados,
      regional: agregaRegional(parametro, indicador, estados, contexto),
      agregacaoRotulo: ROTULO_AGREGACAO[parametro.agregacao] || null,
      historico: montaHistorico(parametro, indicador, estados, ufs, contexto),
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

  const porEstado = Object.fromEntries(ufs.map((uf) => {
    const avaliadas = metas.filter((meta) => meta.estados[uf]);
    return [uf, {
      cumpridas: avaliadas.filter((meta) => meta.estados[uf].cumpre).length,
      avaliadas: avaliadas.length
    }];
  }));

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
        semValorRegional: metas.length - comRegional.length
      },
      porEstado
    }
  };
}
