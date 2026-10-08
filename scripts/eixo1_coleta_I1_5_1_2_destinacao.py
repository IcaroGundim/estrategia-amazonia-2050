"""Reconstroi series.csv, atos.csv e fontes.csv da tarefa I1.5.1-2 (destinacao).

Rodar da raiz do projeto:  python -I scripts/eixo1_coleta_I1_5_1_2_destinacao.py

Entradas:
- CNUC extrato 2026-07, lido (somente leitura) de
  dados/eixo1_coleta/I1.1.2_cnuc/brutos/cnuc_pos22_cnuc_2026_07.csv
- Tabela de titulos quilombolas do Incra (atualizacao 15/06/2026), em
  dados/eixo1_coleta/I1.5.1-2_destinacao/brutos/incra_titulos_expedidos_quilombolas.pdf
  Convertida com pdftotext -layout (se o binario existir no PATH).
- Linhas coletadas manualmente nas fontes oficiais, na pasta da tarefa:
  series_manual.csv, atos_manual.csv, fontes_manual.csv (mesmos cabecalhos).
  O script apenas as concatena depois das linhas geradas.

Saidas (na pasta da tarefa): series.csv, atos.csv, fontes.csv.
"""

import csv
import io
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TASK = ROOT / "dados" / "eixo1_coleta" / "I1.5.1-2_destinacao"
BRUTOS = TASK / "brutos"
CNUC_FILE = ROOT / "dados" / "eixo1_coleta" / "I1.1.2_cnuc" / "brutos" / "cnuc_pos22_cnuc_2026_07.csv"
CNUC_FONTES = ROOT / "dados" / "eixo1_coleta" / "I1.1.2_cnuc" / "fontes.csv"
CNUC_URL = (
    "https://dados.mma.gov.br/dataset/44b6dc8a-dc82-4a84-8d95-1b0da7c85dac/"
    "resource/72dd3d2d-3cca-4b97-b382-a1c90531e379/download/cnuc_2026_07.csv"
)
INCRA_PDF = BRUTOS / "incra_titulos_expedidos_quilombolas.pdf"
INCRA_TXT = BRUTOS / "incra_titulos_quilombolas_layout.txt"
INCRA_URL = "https://www.gov.br/incra/pt-br/assuntos/governanca-fundiaria/titulos_expedidos_quilombolas.pdf/@@display-file/file"

UFS = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]
ANOS_CNUC = list(range(1978, 2027))
ANOS_INCRA = list(range(1995, 2027))

SERIE_HEADER = ["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"]
ATOS_HEADER = ["codigo", "uf", "tipo_ato", "numero", "data", "assunto", "situacao", "url", "trecho", "confianca"]
FONTES_HEADER = ["url", "titulo", "orgao", "tipo", "data_documento", "acessado_em", "arquivo_local"]

CODIGO = "I1.5.1"

# Orgao expedidor estadual -> UF. Orgaos federais (INCRA, FCP, SPU) e empresas (CEMIG)
# ficam de fora desta lista de proposito.
ORGAO_ESTADUAL_UF = {
    "ITERPA": "PA", "ITERMA": "MA", "ITERTINS": "TO", "INTERPI": "PI", "CDA": "BA",
    "INTERBA": "BA", "ITERBA": "BA", "ITESP": "SP", "IDATERRA": "MS", "ITERJ": "RJ",
    "SEHAF": "RJ", "ITERPE": "PE",
}
ENTRADA_INCRA = re.compile(
    r"(?P<org>[A-Z][A-Z\*]{1,}(?:\s*/\s*[A-Z][A-Z\*]+)*\s*\*{0,3}(?:\s*/\s*)?)\s*"
    r"(?P<area>\d{1,3}(?:\.\d{3})*,\d+)\s+(?P<data>\d{2}/\d{2}/\d{4})"
)
CABECALHO_TERRITORIO = re.compile(r"\b(AC|AM|AP|MA|MT|PA|RO|RR|TO|PI|BA|CE|PB|PE|RN|AL|SE|SP|RJ|MG|ES|GO|MS|PR|SC|RS|DF)\s+\d+\s+\d+\b")


def ler_linhas_csv(path, header):
    """Le um CSV com cabecalho conhecido; devolve lista de listas na ordem do cabecalho."""
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as fh:
        out = []
        for row in csv.DictReader(fh):
            if not any((row.get(k) or "").strip() for k in header):
                continue
            out.append([row.get(k, "") or "" for k in header])
        return out


def para_ha(texto):
    """CNUC e Incra usam ponto como separador de milhar e virgula decimal."""
    t = (texto or "").strip().replace(".", "").replace(",", ".")
    return float(t) if t else 0.0


