# -*- coding: utf-8 -*-
"""Gera series.csv e fontes.csv da tarefa I1.5.8_car (CAR de PCT e sobreposicoes de CAR).

Os valores foram transcritos das fontes guardadas em dados/eixo1_coleta/I1.5.8_car/brutos/
(PDFs e JSON baixados em 07/10/2026). Cada registro traz a URL aberta, a data-base e a
nota com o trecho da fonte. Este script nao baixa nada: so grava os CSVs e confere
arquivos e somas.

Rodar a partir da raiz do projeto:
    python -I scripts/eixo1_coleta_I1_5_8_car.py
"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dados" / "eixo1_coleta" / "I1.5.8_car"
BRUTOS = OUT / "brutos"
ACESSO = "2026-10-07"

UFS_OK = {"AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO", "AL"}  # AL = Amazonia Legal

U = {
    "cpi2020": "https://www.climatepolicyinitiative.org/wp-content/uploads/2020/12/Onde-estamos-na-implementacao-do-Codigo-Florestal-radiografia-do-CAR-e-do-PRA-nos-estados-brasileiros.pdf",
    "cpi2022": "https://www.climatepolicyinitiative.org/wp-content/uploads/2023/04/REL-ONDE-ESTAMOS-2022.pdf",
    "cpi2023": "https://www.climatepolicyinitiative.org/wp-content/uploads/2023/12/OE-2023-Relatorio.pdf",
    "cpi2024": "https://www.climatepolicyinitiative.org/wp-content/uploads/2024/12/Onde-Estamos-na-Implementacao-do-Codigo-Florestal-2024.pdf",
    "cpi2025": "https://www.climatepolicyinitiative.org/wp-content/uploads/2025/12/Onde-Estamos-2025.pdf",
    "cpi2025exec": "https://www.climatepolicyinitiative.org/wp-content/uploads/2025/10/Executive-Summary-Implementation-Forest-Code-2025.pdf",
    "mpf": "https://www.mpf.mp.br/atuacao/ccr6/documentos-e-publicacoes/publicacoes/nota-tecnica/2020/analise_de_sobreposicao_ti_x_car_brasil.pdf",
    "opan": "https://amazonianativa.org.br/wp-content/uploads/2024/10/Relatorio-CAR-2024.pdf",
    "ufmg_press": "https://csr.ufmg.br/csr/wp-content/uploads/2025/01/paraterraboa_para-e-o-estado-com-mais-registros-de-car-sobrepostos-a-areas-protegidas.pdf",
    "ufmg_g1": "https://csr.ufmg.br/csr/wp-content/uploads/2024/12/g1_estudo-aponta-que-mais-de-200-mil-registros-rurais-foram-feitos-em-areas-sensiveis.pdf",
    "sfb_camara": "https://www2.camara.leg.br/atividade-legislativa/comissoes/comissoes-permanentes/cmads/apresentacoes-em-eventos/eventos-2019/24-10-2019-DEBATER%20O%20CADASTRO%20AMBIENTAL%20RURAL%20DE%20POVOS%20E%20COMUNIDADES%20TRADICIONAIS/jaine-ariely-cubas-davet/view",
    "car_script": "https://www.car.gov.br/js/script.js",
    "car_boletim": "https://www.car.gov.br/boletim/listar",
    "car_estados_status": "https://www.car.gov.br/estados/status",
    "car_estados_all": "https://www.car.gov.br/estados/all",
    "gov_boletins": "https://www.gov.br/florestal/pt-br/centrais-de-conteudo/publicacoes/boletins",
    "gov_painel": "https://www.gov.br/florestal/pt-br/assuntos/regularizacao-ambiental/painel-da-regularizacao-ambiental",
}

FONTES = [
    # url, titulo, orgao, tipo, data_documento, arquivo_local (relativo a OUT)
    (U["car_script"], "Script da aplicacao Sicar (lido como texto, nao executado)", "SFB/MGI (Sicar)", "primaria", "sem data", "brutos/js/script.js"),
    (U["car_boletim"], "Endpoint de lista de boletins do Sicar (retornou lista vazia)", "SFB/MGI (Sicar)", "primaria", "consulta em 2026-10-07", "brutos/boletim_listar.json"),
    (U["car_estados_status"], "Status por estado no Sicar (liberado, urlBaixar, central de mensagem federal)", "SFB/MGI (Sicar)", "primaria", "consulta em 2026-10-07", "brutos/api_estados_status.json"),
    (U["car_estados_all"], "Lista de UFs com codigo IBGE (Sicar)", "SFB/MGI (Sicar)", "primaria", "consulta em 2026-10-07", "brutos/api_estados_all.json"),
    (U["gov_boletins"], "Central de publicacoes SFB: boletins listados sao SNIF e IFN, nao o Boletim do CAR", "SFB/MMA", "primaria", "sem data", ""),
    (U["gov_painel"], "Painel da Regularizacao Ambiental (Power BI; sem link publico extraivel)", "SFB/MMA", "primaria", "sem data", ""),
    (U["mpf"], "Nota Tecnica: analise de sobreposicoes de cadastros de imoveis rurais em Terras Indigenas (PGR, 6a CCR)", "MPF/PGR (Assessoria Tecnica em Geoprocessamento)", "primaria", "2020-06-02", "brutos/mpf_nt_sobreposicao_ti_car_2020.pdf"),
    (U["cpi2020"], "Onde Estamos na Implementacao do Codigo Florestal (edicao 2020) - sem contagem de PCT por UF", "CPI/PUC-Rio", "secundaria", "2020-12", "brutos/cpi_onde_estamos_2020.pdf"),
    (U["cpi2022"], "Onde Estamos na Implementacao do Codigo Florestal (edicao 2022)", "CPI/PUC-Rio", "secundaria", "2023-04", "brutos/cpi_REL-ONDE-ESTAMOS-2022.pdf"),
    (U["cpi2023"], "Onde Estamos na Implementacao do Codigo Florestal (edicao 2023)", "CPI/PUC-Rio", "secundaria", "2023-12", "brutos/cpi_OE-2023-Relatorio.pdf"),
    (U["cpi2024"], "Onde Estamos na Implementacao do Codigo Florestal (edicao 2024)", "CPI/PUC-Rio", "secundaria", "2024-12", "brutos/cpi_onde_estamos_2024_completo.pdf"),
    (U["cpi2025"], "Onde Estamos na Implementacao do Codigo Florestal (edicao 2025, versao completa)", "CPI/PUC-Rio", "secundaria", "2025-12-15", "brutos/cpi_onde_estamos_2025_completo.pdf"),
    (U["cpi2025exec"], "Onde Estamos 2025 - Sumario Executivo (versao preliminar, dados ate ago/2025)", "CPI/PUC-Rio", "secundaria", "2025-10", "brutos/cpi_exec_summary_2025.pdf"),
    (U["opan"], "O CAR como instrumento de grilagem: CARs sobrepostos a terras indigenas de Mato Grosso (OPAN com ICV)", "OPAN / Instituto Centro de Vida", "secundaria", "2024-10", "brutos/opan_relatorio_car_2024.pdf"),
    (U["ufmg_press"], "Reportagem sobre o Panorama do Codigo Florestal (3a ed., CSR/UFMG): Para e o estado com mais registros de CAR sobrepostos a areas protegidas", "Imprensa (paraterraboa) citando CSR/UFMG", "secundaria", "2025-01", "brutos/ufmg_paraterraboa_2025.pdf"),
    (U["ufmg_g1"], "Reportagem g1 sobre o Panorama do Codigo Florestal (3a ed., CSR/UFMG)", "Imprensa (g1) citando CSR/UFMG", "secundaria", "2024-12-05", "brutos/ufmg_g1_2024.pdf"),
    (U["sfb_camara"], "Apresentacao do SFB sobre o CAR de Povos e Comunidades Tradicionais (Camara dos Deputados)", "SFB/MMA", "primaria", "2019-10-24", "brutos/sfb_apresentacao_camara_2019_pct.pdf"),
]

SER_INSCR = "CAR/PCT inscritos (territorios ou cadastros PCT no Sicar ou modulo estadual)"
SER_VALID = "CAR validados (todos os tipos, nao so PCT)"
SER_ANALISE = "CAR em analise (todos os tipos, nao so PCT)"
SER_ANAL_INI = "CAR com analise iniciada (todos os tipos, nao so PCT)"

S_TI = "CAR sobreposto a Terra Indigena: shapes (todas as fases de regularizacao)"
S_TI_ESTUDO = "CAR sobreposto a Terra Indigena em estudo: shapes"
S_TI_IMOVEIS = "CAR sobreposto a Terra Indigena: imoveis distintos (SEMA-MT)"
S_TI_AREA = "CAR sobreposto a Terra Indigena: area sobreposta (ha, SEMA-MT)"
S_PA_TI_CAD = "CAR sobre TI: cadastros incidentes (Regulariza Para)"
S_PA_TI_CANC = "CAR sobre TI: cancelados (% dos cadastros)"
S_PA_TI_SUSP = "CAR sobre TI: suspensos (% dos cadastros)"
S_PA_TI_PEND = "CAR sobre TI: pendentes (% dos cadastros)"
S_PA_TI_ATIVO = "CAR sobre TI: ativos (% dos cadastros)"
S_PA_UC_CAD = "CAR sobre UC: cadastros sobrepostos (Regulariza Para)"
S_PA_UC_AREA = "CAR sobre UC: area sobreposta (ha, Regulariza Para)"
S_PA_UC_CANC_SUSP = "CAR sobre UC: cancelados e suspensos (% da area sobreposta)"
S_IMOV_TOTAL = "Imoveis CAR cadastrados (total da UF)"
S_IMOV_AREAS = "Imoveis CAR que avancam sobre areas protegidas (Panorama CSR/UFMG)"
S_AL_UC = "Registros CAR sobrepostos a UC (Amazonia Legal, Panorama CSR/UFMG)"
S_AL_TI = "Registros CAR sobrepostos a TI (Amazonia Legal, Panorama CSR/UFMG)"
S_AL_TP = "Registros CAR sobre terras publicas sem destinacao (Amazonia Legal, Panorama CSR/UFMG)"
S_AL_TOTAL = "Casos de sobreposicao CAR (Amazonia Legal, Panorama CSR/UFMG)"

ROWS = []


def add(codigo, serie, rotulo, uf, ano, valor, unidade, fonte, nota):
    assert uf in UFS_OK, uf
    assert rotulo in {"exata", "componente", "proxy", "contexto"}, rotulo
    ROWS.append([codigo, serie, rotulo, uf, str(ano), str(valor), unidade, fonte, nota])


# ---------------- I1.5.8: CAR/PCT inscritos (componente) ----------------
add("I1.5.8", SER_INSCR, "componente", "MA", 2022, 548, "territorios coletivos (CAR/PCT)", U["cpi2022"],
    "CPI 2022: 'Ao final de 2022, Maranhão já havia inscrito 548 territórios coletivos no CAR'.")
add("I1.5.8", SER_INSCR, "componente", "PA", 2022, 29, "CAR de PCT", U["cpi2022"],
    "CPI 2022: 'o Pará inscreveu apenas 29 CAR de PCT' (ao final de 2022).")
add("I1.5.8", SER_INSCR, "componente", "MA", 2023, 680, "CAR/PCT", U["cpi2023"],
    "CPI 2023: 'Maranhão com 680 CAR/PCT' (dados de nov/2023).")
add("I1.5.8", SER_INSCR, "componente", "PA", 2023, 50, "CAR/PCT (territorios)", U["cpi2023"],
    "Valor derivado: 37 territorios quilombolas + 13 territorios extrativistas (CPI 2023, citando Semas/PA 2023). Soma feita neste script.")
add("I1.5.8", SER_INSCR, "componente", "MT", 2023, 0, "CAR/PCT (territorios)", U["cpi2023"],
    "CPI 2023: 'Apenas Espírito Santo, Mato Grosso e o Distrito Federal não possuem nenhum território tradicional inscrito no CAR/PCT.'")
add("I1.5.8", SER_INSCR, "componente", "MA", 2024, 683, "CAR/PCT", U["cpi2024"],
    "CPI 2024: 'Maranhão, com 683' (dados de nov/2024).")
add("I1.5.8", SER_INSCR, "componente", "MT", 2024, 1, "CAR/PCT", U["cpi2024"],
    "CPI 2024: '... como o Mato Grosso, conter apenas uma inscrição de CAR/PCT no Sicar'.")
add("I1.5.8", SER_INSCR, "componente", "MA", 2025, 684, "CAR/PCT", U["cpi2025"],
    "CPI 2025 (versao completa, dez/2025): 'Maranhão (684)'. O sumário executivo de out/2025 traz 683.")
add("I1.5.8", SER_INSCR, "componente", "PA", 2025, 72, "CAR/PCT (territorios)", U["cpi2025"],
    "CPI 2025 completo: 'inscrição de 72 territórios ... (Semas/PA 2025b)'. O sumário executivo traz 69 (inconsistência entre as duas versões da própria CPI).")
add("I1.5.8", SER_INSCR, "componente", "MT", 2025, 1, "CAR/PCT", U["cpi2025"],
    "CPI 2025 completo: 'segue com apenas um CAR/PCT registrado no Sicar'.")

# ---------------- I1.5.8: contexto (todos os CAR, nao so PCT) ----------------
for uf, val in [("MA", 7900), ("PA", 39000), ("MT", 32000), ("AC", 2600), ("AM", 848),
                ("AP", 586), ("RO", 11000), ("RR", 15), ("TO", 14)]:
    add("I1.5.8", SER_VALID, "contexto", uf, 2025, val, "registros validados (todos os CAR)", U["cpi2025exec"],
        "Sumario executivo CPI 2025, dados ate ago/2025 (versao preliminar). Valores de milhar arredondados pela CPI "
        "em PA, MT, RO e MA. Nao e recorte de PCT.")
add("I1.5.8", SER_ANALISE, "contexto", "PA", 2025, 251000, "registros em analise (todos os CAR)", U["cpi2025exec"],
    "Sumario executivo CPI 2025: 'about 251,000 registrations under review' (Para). Aproximado; dados ate ago/2025.")
add("I1.5.8", SER_ANALISE, "contexto", "MT", 2025, 92000, "registros em analise (todos os CAR)", U["cpi2025exec"],
    "Sumario executivo CPI 2025: 'Mato Grosso (92,000)'. Dados ate ago/2025.")
add("I1.5.8", SER_ANALISE, "contexto", "AP", 2025, 9000, "registros em analise (todos os CAR)", U["cpi2025exec"],
    "Sumario executivo CPI 2025: 'In Amapá's case, although the absolute number is small (9,000)'. Aproximado; dados ate ago/2025.")
add("I1.5.8", SER_ANAL_INI, "contexto", "PA", 2024, 236000, "registros com analise iniciada (todos os CAR)", U["cpi2024"],
    "CPI 2024: 'aproximadamente 236 mil análises iniciadas (72% dos cadastros do estado)'.")

# ---------------- I1.5.7: sobreposicoes ----------------
TI_2020 = [("AC", 149), ("AM", 1093), ("AP", 8), ("MA", 2056), ("MT", 2613),
           ("PA", 1535), ("RO", 1651), ("RR", 609), ("TO", 185)]
for uf, val in TI_2020:
    add("I1.5.7", S_TI, "proxy", uf, 2020, val, "shapes de imoveis CAR", U["mpf"],
        "Nota tecnica PGR, tabela 2 (p. 4): quantidade de shapes de propriedades do CAR com sobreposicoes em TIs, por UF. "
        "Dados do CAR (consulta publica) e da FUNAI baixados em 20/05/2020; NT de 02/06/2020. Recorte TI, nao bases estaduais.")

TI_ESTUDO_2020 = [("AC", 0), ("AM", 639), ("MT", 49), ("PA", 1035), ("RO", 40), ("RR", 529)]
for uf, val in TI_ESTUDO_2020:
    add("I1.5.7", S_TI_ESTUDO, "proxy", uf, 2020, val, "shapes de imoveis CAR", U["mpf"],
        "Nota tecnica PGR, tabela 3 (p. 5). AP, MA e TO nao aparecem na tabela. A soma das UFs listadas e 2292, "
        "e a propria tabela informa total 2293 (diferenca de 1 na fonte).")

add("I1.5.7", S_TI_IMOVEIS, "proxy", "MT", 2023, 670, "imoveis CAR distintos", U["opan"],
    "OPAN/ICV 2024, nota 15: 'São um total de 670 imóveis com cadastro no CAR que possuem sobreposição com Territórios Indígenas'. "
    "Dado do Geoportal SEMA-MT acessado em 30/10/2023 (nota 14). A soma da tabela 2 e 691, pois 21 cadastros sao contados duas vezes.")
add("I1.5.7", S_TI_AREA, "proxy", "MT", 2023, 1035033, "hectares", U["opan"],
    "OPAN/ICV 2024, tabela 2 (total): 1.035.033 ha de area sobreposta a 74 TIs, equivalente a 6,84% da area das TIs de MT (15.132.219 ha). "
    "Fonte: Geoportal SEMA-MT acessado em 30/10/2023.")

add("I1.5.7", S_PA_TI_CAD, "proxy", "PA", 2025, 2667, "cadastros CAR incidentes sobre TI", U["cpi2025"],
    "CPI 2025 completo: 'há 2.667 cadastros incidentes sobre TIs' (Regulariza Para, Semas/PA 2025d; acesso em 30/09/2025 segundo a CPI). "
    "Fonte primaria da Semas nao aberta por nos.")
for serie, val in [(S_PA_TI_CANC, 37), (S_PA_TI_SUSP, 20), (S_PA_TI_PEND, 36), (S_PA_TI_ATIVO, 7)]:
    add("I1.5.7", serie, "componente", "PA", 2025, val, "% dos cadastros CAR sobre TI", U["cpi2025"],
        "CPI 2025 completo: '37% foram cancelados, 20% suspensos, 36% permanecem pendentes e 7% ativos' (Semas/PA 2025d, citado pela CPI).")

add("I1.5.7", S_PA_UC_CAD, "proxy", "PA", 2025, 24900, "cadastros CAR sobrepostos a UC", U["cpi2025"],
    "CPI 2025 completo: 'cerca de 24,9 mil cadastros abrangendo mais de 26 milhões de hectares' (Semas/PA 2025e, acesso 30/09/2025 segundo a CPI). Aproximado.")
add("I1.5.7", S_PA_UC_AREA, "proxy", "PA", 2025, 26000000, "hectares", U["cpi2025"],
    "CPI 2025 completo: 'mais de 26 milhões de hectares' (Semas/PA 2025e). Valor e piso, nao valor exato.")
add("I1.5.7", S_PA_UC_CANC_SUSP, "componente", "PA", 2025, 41, "% da area sobreposta a UC", U["cpi2025"],
    "CPI 2025 completo: 'Os cadastros cancelados e suspensos somam 41% da área total sobreposta' (UC; Semas/PA 2025e).")

add("I1.5.7", S_IMOV_TOTAL, "contexto", "PA", 2024, 232170, "imoveis CAR", U["ufmg_press"],
    "Reportagem sobre o Panorama CSR/UFMG (3a ed.): 'são 232.170 imóveis cadastrados, dos quais 70.445 avançam sobre áreas protegidas'. "
    "Panorama publicado em dez/2024 segundo a reportagem g1 (csr.ufmg.br).")
add("I1.5.7", S_IMOV_AREAS, "proxy", "PA", 2024, 70445, "imoveis CAR", U["ufmg_press"],
    "Reportagem citando o Panorama (CSR/UFMG, 3a ed.): '70.445 avançam sobre áreas protegidas'. "
    "A reportagem nao define 'areas protegidas' com precisao; a g1 lista UC, TI e terras publicas sem destinacao.")

add("I1.5.7", S_AL_UC, "proxy", "AL", 2024, 13433, "registros CAR", U["ufmg_press"],
    "Panorama CSR/UFMG (3a ed.), citado pela reportagem: 'com 13.433 registros coincidindo com áreas de unidades de conservação' na Amazonia Legal. "
    "AL aqui = Amazonia Legal (agregado das 9 UFs), nao Alagoas.")
add("I1.5.7", S_AL_TI, "proxy", "AL", 2024, 2360, "registros CAR", U["ufmg_press"],
    "Panorama CSR/UFMG (3a ed.), citado pela reportagem: '2.360 com terras indígenas' na Amazonia Legal. AL = Amazonia Legal.")
add("I1.5.7", S_AL_TP, "proxy", "AL", 2024, 206495, "registros CAR", U["ufmg_press"],
    "Panorama CSR/UFMG (3a ed.), citado pela reportagem: '206.495 sobre terras públicas sem destinação' na Amazonia Legal. AL = Amazonia Legal.")
add("I1.5.7", S_AL_TOTAL, "proxy", "AL", 2024, 910000, "casos de sobreposicao", U["ufmg_press"],
    "Reportagem citando o Panorama (CSR/UFMG): 'a Amazônia, onde há cerca de 910 mil casos'. Aproximado; AL = Amazonia Legal.")


def check_sums():
    # Tabela 2 da NT PGR: 25 UFs (inclui AL = Alagoas, que nao entra nesta serie) somam 14979
    tabela2 = [149, 85, 1093, 8, 245, 10, 24, 44, 2056, 234, 1893, 2613, 1535, 14, 409, 641, 12, 1651, 609, 724, 450, 11, 284, 185]
    assert sum(tabela2) == 14979, sum(tabela2)
    # Tabela 3 (em estudo): soma das UFs listadas
    estudo = [v for _, v in TI_ESTUDO_2020]
    soma_estudo = sum(estudo)
    if soma_estudo != 2293:
        print(f"[aviso] tabela 3 da NT PGR: soma das UFs listadas = {soma_estudo}; total informado = 2293 (registrado na nota)")
    # Opan: 670 imoveis distintos + 21 contados duas vezes = 691 na soma da tabela 2
    assert 670 + 21 == 691
    # Opan: areas por situacao somam o total de 1.035.033 ha
    assert 258030 + 464820 + 0 + 279054 + 33129 == 1035033
    # Opan: 74 TIs
    assert 59 + 5 + 1 + 8 + 1 == 74
    # CPI 2023/2025: PA 2023 = 37 + 13
    assert 37 + 13 == 50


def check_files():
    faltando = []
    for url, _, _, _, _, arq in FONTES:
        if arq and not (OUT / arq).exists():
            faltando.append(arq)
    assert not faltando, faltando


def main():
    check_sums()
    check_files()
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / "series.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"])
        w.writerows(ROWS)
    with open(OUT / "fontes.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["url", "titulo", "orgao", "tipo", "data_documento", "acessado_em", "arquivo_local"])
        for url, titulo, orgao, tipo, data_doc, arq in FONTES:
            w.writerow([url, titulo, orgao, tipo, data_doc, ACESSO, arq])
    print(f"series.csv: {len(ROWS)} linhas; fontes.csv: {len(FONTES)} fontes")


if __name__ == "__main__":
    main()
