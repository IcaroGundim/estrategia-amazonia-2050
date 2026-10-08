#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""I4.4.2 - Capacidade adaptativa urbana: busca de series historicas.

Resultado (estrutural, confirmado): o escore do painel (media de 36 subindicadores
do AdaptaBrasil, % de municipios acima de 0,5) NAO tem serie historica publicada.
Cada no/indicador da plataforma tem um unico ano de referencia, e o mesmo dado
muda de rotulo de ano entre versoes da plataforma. O que este coletor grava:

  1. perfil_arquivos_locais.csv          anos e recortes dos arquivos locais
  2. teste_linha_base_escore.csv         o escore da planilha nao sai do CSV bruto
  3. evidencia_anos_hierarquia.csv       anos de cada no "Capacidade adaptativa" (API viva)
  4. indices_oficiais_municipios.csv     indices oficiais (11 nos), 773 municipios da AL
  5. indices_oficiais_uf.csv             idem, agregado por UF  (contexto, corte unico)
  6. comparacao_versoes_antiga_atual.csv mesmo dado, rotulo de ano diferente entre versoes
  7. contexto_sidra6673_reducao_risco_uf.csv  SERIE 2013/2017/2020 por UF (contexto)
  8. subindicadores_36_fontes_primarias.csv   fonte primaria e periodicidade (so texto)
  9. (opcional, --wayback) evidencia_ids_reaproveitados.csv

Execucao, a partir da raiz do projeto:
    PYTHONUTF8=1 python scripts/eixo4_series_capacidade_adaptativa.py [--wayback]

