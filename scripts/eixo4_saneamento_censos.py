#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 4 / I4.4.1 — Saneamento nos censos de 2000, 2010 e 2022.

POR QUE O ISGR NÃO VAI PARA TRÁS, para não se refazer o caminho. O índice do painel
é `min(água adequada, esgoto adequado) × FClima × FGov`, e dois dos três insumos
não existem antes de 2022:

  1. Água. A definição do ISGR é `72144 + 72145 + 72154` da classificação 1821 do
     Censo 2022 — domicílio COM ligação à rede (usando-a ou não como forma
     principal) mais quem não tem ligação e usa poço profundo. Essa classificação
     nasceu em 2022: ela cruza "existência de ligação" com "forma principal de
     abastecimento", duas perguntas separadas. Em 2000 e 2010 havia só a forma
     principal (classificação 61), que não distingue quem tem ligação e usa outra
     fonte, nem separa poço profundo de poço raso. Não há como reconstruir.
  2. Fatores FClima e FGov. Vêm da MUNIC 2024 (Magr18, Mhab088, Mtic266, Mgov086).
     Edições anteriores da MUNIC têm outro questionário e outros códigos.

O que É comparável entre os três censos, e é o que este script grava:

  esgoto_adequado — rede geral/pluvial mais fossa séptica, sobre o total. A
      classificação é a mesma (11558) nos três censos. Em 2022 o IBGE partiu a
      fossa séptica em ligada e não ligada à rede (46290 + 72112); somadas, o
      conceito é o mesmo de 2000 e 2010 (92855 + 92856).
  agua_rede_geral — rede geral como forma principal de abastecimento. Estável nos
      três censos (2000/2010: categoria 92853; 2022: categoria 72144). **Não é** a
      água adequada do ISGR, que é mais larga; o script mede a distância entre as
      duas em 2022 para deixar o tamanho da diferença registrado.

Ou seja: isto não é uma série do ISGR e não substitui o indicador. É a série da
substância que o ISGR mede, na única definição que atravessa os três censos.

Saídas em dados/saneamento/:
  - censos_saneamento_uf.csv
  - censos_saneamento_municipio.csv
E o consolidado versionado:
  - dashboard/public/data/saneamento-censos.json
