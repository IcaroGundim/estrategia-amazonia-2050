"""I1.5.3 - Conflitos por terra por UF (CPT, Conflitos no Campo Brasil, edicoes 2019-2025).

Roda do zero a partir da raiz do projeto:
    python -I scripts/eixo1_coleta_I1_5_3_conflitos.py

Le os PDFs ja baixados em dados/eixo1_coleta/I1.5.3_conflitos/brutos/ (nao baixa nada).
Para cada edicao, localiza a Tabela 4 (Conflitos por Terra), le as celulas pelas coordenadas
das palavras e valida cada bloco regional contra o subtotal impresso no proprio PDF.
Grava dados/eixo1_coleta/I1.5.3_conflitos/series_cpt_terra.csv (uma linha por ano e UF).

Colunas: ano, uf, terra_ocorrencias, terra_familias (coluna "Conflitos por Terra"),
total_ocorrencias, total_familias (coluna "TOTAL UF"), fonte_pagina, validacao.
Celulas em branco no PDF ficam vazias (nao sao lidas como zero).
"""
import csv
import os
import re
import site
import sys

sys.path.append(site.getusersitepackages())
import fitz  # PyMuPDF; instalado no site do usuario, por isso o sys.path.append acima

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DIR = os.path.join(ROOT, "dados", "eixo1_coleta", "I1.5.3_conflitos")
BRUTOS = os.path.join(DIR, "brutos")
OUT = os.path.join(DIR, "series_cpt_terra.csv")

EDICOES = {
    2009: "cpt_conflitos_no_campo_conflitos-no-campo-brasil-2009.pdf",
    2010: "cpt_conflitos_no_campo_conflitosnocampo2011.pdf",  # edicao de dados de 2010 (publicada em 2011)
    2011: "cpt_conflitos_no_campo_conflitos-no-campo-brasil-2011-nova-versao.pdf",
    2012: "cpt_conflitos_no_campo_conflitos-no-campo-brasil-2012.pdf",
    2013: "cpt_conflitos_no_campo_conflitos-no-campo-brasil-2013.pdf",
    2014: "cpt_conflitos_no_campo_conflitos-no-campo-brasil-2014.pdf",
    2015: "cpt_conflitos_no_campo_conflitos-no-campo-brasil-2015.pdf",
    2016: "cpt_conflitos_no_campo_conflitos-no-campo-brasil-2016.pdf",
    2019: "cpt_conflitos_no_campo_conflitos-no-campo-brasil-2019-web.pdf",
    2020: "cpt_conflitos_no_campo_conflitos-no-campo-brasil-2020.pdf",
    2021: "cpt_conflitos_no_campo_conflitos-no-campo-brasil-2021.pdf",
    2022: "cpt_conflitos_no_campo_livro-2022-v21-web.pdf",
    2023: "cpt_conflitos_no_campo_conflitos-no-campo-brasil-2023.pdf",
    2024: "cpt_conflitos_no_campo_CPT2024_ConflitosNoCampo-web-1.pdf",
    2025: "cpt_conflitos_no_campo_ConflitonoCampoBrasil25_web.pdf",
}
UF_ALL = set("AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO".split())
UF_AL = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]
NUM = re.compile(r"^(\d{1,3}(\.\d{3})+|\d+|-)$")
# indices (0-based) das 8 colunas numericas usadas: 0-1 = Conflitos por Terra; 6-7 = TOTAL UF
IDX = (0, 1, 6, 7)


def to_int(tok):
    return 0 if tok == "-" else int(tok.replace(".", ""))


