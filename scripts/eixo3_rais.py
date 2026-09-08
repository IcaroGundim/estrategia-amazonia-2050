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
import datetime
import io
import json
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
# O FTP do MTE publica RAIS_ESTAB_PUB.7z, com o mesmo layout, de 2018 em diante.
# Antes disso os microdados vêm partidos por UF (AC2017.7z etc.), com outro formato,
# então 2018 é onde a série começa sem trocar de arquivo nem de leitura.
ANOS = list(range(2018, 2026))
URLS = {ano: f"ftp://ftp.mtps.gov.br/pdet/microdados/RAIS/{ano}/RAIS_ESTAB_PUB.7z" for ano in ANOS}


def baixar(ano):
    destino = os.path.join(RAIS_DIR, f"RAIS_ESTAB_PUB_{ano}.7z")
    if os.path.exists(destino) and os.path.getsize(destino) > 50_000_000:
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
    """O nome do arquivo dentro do 7z muda com o ano: 2023 e 2024 trazem
    RAIS_ESTAB_PUB.COMT, 2018 traz RAIS_ESTAB_PUB.txt. Em vez de fixar o nome,
    extrai e usa o maior arquivo — que é sempre o de dados."""
    dest = os.path.join(tempfile.gettempdir(), f"rais_estab_{ano}")
    if os.path.exists(dest):
        shutil.rmtree(dest, ignore_errors=True)
    os.makedirs(dest, exist_ok=True)
    print(f"{ano}: extraindo com py7zr ...")
    with py7zr.SevenZipFile(arq7z) as z:
        z.extractall(path=dest)
    candidatos = [os.path.join(raiz, n) for raiz, _, nomes in os.walk(dest) for n in nomes]
    if not candidatos:
        raise SystemExit(f"{ano}: nada foi extraído de {arq7z}")
    maior = max(candidatos, key=os.path.getsize)
    print(f"{ano}: extraído {os.path.basename(maior)} ({os.path.getsize(maior)/1e9:.2f} GB)")
    return maior


def agregar(comt, ano, linhas_uf, linhas_div):
    print(f"{ano}: processando {os.path.basename(comt)} ...")
    tot_uf = {}
    tot_div = {}
    with open(comt, "r", encoding="latin-1", newline="") as f:
        primeira = f.readline()
        # O separador acompanha o formato: o .COMT vem com vírgula, o .txt com
        # ponto-e-vírgula. Decidir pelo cabeçalho evita fixar um por ano.
        sep = ";" if primeira.count(";") > primeira.count(",") else ","
        f.seek(0)
        reader = csv.reader(f, delimiter=sep)
        header = next(reader)
        idx = {c.strip(): i for i, c in enumerate(header)}
        def coluna(*nomes):
            """O cabeçalho varia de grafia entre edições; falhar mostrando o que veio
            é melhor do que um KeyError sem contexto."""
            for nome in nomes:
                if nome in idx:
                    return idx[nome]
            raise SystemExit(f"{ano}: coluna não encontrada entre {nomes}. Cabeçalho: {header[:12]}")

        i_uf = coluna("UF - Código", "UF", "UF Código")
        i_cnae = coluna("CNAE 2.0 Classe - Código", "CNAE 2.0 Classe", "CNAE 2.0 Classe Código")
        i_vinc = coluna("Qtd Vínculos Ativos", "Qtd Vinculos Ativos")
        i_ativ = coluna("Ind Atividade Ano - Código", "Ind Atividade Ano", "Ind Atividade Ano Código")
        n_rows = 0
        n_ativos = 0
        for partes in reader:
            uf = UF_POR_CODIGO.get(partes[i_uf].strip())
            if uf is None:
                continue
            n_rows += 1
            if partes[i_ativ].strip() != "1":
                continue  # não ativo no ano de referência
            n_ativos += 1
            vinc_raw = partes[i_vinc].strip()
            vinc = int(vinc_raw) if vinc_raw.isdigit() else 0
            cnae = partes[i_cnae].strip().strip('"').strip()
            div = cnae[:2] if cnae[:2].isdigit() else "NA"
            tot_uf[uf] = tot_uf.get(uf, 0) + 1
            e, v = tot_div.get((uf, div), (0, 0))
            tot_div[(uf, div)] = (e + 1, v + vinc)
        print(f"{ano}: {n_rows:,} linhas de UFs da AL".replace(",", "."))
    # Guarda contra edição com o indicador de atividade não preenchido. Em 2022 o campo
    # "Ind Atividade Ano" vem 99% com o código 9 em vez de 1: no Acre são 23.199 linhas
    # com 9 contra 139 com 1, enquanto 2021 traz 11.127 com 1. Não dá para saber quais
    # estabelecimentos estavam ativos, e adotar outro critério só nesse ano quebraria a
    # comparação — então o ano sai da série, declarado.
    # O limiar é 5% porque a proporção de linhas ativas varia legitimamente com o
    # formato do arquivo: 74% a 77% nos anos em .txt (2018-2021), 20% a 24% nos anos
    # em .COMT (2023-2025), que trazem um universo bem maior de registros. O 0,3% de
    # 2022 fica duas ordens de grandeza abaixo de qualquer ano válido, então 5% separa
    # a edição defeituosa sem descartar ano bom — um limiar de 20% cortaria 2025.
    proporcao = n_ativos / n_rows if n_rows else 0
    if proporcao < 0.05:
        print(f"{ano}: DESCARTADO — só {proporcao:.1%} das linhas da AL têm "
              f"'Ind Atividade Ano' = 1; a edição não preencheu o campo.")
        descartados.append((ano, round(proporcao * 100, 2)))
        return
    for uf, n_est in sorted(tot_uf.items()):
        linhas_uf.append({"ano": ano, "uf": uf, "estabelecimentos_ativos": n_est})
    for (uf, div), (n_est, vinc) in sorted(tot_div.items()):
        linhas_div.append({"ano": ano, "uf": uf, "divisao_cnae": div,
                           "estabelecimentos_ativos": n_est, "vinculos_ativos": vinc})


