# -*- coding: utf-8 -*-
"""
I1.3.5-6 (delegacias especializadas em crimes ambientais; sistema regional).

Gera, a partir dos valores transcritos das fontes em brutos/ (com páginas),
os arquivos de dados/eixo1_coleta/I1.3.5-6_seguranca/:
  series.csv, fontes.csv, atos.csv

Rodar a partir da raiz do projeto:
  python -I scripts/eixo1_coleta_I1_3_5_6_seguranca.py

Convenções: uf em AC AM AP MA MT PA RO RR TO ou AL (AL = Amazônia Legal, agregado
das 9 UFs). Valor '-' na fonte = fenômeno inexistente = 0. '...' = sem informação
= linha omitida. Não há valor inventado: cada número abaixo tem página da fonte.
"""
import csv
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dados", "eixo1_coleta", "I1.3.5-6_seguranca")
ACESSO = "2026-10-07"

# ---------------------------------------------------------------- URLs
ED2 = "https://bioeconomia.fea.usp.br/wp-content/uploads/2023/12/Cartografias-violencia-amazonia-ed2-021223-.pdf"
ED3 = "https://static.poder360.com.br/2024/12/relatorio-FBSP-MVI.pdf"
ED4 = "https://forumseguranca.org.br/wp-content/uploads/2025/11/cartografias-violencia-amazonia-2025.pdf"
IGARAPE = "https://igarape.org.br/wp-content/uploads/2026/07/PORT_Esforcos-Estaduais-Combate-Crime-Ambiental-na-Amazonia.pdf"
PERFIL_BASE = "https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica"
P2017 = PERFIL_BASE + "/estatistica/download/pesquisa-perfil/relatorio_pesquisa_perfil_anobase_2017.pdf"
P2018 = PERFIL_BASE + "/estatistica/download/pesquisa-perfil/relatorio_pesquisa_perfil_anobase_2018.pdf"
P2014 = PERFIL_BASE + "/estatistica/download/pesquisa-perfil/relatorio_pesquisa_perfil_anobase_2014-2016-1.pdf"
P2012 = PERFIL_BASE + "/analise-e-pesquisa/download/pesquisa-perfil/relatorio_pesquisa_perfil_anobase_2012.pdf"
P2004 = PERFIL_BASE + "/analise-e-pesquisa/download/pesquisa-perfil/relatorio_pesquisa_perfil_anobase_2004-2007.pdf"
PORTAL = "https://portalamazonia.com/amazonia/crimes-ambientais-diagnostico-amz/"
PA_DECRETO = "https://bancodeleis.alepa.pa.gov.br/arquivos/lei510_2020_58945.pdf"
MT_DOE = "https://iomat.mt.gov.br/legislacao/diario_oficial/download/32559"

UFS = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]

rows = []


def add(cod, serie, rot, uf, ano, val, unid, url, nota):
    rows.append([cod, serie, rot, uf, ano, val, unid, url, nota])


def num(x):
    """'...' -> None (omitir); '-' -> 0; '1.248' -> 1248."""
    if x == "...":
        return None
    if x == "-":
        return 0
    return int(x.replace(".", ""))


