# -*- coding: utf-8 -*-
"""I1.3.1 (IIVCM) - coleta, pareamento de ciclos, validacao da formula e series.

Roda do zero a partir da raiz do projeto:  python -I scripts/eixo1_coleta_I1_3_1_iivcm.py
Brutos ja baixados sao reaproveitados (cache em dados/eixo1_coleta/I1.3.1_iivcm/brutos/).

Etapas:
  1. hierarquia AdaptaBrasil (atual, espelho rnp.dev, capturas Wayback) e testes de anos (probe)
  2. valores municipais (API mapa-dados) dos indicadores da ramificacao Vulnerabilidade
  3. extrato dos municipios de interesse (CSV local e Amazonia Legal 2022)
  4. fontes avulsas: crawler GitHub, IBGE SIDRA 6673, catalogo MDR (CKAN), Atlas Digital, IBGE agregados, README
  5. pareamento de ciclos por caminho de nomes e teste de valores entre ciclos
  6. validacao da formula IIVCM contra os valores locais (dados/iivcm/iivcm.csv)
  7. series.csv e fontes.csv

Nao baixa o CSV de danos do S2ID: o proxy do ambiente recusou o download em 2026-10-07 (ver achados.md).
Entrada local: dados/iivcm/iivcm.csv (somente leitura); dados/eixo4_series/I4.4.2/_verificacao/AL2022.xlsx (somente leitura).
"""
import collections
import csv
import glob
import gzip
import io
import json
import math
import os
import re
import statistics as st
import time
import unicodedata
import urllib.request
import urllib.error
from datetime import datetime, timezone

import openpyxl

ROOT = os.getcwd()
OUT = os.path.join(ROOT, "dados", "eixo1_coleta", "I1.3.1_iivcm")
BR = os.path.join(OUT, "brutos")
MD = os.path.join(BR, "mapa_dados")
WB = os.path.join(BR, "wayback")
PR = os.path.join(BR, "probe")
API = "https://sistema.adaptabrasil.mcti.gov.br/api"
ESPELHO = "https://sistema.adaptabrasil.dev.apps.rnp.br/api"
IIVCM_CSV = os.path.join(ROOT, "dados", "iivcm", "iivcm.csv")
AL_XLSX = os.path.join(ROOT, "dados", "eixo4_series", "I4.4.2", "_verificacao", "AL2022.xlsx")
ACESSO = "2026-10-07"
UFS = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]
SIDRA_URL = "https://apisidra.ibge.gov.br/values/t/6673/n3/11,12,13,14,15,16,17,21,51/p/all/v/all"
CRAWLER_URL = ("https://raw.githubusercontent.com/AdaptaBrasil/PreProcessing/master/"
               "src/crawlers/crawler-1/final_results.csv")
README_URL = "https://raw.githubusercontent.com/AdaptaBrasil/AdaptaBrasilAPIAccess/main/README.md"
CKAN_RESOURCE = "https://dadosabertos.mdr.gov.br/api/3/action/resource_show?id=1c8aac93-f874-4f07-9405-86a0398dadd6"
CKAN_BUSCA = "https://dadosabertos.mdr.gov.br/api/3/action/package_search?q=S2ID&rows=20"
ATLAS_URL = "https://atlasdigital.mdr.gov.br"
IBGE_AGREG = "https://servicodados.ibge.gov.br/api/v3/agregados"
REFERENCIAS = ["1302603", "1100205", "1200401", "1504208"]  # Manaus, Porto Velho, Rio Branco, Maraba
TOL = 0.02

for d in (BR, MD, WB, PR):
    os.makedirs(d, exist_ok=True)
LOG = open(os.path.join(BR, "coleta_log.txt"), "a", encoding="utf-8")


def log(msg):
    linha = f"{datetime.now(timezone.utc).isoformat(timespec='seconds')} {msg}"
    print(linha, flush=True)
    LOG.write(linha + "\n")
    LOG.flush()


def fetch(url, timeout=180, tries=3):
    last = None
    for t in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # rede/servidor: nova tentativa com pausa
            last = e
            time.sleep(2 * (t + 1))
    raise last


def cache(url, caminho):
    """Baixa url para caminho (ou le do cache). Retorna bytes."""
    if os.path.exists(caminho):
        with open(caminho, "rb") as f:
            return f.read()
    dados = fetch(url)
    with open(caminho, "wb") as f:
        f.write(dados)
    log(f"baixado: {url} -> {os.path.relpath(caminho, OUT)} ({len(dados)} bytes)")
    return dados