"""
import csv
import datetime
import gzip
import json
import os
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
SAIDA = os.path.join(PASTA, "dados", "saneamento")
PUBLICO = os.path.join(PASTA, "dashboard", "public", "data")
os.makedirs(SAIDA, exist_ok=True)

UFS = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
       "16": "AP", "17": "TO", "21": "MA", "51": "MT"}
CODIGOS = ",".join(UFS)

# (censo, tema) -> (tabela, variável, classificação, total, categorias somadas)
CONSULTAS = {
    (2000, "esgoto"): ("1444", "96", "c11558", "0", ["92855", "92856"]),
    (2010, "esgoto"): ("1394", "96", "c11558", "0", ["92855", "92856"]),
    (2022, "esgoto"): ("6805", "381", "c11558", "46292", ["46290", "72112"]),
    (2000, "agua"): ("1442", "96", "c61", "0", ["92853"]),
    (2010, "agua"): ("3218", "96", "c61", "0", ["92853"]),
    (2022, "agua"): ("6803", "381", "c1821", "72129", ["72144"]),
}
# Só em 2022: a definição de água do ISGR, para medir a distância até a comparável.
ISGR_AGUA_2022 = ["72144", "72145", "72154"]


def sidra(caminho):
    url = "https://apisidra.ibge.gov.br/values" + caminho
    req = urllib.request.Request(url, headers={"Accept-Encoding": "identity", "User-Agent": "Mozilla/5.0"})
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                dados = r.read()
                if dados[:2] == b"\x1f\x8b":
                    dados = gzip.decompress(dados)
                return json.loads(dados)[1:]
        except Exception as e:
            print("  retry", tentativa + 1, "erro:", e, flush=True)
            if tentativa == 2:
                raise


def num(v):
    if v in (None, "", "-", "...", ".."):
        return None
    try:
        return float(str(v).strip())
    except ValueError:
        return None


def coletar(nivel, tabela, variavel, classe, categorias, ano):
    """Devolve {codigo_local: {categoria: valor}}."""
    territorio = f"n3/{CODIGOS}" if nivel == "uf" else f"n6/in%20n3%20{CODIGOS}"
    caminho = f"/t/{tabela}/{territorio}/v/{variavel}/p/{ano}/{classe}/{','.join(categorias)}"
    saida = {}
    for r in sidra(caminho):
        valor = num(r["V"])
        if valor is None:
            continue
        codigo = r["D1C"]
        categoria = next((r[k] for k in ("D4C", "D5C") if k in r), None)
        saida.setdefault(codigo, {})[categoria] = valor
    return saida


def percentuais(nivel):
    """Monta {codigo: {(ano, tema): pct}} para o nível pedido."""
    resultado = {}
    for (ano, tema), (tabela, variavel, classe, total, partes) in sorted(CONSULTAS.items()):
        print(f"  {nivel} · censo {ano} · {tema} (t{tabela})", flush=True)
        dados = coletar(nivel, tabela, variavel, classe, [total] + partes, ano)
        for codigo, cats in dados.items():
            base = cats.get(total)
            soma = sum(cats.get(p, 0.0) for p in partes)
            if base:
                resultado.setdefault(codigo, {})[(ano, tema)] = round(soma / base * 100, 2)
                resultado[codigo][(ano, tema, "domicilios")] = base
    return resultado


print("Censos 2000, 2010 e 2022 — saneamento por UF")
por_uf = percentuais("uf")

# Distância entre a água comparável e a água do ISGR, em 2022.
print("\nÁgua em 2022: definição comparável x definição do ISGR")
isgr = coletar("uf", "6803", "381", "c1821", ["72129"] + ISGR_AGUA_2022, 2022)
comparacao = []
for codigo, cats in sorted(isgr.items()):
    base = cats.get("72129")
    if not base:
        continue
    larga = sum(cats.get(p, 0.0) for p in ISGR_AGUA_2022) / base * 100
    estreita = por_uf.get(codigo, {}).get((2022, "agua"))
    if estreita is not None:
        comparacao.append({
            "uf": UFS[codigo], "agua_rede_geral_pct": estreita,
            "agua_isgr_pct": round(larga, 2), "diferenca_pp": round(larga - estreita, 2),
            # Decomposição da diferença: quanto vem da parcela ambígua (tem ligação mas usa
            # outra fonte) e quanto vem do poço profundo, que 2000 e 2010 não separam do raso.
            "tem_ligacao_usa_outra_pct": round(cats.get("72145", 0.0) / base * 100, 2),
            "poco_profundo_sem_ligacao_pct": round(cats.get("72154", 0.0) / base * 100, 2),
        })
for c in comparacao:
    print(f"  {c['uf']}  comparável {c['agua_rede_geral_pct']:6.2f}%   ISGR {c['agua_isgr_pct']:6.2f}%   "
          f"dif {c['diferenca_pp']:+.2f} p.p.")
maior = max(c["diferenca_pp"] for c in comparacao)
print(f"  maior diferença: {maior:.2f} p.p. — é o tamanho do que a definição de 2022 acrescenta")

print("\nCensos por município")
por_mun = percentuais("municipio")

anos = [2000, 2010, 2022]

linhas_uf = []
for codigo, cats in sorted(por_uf.items(), key=lambda kv: UFS[kv[0]]):
    for ano in anos:
        linhas_uf.append({
            "uf": UFS[codigo], "ano": ano,
            "esgoto_adequado_pct": cats.get((ano, "esgoto")),
            "agua_rede_geral_pct": cats.get((ano, "agua")),
            "domicilios": cats.get((ano, "esgoto", "domicilios")),
        })
destino = os.path.join(SAIDA, "censos_saneamento_uf.csv")
with open(destino, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["uf", "ano", "esgoto_adequado_pct", "agua_rede_geral_pct", "domicilios"])
    w.writeheader()
    w.writerows(linhas_uf)
print(f"\n  {len(linhas_uf)} linhas -> {destino}")

linhas_mun = []
for codigo, cats in sorted(por_mun.items()):
    for ano in anos:
        if cats.get((ano, "esgoto")) is None and cats.get((ano, "agua")) is None:
            continue
        linhas_mun.append({
            "cod_municipio": codigo, "ano": ano,
            "esgoto_adequado_pct": cats.get((ano, "esgoto")),
            "agua_rede_geral_pct": cats.get((ano, "agua")),
            "domicilios": cats.get((ano, "esgoto", "domicilios")),
        })
destino_mun = os.path.join(SAIDA, "censos_saneamento_municipio.csv")
with open(destino_mun, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["cod_municipio", "ano", "esgoto_adequado_pct", "agua_rede_geral_pct", "domicilios"])
    w.writeheader()
    w.writerows(linhas_mun)
print(f"  {len(linhas_mun)} linhas -> {destino_mun}")

serie = lambda tema: {
    UFS[c]: {str(a): cats[(a, tema)] for a in anos if (a, tema) in cats}
    for c, cats in sorted(por_uf.items(), key=lambda kv: UFS[kv[0]])
}
payload = {
    "indicador": "I4.4.1",
    "nome": "Saneamento nos censos demográficos",
    "unidade": "%",
    "atualizadoEm": datetime.date.today().isoformat(),
    "usoNoPainel": "não",
    "naoEhOIsgr": {
        "aviso": "Estas séries NÃO são o ISGR e não substituem o indicador do painel. São a "
                 "substância que ele mede, na única definição que atravessa os três censos.",
        "decisao": "Decidido em 07/09/2026 que estes dados ficam guardados e NÃO sobem para o "
                   "painel: a metodologia do I4.4.1 diz que o indicador é o ISGR, e exibir outra "
                   "medida sob o mesmo rótulo trocaria o indicador mantendo o nome. Quem for "
                   "estender o painel: não ligue este arquivo ao seletor de ano do isgr.",
        "porQueOIsgrNaoRetroage": [
            "Água: o ISGR usa a classificação 1821 do Censo 2022, que cruza existência de "
            "ligação à rede com forma principal de abastecimento. Essa classificação nasceu "
            "em 2022; 2000 e 2010 só têm a forma principal, e não separam poço profundo de "
            "poço raso nem identificam quem tem ligação mas usa outra fonte.",
            "Fatores FClima e FGov: vêm da MUNIC 2024 (Magr18, Mhab088, Mtic266, Mgov086), e "
            "edições anteriores da MUNIC têm outro questionário.",
        ],
    },
    "anos": [str(a) for a in anos],
    "esgotoAdequado": {
        "definicao": "Rede geral ou pluvial mais fossa séptica, sobre o total de domicílios. "
                     "Mesma classificação (11558) nos três censos: em 2022 o IBGE partiu a fossa "
                     "séptica em ligada e não ligada à rede (46290 + 72112), e somadas elas dão "
                     "o mesmo conceito de 2000 e 2010 (92855 + 92856).",
        "serie": serie("esgoto"),
    },
    "aguaRedeGeral": {
        "definicao": "Rede geral como forma principal de abastecimento (2000 e 2010: categoria "
                     "92853; 2022: categoria 72144). É o recorte mais próximo que atravessa os "
                     "três censos: em 2010 quem tinha ligação mas usava principalmente um poço "
                     "respondia 'poço', então o equivalente de 2022 é o 72144 sozinho, sem o "
                     "72145.",
        "ressalva": "Comparação boa, não perfeita. Em 2022 o IBGE passou a fazer duas perguntas "
                    "(existência de ligação e forma principal) onde antes havia uma, e isso pode "
                    "deslocar a classificação na margem. O 72145, que é a parcela ambígua, vale "
                    "entre 2,7% e 9,7% dos domicílios conforme o estado.",
        "serie": serie("agua"),
    },
    "distanciaParaAguaDoIsgr2022": {
        "descricao": "Quanto a definição de água do ISGR (72144 + 72145 + 72154) fica acima da "
                     "definição comparável, em 2022. É o tamanho do que não dá para reconstruir "
                     "nos censos anteriores.",
        "porUf": comparacao,
    },
}
destino_json = os.path.join(PUBLICO, "saneamento-censos.json")
with open(destino_json, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"  consolidado versionado -> {os.path.relpath(destino_json, PASTA)}")

print("\nEsgoto adequado (%) — rede geral/pluvial + fossa séptica")
print("UF    " + "  ".join(f"{a:>7}" for a in anos))
for uf in UFS.values():
    v = {l["ano"]: l["esgoto_adequado_pct"] for l in linhas_uf if l["uf"] == uf}
    print(f"{uf:5} " + "  ".join(f"{v[a]:7.2f}" if v.get(a) is not None else "      -" for a in anos))
print("\nÁgua por rede geral como forma principal (%)")
print("UF    " + "  ".join(f"{a:>7}" for a in anos))
for uf in UFS.values():
    v = {l["ano"]: l["agua_rede_geral_pct"] for l in linhas_uf if l["uf"] == uf}
    print(f"{uf:5} " + "  ".join(f"{v[a]:7.2f}" if v.get(a) is not None else "      -" for a in anos))
