# -*- coding: utf-8 -*-
"""Coleta I1.3.2 - autorizacoes de supressao de vegetacao e legalidade do desmatamento.

Rodar da raiz do projeto:  python -I scripts/eixo1_coleta_I1_3_2_autorizacoes.py

Entradas (baixadas se nao existirem em brutos/):
  - Sinaflor ASV (autorizacao de supressao de vegetacao) e Sinaflor UAS (uso alternativo do solo),
    tabelas publicas do portal de dados abertos do IBAMA (CSV).
  - PRODES/INPE por UF e ciclo, TerraBrasilis (rates2025.json).
Tabelas de estudos de terceiros (WWF/ICV/Imaflora/UFMG 2021; MapBiomas RAD 2023 e 2024)
estao transcritas abaixo com a pagina do PDF de origem; os valores foram conferidos
na leitura do texto extraido dos PDFs (ver achados.md).

Saidas (pasta dados/eixo1_coleta/I1.3.2_autorizacoes/):
  - series.csv   (formato longo: codigo,serie,rotulo,uf,ano,valor,unidade,fonte_url,nota)
  - fontes.csv   (url,titulo,orgao,tipo,data_documento,acessado_em,arquivo_local)
"""
import csv
import hashlib
import json
import os
import unicodedata
import urllib.request
from collections import defaultdict

PASTA = os.path.join("dados", "eixo1_coleta", "I1.3.2_autorizacoes")
BRUTOS = os.path.join(PASTA, "brutos")
ACESSO = "2026-10-07"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

# UFs do escopo. AL (Amazonia Legal agregado) nao aparece nestas series.
UFS = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]
# UFs em que o PRODES (so bioma Amazonia) e denominador adequado para comparar com autorizacoes.
# MA, MT e TO tem supressao majoritariamente de Cerrado (ver achados.md): proxy nao calculado.
UFS_PROXY = ["AC", "AM", "AP", "PA", "RO", "RR"]

URL_ASV = ("https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/dados/"
           "SINAFLOR/AutSuprVegetacao/sinaflor-autorizacao-de-supressao-de-vegetacao.csv")
URL_ASV_META = ("https://dadosabertos.ibama.gov.br/dataset/3077864c-729b-4f37-969f-151725ac97fe/"
                "resource/bd5d10bf-c952-4f96-9ea4-e208e41d18d4/download/"
                "sinaflor-autorizacao-de-supressao-de-vegetacao.csv")
URL_CKAN_ASV = ("https://dadosabertos.ibama.gov.br/api/3/action/package_show"
                "?id=sinaflor-autorizacao-de-supressao-de-vegetacao")
URL_UAS = ("https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/dados/"
           "SINAFLOR/usoAlternativoDoSolo/uso-alternativo-do-solo.csv")
URL_UAS_META = ("https://dadosabertos.ibama.gov.br/pt_BR/dataset/bd827dc1-ca3d-41c7-b554-5fdbaee77a2e/"
                "resource/1400b471-62bc-4328-a7fb-047923b28781/download/sinaflor-uso-alternativo-do-solo.csv")
URL_CKAN_UAS = ("https://dadosabertos.ibama.gov.br/api/3/action/package_show"
                "?id=sinaflor-uso-alternativo-do-solo")
URL_TERRABRASILIS = ("https://terrabrasilis.dpi.inpe.br/app/prodes/dashboard/deforestation/"
                     "files/rates2025.json")
URL_WWF = ("https://wwfbrnew.awsassets.panda.org/downloads/"
           "desmatamento_ilegal_na_amazonia_e_no_matopiba___estudo_completo.pdf")
URL_RAD2024 = ("https://web.archive.org/web/2025id_/https://alerta.mapbiomas.org/wp-content/"
               "uploads/sites/17/2025/05/RAD2024_15.05.pdf")
URL_RAD2023 = ("https://web.archive.org/web/2025id_/https://alerta.mapbiomas.org/wp-content/"
               "uploads/sites/17/2024/10/RAD2023_COMPLETO_15-10-24_PORTUGUES.pdf")
URL_ICV_MT_2024 = ("https://ihu.unisinos.br/647042-ilegalidade-atinge-75-do-desmatamento-"
                   "registrado-em-mato-grosso-em-2024")

# Mapeamento loiname (TerraBrasilis) -> UF. Conferido contra dados/prodes/prodes_rates_uf.csv em main().
MAPA_LOINAME = {18277: "RO", 18278: "AC", 18279: "AM", 18280: "RR", 18281: "PA",
                18282: "AP", 18283: "TO", 18285: "MT", 18288: "MA"}

