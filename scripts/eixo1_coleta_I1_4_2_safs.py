# -*- coding: utf-8 -*-
"""I1.4.2 (Restauracao com SAFs): serie de CONTEXTO por UF, Censo Agropecuario 2006 e 2017.

Baixa da API de agregados do IBGE (servicodados.ibge.gov.br/api/v3) a area e o numero de
estabelecimentos com "sistemas agroflorestais" (categoria da variavel "Utilizacao das terras")
e a area total dos estabelecimentos, por UF, nos dois censos. Baixa tambem a planilha
MapBiomas Colecao 11 (Amazonia Legal, nivel estado, 1985-2025) e usa as classes de silvicultura
e de mosaico de usos como contexto longo. Grava somente
dados/eixo1_coleta/I1.4.2_safs/series.csv. fontes.csv, atos.csv e achados.md sao manuais.

Limite do indicador: isto e area de estabelecimentos agropecuarios com SAF (IBGE), nao area
restaurada no PRA. Todas as series saem com rotulo "contexto".

Uso (a partir da raiz do projeto):  python -I scripts/eixo1_coleta_I1_4_2_safs.py
"""
import csv
import gzip
import json
import re
import time
import unicodedata
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
TAREFA = RAIZ / "dados" / "eixo1_coleta" / "I1.4.2_safs"
BRUTOS = TAREFA / "brutos"
SAIDA = TAREFA / "series.csv"
CODIGO = "I1.4.2"
CAT_SAF = "113476"      # Utilizacao das terras: Sistemas agroflorestais
CAT_TOTAL = "110087"    # Utilizacao das terras: Total

# codigo IBGE da UF -> sigla (escopo da tarefa: 9 UFs da Amazonia Legal)
UFS = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
       "16": "AP", "17": "TO", "21": "MA", "51": "MT"}
ORDEM_UF = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]

# variavel "numero de estabelecimentos" com SAF: 183 em 2006, 9587 em 2017 (ambas com area)
FONTES = {
    2006: {
        "url": "https://servicodados.ibge.gov.br/api/v3/agregados/1011/periodos/2006/variaveis/183|184"
               "?localidades=N3[all]&classificacao=222[110087,113476]|12440[0]",
        "meta": "https://servicodados.ibge.gov.br/api/v3/agregados/1011/metadados",
        "arq": "ibge_2006_agregado1011_uf_saf.json",
        "meta_arq": "ibge_2006_agregado1011_metadados.json",
        "var_n": "183",
        "var_n_nome": "Numero de estabelecimentos agropecuarios (todos, na categoria SAF)",
        "agregado": "1011",
        "nota_base": "Censo Agropecuario 2006, agregado 1011 (SIDRA/IBGE)",
    },
    2017: {
        "url": "https://servicodados.ibge.gov.br/api/v3/agregados/6881/periodos/2017/variaveis/9587|184"
               "?localidades=N3[all]&classificacao=829[46302]|222[110087,113476]|218[46502]"
               "|12517[113601]|12567[41151]",
        "meta": "https://servicodados.ibge.gov.br/api/v3/agregados/6881/metadados",
        "arq": "ibge_2017_agregado6881_uf_saf.json",
        "meta_arq": "ibge_2017_agregado6881_metadados.json",
        "var_n": "9587",
        "var_n_nome": "Numero de estabelecimentos agropecuarios com area (na categoria SAF)",
        "agregado": "6881",
        "nota_base": "Censo Agropecuario 2017, agregado 6881 (SIDRA/IBGE); tipologia=Total",
    },
}


# MapBiomas Colecao 11, estatistica de cobertura, Amazonia Legal, nivel estado (planilha .xlsx).
# Serie longa 1985-2025 em hectares. Classes usadas: 9.0 Silvicultura e 21.0 Mosaico de Usos.
# Nao ha classe de SAF nem de vegetacao secundaria neste arquivo: ambas as series sao contexto.
MAPB_URL = ("https://brasil.mapbiomas.org/wp-content/uploads/sites/3/2026/08/"
            "MAPBIOMAS_BRAZIL-COVERAGE_STATISTIC_COL.11-LEGAL_AMAZON_STATE_BIOME.xlsx")
MAPB_ARQ = "mapbiomas_col11_legal_amazon_state_biome.xlsx"
MAPB_ABA = "MAPBIOMAS_30M_COVERAGE_COLLECTI"
MAPB_CLASSES = {
    "9.0": ("mapbiomas_silvicultura_ha",
            "MapBiomas classe 3.3 Silvicultura (plantio florestal). Nao e SAF."),
    "21.0": ("mapbiomas_mosaico_usos_ha",
             "MapBiomas classe 3.4 Mosaico de Usos (agricultura e pastagem misturadas). "
             "Nao separa SAF nesta colecao."),
}
NOME_UF_MAPB = {"Acre": "AC", "Amazonas": "AM", "Amapá": "AP", "Maranhão": "MA",
                "Mato Grosso": "MT", "Pará": "PA", "Rondônia": "RO", "Roraima": "RR",
                "Tocantins": "TO"}
