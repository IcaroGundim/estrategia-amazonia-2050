# -*- coding: utf-8 -*-
"""Indicador I1.1.1 (ZEE vigente e atualizado) - extracao e geracao dos CSVs.

Uso (a partir da raiz do projeto):
    python -I scripts/eixo1_coleta_I1_1_1_zee.py

1) Extrai o texto de cada arquivo de dados/eixo1_coleta/I1.1.1_zee/brutos/
   para dados/eixo1_coleta/I1.1.1_zee/texto/ (somente leitura; nada e executado).
   Os arquivos de brutos/ foram baixados com curl a partir das URLs listadas em fontes.csv
   (downloads publicos, sem credenciais); este script nao baixa nada.
2) Grava fontes.csv, atos.csv e series.csv em dados/eixo1_coleta/I1.1.1_zee/.

Regra da serie binaria (estado com ZEE vigente e atualizado):
- conta apenas ZEE/MacroZEE de abrangencia total do territorio estadual, normatizado
  por lei ou decreto (lista do MMA, referencia 31/12/2025);
- janela de 10 anos: o ano de conclusao/normatizacao A vale para A..A+9;
- ZEEs parciais (sub-regionais, de bioma, de rodovias) nao contam, mesmo que somados;
- MacroZEE 1:1.000.000 entra com rotulo "proxy"; ZEE 1:250.000 de abrangencia total com "exata";
- zero so onde a lista oficial (MMA, 31/12/2025) mostra ausencia de norma no periodo
  ou onde ha fonte que diz que o ato esta suspenso/vetado.
"""
import csv
import os
import re
import sys

BASE = os.path.join("dados", "eixo1_coleta", "I1.1.1_zee")
BRUTOS = os.path.join(BASE, "brutos")
TEXTO = os.path.join(BASE, "texto")
ACESSO = "2026-10-07"

# ---------------------------------------------------------------- extracao

def pdf_text(path):
    from pypdf import PdfReader  # instalado no site-packages do sistema (funciona com -I)
    reader = PdfReader(path)
    return "\n".join((p.extract_text() or "") for p in reader.pages)


def html_text(path):
    import lxml.html
    with open(path, "rb") as fh:
        tree = lxml.html.fromstring(fh.read())
    for bad in tree.xpath("//script|//style|//noscript"):
        bad.drop_tree()
    text = tree.text_content()
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    return re.sub(r"\n\s*\n+", "\n\n", text)


def extrair():
    os.makedirs(TEXTO, exist_ok=True)
    n = 0
    for name in sorted(os.listdir(BRUTOS)):
        src = os.path.join(BRUTOS, name)
        if not os.path.isfile(src):
            continue
        low = name.lower()
        try:
            if low.endswith(".pdf"):
                txt = pdf_text(src)
            elif low.endswith((".html", ".htm")):
                txt = html_text(src)
            else:
                continue
        except Exception as exc:  # registra e segue
            print("falhou:", name, exc, file=sys.stderr)
            continue
        out = os.path.join(TEXTO, os.path.splitext(name)[0] + ".txt")
        with open(out, "w", encoding="utf-8") as fh:
            fh.write(txt)
        n += 1
    print("textos extraidos:", n)

# ---------------------------------------------------------------- fontes

MMA_XLSX = ("https://dados.mma.gov.br/dataset/751bbc05-87ee-4919-8fbb-35669c89568f/"
            "resource/61c179ad-0a35-40da-b515-bca0effb9a54/download/"
            "projetos_de_zee_concluidos_no_brasil_dezembro_2025.xlsx")
MMA_PAG = ("https://dados.mma.gov.br/en/dataset/diretrizes-de-uso-e-ocupacao-em-bases-sustentaveis-"
           "por-zoneamento-ecologico-economico/resource/61c179ad-0a35-40da-b515-bca0effb9a54")
MMA_GOV = ("https://www.gov.br/mma/pt-br/assuntos/controle-ao-desmatamento-queimadas-e-ordenamento-"
           "ambiental-territorial/zoneamento-ecologico-economico")
URL_AC_1904 = "https://www.legisweb.com.br/legislacao/?id=116435"
URL_AC_4401 = "https://www.legisweb.com.br/legislacao/?id=463820"
URL_AM_3417 = "https://www.normasbrasil.com.br/norma/lei-3417-2009-am_119483.html"
URL_AM_DEC52216 = "https://www.oeco.org.br/wp-content/uploads/2025/08/DECRETO-N.o-52.216-DE-06-DE-AGOSTO-DE-2025.pdf"
URL_AM_PROJ = "https://prda.sudam.gov.br/pdf/7ebb576099d41a740c69388693d3dfd7.pdf"
URL_CPI = "https://www.climatepolicyinitiative.org/wp-content/uploads/2023/04/Anexo-Legislacao-OE-2023.pdf"
URL_AP_DEC1211 = "https://www.legisweb.com.br/legislacao/?id=491513"
URL_MA_11269 = "https://www.normasbrasil.com.br/norma/lei-11269-2020-ma_397123.html"
URL_MA_11734 = "https://www.legisweb.com.br/legislacao/?id=432080"
URL_MT_OECO = ("https://oeco.org.br/wp-content/uploads/wp-post-to-pdf-enhanced-cache/1/"
               "25727-lei-de-zoneamento-de-mato-grosso-e-suspendida-por-liminar.pdf")
