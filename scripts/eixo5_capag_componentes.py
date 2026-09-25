"""Eixo 5 / I5.5.1 — componentes da CAPAG 2025 por estado.

O painel guarda a nota final da CAPAG (2018-2025) e quantos dos três indicadores
parciais ficaram em A ou B (``indicadoresAB2025``). A planilha da STN traz também
os três indicadores com o valor e a nota parcial, e a qualidade da informação
contábil e fiscal (ICF). Este script acrescenta esses campos para 2025, lidos do
CSV bruto (``dados/eixo5/capag/capag_2025.csv``, idêntico ao
``capagdosestados2025.csv`` do pacote "Dados da Estratégia 2050").

  endividamento2025       Indicador 1, DC/RCL (%)            notaEndividamento2025
  poupancaCorrente2025    Indicador 2, DC/RCA (%)            notaPoupanca2025
  liquidez2025            Indicador 3, liquidez relativa (%) notaLiquidez2025
  icf2025                 qualidade da informação contábil e fiscal (Aicf, Bicf, Cicf)

Só 2025: os anos anteriores publicam o indicador 3 em outra fórmula e, em 2020,
em fração e não em percentual; juntar as séries exigiria normalizar cada ano.

Uso:  python scripts/eixo5_capag_componentes.py [--aplicar]
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from estrategia_set2026 import UFS, aplica  # noqa: E402
from proposta import Proposta  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
BRUTO = RAIZ / "dados" / "eixo5" / "capag" / "capag_2025.csv"


def pct(texto: str) -> float:
    return float(texto.strip().rstrip("%").replace(".", "").replace(",", "."))


def main():
    with BRUTO.open(encoding="utf-8-sig") as f:
        linhas = {r["UF"]: r for r in csv.DictReader(f, delimiter=";")}
    p = Proposta("eixo5_capag_componentes", fonte="STN/Tesouro Transparente: CAPAG dos estados 2025",
                 descricao="I5.5.1: indicadores parciais, notas e ICF da CAPAG 2025")
    for uf in UFS:
        r = linhas[uf]
        assert r["Classificação da CAPAG"].strip(), uf
        p.valor("I5.5.1", uf, pct(r["Indicador 1"]), campo="endividamento2025")
        p.valor("I5.5.1", uf, r["Nota 1"].strip(), campo="notaEndividamento2025")
        p.valor("I5.5.1", uf, pct(r["Indicador 2"]), campo="poupancaCorrente2025")
        p.valor("I5.5.1", uf, r["Nota 2"].strip(), campo="notaPoupanca2025")
        p.valor("I5.5.1", uf, pct(r["Indicador 3"]), campo="liquidez2025")
        p.valor("I5.5.1", uf, r["Nota 3"].strip(), campo="notaLiquidez2025")
        p.valor("I5.5.1", uf, r["Qualidade da informação contábil e fiscal"].strip(), campo="icf2025")
        print(uf, r["Classificação da CAPAG"], r["Indicador 1"], r["Nota 1"], r["Indicador 2"], r["Nota 2"],
              r["Indicador 3"], r["Nota 3"], r["Qualidade da informação contábil e fiscal"])
    caminho = p.gravar()
    print("proposta:", caminho)
    if "--aplicar" in sys.argv and caminho:
        print("aplicadas:", aplica(caminho), "células")


if __name__ == "__main__":
    main()