ANOS_MAPB = range(1985, 2026)


def baixar_mapbiomas():
    destino = BRUTOS / MAPB_ARQ
    if destino.exists() and destino.stat().st_size > 0:
        return destino
    baixar(MAPB_URL, destino)
    return destino


def ler_mapbiomas(caminho):
    """Devolve {(uf, class_id, ano): hectares}, somando todos os biomas do estado no arquivo."""
    import openpyxl  # importavel com python -I (site do sistema)

    def norm(s):
        return unicodedata.normalize("NFC", str(s)).strip()

    nomes = {norm(k): v for k, v in NOME_UF_MAPB.items()}
    wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    ws = wb[MAPB_ABA]
    linhas = ws.iter_rows(values_only=True)
    cab = next(linhas)
    i_uf = cab.index("state")
    i_cls = cab.index("class_id")
    cols_ano = [(i, int(h[1:])) for i, h in enumerate(cab)
                if isinstance(h, str) and re.fullmatch(r"y\d{4}", h)]
    out = {}
    for row in linhas:
        if not row or len(row) < len(cab) or row[i_uf] is None or row[i_cls] is None:
            continue
        uf = nomes.get(norm(row[i_uf]))
        if uf is None:
            continue
        try:
            cls = f"{float(row[i_cls])}"  # "9.0", "21.0"
        except (TypeError, ValueError):
            continue
        if cls not in MAPB_CLASSES:
            continue
        for i, ano in cols_ano:
            try:
                v = float(row[i])
            except (TypeError, ValueError):
                continue
            chave = (uf, cls, ano)
            out[chave] = out.get(chave, 0.0) + v
    return out


def baixar(url, destino, tentativas=3):
    """Baixa url para destino (bytes, ja descompactados). Repete em caso de falha de rede."""
    ultimo = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers={"Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, timeout=240) as r:
                dados = r.read()
            if dados[:2] == b"\x1f\x8b":  # resposta gzip
                dados = gzip.decompress(dados)
            destino.write_bytes(dados)
            return dados
        except Exception as e:  # rede/timeout: repete
            ultimo = e
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"falha ao baixar {url}: {ultimo}")


def nome_categoria(meta_bytes, classe_id, cat_id):
    """Le do metadado do IBGE o nome literal de uma categoria."""
    meta = json.loads(meta_bytes.decode("utf-8"))
    for c in meta.get("classificacoes", []):
        if str(c.get("id")) == classe_id:
            for x in c.get("categorias", []):
                if str(x.get("id")) == cat_id:
                    return x.get("nome", "")
    return ""


def ler_valores(bruto_bytes):
    """Devolve {(uf, ano, variavel, categoria_222): valor} apenas para as 9 UFs."""
    dados = json.loads(bruto_bytes.decode("utf-8"))
    out = {}
    for var in dados:
        vid = str(var["id"])
        for res in var.get("resultados", []):
            cat222 = None
            for c in res.get("classificacoes", []):
                if str(c["id"]) == "222":
                    cat222 = list(c["categoria"].keys())[0]
            for s in res.get("series", []):
                cod = str(s["localidade"]["id"])
                if cod not in UFS:
                    continue
                for ano, v in s.get("serie", {}).items():
                    try:
                        num = float(v)
                    except (TypeError, ValueError):
                        num = None  # '-', '..', 'X' etc.: sem valor numerico
                    out[(UFS[cod], int(ano), vid, cat222)] = num
    return out


def fmt(v, casas=None):
    if casas is None:
        return str(int(round(v)))
    s = f"{v:.{casas}f}"
    return s.rstrip("0").rstrip(".") if "." in s else s


