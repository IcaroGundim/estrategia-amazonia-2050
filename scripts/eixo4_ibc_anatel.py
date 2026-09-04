#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 4.1 — IBC-AMZ (ANATEL).

Baixa o zip oficial do Índice Brasileiro de Conectividade (painel Meu Município)
e calcula o IBC-AMZ ponderado pela população municipal (Censo 2022, SIDRA 4709)
para os 9 estados da Amazônia Legal, 2021-2025.

Saídas:
  dados/anatel/ibc_uf_ano.csv            — IBC estadual (do arquivo oficial da ANATEL)
  dados/anatel/ibc_ponderado_pop.csv     — IBC-AMZ ponderado pela população, por UF/ano
  dados/ibge_pop/pop_mun_censo2022.csv   — população municipal (Censo 2022)
"""
import csv, os, urllib.request, urllib.parse, zipfile

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
DADOS = os.path.join(PASTA, "dados")
ANATEL = os.path.join(DADOS, "anatel")
UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
URL_ZIP = "https://www.anatel.gov.br/dadosabertos/paineis_de_dados/meu_municipio/ibc.zip"
URL_POP = "https://apisidra.ibge.gov.br/values/t/4709/n6/all/v/93/p/2022?formato=json"


def baixar(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    print("baixando", url)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


def num(s):
    return float(str(s).replace(",", ".")) if str(s).strip() not in ("", "-", None) else None


# ---------- 1. IBC (ANATEL) ----------
zip_path = baixar(URL_ZIP, os.path.join(ANATEL, "ibc.zip"))
with zipfile.ZipFile(zip_path) as z:
    z.extractall(ANATEL)

uf_ano = {}
mun_ano = {}
with open(os.path.join(ANATEL, "IBC_UF_indicadores_originais.csv"), encoding="utf-8-sig") as f:
    for r in csv.DictReader(f, delimiter=";"):
        if r["UF"] in UFS and num(r["IBC"]) is not None:
            uf_ano.setdefault(r["UF"], {})[int(r["Ano"])] = num(r["IBC"])
with open(os.path.join(ANATEL, "IBC_municipios_indicadores_originais.csv"), encoding="utf-8-sig") as f:
    for r in csv.DictReader(f, delimiter=";"):
        if r["UF"] in UFS and num(r["IBC"]) is not None:
            mun_ano.setdefault(r["UF"], {})[(int(r["Ano"]), r["Código Município"])] = num(r["IBC"])

# ---------- 2. População municipal (Censo 2022, SIDRA 4709) ----------
pop_path = os.path.join(DADOS, "ibge_pop", "pop_mun_censo2022.csv")
if not (os.path.exists(pop_path) and os.path.getsize(pop_path) > 100):
    import json
    print("baixando SIDRA 4709 (população municipal, Censo 2022)")
    req = urllib.request.Request(URL_POP, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        dados = json.loads(r.read().decode("utf-8"))
    with open(pop_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["cod_ibge", "municipio", "populacao"])
        for x in dados[1:]:
            w.writerow([x["D1C"], x["D1N"], x["V"].replace(".", "")])

pop_mun = {}
with open(pop_path, encoding="utf-8") as f:
    for r in csv.DictReader(f):
        pop_mun[r["cod_ibge"]] = int(r["populacao"])
assert len(pop_mun) >= 5500, "população municipal incompleta"

# ---------- 3. IBC ponderado pela população ----------
ponderado = {}  # uf -> ano -> ibc ponderado
for uf in UFS:
    for ano in sorted({a for a, _ in mun_ano.get(uf, {})}):
        num_sum = den_sum = 0.0
        for (a, cod), ibc in mun_ano[uf].items():
            if a != ano or cod not in pop_mun:
                continue
            num_sum += ibc * pop_mun[cod]
            den_sum += pop_mun[cod]
        if den_sum:
            ponderado.setdefault(uf, {})[ano] = num_sum / den_sum

with open(os.path.join(ANATEL, "ibc_uf_ano.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["uf", "ano", "ibc_uf", "ibc_ponderado_pop"])
    for uf in UFS:
        for ano in sorted(set(uf_ano.get(uf, {})) | set(ponderado.get(uf, {}))):
            w.writerow([uf, ano, uf_ano.get(uf, {}).get(ano, ""), round(ponderado[uf][ano], 2) if ano in ponderado.get(uf, {}) else ""])

print("\nIBC estadual (ANATEL) x ponderado pela população:")
for uf in UFS:
    print(uf, {a: uf_ano.get(uf, {}).get(a) for a in (2024, 2025)},
          "pond:", {a: round(ponderado.get(uf, {}).get(a, 0), 2) for a in (2024, 2025)})

al_ano = {}  # média ponderada da AL com população municipal
for ano in (2021, 2022, 2023, 2024, 2025):
    num_sum = den_sum = 0.0
    for uf in UFS:
        for (a, cod), ibc in mun_ano.get(uf, {}).items():
            if a == ano and cod in pop_mun:
                num_sum += ibc * pop_mun[cod]
                den_sum += pop_mun[cod]
    if den_sum:
        al_ano[ano] = num_sum / den_sum
print("\nAL ponderada:", {a: round(v, 2) for a, v in al_ano.items()})
print("Baseline da ficha (2025): 53,52")

with open(os.path.join(ANATEL, "ibc_al_ano.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["ano", "ibc_al"])
    for a, v in al_ano.items():
        w.writerow([a, round(v, 2)])
