"""Grava fontes.csv, atos.csv e series.csv da tarefa I1.5.4-6_sicarf.

Uso, a partir da raiz do projeto:
    python -I scripts/eixo1_coleta_I1_5_4_6_sicarf.py

Os valores abaixo vieram dos arquivos em dados/eixo1_coleta/I1.5.4-6_sicarf/brutos/
(acessados em 2026-10-07). Nada aqui é inferido sem fonte; o que não foi encontrado
não entra nos CSVs.
"""
import csv
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dados", "eixo1_coleta", "I1.5.4-6_sicarf")
ACESSO = "2026-10-07"

FONTES_HEADER = ["url", "titulo", "orgao", "tipo", "data_documento", "acessado_em", "arquivo_local"]
ATOS_HEADER = ["codigo", "uf", "tipo_ato", "numero", "data", "assunto", "situacao", "url", "trecho", "confianca"]
SERIES_HEADER = ["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"]

FONTES = [
    ["https://www.gov.br/incra/pt-br", "Página inicial do INCRA", "INCRA", "primaria", "sem data", ACESSO, "brutos/incra_home.html"],
    ["https://www.gov.br/incra/pt-br/assuntos/governanca-fundiaria", "Governança Fundiária (INCRA)", "INCRA", "primaria", "modificado em 27/05/2026", ACESSO, "brutos/incra_governanca_fundiaria.html"],
    ["https://www.gov.br/incra/pt-br/terra-cidada/terra-cidada", "Programa Terra Cidadã (INCRA)", "INCRA", "primaria", "sem data", ACESSO, "brutos/incra_terra-cidada_terra-cidada.html"],
    ["https://www.gov.br/incra/pt-br/terra-cidada/normas", "Normas do Programa Terra Cidadã (INCRA)", "INCRA", "primaria", "publicado em 10/02/2025; modificado em 03/06/2026", ACESSO, "brutos/incra_terra-cidada_normas.html"],
    ["https://www.gov.br/incra/pt-br/terra-cidada/formulario-de-adesao", "Formulário de manifestação de interesse de ente federativo (Terra Cidadã)", "INCRA", "primaria", "sem data", ACESSO, "brutos/incra_terra-cidada_formulario-de-adesao.html"],
    ["https://www.gov.br/incra/pt-br/terra-cidada/painel-de-manifestacoes-de-interesse", "Painel de Manifestações de Interesse (sem conteúdo no HTML estático)", "INCRA", "primaria", "sem data", ACESSO, "brutos/incra_terra-cidada_painel-de-manifestacoes-de-interesse.html"],
    ["https://www.gov.br/incra/pt-br/canais_atendimento/plataforma-de-governanca-territorial", "Plataforma de Governança Territorial (página INCRA; conteúdo carregado por JavaScript)", "INCRA", "primaria", "sem data", ACESSO, "brutos/incra_canais_atendimento_plataforma-de-governanca-territorial.html"],
    ["https://www.gov.br/incra/pt-br/painel", "Painel do INCRA (Power BI embutido; dados não lidos)", "INCRA", "primaria", "publicado em 31/07/2025", ACESSO, "brutos/pg_www.gov.br_incra_pt-br_painel.html"],
    ["https://www.gov.br/incra/pt-br/assuntos/noticias", "Notícias do INCRA (lista sem links de matérias no HTML estático)", "INCRA", "primaria", "sem data", ACESSO, "brutos/incra_noticias.html"],
    ["https://www.gov.br/incra/pt-br/acesso-a-informacao/dados-abertos", "Dados abertos do INCRA", "INCRA", "primaria", "sem data", ACESSO, "brutos/incra_dados_abertos.html"],
    ["https://terracidada.incra.gov.br/adesoes", "Terra Cidadã: página de adesões (termo de adesão e manifestação de interesse)", "INCRA", "primaria", "sem data", ACESSO, "brutos/pg_terracidada.incra.gov.br_adesoes.html"],
    ["https://terracidada.incra.gov.br/adesoes-entidades", "Terra Cidadã: adesões de entidades", "INCRA", "primaria", "sem data", ACESSO, "brutos/pg_terracidada.incra.gov.br_adesoes-entidades.html"],
    ["https://portal.stf.jus.br/processos/detalhe.asp?incidente=6007933", "ADPF 743: detalhe do processo (número único 0103374-45.2020.1.00.0000)", "STF", "primaria", "sem data", ACESSO, "brutos/stf_adpf743_detalhe.html"],
    ["https://www.in.gov.br/consulta/-/buscar/dou?q=%22Terras+do+Brasil%22&s=o_dou&exactDate=&sortType=0", "Busca no DOU por “Terras do Brasil” (resultados não renderizados; ver achados)", "Imprensa Nacional (DOU)", "primaria", "consulta em 2026-10-07", ACESSO, "brutos/dou_busca_terras_do_brasil.html"],
    ["https://www.iteracre.ac.gov.br/", "Instituto de Terras do Acre: página inicial", "ITERACRE (AC)", "primaria", "sem data", ACESSO, "brutos/iteracre_home.html"],
    ["https://iteracre.ac.gov.br/acordos-e-cooperacoes/", "ITERACRE: Acordos e Cooperações (página com “Em breve !”)", "ITERACRE (AC)", "primaria", "sem data", ACESSO, "brutos/iteracre_acordos.html"],
    ["https://www.iterma.ma.gov.br/", "ITERMA: página inicial", "ITERMA (MA)", "primaria", "sem data", ACESSO, "brutos/iterma_home.html"],
    ["https://www.iterma.ma.gov.br/noticias/apos-decadas-de-espera-governo-do-maranhao-entrega-800-titulos-e-garante-dignidade-a-familias-em-grajau", "ITERMA: 800 títulos de propriedade urbana em Grajaú", "ITERMA (MA)", "primaria", "4/05/2026 (data exibida na notícia)", ACESSO, "brutos/iterma_grajau_800.html"],
    ["https://www.iterma.ma.gov.br/noticias/governo-do-maranhao-entrega-552-titulos-e-garante-dignidade-e-seguranca-juridica-em-colinas", "ITERMA: 552 títulos de propriedade urbana em Colinas", "ITERMA (MA)", "primaria", "18/05/2026 (data exibida na notícia)", ACESSO, "brutos/iterma_colinas_552.html"],
    ["https://iteraima.rr.gov.br/", "ITERAIMA (Instituto de Terras e Colonização de Roraima): página inicial", "ITERAIMA (RR)", "primaria", "sem data", ACESSO, "brutos/iteraima_home.html"],
    ["https://intermat.mt.gov.br/", "INTERMAT (MT): página inicial", "INTERMAT (MT)", "primaria", "sem data", ACESSO, "brutos/intermat_home.html"],
    ["https://itertins.to.gov.br/", "ITERTINS (TO): Aviso de Suspensão", "ITERTINS (TO)", "primaria", "sem data", ACESSO, "brutos/probe_itertins.to.gov.br.html"],
    ["https://www.ac.gov.br/", "Portal do Governo do Acre", "Governo do Acre", "primaria", "sem data", ACESSO, "brutos/estado_ac_portal.html"],
    ["https://www.amazonas.am.gov.br/", "Portal do Governo do Amazonas", "Governo do Amazonas", "primaria", "sem data", ACESSO, "brutos/estado_am_portal.html"],
    ["http://www.ap.gov.br/", "Portal do Governo do Amapá (redireciona para apdigital.portal.ap.gov.br)", "Governo do Amapá", "primaria", "sem data", ACESSO, "brutos/estado_ap_portal.html"],
    ["https://www.ma.gov.br/inicio", "Portal do Governo do Maranhão", "Governo do Maranhão", "primaria", "sem data", ACESSO, "brutos/estado_ma_portal.html"],
    ["https://portal.mt.gov.br/", "Portal do Governo de Mato Grosso", "Governo de Mato Grosso", "primaria", "sem data", ACESSO, "brutos/estado_mt_portal.html"],
    ["https://www.pa.gov.br/", "Portal do Governo do Pará", "Governo do Pará", "primaria", "sem data", ACESSO, "brutos/estado_pa_portal.html"],
    ["https://www.ro.gov.br/", "Portal do Governo de Rondônia", "Governo de Rondônia", "primaria", "sem data", ACESSO, "brutos/estado_ro_portal.html"],
    ["https://www.to.gov.br/", "Portal do Governo do Tocantins", "Governo do Tocantins", "primaria", "sem data", ACESSO, "brutos/estado_to_portal.html"],
    ["https://www.car.gov.br/estados/status", "Status por estado no Sicar (JSON; cópia própria desta tarefa, sha256 igual ao de I1.5.8)", "SFB/MGI (Sicar)", "primaria", "consulta em 2026-10-07", ACESSO, "brutos/car_estados_status.json"],
    ["https://www.climatepolicyinitiative.org/wp-content/uploads/2024/12/Onde-Estamos-na-Implementacao-do-Codigo-Florestal-2024.pdf", "Onde Estamos na Implementação do Código Florestal (edição 2024): seção “Sistemas Utilizados pelos Estados para Gerenciar as Inscrições no CAR”", "CPI/PUC-Rio", "secundaria", "edição 2024 (dados do Painel do SFB citados como de out/2024)", ACESSO, "brutos/cpi_2024_onde_estamos.pdf"],
    ["https://www.climatepolicyinitiative.org/wp-content/uploads/2025/12/Onde-Estamos-2025.pdf", "Onde Estamos na Implementação do Código Florestal (edição 2025, versão completa): Tabela 4, p. 65, “Sistemas Utilizados pelos Estados na Gestão do CAR (2025)”", "CPI/PUC-Rio (com informações do MGI)", "secundaria", "edição 2025; data de publicação não visível no texto", ACESSO, "brutos/cpi_2025_onde_estamos.pdf"],
    ["https://www.onr.org.br/", "Operador Nacional do Registro de Imóveis (ONR): página inicial", "ONR", "secundaria", "sem data", ACESSO, "brutos/onr_home.html"],
    ["https://web.archive.org/cdx/search/cdx?url=planalto.gov.br/ccivil_03/_ato2023-2026/2025/decreto/&output=json&limit=5", "Wayback CDX: índice de decretos do Planalto 2025 (snapshot com status 403)", "Internet Archive", "secundaria", "captura de 2026-03-08", ACESSO, "brutos/wayback_cdx_planalto_decreto.json"],
]