def main():
    BRUTOS.mkdir(parents=True, exist_ok=True)
    linhas = []
    pulados = []
    for ano in sorted(FONTES):
        f = FONTES[ano]
        bruto = baixar(f["url"], BRUTOS / f["arq"])
        meta = baixar(f["meta"], BRUTOS / f["meta_arq"])
        nome_saf = nome_categoria(meta, "222", CAT_SAF)
        vals = ler_valores(bruto)
        nota_def = (f"{f['nota_base']}. Categoria SAF (IBGE): '{nome_saf}'. "
                    f"Variavel de numero: {f['var_n_nome']}. Variavel de area: area dos estabelecimentos "
                    f"(ha) na mesma categoria. CONTEXTO: nao e area restaurada nem area do PRA.")
        total_al = {"184": 0.0, f["var_n"]: 0.0, "saf_ha": 0.0, "tot_ha": 0.0}
        ok_al = True
        for uf in ORDEM_UF:
            saf_ha = vals.get((uf, ano, "184", CAT_SAF))
            tot_ha = vals.get((uf, ano, "184", CAT_TOTAL))
            saf_n = vals.get((uf, ano, f["var_n"], CAT_SAF))
            if saf_ha is None or tot_ha is None or saf_n is None:
                pulados.append((uf, ano))
                ok_al = False
                continue
            total_al["saf_ha"] += saf_ha
            total_al["tot_ha"] += tot_ha
            total_al[f["var_n"]] += saf_n
            pct = 100.0 * saf_ha / tot_ha if tot_ha else None
            url = f["url"]
            linhas.append([CODIGO, "area_estab_com_SAF", "contexto", uf, ano, fmt(saf_ha), "hectares", url, nota_def])
            linhas.append([CODIGO, "n_estab_com_SAF", "contexto", uf, ano, fmt(saf_n), "estabelecimentos", url, nota_def])
            linhas.append([CODIGO, "area_total_estab", "contexto", uf, ano, fmt(tot_ha), "hectares", url,
                           "Denominador: area dos estabelecimentos agropecuarios (categoria Total da utilizacao das terras)."])
            if pct is not None:
                linhas.append([CODIGO, "pct_area_estab_com_SAF", "contexto", uf, ano, fmt(pct, 4), "%", url,
                               "Calculado: area SAF / area total dos estabelecimentos, mesmo levantamento. "
                               "Nao e % da area restaurada."])
        if ok_al:
            pct_al = 100.0 * total_al["saf_ha"] / total_al["tot_ha"]
            url = f["url"]
            nota_al = ("AL = soma das 9 UFs (o IBGE publica o MA inteiro; no recorte da Amazonia Legal "
                       "do MapBiomas o MA traz so parte da area, ver series mapbiomas). ")
            linhas.append([CODIGO, "area_estab_com_SAF", "contexto", "AL", ano, fmt(total_al["saf_ha"]),
                           "hectares", url, nota_al + nota_def])
            linhas.append([CODIGO, "n_estab_com_SAF", "contexto", "AL", ano, fmt(total_al[f["var_n"]]),
                           "estabelecimentos", url, nota_al + nota_def])
            linhas.append([CODIGO, "area_total_estab", "contexto", "AL", ano, fmt(total_al["tot_ha"]),
                           "hectares", url, nota_al + "Denominador: area total dos estabelecimentos."])
            linhas.append([CODIGO, "pct_area_estab_com_SAF", "contexto", "AL", ano, fmt(pct_al, 4), "%", url,
                           nota_al + "Calculado: soma SAF / soma total. Nao e % da area restaurada."])

    # Serie longa de contexto (MapBiomas, 1985-2025, hectares), por UF e AL
    mapb = ler_mapbiomas(baixar_mapbiomas())
    for cls, (serie, desc) in MAPB_CLASSES.items():
        for ano in ANOS_MAPB:
            soma_al = 0.0
            completo = True
            for uf in ORDEM_UF:
                # classe ausente no arquivo para a UF = area zero (todas as UFs estao no arquivo)
                v = mapb.get((uf, cls, ano), 0.0)
                soma_al += v
                nota = (f"MapBiomas Colecao 11, estatistica de cobertura (LEGAL_AMAZON_STATE_BIOME, nivel estado; "
                        f"soma de todos os biomas do estado no arquivo; classe ausente = 0). {desc} "
                        f"CONTEXTO: nao e SAF nem area restaurada.")
                if uf == "MA":
                    nota += (" ATENCAO: MA aqui e so a parte do estado dentro do recorte Amazonia Legal do arquivo "
                             "(2025: 26.117.479 ha de 32.945.827 ha do estado, segundo MAPBIOMAS_BRAZIL-COL.11-BIOME_STATE). "
                             "Nao comparar com o MA inteiro do IBGE.")
                linhas.append([CODIGO, serie, "contexto", uf, ano, fmt(v), "hectares", MAPB_URL, nota])
            if completo:
                nota_al = (f"AL = soma das 9 UFs no recorte do arquivo MapBiomas (o MA entra so com a parte "
                           f"do arquivo, nao inteiro). {desc} CONTEXTO.")
                linhas.append([CODIGO, serie, "contexto", "AL", ano, fmt(soma_al), "hectares", MAPB_URL, nota_al])

    with SAIDA.open("w", encoding="utf-8", newline="") as fp:
        w = csv.writer(fp)
        w.writerow(["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"])
        w.writerows(linhas)
    print(f"series.csv: {len(linhas)} linhas gravadas em {SAIDA}")
    if pulados:
        print(f"UF-ano sem valor numerico (nao gravados): {pulados}")


if __name__ == "__main__":
    main()