# ---------------------------------------------------------------- delegacias meio ambiente (PC)
S = "I1.3.5_delegacias_meio_ambiente_PC"
N = "Delegacias especializadas em meio ambiente, Polícia Civil (contagem de unidades)"
# MJSP Pesquisa Perfil ano-base 2014-2016, Tab. 2.5 (p.85 do PDF), colunas 'Meio ambiente' 2014/2015/2016
perf2014 = {"AM": 1, "AP": 1, "MA": 1, "MT": 1, "PA": 3, "RO": 1, "RR": 1, "TO": 1}   # AC '-' = sem dado
perf2015 = {"AM": 1, "AP": 1, "MA": 1, "MT": 1, "PA": 1, "RO": 1, "RR": 1, "TO": 1}   # AC '-' = sem dado
perf2016 = {"AC": 0, "AM": 1, "AP": 1, "MA": 1, "MT": 1, "PA": 1, "RO": 1, "RR": 1, "TO": 1}
# MJSP Pesquisa Perfil ano-base 2017, Tab. 2.6 (p.75), coluna 'Polícia especializada de Meio ambiente'
# RO e RR não responderam (nota da tabela) -> omitidos
perf2017 = {"AC": 0, "AM": 1, "AP": 1, "MA": 1, "MT": 1, "PA": 1, "TO": 1}
# FBSP ed.2 (2023), Tab. 34 p.140, coluna 'Meio ambiente'; texto p.139: 11 na região
fbsp2023 = {"AC": 1, "AM": 1, "AP": 1, "MA": 1, "MT": 1, "PA": 3, "RO": 1, "RR": 1, "TO": 1}
# MJSP Pesquisa Perfil ano-base 2018, Tab. 1.6.4 p.31 (pdf p.218), coluna 'Meio Ambiente'; total Brasil = 41
perf2018 = {"AC": 0, "AM": 1, "AP": 1, "MA": 1, "MT": 1, "PA": 1, "RO": 1, "RR": 1, "TO": 1}

for ano, d, url, nt in [
    (2018, perf2018, P2018, "MJSP Pesquisa Perfil ano-base 2018, Tab. 1.6.4 p.31 (pdf p.218), coluna Meio Ambiente. Total Brasil = 41 (não é AL)."),
    (2014, perf2014, P2014, "MJSP Pesquisa Perfil ano-base 2014-2016, Tab. 2.5 p.85 (PC, coluna Meio ambiente). AC: dado não informado (-), omitido."),
    (2015, perf2015, P2014, "MJSP Pesquisa Perfil ano-base 2014-2016, Tab. 2.5 p.85 (PC, coluna Meio ambiente). AC: dado não informado (-), omitido."),
    (2016, perf2016, P2014, "MJSP Pesquisa Perfil ano-base 2014-2016, Tab. 2.5 p.85 (PC, coluna Meio ambiente). Total Brasil 2016 = 37 (não é AL)."),
    (2017, perf2017, P2017, "MJSP Pesquisa Perfil ano-base 2017, Tab. 2.6 p.75 (PC, Polícia especializada de Meio ambiente). RO e RR não responderam: omitidos."),
    (2023, fbsp2023, ED2, "FBSP ed.2 (2023), Tab. 34 p.140 (Meio ambiente); texto p.139. Concorda com 11 na região. PA tem 3, demais UF 1."),
]:
    for uf in UFS:
        if uf in d:
            add(S, N, "exata", uf, ano, d[uf], "delegacias", url, nt)
add(S, N, "exata", "AL", 2023, 11, "delegacias", ED2,
    "Agregado das 9 UFs. FBSP ed.2 (2023), Tab. 34 p.140 (total 11); texto p.139.")

# ---------------------------------------------------------------- delegacias fluviais (PC)
S = "I1.3.5_delegacias_fluviais_PC"
N = "Delegacias especializadas em crimes fluviais, Polícia Civil (contagem de unidades)"
for uf in UFS:
    nt = ("FBSP ed.2 (2023), Tab. 34 p.140 (coluna Fluvial); texto p.139: única delegacia fluvial da Amazônia Legal, no Pará."
          if uf == "PA" else
          "FBSP ed.2 (2023), Tab. 34 p.140 (coluna Fluvial); '-' = fenômeno inexistente, lido como 0.")
    add(S, N, "exata", uf, 2023, 1 if uf == "PA" else 0, "delegacias", ED2, nt)
add(S, N, "exata", "AL", 2023, 1, "delegacias", ED2, "Agregado das 9 UFs. FBSP ed.2 (2023), Tab. 34 p.140.")

