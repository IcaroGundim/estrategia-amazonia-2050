#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 4 / I4.3.1 — ITEQ (transição energética): séries históricas dos termos da fórmula.

A fórmula da ficha é
    ITEQ_m = [ (POP_SIN,m/POP_total,m) * R_SIN,Amz + (POP_SISOL,m/POP_total,m) * R_SISOL,m ] * Fdist,m * Fiso,m
    ITEQ_reg = soma(POP_m * ITEQ_m) / soma(POP_m) * 100

RESULTADO (para não se refazer o caminho): o ITEQ não tem série histórica publicada e
a linha de base (60,13% em 2025) NÃO é reproduzível com dado público, porque a ficha
não dá a função de Fdist (penalização por DEC/FEC) nem de Fiso (isolamento logístico),
e R_SISOL é "proporção de usinas limpas no município isolado" sem a base municipal.
O script prova isso com um teste de limites (teste_linha_base_2025.csv) e entrega
CADA TERMO como série própria, com o rótulo honesto:

  pop_sisol_uf_ciclo.csv            POP_SISOL por UF, ciclos EPE 2018-2025        componente
  pop_sisol_share_uf.csv            POP_SISOL/POP_total (e POP_SIN = 1 - share)   componente
  dec_apurado_uf_epe.csv            DEC por UF 2004-2025 (EPE Anuário, Tab. 2.18)  componente (insumo de Fdist)
  fec_apurado_uf_epe.csv            FEC por UF 2004-2025 (idem)                     componente (insumo de Fdist)
  fdist_proxy_uf_aneel.csv          % de consumidores em conjuntos que cumprem    proxy de Fdist
                                    os limites de DEC e FEC (ANEEL, 2000-2025)
  r_geracao_sin_ons_uf_ano.csv      renovabilidade da geração SIN por UF 2000-2025 proxy de R_SIN,Amz (energia, não potência)
  r_potencia_siga_uf_2026.csv       potência limpa/renovável por UF, SIGA (foto)   componente (R_SIN,Amz no ano atual)
  pnad_energia_eletrica_uf.csv      % domicílios com energia elétrica 2001-2025   contexto
  pnad_rede_geral_integral_uf.csv   % domicílios com rede geral em tempo integral contexto
  anuario_consumidores_sisol_brasil.csv   consumidores em SISOL, Brasil 2011-2025  contexto
  anuario_lpt_regioes_remotas_uf.csv      Luz para Todos, regiões remotas, por UF contexto
  iteq_proxy_uf_ano.csv             composição dos termos 2018-2025 (Fiso=1, R_SISOL=0)  proxy (NÃO recomendado para o painel)
  teste_linha_base_2025.csv         cenários de reprodução do 60,13%: S3 e S4 caem a ~1 pp por leituras
                                    opostas (R_SIN=65,24% sem Fdist; R_SIN=SIGA com Fdist) -> não identifica nada

Rodar do zero, a partir da raiz do projeto:   python scripts/eixo4_series_iteq.py
Opções:  --sem-ons   pula o download dos arquivos do ONS (~0,5 GB; série R_SIN por energia)
Opcional: se `pdfplumber` estiver instalado, os PDFs da EPE são baixados e os valores
transcritos em SISOL são conferidos contra o texto das páginas
(uv run --with pdfplumber --with pandas --with numpy --with openpyxl --with requests --with pyarrow
 python scripts/eixo4_series_iteq.py). Sem pdfplumber o script roda igual, só não faz a conferência.

