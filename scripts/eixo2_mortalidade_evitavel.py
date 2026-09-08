#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 2 / I2.2.1 — Óbitos por causas evitáveis em menores de 5 anos (SIM/DATASUS).

O catálogo trazia só 2024. O TabNet publica a mesma tabulação desde 1996, então o
indicador ganha série de três décadas sem trocar de fonte nem de definição.

A tabulação é a `sim/cnv/evita10uf.def`, cujo título é "Óbitos por causas evitáveis
em menores de 5 anos" — a Lista Brasileira de Causas de Mortes Evitáveis no recorte
de 0 a 4 anos, que é exatamente o que a coleta de 2024 já usava (o `extra` do
catálogo guarda `obitosEvitaveisMenor5`). O incremento é "Óbitos p/Residência", que
atribui o óbito ao estado onde a pessoa morava, e não onde morreu.

**Só a contagem, de propósito.** A ficha define a taxa como óbitos sobre população, e
o painel divide pela população de 0 a 4 anos da revisão de 2024 da projeção do IBGE —
que não está publicada na SIDRA (a tabela 7358 traz a revisão de 2018, que dá 82.857
crianças no Acre em 2024 contra as 88.080 que o painel usa). Calcular a taxa com outra
revisão poria uma quebra de denominador no meio da série. A contagem não depende de
denominador e é o dado bruto do indicador; a taxa se monta quando a série de
população estiver disponível.

Duas ressalvas que o próprio TabNet declara e que vão para o JSON: os dados são
finais até 2024, 2025 é preliminar e 2026 é primeira prévia. E a revisão mexe nos
números: o catálogo registrou 317 óbitos no Acre em 2024 e a extração de hoje dá 298.

Saídas:
  - dados/datasus/obitos_evitaveis_uf_ano.csv
  - dashboard/public/data/mortalidade-evitavel.json (versionado)
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
SAIDA = os.path.join(PASTA, "dados", "datasus")
PUBLICO = os.path.join(PASTA, "dashboard", "public", "data")
os.makedirs(SAIDA, exist_ok=True)

DEF = "sim/cnv/evita10uf.def"
URL = "http://tabnet.datasus.gov.br/cgi/tabcgi.exe?" + DEF
REFERER = "http://tabnet.datasus.gov.br/cgi/deftohtm.exe?" + DEF
# Códigos do IBGE que abrem cada linha da tabela do TabNet.
UFS = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
       "16": "AP", "17": "TO", "21": "MA", "51": "MT"}

# O servidor negocia TLS antigo; sem isso a conexão nem abre daqui.
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE
try:
    CTX.set_ciphers("DEFAULT@SECLEVEL=1")
except ssl.SSLError:
    pass
CTX.options |= 0x4  # OP_LEGACY_SERVER_CONNECT

CABECALHOS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded",
    "Referer": REFERER,
}


def anos_publicados():
    """Lê o formulário para saber quais anos o TabNet oferece, em vez de fixar a faixa."""
    req = urllib.request.Request(REFERER, headers={"User-Agent": CABECALHOS["User-Agent"]})
    with urllib.request.urlopen(req, timeout=300, context=CTX) as r:
        html = r.read().decode("latin-1")
    arquivos = re.findall(r'VALUE=["\']?(evitauf(\d{2})\.dbf)["\']?', html, re.I)
    anos = {}
    for arquivo, aa in arquivos:
        ano = 1900 + int(aa) if int(aa) >= 90 else 2000 + int(aa)
        anos[ano] = arquivo
    return dict(sorted(anos.items()))


def consultar(arquivo):
    campos = [
        ("Linha", "Unidade_da_Federação"),
        ("Coluna", "--Não-Ativa--"),
        ("Incremento", "Óbitos_p/Residênc"),
        ("Arquivos", arquivo),
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


def numero(texto):
    limpo = re.sub(r"[^\d]", "", texto or "")
    return int(limpo) if limpo else None


def linhas_da_tabela(html):
    """O TabNet gera HTML antigo, sem fechar TR nem TD:

        <TR align="right">
        <TD ALIGN=LEFT>11 Rondônia
        <TD>362

    Por isso não dá para casar '<TD>...</TD>' — a leitura é por corte no '<TD'.
    """
    saida = {}
    for bloco in re.split(r"<TR", html, flags=re.I)[1:]:
        celulas = []
        for pedaco in re.split(r"<TD", bloco, flags=re.I)[1:]:
            texto = pedaco.split(">", 1)[1] if ">" in pedaco else pedaco
            celulas.append(texto.split("<")[0].strip())
        if len(celulas) < 2:
            continue
        m = re.match(r"^(\d{2})\s", celulas[0])
        if m and m.group(1) in UFS:
            valor = numero(celulas[1])
            if valor is not None:
                saida[UFS[m.group(1)]] = valor
    return saida


print("SIM/DATASUS — óbitos por causas evitáveis em menores de 5 anos")
arquivos = anos_publicados()
print(f"  anos oferecidos pelo TabNet: {min(arquivos)}-{max(arquivos)} ({len(arquivos)})")

serie = {}
for ano, arquivo in arquivos.items():
    html = consultar(arquivo)
    por_uf = linhas_da_tabela(html)
    if not por_uf:
        print(f"  {ano}: sem linhas reconhecidas, ignorado", flush=True)
        continue
    for uf, valor in por_uf.items():
        serie.setdefault(uf, {})[ano] = valor
    print(f"  {ano}: {len(por_uf)} UFs, {sum(por_uf.values()):,} óbitos na AL", flush=True)

# O rodapé diz até onde o dado é final e de quando é cada extração. Guardar junto do
# número evita que alguém compare um ano fechado com uma prévia sem perceber.
nota = ""
m = re.search(r"<b>\s*Notas?\s*</b>\s*:?\s*<ol>(.*?)</ol>", html, re.S | re.I)
if m:
    itens = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", i)).strip()
             for i in re.split(r"<li>", m.group(1), flags=re.I)[1:]]
    nota = " ".join(i for i in itens if i)

