#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 2 / I2.4.1 — CVLI por UF e ano, das bases Sinesp/VDE do MJ.

CVLI = homicídio doloso + roubo seguido de morte (latrocínio) + lesão corporal
seguida de morte. A definição não muda: é a mesma soma dos três eventos que o
painel já usava, agregada pelo ano que está no dado, não pelo nome do arquivo.

O MJ publica a série a partir de 2015, e o script baixa o que existir — antes ele
dependia dos xlsx já estarem em dados/sinesp/. O HEAD é bloqueado pelo servidor,
então a existência de cada ano se descobre pelo próprio GET.

Ressalva da fonte, que vale registrar: os números refletem o estágio de
consolidação de cada UF no Sinesp VDE na data da extração. Baixar de novo o mesmo
ano pode devolver valores diferentes, sobretudo nos anos recentes.

Saídas:
  - dados/sinesp/cvli_uf_ano.csv
  - dashboard/public/data/cvli.json (versionado)
"""
import csv, datetime, json, os, ssl, urllib.error, urllib.request
from collections import defaultdict
from openpyxl import load_workbook

PASTA = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DADOS = os.path.join(PASTA, "dados")
PUBLICO = os.path.join(PASTA, "dashboard", "public", "data")
URL = ("https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/"
       "download/dnsp-base-de-dados/bancovde-{}.xlsx")
CABECALHOS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
    "Accept-Language": "pt-BR,pt;q=0.9",
    "Referer": "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/dados-nacionais-1",
}
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def baixar(ano, destino):
    """Baixa se ainda não houver. Devolve True se o arquivo existe ao fim."""
    if os.path.exists(destino) and os.path.getsize(destino) > 100000:
        return True
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    # O servidor corta a conexão no meio com alguma frequência (IncompleteRead). Sem
    # repetir, o ano sumiria da série sem avisar, que é pior do que demorar mais.
    for tentativa in range(4):
        try:
            req = urllib.request.Request(URL.format(ano), headers=CABECALHOS)
            with urllib.request.urlopen(req, timeout=900, context=CTX) as r:
                dados = r.read()
            if dados[:2] != b"PK":
                print(f"  {ano}: resposta não é xlsx — provavelmente o ano não existe", flush=True)
                return False
            with open(destino, "wb") as f:
                f.write(dados)
            print(f"  {ano}: baixado, {len(dados)/1e6:.1f} MB", flush=True)
            return True
        except urllib.error.HTTPError as e:
            print(f"  {ano}: HTTP {e.code} — ano indisponível", flush=True)
            return False
        except Exception as e:
            print(f"  {ano}: tentativa {tentativa + 1}, {type(e).__name__} {str(e)[:50]}", flush=True)
    print(f"  {ano}: DESISTIU após 4 tentativas — o ano fica fora da série", flush=True)
    return False
UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
CVLI_EVENTOS = {"Homicídio doloso", "Roubo seguido de morte (latrocínio)", "Lesão corporal seguida de morte"}

def num(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0

agreg = defaultdict(lambda: defaultdict(int))  # uf -> ano -> total
info = {}
print("bases Sinesp/VDE (o MJ publica a partir de 2015):", flush=True)
for ano in range(2015, 2028):
    path = os.path.join(DADOS, "sinesp", f"bancovde-{ano}.xlsx")
    if not baixar(ano, path):
        continue
    print(f"  lendo {ano}...", flush=True)
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb[wb.sheetnames[0]]
    rows = ws.iter_rows(min_row=2, values_only=True)
    datas = set()
    muns = set()
    n = 0
    for r in rows:
        uf, mun, evento, data = r[0], r[1], r[2], r[3]
        if uf is None:
            continue
        n += 1
        uf = str(uf).strip().upper()
        a = str(data)[:4]
        datas.add(a)
        muns.add(str(mun).strip().upper())
        if evento and evento.strip() in CVLI_EVENTOS:
            total = num(r[7]) + num(r[8]) + num(r[9])
            agreg[uf][a] += total
    info[ano] = (n, sorted(datas), len(muns))
    wb.close()

for ano, (n, datas, m) in sorted(info.items()):
    print(f"base {ano}: {n} linhas | anos cobertos: {datas} | municípios: {m}")

print()
print("CVLI (nº de vítimas/ocorrências) por UF/ano:")
anos_todos = sorted({a for uf in agreg for a in agreg[uf]})
print("UF | " + " | ".join(anos_todos))
for uf in sorted(agreg):
    print(uf + " | " + " | ".join(str(agreg[uf].get(a, "")) for a in anos_todos))

# salvar CSV
with open(os.path.join(DADOS, "sinesp", "cvli_uf_ano.csv"), "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["uf", "ano", "cvli"])
    for uf in sorted(agreg):
        for a in anos_todos:
            if a in agreg[uf]:
                w.writerow([uf, a, agreg[uf][a]])
print("\nCSV salvo: dados/cvli_uf_ano.csv")

# ---------- consolidado versionado ----------
UFS_AL = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
serie = {uf: {a: agreg[uf][a] for a in sorted(agreg.get(uf, {}))} for uf in UFS_AL if uf in agreg}
anos_al = sorted({a for v in serie.values() for a in v})
payload = {
    "indicador": "I2.4.1",
    "nome": "CVLI — crimes violentos letais intencionais",
    "unidade": "ocorrências",
    "atualizadoEm": datetime.date.today().isoformat(),
    "fonte": {
        "sistema": "Ministério da Justiça — Sinesp VDE, Dados Nacionais de Segurança Pública",
        "arquivos": "bancovde-AAAA.xlsx",
        "definicao": "Soma de homicídio doloso, roubo seguido de morte (latrocínio) e lesão "
                     "corporal seguida de morte — a mesma do painel antes desta extensão.",
        "agregacao": "Pelo ano que consta no dado, não pelo nome do arquivo.",
    },
    "anos": anos_al,
    "nota": "Os números refletem o estágio de consolidação de cada UF no Sinesp VDE na data da "
            "extração. Baixar de novo o mesmo ano pode devolver valores diferentes, sobretudo "
            "nos anos recentes, e o ano corrente fica sempre incompleto.",
    "serie": serie,
}
destino_json = os.path.join(PUBLICO, "cvli.json")
with open(destino_json, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("Consolidado versionado ->", os.path.relpath(destino_json, PASTA))
