// Avaliação das metas da Estratégia Amazônia 2050 por estado.
//
// O catálogo (`dados/catalogo/indicadores.json`) traz a meta como texto livre. Este
// módulo parametriza apenas as metas que podem ser confrontadas com os valores
// coletados na mesma unidade, e declara explicitamente as que não podem — a lista de
// exclusões faz parte do resultado, não é um silêncio.
//
// Fonte dos valores: sempre o próprio catálogo, para que valor e meta venham do mesmo
// arquivo e não possam divergir. A única exceção é I5.4.1, documentada abaixo.

// tipo: 'declarada' = o número está escrito na meta; 'inferida' = a meta é qualitativa
// ou regional e foi operacionalizada aqui; 'derivada' = calculada por estado a partir
// de uma baseline da própria série.
//
// agregacao: como o valor da Amazônia Legal como um todo é obtido a partir dos nove
// estados. O método viaja com o número até a página, porque uma soma e uma média
// simples não têm o mesmo peso de evidência. Quando a ponderação correta exigiria um
// denominador que não temos, isso fica dito em `notaAgregacao`.
const PARAMETROS = [
  {
    codigo: 'I1.1.2',
    alvo: 40,
    direcao: 'maior',
    tipo: 'inferida',
    agregacao: 'razaoUc',
    nota: 'A meta é regional (40% das UCs estaduais da Amazônia Legal). Aqui ela é aplicada como referência para cada estado, o que não equivale ao compromisso pactuado no agregado.'
  },
  {
    codigo: 'I1.3.1',
    alvo: 52.1,
    direcao: 'menor',
    tipo: 'declarada',
    agregacao: 'media',
    notaAgregacao: 'Média simples dos nove estados: o catálogo traz a média estadual já consolidada, não o número de municípios prioritários que a compõe.',
    nota: 'Convergência para 52,1 pontos, a média do grupo menos vulnerável. O valor estadual é a média dos municípios prioritários, o mesmo recorte citado na meta.'
  },
  {
    codigo: 'I1.3.2',
    alvo: 0,
    direcao: 'menor',
    tipo: 'declarada',
    agregacao: 'soma',
    // Sem baseline: a meta é eliminar o desmatamento ilegal, e não declara ano de
    // partida. Medir "percurso" exigiria eleger um ano arbitrário — 2020 era o
    // primeiro da série, não uma referência pactuada — e daria a estados com áreas
    // muito diferentes percentuais que não se comparam. A leitura fica sendo a
    // área que ainda falta zerar.
    nota: 'A meta é desmatamento ilegal zero e não define ano de partida, então não há percentual de percurso: o que se lê é a área que falta zerar.'
  },
  {
    codigo: 'I1.3.4',
    direcao: 'menor',
    tipo: 'derivada',
    agregacao: 'soma',
    alvoPorEstado: (serie) => {
      const anos = Object.entries(serie || {}).filter(([ano, valor]) => Number(ano) >= 2015 && Number.isFinite(valor));
      if (!anos.length) return null;
      const media = anos.reduce((soma, [, valor]) => soma + valor, 0) / anos.length;
      return media * 0.7;
    },
    valorPorEstado: (serie) => ultimoDaSerie(serie)?.valor ?? null,
    nota: 'Redução de 30% sobre a média histórica de cada estado. A meta cita a baseline 2015–2025; a série consolidada termina em 2024, então a janela usada é 2015–2024.'
  },
  { codigo: 'I2.1.1', alvo: 3, direcao: 'menor', tipo: 'declarada', agregacao: 'populacao' },
  {
    codigo: 'I2.3.2',
    alvo: 100,
    direcao: 'maior',
    tipo: 'inferida',
    agregacao: 'populacao',
    notaAgregacao: 'Ponderação pela população total de cada estado, e não pela população de 4 a 17 anos, que não está na base consolidada.',
    nota: 'A meta fala em universalizar o acesso, sem número. Adotamos 100% de atendimento como leitura da universalização; um patamar de 98%, por exemplo, produziria outro resultado.'
  },
  { codigo: 'I2.4.1', alvo: 10, direcao: 'menor', tipo: 'declarada', agregacao: 'razaoCvli' },
  { codigo: 'I4.1.1', alvo: 80, direcao: 'maior', tipo: 'declarada', agregacao: 'populacao', baselineAno: 2021 },
  {
    codigo: 'I4.3.2',
    alvo: 80,
    direcao: 'maior',
    tipo: 'declarada',
    agregacao: 'media',
    notaAgregacao: 'Média simples dos nove estados. A leitura regional correta ponderaria pela potência instalada de cada estado, que não está na base consolidada.'
  },
  { codigo: 'I4.4.1', alvo: 80, direcao: 'maior', tipo: 'declarada', agregacao: 'populacao' },
  {
    codigo: 'I5.4.1',
    alvo: 1,
    direcao: 'maior',
    tipo: 'declarada',
    fonteValor: 'dashboard',
    unidade: '% do PIB',
    agregacao: 'media',
    notaAgregacao: 'Média simples dos nove estados. Ponderar pelo PIB exigiria o PIB do mesmo ano de referência em todos os estados, o que a série não oferece.',
    nota: 'Os valores de I5.4.1 no catálogo estão em R$ milhões, não em percentual do PIB. Para confrontar com a meta de 1% do PIB usamos o campo pct_pib da mesma base (MCTI), já consolidado pelo painel.'
  },
  {
    codigo: 'I5.5.1',
    direcao: 'categoria',
    tipo: 'declarada',
    agregacao: 'contagem',
    categoriasCumpre: ['A+', 'A', 'B+', 'B'],
    nota: 'A meta do indicador é CAPAG A ou B. Notas com sinal (A+, B+) são contadas dentro da faixa correspondente.'
  }
];

