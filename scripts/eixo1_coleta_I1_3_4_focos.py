#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 1 / I1.3.4 — focos de calor por UF, série longa (1998–2025).

Fontes, todas do INPE Programa Queimadas (baixadas para brutos/ se faltarem):
  - Brasil_sat_ref/focos_br_ref_<ano>.zip (2003–2025): arquivo anual do satélite de
    referência. É o mesmo método do painel (dados/focos/focos_calor_uf_ano.csv, 2015–2024).
  - Brasil_todos_sats/focos_br_todos-sats_<ano>.zip (1998–2011 e 2014): todos os satélites,
    com a coluna `satelite`. Serve para 1998–2002 (NOAA-12), para a janela NOAA-15 e para
    conferir o arquivo sat_ref.

Referência operacional segundo o aviso técnico do INPE de 24/08/2011
(Publicacoes-Impacto/documentos/20110824_Aviso_Ref_Mudoup_Aqua.pdf):
  - NOAA-12: série de referência de 01/07/1998 a 09/08/2007.
  - NOAA-15: referência até 21/08/2011. O início em 10/08/2007 é inferência (o aviso não o declara).
  - AQUA_M-T: referência a partir de 22/08/2011.
O arquivo sat_ref de 2003–2011 traz o recorte AQUA_M-T retroativo (conferido ano a ano abaixo),
então esses anos entram como proxy, com a referência da época como série de contexto à parte.