def cache_gz(url, caminho):
    """Como cache(), mas grava comprimido (gzip) e devolve o JSON descomprimido em bytes."""
    if os.path.exists(caminho):
        with open(caminho, "rb") as f:
            return gzip.decompress(f.read())
    dados = fetch(url)
    with gzip.open(caminho, "wb") as f:
        f.write(dados)
    time.sleep(0.2)
    return dados


def chave(texto):
    """Normaliza nome para pareamento entre ciclos: sem acento, caixa, NBSP e espacos extras."""
    t = unicodedata.normalize("NFKD", texto.replace("\xa0", " "))
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t).strip().casefold()


def anos_do_no(x):
    y = x.get("years")
    if y is None:
        return []
    if isinstance(y, list):
        return [str(t) for t in y]
    return [t.strip() for t in str(y).split(",") if t.strip()]


def ancestrais(x, by):
    out, cur, k = [], x, 0
    while k < 20:
        p = cur.get("indicator_id_master")
        if p is None or str(p).strip() not in by:
            break
        cur = by[str(p).strip()]
        out.append(cur)
        k += 1
    return out


def mapa_ciclo(H):
    """Ramificacao Vulnerabilidade de uma captura: chave normalizada -> [(id, nivel, anos, pessimist, exibicao)]."""
    by = {str(x["id"]): x for x in H}
    rows = {}
    for x in H:
        anc = ancestrais(x, by)
        nomes = [a["name"] for a in anc]
        if (x["name"] == "Vulnerabilidade" and x.get("level") == 3) or (
            x["name"] != "Vulnerabilidade" and "Vulnerabilidade" in nomes
        ):
            segmentos = list(reversed(nomes)) + [x["name"]]  # segmentos[0] e a raiz, que muda entre ciclos
            k = " > ".join(chave(s) for s in segmentos[1:])
            rows.setdefault(k, []).append(
                (str(x["id"]), x.get("level"), anos_do_no(x), x.get("pessimist"), " > ".join(segmentos[1:]))
            )
    return rows


# ---------------------------------------------------------------- etapa 1: hierarquia e probes
def etapa_hierarquia():
    log("[1] hierarquia AdaptaBrasil (atual, espelho, Wayback)")
    hier = cache(f"{API}/hierarquia/adaptabrasil", os.path.join(BR, "hierarquia_adaptabrasil_live.json"))
    H = json.loads(hier.decode("utf-8"))
    cache(f"{ESPELHO}/hierarquia/adaptabrasil", os.path.join(BR, "hierarquia_host_rnp_dev_live.json"))

    cdx_caminho = os.path.join(BR, "cdx_hierarquia.json")
    cdx_url = ("https://web.archive.org/cdx/search/cdx?url=sistema.adaptabrasil.mcti.gov.br/api/hierarquia"
               "&matchType=prefix&output=json&filter=statuscode:200&fl=timestamp,original,length,digest&limit=500")
    linhas_cdx = json.loads(cache(cdx_url, cdx_caminho).decode("utf-8"))[1:]
    capturas = []
    for ts, original, _, _ in linhas_cdx:
        original = original if original.startswith("http") else "https://" + original
        caminho = os.path.join(WB, f"hierarquia_{ts}.json")
        if not os.path.exists(caminho):
            raw = fetch(f"https://web.archive.org/web/{ts}id_/{original}")
            if raw[:2] == b"\x1f\x8b":
                raw = gzip.decompress(raw)
            with open(caminho, "wb") as f:
                f.write(raw)
            log(f"captura {ts} gravada")
            time.sleep(1)
        capturas.append((ts, caminho))
    return H, capturas


