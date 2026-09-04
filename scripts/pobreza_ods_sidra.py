#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 2 / I2.1.1 — Pobreza: série histórica por UF via SIDRA (tabela 10660).

Indicador ODS P1.1.1, "proporção da população abaixo da linha de pobreza
regional", da PNAD Contínua anual. Os metadados da tabela não dizem qual é a
linha, mas os valores batem com o `pct_pobreza_usd365` do SIS (US$ 3,65 PPC
2017) — a conferência no fim do script compara os dois e imprime a diferença
por UF, que ficou em 1,1 p.p. no pior caso.

A série da tabela começa em 2012: a PNAD Contínua não retroage além disso e a
PNAD anual antiga (encerrada em 2015) usa outra metodologia, então 13 anos é o
máximo disponível sem emendar pesquisas diferentes.

Saídas em dados/ibge_ods/:
  - pobreza_uf_ano.csv   (uf, ano, pct_pobreza — 9 UFs + BR como referência)
  - pobreza_al_ano.csv   (ano, pct_pobreza, populacao — média ponderada da AL)
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
SAIDA = os.path.join(PASTA, "dados", "ibge_ods")
os.makedirs(SAIDA, exist_ok=True)

UFS = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
       "16": "AP", "17": "TO", "21": "MA", "51": "MT"}
TABELA = "10660"
VARIAVEL = "14137"
ANOS = "2012-2024"


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
    if v in (None, "", "-", "...", ".."):
        return None
    try:
        return float(str(v).strip().replace(",", "."))
    except ValueError:
        return None


def ler_csv(caminho):
    with open(caminho, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


print(f"SIDRA t{TABELA} v{VARIAVEL} — pobreza regional (US$ 3,65 PPC 2017), {ANOS}")
estados = sidra(f"/t/{TABELA}/n3/{','.join(UFS)}/v/{VARIAVEL}/p/{ANOS}")[1:]
brasil = sidra(f"/t/{TABELA}/n1/1/v/{VARIAVEL}/p/{ANOS}")[1:]

linhas = []
for r in estados:
    valor = num(r["V"])
    if valor is not None:
        linhas.append({"uf": UFS[r["D1C"]], "ano": int(r["D3C"]), "pct_pobreza": valor})
for r in brasil:
    valor = num(r["V"])
    if valor is not None:
        linhas.append({"uf": "BR", "ano": int(r["D3C"]), "pct_pobreza": valor})
linhas.sort(key=lambda x: (x["uf"], x["ano"]))

destino = os.path.join(SAIDA, "pobreza_uf_ano.csv")
with open(destino, "w", encoding="utf-8", newline="") as f:
    escritor = csv.DictWriter(f, fieldnames=["uf", "ano", "pct_pobreza"])
    escritor.writeheader()
    escritor.writerows(linhas)
anos = sorted({l["ano"] for l in linhas})
print(f"  {len(linhas)} linhas ({len(anos)} anos: {anos[0]}-{anos[-1]}) -> {destino}")

# Agregado da AL: média ponderada pela população de cada estado no mesmo ano. O
# painel usa o mesmo critério, mas com a população de 2025 em todos os anos — é a
# única que ele carrega —, então o valor dele nos anos antigos difere um pouco do
# que sai aqui. A população vem da projeção IBGE já consolidada em dados/ibge_pop.
populacao = {}
for r in ler_csv(os.path.join(PASTA, "dados", "ibge_pop", "populacao_uf_ano.csv")):
    pop = num(r["populacao"])
    if pop is not None:
        populacao[(r["uf"], int(r["ano"]))] = pop

regional = []
for ano in anos:
    peso = total = 0.0
    faltantes = []
    for uf in UFS.values():
        valor = next((l["pct_pobreza"] for l in linhas if l["uf"] == uf and l["ano"] == ano), None)
        pop = populacao.get((uf, ano))
        if valor is None or pop is None:
            faltantes.append(uf)
            continue
        total += valor * pop
        peso += pop
    if faltantes:
        print(f"  {ano}: sem valor ou população para {', '.join(faltantes)}")
    if peso:
        regional.append({"ano": ano, "pct_pobreza": round(total / peso, 2), "populacao": int(peso)})

destino_al = os.path.join(SAIDA, "pobreza_al_ano.csv")
with open(destino_al, "w", encoding="utf-8", newline="") as f:
    escritor = csv.DictWriter(f, fieldnames=["ano", "pct_pobreza", "populacao"])
    escritor.writeheader()
    escritor.writerows(regional)
print(f"  {len(regional)} anos -> {destino_al}")

print("\nAmazônia Legal (média ponderada pela população):")
for r in regional:
    print(f"  {r['ano']}  {r['pct_pobreza']:5.1f}%")

# Conferência contra o valor publicado hoje (SIS 2024, linha de US$ 3,65).
sis = {r["uf"]: num(r["pct_pobreza_usd365"]) for r in ler_csv(os.path.join(PASTA, "dados", "ibge_sis", "sis_pobreza_uf.csv"))}
print("\nConferência 2024 — SIDRA t10660 x SIS publicado:")
maior = 0.0
for uf in sorted(UFS.values()):
    novo = next((l["pct_pobreza"] for l in linhas if l["uf"] == uf and l["ano"] == 2024), None)
    antigo = sis.get(uf)
    if novo is None or antigo is None:
        continue
    delta = novo - antigo
    maior = max(maior, abs(delta))
    print(f"  {uf}  SIDRA {novo:5.1f}%   SIS {antigo:5.1f}%   dif {delta:+.1f} p.p.")
print(f"  maior divergência: {maior:.1f} p.p.")
