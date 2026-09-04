#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 5 — CAPAG dos estados (STN/Tesouro Transparente).

Lê os CSVs anuais baixados do CKAN do Tesouro Transparente
(dados/eixo5/capag/capag_*.csv) e produz dados/eixo5/capag_uf_ano.csv
com uf, ano, classificacao CAPAG e notas dos 3 indicadores.

Formatos variam por ano (2018 sem colunas de Nota; 2019 com linha de
preâmbulo; 2024 em duas versões — usa-se a revisão publicada em 04/2025).
"""
import csv, glob, os, re

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
CAPAG = os.path.join(PASTA, "dados", "eixo5", "capag")
SAIDA = os.path.join(PASTA, "dados", "eixo5", "capag_uf_ano.csv")

ARQUIVOS = {
    2018: "capag_2018.csv",
    2019: "capag_2019.csv",
    2020: "capag_2020.csv",
    2021: "capag_2021.csv",
    2022: "capag_2022.csv",
    2023: "capag_2023.csv",
    2024: "capag_2024_revisao.csv",  # revisão (04/2025) prevalece sobre a original
    2025: "capag_2025.csv",
}

def num(s):
    s = (s or "").strip().strip("%")
    if s in ("", "-", "—"):
        return ""
    s = s.replace(".", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return ""

def abre(caminho):
    try:
        return open(caminho, encoding="utf-8-sig")
    except UnicodeDecodeError:
        return open(caminho, encoding="latin-1")

linhas_out = []
for ano, nome in sorted(ARQUIVOS.items()):
    caminho = os.path.join(CAPAG, nome)
    if not os.path.exists(caminho):
        print(f"[AVISO] faltando {nome}")
        continue
    for raw in abre(caminho):
        partes = [p.strip() for p in raw.rstrip("\n").split(";")]
        if not partes or partes[0] != "UF":
            continue  # pula preâmbulos e linhas de dados; header começa em UF
        # localiza colunas pelos cabeçalhos (com acentos, sem acentos ou vazios)
        idx_cap = next((i for i, h in enumerate(partes) if h.lower().startswith("classifica")), None)
        idx_n, idx_letras = [], []
        for alvo in ("indicador 1", "indicador 2", "indicador 3"):
            i = next((j for j, h in enumerate(partes) if h.lower() == alvo), None)
            idx_n.append(i)
            idx_letras.append(i + 1 if i is not None else None)  # 'Nota N' fica ao lado do 'Indicador N'
        break
    else:
        print(f"[ERRO] header 'UF' não encontrado em {nome}")
        continue
    for raw in abre(caminho):
        partes = [p.strip() for p in raw.rstrip("\n").split(";")]
        uf = partes[0] if partes else ""
        if uf not in ("AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"):
            continue
        capag = partes[idx_cap] if idx_cap is not None and idx_cap < len(partes) else ""
        valores = [num(partes[i]) if i is not None and i < len(partes) else "" for i in idx_n]
        letras = [partes[i] if i is not None and i < len(partes) else "" for i in idx_letras]
        linhas_out.append([uf, ano, capag] + valores + letras)

with open(SAIDA, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["uf", "ano", "capag", "indicador1", "indicador2", "indicador3",
                "nota1", "nota2", "nota3"])
    w.writerows(linhas_out)
print(f"OK {len(linhas_out)} linhas -> {os.path.relpath(SAIDA, PASTA)}")

# resumo de conferência
res = {}
for uf, ano, capag, *_ in linhas_out:
    res.setdefault(ano, {})[uf] = capag
for ano in sorted(res):
    print(ano, {uf: res[ano][uf] for uf in ("AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO")})
print("exemplo notas 2025 AC:", [l for l in linhas_out if l[0] == "AC" and l[1] == 2025])
