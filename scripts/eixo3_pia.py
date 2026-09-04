#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 3 / I3.5.1 (e apoio a I3.2.1) — Indústria de transformação: IBGE PIA-Empresa.

Série 2015-2023: tabela 1849 (série antiga, empresas 5+ pessoas, CNAE 2.0) e
ano 2024: tabela 10457 (série nova). Variáveis: unidades locais (706/13816),
empresas (2086, só 10457), pessoal ocupado 31/12 (631), valor bruto da produção
industrial (810), valor da transformação industrial (811), receitas (835).

Saídas em dados/eixo3/:
  - pia_industria_uf_ano.csv     (total da indústria por UF/ano, 2015-2024)
  - pia_divisoes_uf_ano.csv      (detalhe por divisão CNAE, 2023-2024)
"""
import csv
import gzip
import io
import json
import os
import sys
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
SAIDA = os.path.join(PASTA, "dados", "eixo3")
os.makedirs(SAIDA, exist_ok=True)

UFS = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
       "16": "AP", "17": "TO", "21": "MA", "51": "MT"}
UFS_STR = ",".join(UFS)
TOTAL_CNAE = "117897"

VAR_NOMES = {
    "706": "unidades_locais",
    "13816": "unidades_locais",
    "2086": "empresas",
    "631": "pessoal_ocupado_3112",
    "810": "valor_bruto_prod_ind_mil_rs",
    "811": "valor_transf_ind_mil_rs",
    "835": "receita_liquida_vendas_mil_rs",
    "673": "salarios_remuneracoes_mil_rs",
}


def sidra(path):
    url = "https://apisidra.ibge.gov.br/values" + path
    req = urllib.request.Request(url, headers={"Accept-Encoding": "identity", "User-Agent": "Mozilla/5.0"})
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
                if data[:2] == b"\x1f\x8b":
                    data = gzip.decompress(data)
                return json.loads(data)
        except Exception as e:
            print("  retry", tentativa + 1, "erro:", e)
            if tentativa == 2:
                raise


def num(v):
    if v in (None, "", "-", "..."):
        return None
    try:
        return float(str(v).strip())
    except ValueError:
        return None


def coletar(tabela, anos, cnae, vars_):
    path = f"/t/{tabela}/n3/{UFS_STR}/v/{','.join(vars_)}/p/{anos}/c12762/{cnae}"
    print(f"tabela {tabela} (cnae {cnae}, {anos})...")
    rows = sidra(path)
    out = []
    for r in rows:
        if not r["D1C"].isdigit():
            continue
        out.append({
            "uf": UFS[r["D1C"]],
            "ano": int(r["D3C"]),
            "cnae": r["D4C"],
            "cnae_nome": r["D4N"],
            "tabela": str(tabela),
            "var": VAR_NOMES[r["D2C"]],
            "valor": num(r["V"]),
            "unidade": r["MN"],
        })
    return out


serie = coletar(1849, "2015-2023", TOTAL_CNAE, ["706", "631", "810", "811", "835", "673"])
serie += coletar(10457, "2024", TOTAL_CNAE, ["13816", "2086", "631", "810", "811", "835", "673"])
div23 = coletar(1849, "2023", "all", ["706", "631", "810", "811", "835"])
div24 = coletar(10457, "2024", "all", ["13816", "2086", "631", "810", "811", "835"])


def pivotar(rows):
    chaves = {}
    for r in rows:
        chave = (r["uf"], r["ano"], r["cnae"], r["cnae_nome"], r["tabela"])
        if chave not in chaves:
            chaves[chave] = {"uf": r["uf"], "ano": r["ano"], "cnae": r["cnae"], "cnae_nome": r["cnae_nome"],
                             "tabela": r["tabela"]}
        chaves[chave][r["var"]] = r["valor"]
    return sorted(chaves.values(), key=lambda r: (r["cnae"], r["uf"], r["ano"]))


total_rows = pivotar(serie)
div_rows = pivotar(div23 + div24)

for nome, dados, cols in [
    ("pia_industria_uf_ano.csv", total_rows,
     ["uf", "ano", "cnae", "cnae_nome", "tabela", "unidades_locais", "empresas", "pessoal_ocupado_3112",
      "valor_bruto_prod_ind_mil_rs", "valor_transf_ind_mil_rs", "receita_liquida_vendas_mil_rs",
      "salarios_remuneracoes_mil_rs"]),
    ("pia_divisoes_uf_ano.csv", div_rows,
     ["uf", "ano", "cnae", "cnae_nome", "tabela", "unidades_locais", "empresas", "pessoal_ocupado_3112",
      "valor_bruto_prod_ind_mil_rs", "valor_transf_ind_mil_rs", "receita_liquida_vendas_mil_rs",
      "salarios_remuneracoes_mil_rs"]),
]:
    path = os.path.join(SAIDA, nome)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in dados:
            w.writerow({c: r.get(c) for c in cols})
    print("salvo:", path, len(dados), "linhas")

# verificação: valor da transformação industrial (mil R$) por UF
print("\n--- VERIFICAÇÃO: valor da transformação industrial (mil R$) ---")
print(f"{'UF':4} {'2015':>14} {'2020':>14} {'2023':>14} {'2024':>14}")
for uf in ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]:
    vals = []
    for ano in (2015, 2020, 2023, 2024):
        v = next((r["valor_transf_ind_mil_rs"] for r in total_rows
                  if r["uf"] == uf and r["ano"] == ano), None)
        vals.append(f"{v:,.0f}" if v is not None else "-")
    print(f"{uf:4} {vals[0]:>14} {vals[1]:>14} {vals[2]:>14} {vals[3]:>14}")
