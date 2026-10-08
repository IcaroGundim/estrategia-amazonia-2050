#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 4 / I4.4.1 (ISGR) — séries históricas de saneamento por UF, a partir de outras fontes.

NENHUMA destas séries é o ISGR nem entra como valor do I4.4.1 (decisão registrada: exibir
outra medida sob o mesmo rótulo trocaria o indicador mantendo o nome). São componentes,
proxies e contexto. O ISGR em si só existe para 2022/2024: a classificação de água 1821 do
Censo 2022 (ligação à rede x forma principal de abastecimento) não existe antes, e FClima/FGov
vêm de perguntas da MUNIC 2024.

Rodar do zero, a partir da raiz do projeto:   python scripts/eixo4_series_saneamento.py

Rotas (cada uma isolada em try/except: se uma cair, as outras seguem):
  1. PNAD Contínua anual (SIDRA 6731, 9464, 6735, 7192), UF, 2016-2025 (sem 2020/2021).
  2. PNAD 2001-2015 (SIDRA 1955, 1956), UF, outra pesquisa (não emendar com a Contínua).
  3. Testes de linha de base: PNAD x Censo 2022 / Censo 2010 (SIDRA 6803, 6805, 3218, 1394).
  4. SNIS 2001-2022 (espelho da Base dos Dados, conferido com as planilhas oficiais) e SINISA 2023-2024.
  5. MUNIC: fatores FClima/FGov em edições anteriores (equivalência verificada nos dicionários).
  6. ODS 6.1.1 e 6.2.1 do IBGE (SIDRA 9787, 6835).
  7. Quebras entre pesquisas (PNAD -> PNAD Contínua, SNIS -> SINISA).
  8. (opcional, EIXO4_AUDITAR_MUNIC=1) auditoria dos dicionários da MUNIC 2008-2023.

