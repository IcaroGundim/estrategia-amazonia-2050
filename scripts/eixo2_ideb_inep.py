#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 2 / I2.3.1 — IDEB (INEP), série 2005-2025 por UF e por município.

O catálogo dava este indicador como pendente, com a nota "INEP Data sem API aberta;
download.inep.gov.br bloqueado". O host não está bloqueado: a página de resultados
carrega os links por aba via AJAX, e o conteúdo real está em
.../ideb/resultados/2005-2025, de onde saem os arquivos oficiais.

O que a ficha pede é "% de municípios/estados da AL que atingiram ou superaram a
meta do IDEB". Isso só é calculável até 2021: o INEP projetou metas de 2007 a 2021
e parou — as edições de 2023 e 2025 saíram sem meta. Por isso o script grava duas
coisas distintas, e não uma só:

  ideb          — o valor observado, 2005 a 2025 (11 edições), que existe sempre;
  atingiu_meta  — o indicador da ficha, 2007 a 2021 (8 edições), que exige a meta.

Juntar as duas numa linha só faria a série parecer interrompida por falta de dado,
quando o que acabou foi a meta.

O IDEB é bienal e vem em três etapas (anos iniciais, anos finais, ensino médio),
cada uma numa aba. A rede usada é a "Total" de cada território — é a que o INEP
publica como resultado do ente, e a mesma em que a meta é projetada.

Requer openpyxl. Os arquivos municipais têm ~12 MB de xlsx cada, então a leitura
demora alguns minutos.

Saídas em dados/inep/:
  - ideb_uf_ano.csv          (uf, etapa, ano, ideb, meta, atingiu)
  - ideb_municipio_ano.csv   (uf, cod_municipio, municipio, etapa, ano, ideb, meta, atingiu)
E o consolidado versionado:
  - dashboard/public/data/ideb.json