URL_MT_ALMT_NOTA = "https://documentacao.socioambiental.org/noticias/anexo_noticia/20847_20110901_110508.pdf"
URL_MT_PLC18 = "https://www.al.mt.gov.br/storage/webdisco/cp/20241111154719922000.pdf"
URL_PA_6745 = "https://bancodeleis.alepa.pa.gov.br/arquivos/lei6745_2005_85193.pdf"
URL_PA_7243 = "https://bancodeleis.alepa.pa.gov.br/arquivos/lei7243_2009_63676.pdf"
URL_PA_7398 = "https://bancodeleis.alepa.pa.gov.br/arquivos/lei7398_2010_97946.pdf"
URL_PA_7604 = "https://bancodeleis.alepa.pa.gov.br/arquivos/lei7604_2012_97426.pdf"
URL_PA_1026 = "https://bancodeleis.alepa.pa.gov.br/arquivos/lei1026_2008_68447.pdf"
URL_PA_691 = "https://bancodeleis.alepa.pa.gov.br/arquivos/lei691_2007_68154.pdf"
URL_RO_LC233 = "https://faolex.fao.org/docs/pdf/bra225054.pdf"
URL_RO_PLC85 = ("https://sapl.al.ro.leg.br/media/sapl/public/documentoacessorio/2020/1388/"
                "autografo_do_projeto_de_lei_complemetar_85-2020.pdf")
URL_RO_IHU = ("https://ihu.unisinos.br/620435-rondonia-tenta-enfraquecer-protecao-ambiental-"
              "mudando-lei-do-zoneamento-no-estado")
URL_RR_323 = "https://www.legisweb.com.br/legislacao/?id=434885"
URL_TO_2656 = "https://www.legisweb.com.br/legislacao/?id=247886"
URL_TO_PL5 = "https://conexaoto.com.br/2025/08/19/deputados-repercutem-a-retirada-do-projeto-do-pl-do-zoneamento-ecologico-economico"

