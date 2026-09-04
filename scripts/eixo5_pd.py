#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 5 — Dispêndio estadual em P&D (MCTI) e PIB por UF (IBGE/SIDRA).

Fontes:
- MCTI, Indicadores Nacionais de C,T&I, tabela 1.2.2.5 "Dispêndios dos
  governos estaduais em pesquisa e desenvolvimento (P&D), em valores
  correntes, por UF, 2000-2024" (csv oficial do portal);
- MCTI, tabela 1.2.2.7 "Percentual dos dispêndios em P&D dos governos
  estaduais em relação às suas receitas totais" (mesma origem);
- IBGE/SIDRA t5938 (PIB a preços correntes, por UF — apisidra.ibge.gov.br).

Produz dados/eixo5/pd_uf_ano.csv:
uf, ano, pd_mi (R$ mi correntes), pct_receita (%), pib_mi (R$ mi correntes),
pct_pib (= pd_mi / pib_mi * 100; só quando o PIB do ano já foi publicado).

Nota: a série do MCTI cobre o dispêndio PÚBLICO ESTADUAL em P&D
(incl. IES estaduais); não inclui dispêndio privado nem federal.
"""
import csv, json, os, unicodedata, urllib.request

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
PD = os.path.join(PASTA, "dados", "eixo5", "pd")
SAIDA = os.path.join(PASTA, "dados", "eixo5", "pd_uf_ano.csv")

UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
NOMES = {"AC": "Acre", "AP": "Amapá", "AM": "Amazonas", "MA": "Maranhão",
         "MT": "Mato Grosso", "PA": "Pará", "RO": "Rondônia", "RR": "Roraima",
         "TO": "Tocantins"}

def norm(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().strip().lower()

def num(s):
    s = (s or "").strip().replace(" ", "")
    if s in ("", "-", "—", "…"):
        return None
    try:
        return float(s.replace(".", "").replace(",", "."))
    except ValueError:
        return None

# ---------- 1.2.2.5: P&D por UF (R$ milhões correntes) ----------
arq_pd = os.path.join(PD, "tab_01_02_02_05_e_2024.csv")
cab = None
for raw in open(arq_pd, encoding="latin-1"):
    partes = [p.strip() for p in raw.rstrip("\n").split(";")]
    if any(h.endswith("P&D") for h in partes):  # linha de cabeçalho: '<ano> P&D', '<ano> Orçamento executado', ...
        cab = partes
        break
assert cab, "cabeçalho da 1.2.2.5 não encontrado"
col_pd = {int(h.split()[0]): i for i, h in enumerate(cab) if h.endswith("P&D")}
pd_mi = {}  # uf -> ano -> valor
nome2uf = {norm(n): u for u, n in NOMES.items()}
for raw in open(arq_pd, encoding="latin-1"):
    partes = [p.strip() for p in raw.rstrip("\n").split(";")]
    uf = nome2uf.get(norm(partes[0]))
    if not uf:
        continue
    for ano, i in col_pd.items():
        v = num(partes[i]) if i < len(partes) else None
        if v is not None:
            pd_mi.setdefault(uf, {})[ano] = v

# ---------- 1.2.2.7: % P&D / receita total ----------
arq_pct = os.path.join(PD, "tab_01_02_02_07_e_2024.csv")
pct_rec = {}  # uf -> ano -> valor
col_ano = {}
for raw in open(arq_pct, encoding="latin-1"):
    partes = [p.strip() for p in raw.rstrip("\n").split(";")]
    if not col_ano:
        col_ano = {int(h): i for i, h in enumerate(partes) if h.isdigit()}
        continue
    uf = nome2uf.get(norm(partes[0]))
    if not uf:
        continue
    for ano, i in col_ano.items():
        if i < len(partes):
            v = num(partes[i])
            if v is not None:
                pct_rec.setdefault(uf, {})[ano] = v

# ---------- PIB por UF (SIDRA t5938, últimos 5 anos disponíveis) ----------
url = "https://apisidra.ibge.gov.br/values/t/5938/n3/all/v/37/p/last%205"
req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
with urllib.request.urlopen(req, timeout=60) as r:
    dados = json.loads(r.read().decode("utf-8"))
pib_mi = {}  # uf -> ano -> R$ milhões
for row in dados[1:]:
    uf = next((u for u, n in NOMES.items() if row["D1N"].upper() == n.upper()), None)
    if uf and row["V"].replace(".", "").isdigit():
        pib_mi.setdefault(uf, {})[int(row["D3C"])] = float(row["V"]) / 1000.0  # mil -> mi

# ---------- saída ----------
anos = sorted(set().union(*[set(d) for d in pd_mi.values()]))
with open(SAIDA, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["uf", "ano", "pd_mi", "pct_receita", "pib_mi", "pct_pib"])
    n = 0
    for uf in UFS:
        for ano in anos:
            v_pd = pd_mi.get(uf, {}).get(ano)
            v_rec = pct_rec.get(uf, {}).get(ano)
            v_pib = pib_mi.get(uf, {}).get(ano)
            pct_pib = round(v_pd / v_pib * 100, 4) if (v_pd is not None and v_pib) else None
            w.writerow([uf, ano,
                        "" if v_pd is None else v_pd,
                        "" if v_rec is None else v_rec,
                        "" if v_pib is None else round(v_pib, 3),
                        "" if pct_pib is None else pct_pib])
            n += 1
print(f"OK {n} linhas -> {os.path.relpath(SAIDA, PASTA)}")

# conferência: últimos 3 anos
for uf in UFS:
    vals = [(a, pd_mi.get(uf, {}).get(a), pct_rec.get(uf, {}).get(a), pib_mi.get(uf, {}).get(a)) for a in anos[-3:]]
    print(uf, vals)
print("PIB anos disponíveis:", sorted({a for d in pib_mi.values() for a in d}))
