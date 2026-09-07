#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 4 / I4.3.2 — Matriz elétrica: o que existe de série histórica, e o que não existe.

RESULTADO DA BUSCA, para não se refazer o caminho: **não há série histórica
publicada da participação de renováveis por UF.** Nenhuma das três fontes oficiais
cruza unidade da federação com fonte de geração ao longo do tempo:

  ANEEL, `capacidade-instalada-por-unidade-da-federacao`  UF x ano, sem fonte
  ANEEL, `empreendimentos-em-operacao`                    fonte x ano, sem UF
  ANEEL, SIGA                                             fotografia do momento
  ONS,   `capacidade-geracao`                             declara não ter histórico,
                                                          e só cobre usina despachada
                                                          pelo ONS — de fora ficam os
                                                          sistemas isolados, que é
                                                          justamente onde está o diesel
  EPE,   Anuário, Tabela 2.1                              UF x ano, sem fonte
  EPE,   Anuário, Tabela 2.3                              fonte x ano, sem UF
  EPE,   Anuário, Tabela 2.8                              renovabilidade só nacional

Reconstruir a série a partir do `DatEntradaOperacao` do SIGA não funciona, e o
script mede o erro em vez de só afirmar. São dois defeitos independentes:

  1. Sobrevivência. O SIGA só tem as fases "Operação", "Construção" e "Construção
     não iniciada" — não existe "Desativada". As térmicas a diesel aposentadas quando
     a transmissão chegou simplesmente não estão lá. No Amazonas de 2010 a
     reconstrução acha 978 MW contra 2.140 MW reais, 54% a menos, e o que falta é
     exatamente a térmica: o passado sai muito mais renovável do que foi.
  2. Datação. Usina escalonada entra como uma linha só. Belo Monte é um registro de
     11.233 MW datado 2016-04-20, embora as unidades tenham entrado até 2019 — o
     Pará de 2016 sai com 22.038 MW contra 12.966 MW reais, 70% a mais.

Os dois erros têm sinais opostos e não se cancelam. Por isso este script **não grava
série de renovabilidade por UF**: grava o que é medido de verdade.

Saídas em dados/energia/ (pasta local, como nos demais pipelines):
  - capacidade_uf_ano.csv        (uf, ano, potencia_mw, fonte_dado — EPE e ANEEL)
  - renovabilidade_brasil_ano.csv (ano, renovaveis_gwh, nao_renovaveis_gwh, pct)
  - per_uf_fonte_atual.csv       (uf, origem, potencia_mw — recorte do SIGA)
  - diagnostico_siga_reconstrucao.csv (a medição do erro, por UF e ano)

E o consolidado versionado:
  - dashboard/public/data/matriz-eletrica.json