def etapa_probe():
    log("[1b] probes de anos (mapa-dados) e api/total")
    saida = os.path.join(PR, "probe_anos.csv")
    if os.path.exists(saida):
        return
    linhas = []
    for ind, anos in [(60014, [2015, 2016, 2017, 2019, 2020, 2021, 2030, 2050]),
                      (5, [2020, 2021, 2030, 2050]), (7, [2020, 2030]),
                      (60113, [2016]), (60121, [2020]), (60118, [2020])]:
        for ano in anos:
            try:
                d = json.loads(fetch(f"{API}/mapa-dados/BR/municipio/{ind}/{ano}/null/adaptabrasil").decode("utf-8"))
                vals = [x["value"] for x in d if x.get("value") is not None]
                linhas.append([ind, ano, len(d), round(st.mean(vals), 4) if vals else ""])
            except Exception as e:
                linhas.append([ind, ano, "erro", str(e)[:60]])
            time.sleep(0.2)
    with open(saida, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["indicador_id", "ano_pedido", "n_municipios_com_registro", "media_valor"])
        w.writerows(linhas)
    try:
        t = fetch(f"{API}/total/BR/municipio/60014/null/2015/adaptabrasil").decode("utf-8")
    except Exception as e:
        t = f"erro de rede: {e}"
    with open(os.path.join(PR, "api_total_resposta.txt"), "w", encoding="utf-8") as f:
        f.write(t[:2000])