Saídas em dados/eixo4_series/I4.4.1/ (CSV arrumado) e dados/eixo4_series/I4.4.1/bruto/ (cru).
"""
import csv
import io
import json
import os
import re
import sys
import time
import zipfile

import requests

sys.stdout.reconfigure(encoding="utf-8")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(RAIZ, "dados", "eixo4_series", "I4.4.1")
BRUTO = os.path.join(OUT, "bruto")
os.makedirs(BRUTO, exist_ok=True)

UF_COD = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
          "16": "AP", "17": "TO", "21": "MA", "51": "MT"}
UFS = sorted(UF_COD.values())
UF_LISTA = ",".join(UF_COD)
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36")
HEADERS = {"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9"}


# ----------------------------------------------------------------------------- utilidades
def http_get(url, tentativas=4, timeout=300, stream=False, headers=None):
    """GET com novas tentativas; devolve a resposta ou levanta a última exceção."""
    ultimo = None
    for i in range(tentativas):
        try:
            r = requests.get(url, timeout=timeout, headers=headers or HEADERS, stream=stream)
            if r.status_code == 200:
                return r
            ultimo = RuntimeError(f"HTTP {r.status_code} em {url}")
        except Exception as e:  # noqa: BLE001
            ultimo = e
        time.sleep(2 + 3 * i)
    raise ultimo


def sidra(caminho):
    """Consulta a API SIDRA e devolve a lista de linhas (sem o cabeçalho)."""
    r = http_get("https://apisidra.ibge.gov.br/values" + caminho, timeout=600)
    dados = r.json()
    return dados[1:]


def num(v):
    """Valor SIDRA -> float; '-', '...', 'X' -> None."""
    v = str(v).strip()
    if v in ("", "-", "..", "...", "X", "x"):
        return None
    try:
        return float(v)
    except ValueError:
        return None


def grava(nome, linhas, colunas):
    caminho = os.path.join(OUT, nome)
    with open(caminho, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=colunas, extrasaction="ignore")
        w.writeheader()
        for l in linhas:
            w.writerow(l)
    print(f"  gravado {nome}: {len(linhas)} linhas")
    return caminho


def salva_bruto(nome, linhas):
    """Guarda a resposta crua (lista de dicts) como CSV em bruto/."""
    if not linhas:
        return
    cols = list(linhas[0].keys())
    with open(os.path.join(BRUTO, nome), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(linhas)


def arred(x, n=2):
    return None if x is None else round(x, n)


# ----------------------------------------------------------------------------- 1. PNAD Contínua
def pnad_continua():
    """PNAD Contínua anual — características dos domicílios, por UF.

    6731: principal fonte de abastecimento de água (rede geral 46285; poço profundo 46286).
    9464: domicílios com LIGAÇÃO à rede geral (a partir de 2019).
    6735 (2016-2018) e 7192 (2019-): esgotamento sanitário. A 6735 só tem "rede geral, pluvial
          ou fossa ligada à rede" (46290) e um bloco "fossa não ligada" que mistura séptica e
          rudimentar; a 7192 separa fossa séptica ligada (47931) e não ligada (47936).
    Denominador de todos os percentuais: TOTAL de domicílios (6731, v162, c825=47937), o mesmo
    do Censo. As tabelas de esgoto trazem percentual sobre domicílios COM banheiro/sanitário.
    """
    print("1. PNAD Contínua (SIDRA 6731, 9464, 6735, 7192)")
    t6731 = sidra(f"/t/6731/n3/{UF_LISTA}/v/162,9784,9785/p/all/c1/6795/c825/47937,46285,46286")
    t9464 = sidra(f"/t/9464/n3/{UF_LISTA}/v/12957,12959,12960/p/all/c1/6795")
    t6735 = sidra(f"/t/6735/n3/{UF_LISTA}/v/9986,9987/p/all/c1/6795/c11558/46292,46290")
    t7192 = sidra(f"/t/7192/n3/{UF_LISTA}/v/9986,9987/p/all/c1/6795/c11558/46292,47930,47931,47936")
    for nome, t in (("pnadc_6731", t6731), ("pnadc_9464", t9464), ("pnadc_6735", t6735),
                    ("pnadc_7192", t7192)):
        salva_bruto(nome + ".csv", t)

    c = {}  # (uf, ano, tabela, variavel, categoria) -> valor

    def acumula(rows, tabela, cat_key):
        for x in rows:
            uf = UF_COD[x["D1C"]]
            c[(uf, x["D3C"], tabela, x["D2C"], x.get(cat_key, "") if cat_key else "")] = num(x["V"])

    acumula(t6731, "6731", "D5C")      # D4=situação, D5=fonte
    acumula(t9464, "9464", None)       # só tem situação do domicílio (já filtrada em 6795)
    acumula(t6735, "6735", "D5C")
    acumula(t7192, "7192", "D5C")

    anos_c = sorted({k[1] for k in c})
    total = {(uf, a): c.get((uf, a, "6731", "162", "47937")) for uf in UFS for a in anos_c}

    def pct(num_, den_):
        return None if (num_ is None or not den_) else num_ / den_ * 100

    linhas = {k: [] for k in ("agua_rede_principal", "agua_ampla_inf", "agua_ampla_sup",
                              "agua_ligacao", "esgoto_rede_fossaligada", "esgoto_adequado")}
    # acumuladores para a linha 'AL' (soma de domicílios das 9 UFs)
    al = {}

    def soma_al(serie, ano, parcela, tot):
        d = al.setdefault((serie, ano), [0.0, 0.0, True])
        if parcela is None or tot is None:
            d[2] = False
        else:
            d[0] += parcela
            d[1] += tot

    fonte_agua = "IBGE, PNAD Contínua anual (SIDRA 6731)"
    for uf in UFS:
        for a in anos_c:
            tot = total[(uf, a)]
            n_rede = pct(c.get((uf, a, "6731", "162", "46285")), tot)
            n_pp = pct(c.get((uf, a, "6731", "162", "46286")), tot)
            p_rede = c.get((uf, a, "6731", "9784", "46285"))
            p_pp = c.get((uf, a, "6731", "9784", "46286"))
            cv_rede = c.get((uf, a, "6731", "9785", "46285"))
            cv_pp = c.get((uf, a, "6731", "9785", "46286"))
            lig = c.get((uf, a, "9464", "12959", ""))
            cv_lig = c.get((uf, a, "9464", "12960", ""))
            n_lig = c.get((uf, a, "9464", "12957", ""))
            # 1. rede geral como principal forma
            if p_rede is not None:
                linhas["agua_rede_principal"].append(dict(
                    uf=uf, ano=a, valor=p_rede, unidade="% dos domicílios", fonte=fonte_agua,
                    cv_pct=cv_rede, domicilios_mil=total[(uf, a)]))
                soma_al("agua_rede_principal", a, c.get((uf, a, "6731", "162", "46285")), tot)
            # 2. limite inferior da água adequada: rede (principal) + poço profundo (principal)
            if p_rede is not None and p_pp is not None:
                linhas["agua_ampla_inf"].append(dict(
                    uf=uf, ano=a, valor=arred(p_rede + p_pp, 1), unidade="% dos domicílios",
                    fonte=fonte_agua, cv_rede_pct=cv_rede, cv_poco_profundo_pct=cv_pp,
                    pct_rede_principal=p_rede, pct_poco_profundo_principal=p_pp))
                soma_al("agua_ampla_inf", a,
                        (c.get((uf, a, "6731", "162", "46285")) or 0) + (c.get((uf, a, "6731", "162", "46286")) or 0),
                        tot)
            # 3. ligação à rede (2019+) e limite superior: ligação + poço profundo principal
            if lig is not None:
                linhas["agua_ligacao"].append(dict(
                    uf=uf, ano=a, valor=lig, unidade="% dos domicílios",
                    fonte="IBGE, PNAD Contínua anual (SIDRA 9464)", cv_pct=cv_lig))
                soma_al("agua_ligacao", a, n_lig, tot)
                if p_pp is not None:
                    linhas["agua_ampla_sup"].append(dict(
                        uf=uf, ano=a, valor=arred(lig + p_pp, 1), unidade="% dos domicílios",
                        fonte="IBGE, PNAD Contínua anual (SIDRA 9464 + 6731)",
                        pct_ligacao=lig, pct_poco_profundo_principal=p_pp,
                        cv_ligacao_pct=cv_lig, cv_poco_profundo_pct=cv_pp))
                    soma_al("agua_ampla_sup", a, (n_lig or 0) + (c.get((uf, a, "6731", "162", "46286")) or 0), tot)
            # 4. esgoto: rede/pluvial + fossa ligada (comparável 2016-2025)
            if a in ("2016", "2017", "2018"):
                v = c.get((uf, a, "6735", "9986", "46290"))
                cvv = c.get((uf, a, "6735", "9987", "46290"))
                tab = "6735"
            else:
                r_ = c.get((uf, a, "7192", "9986", "47930"))
                f_ = c.get((uf, a, "7192", "9986", "47931"))
                v = None if (r_ is None or f_ is None) else r_ + f_
                cvv = None
                tab = "7192"
            if v is not None and tot:
                linhas["esgoto_rede_fossaligada"].append(dict(
                    uf=uf, ano=a, valor=arred(pct(v, tot), 1), unidade="% dos domicílios",
                    fonte=f"IBGE, PNAD Contínua anual (SIDRA {tab})", tabela_sidra=tab,
                    cv_contagem_pct=cvv, quebra_questionario_2019="2016-2018: tabela 6735; 2019+: tabela 7192"))
                soma_al("esgoto_rede_fossaligada", a, v, tot)
            # 5. esgoto adequado, definição da ficha (2019+): + fossa séptica não ligada
            if a not in ("2016", "2017", "2018"):
                r_ = c.get((uf, a, "7192", "9986", "47930"))
                f_ = c.get((uf, a, "7192", "9986", "47931"))
                s_ = c.get((uf, a, "7192", "9986", "47936"))
                if None not in (r_, f_, s_) and tot:
                    linhas["esgoto_adequado"].append(dict(
                        uf=uf, ano=a, valor=arred(pct(r_ + f_ + s_, tot), 1), unidade="% dos domicílios",
                        fonte="IBGE, PNAD Contínua anual (SIDRA 7192)",
                        pct_rede_ou_pluvial=arred(pct(r_, tot), 1), pct_fossa_septica_ligada=arred(pct(f_, tot), 1),
                        pct_fossa_septica_nao_ligada=arred(pct(s_, tot), 1),
                        cv_septica_nao_ligada_pct=c.get((uf, a, "7192", "9987", "47936"))))
                    soma_al("esgoto_adequado", a, r_ + f_ + s_, tot)
    # linhas AL
    for (serie, a), (s, t, ok) in sorted(al.items()):
        if ok and t:
            linhas[serie].append(dict(uf="AL", ano=a, valor=arred(s / t * 100, 1), unidade="% dos domicílios",
                                      fonte="soma das 9 UFs (domicílios) / total de domicílios das 9 UFs"))
    return linhas


# ----------------------------------------------------------------------------- 2. PNAD 2001-2015
def pnad_antiga():
    """PNAD 1992-2015 (SIDRA 1955 água, 1956 esgoto): outra pesquisa, NÃO emendar com a Contínua.

    Contagens em mil domicílios (inteiro). Até 2003 a PNAD não cobria a área rural de RO, AC, AM,
    RR, PA e AP (só urbano); a partir de 2004 cobre. 2010 não existe (ano de censo).
    Água: classificação 61 não separa poço profundo; 'rede geral' = com rede geral (1033 com
    canalização interna + 1035 sem). Esgoto: 99663 rede coletora; fossa séptica 99664 (2001-2008)
    ou 9490 ligada + 9491 não ligada (2009-2015, quando o IBGE passou a separá-las).
    """
    print("2. PNAD 2001-2015 (SIDRA 1955, 1956)")
    t1955 = sidra(f"/t/1955/n3/{UF_LISTA}/v/96/p/all/c12058/0/c1/0/c61/0,1033,1035")
    t1956 = sidra(f"/t/1956/n3/{UF_LISTA}/v/96/p/all/c12058/0/c1/0/c7173/0,99663,99664,9490,9491")
    salva_bruto("pnad_1955.csv", t1955)
    salva_bruto("pnad_1956.csv", t1956)
    a_ = {}
    for x in t1955:
        a_[(UF_COD[x["D1C"]], x["D3C"], x["D6C"])] = num(x["V"])
    e_ = {}
    for x in t1956:
        e_[(UF_COD[x["D1C"]], x["D3C"], x["D6C"])] = num(x["V"])
    anos = sorted({k[1] for k in a_})
    urbano_ate_2003 = {"RO", "AC", "AM", "RR", "PA", "AP"}
    saida = {"agua_rede_geral": [], "esgoto_rede_fossaseptica": [], "esgoto_rede_fossaligada": [],
             "esgoto_rede_coletora": []}
    al = {}
    for uf in UFS:
        for a in anos:
            cob = "so_urbano" if (uf in urbano_ate_2003 and int(a) <= 2003) else "completa"
            tot = a_.get((uf, a, "0"))
            base = dict(uf=uf, ano=a, unidade="% dos domicílios", cobertura=cob,
                        domicilios_mil=tot, precisao="contagens em mil domicílios (inteiros)")
            r1, r2 = a_.get((uf, a, "1033")), a_.get((uf, a, "1035"))
            if tot and r1 is not None and r2 is not None:
                v = (r1 + r2) / tot * 100
                saida["agua_rede_geral"].append(dict(base, valor=arred(v, 1),
                                                     fonte="IBGE, PNAD (SIDRA 1955)"))
                al.setdefault(("agua_rede_geral", a), [0, 0, cob == "completa"])
                al[("agua_rede_geral", a)][0] += r1 + r2
                al[("agua_rede_geral", a)][1] += tot
                al[("agua_rede_geral", a)][2] &= cob == "completa"
            et = e_.get((uf, a, "0"))
            rede = e_.get((uf, a, "99663"))
            if et and rede is not None:
                saida["esgoto_rede_coletora"].append(dict(base, valor=arred(rede / et * 100, 1),
                                                          fonte="IBGE, PNAD (SIDRA 1956)"))
                k = ("esgoto_rede_coletora", a)
                al.setdefault(k, [0, 0, True])
                al[k][0] += rede
                al[k][1] += et
                al[k][2] &= cob == "completa"
                if int(a) <= 2008:
                    sept = e_.get((uf, a, "99664"))
                    lig = None
                else:
                    lg, nl = e_.get((uf, a, "9490")), e_.get((uf, a, "9491"))
                    sept = None if (lg is None or nl is None) else lg + nl
                    lig = lg
                if sept is not None:
                    saida["esgoto_rede_fossaseptica"].append(dict(
                        base, valor=arred((rede + sept) / et * 100, 1), fonte="IBGE, PNAD (SIDRA 1956)"))
                    k = ("esgoto_rede_fossaseptica", a)
                    al.setdefault(k, [0, 0, True])
                    al[k][0] += rede + sept
                    al[k][1] += et
                    al[k][2] &= cob == "completa"
                if lig is not None:
                    saida["esgoto_rede_fossaligada"].append(dict(
                        base, valor=arred((rede + lig) / et * 100, 1), fonte="IBGE, PNAD (SIDRA 1956)"))
                    k = ("esgoto_rede_fossaligada", a)
                    al.setdefault(k, [0, 0, True])
                    al[k][0] += rede + lig
                    al[k][1] += et
    for (serie, a), (s, t, completa) in sorted(al.items()):
        if t:
            saida[serie].append(dict(uf="AL", ano=a, valor=arred(s / t * 100, 1), unidade="% dos domicílios",
                                     cobertura="completa" if completa else "so_urbano_em_6_UFs",
                                     fonte="soma das 9 UFs / total de domicílios das 9 UFs"))
    return saida


# ----------------------------------------------------------------------------- 3. Censos (linha de base dos testes)
def censos_referencia():
    """% por UF nos Censos 2010 e 2022, direto da SIDRA, para comparar com as pesquisas por amostra."""
    print("3. Censos de referência (SIDRA 6803, 6805, 3218, 1394)")
    ref = {}

    def tabela(path, parser):
        rows = sidra(path)
        return parser(rows)

    # 2022 água (6803): total 72129; 72144 rede e usa; 72145 rede e usa outra; 72154 poço profundo
    t = {}
    for x in sidra(f"/t/6803/n3/{UF_LISTA}/v/381/p/2022/c1821/72129,72144,72145,72154"):
        t.setdefault(UF_COD[x["D1C"]], {})[x["D4C"]] = num(x["V"])
    for uf, d in t.items():
        tot = d["72129"]
        ref[("agua_rede_principal", uf, "2022")] = d["72144"] / tot * 100
        ref[("agua_adequada_isgr", uf, "2022")] = (d["72144"] + d["72145"] + d["72154"]) / tot * 100
        ref[("agua_ligacao", uf, "2022")] = (d["72144"] + d["72145"]) / tot * 100
        ref[("agua_poco_profundo_sem_ligacao", uf, "2022")] = d["72154"] / tot * 100
    e = {}
    for x in sidra(f"/t/6805/n3/{UF_LISTA}/v/381/p/2022/c11558/46292,46290,72112"):
        e.setdefault(UF_COD[x["D1C"]], {})[x["D4C"]] = num(x["V"])
    for uf, d in e.items():
        tot = d["46292"]
        ref[("esgoto_rede_fossaligada", uf, "2022")] = d["46290"] / tot * 100
        ref[("esgoto_adequado_isgr", uf, "2022")] = (d["46290"] + d["72112"]) / tot * 100
    # 2010: água (3218, cat 92853 rede geral) e esgoto (1394, 92855 rede + 92856 fossa séptica)
    t = {}
    for x in sidra(f"/t/3218/n3/{UF_LISTA}/v/96/p/2010/c61/0,92853"):
        t.setdefault(UF_COD[x["D1C"]], {})[x["D4C"]] = num(x["V"])
    for uf, d in t.items():
        ref[("agua_rede_geral", uf, "2010")] = d["92853"] / d["0"] * 100
    t = {}
    for x in sidra(f"/t/1394/n3/{UF_LISTA}/v/96/p/2010/c11558/0,92855,92856"):
        t.setdefault(UF_COD[x["D1C"]], {})[x["D4C"]] = num(x["V"])
    for uf, d in t.items():
        ref[("esgoto_rede_fossaseptica", uf, "2010")] = (d["92855"] + d["92856"]) / d["0"] * 100
        ref[("esgoto_rede_coletora", uf, "2010")] = d["92855"] / d["0"] * 100
    return ref


# ----------------------------------------------------------------------------- 4. SNIS / SINISA
BD_SNIS = ("https://storage.googleapis.com/basedosdados-public/one-click-download/"
           "br_mdr_snis/municipio_agua_esgoto/municipio_agua_esgoto.csv.gz")
GOV = "https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/"
SNIS_ZIPS_OFICIAIS = {   # planilhas oficiais do Diagnóstico SNIS (resumo por UF), usadas para validar o espelho
    2020: GOV + "snis/produtos-do-snis/diagnosticos/Planilhas_AE2020.zip",
    2021: GOV + "snis/produtos-do-snis/diagnosticos/Planilhas_AE2021.zip",
    2022: GOV + "snis/produtos-do-snis/diagnosticos/diagnostico_tematico_visao_geral_ae_snis_2023_atualizado2.zip",
}
SINISA_ZIPS = {          # (ano de referência, módulo) -> (zip, arquivo de indicadores por UF dentro do zip)
    (2023, "agua"): (GOV + "sinisa/arquivos/SINISA_Resultados_Ref2023.zip",
                     "SINISA_Resultados_Ref2023/Água - UF Macrorregiao Brasil/SINISA_AGUA_Indicadores_UF_Macrorregiao_Brasil_2023.xlsx"),
    (2023, "esgoto"): (GOV + "sinisa/resultados-sinisa/SINISA_ESGOTO_Planilhas_2023_v2.zip",
                       "Esgoto - Consolidado UF-MR-BR/SINISA_ESGOTO_Indicadores_UF_Macrorregiao_Brasil_2023_V2.xlsx"),
    (2024, "agua"): (GOV + "sinisa/resultados-sinisa/SINISA_Resultados_Ref2024.zip",
                     "SINISA_Resultados_Ref2024/Água - Consolidado UF_MR_BR/SINISA_AGUA_Indicadores_UF_MR_BR_2024.xlsx"),
    (2024, "esgoto"): (GOV + "sinisa/resultados-sinisa/SINISA_ESGOTO_Planilhas_2024.zip",
                       "Esgoto - Consolidado UF_MR_BR/SINISA_ESGOTO_Indicadores_UF_MR_BR_2024.xlsx"),
}
HEADERS_GOV = dict(HEADERS, Referer=GOV + "snis/produtos-do-snis/diagnosticos-snis")


def baixa_arquivo(url, nome, headers=None):
    """Baixa para bruto/<nome> se ainda não existir; devolve o caminho."""
    caminho = os.path.join(BRUTO, nome)
    if not os.path.exists(caminho) or os.path.getsize(caminho) == 0:
        r = http_get(url, timeout=900, headers=headers or HEADERS_GOV)
        with open(caminho, "wb") as f:
            f.write(r.content)
    return caminho


def populacao_uf():
    """População residente por UF e ano (IBGE): estimativas 6579, Censo 2010 (202), Censo 2022 (4709).
    2007 e 2023 não existem nessas tabelas: interpolação linear (marcada)."""
    pop, interp = {}, set()
    for x in sidra(f"/t/6579/n3/{UF_LISTA}/v/9324/p/all"):
        pop[(UF_COD[x["D1C"]], int(x["D3C"]))] = num(x["V"])
    for x in sidra(f"/t/202/n3/{UF_LISTA}/v/93/p/2010/c1/0/c2/0"):
        pop[(UF_COD[x["D1C"]], 2010)] = num(x["V"])
    for x in sidra(f"/t/4709/n3/{UF_LISTA}/v/93/p/2022"):
        pop[(UF_COD[x["D1C"]], 2022)] = num(x["V"])
    for uf in UFS:
        for ano, (a0, a1) in {2007: (2006, 2008), 2023: (2022, 2024)}.items():
            if (uf, a0) in pop and (uf, a1) in pop:
                pop[(uf, ano)] = (pop[(uf, a0)] + pop[(uf, a1)]) / 2
                interp.add(ano)
    return pop, interp


_MUN_AL = {}


def municipios_al():
    """808 municípios da Amazônia Legal (universo do Censo 2022, SIDRA 4709): código -> UF."""
    if not _MUN_AL:
        for x in sidra(f"/t/4709/n6/in%20n3%20{UF_LISTA}/v/93/p/2022"):
            m = re.search(r" - ([A-Z]{2})$", x["D1N"])
            if m:
                _MUN_AL[x["D1C"]] = m.group(1)
    return _MUN_AL


def n_municipios_uf():
    cont = {}
    for uf in municipios_al().values():
        cont[uf] = cont.get(uf, 0) + 1
    return cont


def snis_espelho(ref):
    """SNIS 2001-2022 por UF, a partir da base municipal consolidada do SNIS espelhada pela Base dos Dados.

    O arquivo oficial por município do SNIS não tem download direto estável (a Série Histórica é um app Yii
    que responde 500 a GET puro). A Base dos Dados publica a base municipal tratada (1995-2022). A conferência
    com as planilhas oficiais do Diagnóstico por UF (2020-2022) está em snis_conferencia_oficial.csv.

    Cálculo, no estilo oficial do SNIS por UF:
      IN055 = sum(AG001) / sum(G12A)   com G12A = AG001 / (IN055_mun/100), sobre os municípios com IN055;
      IN056 = sum(ES001) / sum(G12A)   (denominador: população dos municípios atendidos com água).
    Coluna extra: valor_pop_uf_total = sum(AG001 ou ES001) / população IBGE da UF (todos os municípios, os que não
    responderam entram com zero) — limite inferior, que mistura a expansão do serviço com a adesão ao SNIS.
    """
    import pandas as pd
    print("4a. SNIS 2001-2022 (espelho Base dos Dados)")
    caminho = baixa_arquivo(BD_SNIS, "bd_snis_municipio_agua_esgoto.csv.gz", headers=HEADERS)
    df = pd.read_csv(caminho, compression="gzip", low_memory=False)
    df = df[df["sigla_uf"].isin(UFS)]
    pop, interp = populacao_uf()
    nmun = n_municipios_uf()
    agua, esgoto = [], []
    for ano in range(2001, 2023):
        for uf in UFS + ["AL"]:
            x = df[(df["ano"] == ano) & (df["sigla_uf"].isin(UFS if uf == "AL" else [uf]))]
            a = x.dropna(subset=["populacao_atendida_agua", "indice_atendimento_total_agua"])
            a = a[a["indice_atendimento_total_agua"] > 0]
            pop_snis = (a["populacao_atendida_agua"] / (a["indice_atendimento_total_agua"] / 100)).sum()
            ag001 = a["populacao_atendida_agua"].sum()
            es001 = x["populacao_atentida_esgoto"].fillna(0).sum()
            n_es = int((x["populacao_atentida_esgoto"].fillna(0) > 0).sum())
            pop_ibge = (sum(pop[(u, ano)] for u in UFS) if uf == "AL" else pop.get((uf, ano)))
            nm_uf = sum(nmun.values()) if uf == "AL" else nmun.get(uf)
            if not pop_snis:
                continue
            comum = dict(uf=uf, ano=ano, unidade="% da população", n_municipios_uf=nm_uf,
                         n_municipios_com_agua=len(a), n_municipios_com_esgoto=n_es,
                         pop_snis_g12a=round(pop_snis), pop_uf_ibge=round(pop_ibge) if pop_ibge else None,
                         cobertura_pop_snis_pct=arred(pop_snis / pop_ibge * 100, 1) if pop_ibge else None,
                         pop_ibge_interpolada="sim" if ano in interp else "nao")
            agua.append(dict(comum, valor=arred(ag001 / pop_snis * 100, 2),
                             fonte="SNIS-AE (IN055), base municipal via Base dos Dados",
                             valor_pop_uf_total=arred(ag001 / pop_ibge * 100, 2) if pop_ibge else None))
            esgoto.append(dict(comum, valor=arred(es001 / pop_snis * 100, 2),
                               fonte="SNIS-AE (IN056), base municipal via Base dos Dados",
                               valor_pop_uf_total=arred(es001 / pop_ibge * 100, 2) if pop_ibge else None))
    cols = ["uf", "ano", "valor", "unidade", "fonte", "valor_pop_uf_total", "n_municipios_uf", "n_municipios_com_agua",
            "n_municipios_com_esgoto", "pop_snis_g12a", "pop_uf_ibge", "cobertura_pop_snis_pct", "pop_ibge_interpolada"]
    grava("snis_agua_atendimento_total_2001_2022.csv", agua, cols)
    grava("snis_esgoto_atendimento_total_2001_2022.csv", esgoto, cols)
    return agua, esgoto


def _linha_codigos(rows, prefixos):
    for i, r in enumerate(rows):
        if any(isinstance(c, str) and c.strip().startswith(prefixos) for c in r):
            return i
    return None


def snis_oficial_validacao(agua, esgoto):
    """IN055/IN056 por UF nas planilhas oficiais do Diagnóstico SNIS (2020, 2021, 2022) x espelho."""
    import openpyxl
    print("4b. SNIS oficial por UF (2020-2022) x espelho")
    nomes = {"Acre": "AC", "Amapá": "AP", "Amazonas": "AM", "Maranhão": "MA", "Mato Grosso": "MT", "Pará": "PA",
             "Rondônia": "RO", "Roraima": "RR", "Tocantins": "TO"}
    oficial = []
    for ano, url in SNIS_ZIPS_OFICIAIS.items():
        caminho = baixa_arquivo(url, os.path.basename(url))
        z = zipfile.ZipFile(caminho)
        if any("Resumo_Estado" in n for n in z.namelist()):
            resumo = [n for n in z.namelist() if "Resumo_Estado" in n][0]
        else:
            resumo = [n for n in z.namelist() if "Resumo_Estado" in n or "Planilha_Resumo_Estado" in n][0]
        z2 = zipfile.ZipFile(io.BytesIO(z.read(resumo)))
        arq = [n for n in z2.namelist() if "Indicadores" in n and n.lower().endswith(("xlsx", "xls"))][0]
        if arq.lower().endswith(".xls"):          # 2020 e 2021 vêm em .xls (precisa de xlrd)
            import xlrd
            sh = xlrd.open_workbook(file_contents=z2.read(arq)).sheet_by_index(0)
            rows = [tuple(sh.row_values(i)) for i in range(sh.nrows)]
        else:
            wb = openpyxl.load_workbook(io.BytesIO(z2.read(arq)), read_only=True, data_only=True)
            rows = list(wb.worksheets[0].iter_rows(values_only=True))
        h = _linha_codigos(rows, ("IN055",))
        c55 = [j for j, c in enumerate(rows[h]) if isinstance(c, str) and c.strip().startswith("IN055")][0]
        c56 = [j for j, c in enumerate(rows[h]) if isinstance(c, str) and c.strip().startswith("IN056")][0]
        for r in rows[h + 1:]:
            if r[0] in nomes:
                oficial.append(dict(uf=nomes[r[0]], ano=ano, in055_oficial=num(r[c55]), in056_oficial=num(r[c56]),
                                    fonte=f"SNIS-AE {ano}, Planilha_Resumo_Indicadores_Estado ({os.path.basename(url)})"))
    mir = {(l["uf"], l["ano"]): l for l in agua}
    mie = {(l["uf"], l["ano"]): l for l in esgoto}
    for o in oficial:
        k = (o["uf"], o["ano"])
        o["in055_espelho"] = mir[k]["valor"] if k in mir else None
        o["in056_espelho"] = mie[k]["valor"] if k in mie else None
        o["dif055_pp"] = arred(o["in055_espelho"] - o["in055_oficial"], 2) if o["in055_espelho"] is not None and o["in055_oficial"] is not None else None
        o["dif056_pp"] = arred(o["in056_espelho"] - o["in056_oficial"], 2) if o["in056_espelho"] is not None and o["in056_oficial"] is not None else None
    grava("snis_conferencia_oficial.csv", oficial, ["uf", "ano", "in055_oficial", "in055_espelho", "dif055_pp",
                                                    "in056_oficial", "in056_espelho", "dif056_pp", "fonte"])
    for ano in sorted(SNIS_ZIPS_OFICIAIS):
        d = [o for o in oficial if o["ano"] == ano]
        i55 = sum(1 for o in d if o["dif055_pp"] is not None and abs(o["dif055_pp"]) < 0.05)
        i56 = sum(1 for o in d if o["dif056_pp"] is not None and abs(o["dif056_pp"]) < 0.05)
        m55 = max((abs(o["dif055_pp"]) for o in d if o["dif055_pp"] is not None), default=None)
        print(f"  {ano}: IN055 idêntico em {i55}/{len(d)} UFs (maior |dif| {m55} pp); IN056 idêntico em {i56}/{len(d)}")
    return oficial


def sinisa(ref):
    """SINISA (sucessor do SNIS): consolidado por UF, ano de referência 2023 e 2024."""
    import openpyxl
    print("4c. SINISA 2023-2024 por UF")
    saida = {"agua": [], "esgoto": []}
    for (ano, modulo), (url, membro) in SINISA_ZIPS.items():
        caminho = baixa_arquivo(url, os.path.basename(url))
        z = zipfile.ZipFile(caminho)
        wb = openpyxl.load_workbook(io.BytesIO(z.read(membro)), read_only=True, data_only=True)
        alvo = ("IAG0001", "IAG0004") if modulo == "agua" else ("IES0001", "IES0004", "IES0007")
        achou = False
        for ws in wb.worksheets:
            rows = list(ws.iter_rows(values_only=True))
            h = _linha_codigos(rows, alvo[:1])
            if h is None:
                continue
            achou = True
            cod = {str(c).strip(): j for j, c in enumerate(rows[h])
                   if isinstance(c, str) and re.match(r"I[AE][GS]\d{4}", c.strip())}
            for r in rows[h + 1:]:
                sig = str(r[1]).strip() if r[1] is not None else ""
                if sig in UFS:
                    d = dict(uf=sig, ano=ano, unidade="%",
                             fonte=f"SINISA ref. {ano}, consolidado UF ({os.path.basename(url)})")
                    d["valor"] = arred(num(r[cod[alvo[0]]]), 2)
                    d["valor_domicilios"] = arred(num(r[cod[alvo[1]]]), 2)
                    if modulo == "esgoto" and "IES0007" in cod:
                        d["valor_domicilios_coleta_e_tratamento"] = arred(num(r[cod["IES0007"]]), 2)
                    d["indicador_valor"] = alvo[0]
                    d["indicador_valor_domicilios"] = alvo[1]
                    saida[modulo].append(d)
            break
        if not achou:
            print("  AVISO: não achei", alvo, "em", membro)
    base = ["uf", "ano", "valor", "valor_domicilios", "unidade", "fonte", "indicador_valor", "indicador_valor_domicilios"]
    grava("sinisa_agua_atendimento_2023_2024.csv", saida["agua"], base)
    grava("sinisa_esgoto_atendimento_2023_2024.csv", saida["esgoto"], base + ["valor_domicilios_coleta_e_tratamento"])
    return saida


def sinisa_snis(ref):
    agua, esgoto = snis_espelho(ref)
    try:
        snis_oficial_validacao(agua, esgoto)
    except Exception as e:  # noqa: BLE001
        print("  FALHOU validação oficial do SNIS:", repr(e)[:300])
    sin = sinisa(ref)
    testes = []

    def par(serie, linhas, chave_ref, ano_p, ano_c, campo="valor"):
        for l in linhas:
            if (l["uf"] in UFS and int(l["ano"]) == ano_p and (chave_ref, l["uf"], str(ano_c)) in ref
                    and l.get(campo) is not None):
                v = ref[(chave_ref, l["uf"], str(ano_c))]
                testes.append(dict(serie=serie, referencia=f"Censo {ano_c}: {chave_ref}", uf=l["uf"],
                                   ano_pesquisa=ano_p, valor_pesquisa=l[campo], valor_censo=arred(v, 1),
                                   diferenca_pp=arred(float(l[campo]) - v, 1)))
    par("snis_agua_atendimento_total_2001_2022", agua, "agua_ligacao", 2022, 2022)
    par("snis_agua_atendimento_total_2001_2022", agua, "agua_rede_geral", 2010, 2010)
    par("snis_esgoto_atendimento_total_2001_2022", esgoto, "esgoto_rede_coletora", 2010, 2010)
    par("snis_esgoto_atendimento_total_2001_2022", esgoto, "esgoto_rede_fossaligada", 2022, 2022)
    par("sinisa_agua_atendimento_2023_2024", sin["agua"], "agua_ligacao", 2023, 2022, campo="valor_domicilios")
    par("sinisa_esgoto_atendimento_2023_2024", sin["esgoto"], "esgoto_rede_fossaligada", 2023, 2022, campo="valor_domicilios")
    if testes:
        grava("testes_linha_base_snis_x_censo.csv", testes,
              ["serie", "referencia", "uf", "ano_pesquisa", "valor_pesquisa", "valor_censo", "diferenca_pp"])
        resumo = {}
        for t in testes:
            resumo.setdefault((t["serie"], t["referencia"], t["ano_pesquisa"]), []).append(t["diferenca_pp"])
        print("Resumo dos testes SNIS/SINISA x Censo (pp):")
        for (s, r, a), d in resumo.items():
            print(f"  {s} [{a}] vs {r}: média abs {sum(abs(x) for x in d)/len(d):.1f} | viés {sum(d)/len(d):+.1f} | n={len(d)}")


# ----------------------------------------------------------------------------- 5. MUNIC (fatores FClima e FGov em edições anteriores)
MUNIC_FTP = "https://ftp.ibge.gov.br/Perfil_Municipios/"
MUNIC_2024 = os.path.join(RAIZ, "dados", "ibge_munic", "Base_MUNIC_2024_20251107.xlsx")

# Matriz de equivalência verificada nos dicionários das bases (texto literal de cada edição).
# (edicao, variavel_isgr) -> (arquivo, aba, coluna, enunciado literal na edição)
MUNIC_VARS = {
    (2014, "Mgov086"): ("2014/base_MUNIC_xls_2014.zip", "Comunicação", "A150",
                        "Possui na página na internet: Dados gerais para o acompanhamento de programas, ações, projetos e obras de órgãos e entidades"),
    (2017, "Mhab088"): ("2017/Base_de_Dados/Base_MUNIC_2017_xls.zip", "Habitação", "MHAB088",
                        "Aspectos do Plano Municipal de Habitação: Priorizar ações nas áreas de risco"),
    (2017, "Magr18"): ("2017/Base_de_Dados/Base_MUNIC_2017_xls.zip", "Agropecuária", "MAGR21",
                       "A prefeitura desenvolve programa ou ação de prevenção contra problemas climáticos para o setor agropecuário"),
    (2019, "Mtic266"): ("2019/Base_de_Dados/Base_MUNIC_2019_20210817.xlsx", "Comunicção e informática", "MTIC266",
                        "Existência de sistemas digitais no dia-a-dia da população: Sensores para monitoramento de área de risco"),
    (2019, "Mgov086"): ("2019/Base_de_Dados/Base_MUNIC_2019_20210817.xlsx", "Governança", "MGOV086",
                        "Conteúdo da página na internet e/ou portal da transparência: Dados gerais para acompanhamento de programas"),
    (2020, "Mhab088"): ("2020/Base_de_Dados/Base_MUNIC_2020.xlsx", "Habitação", "MHAB088",
                        "Aspectos do Plano Municipal de Habitação: Priorizar ações nas áreas de risco"),
    (2020, "Magr18"): ("2020/Base_de_Dados/Base_MUNIC_2020.xlsx", "Agropecuário", "MAGR18",
                       "A prefeitura desenvolve programa ou ação de prevenção contra problemas climáticos para o setor agropecuário"),
    (2024, "Mhab088"): (None, "Habitacao", "Mhab088",
                        "Aspectos do plano: Priorização de ações nas áreas de risco"),
    (2024, "Magr18"): (None, "Agropecuária", "Magr18",
                       "A prefeitura desenvolve programa ou ação de prevenção contra problemas climáticos para o setor agropecuário"),
    (2024, "Mtic266"): (None, "Informática e comunicação", "Mtic266",
                        "Existência de sistemas digitais no dia-a-dia da população: Sensores para monitoramento de áreas com risco de enchentes, alagamentos ou outros desastres naturais"),
    (2024, "Mgov086"): (None, "Governanca", "Mgov086",
                        "Conteúdo da página na internet e/ou portal da transparência: Dados gerais para acompanhamento de programas, ações, projetos e obras de órgãos e entidades"),
}


def _cod7(v):
    try:
        return str(int(float(v))).zfill(7)
    except (TypeError, ValueError):
        return str(v).strip()


def _le_coluna(arquivo, aba, coluna):
    """Lê (codigo_municipio -> valor) de uma aba/coluna de uma base MUNIC (.xls, .xlsx ou zip com .xls)."""
    import openpyxl
    out = {}
    if arquivo.lower().endswith(".zip"):
        z = zipfile.ZipFile(arquivo)
        membro = z.namelist()[0]
        import xlrd
        wb = xlrd.open_workbook(file_contents=z.read(membro), on_demand=True)
        sh = wb.sheet_by_name(aba)
        cab = [str(c).strip() for c in sh.row_values(0)]
        j = [k for k, c in enumerate(cab) if c.lower() == coluna.lower()][0]
        for i in range(1, sh.nrows):
            out[_cod7(sh.cell_value(i, 0))] = str(sh.cell_value(i, j)).strip()
        return out
    wb = openpyxl.load_workbook(arquivo, read_only=True)
    ws = wb[aba]
    it = ws.iter_rows(values_only=True)
    cab = [str(c).strip() if c is not None else "" for c in next(it)]
    j = [k for k, c in enumerate(cab) if c.lower() == coluna.lower()][0]
    for r in it:
        if r[0] is not None:
            out[_cod7(r[0])] = str(r[j]).strip() if r[j] is not None else ""
    wb.close()
    return out


def _censo_2022_municipal():
    """min(água adequada, esgoto adequado) por município (pesos fixos do Censo 2022) e domicílios totais."""
    agua, esg = {}, {}
    for x in sidra(f"/t/6803/n6/in%20n3%20{UF_LISTA}/v/381/p/2022/c1821/72129,72144,72145,72154"):
        agua.setdefault(x["D1C"], {})[x["D4C"]] = num(x["V"]) or 0.0
    for x in sidra(f"/t/6805/n6/in%20n3%20{UF_LISTA}/v/381/p/2022/c11558/46292,46290,72112"):
        esg.setdefault(x["D1C"], {})[x["D4C"]] = num(x["V"]) or 0.0
    out = {}
    for cod, a in agua.items():
        e = esg.get(cod, {})
        aa = a.get("72144", 0) + a.get("72145", 0) + a.get("72154", 0)
        ee = e.get("46290", 0) + e.get("72112", 0)
        out[cod] = dict(dom=a.get("72129", 0), minimo=min(aa, ee))
    return out


def munic(ref):
    """Fatores FClima e FGov em edições anteriores da MUNIC: equivalência e valores por UF.

    Equivalência (texto literal nos dicionários, ver MUNIC_VARS):
      Mgov086  : 2014 (A150), 2019, 2024  -> mesmo item, mesma lista 'conteúdo da página/portal da transparência'.
      Magr18   : 2017 (MAGR21), 2020, 2024 -> texto idêntico.
      Mhab088  : 2017, 2020, 2024          -> mesmo item do 'Plano Municipal de Habitação' (condicionado a MHAB07).
      Mtic266  : 2019 e 2024               -> 2019 'área de risco' genérica; 2024 especifica enchentes/alagamentos/desastres.
    Nenhuma edição anterior tem as quatro variáveis juntas: FGov (1 variável) tem 3 edições; FClima só pode ser
    reconstruído com 2 das 3 variáveis (Magr18 + Mhab088) em 2017, 2020 e 2024.
    """
    print("5. MUNIC: variáveis dos fatores por edição")
    # municípios da AL (código -> UF), pelo SIDRA 4709 (Censo 2022: 808 municípios)
    cod_uf = dict(municipios_al())
    peso = _censo_2022_municipal()
    dados = {}   # (ano, var) -> {cod: valor}
    for (ano, var), (rel, aba, col, enunc) in MUNIC_VARS.items():
        try:
            if rel is None:
                caminho = MUNIC_2024
                if not os.path.exists(caminho):
                    caminho = baixa_arquivo(MUNIC_FTP + "2024/Base_de_Dados/Base_MUNIC_2024_20251107.xlsx",
                                            "Base_MUNIC_2024_20251107.xlsx", headers=HEADERS)
            else:
                caminho = baixa_arquivo(MUNIC_FTP + rel, os.path.basename(rel), headers=HEADERS)
            dados[(ano, var)] = _le_coluna(caminho, aba, col)
        except Exception as e:  # noqa: BLE001
            print(f"  FALHOU {ano} {var}:", repr(e)[:200])

    def sim(ano, var, cod):
        return dados.get((ano, var), {}).get(cod, "").strip().lower() == "sim"

    # ---- variável a variável, por UF
    linhas_var = []
    for (ano, var), d in sorted(dados.items()):
        enunc = MUNIC_VARS[(ano, var)][3]
        for uf in UFS + ["AL"]:
            cods = [c for c, u in cod_uf.items() if uf == "AL" or u == uf]
            vals = [d.get(c, "").strip() for c in cods]
            n_sim = sum(v.lower() == "sim" for v in vals)
            n_nao = sum(v.lower() in ("não", "nao") for v in vals)
            n_na = sum(v == "-" for v in vals)
            linhas_var.append(dict(
                uf=uf, ano=ano, variavel_isgr=var, codigo_na_edicao=MUNIC_VARS[(ano, var)][2], enunciado=enunc,
                n_municipios=len(cods), n_sim=n_sim, n_nao=n_nao, n_nao_aplicavel=n_na,
                n_recusa_ou_branco=len(cods) - n_sim - n_nao - n_na,
                valor=arred(n_sim / len(cods) * 100, 1) if cods else None, unidade="% dos municípios com 'Sim'",
                fonte=f"IBGE, MUNIC {ano}"))
    cols_var = ["uf", "ano", "variavel_isgr", "codigo_na_edicao", "enunciado", "valor", "unidade", "n_municipios",
                "n_sim", "n_nao", "n_nao_aplicavel", "n_recusa_ou_branco", "fonte"]
    for var in ("Magr18", "Mhab088", "Mtic266", "Mgov086"):   # um CSV por variável (= uma série cada)
        grava(f"munic_var_{var.lower()}_uf.csv", [l for l in linhas_var if l["variavel_isgr"] == var], cols_var)

    # ---- fatores por município e edição, ponderados pelo peso fixo do Censo 2022
    def fator_clima(ano, vars_):
        return {c: (1.0 if any(sim(ano, v, c) for v in vars_) else 0.9) for c in cod_uf}

    def fator_gov(ano):
        return {c: (1.0 if sim(ano, "Mgov086", c) else 0.95) for c in cod_uf}

    series = []   # (nome, ano, {cod: fator})
    for ano in (2017, 2020, 2024):
        if all((ano, v) in dados for v in ("Magr18", "Mhab088")):
            series.append(("fclima_2_variaveis", ano, fator_clima(ano, ("Magr18", "Mhab088"))))
    if all((2024, v) in dados for v in ("Magr18", "Mhab088", "Mtic266")):
        series.append(("fclima_3_variaveis_ficha", 2024, fator_clima(2024, ("Magr18", "Mhab088", "Mtic266"))))
    for ano in (2014, 2019, 2024):
        if (ano, "Mgov086") in dados:
            series.append(("fgov", ano, fator_gov(ano)))
    linhas_f = []
    for nome, ano, f in series:
        for uf in UFS + ["AL"]:
            cods = [c for c, u in cod_uf.items() if (uf == "AL" or u == uf) and c in peso]
            w = sum(peso[c]["minimo"] for c in cods)
            media_pond = sum(f[c] * peso[c]["minimo"] for c in cods) / w if w else None
            media_simples = sum(f[c] for c in cods) / len(cods) if cods else None
            linhas_f.append(dict(
                uf=uf, ano=ano, fator=nome, valor=arred(media_pond, 4), valor_media_simples=arred(media_simples, 4),
                pct_municipios_sem_penalidade=arred(sum(f[c] == 1.0 for c in cods) / len(cods) * 100, 1),
                n_municipios=len(cods), unidade="fator (0,9 a 1 para FClima; 0,95 a 1 para FGov)",
                ponderacao="min(água adequada, esgoto adequado) por município, Censo 2022 (peso fixo)",
                fonte=f"IBGE, MUNIC {ano} + Censo 2022"))
    cols_f = ["uf", "ano", "fator", "valor", "valor_media_simples", "pct_municipios_sem_penalidade", "n_municipios",
              "unidade", "ponderacao", "fonte"]
    grava("munic_fgov_uf.csv", [l for l in linhas_f if l["fator"] == "fgov"], cols_f)
    # FClima com 2 das 3 variáveis; nas linhas de 2024 traz o valor com as 3 variáveis da ficha e o viés da versão de 2
    f3 = {(l["uf"]): l for l in linhas_f if l["fator"] == "fclima_3_variaveis_ficha"}
    f2 = []
    for l in linhas_f:
        if l["fator"] == "fclima_2_variaveis":
            l = dict(l)
            if l["ano"] == 2024 and l["uf"] in f3:
                l["valor_3_variaveis_ficha"] = f3[l["uf"]]["valor"]
                l["vies_2_menos_3_variaveis"] = arred(l["valor"] - f3[l["uf"]]["valor"], 4)
            f2.append(l)
    grava("munic_fclima_2variaveis_uf.csv", f2, cols_f + ["valor_3_variaveis_ficha", "vies_2_menos_3_variaveis"])
    if ("fclima_2_variaveis", 2024) in {(n, a) for n, a, _ in series} and f3:
        d2 = dict(((n, a), f) for n, a, f in series)
        a2, a3 = d2[("fclima_2_variaveis", 2024)], d2[("fclima_3_variaveis_ficha", 2024)]
        dif = []
        for c in cod_uf:
            if a2[c] != a3[c] and c in peso:
                w_uf = sum(peso[k]["minimo"] for k, u in cod_uf.items() if u == cod_uf[c] and k in peso)
                dif.append(dict(cod_ibge=c, uf=cod_uf[c], peso_min_censo2022=round(peso[c]["minimo"]),
                                pct_do_peso_da_uf=arred(peso[c]["minimo"] / w_uf * 100, 1),
                                mtic266_2024=dados[(2024, "Mtic266")].get(c)))
        grava("munic_fclima_2x3_municipios_2024.csv", sorted(dif, key=lambda x: -x["peso_min_censo2022"]),
              ["cod_ibge", "uf", "peso_min_censo2022", "pct_do_peso_da_uf", "mtic266_2024"])

    # ---- teste de linha de base: reproduzir o ISGR do painel (2024) com os fatores calculados aqui
    painel = {}
    p_valores = os.path.join(RAIZ, "dashboard", "conteudo", "valores.csv")
    if os.path.exists(p_valores):
        with open(p_valores, encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r["codigo"] == "I4.4.1" and not r["campo"] and not r["ano"]:
                    painel[r["uf"]] = float(r["valor"])
    f_cl = dict(((n, a), f) for n, a, f in series).get(("fclima_3_variaveis_ficha", 2024))
    f_gv = dict(((n, a), f) for n, a, f in series).get(("fgov", 2024))
    testes = []
    if f_cl and f_gv:
        tot_dom = {}
        for uf in UFS + ["AL"]:
            cods = [c for c, u in cod_uf.items() if (uf == "AL" or u == uf) and c in peso]
            dom = sum(peso[c]["dom"] for c in cods)
            efet = sum(peso[c]["minimo"] * f_cl[c] * f_gv[c] for c in cods)
            isgr = efet / dom * 100
            testes.append(dict(uf=uf, isgr_recalculado=arred(isgr, 2), isgr_painel=painel.get(uf),
                               diferenca=arred(isgr - painel[uf], 2) if uf in painel else None,
                               n_sim_magr18=sum(sim(2024, "Magr18", c) for c in cods),
                               n_sim_mtic266=sum(sim(2024, "Mtic266", c) for c in cods),
                               n_sim_mhab088=sum(sim(2024, "Mhab088", c) for c in cods),
                               n_sim_mgov086=sum(sim(2024, "Mgov086", c) for c in cods)))
        grava("munic_teste_reproduz_isgr_painel_2024.csv", testes,
              ["uf", "isgr_recalculado", "isgr_painel", "diferenca", "n_sim_magr18", "n_sim_mtic266", "n_sim_mhab088",
               "n_sim_mgov086"])
        for t in testes:
            print("  ", t)
    # quanto se perde usando só 2 das 3 variáveis em 2024
    if ("fclima_2_variaveis", 2024) in dict(((n, a), 1) for n, a, f in series):
        f2 = dict(((n, a), f) for n, a, f in series)[("fclima_2_variaveis", 2024)]
        dif = [c for c in cod_uf if f2[c] != f_cl[c]]
        print(f"  FClima com 2 variáveis x 3 variáveis (2024): {len(dif)} de {len(cod_uf)} municípios diferem")


# ----------------------------------------------------------------------------- 6. ODS do IBGE (derivados da PNAD Contínua)
def ods_ibge(ref):
    """ODS 6.1.1 (tabela 9787, água potável gerenciada de forma segura, UF, 2016-2023) e 6.2.1 (tabela 6835,
    saneamento gerenciado de forma segura, UF, só 2017-2018). Outro conceito (gestão 'segura'): contexto."""
    print("6. ODS IBGE (SIDRA 9787 e 6835)")
    saidas = {}
    for nome, tabela, var_pct, var_cv, arquivo in (
            ("ods611", 9787, "9484", "9485", "ods_agua_potavel_gerenciada_6_1_1.csv"),
            ("ods621", 6835, "10107", None, "ods_saneamento_gerenciado_6_2_1.csv")):
        rows = sidra(f"/t/{tabela}/n3/{UF_LISTA}/p/all/v/all")
        salva_bruto(f"ibge_ods_{tabela}.csv", rows)
        val, cv = {}, {}
        for x in rows:
            uf, ano, v = UF_COD[x["D1C"]], x["D2C"], x["D3C"]
            if v == var_pct:
                val[(uf, ano)] = num(x["V"])
            elif var_cv is not None and v == var_cv:
                cv[(uf, ano)] = num(x["V"])
        linhas = [dict(uf=uf, ano=ano, valor=v, unidade="% da população", cv_pct=cv.get((uf, ano)),
                       fonte=f"IBGE, ODS (SIDRA {tabela}), derivado da PNAD Contínua")
                  for (uf, ano), v in sorted(val.items()) if v is not None]
        grava(arquivo, linhas, ["uf", "ano", "valor", "unidade", "fonte", "cv_pct"])
        saidas[nome] = linhas


# ----------------------------------------------------------------------------- 7. Emendas entre pesquisas (quebras)
def continuidade(ref):
    """Compara o último ano de uma pesquisa com o primeiro da seguinte (quebra de série), por UF."""
    print("7. Quebras entre pesquisas")

    def le(nome):
        with open(os.path.join(OUT, nome), encoding="utf-8") as f:
            return {(r["uf"], r["ano"]): float(r["valor"]) for r in csv.DictReader(f) if r["valor"] != ""}
    pares = [
        ("agua_rede_geral: PNAD 2015 -> PNAD Contínua 2016", "pnad_agua_rede_geral_2001_2015.csv", "2015",
         "pnadc_agua_rede_principal.csv", "2016"),
        ("esgoto rede+fossa ligada: PNAD 2015 -> PNAD Contínua 2016", "pnad_esgoto_rede_fossa_ligada_2009_2015.csv",
         "2015", "pnadc_esgoto_rede_fossa_ligada.csv", "2016"),
        ("esgoto rede+fossa ligada: PNAD Contínua 2018 (6735) -> 2019 (7192)", "pnadc_esgoto_rede_fossa_ligada.csv",
         "2018", "pnadc_esgoto_rede_fossa_ligada.csv", "2019"),
        ("agua SNIS IN055: 2022 -> SINISA IAG0001 2023", "snis_agua_atendimento_total_2001_2022.csv", "2022",
         "sinisa_agua_atendimento_2023_2024.csv", "2023"),
        ("esgoto SNIS IN056: 2022 -> SINISA IES0001 2023", "snis_esgoto_atendimento_total_2001_2022.csv", "2022",
         "sinisa_esgoto_atendimento_2023_2024.csv", "2023"),
    ]
    linhas = []
    for rotulo, a, ano_a, b, ano_b in pares:
        try:
            da, db = le(a), le(b)
        except FileNotFoundError:
            continue
        for uf in UFS:
            if (uf, ano_a) in da and (uf, ano_b) in db:
                linhas.append(dict(emenda=rotulo, uf=uf, ano_antes=ano_a, valor_antes=da[(uf, ano_a)],
                                   ano_depois=ano_b, valor_depois=db[(uf, ano_b)],
                                   salto_pp=arred(db[(uf, ano_b)] - da[(uf, ano_a)], 1)))
    if linhas:
        grava("quebras_entre_pesquisas.csv", linhas,
              ["emenda", "uf", "ano_antes", "valor_antes", "ano_depois", "valor_depois", "salto_pp"])
        por = {}
        for l in linhas:
            por.setdefault(l["emenda"], []).append(l["salto_pp"])
        for k, v in por.items():
            print(f"  {k}: salto médio {sum(v)/len(v):+.1f} pp | maior |salto| {max(abs(x) for x in v):.1f} pp")


# ----------------------------------------------------------------------------- 8. Auditoria dos dicionários da MUNIC
AUDITORIA_PADROES = {
    "Magr18": r"problemas clim[aá]ticos",
    "Mhab088": r"priori[zs]\w* a[cç][oõ]es nas [aá]reas de risco",
    "Mtic266": r"sensores? para monitoramento|monitoramento de (cheia|enchente|inunda|alagamento)|sistema de alerta",
    "Mgov086": r"acompanhamento de programas",
}
AUDITORIA_BASES = {   # edição -> caminho relativo no FTP (formato xls/xlsx com aba 'Dicionário')
    2008: "2008/Base2008.zip", 2009: "2009/base_MUNIC_2009.zip", 2011: "2011/base_MUNIC_xls_2011.zip",
    2012: "2012/base_MUNIC_xls_2012.zip", 2013: "2013/base_MUNIC_xls_2013.zip", 2014: "2014/base_MUNIC_xls_2014.zip",
    2015: "2015/Base_de_Dados/Base_MUNIC_2015_xls.zip", 2017: "2017/Base_de_Dados/Base_MUNIC_2017_xls.zip",
    2019: "2019/Base_de_Dados/Base_MUNIC_2019_20210817.xlsx", 2020: "2020/Base_de_Dados/Base_MUNIC_2020.xlsx",
    2021: "2021/Base_de_Dados/Base_MUNIC_2021_20240425.xlsx", 2023: "2023/Base_de_Dados/Base_MUNIC_2023.xlsx",
}


def munic_auditoria(ref=None):
    """Procura, no dicionário de cada edição da MUNIC, o texto das quatro variáveis dos fatores.
    Pesado (baixa ~150 MB): só roda com  EIXO4_AUDITAR_MUNIC=1 python scripts/eixo4_series_saneamento.py
    O resultado fica em munic_auditoria_dicionarios.csv (a pasta dados/ é local, está no .gitignore)."""
    import openpyxl
    import xlrd
    print("8. Auditoria dos dicionários MUNIC (2008-2023)")
    achados = []
    for ano, rel in AUDITORIA_BASES.items():
        try:
            caminho = baixa_arquivo(MUNIC_FTP + rel, os.path.basename(rel), headers=HEADERS)
            if caminho.lower().endswith(".zip"):
                z = zipfile.ZipFile(caminho)
                wb = xlrd.open_workbook(file_contents=z.read(z.namelist()[0]), on_demand=True)
                abas = [n for n in wb.sheet_names() if re.search(r"dic", n, re.I)]
                linhas = [(n, i + 1, " | ".join(str(c)[:250] for c in wb.sheet_by_name(n).row_values(i) if c not in ("", None)))
                          for n in abas for i in range(wb.sheet_by_name(n).nrows)]
            else:
                wb = openpyxl.load_workbook(caminho, read_only=True)
                abas = [n for n in wb.sheetnames if re.search(r"dic", n, re.I)]
                linhas = [(n, i + 1, " | ".join(str(c)[:250] for c in r if c is not None))
                          for n in abas for i, r in enumerate(wb[n].iter_rows(values_only=True))]
        except Exception as e:  # noqa: BLE001
            achados.append(dict(ano=ano, variavel_isgr="(arquivo)", aba="", linha="", texto=f"FALHOU: {repr(e)[:150]}"))
            continue
        for var, pad in AUDITORIA_PADROES.items():
            for aba, i, txt in linhas:
                if re.search(pad, txt, re.I):
                    achados.append(dict(ano=ano, variavel_isgr=var, aba=aba, linha=i, texto=txt[:400]))
        print(f"  {ano}: {sum(1 for a in achados if a['ano'] == ano)} achados")
    grava("munic_auditoria_dicionarios.csv", achados, ["ano", "variavel_isgr", "aba", "linha", "texto"])


# ----------------------------------------------------------------------------- orquestra
def main():
    resultados = {}
    try:
        resultados["pnadc"] = pnad_continua()
    except Exception as e:  # noqa: BLE001
        print("FALHOU PNAD Contínua:", e)
    try:
        resultados["pnad"] = pnad_antiga()
    except Exception as e:  # noqa: BLE001
        print("FALHOU PNAD 2001-2015:", e)
    try:
        ref = censos_referencia()
    except Exception as e:  # noqa: BLE001
        print("FALHOU Censos de referência:", e)
        ref = {}

    # --- grava as séries PNAD
    if "pnadc" in resultados:
        p = resultados["pnadc"]
        base = ["uf", "ano", "valor", "unidade", "fonte"]
        grava("pnadc_agua_rede_principal.csv", p["agua_rede_principal"], base + ["cv_pct", "domicilios_mil"])
        grava("pnadc_agua_adequada_limite_inferior.csv", p["agua_ampla_inf"],
              base + ["pct_rede_principal", "pct_poco_profundo_principal", "cv_rede_pct", "cv_poco_profundo_pct"])
        grava("pnadc_agua_ligacao_rede.csv", p["agua_ligacao"], base + ["cv_pct"])
        grava("pnadc_agua_adequada_limite_superior.csv", p["agua_ampla_sup"],
              base + ["pct_ligacao", "pct_poco_profundo_principal", "cv_ligacao_pct", "cv_poco_profundo_pct"])
        grava("pnadc_esgoto_rede_fossa_ligada.csv", p["esgoto_rede_fossaligada"],
              base + ["tabela_sidra", "cv_contagem_pct", "quebra_questionario_2019"])
        grava("pnadc_esgoto_adequado_2019.csv", p["esgoto_adequado"],
              base + ["pct_rede_ou_pluvial", "pct_fossa_septica_ligada", "pct_fossa_septica_nao_ligada",
                      "cv_septica_nao_ligada_pct"])
    if "pnad" in resultados:
        p = resultados["pnad"]
        base = ["uf", "ano", "valor", "unidade", "fonte", "cobertura", "domicilios_mil", "precisao"]
        grava("pnad_agua_rede_geral_2001_2015.csv", p["agua_rede_geral"], base)
        grava("pnad_esgoto_rede_coletora_2001_2015.csv", p["esgoto_rede_coletora"], base)
        grava("pnad_esgoto_rede_fossa_ligada_2009_2015.csv", p["esgoto_rede_fossaligada"], base)
        # 'rede + fossa séptica' da PNAD antiga REPROVA no teste contra o Censo 2010 (diferenças de 20 a 50 pp;
        # o respondente chama de séptica muita fossa rudimentar). Fica só em descartadas/, para registro.
        global OUT
        saida_antiga = OUT
        OUT = os.path.join(OUT, "descartadas")
        os.makedirs(OUT, exist_ok=True)
        grava("pnad_esgoto_rede_fossa_septica_2001_2015_REPROVADA.csv", p["esgoto_rede_fossaseptica"], base)
        OUT = saida_antiga

    # --- testes de linha de base: pesquisa por amostra x Censo
    testes = []

    # campos auxiliares do painel (dashboard/conteudo/valores.csv) = Censo 2022 arredondado a 1 decimal
    painel = {}
    p_valores = os.path.join(RAIZ, "dashboard", "conteudo", "valores.csv")
    if os.path.exists(p_valores):
        with open(p_valores, encoding="utf-8") as f:
            for r in csv.DictReader(f):
                if r["codigo"] == "I4.4.1" and r["campo"] in ("pctAguaAdequada", "pctEsgotoAdequado") and not r["ano"]:
                    painel[(r["campo"], r["uf"])] = float(r["valor"])
    campo_painel = {"agua_adequada_isgr": "pctAguaAdequada", "esgoto_adequado_isgr": "pctEsgotoAdequado"}

    def compara(serie_csv, chave_ref, ano_pesq, ano_ref, linhas):
        for l in linhas:
            if l["uf"] in UFS and l["ano"] == ano_pesq and (chave_ref, l["uf"], ano_ref) in ref:
                v_ref = ref[(chave_ref, l["uf"], ano_ref)]
                vp = painel.get((campo_painel.get(chave_ref), l["uf"]))
                testes.append(dict(serie=serie_csv, referencia=f"Censo {ano_ref}: {chave_ref}", uf=l["uf"],
                                   ano_pesquisa=ano_pesq, valor_pesquisa=l["valor"],
                                   valor_censo=arred(v_ref, 1), diferenca_pp=arred(float(l["valor"]) - v_ref, 1),
                                   valor_painel=vp,
                                   diferenca_vs_painel_pp=arred(float(l["valor"]) - vp, 1) if vp is not None else None))
    if "pnadc" in resultados:
        p = resultados["pnadc"]
        compara("pnadc_agua_rede_principal", "agua_rede_principal", "2022", "2022", p["agua_rede_principal"])
        compara("pnadc_agua_adequada_limite_inferior", "agua_adequada_isgr", "2022", "2022", p["agua_ampla_inf"])
        compara("pnadc_agua_adequada_limite_superior", "agua_adequada_isgr", "2022", "2022", p["agua_ampla_sup"])
        compara("pnadc_agua_ligacao_rede", "agua_ligacao", "2022", "2022", p["agua_ligacao"])
        compara("pnadc_esgoto_rede_fossa_ligada", "esgoto_rede_fossaligada", "2022", "2022", p["esgoto_rede_fossaligada"])
        compara("pnadc_esgoto_adequado_2019", "esgoto_adequado_isgr", "2022", "2022", p["esgoto_adequado"])
    if "pnad" in resultados:
        p = resultados["pnad"]
        for ano_p in ("2009", "2011"):
            compara("pnad_agua_rede_geral_2001_2015", "agua_rede_geral", ano_p, "2010", p["agua_rede_geral"])
            compara("pnad_esgoto_rede_coletora_2001_2015", "esgoto_rede_coletora", ano_p, "2010",
                    p["esgoto_rede_coletora"])
            compara("pnad_esgoto_rede_fossa_septica_2001_2015_REPROVADA", "esgoto_rede_fossaseptica", ano_p, "2010",
                    p["esgoto_rede_fossaseptica"])
    if testes:
        grava("testes_linha_base_pnad_x_censo.csv", testes,
              ["serie", "referencia", "uf", "ano_pesquisa", "valor_pesquisa", "valor_censo", "diferenca_pp",
               "valor_painel", "diferenca_vs_painel_pp"])
        # resumo por série e ano
        resumo = {}
        for t in testes:
            resumo.setdefault((t["serie"], t["ano_pesquisa"]), []).append(t["diferenca_pp"])
        print("\nResumo dos testes (diferença pesquisa - Censo, pontos percentuais):")
        for (s, a), d in resumo.items():
            print(f"  {s} [{a}]: média abs {sum(abs(x) for x in d)/len(d):.1f} | máx abs {max(abs(x) for x in d):.1f} "
                  f"| viés médio {sum(d)/len(d):+.1f}")

    # --- rotas de SNIS/SINISA e MUNIC (preenchidas abaixo, se existirem)
    rotas = ["sinisa_snis", "munic", "ods_ibge", "continuidade"]
    if os.environ.get("EIXO4_AUDITAR_MUNIC") == "1":
        rotas.append("munic_auditoria")
    for nome in rotas:
        fn = globals().get(nome)
        if fn:
            try:
                fn(ref)
            except Exception as e:  # noqa: BLE001
                print(f"FALHOU rota {nome}:", repr(e)[:300])


if __name__ == "__main__":
    main()