# ---------------------------------------------------------------- delegacias 'de interesse', todas as temáticas (contexto)
S = "I1.3.5_delegacias_interesse_PC_total"
N = "Delegacias especializadas de interesse (todas as temáticas), Polícia Civil (contexto)"
interesse = {"AC": 3, "AP": 6, "AM": 3, "MA": 1, "MT": 4, "PA": 14, "RO": 2, "RR": 6, "TO": 14}
for uf in UFS:
    add(S, N, "contexto", uf, 2023, interesse[uf], "delegacias", ED2,
        "FBSP ed.2 (2023), Tab. 33 p.139, coluna 'Delegacias Especializadas de interesse' (inclui meio ambiente, conflitos agrários, fluvial, crime organizado, corrupção, lavagem, drogas).")
add(S, N, "contexto", "AL", 2023, 53, "delegacias", ED2, "Agregado das 9 UFs. FBSP ed.2 (2023), Tab. 33 p.139.")

# ---------------------------------------------------------------- batalhões de polícia ambiental (PM, ostensiva; contexto)
S = "I1.3.5_batalhoes_policia_ambiental_PM"
N = "Batalhões específicos de polícia ambiental, Polícia Militar (policiamento ostensivo; contexto)"
pmamb = {"AC": 1, "AP": 1, "AM": 1, "MA": 1, "MT": 4, "PA": 4, "RO": 8, "RR": 1, "TO": 1}
for uf in UFS:
    add(S, N, "contexto", uf, 2023, pmamb[uf], "batalhões", ED2,
        "FBSP ed.2 (2023), Tab. 33 p.139, coluna 'Polícia Ambiental' (PM). Texto p.144: 591 batalhões na região, 22 específicos de polícia ambiental.")
add(S, N, "contexto", "AL", 2023, 22, "batalhões", ED2,
    "Agregado das 9 UFs. FBSP ed.2 (2023), Tab. 33 p.139 e texto p.144.")

def al_nota(d, tb, pg):
    """Nota do total AL de frota: a fonte publica o total, mas só soma as UFs com informação."""
    faltam = [u for u in UFS if num(d[u]) is None]
    lista = ", ".join(faltam) if faltam else "nenhuma"
    return ("Total publicado pela fonte (AL). Soma só das UFs com informação; "
            "sem informação (omitidas): %s. Fonte: %s %s." % (lista, tb, pg))