anos = sorted({a for v in serie.values() for a in v})
# "Dados finais disponíveis até AAAA" — tudo depois disso é preliminar ou prévia.
m_final = re.search(r"finais dispon[ií]veis at[ée]\s*(\d{4})", nota, re.I)
ano_final = int(m_final.group(1)) if m_final else None
anos_preliminares = [a for a in anos if ano_final and a > ano_final]

destino = os.path.join(SAIDA, "obitos_evitaveis_uf_ano.csv")
with open(destino, "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f)
    w.writerow(["uf", "ano", "obitos_evitaveis_menor5"])
    for uf in sorted(serie):
        for ano in sorted(serie[uf]):
            w.writerow([uf, ano, serie[uf][ano]])
print(f"\n  {sum(len(v) for v in serie.values())} linhas -> {destino}")

payload = {
    "indicador": "I2.2.1",
    "nome": "Óbitos por causas evitáveis em menores de 5 anos",
    "unidade": "óbitos",
    "atualizadoEm": datetime.date.today().isoformat(),
    "fonte": {
        "sistema": "Ministério da Saúde — SIM (Sistema de Informações sobre Mortalidade), via TabNet",
        "tabulacao": DEF,
        "titulo": "Óbitos por causas evitáveis em menores de 5 anos",
        "incremento": "Óbitos por residência — atribui o óbito ao estado onde a pessoa morava",
        "lista": "Lista Brasileira de Causas de Mortes Evitáveis, recorte de 0 a 4 anos",
        "notaDoTabnet": nota,
    },
    "anos": [str(a) for a in anos],
    "anoFinal": str(ano_final) if ano_final else None,
    "anosPreliminares": [str(a) for a in anos_preliminares],
    "notaPreliminares": "Os anos depois do último fechado não são comparáveis com os "
                        "anteriores: o SIM ainda recebe declarações. O ano da prévia mais "
                        "recente traz uma fração do total e não deve ser lido como queda.",
    "somenteContagem": "A ficha define a taxa como óbitos sobre população, mas o painel divide pela "
                       "população de 0 a 4 anos da revisão de 2024 da projeção do IBGE, que não está "
                       "publicada na SIDRA — a tabela 7358 traz a revisão de 2018 e dá 82.857 crianças "
                       "no Acre em 2024, contra as 88.080 que o painel usa. Calcular a taxa com outra "
                       "revisão poria uma quebra de denominador no meio da série, então aqui vai só a "
                       "contagem, que é o dado bruto e não depende de denominador.",
    "revisaoDoDado": "O SIM revisa os números. O catálogo registrou 317 óbitos no Acre em 2024 e a "
                     "extração desta data dá um valor diferente; rebaixar o mesmo ano pode mudar o "
                     "resultado, sobretudo nos anos ainda preliminares.",
    "serie": {uf: {str(a): v for a, v in sorted(serie[uf].items())} for uf in sorted(serie)},
}
destino_json = os.path.join(PUBLICO, "mortalidade-evitavel.json")
with open(destino_json, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"  consolidado versionado -> {os.path.relpath(destino_json, PASTA)}")

recentes = [a for a in anos if a >= max(anos) - 14]
print("\nÓbitos evitáveis em menores de 5 anos, por UF")
print("UF   " + " ".join(f"{a:>6}" for a in recentes))
for uf in ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]:
    v = serie.get(uf, {})
    print(f"{uf:4} " + " ".join(f"{v[a]:6,}" if a in v else "     -" for a in recentes))
if nota:
    print(f"\nNota do TabNet: {nota[:200]}")