def iso(data_br):
    d, m, a = data_br.split("/")
    return f"{a}-{int(m):02d}-{int(d):02d}"


# ---------------------------------------------------------------- CNUC

def ler_cnuc():
    raw = CNUC_FILE.read_bytes().decode("cp1252", errors="replace")
    rows = list(csv.reader(io.StringIO(raw), delimiter=";"))
    return rows[0], rows[1:]


def achar_coluna(header, nome, exato=False):
    if exato:
        return header.index(nome)
    return [i for i, x in enumerate(header) if nome in x][0]


def area_ato_corrigida(texto_ato, texto_mapa):
    """Area do ato legal (ha). Se estiver mais de 50x distante da area do mapa
    (soma biomas), usa a area do mapa. Retorna (area, valor_original_se_corrigido)."""
    ato = para_ha(texto_ato)
    mapa = para_ha(texto_mapa)
    if mapa > 0 and ato > 0 and (ato / mapa > 50 or ato / mapa < 1 / 50):
        return mapa, texto_ato.strip()
    return ato, None


def e_apa(categoria):
    return re.search(r"rea de Prote..o Ambiental", categoria) is not None


def e_rppn(categoria):
    return "Particular" in categoria


def parse_ato(texto):
    """Extrai tipo legal, numero e data (ISO) do campo 'Ato Legal de Criacao'."""
    primeiro = texto.split(";")[0].strip()
    m_data = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", primeiro)
    data = f"{m_data.group(3)}-{int(m_data.group(2)):02d}-{int(m_data.group(1)):02d}" if m_data else ""
    prefixo = re.split(r"\s+de\s+\d", primeiro, maxsplit=1)[0]
    prefixo = re.sub(r"\bn[º°o]\.?\s*", "", prefixo, flags=re.IGNORECASE).strip()
    m_num = re.search(r"(\d[\d\.\/]*)", prefixo)
    numero = m_num.group(1).rstrip(".") if m_num else ""
    tipo = prefixo[: m_num.start()].strip() if m_num else prefixo
    return tipo, numero, data


def gerar_cnuc():
    header, linhas = ler_cnuc()
    c_esfera = achar_coluna(header, "Esfera")
    c_uf = achar_coluna(header, "UF", exato=True)
    c_ano = achar_coluna(header, "Ano de Cria")
    c_cat = achar_coluna(header, "Categoria de Manejo", exato=True)
    c_grupo = achar_coluna(header, "Grupo", exato=True)
    c_area = achar_coluna(header, "rea Ato Legal")
    c_mapa = achar_coluna(header, "rea soma biomas")
    c_nome = achar_coluna(header, "Nome da UC", exato=True)
    c_ato = achar_coluna(header, "Ato Legal de Cria")

    estaduais = [
        r for r in linhas
        if len(r) > c_ato and r[c_esfera] == "Estadual" and r[c_uf] in UFS
    ]

    agg = {}
    for uf in UFS + ["AL"]:
        for ano in ANOS_CNUC:
            agg[(uf, ano)] = {"n": 0, "pi": 0.0, "us": 0.0, "apa": 0.0}

    # RPPN e de propriedade privada: fica fora das series de area publica.
    for r in estaduais:
        uf = r[c_uf]
        ano = int(r[c_ano])
        cat = r[c_cat]
        if e_rppn(cat):
            continue
        area, _ = area_ato_corrigida(r[c_area], r[c_mapa])
        if e_apa(cat):
            agg[(uf, ano)]["apa"] += area
            continue
        agg[(uf, ano)]["n"] += 1
        if r[c_grupo].startswith("Prote"):
            agg[(uf, ano)]["pi"] += area
        else:
            agg[(uf, ano)]["us"] += area

    for ano in ANOS_CNUC:
        for k in ("n", "pi", "us", "apa"):
            agg[("AL", ano)][k] = sum(agg[(uf, ano)][k] for uf in UFS)

    nota_base = ("CNUC extrato 2026-07; esfera Estadual; ano de criacao do ato; area do ato legal (ha), "
                 "com area do mapa (soma biomas) no lugar de 3 valores fora de escala (ver atos.csv, AREA CORRIGIDA); "
                 "exclui RPPN (privada)")
    defs = [
        ("ucs_estaduais_criadas_pub_n", "proxy", "UCs", "n", "exclui APA e RPPN"),
        ("area_ha_ucs_estaduais_protecao_integral_criadas", "proxy", "ha", "pi", "grupo Protecao Integral; exclui APA e RPPN"),
        ("area_ha_ucs_estaduais_uso_sustentavel_criadas", "proxy", "ha", "us", "grupo Uso Sustentavel; exclui APA e RPPN"),
        ("area_ha_apas_estaduais_criadas", "contexto", "ha", "apa", "APA pode incluir terra privada; so leitura"),
    ]

    linhas_out = []
    for uf in UFS + ["AL"]:
        acumulado = 0.0
        sufixo_al = "; AL = soma das 9 UFs" if uf == "AL" else ""
        for ano in ANOS_CNUC:
            d = agg[(uf, ano)]
            for serie, rotulo, unidade, chave, nota in defs:
                linhas_out.append([
                    CODIGO, serie, rotulo, uf, str(ano), str(int(d[chave])), unidade, CNUC_URL,
                    f"{nota_base}; {nota}; zero = nenhuma UC com esse ano no extrato{sufixo_al}",
                ])
            acumulado += d["pi"] + d["us"]
            linhas_out.append([
                CODIGO, "area_ha_ucs_estaduais_pub_acumulada", "proxy", uf, str(ano),
                str(int(acumulado)), "ha", CNUC_URL,
                f"{nota_base}; soma acumulada de protecao integral + uso sustentavel; exclui APA e RPPN; "
                f"soma simples: UCs sobrepostas (ex.: FLOE e APA do Rio Pardo, RO, 2010) contam em dobro{sufixo_al}",
            ])

    atos = []
    for r in sorted(estaduais, key=lambda x: (x[c_uf], int(x[c_ano]), x[c_nome])):
        cat = r[c_cat]
        if e_rppn(cat):
            continue
        texto = r[c_ato].strip()
        tipo_legal, numero, data = parse_ato(texto)
        if not data:
            data = r[c_ano]
            confianca = "baixa"
        else:
            confianca = "media"
        if not numero:
            confianca = "baixa"
        rotulo_tipo = "Ato de criacao de APA estadual" if e_apa(cat) else "Ato de criacao de UC estadual"
        area, original = area_ato_corrigida(r[c_area], r[c_mapa])
        nota_area = (f" | AREA CORRIGIDA: ato diz '{original}', fora de escala frente ao mapa; usada a area do mapa"
                     if original else "")
        atos.append([
            CODIGO, r[c_uf],
            f"{tipo_legal or 'Ato sem tipo identificado'} ({rotulo_tipo}; {cat})",
            numero, data,
            f"{r[c_nome]} | {cat} | grupo {r[c_grupo]} | area {area:.0f} ha{nota_area}",
            "vigente", CNUC_URL, texto[:300], confianca,
        ])
    return linhas_out, atos