# codigo, uf, tipo_ato, numero, data, assunto, situacao, url, trecho, confianca
# uf = AL para atos federais, que valem para as nove UFs (AL = Amazônia Legal, nunca Alagoas).
ATOS = [
    ["I1.5.4", "AL", "Portaria Conjunta MDA/Incra", "4/2024", "",
     "Institui o Programa Terra Cidadã e dispõe sobre seus objetivos e forma de implementação",
     "desconhecido", "https://www.gov.br/incra/pt-br/terra-cidada/normas",
     "Institui o Programa Terra Cidadã e dispõe sobre seus objetivos e forma de implementação.", "media"],
    ["I1.5.4", "AL", "Instrução Normativa", "148/2025", "",
     "Regulamenta os procedimentos para a celebração de acordos de adesão com entes federativos, entidades públicas de ATER e universidades públicas",
     "desconhecido", "https://www.gov.br/incra/pt-br/terra-cidada/normas",
     "Regulamenta os procedimentos para a celebração de acordos de adesão com entes federativos", "media"],
    ["I1.5.4", "AL", "Resolução", "35/2025", "",
     "Aprovação da Carta de Serviços do Programa Terra Cidadã",
     "desconhecido", "https://www.gov.br/incra/pt-br/terra-cidada/normas",
     "Aprovação da Carta de Serviços do Programa Terra Cidadã", "media"],
    ["I1.5.6", "AL", "Processo judicial (ADPF)", "743", "",
     "Relator(a) André Mendonça; redator do acórdão Flávio Dino; número único 0103374-45.2020.1.00.0000. Objeto e decisões sobre integração de bases não lidos.",
     "desconhecido", "https://portal.stf.jus.br/processos/detalhe.asp?incidente=6007933",
     "Relator(a): MIN. ANDRÉ MENDONÇA", "media"],
]