linhas_uf, linhas_div, descartados = [], [], []
for ano in ANOS:
    arq = baixar(ano)
    comt = extrair(ano, arq)
    agregar(comt, ano, linhas_uf, linhas_div)
    # O .COMT descompactado passa de 1 GB; oito anos juntos encheriam o disco.
    shutil.rmtree(os.path.dirname(comt), ignore_errors=True)

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

vinc = {}
for r in linhas_div:
    vinc.setdefault(r["uf"], {}).setdefault(r["ano"], 0)
    vinc[r["uf"]][r["ano"]] += r["vinculos_ativos"]
estab = {}
for r in linhas_uf:
    estab.setdefault(r["uf"], {})[r["ano"]] = r["estabelecimentos_ativos"]
anos_ok = sorted({r["ano"] for r in linhas_uf})

payload = {
    "indicador": "F3.2",
    "nome": "Empregos formais e estabelecimentos (RAIS Estabelecimentos)",
    "atualizadoEm": datetime.date.today().isoformat(),
    "fonte": {
        "sistema": "Ministério do Trabalho — RAIS Estabelecimentos",
        "arquivo": "ftp://ftp.mtps.gov.br/pdet/microdados/RAIS/<ano>/RAIS_ESTAB_PUB.7z",
        "criterio": "Estabelecimentos com 'Ind Atividade Ano' = 1, ativos no ano de referência; "
                    "vínculos ativos em 31/12.",
        "porQueComecaEm2018": "É de 2018 em diante que o FTP publica um único RAIS_ESTAB_PUB.7z "
                              "nacional. Antes disso os microdados vêm partidos por UF "
                              "(AC2017.7z etc.), com outro formato de leitura.",
    },
    "anos": [str(a) for a in anos_ok],
    "anosDescartados": [
        {"ano": str(a), "pctLinhasAtivas": p,
         "motivo": "A edição não preencheu 'Ind Atividade Ano': as linhas vêm com o código 9 em "
                   "vez de 1, então não há como saber quais estabelecimentos estavam ativos. "
                   "Adotar outro critério só nesse ano quebraria a comparação com os demais."}
        for a, p in descartados
    ],
    "estabelecimentosAtivos": {uf: {str(a): v for a, v in sorted(estab[uf].items())} for uf in sorted(estab)},
    "vinculosAtivos": {uf: {str(a): v for a, v in sorted(vinc[uf].items())} for uf in sorted(vinc)},
}
destino_json = os.path.join(PASTA, "dashboard", "public", "data", "rais-empregos.json")
with open(destino_json, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print("Consolidado versionado ->", os.path.relpath(destino_json, PASTA))

if descartados:
    print("\nAnos descartados:")
    for a, p in descartados:
        print(f"  {a}: só {p}% das linhas da AL com indicador de atividade = 1")

print("\n--- VERIFICAÇÃO: vínculos ativos em 31/12 (por UF) ---")
print("UF   " + " ".join(f"{a:>12}" for a in anos_ok))
for uf in ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]:
    print(f"{uf:4} " + " ".join(f"{vinc.get(uf, {}).get(a, 0):>12,}".replace(",", ".") for a in anos_ok))
