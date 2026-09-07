#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Confere as fichas técnicas contra o catálogo de indicadores.

O `fichas.json` é extraído do .docx pelo `dashboard/scripts/extract-fichas.ps1`, e o
`catalogo.json` vem dos workbooks. São duas origens independentes descrevendo os
mesmos indicadores, então divergir é sinal de erro de digitação numa delas — e foi
assim que se achou o I2.3.1, cuja ficha trazia a fonte e o link do indicador de
conectividade da ANATEL num indicador que é do IDEB.

Roda quatro conferências, da mais grave para a mais branda:

  órgão trocado — ficha e catálogo nomeiam órgãos conhecidos e nenhum em comum;
  link órfão    — o domínio do link não bate com nenhuma fonte declarada nos dois;
  texto trocado — o indicador da ficha mal se sobrepõe ao do catálogo;
  redação       — mesma fonte escrita de outro jeito, só informativo.

Conferir a ficha contra ela mesma não basta, e o I2.3.1 mostra por quê: fonte
"ANATEL" com link da ANATEL é internamente coerente. Só o cruzamento com o
catálogo, que diz "INEP (IDEB)", revela que o indicador é de outro órgão.

Nenhuma conferência prova erro sozinha — "SUS, IBGE" e "Ministério da Saúde" são
a mesma fonte escrita diferente. O script aponta onde olhar.

