# -*- coding: utf-8 -*-
"""I1.3.7 - Plano de Manejo Integrado do Fogo (Sisfogo / Prevfogo).

Etapa 1 (coleta): baixa camadas publicas do portal ArcGIS do Sisfogo para
dados/eixo1_coleta/I1.3.7_fogo/brutos/sisfogo/*.json (sem token).
Etapa 2 (series): gera dados/eixo1_coleta/I1.3.7_fogo/series.csv a partir dos
JSON baixados. fontes.csv, atos.csv e achados.md sao curados a mao a partir dos
documentos lidos e nao sao gerados aqui.

Rodar a partir da raiz do projeto (padrao: coleta + series):
    python -I scripts/eixo1_coleta_I1_3_7_fogo.py
Modos: "coletar" ou "series" para rodar so uma etapa.
"""
import csv
import datetime as dt
import json
import os
import sys
import time
import urllib.parse
import urllib.request

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PASTA = os.path.join(RAIZ, "dados", "eixo1_coleta", "I1.3.7_fogo")
BRUTOS = os.path.join(PASTA, "brutos", "sisfogo")
ACESSO = dt.date.today().isoformat()

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json",
}
BASE = "https://sisfogo.ibama.gov.br/server/rest/services"

# nome local -> (caminho do servico/camada, campos a pedir ou '*')
CAMADAS = {
    "adesao_sisfogo": ("Ades%C3%A3oSisfogo/Ades%C3%A3o_Sisfogo/FeatureServer/0", "*"),
    "brigadas_17_25": ("Brigadas_17_a_25/FeatureServer/0", "*"),
    "brigadas_prevfogo_2025": ("Brigadas_prevfogo_2025/FeatureServer/0", "*"),
    "brigadas_prevfogo_2026": ("Brigadas_Prevfogo_Ibama_2026/FeatureServer/0", "*"),
    "queima_controlada": ("wfs/Prevfogo/MapServer/0", "*"),
    "queima_prescrita": ("wfs/Prevfogo/MapServer/1", "*"),
    "roi_ocorrencias": ("wfs/Prevfogo/MapServer/5", "*"),
    # series historicas 2017-2025 (uma linha por brigada, colunas por ano)
    "historico_queima_controlada": ("Hist%C3%B3rico_Queima_Controlada/FeatureServer/0", "*"),
    "historico_queima_prescrita": ("Hist%C3%B3rico_Queima_Prescrita/FeatureServer/0", "*"),
    "historico_aceiros": ("Hist%C3%B3rico_Aceiros/FeatureServer/0", "*"),
}

# camadas opcionais: falha registrada como bloqueio, sem interromper a coleta
CAMADAS_OPCIONAIS = {
    "roi_desatualizado": ("ROI_Registro_de_Ocorr%C3%AAncia_de_Inc%C3%AAndio/FeatureServer/0", "*"),
}


def _get(url, tentativas=3):
    ultimo = None
    for i in range(tentativas):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001 - registrar e tentar de novo
            ultimo = e
            time.sleep(3 * (i + 1))
    raise RuntimeError("falha em %s: %r" % (url, ultimo))


def baixar_camada(nome, caminho, campos):
    """Baixa todas as feicoes (sem geometria) de uma camada ArcGIS, paginando."""
    url_q = "%s/%s/query" % (BASE, caminho)
    meta = _get("%s/%s?f=json" % (BASE, caminho))
    oid = meta.get("objectIdField") or "objectid"
    feicoes = []
    offset = 0
    passo = 2000
    while True:
        params = {
            "where": "1=1",
            "outFields": campos,
            "returnGeometry": "false",
            "orderByFields": oid,
            "resultOffset": str(offset),
            "resultRecordCount": str(passo),
            "f": "json",
        }
        d = _get(url_q + "?" + urllib.parse.urlencode(params))
        if "error" in d:
            raise RuntimeError("erro ArcGIS em %s: %r" % (nome, d["error"]))
        lote = d.get("features", [])
        feicoes.extend(f.get("attributes", {}) for f in lote)
        if not lote or not d.get("exceededTransferLimit"):
            break
        offset += len(lote)
    saida = {
        "fonte_url": url_q,
        "acessado_em": ACESSO,
        "nome_camada": meta.get("name"),
        "tipo_geometria": meta.get("geometryType"),
        "campos": [f["name"] for f in meta.get("fields", [])],
        "n_registros": len(feicoes),
        "registros": feicoes,
    }
    with open(os.path.join(BRUTOS, nome + ".json"), "w", encoding="utf-8") as fh:
        json.dump(saida, fh, ensure_ascii=False)
    print("  %-24s %6d registros" % (nome, len(feicoes)))
    return saida