Requer openpyxl (já em scripts/requirements.txt), como o exportar_catalogo.py.
"""
import csv
import datetime
import io
import json
import os
import ssl
import sys
import urllib.request

import openpyxl

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
DADOS = os.path.join(PASTA, "dados")
SAIDA = os.path.join(DADOS, "energia")
PUBLICO = os.path.join(PASTA, "dashboard", "public", "data")
os.makedirs(SAIDA, exist_ok=True)

UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
NOMES = {"Rondônia": "RO", "Acre": "AC", "Amazonas": "AM", "Roraima": "RR", "Pará": "PA",
         "Amapá": "AP", "Tocantins": "TO", "Maranhão": "MA", "Mato Grosso": "MT"}
RENOVAVEIS = {"Hídrica", "Solar", "Eólica", "Biomassa"}

URL_EPE = ("https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/"
           "publicacao-160/topico-168/anuario-workbook.xlsx")
URL_ANEEL_UF = ("https://dadosabertos.aneel.gov.br/dataset/cec20fdd-97e4-40a8-870f-c63339f5d8b7/resource/"
                "6fbee0f8-2617-4879-a69a-6b7892f12dad/download/capacidade-instalada-geracao-uf.csv")
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def baixar(url, destino, minimo=1000):
    if os.path.exists(destino) and os.path.getsize(destino) > minimo:
        return destino
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    print("  baixando", url.rsplit("/", 1)[-1])
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=900, context=CTX) as r, open(destino, "wb") as f:
        f.write(r.read())
    return destino


def num(v):
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):
        return float(v)
    texto = str(v).strip().replace(".", "").replace(",", ".") if "," in str(v) else str(v).strip()
    try:
        return float(texto)
    except ValueError:
        return None


def gravar(nome, campos, linhas):
    destino = os.path.join(SAIDA, nome)
    with open(destino, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=campos)
        w.writeheader()
        w.writerows(linhas)
    print(f"  {len(linhas)} linhas -> {destino}")


# --------------- EPE: capacidade por UF (Tabela 2.1) e renovabilidade nacional (2.8) ---------------
print("EPE — Anuário Estatístico de Energia Elétrica")
xlsx = baixar(URL_EPE, os.path.join(DADOS, "epe", "anuario-workbook.xlsx"), 100000)
wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)


def linhas_da_tabela(aba):
    """Devolve (anos, {rótulo: [valores]}). O cabeçalho é a linha cuja segunda coluna
    está vazia e cujas seguintes são anos de quatro dígitos."""
    anos, dados = None, {}
    for row in wb[aba].iter_rows(values_only=True):
        celulas = list(row)
        if len(celulas) < 3:
            continue
        rotulo = str(celulas[1]).strip() if celulas[1] is not None else ""
        resto = celulas[2:]
        if anos is None:
            candidatos = [int(c) for c in resto if str(c).strip().isdigit() and len(str(c).strip()) == 4]
            if len(candidatos) >= 5:
                anos = candidatos
                inicio = next(i for i, c in enumerate(resto) if str(c).strip().isdigit())
                deslocamento = inicio
            continue
        if rotulo:
            dados[rotulo] = [num(c) for c in resto[deslocamento:deslocamento + len(anos)]]
    return anos, dados


anos_epe, tab21 = linhas_da_tabela("Tabela 2.1")
print(f"  Tabela 2.1 (capacidade por UF): {anos_epe[0]}-{anos_epe[-1]}, {len(tab21)} rótulos")

capacidade = []
for nome, sigla in NOMES.items():
    valores = tab21.get(nome)
    if valores is None:
        print(f"  ATENÇÃO: {nome} não encontrado na Tabela 2.1")
        continue
    for ano, v in zip(anos_epe, valores):
        if v is not None:
            capacidade.append({"uf": sigla, "ano": ano, "potencia_mw": round(v, 1), "fonte_dado": "EPE Anuário 2.1"})
for rotulo, sigla in (("Brasil", "BR"), ("Norte", "Norte")):
    for ano, v in zip(anos_epe, tab21.get(rotulo, [])):
        if v is not None:
            capacidade.append({"uf": sigla, "ano": ano, "potencia_mw": round(v, 1), "fonte_dado": "EPE Anuário 2.1"})

anos_28, tab28 = linhas_da_tabela("Tabela 2.8")
renovabilidade = []
for ano, ren, nao, pct in zip(anos_28, tab28.get("Renováveis", []), tab28.get("Não Renováveis", []),
                              tab28.get("Renováveis (%)", [])):
    if pct is not None:
        renovabilidade.append({"ano": ano, "renovaveis_gwh": ren, "nao_renovaveis_gwh": nao,
                               "pct_renovaveis": round(pct, 2)})
print(f"  Tabela 2.8 (renovabilidade nacional): {len(renovabilidade)} anos, "
      f"{renovabilidade[0]['pct_renovaveis']}% em {renovabilidade[0]['ano']} -> "
      f"{renovabilidade[-1]['pct_renovaveis']}% em {renovabilidade[-1]['ano']}")
gravar("renovabilidade_brasil_ano.csv",
       ["ano", "renovaveis_gwh", "nao_renovaveis_gwh", "pct_renovaveis"], renovabilidade)

# --------------- ANEEL: capacidade por UF, série mais recente ---------------
print("\nANEEL — capacidade instalada por UF (dados abertos)")
csv_aneel = baixar(URL_ANEEL_UF, os.path.join(DADOS, "aneel", "capacidade_uf.csv"))
texto = open(csv_aneel, "rb").read().decode("latin-1")  # o arquivo não é UTF-8
real = {}
for r in csv.DictReader(io.StringIO(texto), delimiter=";"):
    sigla = r["SigUF"].strip()
    if sigla not in UFS or int(r["MesReferencia"]) != 12:
        continue
    mw = num(r["MdaPotenciaInstaladakW"])
    if mw is not None:
        real[(sigla, int(r["AnoReferencia"]))] = mw / 1000
anos_aneel = sorted({a for _, a in real})
print(f"  {len(real)} pontos, {anos_aneel[0]}-{anos_aneel[-1]} (dezembro de cada ano)")
for (sigla, ano), mw in sorted(real.items()):
    capacidade.append({"uf": sigla, "ano": ano, "potencia_mw": round(mw, 1), "fonte_dado": "ANEEL dados abertos"})
capacidade.sort(key=lambda x: (x["uf"], x["ano"], x["fonte_dado"]))
gravar("capacidade_uf_ano.csv", ["uf", "ano", "potencia_mw", "fonte_dado"], capacidade)

# --------------- SIGA: recorte atual por fonte, e a medição do erro da reconstrução ---------------
print("\nANEEL SIGA — recorte do momento e diagnóstico da reconstrução")
siga = os.path.join(DADOS, "aneel", "siga.csv")
if not os.path.exists(siga):
    print("  ATENÇÃO: rode scripts/eixo4_aneel_siga.py antes — dados/aneel/siga.csv não existe.")
    sys.exit(1)

usinas, data_ref = [], None
with open(siga, encoding="utf-8-sig") as f:
    for r in csv.DictReader(f, delimiter=";"):
        data_ref = data_ref or r.get("DatGeracaoConjuntoDados")
        if r["DscFaseUsina"] != "Operação":
            continue
        sigla = r["SigUFPrincipal"].strip().upper()
        if sigla not in UFS:
            continue
        entrada = (r.get("DatEntradaOperacao") or "").strip()
        usinas.append({
            "uf": sigla,
            "ano": int(entrada[:4]) if entrada[:4].isdigit() else None,
            "origem": r["DscOrigemCombustivel"].strip(),
            "mw": (num(r["MdaPotenciaFiscalizadaKw"]) or 0) / 1000,
        })
print(f"  base {data_ref} · {len(usinas)} usinas em operação na Amazônia Legal")

atual = {}
for u in usinas:
    atual.setdefault(u["uf"], {}).setdefault(u["origem"], 0.0)
    atual[u["uf"]][u["origem"]] += u["mw"]
gravar("per_uf_fonte_atual.csv", ["uf", "origem", "potencia_mw"],
       [{"uf": uf, "origem": o, "potencia_mw": round(mw, 1)}
        for uf in UFS for o, mw in sorted(atual.get(uf, {}).items())])

per_atual = {}
for uf in UFS:
    total = sum(atual.get(uf, {}).values())
    ren = sum(v for k, v in atual.get(uf, {}).items() if k in RENOVAVEIS)
    per_atual[uf] = {"potencia_mw": round(total, 1), "renovavel_mw": round(ren, 1),
                     "pct_renovavel": round(ren / total * 100, 2) if total else None}

# O diagnóstico: reconstrução acumulada por ano de entrada x série oficial da ANEEL.
diagnostico = []
for uf in UFS:
    for ano in anos_aneel:
        recon = sum(u["mw"] for u in usinas if u["uf"] == uf and u["ano"] and u["ano"] <= ano)
        oficial = real.get((uf, ano))
        if not oficial:
            continue
        diagnostico.append({"uf": uf, "ano": ano, "siga_reconstruido_mw": round(recon, 1),
                            "aneel_oficial_mw": round(oficial, 1),
                            "erro_pct": round((recon - oficial) / oficial * 100, 1)})
gravar("diagnostico_siga_reconstrucao.csv",
       ["uf", "ano", "siga_reconstruido_mw", "aneel_oficial_mw", "erro_pct"], diagnostico)

piores = sorted(diagnostico, key=lambda d: -abs(d["erro_pct"]))[:6]
print("  maiores erros da reconstrução (por que não existe série):")
for d in piores:
    print(f"    {d['uf']} {d['ano']}: SIGA {d['siga_reconstruido_mw']:9,.0f} MW  x  "
          f"ANEEL {d['aneel_oficial_mw']:9,.0f} MW  ({d['erro_pct']:+.1f}%)")
recentes = [d for d in diagnostico if d["ano"] >= max(anos_aneel) - 1]
print(f"  convergência no fim da série: erro médio de {sum(abs(d['erro_pct']) for d in recentes)/len(recentes):.1f}%"
      f" em {max(anos_aneel)-1}-{max(anos_aneel)}")

# --------------- Confronto entre as duas séries de capacidade ---------------
# A EPE é a série principal. A da ANEEL serve de conferência e tem ao menos um erro
# grosseiro: Roraima aparece com 4.746 MW em dezembro de 2014, entre 122,6 MW em junho
# e 124,4 MW em março seguinte — o estado nunca teve 4,7 GW, e a EPE traz 119,2 MW no
# mesmo ano. Por isso a série publicada aqui é a da EPE, e as divergências saem listadas.
serie_cap = {}
for linha in capacidade:
    if linha["fonte_dado"] == "EPE Anuário 2.1":
        serie_cap.setdefault(linha["uf"], {})[str(linha["ano"])] = linha["potencia_mw"]

divergencias = []
for (sigla, ano), mw in sorted(real.items()):
    epe = serie_cap.get(sigla, {}).get(str(ano))
    if epe and mw and abs(mw - epe) / epe > 0.10:
        divergencias.append({"uf": sigla, "ano": ano, "epe_mw": round(epe, 1),
                             "aneel_mw": round(mw, 1), "dif_pct": round((mw - epe) / epe * 100, 1)})
comparaveis = sum(1 for (s, a) in real if serie_cap.get(s, {}).get(str(a)))
print(f"\n  divergências EPE x ANEEL acima de 10%: {len(divergencias)} de {comparaveis} pontos comparáveis")
por_uf = {}
for d in divergencias:
    por_uf.setdefault(d["uf"], []).append(abs(d["dif_pct"]))
for sigla in sorted(por_uf, key=lambda s: -len(por_uf[s])):
    v = por_uf[sigla]
    print(f"    {sigla}: {len(v):2d} anos, divergência de até {max(v):.0f}%")
pior = max(divergencias, key=lambda d: abs(d["dif_pct"]))
print(f"    pior ponto: {pior['uf']} {pior['ano']} — EPE {pior['epe_mw']:,.1f} MW x ANEEL {pior['aneel_mw']:,.1f} MW")

payload = {
    "indicador": "I4.3.2",
    "nome": "Matriz elétrica — capacidade instalada e renovabilidade",
    "atualizadoEm": datetime.date.today().isoformat(),
    "seriePorUfIndisponivel": {
        "conclusao": "Não há série histórica publicada da participação de renováveis por UF.",
        "fontesConsultadas": [
            "ANEEL/CKAN capacidade-instalada-por-unidade-da-federacao — UF x ano, sem fonte de geração",
            "ANEEL/CKAN empreendimentos-em-operacao — fonte de geração x ano, sem UF",
            "ANEEL/CKAN SIGA — fotografia do momento, sem fase 'Desativada'",
            "ONS capacidade-geracao — declara não ter histórico; cobre só usina despachada pelo ONS",
            "EPE Anuário, Tabela 2.1 — UF x ano, sem fonte de geração",
            "EPE Anuário, Tabela 2.3 — fonte de geração x ano, sem UF",
            "EPE Anuário, Tabela 2.8 — renovabilidade apenas nacional",
        ],
        "porQueNaoReconstruir": [
            "Sobrevivência: o SIGA não guarda usina desativada, então as térmicas a diesel "
            "aposentadas somem do passado e a série sai renovável demais.",
            "Datação: usina escalonada entra numa linha só (Belo Monte, 11.233 MW, datada "
            "2016-04-20), então a capacidade aparece anos antes de existir.",
        ],
    },
    "capacidadeInstaladaMw": {
        "descricao": "Capacidade instalada total por UF, dezembro de cada ano, do Anuário da EPE "
                     "(Tabela 2.1). É o total, sem quebra por fonte de geração — não dá para "
                     "derivar dele a participação de renováveis.",
        "serie": serie_cap,
        "conferenciaAneel": {
            "descricao": "Pontos em que a série da ANEEL diverge da EPE em mais de 10%. A da "
                         "ANEEL tem erro grosseiro em Roraima 2014 (4.746 MW contra 119 MW da EPE), "
                         "por isso a série publicada aqui é a da EPE.",
            "pontos": divergencias,
        },
    },
    "renovabilidadeBrasil": {
        "descricao": "Índice de renovabilidade da oferta interna de energia elétrica, Brasil "
                     "(EPE Anuário Tabela 2.8, a partir do Balanço Energético Nacional). É o "
                     "conceito exato do indicador, mas só existe em âmbito nacional.",
        "serie": {str(r["ano"]): r["pct_renovaveis"] for r in renovabilidade},
    },
    "recorteAtualPorUf": {
        "descricao": "Participação de renováveis na potência fiscalizada das usinas em operação "
                     "(proxy do PER). Fotografia, não série.",
        "baseSiga": data_ref,
        "valores": per_atual,
    },
}
destino = os.path.join(PUBLICO, "matriz-eletrica.json")
with open(destino, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"\nConsolidado versionado -> {destino}")

# --------------- Relatório ---------------
anos_rec = [a for a in sorted({int(a) for s in serie_cap.values() for a in s}) if a >= 2015]
print("\nCapacidade instalada (MW) — total, sem quebra por fonte")
print("UF    " + " ".join(f"{a:>8}" for a in anos_rec))
for uf in UFS + ["Norte", "BR"]:
    v = serie_cap.get(uf, {})
    print(f"{uf:5} " + " ".join(f"{v[str(a)]:8,.0f}" if str(a) in v else "       -" for a in anos_rec))

print("\nRenovabilidade da oferta de energia elétrica, Brasil (%) — EPE/BEN")
print("  " + "  ".join(f"{r['ano']}: {r['pct_renovaveis']:.1f}" for r in renovabilidade[-10:]))

print(f"\nPER por UF na base {data_ref} (fotografia do SIGA):")
for uf in UFS:
    p = per_atual[uf]
    print(f"  {uf}  {p['potencia_mw']:9,.1f} MW   renovável {p['renovavel_mw']:9,.1f} MW   {p['pct_renovavel']:6.1f}%")
