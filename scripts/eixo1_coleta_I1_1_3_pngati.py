# -*- coding: utf-8 -*-
"""Tarefa I1.1.3_pngati: instrumentos de cooperacao tecnica estado-Uniao para PNGATI/PNGTAQ.

Baixa as fontes publicas usadas (somente se ainda nao estiverem em brutos/),
confere que cada trecho citado aparece no texto da propria fonte e grava
series.csv, fontes.csv e atos.csv com o modulo csv. O achados.md e escrito a parte.

Rodar da raiz do projeto:  python -I scripts/eixo1_coleta_I1_1_3_pngati.py
"""
import csv
import os
import re
import sys
import urllib.request

import lxml.html as H
import pypdf

RAIZ_DADOS = os.path.join("dados", "eixo1_coleta", "I1.1.3_pngati")
BRUTOS = os.path.join(RAIZ_DADOS, "brutos")
ACESSO = "2026-10-07"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

FUNAI = "https://www.gov.br/funai/pt-br/acesso-a-informacao/acordos-e-parcerias/"
URL_FUNAI_INDEX = FUNAI.rstrip("/")
URL_EMATER_PDF = FUNAI + "acordo-de-cooperacao-tecnica-funai-e-emater-ro.pdf/@@display-file/file"
URL_EMATER_PORTAL = FUNAI + "acordo-de-cooperacao-tecnica-funai-e-emater-ro.pdf"
URL_UNIVAJA = FUNAI + "acordo-de-cooperacao-funai-e-uniao-dos-povos-indigenas-do-vale-do-javari-univaja/@@display-file/file"
URL_D7747 = "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/decreto/d7747.htm"
URL_D11512 = "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/D11512.htm"
URL_D11786 = "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/decreto/D11786.htm"
URL_PA_PROTOCOLO = ("https://portalamazonia.com/politica/protocolo-de-intencoes-e-assinado-"
                    "para-avancar-demarcacao-de-terras-indigenas/")
URL_MA_TJMA = ("https://www.tjma.jus.br/midia/portal/noticia/515246/"
               "tjma-participa-de-evento-sobre-governanca-em-terras-indigenas")
URL_TO_AQUILOMBA = ("https://agenciagov.ebc.com.br/noticias/202403/"
                    "ministerio-da-igualdade-racial-e-governo-do-tocantins-lancam-o-programa-aquilomba-tocantins")
URL_PA_SEMAS = "https://www.semas.pa.gov.br/legislacao/files/pdf/547309.pdf"
URL_CGU_PNGTAQ = ("https://www.gov.br/igualdaderacial/pt-br/acesso-a-informacao/auditorias/"
                  "RelatriodeAvaliao1566075GovernanadaPNGTAQ.pdf")
URL_ATA_VII_CG = ("https://www.gov.br/igualdaderacial/pt-br/assuntos/programas-e-projetos/"
                  "politica-nacional-de-gestao-territorial-e-ambiental-quilombola-pngtaq/comite-gestor/"
                  "ata-da-vii-reuniao-cg-pngtaq.pdf")
URL_RG_FUNAI_2022 = "https://www.gov.br/funai/pt-br/acesso-a-informacao/auditorias/Relatorio_Gestao_Funai_2022.pdf/@@download/file"
URL_AGENCIA_PNGTAQ = "https://agenciagov.ebc.com.br/noticias/202406/proteger-territorios-quilombolas-e-preservar-o-meio-ambiente"
URL_CM_ACRE = ("https://digital.correiodamanha.com.br/jornalcorreiodamanha/2026/02/26/000883/"
               "pdf/2602df_cmanha29.pdf")
URL_TO_ALMAPRETA = ("https://almapreta.com.br/sessao/politica/"
                    "aquilomba-tocantins-mir-e-governo-estadual-lancam-programa-com-foco-em-quilombos/")

