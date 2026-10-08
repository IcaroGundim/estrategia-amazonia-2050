# -*- coding: utf-8 -*-
"""
I1.3.3 - Monitoramento por sensoriamento remoto e resposta a alertas (documental).

Reproduz series.csv a partir de:
  - MapBiomas RAD2024 (Tabelas 68, 69, 70, 71): acumulado 2019-2024 e anual 2019-2024
  - MapBiomas RAD2023 (Tabelas 65 e 66): anual 2019-2023 (edicao anterior)
  - INPE DETER-AMZ (WFS TerraBrasilis): alertas de desmatamento por UF e ano, 2016-2026

Uso (a partir da raiz do projeto):
    python -I scripts/eixo1_coleta_I1_3_3_monitoramento.py

Downloads e textos ficam em dados/eixo1_coleta/I1.3.3_monitoramento/brutos/.
Escreve dados/eixo1_coleta/I1.3.3_monitoramento/series.csv (sobrescreve).
fontes.csv e atos.csv sao mantidos a mao (com trechos copiados das fontes).
Nos arquivos, AL = Amazonia Legal (agregado das 9 UFs do escopo).
"""
import csv
import glob
import os
import re
import site
import sys
import urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "dados", "eixo1_coleta", "I1.3.3_monitoramento")
BRUTOS = os.path.join(OUT_DIR, "brutos")
os.makedirs(BRUTOS, exist_ok=True)

UFS = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

RAD24_URL = "https://web.archive.org/web/2025id_/https://alerta.mapbiomas.org/wp-content/uploads/sites/17/2025/05/RAD2024_15.05.pdf"
RAD23_URL = "https://web.archive.org/web/2025id_/https://alerta.mapbiomas.org/wp-content/uploads/sites/17/2024/10/RAD2023_COMPLETO_15-10-24_PORTUGUES.pdf"
DETER_WFS = ("https://terrabrasilis.dpi.inpe.br/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature"
             "&typeName=deter-amz:deter_amz&outputFormat=csv"
             "&propertyName=gid,uf,view_date,classname,areamunkm,satellite,sensor&sortBy=gid")
PAGE = 50000

SRC_RAD24 = "https://alerta.mapbiomas.org/ (copia: " + RAD24_URL + ")"


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=900) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


def pdf_to_txt(pdf, txt):
    if os.path.exists(txt) and os.path.getsize(txt) > 0:
        return txt
    sys.path.append(site.getusersitepackages())  # PyMuPDF instalado no perfil do usuario
    import fitz  # noqa: E402
    d = fitz.open(pdf)
    with open(txt, "w", encoding="utf-8") as out:
        for i, p in enumerate(d):
            out.write("\n=== PAGE %d ===\n" % (i + 1))
            out.write(p.get_text())
    return txt


def num(tok):
    """'57.275' -> 57275 ; '2,3%' -> 2.3 ; '1.132,6' -> 1132.6 ; '12.3%' -> 12.3"""
    t = tok.strip().rstrip("%").strip()
    if "," in t:
        t = t.replace(".", "").replace(",", ".")
    else:
        t = t.replace(".", "")
    return float(t)


def page_before(lines, idx):
    for j in range(idx, -1, -1):
        m = re.match(r"=== PAGE (\d+) ===", lines[j])
        if m:
            return int(m.group(1))
    return None


VALID = re.compile(r"^\d+(\.\d{3})*(,\d+)?%?$|^\d+\.\d+%?$")


def merged_tokens(lines, start):
    """Uma celula por linha (extracao PyMuPDF): junta o '%' solto ao valor anterior."""
    toks = []
    for ln in lines[start:]:
        t = re.sub(r"\s+%", "%", ln.strip())
        if not t:
            continue
        pieces = t.split()
        if len(pieces) > 1 and all(VALID.match(p) for p in pieces):
            toks.extend(pieces)  # ex.: '40,8% 40,7%' numa mesma linha
        elif t == "%" and toks:
            toks[-1] = toks[-1] + "%"
        else:
            toks.append(t)
    return toks


def read_buckets(lines, start, nvals, nbuckets):
    """Le tabelas sequenciais: cada tabela comeca na linha da primeira UF (AC) e tem 9 UFs.
    nvals = numero de valores por UF (7 nas tabelas 68-71 da RAD2024; 6 na 65-66 da RAD2023)."""
    toks = merged_tokens(lines, start)
    buckets, cur, k = [], None, 0
    while k < len(toks) and len(buckets) < nbuckets:
        t = toks[k]
        if t in UFS and k + nvals < len(toks):
            vals = toks[k + 1:k + 1 + nvals]
            if all(VALID.match(v) for v in vals):
                if cur is None:
                    cur = {}
                if t in cur:  # UF repetida = comeca a tabela seguinte
                    buckets.append(cur)
                    cur = {}
                cur[t] = [num(v) for v in vals]
                k += nvals + 1
                if len(cur) == len(UFS):
                    buckets.append(cur)
                    cur = None
                continue
        k += 1
    if cur and len(buckets) < nbuckets:
        buckets.append(cur)
    return buckets


