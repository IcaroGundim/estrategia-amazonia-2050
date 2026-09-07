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
import csv, datetime, json, os, unicodedata, urllib.request

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
# Os CSVs do MCTI só existem na máquina de trabalho (dados/ está no .gitignore). Num
# clone feito por git pull o numerador vem do catalogo.json, que publica a mesma série
# 2000-2024 vinda do mesmo workbook — assim o script roda e confere em qualquer lugar.
arq_pd = os.path.join(PD, "tab_01_02_02_05_e_2024.csv")
usando_catalogo = not os.path.exists(arq_pd)
if usando_catalogo:
    catalogo = os.path.join(PASTA, "dashboard", "public", "data", "catalogo.json")
    print(f"CSVs do MCTI ausentes; lendo o dispêndio de {os.path.relpath(catalogo, PASTA)}")

    def acha(no):
        if isinstance(no, dict):
            if no.get("codigo") == "I5.4.1":
                return no
            for v in no.values():
                achado = acha(v)
                if achado:
                    return achado
        elif isinstance(no, list):
            for v in no:
                achado = acha(v)
                if achado:
                    return achado
        return None

    with open(catalogo, encoding="utf-8") as f:
        serie = acha(json.load(f))["serieAnual"]
    pd_mi = {uf: {int(a): v for a, v in anos.items() if v is not None} for uf, anos in serie.items()}
    pct_rec = {}

nome2uf = {norm(n): u for u, n in NOMES.items()}
if not usando_catalogo:
    cab = None
    for raw in open(arq_pd, encoding="latin-1"):
        partes = [p.strip() for p in raw.rstrip("\n").split(";")]
        if any(h.endswith("P&D") for h in partes):  # cabeçalho: '<ano> P&D', '<ano> Orçamento executado', ...
            cab = partes
            break
    assert cab, "cabeçalho da 1.2.2.5 não encontrado"
    col_pd = {int(h.split()[0]): i for i, h in enumerate(cab) if h.endswith("P&D")}
    pd_mi = {}  # uf -> ano -> valor
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

# ---------- PIB por UF (SIDRA t5938, série inteira) ----------
# Era `p/last 5`, o que reduzia o pct_pib a cinco anos embora o dispêndio do MCTI
# venha desde 2000. A t5938 (Contas Regionais, referência 2010) cobre 2002-2023 no
# nível de UF, então a série publicada aqui vai de 2002 a 2023 com uma referência só.
# 2024 fica de fora porque o PIB do ano ainda não saiu, não porque falte P&D.
def sidra(caminho):
    url = "https://apisidra.ibge.gov.br/values" + caminho
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "identity"})
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.loads(r.read().decode("utf-8"))[1:]
        except Exception as e:
            print("  retry", tentativa + 1, "erro:", e)
            if tentativa == 2:
                raise


def pib_de(tabela, periodo):
    saida = {}
    for row in sidra(f"/t/{tabela}/n3/all/v/37/p/{periodo}"):
        uf = next((u for u, n in NOMES.items() if row["D1N"].upper() == n.upper()), None)
        valor = num(row["V"]) if row.get("V") not in (None, "", "-", "...") else None
        if uf and valor is not None:
            saida.setdefault(uf, {})[int(row["D3C"])] = valor / 1000.0  # mil -> R$ mi
    return saida


pib_mi = pib_de("5938", "2002-2023")

# A t21 é a referência 2002 da mesma conta e cobre 1999-2012; serviria para alcançar
# 2000 e 2001, os dois anos de P&D que ficam sem denominador. Não entra na série: nos
# dez anos de sobreposição as duas referências divergem 4,3% em média e até 17,7%
# (Pará em 2012), então emendá-las poria uma quebra de referência bem no início da
# linha. Fica medido aqui para quem quiser decidir depois.
pib_ref2002 = pib_de("21", "1999-2012")
divergencias = []
for uf, anos_uf in pib_mi.items():
    for ano, novo in anos_uf.items():
        velho = pib_ref2002.get(uf, {}).get(ano)
        if velho:
            divergencias.append(abs(novo - velho) / velho * 100)

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

# ---------- consolidado versionado ----------
serie_pct = {uf: {str(a): round(pd_mi[uf][a] / pib_mi[uf][a] * 100, 4)
                  for a in anos if pd_mi.get(uf, {}).get(a) is not None and pib_mi.get(uf, {}).get(a)}
             for uf in UFS}
anos_pct = sorted({int(a) for s in serie_pct.values() for a in s})
payload = {
    "indicador": "I5.4.1",
    "nome": "Dispêndio estadual em P&D (% do PIB)",
    "unidade": "% do PIB",
    "atualizadoEm": datetime.date.today().isoformat(),
    "fonte": {
        "numerador": "MCTI, Indicadores Nacionais de C,T&I, tabela 1.2.2.5 — dispêndio dos "
                     "governos estaduais em P&D, valores correntes, 2000-2024"
                     + (" (lido do catalogo.json neste ambiente)" if usando_catalogo else ""),
        "denominador": "IBGE/SIDRA t5938 — PIB a preços correntes por UF, referência 2010, 2002-2023",
        "cobertura": "dispêndio público estadual, incluindo IES estaduais; não inclui P&D federal nem privado",
    },
    "anos": [str(a) for a in anos_pct],
    "limites": {
        "inicio": "A série do pct começa em 2002 porque é aí que começa o PIB por UF da "
                  "referência 2010, não porque falte P&D: o MCTI publica desde 2000.",
        "fim": "Termina em 2023 porque o PIB por UF de 2024 ainda não foi publicado, embora o "
               "dispêndio de 2024 já exista.",
        "extensaoDescartada": {
            "descricao": "A tabela SIDRA 21 (referência 2002) traz PIB por UF de 1999 a 2012 e "
                         "alcançaria 2000 e 2001, mas nos dez anos de sobreposição as duas "
                         "referências divergem demais para emendar sem quebra.",
            "divergenciaMediaPct": round(sum(divergencias) / len(divergencias), 2) if divergencias else None,
            "divergenciaMaximaPct": round(max(divergencias), 2) if divergencias else None,
        },
    },
    "seriePctPib": serie_pct,
    "dispendioMiRs": {uf: {str(a): v for a, v in sorted(pd_mi.get(uf, {}).items())} for uf in UFS},
}
destino_json = os.path.join(PASTA, "dashboard", "public", "data", "pd-estadual.json")
with open(destino_json, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"Consolidado versionado -> {os.path.relpath(destino_json, PASTA)}")

# ---------- relatório ----------
print(f"\nP&D como % do PIB estadual — {anos_pct[0]}-{anos_pct[-1]} ({len(anos_pct)} anos)")
print("UF   " + " ".join(f"{a:>6}" for a in anos_pct))
for uf in UFS:
    v = serie_pct[uf]
    print(f"{uf:4} " + " ".join(f"{v[str(a)]:6.3f}" if str(a) in v else "     -" for a in anos_pct))
if divergencias:
    print(f"\nPIB t5938 (ref. 2010) x t21 (ref. 2002) na sobreposição 2002-2012: "
          f"{len(divergencias)} pontos, divergência média {sum(divergencias)/len(divergencias):.2f}%, "
          f"máxima {max(divergencias):.2f}% — por isso 2000 e 2001 ficam de fora.")
sem_pib = [a for a in anos if a not in anos_pct]
print(f"Anos com dispêndio mas sem PIB publicado: {sem_pib}")
