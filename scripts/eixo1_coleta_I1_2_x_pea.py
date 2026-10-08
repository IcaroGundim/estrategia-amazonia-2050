# -*- coding: utf-8 -*-
"""Gera os CSVs da coleta I1.2.x_pea (Planos Estaduais de Adaptação).

Roda do zero a partir da raiz do projeto:
    python -I scripts/eixo1_coleta_I1_2_x_pea.py

Os dados abaixo foram copiados das fontes que foram abertas (ver fontes.csv e
achados.md). Nenhum valor foi estimado: ausência de ato é registrada como
"não encontrado" e não gera linha em series.csv.
"""
import csv
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dados", "eixo1_coleta", "I1.2.x_pea")
BR = "dados/eixo1_coleta/I1.2.x_pea/brutos/"
ACESSO = "2026-10-07"

# ---------------------------------------------------------------- fontes.csv
FONTES_HEADER = ["url", "titulo", "orgao", "tipo", "data_documento", "acessado_em", "arquivo_local"]
FONTES = [
    ("https://unfccc.int/sites/default/files/resource/Updated-NAP_Brazil_POR_2026-compressed.pdf",
     "Plano Clima Adaptação: Estratégia Nacional de Adaptação (NAP do Brasil, versão em português)",
     "MMA / Governo federal (submetido à UNFCCC)", "primaria", "2026", ACESSO, BR + "unfccc_nap_brazil_por_2026.pdf"),
    ("https://www.gov.br/mma/pt-br/composicao/smc/plano-clima/plano-clima-adaptacao/planos-setoriais-e-tematicos-de-adaptacao-pt",
     "Planos setoriais e temáticos de adaptação (página MMA; acesso restrito, sem conteúdo)",
     "MMA", "primaria", "", ACESSO, BR + "mma_planos_adaptacao.html"),
    ("https://web.archive.org/cdx/search/cdx?url=gov.br/mma/pt-br/composicao/smc/plano-clima/plano-clima-adaptacao/planos-setoriais-e-tematicos-de-adaptacao-pt&output=json",
     "Índice do Wayback para a página do MMA (sem capturas)",
     "Internet Archive", "secundaria", "", ACESSO, BR + "mma_wayback_cdx.json"),
    ("https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2024/lei/L14904.htm",
     "Lei nº 14.904, de 27/06/2024 (diretrizes para planos de adaptação à mudança do clima)",
     "Presidência da República", "primaria", "2024-06-27", ACESSO, BR + "lei14904_2024_planalto.html"),
    ("https://ditel.casacivil.ro.gov.br/cotel/Livros/Files/D31619.pdf",
     "Decreto nº 31.619, de 29/05/2026 (homologa Plano ABC+RONDÔNIA); DOE nº 114, publicação 16/06/2026",
     "Governo de Rondônia - Casa Civil", "primaria", "2026-05-29", ACESSO, BR + "ro_decreto31619_2026.pdf"),
    ("https://rondonia.ro.gov.br/wp-content/uploads/2024/10/Decreto_N__29.556_-1CBMRO-1.pdf",
     "Decreto nº 29.556, de 14/10/2024 (Comitê Gestor para Adaptação e Enfrentamento às Mudanças Climáticas)",
     "Governo de Rondônia", "primaria", "2024-10-14", ACESSO, BR + "ro_decreto29556_2024.pdf"),
    ("https://bancodeleis.alepa.pa.gov.br/arquivos/lei4774_2025_72839.pdf",
     "Decreto nº 4.774, de 01/07/2025 (homologa Plano ABC+PA e cria GGE)",
     "Assembleia Legislativa do Pará - Assessoria Técnica", "primaria", "2025-07-01", ACESSO, BR + "pa_lei4774_2025.pdf"),
    ("https://sistemas.semas.pa.gov.br/legislacao/files/anexos/726178_ANEXO%20%C3%9ANICO,%20DECRETO%20N%C2%BA%204.774,%20DE%201%C2%BA%20DE%20JULHO%20DE%202025.pdf",
     "Anexo Único do Decreto nº 4.774/2025 (texto do Plano ABC+PA)",
     "SEMAS-PA (legislação)", "primaria", "2025-07-01", ACESSO, BR + "pa_anexo_abc_plus_4774.pdf"),
    ("https://bancodeleis.alepa.pa.gov.br/arquivos/lei9048_2020_93797.pdf",
     "Lei nº 9.048, de 29/04/2020 (Política Estadual sobre Mudanças Climáticas do Pará - PEMC/PA)",
     "Assembleia Legislativa do Pará", "primaria", "2020-04-29", ACESSO, BR + "pa_lei9048_2020.pdf"),
    ("https://bancodeleis.alepa.pa.gov.br/arquivos/lei9781_2022_17582.pdf",
     "Lei nº 9.781, de 27/12/2022 (altera a Lei 9.048/2020)",
     "Assembleia Legislativa do Pará", "primaria", "2022-12-27", ACESSO, BR + "pa_lei9781_2022.pdf"),
    ("https://arquivos.al.ma.leg.br:8443/ged/legislacao/LEI_12301",
     "Lei nº 12.301, de 11/06/2024 (Política Estadual de Enfrentamento das Mudanças Climáticas - MA)",
     "Assembleia Legislativa do Maranhão", "primaria", "2024-06-11", ACESSO, BR + "ma_lei12301_2024.pdf"),
    ("https://iomat.mt.gov.br/legislacao/diario_oficial/download/137548",
     "Decreto nº 1.160, de 25/10/2021 (Carbono Neutro MT; art. 5º PAC/MT) - edição DOE-MT",
     "Imprensa Oficial de Mato Grosso (IOMAT)", "primaria", "2021-10-25", ACESSO, BR + "mt_iomat_137548.pdf"),
    ("https://iomat.mt.gov.br/legislacao/diario_oficial/download/327348",
     "Lei Complementar nº 582, de 13/01/2017 (Política Estadual de Mudanças Climáticas - MT)",
     "Imprensa Oficial de Mato Grosso (IOMAT)", "primaria", "2017-01-13", ACESSO, BR + "mt_lc582_2017_iomat.pdf"),
    ("https://www.legisweb.com.br/legislacao/?id=438199",
     "Decreto nº 1.513, de 03/11/2022 (redefine Plano ABC+MT); cópia de texto, DOE 04/11/2022 segundo a cópia",
     "Legisweb (agregador de legislação)", "secundaria", "2022-11-03", ACESSO, BR + "mt_decreto1513_2022_legisweb.html"),
    ("https://www.legisweb.com.br/legislacao/?id=422087",
     "Decreto nº 1.160, de 25/10/2021; cópia de texto (conferência)",
     "Legisweb (agregador de legislação)", "secundaria", "2021-10-25", ACESSO, BR + "mt_decreto1160_2021_legisweb.html"),
    ("https://al.to.leg.br/arquivo/61813",
     "Lei nº 4.131, de 05/01/2023 (institui o Fundo Clima do Tocantins - FunClima); publicada no DOE nº 6.244 de 06/01/2023",
     "Assembleia Legislativa do Tocantins", "primaria", "2023-01-05", ACESSO, BR + "to_al_arquivo_61813.pdf"),
    ("https://conexaoto.com.br/2025/02/07/semarh-apresenta-necessidade-de-planos-municipais-de-adaptacao-as-mudancas-climaticas-ao-cma",
     "Semarh apresenta necessidade de planos municipais de adaptação às mudanças climáticas ao CMA (notícia; menciona o Plano Estadual de Adaptação em construção)",
     "Conexão Tocantins (notícia; Governo do Tocantins)", "secundaria", "2025-02-07", ACESSO, BR + "to_conexao_adaptacao_2025.html"),
    ("https://www.legisweb.com.br/legislacao/?id=171295",
     "Lei nº 1.917, de 17/04/2008 (Política Estadual sobre Mudanças Climáticas do Tocantins); cópia de texto",
     "Legisweb (agregador de legislação)", "secundaria", "2008-04-17", ACESSO, BR + "to_lei1917_legisweb.html"),
    ("https://www.legis.ac.gov.br/detalhar_imprimir/5560",
     "Decreto nº 11.217, de 31/03/2023 (Comitê Gestor de Mudanças Climáticas do Acre), impressão do LEGIS",
     "Governo do Acre - Portal da Legislação (LEGIS)", "primaria", "2023-03-31", ACESSO, BR + "ac_legis_detalhar5560.html"),
    ("https://faolex.fao.org/docs/pdf/bra216482.pdf",
     "Decreto nº 11.217/2023: impressão do LEGIS hospedada no FAOLEX",
     "FAO - FAOLEX", "secundaria", "2023-03-31", ACESSO, BR + "ac_decreto11217_faolex.pdf"),
    ("https://fas-amazonia.org/wp-content/uploads/2023/09/TDR-179-2023-PSI.pdf",
     "Termo de referência (PSI) que cita a Lei estadual 2.308/2010 e o SISA (Acre)",
     "Fundo Amazônia Sustentável (FAS)", "secundaria", "2023-09", ACESSO, BR + "ac_tdr_fas_2023.pdf"),
    ("https://www.legisweb.com.br/legislacao/?id=485680",
     "Decreto nº 39.445-E, de 29/10/2025 (institui Plano ABC+RR); cópia de texto, publicado no DOE-RR em 29/10/2025 segundo a cópia",
     "Legisweb (agregador de legislação)", "secundaria", "2025-10-29", ACESSO, BR + "rr_decreto39445_legisweb.html"),
    ("https://www.legisweb.com.br/legislacao/?id=119995",
     "Lei nº 3.135, de 05/06/2007 (Política Estadual sobre Mudanças Climáticas do Amazonas); texto consolidado",
     "Legisweb (agregador de legislação)", "secundaria", "2007-06-05", ACESSO, BR + "am_lei3135_legisweb.html"),
    ("https://transparencia.mpam.mp.br/images/stories/lei_3135_07.pdf",
     "Lei 3.135/2007: cópia do MPAM (o arquivo baixado é página de navegação, sem texto da lei)",
     "Ministério Público do Amazonas", "secundaria", "2007-06-05", ACESSO, BR + "am_lei3135_2007_mpam.pdf"),
    ("https://www.legisweb.com.br/legislacao/?id=279645",
     "Resolução SAGRIMA nº 2, de 23/12/2014 (publica Plano ABC do Maranhão); cópia de texto, DOE 30/12/2014 segundo a cópia",
     "Legisweb (agregador de legislação)", "secundaria", "2014-12-23", ACESSO, BR + "ma_res2_2014_legisweb.html"),
    ("https://backend.transparencia.org.br/wp-content/uploads/2026/02/estrategias-subnacionais-na-amazonia.pdf",
     "Emergência climática: estratégias subnacionais na Amazônia (relatório Achados e Pedidos)",
     "Transparência Brasil / Abraji", "secundaria", "2021-10", ACESSO, BR + "transparencia_estrategias_subnacionais_amazonia.pdf"),
    ("https://portalamazonia.com/meio-ambiente/diagnostico-amazonas-estiagem/",
     "Sema-AM apresenta diagnóstico climático que servirá de base ao Plano de Adaptação do Estado",
     "Portal Amazônia (notícia)", "secundaria", "2025-08-13", ACESSO, BR + "am_portalamazonia_diagnostico.html"),
    ("https://portalamazonia.com/amapa/nova-lei-florestas-amapa/",
     "Nova lei busca reduzir vulnerabilidade das florestas no Amapá (Lei 3.128 sancionada)",
     "Portal Amazônia (notícia)", "secundaria", "2024-10-27", ACESSO, BR + "ap_portalamazonia_lei3128.html"),
    ("https://legis.senado.leg.br/sdleg-getter/documento/download/8968e5bc-baa4-4e1b-bf4a-148ca5b531ef",
     "Documento do Senado citado como tendo 14 planos setoriais (NÃO LIDO: página de verificação por JavaScript)",
     "Senado Federal", "secundaria", "", ACESSO, BR + "senado_planos_adaptacao_8968e5bc.pdf"),
]

