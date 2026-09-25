"""Incorpora o pacote "Dados da Estratégia 2050" (set/2026) ao painel.

Duas saídas:

1. Uma proposta de valores (``dashboard/conteudo/propostas/``) com os dois
   indicadores que o pacote traz por estado e que estavam sem coleta:
     I4.2.1  adequação e trafegabilidade (km efetivo / km físico, por UF)
     I4.4.2  capacidade adaptativa urbana (municípios com escore > 0,5, por UF)
   A proposta segue o caminho normal: aceita na administração ou por
   ``--aplicar``, que faz o mesmo que o botão Aceitar (valores.csv com origem
   ``script`` e o arquivo movido para ``aplicadas/``).

2. ``dashboard/conteudo/projecoes.json``: as trajetórias pactuadas até 2050 das
   planilhas de projeção, regionais, com todos os cenários. O campo
   ``comparavel`` só é verdadeiro quando a linha de base da projeção é o mesmo
   número que o painel calcula para a Amazônia Legal (mesma unidade, mesmo
   recorte); nos demais casos ``motivo`` explica a diferença e a página não
   desenha a série observada sobre a trajetória.

Uso:  python scripts/estrategia_set2026.py [--aplicar | --so-projecoes]
"""
from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from datetime import date
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
from proposta import PASTA_PROPOSTAS, Proposta  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
PACOTE = RAIZ / "Dados da Estratégia 2050"
CONTEUDO = RAIZ / "dashboard" / "conteudo"
UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]


def num(valor):
    """Célula numérica que pode vir como texto com vírgula decimal ("6,90")."""
    if valor is None:
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    texto = str(valor).strip().replace(" ", "")
    if not texto:
        return None
    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    return float(texto)


def arred(valor, casas=2):
    return None if valor is None else round(valor, casas)


# ---------- valores por estado ----------

def trafegabilidade(p: Proposta) -> None:
    ws = openpyxl.load_workbook(PACOTE / "indicador trafegabilidade e adequação.xlsx", data_only=True).active
    for sigla, fisico, efetivo, pct in list(ws.iter_rows(values_only=True))[1:]:
        if sigla not in UFS:
            continue
        p.valor("I4.2.1", sigla, round(pct, 2))
        p.valor("I4.2.1", sigla, round(fisico, 1), campo="kmFisico")
        p.valor("I4.2.1", sigla, round(efetivo, 1), campo="kmEfetivo")


def capacidade_adaptativa(p: Proposta) -> None:
    wb = openpyxl.load_workbook(PACOTE / "indicador capacidade adaptativa amazonia legal.xlsx", data_only=True)
    com = list(wb["3. Cidades COM Dados"].iter_rows(values_only=True))
    sem = list(wb["4. Cidades SEM Dados"].iter_rows(values_only=True))
    iuf, iscore = com[0].index("SIGLA_UF"), com[0].index("score_capacidade")
    avaliados = Counter(r[iuf] for r in com[1:])
    acima = Counter(r[iuf] for r in com[1:] if r[iscore] is not None and r[iscore] > 0.5)
    semdados = Counter(r[sem[0].index("SIGLA_UF")] for r in sem[1:] if r[0])
    # Denominador: todos os municípios da Amazônia Legal (773), como no resumo
    # da planilha (19 / 773 = 2,46%). Os 35 sem informação contam como "não
    # acima de 0,5", e não somem do total.
    for uf in UFS:
        total = avaliados[uf] + semdados[uf]
        p.valor("I4.4.2", uf, round(acima[uf] / total * 100, 2))
        p.valor("I4.4.2", uf, acima[uf], campo="acima05")
        p.valor("I4.4.2", uf, avaliados[uf], campo="comDados")
        p.valor("I4.4.2", uf, total, campo="total")