def ler_linhas(page):
    """Devolve (linhas, n_cabecalho): linhas = [(rotulo, [8 valores ou None], n_celulas_lidas)]."""
    words = page.get_text("words")
    y_first = min(w[1] for w in words if w[4] in UF_ALL)
    cab = sorted(
        (w[0] + w[2]) / 2
        for w in words
        if w[1] < y_first and (w[4].startswith("Ocorr") or w[4].startswith("Fam"))
    )
    grupos = {}
    for w in words:
        if w[1] < y_first - 2:
            continue
        cy = round((w[1] + w[3]) / 2)
        chave = next((k for k in grupos if abs(k - cy) <= 3), None)
        if chave is None:
            chave = cy
            grupos[chave] = []
        grupos[chave].append(w)
    linhas = []
    for k in sorted(grupos):
        ws = sorted(grupos[k], key=lambda w: w[0])
        primeiro = ws[0][4] if ws else ""
        if primeiro in UF_ALL:
            rot = primeiro  # o rotulo da UF e sempre a primeira palavra da linha
        elif primeiro.lower().startswith("subtotal"):
            rot = "Subtotal"
        elif primeiro.lower().startswith("brasil"):
            rot = "BRASIL"
        else:
            continue
        nums = [w for w in ws[1:] if NUM.match(w[4])]
        if not nums and rot in UF_ALL:
            vals = [0] * 8  # linha de UF totalmente em branco no PDF: sem registros
        elif len(nums) == 8 and len(cab) == 8:
            vals = [to_int(w[4]) for w in nums]
        elif len(cab) == 8:
            vals = [None] * 8
            for w in nums:
                cx = (w[0] + w[2]) / 2
                j = min(range(8), key=lambda i: abs(cab[i] - cx))
                vals[j] = to_int(w[4])
        else:
            vals = None
        # se o TOTAL UF e zero e a celula de conflitos por terra esta vazia, a coluna de conflitos
        # por terra (componente do total) so pode ser zero
        if vals is not None and vals[0] is None and vals[1] is None and vals[6] == 0 and vals[7] == 0:
            vals[0] = 0
            vals[1] = 0
        linhas.append((rot, vals, len(nums)))
    return linhas, len(cab)


def pagina_da_tabela(doc):
    """Pagina da Tabela 4 (Conflitos por Terra): 20+ linhas de UF, subtotais, BRASIL e coluna Acampamentos."""
    for pno in range(len(doc)):
        page = doc[pno]
        toks = [w[4] for w in page.get_text("words")]
        low = [t.lower() for t in toks]
        ufs = sum(1 for t in toks if t in UF_ALL)
        if (ufs >= 9 and "acampamentos" in low and any(t.startswith("subtotal") for t in low) and any(t.startswith("brasil") for t in low)
                and re.search(r"tabela\s*4", page.get_text(), re.I)):
            return pno
    return None


def completo(v):
    return v is not None and all(v[i] is not None for i in IDX)


def validar(linhas):
    """Confere cada subtotal regional contra a soma das linhas de UF do seu bloco (colunas IDX).
    Blocos com alguma celula ausente (UF fora do escopo) nao sao conferidos e sao contados.
    Devolve (problemas, blocos_conferidos, blocos_sem_conferencia)."""
    problemas = []
    bloco = []
    subtotais = []
    conferidos = 0
    sem_conferencia = 0
    for rot, vals, _ in linhas:
        if rot == "Subtotal":
            if completo(vals) and all(completo(bv) for _, bv, _ in bloco):
                soma = {i: sum(bv[i] for _, bv, _ in bloco) for i in IDX}
                if any(soma[i] != vals[i] for i in IDX):
                    problemas.append(f"subtotal {[vals[i] for i in IDX]} != soma {[soma[i] for i in IDX]}")
                else:
                    conferidos += 1
            else:
                sem_conferencia += 1
            subtotais.append(vals)
            bloco = []
        elif rot in UF_ALL:
            bloco.append((rot, vals, None))
    brasil = [v for r, v, _ in linhas if r == "BRASIL"]
    if brasil and completo(brasil[0]) and subtotais and all(completo(s) for s in subtotais):
        soma = {i: sum(s[i] for s in subtotais) for i in IDX}
        if any(soma[i] != brasil[0][i] for i in IDX):
            problemas.append(f"BRASIL {[brasil[0][i] for i in IDX]} != soma subtotais {[soma[i] for i in IDX]}")
        else:
            conferidos += 1
    return problemas, conferidos, sem_conferencia