FONTES = [
    # url, titulo, orgao, tipo, data_documento, arquivo_local
    (MMA_GOV, "Zoneamento ecologico-economico (pagina do MMA; 'ZEE nos Estados' indisponivel no defeso eleitoral)",
     "MMA", "primaria", "n/d", "sem arquivo (WebFetch)"),
    (MMA_PAG, "Projetos de ZEE Concluidos no Brasil - pagina do dataset (Portal de Dados Abertos do MMA)",
     "MMA", "primaria", "2025-12-31 (referencia)", "brutos/MMA_dados_ZEE_concluidos.html"),
    (MMA_XLSX, "Projetos de Zoneamento Ecologico-Economico - ZEE Concluidos no Brasil - 2025 (planilha)",
     "MMA", "primaria", "2025-12-31 (referencia)", "brutos/MMA_projetos_zee_concluidos_dez2025.xlsx"),
    (URL_AC_1904, "Lei no 1.904, de 05/06/2007 (ZEE do Acre) - texto consolidado",
     "Assembleia Legislativa do Acre (texto via LegisWeb)", "secundaria", "2007-06-05", "brutos/AC_L1904_2007.html"),
    (URL_AC_4401, "Lei no 4.401, de 30/08/2024 (altera art. 40 da Lei 1.904/2007)",
     "Assembleia Legislativa do Acre (texto via LegisWeb)", "secundaria", "2024-08-30", "brutos/AC_L4401_2024.html"),
    (URL_AM_3417, "Lei no 3.417, de 31/07/2009 (MZEE do Amazonas)",
     "Assembleia Legislativa do Amazonas (texto via NormasBrasil)", "secundaria", "2009-07-31", "brutos/AM_L3417_2009.html"),
    (URL_AM_DEC52216, "Decreto no 52.216, de 06/08/2025 (reserva legal; uso do ZEE do Amazonas)",
     "Governo do Amazonas (copia via OEco)", "secundaria", "2025-08-06", "brutos/AM_Dec52216_2025.pdf"),
    (URL_AM_PROJ, "ZEE-AM - documento de projeto (formulario, JANEIRO/2024)",
     "SUDAM (hospedagem do documento)", "primaria", "2024-01", "brutos/AM_ZEE_2024_prda.pdf"),
    (URL_CPI, "Anexo Legislacao OE 2023 (lista a Lei 3.645/2011, ZEE do Purus)",
     "Climate Policy Initiative", "secundaria", "2023-04", "brutos/CPI_anexo_legislacao_OE_2023.pdf"),
    (URL_AP_DEC1211, "Decreto no 1.211, de 27/02/2026 (reducao de Reserva Legal; cita a Lei 3.208/2025) - texto via LegisWeb",
     "Governo do Amapa (texto via LegisWeb)", "secundaria", "2026-02-27", "brutos/AP_Dec1211_2026.html"),
    ("https://portalamazonia.com/amapa/nova-lei-florestas-amapa/", "Noticia sobre a Lei 3.128 (clima) do Amapa - contexto, nao e ato de ZEE",
     "Portal Amazonia", "secundaria", "n/d", "brutos/AP_noticia_lei3128.html"),
    (URL_MA_11269, "Lei no 11.269, de 28/05/2020 (ZEE do Bioma Amazonico, MA)",
     "Assembleia Legislativa do Maranhao (texto via NormasBrasil)", "secundaria", "2020-05-28", "brutos/MA_L11269_2020.html"),
    (URL_MA_11734, "Lei no 11.734, de 26/05/2022 (ZEE do Bioma Cerrado e Sistema Costeiro, MA)",
     "Assembleia Legislativa do Maranhao (texto via LegisWeb)", "secundaria", "2022-05-26", "brutos/MA_L11734_2022.html"),
    ("https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/987820/1/RelatorioPlanejamentoProd1MacroZEE.pdf",
     "Relatorio do MacroZEE do Maranhao (Embrapa) - consultado; nao confirmou o numero do decreto CEZEE",
     "Embrapa", "secundaria", "2014", "brutos/MA_relatorio_macrozee_embrapa.pdf"),
    (URL_MT_OECO, "Lei de Zoneamento de Mato Grosso e suspensa por liminar (OEco)",
     "OEco (Jornalismo Ambiental)", "secundaria", "2012-02 (ano nao visivel no trecho baixado)", "brutos/MT_oeco_liminar_zsee.pdf"),
    (URL_MT_ALMT_NOTA, "Nota de esclarecimento da Assembleia Legislativa de MT sobre o ZSEE (2011)",
     "Assembleia Legislativa de Mato Grosso (via acervo Socioambiental)", "secundaria", "2011-09", "brutos/MT_AL_doc_2011_zsei_clarif.pdf"),
    (URL_MT_PLC18, "Substitutivo Integral ao Projeto de Lei Complementar no 18/2024 (ALMT)",
     "Assembleia Legislativa de Mato Grosso", "primaria", "2024-11", "brutos/MT_AL_doc_2024_11.pdf"),
    ("https://olhardireto.com.br/noticias/minuta-de-substitutivo-integral-do-zoneamento-e-apresentada-a-sema-seplan-e-mpe",
     "Minuta de substitutivo integral do ZSEE/MT (noticia de 2009, PL 273/08)",
     "Olhar Direto", "secundaria", "2009-12-03", "brutos/MT_noticia_substitutivo.html"),
    ("https://www.al.mt.gov.br/storage/webdisco/cp/20121220115425232000.pdf",
     "Substitutivo ao PLC 2/2012 (MT) - consultado, sem relacao com ZEE (revoga LC 235/2005)",
     "Assembleia Legislativa de Mato Grosso", "primaria", "2012-12", "brutos/MT_AL_doc_2012_12.pdf"),
    ("https://www.al.mt.gov.br/storage/webdisco/cp/20250122114459562000.pdf",
     "Projeto de Lei Complementar no 3/2025 (MT) - consultado, sem relacao com ZEE",
     "Assembleia Legislativa de Mato Grosso", "primaria", "2025-01-22", "brutos/MT_AL_doc_2025_01.pdf"),
    ("https://www.al.mt.gov.br/storage/webdisco/cp/20231129162323170100.pdf",
     "Documento da ALMT (2023) sobre tecnica legislativa - consultado, sem relacao com ZEE",
     "Assembleia Legislativa de Mato Grosso", "primaria", "2023-11", "brutos/MT_AL_doc_2023_11.pdf"),
    (URL_PA_6745, "Lei no 6.745, de 06/05/2005 (Macrozoneamento Ecologico-Economico do Para)",
     "Assembleia Legislativa do Para - Banco de Leis", "primaria", "2005-05-06", "brutos/PA_lei6745_2005.pdf"),
    (URL_PA_1026, "Decreto no 1.026, de 05/06/2008 (Comite Supervisor do ZEE-PA)",
     "Assembleia Legislativa do Para - Banco de Leis", "primaria", "2008-06-05", "brutos/PA_dec1026_2008.pdf"),
    (URL_PA_691, "Decreto no 691, de 05/12/2007 (Modelo do Detalhamento do ZEE-PA)",
     "Assembleia Legislativa do Para - Banco de Leis", "primaria", "2007-12-05", "brutos/PA_lei691_2007.pdf"),
    (URL_PA_7243, "Lei no 7.243, de 09/01/2009 (ZEE Zona Oeste - BR-163 e BR-230)",
     "Assembleia Legislativa do Para - Banco de Leis", "primaria", "2009-01-09", "brutos/PA_lei7243_2009.pdf"),
    (URL_PA_7398, "Lei no 7.398, de 16/04/2010 (ZEE Zona Leste e Calha Norte)",
     "Assembleia Legislativa do Para - Banco de Leis", "primaria", "2010-04-16", "brutos/PA_lei7398_2010.pdf"),
    (URL_PA_7604, "Lei no 7.604, de 16/03/2012 (altera a Lei 7.398/2010)",
     "Assembleia Legislativa do Para - Banco de Leis", "primaria", "2012-03-16", "brutos/PA_lei7604_2012.pdf"),
    (URL_RO_LC233, "Lei Complementar no 233, de 06/06/2000 (ZSEE de Rondonia) - texto (LeisEstaduais.com.br via FAOLEX)",
     "FAO/FAOLEX (texto de LeisEstaduais.com.br)", "secundaria", "2000-06-06", "brutos/RO_faolex_bra225054.pdf"),
    ("https://leap.unep.org/en/countries/br/national-legislation/complementary-law-no-233-providing-socioeconomic-ecological",
     "Registro da LC 233/2000 (LEAP/UNEP) - consultado",
     "UNEP LEAP", "secundaria", "2000-06-06", "brutos/RO_leap_LC233.html"),
    (URL_RO_PLC85, "Autografo de Lei Complementar no 085/2020 (Rondonia) - dispoe sobre o ZSEE e revoga a LC 233/2000",
     "Assembleia Legislativa de Rondonia (SAPL)", "primaria", "2021-09 (aprovacao; data exata nao visivel no autografo)",
     "brutos/RO_PLC85_2020_autografo.pdf"),
    (URL_RO_IHU, "Reportagem sobre a mudanca do zoneamento de Rondonia (veto de out/2021; grupo de trabalho DOE 27/06/2022)",
     "IHU / Unisinos (republicacao de OEco)", "secundaria", "2022-07-16", "brutos/RO_noticia_ihu_2022.html"),
    (URL_RR_323, "Lei Complementar no 323, de 02/08/2022 (ZEE de Roraima)",
     "Assembleia Legislativa de Roraima (texto via LegisWeb)", "secundaria", "2022-08-02", "brutos/RR_LC323_2022.html"),
    (URL_TO_2656, "Lei no 2.656, de 06/12/2012 (ZEE do Tocantins) - texto via LegisWeb",
     "Assembleia Legislativa do Tocantins (texto via LegisWeb)", "secundaria", "2012-12-06", "brutos/TO_L2656_2012.html"),
    (URL_TO_PL5, "Deputados repercutem a retirada do PL do ZEE do Tocantins (Conexao Tocantins)",
     "Portal Conexao Tocantins", "secundaria", "2025-08-19", "brutos/TO_retirada_PL5_2025.html"),
]

