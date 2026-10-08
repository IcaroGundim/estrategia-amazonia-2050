#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 4.2 - I4.2.1 (adequacao e trafegabilidade) - series historicas por UF.

O painel mostra o valor de 2025 (km efetivo / km fisico da malha estadual) sem
serie. A razao exata nao se reconstroi (o xlsx de origem so tem o resultado, nao
a geometria nem a juncao CNT x malha), entao este coletor entrega os INSUMOS da
formula e proxies, todos com o mesmo vies de cobertura: o que a Pesquisa CNT de
Rodovias avalia (rodovias federais pavimentadas + principais trechos estaduais
pavimentados), nao a malha estadual inteira.

Fontes (todas publicas, sem login):
  A. Paineis Power BI da Pesquisa CNT de Rodovias 2021-2025, publicados na web.
     As chaves de "publicar na web" estao no JavaScript do SPA
     pesquisarodovias.cnt.org.br (versao arquivada no Wayback de 2026-07-16).
     A rota documentada como "Power BI sem API" e na verdade acessivel pelo
     endpoint publico /public/reports/querydata do cluster descoberto na pagina
     app.powerbi.com/view?r=... (nenhuma autenticacao, so a chave do relatorio).
  B. Relatorios gerenciais da Pesquisa CNT de Rodovias 2010-2019 e 2021-2025
     (PDF, repositorio do ITL: repositorio.itl.org.br). Tabelas "Classificacao do
     Estado Geral em km por Regiao e UF" (todas as jurisdicoes) e, em 2011-2018,
     "Classificacao por rodovia pesquisada - UF" (uma classe por rodovia).
  C. PNV/SNV historico (DNIT Cloud, link oficial da pagina BIT-Mapas do Min.
     Transportes): resumos 2001-2010 da rede de jurisdicao estadual por UF.

Saidas em dados/eixo4_series/I4.2.1/:
  s1_cnt_estadual_km_por_classe_uf_2021_2025.csv           (componente) km por classe do Estado Geral, rodovias estaduais
  s2_cnt_estadual_adequacao_ponderada_uf_2021_2025.csv     (proxy) razao ponderada pelos pesos da ficha, a partir de s1
  s3_cnt_federal_estadual_adequacao_ponderada_uf_2010_2025.csv (proxy) idem, federal + estadual (PDFs 2010-2025; sem 2020)
  s4_cnt_estadual_adequacao_por_rodovia_uf_2011_2022.csv   (contexto) uma classe por rodovia estadual, 2011-2018 e 2022
  s4_rodovias_estaduais_raw.csv                            linhas por rodovia usadas em s4
  s5_pnv_estadual_pavimentada_uf_2001_2010.csv             (contexto) % pavimentada da rede estadual do PNV
  checagem_metodos_2022.csv, validacao_cnt_pbi_vs_pdf.json, pbi_meta_paineis.json  (conferencias e metadados)
Dependencias:
requests, pandas, openpyxl e PyMuPDF (fitz) - todos presentes no python do
sistema. Os PDFs (~1,2 GB) sao baixados um a um, o texto das paginas e salvo em
brutos/texto_cnt/<ano>.txt e o PDF e apagado (use --manter-pdf para guarda-lo).

Uso, a partir da raiz do projeto:
    python scripts/eixo4_series_trafegabilidade.py [--so-pbi] [--sem-pdf] [--manter-pdf]