# ---------------------------------------------------------------- etapa 2 e 3: valores e extrato
def carregar_al():
    wb = openpyxl.load_workbook(AL_XLSX, read_only=True, data_only=True)
    al = {}
    for row in list(wb.worksheets[0].iter_rows(values_only=True))[1:]:
        if row and row[0]:
            al[str(row[0]).strip()] = (row[4], row[5])
    with open(os.path.join(OUT, "municipios_amazonia_legal_2022.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["cod_ibge", "uf", "nome_municipio"])
        for c, (uf, nome) in al.items():
            w.writerow([c, uf, nome])
    return al


def etapa_valores(H, al):
    log("[2-3] valores municipais da ramificacao Vulnerabilidade (mapa-dados) e extrato")
    by = {str(x["id"]): x for x in H}
    cod_csv = {}
    with open(IIVCM_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            cod_csv[r["codigo_ibge"].strip()] = r["uf"].strip()
    interesse = set(cod_csv) | set(al)

    children = collections.defaultdict(list)
    for x in H:
        p = x.get("indicator_id_master")
        if p is not None:
            children[str(p).strip()].append(str(x["id"]))
    alvo = {}
    for x in H:
        anc = ancestrais(x, by)
        nomes = [a["name"] for a in anc]
        if x["name"] == "Vulnerabilidade" and x.get("level") == 3:
            alvo[str(x["id"])] = ("vulnerabilidade_setorial", x, anc)
        elif x["name"] != "Vulnerabilidade" and "Vulnerabilidade" in nomes:
            alvo[str(x["id"])] = (None, x, anc)
    ids_alvo = set(alvo)
    for i, (tipo, x, anc) in list(alvo.items()):
        if tipo is None:
            filhos = [c for c in children.get(i, []) if c in ids_alvo]
            alvo[i] = ("no_interno" if filhos else "folha", x, anc)
    log(f"alvo: {len(alvo)} entradas (folhas={sum(1 for v in alvo.values() if v[0]=='folha')}, "
        f"nos internos={sum(1 for v in alvo.values() if v[0]=='no_interno')}, "
        f"setoriais={sum(1 for v in alvo.values() if v[0]=='vulnerabilidade_setorial')})")

    linhas, resumo = [], []
    for i, (tipo, x, anc) in sorted(alvo.items(), key=lambda kv: int(kv[0])):
        anos = anos_do_no(x)
        if not anos:
            resumo.append((i, "sem anos na hierarquia", 0))
            continue
        ano = int(anos[0])  # a API so devolve o ano listado (verificado em probe_anos.csv)
        caminho = " > ".join(reversed([a["name"] for a in anc])) + " > " + x["name"]
        raw = cache_gz(f"{API}/mapa-dados/BR/municipio/{i}/{ano}/null/adaptabrasil",
                       os.path.join(MD, f"{i}_{ano}.json.gz"))
        dados = json.loads(raw.decode("utf-8"))
        n_ok = 0
        for rec in dados:
            cod = str(rec.get("geocod_ibge") or "").strip()
            if cod not in interesse or rec.get("value") is None:
                continue
            n_ok += 1
            linhas.append([i, x["name"], x.get("level"), tipo, x.get("pessimist"), rec.get("year", ano),
                           anc[-1]["name"] if anc else "", caminho, cod, rec["value"]])
        resumo.append((i, tipo, n_ok))
    out_csv = os.path.join(OUT, "valores_vulnerabilidade_municipios.csv")
    with open(out_csv, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["indicador_id", "nome", "nivel", "tipo", "pessimist", "ano", "setor", "caminho",
                    "cod_ibge", "valor"])
        w.writerows(linhas)
    com_valor = sum(1 for r in resumo if r[2] > 0)
    log(f"extrato: {len(linhas)} linhas; indicadores com valor: {com_valor}; vazios: {len(resumo)-com_valor}")
    return alvo


# ---------------------------------------------------------------- etapa 4: fontes avulsas
def etapa_fontes_avulsas():
    log("[4] fontes avulsas: crawler, SIDRA, CKAN, Atlas, IBGE agregados, README")
    cache(CRAWLER_URL, os.path.join(BR, "crawler_final_results.csv"))
    cache(SIDRA_URL, os.path.join(BR, "sidra6673_uf_AL.json"))
    cache(CKAN_RESOURCE, os.path.join(BR, "ckan_resource_bd_atlas.json"))
    cache(CKAN_BUSCA, os.path.join(BR, "ckan_s2id_search.json"))
    cache(README_URL, os.path.join(BR, "github_AdaptaBrasilAPIAccess_README_live.md"))
    cache(ATLAS_URL, os.path.join(BR, "atlas_home.html"))
    ag = os.path.join(BR, "ibge_agregados_todos.json")
    cache(IBGE_AGREG, ag)
    d = json.loads(open(ag, encoding="utf-8").read())
    pat = re.compile(r"alagamento|enchente|deslizamento|inunda|desastre|erosão|enxurrada|escorregamento", re.I)
    hits = []
    for assunto in d:
        for agr in assunto.get("agregados", []):
            nome = agr.get("nome", "")
            if "munic" in nome.lower() and pat.search(nome):
                hits.append({"id": agr.get("id"), "nome": nome})
    with open(os.path.join(BR, "ibge_munic_tabelas_desastre_filtro.json"), "w", encoding="utf-8") as f:
        json.dump(hits, f, ensure_ascii=False, indent=1)
    log(f"IBGE agregados com termos de desastre (MUNIC/munic): {len(hits)}")


# ---------------------------------------------------------------- etapa 5: pareamento de ciclos
def etapa_ciclos(H, capturas):
    log("[5] pareamento de ciclos por caminho e teste de valores entre ciclos")
    fontes = [("2026_live", H)] + [(ts, json.load(open(p, encoding="utf-8"))) for ts, p in capturas]
    ciclos = {r: mapa_ciclo(h) for r, h in fontes}
    rot = [r for r, _ in fontes]
    caminhos = sorted(set().union(*[set(c) for c in ciclos.values()]))
    with open(os.path.join(OUT, "versoes_anos_vulnerabilidade.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["caminho"] + [f"id_{r}" for r in rot] + [f"ano_{r}" for r in rot] + ["mudou_ano_entre_ciclos"])
        for c in caminhos:
            ids, ys, exib = [], [], ""
            for r in rot:
                ent = ciclos[r].get(c)
                if ent:
                    exib = exib or ent[0][4]
                    ids.append(";".join(e[0] for e in ent))
                    ys.append(";".join(",".join(e[2][:1]) if e[2] else "" for e in ent))
                else:
                    ids.append("")
                    ys.append("")
            presentes = [y for y in ys if y]
            mudou = "sim" if len(set(presentes)) > 1 else ("nao" if presentes else "")
            w.writerow([exib] + ids + ys + [mudou])
    # teste de valores: pares com mesmo indicador (por nome) e rotulos de ano diferentes
    crawler = {}
    with open(os.path.join(BR, "crawler_final_results.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["value"]:
                crawler.setdefault((r["indicator_id"], r["year"]), {})[r["geocod_ibge"]] = float(r["value"])
    pares = [("60104", "2015", "60005", "2015"), ("60004", "2015", "60045", "2015"),
             ("60118", "2020", "60019", "2015"), ("60121", "2020", "60022", "2015"),
             ("60014", "2015", "60014", "2015")]
    linhas = []
    for a, ya, b, yb in pares:
        ca = crawler.get((a, ya), {})
        caminho_b = os.path.join(MD, f"{b}_{yb}.json.gz")
        if not ca or not os.path.exists(caminho_b):
            continue
        lb = {str(x["geocod_ibge"]): float(x["value"]) for x in
              json.loads(gzip.decompress(open(caminho_b, "rb").read()).decode("utf-8")) if x.get("value") is not None}
        comum = sorted(set(ca) & set(lb))
        xs = [ca[k] for k in comum]
        ys = [lb[k] for k in comum]
        mx, my = st.mean(xs), st.mean(ys)
        cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        vx = sum((x - mx) ** 2 for x in xs)
        vy = sum((y - my) ** 2 for y in ys)
        corr = cov / math.sqrt(vx * vy) if vx and vy else float("nan")
        ident = sum(1 for k in comum if abs(ca[k] - lb[k]) < 1e-9) / len(comum) * 100
        linhas.append([f"crawler {a} ({ya})", f"atual {b} ({yb})", len(comum), round(corr, 4), round(ident, 1),
                       round(mx, 4), round(my, 4)])
    with open(os.path.join(OUT, "pares_ciclos_teste.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["antigo", "atual", "n_municipios", "correlacao", "pct_valores_identicos", "media_antigo",
                    "media_atual"])
        w.writerows(linhas)
    resumo = collections.Counter(sum(1 for r in rot if c in ciclos[r]) for c in caminhos)
    log(f"caminhos por numero de ciclos onde aparecem: {dict(sorted(resumo.items()))}")
    return ciclos


# ---------------------------------------------------------------- etapa 6: validacao da formula
def ler_local():
    loc = {}
    with open(IIVCM_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            loc[r["codigo_ibge"].strip()] = float(r["adaptabrasil_iivcm"].replace(",", "."))
    return loc


def quartil(vals, modo):
    n = len(vals)
    k = {"piso": n // 4, "teto": math.ceil(n / 4), "arred": round(n / 4)}[modo]
    k = max(k, 1)
    s = sorted(vals, reverse=True)
    return sum(s[:k]) / k


def iivcm_mun(pares, orient, modo):
    v = []
    for x, pess in pares:
        if (orient == "flip_pess0" and pess == "0") or (orient == "flip_pess1" and pess == "1"):
            x = 1 - x
        v.append(x)
    return 100 * (0.60 * (sum(v) / len(v)) + 0.40 * quartil(v, modo))


def etapa_validacao():
    log("[6] validacao da formula IIVCM contra os valores locais")
    local = ler_local()
    valores = collections.defaultdict(dict)
    with open(os.path.join(OUT, "valores_vulnerabilidade_municipios.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            valores[r["cod_ibge"]][r["indicador_id"]] = (float(r["valor"]), r["tipo"], r["pessimist"])
    conjuntos = {"folhas": lambda t: t == "folha",
                 "folhas+nos_internos": lambda t: t in ("folha", "no_interno"),
                 "todos_com_valor": lambda t: True,
                 "setoriais": lambda t: t == "vulnerabilidade_setorial"}
    res = []
    for nome_c, filtro in conjuntos.items():
        for orient in ["raw", "flip_pess0", "flip_pess1"]:
            for modo in ["piso", "teto", "arred"]:
                erros = {}
                for cod in REFERENCIAS:
                    pares = [(v, p) for ind, (v, t, p) in valores.get(cod, {}).items() if filtro(t)]
                    erros[cod] = iivcm_mun(pares, orient, modo) - local[cod] if pares else float("nan")
                maxerr = max(abs(e) for e in erros.values() if not math.isnan(e)) if erros else float("nan")
                res.append((maxerr, nome_c, orient, modo, erros))
    res.sort(key=lambda r: (math.isnan(r[0]), r[0]))
    with open(os.path.join(OUT, "validacao_variantes_iivcm.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["erro_max_abs", "conjunto", "orientacao", "quartil", "erro_manaus", "erro_porto_velho",
                    "erro_rio_branco", "erro_maraba", "aceita_tol_0_02"])
        for maxerr, nome_c, orient, modo, erros in res:
            w.writerow([round(maxerr, 4), nome_c, orient, modo] + [round(erros[c], 4) for c in REFERENCIAS]
                       + ["sim" if (not math.isnan(maxerr) and maxerr <= TOL) else "nao"])
    melhor = res[0]
    log(f"melhor variante: {melhor[1]} / {melhor[2]} / {melhor[3]}; erro max {round(melhor[0], 4)}; "
        f"{'ACEITA' if melhor[0] <= TOL else 'NAO ACEITA'} (tolerancia {TOL})")


# ---------------------------------------------------------------- etapa 7: series e fontes
def etapa_series(al):
    log("[7] series.csv e fontes.csv")
    loc = {}
    with open(IIVCM_CSV, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            loc[r["codigo_ibge"].strip()] = (r["uf"].strip(), r["prioritario"].strip() == "Sim")

    valores = collections.defaultdict(lambda: collections.defaultdict(list))
    meta = {}
    with open(os.path.join(OUT, "valores_vulnerabilidade_municipios.csv"), encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["tipo"] != "vulnerabilidade_setorial":
                continue
            cod = r["cod_ibge"].strip()
            if cod not in al:  # escopo AL 2022 (772)
                continue
            uf, prio = loc.get(cod, (al[cod][0], False))
            meta[r["indicador_id"]] = (r["ano"], r["caminho"])
            if prio:
                valores[r["indicador_id"]][uf].append(float(r["valor"]) * 100)
                valores[r["indicador_id"]]["AL"].append(float(r["valor"]) * 100)

    linhas = []
    for ind in sorted(valores, key=lambda x: int(x)):
        ano, caminho = meta[ind]
        partes = [p.strip() for p in caminho.split(">")]
        setor = " > ".join(partes[1:-1][:2]) if len(partes) > 2 else caminho
        serie = f"Subindice setorial de vulnerabilidade - {setor} (id AdaptaBrasil {ind})"
        for uf in UFS + ["AL"]:
            v = valores[ind].get(uf, [])
            if not v:
                continue
            escopo = "AL (Amazonia Legal)" if uf == "AL" else uf
            nota = (f"media simples de {len(v)} municipio(s) prioritario(s) em {escopo}; prioritarios definidos "
                    "pelo iivcm.csv (origem nao verificada); escopo AL 2022 (772); ano = ano de referencia do no "
                    "na hierarquia; nao e termo isolado da formula (Vgeral usa todos os indicadores); corte "
                    "transversal entre setores, nao trajetoria")
            linhas.append(["I1.3.1", serie, "proxy", uf, ano, round(st.mean(v), 4), "pontos (0-100)",
                           f"https://sistema.adaptabrasil.mcti.gov.br/api/mapa-dados/BR/municipio/{ind}/{ano}/null/adaptabrasil",
                           nota])
    with open(os.path.join(BR, "sidra6673_uf_AL.json"), encoding="utf-8") as f:
        sidra = json.load(f)
    nomes_uf = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
                "21": "MA", "51": "MT"}
    for r in sidra[1:]:
        linhas.append(["I1.3.1",
                       "Municipios com estrategia local de reducao de risco de desastres alinhada a nacional (ODS 11.b.2, MUNIC)",
                       "proxy", nomes_uf[r["D1C"]], r["D2C"], float(r["V"]), "% de municipios (proporcao)", SIDRA_URL,
                       "IBGE SIDRA tabela 6673, variavel 9600; valor da UF inteira (nao so prioritarios); proxy da "
                       "capacidade de gestao de risco, nao o IIVCM; RO 2017 e 2020 identicos (21,2) na fonte"])
    with open(os.path.join(OUT, "series.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"])
        w.writerows(linhas)
    log(f"series.csv: {len(linhas)} linhas")

    fontes = [
        [f"{API}/hierarquia/adaptabrasil", "AdaptaBrasil - hierarquia de indicadores (API atual, 558 entradas)",
         "MCTI", "primaria", "n/d (API viva)", ACESSO, "brutos/hierarquia_adaptabrasil_live.json"],
        [f"{API}/mapa-dados/BR/municipio/{{id}}/{{ano}}/null/adaptabrasil",
         "AdaptaBrasil - valores municipais por indicador (API mapa-dados), 344 indicadores da ramificacao Vulnerabilidade",
         "MCTI", "primaria", "n/d (API viva)", ACESSO, "brutos/mapa_dados/{id}_{ano}.json.gz"],
        [f"{ESPELHO}/hierarquia/adaptabrasil",
         "AdaptaBrasil - hierarquia no host espelho sistema.adaptabrasil.dev.apps.rnp.br (mesma estrutura de anos)",
         "MCTI/RNP", "primaria", "n/d", ACESSO, "brutos/hierarquia_host_rnp_dev_live.json"],
        ["https://web.archive.org/cdx/search/cdx?url=sistema.adaptabrasil.mcti.gov.br/api/hierarquia&matchType=prefix&output=json",
         "Wayback CDX - capturas da hierarquia AdaptaBrasil (8 capturas, 2022-06 a 2025-04)", "Internet Archive",
         "secundaria", "n/d", ACESSO, "brutos/cdx_hierarquia.json"],
    ]
    for ts, caminho in capturas_wb():
        fontes.append([f"https://web.archive.org/web/{ts}id_/https://sistema.adaptabrasil.mcti.gov.br/api/hierarquia",
                       f"Captura Wayback {ts[:4]}-{ts[4:6]}-{ts[6:8]} da hierarquia AdaptaBrasil (copia do MCTI)",
                       "Internet Archive (copia do MCTI)", "secundaria",
                       f"{ts[:4]}-{ts[4:6]}-{ts[6:8]}", ACESSO, os.path.relpath(caminho, OUT).replace("\\", "/")])
    fontes += [
        [SIDRA_URL, "IBGE SIDRA tabela 6673 (ODS 11.b.2 / MUNIC), UF 2013, 2017 e 2020, variavel 9600", "IBGE",
         "primaria", "n/d (tabela)", ACESSO, "brutos/sidra6673_uf_AL.json"],
        [CKAN_RESOURCE, "Catalogo MDR - recurso 'Danos Informados 1991-2025' (S2ID): metadados (86.323.744 bytes; last_modified 2026-08-19)",
         "MIDR/SEDEC", "primaria", "2026-08-19", ACESSO, "brutos/ckan_resource_bd_atlas.json"],
        [CKAN_BUSCA, "Catalogo MDR - busca S2ID (dataset s2id_sedec)", "MIDR/SEDEC", "primaria", "n/d", ACESSO,
         "brutos/ckan_s2id_search.json"],
        ["https://dadosabertos.mdr.gov.br/dataset/1aabd419-5677-4fa2-a0e3-a1a3e1a42234/resource/1c8aac93-f874-4f07-9405-86a0398dadd6/download/bd_atlas_1991_2025_v1.1_2026.08.06_consolidado.csv",
         "S2ID Danos Informados 1991-2025 (CSV de 86 MB): download BLOQUEADO pelo proxy ('Request Rejected'), duas tentativas manuais em 2026-10-07; nao baixado",
         "MIDR/SEDEC", "primaria", "2026-08-19", ACESSO, ""],
        [ATLAS_URL, "Atlas Digital de Desastres no Brasil - pagina inicial ('registros de desastres ... entre os anos de 1991 e 2025')",
         "MIDR/SEDEC", "primaria", "n/d", ACESSO, "brutos/atlas_home.html"],
        [IBGE_AGREG, "IBGE API de metadados de agregados (filtro MUNIC com termos de desastre: tabelas 8535 a 8542 e outras)",
         "IBGE", "primaria", "n/d", ACESSO, "brutos/ibge_agregados_todos.json; brutos/ibge_munic_tabelas_desastre_filtro.json"],
        [CRAWLER_URL, "Crawler GitHub AdaptaBrasil/PreProcessing - valores de versao antiga (80 indicadores x 5570 municipios)",
         "AdaptaBrasil (GitHub, crawler)", "secundaria", "n/d", ACESSO, "brutos/crawler_final_results.csv"],
        [README_URL, "README do repositorio AdaptaBrasilAPIAccess (referencia da ficha)", "AdaptaBrasil (GitHub)",
         "secundaria", "n/d", ACESSO, "brutos/github_AdaptaBrasilAPIAccess_README_live.md"],
        ["https://cnm.org.br/biblioteca/download/15657",
         "Levantamento CNM de decretos SE e ECP (S2iD 2013-2024): HTTP 403 em 2026-10-07; nao acessado",
         "CNM", "secundaria", "n/d", ACESSO, ""],
    ]
    with open(os.path.join(OUT, "fontes.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["url", "titulo", "orgao", "tipo", "data_documento", "acessado_em", "arquivo_local"])
        w.writerows(fontes)
    tipos = collections.Counter(r[3] for r in fontes)
    log(f"fontes.csv: {len(fontes)} linhas; {dict(tipos)}")


def capturas_wb():
    arq = sorted(glob.glob(os.path.join(WB, "hierarquia_*.json")))
    return [(re.search(r"hierarquia_(\d+)\.json", a).group(1), a) for a in arq]


def main():
    H, capturas = etapa_hierarquia()
    etapa_probe()
    al = carregar_al()
    log(f"municipios AL 2022: {len(al)}")
    etapa_valores(H, al)
    etapa_fontes_avulsas()
    etapa_ciclos(H, capturas)
    etapa_validacao()
    etapa_series(al)
    log("concluido")


if __name__ == "__main__":
    main()
