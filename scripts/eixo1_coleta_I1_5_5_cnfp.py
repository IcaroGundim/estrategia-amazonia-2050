# Coleta I1.5.5 - Florestas publicas estaduais destinadas e nao destinadas (CNFP / SFB)
# Rodar a partir da raiz do projeto:  python -I scripts/eixo1_coleta_I1_5_5_cnfp.py
# Entrada: dados/eixo1_coleta/I1.5.5_cnfp/brutos/ (CSV e PDF baixados de dados.florestal.gov.br e gov.br/florestal)
# Saida:   dados/eixo1_coleta/I1.5.5_cnfp/series.csv e fontes.csv
import sys, os, re, csv, io, json, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "dados", "eixo1_coleta", "I1.5.5_cnfp")
BRUTOS = os.path.join(BASE, "brutos")
TXT = os.path.join(BRUTOS, "_txt")
ACESSO = "2026-10-07"
CODIGO = "I1.5.5"
UFS = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]
csv.field_size_limit(10**9)

URL_GOVBR = "https://www.gov.br/florestal/pt-br/assuntos/cadastro-nacional-de-florestas-publicas"
# Anos com CSV no dataset. 2021 e 2023 nao aparecem no catalogo nem na lista de edicoes do gov.br.
CSV_ANOS = {
    2010: "dadosabertos_snif_cnfp_2010_sfb.csv",
    2011: "dadosabertos_snif_cnfp_2011_sfb.csv",
    2012: "dadosabertos_snif_cnfp_2012_sfb.csv",
    2013: "dadosabertos_snif_cnfp_2013_sfb.csv",
    2014: "dadosabertos_snif_cnfp_2014_sfb.csv",
    2015: "dadosabertos_snif_cnfp_2015_sfb.csv",
    2016: "dadosabertos_snif_cnfp_2016_sfb.csv",
    2017: "dadosabertos_snif_cnfp_2017_sfb.csv",
    2018: "dadosabertos_snif_cnfp_2018_sfb.csv",
    2019: "dadosabertos_snif_cnfp_2019_sfb.csv",
    2020: "dadosabertos_snif_cnfp_2020_sfb.csv",
    2022: "dadosabertos_snif_cnfp_2022_sfb.csv",
    2024: "dadosabertos_snif_cnfp_2024_v19_03_retificado_17072025_sfb_out_2025.csv",
    2025: "dadosabertos_snif_cnfp_2025_sfb_junho_2026_1.csv",
}


def num_br(s):
    s = (s or "").strip()
    if s in ("", "-", "--"):
        return 0.0
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(\.\d{3})+", s):
        s = s.replace(".", "")
    return float(s)


def pick(cols, cands):
    for c in cands:
        if c in cols:
            return c
    return None


def load_csv(path):
    txt = open(path, "rb").read().decode("utf-8-sig", errors="replace")
    rd = csv.DictReader(io.StringIO(txt), delimiter=";")
    cols = rd.fieldnames
    rows = list(rd)
    m = dict(
        gov=pick(cols, ["governo", "GOVERNO", "GOV"]),
        tipo=pick(cols, ["tipo", "TIPO", "TIPO_FLORE"]),
        uf=pick(cols, ["uf", "SIGLA_UF"]),
        area=pick(cols, ["area_ha", "Area_Ha", "HECTARES"]),
    )
    return rows, m


def classe_gov(g):
    g = re.sub(r"\s*/\s*", "/", (g or "").strip().upper())
    if g in ("ESTADUAL", "FEDERAL", "MUNICIPAL"):
        return g
    if "/" in g:
        return "MISTO"
    return "OUTRO"


def tipo_ab(t):
    t = (t or "").strip().upper()
    last = t[-1:]
    return last if last in ("A", "B", "C") else "?"


def agregar_csv(ano):
    rows, m = load_csv(os.path.join(BRUTOS, CSV_ANOS[ano]))
    agg = collections.defaultdict(float)    # (uf, classe_gov, tipo) -> ha
    todas = collections.defaultdict(float)  # (uf, tipo) -> ha, todas as esferas
    for r in rows:
        uf = (r[m["uf"]] or "").strip().upper()
        if uf not in UFS:
            continue
        cg = classe_gov(r[m["gov"]])
        t = tipo_ab(r[m["tipo"]])
        a = num_br(r[m["area"]])
        agg[(uf, cg, t)] += a
        todas[(uf, t)] += a
    return agg, todas