# ---------------------------------------------------------------- atos
# codigo, uf, tipo_ato, numero, data, assunto, situacao, url, trecho, confianca
ATOS = [
    # Acre
    ("I1.1.1_AC_01", "AC", "lei", "1.904", "2007-06-05",
     "ZEE do Acre - Fase II (escala 1:250.000; Mapa de Gestao Territorial)", "vigente", URL_AC_1904,
     "Art. 1º Fica instituído o Zoneamento Ecológico-Econômico do Estado do Acre, sintetizado através do Mapa de Gestão Territorial constante do Anexo I desta lei", "alta"),
    ("I1.1.1_AC_02", "AC", "lei (vinculacao)", "1.904 (art. 3º, par. unico)", "2007-06-05",
     "Vinculacao generica: indicacoes do ZEE vinculam politicas, programas, projetos e investimentos", "vigente", URL_AC_1904,
     "As indicações e recomendações constantes do ZEE vinculam todas as políticas, programas, projetos e investimentos, públicos ou privados", "alta"),
    ("I1.1.1_AC_03", "AC", "lei (alteracao)", "2.006", "2008-06-09",
     "Redacao do art. 32 (alteracao do ZEE segue prazo da legislacao federal)", "vigente", URL_AC_1904,
     "A alteração do ZEE, bem como mudanças nos limites das zonas e indicação de novas diretrizes gerais e específicas, ocorrerá no prazo estipulado pela legislação federal", "media"),
    ("I1.1.1_AC_04", "AC", "lei (alteracao)", "4.395", "2024-08-19",
     "Redacao do art. 40 (regularizacao de imoveis rurais - Reserva Legal)", "vigente", URL_AC_1904,
     "A regularização dos imóveis rurais, para fins de recomposição da RL, poderá ser realizada por meio de uma das seguintes modalidades", "media"),
    ("I1.1.1_AC_05", "AC", "lei (alteracao)", "4.401", "2024-08-30",
     "Inclui inciso X no art. 40: reducao da RL para ate 50% na Zona 1 (compensacao ambiental), citando o ZEE", "vigente", URL_AC_4401,
     "X - reduzir para até cinquenta por cento os percentuais de Reserva Legal - RL, para fins de compensação ambiental, nas propriedades incluídas na Zona 1", "alta"),
    ("I1.1.1_AC_06", "AC", "decreto", "503", "1999-04-06",
     "Programa Estadual de ZEE e Comissao Estadual do ZEE (ZEE Fase I, 1:1.000.000; sem normatizacao)", "desconhecido",
     MMA_XLSX, "O decreto estadual nº 503, de 06 de abril de 1999, criou o Programa Estadual de ZEE e instituiu a Comissão Estadual do ZEE.", "media"),
    # Amazonas
    ("I1.1.1_AM_01", "AM", "lei", "3.417", "2009-07-31",
     "Macrozoneamento Ecologico-Economico do Amazonas (MZEE, 1:1.000.000); ZEE 1:250.000 previsto em 3 anos", "vigente", URL_AM_3417,
     "Institui o Macrozoneamento Ecológico-Econômico do Estado do Amazonas - MZEE.", "alta"),
    ("I1.1.1_AM_02", "AM", "lei", "3.645", "2011-08-08",
     "ZEE da Sub-regiao do Purus (1:250.000; area aprox. 250.414 km2; parcial)", "vigente", URL_CPI,
     "Lei nº 3645, de 08 de agosto de 2011 – Institui o Zoneamento Ecológico econômico da Sub-região do Purus no Estado do Amazonas.", "media"),
    ("I1.1.1_AM_03", "AM", "decreto", "52.216", "2025-08-06",
     "Reducao de RL para ate 50% em imovel dentro de area 'apta' no ZEE do Amazonas (regularizacao ambiental)", "vigente", URL_AM_DEC52216,
     "área classificada, no Zoneamento Ecológico-Econômico (ZEE) do Estado do Amazonas, como apta à redução de reserva legal", "alta"),
    ("I1.1.1_AM_04", "AM", "projeto (documento)", "s/n", "2024-01",
     "Formulario de projeto 'ZEE-AM' (nao e ato normativo); campos de proponente, metas e investimento", "em_elaboracao", URL_AM_PROJ,
     "Zoneamento Ecológico Econômico do Estado do Amazonas-ZEE-AM JANEIRO/2024 Alçada do Projeto Federal Estadual Outro X", "media"),
    ("I1.1.1_AM_05", "AM", "decreto", "36.600", "2015-12-30",
     "Renomeia e reorganiza a Comissao Estadual de ZEE (governanca)", "desconhecido", MMA_XLSX,
     "O decreto estadual nº 36.600, de 30 de dezembro de 2015, renomeou e reorganizou a Comissão Estadual de ZEE.", "media"),
    # Amapa
    ("I1.1.1_AP_01", "AP", "lei", "3.208", "2025-04-24",
     "ZEE do Estado do Amapa (1:250.000; validacao federal: nao, segundo MMA)", "vigente", URL_AP_DEC1211,
     "Zoneamento Ecológico-Econômico do Estado do Amapá - ZEE/AP, aprovado por meio da Lei nº 3.208, de 24 de abril de 2025", "alta"),
    ("I1.1.1_AP_02", "AP", "lei (cit. pela planilha MMA)", "3.208", "2025-04-24",
     "Registro federal: normatizacao do ZEE/AP (MMA, ref. 31/12/2025)", "vigente", MMA_XLSX,
     "sim (lei estadual nº 3.208, de 24 de abril de 2025)", "alta"),
    ("I1.1.1_AP_03", "AP", "decreto", "1.211", "2026-02-27",
     "Reducao de RL para ate 50% em areas de floresta (base no ZEE/AP e no art. 12, par. 5º, Lei 12.651/2012)", "vigente", URL_AP_DEC1211,
     "Fica autorizada a redução do percentual mínimo de Reserva Legal (RL) para até 50% da área dos imóveis rurais situados em áreas de floresta no Estado do Amapá", "alta"),
    ("I1.1.1_AP_04", "AP", "lei", "919", "2005-08-18",
     "Ordenamento territorial do Amapa (MMA: nao normatizou o ZEE da Area Sul)", "desconhecido", MMA_XLSX,
     "a lei estadual nº 919, de 18 de agosto de 2005, dispôs sobre o ordenamento territorial do Estado do Amapá", "media"),
    ("I1.1.1_AP_05", "AP", "decreto", "277", "1991-12-18",
     "Comissao Estadual do ZEE (governanca; ZEE da Area Sul sem normatizacao)", "desconhecido", MMA_XLSX,
     "O decreto estadual nº 277, de 18 de dezembro de 1991, instituiu a Comissão Estadual do ZEE", "media"),
    # Maranhao
    ("I1.1.1_MA_01", "MA", "lei", "10.316", "2015-09-17",
     "MacroZEE do Maranhao (1:1.000.000; abrangencia estadual; conforme MMA)", "vigente", MMA_XLSX,
     "sim (lei estadual nº 10.316, de 17 de setembro de 2015)", "media"),
    ("I1.1.1_MA_02", "MA", "decreto", "29.359", "2013-09-11",
     "Comissao Estadual de ZEE e Comite Tecnico-Cientifico (governanca); numero diverge do Embrapa (29.358)", "desconhecido", MMA_XLSX,
     "O decreto estadual n° 29.359, de 11 de setembro de 2013, instituiu a Comissão Estadual de ZEE e o Comitê Técnico-Científico do ZEE do Estado do Maranhão.", "baixa"),
    ("I1.1.1_MA_03", "MA", "lei", "11.269", "2020-05-28",
     "ZEE do Bioma Amazonico do Maranhao (1:250.000; parcial - bioma)", "vigente", URL_MA_11269,
     "Fica instituído, nos termos desta Lei, o Zoneamento Ecológico-Econômico do Bioma Amazônico do Estado do Maranhão", "alta"),
    ("I1.1.1_MA_04", "MA", "lei", "11.734", "2022-05-26",
     "ZEE do Bioma Cerrado e Sistema Costeiro do Maranhao (1:250.000; parcial - bioma)", "vigente", URL_MA_11734,
     "Fica instituído, nos termos desta Lei, o Zoneamento Ecológico-Econômico do Bioma Cerrado e Sistema Costeiro do Estado do Maranhão", "alta"),
    # Mato Grosso
    ("I1.1.1_MT_01", "MT", "lei", "5.993", "1992-06-03",
     "MacroZEE / politica de ordenamento territorial (1:1.500.000 segundo MMA)", "desconhecido", MMA_XLSX,
     "sim (lei estadual nº 5.993, de 03 de junho de 1992)", "media"),
    ("I1.1.1_MT_02", "MT", "lei", "9.523", "2011-04-20",
     "ZSEE/MT (1:250.000; abrangencia estadual); efeitos suspensos por liminar", "desconhecido", URL_MT_OECO,
     "Em abril de 2011, o governador do Mato Grosso, Silval Barbosa, sancionou o substitutivo 3 que deu origem à Lei Estadual nº 9.523/2011.", "media"),
    ("I1.1.1_MT_03", "MT", "lei (nota oficial da ALMT)", "9.523", "2011-04",
     "Nota da ALMT: ZSEE aprovado pela Casa e sancionado pelo Governo", "vigente", URL_MT_ALMT_NOTA,
     "Lei do Zoneamento Socioeconômico Ecológico (ZSEE), aprovado por esta Casa de Leis e sancionada pelo Governo do Estado", "media"),
    ("I1.1.1_MT_04", "MT", "lei (MMA: suspensao judicial)", "9.523", "2011-04-20",
     "Registro federal: ZSEE/MT com 'suspensão judicial' (ref. 31/12/2025)", "desconhecido", MMA_XLSX,
     "sim (lei estadual nº 9.523, de 20 de abril de 2011) - suspensão judicial", "alta"),
    ("I1.1.1_MT_05", "MT", "projeto de lei complementar", "18/2024 (substitutivo)", "2024-11",
     "Altera o art. 62 do Codigo Ambiental; cita o ZSEE como condicao para o mapa de vegetacao (sem ZSEE aprovado, usa o IBGE)", "em_elaboracao", URL_MT_PLC18,
     "enquanto um destes não estiver concluído e aprovado, deverá ser considerado o Mapa de Vegetação do IBGE", "media"),
    ("I1.1.1_MT_06", "MT", "decreto", "469", "2016-03-31",
     "Comissao Estadual do Zoneamento Socioeconomico Ecologico - CEZSEE (governanca)", "desconhecido", MMA_XLSX,
     "O decreto estadual nº 469, de 31 de março de 2016, instituiu a Comissão Estadual do Zoneamento Socioeconômico Ecológico - CEZSEE do Estado do Mato Grosso.", "media"),
    # Para
    ("I1.1.1_PA_01", "PA", "lei", "6.745", "2005-05-06",
     "Macrozoneamento Ecologico-Economico do Para (1:1.000.000; abrangencia estadual; DOE 30.435 de 12/05/2005)", "vigente", URL_PA_6745,
     "Institui o Macrozoneamento Ecológico -Econômico do Estado do Pará e dá outras providências.", "alta"),
    ("I1.1.1_PA_02", "PA", "decreto", "691", "2007-12-05",
     "Modelo do detalhamento do ZEE do Para (DOE 31.062 de 06/12/2007)", "desconhecido", URL_PA_691,
     "Institui o Modelo do Detalhamento do Zoneamento Ecológico -Econômico do Estado do Pará.", "alta"),
    ("I1.1.1_PA_03", "PA", "lei", "7.243", "2009-01-09",
     "ZEE da Zona Oeste (BR-163 e BR-230; 1:250.000; parcial; DOE 31.341 de 20/01/2009)", "vigente", URL_PA_7243,
     "Art. 1º Fica aprovado o ZEE da área de influência das Rodovias Cuiabá/Santarém e Transamazônica, no Estado do Pará", "alta"),
    ("I1.1.1_PA_04", "PA", "decreto", "1.026", "2008-06-05",
     "Comite Supervisor, Comite Tecnico-Cientifico e Grupo de Trabalho do ZEE-PA (DOE 31.184 de 06/06/2008)", "desconhecido", URL_PA_1026,
     "Institui o Comitê Supervisor do Zoneamento Ecológico -Econômico do Estado do Pará (ZEE -PA), o Comitê Técnico Científico e o Grupo de Trabalho", "alta"),
    ("I1.1.1_PA_05", "PA", "lei", "7.398", "2010-04-16",
     "ZEE da Zona Leste e Calha Norte (1:250.000; parcial; DOE 31.650 de 22/04/2010)", "vigente", URL_PA_7398,
     "Art. 1º Fica aprovado o ZEE da Zona Leste e Calha Norte, na escala de execução de 1:250.000", "alta"),
    ("I1.1.1_PA_06", "PA", "lei (alteracao)", "7.604", "2012-03-16",
     "Altera e revoga dispositivos da Lei 7.398/2010 (DOE 32.119 de 19/03/2012); licenciamento de imoveis rurais deve ser revisto ao mapa", "vigente", URL_PA_7604,
     "Altera e revoga dispositivos da Lei nº 7.398, de 16 de abril de 2010", "alta"),
    # Rondonia
    ("I1.1.1_RO_01", "RO", "lei complementar", "52", "1991-12-20",
     "ZSEE de Rondonia - 1a aproximacao (1:1.000.000; MMA)", "substituido", MMA_XLSX,
     "sim (lei complementar nº 52, de 20 de dezembro de 1991)", "media"),
    ("I1.1.1_RO_02", "RO", "lei complementar", "233", "2000-06-06",
     "ZSEE de Rondonia - 2a aproximacao (1:250.000; zonas 1, 2 e 3); base vigente segundo MMA", "vigente", URL_RO_LC233,
     "DISPÕE SOBRE O ZONEAMENTO SOCIOECONÔMICO-ECOLÓGICO DO ESTADO DE RONDÔNIA - ZSEE E DÁ OUTRAS PROVIDÊNCIAS.", "alta"),
    ("I1.1.1_RO_03", "RO", "lei complementar (retificacao)", "312", "2005-05-06",
     "Retifica a LC 233/2000 (ano de conclusao da 2a aproximacao = 2005, segundo MMA)", "vigente", MMA_XLSX,
     "lei complementar estadual nº 233, de 06 de junho de 2000, retificada pela lei complementar estadual nº 312, de 06 de maio de 2005", "media"),
    ("I1.1.1_RO_04", "RO", "projeto de lei complementar (autografo)", "85/2020", "2021-09-28",
     "PLC que revogaria a LC 233/2000 e instituiria novo ZSEE; aprovado pela ALE-RO", "desconhecido", URL_RO_PLC85,
     "Dispõe sobre o Zoneamento Socioeconômico-Ecológico do Estado de Rondônia e revoga a Lei", "media"),
    ("I1.1.1_RO_05", "RO", "veto total", "VT 127/2021", "2021-10 (aprox.)",
     "Veto total ao PLC 85/2020; veto mantido em sessao de 15/03/2022 (MMA)", "desconhecido", MMA_XLSX,
     "vetado na integra pelo Governador (VT 127/2021. O veto foi mantido na sessão ordinária do dia 15/03/2022)", "media"),
    ("I1.1.1_RO_06", "RO", "ato administrativo (grupo de trabalho)", "s/n", "2022-06-27",
     "Grupo de trabalho na SEDAM para propor novo texto do ZSEE (publicado no DOE)", "desconhecido", URL_RO_IHU,
     "A criação do grupo foi publicada no Diário Oficial no dia 27 de junho", "media"),
    ("I1.1.1_RO_07", "RO", "decreto", "21.906", "2017-05-02",
     "Comissao Estadual do Zoneamento Socioeconomico-Ecologico (governanca)", "desconhecido", MMA_XLSX,
     "O decreto estadual nº 21.906, de 02 de maio de 2017, instituiu a Comissão Estadual do Zoneamento Socioeconômico-Ecológico do Estado de Rondônia.", "media"),
    # Roraima
    ("I1.1.1_RR_01", "RR", "lei complementar", "323", "2022-08-02",
     "ZEE de Roraima (1:250.000; Mapa de Gestao Territorial; uso no licenciamento)", "vigente", URL_RR_323,
     "Art. 1º Fica instituído o Zoneamento Ecológico-Econômico do Estado de Roraima (ZEE-RR), na escala geográfica de 1:250.000", "alta"),
    ("I1.1.1_RR_02", "RR", "lei complementar (licenciamento)", "323 (art. 33)", "2022-08-02",
     "Uso no licenciamento: orgao ambiental deve observar as indicacoes de uso da zona; ZEE nao e documento unico (art. 7º)", "vigente", URL_RR_323,
     "No processo de licenciamento ambiental, o órgão ambiental deverá observar as indicações de uso da zona ou subzona definidas no mapa de gestão territorial", "alta"),
    ("I1.1.1_RR_03", "RR", "decreto", "6.817-E", "2005",
     "Comite Gestor de Geotecnologia, Cartografia e Ordenamento Territorial (governanca)", "desconhecido", MMA_XLSX,
     "O decreto estadual nº 6.817-E, de 2005, dispõe sobre o Comitê Gestor do Programa de Geotecnologia, Cartografia e Ordenamento Territorial do Estado de Roraima", "media"),
    # Tocantins
    ("I1.1.1_TO_01", "TO", "lei", "2.656", "2012-12-06",
     "ZEE do Norte do Tocantins (Bico do Papagaio; 1:250.000; parcial) - texto fala em 'Norte do Estado'", "vigente", URL_TO_2656,
     "Art. 1º. É instituído o Zoneamento Ecológico-Econômico do Estado do Tocantins - ZEE, na conformidade do Plano de Zoneamento", "alta"),
    ("I1.1.1_TO_02", "TO", "lei (prazo)", "2.656 (art. 4º)", "2012-12-06",
     "Prazo de 18 meses para complementar e atualizar o ZEE por projeto de lei (prazo vencido)", "vigente", URL_TO_2656,
     "Incumbe ao Chefe do Poder Executivo promover a complementação e a atualização do ZEE, em dezoito meses, a partir da vigência desta Lei", "alta"),
    ("I1.1.1_TO_03", "TO", "decreto", "5.559", "2017-01-09",
     "Comissao Estadual de ZEE (CEZEE) (governanca)", "desconhecido", MMA_XLSX,
     "O decreto nº 5.559, de 09 de janeiro de 2017, instituiu a Comissão Estadual de Zoneamento Ecológico-Econômico (CEZEE).", "media"),
    ("I1.1.1_TO_04", "TO", "projeto de lei (retirado)", "PL 5/2025", "2025-08-19",
     "PL do ZEE do Estado do Tocantins retirado pelo governador da Aleto (ZEE do Estado: normatizacao 'nao' no MMA)", "desconhecido", URL_TO_PL5,
     "A decisão do Governo do Estado de retirar da Assembleia Legislativa do Tocantins (Aleto) o Projeto de Lei do Zoneamento Ecológico-Econômico (ZEE)", "media"),
    # Federal (Amazonia Legal)
    ("I1.1.1_AL_01", "AL", "decreto federal (MacroZEE)", "7.378", "2010-12-01",
     "MacroZEE da Amazonia Legal (1:1.000.000; federal; base para os ZEEs estaduais)", "vigente", MMA_XLSX,
     "sim (decreto federal nº 7.378, de 1º de dezembro de 2010)", "alta"),
]