Uso: python scripts/auditar_fichas.py [--falhar-se-houver]
"""
import json
import os
import re
import sys
import unicodedata

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
DADOS = os.path.join(PASTA, "dashboard", "public", "data")

# Órgão -> (domínio do site, como a fonte pode estar escrita). Os apelidos importam:
# a mesma fonte aparece como "SUS, IBGE" na ficha e "Ministério da Saúde (CNES)" no
# catálogo, e sem eles o script acusaria link trocado onde não há.
ORGAOS = {
    "inep": ("inep.gov.br", ["inep", "ideb", "censo escolar", "saeb"]),
    "anatel": ("anatel.gov.br", ["anatel"]),
    "ibge": ("ibge.gov.br", ["ibge", "sidra", "pnad", "munic", "censo demografico", "pevs", "pia"]),
    "datasus": ("datasus.gov.br", ["datasus", "tabnet", "cnes", " sus", "saude", "e-gestor", "egestor"]),
    "mma": ("mma.gov.br", ["mma", "meio ambiente", "cnuc"]),
    "aneel": ("aneel.gov.br", ["aneel", "siga"]),
    "epe": ("epe.gov.br", ["epe", "pesquisa energetica", "pasi"]),
    "dnit": ("dnit.gov.br", ["dnit"]),
    "cnt": ("cnt.org.br", ["cnt", "confederacao nacional do transporte"]),
    "transportes": ("gov.br/transportes", ["transportes"]),
    "cgu": ("cgu.gov.br", ["cgu", "controladoria", "brasil transparente"]),
    "inpe": ("inpe.br", ["inpe", "prodes", "queimadas"]),
    "adaptabrasil": ("adaptabrasil.mcti.gov.br", ["adaptabrasil", "adapta brasil", "mcti"]),
    "cal": ("consorcioamazonialegal.gov.br", ["cal", "consorcio"]),
    "mj": ("gov.br/mj", ["sinesp", "ministerio da justica", "pronasci", " mj"]),
    "tesouro": ("tesourotransparente.gov.br", ["tesouro", "capag", "stn"]),
}
PALAVRAS_VAZIAS = {"estado", "estados", "portal", "portais", "dados", "cada", "sistema"}


def normaliza(texto):
    limpo = unicodedata.normalize("NFD", str(texto or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]", " ", limpo)


def palavras(texto, minimo=3):
    return {t for t in normaliza(texto).split() if len(t) >= minimo and t not in PALAVRAS_VAZIAS}


def orgaos(texto):
    """Órgãos conhecidos citados num texto de fonte, por qualquer um dos apelidos."""
    limpo = " " + normaliza(texto) + " "
    return {chave for chave, (_, apelidos) in ORGAOS.items()
            if any(normaliza(a).strip() in limpo for a in apelidos)}


def orgaos_do_link(url):
    baixo = url.lower()
    return {chave for chave, (dominio, _) in ORGAOS.items() if dominio in baixo}


def carregar():
    with open(os.path.join(DADOS, "fichas.json"), encoding="utf-8") as f:
        fichas = json.load(f)["fichas"]
    with open(os.path.join(DADOS, "catalogo.json"), encoding="utf-8") as f:
        catalogo = json.load(f)
    indice = {i["codigo"]: i for e in catalogo["eixos"] for i in e["indicadores"]}
    return fichas, indice


def auditar():
    fichas, catalogo = carregar()
    trocas, divergencias, links, trocas_de_orgao = [], [], [], []

    for codigo in sorted(fichas):
        ficha = fichas[codigo]
        item = catalogo.get(codigo)
        if not item:
            continue

        # 1. Texto do indicador: sobreposição baixa sugere ficha com o conteúdo de outro.
        da_ficha = palavras(ficha.get("indicador"), 5)
        do_catalogo = palavras(item.get("descricao"), 5) | palavras(item.get("nome"), 5) | palavras(item.get("meta"), 5)
        if da_ficha and do_catalogo:
            sobreposicao = len(da_ficha & do_catalogo) / len(da_ficha)
            if sobreposicao < 0.15:
                trocas.append((codigo, sobreposicao, ficha.get("indicador"), item.get("descricao") or item.get("nome")))

        # 2. Órgão citado na ficha x órgão citado no catálogo. Se os dois nomeiam órgãos
        #    conhecidos e não têm nenhum em comum, alguém trocou o indicador de dono —
        #    foi o que aconteceu no I2.3.1, que é do IDEB mas cita a ANATEL. Ficha
        #    internamente coerente não basta: só o cruzamento com o catálogo revela.
        oa, oc = orgaos(ficha.get("fontes")), orgaos(item.get("fonte"))
        if oa and oc and not (oa & oc):
            trocas_de_orgao.append((codigo, ficha.get("fontes"), item.get("fonte"), oa, oc))

        # 3. Link que não corresponde a nenhum órgão citado — nem na ficha, nem no
        #    catálogo. Ficha com várias fontes pode apontar para qualquer uma delas,
        #    então só é problema quando o link não bate com nenhuma.
        aceitos = oa | oc
        for url in ficha.get("referencias") or []:
            do_link = orgaos_do_link(url)
            if do_link and aceitos and not (do_link & aceitos):
                links.append((codigo, ficha.get("fontes"), item.get("fonte"), url, sorted(do_link)))

        # 4. Fonte escrita de outro jeito, sem troca de órgão: só informativo.
        fa, fc = palavras(ficha.get("fontes")), palavras(item.get("fonte"))
        if fa and fc and not (fa & fc) and not (oa and oc and not (oa & oc)):
            divergencias.append((codigo, ficha.get("fontes"), item.get("fonte")))
    return trocas, divergencias, links, trocas_de_orgao


trocas, divergencias, links, trocas_de_orgao = auditar()

print("=== ÓRGÃO TROCADO ENTRE FICHA E CATÁLOGO (o mais grave) ===")
if not trocas_de_orgao:
    print("  nenhum")
for codigo, da_ficha, do_catalogo, oa, oc in trocas_de_orgao:
    print(f"  {codigo}: ficha atribui a {sorted(oa)}, catálogo a {sorted(oc)}")
    print(f"      ficha    : {str(da_ficha)[:80]!r}")
    print(f"      catálogo : {str(do_catalogo)[:80]!r}")

print()
print("=== LINK QUE NÃO BATE COM NENHUMA FONTE DECLARADA ===")
if not links:
    print("  nenhum")
for codigo, da_ficha, do_catalogo, url, do_link in links:
    print(f"  {codigo}: link é de {do_link}, mas as fontes são {str(da_ficha)[:40]!r} / {str(do_catalogo)[:40]!r}")
    print(f"      {url}")

print("\n=== FICHA COM TEXTO DE OUTRO INDICADOR ===")
if not trocas:
    print("  nenhuma")
for codigo, sobreposicao, texto_ficha, texto_catalogo in trocas:
    print(f"  {codigo} (sobreposição {sobreposicao:.0%})")
    print(f"      ficha    : {str(texto_ficha)[:92]}")
    print(f"      catálogo : {str(texto_catalogo)[:92]}")

print("\n=== FONTE ESCRITA DE FORMA DIFERENTE (conferir, nem sempre é erro) ===")
if not divergencias:
    print("  nenhuma")
for codigo, da_ficha, do_catalogo in divergencias:
    print(f"  {codigo}: ficha {str(da_ficha).replace(chr(10), ' / ')[:46]!r} x catálogo {str(do_catalogo)[:46]!r}")

problemas = len(links) + len(trocas) + len(trocas_de_orgao)
print(f"\nProblemas graves: {problemas} · divergências de redação: {len(divergencias)}")
if "--falhar-se-houver" in sys.argv and problemas:
    raise SystemExit(1)
