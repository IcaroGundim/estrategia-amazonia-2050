#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Extrai da SIS 2025 (IBGE): pobreza por UF (Tabela 2.18) e frequência escolar
por faixa etária (Tabela 4.1) para os 9 estados da AL."""
import csv, os
import xlrd

DADOS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dados")
UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
NOMES_UF = {"AC": "Acre", "AP": "Amapá", "AM": "Amazonas", "MA": "Maranhão",
            "MT": "Mato Grosso", "PA": "Pará", "RO": "Rondônia", "RR": "Roraima", "TO": "Tocantins"}

def ler_tabela(path):
    wb = xlrd.open_workbook(path)
    ws = wb.sheet_by_index(0)
    linhas = []
    for i in range(ws.nrows):
        linhas.append([ws.cell_value(i, j) for j in range(ws.ncols)])
    return linhas

# ---------------- Pobreza ----------------
linhas = ler_tabela(os.path.join(DADOS, "ibge_sis", "sis_renda", "Tabela 2.18 (Pobr_Geo).xls"))
# achar a linha com os UFs: coluna 0 = nome
pobres = {}
for r in linhas:
    nome = str(r[0]).strip()
    if nome in NOMES_UF.values():
        uf = next(s for s, n in NOMES_UF.items() if n == nome)
        # colunas: 1=total(1000), 2=%<2,15, 3=%<3,65, 4=%<6,85, 5=%até50%med, 6=.., 7=valor 50% mediana
        pobres[uf] = {
            "pop_1000": r[1], "pct_2_15": r[2], "pct_3_65": r[3],
            "pct_6_85": r[4], "pct_50med": r[5], "linha50_r$": r[7],
        }
print("POBREZA (SIS 2025 — dados PNADc 2024):")
print(f"{'UF':3} {'pop(mil)':>9} {'%<2,15':>8} {'%<3,65':>8} {'%<6,85':>8} {'%até50%med':>11} {'linha50 R$':>10}")
for uf in UFS:
    p = pobres.get(uf)
    if p:
        print(f"{uf:3} {p['pop_1000']:9.0f} {p['pct_2_15']:8.2f} {p['pct_3_65']:8.2f} {p['pct_6_85']:8.2f} {p['pct_50med']:11.2f} {p['linha50_r$']:10.2f}")
with open(os.path.join(DADOS, "ibge_sis", "sis_pobreza_uf.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["uf", "pop_mil", "pct_extrema_usd215", "pct_pobreza_usd365", "pct_usd685", "pct_ate50mediana", "linha50_mediana_r$"])
    for uf in UFS:
        p = pobres.get(uf)
        if p:
            w.writerow([uf, p["pop_1000"], p["pct_2_15"], p["pct_3_65"], p["pct_6_85"], p["pct_50med"], p["linha50_r$"]])

# ---------------- Frequência escolar ----------------
linhas = ler_tabela(os.path.join(DADOS, "ibge_sis", "sis_educacao", "Tabela 4.1 (FreqBrut_Geo).xls"))
freq = {}
for r in linhas:
    nome = str(r[0]).strip()
    if nome in NOMES_UF.values():
        uf = next(s for s, n in NOMES_UF.items() if n == nome)
        # colunas: 1=total, 2=0-3, 3=4-5, 4=6-10, 5=11-14, 6=6-14, 7=15-17
        freq[uf] = {"total": r[1], "0_3": r[2], "4_5": r[3], "6_10": r[4], "11_14": r[5], "6_14": r[6], "15_17": r[7]}
print("\nFREQUÊNCIA ESCOLAR (SIS 2025 — PNADc 2024):")
print(f"{'UF':3} {'total':>7} {'0-3':>7} {'4-5':>7} {'6-10':>7} {'11-14':>7} {'15-17':>7}")
for uf in UFS:
    fr = freq.get(uf)
    if fr:
        print(f"{uf:3} {fr['total']:7.1f} {fr['0_3']:7.1f} {fr['4_5']:7.1f} {fr['6_10']:7.1f} {fr['11_14']:7.1f} {fr['15_17']:7.1f}")
with open(os.path.join(DADOS, "ibge_sis", "sis_freq_escolar_uf.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["uf", "total", "0_3", "4_5", "6_10", "11_14", "6_14", "15_17"])
    for uf in UFS:
        fr = freq.get(uf)
        if fr:
            w.writerow([uf, fr["total"], fr["0_3"], fr["4_5"], fr["6_10"], fr["11_14"], fr["6_14"], fr["15_17"]])
print("\nCSVs salvos em dados/.")
