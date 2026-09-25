"""Dados brutos do pacote "Dados da Estratégia 2050" (set/2026) que o painel não tinha.

Lê a pasta ``2. Dados Brutos`` (extraída do zip) e grava:

1. Proposta de valores (``--aplicar`` = Aceitar tudo):
   I2.2.3  telessaúde: o valor principal passa a ser o que a ficha define,
           **municípios** com estabelecimento de telessaúde (CNES, dez/2025, tabela
           por município). O valor anterior contava estabelecimentos em jul/2026 e
           fica como campo ``estabelecimentosJul2026``. Série anual de municípios
           2014-2025 de ``public/data/csv/telessaude_uf_ano.csv`` (mesma fonte).
           Campos novos: ``estabelecimentos2025`` e ``ubsFluviais2025`` (unidade
           móvel fluvial = tabela "fluvial + telessaúde" menos a de telessaúde),
           o primeiro indicador da ficha.
   I2.2.1  campo ``obitos5a74_2024``: óbitos por causas evitáveis de 5 a 74 anos
           (SIM), o recorte da ficha (≈840 mil no Brasil).
   F3.5    campo ``receitaLiquida2024``: receita líquida de vendas da indústria de
           transformação (PIA, mil R$), a variável das projeções.
2. Tabelas de detalhe em ``dashboard/public/data/csv/``:
   obitos_evitaveis_5a74_uf_ano.csv, pia_receita_liquida_uf_ano.csv,
   ubs_fluviais_uf_ano.csv.

Uso:  python scripts/estrategia_brutos_set2026.py [--aplicar]
"""
from __future__ import annotations

import csv
import sys
from collections import Counter
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
from estrategia_set2026 import UFS, aplica  # noqa: E402
from proposta import Proposta  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
BRUTOS = RAIZ / "Dados da Estratégia 2050" / "2. Dados Brutos-20260925T135204Z-1-001" / "2. Dados Brutos"
CSV_PAINEL = RAIZ / "dashboard" / "public" / "data" / "csv"
COD_UF = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "51": "MT"}


def linhas_tabnet(nome):
    return [l.replace('"', "").split(";") for l in (BRUTOS / nome).read_text(encoding="latin1").splitlines()]


def tabela_uf_ano(nome):
    """TabNet com UF nas linhas e "AAAA/Dez" nas colunas -> {uf: {ano: n}}."""
    linhas = linhas_tabnet(nome)
    cab = next(l for l in linhas if l[0].startswith("Unidade da Federa"))
    saida = {}
    for l in linhas:
        uf = COD_UF.get(l[0][:2]) if l[0][:2].isdigit() else None
        if uf:
            saida[uf] = {cab[i][:4]: (0 if l[i].strip() == "-" else int(l[i])) for i in range(1, len(cab)) if cab[i][:4].isdigit()}
    return saida


def telessaude_municipios():
    mun, est = Counter(), Counter()
    for l in linhas_tabnet("cnes_cnv_estabbr145930138_0_245_11.csv"):
        uf = COD_UF.get(l[0][:2]) if l[0][:6].isdigit() else None
        if uf:
            mun[uf] += 1
            est[uf] += int(l[1])
    return mun, est


def obitos_5a74():
    linhas = linhas_tabnet("óbitos causas evitáveis.csv")
    cab = next(l for l in linhas if l[0].startswith("Unidade da Federa"))
    saida = {}
    for l in linhas:
        uf = COD_UF.get(l[0][:2]) if l[0][:2].isdigit() else None
        if uf:
            saida[uf] = {cab[i]: int(l[i]) for i in range(1, len(cab)) if cab[i].isdigit()}
    return saida


def pia_receita():
    saida = {uf: {} for uf in UFS}
    for nome in ["tabela pia 2023 certa.xlsx", "PIA 2024.xlsx"]:
        linhas = list(openpyxl.load_workbook(BRUTOS / nome, read_only=True, data_only=True).worksheets[0].iter_rows(values_only=True))
        anos = next(r for r in linhas if r[0] is None and r[2] and str(r[2]).isdigit())
        for r in linhas:
            uf = COD_UF.get(str(r[0])) if r[0] else None
            if uf:
                for i, ano in enumerate(anos[2:], start=2):
                    if ano and str(ano).isdigit():
                        saida[uf][str(ano)] = r[i] if isinstance(r[i], (int, float)) else None
    return saida