def main():
    saida = []
    for ano in sorted(EDICOES):
        doc = fitz.open(os.path.join(BRUTOS, EDICOES[ano]))
        pno = pagina_da_tabela(doc)
        if pno is None:
            print(ano, "tabela nao encontrada")
            doc.close()
            continue
        linhas, ncab = ler_linhas(doc[pno])
        doc.close()
        probs, conf, sem = validar(linhas)
        if ncab != 8:
            probs.append(f"cabecalho com {ncab} colunas")
        if not all(completo(v) for r, v, _ in linhas if r in UF_AL):
            probs.append("UF do escopo com celula ausente")
        if probs:
            status = "verificar: " + "; ".join(probs)
        else:
            status = f"validada: {conf} blocos conferidos" + (f"; {sem} blocos sem conferencia (celula vazia de UF fora do escopo)" if sem else "")
        print(ano, "pagina", pno + 1, status)
        lidas = {r: v for r, v, _ in linhas if r in UF_ALL}
        for u in UF_AL:
            v = lidas.get(u)
            if v is None:
                saida.append((ano, u, "", "", "", "", f"pag {pno+1}", "UF ausente na tabela"))
                continue
            vals = [("" if v[i] is None else v[i]) for i in (0, 1, 6, 7)]
            saida.append((ano, u, *vals, f"pag {pno+1}", status))
    with open(OUT, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["ano", "uf", "terra_ocorrencias", "terra_familias", "total_ocorrencias", "total_familias", "fonte_pagina", "validacao"])
        w.writerows(saida)
    print("gravado:", OUT, len(saida), "linhas")
    gravar_series(saida)


# ---------------------------------------------------------------------------
# series.csv (formato longo do projeto): CPT por UF, agregado AL, Tabela 2 da CPT e
# contagem de comissoes de TJ com ato localizado. Valores de Tabela 2 e da contagem de
# comissoes foram transcritos dos PDFs/atos indicados nas notas (ver achados.md).
CPT_URL = {
    2009: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitos-no-campo-brasil-2009.pdf",
    2010: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitosnocampo2011.pdf",
    2011: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitos-no-campo-brasil-2011-nova-versao.pdf",
    2012: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitos-no-campo-brasil-2012.pdf",
    2013: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitos-no-campo-brasil-2013.pdf",
    2014: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitos-no-campo-brasil-2014.pdf",
    2015: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitos-no-campo-brasil-2015.pdf",
    2016: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitos-no-campo-brasil-2016.pdf",
    2019: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitos-no-campo-brasil-2019-web.pdf",
    2020: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitos-no-campo-brasil-2020.pdf",
    2021: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitos-no-campo-brasil-2021.pdf",
    2022: "https://cptnacional.org.br/wp-content/uploads/2025/03/livro-2022-v21-web.pdf",
    2023: "https://cptnacional.org.br/wp-content/uploads/2025/03/conflitos-no-campo-brasil-2023.pdf",
    2024: "https://cptnacional.org.br/wp-content/uploads/2025/04/CPT2024_ConflitosNoCampo-web-1.pdf",
    2025: "https://cptnacional.org.br/wp-content/uploads/2026/06/ConflitonoCampoBrasil25_web.pdf",
}
# Tabela 2 da edicao 2024 (pag. 112): Amazonia Legal, coluna "Brasil" = total de conflitos por terra
TAB2_AL_2015_2024 = {2015: 590, 2016: 809, 2017: 674, 2018: 630, 2019: 800, 2020: 1046,
                     2021: 699, 2022: 940, 2023: 883, 2024: 995}
# Comissoes de solucoes fundiarias de TJ com ato de criacao localizado (ver atos.csv); contagem
# acumulada de UFs com ato datado ate o ano. AP e TO sem ato localizado.
TJ_UFS_ACUM = {2022: 2, 2023: 7, 2024: 7, 2025: 7}

CAB_SERIES = ["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"]
ARQ_SERIES = os.path.join(DIR, "series.csv")