# (url, nome do arquivo em brutos/)
DOWNLOADS = [
    (URL_CGU_PNGTAQ, "cgu_pngtaq_avaliacao.pdf"),
    (URL_ATA_VII_CG, "pngtaq_ata_vii_cg.pdf"),
    (URL_RG_FUNAI_2022, "funai_relatorio_gestao_2022.pdf"),
    (URL_AGENCIA_PNGTAQ, "agenciagov_pngtaq_adesao_202406.html"),
    (URL_CM_ACRE, "cmanha_acre_2602.pdf"),
    (URL_TO_ALMAPRETA, "almapreta_aquilomba_TO.html"),
    (URL_D7747, "planalto_d7747.htm"),
    (URL_D11512, "planalto_D11512.htm"),
    (URL_D11786, "planalto_D11786.htm"),
    (URL_EMATER_PDF, "funai_emater_ro_acordo.pdf"),
    (URL_EMATER_PORTAL, "funai_portal_acordo_emater_ro.html"),
    (URL_FUNAI_INDEX, "funai_acordos_e_parcerias.html"),
    (URL_UNIVAJA, "funai_univaja.pdf"),
    (URL_PA_PROTOCOLO, "portalamazonia_protocolo_PA.html"),
    (URL_MA_TJMA, "tjma_governanca_terras_indigenas.html"),
    (URL_TO_AQUILOMBA, "agenciagov_aquilomba_TO.html"),
    (URL_PA_SEMAS, "semas_pa_547309_pagina_inicial.html"),
]

# Fontes abertas. arq = nome do arquivo em brutos/ (o caminho gravado sai relativo a raiz).
FONTES = [
    dict(url=URL_D7747, arq="planalto_d7747.htm", tipo="primaria", data="2012-06-05",
         titulo="Decreto nº 7.747, de 5 de junho de 2012: institui a PNGATI",
         orgao="Presidência da República (Planalto)"),
    dict(url=URL_D11512, arq="planalto_D11512.htm", tipo="primaria", data="2023-04-28",
         titulo="Decreto nº 11.512, de 28 de abril de 2023: Comitê Gestor da PNGATI no âmbito do MPI; revoga arts. 6º a 8º do Decreto 7.747/2012",
         orgao="Presidência da República (Planalto)"),
    dict(url=URL_D11786, arq="planalto_D11786.htm", tipo="primaria", data="2023-11-20",
         titulo="Decreto nº 11.786, de 20 de novembro de 2023: institui a PNGTAQ e seu Comitê Gestor",
         orgao="Presidência da República (Planalto)"),
    dict(url=URL_EMATER_PDF, arq="funai_emater_ro_acordo.pdf", tipo="primaria", data="2026-04-24",
         titulo="Acordo de Cooperação Técnica Funai e Emater-RO (SEI 10115290; processo 08760.000252/2018-86)",
         orgao="FUNAI (MPI) e EMATER-RO"),
    dict(url=URL_EMATER_PORTAL, arq="funai_portal_acordo_emater_ro.html", tipo="primaria", data="",
         titulo="Página do portal FUNAI do ACT Funai e Emater-RO (metadados de publicação: criado em 04/05/2026)",
         orgao="FUNAI"),
    dict(url=URL_UNIVAJA, arq="funai_univaja.pdf", tipo="primaria", data="",
         titulo="Acordo de Cooperação Funai e União dos Povos Indígenas do Vale do Javari (Univaja), processo 08620.002457/2025-20",
         orgao="FUNAI (MPI) e Univaja (entidade civil)"),
    dict(url=URL_FUNAI_INDEX, arq="funai_acordos_e_parcerias.html", tipo="primaria", data="",
         titulo="Acesso à informação: Acordos e parcerias (índice da FUNAI; a lista não aparece no HTML estático)",
         orgao="FUNAI"),
    dict(url=URL_PA_PROTOCOLO, arq="portalamazonia_protocolo_PA.html", tipo="secundaria", data="2024-04-27",
         titulo="Protocolo de intenções é assinado para avançar demarcação de terras indígenas (reportagem)",
         orgao="Portal Amazônia (Rede Amazônica)"),
    dict(url=URL_MA_TJMA, arq="tjma_governanca_terras_indigenas.html", tipo="primaria", data="2024-09-23",
         titulo="TJMA participa de evento sobre governança em terras indígenas",
         orgao="Tribunal de Justiça do Maranhão (Ascom/TJMA)"),
    dict(url=URL_TO_AQUILOMBA, arq="agenciagov_aquilomba_TO.html", tipo="primaria", data="",
         titulo="MIR e Governo do Tocantins lançam o programa Aquilomba Tocantins (página indisponível: aviso de legislação eleitoral)",
         orgao="EBC / Agência Gov"),
    dict(url=URL_PA_SEMAS, arq="semas_pa_547309_pagina_inicial.html", tipo="primaria", data="",
         titulo="SEMAS-PA: o endereço do PDF da Portaria 57/2024 retornou a página inicial da SEMAS (portaria não obtida)",
         orgao="SEMAS-PA"),
    dict(url=URL_CGU_PNGTAQ, arq="cgu_pngtaq_avaliacao.pdf", tipo="primaria", data="",
         titulo="Avaliação de governança da PNGTAQ (CGU, auditoria do MIR; trata das adesões voluntárias de estados e municípios)",
         orgao="Controladoria-Geral da União (CGU), publicado pelo MIR"),
    dict(url=URL_ATA_VII_CG, arq="pngtaq_ata_vii_cg.pdf", tipo="primaria", data="2026-05-14",
         titulo="Ata da VII Reunião Ordinária do Comitê Gestor da PNGTAQ (CG-PNGTAQ), 12 a 14/05/2026, Brasília",
         orgao="Ministério da Igualdade Racial (MIR)"),
    dict(url=URL_RG_FUNAI_2022, arq="funai_relatorio_gestao_2022.pdf", tipo="primaria", data="",
         titulo="Relatório de Gestão da FUNAI 2022 (lista de convênios com situação de prestação de contas)",
         orgao="FUNAI"),
    dict(url=URL_AGENCIA_PNGTAQ, arq="agenciagov_pngtaq_adesao_202406.html", tipo="primaria", data="",
         titulo="Agência Gov (jun/2024) sobre adesões à PNGTAQ (página indisponível: aviso de legislação eleitoral)",
         orgao="EBC / Agência Gov"),
    dict(url=URL_CM_ACRE, arq="cmanha_acre_2602.pdf", tipo="secundaria", data="2026-02-26",
         titulo="Sepi-AC em agenda em Brasília com Funai e Noruega: notícia sobre apoio ao PGTA (sem ato de cooperação)",
         orgao="Correio da Manhã (jornal)"),
    dict(url=URL_TO_ALMAPRETA, arq="almapreta_aquilomba_TO.html", tipo="secundaria", data="2024-03-28",
         titulo="Aquilomba Tocantins: MIR e governo estadual lançam programa com foco em quilombos (reportagem)",
         orgao="Alma Preta Jornalismo"),
]