"""
import csv
import datetime
import io
import json
import os
import ssl
import sys
import urllib.request
import zipfile

import openpyxl

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
SAIDA = os.path.join(PASTA, "dados", "inep")
PUBLICO = os.path.join(PASTA, "dashboard", "public", "data")
os.makedirs(SAIDA, exist_ok=True)

UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
NOMES_UF = {"Acre": "AC", "Amapá": "AP", "Amazonas": "AM", "Maranhão": "MA",
            "Mato Grosso": "MT", "Pará": "PA", "Rondônia": "RO", "Roraima": "RR",
            "Tocantins": "TO"}
BASE_URL = "https://download.inep.gov.br/ideb/resultados/"
CABECALHOS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Referer": "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados",
}
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

ETAPAS = {"AI": "anos iniciais", "AF": "anos finais", "EM": "ensino médio"}
ARQ_MUNICIPIOS = {
    "AI": "divulgacao_anos_iniciais_municipios_2025.zip",
    "AF": "divulgacao_anos_finais_municipios_2025.zip",
    "EM": "divulgacao_ensino_medio_municipios_2025.zip",
}
ARQ_UFS = "divulgacao_regioes_ufs_ideb_2025.zip"
# Rede usada em cada nível. Na UF existe o "Total", que soma pública e privada e é onde
# o INEP projeta a meta do ente. No arquivo municipal não há "Total": as redes são
# Estadual, Municipal, Federal e Pública, e a agregada é a Pública — 809 linhas para os
# 808 municípios da AL, 808 delas com meta. É ela que representa o município.
REDE_UF = "Total"
REDE_MUNICIPIO = "Pública"


def baixar(nome):
    destino = os.path.join(SAIDA, nome)
    if os.path.exists(destino) and os.path.getsize(destino) > 100000:
        return destino
    print(f"  baixando {nome}...", flush=True)
    for tentativa in range(4):
        try:
            req = urllib.request.Request(BASE_URL + nome, headers=CABECALHOS)
            with urllib.request.urlopen(req, timeout=900, context=CTX) as r:
                dados = r.read()
            with open(destino, "wb") as f:
                f.write(dados)
            print(f"    {len(dados)/1e6:.1f} MB", flush=True)
            return destino
        except Exception as e:
            print(f"    tentativa {tentativa + 1}: {type(e).__name__} {str(e)[:50]}", flush=True)
    raise SystemExit(f"não foi possível baixar {nome}")


def abrir_planilha(zip_path):
    with zipfile.ZipFile(zip_path) as z:
        nome = [n for n in z.namelist() if n.endswith(".xlsx")][0]
        conteudo = z.read(nome)
    return openpyxl.load_workbook(io.BytesIO(conteudo), read_only=True, data_only=True)


def normaliza_rede(v):
    """O INEP põe marcadores de nota no rótulo da rede: nas UFs a linha do total vem
    como 'Total (3)(4)' e a pública como 'Pública (4)'. Corta o que vem do parêntese
    em diante para comparar pelo nome."""
    texto = str(v).strip() if v else ""
    return texto.split("(")[0].strip()


def num(v):
    if v is None:
        return None
    texto = str(v).strip().replace(",", ".")
    if texto in ("", "-", "--", "*", "ND", "nan"):
        return None
    try:
        return float(texto)
    except ValueError:
        return None


def colunas_de(linha_codigos):
    """Mapeia VL_OBSERVADO_AAAA e VL_PROJECAO_AAAA para o índice da coluna."""
    obs, meta = {}, {}
    for i, c in enumerate(linha_codigos):
        texto = str(c) if c is not None else ""
        if texto.startswith("VL_OBSERVADO_"):
            obs[int(texto.rsplit("_", 1)[1])] = i
        elif texto.startswith("VL_PROJECAO_"):
            meta[int(texto.rsplit("_", 1)[1])] = i
    return obs, meta


def linhas_da_aba(ws, limite_cabecalho=12):
    """Devolve (linha de códigos, iterador do corpo). O cabeçalho do INEP tem
    várias linhas de título antes da linha com os códigos VL_*."""
    corpo = []
    codigos = None
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if codigos is None:
            if any(str(c or "").startswith(("VL_OBSERVADO_", "VL_APROVACAO_")) for c in row):
                codigos = row
            elif i > limite_cabecalho:
                break
            continue
        corpo.append(row)
    return codigos, corpo


# --------------- UFs ---------------
print("IDEB — arquivo de regiões e UFs")
wb = abrir_planilha(baixar(ARQ_UFS))
linhas_uf = []
for sigla, rotulo in ETAPAS.items():
    aba = next((n for n in wb.sheetnames if f"({sigla})" in n), None)
    if aba is None:
        print(f"  aba de {rotulo} não encontrada")
        continue
    codigos, corpo = linhas_da_aba(wb[aba])
    obs, meta = colunas_de(codigos)
    achados = 0
    for row in corpo:
        territorio = str(row[0]).strip() if row[0] else ""
        rede = normaliza_rede(row[1] if len(row) > 1 else None)
        uf = NOMES_UF.get(territorio)
        if not uf or rede != REDE_UF:
            continue
        achados += 1
        for ano, col in sorted(obs.items()):
            valor = num(row[col]) if col < len(row) else None
            alvo = num(row[meta[ano]]) if ano in meta and meta[ano] < len(row) else None
            if valor is None and alvo is None:
                continue
            linhas_uf.append({
                "uf": uf, "etapa": rotulo, "ano": ano, "ideb": valor, "meta": alvo,
                "atingiu": None if (valor is None or alvo is None) else int(valor >= alvo),
            })
    print(f"  {rotulo}: {achados} UFs, anos {min(obs)}-{max(obs)}, metas {min(meta)}-{max(meta)}")

destino = os.path.join(SAIDA, "ideb_uf_ano.csv")
with open(destino, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["uf", "etapa", "ano", "ideb", "meta", "atingiu"])
    w.writeheader()
    w.writerows(sorted(linhas_uf, key=lambda r: (r["uf"], r["etapa"], r["ano"])))
print(f"  {len(linhas_uf)} linhas -> {destino}")

# --------------- Municípios ---------------
print("\nIDEB — arquivos municipais")
linhas_mun = []
for sigla, rotulo in ETAPAS.items():
    wbm = abrir_planilha(baixar(ARQ_MUNICIPIOS[sigla]))
    ws = wbm[wbm.sheetnames[0]]
    codigos, corpo = linhas_da_aba(ws)
    obs, meta = colunas_de(codigos)
    achados = 0
    for row in corpo:
        uf = str(row[0]).strip() if row[0] else ""
        if uf not in UFS:
            continue
        rede = normaliza_rede(row[3] if len(row) > 3 else None)
        if rede != REDE_MUNICIPIO:
            continue
        achados += 1
        for ano, col in sorted(obs.items()):
            valor = num(row[col]) if col < len(row) else None
            alvo = num(row[meta[ano]]) if ano in meta and meta[ano] < len(row) else None
            if valor is None and alvo is None:
                continue
            linhas_mun.append({
                "uf": uf, "cod_municipio": str(row[1]).strip(), "municipio": str(row[2]).strip(),
                "etapa": rotulo, "ano": ano, "ideb": valor, "meta": alvo,
                "atingiu": None if (valor is None or alvo is None) else int(valor >= alvo),
            })
    print(f"  {rotulo}: {achados} municípios da AL", flush=True)
    wbm.close()

destino_mun = os.path.join(SAIDA, "ideb_municipio_ano.csv")
with open(destino_mun, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["uf", "cod_municipio", "municipio", "etapa", "ano", "ideb", "meta", "atingiu"])
    w.writeheader()
    w.writerows(sorted(linhas_mun, key=lambda r: (r["uf"], r["municipio"], r["etapa"], r["ano"])))
print(f"  {len(linhas_mun)} linhas -> {destino_mun}")

# --------------- Consolidado versionado ---------------
anos_ideb = sorted({l["ano"] for l in linhas_uf if l["ideb"] is not None})
anos_meta = sorted({l["ano"] for l in linhas_uf if l["meta"] is not None})

serie_ideb = {}
for l in linhas_uf:
    if l["ideb"] is not None:
        serie_ideb.setdefault(l["etapa"], {}).setdefault(l["uf"], {})[str(l["ano"])] = l["ideb"]

uf_atingiu = {}
for l in linhas_uf:
    if l["atingiu"] is not None:
        uf_atingiu.setdefault(l["etapa"], {}).setdefault(l["uf"], {})[str(l["ano"])] = bool(l["atingiu"])

# O indicador da ficha: % dos municípios de cada UF que bateram a meta.
pct_mun = {}
contagem = {}
for l in linhas_mun:
    if l["atingiu"] is None:
        continue
    chave = (l["etapa"], l["uf"], str(l["ano"]))
    c = contagem.setdefault(chave, [0, 0])
    c[0] += l["atingiu"]
    c[1] += 1
for (etapa, uf, ano), (bateram, total) in contagem.items():
    pct_mun.setdefault(etapa, {}).setdefault(uf, {})[ano] = round(bateram / total * 100, 1)

payload = {
    "indicador": "I2.3.1",
    "nome": "IDEB — Índice de Desenvolvimento da Educação Básica",
    "atualizadoEm": datetime.date.today().isoformat(),
    "fonte": {
        "orgao": "INEP",
        "arquivos": BASE_URL + ARQ_UFS + " e os três arquivos municipais por etapa",
        "rede": "Total de cada território, que é a rede em que o INEP publica o resultado do "
                "ente e projeta a meta.",
        "periodicidade": "bienal",
    },
    "porQueDuasSeries": "A ficha pede o percentual que atingiu ou superou a meta, mas o INEP "
                        "projetou metas só de 2007 a 2021 — as edições de 2023 e 2025 saíram sem "
                        "meta. O valor observado do IDEB existe nas 11 edições; o cumprimento de "
                        "meta, em 8. São séries de extensões diferentes e ficam separadas para "
                        "que a segunda não pareça interrompida por falta de dado.",
    "anosIdeb": [str(a) for a in anos_ideb],
    "anosComMeta": [str(a) for a in anos_meta],
    "idebObservado": serie_ideb,
    "estadoAtingiuMeta": uf_atingiu,
    "pctMunicipiosAtingiramMeta": pct_mun,
}
destino_json = os.path.join(PUBLICO, "ideb.json")
with open(destino_json, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"\nConsolidado versionado -> {os.path.relpath(destino_json, PASTA)}")

# --------------- Relatório ---------------
for etapa in ETAPAS.values():
    print(f"\nIDEB observado — {etapa}")
    print("UF   " + " ".join(f"{a:>6}" for a in anos_ideb))
    for uf in UFS:
        v = serie_ideb.get(etapa, {}).get(uf, {})
        print(f"{uf:4} " + " ".join(f"{v[str(a)]:6.1f}" if str(a) in v else "     -" for a in anos_ideb))

print("\n% dos municípios da UF que atingiram a meta (anos iniciais)")
etapa = ETAPAS["AI"]
print("UF   " + " ".join(f"{a:>6}" for a in anos_meta))
for uf in UFS:
    v = pct_mun.get(etapa, {}).get(uf, {})
    print(f"{uf:4} " + " ".join(f"{v[str(a)]:5.0f}%" if str(a) in v else "     -" for a in anos_meta))