# ---------------------------------------------------------------- frota 2023 (FBSP ed.2)
frota2023 = {
    "viaturas_tracao": {
        "SSP": {"AC": "34", "AP": "10", "AM": "601", "MA": "5", "MT": "346", "PA": "62", "RO": "67", "RR": "...", "TO": "123", "AL": "1.248"},
        "PC": {"AC": "112", "AP": "20", "AM": "...", "MA": "118", "MT": "...", "PA": "363", "RO": "147", "RR": "...", "TO": "...", "AL": "760"},
        "PM": {"AC": "106", "AP": "147", "AM": "...", "MA": "1.556", "MT": "...", "PA": "1.390", "RO": "376", "RR": "...", "TO": "...", "AL": "3.575"},
    },
    "viaturas_total": {
        "SSP": {"AC": "57", "AP": "32", "AM": "1.284", "MA": "5", "MT": "3.050", "PA": "110", "RO": "163", "RR": "...", "TO": "501", "AL": "5.202"},
        "PC": {"AC": "372", "AP": "160", "AM": "...", "MA": "345", "MT": "...", "PA": "626", "RO": "503", "RR": "...", "TO": "...", "AL": "2.006"},
        "PM": {"AC": "151", "AP": "237", "AM": "...", "MA": "1.951", "MT": "...", "PA": "2.724", "RO": "623", "RR": "...", "TO": "...", "AL": "5.686"},
    },
    "embarcacoes": {
        "SSP": {"AC": "-", "AP": "-", "AM": "12", "MA": "-", "MT": "47", "PA": "83", "RO": "-", "RR": "...", "TO": "1", "AL": "143"},
        "PC": {"AC": "3", "AP": "4", "AM": "...", "MA": "1", "MT": "...", "PA": "22", "RO": "-", "RR": "...", "TO": "...", "AL": "30"},
        "PM": {"AC": "16", "AP": "23", "AM": "...", "MA": "8", "MT": "...", "PA": "40", "RO": "56", "RR": "...", "TO": "...", "AL": "143"},
    },
    "aeronaves": {
        "SSP": {"AC": "-", "AP": "1", "AM": "...", "MA": "3", "MT": "7", "PA": "8", "RO": "-", "RR": "...", "TO": "-", "AL": "19"},
        "PC": {"AC": "-", "AP": "-", "AM": "...", "MA": "-", "MT": "...", "PA": "-", "RO": "1", "RR": "...", "TO": "...", "AL": "1"},
        "PM": {"AC": "...", "AP": "-", "AM": "...", "MA": "-", "MT": "...", "PA": "...", "RO": "-", "RR": "...", "TO": "...", "AL": "0"},
    },
    "helicopteros": {
        "SSP": {"AC": "2", "AP": "1", "AM": "...", "MA": "5", "MT": "6", "PA": "8", "RO": "-", "RR": "...", "TO": "2", "AL": "24"},
        "PC": {"AC": "-", "AP": "-", "AM": "...", "MA": "-", "MT": "...", "PA": "-", "RO": "-", "RR": "...", "TO": "...", "AL": "0"},
        "PM": {"AC": "...", "AP": "-", "AM": "...", "MA": "-", "MT": "...", "PA": "...", "RO": "-", "RR": "...", "TO": "...", "AL": "0"},
    },
}
tab2023 = {"viaturas_tracao": ("Tab. 42", "p.150", "viaturas"), "viaturas_total": ("Tab. 42", "p.150", "viaturas"),
           "embarcacoes": ("Tab. 41", "p.149", "embarcações"), "aeronaves": ("Tab. 40", "p.148", "aeronaves"),
           "helicopteros": ("Tab. 40", "p.148", "helicópteros")}
inst_nome = {"SSP": "Secretaria de Segurança Pública e/ou Defesa Social", "PC": "Polícia Civil", "PM": "Polícia Militar"}
for item, insts in frota2023.items():
    tb, pg, unid = tab2023[item]
    for inst, d in insts.items():
        S = "I1.3.5_frota_2023_%s_%s" % (item, inst)
        N = "Frota (%s) disponível e em uso, %s, 2023" % (unid, inst_nome[inst])
        for uf in UFS + ["AL"]:
            v = num(d[uf])
            if v is None:
                continue
            nt = "FBSP ed.2 (2023), %s %s. '...' sem informação (omitido); '-' = 0." % (tb, pg)
            if uf == "AL":
                nt = al_nota(d, tb, pg)
            add(S, N, "componente", uf, 2023, v, unid, ED2, nt)

