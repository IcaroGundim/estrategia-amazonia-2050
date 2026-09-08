#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 2 / I2.2.3 — Telessaúde nos municípios da Amazônia Legal (CNES/DATASUS).

O catálogo trazia só jul/2026. O CNES publica competências mensais desde ago/2005,
então o indicador ganha vinte anos sem trocar de fonte.

A tabulação é a `cnes/cnv/estabbr.def`, filtrando o tipo de estabelecimento 35,
"TELESSAUDE" — o mesmo recorte que a coleta anterior usou, que no catálogo aparece
como "Estabelecimentos TELESSAUDE ativos". A linha é o município, e não a UF, porque
a ficha define o indicador como "municípios com estabelecimento de telessaúde
ativo / total de municípios da Amazônia Legal": é preciso saber quantos municípios
têm ao menos um, e não quantos estabelecimentos existem. A consulta por município dá
os dois números de uma vez — a soma das linhas é o total de estabelecimentos e a
contagem de linhas com valor é o número de municípios cobertos.

Uma competência por ano, a de dezembro, ou a mais recente quando o ano ainda corre.
Estabelecimento é estoque, então a leitura certa é uma fotografia, não uma média
de meses — o mesmo critério usado nas equipes de atenção primária.

O total de municípios da Amazônia Legal vem do próprio painel (`geo.json` não tem
municípios, então usa-se a contagem consolidada de 808 do IBGE, a mesma dos demais
recortes municipais deste repositório).

Saídas:
  - dados/cnes/telessaude_uf_ano.csv
  - dashboard/public/data/telessaude.json (versionado)