def grava_csv(nome, colunas, linhas):
    with (CSV_PAINEL / nome).open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(colunas)
        w.writerows(linhas)
    print("tabela:", nome, len(linhas), "linhas")


def main():
    p = Proposta("estrategia_brutos_set2026", fonte="Dados da Estratégia 2050 (set/2026): CNES, SIM e PIA",
                 descricao="Telessaúde por município (I2.2.3), UBS fluviais, óbitos evitáveis 5-74 (I2.2.1), receita líquida da indústria (F3.5)")

    # --- I2.2.3 ---
    atuais = {}
    with (RAIZ / "dashboard" / "conteudo" / "valores.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["codigo"] == "I2.2.3" and not r["campo"] and not r["ano"]:
                atuais[r["uf"]] = r["valor"]
    serie = {}
    with (CSV_PAINEL / "telessaude_uf_ano.csv").open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            serie.setdefault(r["uf"], {})[r["ano"]] = int(r["municipios_com_telessaude"])
    mun, est = telessaude_municipios()
    fluvial_tele = tabela_uf_ano("cnes_cnv_estabbr145414138_0_245_11.csv")
    tele = tabela_uf_ano("telesaude.csv")
    fluviais = {uf: {ano: fluvial_tele[uf][ano] - tele.get(uf, {}).get(ano, 0) for ano in fluvial_tele[uf] if ano in tele.get(uf, {})} for uf in fluvial_tele}
    # O TabNet só lista quem tem ao menos um estabelecimento: estado-ano ausente
    # dentro do período coberto é zero, não dado faltante.
    anos = sorted({ano for s in serie.values() for ano in s})
    ultimo = anos[-1]
    nota = f"Municípios com estabelecimento de telessaúde ativo, CNES ({'jul' if ultimo == '2026' else 'dez'}/{ultimo})"
    for uf in UFS:
        serie.setdefault(uf, {})
        assert serie[uf].get("2025", 0) == mun[uf], (uf, serie[uf].get("2025"), mun[uf])
        p.valor("I2.2.3", uf, serie[uf].get(ultimo, 0), nota=nota)
        for ano in anos:
            p.valor("I2.2.3", uf, serie[uf].get(ano, 0), ano=int(ano))
        if uf in atuais:
            p.valor("I2.2.3", uf, float(atuais[uf]) if "." in atuais[uf] else int(atuais[uf]), campo="estabelecimentosJul2026",
                    nota="Valor que o painel mostrava antes: estabelecimentos, não municípios")
        p.valor("I2.2.3", uf, est[uf], campo="estabelecimentos2025")
        p.valor("I2.2.3", uf, fluviais[uf]["2025"], campo="ubsFluviais2025")
    print("telessaúde: municípios", sum(mun.values()), "estabelecimentos", sum(est.values()), "UBS fluviais", sum(f["2025"] for f in fluviais.values()))
    grava_csv("ubs_fluviais_uf_ano.csv", ["uf", "ano", "ubs_fluviais"],
              [[uf, ano, n] for uf in UFS for ano, n in sorted(fluviais[uf].items())])

    # --- I2.2.1 ---
    ob = obitos_5a74()
    for uf in UFS:
        p.valor("I2.2.1", uf, ob[uf]["2024"], campo="obitos5a74_2024")
    print("óbitos 5-74 AL 2024:", sum(ob[uf]["2024"] for uf in UFS))
    grava_csv("obitos_evitaveis_5a74_uf_ano.csv", ["uf", "ano", "obitos_evitaveis_5a74"],
              [[uf, ano, n] for uf in UFS for ano, n in sorted(ob[uf].items())])

    # --- F3.5 ---
    rec = pia_receita()
    for uf in UFS:
        p.valor("F3.5", uf, rec[uf]["2024"], campo="receitaLiquida2024")
    print("receita líquida AL 2024 (R$ bi):", round(sum(rec[uf]["2024"] for uf in UFS) / 1e6, 2))
    grava_csv("pia_receita_liquida_uf_ano.csv", ["uf", "ano", "receita_liquida_mil_reais"],
              [[uf, ano, "" if v is None else v] for uf in UFS for ano, v in sorted(rec[uf].items())])

    caminho = p.gravar()
    print("proposta:", caminho)
    if "--aplicar" in sys.argv and caminho:
        print("aplicadas:", aplica(caminho), "células")


if __name__ == "__main__":
    main()