def gravar_series(saida):
    linhas = []
    por_ano = {}
    for ano, uf, t_ocor, t_fam, tot_ocor, tot_fam, pag, status in saida:
        por_ano.setdefault(ano, {})[uf] = (t_ocor, t_fam, tot_ocor, tot_fam)
        nota = f"CPT Conflitos no Campo Brasil {ano}, Tabela 4, {pag}; {status}; fonte secundaria (ONG)"
        url = CPT_URL[ano]
        for cod, idx, unid, serie in [
            ("I1.5.3_CPT_TERRA_OCOR_UF", 0, "ocorrencias", "Conflitos por terra (CPT): ocorrencias, coluna 'Conflitos por Terra'"),
            ("I1.5.3_CPT_TERRA_FAM_UF", 1, "familias", "Conflitos por terra (CPT): familias envolvidas, coluna 'Conflitos por Terra'"),
            ("I1.5.3_CPT_TOTAL_TERRA_OCOR_UF", 2, "ocorrencias", "Conflitos por terra (CPT): ocorrencias, coluna 'TOTAL UF' (inclui ocupacoes e acampamentos)"),
            ("I1.5.3_CPT_TOTAL_TERRA_FAM_UF", 3, "familias", "Conflitos por terra (CPT): familias, coluna 'TOTAL UF' (inclui ocupacoes e acampamentos)"),
        ]:
            v = (t_ocor, t_fam, tot_ocor, tot_fam)[idx]
            if v == "":
                continue
            linhas.append([cod, serie, "contexto", uf, ano, v, unid, url, nota])
    # agregado AL = soma das 9 UFs, so quando todas as 9 estao presentes no ano
    for ano, ufs in sorted(por_ano.items()):
        if all(u in ufs and all(x != "" for x in ufs[u]) for u in UF_AL):
            for cod, idx, unid in [("I1.5.3_CPT_TERRA_OCOR_AL", 0, "ocorrencias"), ("I1.5.3_CPT_TERRA_FAM_AL", 1, "familias"),
                                   ("I1.5.3_CPT_TOTAL_TERRA_OCOR_AL", 2, "ocorrencias"), ("I1.5.3_CPT_TOTAL_TERRA_FAM_AL", 3, "familias")]:
                soma = sum(ufs[u][idx] for u in UF_AL)
                linhas.append([cod, "Soma das 9 UFs da Amazonia Legal (calculada a partir da tabela por UF da CPT)",
                               "contexto", "AL", ano, soma, unid, CPT_URL[ano],
                               f"soma calculada de AC, AM, AP, MA, MT, PA, RO, RR, TO na edicao {ano}; nao e a serie regional da CPT (ver I1.5.3_CPT_AL_REGIONAL_TOTAL)"])
    for ano, v in sorted(TAB2_AL_2015_2024.items()):
        linhas.append(["I1.5.3_CPT_AL_REGIONAL_TOTAL", "Conflito por terra na Amazonia Legal, serie regional da CPT (Tabela 2, edicao 2024)",
                       "contexto", "AL", ano, v, "ocorrencias", "https://cptnacional.org.br/wp-content/uploads/2025/04/CPT2024_ConflitosNoCampo-web-1.pdf",
                       "Tabela 2 'Conflito por terra nas regioes', pag. 112 da edicao 2024; total de conflitos por terra (mesma base do Brasil = 1.768 em 2024); NAO e a soma das 9 UFs (ex. 2024: soma das UFs = 1.124)"])
    for ano, v in sorted(TJ_UFS_ACUM.items()):
        linhas.append(["I1.5.3_TJ_COMISSAO_UFS_ACUM", "UFs com comissao de solucoes fundiarias de TJ com ato de criacao localizado (acumulado)",
                       "contexto", "AL", ano, v, "UFs", "",
                       "contagem derivada de atos.csv: MA (ATO_MA_PRES84_2022) e MT (ATO_MT_CRIACAO_2022, data por noticia do TJMT, ato nao localizado) em 2022; AC (ATO_AC_PORT1465_2023), AM (ATO_AM_PORT4847_2023), PA (ATO_PA_PORT3525_2023), RO (ATO_RO_AC007_2023, 2023-04-11) e RR (ATO_RR_PORT2108_2023, 2023-12-19) em 2023; AP e TO sem ato localizado; vigencia e revogacoes nao verificadas para AC, AM, PA, MT"])
    with open(ARQ_SERIES, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(CAB_SERIES)
        w.writerows(linhas)
    print("gravado:", ARQ_SERIES, len(linhas), "linhas de serie")


if __name__ == "__main__":
    main()