# Série por UF e ano: gestão do CAR no Sicar federal (1) ou em sistema estadual próprio (0).
# 2026: flag utilizarCentralMensagemFederal de car.gov.br/estados/status (cópia própria em brutos/).
# 2025: Tabela 4 do CPI 2025 (secundária). 2024: texto do CPI 2024 (secundária).
# Em 2024, AC, PA e RO aparecem como "módulo federal do Sicar customizado": categoria que o CPI 2025
# trata como plataforma estadual. Por isso AC, PA e RO não entram na série de 2024.
SICAR_STATUS = "https://www.car.gov.br/estados/status"
CPI24 = "https://www.climatepolicyinitiative.org/wp-content/uploads/2024/12/Onde-Estamos-na-Implementacao-do-Codigo-Florestal-2024.pdf"
CPI25 = "https://www.climatepolicyinitiative.org/wp-content/uploads/2025/12/Onde-Estamos-2025.pdf"
SERIE = "Gestão do CAR: Sicar federal (1) ou sistema estadual próprio (0), por UF e ano"
UNIDADE = "1=Sicar federal 0=sistema estadual"
SICAR_1 = {"AM", "AP", "MA", "RR"}

# Trechos literais do status 2026 (car.gov.br/estados/status, cópia própria em brutos/car_estados_status.json).
FRAG_2026 = {
    "AC": '{"liberado":true,"sigla":"AC","urlBaixar":"http://www.car.ac.gov.br/#/baixar","federalPodeCancelar":false,"executarFiltroAutomatico":false,"utilizarCentralMensagemFederal":false}',
    "AM": '{"liberado":true,"sigla":"AM","urlBaixar":null,"federalPodeCancelar":true,"executarFiltroAutomatico":false,"utilizarCentralMensagemFederal":true}',
    "AP": '{"liberado":true,"sigla":"AP","urlBaixar":null,"federalPodeCancelar":true,"executarFiltroAutomatico":false,"utilizarCentralMensagemFederal":true}',
    "MA": '{"liberado":true,"sigla":"MA","urlBaixar":null,"federalPodeCancelar":true,"executarFiltroAutomatico":false,"utilizarCentralMensagemFederal":true}',
    "MT": '{"liberado":true,"sigla":"MT","urlBaixar":"http://www.sema.mt.gov.br/car#/","federalPodeCancelar":false,"executarFiltroAutomatico":false,"utilizarCentralMensagemFederal":false}',
    "PA": '{"liberado":true,"sigla":"PA","urlBaixar":"https://car.semas.pa.gov.br/","federalPodeCancelar":false,"executarFiltroAutomatico":false,"utilizarCentralMensagemFederal":false}',
    "RO": '{"liberado":true,"sigla":"RO","urlBaixar":"http://car.sedam.ro.gov.br/#/site","federalPodeCancelar":false,"executarFiltroAutomatico":false,"utilizarCentralMensagemFederal":false}',
    "RR": '{"liberado":true,"sigla":"RR","urlBaixar":null,"federalPodeCancelar":true,"executarFiltroAutomatico":false,"utilizarCentralMensagemFederal":true}',
    "TO": '{"liberado":true,"sigla":"TO","urlBaixar":"http://sigcar.semarh.to.gov.br/","federalPodeCancelar":false,"executarFiltroAutomatico":false,"utilizarCentralMensagemFederal":false}',
}
NOTA_2026 = ("Literal de car.gov.br/estados/status (consulta 2026-10-07): {frag}. "
             "Valor = utilizarCentralMensagemFederal. O significado do campo foi inferido do nome; "
             "não há definição oficial encontrada. Não comprova interoperabilidade da base ambiental.")