# ----------------------------------------------------------------- atos.csv
ATOS_HEADER = ["codigo", "uf", "tipo_ato", "numero", "data", "assunto", "situacao", "url", "trecho", "confianca"]
ATOS = [
    # AC
    ("AC01", "AC", "decreto", "11.217", "2023-03-31",
     "Comitê Gestor de Mudanças Climáticas do Acre (diretrizes de serviços ambientais, mitigação e adaptação); não é plano",
     "vigente", "https://www.legis.ac.gov.br/detalhar_imprimir/5560",
     "Dispõe sobre o Comitê Gestor de Mudanças Climáticas do Estado do Acre.", "alta"),
    ("AC02", "AC", "lei", "2.308", "2010-10-22",
     "Política estadual de baixas emissões e Sistema de Incentivos a Serviços Ambientais (SISA); contexto, não é plano de adaptação",
     "desconhecido", "https://fas-amazonia.org/wp-content/uploads/2023/09/TDR-179-2023-PSI.pdf",
     "por meio da lei estadual 2.308, aprovada em 22 de outubro de 2010, que engloba o Sistema de Incentivos a Serviços Ambientais - SISA",
     "media"),
    # AM
    ("AM01", "AM", "lei", "3.135", "2007-06-05",
     "Política Estadual sobre Mudanças Climáticas, Conservação Ambiental e Desenvolvimento Sustentável (texto consolidado de cópia; alterações posteriores não verificadas)",
     "vigente", "https://www.legisweb.com.br/legislacao/?id=119995",
     "XI - a elaboração de planos de ação que contribuam para mitigar os efeitos adversos das mudanças climáticas, fazendo-os constar dos planejamentos gerais ou setoriais do Estado do Amazonas;",
     "media"),
    ("AM02", "AM", "plano_em_elaboracao", "", "2025-08-11",
     "Diagnóstico climático apresentado pela Sema-AM como base do Plano de Adaptação às Mudanças Climáticas do Estado; sem ato de aprovação encontrado",
     "em_elaboracao", "https://portalamazonia.com/meio-ambiente/diagnostico-amazonas-estiagem/",
     "O estudo servirá como base para a elaboração do Plano de Adaptação às Mudanças Climáticas do Estado",
     "media"),
    # AP
    ("AP01", "AP", "lei", "3.128", "",
     "Institui política estadual sobre mudança do clima (reduzir vulnerabilidade; ZEE; monitoramento de GEE; Sistema Estadual do Clima; Comitê Técnico-Científico); data do ato não verificada",
     "vigente", "https://portalamazonia.com/amapa/nova-lei-florestas-amapa/",
     "Foi sancionada pelo Governo do Amapá, a Lei nº 3.128 que institui uma política estadual para reduzir a vulnerabilidade",
     "baixa"),
    # MA
    ("MA01", "MA", "lei", "12.301", "2024-06-11",
     "Institui a Política Estadual de Enfrentamento das Mudanças Climáticas; art. 6º, XIII lista planos setoriais de mitigação e adaptação; art. 8º prevê Plano de Redução do Risco de Desastres (não é PEA)",
     "vigente", "https://arquivos.al.ma.leg.br:8443/ged/legislacao/LEI_12301",
     "XIII - os planos setoriais de mitigação e de adaptação às mudanças climáticas visando à redução do risco climático",
     "alta"),
    ("MA02", "MA", "resolucao", "2", "2014-12-23",
     "Publica o Plano Estadual de Mitigação e de Adaptação às Mudanças Climáticas (Plano ABC do Maranhão, agropecuária); setorial",
     "desconhecido", "https://www.legisweb.com.br/legislacao/?id=279645",
     "Publicar o Plano Estadual de Mitigação e de Adaptação às Mudanças Climáticas",
     "media"),
    ("MA03", "MA", "plano_previsto_ppa", "", "",
     "Plano Estadual de Adaptação e Mitigação dos Efeitos das Mudanças Climáticas previsto no PPA 2020-2023 (relatório de 2021; status atual não verificado)",
     "em_elaboracao", "https://backend.transparencia.org.br/wp-content/uploads/2026/02/estrategias-subnacionais-na-amazonia.pdf",
     "está prevista a implantação do Plano Estadual de Adaptação e Mitigação dos Efeitos das Mudanças Climáticas, ainda em fase de planejamento",
     "media"),
    # MT
    ("MT01", "MT", "lei_complementar", "582", "2017-01-13",
     "Institui a Política Estadual de Mudanças Climáticas (alterada pela LC 777/2023, segundo busca não aberta)",
     "vigente", "https://iomat.mt.gov.br/legislacao/diario_oficial/download/327348",
     "Institui a Política Estadual de Mudanças Climáticas.", "alta"),
    ("MT02", "MT", "decreto", "1.160", "2021-10-25",
     "Cria o Programa Carbono Neutro MT; institui PPCDIF/MT 4ª fase (2021-2024); art. 5º manda elaborar o PAC/MT",
     "vigente", "https://iomat.mt.gov.br/legislacao/diario_oficial/download/137548",
     "será elaborado, sob a coordenação da SEMA, o Plano de Ação Climática do Estado de Mato Grosso (PAC/MT), em até 120 dias da publicação deste Decreto",
     "alta"),
    ("MT03", "MT", "plano_previsto", "", "",
     "Plano de Ação Climática do Estado de MT (PAC/MT), previsto no Decreto 1.160/2021 com prazo de 120 dias; nenhuma publicação ou aprovação encontrada em três buscas",
     "desconhecido", "https://iomat.mt.gov.br/legislacao/diario_oficial/download/137548",
     "Plano de Ação Climática do Estado de Mato Grosso (PAC/MT), em até 120 dias da publicação deste Decreto",
     "media"),
    ("MT04", "MT", "decreto", "2.052", "2013-12-18",
     "Institui o Plano Estadual de Agricultura de Baixo Carbono (Plano ABC-MT; mitigação); redefinido pelo Decreto 430/2016",
     "substituido", "https://www.legisweb.com.br/legislacao/?id=438199",
     "instituiu pelo Decreto nº 2.052 , de 18 de dezembro de 2013, o Plano Estadual de Agricultura de Baixo Carbono - Plano ABC-MT",
     "media"),
    ("MT05", "MT", "decreto", "430", "2016-02-22",
     "Redefine o Plano ABC-MT; revogado pelo Decreto 1.513/2022 (art. 6º)",
     "revogado", "https://www.legisweb.com.br/legislacao/?id=438199",
     "Fica revogado o Decreto nº 430 , de 22 de fevereiro de 2016.", "media"),
    ("MT06", "MT", "decreto_setorial_agropecuaria", "1.513", "2022-11-03",
     "Redefine o Plano ABC+MT (Plano Estadual para Adaptação à Mudança do Clima e Baixa Emissão de Carbono na Agropecuária); publicado no DOE 04/11/2022 segundo a cópia",
     "vigente", "https://www.legisweb.com.br/legislacao/?id=438199",
     "Redefine o Plano Estadual para Adaptação à Mudança do Clima e Baixa Emissão de Carbono na Agropecuária - ABC+MT",
     "media"),
    # PA
    ("PA01", "PA", "lei", "9.048", "2020-04-29",
     "Institui a Política Estadual sobre Mudanças Climáticas do Pará (PEMC/PA)",
     "vigente", "https://bancodeleis.alepa.pa.gov.br/arquivos/lei9048_2020_93797.pdf",
     "Institui a Política Estadual sobre Mudanças Climáticas do Pará (PEMC/PA), e dá outras providências.", "alta"),
    ("PA02", "PA", "plano_previsto", "", "",
     "Plano Estadual sobre Mudanças Climáticas: art. 36 fixa prazo de até 3 anos, contados da publicação da lei (2020), para elaborar, aprovar e publicar; nenhum ato de aprovação encontrado",
     "desconhecido", "https://bancodeleis.alepa.pa.gov.br/arquivos/lei9048_2020_93797.pdf",
     "Fica estabelecido o prazo de até 3 (três) anos, contados a partir da publicação desta Lei",
     "alta"),
    ("PA03", "PA", "lei", "9.781", "2022-12-27",
     "Altera a Lei 9.048/2020 (PEMC/PA): inclui planos setoriais no art. 32, III (inclui Plano Setorial de Agropecuária) e cria o PC-Clima",
     "vigente", "https://bancodeleis.alepa.pa.gov.br/arquivos/lei9781_2022_17582.pdf",
     "Altera a Lei Estadual nº 9.048, de 29 de abril de 2020, que institui a Política Estadual sobre Mudanças Climáticas do Pará (PEMC/PA).",
     "alta"),
    ("PA04", "PA", "decreto_setorial_agropecuaria", "4.774", "2025-07-01",
     "Homologa o Plano Estadual para Adaptação à Mudança do Clima e Baixa Emissão de Carbono na Agropecuária (Plano ABC+PA) e cria o GGE; publicação no DOE não verificada no texto lido",
     "vigente", "https://bancodeleis.alepa.pa.gov.br/arquivos/lei4774_2025_72839.pdf",
     "Homologa o Plano Estadual para Adaptação à Mudança do Clima e Baixa Emissão de Carbono na Agropecuária (Plano ABC+PA)",
     "alta"),
    ("PA05", "PA", "plano_setorial_nao_publicado", "", "",
     "Plano ABC Pará (segunda fase, 2020-2030): elaborado mas sem publicação por instrumento normativo, segundo o anexo do Decreto 4.774/2025",
     "desconhecido", "https://sistemas.semas.pa.gov.br/legislacao/files/anexos/726178_ANEXO%20%C3%9ANICO,%20DECRETO%20N%C2%BA%204.774,%20DE%201%C2%BA%20DE%20JULHO%20DE%202025.pdf",
     "O Plano ABC Pará foi elaborado, mas não foi oficialmente publicado por meio de instrumentos normativos",
     "alta"),
    # RO
    ("RO01", "RO", "lei", "4.437", "2018-12-17",
     "Institui a Política Estadual de Governança Climática e Serviços Ambientais (PGSA); citada no Decreto 31.619/2026, texto não aberto",
     "vigente", "https://ditel.casacivil.ro.gov.br/cotel/Livros/Files/D31619.pdf",
     "Lei Estadual n° 4.437, de 17 de dezembro de 2018", "media"),
    ("RO02", "RO", "decreto", "28.060", "2023-04-20",
     "Institui e aprova o Regimento do Grupo Gestor Estadual (GGE/ABC+/RO) do plano setorial de adaptação na agropecuária, 2020-2030; citado no Decreto 31.619/2026",
     "vigente", "https://ditel.casacivil.ro.gov.br/cotel/Livros/Files/D31619.pdf",
     "Institui e aprova o Regimento Interno do Grupo Gestor Estadual do Plano Setorial para Adaptação à Mudança do Clima",
     "media"),
    ("RO03", "RO", "decreto", "28.613", "2023-11-28",
     "Institui o Comitê de Crise Hídrica (2023); alterado pelo Decreto 29.556/2024, que passa a Comitê Gestor para Adaptação e Enfrentamento às Mudanças Climáticas",
     "vigente", "https://rondonia.ro.gov.br/wp-content/uploads/2024/10/Decreto_N__29.556_-1CBMRO-1.pdf",
     "Institui o Comitê de Crise Hídrica no âmbito do estado de Rondônia.", "media"),
    ("RO04", "RO", "decreto", "29.556", "2024-10-14",
     "Altera o Decreto 28.613/2023 e institui o Comitê Gestor para Adaptação e Enfrentamento às Mudanças Climáticas (comitê, não plano)",
     "vigente", "https://rondonia.ro.gov.br/wp-content/uploads/2024/10/Decreto_N__29.556_-1CBMRO-1.pdf",
     "Institui o Comitê Gestor para Adaptação e Enfrentamento às Mudanças Climáticas no âmbito do estado de Rondônia.", "alta"),
    ("RO05", "RO", "decreto_setorial_agropecuaria", "31.619", "2026-05-29",
     "Homologa o Plano Estadual para Adaptação à Mudança do Clima e Baixa Emissão de Carbono na Agropecuária (Plano ABC+RONDÔNIA); DOE nº 114, publicação 16/06/2026",
     "vigente", "https://ditel.casacivil.ro.gov.br/cotel/Livros/Files/D31619.pdf",
     "Homologa o Plano Estadual para Adaptação à Mudança do Clima e Baixa Emissão de Carbono na Agropecuária - Plano ABC+RONDÔNIA.",
     "alta"),
    # RR
    ("RR01", "RR", "decreto", "29.407-E", "2020",
     "Estabelece o Plano Estadual ABC-RR (agropecuária); ato não aberto, citado no relatório de 2021; escopo de adaptação não confirmado",
     "desconhecido", "https://backend.transparencia.org.br/wp-content/uploads/2026/02/estrategias-subnacionais-na-amazonia.pdf",
     "Decreto 29.407-E/2020: estabelece o Plano Estadual ABC – RR", "media"),
    ("RR02", "RR", "decreto_setorial_agropecuaria", "39.445-E", "2025-10-29",
     "Institui o Plano Estadual de Mitigação e de Adaptação às Mudanças Climáticas (Plano ABC + RR) e cria o GGE; publicado no DOE-RR em 29/10/2025 segundo a cópia",
     "vigente", "https://www.legisweb.com.br/legislacao/?id=485680",
     "Institui o Plano Estadual de Mitigação e de Adaptação às mudanças climáticas para a consolidação de uma economia de baixa emissão de carbono na agricultura (Plano ABC + RR)",
     "media"),
    ("RR03", "RR", "decreto", "29.710-E", "2020",
     "Política Estadual de Impulsionamento do Desenvolvimento Econômico-Ambiental de Baixas Emissões (citada no relatório de 2021; contexto)",
     "desconhecido", "https://backend.transparencia.org.br/wp-content/uploads/2026/02/estrategias-subnacionais-na-amazonia.pdf",
     "Decreto Nº 29.710-E/2020: estabelece a Política Estadual de Impulsionamento do Desenvolvimento Econômico-Ambiental de Baixas Emissões de Gases de Efeito Estufa",
     "media"),
    # TO
    ("TO01", "TO", "lei", "1.917", "2008-04-17",
     "Institui a Política Estadual sobre Mudanças Climáticas, Conservação Ambiental e Desenvolvimento Sustentável do Tocantins (cópia de texto; alterações não verificadas)",
     "vigente", "https://www.legisweb.com.br/legislacao/?id=171295",
     "Art. 1º É instituída a Política Estadual sobre Mudanças Climáticas, Conservação Ambiental e Desenvolvimento Sustentável do Tocantins", "media"),
    ("TO03", "TO", "plano_em_elaboracao", "", "2025-02-07",
     "Governo do Tocantins (Semarh) afirma que está construindo o Plano Estadual de Adaptação e prevê adesão ao programa Adaptacidade do MMA; notícia, sem ato publicado",
     "em_elaboracao", "https://conexaoto.com.br/2025/02/07/semarh-apresenta-necessidade-de-planos-municipais-de-adaptacao-as-mudancas-climaticas-ao-cma",
     "estamos construindo o Plano Estadual de Adaptação e alinhando essa estratégia com a Defesa Civil e o Plano Nacional de Adaptação",
     "media"),
    ("TO02", "TO", "lei", "4.131", "2023-01-05",
     "Institui o Fundo Clima do Estado do Tocantins (FunClima) para apoiar projetos de mitigação e adaptação; é fundo, não plano",
     "vigente", "https://al.to.leg.br/arquivo/61813",
     "Institui o Fundo Clima do Estado do Tocantins - FunClima, e adota outras providências.", "alta"),
]

