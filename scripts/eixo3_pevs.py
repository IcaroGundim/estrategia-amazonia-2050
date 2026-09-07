#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 3 / I3.1.1 — Sociobioeconomia: proxy IBGE PEVS (tabela 289).

Valor da produção (VAR 145, mil R$) e quantidade produzida (VAR 144, t) da
extração vegetal, por UF da Amazônia Legal, série 2015-2024.
Saídas em dados/eixo3/:
  - pevs_total_uf_ano.csv         (Total, por UF/ano)
  - pevs_por_produto_uf.csv       (detalhado por produto)
  - pevs_madeireiro_uf_ano.csv    (agregação madeireiros x não-madeireiros)
"""
import csv
import datetime
import gzip
import io
import json
import os
import re
import sys
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
SAIDA = os.path.join(PASTA, "dados", "eixo3")
os.makedirs(SAIDA, exist_ok=True)

UFS = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
       "16": "AP", "17": "TO", "21": "MA", "51": "MT"}
ANOS = "2015-2024"          # detalhe por produto: alimenta o recorte do ano de referência
# A série total vai a 1994 e não a 1986, onde a tabela começa, porque o valor da
# produção muda de moeda antes disso — Cruzados até 1988, Cruzados Novos em 1989,
# Cruzeiros até 1992, Cruzeiros Reais em 1993. Só de 1994 em diante é Mil Reais, e
# só aí os anos são somáveis na mesma unidade.
ANOS_TOTAL = "1994-2024"
# Categorias folha = subprodutos (nome "7.1 - ...", "9.3 - ..."); os grupos
# ("1 - Alimentícios" etc.) são somatório dos filhos e NÃO entram nas agregações.
FOLHA = re.compile(r"^\d+\.\d+ ")
GRUPO = re.compile(r"^\d+ - ")


def eh_madeireiro(nome):
    return nome.startswith(("7.", "9."))


def sidra(path):
    url = "https://apisidra.ibge.gov.br/values" + path
    req = urllib.request.Request(url, headers={"Accept-Encoding": "identity", "User-Agent": "Mozilla/5.0"})
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = r.read()
                if data[:2] == b"\x1f\x8b":
                    data = gzip.decompress(data)
                return json.loads(data)
        except Exception as e:
            print("  retry", tentativa + 1, "erro:", e)
            if tentativa == 2:
                raise


def num(v):
    if v in (None, "", "-", "..."):
        return None
    s = str(v).strip()
    try:
        return float(s)
    except ValueError:
        return None


def linha_para_dict(r, prod_flag=False):
    return {
        "uf": UFS[r["D1C"]],
        "ano": int(r["D3C"]),
        "cod_produto": r["D4C"] if prod_flag else None,
        "produto": r["D4N"] if prod_flag else None,
        "var": r["D2C"],
        "valor": num(r["V"]),
        "unidade": r["MN"],
    }


print("PEVS total (categoria 0) por UF/ano...")
total = sidra(f"/t/289/n3/{','.join(UFS)}/v/144,145/p/{ANOS_TOTAL}/c193/0")
print("PEVS detalhado por produto...")
detalhe = sidra(f"/t/289/n3/{','.join(UFS)}/v/144,145/p/{ANOS}/c193/all")


def gravar(rows, nome, colunas):
    path = os.path.join(SAIDA, nome)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=colunas)
        w.writeheader()
        for r in rows:
            w.writerow(r)
    print("salvo:", path, len(rows), "linhas")


# total por UF/ano
tot = {}
for r in total:
    if not r["D1C"].isdigit():
        continue  # linha de descritores
    d = linha_para_dict(r)
    chave = (d["uf"], d["ano"])
    if chave not in tot:
        tot[chave] = {"uf": d["uf"], "ano": d["ano"], "quantidade_t": None, "valor_mil_rs": None}
    if d["var"] == "144":
        tot[chave]["quantidade_t"] = d["valor"]
    else:
        tot[chave]["valor_mil_rs"] = d["valor"]
tot_rows = [tot[k] for k in sorted(tot, key=lambda k: (UFS.get(k[0], k[0]), k[0]), reverse=False) if True]
tot_rows.sort(key=lambda r: (r["uf"], r["ano"]))

# detalhado por produto
det = {}
for r in detalhe:
    if not r["D1C"].isdigit():
        continue  # linha de descritores
    d = linha_para_dict(r, prod_flag=True)
    if d["cod_produto"] == "0":
        continue
    chave = (d["uf"], d["ano"], d["cod_produto"])
    if chave not in det:
        det[chave] = {"uf": d["uf"], "ano": d["ano"], "cod_produto": d["cod_produto"], "produto": d["produto"],
                      "quantidade_t": None, "valor_mil_rs": None}
    if d["var"] == "144":
        det[chave]["quantidade_t"] = d["valor"]
    else:
        det[chave]["valor_mil_rs"] = d["valor"]
det_rows = [det[k] for k in sorted(det)]
det_rows = [r for r in det_rows if r["quantidade_t"] is not None or r["valor_mil_rs"] is not None]

# agregação madeireiros x não-madeireiros (por valor e quantidade), apenas folhas
agg = {}
for r in det_rows:
    if not FOLHA.match(r["produto"]):
        continue  # grupos são somatório dos filhos — excluídos para evitar dupla contagem
    chave = (r["uf"], r["ano"])
    grupo = "madeireiro" if eh_madeireiro(r["produto"]) else "nao_madeireiro"
    k = agg.setdefault(chave, {})
    g = k.setdefault(grupo, {"valor": 0.0, "quant": 0.0})
    g["valor"] += r["valor_mil_rs"] or 0.0
    g["quant"] += r["quantidade_t"] or 0.0
mad_rows = []
for (uf, ano), k in sorted(agg.items()):
    for grupo in ("madeireiro", "nao_madeireiro"):
        if grupo in k:
            mad_rows.append({"uf": uf, "ano": ano, "grupo": grupo,
                             "valor_mil_rs": round(k[grupo]["valor"], 1), "quantidade_t": round(k[grupo]["quant"], 1)})

gravar(tot_rows, "pevs_total_uf_ano.csv", ["uf", "ano", "quantidade_t", "valor_mil_rs"])
gravar(det_rows, "pevs_por_produto_uf.csv", ["uf", "ano", "cod_produto", "produto", "quantidade_t", "valor_mil_rs"])
gravar(mad_rows, "pevs_madeireiro_uf_ano.csv", ["uf", "ano", "grupo", "valor_mil_rs", "quantidade_t"])

# verificação interna: soma das folhas = categoria Total (por UF/ano).
# Só nos anos em que o detalhe por produto foi baixado — o total vai mais longe.
anos_detalhe = {d["ano"] for d in det_rows}
dif = []
for r in tot_rows:
    if r["ano"] not in anos_detalhe:
        continue
    soma_folhas = sum(
        (d["valor_mil_rs"] or 0.0) for d in det_rows
        if d["uf"] == r["uf"] and d["ano"] == r["ano"] and FOLHA.match(d["produto"])
    )
    if r["valor_mil_rs"] is not None and abs(soma_folhas - r["valor_mil_rs"]) > 1:
        dif.append(f"{r['uf']}/{r['ano']}: folhas {soma_folhas:,.0f} vs total {r['valor_mil_rs']:,.0f}")
if dif:
    raise SystemExit("ERRO: soma dos subprodutos != Total — " + "; ".join(dif[:5]))
print(f"check interno: soma dos subprodutos = Total OK ({min(anos_detalhe)}-{max(anos_detalhe)})")

# ---------- consolidado versionado ----------
# O painel exibe o valor a preços correntes, que é a metodologia da tabela e não muda
# aqui. Só que numa série de 31 anos isso engana: o Pará sai de R$ 1,95 bi em 1994 para
# R$ 2,74 bi em 2024 e parece ter crescido, quando o IPCA subiu 7x no mesmo período —
# em valor real a produção caiu. Por isso vai junto uma série deflacionada pelo IPCA
# para reais de 2024, marcada como derivada: ela não substitui o indicador, mostra o
# que a série corrente esconde.
print("\nIPCA (SIDRA 1737) para a série deflacionada...")
anos_serie = sorted({r["ano"] for r in tot_rows})
periodos = ",".join(f"{a}12" for a in anos_serie)
ipca = {}
for r in sidra(f"/t/1737/n1/1/v/2266/p/{periodos}")[1:]:
    valor = num(r["V"])
    if valor:
        ipca[int(r["D3C"][:4])] = valor
base = ipca.get(max(anos_serie))
print(f"  índice de {min(anos_serie)} a {max(anos_serie)}; fator do primeiro ano: {base / ipca[min(anos_serie)]:.2f}x")

nominal, real = {}, {}
for r in tot_rows:
    if r["valor_mil_rs"] is None:
        continue
    # Sem arredondar: é exatamente a conta que o server.mjs faz (valor_mil_rs / 1e6),
    # e o painel guarda a precisão cheia. Arredondar aqui criaria divergência boba
    # entre o JSON versionado e o que o build:static produz.
    nominal.setdefault(r["uf"], {})[str(r["ano"])] = r["valor_mil_rs"] / 1e6
    fator = ipca.get(r["ano"])
    if fator and base:
        real.setdefault(r["uf"], {})[str(r["ano"])] = round(r["valor_mil_rs"] / 1e6 * (base / fator), 6)

payload = {
    "indicador": "I3.1.1",
    "nome": "Produção da extração vegetal (PEVS)",
    "unidade": "R$ bilhões",
    "atualizadoEm": datetime.date.today().isoformat(),
    "fonte": {
        "tabela": "IBGE/SIDRA 289 — valor da produção na extração vegetal (variável 145), categoria Total",
        "recorte": f"{ANOS_TOTAL}, por UF",
        "porQueComecaEm1994": "A tabela começa em 1986, mas o valor da produção muda de moeda "
                              "antes de 1994 (Cruzados, Cruzados Novos, Cruzeiros, Cruzeiros "
                              "Reais). Só de 1994 em diante a unidade é Mil Reais e os anos são "
                              "comparáveis na mesma moeda.",
    },
    "anos": [str(a) for a in anos_serie],
    "seriePrecosCorrentes": {
        "descricao": "É o que o painel exibe, na metodologia da própria tabela: valor a preços "
                     "correntes de cada ano.",
        "serie": nominal,
    },
    "serieReais2024": {
        "descricao": "Derivada, não substitui o indicador. A mesma série deflacionada pelo IPCA "
                     f"(SIDRA 1737) para reais de {max(anos_serie)}, para que a comparação entre "
                     "anos distantes não seja dominada pela inflação.",
        "deflator": "IPCA, número-índice de dezembro de cada ano",
        "serie": real,
    },
    "anosAusentes": [{"uf": uf, "ano": str(a)} for uf in sorted(nominal)
                     for a in anos_serie if str(a) not in nominal[uf]],
}
destino = os.path.join(PASTA, "dashboard", "public", "data", "pevs-extracao-vegetal.json")
with open(destino, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("Consolidado versionado ->", os.path.relpath(destino, PASTA))

print("\nValor da produção (R$ bi) — correntes x reais de 2024")
mostra = [a for a in anos_serie if a % 5 == 0 or a == max(anos_serie)]
print("UF   " + " ".join(f"{a:>16}" for a in mostra))
for uf in ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]:
    celulas = []
    for a in mostra:
        n, rl = nominal.get(uf, {}).get(str(a)), real.get(uf, {}).get(str(a))
        celulas.append(f"{n:6.2f}/{rl:8.2f}" if n is not None else "               -")
    print(f"{uf:4} " + " ".join(f"{c:>16}" for c in celulas))

# síntese de verificação
print("\n--- VERIFICAÇÃO: valor da produção (mil R$), 2024 ---")
print(f"{'UF':4} {'Total':>12} {'Açaí (3403)':>12} {'Castanha (3405)':>15} {'Madeira tora':>13}")
for uf in ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]:
    tot24 = next((r["valor_mil_rs"] for r in tot_rows if r["uf"] == uf and r["ano"] == 2024), None)
    acai = next((r["valor_mil_rs"] for r in det_rows if r["uf"] == uf and r["ano"] == 2024 and r["cod_produto"] == "3403"), None)
    cast = next((r["valor_mil_rs"] for r in det_rows if r["uf"] == uf and r["ano"] == 2024 and r["cod_produto"] == "3405"), None)
    mad = next((r["valor_mil_rs"] for r in det_rows if r["uf"] == uf and r["ano"] == 2024 and r["cod_produto"] == "3435"), None)
    fmt = lambda x: f"{x:,.0f}" if x is not None else "-"
    print(f"{uf:4} {fmt(tot24):>12} {fmt(acai):>12} {fmt(cast):>15} {fmt(mad):>13}")
