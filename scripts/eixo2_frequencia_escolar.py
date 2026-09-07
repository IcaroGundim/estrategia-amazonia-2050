#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 2 / I2.3.2 — Frequência escolar 15-17 anos: série histórica via SIDRA.

Fonte principal: PNAD Contínua anual, módulo Educação — tabela SIDRA 7138
("Taxa de escolarização, por sexo e grupo de idade"), variável 10276, grupo de
idade 2792 ("15 a 17 anos"). É o mesmo conceito da "taxa bruta de frequência
escolar" da Tabela 4.1 do SIS que `sis_pobreza_escola.py` lê do xls: percentual
das pessoas de 15 a 17 anos que frequentavam escola. A conferência no fim do
script compara o valor da SIDRA com o do SIS que o painel já publica em I2.3.2
(`catalogo.json`, extra.faixa15a17): as 9 UFs bateram exatamente em 2024.

Cobertura: 2016-2025 (10 anos), mas **sem 2020 e 2021** — o módulo de Educação
da PNADc não foi a campo nesses dois anos por causa da pandemia. Não existe
substituto do IBGE para eles: o FTP só publica as tabelas de Educação de 2016 a
2018 e a divulgação seguinte pula direto de 2019 para 2022. São 8 pontos reais.

O agregado da Amazônia Legal não é média simples: vem da razão entre os totais
das tabelas 7136 (estudantes, mil pessoas) e 7109 (população, mil pessoas), nas
mesmas faixa e periodicidade, então usa os próprios pesos da PNADc em vez de uma
projeção populacional externa.

Complementos gravados junto:
  - Censo 2022 (tabela 10139) por município — única fonte com detalhe municipal.
  - IDS/PNAD antiga (tabela 1184) por UF, para contexto anterior à PNADc. A tabela
    vai de 1992 a 2009, mas para estas 9 UFs só devolve 2007-2009. Metodologia
    diferente da PNADc: não emendar na mesma série sem ressalva.

CSVs de trabalho em dados/ibge_educacao/ (pasta local, como nos demais pipelines):
  - freq_escolar_15a17_uf_ano.csv        (uf, ano, taxa, cv — 9 UFs + Norte + BR)
  - freq_escolar_15a17_al_ano.csv        (ano, taxa, estudantes_mil, populacao_mil)
  - freq_escolar_15a17_municipio_2022.csv (uf, cod_municipio, municipio, taxa)
  - freq_escolar_15a17_uf_pnad_antiga.csv (uf, ano, taxa — PNAD antiga)

E o consolidado versionado, que vai junto com o site:
  - dashboard/public/data/frequencia-escolar-15a17.json