def aplica(caminho: Path) -> int:
    """O mesmo que Aceitar tudo na tela de Propostas."""
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    arquivo = CONTEUDO / "valores.csv"
    with arquivo.open(encoding="utf-8", newline="") as f:
        leitor = csv.DictReader(f)
        colunas, linhas = leitor.fieldnames, list(leitor)
    chave = lambda r: (r["codigo"], r.get("campo") or "", r["uf"], str(r.get("ano") or ""))
    indice = {chave(r): r for r in linhas}
    hoje = date.today().isoformat()
    for v in dados["valores"]:
        linha = {"codigo": v["codigo"], "campo": v.get("campo", ""), "uf": v["uf"], "ano": str(v.get("ano") or ""),
                 "valor": v["valor"], "origem": "script", "atualizadoEm": hoje, "por": dados["script"], "nota": v.get("nota", "")}
        if chave(linha) in indice:
            indice[chave(linha)].update(linha)
        else:
            # Entra antes do primeiro código maior, sem reordenar o resto do arquivo.
            pos = next((i for i, r in enumerate(linhas) if r["codigo"] > linha["codigo"]), len(linhas))
            linhas.insert(pos, linha)
            indice[chave(linha)] = linha
    with arquivo.open("w", encoding="utf-8", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=colunas, lineterminator="\n")
        escritor.writeheader()
        escritor.writerows(linhas)
    dados.update({"decisao": "aceita", "decididoEm": hoje, "por": dados["script"], "celulasAceitas": len(dados["valores"])})
    destino = PASTA_PROPOSTAS / "aplicadas" / caminho.name
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    caminho.unlink()
    return len(dados["valores"])


# ---------- projeções ----------

FONTE_23_5 = "Projecoes_Indicadores_Eixos 2 3 e 5.xlsx"
FONTE_1_5 = "projeções indicadores eixos 1 e 5.xlsx"

# IDEB: a baseline da planilha é a edição 2023 contra a meta de 2021, a mesma
# regra de scripts/eixo2_ideb_meta2021.py; o painel dá 30,7 / 7,8 / 61,4 em 2023.
MOTIVO_IDEB = ("Mesma regra do painel (IDEB contra a meta de 2021), mas a projeção parte de {base}% e o painel calcula {painel}% "
               "para esta etapa em 2023: o universo de municípios difere. O painel mostra as três etapas juntas no valor principal.")
IDEB_PAINEL_2023 = {"anosIniciais": "30,7", "anosFinais": "7,8", "ensinoMedio": "61,4"}