# ---------------------------------------------------------------- series.csv
SERIES_HEADER = ["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"]
S1 = "I1.2.1_PROXY_ABC_ADAPT"
S1_NAME = "Plano setorial de adaptação na agropecuária (ABC/ABC+) instituído ou homologado (1 = sim). Não é PEA geral"
S2 = "I1.2.1_CTX_LEI_POLITICA_CLIMA"
S2_NAME = "Política estadual de mudança do clima instituída por lei (1 = sim, no ano do ato)"
S3 = "I1.2.2_ENA_REF_PROXY"
S3_NAME = "Planos da ENA (de 16) explicitamente referenciados no plano estadual"
S4 = "I1.2.2_REVISAO_PRAZO_PROXY"
S4_NAME = "Cláusula formal de revisão periódica com prazo e órgão responsável no plano (1 = sim, 0 = não)"

URL_MA_RES = "https://www.legisweb.com.br/legislacao/?id=279645"
URL_MT_1513 = "https://www.legisweb.com.br/legislacao/?id=438199"
URL_PA_4774 = "https://bancodeleis.alepa.pa.gov.br/arquivos/lei4774_2025_72839.pdf"
URL_RR_39445 = "https://www.legisweb.com.br/legislacao/?id=485680"
URL_RO_31619 = "https://ditel.casacivil.ro.gov.br/cotel/Livros/Files/D31619.pdf"
URL_AM_3135 = "https://www.legisweb.com.br/legislacao/?id=119995"
URL_TO_1917 = "https://www.legisweb.com.br/legislacao/?id=171295"
URL_AC_TDR = "https://fas-amazonia.org/wp-content/uploads/2023/09/TDR-179-2023-PSI.pdf"
URL_AP_NEWS = "https://portalamazonia.com/amapa/nova-lei-florestas-amapa/"
URL_MT_LC582 = "https://iomat.mt.gov.br/legislacao/diario_oficial/download/327348"
URL_MA_12301 = "https://arquivos.al.ma.leg.br:8443/ged/legislacao/LEI_12301"
URL_PA_9048 = "https://bancodeleis.alepa.pa.gov.br/arquivos/lei9048_2020_93797.pdf"
URL_RO_4437 = URL_RO_31619