// Indicadores que têm valores coletados mas cuja meta não é confrontável hoje.
const EXCLUSOES = {
  'I2.2.1': 'A meta é de redução de 50% na região, sem baseline informada no catálogo. Sem o ponto de partida não há como dizer se um estado está cumprindo.',
  'I2.2.2': 'A meta é de cobertura de 100% da população, mas os valores coletados são o número de equipes de atenção primária, não o percentual de cobertura.',
  'I2.2.3': 'A meta é ter telessaúde em pelo menos 50% dos municípios; o valor coletado é a contagem absoluta de municípios atendidos, sem o total municipal por estado no catálogo.',
  'I3.1.1': 'A meta de aumento de R$ 100 milhões não indica a que baseline se refere nem se é por estado ou regional.',
  'F3.2': 'A ficha define estruturação de cadeias produtivas de forma qualitativa, sem patamar numérico.',
  'F3.5': 'A meta é de crescimento de 10% ao ano em valores nominais. Avaliar cumprimento por um único ano de variação diria mais sobre inflação e base de comparação do que sobre a meta de 2050.'
};

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

function progressoEntre(baseline, atual, alvo) {
  if (![baseline, atual, alvo].every(Number.isFinite)) return null;
  const percurso = baseline - alvo;
  if (percurso === 0) return atual === alvo ? 1 : 0;
  const razao = (baseline - atual) / percurso;
  return Math.max(0, Math.min(1, razao));
}

const ROTULO_AGREGACAO = {
  soma: 'soma dos nove estados',
  populacao: 'média ponderada pela população',
  media: 'média simples dos nove estados',
  razaoUc: 'unidades com plano e conselho sobre o total de unidades',
  razaoCvli: 'total de CVLI sobre a população regional',
  contagem: 'sem valor regional: a meta é uma classificação por estado'
};