# Coluna da planilha dos eixos 2, 3 e 5 -> indicador do catálogo. `motivo`
# preenchido = a linha de base não é o número que o painel mede.
COLUNAS_23_5 = [
    ("Eixo 2 - População em Extrema Pobreza (%)", "I2.1.1", "extremaPobreza", "População em extrema pobreza", "%",
     "A projeção parte de 6,9% em extrema pobreza; o painel mede a pobreza pelo CadÚnico (14,0% na Amazônia Legal) e a extrema pobreza pela SIS/IBGE (5,5%). Nenhum dos dois é a linha de base da projeção."),
    ("Eixo 2 - Óbitos Evitáveis (Total de Óbitos)", "I2.2.1", "obitosEvitaveis", "Óbitos por causas evitáveis", "óbitos",
     "A projeção é do Brasil inteiro: 839.766 óbitos evitáveis de 5 a 74 anos em 2024 (SIM), a base citada na ficha. Na Amazônia Legal foram 95.901 (campo obitos5a74_2024). O valor principal do painel é a taxa de menores de 5 anos."),
    ("Eixo 2 - Municípios com Telessaúde (Qtde)", "I2.2.3", None, "Municípios com telessaúde", "municípios",
     None),
    ("Eixo 2 - IDEB Anos Iniciais (% Municípios na Meta)", "I2.3.1", "anosIniciais", "IDEB anos iniciais: municípios na meta", "% de municípios",
     MOTIVO_IDEB),
    ("Eixo 2 - IDEB Anos Finais (% Municípios na Meta)", "I2.3.1", "anosFinais", "IDEB anos finais: municípios na meta", "% de municípios",
     MOTIVO_IDEB),
    ("Eixo 2 - IDEB Ensino Médio (% Municípios na Meta)", "I2.3.1", "ensinoMedio", "IDEB ensino médio: municípios na meta", "% de municípios",
     MOTIVO_IDEB),
    ("Eixo 2 - Taxa de Escolarização (%)", "I2.3.2", None, "Taxa de escolarização", "%",
     "A projeção parte de 75,5%; o atendimento escolar de 4 a 17 anos no painel é 96,4%. Recortes etários diferentes."),
    ("Eixo 2 - Taxa de CVLI (por 100 mil hab.)", "I2.4.1", None, "Taxa de CVLI", "por 100 mil hab.",
     "A projeção parte de 22,0 por 100 mil; o painel calcula 23,8 em 2024 e 21,1 em 2025. A linha de base não coincide com nenhum ano da série."),
    ("Eixo 2 - Segurança Cidadã (% Municípios)", "I2.4.2", "segurancaCidada", "Municípios com programa de segurança cidadã", "% de municípios",
     "Indicador ainda sem valores coletados no painel."),
    ("Eixo 2 - Adaptação Climática (% Municípios)", "I2.4.2", "adaptacaoClimatica", "Municípios com plano de adaptação climática", "% de municípios",
     "Indicador ainda sem valores coletados no painel."),
    ("Eixo 3 - Receita Líquida Indústria (R$ Bilhões)", "F3.5", None, "Receita líquida da indústria", "R$ bilhões",
     "A projeção parte de R$ 578,1 bi de receita líquida da indústria, e nenhum recorte da tabela SIDRA 10457 de 2024 reproduz esse número: receita de atividades industriais de R$ 584,3 bi (indústria total) ou R$ 475,0 bi (transformação, campo receitaLiquida2024); receita total de vendas de R$ 598,4 bi ou R$ 489,1 bi. O valor principal do painel é outra variável, o valor da transformação industrial da indústria total (R$ 215,4 bi)."),
    ("Eixo 5 - Captação Climática Nova (R$ Milhões)", "I5.1.1", None, "Captação nova de financiamento climático", "R$ milhões",
     "A projeção conta a captação nova a partir de zero em 2025; o painel soma o que os governos estaduais receberam do Fundo Amazônia e do REM Acre (R$ 143,3 mi em 2025), sem separar recurso novo de continuidade de contratos antigos."),
    ("Eixo 5 - Alavancagem Blended Finance (X:1)", "I5.2.1", None, "Alavancagem de blended finance", "R$ privado por R$ público",
     "Indicador ainda sem valores coletados no painel."),
    # Convertida de R$ milhões para R$ (FATOR_23_5), a unidade do valor do painel:
    # a soma dos contratos de rateio dos nove estados (scripts/eixo5_cal.py).
    ("Eixo 5 - Orçamento CAL (R$ Milhões)", "I5.2.2", None, "Rateio contratado dos estados com o Consórcio", "R$",
     None),
    ("Eixo 5 - Sistemas de Dados Integrados (Qtde)", "I5.3.2", None, "Sistemas de dados integrados", "sistemas",
     "Indicador ainda sem valores coletados no painel."),
]


# Colunas cuja unidade na planilha difere da do painel: multiplica a série.
FATOR_23_5 = {"I5.2.2": 1_000_000}