# ---------------------------------------------------------------- frota 2024 (FBSP ed.3, Tab. 54 p.194)
frota2024 = {
    "PC": {
        "viaturas_tracao": {"AC": "122", "AP": "66", "AM": "185", "MA": "...", "MT": "217", "PA": "384", "RO": "147", "RR": "211", "TO": "137", "AL": "1.469"},
        "viaturas_total": {"AC": "417", "AP": "116", "AM": "397", "MA": "...", "MT": "793", "PA": "648", "RO": "445", "RR": "92", "TO": "529", "AL": "3.437"},
        "embarcacoes": {"AC": "9", "AP": "15", "AM": "8", "MA": "...", "MT": "6", "PA": "15", "RO": "1", "RR": "2", "TO": "1", "AL": "57"},
        "aeronaves": {"AC": "-", "AP": "-", "AM": "-", "MA": "...", "MT": "-", "PA": "-", "RO": "1", "RR": "-", "TO": "-", "AL": "1"},
        "helicopteros": {"AC": "-", "AP": "-", "AM": "-", "MA": "...", "MT": "-", "PA": "-", "RO": "-", "RR": "-", "TO": "-", "AL": "0"},
    },
    "PM": {
        "viaturas_tracao": {"AC": "213", "AP": "158", "AM": "783", "MA": "527", "MT": "257", "PA": "1272", "RO": "299", "RR": "366", "TO": "216", "AL": "4.091"},
        "viaturas_total": {"AC": "579", "AP": "358", "AM": "1.406", "MA": "1.651", "MT": "1.142", "PA": "2.382", "RO": "624", "RR": "181", "TO": "523", "AL": "8.846"},
        "embarcacoes": {"AC": "34", "AP": "36", "AM": "47", "MA": "3", "MT": "6", "PA": "-", "RO": "35", "RR": "3", "TO": "29", "AL": "193"},
        "aeronaves": {"AC": "-", "AP": "-", "AM": "-", "MA": "...", "MT": "7", "PA": "-", "RO": "-", "RR": "-", "TO": "3", "AL": "10"},
        "helicopteros": {"AC": "-", "AP": "-", "AM": "-", "MA": "...", "MT": "4", "PA": "-", "RO": "-", "RR": "-", "TO": "-", "AL": "4"},
    },
}
unid2 = {"viaturas_tracao": "viaturas", "viaturas_total": "viaturas", "embarcacoes": "embarcações",
         "aeronaves": "aeronaves", "helicopteros": "helicópteros"}
for inst, items in frota2024.items():
    for item, d in items.items():
        S = "I1.3.5_frota_2024_%s_%s" % (item, inst)
        N = "Frota (%s) disponível e em uso, %s, 2024" % (unid2[item], inst_nome[inst])
        for uf in UFS + ["AL"]:
            v = num(d[uf])
            if v is None:
                continue
            nt = "FBSP ed.3 (2024), Tab. 54 p.194 (LAI). '...' sem informação (omitido); '-' = 0. RR refere-se a 2023 e 2024 (nota 6)."
            if uf == "AL":
                nt = al_nota(d, "Tab. 54", "p.194")
            add(S, N, "componente", uf, 2024, v, unid2[item], ED3, nt)

# ---------------------------------------------------------------- escrita
SERIES_HDR = ["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"]
FONTES_HDR = ["url", "titulo", "orgao", "tipo", "data_documento", "acessado_em", "arquivo_local"]
ATOS_HDR = ["codigo", "uf", "tipo_ato", "numero", "data", "assunto", "situacao", "url", "trecho", "confianca"]