# Series: codigo, serie, rotulo, uf, ano, valor, unidade, fonte_url, nota
SERIES = [
    ["I1.1.3", "instrumento_cooperacao_vigente_PNGATI", "exata", "RO", 2026, 1, "sim/nao (1=sim)", URL_EMATER_PDF,
     "ACT FUNAI-EMATER-RO (SEI 10115290), assinado pela FUNAI em 14/04/2026 e pela EMATER-RO em 24/04/2026; "
     "objeto cita a PNGATI; prazo de 5 anos a partir da assinatura (cl. 8.1). Signataria estadual e autarquia "
     "de ATER, ver achados. Anos 2027 a 2030 nao gravados: sao anos futuros (projecao, nao observacao); a vigencia "
     "prevista na cl. 8.1 vai ate 2031."],
    ["I1.1.3", "n_estados_AL_com_instrumento_vigente", "exata", "AL", 2026, 1, "estados", URL_EMATER_PDF,
     "PISO: conta somente o encontrado (RO). Nao e contagem final; ausencia de achado nos demais estados nao "
     "prova que o instrumento nao exista."],
]

# Atos: codigo, uf, tipo_ato, numero, data, assunto, situacao, url, trecho, confianca
ATOS = [
    ["I1.1.3", "RO", "Acordo de Cooperação Técnica (FUNAI e EMATER-RO)", "SEI 10115290 / processo 08760.000252/2018-86",
     "2026-04-24",
     "PNGATI e ATER indígena nas áreas das Coordenações Regionais da FUNAI em Ji-Paraná, Cacoal e Guajará-Mirim. "
     "Signatária estadual: EMATER-RO (autarquia estadual de ATER). Prazo de 5 anos a partir da assinatura (cl. 8.1). "
     "Extrato no DOU/DOE não localizado.",
     "vigente", URL_EMATER_PDF,
     "regime de cooperação mútua entre os partícipes, por meio de parcerias voltadas à implementação da "
     "Política Nacional de Gestão Territorial e Ambiental de Terras Indígenas (PNGATI)",
     "media"],
    ["I1.1.3", "PA", "Protocolo de intenções (FUNAI, órgãos do governo do Pará e Fepipa)", "não localizado",
     "2024-04-19",
     "Regularização de terras indígenas e gestão ambiental no Pará; intenção de celebrar ACT para elaborar e "
     "implementar PGTAs. Não é ACT. ACT não localizado. Portaria SEPI 57/2024 (GT) citada em resumo de busca, "
     "não obtida.",
     "em_elaboracao", URL_PA_PROTOCOLO,
     "O instrumento indica a intenção dos órgãos envolvidos de colaborarem entre si para celebrar um ACT",
     "media"],
    ["I1.1.3", "AL", "Decreto federal (norma da política; não é instrumento estadual)", "7.747", "2012-06-05",
     "Institui a PNGATI. Art. 3º, XIII, prevê parcerias com governos estaduais. Arts. 6º a 8º (Comitê Gestor; "
     "coordenação; Secretaria-Executiva pela FUNAI) revogados pelo Decreto 11.512/2023.",
     "vigente", URL_D7747,
     "Fica instituída a Política Nacional de Gestão Territorial e Ambiental de Terras Indígenas - PNGATI",
     "alta"],
    ["I1.1.3", "AL", "Decreto federal (norma da política; não é instrumento estadual)", "11.512", "2023-04-28",
     "Institui o Comitê Gestor da PNGATI no âmbito do MPI, com representantes federais e indígenas; coordenação "
     "alternada (MPI, MMA e organizações indígenas); Secretaria-Executiva pela FUNAI; revoga arts. 6º a 8º do "
     "Decreto 7.747/2012.",
     "vigente", URL_D11512,
     "Fica instituído, no âmbito do Ministério dos Povos Indígenas, o Comitê Gestor da Política Nacional de "
     "Gestão Territorial e Ambiental de Terras Indígenas",
     "alta"],
    ["I1.1.3", "AL", "Decreto federal (norma da política; não é instrumento estadual)", "11.786", "2023-11-20",
     "Institui a PNGTAQ (comunidades quilombolas) e seu Comitê Gestor. Coordenação conjunta MIR, MMA e MDA "
     "(art. 19); Secretaria-Executiva no MIR (art. 20). Sem FUNAI nem MPI na composição (art. 17).",
     "vigente", URL_D11786,
     "A PNGTAQ destina-se a todas as comunidades quilombolas com trajetória histórica própria",
     "alta"],
]