Saídas em dados/eixo1_coleta/I1.3.4_focos/: series.csv e fontes.csv.
Checagens são impressas no terminal.
Uso, a partir da raiz do projeto:  python -I scripts/eixo1_coleta_I1_3_4_focos.py
"""
import collections
import csv
import io
import os
import unicodedata
import urllib.request
import zipfile

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
TAREFA = os.path.join(RAIZ, "dados", "eixo1_coleta", "I1.3.4_focos")
BRUTOS = os.path.join(TAREFA, "brutos")
PAINEL = os.path.join(RAIZ, "dados", "focos", "focos_calor_uf_ano.csv")
ACESSO = "2026-10-07"
PREFIXO_LOCAL = "dados/eixo1_coleta/I1.3.4_focos/brutos"

URL_SAT = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/anual/Brasil_sat_ref"
URL_TODOS = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/anual/Brasil_todos_sats"
URL_AVISO = ("https://dataserver-coids.inpe.br/queimadas/queimadas/Publicacoes-Impacto/documentos/"
             "20110824_Aviso_Ref_Mudoup_Aqua.pdf")
URL_RAF = ("https://brasil.mapbiomas.org/wp-content/uploads/sites/4/2026/07/"
           "RAF2025_17.07.26_v2.pdf")

ANOS_SAT = list(range(2003, 2026))
ANOS_TODOS = list(range(1998, 2012)) + [2014]
UFS = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]
NOME_UF = {"ACRE": "AC", "AMAZONAS": "AM", "AMAPA": "AP", "MARANHAO": "MA",
           "MATO GROSSO": "MT", "PARA": "PA", "RONDONIA": "RO", "RORAIMA": "RR",
           "TOCANTINS": "TO"}

NOAA12_INI, NOAA12_FIM = "1998-07-01", "2007-08-09"
NOAA15_INI, NOAA15_FIM = "2007-08-10", "2011-08-21"
AQUA_OP_INI = "2011-08-22"

# MapBiomas Fogo, RAF2025 (17/07/2026), Tabela 15, p. 60: área queimada em 2025 (hectares).
MAPBIOMAS_2025_HA = {"MA": 2555512, "TO": 2204692, "MT": 1603370, "PA": 1073598,
                     "RR": 388343, "AM": 325222, "AP": 207902, "RO": 114796, "AC": 81366}
# Mesma tabela: média anual 1985–2025 (hectares). Só para achados.md.
MAPBIOMAS_MEDIA_HA = {"MA": 2259523, "TO": 2631031, "MT": 4115078, "PA": 2589027,
                      "RR": 696107, "AM": 364477, "AP": 240917, "RO": 694338, "AC": 213924}

# Predicados sobre (satélite normalizado, data AAAA-MM-DD)
PREDICADOS = {
    "todos": lambda s, d: True,
    "noaa12_ref": lambda s, d: s == "NOAA-12" and NOAA12_INI <= d <= NOAA12_FIM,
    "noaa15_ref": lambda s, d: s == "NOAA-15" and NOAA15_INI <= d <= NOAA15_FIM,
    "aqua_op": lambda s, d: s == "AQUA_M-T" and d >= AQUA_OP_INI,
    "aqua_todos": lambda s, d: s == "AQUA_M-T",
    "noaa12_janela": lambda s, d: s == "NOAA-12" and "2003-01-01" <= d <= NOAA12_FIM,
    "aqua_janela12": lambda s, d: s == "AQUA_M-T" and "2003-01-01" <= d <= NOAA12_FIM,
    "aqua_janela15": lambda s, d: s == "AQUA_M-T" and NOAA15_INI <= d <= NOAA15_FIM,
}


def norm(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper().strip()


def garantir(nome, url):
    os.makedirs(BRUTOS, exist_ok=True)
    dest = os.path.join(BRUTOS, nome)
    if not os.path.exists(dest) or os.path.getsize(dest) < 1000:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=300) as r:
            dados = r.read()
        with open(dest, "wb") as f:
            f.write(dados)
    return dest


def abrir_csv(zip_path):
    with zipfile.ZipFile(zip_path) as z:
        nome = next(n for n in z.namelist() if n.lower().endswith(".csv"))
        bruto = z.read(nome)
    try:
        texto = bruto.decode("utf-8")
    except UnicodeDecodeError:
        texto = bruto.decode("cp1252", errors="replace")
    leitor = csv.reader(io.StringIO(texto))
    cab = [c.strip().lower() for c in next(leitor)]
    return cab, leitor


def agregar_sat(ano):
    zip_path = garantir(f"focos_br_ref_{ano}.zip", f"{URL_SAT}/focos_br_ref_{ano}.zip")
    cab, leitor = abrir_csv(zip_path)
    ie, idt, ib = cab.index("estado"), cab.index("data_pas"), cab.index("bioma")
    total, amaz, fora = collections.Counter(), collections.Counter(), 0
    for r in leitor:
        if len(r) <= max(ie, idt, ib):
            continue
        uf = NOME_UF.get(norm(r[ie]))
        if uf is None:
            continue
        if r[idt].strip()[:4] != str(ano):
            fora += 1
        total[uf] += 1
        if norm(r[ib]) == "AMAZONIA":
            amaz[uf] += 1
    return total, amaz, fora


def agregar_todos(ano):
    zip_path = garantir(f"focos_br_todos-sats_{ano}.zip",
                        f"{URL_TODOS}/focos_br_todos-sats_{ano}.zip")
    cab, leitor = abrir_csv(zip_path)
    ie, idt, isat = cab.index("estado"), cab.index("data_pas"), cab.index("satelite")
    cont = {nome: collections.Counter() for nome in PREDICADOS}
    fora = 0
    for r in leitor:
        if len(r) <= max(ie, idt, isat):
            continue
        uf = NOME_UF.get(norm(r[ie]))
        if uf is None:
            continue
        d = r[idt].strip()[:10]
        s = norm(r[isat])
        if d[:4] != str(ano):
            fora += 1
        for nome, fn in PREDICADOS.items():
            if fn(s, d):
                cont[nome][uf] += 1
    return cont, fora


def main():
    for ano in ANOS_SAT:
        garantir(f"focos_br_ref_{ano}.zip", f"{URL_SAT}/focos_br_ref_{ano}.zip")
    for ano in ANOS_TODOS:
        garantir(f"focos_br_todos-sats_{ano}.zip", f"{URL_TODOS}/focos_br_todos-sats_{ano}.zip")
    garantir("20110824_Aviso_Ref_Mudoup_Aqua.pdf", URL_AVISO)
    garantir("RAF2025_17.07.26_v2.pdf", URL_RAF)

    print("== sat_ref anual (Brasil_sat_ref)")
    sat_total, sat_amaz = {}, {}
    for ano in ANOS_SAT:
        t, a, fora = agregar_sat(ano)
        sat_total[ano], sat_amaz[ano] = t, a
        print(f"  {ano}: total nas 9 UFs {sum(t.values())}, bioma Amazônia {sum(a.values())}, "
              f"registros com ano diferente do nome: {fora}")

    print("== todos os satélites (Brasil_todos_sats)")
    todos, fora_todos = {}, {}
    for ano in ANOS_TODOS:
        c, fora = agregar_todos(ano)
        todos[ano], fora_todos[ano] = c, fora
        print(f"  {ano}: AQUA_M-T {sum(c['aqua_todos'].values())}, NOAA-12 {sum(c['noaa12_ref'].values())}, "
              f"NOAA-15 {sum(c['noaa15_ref'].values())}, registros com ano diferente: {fora}")

    print("== V1: painel (focos_calor_uf_ano.csv, 2015-2024) contra sat_ref")
    painel = {}
    with open(PAINEL, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            painel[(r["uf"], int(r["ano"]))] = int(r["focos_sat_ref"])
    checados, divergentes = 0, []
    for (uf, ano), v in sorted(painel.items()):
        if 2015 <= ano <= 2024:
            checados += 1
            if sat_total[ano].get(uf, 0) != v:
                divergentes.append((uf, ano, v, sat_total[ano].get(uf, 0)))
    print(f"  pares UF x ano checados: {checados}; divergentes: {divergentes or 'nenhum'}")

    print("== V2: AQUA_M-T do arquivo todos os satélites contra sat_ref, por ano")
    for ano in sorted(set(ANOS_TODOS) & set(ANOS_SAT)):
        aq = todos[ano]["aqua_todos"]
        dif = [(uf, aq.get(uf, 0), sat_total[ano].get(uf, 0)) for uf in UFS
               if aq.get(uf, 0) != sat_total[ano].get(uf, 0)]
        print(f"  {ano}: UFs diferentes: {dif or 'nenhuma'}")

    print("== V3: razao entre satélites nas janelas de transicao (por UF)")
    print("  janela NOAA-12 (2003-01-01 a 2007-08-09): UF, NOAA-12, AQUA_M-T, AQUA/NOAA-12")
    for uf in UFS:
        n12 = sum(todos[a]["noaa12_janela"].get(uf, 0) for a in range(2003, 2008) if a in todos)
        aq = sum(todos[a]["aqua_janela12"].get(uf, 0) for a in range(2003, 2008) if a in todos)
        print(f"    {uf} {n12} {aq} {round(aq / n12, 2) if n12 else '-'}")
    print("  janela NOAA-15 (2007-08-10 a 2011-08-21): UF, NOAA-15, AQUA_M-T, AQUA/NOAA-15")
    for uf in UFS:
        n15 = sum(todos[a]["noaa15_ref"].get(uf, 0) for a in range(2007, 2012) if a in todos)
        aq = sum(todos[a]["aqua_janela15"].get(uf, 0) for a in range(2007, 2012) if a in todos)
        print(f"    {uf} {n15} {aq} {round(aq / n15, 2) if n15 else '-'}")

    # ---------------- series ----------------
    linhas = []

    def add(serie, rotulo, uf, ano, valor, unidade, url, nota):
        linhas.append([ "I1.3.4", serie, rotulo, uf, ano, valor, unidade, url, nota])

    url_sat = lambda a: f"{URL_SAT}/focos_br_ref_{a}.zip"
    url_todos = lambda a: f"{URL_TODOS}/focos_br_todos-sats_{a}.zip"
    S_OP = "focos_ref_operacional_AQUA_M-T"
    S_RETRO = "focos_sat_ref_AQUA_M-T_retro"
    S_COMP = "focos_componente_bioma_Amazonia_sat_ref"
    S_N12 = "focos_ref_historica_NOAA-12"
    S_N15 = "focos_ref_historica_NOAA-15"
    S_AREA = "area_queimada_MapBiomas_RAF2025"

    for uf in UFS:
        # Referência operacional AQUA_M-T
        add(S_OP, "exata", uf, 2011, todos[2011]["aqua_op"].get(uf, 0), "focos", url_todos(2011),
            "PARCIAL 22/08 a 31/12/2011: AQUA_M-T como referência operacional desde 22/08/2011 "
            "(aviso INPE). Não e ano completo.")
        for ano in range(2012, 2026):
            nota = ("Referência operacional AQUA_M-T (aviso INPE). Mesmo metodo do painel: "
                    "arquivo sat_ref por UF.")
            if ano == 2025:
                nota += " Ano completo: registros de 01/01 a 31/12/2025."
            add(S_OP, "exata", uf, ano, sat_total[ano].get(uf, 0), "focos", url_sat(ano), nota)

        # Série AQUA retroativa (proxy)
        add(S_RETRO, "proxy", uf, 2002, todos[2002]["aqua_todos"].get(uf, 0), "focos", url_todos(2002),
            "PARCIAL jul-dez/2002: AQUA_M-T do arquivo todos os satélites. Antes de 22/08/2011 "
            "a referência operacional não era o AQUA (aviso INPE).")
        for ano in range(2003, 2012):
            add(S_RETRO, "proxy", uf, ano, sat_total[ano].get(uf, 0), "focos", url_sat(ano),
                "Série AQUA_M-T retroativa do arquivo sat_ref. Não e a referência da época: NOAA-12 "
                "ate 09/08/2007 e NOAA-15 ate 21/08/2011 (aviso INPE). Ver focos_ref_histórica_*.")

        # Componente: bioma Amazônia dentro da contagem da UF
        for ano in ANOS_SAT:
            nota = "Focos do bioma Amazônia dentro da contagem total da UF (sat_ref)."
            if ano <= 2011:
                nota += " 2003-2011: serie AQUA_M-T retroativa."
            add(S_COMP, "componente", uf, ano, sat_amaz[ano].get(uf, 0), "focos", url_sat(ano), nota)

        # Contexto: referência histórica NOAA-12
        for ano in range(1998, 2008):
            nota = "Contexto: referência histórica NOAA-12 (aviso INPE 2011). Quebra explícita com AQUA_M-T."
            if ano == 1998:
                nota = "PARCIAL jul-dez/1998. " + nota
            if ano == 2007:
                nota = "PARCIAL 01/01 a 09/08/2007. " + nota
            add(S_N12, "contexto", uf, ano, todos[ano]["noaa12_ref"].get(uf, 0), "focos",
                url_todos(ano), nota)

        # Contexto: referência histórica NOAA-15 (início 10/08/2007 inferido)
        for ano in range(2007, 2012):
            nota = ("Contexto: referência histórica NOAA-15 (aviso INPE 2011). Início em 10/08/2007 "
                    "e inferência, não declarado no aviso. Quebra explícita com AQUA_M-T.")
            if ano == 2007:
                nota = "PARCIAL 10/08 a 31/12/2007. " + nota
            if ano == 2011:
                nota = "PARCIAL 01/01 a 21/08/2011. " + nota
            add(S_N15, "contexto", uf, ano, todos[ano]["noaa15_ref"].get(uf, 0), "focos",
                url_todos(ano), nota)

        # Contexto: area queimada MapBiomas (so 2025)
        add(S_AREA, "contexto", uf, 2025, MAPBIOMAS_2025_HA[uf], "hectares",
            "https://brasil.mapbiomas.org/wp-content/uploads/sites/4/2026/07/RAF2025_17.07.26_v2.pdf",
            "MapBiomas Fogo RAF2025, Tabela 15 (p. 60). Serie anual por UF não obtida; "
            "média 1985-2025 em achados.md.")

    linhas.sort(key=lambda x: (x[1], x[3], x[4]))
    saida = os.path.join(TAREFA, "series.csv")
    with open(saida, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"])
        w.writerows(linhas)
    print(f"== series.csv: {len(linhas)} linhas -> {os.path.relpath(saida, RAIZ)}")

    # ---------------- fontes ----------------
    data_sat = {a: "2023-08-09" for a in range(2003, 2023)}
    data_sat.update({2023: "2024-07-12", 2024: "2025-06-06", 2025: "2026-02-11"})
    data_todos = {a: "2026-06-17" for a in range(1998, 2003)}
    data_todos.update({a: "2025-09-08" for a in range(2003, 2018)})
    data_todos.update({a: "2023-10-10" for a in range(2018, 2023)})
    data_todos.update({2023: "2024-05-03", 2024: "2025-06-06", 2025: "2026-02-11"})

    fontes = [
        [URL_SAT + "/", "Índice do diretorio Brasil_sat_ref (focos anuais, satélite de referência)",
         "INPE - Programa Queimadas (BDQueimadas)", "primaria", "2026-02-11", ACESSO, ""],
        [URL_TODOS + "/", "Índice do diretorio Brasil_todos_sats (focos anuais, todos os satélites)",
         "INPE - Programa Queimadas (BDQueimadas)", "primaria", "2026-06-17", ACESSO, ""],
        [URL_AVISO, "A mudanca do Satelite de referência em 22/agosto/2011 (aviso tecnico)",
         "INPE - Programa Queimadas", "primaria", "2011-08-24", ACESSO,
         PREFIXO_LOCAL + "/20110824_Aviso_Ref_Mudoup_Aqua.pdf"],
        [URL_RAF, "MapBiomas Fogo - Relatório Anual do Fogo 2025 (RAF2025)",
         "MapBiomas Brasil (iniciativa de rede academica e ONGs)", "secundaria", "2026-07-17", ACESSO,
         PREFIXO_LOCAL + "/RAF2025_17.07.26_v2.pdf"],
    ]
    for ano in ANOS_SAT:
        fontes.append([url_sat(ano), f"Focos de calor anuais, satélite de referência, Brasil, {ano}",
                       "INPE - Programa Queimadas (BDQueimadas)", "primaria", data_sat[ano], ACESSO,
                       f"{PREFIXO_LOCAL}/focos_br_ref_{ano}.zip"])
    for ano in ANOS_TODOS:
        fontes.append([url_todos(ano), f"Focos de calor anuais, todos os satélites, Brasil, {ano}",
                       "INPE - Programa Queimadas (BDQueimadas)", "primaria", data_todos[ano], ACESSO,
                       f"{PREFIXO_LOCAL}/focos_br_todos-sats_{ano}.zip"])
    saida_f = os.path.join(TAREFA, "fontes.csv")
    with open(saida_f, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["url", "titulo", "orgao", "tipo", "data_documento", "acessado_em", "arquivo_local"])
        w.writerows(fontes)
    print(f"== fontes.csv: {len(fontes)} linhas -> {os.path.relpath(saida_f, RAIZ)}")


if __name__ == "__main__":
    main()