# Trechos literais do CPI 2025, Tabela 4 (grupos lidos com a intercalação do rótulo "Sistema estadual" no PDF).
CPI25_SICAR = ("“Alagoas, Amapá, Amazonas, Ceará, Distrito Federal, Maranhão, Minas Gerais, Paraíba,” "
               "e “Paraná, Pernambuco, Piauí, Rio de Janeiro, Rio Grande do Norte, Rio Grande do Sul, "
               "Roraima e Sergipe.”")
CPI25_ESTADUAL = ("“Acre, Bahia, Espírito Santo, Goiás, Mato Grosso, Mato Grosso do Sul, Pará, Rondônia, "
                  "Santa Catarina, São Paulo e Tocantins.”")
NOTA_2025 = ("CPI 2025, Tabela 4 (p. 65), fonte secundária com informações do MGI. Grupo “Sicar”: {sicar}. "
             "Grupo “Sistema estadual”: {estadual}. UF lida no grupo {grupo}; confirmada pelo texto de 2024 "
             "e pelo status de 2026.")

# Trechos literais do CPI 2024 (seção sobre sistemas estaduais).
CPI24_SICAR = ("“A maioria dos estados utiliza o Sicar, a saber: Alagoas, Amapá, Amazonas, Ceará, Goiás, "
               "Maranhão, Minas Gerais, Paraíba, Pernambuco, Paraná, Piauí, Rio de Janeiro, Rio Grande do Norte, "
               "Rio Grande do Sul, Roraima, Sergipe e o Distrito Federal.”")
