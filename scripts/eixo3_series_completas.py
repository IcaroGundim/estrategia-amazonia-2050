"""Eixo 3 — séries que já estão no projeto e não chegavam ao catálogo.

Os coletores do eixo 3 (eixo3_pevs.py, eixo3_pia.py, eixo3_rais.py) gravaram
séries longas em dashboard/public/data/*.json, usadas no Panorama, mas o
catálogo dos indicadores ficou com um recorte curto. Nos anos em comum os
valores são idênticos (conferido: 90 + 90 + 18 células, nenhuma diferença), então
estender é trazer a mesma variável da mesma fonte, sem emenda nova:

  I3.1.1  PEVS, valor da produção da extração vegetal (SIDRA 289, var. 145,
          Total), 1994-2024. O catálogo tinha 2015-2024. R$ bilhões no JSON,
          R$ mil no catálogo. RR 1995 não existe na tabela.
  F3.5    PIA, valor da transformação industrial do total da indústria (SIDRA
          1849 até 2023, 10457 em 2024; var. 811), 2007-2024. O catálogo tinha
          2015-2024. R$ bilhões no JSON, R$ mil no catálogo.
  F3.2    RAIS Estabelecimentos, vínculos ativos em 31/12 e estabelecimentos
          ativos, 2018-2021 e 2023-2025 (2022 descartado: a edição não preencheu
          "Ind Atividade Ano"). O catálogo tinha 2023-2024; o valor atual passa a
          2025 e os estabelecimentos de cada ano vão para ``estabelecimentos<ano>``.

Só entram células que o catálogo ainda não tem; as existentes não são tocadas.

Uso:  python scripts/eixo3_series_completas.py [--aplicar]
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from estrategia_set2026 import UFS, aplica  # noqa: E402
from proposta import Proposta  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
DADOS = RAIZ / "dashboard" / "public" / "data"
VALORES = RAIZ / "dashboard" / "conteudo" / "valores.csv"


def main():
    existentes = set()
    with VALORES.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            existentes.add((r["codigo"], r["campo"], r["uf"], r["ano"]))
    novo = lambda codigo, campo, uf, ano: (codigo, campo, uf, str(ano)) not in existentes

    p = Proposta("eixo3_series_completas", fonte="IBGE (PEVS, PIA) e MTE (RAIS), séries já coletadas pelo projeto",
                 descricao="I3.1.1 1994-2014, F3.5 2007-2014, F3.2 2018-2021 e 2025")
    contagem = {}

    for arquivo, codigo in (("pevs-extracao-vegetal.json", "I3.1.1"), ("pia-transformacao-industrial.json", "F3.5")):
        serie = json.loads((DADOS / arquivo).read_text(encoding="utf-8"))["seriePrecosCorrentes"]["serie"]
        n = 0
        for uf in UFS:
            for ano, bilhoes in serie.get(uf, {}).items():
                if bilhoes is None or not novo(codigo, "", uf, ano):
                    continue
                p.valor(codigo, uf, round(bilhoes * 1_000_000), ano=int(ano))  # R$ bilhões -> R$ mil
                n += 1
        contagem[codigo] = n

    rais = json.loads((DADOS / "rais-empregos.json").read_text(encoding="utf-8"))
    ultimo = max(rais["anos"])
    n = 0
    for uf in UFS:
        for ano, vinculos in rais["vinculosAtivos"][uf].items():
            if novo("F3.2", "", uf, ano):
                p.valor("F3.2", uf, vinculos, ano=int(ano))
                n += 1
        for ano, estab in rais["estabelecimentosAtivos"][uf].items():
            if novo("F3.2", f"estabelecimentos{ano}", uf, ""):
                p.valor("F3.2", uf, estab, campo=f"estabelecimentos{ano}")
                n += 1
        # valor atual = ano mais recente da série (substitui 2024)
        p.valor("F3.2", uf, rais["vinculosAtivos"][uf][ultimo], nota=f"Vínculos ativos em 31/12/{ultimo} (RAIS Estabelecimentos)")
        n += 1
    contagem["F3.2"] = n

    print("células novas:", contagem, "| F3.2 atual =", ultimo)
    caminho = p.gravar()
    print("proposta:", caminho)
    if "--aplicar" in sys.argv and caminho:
        print("aplicadas:", aplica(caminho), "células")


if __name__ == "__main__":
    main()