// Valor da Amazônia Legal como um todo. Devolve null quando a agregação não é
// defensável — nesse caso a página mostra apenas a contagem de estados.
function agregaRegional(parametro, indicador, estados, contexto) {
  const { populacaoPorUf, cvliPorUf } = contexto;
  const celulas = Object.entries(estados).filter(([, item]) => item && !item.categoria);
  if (!parametro.agregacao || parametro.agregacao === 'contagem' || !celulas.length) return null;

  const soma = (fn) => celulas.reduce((total, entrada) => total + (fn(entrada) || 0), 0);
  let valor = null;
  let alvo = parametro.alvo ?? null;

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

export function buildMetas(catalogo, dashboard) {
  const ufs = (dashboard?.states || []).map((estado) => estado.uf);
  const porCodigo = new Map();
  for (const eixo of catalogo?.eixos || []) {
    for (const indicador of eixo.indicadores || []) {
      porCodigo.set(indicador.codigo, { ...indicador, eixo: eixo.numero, eixoNome: eixo.nome });
    }
  }
  const pdPorUf = Object.fromEntries((dashboard?.states || []).map((estado) => [estado.uf, estado.pdPctPib]));
  const contexto = {
    populacaoPorUf: Object.fromEntries((dashboard?.states || []).map((estado) => [estado.uf, estado.population])),
    cvliPorUf: Object.fromEntries((dashboard?.states || []).map((estado) => [estado.uf, estado.cvli]))
  };

  const metas = [];
  for (const parametro of PARAMETROS) {
    const indicador = porCodigo.get(parametro.codigo);
    if (!indicador) continue;

    const estados = {};
    let cumpridas = 0;
    let avaliados = 0;

    for (const uf of ufs) {
      const serie = indicador.serieAnual?.[uf] || null;
      const valorBruto = parametro.fonteValor === 'dashboard'
        ? pdPorUf[uf]
        : (parametro.valorPorEstado ? parametro.valorPorEstado(serie) : indicador.valores?.[uf]);

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
      const alvo = parametro.alvoPorEstado ? parametro.alvoPorEstado(serie) : parametro.alvo;
      if (!Number.isFinite(valor) || !Number.isFinite(alvo)) { estados[uf] = null; continue; }

      const cumpre = parametro.direcao === 'menor' ? valor <= alvo : valor >= alvo;
      const baseline = parametro.baselineAno
        ? primeiroDaSerie(serie, parametro.baselineAno)?.valor
        : (parametro.alvoPorEstado ? primeiroDaSerie(serie)?.valor : null);
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

    metas.push({
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
      direcao: parametro.direcao,
      tipo: parametro.tipo,
      nota: parametro.nota || null,
      alvo: parametro.alvo ?? null,
      alvoPorEstado: Boolean(parametro.alvoPorEstado),
      estados,
      cumpridas,
      avaliados,
      regional: agregaRegional(parametro, indicador, estados, contexto),
      agregacaoRotulo: ROTULO_AGREGACAO[parametro.agregacao] || null
    });
  }

  const codigosAvaliados = new Set(metas.map((meta) => meta.codigo));
  const foraDoPainel = [];
  for (const [, indicador] of porCodigo) {
    if (codigosAvaliados.has(indicador.codigo)) continue;
    const motivo = EXCLUSOES[indicador.codigo]
      || (indicador.valores
        ? 'A meta não define um patamar numérico comparável aos valores coletados.'
        : 'O indicador ainda não tem valores coletados para os nove estados.');
    foraDoPainel.push({
      codigo: indicador.codigo,
      eixo: indicador.eixo,
      eixoNome: indicador.eixoNome,
      nome: indicador.nome,
      metaTexto: indicador.meta,
      status: indicador.status,
      temValores: Boolean(indicador.valores),
      motivo
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
      regional: {
        comValorRegional: comRegional.length,
        cumpridas: comRegional.filter((meta) => meta.regional.cumpre).length,
        semValorRegional: metas.length - comRegional.length
      },
      porEstado
    }
  };
}