# ---------------------------------------------------------------- series

ANOS = list(range(2000, 2026))  # 2000..2025 (snapshot da lista MMA em 31/12/2025)
SERIE_BIN = "estado com ZEE estadual de abrangencia total vigente e atualizado nos ultimos 10 anos (1/0)"
SERIE_AL = "AL: numero de estados com ZEE estadual de abrangencia total vigente e atualizado"

# UF: (inicio, fim, rotulo, fonte_url, nota) - janela A..A+9 (inclusive), conforme a regra do topo
JANELAS = {
    "AC": [(2007, 2016, "exata", URL_AC_1904,
            "Lei 1.904/2007 (ZEE Fase II, 1:250.000); unica normatizacao estadual segundo MMA (ref. 31/12/2025)")],
    "AM": [(2009, 2018, "proxy", URL_AM_3417,
            "Lei 3.417/2009 (MacroZEE 1:1.000.000 - proxy); ZEE do Purus (Lei 3.645/2011) e parcial e nao conta")],
    "AP": [(2025, 2025, "exata", URL_AP_DEC1211,
            "Lei 3.208/2025 (ZEE/AP 1:250.000) citada no Decreto 1.211/2026; MMA ref. 31/12/2025")],
    "MA": [(2015, 2024, "proxy", MMA_XLSX,
            "MacroZEE Lei 10.316/2015 (1:1.000.000 - proxy, segundo MMA); ZEEs de bioma (Leis 11.269/2020 e 11.734/2022) sao parciais e nao contam")],
    "MT": [(1992, 2001, "proxy", MMA_XLSX,
            "MacroZEE Lei 5.993/1992 (proxy, segundo MMA)"),
           (2011, 2011, "exata", URL_MT_OECO,
            "Lei 9.523/2011 (ZSEE 1:250.000); efeitos suspensos por liminar em 2012 (OEco) e 'suspensao judicial' no MMA")],
    "PA": [(2005, 2014, "proxy", URL_PA_6745,
            "Lei 6.745/2005 (MacroZEE 1:1.000.000 - proxy); ZEEs parciais de 2009/2010 nao contam")],
    "RO": [(2000, 2014, "exata", URL_RO_LC233,
            "LC 233/2000 (ZSEE 2a aproximacao 1:250.000), retificada pela LC 312/2005 (janela estendida a 2014 por MMA: conclusao 2005); PLC 85/2020 vetado")],
    "RR": [(2022, 2025, "exata", URL_RR_323,
            "LC 323/2022 (ZEE-RR 1:250.000)")],
    "TO": [],
}