# WWF/ICV/Imaflora/UFMG (2021), Tabela 7, p.14: autorizacoes de supressao de vegetacao natural
# por ano de emissao (2008 ao 2o semestre de 2020). Colunas do PDF: AC AP AM BA MA MT PA PI RO RR TO
WWF_T7 = {
    2008: {"MT": 6},
    2009: {"MT": 8},
    2010: {"MT": 12, "PA": 1, "RR": 44},
    2011: {"MT": 26, "PA": 4},
    2012: {"MT": 21, "PA": 5, "RR": 28},
    2013: {"MT": 17, "PA": 3, "RR": 7, "TO": 8},
    2014: {"MT": 31, "PA": 5, "RR": 33, "TO": 671},
    2015: {"MT": 22, "PA": 2, "RR": 39, "TO": 194},
    2016: {"MT": 30, "PA": 3, "RR": 55, "TO": 189},
    2017: {"MT": 45, "PA": 1, "RR": 37, "TO": 259},
    2018: {"AM": 21, "MA": 1, "MT": 117, "PA": 2, "RR": 50, "TO": 86},
    2019: {"AC": 3, "AP": 61, "AM": 1, "MA": 104, "MT": 94, "PA": 10, "RO": 17, "RR": 75, "TO": 170},
    2020: {"AC": 11, "AP": 76, "AM": 3, "MA": 89, "MT": 93, "PA": 2, "RO": 18, "RR": 50, "TO": 303},
}
WWF_T7_TOTAL = {"AC": 14, "AP": 137, "AM": 25, "MA": 194, "MT": 522, "PA": 38,
                "RO": 35, "RR": 418, "TO": 1880}

# Cobertura conhecida por UF (MapBiomas RAD2024, Tabela B e Quadro 5; registros do proprio CSV).
COBERTURA = {
    "AC": "Cobertura: RAD2024 lista AC sem base estadual publica de ASV (dados so por pedido, com restricao de uso).",
    "AM": "Cobertura: RAD2024 lista para AM apenas autos e embargos no portal; Sinaflor e a base disponivel.",
    "AP": "Cobertura: RAD2024 registra base de autorizacoes da SEMA-AP recebida por pedido; comparar com Sinaflor.",
    "PA": "Cobertura: RAD2024 acessou base estadual de supressao (PA asv); Sinaflor-PA e parcial; limite inferior subestima A.",
    "RO": "Cobertura: RAD2024 acessou base estadual de ASV em xlsx (01/04/2025); conferir com Sinaflor-RO.",
    "RR": "Cobertura: RAD2024 cita RR sem dados publicos de autorizacao; Sinaflor-RR e a base disponivel; cobertura incerta.",
}

# MapBiomas RAD 2024, Tabela 71 (p.150): % da area desmatada com autorizacao E/OU acao de fiscalizacao,
# por ano de alerta 2019-2024 (medicao ate abril de 2025). Contexto: NAO e so autorizacao.
RAD24_T71 = {
    "AC": [24.5, 27.6, 29.3, 38.5, 30.2, 20.8],
    "AM": [62.6, 54.5, 65.5, 74.1, 55.1, 27.2],
    "AP": [56.2, 45.2, 41.0, 69.1, 42.2, 39.8],
    "MA": [16.2, 31.9, 22.3, 29.9, 38.8, 55.9],
    "MT": [70.7, 77.6, 85.8, 89.2, 88.6, 84.8],
    "PA": [46.0, 49.4, 53.1, 52.9, 36.6, 23.1],
    "RO": [40.8, 40.7, 43.7, 47.6, 42.3, 30.6],
    "RR": [34.1, 43.2, 38.5, 54.1, 54.5, 71.1],
    "TO": [32.1, 42.1, 70.2, 76.1, 79.6, 81.9],
}


