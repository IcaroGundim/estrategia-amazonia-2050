import csv
import io
import os
import re
import sys
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
EIXO3 = os.path.join("dados", "eixo3")
UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
FOLHA = re.compile(r"^\d+\.\d+ ")


def fmt(v, dec=0):
    if v is None:
        return "-"
    return f"{v:,.{dec}f}".replace(",", "X").replace(".", ",").replace("X", ".")


# PEVS
pevs, pevs_qt = defaultdict(dict), defaultdict(dict)
with open(os.path.join(EIXO3, "pevs_total_uf_ano.csv"), encoding="utf-8") as f:
    for r in csv.DictReader(f):
        pevs[r["uf"]][int(r["ano"])] = float(r["valor_mil_rs"]) if r["valor_mil_rs"] else None
        pevs_qt[r["uf"]][int(r["ano"])] = float(r["quantidade_t"]) if r["quantidade_t"] else None

print("### PEVS (R$ mil) — 2015, 2020, 2023, 2024")
print("| UF | 2015 | 2020 | 2023 | 2024 |")
print("|---|---|---|---|---|")
tot = defaultdict(float)
for uf in UFS:
    row = []
    for a in (2015, 2020, 2023, 2024):
        v = pevs[uf].get(a)
        if v is not None:
            tot[a] += v
        row.append(fmt(v))
    print(f"| {uf} | " + " | ".join(row) + " |")
print("| **AL** | " + " | ".join(fmt(tot[a]) for a in (2015, 2020, 2023, 2024)) + " |")

print()
print("### PEVS produtos top por UF 2024 (3 maiores em R$ mil)")
prod = []
with open(os.path.join(EIXO3, "pevs_por_produto_uf.csv"), encoding="utf-8") as f:
    for r in csv.DictReader(f):
        if int(r["ano"]) == 2024 and r["valor_mil_rs"] and r["cod_produto"] != "0" and FOLHA.match(r["produto"]):
            prod.append((r["uf"], r["produto"], float(r["valor_mil_rs"])))
prod.sort(key=lambda t: (t[0], -t[2]))
por_uf = defaultdict(int)
for uf, p, v in prod:
    if por_uf[uf] < 3:
        print(f"- {uf}: {p} = {fmt(v)}")
        por_uf[uf] += 1

print()
print("### RAIS vínculos/estabelecimentos")
rais_uf, rais_vinc = defaultdict(dict), defaultdict(dict)
divs = defaultdict(lambda: defaultdict(dict))
with open(os.path.join(EIXO3, "rais_estab_uf_ano.csv"), encoding="utf-8") as f:
    for r in csv.DictReader(f):
        rais_uf[r["uf"]][int(r["ano"])] = int(r["estabelecimentos_ativos"])
with open(os.path.join(EIXO3, "rais_estab_uf_divisao_ano.csv"), encoding="utf-8") as f:
    for r in csv.DictReader(f):
        divs[r["uf"]][int(r["ano"])][r["divisao_cnae"]] = (int(r["estabelecimentos_ativos"]), int(r["vinculos_ativos"]))
cnae = {}
with open(os.path.join(EIXO3, "cnae_divisoes.csv"), encoding="utf-8") as f:
    for r in csv.DictReader(f):
        cnae[r["divisao"]] = r["descricao"]
print("| UF | Estab 2023 | Estab 2024 | Vínculos 2023 | Vínculos 2024 | Var vínculos (%) |")
print("|---|---|---|---|---|---|")
tv23 = tv24 = te23 = te24 = 0
for uf in UFS:
    e23, e24 = rais_uf[uf][2023], rais_uf[uf][2024]
    v23 = sum(v[1] for v in divs[uf][2023].values())
    v24 = sum(v[1] for v in divs[uf][2024].values())
    te23 += e23; te24 += e24; tv23 += v23; tv24 += v24
    var = (v24 / v23 - 1) * 100
    print(f"| {uf} | {fmt(e23)} | {fmt(e24)} | {fmt(v23)} | {fmt(v24)} | {fmt(var,1)} |")
print(f"| **AL** | {fmt(te23)} | {fmt(te24)} | {fmt(tv23)} | {fmt(tv24)} | {fmt((tv24/tv23-1)*100,1)} |")

print()
print("### RAIS: top divisão por UF (2024, vínculos)")
for uf in UFS:
    d24 = divs[uf][2024]
    top = sorted(d24.items(), key=lambda kv: -kv[1][1])[:2]
    s = ", ".join(f"{div} {cnae.get(div,'')}: {fmt(v)}" for div, (e, v) in top)
    print(f"- {uf}: {s}")

print()
print("### PIA valor transformação industrial (R$ mil)")
pia = defaultdict(dict)
with open(os.path.join(EIXO3, "pia_industria_uf_ano.csv"), encoding="utf-8") as f:
    for r in csv.DictReader(f):
        pia[r["uf"]][int(r["ano"])] = float(r["valor_transf_ind_mil_rs"]) if r["valor_transf_ind_mil_rs"] else None
print("| UF | 2015 | 2020 | 2023 | 2024 | CAGR 15-24 (%) |")
print("|---|---|---|---|---|---|")
tot = defaultdict(float)
for uf in UFS:
    row = []
    for a in (2015, 2020, 2023, 2024):
        v = pia[uf].get(a)
        if v:
            tot[a] += v
        row.append(fmt(v))
    v15, v24 = pia[uf].get(2015), pia[uf].get(2024)
    cagr = ((v24 / v15) ** (1 / 9) - 1) * 100 if v15 and v24 else None
    print(f"| {uf} | " + " | ".join(row) + f" | {fmt(cagr,1)} |")
row = []
for a in (2015, 2020, 2023, 2024):
    row.append(fmt(tot[a]))
print("| **AL** | " + " | ".join(row) + " | - |")
