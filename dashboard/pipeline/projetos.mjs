// Carteira de projetos (conteudo/projetos.json) no formato que a página
// /projetos lê. A fonte guarda também o que o site do Consórcio diz ao pé da
// letra; para a página vai só o que ela mostra, mais o nome dos eixos e dos
// estados, para ela não precisar de outro arquivo.
//
// O site traz cada ficha numa língua só, e várias misturam as duas (título em
// inglês, resumo em português). A página mostra uma língua por vez, a do
// seletor: `traducao` guarda, por língua, o texto dos campos que o site não
// escreveu nela, e daqui saem os dois textos completos de cada cartão.

/** As seis faixas de orçamento do formulário da carteira, em dólar, da menor para a maior. */
export const FAIXAS_DE_ORCAMENTO = ['ate-500k', '500k-1m', '1m-3.5m', '3.5m-5m', '5m-10m', 'acima-10m'];

const LINGUAS = ['pt', 'en'];
/** Os campos de texto do cartão, os únicos que `traducao` pode trazer. */
export const CAMPOS_DE_TEXTO = ['titulo', 'entidade', 'resumo'];

/**
 * As línguas em que a ficha ainda não está inteira, por faltar o título ou o
 * resumo. Vale o texto do site quando a ficha é dessa língua, ou quando
 * `traducao` o refez na língua da ficha: sinal de que o site o escreveu na
 * outra. O órgão fica de fora, porque muitos são só a sigla. Com `par`, a
 * outra língua é a outra ficha, e não falta nada.
 */
export function linguasSemTraducao(projeto) {
  if (projeto.par) return [];
  const falta = (lingua, campo) => projeto[campo] && !projeto.traducao?.[lingua]?.[campo] && !projeto.traducao?.[projeto.idioma]?.[campo];
  return LINGUAS.filter((lingua) => lingua !== projeto.idioma && ['titulo', 'resumo'].some((campo) => falta(lingua, campo)));
}