def coletar():
    os.makedirs(BRUTOS, exist_ok=True)
    print("Coletando camadas publicas do Sisfogo (acesso %s):" % ACESSO)
    for nome, (caminho, campos) in CAMADAS.items():
        baixar_camada(nome, caminho, campos)
    for nome, (caminho, campos) in CAMADAS_OPCIONAIS.items():
        try:
            baixar_camada(nome, caminho, campos)
        except RuntimeError as e:
            print("  %-24s BLOQUEIO: %s" % (nome, str(e)[:200]))
            with open(os.path.join(BRUTOS, nome + ".erro.txt"), "w", encoding="utf-8") as fh:
                fh.write("acessado_em=%s\n%s\n" % (ACESSO, e))


# ---------------------------------------------------------------- series ----
import collections  # noqa: E402

CODIGO = "I1.3.7"
UFS_AL = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]  # AL = Amazonia Legal
CONTEXTO = "contexto"
PROXY = "proxy"
ANO_ADESAO = 2026  # snapshot do portal em 2026-10-07


def _carregar(nome):
    with open(os.path.join(BRUTOS, nome + ".json"), encoding="utf-8") as fh:
        return json.load(fh)


def _url_camada(d):
    return d["fonte_url"].rsplit("/query", 1)[0]


def _uf(v):
    return (v or "").strip()


def _ano_epoch(v):
    if v in (None, ""):
        return None
    if isinstance(v, (int, float)):
        return dt.datetime.fromtimestamp(v / 1000, dt.timezone.utc).year
    try:
        return int(str(v)[:4])
    except ValueError:
        return None


def _fmt(valor, unidade):
    if valor is None:
        return ""
    if unidade.startswith("ha") or unidade.startswith("m") or unidade.startswith("pontos"):
        return "%.2f" % float(valor)
    return str(int(round(float(valor))))