NOTA_ZERO = {
    "AC": "sem ZEE estadual normatizado na janela (ultima normatizacao: Lei 1.904/2007; lista MMA ref. 31/12/2025)",
    "AM": "sem MacroZEE/ZEE de abrangencia total na janela (MacroZEE 2009 + janela de 10 anos; Purus parcial)",
    "AP": "sem ZEE estadual normatizado antes de 2025 (lista MMA ref. 31/12/2025 so registra Lei 3.208/2025 como normatizacao estadual)",
    "MA": "sem MacroZEE ou ZEE estadual na janela (MacroZEE 2015 vale ate 2024; ZEEs de bioma sao parciais)",
    "MT": "ZSEE/MT com efeitos suspensos por liminar (2012, OEco) e 'suspensao judicial' no MMA ref. 31/12/2025; sem outra normatizacao na janela",
    "PA": "sem MacroZEE/ZEE de abrangencia total na janela (MacroZEE 2005 vale ate 2014; ZEEs parciais nao contam)",
    "RO": "LC 233/2000 fora da janela (retificacao 2005) e PLC 85/2020 vetado integralmente (VT 127/2021, mantido em 15/03/2022)",
    "RR": "sem ZEE estadual normatizado antes de 2022 (primeira normatizacao: LC 323/2022, lista MMA)",
    "TO": "ZEE do Estado do Tocantins nao normatizado (MMA: 'normatizacao: nao'); Lei 2.656/2012 e parcial (Norte)",
}