def baixar(url, destino):
    """Baixa url para destino se ainda nao existir. Grava em arquivo temporario antes."""
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return destino
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    tmp = destino + ".part"
    with urllib.request.urlopen(req, timeout=600) as r, open(tmp, "wb") as f:
        while True:
            bloco = r.read(1 << 16)
            if not bloco:
                break
            f.write(bloco)
    os.replace(tmp, destino)
    return destino


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def norm(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


def num(s):
    s = (s or "").strip()
    if not s:
        return 0.0, True
    try:
        return float(s.replace(",", ".")), True
    except ValueError:
        return 0.0, False


def ler_sinaflor(path):
    """Uma linha por (autorizacao x responsavel tecnico). Deduplica por NRO_AUTORIZACAO."""
    autos = {}
    situacoes = defaultdict(set)
    n_linhas = 0
    with open(path, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f, delimiter=";"):
            n_linhas += 1
            k = r["NRO_AUTORIZACAO"].strip()
            if not k:
                continue
            situacoes[k].add(r["SITUACAO"].strip())
            autos.setdefault(k, r)
    inconsistentes = sum(1 for v in situacoes.values() if len(v) > 1)
    return n_linhas, autos, inconsistentes


def agregar_sinaflor(autos):
    """Por UF e ano de emissao: contagem e area (todas situacoes; nao canceladas; amazonia nao canceladas)."""
    vazio = {"n": 0, "n_canc": 0, "area": 0.0, "area_nc": 0.0, "area_amz_nc": 0.0,
             "sem_area": 0, "amz_nc_n": 0, "sem_bioma_n": 0, "integrada_n": 0}
    agg = defaultdict(lambda: defaultdict(lambda: dict(vazio)))
    erros_data = 0
    for k, r in autos.items():
        uf = r["UF"].strip().upper()
        if uf not in UFS:
            continue
        ano = r["DATA_DE_EMISSAO"].strip()[-4:]
        if not ano.isdigit():
            erros_data += 1
            continue
        a = agg[uf][int(ano)]
        area, _ok = num(r["AREA_TOTAL_PROJ"])
        cancelada = "cancelad" in norm(r["SITUACAO"])
        bioma = norm(r["BIOMA"])
        a["n"] += 1
        if cancelada:
            a["n_canc"] += 1
        if not r["AREA_TOTAL_PROJ"].strip():
            a["sem_area"] += 1
        a["area"] += area
        if not cancelada:
            a["area_nc"] += area
        if bioma in ("", "-"):
            a["sem_bioma_n"] += 1
        if norm(r["COMPETENCIA_DA_AVALIACAO"]) == "autorizacao integrada":
            a["integrada_n"] += 1
        if bioma in ("amazonia", "floresta amazonica") and not cancelada:
            a["area_amz_nc"] += area
            a["amz_nc_n"] += 1
    return agg, erros_data


def ler_prodes(path_json):
    d = json.load(open(path_json, encoding="utf-8"))
    serie = defaultdict(dict)
    tipos = set()
    for p in d["periods"]:
        ano = p["endDate"]["year"]
        for f in p["features"]:
            for ar in f["areas"]:
                tipos.add(ar["type"])
            serie[f["loiname"]][ano] = [ar["area"] for ar in f["areas"] if ar["type"] == 1][0]
    return serie, tipos


def verificar_mapa_prodes(serie):
    """Confirma o mapa loiname->UF contra o CSV local de PRODES (valores exatos, todos os anos)."""
    local_csv = os.path.join("dados", "prodes", "prodes_rates_uf.csv")
    if not os.path.exists(local_csv):
        return "csv local ausente; mapa usado sem conferencia adicional"
    local = defaultdict(dict)
    with open(local_csv, encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            local[r["uf"]][int(r["ano"])] = int(r["taxa_km2"])
    total = 0
    for lid, uf in MAPA_LOINAME.items():
        s = serie[lid]
        comuns = [y for y in s if y in local[uf]]
        iguais = sum(1 for y in comuns if s[y] == local[uf][y])
        assert iguais == len(comuns) and len(comuns) >= 30, (lid, uf, iguais, len(comuns))
        total += len(comuns)
    return f"mapa conferido: {len(MAPA_LOINAME)} UFs, {total} pares ano-UF iguais ao CSV local"


def fmt(x, casas=2):
    if isinstance(x, float):
        return f"{x:.{casas}f}"
    return str(x)


def vazio_agg():
    return {"n": 0, "n_canc": 0, "area": 0.0, "area_nc": 0.0, "area_amz_nc": 0.0,
            "sem_area": 0, "amz_nc_n": 0, "sem_bioma_n": 0, "integrada_n": 0}


def main():
    os.makedirs(BRUTOS, exist_ok=True)
    # ---- 1. Downloads (so se faltar)
    p_asv = baixar(URL_ASV, os.path.join(BRUTOS, "sinaflor_asv.csv"))
    p_asv_meta = baixar(URL_ASV_META, os.path.join(BRUTOS, "sinaflor_asv_metadados.csv"))
    p_uas = baixar(URL_UAS, os.path.join(BRUTOS, "sinaflor_uas.csv"))
    p_uas_meta = baixar(URL_UAS_META, os.path.join(BRUTOS, "sinaflor_uas_metadados.csv"))
    p_tb = baixar(URL_TERRABRASILIS, os.path.join(BRUTOS, "terrabrasilis_rates2025.json"))
    for nome, p in [("sinaflor_asv.csv", p_asv), ("sinaflor_uas.csv", p_uas),
                    ("terrabrasilis_rates2025.json", p_tb)]:
        print(f"hash {nome}: {sha256(p)}")

    # Conferencia interna da transcricao da Tabela 7 (WWF 2021) contra os totais publicados
    for uf in UFS:
        soma = sum(WWF_T7[ano].get(uf, 0) for ano in WWF_T7)
        assert soma == WWF_T7_TOTAL[uf], ("WWF T7", uf, soma, WWF_T7_TOTAL[uf])

    # ---- 2. Sinaflor: ASV e UAS (bases distintas; nenhum NRO_AUTORIZACAO em comum)
    bases = {}
    for nome, path in [("ASV", p_asv), ("UAS", p_uas)]:
        n_linhas, autos, inconsist = ler_sinaflor(path)
        agg, erros_data = agregar_sinaflor(autos)
        bases[nome] = {"agg": agg, "autos": autos}
        print(f"Sinaflor {nome}: {n_linhas} linhas; {len(autos)} autorizacoes distintas; "
              f"com mais de uma situacao: {inconsist}; erros de data: {erros_data}")
    chaves_asv = set(bases["ASV"]["autos"])
    chaves_uas = set(bases["UAS"]["autos"])
    print(f"sobreposicao de NRO_AUTORIZACAO entre ASV e UAS: {len(chaves_asv & chaves_uas)}")

    # ---- 3. PRODES (TerraBrasilis)
    prodes_km2, tipos = ler_prodes(p_tb)
    print("tipos de area no JSON:", sorted(tipos))
    print(verificar_mapa_prodes(prodes_km2))
    prodes_ha = {}
    for lid, uf in MAPA_LOINAME.items():
        prodes_ha[uf] = {ano: v * 100 for ano, v in prodes_km2[lid].items()}

    series = []  # (codigo, serie, rotulo, uf, ano, valor, unidade, fonte_url, nota)
    cod = "I1.3.2"
    fonte_asv = URL_ASV
    fonte_uas = URL_UAS
    fonte_tb = URL_TERRABRASILIS
    unid_area = "ha (unidade presumida; dicionario nao informa)"

    # 3a. Sinaflor ASV e UAS - componentes (contagem e area) 2018-2026
    for nome, url in [("ASV", fonte_asv), ("UAS", fonte_uas)]:
        agg = bases[nome]["agg"]
        for uf in UFS:
            for ano in range(2018, 2027):
                a = agg[uf].get(ano) or vazio_agg()
                nota_base = ""
                if ano == 2018:
                    nota_base = "base Sinaflor inicia em maio de 2018 (integracao estadual; ano parcial). "
                if ano == 2026:
                    nota_base = "ano parcial ate 2026-10-07. "
                if a["n"] == 0:
                    nota_base += "nenhum registro na base Sinaflor. "
                series.append((cod, f"{nome}_N_SINAFLOR", "componente", uf, ano, a["n"],
                               "autorizacoes (contagem)", url,
                               nota_base + f"base {nome} emitidas no ano civil; inclui {a['n_canc']} canceladas; "
                               f"{a['integrada_n']} com competencia 'Autorizacao Integrada'; "
                               f"{a['sem_bioma_n']} sem bioma informado."))
                series.append((cod, f"{nome}_AREA_SINAFLOR_HA", "componente", uf, ano, round(a["area"], 2),
                               unid_area, url,
                               nota_base + "soma da area do projeto por autorizacao (todas situacoes); "
                               f"{a['sem_area']} sem area informada entram como zero."))
                series.append((cod, f"{nome}_AREA_AMZ_NAOCANC_HA", "componente", uf, ano,
                               round(a["area_amz_nc"], 2), unid_area, url,
                               nota_base + "apenas BIOMA Amazonia/Floresta amazonica e sem canceladas "
                               f"({a['amz_nc_n']} autorizacoes); subestima porque "
                               f"{a['sem_bioma_n']} registros nao tem bioma."))

    # 3b. PRODES (componente) 1988-2025, em ha (1 km2 = 100 ha)
    for uf in UFS:
        for ano in sorted(prodes_ha[uf]):
            series.append((cod, "PRODES_DESMAT_HA", "componente", uf, ano, prodes_ha[uf][ano], "ha",
                           fonte_tb,
                           "taxa consolidada PRODES Legal Amazon, valor publicado em km2 x 100; "
                           "ano = fim do ciclo PRODES (ago do ano anterior a jul do ano)."))

    # 3c. WWF/ICV 2021 - contagem de ASV por ano de emissao 2008-2020 (secundaria)
    for uf in UFS:
        for ano in range(2008, 2021):
            v = WWF_T7.get(ano, {}).get(uf, 0)
            series.append((cod, "ASV_N_ESTUDO_WWF2021", "componente", uf, ano, v,
                           "autorizacoes (contagem)", URL_WWF,
                           "fonte secundaria: Tabela 7 p.14; autorizacoes de supressao de vegetacao natural "
                           "obtidas pelos pesquisadores em bases estaduais (LAI/transparencia). "
                           "Pode incluir tipos alem da ASV; nao comparavel 1:1 com Sinaflor. "
                           "Ano 2020 vai ate o 2o semestre."))

    # 3d. Proxies 2019-2025 para UFS_PROXY: limites da % sem autorizacao (ASV + UAS), com D = PRODES
    #   superior: (D - A_amz)/D; A_amz = so bioma Amazonia, sem canceladas
    #   inferior: (D - A_tot)/D; A_tot = todos os biomas, sem canceladas
    proxy_nao_interp = []
    proxy_sem_registro = []
    for uf in UFS_PROXY:
        for ano in range(2019, 2026):
            pr = prodes_ha[uf].get(ano)
            asv = bases["ASV"]["agg"][uf].get(ano) or vazio_agg()
            uas = bases["UAS"]["agg"][uf].get(ano) or vazio_agg()
            if not pr:
                continue
            if asv["n"] + uas["n"] == 0:
                proxy_sem_registro.append((uf, ano))
                continue
            a_amz = asv["area_amz_nc"] + uas["area_amz_nc"]
            a_tot = asv["area_nc"] + uas["area_nc"]
            base_nota = ("proxy: limite da % sem autorizacao; A = ASV + UAS (bases distintas), area autorizada "
                         "(nao desmatada); ano civil contra ciclo PRODES ago-jul. " + COBERTURA.get(uf, ""))
            pct_sup = (pr - a_amz) / pr * 100
            pct_inf = (pr - a_tot) / pr * 100
            if 0 <= pct_sup <= 100:
                series.append((cod, "PROXY_DESMAT_SEM_AUT_LIMITE_SUP_PCT", "proxy", uf, ano,
                               round(pct_sup, 2), "%", f"{URL_ASV} | {URL_UAS} | {URL_TERRABRASILIS}",
                               base_nota + " Limite superior: so bioma Amazonia."))
            else:
                proxy_nao_interp.append((uf, ano, "sup", round(pct_sup, 1)))
            if 0 <= pct_inf <= 100:
                series.append((cod, "PROXY_DESMAT_SEM_AUT_LIMITE_INF_PCT", "proxy", uf, ano,
                               round(pct_inf, 2), "%", f"{URL_ASV} | {URL_UAS} | {URL_TERRABRASILIS}",
                               base_nota + " Limite inferior: todos os biomas da base."))
            else:
                proxy_nao_interp.append((uf, ano, "inf", round(pct_inf, 1)))

    # 3e. MapBiomas RAD 2024, Tabela 71 (p.150) - contexto: % area com autorizacao OU fiscalizacao
    for uf in UFS:
        for i, ano in enumerate(range(2019, 2025)):
            series.append((cod, "CONTEXTO_RAD2024_AREA_AUT_OU_FISC_PCT", "contexto", uf, ano,
                           RAD24_T71[uf][i], "% da area desmatada (alertas MapBiomas)", URL_RAD2024,
                           "fonte secundaria (MapBiomas RAD2024, Tabela 71 p.150): mistura autorizacao e "
                           "acao de fiscalizacao; ano = ano do alerta; medicao ate abril de 2025."))

    # ---- 4. Escrita
    os.makedirs(PASTA, exist_ok=True)
    with open(os.path.join(PASTA, "series.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        w.writerow(["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"])
        for row in series:
            codigo, serie_nome, rotulo, uf, ano, valor, unidade, url, nota = row
            w.writerow([codigo, serie_nome, rotulo, uf, ano, fmt(valor, 2) if isinstance(valor, float) else valor,
                        unidade, url, nota])

    fontes = [
        (URL_ASV, "Sinaflor - Autorizacao de Supressao de Vegetacao (CSV, dados abertos)",
         "IBAMA", "primaria", "ultima atualizacao do relatorio em 07/10/2026 01:08 (campo ULTIMA_ATUALIZACAO_RELATORIO)",
         ACESSO, os.path.join(BRUTOS, "sinaflor_asv.csv")),
        (URL_ASV_META, "Sinaflor ASV - dicionario de dados (metadados do conjunto)",
         "IBAMA", "primaria", "conjunto atualizado em 2026-04-10 (metadata_modified); recurso em 2025-11-10",
         ACESSO, os.path.join(BRUTOS, "sinaflor_asv_metadados.csv")),
        (URL_CKAN_ASV, "Portal de dados abertos IBAMA - API package_show do conjunto Sinaflor ASV",
         "IBAMA", "primaria", "metadata_modified 2026-04-10; frequencia de atualizacao Semanal",
         ACESSO, os.path.join(BRUTOS, "ckan_pkg_asv.json")),
        (URL_UAS, "Sinaflor - Uso Alternativo do Solo (CSV, dados abertos)",
         "IBAMA", "primaria", "conjunto modificado em 2026-07-08 (metadata_modified); frequencia Semanal",
         ACESSO, os.path.join(BRUTOS, "sinaflor_uas.csv")),
        (URL_UAS_META, "Sinaflor UAS - dicionario de dados (metadados do conjunto)",
         "IBAMA", "primaria", "recurso do conjunto Sinaflor Uso Alternativo do Solo",
         ACESSO, os.path.join(BRUTOS, "sinaflor_uas_metadados.csv")),
        (URL_CKAN_UAS, "Portal de dados abertos IBAMA - API package_show do conjunto Sinaflor UAS",
         "IBAMA", "primaria", "metadata_modified 2026-07-08",
         ACESSO, os.path.join(BRUTOS, "ckan_pkg_uas.json")),
        (URL_TERRABRASILIS, "TerraBrasilis - PRODES Legal Amazon, taxas por periodo (rates2025.json)",
         "INPE", "primaria", "ciclo PRODES 2025 (versao revisada)", ACESSO,
         os.path.join(BRUTOS, "terrabrasilis_rates2025.json")),
        (URL_WWF, "Desmatamento ilegal na Amazonia e no Matopiba: falta transparencia e acesso a informacao",
         "WWF-Brasil com ICV, Imaflora e UFMG (conforme texto do estudo)", "secundaria",
         "marco de 2021", ACESSO, os.path.join(BRUTOS, "wwf_desmatamento_ilegal_amazonia_matopiba.pdf")),
        (URL_RAD2024, "MapBiomas RAD2024 - Relatorio Anual do Desmatamento no Brasil 2024 (copia Wayback)",
         "MapBiomas", "secundaria", "maio de 2025 (RAD2024_15.05)", ACESSO, os.path.join(BRUTOS, "rad2024.pdf")),
        (URL_RAD2023, "MapBiomas RAD2023 - Relatorio Anual do Desmatamento no Brasil 2023 (copia Wayback)",
         "MapBiomas", "secundaria", "outubro de 2024 (RAD2023_COMPLETO_15-10-24)", ACESSO,
         os.path.join(BRUTOS, "rad2023.pdf")),
        (URL_ICV_MT_2024, "Ilegalidade atinge 75% do desmatamento registrado em Mato Grosso em 2024 (IHU, reproduz nota tecnica ICV de 10/12/2024)",
         "ICV via IHU/Unisinos (reproducao jornalistica)", "secundaria",
         "reportagem de 11/12/2024; nota tecnica ICV de 10/12/2024", ACESSO, ""),
    ]
    with open(os.path.join(PASTA, "fontes.csv"), "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
        w.writerow(["url", "titulo", "orgao", "tipo", "data_documento", "acessado_em", "arquivo_local"])
        for linha in fontes:
            w.writerow(linha)

    print(f"series.csv: {len(series)} linhas")
    print("proxies nao interpretaveis (pct fora de 0-100):", proxy_nao_interp)
    print("UF-anos sem registro Sinaflor (proxy nao calculado):", proxy_sem_registro)
    print("UFs sem proxy (denominador PRODES so Amazonia; supressao majoritariamente Cerrado):",
          [u for u in UFS if u not in UFS_PROXY])


if __name__ == "__main__":
    main()