FONTES = [
    [ED2, "Cartografias da violência na Amazônia, 2ª edição (2023), cópia hospedada no repositório da FEA-USP (não é o site do FBSP)",
     "Fórum Brasileiro de Segurança Pública (FBSP), via FEA-USP", "secundaria",
     "2023", ACESSO, "brutos/fbsp_cartografias_ed2_2023.pdf"],
    [ED3, "Cartografias da violência na Amazônia, 3ª edição (2024), cópia hospedada pelo Poder360", "FBSP (cópia em Poder360)", "secundaria",
     "2024-12-11", ACESSO, "brutos/fbsp_cartografias_ed3_2024_poder360.pdf"],
    [ED4, "Cartografias da violência na Amazônia, 4ª edição (2025)", "FBSP", "secundaria", "2025-11", ACESSO,
     "brutos/fbsp_cartografias_ed4_2025.pdf"],
    [IGARAPE, "Esforços estaduais no combate aos crimes ambientais na Amazônia Legal: relatório diagnóstico",
     "Instituto Igarapé e Consórcio Interestadual da Amazônia Legal (CAL)", "secundaria", "2026-03", ACESSO,
     "brutos/igarape_port_esforcos_2026.pdf"],
    [P2017, "Pesquisa Perfil das Instituições de Segurança Pública, ano-base 2017", "Ministério da Justiça e Segurança Pública (MJSP)",
     "primaria", "ano-base 2017", ACESSO, "brutos/perfil_anobase_2017.pdf"],
    [P2018, "Pesquisa Perfil das Instituições de Segurança Pública, ano-base 2018 (publicada em 2020)", "Ministério da Justiça e Segurança Pública (MJSP)",
     "primaria", "ano-base 2018", ACESSO, "brutos/perfil_anobase_2018.pdf"],
    [P2014, "Pesquisa Perfil das Instituições de Segurança Pública, ano-base 2014-2016", "Ministério da Justiça e Segurança Pública (MJSP)",
     "primaria", "ano-base 2014-2016", ACESSO, "brutos/perfil_anobase_2014_2016.pdf"],
    [P2012, "Pesquisa Perfil das Instituições de Segurança Pública, ano-base 2012", "Ministério da Justiça e Segurança Pública (MJSP)",
     "primaria", "ano-base 2012", ACESSO, "brutos/perfil_anobase_2012.pdf"],
    [P2004, "Pesquisa Perfil Organizacional das Polícias Civis, 2004-2007", "Ministério da Justiça e Segurança Pública (MJSP)",
     "primaria", "2004-2007", ACESSO, "brutos/perfil_anobase_2004_2007.pdf"],
    [PORTAL, "Consórcio apresenta o primeiro diagnóstico integrado dos crimes ambientais na Amazônia Brasileira",
     "Portal Amazônia (imprensa)", "secundaria", "2025-11-20 (metadado do HTML)", ACESSO, "brutos/portalamazonia_diagnostico.html"],
    [PA_DECRETO, "Decreto nº 510, de 16/01/2020 (PA): homologa Resolução nº 04/2019-CONSUP (Divisão Especializada em Meio Ambiente)",
     "Governo do Estado do Pará (banco de leis da Alepa)", "primaria", "2020-01-16", ACESSO, "brutos/pa_lei510_2020.pdf"],
    [MT_DOE, "Decreto nº 218, de 31/03/2023 (MT): altera Decreto nº 1.436/2022 (DOE-MT)",
     "Governo de Mato Grosso (IOMAT)", "primaria", "2023-03-31", ACESSO, "brutos/mt_iomat_32559.pdf"],
]