def write_series(rows):
    path = os.path.join(OUT_DIR, "series.csv")
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"])
        for r in rows:
            w.writerow(r)
    return path


def main():
    rad24_pdf = fetch(RAD24_URL, os.path.join(BRUTOS, "rad2024_wb.pdf"))
    rad23_pdf = fetch(RAD23_URL, os.path.join(BRUTOS, "rad2023_wb.pdf"))
    rad24 = pdf_to_txt(rad24_pdf, os.path.join(BRUTOS, "rad2024_wb.txt"))
    rad23 = pdf_to_txt(rad23_pdf, os.path.join(BRUTOS, "rad2023_wb.txt"))
    with open(rad24, encoding="utf-8") as f:
        L24 = f.read().split("\n")
    with open(rad23, encoding="utf-8") as f:
        L23 = f.read().split("\n")

    rows = []
    CODIGO = "I1.3.3"

    # ---- RAD2024: 4 tabelas seguidas a partir do paragrafo 4.1.3 (ordem no PDF: 68, 69, 70, 71)
    idx_body = next(i for i, l in enumerate(L24) if "Considerando os dados disponibilizados pelos OEMAs" in l)
    b24 = read_buckets(L24, idx_body, 7, 4)
    if len(b24) != 4:
        raise SystemExit("RAD2024: esperadas 4 tabelas, achei %d" % len(b24))
    t68, t69, t70, t71 = b24
    # paginas do PDF conferidas nos marcadores '=== PAGE n ===' do texto extraido
    p68, p69, p70, p71 = "146-147", "147-148", "149", "150"
    # ---- RAD2023: Tabelas 65 (alertas) e 66 (area), % por ano 2019-2023
    i65 = next(i for i, l in enumerate(L23) if l.strip() == "Tabela 65")
    i66 = next(i for i, l in enumerate(L23) if l.strip() == "Tabela 66")
    b23 = read_buckets(L23, i65, 6, 2)
    if len(b23) != 2:
        raise SystemExit("RAD2023: esperadas 2 tabelas, achei %d" % len(b23))
    t65, t66 = b23
    p65, p66 = page_before(L23, i65), page_before(L23, i66)
    print("RAD2024 tabelas 68-71 UFs:", [len(b) for b in b24], " RAD2023 tabelas 65-66 UFs:", [len(b) for b in b23])

    NOTA_RAD24 = "MapBiomas RAD2024 (secundaria)"
    anos24 = [2019, 2020, 2021, 2022, 2023, 2024]
    anos23 = [2019, 2020, 2021, 2022, 2023]

    for uf in UFS:
        a = t68[uf]  # alertas, aut_n, aut_pct, fed_n, est_n, fed_ou_est_n, fed_ou_est_pct
        rows += [
            [CODIGO, "RAD24_ALERTAS_TOTAL_ACUM_2019_2024", "componente", uf, 2024, a[0], "alertas (nº)", RAD24_URL,
             "%s Tabela 68 p.%s. Acumulado 2019-2024; ano = ultimo ano do periodo." % (NOTA_RAD24, p68)],
            [CODIGO, "RAD24_ALERTAS_AUT_FED_OU_EST_ACUM_2019_2024", "contexto", uf, 2024, a[1], "alertas (nº)", RAD24_URL,
             "%s Tabela 68 p.%s. Cruzam com autorizacao federal ou estadual (nao e fiscalizacao)." % (NOTA_RAD24, p68)],
            [CODIGO, "RAD24_ALERTAS_FISC_FED_ACUM_2019_2024", "componente", uf, 2024, a[3], "alertas (nº)", RAD24_URL,
             "%s Tabela 68 p.%s. Cruzam com acao de fiscalizacao federal." % (NOTA_RAD24, p68)],
            [CODIGO, "RAD24_ALERTAS_FISC_EST_ACUM_2019_2024", "componente", uf, 2024, a[4], "alertas (nº)", RAD24_URL,
             "%s Tabela 68 p.%s. Cruzam com acao de fiscalizacao estadual." % (NOTA_RAD24, p68)],
            [CODIGO, "RAD24_ALERTAS_FISC_FED_OU_EST_ACUM_2019_2024", "componente", uf, 2024, a[5], "alertas (nº)", RAD24_URL,
             "%s Tabela 68 p.%s. Cruzam com acao de fiscalizacao federal ou estadual." % (NOTA_RAD24, p68)],
            [CODIGO, "RAD24_PCT_ALERTAS_FISC_FED_OU_EST_ACUM_2019_2024", "proxy", uf, 2024, a[6], "% dos alertas", RAD24_URL,
             "%s Tabela 68 p.%s. Proxy de resposta: %% dos alertas 2019-2024 com acao de fiscalizacao federal ou estadual. Acumulado, nao anual. Base do estado pode estar incompleta (ver achados)." % (NOTA_RAD24, p68)],
        ]
        b = t69[uf]  # area_total_ha, aut_ha, aut_pct, fed_ha, est_ha, fed_ou_est_ha, fed_ou_est_pct
        rows += [
            [CODIGO, "RAD24_AREA_DESMAT_ACUM_2019_2024_HA", "componente", uf, 2024, b[0], "ha", RAD24_URL,
             "%s Tabela 69 p.%s. Area desmatada 2019-2024 (alertas)." % (NOTA_RAD24, p69)],
            [CODIGO, "RAD24_AREA_FISC_FED_OU_EST_ACUM_2019_2024_HA", "componente", uf, 2024, b[5], "ha", RAD24_URL,
             "%s Tabela 69 p.%s. Area de alertas que cruzam com acao de fiscalizacao federal ou estadual." % (NOTA_RAD24, p69)],
            [CODIGO, "RAD24_PCT_AREA_FISC_FED_OU_EST_ACUM_2019_2024", "proxy", uf, 2024, b[6], "% da area desmatada", RAD24_URL,
             "%s Tabela 69 p.%s. Proxy de resposta: %% da area 2019-2024 com acao de fiscalizacao federal ou estadual. Acumulado." % (NOTA_RAD24, p69)],
        ]
        for i, ano in enumerate(anos24):
            rows.append([CODIGO, "RAD24_PCT_ALERTAS_AUT_OU_FISC_ANUAL", "proxy", uf, ano, t70[uf][i], "% dos alertas do ano", RAD24_URL,
                         "%s Tabela 70 p.%s. Alertas validados no ano com autorizacao e/ou fiscalizacao ate abr/2025. Mistura autorizacao e fiscalizacao (RAD nao separa por ano)." % (NOTA_RAD24, p70)])
        for i, ano in enumerate(anos24):
            rows.append([CODIGO, "RAD24_PCT_AREA_AUT_OU_FISC_ANUAL", "proxy", uf, ano, t71[uf][i], "% da area desmatada do ano", RAD24_URL,
                         "%s Tabela 71 p.%s. Area desmatada no ano com autorizacao e/ou fiscalizacao ate abr/2025. Mistura autorizacao e fiscalizacao." % (NOTA_RAD24, p71)])
        # RAD2023 (edicao anterior), mesma logica, para revisao
        for i, ano in enumerate(anos23):
            rows.append([CODIGO, "RAD23_PCT_ALERTAS_AUT_OU_FISC_ANUAL", "proxy", uf, ano, t65[uf][i], "% dos alertas do ano", RAD23_URL,
                         "MapBiomas RAD2023 (secundaria) Tabela 65 p.%s. Edicao anterior: compare com RAD24_PCT_ALERTAS_AUT_OU_FISC_ANUAL; diferencas sao revisao da base." % p65])
        for i, ano in enumerate(anos23):
            rows.append([CODIGO, "RAD23_PCT_AREA_AUT_OU_FISC_ANUAL", "proxy", uf, ano, t66[uf][i], "% da area desmatada do ano", RAD23_URL,
                         "MapBiomas RAD2023 (secundaria) Tabela 66 p.%s. Edicao anterior: mistura autorizacao e fiscalizacao." % p66])

    # ---- AL = soma das 9 UFs (acumulado 2019-2024): contagens e % recalculado
    def soma(idx):
        return sum(t68[u][idx] for u in UFS)
    al_total, al_aut, al_fed, al_est, al_fe = soma(0), soma(1), soma(3), soma(4), soma(5)
    al_area = sum(t69[u][0] for u in UFS)
    al_area_fe = sum(t69[u][5] for u in UFS)
    rows += [
        [CODIGO, "RAD24_ALERTAS_TOTAL_ACUM_2019_2024", "componente", "AL", 2024, al_total, "alertas (nº)", RAD24_URL,
         "AL = soma das 9 UFs. MapBiomas RAD2024 Tabela 68 p.146-147."],
        [CODIGO, "RAD24_ALERTAS_FISC_FED_OU_EST_ACUM_2019_2024", "componente", "AL", 2024, al_fe, "alertas (nº)", RAD24_URL,
         "AL = soma das 9 UFs. MapBiomas RAD2024 Tabela 68 p.146-147."],
        [CODIGO, "RAD24_PCT_ALERTAS_FISC_FED_OU_EST_ACUM_2019_2024", "proxy", "AL", 2024, round(100.0 * al_fe / al_total, 1), "% dos alertas", RAD24_URL,
         "AL = soma das 9 UFs; percentual recalculado a partir das contagens (acumulado 2019-2024). Bases de MA incompletas (ver achados)."],
        [CODIGO, "RAD24_AREA_FISC_FED_OU_EST_ACUM_2019_2024_HA", "componente", "AL", 2024, al_area_fe, "ha", RAD24_URL,
         "AL = soma das 9 UFs. MapBiomas RAD2024 Tabela 69 p.147-148."],
        [CODIGO, "RAD24_PCT_AREA_FISC_FED_OU_EST_ACUM_2019_2024", "proxy", "AL", 2024, round(100.0 * al_area_fe / al_area, 1), "% da area desmatada", RAD24_URL,
         "AL = soma das 9 UFs; percentual recalculado a partir das areas (acumulado 2019-2024)."],
    ]

    # ---- DETER-AMZ: alertas de desmatamento por UF e ano (contexto)
    parts = sorted(glob.glob(os.path.join(BRUTOS, "deter_part_*.csv")))
    if len(parts) < 10:
        raise SystemExit("faltam partes do DETER em brutos/; rode o download (ver achados.md)")
    cnt = defaultdict(int)
    area = defaultdict(float)
    max_date = None
    for pth in parts:
        with open(pth, encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row["classname"] not in ("DESMATAMENTO_CR", "DESMATAMENTO_VEG"):
                    continue
                uf = row["uf"]
                if uf not in UFS:
                    continue
                ano = int(row["view_date"][:4])
                cnt[(uf, ano)] += 1
                area[(uf, ano)] += float(row["areamunkm"] or 0)
                if max_date is None or row["view_date"] > max_date:
                    max_date = row["view_date"]
    anos_deter = list(range(2016, 2027))
    nota_deter = ("INPE DETER-AMZ (WFS TerraBrasilis, primaria). Classes DESMATAMENTO_CR + DESMATAMENTO_VEG; ano pelo view_date. "
                  "Cobre so o bioma Amazonia (parte cerrado de MA, MT, TO fora). Contexto, nao e o indicador.")
    for uf in UFS + ["AL"]:
        for ano in anos_deter:
            if uf == "AL":
                n = sum(cnt[(u, ano)] for u in UFS)
                km2 = sum(area[(u, ano)] for u in UFS)
            else:
                n = cnt[(uf, ano)]
                km2 = area[(uf, ano)]
            extra = " Ano 2026 parcial (ultimo registro %s)." % max_date if ano == 2026 else ""
            nota = nota_deter + extra + (" AL = soma das 9 UFs." if uf == "AL" else "")
            rows.append([CODIGO, "DETER_DESMAT_ALERTAS_N", "contexto", uf, ano, n, "alertas (nº)", DETER_WFS, nota])
            rows.append([CODIGO, "DETER_DESMAT_AREA_KM2", "contexto", uf, ano, round(km2, 2), "km²", DETER_WFS, nota + " Area = areamunkm somada."])

    # ---- RAD2025 (edicao mais recente): so o que foi conferido em reportagem aberta (canalrural, 2026)
    CANALRURAL = "https://www.canalrural.com.br/sustentabilidade/amazonas-reduz-desmatamento-em-146-em-2025-aponta-relatorio-do-mapbiomas/"
    rows += [
        [CODIGO, "RAD25_AREA_DESMAT_HA", "contexto", "AM", 2024, 79569, "ha", CANALRURAL,
         "Secundaria (reportagem sobre RAD 2025, divulgado em 27/05/2026). Area desmatada 2024 citada na reportagem. Nao e % de fiscalizacao."],
        [CODIGO, "RAD25_AREA_DESMAT_HA", "contexto", "AM", 2025, 67986, "ha", CANALRURAL,
         "Secundaria (reportagem sobre RAD 2025, divulgado em 27/05/2026). Area desmatada 2025 citada na reportagem. Nao e % de fiscalizacao."],
    ]

    # ordena: codigo, serie, uf, ano
    order = {u: i for i, u in enumerate(UFS + ["AL"])}
    rows.sort(key=lambda r: (r[1], order[r[3]], r[4]))
    path = write_series(rows)
    print("series.csv:", path, "linhas:", len(rows))
    print("RAD24 tab70 parsed:", sorted(t70.keys()), " tab71:", sorted(t71.keys()), " tab65:", sorted(t65.keys()), " tab66:", sorted(t66.keys()))
    print("DETER max view_date:", max_date)


if __name__ == "__main__":
    main()