Pesos da ficha: otimo 1; bom 0,8; regular 0,5; ruim 0,2; pessimo 0,05.
"""
import argparse
import base64
import collections
import csv
import json
import os
import re
import sys
import unicodedata
import urllib.parse

import requests

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

BASE = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(BASE)
PASTA = os.path.join(RAIZ, "dados", "eixo4_series", "I4.2.1")
BRUTOS = os.path.join(PASTA, "brutos")
TEXTO = os.path.join(BRUTOS, "texto_cnt")
UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
NOME_UF = {"Rondônia": "RO", "Acre": "AC", "Amazonas": "AM", "Roraima": "RR", "Pará": "PA",
           "Amapá": "AP", "Tocantins": "TO", "Maranhão": "MA", "Mato Grosso": "MT"}
CLASSES = ["Ótimo", "Bom", "Regular", "Ruim", "Péssimo"]
PESO = {"Ótimo": 1.0, "Bom": 0.8, "Regular": 0.5, "Ruim": 0.2, "Péssimo": 0.05}
HDR = {"User-Agent": "Mozilla/5.0"}
ITL = "https://repositorio.itl.org.br"
FONTE_PBI = "CNT, Pesquisa CNT de Rodovias {ano} - painel Power BI publicado na web (extensao avaliada, Estado Geral)"
FONTE_PDF = "CNT, Pesquisa CNT de Rodovias {ano} - Relatorio gerencial (ITL)"

# Chaves de publicar-na-web dos paineis (extraidas do JS do SPA da CNT).
TENANT = "8609bc5b-7aca-4204-b4b0-ce9cf9002e53"
CHAVES_PBI = {
    2021: "f666d1a7-ae0b-425e-a540-cf40d7411e70",
    2022: "ee15af69-ddab-4c25-8f1d-0e91854a0034",
    2023: "85e3cbe7-7f55-4ed7-b5e6-02e90f3de0de",
    2024: "3560f11f-74c9-46d9-9ec2-f680cb7014ba",
    2025: "0e4868e3-06db-4f7a-acfd-5f56c7be211e",
}
# Edicoes no repositorio do ITL (numero do handle). 2020 nao existe no repositorio.
HANDLES_PDF = {2010: 140, 2011: 141, 2012: 142, 2013: 143, 2014: 144, 2015: 145, 2016: 146, 2017: 147,
               2018: 148, 2019: 322, 2021: 635, 2022: 639, 2023: 697, 2024: 830, 2025: 847}
ANOS_ROD_PDF = range(2011, 2019)   # tabela por rodovia pesquisada - UF
DAV = "https://servicos.dnit.gov.br/dnitcloud/public.php/webdav/"
DAV_TOKEN = "oTpPRmYs5AAdiNr"      # link publico da pagina BIT-Mapas (gov.br/transportes)


# ----------------------------------------------------------------------------
# utilitarios
# ----------------------------------------------------------------------------
def log(*a):
    print(*a, flush=True)


def escreve_csv(nome, linhas, campos):
    os.makedirs(PASTA, exist_ok=True)
    caminho = os.path.join(PASTA, nome)
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=campos, delimiter=",", extrasaction="ignore")
        w.writeheader()
        for l in linhas:
            w.writerow(l)
    log("  gravado", os.path.relpath(caminho, RAIZ), len(linhas), "linhas")
    return caminho


def razao(km_por_classe):
    """(km_efetivo, km_total, % ponderado) a partir de {classe: km}."""
    tot = sum(km_por_classe.get(c, 0) for c in CLASSES)
    ef = sum(PESO[c] * km_por_classe.get(c, 0) for c in CLASSES)
    return ef, tot, (100.0 * ef / tot if tot else None)


# ----------------------------------------------------------------------------
# A. Power BI publicado na web (CNT 2021-2025)
# ----------------------------------------------------------------------------
def decodifica_dsr(resp):
    """Decodifica o 'data shape result' do Power BI em lista de dicts."""
    saida = []
    for res in resp["results"]:
        dado = res["result"]["data"]
        nomes = {s["Value"]: s["Name"] for s in dado["descriptor"]["Select"]}
        for ds in dado["dsr"]["DS"]:
            if ds.get("IC") is False or "RT" in ds:
                raise RuntimeError("resposta truncada (token de reinicio); aumente a janela")
            dic = ds.get("ValueDicts", {})
            for ph in ds["PH"]:
                esquema = prev = None
                for lin in ph["DM0"]:
                    if "S" in lin:
                        esquema = lin["S"]
                    C, R, Z = lin.get("C", []), lin.get("R", 0), lin.get("Ø", 0)
                    vals, ci = [], 0
                    for i, sc in enumerate(esquema):
                        bit = 1 << i
                        if Z & bit:
                            v = None
                        elif R & bit:
                            v = prev[i]
                        else:
                            v = C[ci]
                            ci += 1
                            if "DN" in sc and isinstance(v, int):
                                v = dic[sc["DN"]][v]
                        vals.append(v)
                    prev = vals
                    saida.append({nomes.get(sc["N"], sc["N"]): v for sc, v in zip(esquema, vals)})
    return saida


class PowerBI:
    def __init__(self, chave):
        self.chave = chave
        self.s = requests.Session()
        self.s.headers.update(HDR)
        r_tok = base64.b64encode(json.dumps({"k": chave, "t": TENANT}, separators=(",", ":")).encode()).decode()
        v = self.s.get("https://app.powerbi.com/view?r=" + r_tok, timeout=90)
        v.raise_for_status()
        m = re.search(r"(wabi[a-z0-9\-]*?)-redirect\.analysis\.windows\.net", v.text)
        if not m:
            raise RuntimeError("cluster nao encontrado na pagina de visualizacao")
        self.api = "https://%s-api.analysis.windows.net" % m.group(1)
        h = {"X-PowerBI-ResourceKey": chave, "Accept": "application/json"}
        r = self.s.get("%s/public/reports/%s/modelsAndExploration?preferReadOnlySession=true" % (self.api, chave),
                       headers=h, timeout=180)
        r.raise_for_status()
        j = r.json()
        self.model_id = j["models"][0]["id"]
        self.ultima_atualizacao = j["models"][0].get("LastRefreshTime")
        self.titulo = j["exploration"]["report"]["displayName"]
        r = self.s.post(self.api + "/public/reports/conceptualschema",
                        headers={"X-PowerBI-ResourceKey": chave, "Content-Type": "application/json;charset=UTF-8"},
                        data=json.dumps({"modelIds": [self.model_id]}), timeout=120)
        r.raise_for_status()
        self.entidades = {e["Name"]: [p["Name"] for p in e["Properties"]]
                          for e in r.json()["schemas"][0]["schema"]["Entities"]}

    def consulta(self, entidade, colunas, soma=None):
        sel = [{"Column": {"Expression": {"SourceRef": {"Source": "t"}}, "Property": c}, "Name": c} for c in colunas]
        if soma:
            sel.append({"Aggregation": {"Expression": {"Column": {"Expression": {"SourceRef": {"Source": "t"}},
                        "Property": soma}}, "Function": 0}, "Name": "soma_" + soma})
        q = {"Version": 2, "From": [{"Name": "t", "Entity": entidade, "Type": 0}], "Select": sel}
        corpo = {"version": "1.0.0", "queries": [{"Query": {"Commands": [{"SemanticQueryDataShapeCommand": {
            "Query": q, "Binding": {"Primary": {"Groupings": [{"Projections": list(range(len(sel)))}]},
                                    "DataReduction": {"DataVolume": 4, "Primary": {"Window": {"Count": 30000}}},
                                    "Version": 1}}}]}, "QueryId": "", "ApplicationContext": {
                                        "DatasetId": None, "Sources": [{"ReportId": None, "VisualId": None}]}}],
                 "cancelQueries": [], "modelId": self.model_id}
        r = self.s.post(self.api + "/public/reports/querydata?synchronous=true",
                        headers={"X-PowerBI-ResourceKey": self.chave, "Content-Type": "application/json;charset=UTF-8"},
                        data=json.dumps(corpo), timeout=300)
        r.raise_for_status()
        return decodifica_dsr(r.json())


def coleta_powerbi():
    """Devolve (km[ano][uf][jur][classe], rodovias_2022) e grava os brutos."""
    log("== A. Power BI publicado (CNT 2021-2025)")
    km = {}
    meta = {}
    rod = []
    for ano, chave in CHAVES_PBI.items():
        bruto = os.path.join(BRUTOS, "pbi_cnt_%d_longo.json" % ano)
        if os.path.exists(bruto):
            linhas = json.load(open(bruto, encoding="utf-8"))
            meta_ano = json.load(open(os.path.join(BRUTOS, "pbi_cnt_%d_meta.json" % ano), encoding="utf-8"))
            pbi = None
        else:
            pbi = PowerBI(chave)
            ent = next(n for n, cols in pbi.entidades.items()
                       if {"ats_uf_sigla", "ats_trecho_jurisdicao", "atn_up_quant_uc", "Variável", "Resultado_Texto"} <= set(cols))
            linhas = pbi.consulta(ent, ["ats_uf_sigla", "ats_trecho_jurisdicao", "Variável", "Resultado_Texto"],
                                  soma="atn_up_quant_uc")
            meta_ano = {"ano": ano, "chave": chave, "titulo": pbi.titulo, "modelo": pbi.model_id,
                        "ultima_atualizacao_modelo": pbi.ultima_atualizacao, "cluster": pbi.api, "entidade": ent}
            os.makedirs(BRUTOS, exist_ok=True)
            json.dump(linhas, open(bruto, "w", encoding="utf-8"), ensure_ascii=False)
            json.dump(meta_ano, open(os.path.join(BRUTOS, "pbi_cnt_%d_meta.json" % ano), "w", encoding="utf-8"),
                      ensure_ascii=False, indent=1)
        meta[ano] = meta_ano
        d = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(float)))
        for l in linhas:
            if l["Variável"] == "Estado Geral" and l["Resultado_Texto"] in PESO:
                d[l["ats_uf_sigla"]][l["ats_trecho_jurisdicao"]][l["Resultado_Texto"]] += l["soma_atn_up_quant_uc"] or 0
        km[ano] = d
        tot = collections.Counter()
        for uf in d:
            for c, v in d[uf]["Estadual"].items():
                tot[c] += v
        log("  %d %s | modelo %s | estadual Brasil: %s" % (ano, meta_ano["titulo"], meta_ano["modelo"],
                                                            {c: int(tot[c]) for c in CLASSES}))
        if ano == 2022:
            bruto_r = os.path.join(BRUTOS, "pbi_cnt_2022_rodovias.json")
            if os.path.exists(bruto_r):
                rod = json.load(open(bruto_r, encoding="utf-8"))
            else:
                pbi = pbi or PowerBI(chave)
                rod = _rodovias_2022(pbi)
                json.dump(rod, open(bruto_r, "w", encoding="utf-8"), ensure_ascii=False)
    return km, meta, rod


def _rodovias_2022(pbi):
    """Extensao (maximo por rodovia/UF) e classe de Estado Geral por rodovia, painel 2022."""
    sel = []

    def col(c):
        return {"Column": {"Expression": {"SourceRef": {"Source": "t"}}, "Property": c}, "Name": c}
    for c in ["ats_uf_sigla", "ats_trecho_jurisdicao", "rodovia", "estadogeral_rodovia_uf"]:
        sel.append(col(c))
    sel.append({"Aggregation": {"Expression": {"Column": {"Expression": {"SourceRef": {"Source": "t"}},
                "Property": "total_extensao_rodovia"}}, "Function": 3}, "Name": "ext_max"})
    q = {"Version": 2, "From": [{"Name": "t", "Entity": "vw_basedadosrodovia_mediageral2", "Type": 0}], "Select": sel}
    corpo = {"version": "1.0.0", "queries": [{"Query": {"Commands": [{"SemanticQueryDataShapeCommand": {
        "Query": q, "Binding": {"Primary": {"Groupings": [{"Projections": list(range(len(sel)))}]},
                                "DataReduction": {"DataVolume": 4, "Primary": {"Window": {"Count": 30000}}},
                                "Version": 1}}}]}, "QueryId": "", "ApplicationContext": {
                                    "DatasetId": None, "Sources": [{"ReportId": None, "VisualId": None}]}}],
             "cancelQueries": [], "modelId": pbi.model_id}
    r = pbi.s.post(pbi.api + "/public/reports/querydata?synchronous=true",
                   headers={"X-PowerBI-ResourceKey": pbi.chave, "Content-Type": "application/json;charset=UTF-8"},
                   data=json.dumps(corpo), timeout=300)
    r.raise_for_status()
    return decodifica_dsr(r.json())


# ----------------------------------------------------------------------------
# B. PDFs da Pesquisa CNT de Rodovias (repositorio do ITL)
# ----------------------------------------------------------------------------
def norm(s):
    return unicodedata.normalize("NFC", s).replace("\xa0", " ")


def sem_espaco(s):
    return re.sub(r"\s+", "", unicodedata.normalize("NFKC", s))


def baixa_texto_pdf(ano, manter_pdf=False):
    """Texto por pagina do relatorio gerencial do ano (cache em brutos/texto_cnt)."""
    os.makedirs(TEXTO, exist_ok=True)
    dest = os.path.join(TEXTO, "%d.txt" % ano)
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        return open(dest, encoding="utf-8").read()
    import fitz
    h = HANDLES_PDF[ano]
    pg = requests.get("%s/jspui/handle/123456789/%d" % (ITL, h), headers=HDR, timeout=90).text
    cands = sorted(set(re.findall(r'href="(/jspui/bitstream/[^"]+)"', pg)))
    alvo = None
    for c in cands:
        nome = urllib.parse.unquote(c.split("/")[-1].split("?")[0])
        if re.search(r"Rodovias\s+%d\.pdf$" % ano, nome) and not re.search(r"Boletim|Principais|Pontos|ntese", nome):
            alvo = c
    if not alvo:
        raise RuntimeError("PDF principal de %d nao encontrado no handle %d: %s" % (ano, h, cands))
    log("  baixando PDF %d (%s)" % (ano, urllib.parse.unquote(alvo.split("/")[-1])[:50]))
    tmp = os.path.join(TEXTO, "%d.pdf" % ano)
    with requests.get(ITL + alvo, headers=HDR, stream=True, timeout=600) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for blk in r.iter_content(1 << 20):
                f.write(blk)
    doc = fitz.open(tmp)
    with open(dest, "w", encoding="utf-8") as f:
        for i, p in enumerate(doc):
            f.write("\n=====PAGE %d=====\n" % (i + 1))
            f.write(p.get_text())
    doc.close()
    if not manter_pdf:
        os.remove(tmp)
    return open(dest, encoding="utf-8").read()


def paginas(texto):
    out = {}
    for p in texto.split("=====PAGE ")[1:]:
        n = int(p.split("=====")[0])
        out[n] = p.split("=====", 1)[1]
    return out


NOMES = ["Brasil", "Norte", "Rondônia", "Acre", "Amazonas", "Roraima", "Pará", "Amapá", "Tocantins", "Nordeste",
         "Maranhão", "Piauí", "Ceará", "Rio Grande do Norte", "Paraíba", "Pernambuco", "Alagoas", "Sergipe", "Bahia",
         "Sudeste", "Minas Gerais", "Espírito Santo", "Rio de Janeiro", "São Paulo", "Sul", "Paraná", "Santa Catarina",
         "Rio Grande do Sul", "Centro-Oeste", "Mato Grosso do Sul", "Mato Grosso", "Goiás", "Distrito Federal"]


def num_milhar(s):
    s = s.strip()
    if s in ("-", "–", "—"):
        return 0.0
    if re.fullmatch(r"\d{1,3}(\.\d{3})+", s):
        return float(s.replace(".", ""))
    if re.fullmatch(r"\d+", s):
        return float(s)
    return None


def desfaz_fonte(txt):
    """No PDF de 2010 alguns rotulos vem com a fonte deslocada em 29 codigos ('$PD]RQDV' = 'Amazonas')."""
    try:
        return "".join(chr(ord(c) + 29) for c in txt)
    except ValueError:
        return txt


def parse_tabela_uf(pgs, inicio, vao=3):
    """Linhas 'nome da UF' seguidas de 6 numeros (otimo..pessimo, total)."""
    linhas = []
    for n in range(inicio, inicio + vao):
        if n in pgs:
            linhas += [l.strip() for l in pgs[n].split("\n")]
    res, i = {}, 0
    while i < len(linhas):
        nome = re.sub(r"\s+", " ", norm(linhas[i]))
        if nome not in NOMES and nome.startswith("$") and desfaz_fonte(nome) in NOMES:
            nome = desfaz_fonte(nome)
        if nome in NOMES and nome not in res:
            vals, j = [], i + 1
            while j < len(linhas) and len(vals) < 6:
                if linhas[j] == "":
                    j += 1
                    continue
                v = num_milhar(linhas[j])
                if v is None:
                    break
                vals.append(v)
                j += 1
            if len(vals) == 6:
                res[nome] = vals
                i = j
                continue
        i += 1
    return res


def acha_tabela_uf(pgs):
    """Pagina da tabela 'Classificacao do Estado Geral em km por Regiao e UF'."""
    for n in sorted(pgs):
        s = sem_espaco(pgs[n])
        titulo = "ClassificaçãodoEstadoGeralemkm" in s or "ClassificaçãodoEstadoGeral(km)" in s
        titulo_2010 = "ESTADOGERAL" in s and "RegiãoeUF" in s and "Tabela" in pgs[n]   # 2010: titulo com fonte codificada
        if titulo or titulo_2010:
            r = parse_tabela_uf(pgs, n)
            if all(k in r for k in NOME_UF) and all(abs(sum(v[:5]) - v[5]) <= 1 for v in r.values()):
                return n, r
    return None, {}


ROD_RE = re.compile(r"^[A-Z]{2,3}-\d{2,3}[A-Z]?(?:/[A-Z]{2,3}-\d{2,3}[A-Z]?)*$")


def num_km(s):
    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+", s):
        return float(s.replace(".", ""))
    if re.fullmatch(r"\d+(?:,\d+)?", s):
        return float(s.replace(",", "."))
    return None


def parse_rodovias(pgs):
    """(pagina, rodovia, km, geral, pav, sin, geom) das tabelas 'por rodovia pesquisada'."""
    linhas = []
    for n in sorted(pgs):
        tok = norm(pgs[n]).split()
        i = 0
        while i < len(tok) - 5:
            if ROD_RE.match(tok[i]) and num_km(tok[i + 1]) is not None and all(x in PESO for x in tok[i + 2:i + 6]):
                linhas.append((n, tok[i], num_km(tok[i + 1]), *tok[i + 2:i + 6]))
                i += 6
                continue
            i += 1
    return linhas


def nacional_estadual_pdf(pgs):
    """Tabela nacional 'Classificacao do Estado Geral - Extensao estadual' (validacao)."""
    for n in sorted(pgs):
        s = sem_espaco(pgs[n])
        if re.search(r"ClassificaçãodoEstadoGeral[–-]Extensãoestadual", s, re.I) and "Ótimo" in pgs[n]:
            tok = norm(pgs[n]).split()
            out = {}
            for k, t in enumerate(tok[:-1]):
                if t in PESO and t not in out and num_milhar(tok[k + 1]) is not None:
                    out[t] = num_milhar(tok[k + 1])
            if len(out) == 5:
                return n, out
    return None, {}


# ----------------------------------------------------------------------------
# C. PNV - rede de jurisdicao estadual (resumos 2001-2010)
# ----------------------------------------------------------------------------
def coleta_pnv():
    import pandas as pd
    log("== C. PNV resumos 2001-2010 (DNIT Cloud)")
    pasta = os.path.join(BRUTOS, "pnv")
    os.makedirs(pasta, exist_ok=True)
    linhas = []
    for ano in range(2001, 2011):
        f = os.path.join(pasta, "Resumo_PNV%d.xlsx" % ano)
        if not os.path.exists(f):
            caminho = "Histórico PNV (1983-2010)/PNV Resumos (2001-2010) (XLS)/Resumo_PNV%d.xlsx" % ano
            r = requests.get(DAV + urllib.parse.quote(caminho), auth=(DAV_TOKEN, ""), timeout=300)
            r.raise_for_status()
            open(f, "wb").write(r.content)
        df = pd.read_excel(f, sheet_name="RESUMO_ESTADUAL", header=None)
        for _, r in df.iterrows():
            uf = r[1]
            if isinstance(uf, str) and uf in UFS:
                v = [float(x) for x in r.iloc[3:14]]
                plan, leito, ob_imp, imp, ob_pav, sub_np, simples, ob_dup, dupla, sub_pav, total = v
                if abs(plan + sub_np + sub_pav - total) > 1.0:
                    log("  AVISO: soma nao fecha", ano, uf, plan + sub_np + sub_pav, total)
                implantada = sub_np + sub_pav
                linhas.append({"uf": uf, "ano": ano, "valor": round(100 * sub_pav / implantada, 2) if implantada else None,
                               "km_pavimentada": sub_pav, "km_nao_pavimentada": sub_np, "km_planejada": plan,
                               "km_total": total, "unidade": "% pavimentada da rede estadual do PNV (sem planejada)",
                               "fonte": "DNIT, PNV - Resumo_PNV%d.xlsx, aba RESUMO_ESTADUAL" % ano})
    # regional
    por_ano = collections.defaultdict(lambda: collections.Counter())
    for l in list(linhas):
        for k in ("km_pavimentada", "km_nao_pavimentada", "km_planejada", "km_total"):
            por_ano[l["ano"]][k] += l[k]
    for ano, c in sorted(por_ano.items()):
        linhas.append({"uf": "AL", "ano": ano, "valor": round(100 * c["km_pavimentada"] / (c["km_pavimentada"] + c["km_nao_pavimentada"]), 2),
                       "km_pavimentada": c["km_pavimentada"], "km_nao_pavimentada": c["km_nao_pavimentada"],
                       "km_planejada": c["km_planejada"], "km_total": c["km_total"],
                       "unidade": "% pavimentada da rede estadual do PNV (sem planejada)",
                       "fonte": "DNIT, PNV - soma das 9 UFs"})
    escreve_csv("s5_pnv_estadual_pavimentada_uf_2001_2010.csv", linhas,
                ["uf", "ano", "valor", "km_pavimentada", "km_nao_pavimentada", "km_planejada", "km_total", "unidade", "fonte"])
    return linhas


# ----------------------------------------------------------------------------
# principal
# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--so-pbi", action="store_true", help="so a coleta A (Power BI)")
    ap.add_argument("--sem-pdf", action="store_true", help="nao baixa os PDFs (usa so o cache de texto)")
    ap.add_argument("--manter-pdf", action="store_true")
    a = ap.parse_args()
    os.makedirs(BRUTOS, exist_ok=True)

    # ---- A
    km, meta, rod2022 = coleta_powerbi()
    s1, s2 = [], []
    for ano in sorted(km):
        acum = collections.Counter()
        for uf in UFS:
            d = km[ano].get(uf, {}).get("Estadual")
            if not d:
                continue
            for c in CLASSES:
                s1.append({"uf": uf, "ano": ano, "classe": c, "km": d.get(c, 0.0), "jurisdicao": "Estadual",
                           "unidade": "km avaliados pela CNT (unidades de pesquisa de 1 km)",
                           "fonte": FONTE_PBI.format(ano=ano)})
                acum[c] += d.get(c, 0.0)
            ef, tot, v = razao(d)
            s2.append({"uf": uf, "ano": ano, "valor": round(v, 2), "km_efetivo": round(ef, 2), "km_avaliado": tot,
                       "unidade": "% (soma dos km x peso da ficha / km avaliados), rodovias ESTADUAIS avaliadas pela CNT",
                       "fonte": FONTE_PBI.format(ano=ano), "metodo": "distribuicao por classe (km por classe do Estado Geral)"})
        ef, tot, v = razao(acum)
        s2.append({"uf": "AL", "ano": ano, "valor": round(v, 2), "km_efetivo": round(ef, 2), "km_avaliado": tot,
                   "unidade": "% (soma sobre soma das UFs com rodovia estadual avaliada)", "fonte": FONTE_PBI.format(ano=ano),
                   "metodo": "distribuicao por classe (km por classe do Estado Geral)"})
    log("== saidas A")
    escreve_csv("s1_cnt_estadual_km_por_classe_uf_2021_2025.csv", s1,
                ["uf", "ano", "classe", "km", "jurisdicao", "unidade", "fonte"])
    escreve_csv("s2_cnt_estadual_adequacao_ponderada_uf_2021_2025.csv", s2,
                ["uf", "ano", "valor", "km_efetivo", "km_avaliado", "unidade", "fonte", "metodo"])
    json.dump(meta, open(os.path.join(PASTA, "pbi_meta_paineis.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    if a.so_pbi:
        return

    # ---- B
    log("== B. PDFs Pesquisa CNT de Rodovias")
    s3, s4, s4_raw, valid = [], [], [], []
    for ano in sorted(HANDLES_PDF):
        if a.sem_pdf and not os.path.exists(os.path.join(TEXTO, "%d.txt" % ano)):
            continue
        pgs = paginas(baixa_texto_pdf(ano, a.manter_pdf))
        n, r = acha_tabela_uf(pgs)
        if not n:
            log("  %d: tabela por UF NAO encontrada" % ano)
        else:
            acum = collections.Counter()
            for nome, sigla in NOME_UF.items():
                if sigla not in UFS:
                    continue
                v = r[nome]
                d = dict(zip(CLASSES, v[:5]))
                ef, tot, pc = razao(d)
                s3.append({"uf": sigla, "ano": ano, "valor": round(pc, 2), "km_otimo": v[0], "km_bom": v[1],
                           "km_regular": v[2], "km_ruim": v[3], "km_pessimo": v[4], "km_total": v[5],
                           "unidade": "% (ponderado pelos pesos da ficha), rodovias federais + estaduais avaliadas pela CNT",
                           "fonte": FONTE_PDF.format(ano=ano), "pagina_pdf": n})
                for c in CLASSES:
                    acum[c] += d[c]
            ef, tot, pc = razao(acum)
            s3.append({"uf": "AL", "ano": ano, "valor": round(pc, 2), "km_otimo": acum["Ótimo"], "km_bom": acum["Bom"],
                       "km_regular": acum["Regular"], "km_ruim": acum["Ruim"], "km_pessimo": acum["Péssimo"], "km_total": tot,
                       "unidade": "% (soma sobre soma das 9 UFs)", "fonte": FONTE_PDF.format(ano=ano), "pagina_pdf": n})
            # validacao com o Power BI (soma Estadual + Federal por UF)
            if ano in km:
                for nome, sigla in NOME_UF.items():
                    if sigla not in UFS:
                        continue
                    pbi = collections.Counter()
                    for jur, dd in km[ano].get(sigla, {}).items():
                        for c, x in dd.items():
                            pbi[c] += x
                    v = r[nome]
                    ok = all(abs(pbi.get(c, 0) - v[i]) < 0.5 for i, c in enumerate(CLASSES))
                    valid.append({"ano": ano, "teste": "PDF tabela por UF = Power BI (estadual + federal)", "uf": sigla,
                                  "resultado": "ok" if ok else "DIFERE", "pdf": v[:5], "pbi": [pbi.get(c, 0) for c in CLASSES]})
        # tabela nacional estadual (validacao do painel)
        if ano in km:
            np_, nac = nacional_estadual_pdf(pgs)
            if nac:
                pbi = collections.Counter()
                for uf in km[ano]:
                    for c, x in km[ano][uf].get("Estadual", {}).items():
                        pbi[c] += x
                ok = all(abs(pbi[c] - nac[c]) < 0.5 for c in CLASSES)
                valid.append({"ano": ano, "teste": "PDF tabela nacional 'extensao estadual' = Power BI", "uf": "BR",
                              "resultado": "ok" if ok else "DIFERE", "pdf": [nac[c] for c in CLASSES],
                              "pbi": [pbi[c] for c in CLASSES]})
        # rodovias estaduais por UF (uma classe por rodovia)
        if ano in ANOS_ROD_PDF:
            # so as paginas com a legenda "Classificacao por rodovia pesquisada - <UF>": outras tabelas
            # (corredores, rodovias de varias UFs) repetem os codigos com extensoes totais
            legenda = {n_ for n_, x in pgs.items()
                       if re.search("classificaçãoporrodoviapesquisada", sem_espaco(x), re.I)}
            linhas = [l for l in parse_rodovias(pgs) if l[0] in legenda]
            vistos = {}
            for (pg, rod, kmr, ger, pav, sin, geo) in linhas:
                uf = rod.split("-")[0]
                if uf in UFS and rod not in vistos:
                    vistos[rod] = (pg, rod, kmr, ger, pav, sin, geo)
                    s4_raw.append({"ano": ano, "uf": uf, "rodovia": rod, "km": kmr, "estado_geral": ger, "pavimento": pav,
                                   "sinalizacao": sin, "geometria": geo, "pagina_pdf": pg,
                                   "fonte": FONTE_PDF.format(ano=ano)})
    # S4 agregada (PDF 2011-2018 + painel 2022)
    por = collections.defaultdict(lambda: collections.defaultdict(float))
    nrod = collections.Counter()
    for l in s4_raw:
        por[(l["uf"], l["ano"])][l["estado_geral"]] += l["km"]
        nrod[(l["uf"], l["ano"])] += 1
    for l in rod2022:
        if l["ats_trecho_jurisdicao"] == "Estadual" and l["estadogeral_rodovia_uf"] in PESO and l["ats_uf_sigla"] in UFS:
            por[(l["ats_uf_sigla"], 2022)][l["estadogeral_rodovia_uf"]] += l["ext_max"]
            nrod[(l["ats_uf_sigla"], 2022)] += 1
            s4_raw.append({"ano": 2022, "uf": l["ats_uf_sigla"], "rodovia": l["rodovia"], "km": l["ext_max"],
                           "estado_geral": l["estadogeral_rodovia_uf"], "pavimento": l.get("estadopav_rodovia_uf"),
                           "sinalizacao": l.get("estadosin_rodovia_uf"), "geometria": l.get("estadogeom_rodovia_uf"),
                           "pagina_pdf": "", "fonte": FONTE_PBI.format(ano=2022) + " (vw_basedadosrodovia_mediageral2)"})
    for (uf, ano), d in sorted(por.items(), key=lambda x: (x[0][1], x[0][0])):
        ef, tot, pc = razao(d)
        s4.append({"uf": uf, "ano": ano, "valor": round(pc, 2), "km_efetivo": round(ef, 2), "km_avaliado": tot,
                   "n_rodovias": nrod[(uf, ano)],
                   "unidade": "% (ponderado), UMA classe por rodovia estadual avaliada (classe predominante da rodovia na UF)",
                   "fonte": FONTE_PDF.format(ano=ano) if ano <= 2018 else FONTE_PBI.format(ano=ano),
                   "metodo": "classe unica por rodovia (aproximacao grosseira)"})
    for ano in sorted({k[1] for k in por}):
        ac = collections.Counter()
        for (uf, a2), d in por.items():
            if a2 == ano:
                for c, x in d.items():
                    ac[c] += x
        ef, tot, pc = razao(ac)
        s4.append({"uf": "AL", "ano": ano, "valor": round(pc, 2), "km_efetivo": round(ef, 2), "km_avaliado": tot,
                   "n_rodovias": sum(v for (u, a2), v in nrod.items() if a2 == ano),
                   "unidade": "% (soma sobre soma das UFs com rodovia estadual avaliada)",
                   "fonte": "CNT, ver s4_rodovias_estaduais_raw.csv", "metodo": "classe unica por rodovia (aproximacao grosseira)"})
    log("== saidas B")
    escreve_csv("s3_cnt_federal_estadual_adequacao_ponderada_uf_2010_2025.csv", s3,
                ["uf", "ano", "valor", "km_otimo", "km_bom", "km_regular", "km_ruim", "km_pessimo", "km_total", "unidade",
                 "fonte", "pagina_pdf"])
    escreve_csv("s4_cnt_estadual_adequacao_por_rodovia_uf_2011_2022.csv", s4,
                ["uf", "ano", "valor", "km_efetivo", "km_avaliado", "n_rodovias", "unidade", "fonte", "metodo"])
    escreve_csv("s4_rodovias_estaduais_raw.csv", s4_raw,
                ["ano", "uf", "rodovia", "km", "estado_geral", "pavimento", "sinalizacao", "geometria", "pagina_pdf", "fonte"])
    # comparacao dos dois metodos em 2022 (distribuicao x classe unica por rodovia)
    comp = []
    for uf in UFS:
        a_ = next((x for x in s2 if x["uf"] == uf and x["ano"] == 2022), None)
        b_ = next((x for x in s4 if x["uf"] == uf and x["ano"] == 2022), None)
        if a_ and b_:
            comp.append({"uf": uf, "ano": 2022, "valor_distribuicao": a_["valor"], "valor_classe_unica": b_["valor"],
                         "km_distribuicao": a_["km_avaliado"], "km_classe_unica": b_["km_avaliado"]})
    escreve_csv("checagem_metodos_2022.csv", comp,
                ["uf", "ano", "valor_distribuicao", "valor_classe_unica", "km_distribuicao", "km_classe_unica"])
    json.dump(valid, open(os.path.join(PASTA, "validacao_cnt_pbi_vs_pdf.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log("  validacoes:", collections.Counter(v["resultado"] for v in valid))

    # ---- C
    coleta_pnv()
    log("pronto.")


if __name__ == "__main__":
    main()