def parse_state_table(txt, ncols):
    """Para cada sigla de UF, le as ncols colunas numericas que vem nas linhas seguintes."""
    lines = txt.split("\n")
    out = {}
    for i, ln in enumerate(lines):
        s = ln.strip()
        if s in UFS and s not in out:
            vals = []
            for ln2 in lines[i + 1:]:
                t = ln2.strip()
                if not t:
                    continue
                toks = t.split()
                if all(re.fullmatch(r"-|\d{1,3}(?:\.\d{3})+|\d+", x) for x in toks):
                    vals.extend(toks)
                    if len(vals) >= ncols:
                        break
                else:
                    break
            if len(vals) >= ncols:
                out[s] = [num_br(v) for v in vals[:ncols]]
    return out


def pdf_text(nome):
    # PyMuPDF instalado no site do usuario (o python -I nao o enxerga sem este caminho)
    sys.path.append(r"C:\Users\icaro.lebre\AppData\Roaming\Python\Python314\site-packages")
    import fitz
    doc = fitz.open(os.path.join(BRUTOS, nome))
    return "\n".join(pg.get_text() for pg in doc)


def ckan_recursos():
    d = json.load(open(os.path.join(BRUTOS, "_package_show.json"), encoding="utf-8"))
    return {os.path.basename(x["url"]): x for x in d["result"]["resources"] if x.get("url")}


def soma(agg, ufs, cg, t):
    return sum(agg.get((x, cg, t), 0.0) for x in ufs)