O JSON usa o mesmo formato de `serieAnual` do catalogo.json ({UF: {ano: valor}}),
com `null` explícito em 2020 e 2021 para o gráfico poder desenhar a lacuna em vez
de ligar 2019 a 2022 numa reta que não existiu. Ele fica fora da lista
DATA_GERADOS do build-static.mjs, então `npm run build:static` não o apaga.
"""
import csv
import datetime
import gzip
import io
import json
import os
import sys
import urllib.request

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
SAIDA = os.path.join(PASTA, "dados", "ibge_educacao")
PUBLICO = os.path.join(PASTA, "dashboard", "public", "data")
os.makedirs(SAIDA, exist_ok=True)

UFS = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
       "16": "AP", "17": "TO", "21": "MA", "51": "MT"}
FAIXA = "2792"   # grupo de idade "15 a 17 anos"
SEXO = "6794"    # sexo "Total"
ANOS = "2016-2025"


def sidra(path):
    url = "https://apisidra.ibge.gov.br/values" + path
    req = urllib.request.Request(url, headers={"Accept-Encoding": "identity", "User-Agent": "Mozilla/5.0"})
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300) as r:
                data = r.read()
                if data[:2] == b"\x1f\x8b":
                    data = gzip.decompress(data)
                return json.loads(data)[1:]
        except Exception as e:
            print("  retry", tentativa + 1, "erro:", e)
            if tentativa == 2:
                raise


def num(v):
    if v in (None, "", "-", "...", "..", "X"):
        return None
    try:
        return float(str(v).strip().replace(",", "."))
    except ValueError:
        return None


def gravar(nome, campos, linhas):
    destino = os.path.join(SAIDA, nome)
    with open(destino, "w", encoding="utf-8", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=campos)
        escritor.writeheader()
        escritor.writerows(linhas)
    print(f"  {len(linhas)} linhas -> {destino}")
    return destino


# --------------- Série por UF (PNADc anual, tabela 7138) ---------------
print(f"SIDRA t7138 v10276 — taxa de escolarização 15-17 anos, {ANOS}")
recorte = f"/v/10276,10277/p/{ANOS}/c2/{SEXO}/c58/{FAIXA}"
estados = sidra(f"/t/7138/n3/{','.join(UFS)}" + recorte)
norte = sidra("/t/7138/n2/1" + recorte)
brasil = sidra("/t/7138/n1/1" + recorte)

# A API devolve taxa e coeficiente de variação como linhas separadas (D2C).
serie = {}
for registro, rotulo in ((estados, None), (norte, "Norte"), (brasil, "BR")):
    for r in registro:
        uf = rotulo or UFS[r["D1C"]]
        chave = (uf, int(r["D3C"]))
        valor = num(r["V"])
        if valor is None:
            continue
        serie.setdefault(chave, {})["cv" if r["D2C"] == "10277" else "taxa"] = valor

linhas_uf = [{"uf": uf, "ano": ano, "taxa": v.get("taxa"), "cv": v.get("cv")}
             for (uf, ano), v in sorted(serie.items()) if v.get("taxa") is not None]
gravar("freq_escolar_15a17_uf_ano.csv", ["uf", "ano", "taxa", "cv"], linhas_uf)

anos = sorted({l["ano"] for l in linhas_uf})
faltando = [a for a in range(anos[0], anos[-1] + 1) if a not in anos]
print(f"  anos com dado: {anos[0]}-{anos[-1]} ({len(anos)} pontos)")
if faltando:
    print(f"  sem coleta do módulo Educação: {', '.join(map(str, faltando))}")

# --------------- Agregado da Amazônia Legal (tabelas 7136 e 7109) ---------------
print("\nSIDRA t7136 / t7109 — estudantes e população de 15-17 anos, para agregar a AL")
estudantes = sidra(f"/t/7136/n3/{','.join(UFS)}/v/10272/p/{ANOS}/c2/{SEXO}/c58/{FAIXA}")
populacao = sidra(f"/t/7109/n3/{','.join(UFS)}/v/606/p/{ANOS}/c2/{SEXO}/c58/{FAIXA}")

totais = {}
for registro, campo in ((estudantes, "estudantes_mil"), (populacao, "populacao_mil")):
    for r in registro:
        valor = num(r["V"])
        if valor is None:
            continue
        alvo = totais.setdefault(int(r["D3C"]), {"estudantes_mil": 0.0, "populacao_mil": 0.0, "ufs": set()})
        alvo[campo] += valor
        alvo["ufs"].add(UFS[r["D1C"]])

linhas_al = []
for ano in sorted(totais):
    t = totais[ano]
    if len(t["ufs"]) < len(UFS) or not t["populacao_mil"]:
        print(f"  {ano}: cobertura incompleta ({len(t['ufs'])}/{len(UFS)} UFs) — ano descartado")
        continue
    linhas_al.append({
        "ano": ano,
        "taxa": round(100 * t["estudantes_mil"] / t["populacao_mil"], 1),
        "estudantes_mil": round(t["estudantes_mil"], 1),
        "populacao_mil": round(t["populacao_mil"], 1),
    })
gravar("freq_escolar_15a17_al_ano.csv", ["ano", "taxa", "estudantes_mil", "populacao_mil"], linhas_al)

# --------------- Censo 2022 por município (tabela 10139) ---------------
print("\nSIDRA t10139 — Censo 2022, taxa de escolarização 15-17 por município")
municipios = sidra(f"/t/10139/n6/in%20n3%20{','.join(UFS)}/v/12805/p/2022/c2/{SEXO}/c58/{FAIXA}/c839/46583")
linhas_mun = []
for r in municipios:
    taxa = num(r["V"])
    if taxa is None:
        continue
    nome, _, sigla = r["D1N"].rpartition(" - ")
    linhas_mun.append({"uf": sigla, "cod_municipio": r["D1C"], "municipio": nome, "taxa": taxa})
linhas_mun.sort(key=lambda x: (x["uf"], x["municipio"]))
gravar("freq_escolar_15a17_municipio_2022.csv", ["uf", "cod_municipio", "municipio", "taxa"], linhas_mun)

# --------------- Contexto de longo prazo (IDS/PNAD antiga, tabela 1184) ---------------
print("\nSIDRA t1184 — PNAD antiga, taxa de escolarização 15-17 por UF, 1992-2009")
antiga = sidra(f"/t/1184/n3/{','.join(UFS)}/v/2511/p/all/c58/{FAIXA}")
linhas_antiga = [{"uf": UFS[r["D1C"]], "ano": int(r["D3C"]), "taxa": num(r["V"])}
                 for r in antiga if num(r["V"]) is not None]
linhas_antiga.sort(key=lambda x: (x["uf"], x["ano"]))
gravar("freq_escolar_15a17_uf_pnad_antiga.csv", ["uf", "ano", "taxa"], linhas_antiga)

# --------------- Consolidado versionado para o painel ---------------
todos_anos = list(range(int(ANOS.split("-")[0]), int(ANOS.split("-")[1]) + 1))
serie_anual = {}
for uf in list(UFS.values()) + ["Norte", "BR"]:
    valores = {l["ano"]: l["taxa"] for l in linhas_uf if l["uf"] == uf}
    serie_anual[uf] = {str(a): valores.get(a) for a in todos_anos}
serie_anual["AL"] = {str(a): next((l["taxa"] for l in linhas_al if l["ano"] == a), None) for a in todos_anos}

payload = {
    "indicador": "I2.3.2",
    "nome": "Taxa de frequência escolar, 15 a 17 anos",
    "unidade": "%",
    "atualizadoEm": datetime.date.today().isoformat(),
    "fonte": {
        "pesquisa": "IBGE — PNAD Contínua anual, módulo Educação",
        "tabelas": {
            "taxaPorUf": "SIDRA 7138 (v10276, c58=15 a 17 anos)",
            "agregadoAl": "SIDRA 7136 e 7109 (estudantes / população de 15 a 17 anos)",
            "municipios": "SIDRA 10139 (Censo Demográfico 2022)",
            "pnadAntiga": "SIDRA 1184 (PNAD antiga, série encerrada)",
        },
        "conceito": "percentual das pessoas de 15 a 17 anos que frequentavam escola; "
                    "mesma definição da taxa bruta de frequência escolar da Tabela 4.1 do SIS",
    },
    "anos": [str(a) for a in todos_anos],
    "anosSemColeta": [str(a) for a in faltando],
    "notaLacuna": "O módulo de Educação da PNAD Contínua não foi a campo em 2020 e 2021 "
                  "por causa da pandemia; a variação de 2019 para 2022 atravessa dois anos "
                  "sem medição e não deve ser lida como variação anual.",
    "serieAnual": serie_anual,
    "coeficienteVariacao": {
        uf: {str(l["ano"]): l["cv"] for l in linhas_uf if l["uf"] == uf and l["cv"] is not None}
        for uf in list(UFS.values()) + ["Norte", "BR"]
    },
    "amazoniaLegal": [
        {"ano": str(l["ano"]), "taxa": l["taxa"],
         "estudantesMil": l["estudantes_mil"], "populacaoMil": l["populacao_mil"]}
        for l in linhas_al
    ],
    "municipiosCenso2022": [
        {"uf": l["uf"], "codigo": l["cod_municipio"], "nome": l["municipio"], "taxa": l["taxa"]}
        for l in linhas_mun
    ],
    "pnadAntiga": {
        uf: {str(l["ano"]): l["taxa"] for l in linhas_antiga if l["uf"] == uf}
        for uf in sorted({l["uf"] for l in linhas_antiga})
    },
}
destino_json = os.path.join(PUBLICO, "frequencia-escolar-15a17.json")
with open(destino_json, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"\nConsolidado versionado -> {destino_json}")

# --------------- Relatório ---------------
print("\nTaxa de frequência escolar 15-17 anos (%) — PNAD Contínua anual")
cabecalho = "UF " + " ".join(f"{a:>6}" for a in anos)
print(cabecalho)
for uf in list(UFS.values()) + ["Norte", "BR"]:
    valores = {l["ano"]: l["taxa"] for l in linhas_uf if l["uf"] == uf}
    print(f"{uf:5} " + " ".join(f"{valores[a]:6.1f}" if a in valores else "     -" for a in anos))
al = {l["ano"]: l["taxa"] for l in linhas_al}
print(f"{'AL':5} " + " ".join(f"{al[a]:6.1f}" if a in al else "     -" for a in anos))

if linhas_al:
    primeiro, ultimo = linhas_al[0], linhas_al[-1]
    print(f"\nAmazônia Legal: {primeiro['taxa']:.1f}% ({primeiro['ano']}) -> "
          f"{ultimo['taxa']:.1f}% ({ultimo['ano']}), {ultimo['taxa'] - primeiro['taxa']:+.1f} p.p.")

# Conferência contra o valor do SIS que o painel já publica em I2.3.2 (extra.faixa15a17).
def achar_indicador(no, codigo):
    if isinstance(no, dict):
        if no.get("codigo") == codigo:
            return no
        for v in no.values():
            achado = achar_indicador(v, codigo)
            if achado:
                return achado
    elif isinstance(no, list):
        for v in no:
            achado = achar_indicador(v, codigo)
            if achado:
                return achado
    return None


catalogo = os.path.join(PASTA, "dashboard", "public", "data", "catalogo.json")
with open(catalogo, encoding="utf-8") as f:
    indicador = achar_indicador(json.load(f), "I2.3.2") or {}
sis = {uf: v.get("faixa15a17") for uf, v in (indicador.get("extra") or {}).items()}
ano_sis = 2024  # anoRef do I2.3.2 hoje: SIS 2025, com dados da PNADc 2024
if sis:
    print(f"\nConferência {ano_sis} — SIDRA t7138 x SIS (Tabela 4.1) publicado no painel:")
    maior = 0.0
    for uf in sorted(UFS.values()):
        novo = next((l["taxa"] for l in linhas_uf if l["uf"] == uf and l["ano"] == ano_sis), None)
        antigo = sis.get(uf)
        if novo is None or antigo is None:
            continue
        maior = max(maior, abs(novo - antigo))
        print(f"  {uf}  SIDRA {novo:5.1f}%   SIS {antigo:5.1f}%   dif {novo - antigo:+.1f} p.p.")
    print(f"  maior divergência: {maior:.1f} p.p.")
else:
    print(f"\n(I2.3.2 sem extra.faixa15a17 em {catalogo} — conferência pulada)")
