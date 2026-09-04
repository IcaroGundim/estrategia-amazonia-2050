#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 3 / I3.2.1 — Empregos formais e estabelecimentos: RAIS Estabelecimentos (MTE).

Baixa RAIS_ESTAB_PUB.7z (2023 e 2024) do FTP do MTE, extrai o arquivo .COMT
(CSV nacional, separador vírgula, layout 2023/2024) e agrega, para os 9
estados da Amazônia Legal: número de estabelecimentos ativos no ano e
quantidade de vínculos ativos, por UF x divisão CNAE (2 dígitos).

Saídas em dados/eixo3/:
  - rais_estab_uf_ano.csv         (total por UF/ano)
  - rais_estab_uf_divisao_ano.csv (por UF x divisão CNAE/ano)
Arquivos brutos mantidos em dados/eixo3/rais/.
"""
import csv
import io
import os
import shutil
import subprocess
import sys
import tempfile

import py7zr

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
SAIDA = os.path.join(PASTA, "dados", "eixo3")
RAIS_DIR = os.path.join(SAIDA, "rais")
os.makedirs(RAIS_DIR, exist_ok=True)

UF_POR_CODIGO = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
                 "16": "AP", "17": "TO", "21": "MA", "51": "MT"}
ANOS = [2023, 2024]
URLS = {
    2023: "ftp://ftp.mtps.gov.br/pdet/microdados/RAIS/2023/RAIS_ESTAB_PUB.7z",
    2024: "ftp://ftp.mtps.gov.br/pdet/microdados/RAIS/2024/RAIS_ESTAB_PUB.7z",
}


def baixar(ano):
    destino = os.path.join(RAIS_DIR, f"RAIS_ESTAB_PUB_{ano}.7z")
    if os.path.exists(destino) and os.path.getsize(destino) > 100_000_000:
        print(f"{ano}: arquivo já baixado ({os.path.getsize(destino)/1e6:.0f} MB)")
        return destino
    print(f"{ano}: baixando {URLS[ano]} ...")
    subprocess.run(
        ["curl.exe", "-sS", "--retry", "3", "--retry-delay", "2", "--max-time", "1800",
         "--user", "anonymous:anonymous", "-o", destino, URLS[ano]],
        check=True,
    )
    print(f"{ano}: baixado ({os.path.getsize(destino)/1e6:.0f} MB)")
    return destino


def extrair(ano, arq7z):
    dest = os.path.join(tempfile.gettempdir(), f"rais_estab_{ano}")
    comt = os.path.join(dest, "RAIS_ESTAB_PUB.COMT")
    if not os.path.exists(comt):
        if os.path.exists(dest):
            shutil.rmtree(dest, ignore_errors=True)
        os.makedirs(dest, exist_ok=True)
        print(f"{ano}: extraindo com py7zr ...")
        with py7zr.SevenZipFile(arq7z) as z:
            z.extractall(path=dest)
    print(f"{ano}: extraído em {comt} ({os.path.getsize(comt)/1e9:.2f} GB)")
    return comt


def agregar(comt, ano, linhas_uf, linhas_div):
    print(f"{ano}: processando {os.path.basename(comt)} ...")
    tot_uf = {}
    tot_div = {}
    with open(comt, "r", encoding="latin-1", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        idx = {c.strip(): i for i, c in enumerate(header)}
        i_uf = idx["UF - Código"]
        i_cnae = idx["CNAE 2.0 Classe - Código"]
        i_vinc = idx["Qtd Vínculos Ativos"]
        i_ativ = idx["Ind Atividade Ano - Código"]
        n_rows = 0
        for partes in reader:
            uf = UF_POR_CODIGO.get(partes[i_uf].strip())
            if uf is None:
                continue
            n_rows += 1
            if partes[i_ativ].strip() != "1":
                continue  # não ativo no ano de referência
            vinc_raw = partes[i_vinc].strip()
            vinc = int(vinc_raw) if vinc_raw.isdigit() else 0
            cnae = partes[i_cnae].strip().strip('"').strip()
            div = cnae[:2] if cnae[:2].isdigit() else "NA"
            tot_uf[uf] = tot_uf.get(uf, 0) + 1
            e, v = tot_div.get((uf, div), (0, 0))
            tot_div[(uf, div)] = (e + 1, v + vinc)
        print(f"{ano}: {n_rows:,} linhas de UFs da AL".replace(",", "."))
    for uf, n_est in sorted(tot_uf.items()):
        linhas_uf.append({"ano": ano, "uf": uf, "estabelecimentos_ativos": n_est})
    for (uf, div), (n_est, vinc) in sorted(tot_div.items()):
        linhas_div.append({"ano": ano, "uf": uf, "divisao_cnae": div,
                           "estabelecimentos_ativos": n_est, "vinculos_ativos": vinc})


linhas_uf, linhas_div = [], []
for ano in ANOS:
    arq = baixar(ano)
    comt = extrair(ano, arq)
    agregar(comt, ano, linhas_uf, linhas_div)

linhas_uf.sort(key=lambda r: (r["ano"], r["uf"]))
linhas_div.sort(key=lambda r: (r["ano"], r["uf"], r["divisao_cnae"]))

for nome, dados, cols in [
    ("rais_estab_uf_ano.csv", linhas_uf, ["ano", "uf", "estabelecimentos_ativos"]),
    ("rais_estab_uf_divisao_ano.csv", linhas_div,
     ["ano", "uf", "divisao_cnae", "estabelecimentos_ativos", "vinculos_ativos"]),
]:
    path = os.path.join(SAIDA, nome)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in dados:
            w.writerow(r)
    print("salvo:", path, len(dados), "linhas")

print("\n--- VERIFICAÇÃO: vínculos ativos em 31/12 (por UF) ---")
print(f"{'UF':4} {'2023':>12} {'2024':>12}")
vinc = {}
for r in linhas_div:
    vinc.setdefault(r["uf"], {}).setdefault(r["ano"], 0)
    vinc[r["uf"]][r["ano"]] += r["vinculos_ativos"]
for uf in ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]:
    v23 = vinc.get(uf, {}).get(2023, 0)
    v24 = vinc.get(uf, {}).get(2024, 0)
    print(f"{uf:4} {v23:>12,} {v24:>12,}".replace(",", "."))