ATOS = [
    ["I1.3.5-6_seguranca", "AL", "edicao_publicacao", "2ª edição", "2023", "Dados LAI das polícias da Amazônia Legal (Tab. 33, 34, 40 a 42)",
     "substituido", ED2, "Delegacias Especializadas de Interesse - Amazônia Legal - 2023", "alta"],
    ["I1.3.5-6_seguranca", "AL", "edicao_publicacao", "3ª edição", "2024-12-11", "Dados LAI, equipamentos PC e PM (Tab. 54) e PF (Tab. 55)",
     "substituido", ED3, "Número de equipamentos disponíveis e em uso - Polícia Civil e Polícia Militar", "alta"],
    ["I1.3.5-6_seguranca", "AL", "edicao_publicacao", "4ª edição", "2025-11", "Cartografias 2025 (crimes contra a vida; sem tabela de delegacias ambientais localizada)",
     "vigente", ED4, "Cartografias da violência na Amazônia (4ª edição)", "media"],
    ["I1.3.5-6_seguranca", "AL", "edicao_publicacao", "relatório diagnóstico", "2026-03", "Esforços estaduais no combate aos crimes ambientais na Amazônia Legal",
     "vigente", IGARAPE, "a região amazônica conta com apenas 11 delegacias ambientais e somente 1 delegacia fluvial", "alta"],
    ["I1.3.5-6_seguranca", "AL", "edicao_publicacao", "ano-base 2014-2016", "2014-2016", "Pesquisa Perfil: Polícia Civil, delegacias especializadas por atendimento (Tab. 2.5)",
     "substituido", P2014, "Tabela 2.5 - Total de delegacias especializadas por atendimento - (continuação); coluna Meio ambiente", "alta"],
    ["I1.3.5-6_seguranca", "AL", "edicao_publicacao", "ano-base 2017", "ano-base 2017", "Pesquisa Perfil: Polícia Civil, delegacias especializadas por atendimento (Tab. 2.6)",
     "substituido", P2017, "Tabela 2.6 - Total de delegacias especializadas, por atendimento (continuação); Polícia especializada de Meio ambiente", "alta"],
    ["I1.3.5-6_seguranca", "AL", "edicao_publicacao", "ano-base 2018", "ano-base 2018", "Pesquisa Perfil: delegacias especializadas por atendimento, Polícias Civis (Tab. 1.6.4)",
     "substituido", P2018, "Tabela 1.6.4 - Total de delegacias especializadas, por atendimento; coluna Meio Ambiente", "alta"],
    ["I1.3.5-6_seguranca", "AL", "edicao_publicacao", "ano-base 2012", "ano-base 2012", "Pesquisa Perfil: delegacias da PC e especializadas por UF (Tab. 2); sem coluna de meio ambiente por UF no texto",
     "substituido", P2012, "Tabela 2 - Quantidade de delegacias e delegacias especializadas das Polícias Civis, por Unidade da Federação, 2012", "media"],
    ["I1.3.5-6_seguranca", "AL", "edicao_publicacao", "2004-2007", "2004-2007", "Pesquisa Perfil Organizacional das Polícias Civis: unidades especializadas, Brasil (Tab. PC.6)",
     "substituido", P2004, "Tabela PC.6 - Número de Unidades Especializadas das Polícias Civis Segundo Tipo de Especialização (Brasil - 2004/2007)", "media"],
    ["I1.3.5-6_seguranca", "PA", "decreto", "510", "2020-01-16",
     "Homologa Resolução 04/2019-CONSUP: muda 'Divisão Especializada em Meio Ambiente' para 'Divisão Especializada em Meio Ambiente e Proteção Animal' no Regimento da PC-PA; lista três delegacias subordinadas (fauna e flora; ordenamento urbano e patrimônio cultural; poluição e outros crimes ambientais)",
     "desconhecido", PA_DECRETO, "Homologa a Resolução nº 04/2019 - CONSUP ... que aprova a mudança de nomenclatura da Divisão Especializada em Meio Ambiente.", "alta"],
    ["I1.3.5-6_seguranca", "MT", "decreto", "218", "2023-03-31",
     "Altera art. 33 do Decreto 1.436/2022 (conciliação ambiental). Cita a Delegacia Especializada do Meio Ambiente; não é ato de criação",
     "desconhecido", MT_DOE, "poderá ser realizado em conjunto com a Delegacia Especializada do Meio Ambiente e o Ministério Público do Estado de Mato Grosso.", "alta"],
    ["I1.3.5-6_seguranca", "AL", "proposta", "sem número", "2026-03",
     "Plano Tático Integrado da Amazônia Legal (longo prazo): proposta do diagnóstico Igarapé + CAL, não existente",
     "em_elaboracao", IGARAPE, "Sistema regional interoperável de indicadores ambientais criminais", "alta"],
    ["I1.3.5-6_seguranca", "AL", "proposta", "sem número", "2026-03",
     "Padronização de dados: atuação junto à SENASP para incorporar padronização de crimes ambientais e API para estados que não usam o sistema federal (proposta)",
     "em_elaboracao", IGARAPE, "API para integração de dados dos estados da Amazônia Legal que não utilizam o sistema federal", "alta"],
]

BLOCK_LOCAL = "dados/eixo1_coleta/I1.3.5-6_seguranca"


def write(name, header, data):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        for r in data:
            w.writerow(r)
    return path, len(data)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    p1, n1 = write("series.csv", SERIES_HDR, rows)
    p2, n2 = write("fontes.csv", FONTES_HDR, FONTES)
    p3, n3 = write("atos.csv", ATOS_HDR, ATOS)
    print("series.csv", n1, "linhas")
    print("fontes.csv", n2, "linhas")
    print("atos.csv", n3, "linhas")