# ---------------------------------------------------------------- Incra (titulos quilombolas)

def garantir_texto_incra():
    """Converte o PDF com pdftotext -layout, se o binario estiver disponivel."""
    if shutil.which("pdftotext") and INCRA_PDF.exists():
        subprocess.run(["pdftotext", "-layout", str(INCRA_PDF), str(INCRA_TXT)], check=True)
    # O texto do pdftotext vem em ISO-8859-1 (sem UTF-8).
    return INCRA_TXT.read_text(encoding="latin-1").splitlines()


def gerar_incra():
    """Titulos expedidos a comunidades quilombolas por orgao estadual, por UF e ano.

    Atribuicao de UF pelo proprio orgao (ITERPA = PA, ITERMA = MA, ...), e nao pela
    posicao da linha, porque as linhas de continuacao da tabela nao trazem UF.
    Linhas que so trazem area e data (sem orgao) nao entram nas series.
    """
    linhas = garantir_texto_incra()
    titulos = []
    territorio = ""
    for l in linhas:
        if CABECALHO_TERRITORIO.search(l):
            partes = re.split(r"\s{2,}", l.strip())
            if len(partes) > 1 and not re.match(r"^\d+$", partes[0]):
                territorio = partes[0]
            elif len(partes) > 1:
                territorio = partes[1]
        for m in ENTRADA_INCRA.finditer(l):
            org_bruto = m.group("org")
            org = re.sub(r"[\*\s/]+$", "", org_bruto).strip()
            org = re.sub(r"\s*/.*$", "", org)
            if org not in ORGAO_ESTADUAL_UF:
                continue
            titulos.append({
                "org": org,
                "uf": ORGAO_ESTADUAL_UF[org],
                "ano": int(m.group("data")[-4:]),
                "data": m.group("data"),
                "ha": para_ha(m.group("area")),
                "parceria": "**" in org_bruto,
                "suspensivo": "*" in org_bruto.replace("**", ""),
                "territorio": territorio,
                "trecho": re.sub(r"\s+", " ", l.strip())[:300],
            })

    nota_base = "Incra/DQ, tabela 'Titulos expedidos as comunidades quilombolas' (atualizada em 15/06/2026); orgao estadual por UF; area do titulo (ha)"
    series = []
    ufs_com_titulos = sorted({t["uf"] for t in titulos if t["uf"] in UFS})
    for uf in ufs_com_titulos:
        for ano in ANOS_INCRA:
            n = sum(1 for t in titulos if t["uf"] == uf and t["ano"] == ano)
            ha = sum(t["ha"] for t in titulos if t["uf"] == uf and t["ano"] == ano)
            series.append([CODIGO, "titulos_quilombolas_orgao_estadual_n", "componente", uf, str(ano), str(n), "titulos", INCRA_URL,
                           f"{nota_base}; zero = nenhum titulo estadual na tabela naquele ano"])
            series.append([CODIGO, "area_ha_titulos_quilombolas_orgao_estadual", "componente", uf, str(ano), f"{ha:.4f}".rstrip("0").rstrip("."), "ha", INCRA_URL,
                           f"{nota_base}; zero = nenhum titulo estadual na tabela naquele ano"])
    for ano in ANOS_INCRA:
        n = sum(1 for t in titulos if t["uf"] in UFS and t["ano"] == ano)
        ha = sum(t["ha"] for t in titulos if t["uf"] in UFS and t["ano"] == ano)
        series.append([CODIGO, "titulos_quilombolas_orgao_estadual_n", "componente", "AL", str(ano), str(n), "titulos", INCRA_URL,
                       f"{nota_base}; AL = soma das 9 UFs; zero = nenhum titulo estadual na tabela naquele ano"])
        series.append([CODIGO, "area_ha_titulos_quilombolas_orgao_estadual", "componente", "AL", str(ano), f"{ha:.4f}".rstrip("0").rstrip("."), "ha", INCRA_URL,
                       f"{nota_base}; AL = soma das 9 UFs; zero = nenhum titulo estadual na tabela naquele ano"])

    atos = []
    for t in sorted([t for t in titulos if t["uf"] in UFS], key=lambda x: (x["uf"], x["ano"], x["data"])):
        flags = []
        if t["parceria"]:
            flags.append("expedido por orgao estadual em parceria com INCRA/MDA (**)")
        if t["suspensivo"]:
            flags.append("contem clausulas suspensivas (*)")
        assunto = f"Territorio quilombola: {t['territorio'] or 'nao identificado na linha'} | area do titulo {t['ha']:.4f} ha | orgao {t['org']}"
        if flags:
            assunto += " | " + "; ".join(flags)
        atos.append([
            CODIGO, t["uf"],
            "Titulo coletivo de dominio quilombola (orgao estadual)",
            "", iso(t["data"]),
            assunto, "vigente", INCRA_URL, t["trecho"], "alta",
        ])
    return series, atos


