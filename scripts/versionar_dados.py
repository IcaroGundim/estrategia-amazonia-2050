#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Copia para dentro do repositório os CSVs de detalhe que os pipelines produzem.

Os scripts de coleta gravam em `dados/`, que está no .gitignore por decisão do
projeto: é pasta de trabalho, com fontes brutas e arquivos grandes. O problema é que
parte do resultado só existe lá — o IDEB por município, a RAIS e a PIA por divisão
CNAE, o PEVS por produto, a APS mês a mês. Num clone feito por `git pull` esse
detalhe simplesmente não existe, e refazê-lo custa horas de download.

Os JSONs de `public/data/` guardam o recorte por UF, que é o que o painel usa. Este
script guarda o resto, em CSV, em `public/data/csv/`. CSV e não JSON porque o dado é
tabular e o arquivo fica menos da metade do tamanho; e nessa pasta porque o
`build-static.mjs` só apaga os quatro JSONs que ele mesmo gera, então o que está
aqui sobrevive ao `npm run build:static`.

Rode depois dos pipelines de coleta. O que não existir em `dados/` é apenas
reportado como ausente — o script não falha por isso, já que cada máquina tem um
subconjunto diferente coletado.

Uso: python scripts/versionar_dados.py
"""
import os
import shutil
import sys

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
DADOS = os.path.join(PASTA, "dados")
DESTINO = os.path.join(PASTA, "dashboard", "public", "data", "csv")

# Só o detalhe que não cabe nos JSONs por UF. O que já está em public/data/*.json
# não entra aqui para não guardar o mesmo número duas vezes.
ARQUIVOS = [
    ("inep/ideb_municipio_ano.csv", "IDEB por município, etapa e ano (2005-2025)"),
    ("inep/ideb_uf_ano.csv", "IDEB por UF, com meta e cumprimento"),
    ("eixo3/rais_estab_uf_divisao_ano.csv", "RAIS por UF e divisão CNAE"),
    ("eixo3/pia_divisoes_uf_ano.csv", "PIA por UF e divisão CNAE"),
    ("eixo3/pevs_por_produto_uf.csv", "PEVS por produto extrativo"),
    ("eixo3/pevs_madeireiro_uf_ano.csv", "PEVS madeireiro x não-madeireiro"),
    ("ms_aps/aps_uf_mes.csv", "Atenção primária, competência mensal"),
    ("ms_aps/aps_municipio_ultima.csv", "Atenção primária por município"),
    ("ibge_educacao/freq_escolar_15a17_municipio_2022.csv", "Frequência escolar 15-17 por município"),
    ("saneamento/censos_saneamento_municipio.csv", "Saneamento por município nos três censos"),
    ("energia/diagnostico_siga_reconstrucao.csv", "Medição do erro da reconstrução do SIGA"),
    ("datasus/obitos_evitaveis_uf_ano.csv", "Óbitos evitáveis em menores de 5 anos"),
    ("cnes/telessaude_uf_ano.csv", "Telessaúde por UF e ano"),
    ("focos/focos_calor_uf_ano.csv", "Focos de calor por UF e ano"),
]

os.makedirs(DESTINO, exist_ok=True)
copiados, ausentes, total = [], [], 0
for relativo, descricao in ARQUIVOS:
    origem = os.path.join(DADOS, relativo)
    if not os.path.exists(origem):
        ausentes.append((relativo, descricao))
        continue
    nome = os.path.basename(relativo)
    shutil.copy2(origem, os.path.join(DESTINO, nome))
    tamanho = os.path.getsize(origem)
    total += tamanho
    copiados.append((nome, tamanho, descricao))

print(f"Copiados para {os.path.relpath(DESTINO, PASTA)}:")
for nome, tamanho, descricao in copiados:
    print(f"  {nome:44} {tamanho/1024:8.1f} KB  {descricao}")
print(f"\n  {len(copiados)} arquivos, {total/1024/1024:.2f} MB")

if ausentes:
    print("\nAinda não coletados nesta máquina (rode o pipeline correspondente):")
    for relativo, descricao in ausentes:
        print(f"  {relativo:52} {descricao}")

# Um índice legível ao lado dos arquivos, para quem abrir a pasta saber o que é cada um.
indice = os.path.join(DESTINO, "README.md")
with open(indice, "w", encoding="utf-8") as f:
    f.write("# Dados de detalhe\n\n")
    f.write("Recortes que não cabem nos JSONs por UF de `public/data/`: município, divisão CNAE,\n")
    f.write("produto, competência mensal. Gerados pelos pipelines em `scripts/` e copiados para cá\n")
    f.write("por `scripts/versionar_dados.py`, porque a pasta `dados/` fica fora do versionamento.\n\n")
    f.write("| Arquivo | Tamanho | Conteúdo |\n|---|---|---|\n")
    for nome, tamanho, descricao in copiados:
        f.write(f"| `{nome}` | {tamanho/1024:.0f} KB | {descricao} |\n")
print(f"  índice -> {os.path.relpath(indice, PASTA)}")
