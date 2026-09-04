#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 4.3b — Participação de renováveis na oferta de energia (ANEEL SIGA).

Baixa o CSV do SIGA (Sistema de Informações de Geração da ANEEL, dados abertos
CKAN) e calcula a participação de fontes renováveis na potência fiscalizada das
usinas EM OPERAÇÃO nos 9 estados da Amazônia Legal (proxy do indicador PER).

Fontes renováveis da ficha: solar, hidráulica, eólica, biomassa, biogás.
Saída: dados/aneel/potencia_uf_fonte.csv + dados/aneel/per_uf.csv
"""
import csv, os, urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
DADOS = os.path.join(PASTA, "dados")
ANEEL = os.path.join(DADOS, "aneel")
UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
URL_SIGA = ("https://dadosabertos.aneel.gov.br/dataset/6d90b77c-c5f5-4d81-bdec-7bc619494bb9/"
            "resource/11ec447d-698d-4ab8-977f-b424d5deee6a/download/siga-empreendimentos-geracao.csv")
RENOVAVEIS = {"Hídrica", "Solar", "Eólica", "Biomassa"}


def baixar(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        return dest
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    print("baixando", url)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


sigla_uf = {"Acre": "AC", "Amapá": "AP", "Amazonas": "AM", "Maranhão": "MA", "Mato Grosso": "MT",
            "Pará": "PA", "Rondônia": "RO", "Roraima": "RR", "Tocantins": "TO"}

path = baixar(URL_SIGA, os.path.join(ANEEL, "siga.csv"))

pot = {}  # uf -> origem -> kw
fase_seen = {}
dt_ref = None
n_linhas = n_op = 0
with open(path, encoding="utf-8-sig") as f:
    for r in csv.DictReader(f, delimiter=";"):
        n_linhas += 1
        dt_ref = dt_ref or r.get("DatGeracaoConjuntoDados")
        fase = r["DscFaseUsina"]
        fase_seen[fase] = fase_seen.get(fase, 0) + 1
        if fase != "Operação":
            continue
        uf = r["SigUFPrincipal"].strip().upper()
        if uf not in UFS:
            continue
        try:
            kw = float(r["MdaPotenciaFiscalizadaKw"].replace(".", "").replace(",", "."))
        except (ValueError, KeyError):
            kw = 0.0
        origem = r["DscOrigemCombustivel"].strip()
        pot.setdefault(uf, {}).setdefault(origem, 0.0)
        pot[uf][origem] += kw
        n_op += 1

with open(os.path.join(ANEEL, "potencia_uf_fonte.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["uf", "origem", "potencia_fiscalizada_kw"])
    for uf in UFS:
        for origem, kw in sorted(pot.get(uf, {}).items()):
            w.writerow([uf, origem, round(kw, 1)])

tot_uf = {uf: sum(pot.get(uf, {}).values()) for uf in UFS}
ren_uf = {uf: sum(v for k, v in pot.get(uf, {}).items() if k in RENOVAVEIS) for uf in UFS}

with open(os.path.join(ANEEL, "per_uf.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["uf", "potencia_total_kw", "potencia_renovavel_kw", "per_renovaveis_pct"])
    for uf in UFS:
        t = tot_uf[uf]
        w.writerow([uf, round(t, 1), round(ren_uf[uf], 1), round(ren_uf[uf] / t * 100, 2) if t else ""])

print("data de referência:", dt_ref, "| linhas:", n_linhas, "| usinas em operação na AL:", n_op)
print("fases:", fase_seen)
print("\nUF  total(MW)  renovável(MW)  PER%")
t_al = r_al = 0.0
for uf in UFS:
    t, rr = tot_uf[uf], ren_uf[uf]
    t_al += t
    r_al += rr
    print(uf, f"{t/1000:12,.1f} {rr/1000:12,.1f} {rr/t*100:8.1f}%" if t else f"{uf} sem potência")
print(f"AL  {t_al/1000:12,.1f} {r_al/1000:12,.1f} {r_al/t_al*100:8.1f}%")
print("baseline da ficha (2025): 65,24% | meta: 80% (2050)")