def fonte_incra():
    return [[
        INCRA_URL,
        "Titulos expedidos as comunidades quilombolas de 1995 a atualidade, por orgaos fundiarios federais, estaduais e municipais (tabela INCRA/DQ)",
        "INCRA (Diretoria de Quilombolas)",
        "primaria",
        "2026-06-15",
        "2026-10-07",
        "dados/eixo1_coleta/I1.5.1-2_destinacao/brutos/incra_titulos_expedidos_quilombolas.pdf",
    ]]


# ---------------------------------------------------------------- fontes

def gerar_fontes_cnuc():
    if not CNUC_FONTES.exists():
        return []
    with CNUC_FONTES.open(encoding="utf-8", newline="") as fh:
        for row in csv.DictReader(fh):
            if row.get("url") == CNUC_URL:
                return [[row[k] for k in FONTES_HEADER]]
    return []


def escrever(path, header, linhas):
    with path.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(header)
        w.writerows(linhas)


def main():
    cnuc_series, cnuc_atos = gerar_cnuc()
    incra_series, incra_atos = gerar_incra()
    series = cnuc_series + incra_series + ler_linhas_csv(TASK / "series_manual.csv", SERIE_HEADER)
    atos = cnuc_atos + incra_atos + ler_linhas_csv(TASK / "atos_manual.csv", ATOS_HEADER)
    fontes = gerar_fontes_cnuc() + fonte_incra() + ler_linhas_csv(TASK / "fontes_manual.csv", FONTES_HEADER)

    escrever(TASK / "series.csv", SERIE_HEADER, series)
    escrever(TASK / "atos.csv", ATOS_HEADER, atos)
    escrever(TASK / "fontes.csv", FONTES_HEADER, fontes)
    print(f"series.csv: {len(series)} linhas (CNUC {len(cnuc_series)}, Incra {len(incra_series)})")
    print(f"atos.csv: {len(atos)} linhas (CNUC {len(cnuc_atos)}, Incra {len(incra_atos)})")
    print(f"fontes.csv: {len(fontes)} linhas")


if __name__ == "__main__":
    main()
