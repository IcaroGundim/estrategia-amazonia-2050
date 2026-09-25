"""Eixo 2 / I2.3.1: % de municípios que atingiram a meta do IDEB, por UF.

A ficha pede o percentual de municípios da AL que atingiram ou superaram a meta
do IDEB nas três etapas. O INEP projetou metas só até 2021; as edições de 2023
e 2025 saíram sem meta. A regra da Estratégia (a das planilhas de projeção,
pacote "Dados da Estratégia 2050", set/2026) compara o IDEB observado com a
**última meta projetada, a de 2021**. Refeita aqui sobre a base municipal do
painel (``dashboard/public/data/csv/ideb_municipio_ano.csv``, gerada por
``eixo2_ideb_inep.py`` a partir dos arquivos de divulgação do INEP), ela dá
para 2023 30,7% / 7,8% / 61,4% (anos iniciais / finais / ensino médio); a
projeção parte de 30,3% / 7,7% / 58,1%: mesma regra, universo de municípios
ligeiramente diferente.

Valor principal: pares município × etapa que atingiram sobre pares avaliados
(as três etapas juntas). Campos auxiliares: o percentual e as contagens de cada
etapa. Série: 2023 e 2025. A série de 2007 a 2021, contra a meta de cada ano, é
outra regra e fica fora para não emendar dois critérios.

Uso:  python scripts/eixo2_ideb_meta2021.py [--aplicar]
"""
from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from estrategia_set2026 import UFS, aplica  # noqa: E402
from proposta import Proposta  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
BASE = RAIZ / "dashboard" / "public" / "data" / "csv" / "ideb_municipio_ano.csv"
ETAPAS = {"anos iniciais": "AnosIniciais", "anos finais": "AnosFinais", "ensino médio": "EnsinoMedio"}
ANOS = ["2023", "2025"]
ANO_META = "2021"


def main():
    por_mun = defaultdict(dict)
    with BASE.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            por_mun[(r["uf"], r["cod_municipio"], r["etapa"])][r["ano"]] = r

    # contagem[ano][uf][etapa] = [atingiram, avaliados]
    contagem = {ano: {uf: {e: [0, 0] for e in ETAPAS} for uf in UFS} for ano in ANOS}
    for (uf, _, etapa), anos in por_mun.items():
        if uf not in UFS or etapa not in ETAPAS:
            continue
        meta = (anos.get(ANO_META) or {}).get("meta")
        if not meta:
            continue
        for ano in ANOS:
            ideb = (anos.get(ano) or {}).get("ideb")
            if not ideb:
                continue
            c = contagem[ano][uf][etapa]
            c[1] += 1
            c[0] += float(ideb) >= float(meta)

    p = Proposta("eixo2_ideb_meta2021", fonte="INEP/IDEB municipal (divulgação 2023 e 2025) contra a meta de 2021",
                 descricao="I2.3.1: % de municípios que atingiram a última meta do IDEB, por etapa")
    nota = "IDEB observado contra a última meta projetada pelo INEP (2021)"
    for uf in UFS:
        for ano in ANOS:
            ating = sum(c[0] for c in contagem[ano][uf].values())
            aval = sum(c[1] for c in contagem[ano][uf].values())
            if aval:
                p.valor("I2.3.1", uf, round(ating / aval * 100, 2), ano=int(ano), nota=nota)
            if ano != ANOS[-1]:
                # contagens das edições anteriores, para o regional de cada ano
                # (pipeline/metas.mjs, razaoCampos: `atingiram2023` / `avaliados2023`)
                p.valor("I2.3.1", uf, ating, campo=f"atingiram{ano}")
                p.valor("I2.3.1", uf, aval, campo=f"avaliados{ano}")
        ultimo = contagem[ANOS[-1]][uf]
        ating = sum(c[0] for c in ultimo.values())
        aval = sum(c[1] for c in ultimo.values())
        p.valor("I2.3.1", uf, round(ating / aval * 100, 2), nota=f"{nota}; edição {ANOS[-1]}")
        p.valor("I2.3.1", uf, ating, campo="atingiram")
        p.valor("I2.3.1", uf, aval, campo="avaliados")
        for etapa, sufixo in ETAPAS.items():
            a, n = ultimo[etapa]
            p.valor("I2.3.1", uf, round(a / n * 100, 2) if n else None, campo=f"pct{sufixo}")

    # conferência com a linha de base da projeção
    for etapa in ETAPAS:
        a = sum(contagem["2023"][uf][etapa][0] for uf in UFS)
        n = sum(contagem["2023"][uf][etapa][1] for uf in UFS)
        print(f"2023 {etapa}: {a}/{n} = {a / n * 100:.1f}%")

    caminho = p.gravar()
    print("proposta:", caminho)
    if "--aplicar" in sys.argv and caminho:
        print("aplicadas:", aplica(caminho), "células")


if __name__ == "__main__":
    main()