NOTA_AL_S1 = ("AL = Amazônia Legal (agregado das 9 UFs). Fluxo de atos novos no ano; não é estoque vigente; "
              "ver achados.md §5. Limite inferior: conta só o que foi achado em fonte. Anos sem linha não significam zero.")
NOTA_AL_S2 = ("AL = Amazônia Legal. Fluxo de leis novas no ano; não é estoque vigente; ver achados.md §5. "
              "RR não entra (PEMC-RR não confirmado). AP fica fora (data do ato não verificada). Limite inferior.")
UNID_AL = "nº de UFs com ato no ano"

SERIES = [
    # S1: proxy, planos setoriais ABC/ABC+ com adaptação
    (S1, S1_NAME, "proxy", "MA", 2014, 1, "0/1", URL_MA_RES,
     "Resolução SAGRIMA 2/2014 publica o Plano ABC-MA (mitigação e adaptação na agricultura); cópia Legisweb (secundária); vigência não verificada"),
    (S1, S1_NAME, "proxy", "MT", 2022, 1, "0/1", URL_MT_1513,
     "Decreto 1.513/2022 redefine o Plano ABC+MT (adaptação na agropecuária); cópia Legisweb (secundária)"),
    (S1, S1_NAME, "proxy", "PA", 2025, 1, "0/1", URL_PA_4774,
     "Decreto 4.774/2025 homologa o Plano ABC+PA (fonte primária)"),
    (S1, S1_NAME, "proxy", "RR", 2025, 1, "0/1", URL_RR_39445,
     "Decreto 39.445-E/2025 institui o Plano ABC+RR (mitigação e adaptação); cópia Legisweb (secundária)"),
    (S1, S1_NAME, "proxy", "RO", 2026, 1, "0/1", URL_RO_31619,
     "Decreto 31.619/2026 homologa o Plano ABC+RONDÔNIA (fonte primária)"),
    (S1, S1_NAME, "proxy", "AL", 2014, 1, UNID_AL, URL_MA_RES, NOTA_AL_S1 + " MA."),
    (S1, S1_NAME, "proxy", "AL", 2022, 1, UNID_AL, URL_MT_1513, NOTA_AL_S1 + " MT."),
    (S1, S1_NAME, "proxy", "AL", 2025, 2, UNID_AL, URL_PA_4774, NOTA_AL_S1 + " PA e RR."),
    (S1, S1_NAME, "proxy", "AL", 2026, 1, UNID_AL, URL_RO_31619, NOTA_AL_S1 + " RO."),
    # S2: contexto, lei de política climática
    (S2, S2_NAME, "contexto", "AM", 2007, 1, "0/1", URL_AM_3135,
     "Lei 3.135/2007 (texto consolidado, cópia Legisweb; secundária)"),
    (S2, S2_NAME, "contexto", "TO", 2008, 1, "0/1", URL_TO_1917,
     "Lei 1.917/2008 (cópia Legisweb; secundária)"),
    (S2, S2_NAME, "contexto", "AC", 2010, 1, "0/1", URL_AC_TDR,
     "Lei 2.308/2010 citada no TDR do FAS como política de baixas emissões e SISA (secundária); escopo é serviços ambientais, não plano"),
    (S2, S2_NAME, "contexto", "MT", 2017, 1, "0/1", URL_MT_LC582,
     "LC 582/2017 (fonte primária)"),
    (S2, S2_NAME, "contexto", "RO", 2018, 1, "0/1", URL_RO_4437,
     "Lei 4.437/2018 citada no Decreto 31.619/2026 (fonte primária que cita; texto da lei não aberto)"),
    (S2, S2_NAME, "contexto", "PA", 2020, 1, "0/1", URL_PA_9048,
     "Lei 9.048/2020 (fonte primária)"),
    (S2, S2_NAME, "contexto", "MA", 2024, 1, "0/1", URL_MA_12301,
     "Lei 12.301/2024 (fonte primária)"),
    (S2, S2_NAME, "contexto", "AL", 2007, 1, UNID_AL, URL_AM_3135, NOTA_AL_S2 + " AM."),
    (S2, S2_NAME, "contexto", "AL", 2008, 1, UNID_AL, URL_TO_1917, NOTA_AL_S2 + " TO."),
    (S2, S2_NAME, "contexto", "AL", 2010, 1, UNID_AL, URL_AC_TDR, NOTA_AL_S2 + " AC (escopo SISA, secundária)."),
    (S2, S2_NAME, "contexto", "AL", 2017, 1, UNID_AL, URL_MT_LC582, NOTA_AL_S2 + " MT."),
    (S2, S2_NAME, "contexto", "AL", 2018, 1, UNID_AL, URL_RO_4437, NOTA_AL_S2 + " RO."),
    (S2, S2_NAME, "contexto", "AL", 2020, 1, UNID_AL, URL_PA_9048, NOTA_AL_S2 + " PA."),
    (S2, S2_NAME, "contexto", "AL", 2024, 1, UNID_AL, URL_MA_12301, NOTA_AL_S2 + " MA."),
    # S3: ENA referenciada (texto lido). ENA aprovada pelo CIM em 15/12/2025 (NAP, primária)
    (S3, S3_NAME, "proxy", "MT", 2022, 0, "nº de planos ENA (de 16)", URL_MT_1513,
     "0 = nenhuma menção aos planos da ENA no texto lido (cópia Legisweb). Ato anterior à ENA: 0 por construção"),
    (S3, S3_NAME, "proxy", "RR", 2025, 0, "nº de planos ENA (de 16)", URL_RR_39445,
     "0 = nenhuma menção no texto lido (cópia Legisweb integral, com art. 4º e assinatura de 29/10/2025). Ato anterior à ENA: 0 por construção"),
    (S3, S3_NAME, "proxy", "PA", 2025, 0, "nº de planos ENA (de 16)", URL_PA_4774,
     "0 = nenhuma menção no decreto e no anexo lidos; cita o PNA (2016) e o Plano Setorial federal. Anterior à ENA"),
    (S3, S3_NAME, "proxy", "RO", 2026, 0, "nº de planos ENA (de 16)", URL_RO_31619,
     "0 = nenhuma menção no decreto lido; o plano completo (site da Seagri) não foi aberto. Posterior à aprovação do Plano Clima"),
    # S4: cláusula de revisão com prazo e órgão (texto lido)
    (S4, S4_NAME, "proxy", "MT", 2022, 0, "0/1", URL_MT_1513,
     "0 = GGE tem competência para 'estabelecer as metas e a revisão do Plano ABC+ MT', sem prazo"),
    (S4, S4_NAME, "proxy", "RR", 2025, 0, "0/1", URL_RR_39445,
     "0 = cópia Legisweb integral (art. 1º a 4º e assinatura) sem termo de revisão; DOE-RR não acessado"),
    (S4, S4_NAME, "proxy", "PA", 2025, 0, "0/1", URL_PA_4774,
     "0 = GGE 'revisar' o plano sem prazo; 'reavaliada a cada 2 anos' refere-se ao GGE; o anexo diz 'sugere-se' revisões periódicas (sugestão, não cláusula)"),
    (S4, S4_NAME, "proxy", "RO", 2026, 0, "0/1", URL_RO_31619,
     "0 = GGE 'revisar' o plano sem prazo; plano completo não aberto"),
]


def escreve(nome, header, linhas):
    caminho = os.path.join(OUT, nome)
    os.makedirs(OUT, exist_ok=True)
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(header)
        for linha in linhas:
            assert len(linha) == len(header), (nome, linha[:2])
            w.writerow(linha)
    return caminho


if __name__ == "__main__":
    for nome, header, linhas in [
        ("fontes.csv", FONTES_HEADER, FONTES),
        ("atos.csv", ATOS_HEADER, ATOS),
        ("series.csv", SERIES_HEADER, SERIES),
    ]:
        print(escreve(nome, header, linhas), len(linhas), "linhas")