PRIMEIRO_ATO = {"AC": 2007, "AM": 2009, "AP": 2025, "MA": 2015, "MT": 1992,
                "PA": 2005, "RO": 2000, "RR": 2022, "TO": 9999}

NOTA_ANTES = {
    "AC": "antes da primeira normatizacao de ZEE estadual (Lei 1.904/2007; lista MMA ref. 31/12/2025)",
    "AM": "antes do MacroZEE do Amazonas (Lei 3.417/2009; lista MMA)",
    "AP": "antes da primeira normatizacao estadual de ZEE (Lei 3.208/2025; lista MMA)",
    "MA": "antes do primeiro MacroZEE normatizado (Lei 10.316/2015; lista MMA)",
    "MT": "antes do primeiro ato de ZEE estadual na janela (MacroZEE 1992 vale ate 2001)",
    "PA": "antes do MacroZEE do Para (Lei 6.745/2005; lista MMA)",
    "RO": "antes de qualquer ZEE estadual normatizado na lista MMA",
    "RR": "antes da primeira normatizacao de ZEE estadual (LC 323/2022; lista MMA)",
    "TO": "nenhum ZEE de abrangencia total normatizado (lista MMA ref. 31/12/2025)",
}


def valor_uf(uf, ano):
    for ini, fim, rot, url, nota in JANELAS[uf]:
        if ini <= ano <= fim:
            return 1, rot, url, nota
    nota = NOTA_ANTES[uf] if ano < PRIMEIRO_ATO[uf] else NOTA_ZERO[uf]
    return 0, "exata", (URL_MT_OECO if uf == "MT" else MMA_XLSX), nota


