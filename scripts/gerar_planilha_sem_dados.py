#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Gera INDICADORES_SEM_DADOS.xlsx a partir do catálogo e do levantamento.

Os nomes dos indicadores e o eixo vêm do `catalogo.json`, para não haver
redigitação; o motivo e o que destrava vêm do INDICADORES_SEM_DADOS.md, que é a
apuração. Regerar a planilha depois de atualizar os workbooks mantém os nomes em dia.

Requer openpyxl. Uso: python scripts/gerar_planilha_sem_dados.py
"""
import json
import os
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
DESTINO = os.path.join(PASTA, "INDICADORES_SEM_DADOS.xlsx")

G1 = "1. Depende dos estados"
G2 = "2. Base externa bloqueada"
G3 = "3. Sem série possível"
G4 = "4. Série obtida, fora do painel"

# codigo -> (situação, por que não foi possível, o que destrava, prazo declarado)
MOTIVOS = {
    # --- 2. base externa identificável, mas bloqueada ou incompleta
    "I3.4.1": (G2,
        "O CNPSA, cadastro nacional que consolidaria os beneficiários de PSA, ainda está em "
        "construção. O painel do Bolsa Verde no MMA está sob restrição de defeso eleitoral e o "
        "programa não aparece nos 39 conjuntos de download em massa do Portal da Transparência.",
        "O endpoint bolsa-verde-por-municipio do Portal da Transparência responde 401 e não 404: "
        "existe e entrega dados por município, faltando só a chave de API. Cobriria o programa "
        "federal, não os estaduais (Bolsa Floresta, REM).",
        "Defeso até 25/10/2026; CNPSA sem data firme"),
    "I5.5.2": (G2,
        "O sistema Mapa Brasil Transparente redireciona para página de manutenção declarando "
        "retorno em novembro/2026. O dadosabertos.cgu.gov.br não resolve mais em DNS.",
        "Reconferir depois de novembro de 2026.",
        "novembro/2026"),
    "I2.4.2": (G2,
        "A API do AdaptaBrasil devolve 403 mesmo com Referer e Origin do próprio portal. Mais "
        "decisivo: o AdaptaBrasil publica por cenário (presente, 2030, 2050), não por ano "
        "histórico — não há série temporal a extrair.",
        "Depende de o MCTI publicar recorte anual; não é questão de acesso.",
        "sem prazo"),
    "I4.4.2": (G2,
        "Mesmo caso do I2.4.2: API com 403 e índice por cenário, não por ano.",
        "Depende de o MCTI publicar recorte anual.",
        "sem prazo"),
    "I4.2.1": (G2,
        "O painel da CNT é Power BI sem API e o vgeo do DNIT publica só geometria, sem estado de "
        "conservação — que é justamente o que o indicador mede.",
        "Depende de a CNT ou o DNIT abrirem o estado de conservação em formato aberto.",
        "sem prazo"),
    "I2.5.1": (G2,
        "A Plataforma da Ecosociobiodiversidade do MMA, que a ficha aponta como fonte, está em "
        "construção.",
        "Reconferir quando a plataforma entrar no ar.",
        "em construção"),
    "I4.3.1": (G2,
        "Parcial. Os componentes de geração são coletáveis pelo SIGA da ANEEL, mas o índice "
        "composto depende do PASI/EPE, cujo endpoint de downloads devolveu 500.",
        "Reconferir o PASI/EPE; ver também o problema estrutural da matriz elétrica (I4.3.2).",
        "sem prazo"),
    "I1.5.7": (G2,
        "O SICAR publica shapefile por estado e boletim em PDF, não série por UF com o recorte "
        "que a ficha pede. O car.gov.br exige TLS legado para conectar, o que já foi resolvido.",
        "Exigiria geoprocessamento das camadas do SICAR, não consulta.",
        "sem prazo"),
    "I1.5.8": (G2,
        "Mesmo caso do I1.5.7: o SICAR não publica série por UF de territórios de povos e "
        "comunidades tradicionais inscritos e analisados.",
        "Exigiria processamento das camadas do SICAR.",
        "sem prazo"),
    "I1.3.5": (G2,
        "A fonte (FBSP, Cartografias da Violência na Amazônia) é estudo publicado como relatório, "
        "não base consultável.",
        "Leitura de documento; coleta manual.",
        "sem prazo"),
    "I1.3.6": (G2,
        "A fonte (CAL em parceria com o Igarapé) é registro de projeto, não base consultável.",
        "Leitura de documento; coleta manual.",
        "sem prazo"),
    "I1.3.7": (G2,
        "O Sisfogo/IBAMA não publica o recorte pedido (planos de manejo integrado do fogo "
        "registrados por estado) em base aberta.",
        "Leitura de documento; coleta manual.",
        "sem prazo"),
    "I1.4.1": (G2,
        "O Observatório do Código Florestal publica relatório, não base por UF com o estado de "
        "regulamentação e execução do PRA.",
        "Leitura de documento; coleta manual.",
        "sem prazo"),
    "I1.4.2": (G2,
        "Depende de registros de TCA/PRADA do PRA de cada estado, que não são publicados de forma "
        "consolidada.",
        "Coleta junto aos órgãos ambientais estaduais.",
        "sem prazo"),
    "I5.2.2": (G2,
        "O site do Consórcio é feito em Wix e a tabela de orçamento carrega por JavaScript; não há "
        "endpoint estável para automatizar.",
        "Leitura de página ou pedido direto ao CAL.",
        "sem prazo"),
    # --- 3. tem valor no painel, mas a série é impossível
    "I4.3.2": (G3,
        "Nenhuma fonte cruza UF com fonte de geração ao longo do tempo: ANEEL e EPE têm UF x ano "
        "sem fonte, ou fonte x ano sem UF; o ONS declara não ter histórico. Reconstruir pelo SIGA "
        "falha em dois sentidos — usina desativada some (Amazonas 2010: 978 MW contra 2.140 MW "
        "reais) e usina escalonada entra numa data só (Pará 2016: 70% acima do real).",
        "Depende de ANEEL ou EPE publicarem capacidade por UF e fonte na mesma série.",
        "sem prazo"),
    "I4.4.1": (G3,
        "O ISGR combina água e esgoto adequados com fatores climático e de governança, e dois dos "
        "três insumos nascem em 2022: a classificação de água do Censo 2022 não existe em 2000 e "
        "2010, e os fatores vêm da MUNIC 2024.",
        "O que é comparável entre os três censos foi coletado e está guardado, marcado como não "
        "sendo o ISGR.",
        "não se aplica"),
    "I1.1.2": (G3,
        "O CNUC é registro do estado atual; não foram encontradas edições históricas publicadas "
        "como série. Conclusão de menor confiança do levantamento: a busca parou na página do "
        "portal e não foi esgotada.",
        "Vale nova busca por edições históricas do cadastro.",
        "a reconferir"),
    "I1.3.1": (G3,
        "Mesmo caso do AdaptaBrasil: índice por cenário, não por ano.",
        "Depende de o MCTI publicar recorte anual.",
        "sem prazo"),
    # --- 4. série obtida, mas não ligada ao painel
    "I2.2.1": (G4,
        "A contagem foi obtida (31 anos, 1996-2026), mas a ficha define taxa sobre população, e o "
        "painel usa a revisão de 2024 da projeção do IBGE, que não está na SIDRA — a tabela "
        "disponível é a revisão de 2018 e diverge (82.857 crianças de 0 a 4 anos no Acre em 2024 "
        "contra 88.080).",
        "Publicar a série de população da revisão de 2024, ou rodar o build na máquina que a tem.",
        "não se aplica"),
    "I2.4.1": (G4,
        "A contagem foi estendida (12 anos, 2015-2026), mas a taxa depende da mesma projeção "
        "populacional ausente na SIDRA.",
        "Entra sozinha no próximo build:static na máquina com dados/ibge_pop/.",
        "não se aplica"),
    "I2.2.3": (G4,
        "Série obtida (15 anos, 2012-2026) e versionada. Não virou métrica do painel porque isso é "
        "decisão de escopo, não de coleta.",
        "Decisão de incluir no seletor do panorama.",
        "não se aplica"),
    "F3.2": (G4,
        "Série obtida (7 anos, 2018-2025) e versionada. Não virou métrica do painel porque isso é "
        "decisão de escopo. A edição de 2022 da RAIS foi descartada: o campo de atividade vem "
        "quase todo com código 9 em vez de 1.",
        "Decisão de incluir no seletor do panorama.",
        "não se aplica"),
}

MOTIVO_ESTADOS = (
    "Status administrativo de política estadual: só existe se a secretaria o produzir. Nenhuma "
    "base secundária ou varredura de dados abertos resolve."
)
DESTRAVA_ESTADOS = "Coleta por ofício ou pactuação no âmbito do Consórcio."

with open(os.path.join(PASTA, "dashboard", "public", "data", "catalogo.json"), encoding="utf-8") as f:
    catalogo = json.load(f)
indice = {i["codigo"]: (e["numero"], i["nome"], i["fonte"] or "")
          for e in catalogo["eixos"] for i in e["indicadores"]}


def depende_dos_estados(fonte):
    f = (fonte or "").lower()
    return (f.startswith("estado") or "estados" in f[:30] or "diário oficial" in f
            or "órgãos fundiários" in f or "legislação" in f)


linhas = []
for eixo in catalogo["eixos"]:
    for item in eixo["indicadores"]:
        codigo = item["codigo"]
        if item.get("valores") and codigo not in MOTIVOS:
            continue
        # A situação vem da classificação do catálogo, não do texto do motivo: o I3.4.1 e
        # o I1.5.7 têm caminho técnico descrito, mas a fonte prevista continua sendo os
        # estados, e é assim que o levantamento em .md e .pdf os conta.
        if codigo in MOTIVOS:
            _, motivo, destrava, prazo = MOTIVOS[codigo]
        elif not item.get("valores") and depende_dos_estados(item.get("fonte")):
            motivo, destrava, prazo = MOTIVO_ESTADOS, DESTRAVA_ESTADOS, "sem prazo"
        else:
            continue
        if item.get("valores"):
            situacao = MOTIVOS[codigo][0]           # grupos 3 e 4: já têm valor no painel
        elif depende_dos_estados(item.get("fonte")):
            situacao = G1
        else:
            situacao = G2
        linhas.append([codigo, eixo["numero"], item["nome"], situacao,
                       (item["fonte"] or "").replace("\n", " / "), motivo, destrava, prazo])
linhas.sort(key=lambda r: (r[3], r[0]))

ARIAL = "Arial"
AZUL = "1F3864"
CINZA = "F2F2F2"
borda = Border(*[Side(style="thin", color="BFBFBF")] * 4)

wb = Workbook()

# ---------------- Aba de detalhe ----------------
ws = wb["Sheet"]
ws.title = "Indicadores"
cabecalho = ["Código", "Eixo", "Indicador", "Situação", "Fonte prevista na ficha",
             "Por que não foi possível", "O que destrava", "Prazo declarado"]
ws.append(cabecalho)
for linha in linhas:
    ws.append(linha)

larguras = [10, 7, 38, 26, 30, 62, 44, 20]
for i, largura in enumerate(larguras, start=1):
    ws.column_dimensions[get_column_letter(i)].width = largura

for celula in ws[1]:
    celula.font = Font(name=ARIAL, bold=True, color="FFFFFF", size=10)
    celula.fill = PatternFill("solid", start_color=AZUL)
    celula.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
    celula.border = borda
ws.row_dimensions[1].height = 30

for linha_idx in range(2, ws.max_row + 1):
    for coluna_idx in range(1, len(cabecalho) + 1):
        celula = ws.cell(row=linha_idx, column=coluna_idx)
        celula.font = Font(name=ARIAL, size=10)
        celula.alignment = Alignment(vertical="top", wrap_text=(coluna_idx >= 3),
                                     horizontal="center" if coluna_idx == 2 else "left")
        celula.border = borda
    if linha_idx % 2 == 0:
        for coluna_idx in range(1, len(cabecalho) + 1):
            ws.cell(row=linha_idx, column=coluna_idx).fill = PatternFill("solid", start_color=CINZA)

ws.freeze_panes = "A2"
ws.auto_filter.ref = f"A1:{get_column_letter(len(cabecalho))}{ws.max_row}"

# ---------------- Aba de resumo ----------------
resumo = wb.create_sheet("Resumo", 0)
resumo["A1"] = "Indicadores sem dados — Estratégia Amazônia 2050"
resumo["A1"].font = Font(name=ARIAL, bold=True, size=14, color=AZUL)
resumo["A2"] = "Levantamento de 7 de setembro de 2026. Detalhe na aba Indicadores."
resumo["A2"].font = Font(name=ARIAL, size=10, italic=True)

resumo["A4"] = "Situação"
resumo["B4"] = "Indicadores"
for celula in (resumo["A4"], resumo["B4"]):
    celula.font = Font(name=ARIAL, bold=True, color="FFFFFF", size=10)
    celula.fill = PatternFill("solid", start_color=AZUL)
    celula.border = borda

ultima = ws.max_row
for i, grupo in enumerate([G1, G2, G3, G4], start=5):
    resumo[f"A{i}"] = grupo
    resumo[f"B{i}"] = f"=COUNTIF(Indicadores!$D$2:$D${ultima},A{i})"
    resumo[f"A{i}"].font = Font(name=ARIAL, size=10)
    resumo[f"B{i}"].font = Font(name=ARIAL, size=10)
    resumo[f"A{i}"].border = borda
    resumo[f"B{i}"].border = borda
resumo["A9"] = "Total"
resumo["B9"] = "=SUM(B5:B8)"
for celula in (resumo["A9"], resumo["B9"]):
    celula.font = Font(name=ARIAL, bold=True, size=10)
    celula.fill = PatternFill("solid", start_color=CINZA)
    celula.border = borda

notas = [
    "",
    "Os grupos 3 e 4 não estão entre os 41 indicadores sem valores do catálogo: são indicadores",
    "que já têm valor no painel, mas cuja série esbarra em limite da fonte ou em decisão pendente.",
    "",
    "Os resolvidos nesta rodada — IDEB, mortalidade evitável, telessaúde, focos de calor, PEVS,",
    "PIA, RAIS, frequência escolar, atenção primária e P&D — não aparecem nesta planilha.",
]
for i, texto in enumerate(notas, start=11):
    resumo[f"A{i}"] = texto
    resumo[f"A{i}"].font = Font(name=ARIAL, size=9, color="595959")

resumo.column_dimensions["A"].width = 92
resumo.column_dimensions["B"].width = 14

wb.save(DESTINO)
print(f"{len(linhas)} indicadores -> {os.path.relpath(DESTINO, PASTA)}")
for grupo in [G1, G2, G3, G4]:
    print(f"  {grupo:34} {sum(1 for l in linhas if l[3] == grupo)}")