Todos os dados brutos ficam em dados/eixo4_series/I4.3.1/bruto/ (pasta ignorada pelo git).
"""
import csv
import io
import os
import re
import sys
import tempfile
import time
import warnings

import numpy as np
import openpyxl
import pandas as pd
import requests

sys.stdout.reconfigure(encoding="utf-8")
warnings.filterwarnings("ignore")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "dados", "eixo4_series", "I4.3.1")
BRUTO = os.path.join(SAIDA, "bruto")
os.makedirs(BRUTO, exist_ok=True)

UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
COD_UF = {"RO": 11, "AC": 12, "AM": 13, "RR": 14, "PA": 15, "AP": 16, "TO": 17, "MA": 21, "MT": 51}
NOME_UF = {"AC": "Acre", "AP": "Amapá", "AM": "Amazonas", "MA": "Maranhão", "MT": "Mato Grosso",
           "PA": "Pará", "RO": "Rondônia", "RR": "Roraima", "TO": "Tocantins"}
UA = {"User-Agent": "Mozilla/5.0 (observatorio-amazonia-2050; coleta de dados abertos)"}
FALHAS = []  # (rota, resultado) — impresso no fim


# ----------------------------------------------------------------------------- utilidades
def baixar(url, destino, minimo=1000):
    """Baixa com cache (pula se o arquivo já existe). Em erro de TLS tenta sem verificação."""
    if os.path.exists(destino) and os.path.getsize(destino) > minimo:
        return destino
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    print("  baixando", url.rsplit("/", 1)[-1][:90])
    for verify in (True, False):
        try:
            with requests.get(url, headers=UA, stream=True, timeout=600, verify=verify) as r:
                r.raise_for_status()
                tmp = destino + ".parcial"
                with open(tmp, "wb") as f:
                    for bloco in r.iter_content(1 << 20):
                        f.write(bloco)
            os.replace(tmp, destino)
            return destino
        except requests.exceptions.SSLError:
            if not verify:
                raise
            print("   (TLS falhou; repetindo sem verificação)")
    return destino


def num_br(serie):
    """'1.234,56' -> 1234.56 (colunas dos CSV da ANEEL)."""
    return pd.to_numeric(serie.astype(str).str.replace(".", "", regex=False).str.replace(",", ".", regex=False),
                         errors="coerce")


def gravar(df, nome):
    destino = os.path.join(SAIDA, nome)
    df.to_csv(destino, index=False, encoding="utf-8")
    print(f"  -> {nome}  ({len(df)} linhas)")
    return destino


def falha(rota, resultado):
    FALHAS.append((rota, resultado))
    print(f"  ATENÇÃO: {rota}: {resultado}")


# ----------------------------------------------------------------------------- população IBGE
def populacao_uf():
    """População por UF e ano, projeção IBGE 2024 (a mesma que o painel usa). -> DataFrame uf,ano,populacao."""
    url = ("https://ftp.ibge.gov.br/Projecao_da_Populacao/Projecao_da_Populacao_2024/"
           "projecoes_2024_tab1_idade_simples.xlsx")
    xlsx = baixar(url, os.path.join(BRUTO, "ibge_projecoes_2024_idade_simples.xlsx"), 1_000_000)
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    it = wb[wb.sheetnames[0]].iter_rows(values_only=True)
    for _ in range(5):
        next(it)
    cab = next(it)
    anos = [str(c) for c in cab[5:]]
    soma = {}
    for row in it:
        if row[0] is None or row[3] is None or str(row[1]).strip() != "Ambos":
            continue
        uf = str(row[3]).strip().upper()
        if uf not in UFS:
            continue
        for i, a in enumerate(anos):
            v = row[5 + i]
            if isinstance(v, (int, float)):
                soma[(uf, int(a))] = soma.get((uf, int(a)), 0.0) + float(v)
    wb.close()
    df = pd.DataFrame([(u, a, round(v)) for (u, a), v in sorted(soma.items())], columns=["uf", "ano", "populacao"])
    return df


# ----------------------------------------------------------------------------- 1. POP_SISOL (EPE)
# Transcrição dos ciclos de planejamento dos Sistemas Isolados (EPE). "doc/pag" dizem onde cada número está.
# Para 2018-2020 é a Tabela 1 (texto). Em 2021 é a Figura 1 (imagem rasterizada; transcrita à vista, em zoom).
# De 2022 a 2025 são os rótulos do mapa da Figura/slide "Principais características" (texto extraível; arredondados
# a "mil pessoas"). UF ausente da lista do ciclo = sem SISOL no ciclo (0). A população é a da LOCALIDADE isolada
# (estimativa IBGE do ano do ciclo, segundo os próprios relatórios), não a de pessoas efetivamente atendidas.
EPE_BASE = "https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/"
SISOL = {
    2018: dict(doc="EPE-NT-Planejamento SI-ciclo_2018_rev1.pdf", pag=11, tipo="tabela-texto",
               url=EPE_BASE + "publicacao-346/EPE-NT-Planejamento%20SI-ciclo_2018_rev1.pdf",
               uf={"AC": (213579, 9, "Eletrobras Distribuição Acre"), "AP": (43315, 29, "CEA"),
                   "AM": (1657298, 95, "Eletrobras Amazonas Energia"), "PA": (668077, 21, "Celpa"),
                   "RO": (170953, 25, "Eletrobras Distribuição Rondônia"),
                   "RR": (494409, 86, "Eletrobras Distribuição Roraima"), "MT": (4038, 2, "Energisa Mato Grosso")},
               fora=3016, total=3254685,
               txt=["213.579", "43.315", "1.657.298", "668.077", "170.953", "494.409", "4.038", "3.254.685"]),
    2019: dict(doc="EPE-NT-Planejamento SI-ciclo_2019_rev1.pdf", pag=11, tipo="tabela-texto",
               url=EPE_BASE + "publicacao-452/EPE-NT-Planejamento%20SI-ciclo_2019_rev1.pdf",
               uf={"AC": (279189, 9, "Energisa Acre"), "AP": (43315, 29, "CEA"),
                   "AM": (1549241, 95, "Amazonas Energia"), "PA": (678694, 22, "Celpa"),
                   "RO": (214241, 26, "Energisa Rondônia"), "RR": (541712, 86, "Roraima Energia"),
                   "MT": (3038, 1, "Energisa Mato Grosso")},
               fora=3021, total=3312451,
               txt=["279.189", "43.315", "1.549.241", "678.694", "214.241", "541.712", "3.038", "3.312.451"]),
    2020: dict(doc="EPE-NT-Planejamento SI-ciclo_2020.pdf", pag=11, tipo="tabela-texto",
               url=EPE_BASE + "publicacao-614/EPE-NT-Planejamento%20SI-ciclo_2020.pdf",
               uf={"AC": (262553, 7, "Energisa Acre"), "AP": (38743, 25, "CEA"),
                   "AM": (1549241, 95, "Amazonas Energia"), "PA": (482537, 19, "Equatorial Pará"),
                   "RO": (155822, 22, "Energisa Rondônia"), "RR": (492838, 86, "Roraima Energia"),
                   "MT": (3038, 1, "Energisa Mato Grosso")},
               fora=3021, total=2987793,
               txt=["262.553", "38.743", "1.549.241", "482.537", "155.822", "492.838", "3.038", "2.987.793"]),
    2021: dict(doc="EPE-NT-Planejamento SI-Ciclo_2021_r2.pdf", pag=8, tipo="figura-raster",
               url=EPE_BASE + "publicacao-652/EPE-NT-Planejamento%20SI-Ciclo_2021_r2.pdf",
               uf={"AC": (262553, 7, "Energisa Acre"), "AP": (41135, 25, "CEA"),
                   "AM": (1549241, 97, "Amazonas Energia"), "PA": (482537, 19, "Equatorial Pará"),
                   "RO": (155822, 22, "Energisa Rondônia"), "RR": (490463, 77, "Roraima Energia"),
                   "MT": (3038, 1, "Energisa Mato Grosso")},
               fora=3021, total=None, txt=[]),
    2022: dict(doc="EPE-NT-Planejamento SI-Ciclo_2022_r0.pdf", pag=9, tipo="figura-texto",
               url=EPE_BASE + "publicacao-713/EPE-NT-Planejamento%20SI-Ciclo_2022_r0.pdf",
               uf={"AC": (216000, 7, "Energisa Acre"), "AP": (28500, 1, "Equatorial Amapá"),
                   "AM": (1775000, 97, "Amazonas Energia"), "PA": (440000, 18, "Equatorial Pará"),
                   "RO": (11000, 13, "Energisa Rondônia"), "RR": (645000, 73, "Roraima Energia")},
               fora=3140, total=3_100_000,  # texto do relatório: "3,1 milhões" (p.10)
               txt=["645 mil pessoas", "1,775 milhão", "216 mil pessoas", "11 mil pessoas", "28,5 mil pessoas",
                    "440 mil pessoas", "3.140 pessoas"]),
    2023: dict(doc="Planejamento dos Sistemas Isolados - Ciclo 2023.pdf", pag=7, tipo="figura-texto",
               url=EPE_BASE.replace("PublicacoesArquivos/", "") + "PublishingImages/Paginas/Forms/Publicaes/"
                   "Planejamento%20dos%20Sistemas%20Isolados%20-%20Ciclo%202023.pdf",
               uf={"AC": (214500, 7, "Energisa Acre"), "AP": (27500, 1, "Equatorial Amapá"),
                   "AM": (1786000, 97, "Amazonas Energia"), "PA": (394200, 17, "Equatorial Pará"),
                   "RO": (11000, 13, "Energisa Rondônia"), "RR": (636700, 58, "Roraima Energia")},
               fora=3200, total=None,
               txt=["636,7 mil pessoas", "1,786 milhão", "214,5 mil pessoas", "11 mil pessoas", "27,5 mil pessoas",
                    "394,2 mil pessoas", "3,2 mil pessoas"]),
    2024: dict(doc="Planejamento do Atendimento aos Sistemas Isolados - Ciclo 2024 (cópia hospedada pelo Poder360)",
               pag=11, tipo="figura-texto",
               url="https://static.poder360.com.br/2024/12/epe-planejamento-sistemas-isolados.pdf",
               uf={"AC": (135700, 5, "Energisa Acre"), "AP": (28500, 1, "Equatorial Amapá"),
                   "AM": (1415000, 95, "Amazonas Energia"), "PA": (394200, 17, "Equatorial Pará"),
                   "RO": (9400, 12, "Energisa Rondônia"), "RR": (590000, 42, "Roraima Energia")},
               fora=3200, total=2_600_000,  # texto: "cerca de 2,6 milhões" (p.11)
               txt=["590 mil pessoas", "1,415 milhão", "135,7 mil pessoas", "9,4 mil pessoas", "28,5 mil pessoas",
                    "394,2 mil pessoas", "3,2 mil pessoas"]),
    2025: dict(doc="Caderno_Planejamento SISOL_2025_FINAL.pdf", pag=11, tipo="figura-texto",
               url=EPE_BASE + "publicacao-942/Caderno_Planejamento%20SISOL_2025_FINAL.pdf",
               uf={"AC": (43800, 4, "Energisa Acre"), "AP": (30500, 1, "Equatorial Amapá"),
                   "AM": (1467000, 92, "Amazonas Energia"), "PA": (352700, 14, "Equatorial Pará"),
                   "RO": (10000, 12, "Energisa Rondônia"), "RR": (57700, 34, "Roraima Energia")},
               fora=3300, total=1_965_000,  # texto: "1,965 milhões"
               txt=["57,7 mil pessoas", "1,467 milhões", "43,8 mil pessoas", "10 mil pessoas", "30,5 mil pessoas",
                    "352,7 mil pessoas", "3,3 mil pessoas", "1,965 milhões"]),
}


def verificar_pdfs_sisol():
    """Se pdfplumber existir, confere as transcrições contra o texto das páginas dos PDFs da EPE."""
    try:
        import pdfplumber
    except ImportError:
        print("  (pdfplumber ausente: valores SISOL usados como transcritos; para conferir, rode com "
              "`uv run --with pdfplumber python scripts/eixo4_series_iteq.py`)")
        return {}
    resultado = {}
    for ciclo, c in SISOL.items():
        if not c["txt"]:
            print(f"  ciclo {ciclo}: figura rasterizada, sem texto extraível (transcrição visual mantida)")
            resultado[ciclo] = None
            continue
        try:
            pdf = baixar(c["url"], os.path.join(BRUTO, f"epe_sisol_ciclo{ciclo}.pdf"), 100_000)
            with pdfplumber.open(pdf) as doc:
                texto = (doc.pages[c["pag"] - 1].extract_text() or "")
            ausentes = [s for s in c["txt"] if s not in texto]
            resultado[ciclo] = not ausentes
            print(f"  ciclo {ciclo}: {len(c['txt']) - len(ausentes)}/{len(c['txt'])} rótulos achados na p.{c['pag']}"
                  + (f"  AUSENTES: {ausentes}" if ausentes else ""))
        except Exception as e:  # noqa: BLE001
            falha(f"PDF EPE ciclo {ciclo}", repr(e)[:150])
    return resultado


def serie_pop_sisol(pop):
    print("\n[1] POP_SISOL — população em localidades de Sistemas Isolados (EPE, ciclos 2018-2025)")
    verif = verificar_pdfs_sisol()
    linhas, conferencia = [], []
    for ciclo, c in SISOL.items():
        soma_al = 0
        for uf in UFS:
            if uf in c["uf"]:
                p, n, dist = c["uf"][uf]
                obs = ""
            else:
                p, n, dist = 0, 0, ""
                obs = "UF não consta da lista de SISOL do ciclo"
            soma_al += p
            linhas.append(dict(uf=uf, ano=ciclo, valor=p, unidade="pessoas", fonte="EPE, Planejamento do Atendimento "
                               f"aos Sistemas Isolados, ciclo {ciclo}", n_sistemas=n, distribuidora=dist,
                               documento=c["doc"], pagina=c["pag"], tipo_fonte=c["tipo"],
                               conferido_no_texto=("" if verif.get(ciclo) is None else bool(verif.get(ciclo))),
                               obs=obs))
        linhas.append(dict(uf="AL", ano=ciclo, valor=soma_al, unidade="pessoas", fonte="soma das 9 UFs",
                           n_sistemas=sum(v[1] for v in c["uf"].values()), distribuidora="", documento=c["doc"],
                           pagina=c["pag"], tipo_fonte=c["tipo"], conferido_no_texto="", obs="soma; exclui PE e Vibra/Petrobras"))
        total_calc = soma_al + c["fora"]
        conferencia.append(dict(ciclo=ciclo, soma_AL=soma_al, pernambuco=c["fora"], soma_AL_mais_PE=total_calc,
                                total_impresso=c["total"] if c["total"] else "",
                                diferenca=(total_calc - c["total"]) if c["total"] else "",
                                obs="total impresso no relatório" if c["total"] else "relatório não imprime o total"))
    df = pd.DataFrame(linhas)
    gravar(df, "pop_sisol_uf_ciclo.csv")
    conf = pd.DataFrame(conferencia)
    gravar(conf, "pop_sisol_conferencia_totais.csv")
    print(conf.to_string(index=False))

    # participação sobre a população da UF (IBGE, mesmo ano) — POP_SISOL/POP_total; POP_SIN = 1 - share
    pop_ano = pop.set_index(["uf", "ano"]).populacao
    pop_al = pop.groupby("ano").populacao.sum()
    linhas2 = []
    for _, r in df.iterrows():
        denom = pop_al.get(r.ano) if r.uf == "AL" else pop_ano.get((r.uf, r.ano))
        linhas2.append(dict(uf=r.uf, ano=r.ano, valor=round(r.valor / denom * 100, 3), unidade="% da população",
                            fonte="EPE (POP_SISOL) / IBGE projeção 2024 (POP_total)", pop_sisol=r.valor,
                            pop_total_ibge=int(denom), pop_sin=int(denom - r.valor),
                            obs="POP_SIN = POP_total - POP_SISOL; 2022-2025 arredondado a mil pessoas"))
    sh = pd.DataFrame(linhas2)
    gravar(sh, "pop_sisol_share_uf.csv")
    return df, sh


# ----------------------------------------------------------------------------- 2. Anuário EPE
def ler_aba(wb, aba):
    """Devolve (anos, [(rótulo, [valores])]) de uma aba do Anuário (cabeçalho = linha de anos em texto)."""
    linhas = list(wb[aba].iter_rows(values_only=True))
    ih = next(i for i, r in enumerate(linhas)
              if sum(1 for c in r[2:] if str(c).strip().isdigit() and len(str(c).strip()) == 4) >= 3)
    cab = linhas[ih]
    cols = [(j, int(str(c).strip())) for j, c in enumerate(cab) if j >= 2 and str(c).strip().isdigit()
            and len(str(c).strip()) == 4]
    out = []
    for r in linhas[ih + 1:]:
        if len(r) > 1 and r[1] is not None and str(r[1]).strip() and not str(r[1]).strip().startswith("Fonte"):
            out.append((str(r[1]).strip(), {a: r[j] for j, a in cols}))
    return out


def valor(v):
    if v is None or str(v).strip() in ("", "-"):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def anuario():
    print("\n[2] EPE — Anuário Estatístico de Energia Elétrica (Tabelas 2.18, 2.25, 3.41, 3.44)")
    url = ("https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/"
           "publicacao-160/topico-168/anuario-workbook.xlsx")
    xlsx = baixar(url, os.path.join(BRUTO, "epe_anuario_workbook.xlsx"), 100_000)
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    fonte = "EPE, Anuário Estatístico de Energia Elétrica (workbook), "

    # 2.18: blocos "UF" -> "DEC apurado..." / "FEC apurado..."
    atual, dec, fec = None, [], []
    for rotulo, vals in ler_aba(wb, "Tabela 2.18"):
        if "DEC" in rotulo.upper() and "apurado" in rotulo:
            alvo, un = dec, "horas"
        elif "FEC" in rotulo.upper() and "apurado" in rotulo:
            alvo, un = fec, "interrupções"
        else:
            atual = rotulo
            continue
        sigla = next((u for u, n in NOME_UF.items() if n == atual), None)
        if sigla is None:
            continue
        for ano, v in vals.items():
            x = valor(v)
            if x is not None:
                alvo.append(dict(uf=sigla, ano=ano, valor=round(x, 2), unidade=un,
                                 fonte=fonte + "Tabela 2.18 (origem ANEEL)"))
    gravar(pd.DataFrame(dec), "dec_apurado_uf_epe.csv")
    gravar(pd.DataFrame(fec), "fec_apurado_uf_epe.csv")

    # 3.41 / 3.44: "Sistemas Isolados" (só Brasil, sem UF) e "Brasil"
    cons = []
    for aba, nome in (("Tabela 3.41", "consumidores_total"), ("Tabela 3.44", "consumidores_residenciais")):
        t = ler_aba(wb, aba)
        brasil = dict(t[0][1])
        iso = dict(next(v for r, v in t if r == "Sistemas Isolados"))
        for ano in sorted(iso):
            if valor(iso[ano]) is not None:
                cons.append(dict(uf="BR", ano=ano, valor=valor(iso[ano]), unidade="consumidores (dezembro)",
                                 fonte=fonte + aba, classe=nome, total_brasil=valor(brasil[ano]),
                                 pct_sisol=round(valor(iso[ano]) / valor(brasil[ano]) * 100, 3),
                                 obs="Sistemas Isolados, total nacional (a tabela não abre por UF)"))
    gravar(pd.DataFrame(cons), "anuario_consumidores_sisol_brasil.csv")

    # 2.25: Luz para Todos, regiões remotas da Amazônia Legal (domicílios, por UF)
    lpt = []
    for rotulo, vals in ler_aba(wb, "Tabela 2.25"):
        sigla = next((u for u, n in NOME_UF.items() if n == rotulo), None)
        if sigla is None:
            continue
        for ano, v in vals.items():
            if valor(v) is not None:
                lpt.append(dict(uf=sigla, ano=ano, valor=valor(v), unidade="domicílios atendidos no ano",
                                fonte=fonte + "Tabela 2.25 (MME, acessado em 26/05/2026)"))
    gravar(pd.DataFrame(lpt), "anuario_lpt_regioes_remotas_uf.csv")
    wb.close()
    return pd.DataFrame(dec), pd.DataFrame(fec)


# ----------------------------------------------------------------------------- 3. ANEEL DEC/FEC por conjunto
# Distribuidoras da Amazônia Legal por raiz do CNPJ (8 dígitos) -> UF. A junção conjunto->município do IndQual NÃO serve:
# os IDs de conjunto colidem entre distribuidoras (conjuntos da Energisa Paraíba caem no Maranhão).
RAIZ_UF = {"04065033": "AC",  # Eletroacre / Energisa Acre
           "05965546": "AP",  # CEA
           "02341467": "AM",  # Manaus Energia / Amazonas Energia / Âmbar
           "04355657": "AM",  # CEAM (interior do AM até 2009)
           "06272793": "MA",  # CEMAR / Equatorial MA
           "03467321": "MT",  # CEMAT / Energisa MT
           "04895728": "PA",  # CELPA / Equatorial PA
           "05914650": "RO",  # CERON / Energisa RO
           "02341470": "RR",  # Boa Vista Energia / Roraima Energia
           "05938444": "RR",  # CERR (interior de RR, 2008-2015)
           "25086034": "TO"}  # CELTINS / Energisa TO
ANEEL_DEC = ("https://dadosabertos.aneel.gov.br/dataset/d5f0712e-62f6-4736-8dff-9991f10758a7/resource/")
ARQ_DEC = {"col_2000_2009.parquet": "79ba3a61-3a9c-4e29-8188-9bb19f858ec6/download/indicadores-continuidade-coletivos-2000-2009.parquet",
           "col_2010_2019.parquet": "1706a88f-ecd6-4de9-99ee-ec240c317378/download/indicadores-continuidade-coletivos-2010-2019.parquet",
           "col_2020_2029.parquet": "d7f70fb1-725c-4748-afeb-65c6a78df550/download/indicadores-continuidade-coletivos-2020-2029.parquet"}
ARQ_LIM = "fd69e1dd-fd66-4269-b60c-cc0b7eb221b4/download/indicadores-continuidade-coletivos-limite.csv"


def aneel_dec_fec(dec_epe, fec_epe):
    print("\n[3] ANEEL — DEC/FEC por conjunto elétrico, limites e cumprimento (Fdist)")
    quadros = []
    for nome, caminho in ARQ_DEC.items():
        p = baixar(ANEEL_DEC + caminho, os.path.join(BRUTO, nome), 1_000_000)
        d = pd.read_parquet(p, filters=[("SigIndicador", "in", ["DEC", "FEC", "NumCon"])])
        d["raiz"] = d.NumCNPJ.astype(str).str.zfill(14).str[:8]
        quadros.append(d[d.raiz.isin(RAIZ_UF)])
    a = pd.concat(quadros, ignore_index=True)
    a["uf"] = a.raiz.map(RAIZ_UF)
    chave = ["raiz", "IdeConjUndConsumidoras", "AnoIndice", "NumPeriodoIndice", "SigIndicador"]
    dup = int(a.duplicated(chave).sum())
    print(f"  {len(a)} linhas das distribuidoras da AL; duplicatas (conjunto,ano,mês,indicador): {dup}")
    a = a.drop_duplicates(chave)

    # DEC e FEC do ano = soma dos 12 valores mensais; consumidores = média dos meses; só conjuntos com 12 meses
    p = a.pivot_table(index=["uf", "raiz", "IdeConjUndConsumidoras", "AnoIndice", "NumPeriodoIndice"],
                      columns="SigIndicador", values="VlrIndiceEnviado", aggfunc="first").reset_index()
    g = p.groupby(["uf", "raiz", "IdeConjUndConsumidoras", "AnoIndice"]).agg(
        DEC=("DEC", "sum"), FEC=("FEC", "sum"), nd=("DEC", "count"), nf=("FEC", "count"), N=("NumCon", "mean")).reset_index()
    g = g[(g.nd == 12) & (g.nf == 12) & (g.N > 0) & (g.AnoIndice <= 2025)].copy()
    g["DEC"], g["FEC"] = g.DEC.round(2), g.FEC.round(2)

    # limites anuais
    lim = pd.read_csv(baixar(ANEEL_DEC + ARQ_LIM, os.path.join(BRUTO, "limite.csv"), 1_000_000), sep=";",
                      encoding="utf-8-sig", dtype=str)
    lim["raiz"] = lim.NumCNPJ.astype(str).str.zfill(14).str[:8]
    lim = lim[lim.raiz.isin(RAIZ_UF)].copy()
    lim["lim"] = num_br(lim.VlrLimite)
    lim["IdeConjUndConsumidoras"] = lim.IdeConjUndConsumidoras.astype(int)
    lim["AnoIndice"] = lim.AnoLimiteQualidade.astype(int)
    lim = lim.drop_duplicates(["raiz", "IdeConjUndConsumidoras", "AnoIndice", "SigIndicador"])
    lp = lim.pivot_table(index=["raiz", "IdeConjUndConsumidoras", "AnoIndice"], columns="SigIndicador",
                         values="lim", aggfunc="first").reset_index().rename(columns={"DEC": "limDEC", "FEC": "limFEC"})
    m = g.merge(lp, on=["raiz", "IdeConjUndConsumidoras", "AnoIndice"], how="left")
    m["tem_lim"] = m.limDEC.notna() & m.limFEC.notna()
    m["ok_dec"] = m.DEC <= m.limDEC
    m["ok_fec"] = m.FEC <= m.limFEC
    m["ok"] = m.ok_dec & m.ok_fec
    # versão contínua: quanto do limite foi respeitado (1 = dentro; <1 = estourou), pelo pior dos dois indicadores
    with np.errstate(divide="ignore", invalid="ignore"):
        r_dec = np.where(m.DEC > 0, m.limDEC / m.DEC, 1.0)
        r_fec = np.where(m.FEC > 0, m.limFEC / m.FEC, 1.0)
    m["razao"] = np.minimum(1.0, np.minimum(r_dec, r_fec))

    def agrega(d):
        N = d.N.sum()
        L = d[d.tem_lim]
        NL = L.N.sum()
        return pd.Series(dict(
            razao_limite_apurado_pct=(L.N * L.razao).sum() / NL * 100 if NL else np.nan,
            dec_h=(d.DEC * d.N).sum() / N, fec_n=(d.FEC * d.N).sum() / N,
            lim_dec_h=(L.limDEC * L.N).sum() / NL if NL else np.nan,
            lim_fec_n=(L.limFEC * L.N).sum() / NL if NL else np.nan,
            pct_cons_dec_ok=(L.N * L.ok_dec).sum() / NL * 100 if NL else np.nan,
            pct_cons_fec_ok=(L.N * L.ok_fec).sum() / NL * 100 if NL else np.nan,
            pct_cons_ambos_ok=(L.N * L.ok).sum() / NL * 100 if NL else np.nan,
            consumidores=N, n_conjuntos=len(d), cobertura_limite_pct=NL / N * 100))

    res = m.groupby(["uf", "AnoIndice"]).apply(agrega).reset_index().rename(columns={"AnoIndice": "ano"})
    al = m.groupby("AnoIndice").apply(agrega).reset_index().rename(columns={"AnoIndice": "ano"})
    al.insert(0, "uf", "AL")
    res = pd.concat([res, al], ignore_index=True)

    # conferência com a Tabela 2.18 do Anuário (mesma grandeza, calculada pela EPE)
    ref_dec = dec_epe.set_index(["uf", "ano"]).valor
    ref_fec = fec_epe.set_index(["uf", "ano"]).valor
    res["dec_epe"] = [ref_dec.get((u, a), np.nan) for u, a in zip(res.uf, res.ano)]
    res["fec_epe"] = [ref_fec.get((u, a), np.nan) for u, a in zip(res.uf, res.ano)]
    res["dif_rel_dec"] = (res.dec_h - res.dec_epe) / res.dec_epe
    res["dif_rel_fec"] = (res.fec_n - res.fec_epe) / res.fec_epe
    res["diverge_epe_3pct"] = (res.dif_rel_dec.abs() > 0.03) | (res.dif_rel_fec.abs() > 0.03)
    cmp = res[res.dec_epe.notna() & (res.uf != "AL")]
    n_ok = int((~cmp.diverge_epe_3pct).sum())
    print(f"  conferência com Tabela 2.18: {n_ok} de {len(cmp)} UF-anos dentro de 3% (mediana |dif| DEC "
          f"{cmp.dif_rel_dec.abs().median()*100:.2f}%, FEC {cmp.dif_rel_fec.abs().median()*100:.2f}%)")
    print("  UF-anos divergentes:", ", ".join(f"{u}{a}" for u, a in cmp[cmp.diverge_epe_3pct][["uf", "ano"]].values))
    for uf, ano in (("PA", 2015), ("MT", 2020), ("TO", 2025), ("AC", 2010)):
        r = res[(res.uf == uf) & (res.ano == ano)].iloc[0]
        print(f"    {uf} {ano}: DEC ANEEL {r.dec_h:.2f} vs EPE {r.dec_epe:.2f} | FEC {r.fec_n:.2f} vs {r.fec_epe:.2f}")

    out = res.copy()
    out.insert(2, "valor", out.pct_cons_ambos_ok.round(2))
    out.insert(3, "unidade", "% dos consumidores em conjuntos dentro dos limites de DEC e FEC")
    out.insert(4, "fonte", "ANEEL dados abertos, Indicadores Coletivos de Continuidade (DEC/FEC) e limites; "
                           "agregação própria por UF ponderada por nº de consumidores")
    for c in out.columns:
        if out[c].dtype == float:
            out[c] = out[c].round(3)
    out["obs"] = np.where(out.ano < 2004, "2000-2003: poucos conjuntos com 12 meses completos e limites incompletos; "
                          "usar a partir de 2004", np.where(out.diverge_epe_3pct, "diverge >3% da Tabela 2.18 do Anuário "
                          "(conjuntos com meses faltantes, p.ex. CERR em RR)", ""))
    gravar(out, "fdist_proxy_uf_aneel.csv")
    return out


# ----------------------------------------------------------------------------- 4. ONS: geração SIN por UF e fonte
def ons_geracao():
    print("\n[4] ONS — geração verificada por usina (SIN) agregada por UF e fonte, 2000-2025")
    agreg = os.path.join(BRUTO, "ons_geracao_uf_fonte_mes.csv")
    base = "https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/geracao_usina_2_ho/GERACAO_USINA-2_"
    arquivos = [(f"{y}", f"{base}{y}.parquet") for y in range(2000, 2022)]
    arquivos += [(f"{y}_{m:02d}", f"{base}{y}_{m:02d}.parquet") for y in range(2022, 2026) for m in range(1, 13)]
    feitos = set()
    acum = pd.DataFrame()
    if os.path.exists(agreg):
        acum = pd.read_csv(agreg, dtype={"arquivo": str})
        feitos = set(acum.arquivo.unique())
    novos = []
    import pyarrow.parquet as pq
    for chave, url in arquivos:
        if chave in feitos:
            continue
        tmp = os.path.join(tempfile.gettempdir(), f"ons_{chave}.parquet")
        try:
            baixar(url, tmp, 1000)
            d = pq.read_table(tmp, columns=["din_instante", "id_estado", "nom_tipousina", "nom_tipocombustivel",
                                            "val_geracao"]).to_pandas()
        except Exception as e:  # noqa: BLE001
            falha(f"ONS {url.rsplit('/', 1)[-1]}", repr(e)[:120])
            continue
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)
        d["v"] = pd.to_numeric(d.val_geracao, errors="coerce")
        d["ano"] = d.din_instante.dt.year
        d["mes"] = d.din_instante.dt.month
        d = d[d.id_estado.isin(UFS)]
        t = d.groupby(["ano", "mes", "id_estado", "nom_tipousina", "nom_tipocombustivel"], dropna=False).v.sum().reset_index()
        t = t.rename(columns={"id_estado": "uf", "nom_tipousina": "tipo_usina", "nom_tipocombustivel": "combustivel",
                              "v": "mwh"})
        t["arquivo"] = chave
        novos.append(t)
        print(f"   {chave}: {len(d)} linhas AL, {t.mwh.sum()/1e3:,.0f} GWh")
        acum = pd.concat([acum, t], ignore_index=True)
        acum.to_csv(agreg, index=False, encoding="utf-8")  # cache incremental
    if acum.empty:
        falha("ONS geração por usina", "nenhum arquivo lido")
        return None
    acum = acum[acum.ano <= 2025]

    def classe(r):
        tu, co = str(r.tipo_usina).upper(), str(r.combustivel).upper()
        if "HIDRO" in tu or "HIDR" in co:
            return "hidro"
        if "EOL" in tu or "EÓL" in co:
            return "eolica"
        if "FOTOV" in tu or "SOLAR" in co or "FOTOV" in co:
            return "solar"
        if "BIOMASSA" in co:
            return "biomassa"
        return "outras"
    pares = acum[["tipo_usina", "combustivel"]].drop_duplicates()
    pares["classe"] = pares.apply(classe, axis=1)
    acum = acum.merge(pares, on=["tipo_usina", "combustivel"], how="left")
    t = acum.pivot_table(index=["uf", "ano"], columns="classe", values="mwh", aggfunc="sum", fill_value=0).reset_index()
    for c in ("hidro", "eolica", "solar", "biomassa", "outras"):
        if c not in t.columns:
            t[c] = 0.0
    al = t.groupby("ano")[["hidro", "eolica", "solar", "biomassa", "outras"]].sum().reset_index()
    al.insert(0, "uf", "AL")
    t = pd.concat([t, al], ignore_index=True)
    t["total"] = t[["hidro", "eolica", "solar", "biomassa", "outras"]].sum(axis=1)
    t = t[t.total > 0].copy()
    t["limpa"] = t.hidro + t.eolica + t.solar
    # conferência de cobertura: geração total da UF no Anuário (Tabela 2.5, todas as usinas) vs. soma ONS (só SIN)
    epe25 = {}
    try:
        wb = openpyxl.load_workbook(os.path.join(BRUTO, "epe_anuario_workbook.xlsx"), read_only=True, data_only=True)
        for rotulo, vals in ler_aba(wb, "Tabela 2.5"):
            sigla = next((u for u, n in NOME_UF.items() if n == rotulo), None)
            if sigla:
                for a, v in vals.items():
                    if valor(v) is not None:
                        epe25[(sigla, a)] = valor(v)
        wb.close()
    except Exception as e:  # noqa: BLE001
        falha("Anuário Tabela 2.5 (cobertura ONS)", repr(e)[:120])
    for (u, a) in (("PA", 2015), ("MT", 2020), ("TO", 2024), ("MA", 2022)):
        r = t[(t.uf == u) & (t.ano == a)]
        if len(r) and (u, a) in epe25:
            print(f"    cobertura {u} {a}: ONS {r.total.iloc[0]/1e3:,.0f} GWh vs EPE Tab. 2.5 {epe25[(u, a)]:,.0f} GWh "
                  f"({r.total.iloc[0]/1e3/epe25[(u, a)]*100:.0f}%)")
    gwh_epe = [epe25.get((u, a), np.nan) if u != "AL" else sum(epe25.get((x, a), 0) for x in UFS) or np.nan
               for u, a in zip(t.uf, t.ano)]
    out = pd.DataFrame(dict(
        uf=t.uf, ano=t.ano, valor=(t.limpa / t.total * 100).round(2), unidade="% da geração SIN (hidro+eólica+solar)",
        fonte="ONS dados abertos, Geração por Usina (horária) 2000-2025, agregada por UF e fonte",
        pct_renovavel_com_biomassa=((t.limpa + t.biomassa) / t.total * 100).round(2),
        geracao_total_gwh=(t.total / 1e3).round(1), geracao_limpa_gwh=(t.limpa / 1e3).round(1),
        gwh_hidro=(t.hidro / 1e3).round(1), gwh_eolica=(t.eolica / 1e3).round(1), gwh_solar=(t.solar / 1e3).round(1),
        gwh_biomassa=(t.biomassa / 1e3).round(1), gwh_outras=(t.outras / 1e3).round(1),
        gwh_epe_tabela25=np.round(gwh_epe, 1),
        cobertura_ons_pct=np.round((t.total / 1e3) / np.array(gwh_epe, dtype=float) * 100, 1),
        obs="só usinas do SIN que reportam ao ONS (sem sistemas isolados); energia, não potência"))
    out = out.sort_values(["uf", "ano"]).reset_index(drop=True)
    gravar(out, "r_geracao_sin_ons_uf_ano.csv")
    return out


# ----------------------------------------------------------------------------- 5. SIGA (potência) — foto atual
def siga_potencia():
    print("\n[5] ANEEL SIGA — potência fiscalizada em operação (foto), e usinas de Sistemas Isolados")
    siga = baixar("https://dadosabertos.aneel.gov.br/dataset/6d90b77c-c5f5-4d81-bdec-7bc619494bb9/resource/"
                  "11ec447d-698d-4ab8-977f-b424d5deee6a/download/siga-empreendimentos-geracao.csv",
                  os.path.join(BRUTO, "siga_empreendimentos_geracao.csv"), 1_000_000)
    s = pd.read_csv(siga, sep=";", encoding="utf-8-sig", dtype=str,
                    usecols=["DatGeracaoConjuntoDados", "CodCEG", "SigUFPrincipal", "DscFaseUsina",
                             "DscOrigemCombustivel", "MdaPotenciaFiscalizadaKw"])
    data_ref = s.DatGeracaoConjuntoDados.iloc[0]
    s = s[(s.DscFaseUsina == "Operação") & s.SigUFPrincipal.isin(UFS)].copy()
    s["kw"] = num_br(s.MdaPotenciaFiscalizadaKw)
    print(f"  base de {data_ref}; {len(s)} usinas em operação na AL; origens: {sorted(s.DscOrigemCombustivel.unique())}")

    lib = baixar("https://dadosabertos.aneel.gov.br/dataset/2b2ace01-5692-4636-8c99-2a84ff094f4f/resource/"
                 "75419902-c692-498b-a6ef-85f6d4beb5b2/download/unidades-geradoras-liberadas-operacao-comercial-detalhado.csv",
                 os.path.join(BRUTO, "liberacao_operacao_comercial_unidades.csv"), 1_000_000)
    L = pd.read_csv(lib, sep=";", encoding="utf-8-sig", dtype=str, usecols=["CodCEG", "DscSistema"])
    iso_ceg = set(L[L.DscSistema == "Sistemas Isolados"].CodCEG)
    s["isolado"] = s.CodCEG.isin(iso_ceg)

    def classe(o):
        return {"Hídrica": "hidro", "Eólica": "eolica", "Solar": "solar", "Biomassa": "biomassa"}.get(o, "outras")
    s["classe"] = s.DscOrigemCombustivel.map(classe)

    def linha(uf, d):
        tot = d.kw.sum()
        limpa = d[d.classe.isin(["hidro", "eolica", "solar"])].kw.sum()
        ren = limpa + d[d.classe == "biomassa"].kw.sum()
        iso = d[d.isolado]
        iso_t = iso.kw.sum()
        iso_l = iso[iso.classe.isin(["hidro", "eolica", "solar"])].kw.sum()
        return dict(uf=uf, ano=2026, valor=round(limpa / tot * 100, 2),
                    unidade="% da potência fiscalizada (hídrica+eólica+solar)",
                    fonte=f"ANEEL SIGA, base de {data_ref}",
                    pct_renovavel_com_biomassa=round(ren / tot * 100, 2), potencia_total_mw=round(tot / 1e3, 1),
                    potencia_limpa_mw=round(limpa / 1e3, 1), potencia_sisol_mw_parcial=round(iso_t / 1e3, 1),
                    pct_limpa_sisol_parcial=round(iso_l / iso_t * 100, 2) if iso_t else np.nan,
                    obs="foto da base indicada (rótulo 2026); SISOL só identificado para usinas com liberação "
                        "comercial registrada desde 1997 (cobertura parcial)")
    linhas = [linha(uf, s[s.SigUFPrincipal == uf]) for uf in UFS] + [linha("AL", s)]
    out = pd.DataFrame(linhas)
    gravar(out, "r_potencia_siga_uf_2026.csv")
    print(out[["uf", "valor", "pct_renovavel_com_biomassa", "potencia_total_mw", "pct_limpa_sisol_parcial"]].to_string(index=False))
    return out


# ----------------------------------------------------------------------------- 6. PNAD (SIDRA)
def sidra(url):
    r = requests.get(url, headers=UA, timeout=120)
    r.raise_for_status()
    return r.json()


def pnad():
    print("\n[6] IBGE SIDRA — acesso a energia elétrica nos domicílios (PNAD e PNAD Contínua)")
    locs = "N3[" + ",".join(str(c) for c in COD_UF.values()) + "]"
    inv = {str(v): k for k, v in COD_UF.items()}
    base = "https://servicodados.ibge.gov.br/api/v3/agregados/"
    acesso, integral = [], []
    try:  # PNAD 2001-2015, tabela 1959: domicílios com iluminação elétrica
        j = sidra(f"{base}1959/periodos/all/variaveis/96?localidades={locs}&classificacao=12058[0]|1[0]|2613[0,99676]")
        tab = {}
        for res in j[0]["resultados"]:
            cat = next(c for c in res["classificacoes"] if str(c["id"]) == "2613")["categoria"]
            cat_id = list(cat.keys())[0]
            for s in res["series"]:
                uf = inv[s["localidade"]["id"]]
                for ano, v in s["serie"].items():
                    if valor(v) is not None:
                        tab[(uf, int(ano), cat_id)] = valor(v)
        for (uf, ano, cat), v in sorted(tab.items()):
            if cat == "99676" and (uf, ano, "0") in tab:
                acesso.append(dict(uf=uf, ano=ano, valor=round(v / tab[(uf, ano, "0")] * 100, 2),
                                   unidade="% dos domicílios", fonte="IBGE, PNAD (SIDRA 1959): domicílios com iluminação elétrica",
                                   pesquisa="PNAD", obs="iluminação elétrica; sem 2010 (ano de Censo)"))
    except Exception as e:  # noqa: BLE001
        falha("SIDRA 1959 (PNAD 2001-2015)", repr(e)[:150])
    try:  # PNAD Contínua anual 2016-2025, tabela 6737: % domicílios com energia (rede geral ou fonte alternativa)
        j = sidra(f"{base}6737/periodos/all/variaveis/5074?localidades={locs}&classificacao=1[6795]|827[46296]")
        for s in j[0]["resultados"][0]["series"]:
            for ano, v in s["serie"].items():
                if valor(v) is not None:
                    acesso.append(dict(uf=inv[s["localidade"]["id"]], ano=int(ano), valor=valor(v), unidade="% dos domicílios",
                                       fonte="IBGE, PNAD Contínua anual (SIDRA 6737): energia elétrica de rede geral ou fonte alternativa",
                                       pesquisa="PNAD Contínua", obs="há quebra de série e de conceito entre 2015 (PNAD) e 2016 (PNAD Contínua)"))
    except Exception as e:  # noqa: BLE001
        falha("SIDRA 6737 (PNAD Contínua)", repr(e)[:150])
    try:  # tabela 6738: rede geral em tempo integral
        j = sidra(f"{base}6738/periodos/all/variaveis/9994?localidades={locs}&classificacao=1[6795]")
        for s in j[0]["resultados"][0]["series"]:
            for ano, v in s["serie"].items():
                if valor(v) is not None:
                    integral.append(dict(uf=inv[s["localidade"]["id"]], ano=int(ano), valor=valor(v), unidade="% dos domicílios",
                                         fonte="IBGE, PNAD Contínua anual (SIDRA 6738): energia de rede geral em tempo integral",
                                         obs="2020 e 2021 não foram divulgados"))
    except Exception as e:  # noqa: BLE001
        falha("SIDRA 6738 (PNAD Contínua)", repr(e)[:150])
    a, i = pd.DataFrame(acesso), pd.DataFrame(integral)
    if len(a):
        gravar(a.sort_values(["uf", "ano"]), "pnad_energia_eletrica_uf.csv")
    if len(i):
        gravar(i.sort_values(["uf", "ano"]), "pnad_rede_geral_integral_uf.csv")
    return a, i


# ----------------------------------------------------------------------------- 7. teste da linha de base 2025
def teste_linha_base(pop, sisol_share, siga, fdist, ons=None):
    print("\n[7] Teste de limites: dá para reproduzir o ITEQ de 2025 (60,13% na AL)?")
    ano = 2025
    pop25 = pop[pop.ano == ano].set_index("uf").populacao
    sh = sisol_share[(sisol_share.ano == ano) & (sisol_share.uf != "AL")].set_index("uf").valor / 100
    sg = siga.set_index("uf")
    fd = fdist[(fdist.ano == ano) & (fdist.uf != "AL")].set_index("uf").pct_cons_ambos_ok / 100
    r_limpa, r_renov = sg.loc["AL", "valor"] / 100, sg.loc["AL", "pct_renovavel_com_biomassa"] / 100
    PER_BASELINE = 0.6524  # baseline da ficha I4.3.2 (catalogo.json), renovabilidade da oferta de energia
    cenarios = [
        ("S1 R_SIN=limpa(SIGA) | Fdist=1 | Fiso=1", r_limpa, False),
        ("S2 R_SIN=renovavel c/ biomassa(SIGA) | Fdist=1 | Fiso=1", r_renov, False),
        ("S3 R_SIN=65,24% (baseline PER, I4.3.2) | Fdist=1 | Fiso=1", PER_BASELINE, False),
        ("S4 R_SIN=limpa(SIGA) | Fdist=% cons. dentro dos limites | Fiso=1", r_limpa, True),
        ("S5 R_SIN=renovavel c/ biomassa | Fdist=% cons. dentro dos limites | Fiso=1", r_renov, True),
        ("S6 R_SIN=65,24% | Fdist=% cons. dentro dos limites | Fiso=1", PER_BASELINE, True),
    ]
    if ons is not None and len(ons[(ons.uf == "AL") & (ons.ano == ano)]):
        r_ons = ons[(ons.uf == "AL") & (ons.ano == ano)].valor.iloc[0] / 100
        cenarios.append(("S7 R_SIN=limpa na geração SIN 2025 (ONS) | Fdist=% cons. dentro dos limites | Fiso=1", r_ons, True))
    linhas = []
    for nome, R, usa_f in cenarios:
        itq = {}
        for uf in UFS:
            r_sisol = sg.loc[uf, "pct_limpa_sisol_parcial"]
            r_sisol = 0.0 if pd.isna(r_sisol) else r_sisol / 100  # sem usina SISOL identificada -> 0 (UF sem SISOL pesa 0)
            v = (1 - sh[uf]) * R + sh[uf] * r_sisol
            itq[uf] = v * (fd[uf] if usa_f else 1.0)
        al = sum(pop25[u] * itq[u] for u in UFS) / sum(pop25[u] for u in UFS) * 100
        linhas.append(dict(cenario=nome, iteq_al_pct=round(al, 2), baseline_ficha_pct=60.13,
                           diferenca_pp=round(al - 60.13, 2), fator_residual_implicito=round(60.13 / al, 3)))
    out = pd.DataFrame(linhas)
    out["fonte"] = ("POP_SISOL: EPE ciclo 2025; POP_total: IBGE 2024; R_SIN: ANEEL SIGA / baseline PER; "
                    "R_SISOL: % limpa das usinas SISOL identificadas (parcial); Fdist: ANEEL DEC/FEC 2025")
    gravar(out, "teste_linha_base_2025.csv")
    print(out[["cenario", "iteq_al_pct", "diferenca_pp", "fator_residual_implicito"]].to_string(index=False))
    # detalhe por UF do cenário S4 (ficha com Fdist proxy)
    print("  detalhe UF (S1, sem fatores): " + ", ".join(
        f"{u} {((1 - sh[u]) * r_limpa + sh[u] * 0) * 100:.1f}" for u in UFS))
    print("  Fdist proxy 2025 por UF: " + ", ".join(f"{u} {fd[u]*100:.1f}%" for u in UFS))
    return out


# ----------------------------------------------------------------------------- 8. ITEQ proxy composto (2018-2025)
def iteq_proxy(pop, sisol_share, fdist, ons):
    """Composição dos termos com as hipóteses mais simples: Fiso=1, R_SISOL=0 (piso), Fdist=% de consumidores dentro
    dos limites, R_SIN,Amz = % limpa da geração SIN na AL (ONS). Não é o ITEQ da ficha: é um proxy para ler tendência."""
    print("\n[8] ITEQ proxy composto (Fiso=1, R_SISOL=0, Fdist=% cons. dentro dos limites, R_SIN=geração SIN limpa AL)")
    if ons is None:
        return None
    pop_ano = pop.set_index(["uf", "ano"]).populacao
    sh = sisol_share[sisol_share.uf != "AL"].set_index(["uf", "ano"]).valor / 100
    fd = fdist[fdist.uf != "AL"].set_index(["uf", "ano"]).pct_cons_ambos_ok / 100
    r = ons[ons.uf == "AL"].set_index("ano").valor / 100
    linhas = []
    for ano in sorted(sisol_share.ano.unique()):
        if ano not in r.index:
            continue
        itq = {}
        for uf in UFS:
            f = fd.get((uf, ano))
            if f is None or pd.isna(f):
                continue
            bruto = (1 - sh[(uf, ano)]) * r[ano]
            itq[uf] = (bruto, bruto * f)
            linhas.append(dict(uf=uf, ano=ano, valor=round(bruto * f * 100, 2), unidade="% (0 a 100), proxy do ITEQ",
                               fonte="composição: POP_SISOL (EPE) x R_SIN (ONS) x Fdist proxy (ANEEL); Fiso=1; R_SISOL=0",
                               valor_sem_fdist=round(bruto * 100, 2),
                               r_sin_al=round(r[ano] * 100, 2), share_sisol=round(sh[(uf, ano)] * 100, 3),
                               fdist_proxy=round(f * 100, 2)))
        if len(itq) == len(UFS):
            pt = sum(pop_ano[(u, ano)] for u in UFS)
            w_b = sum(pop_ano[(u, ano)] * itq[u][0] for u in UFS) / pt
            w_f = sum(pop_ano[(u, ano)] * itq[u][1] for u in UFS) / pt
            linhas.append(dict(uf="AL", ano=ano, valor=round(w_f * 100, 2), unidade="% (0 a 100), proxy do ITEQ",
                               fonte="composição: POP_SISOL (EPE) x R_SIN (ONS) x Fdist proxy (ANEEL); Fiso=1; R_SISOL=0; "
                                     "média das UFs ponderada pela população (IBGE)", valor_sem_fdist=round(w_b * 100, 2),
                               r_sin_al=round(r[ano] * 100, 2)))
    out = pd.DataFrame(linhas)
    out["obs"] = ("proxy: omite Fiso e R_SISOL, usa energia (ONS) no lugar de potência em R_SIN e agrega por UF, não por "
                  "município; NÃO reproduz a linha de base de 60,13% (ver teste_linha_base_2025.csv)")
    gravar(out, "iteq_proxy_uf_ano.csv")
    print(out[out.uf == "AL"][["ano", "valor", "valor_sem_fdist", "r_sin_al"]].to_string(index=False))
    return out


# ----------------------------------------------------------------------------- principal
def main():
    sem_ons = "--sem-ons" in sys.argv
    t0 = time.time()
    print("Raiz:", RAIZ)
    pop = populacao_uf()
    print("  população IBGE (projeção 2024), 2025:", {u: int(pop[(pop.uf == u) & (pop.ano == 2025)].populacao.iloc[0]) for u in UFS})
    _, share = serie_pop_sisol(pop)
    dec, fec = anuario()
    fd = aneel_dec_fec(dec, fec)
    ons = None
    if sem_ons:
        print("\n[4] ONS pulado (--sem-ons)")
    else:
        ons = ons_geracao()
    siga = siga_potencia()
    pnad()
    teste_linha_base(pop, share, siga, fd, ons)
    iteq_proxy(pop, share, fd, ons)
    print(f"\nFalhas/avisos registrados ({len(FALHAS)}):")
    for rota, res in FALHAS:
        print("  -", rota, "->", res)
    print(f"\nConcluído em {time.time() - t0:.0f}s. Saídas em {SAIDA}")


if __name__ == "__main__":
    main()