def build_series():
    rows = []
    ufs = ["AC", "AM", "AP", "MA", "MT", "PA", "RO", "RR", "TO"]
    tot = {ano: 0 for ano in ANOS}
    for uf in ufs:
        for ano in ANOS:
            v, rot, url, nota = valor_uf(uf, ano)
            tot[ano] += v
            rows.append(["I1.1.1", SERIE_BIN, rot, uf, ano, v, "1/0", url, nota])
    for ano in ANOS:
        rows.append(["I1.1.1", SERIE_AL, "proxy", "AL", ano, tot[ano], "estados",
                     MMA_XLSX,
                     "soma dos 9 UFs (AL = Amazonia Legal); rotulo proxy porque inclui MacroZEE 1:1.000.000 (AM, MA, MT, PA)"])
    return rows

# ---------------------------------------------------------------- escrita

def escrever_csv(nome, cabecalho, linhas):
    path = os.path.join(BASE, nome)
    with open(path, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh, lineterminator="\n")
        w.writerow(cabecalho)
        for l in linhas:
            w.writerow(l)
    print("gravado:", path, len(linhas), "linhas")


def gravar_tudo():
    escrever_csv("fontes.csv",
                 ["url", "titulo", "orgao", "tipo", "data_documento", "acessado_em", "arquivo_local"],
                 [[u, t, o, tp, d, ACESSO, a] for (u, t, o, tp, d, a) in FONTES])
    for codigo, uf, tipo, num, data, assunto, sit, url, trecho, conf in ATOS:
        n = len(trecho.split())
        if n > 30:
            print("AVISO trecho >30 palavras:", codigo, n)
    escrever_csv("atos.csv",
                 ["codigo", "uf", "tipo_ato", "numero", "data", "assunto", "situacao", "url", "trecho", "confianca"],
                 [[c, uf, tp, num, d, a, s, u, tr, cf] for (c, uf, tp, num, d, a, s, u, tr, cf) in ATOS])
    escrever_csv("series.csv",
                 ["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"],
                 build_series())


def main():
    extrair()
    gravar_tudo()
    return 0


if __name__ == "__main__":
    sys.exit(main())
