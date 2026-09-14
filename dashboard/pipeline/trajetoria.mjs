// Trajetória de cada meta: onde a série está, em que ritmo anda e em que ano
// cruzaria o alvo se o ritmo se mantivesse.
//
// É uma projeção mecânica a partir da própria série, não uma previsão: nada
// aqui sabe de política, orçamento ou clima. Por isso a conta é simples e
// declarada por inteiro no resultado (janela, método, pontos), para a página
// poder dizer exatamente de onde saiu cada número.
//
// Para cada meta e escopo (Amazônia Legal e cada estado):
//   atual            último ponto da série (ano, valor)
//   base             primeiro ponto da janela usada para o ritmo
//   ritmo            variação média por ano na janela: linear = inclinação da
//                    reta de mínimos quadrados; composto = taxa geométrica
//   ritmoNecessario  variação por ano que levaria do valor atual ao alvo no prazo
//   anoAlcance       ano em que a tendência cruza o alvo (null se não cruza)
//   aceleracao       ritmoNecessario / ritmo, quando os dois apontam para o alvo
//   classe           cumprida | noRitmo | acelerar | contrario | semSerie | desligada
//
// Parâmetros por meta em conteudo/metas.json (`trajetoria`, opcional):
//   janela     quantos pontos mais recentes entram no ritmo (padrão 5, mínimo 3)
//   metodo     'linear' (padrão) | 'composto'
//   desligada  true tira a meta da trajetória (série com quebra, por exemplo)
//   nota       explicação exibida junto

export const ANO_LIMITE = 2050;
export const JANELA_PADRAO = 5;
export const PONTOS_MINIMOS = 3;

function pontosDe(historico, escopo) {
  return (historico || [])
    .map((item) => ({ ano: Number(item.ano), valor: escopo === 'regional' ? item.regional : item.valores?.[escopo] }))
    .filter((item) => Number.isFinite(item.ano) && Number.isFinite(item.valor))
    .sort((a, b) => a.ano - b.ano);
}

function inclinacao(pontos) {
  const n = pontos.length;
  const mediaX = pontos.reduce((soma, p) => soma + p.ano, 0) / n;
  const mediaY = pontos.reduce((soma, p) => soma + p.valor, 0) / n;
  const numerador = pontos.reduce((soma, p) => soma + (p.ano - mediaX) * (p.valor - mediaY), 0);
  const denominador = pontos.reduce((soma, p) => soma + (p.ano - mediaX) ** 2, 0);
  return denominador ? numerador / denominador : 0;
}

function taxaComposta(pontos) {
  const primeiro = pontos[0];
  const ultimo = pontos.at(-1);
  const anos = ultimo.ano - primeiro.ano;
  if (!anos || primeiro.valor <= 0 || ultimo.valor <= 0) return null;
  return (ultimo.valor / primeiro.valor) ** (1 / anos) - 1;
}

/**
 * Trajetória de um escopo. `alvo` e `prazo` numéricos; `direcao` 'maior' ou
 * 'menor'. Devolve null quando não há nem o ponto atual.
 */