def eixos_2_3_5():
    ws = openpyxl.load_workbook(PACOTE / FONTE_23_5, data_only=True).active
    linhas = list(ws.iter_rows(values_only=True))
    cabecalho = [str(c).strip() if c else "" for c in linhas[0]]
    base = linhas[1]
    anos = [r for r in linhas[2:] if r[0]]
    saida = []
    for coluna, codigo, variante, nome, unidade, motivo in COLUNAS_23_5:
        i = cabecalho.index(coluna)
        # A linha "Baseline" não traz o ano; a série anual começa em 2026, e a
        # planilha trata a baseline como o ponto de partida imediatamente anterior.
        ideb = codigo == "I2.3.1"
        # I5.2.2: a ficha ancora os R$ 6,12 mi em 2026 (Res. 001/2026); em 2025 o
        # rateio contratado foi maior, com o aporte extra de Roraima para a COP30.
        ano_base = "2023" if ideb else ("2026" if codigo == "I5.2.2" else "2025")
        serie = {ano_base: arred(num(base[i]), 4)}
        serie.update({str(int(r[0])): arred(num(r[i]), 4) for r in anos})
        if codigo in FATOR_23_5:
            serie = {ano: round(v * FATOR_23_5[codigo], 2) for ano, v in serie.items()}
        if ideb:
            motivo = motivo.format(base=f"{serie[ano_base]:g}".replace(".", ","), painel=IDEB_PAINEL_2023[variante])
        item = {
            "codigo": codigo, "variante": variante, "nome": nome, "unidade": unidade,
            "fonte": FONTE_23_5, "baseline": {"ano": int(ano_base), "valor": serie[ano_base], "rotulo": "linha de base"},
            "cenarios": [{"chave": "pactuada", "nome": "Trajetória pactuada", "serie": serie}],
            "comparavel": motivo is None, "motivo": motivo,
        }
        if codigo == "I2.2.3":
            # 35 municípios em dez/2025 = soma estadual do painel (CNES por município)
            item["observado"] = "soma"
            item["nota"] = "Meta: 50% dos 772 municípios da Amazônia Legal (386). A série medida é a soma dos municípios com telessaúde dos nove estados."
        if codigo == "I5.2.2":
            # R$ 6,12 mi = rateio ordinário dos nove estados em 2026 (Res. 001/2026)
            item["observado"] = "soma"
            item["nota"] = ("A ficha parte de R$ 6,12 mi em 2026, o rateio ordinário dos nove estados fixado pela Res. 001/2026 "
                            "(a ficha o chama de executado; é orçamento). A série medida soma os contratos de rateio de cada estado "
                            "com o Consórcio: valor contratado, não arrecadado. Em 2019 e 2020 a receita arrecadada (R$ 0,70 mi e "
                            "R$ 3,11 mi) ficou abaixo do contratado; 2024 e 2025 incluem aportes extras (HUB e COP30). Recursos de "
                            "terceiros e a execução estão nas tabelas cal_instrumentos e cal_orcamento_execucao.")
        if ideb:
            item["nota"] = "A linha de base da planilha corresponde à edição 2023 do IDEB; a série anual da projeção começa em 2026."
        saida.append(item)
    return saida