CPI24_ESTADUAL = ("“outros usam sistema estadual próprio, como Bahia, Espírito Santo, Mato Grosso, "
                  "Mato Grosso do Sul e Tocantins.”")
NOTA_2024 = ("CPI 2024, fonte secundária. UF lida no grupo {grupo}; texto: {texto}")

SERIES = []
for uf in ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]:
    v = 1 if uf in SICAR_1 else 0
    SERIES.append(["I1.5.6", SERIE, "proxy", uf, 2026, v, UNIDADE, SICAR_STATUS,
                   NOTA_2026.format(frag=FRAG_2026[uf])])
for uf in ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]:
    v = 1 if uf in SICAR_1 else 0
    grupo = "Sicar" if v else "Sistema estadual"
    SERIES.append(["I1.5.6", SERIE, "proxy", uf, 2025, v, UNIDADE, CPI25,
                   NOTA_2025.format(sicar=CPI25_SICAR, estadual=CPI25_ESTADUAL, grupo=grupo)])
for uf in ["AM", "AP", "MA", "RR"]:
    SERIES.append(["I1.5.6", SERIE, "proxy", uf, 2024, 1, UNIDADE, CPI24,
                   NOTA_2024.format(grupo="Sicar", texto=CPI24_SICAR)])
for uf in ["MT", "TO"]:
    SERIES.append(["I1.5.6", SERIE, "proxy", uf, 2024, 0, UNIDADE, CPI24,
                   NOTA_2024.format(grupo="sistema estadual próprio", texto=CPI24_ESTADUAL)])


def gravar(nome, header, linhas):
    caminho = os.path.join(OUT, nome)
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(linhas)
    return caminho


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for nome, header, linhas in [
        ("fontes.csv", FONTES_HEADER, FONTES),
        ("atos.csv", ATOS_HEADER, ATOS),
        ("series.csv", SERIES_HEADER, SERIES),
    ]:
        p = gravar(nome, header, linhas)
        print(f"{p}: {len(linhas)} linhas")