export function calculaTrajetoria({ pontos, alvo, prazo, direcao, cumpre, parametro = {} }) {
  if (!pontos.length) return null;
  const atual = pontos.at(-1);
  const janela = Math.max(PONTOS_MINIMOS, Number(parametro.janela) || JANELA_PADRAO);
  const metodo = parametro.metodo === 'composto' ? 'composto' : 'linear';
  const comum = { atual, alvo, prazo, metodo, janela, pontos: pontos.length, serie: pontos, nota: parametro.nota || null };

  if (parametro.desligada) return { ...comum, classe: 'desligada', base: null, ritmo: null, ritmoNecessario: null, anoAlcance: null, aceleracao: null };
  if (cumpre) return { ...comum, classe: 'cumprida', base: null, ritmo: null, ritmoNecessario: null, anoAlcance: atual.ano, aceleracao: null };
  if (!Number.isFinite(alvo) || !Number.isFinite(prazo)) return null;

  const anosRestantes = prazo - atual.ano;
  const ritmoNecessario = anosRestantes > 0 ? (alvo - atual.valor) / anosRestantes : null;
  if (pontos.length < PONTOS_MINIMOS) {
    return { ...comum, classe: 'semSerie', base: null, ritmo: null, ritmoNecessario, anoAlcance: null, aceleracao: null };
  }

  const recentes = pontos.slice(-janela);
  const base = recentes[0];
  let ritmo;
  let anoAlcance = null;
  if (metodo === 'composto') {
    const taxa = taxaComposta(recentes);
    if (taxa === null) return { ...comum, classe: 'semSerie', base, ritmo: null, ritmoNecessario, anoAlcance: null, aceleracao: null };
    // Ritmo expresso na unidade do indicador, para a página comparar com o necessário.
    ritmo = atual.valor * taxa;
    if (taxa !== 0 && alvo > 0 && atual.valor > 0) {
      const anos = Math.log(alvo / atual.valor) / Math.log(1 + taxa);
      if (Number.isFinite(anos) && anos > 0) anoAlcance = Math.ceil(atual.ano + anos);
    }
  } else {
    ritmo = inclinacao(recentes);
    if (ritmo !== 0) {
      const anos = (alvo - atual.valor) / ritmo;
      if (anos > 0) anoAlcance = Math.ceil(atual.ano + anos);
    }
  }

  const sentidoCerto = direcao === 'menor' ? ritmo < 0 : ritmo > 0;
  const aceleracao = sentidoCerto && ritmoNecessario !== null && ritmo !== 0 ? ritmoNecessario / ritmo : null;
  let classe;
  if (!sentidoCerto || anoAlcance === null) classe = 'contrario';
  else if (anoAlcance <= prazo) classe = 'noRitmo';
  else classe = 'acelerar';

  return { ...comum, classe, base, ritmo, ritmoNecessario, anoAlcance, aceleracao };
}

/** Trajetória de uma meta já montada pelo buildMetas, em todos os escopos. */
export function trajetoriaDaMeta(meta, parametro, ufs) {
  if (meta.direcao === 'categoria') return null;
  const config = parametro.trajetoria || {};
  const prazo = Number(meta.prazo);
  const escopos = {};
  for (const uf of ufs) {
    const estado = meta.estados[uf];
    if (!estado) { escopos[uf] = null; continue; }
    escopos[uf] = calculaTrajetoria({ pontos: pontosDe(meta.historico, uf), alvo: estado.alvo, prazo, direcao: meta.direcao, cumpre: estado.cumpre, parametro: config });
  }
  const regional = meta.regional
    ? calculaTrajetoria({ pontos: pontosDe(meta.historico, 'regional'), alvo: meta.regional.alvo, prazo, direcao: meta.direcao, cumpre: meta.regional.cumpre, parametro: config })
    : null;
  return { regional, estados: escopos };
}

/**
 * Resumo para o Panorama: por escopo, a contagem por classe e a lista das
 * metas com o essencial de cada uma. É o que dashboard.json carrega.
 */
export function resumeTrajetoria(metas, ufs) {
  const escopos = ['regional', ...ufs];
  const contagem = Object.fromEntries(escopos.map((escopo) => [escopo, { cumprida: 0, noRitmo: 0, acelerar: 0, contrario: 0, semSerie: 0, desligada: 0, naoAvaliada: 0 }]));
  const lista = [];
  for (const meta of metas) {
    if (!meta.trajetoria) continue;
    const porEscopo = {};
    for (const escopo of escopos) {
      const item = escopo === 'regional' ? meta.trajetoria.regional : meta.trajetoria.estados[escopo];
      if (!item) { contagem[escopo].naoAvaliada += 1; porEscopo[escopo] = null; continue; }
      contagem[escopo][item.classe] += 1;
      porEscopo[escopo] = {
        classe: item.classe,
        atual: item.atual,
        base: item.base,
        alvo: item.alvo,
        ritmo: item.ritmo,
        ritmoNecessario: item.ritmoNecessario,
        anoAlcance: item.anoAlcance,
        aceleracao: item.aceleracao,
        pontos: item.pontos,
        serie: item.serie,
        janela: item.janela,
        metodo: item.metodo,
        nota: item.nota
      };
    }
    lista.push({
      codigo: meta.codigo,
      eixo: meta.eixo,
      nome: meta.nome,
      en: meta.en || null,
      unidade: meta.unidade,
      prazo: meta.prazo,
      direcao: meta.direcao,
      escopos: porEscopo
    });
  }
  return { anoLimite: ANO_LIMITE, contagem, metas: lista };
}