export function validaProjetos(carteira, ufs, exige) {
  exige(Array.isArray(carteira.projetos), 'projetos.json sem a lista de projetos');
  const ids = new Set();
  for (const projeto of carteira.projetos) {
    exige(projeto.id && !ids.has(projeto.id), `projetos.json: id repetido ou vazio: "${projeto.id}"`);
    ids.add(projeto.id);
    exige(/^https:\/\//.test(projeto.url || ''), `projetos.json: "${projeto.id}" sem endereço`);
    exige(Array.isArray(projeto.ufs) && projeto.ufs.every((uf) => ufs.includes(uf)), `projetos.json: "${projeto.id}" cita um estado que o painel não tem`);
    exige(projeto.eixo === null || [1, 2, 3, 4, 5].includes(projeto.eixo), `projetos.json: "${projeto.id}" com eixo fora de 1 a 5`);
    exige(projeto.faixa === null || FAIXAS_DE_ORCAMENTO.includes(projeto.faixa), `projetos.json: "${projeto.id}" com faixa de orçamento desconhecida: "${projeto.faixa}"`);
    exige(['pt', 'en'].includes(projeto.idioma), `projetos.json: "${projeto.id}" sem idioma (pt ou en)`);
    exige(!projeto.foto || /^\/fotos-projetos\/[\w.-]+$/.test(projeto.foto), `projetos.json: "${projeto.id}" com foto fora de /fotos-projetos/`);
    for (const [lingua, campos] of Object.entries(projeto.traducao || {})) {
      exige(LINGUAS.includes(lingua), `projetos.json: "${projeto.id}" com tradução em língua desconhecida: "${lingua}"`);
      exige(Object.entries(campos).every(([campo, texto]) => CAMPOS_DE_TEXTO.includes(campo) && typeof texto === 'string' && texto.trim()), `projetos.json: "${projeto.id}" com tradução vazia ou de campo que não é do cartão (${lingua})`);
    }
  }
  for (const projeto of carteira.projetos) {
    exige(!projeto.par || ids.has(projeto.par), `projetos.json: "${projeto.id}" aponta um par que não existe: "${projeto.par}"`);
  }
}

// A licença das fotos ilustrativas exige o crédito: sem autor, licença ou
// página de origem a foto não pode ir ao ar.
export function validaFotosDosEstados(lista, ufs, exige) {
  exige(Array.isArray(lista.fotos), 'fotos-estados.json sem a lista de fotos');
  for (const foto of lista.fotos) {
    exige(ufs.includes(foto.uf), `fotos-estados.json: "${foto.commons}" cita um estado que o painel não tem`);
    exige(/^\/fotos-projetos\/estados\/[\w.-]+$/.test(foto.arquivo || ''), `fotos-estados.json: "${foto.commons}" ainda não foi baixada (rode scripts/baixar-fotos-estados.mjs)`);
    exige(foto.autor && foto.licenca && /^https:\/\//.test(foto.pagina || ''), `fotos-estados.json: "${foto.commons}" sem autor, licença ou página de origem`);
  }
}

/**
 * Dá uma foto ilustrativa do estado a cada projeto que o site publica sem
 * foto. Cada estado tem a sua fila, percorrida na ordem da carteira, de modo
 * que a mesma foto só se repete quando o estado tem mais projetos sem foto do
 * que fotos na lista. As duas línguas do mesmo projeto ficam com a mesma.
 */
function distribuiFotos(projetos, fotos) {
  const filas = new Map();
  for (const foto of fotos) filas.set(foto.uf, [...(filas.get(foto.uf) || []), foto]);
  const proxima = new Map();
  const dada = new Map();
  for (const projeto of projetos) {
    if (projeto.foto || dada.has(projeto.id)) continue;
    const uf = projeto.ufs.find((sigla) => filas.has(sigla));
    if (!uf) continue;
    const fila = filas.get(uf);
    const vez = proxima.get(uf) || 0;
    proxima.set(uf, vez + 1);
    dada.set(projeto.id, fila[vez % fila.length]);
    if (projeto.par) dada.set(projeto.par, fila[vez % fila.length]);
  }
  return dada;
}

// O texto do cartão numa língua: o do site no que ele já escreveu nela, e o de
// `traducao` no resto. Sem tradução, sobra o do site, e a página avisa.
function textoEm(projeto, lingua) {
  const campo = (nome) => projeto.traducao?.[lingua]?.[nome] ?? projeto[nome] ?? '';
  // Sem título no site, a ficha é apresentada pelo órgão que a propôs.
  const titulo = campo('titulo');
  return { titulo: titulo || campo('entidade'), entidade: titulo ? campo('entidade') : '', resumo: campo('resumo') };
}

export function montaProjetosPublicos({ projetos: carteira, fotosEstados, catalogo, panorama, ufs }) {
  const porId = new Map(carteira.projetos.map((projeto) => [projeto.id, projeto]));
  // Quem tem foto própria, sua ou da ficha na outra língua, não entra na distribuição.
  const comFotoPropria = (projeto) => projeto.foto || porId.get(projeto.par)?.foto || null;
  const ilustrativas = distribuiFotos(carteira.projetos.filter((projeto) => !projeto.oculto).map((projeto) => ({ ...projeto, foto: comFotoPropria(projeto) })), fotosEstados?.fotos || []);
  const creditoDe = (foto) => ({ autor: foto.autor, licenca: foto.licenca, pagina: foto.pagina });
  const projetos = carteira.projetos.filter((projeto) => !projeto.oculto).map((projeto) => ({
    id: projeto.id,
    url: projeto.url,
    textos: Object.fromEntries(LINGUAS.map((lingua) => [lingua, textoEm(projeto, lingua)])),
    // As línguas em que a ficha ainda aparece como o site a escreveu, em outra.
    semTraducao: linguasSemTraducao(projeto).length ? linguasSemTraducao(projeto) : undefined,
    ufs: projeto.ufs,
    eixo: projeto.eixo,
    faixa: projeto.faixa,
    duracaoMeses: projeto.duracaoMeses,
    areas: projeto.areas,
    idioma: projeto.idioma,
    par: projeto.par || null,
    // Das duas línguas do mesmo projeto, às vezes só uma ficha tem foto. Sem
    // nenhuma, vai a ilustrativa do estado, com o crédito que a licença pede.
    foto: comFotoPropria(projeto) || ilustrativas.get(projeto.id)?.arquivo || null,
    credito: !comFotoPropria(projeto) && ilustrativas.has(projeto.id) ? creditoDe(ilustrativas.get(projeto.id)) : null
  }));
  return {
    fonte: carteira.fonte,
    faixas: FAIXAS_DE_ORCAMENTO,
    eixos: catalogo.eixos.map((eixo) => ({ numero: eixo.numero, nome: eixo.nome, en: eixo.en?.nome || null })),
    estados: ufs.map((uf) => ({ uf, name: panorama.estados[uf].name, flag: panorama.estados[uf].flag })),
    projetos
  };
}