def eixos_1_e_4():
    wb = openpyxl.load_workbook(PACOTE / FONTE_1_5, data_only=True)
    saida = []

    ucs = [r for r in list(wb["ucs"].iter_rows(values_only=True))[1:] if r[0]]
    saida.append({
        "codigo": "I1.1.2", "variante": None, "nome": "UCs estaduais com plano de manejo e conselho gestor", "unidade": "%",
        "fonte": FONTE_1_5, "baseline": {"ano": 2026, "valor": 21.1, "rotulo": "CNUC/MMA 2026 (42 de 199 UCs)"},
        "cenarios": [{"chave": "pactuada", "nome": "Trajetória pactuada",
                      "serie": {str(int(r[0])): round(r[4], 2) for r in ucs if int(r[0]) >= 2026}}],
        "comparavel": True, "motivo": None,
        "nota": "A planilha traz também 2025 (81 de 393 UCs, 20,6%), com um cadastro maior; a trajetória parte do recorte de 2026, o mesmo do painel.",
    })

    san = [r for r in list(wb["sanitario"].iter_rows(values_only=True))[1:] if r[0]]
    saida.append({
        "codigo": "I4.4.1", "variante": None, "nome": "Saneamento básico adequado", "unidade": "%",
        "fonte": FONTE_1_5, "baseline": {"ano": 2022, "valor": 41.52, "rotulo": "Censo 2022"},
        "cenarios": [
            {"chave": "linear", "nome": "Linear", "serie": {str(int(r[0])): num(r[1]) for r in san}},
            {"chave": "acelerada", "nome": "Acelerada", "serie": {str(int(r[0])): num(r[2]) for r in san}},
        ],
        "comparavel": False,
        "motivo": "A projeção parte de 41,5% em 2022; o ISGR do painel é 47,2 (água e esgoto adequados, ponderado pela população). Composição diferente do índice.",
    })

    con = [r for r in list(wb["conectividade"].iter_rows(values_only=True)) if isinstance(r[0], (int, float))]
    saida.append({
        "codigo": "I4.1.1", "variante": None, "nome": "Conectividade digital (IBC-AMZ)", "unidade": "0 a 100",
        "fonte": FONTE_1_5, "baseline": {"ano": 2025, "valor": 53.52, "rotulo": "IBC-AMZ 2025 ponderado"},
        "cenarios": [{"chave": "pactuada", "nome": "Marcos pactuados", "serie": {str(int(r[0])): r[1] for r in con}}],
        "comparavel": True, "motivo": None,
    })

    tra = [r for r in list(wb["trafegabilidade"].iter_rows(values_only=True))[1:] if isinstance(r[0], (int, float))]
    saida.append({
        "codigo": "I4.2.1", "variante": None, "nome": "Adequação e trafegabilidade de transportes", "unidade": "%",
        "fonte": FONTE_1_5, "baseline": {"ano": 2025, "valor": 46.44, "rotulo": "km efetivo sobre km físico, 2025"},
        "cenarios": [
            {"chave": "arrojado", "nome": "Arrojado", "serie": {str(int(r[0])): round(r[2], 2) for r in tra}},
            {"chave": "moderado", "nome": "Moderado", "serie": {str(int(r[0])): round(r[3], 2) for r in tra}, "central": True},
            {"chave": "conservador", "nome": "Conservador", "serie": {str(int(r[0])): round(r[4], 2) for r in tra}},
        ],
        "comparavel": True, "motivo": None,
        "nota": "A meta do catálogo (65% em 2050) é o cenário moderado.",
    })

    ren = [r for r in list(wb["energias renovaveis"].iter_rows(values_only=True))[1:] if r[0]]
    saida.append({
        "codigo": "I4.3.2", "variante": None, "nome": "Participação de renováveis", "unidade": "%",
        "fonte": FONTE_1_5, "baseline": {"ano": 2025, "valor": 62.5, "rotulo": "linha de base"},
        "cenarios": [{"chave": "pactuada", "nome": "Marcos pactuados", "serie": {str(int(r[0])): r[1] for r in ren}}],
        "comparavel": False,
        "motivo": "A projeção parte de 62,5%; o painel calcula 60,9% (média simples dos estados) ou 85,2% (ponderado pela potência fiscalizada). Nenhum dos dois é a linha de base.",
    })

    teq = [r for r in list(wb.worksheets[5].iter_rows(values_only=True))[1:] if r[0]]
    saida.append({
        "codigo": "I4.3.1", "variante": None, "nome": "Transição energética e qualidade distributiva (ITEQ)", "unidade": "%",
        "fonte": FONTE_1_5, "baseline": {"ano": 2025, "valor": 60.1, "rotulo": "linha de base"},
        "cenarios": [{"chave": "pactuada", "nome": "Marcos pactuados", "serie": {str(int(r[0])): r[1] for r in teq}}],
        "comparavel": False, "motivo": "Indicador ainda sem valores coletados no painel.",
    })
    return saida


def projecoes():
    itens = eixos_1_e_4() + eixos_2_3_5()
    ordem = lambda item: [int(p) if p.isdigit() else p for p in item["codigo"].lstrip("IF").split(".")]
    itens.sort(key=ordem)
    return {
        "_leia": ("Trajetórias pactuadas até 2050, regionais (Amazônia Legal), das planilhas de projeção do pacote "
                  "'Dados da Estratégia 2050' (set/2026). Geradas por scripts/estrategia_set2026.py. São metas "
                  "intermediárias, não previsões nem a projeção mecânica do Panorama. `comparavel` só é true quando a "
                  "linha de base é o mesmo número que o painel calcula para a região; `motivo` explica os demais."),
        "atualizadoEm": date.today().isoformat(),
        "projecoes": itens,
    }


def main():
    if "--so-projecoes" not in sys.argv:
        valores()
    destino = CONTEUDO / "projecoes.json"
    destino.write_text(json.dumps(projecoes(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("projeções:", destino)


def valores():
    p = Proposta("estrategia_set2026", fonte="Dados da Estratégia 2050 (set/2026)",
                 descricao="Trafegabilidade (I4.2.1) e capacidade adaptativa urbana (I4.4.2) por estado")
    trafegabilidade(p)
    capacidade_adaptativa(p)
    caminho = p.gravar()
    print("proposta:", caminho)
    if "--aplicar" in sys.argv and caminho:
        print("aplicadas:", aplica(caminho), "células")


if __name__ == "__main__":
    main()