def gerar_series():
    linhas = []

    def add(serie, rotulo, uf, ano, valor, unidade, url, nota):
        linhas.append([CODIGO, serie, rotulo, uf, ano, _fmt(valor, unidade), unidade, url, nota])

    # 1) adesao ao Sisfogo (snapshot 2026)
    ad = _carregar("adesao_sisfogo")
    url_ad = _url_camada(ad)
    termo_al = 0
    for a in ad["registros"]:
        uf = _uf(a.get("sigla_uf"))
        if uf not in UFS_AL:
            continue
        termo = 1 if (a.get("assinatura_termo") or 0) > 0 else 0
        termo_al += termo
        base_nota = ("snapshot em %s; valor binario derivado do campo assinatura_termo (1 se campo>0); "
                     "campo assinatura_termo=%s; status='%s'; ultima_atualizacao=%s; responsavel=%s; "
                     "adesao ao Sisfogo, nao registro de plano estadual"
                     % (ACESSO, a.get("assinatura_termo"), a.get("status"),
                        a.get("ultima_atualizacao"), a.get("responsavel")))
        add("sisfogo_termo_adesao_assinado", PROXY, uf, ANO_ADESAO, termo,
            "1=termo assinado; 0=nao assinado", url_ad, base_nota)
        add("sisfogo_pontuacao_adesao", CONTEXTO, uf, ANO_ADESAO, a.get("pontuacao"),
            "pontos (0-100)", url_ad, "pontuacao das etapas de adesao; snapshot em %s" % ACESSO)
    add("sisfogo_termo_adesao_assinado", PROXY, "AL", ANO_ADESAO, termo_al,
        "nº de UFs da AL com termo assinado (de 9)", url_ad,
        "soma das 9 UFs; snapshot em %s; nao e registro de plano" % ACESSO)

    # 2) series historicas Prevfogo 2017-2025 (uma linha por brigada, colunas por ano)
    series_hist = [
        ("prevfogo_queima_controlada_n", "historico_queima_controlada", "num_qc_", "queimas (nº)"),
        ("prevfogo_queima_controlada_ha", "historico_queima_controlada", "ha_qc_", "ha"),
        ("prevfogo_queima_prescrita_n", "historico_queima_prescrita", "num_qp_", "queimas (nº)"),
        ("prevfogo_queima_prescrita_ha", "historico_queima_prescrita", "ha_qp_", "ha"),
        ("prevfogo_aceiros_m", "historico_aceiros", "metros_aceiro_", "m"),
    ]
    for serie, camada, prefixo, unidade in series_hist:
        d = _carregar(camada)
        url = _url_camada(d)
        for ano in range(2017, 2026):
            soma = collections.defaultdict(float)
            for r in d["registros"]:
                uf = _uf(r.get("sigla_uf"))
                v = r.get(prefixo + str(ano))
                if uf in UFS_AL and v is not None:
                    soma[uf] += float(v)
            nota = ("soma por UF das linhas (brigadas) da camada %s, campo %s%d; "
                    "a camada lista 123 brigadas atuais, entao brigadas encerradas antes de 2025 podem "
                    "estar ausentes (soma pode estar subestimada em anos anteriores); "
                    "valores extremos nao verificados individualmente"
                    % (camada, prefixo, ano))
            for uf in UFS_AL:
                add(serie, CONTEXTO, uf, ano, soma[uf], unidade, url, nota)
            add(serie, CONTEXTO, "AL", ano, sum(soma[u] for u in UFS_AL), unidade, url,
                "soma das 9 UFs da AL; " + nota)

    # 3) brigadistas e bases do Prevfogo por UF (2025 e 2026)
    b25 = _carregar("brigadas_prevfogo_2025")
    b26 = _carregar("brigadas_prevfogo_2026")
    url25 = _url_camada(b25)
    url26 = _url_camada(b26)
    tot = collections.defaultdict(float)
    for uf in UFS_AL:
        br25 = sum(float(r.get("brigdts") or 0) for r in b25["registros"] if _uf(r.get("sigla_uf")) == uf)
        n25 = sum(1 for r in b25["registros"] if _uf(r.get("sigla_uf")) == uf)
        br26 = sum(float(r.get("n_brigadis") or 0) for r in b26["registros"] if _uf(r.get("estado")) == uf)
        n26 = sum(1 for r in b26["registros"] if _uf(r.get("estado")) == uf)
        tot["br25"] += br25; tot["n25"] += n25; tot["br26"] += br26; tot["n26"] += n26
        add("prevfogo_brigadistas_n", CONTEXTO, uf, 2025, br25, "brigadistas (nº)", url25,
            "soma do campo brigdts por sigla_uf na camada Brigadas Prevfogo 2025; campo total_brif nao usado")
        add("prevfogo_brigadistas_n", CONTEXTO, uf, 2026, br26, "brigadistas (nº)", url26,
            "soma do campo n_brigadis por estado na camada Brigadas Prevfogo Ibama 2026; campo total_brif nao usado")
        add("prevfogo_bases_brigada_n", CONTEXTO, uf, 2025, n25, "bases (nº)", url25,
            "registros (bases) por sigla_uf na camada Brigadas Prevfogo 2025")
        add("prevfogo_bases_brigada_n", CONTEXTO, uf, 2026, n26, "bases (nº)", url26,
            "registros (bases) por campo estado na camada Brigadas Prevfogo Ibama 2026")
    for ano, chave_br, chave_n, url in [(2025, "br25", "n25", url25), (2026, "br26", "n26", url26)]:
        add("prevfogo_brigadistas_n", CONTEXTO, "AL", ano, tot[chave_br], "brigadistas (nº)", url,
            "soma das 9 UFs da AL")
        add("prevfogo_bases_brigada_n", CONTEXTO, "AL", ano, tot[chave_n], "bases (nº)", url,
            "soma das 9 UFs da AL")

    # 4) ocorrencias de incendio (ROI) na camada atual: serie comeca em 2025
    roi = _carregar("roi_ocorrencias")
    url_roi = _url_camada(roi)
    cont = collections.Counter()
    sem_data = 0
    for r in roi["registros"]:
        uf = _uf(r.get("uf"))
        ano = _ano_epoch(r.get("data_inicio"))
        if ano is None:
            sem_data += 1
            continue
        if uf in UFS_AL:
            cont[(uf, ano)] += 1
    n2026 = sum(1 for r in roi["registros"] if _ano_epoch(r.get("data_inicio")) == 2026)
    nota_roi = ("camada atual de ROI (Sisfogo), contagem por data_inicio; serie curta (inicia em 2025); "
                "%d registros sem data_inicio excluidos; ano 2026 nao incluido: a camada tem apenas "
                "%d registros nacionais com data em 2026, cobertura incompleta para o ano"
                % (sem_data, n2026))
    for ano in (2025,):
        for uf in UFS_AL:
            add("sisfogo_roi_ocorrencias_n", CONTEXTO, uf, ano, cont[(uf, ano)], "registros ROI (nº)",
                url_roi, nota_roi)
        add("sisfogo_roi_ocorrencias_n", CONTEXTO, "AL", ano,
            sum(cont[(uf, ano)] for uf in UFS_AL), "registros ROI (nº)", url_roi,
            "soma das 9 UFs da AL; " + nota_roi)

    caminho = os.path.join(PASTA, "series.csv")
    with open(caminho, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"])
        w.writerows(linhas)
    print("series.csv gravado com %d linhas em %s" % (len(linhas), caminho))


if __name__ == "__main__":
    modo = sys.argv[1] if len(sys.argv) > 1 else "tudo"
    if modo in ("coletar", "tudo"):
        coletar()
    if modo in ("series", "tudo"):
        gerar_series()
    if modo not in ("coletar", "series", "tudo"):
        print("modo desconhecido:", modo)
        sys.exit(2)