Cada etapa de rede falha sem derrubar as demais. Somente leitura sobre
"Dados da Estrategia 2050/" e "dashboard/conteudo/valores.csv".
"""
import csv
import html
import io
import json
import os
import re
import sys
import time
from collections import OrderedDict

import numpy as np
import openpyxl
import pandas as pd
import requests

BASE = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(BASE)
PACOTE = os.path.join(RAIZ, "Dados da Estratégia 2050")
OUT = os.path.join(RAIZ, "dados", "eixo4_series", "I4.4.2")
BRUTO = os.path.join(OUT, "bruto")
VALORES = os.path.join(RAIZ, "dashboard", "conteudo", "valores.csv")
UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
UF_COD = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP",
          "17": "TO", "21": "MA", "51": "MT"}
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
API = "https://sistema.adaptabrasil.mcti.gov.br/api"
URL_HIER = API + "/hierarquia/adaptabrasil"
URL_MAPA = API + "/mapa-dados/BR/municipio/{i}/{y}/null/adaptabrasil"
URL_SIDRA = "https://apisidra.ibge.gov.br/values/t/6673/{n}/all/v/all/p/all?formato=json"
URL_CRAWLER = ("https://raw.githubusercontent.com/AdaptaBrasil/PreProcessing/master/"
               "src/crawlers/crawler-1/final_results.csv")
WAYBACK = [("20220621150209", "api/hierarquia"), ("20240710134326", "api/hierarquia"),
           ("20250227121453", "api/hierarquia")]

os.makedirs(BRUTO, exist_ok=True)


def log(*a):
    print(*a, flush=True)


def gravar(nome, df):
    df.to_csv(os.path.join(OUT, nome), index=False, encoding="utf-8")
    log(f"  -> {nome} ({len(df)} linhas)")


def get(url, tentativas=3, **kw):
    ultimo = None
    for i in range(tentativas):
        try:
            r = requests.get(url, timeout=180, headers=HEADERS, **kw)
            if r.status_code in (429, 502, 503):
                ultimo = r.status_code
                time.sleep(10 * (i + 1))
                continue
            return r
        except requests.RequestException as e:
            ultimo = str(e)
            time.sleep(5)
    raise RuntimeError(f"falhou {url}: {ultimo}")


# --------------------------------------------------------------------------
# 1. Arquivos locais: anos, recortes, universo de municipios, teste do escore
# --------------------------------------------------------------------------
def etapa_locais():
    log("[1] arquivos locais")
    bruto = pd.read_csv(os.path.join(PACOTE, "valores brutos capacidade adaptativa.csv"),
                        sep=";", encoding="utf-8-sig")
    wb = openpyxl.load_workbook(os.path.join(PACOTE, "indicador capacidade adaptativa amazonia legal.xlsx"),
                                data_only=True)
    com = list(wb["3. Cidades COM Dados"].iter_rows(values_only=True))
    sem = list(wb["4. Cidades SEM Dados"].iter_rows(values_only=True))
    ind = list(wb["2. Indicadores"].iter_rows(values_only=True))[1:]
    sc = pd.DataFrame(com[1:], columns=com[0])
    sc["geocod_ibge"] = sc["geocod_ibge"].astype(int)
    isem_cd, isem_uf = sem[0].index("CD_MUN"), sem[0].index("SIGLA_UF")
    universo = {str(r[0]): r[isem_uf] for r in sem[1:] if r[0]}
    for _, r in sc.iterrows():
        universo[str(int(r["CD_MUN"]))] = r["SIGLA_UF"]
    log(f"  universo de municipios da AL: {len(universo)} ({len(sc)} com dados + {len(sem) - 1} sem)")

    # perfil: ano e cobertura de cada id
    bruto["setor"] = bruto["caminho_hierarquico_completo"].str.split(" ➔ ").str[0]
    perfil = (bruto.groupby(["setor", "indicador_id", "indicador_nome"])
              .agg(ano=("ano", "min"), ano_max=("ano", "max"), n_anos=("ano", "nunique"),
                   n_municipios=("geocod_ibge", "nunique"), n_ufs=("uf_sigla", "nunique"))
              .reset_index())
    gravar("perfil_arquivos_locais.csv", perfil)

    # linha de base: o painel (valores.csv) sai da planilha
    nomes36 = [r[0] for r in ind]
    avaliados = sc.groupby("SIGLA_UF").size().to_dict()
    acima = sc[sc["score_capacidade"] > 0.5].groupby("SIGLA_UF").size().to_dict()
    total = {u: sum(1 for x in universo.values() if x == u) for u in UFS}
    painel = {}
    with open(VALORES, encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["codigo"] == "I4.4.2" and not r["campo"] and not r["ano"]:
                painel[r["uf"]] = float(r["valor"])
    linhas = []
    for u in UFS:
        v = round(acima.get(u, 0) / total[u] * 100, 2)
        linhas.append(dict(teste="planilha_vs_valores_csv", uf=u, valor_a=v, valor_b=painel.get(u),
                           nota="valor_a: planilha (escore>0,5 / municipios da UF); valor_b: valores.csv"))
    linhas.append(dict(teste="planilha_vs_valores_csv", uf="AL", valor_a=round(sum(acima.values()) / len(universo) * 100, 2),
                       valor_b=2.46, nota="19 / 773 = 2,46% (resumo da planilha)"))

    # escore recalculado com media simples dos 36 nomes no ano mais recente
    d = bruto[bruto["indicador_nome"].isin(nomes36)].copy()
    d["amax"] = d.groupby("indicador_nome")["ano"].transform("max")
    d = d[d["ano"] == d["amax"]]
    for rotulo, agg in (("media_dos_ids_do_mesmo_nome", "mean"), ("primeiro_id_do_nome", "first")):
        x = d.groupby(["geocod_ibge", "indicador_nome"])["valor"].agg(agg).reset_index()
        m = x.groupby("geocod_ibge")["valor"].mean().rename("m")
        j = sc.merge(m, left_on="geocod_ibge", right_index=True, how="left")
        dif = (j["score_capacidade"] - j["m"]).abs()
        linhas.append(dict(teste=f"escore_recalculado_{rotulo}", uf="AL", valor_a=int((sc["score_capacidade"] > 0.5).sum()),
                           valor_b=int((j["m"] > 0.5).sum()),
                           nota=f"municipios acima de 0,5: planilha vs media simples dos 36; dif max abs no escore = {dif.max():.4f}"))
    gravar("teste_linha_base_escore.csv", pd.DataFrame(linhas))
    return universo


# --------------------------------------------------------------------------
# 2. Hierarquia viva da API: um ano por no "Capacidade adaptativa"?
# --------------------------------------------------------------------------
def anos_do_no(x):
    y = x.get("years")
    if y is None:
        return []
    if isinstance(y, list):
        return [int(i) for i in y]
    return [int(i) for i in str(y).split(",") if i.strip()]


def cadeia(h, x):
    p = [x]
    while True:
        try:
            m = int(x.get("indicator_id_master"))
        except (TypeError, ValueError):
            break
        if m == 0 or m not in h:
            break
        x = h[m]
        p.append(x)
    return list(reversed(p))


def etapa_hierarquia():
    log("[2] hierarquia da API")
    r = get(URL_HIER)
    r.raise_for_status()
    with open(os.path.join(BRUTO, "api_hierarquia_adaptabrasil.json"), "wb") as f:
        f.write(r.content)
    h = {x["id"]: x for x in r.json()}
    linhas = []
    for x in h.values():
        ch = cadeia(h, x)
        nomes = [(c.get("shortname") or c["name"]).strip() for c in ch]
        if any(n == "Capacidade adaptativa" for n in nomes):
            anos = anos_do_no(x)
            linhas.append(dict(id=x["id"], nome=nomes[-1], nivel=x["level"], setor=nomes[0],
                               caminho=" > ".join(nomes), anos=",".join(map(str, anos)), n_anos=len(anos),
                               e_indice_capacidade=int(nomes[-1] == "Capacidade adaptativa")))
    df = pd.DataFrame(linhas).sort_values(["setor", "id"])
    gravar("evidencia_anos_hierarquia.csv", df)
    idx = df[df["e_indice_capacidade"] == 1]
    log(f"  nos 'Capacidade adaptativa': {len(idx)}; com mais de um ano: {(idx['n_anos'] > 1).sum()}")
    log(f"  descendentes com mais de um ano: {(df['n_anos'] > 1).sum()} de {len(df)}")
    return h


# --------------------------------------------------------------------------
# 3. Indices oficiais "Capacidade adaptativa" por UF (cortes unicos de ano)
# --------------------------------------------------------------------------
def baixar_no(i, y):
    r = get(URL_MAPA.format(i=i, y=y))
    r.raise_for_status()
    j = r.json()
    if not isinstance(j, list) or not j:
        return pd.DataFrame(columns=["geocod_ibge", "value"])
    df = pd.DataFrame(j)[["geocod_ibge", "value"]]
    df["geocod_ibge"] = df["geocod_ibge"].astype(str)
    return df


def etapa_indices(h, universo):
    log("[3] indices oficiais de capacidade adaptativa (API mapa-dados)")
    nos = []
    for x in h.values():
        if (x.get("shortname") or x["name"]).strip() == "Capacidade adaptativa" and x["level"] == 4:
            ch = cadeia(h, x)
            setor = (ch[0].get("shortname") or ch[0]["name"]).strip()
            if setor == "Infraestrutura portuária":
                continue  # ponto de porto, nao municipal-urbano
            ameaca = (ch[1].get("shortname") or ch[1]["name"]).strip() if len(ch) > 1 else ""
            nos.append((x["id"], setor, ameaca, anos_do_no(x)))
    nos.sort()
    mun, uf_rows = [], []
    for i, setor, ameaca, anos in nos:
        for y in anos:
            df = baixar_no(i, y)
            df = df[df["geocod_ibge"].isin(universo)].copy()
            df["uf"] = df["geocod_ibge"].map(universo)
            log(f"  no {i} {setor}/{ameaca} {y}: {len(df)} municipios da AL com valor")
            for _, r in df.iterrows():
                mun.append(dict(cod_ibge=r["geocod_ibge"], uf=r["uf"], no_id=i, setor=setor, ameaca=ameaca,
                                ano=y, valor=r["value"]))
            tot_al = ac_al = cd_al = 0
            soma = 0.0
            for u in UFS:
                t = sum(1 for v in universo.values() if v == u)
                d = df[df["uf"] == u]
                a = int((d["value"] > 0.5).sum())
                uf_rows.append(dict(uf=u, ano=y, no_id=i, setor=setor, ameaca=ameaca, n_total=t,
                                    n_com_valor=len(d), n_acima05=a, valor=round(a / t * 100, 2),
                                    media=round(float(d["value"].mean()), 3) if len(d) else None,
                                    unidade="% de municipios (denominador: todos os municipios da UF na AL)",
                                    fonte="AdaptaBrasil MCTI, API mapa-dados"))
                tot_al += t; ac_al += a; cd_al += len(d); soma += float(d["value"].sum())
            uf_rows.append(dict(uf="AL", ano=y, no_id=i, setor=setor, ameaca=ameaca, n_total=tot_al,
                                n_com_valor=cd_al, n_acima05=ac_al, valor=round(ac_al / tot_al * 100, 2),
                                media=round(soma / cd_al, 3) if cd_al else None,
                                unidade="% de municipios (denominador: 773 municipios da AL)",
                                fonte="AdaptaBrasil MCTI, API mapa-dados"))
    gravar("indices_oficiais_municipios.csv", pd.DataFrame(mun))
    gravar("indices_oficiais_uf.csv", pd.DataFrame(uf_rows))


# --------------------------------------------------------------------------
# 4. Mesmo dado, outro rotulo de ano: crawler antigo (GitHub) vs API atual
# --------------------------------------------------------------------------
# id antigo -> (id atual, nome). Ramo "deslizamento de terra" (antigo 601xx; atual 600xx).
PARES = OrderedDict([
    (60104, (60005, "INDICE Capacidade adaptativa (deslizamento)")),
    (60004, (60045, "INDICE Capacidade adaptativa (inundacoes)")),
    (60118, (60019, "Instituicoes para gestao de risco")),
    (60119, (60020, "Gestao de residuos e limpeza publica")),
    (60120, (60021, "Gestao de ocupacao urbana em areas de risco")),
    (60121, (60022, "Acoes para reducao de risco")),
    (60122, (60023, "Sistemas de alerta antecipado")),
    (60123, (60024, "Plano de contingencia")),
    (60124, (60025, "Uso e ocupacao do solo")),
    (60125, (60026, "Governanca em meio ambiente")),
    (60126, (60027, "Governanca em habitacao")),
    (60127, (60028, "Governanca em transporte")),
    (60117, (60018, "Programa cidades resilientes")),
    (60113, (60014, "Investimento em politicas de adaptacao")),
    (60129, (60030, "Plano municipal de saneamento basico")),
])


def etapa_versoes(h):
    log("[4] comparacao versao antiga (crawler GitHub, commit 2025-09-17) x API atual")
    r = get(URL_CRAWLER)
    r.raise_for_status()
    fr = pd.read_csv(io.BytesIO(r.content))
    linhas = []
    for oid, (nid, nome) in PARES.items():
        o = fr[fr["indicator_id"] == oid]
        if o.empty or nid not in h:
            continue
        ano_antigo = int(o["year"].iloc[0])
        ano_atual = anos_do_no(h[nid])[0]
        n = baixar_no(nid, ano_atual)
        n["geocod_ibge"] = n["geocod_ibge"].astype(int)
        m = o[["geocod_ibge", "value"]].merge(n, on="geocod_ibge", suffixes=("_antigo", "_atual"))
        dif = (m["value_antigo"] - m["value_atual"]).abs()
        linhas.append(dict(
            tipo="indice" if nome.startswith("INDICE") else "subindicador", nome=nome,
            id_antigo=oid, ano_rotulo_antigo=ano_antigo, id_atual=nid, ano_rotulo_atual=ano_atual,
            n_municipios=len(m), correlacao=round(float(m["value_antigo"].corr(m["value_atual"])), 4),
            pct_valores_identicos=round(float((dif < 1e-9).mean()) * 100, 1),
            dif_max=round(float(dif.max()), 3),
            media_antiga=round(float(m["value_antigo"].mean()), 3), media_atual=round(float(m["value_atual"].mean()), 3),
            nota="ids sao reaproveitados entre versoes: comparar so por estes pares nominais"))
    gravar("comparacao_versoes_antiga_atual.csv", pd.DataFrame(linhas))


# --------------------------------------------------------------------------
# 5. Contexto: SIDRA 6673 (ODS 11.b.2), serie 2013/2017/2020 por UF
# --------------------------------------------------------------------------
def etapa_sidra():
    log("[5] SIDRA 6673 (ODS 11.b.2)")
    linhas = []
    for n in ("n3", "n1"):
        r = get(URL_SIDRA.format(n=n))
        r.raise_for_status()
        dados = r.json()
        for x in dados[1:]:
            cod = x["D1C"]
            uf = UF_COD.get(cod) if n == "n3" else "BR"
            if uf is None or str(x["V"]).strip() in ("-", "...", "X", ""):
                continue
            obs = ("valor do Brasil inteiro" if uf == "BR" else
                   "valor da UF inteira; so o MA e parcial na AL (181 de 217 municipios)" if uf == "MA" else
                   "valor da UF inteira")
            linhas.append(dict(uf=uf, ano=int(x["D3C"]), valor=float(x["V"]), unidade="% de municipios",
                               fonte="IBGE, SIDRA tabela 6673 (ODS 11.b.2/13.1.3, base MUNIC)",
                               observacao=obs))
    df = pd.DataFrame(linhas).sort_values(["uf", "ano"])
    gravar("contexto_sidra6673_reducao_risco_uf.csv", df)


# --------------------------------------------------------------------------
# 6. Subindicadores: fonte primaria e periodicidade (somente texto)
# --------------------------------------------------------------------------
# periodicidade/serie anual: avaliacao do autor a partir do texto da descricao do AdaptaBrasil;
# a frequencia de cada fonte NAO foi verificada por download nesta etapa.
CLASSE = {
    "Associativismo": ("Censo Agropecuario IBGE", "decenal", "nao"),
    "Propriedade da terra": ("Censo Agropecuario IBGE", "decenal", "nao"),
    "Orientacao tecnica": ("Censo Agropecuario IBGE", "decenal", "nao"),
    "Renda superior a dois salarios minimos": ("Censo Demografico IBGE 2010", "decenal", "nao"),
    "Diversidade de receitas": ("PAM e PPM IBGE", "anual", "sim"),
    "Participacao agropecuaria no PIB": ("PIB dos Municipios IBGE (VAB)", "anual", "sim"),
    "Participacao industrial no PIB": ("PIB dos Municipios IBGE (VAB)", "anual", "sim"),
    "Pib municipal per capita": ("PIB dos Municipios IBGE", "anual", "sim"),
    "Produto interno bruto por area urbana": ("PIB dos Municipios IBGE + area urbana", "anual (PIB)", "parcial"),
    "Investimento federal per capita": ("Portal da Transparencia/CGU (transferencias)", "anual", "sim"),
    "Investimento em politicas de adaptacao": ("Portal da Transparencia/CGU (transferencias)", "anual", "sim"),
    "Investimentos em politicas de adaptacao": ("Portal da Transparencia/CGU (transferencias)", "anual", "sim"),
    "Investimentos em recursos hidricos": ("Portal da Transparencia/CGU (transferencias)", "anual", "sim"),
    "Programa nacional de alimentacao escolar (PNAE)": ("SEAD/MDA painel + INEP", "anual", "sim"),
    "Cobertura da atencao basica": ("e-Gestor AB (Ministerio da Saude)", "mensal/anual", "sim"),
    "Geracao distribuida de eletricidade": ("EPE, painel de micro e minigeracao (UF)", "anual/mensal", "sim (UF)"),
    "Autoprodutores de eletricidade": ("BEN/EPE e Anuario de Energia Eletrica (UF, 2018)", "anual", "sim (UF)"),
    "Diversificacao da geracao de eletricidade": ("BEN/EPE (UF, 2018)", "anual", "sim (UF)"),
    "Energia armazenada em reservatorios de hidreletricas": ("descricao nao informa a fonte", "n/d", "n/d"),
    "Cidades resilientes": ("SEDEC, adesao 2014-2016", "cadastro", "nao"),
    "Programa cidades resilientes": ("SEDEC, adesao 2014-2016", "cadastro", "nao"),
    "Reservacao natural": ("ANA, Indice de Seguranca Hidrica 2020", "edicoes esparsas", "nao"),
    "Reservacao artificial": ("ANA, Indice de Seguranca Hidrica 2020", "edicoes esparsas", "nao"),
    "Potencial de armazenamento subterraneo": ("ANA, Indice de Seguranca Hidrica 2020", "edicoes esparsas", "nao"),
    "Nivel de atuacao em comites de bacia": ("ANA 2017 + PNSB 2008 + MUNIC", "irregular", "nao"),
}
MUNIC = ("MUNIC IBGE (bloco gestao de riscos/governanca, edicao 2020)", "irregular: blocos mudam entre edicoes", "parcial")
for n in ("Acoes para reducao de risco", "Gestao de ocupacao urbana em areas de risco", "Gestao de residuos e limpeza publica",
          "Governanca em habitacao", "Governanca em meio ambiente", "Governanca em transporte",
          "Instituicoes para gestao de risco", "Plano de contingencia", "Sistemas de alerta antecipado",
          "Uso e ocupacao do solo"):
    CLASSE[n] = MUNIC
CLASSE["Plano municipal de saneamento basico"] = ("MUNIC IBGE 2015 e 2017", "irregular", "parcial")


def sem_acento(s):
    import unicodedata
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()


def etapa_subindicadores(h):
    log("[6] subindicadores: fonte primaria")
    wb = openpyxl.load_workbook(os.path.join(PACOTE, "indicador capacidade adaptativa amazonia legal.xlsx"), data_only=True)
    nomes = [r[0] for r in list(wb["2. Indicadores"].iter_rows(values_only=True))[1:]]
    bruto = pd.read_csv(os.path.join(PACOTE, "valores brutos capacidade adaptativa.csv"), sep=";", encoding="utf-8-sig")
    linhas = []
    for nome in nomes:
        d = bruto[bruto["indicador_nome"] == nome]
        amax = d["ano"].max()
        ids = sorted(d[d["ano"] == amax]["indicador_id"].unique())
        desc = ""
        if ids and int(ids[0]) in h:
            t = html.unescape(re.sub(r"<[^>]+>", " ", (h[int(ids[0])].get("complete_description") or "").replace("<br>", " ")))
            t = re.sub(r"\s+", " ", t)
            frases = re.split(r"(?<=[.;])\s+", t)
            keep = [s for s in frases if re.search(r"obtid|disponibiliz|oriund|coletad", s) and "AdaptaBrasil MCTI" not in s]
            desc = " | ".join(keep)[:500]
        fonte, per, serie = CLASSE.get(sem_acento(nome), ("", "", ""))
        linhas.append(dict(subindicador=nome, ids_no_csv=",".join(map(str, ids)), ano_rotulo_plataforma=int(amax),
                           fonte_primaria_classificada=fonte, periodicidade_da_fonte=per, serie_anual_publica=serie,
                           trecho_da_descricao=desc,
                           nota="classificacao do autor a partir do texto; frequencia da fonte nao verificada por download"))
    gravar("subindicadores_36_fontes_primarias.csv", pd.DataFrame(linhas))


# --------------------------------------------------------------------------
# 7. Opcional: Wayback, ids reaproveitados entre versoes da hierarquia
# --------------------------------------------------------------------------
def etapa_wayback(h):
    log("[7] Wayback: ids reaproveitados")
    alvo = [5006, 7, 50006, 60005, 60045, 90006, 60004, 60104, 50005]
    linhas = []
    for ts, caminho in WAYBACK:
        try:
            r = get(f"https://web.archive.org/web/{ts}id_/https://sistema.adaptabrasil.mcti.gov.br/{caminho}")
            r.raise_for_status()
            snap = {x["id"]: x for x in r.json()}
        except Exception as e:  # noqa: BLE001
            log(f"  {ts}: falhou ({e})")
            continue
        for i in alvo:
            x = snap.get(i)
            linhas.append(dict(captura=ts, id=i, existe=int(x is not None),
                               nome=(x or {}).get("name"), nivel=(x or {}).get("level"),
                               ano_rotulo=",".join(map(str, anos_do_no(x))) if x else None,
                               pai=(x or {}).get("indicator_id_master")))
    for i in alvo:
        x = h.get(i)
        linhas.append(dict(captura="api_viva", id=i, existe=int(x is not None), nome=(x or {}).get("name"),
                           nivel=(x or {}).get("level"), ano_rotulo=",".join(map(str, anos_do_no(x))) if x else None,
                           pai=(x or {}).get("indicator_id_master")))
    gravar("evidencia_ids_reaproveitados.csv", pd.DataFrame(linhas))


def seguro(nome, fn, *a):
    try:
        return fn(*a)
    except Exception as e:  # noqa: BLE001
        log(f"  !! etapa '{nome}' falhou: {e}")
        return None


def main():
    universo = seguro("locais", etapa_locais)
    h = seguro("hierarquia", etapa_hierarquia)
    if h is None and os.path.exists(os.path.join(BRUTO, "api_hierarquia_adaptabrasil.json")):
        h = {x["id"]: x for x in json.load(open(os.path.join(BRUTO, "api_hierarquia_adaptabrasil.json"), encoding="utf-8"))}
        log("  usando hierarquia em cache")
    if h and universo:
        seguro("indices", etapa_indices, h, universo)
        seguro("versoes", etapa_versoes, h)
        seguro("subindicadores", etapa_subindicadores, h)
    seguro("sidra6673", etapa_sidra)
    if "--wayback" in sys.argv and h:
        seguro("wayback", etapa_wayback, h)
    log("pronto")


if __name__ == "__main__":
    main()