# Trechos citados no achados.md que tambem precisam bater com a fonte.
CHECKS = [
    (URL_EMATER_PDF, "em 14/04/2026"),
    (URL_EMATER_PDF, "em 24/04/2026"),
    (URL_EMATER_PDF, "vigorará pelo prazo de 5 (cinco) anos a partir da data de sua assinatura"),
    (URL_EMATER_PDF, "Este Acordo de Cooperação Técnica não enseja a transferência, direta ou indireta, de recursos financeiros"),
    (URL_EMATER_PDF, "Política Nacional de Gestão Ambiental de Terras Indígenas - PNGATI"),
    (URL_D7747, "promoção de parcerias com os governos estaduais, distrital e municipais para compatibilizar políticas públicas regionais e locais e a PNGATI"),
    (URL_D7747, "Art. 7º A coordenação do Comitê Gestor da PNGATI será exercida de forma alternada entre as representações do Ministério da Justiça"),
    (URL_D7747, "A Secretaria-Executiva do Comitê Gestor da PNGATI será exercida pela FUNAI"),
    (URL_D11512, "A Secretaria-Executiva do Comitê Gestor será exercida pela Funai."),
    (URL_D11512, "A coordenação do Comitê Gestor será exercida de forma alternada pelos representantes do Ministério dos Povos Indígenas"),
    (URL_D11512, "Ficam revogados os art. 6º a art. 8º do Decreto nº 7.747"),
    (URL_D11786, "A PNGTAQ será implementada pela União, sem prejuízo das competências concorrentes dos Estados"),
    (URL_D11786, "A Coordenação do Comitê Gestor será desempenhada de forma conjunta pelos Ministérios da Igualdade Racial"),
    (URL_D11786, "A Secretaria-Executiva do Comitê Gestor será exercida pelo Ministério da Igualdade Racial"),
    (URL_D11786, "Os Governos estaduais, distrital e municipais poderão criar instâncias participativas e paritárias"),
    (URL_PA_PROTOCOLO, "a Funai assinou ainda um um Protocolo de Intenções com órgãos do governo do estado do Pará"),
    (URL_MA_TJMA, "A oficina é uma iniciativa do Ministério dos Povos Indígenas, em parceria com o Governo do Maranhão"),
    (URL_UNIVAJA, "doravante denominada Univaja, entidade civil"),
    (URL_TO_AQUILOMBA, "Em respeito à legislação eleitoral vigente"),
    (URL_TO_ALMAPRETA, "lançou, na última terça-feira (26), o programa Aquilomba Tocantins"),
    (URL_CGU_PNGTAQ, "o MIR publicou a Portaria nº 380, de 17 de novembro de 2024, que aprovou a minuta de Termo de Adesão para os entes federados"),
    (URL_CGU_PNGTAQ, "também dispõe que sua adesão é voluntária"),
    (URL_ATA_VII_CG, "Caio do MIR informou que foram 18 ao todo"),
    (URL_ATA_VII_CG, "ATA da VII Reunião Ordinária do Comitê Gestor da PNGTAQ"),
    (URL_RG_FUNAI_2022, "001/2005 SIAFI 544568 Governo do Estado de Roraima"),
    (URL_AGENCIA_PNGTAQ, "Em respeito à legislação eleitoral vigente"),
]