"""
import csv
import datetime
import json
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
SAIDA = os.path.join(PASTA, "dados", "cnes")
PUBLICO = os.path.join(PASTA, "dashboard", "public", "data")
os.makedirs(SAIDA, exist_ok=True)

DEF = "cnes/cnv/estabbr.def"
URL = "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?" + DEF
REFERER = "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?" + DEF
TIPO_TELESSAUDE = "35"
UFS = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
       "16": "AP", "17": "TO", "21": "MA", "51": "MT"}
# Municípios por UF na Amazônia Legal (IBGE), para o denominador da ficha.
MUNICIPIOS_POR_UF = {"RO": 52, "AC": 22, "AM": 62, "RR": 15, "PA": 144,
                     "AP": 16, "TO": 139, "MA": 217, "MT": 141}

CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
try:
    CTX.set_ciphers("DEFAULT@SECLEVEL=1")
except ssl.SSLError:
    pass
CTX.options |= 0x4  # o TabNet negocia TLS antigo

CABECALHOS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": REFERER,
}


def competencias():
    """Arquivos stbrAAMM.dbf oferecidos pelo formulário -> {ano: {mes: arquivo}}."""
    req = urllib.request.Request(REFERER, headers={"User-Agent": CABECALHOS["User-Agent"]})
    with urllib.request.urlopen(req, timeout=300, context=CTX) as r:
        html = r.read().decode("latin-1")
    saida = {}
    for arquivo, aa, mm in re.findall(r'VALUE=["\']?(stbr(\d{2})(\d{2})\.dbf)["\']?', html, re.I):
        saida.setdefault(2000 + int(aa), {})[int(mm)] = arquivo
    return dict(sorted(saida.items()))


def consultar(arquivo):
    campos = [
        ("Linha", "Município"),
        ("Coluna", "--Não-Ativa--"),
        ("Incremento", "Quantidade"),
        ("Arquivos", arquivo),
        ("STipo_de_Estabelecimento", TIPO_TELESSAUDE),
        ("formato", "table"),
        ("mostre", "Mostra"),
    ]
    corpo = urllib.parse.urlencode(campos, encoding="latin-1").encode("latin-1")
    for tentativa in range(4):
        try:
            req = urllib.request.Request(URL, data=corpo, headers=CABECALHOS)
            with urllib.request.urlopen(req, timeout=300, context=CTX) as r:
                return r.read().decode("latin-1")
        except Exception as e:
            print(f"    tentativa {tentativa + 1}: {type(e).__name__} {str(e)[:45]}", flush=True)
            time.sleep(2)
    raise SystemExit(f"TabNet não respondeu para {arquivo}")


def por_municipio(html):
    """O TabNet não fecha TR nem TD; a leitura é por corte. Devolve {cod6: quantidade}."""
    saida = {}
    for bloco in re.split(r"<TR", html, flags=re.I)[1:]:
        celulas = []
        for pedaco in re.split(r"<TD", bloco, flags=re.I)[1:]:
            texto = pedaco.split(">", 1)[1] if ">" in pedaco else pedaco
            celulas.append(texto.split("<")[0].strip())
        if len(celulas) < 2:
            continue
        m = re.match(r"^(\d{6})\s", celulas[0])
        if not m:
            continue
        digitos = re.sub(r"[^\d]", "", celulas[1])
        if digitos:
            saida[m.group(1)] = int(digitos)
    return saida


print("CNES/DATASUS — estabelecimentos de telessaúde (tipo 35)")
por_ano = competencias()
print(f"  competências publicadas: {min(por_ano)}-{max(por_ano)}")

linhas = []
for ano, meses in por_ano.items():
    mes = 12 if 12 in meses else max(meses)
    html = consultar(meses[mes])
    dados = por_municipio(html)
    if not dados:
        print(f"  {ano}/{mes:02d}: sem linhas reconhecidas", flush=True)
        continue
    resumo = {}
    for cod, qtd in dados.items():
        uf = UFS.get(cod[:2])
        if not uf or qtd <= 0:
            continue
        r = resumo.setdefault(uf, {"municipios": 0, "estabelecimentos": 0})
        r["municipios"] += 1
        r["estabelecimentos"] += qtd
    for uf, r in resumo.items():
        linhas.append({
            "uf": uf, "ano": ano, "mes_ref": mes,
            "municipios_com_telessaude": r["municipios"],
            "estabelecimentos": r["estabelecimentos"],
            "pct_municipios": round(r["municipios"] / MUNICIPIOS_POR_UF[uf] * 100, 1),
        })
    cobertos = sum(r["municipios"] for r in resumo.values())
    print(f"  {ano}/{mes:02d}: {cobertos} municípios da AL com telessaúde", flush=True)

anos = sorted({l["ano"] for l in linhas})
destino = os.path.join(SAIDA, "telessaude_uf_ano.csv")
with open(destino, "w", encoding="utf-8", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["uf", "ano", "mes_ref", "municipios_com_telessaude",
                                      "estabelecimentos", "pct_municipios"])
    w.writeheader()
    w.writerows(sorted(linhas, key=lambda r: (r["uf"], r["ano"])))
print(f"\n  {len(linhas)} linhas -> {destino}")

serie = lambda campo: {
    uf: {str(l["ano"]): l[campo] for l in linhas if l["uf"] == uf}
    for uf in sorted({l["uf"] for l in linhas})
}
total_al = {str(a): sum(l["municipios_com_telessaude"] for l in linhas if l["ano"] == a) for a in anos}
payload = {
    "indicador": "I2.2.3",
    "nome": "Telessaúde nos municípios da Amazônia Legal",
    "atualizadoEm": datetime.date.today().isoformat(),
    "fonte": {
        "sistema": "Ministério da Saúde — CNES, via TabNet",
        "tabulacao": DEF,
        "filtro": "Tipo de estabelecimento 35, TELESSAUDE — o mesmo recorte da coleta anterior",
        "recorteAnual": "competência de dezembro; no ano corrente, a mais recente publicada",
        "porQuePorMunicipio": "A ficha define o indicador como municípios com telessaúde ativo "
                              "sobre o total de municípios, então é preciso contar municípios com "
                              "ao menos um estabelecimento, e não estabelecimentos.",
    },
    "anos": [str(a) for a in anos],
    "denominador": {"descricao": "Municípios por UF na Amazônia Legal (IBGE)", "porUf": MUNICIPIOS_POR_UF,
                    "total": sum(MUNICIPIOS_POR_UF.values())},
    "municipiosComTelessaude": serie("municipios_com_telessaude"),
    "pctMunicipios": serie("pct_municipios"),
    "estabelecimentos": serie("estabelecimentos"),
    "totalMunicipiosAl": total_al,
}
destino_json = os.path.join(PUBLICO, "telessaude.json")
with open(destino_json, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"  consolidado versionado -> {os.path.relpath(destino_json, PASTA)}")

recentes = [a for a in anos if a >= max(anos) - 11]
print("\n% dos municípios da UF com telessaúde ativo")
print("UF   " + " ".join(f"{a:>6}" for a in recentes))
for uf in ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]:
    v = {l["ano"]: l["pct_municipios"] for l in linhas if l["uf"] == uf}
    print(f"{uf:4} " + " ".join(f"{v[a]:5.0f}%" if a in v else "     -" for a in recentes))
print("\nmunicípios da AL com telessaúde, por ano:",
      " ".join(f"{a}={total_al[str(a)]}" for a in recentes))
