// Catálogo público: o `catalogo.json` de `conteudo/` (só texto) reunido aos
// números de `valores.csv`, no formato que `public/data/catalogo.json` sempre
// teve — `valores` por UF, `serieAnual` por UF e ano, `extra` por UF.
//
// As três chaves existem em todo indicador, com `null` quando não há linha no
// CSV para ele: é assim que as páginas distinguem "sem coleta" de "coletado".

const CAMPOS_TEXTO = ['codigo', 'linhaAcao', 'nome', 'meta', 'descricao', 'unidade', 'fonte', 'prazo', 'status'];

function ouNulo(objeto) {
  return objeto && Object.keys(objeto).length ? objeto : null;
}

export function montaCatalogoPublico(fonte) {
  const { catalogo, valores, ufs } = fonte;
  return {
    eixos: catalogo.eixos.map((eixo) => ({
      numero: eixo.numero,
      nome: eixo.nome,
      indicadores: (eixo.indicadores || []).map((indicador) => {
        const numeros = valores.get(indicador.codigo);
        const saida = {};
        for (const campo of CAMPOS_TEXTO) saida[campo] = indicador[campo] ?? null;
        saida.valores = numeros ? ouNulo(ordenaPorUf(numeros.atual, ufs)) : null;
        saida.serieAnual = numeros ? ouNulo(ordenaPorUf(numeros.serie, ufs, ordenaAnos)) : null;
        saida.extra = numeros ? ouNulo(transpoeExtra(numeros.extra, ufs)) : null;
        saida.anoRef = indicador.anoRef ?? null;
        return saida;
      })
    }))
  };
}

function ordenaAnos(serie) {
  return Object.fromEntries(Object.entries(serie).sort(([a], [b]) => Number(a) - Number(b)));
}

function ordenaPorUf(porUf, ufs, mapa = (valor) => valor) {
  const saida = {};
  for (const uf of ufs) {
    if (uf in porUf) saida[uf] = mapa(porUf[uf]);
  }
  return saida;
}

// No CSV o extra é campo → UF → valor; no catálogo público é UF → campo → valor.
function transpoeExtra(extra, ufs) {
  const saida = {};
  for (const uf of ufs) {
    for (const [campo, porUf] of Object.entries(extra)) {
      if (uf in porUf) (saida[uf] ||= {})[campo] = porUf[uf];
    }
  }
  return saida;
}