# PDF de jornal com hifenização de quebra de linha: compara sem espacos nem hifens.
CHECKS_FROUXOS = [
    (URL_CM_ACRE, "fortalecer as parcerias com a Embaixada da Noruega, que apoia o Plano de Gestão Territorial e Ambiental"),
]


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def baixar(url, nome):
    destino = os.path.join(BRUTOS, nome)
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r, open(destino, "wb") as f:
        f.write(r.read())
    print("baixado:", nome)


def texto_da_fonte(caminho):
    if caminho.lower().endswith(".pdf"):
        leitor = pypdf.PdfReader(caminho)
        return norm(" ".join((p.extract_text() or "") for p in leitor.pages))
    raw = open(caminho, "rb").read()
    try:
        html = raw.decode("utf-8")
    except UnicodeDecodeError:
        html = raw.decode("cp1252", errors="replace")
    doc = H.fromstring(html)
    for ruido in doc.xpath("//script|//style|//noscript"):
        ruido.drop_tree()
    artigos = doc.xpath("//article")
    raiz = artigos[0] if artigos else doc.body
    return norm(raiz.text_content())


def gravar(nome, cabecalho, linhas):
    caminho = os.path.join(RAIZ_DADOS, nome)
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        escritor = csv.writer(f)
        escritor.writerow(cabecalho)
        for linha in linhas:
            escritor.writerow(linha)
    print("gravado:", caminho, len(linhas), "linha(s)")


def main():
    os.makedirs(BRUTOS, exist_ok=True)
    for url, nome in DOWNLOADS:
        baixar(url, nome)

    arquivo_por_url = {f["url"]: os.path.join(BRUTOS, f["arq"]) for f in FONTES}
    cache = {}

    def texto(url):
        if url not in cache:
            cache[url] = texto_da_fonte(arquivo_por_url[url])
        return cache[url]

    falhas = []
    for url, trecho in CHECKS:
        if norm(trecho) not in texto(url):
            falhas.append((url, trecho))
    for ato in ATOS:
        if len(ato[8].split()) > 30:
            falhas.append((ato[7], "trecho com mais de 30 palavras: " + ato[8]))
        if norm(ato[8]) not in texto(ato[7]):
            falhas.append((ato[7], ato[8]))

    for url, trecho in CHECKS_FROUXOS:
        sem_marcas = lambda s: re.sub(r"[\s\-]+", "", s).lower()
        if sem_marcas(trecho) not in sem_marcas(texto(url)):
            falhas.append((url, trecho))

    urls_validas = set(arquivo_por_url)
    for linha in SERIES:
        if linha[7] not in urls_validas:
            falhas.append((linha[7], "fonte_url de serie sem entrada em FONTES"))
    for ato in ATOS:
        if ato[7] not in urls_validas:
            falhas.append((ato[7], "url de ato sem entrada em FONTES"))

    if falhas:
        print("TRECHOS NAO CONFEREM:")
        for url, trecho in falhas:
            print(" -", url, "::", trecho)
        sys.exit(1)
    print("todos os trechos conferem com a fonte (%d verificacoes)" % (len(CHECKS) + len(ATOS)))

    gravar("series.csv", ["codigo", "serie", "rotulo", "uf", "ano", "valor", "unidade", "fonte_url", "nota"], SERIES)
    gravar("fontes.csv", ["url", "titulo", "orgao", "tipo", "data_documento", "acessado_em", "arquivo_local"],
           [[f["url"], f["titulo"], f["orgao"], f["tipo"], f["data"], ACESSO,
             os.path.join(BRUTOS, f["arq"]).replace("\\", "/")] for f in FONTES])
    gravar("atos.csv", ["codigo", "uf", "tipo_ato", "numero", "data", "assunto", "situacao", "url", "trecho", "confianca"],
           ATOS)


if __name__ == "__main__":
    main()