def main():
    recursos = ckan_recursos()
    series = []
    fontes = []
    por_ano = {}

    for ano in sorted(CSV_ANOS):
        fn = CSV_ANOS[ano]
        url = recursos[fn]["url"]
        agg, todas = agregar_csv(ano)
        por_ano[ano] = agg
        fontes.append((url, recursos[fn]["name"], "Serviço Florestal Brasileiro (SFB) - SNIF", "primaria",
                       (recursos[fn].get("last_modified") or "")[:10], "brutos/" + fn))
        base = f"CSV SFB dadosabertos_snif_cnfp_{ano}; soma de area_ha de todos os registros do arquivo"
        if ano == 2018:
            base += ("; ANO ATIPICO: arquivo com colunas PAOF/mapa/id2 e mais linhas duplicadas; "
                     "diverge de 2017 e 2019 em varias UFs (ver achados.md)")
        for uf in UFS + ["AL"]:
            ufs = UFS if uf == "AL" else [uf]
            pre = "AL = soma das 9 UFs da Amazonia Legal; " if uf == "AL" else ""
            eA, eB = soma(agg, ufs, "ESTADUAL", "A"), soma(agg, ufs, "ESTADUAL", "B")
            fA, fB = soma(agg, ufs, "FEDERAL", "A"), soma(agg, ufs, "FEDERAL", "B")
            mA = soma(agg, ufs, "MISTO", "A")
            tA = sum(todas.get((x, "A"), 0.0) for x in ufs)
            tB = sum(todas.get((x, "B"), 0.0) for x in ufs)
            series += [
                (CODIGO, "florestas_estaduais_destinadas_ha", "componente", uf, ano, round(eA, 2), "ha", url,
                 pre + base + "; governo=ESTADUAL e tipo A; registros mistos (FEDERAL/ESTADUAL etc.) fora"),
                (CODIGO, "florestas_estaduais_nao_destinadas_ha", "componente", uf, ano, round(eB, 2), "ha", url,
                 pre + base + "; governo=ESTADUAL e tipo B; registros mistos fora"),
                (CODIGO, "florestas_estaduais_total_ha", "componente", uf, ano, round(eA + eB, 2), "ha", url,
                 pre + base + "; governo=ESTADUAL, tipo A + tipo B (denominador da %)"),
            ]
            if eA + eB > 0:
                series.append((CODIGO, "pct_florestas_estaduais_destinadas", "exata", uf, ano,
                               round(100.0 * eA / (eA + eB), 4), "%", url,
                               pre + "100 x estadual destinada / (estadual destinada + estadual nao destinada); "
                               "formula da ficha corrigida (ver problemas_ficha); esfera de governo do CNFP tomada como dominio estadual"))
            series += [
                (CODIGO, "florestas_federais_destinadas_ha", "contexto", uf, ano, round(fA, 2), "ha", url,
                 pre + base + "; governo=FEDERAL e tipo A; sem registros mistos"),
                (CODIGO, "florestas_federais_nao_destinadas_ha", "contexto", uf, ano, round(fB, 2), "ha", url,
                 pre + base + "; governo=FEDERAL e tipo B; sem registros mistos"),
                (CODIGO, "florestas_mistas_federal_estadual_destinadas_ha", "contexto", uf, ano, round(mA, 2), "ha", url,
                 pre + base + "; governo composto (ex.: FEDERAL/ESTADUAL) e tipo A; esfera nao atribuivel"),
                (CODIGO, "todas_esferas_destinadas_ha", "contexto", uf, ano, round(tA, 2), "ha", url,
                 pre + base + "; todas as esferas, tipo A"),
                (CODIGO, "todas_esferas_nao_destinadas_ha", "contexto", uf, ano, round(tB, 2), "ha", url,
                 pre + base + "; todas as esferas, tipo B"),
            ]

    # 2009: o CSV de 2009 nao tem coluna de UF. A tabela por UF do PDF da edicao 2009 soma federal + estadual.
    url09 = URL_GOVBR + "/cadastro-nacional-de-florestas-publicas-atualizacao-2009/mapa-cnfp-2009.pdf/@@display-file/file"
    lines = pdf_text("mapa_cnfp_2009.pdf").split("\n")  # tabela de distribuicao por estado (2009)
    tab09 = {}
    for i, ln in enumerate(lines):
        s = ln.strip()
        if s in UFS and s not in tab09:
            vals = [lines[j].strip() for j in range(i + 1, min(i + 4, len(lines)))]
            if len(vals) == 3 and all(re.fullmatch(r"\d{1,3}(?:\.\d{3})+|\d+", v) for v in vals[:2]):
                tab09[s] = (num_br(vals[0]), num_br(vals[1]))
    for uf in UFS:
        d, nd = tab09[uf]
        nota = ("PDF mapa CNFP 2009, tabela 'Distribuicao das Florestas Publicas Cadastradas ate 2009'; "
                "soma federal + estadual (a tabela nao separa a esfera); CSV de 2009 sem coluna UF")
        series += [
            (CODIGO, "todas_esferas_destinadas_ha", "contexto", uf, 2009, round(d, 2), "ha", url09, nota + "; coluna DESTINADAS"),
            (CODIGO, "todas_esferas_nao_destinadas_ha", "contexto", uf, 2009, round(nd, 2), "ha", url09, nota + "; coluna NAO DESTINADAS"),
        ]

    # Validacao: colunas estaduais do CSV x tabela oficial por UF nos PDFs das edicoes 2012, 2019, 2020 e 2022
    pdfs = {2012: ("mapa_cnfp_2012.pdf", 7), 2019: ("cnfp_2019_compressed.pdf", 8),
            2020: ("cnfp_2020_compressed.pdf", 8), 2022: ("cnfp_2022_compressed.pdf", 8)}
    print("VALIDACAO estadual (CSV - PDF oficial, ha):")
    for ano, (pdfn, nc) in sorted(pdfs.items()):
        tab = parse_state_table(pdf_text(pdfn), nc)
        agg = por_ano[ano]
        for uf in UFS:
            v = tab[uf]
            estA_pdf = v[1]
            estB_pdf = v[5] if nc == 8 else v[4]
            dA = agg.get((uf, "ESTADUAL", "A"), 0.0) - estA_pdf
            dB = agg.get((uf, "ESTADUAL", "B"), 0.0) - estB_pdf
            print(f"  {ano} {uf}: dif_dest={dA:,.0f} dif_nao_dest={dB:,.0f}")
    for ano in (2017, 2022):
        agg = por_ano[ano]
        tA = sum(v for (uf, cg, t), v in agg.items() if cg == "ESTADUAL" and t == "A")
        tB = sum(v for (uf, cg, t), v in agg.items() if cg == "ESTADUAL" and t == "B")
        print(f"VALIDACAO {ano} (9 UFs, estadual): dest={tA:,.0f} nao_dest={tB:,.0f}")

    # Validacao 2025: o valor estadual destinado do CSV deve aparecer na tabela do layout 2025 (PDF).
    txt25 = pdf_text("layout_cnfp_2025-defeso.pdf")
    print("VALIDACAO 2025 (estadual destinada do CSV presente no PDF layout 2025):")
    for uf in UFS:
        v = por_ano[2025].get((uf, "ESTADUAL", "A"), 0.0)
        s = f"{v:,.0f}".replace(",", ".")
        print(f"  2025 {uf}: {s} -> {'encontrado' if s in txt25 else 'nao encontrado no PDF'}")

    # Fontes abertas e lidas (nao inclui paginas de busca que nao foram abertas)
    G = URL_GOVBR
    fontes += [
        ("https://dados.florestal.gov.br/dataset/cadastro-nacional-de-florestas-publicas-cnfp",
         "Cadastro Nacional de Florestas Publicas - CNFP (pagina do dataset)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2026-07-06 (CKAN metadata_modified)", "brutos/_dataset_page.html"),
        ("https://dados.florestal.gov.br/api/3/action/package_show?id=cadastro-nacional-de-florestas-publicas-cnfp",
         "CKAN package_show (lista de recursos e datas do CNFP)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2026-07-06", "brutos/_package_show.json"),
        (G, "Cadastro Nacional de Florestas Publicas - pagina de edicoes", "Serviço Florestal Brasileiro (SFB)", "primaria", "sem data na pagina", "brutos/_cnfp_index.html"),
        ("https://dados.florestal.gov.br/dataset/426c441c-741a-4b49-a456-4e002054e4a2/resource/dc85b817-cf93-40aa-a3e3-12b5926bfcdf/download/metadados_snif_cadastro_nacional_de_florestas_publicas-_2025_sfb_junho_2026_1.pdf",
         "Metadados SNIF - CNFP 2025 (dicionario de dados: Tipo A = destinada; Tipo B = nao destinada)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2026-07-02 (catalogacao 02/07/2026)", "brutos/metadados_snif_cadastro_nacional_de_florestas_publicas-_2025_sfb_junho_2026_1.pdf"),
        ("https://dados.florestal.gov.br/dataset/426c441c-741a-4b49-a456-4e002054e4a2/resource/2bbccd78-e235-4c99-bc51-36196a01ee80/download/metadados_snif_cadastro_nacional_de_florestas_publicas_2024_sfb_out_2025.pdf",
         "Metadados SNIF - CNFP 2024 (mesmo dicionario de dados)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2025-10-01 (ano-base 2024)", "brutos/metadados_snif_cadastro_nacional_de_florestas_publicas_2024_sfb_out_2025.pdf"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2025/layout_cnfp_2025-defeso.pdf/@@display-file/file",
         "CNFP atualizacao 2025 - layout com tabela 'Distribuicao de Florestas Publicas cadastradas ate 2025'", "Serviço Florestal Brasileiro (SFB)", "primaria", "2026 (publicacao SFB junho/2026)", "brutos/layout_cnfp_2025-defeso.pdf"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2025/manual-cnfp-publico_junho-2026.pdf/@@display-file/file",
         "Manual do CNFP (publico) - junho de 2026", "Serviço Florestal Brasileiro (SFB)", "primaria", "2026-06", "brutos/manual-cnfp-publico_junho-2026.pdf"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2022/cnfp_2022_compressed.pdf/@@display-file/file",
         "CNFP atualizacao 2022 - tabela 'Distribuicao de Florestas Publicas Cadastradas ate 2022' (valores em ha)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2022 (ano-base)", "brutos/cnfp_2022_compressed.pdf"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2022/layout_cnfp_2022-defeso.pdf/@@display-file/file",
         "CNFP atualizacao 2022 - layout (mapa)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2022 (ano-base)", "brutos/layout_cnfp_2022-defeso.pdf"),
        (G + "/cnfp-2020/cnfp_2020_compressed.pdf/@@display-file/file",
         "CNFP 2020 - tabela 'Distribuicao de Florestas Publicas Cadastradas ate 2020' (valores em ha)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2020 (ano-base)", "brutos/cnfp_2020_compressed.pdf"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2019/cnfp_2019_compressed.pdf/@@display-file/file",
         "CNFP atualizacao 2019 - tabela 'Distribuicao de Florestas Publicas Cadastradas ate 2019' (valores em ha)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2019 (ano-base)", "brutos/cnfp_2019_compressed.pdf"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2012/mapa_cnfp_2012.pdf/@@display-file/file",
         "CNFP atualizacao 2012 - mapa com tabela por estado (valores em ha)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2012 (ano-base)", "brutos/mapa_cnfp_2012.pdf"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2024/layout_cnfp_2024-defeso.pdf/@@display-file/file",
         "CNFP atualizacao 2024 - layout (PDF so de imagem; sem texto extraivel; nao validado)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2024 (ano-base)", "brutos/layout_cnfp_2024-defeso.pdf"),
        (G + "/centrais-de-conteudo/publicacoes/relatorios/relatorios-de-gestao-de-florestas-publicas/relatorio-de-gestao-de-florestas-publicas-2025.pdf/@@display-file/file",
         "Relatorio de Gestao de Florestas Publicas 2025 (SFB) - baixado; sem tabela de destinacao por UF usada", "Serviço Florestal Brasileiro (SFB)", "primaria", "2025", "brutos/relatorio-de-gestao-de-florestas-publicas-2025.pdf"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2009/mapa-cnfp-2009.pdf/@@display-file/file",
         "CNFP atualizacao 2009 - mapa com tabela por estado (ESTADOS: destinadas, nao destinadas, total)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2009 (ano-base)", "brutos/mapa_cnfp_2009.pdf"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2008",
         "CNFP atualizacao 2008 - pagina (texto: 211 mi ha; 14 mi ha estaduais; sem tabela por UF)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2023-12-19 (publicado em, segundo a pagina)", "brutos/_page_2008.html"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2013",
         "CNFP atualizacao 2013 - pagina (texto: ~75% destinadas, ~25% nao destinadas, nacional)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2023-12-19 (publicado em, segundo a pagina)", "brutos/_page_2013.html"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2017",
         "CNFP atualizacao 2017 - pagina (texto: 311,6 mi ha; ~79% destinadas, ~21% nao destinadas, nacional)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2023-12-19 (publicado em, segundo a pagina)", "brutos/_page_2017.html"),
        ("https://mapas.florestal.gov.br/portal/sharing/rest/content/items/889978a137f14a2f917a9c59c047cf3a/data",
         "CNFP 2008 - shapefile (DBF com TIPO_FLOR, AREA_HA, MUNI_UF, ORGAO_GEST; 1434 feicoes; sem campo de esfera)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2008 (ano-base)", "brutos/cnfp_2008_shapefile.zip"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2010/tabela_cnfp_2010.zip/@@download/file",
         "CNFP 2010 - zip com apenas imagens de mapas (nao usado para valores)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2010 (ano-base)", "brutos/tabela_cnfp_2010.zip"),
        (G + "/cadastro-nacional-de-florestas-publicas-atualizacao-2011/tabela_cnfp_20111.zip/@@download/file",
         "CNFP 2011 - zip com apenas imagens de mapas (nao usado para valores)", "Serviço Florestal Brasileiro (SFB)", "primaria", "2011 (ano-base)", "brutos/tabela_cnfp_20111.zip"),
        ("https://imazon.fly.storage.tigris.dev/uploads/2025/05/FatosAMZ2025.pdf",
         "Imazon - Fatos da Amazonia 2025 (Tabela 10: situacao fundiaria da Amazonia Legal, regional; Tabela 11: areas protegidas por UF)", "Imazon (ONG)", "secundaria", "2025-05 (upload)", "brutos/imazon_fatos_amazonia_2025.pdf"),
    ]
    return series, fontes


def escrever(series, fontes):
    os.makedirs(BASE, exist_ok=True)
    with open(os.path.join(BASE, "series.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"])
        for row in sorted(series, key=lambda r: (r[1], r[3], r[4])):
            w.writerow(row)
    with open(os.path.join(BASE, "fontes.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["url", "titulo", "orgao", "tipo", "data_documento", "acessado_em", "arquivo_local"])
        for url, titulo, orgao, tipo, data, arq in fontes:
            w.writerow([url, titulo, orgao, tipo, data, ACESSO, arq])


if __name__ == "__main__":
    s, f = main()
    escrever(s, f)
    print("linhas de series:", len(s), "| fontes:", len(f))
