#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 4.1 / I4.1.1 — séries históricas para o IBC-AMZ (ANATEL).

Coletor reprodutível. Roda do zero com:  python scripts/eixo4_series_ibc.py
(a partir da raiz do projeto; precisa de pandas, numpy e requests). Baixa só os trechos necessários dos zips
grandes da ANATEL (HTTP Range) e guarda extratos filtrados (9 estados) em dados/eixo4_series/I4.1.1/bruto/.

Séries gravadas em dados/eixo4_series/I4.1.1/ (um CSV por série):

  1. ibc_ponderado_pop_uf_ano.csv — IBC-AMZ ponderado pela população municipal (Censo 2022, SIDRA 4709),
     2021-2025, por UF e AL, a partir do IBC municipal oficial (ibc.zip do painel Meu Município).
     2024 e 2025 reproduzem o painel; 2021-2023 são da metodologia v1 (descontinuidade em 2024).
  2. Componentes do IBC reconstruídos dos dados abertos de acessos da ANATEL, por UF (e AL), dezembro:
     densidade_smp_v1, densidade_scm_v1, hhi_smp, hhi_scm (definições do IBC v1, 2021-2023, testadas contra
     o IBC estadual), densidade_smp_4g5g_v2 e densidade_scm_100mbps_v2 (definições v2), erb_por_10mil_hab
     (estações SMP; proxy), cobertura_pop_4g5g e municipios_backhaul_fibra (publicados, 2021-2025) e
     validacao_componentes_vs_ibc_estadual.csv (conferência numérica).
  3. ibc_nucleo_v2_ponderado_uf_ano.csv — reconstrução do IBC na regra v2 (sem a cobertura agrícola) para
     2021-2025, sem a quebra de metodologia (proxy).
  4. PNAD Contínua TIC (SIDRA 7307, 7325, 7342), 2016-2025 (sem 2020): contexto.
  Arquivos de apoio: validacao_componentes_vs_ibc_estadual.csv, validacao_nucleo_v2_vs_publicado.csv,
  populacao_uf_denominador.csv, populacao_municipal_denominadores.csv.
"""
import csv
import io
import os
import sys
import urllib.request
import zipfile

import numpy as np
import pandas as pd

BASE = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(BASE)
DADOS = os.path.join(RAIZ, "dados")
SAIDA = os.path.join(DADOS, "eixo4_series", "I4.1.1")
BRUTO = os.path.join(SAIDA, "bruto")
UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
HDR = {"User-Agent": "Mozilla/5.0"}

URL_IBC_ZIP = "https://www.anatel.gov.br/dadosabertos/paineis_de_dados/meu_municipio/ibc.zip"
URL_POP_CENSO = "https://apisidra.ibge.gov.br/values/t/4709/n6/all/v/93/p/2022?formato=json"

os.makedirs(BRUTO, exist_ok=True)


def baixar(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    print("baixando", url)
    req = urllib.request.Request(url, headers=HDR)
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    return dest


def gravar(df, nome):
    p = os.path.join(SAIDA, nome)
    df.to_csv(p, index=False, encoding="utf-8")
    print("gravado", os.path.relpath(p, RAIZ), len(df), "linhas")
    return p


# ---------------------------------------------------------------------------
# Leitura de membros de zips grandes via HTTP Range (sem baixar o zip inteiro)
# ---------------------------------------------------------------------------
import struct
import time
import zlib

import requests

URL_ACESSOS = "https://www.anatel.gov.br/dadosabertos/paineis_de_dados/acessos/{}.zip"
TMP = os.path.join(BRUTO, "_tmp")  # compactados baixados; apagados após o processamento
os.makedirs(TMP, exist_ok=True)


class _HTTPFile(io.RawIOBase):
    """Arquivo somente leitura sobre HTTP Range (usado só para ler o diretório central do zip)."""

    def __init__(self, url):
        self.url = url
        r = requests.head(url, headers=HDR, allow_redirects=True, timeout=60)
        self.size = int(r.headers["content-length"])
        self.pos = 0
        self.s = requests.Session()

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, o, w=0):
        self.pos = o if w == 0 else (self.pos + o if w == 1 else self.size + o)
        return self.pos

    def readinto(self, b):
        n = min(len(b), self.size - self.pos)
        if n <= 0:
            return 0
        for _ in range(5):
            try:
                r = self.s.get(self.url, headers={**HDR, "Range": f"bytes={self.pos}-{self.pos + n - 1}"}, timeout=180)
                if r.status_code == 206:
                    break
            except requests.RequestException:
                time.sleep(2)
        assert r.status_code == 206, r.status_code
        b[:n] = r.content[:n]
        self.pos += n
        return n


def _info_membro(url, nome):
    z = zipfile.ZipFile(io.BufferedReader(_HTTPFile(url), buffer_size=4 << 20))
    return z.getinfo(nome)


def baixar_membro(zipnome, nome):
    """Baixa só o trecho comprimido de um membro do zip (com retomada) para BRUTO/_tmp. Devolve (caminho, info)."""
    url = URL_ACESSOS.format(zipnome)
    info = _info_membro(url, nome)
    assert info.compress_type == zipfile.ZIP_DEFLATED
    dest = os.path.join(TMP, nome + ".deflate")
    if os.path.exists(dest) and os.path.getsize(dest) == info.compress_size:
        return dest, info
    r = requests.get(url, headers={**HDR, "Range": f"bytes={info.header_offset}-{info.header_offset + 29}"}, timeout=120)
    n, m = struct.unpack("<HH", r.content[26:30])
    ini = info.header_offset + 30 + n + m
    feito = os.path.getsize(dest) if os.path.exists(dest) else 0
    print(f"baixando {zipnome}/{nome} ({info.compress_size / 1e6:.0f} MB comprimidos)")
    while feito < info.compress_size:
        try:
            with requests.get(url, headers={**HDR, "Range": f"bytes={ini + feito}-{ini + info.compress_size - 1}"},
                              stream=True, timeout=120) as rr:
                assert rr.status_code == 206, rr.status_code
                with open(dest, "ab") as f:
                    for ch in rr.iter_content(1 << 20):
                        f.write(ch)
                        feito += len(ch)
        except requests.RequestException as e:
            print("  retomando após erro:", e)
            time.sleep(3)
            feito = os.path.getsize(dest)
    return dest, info


class _Inflate(io.RawIOBase):
    def __init__(self, path):
        self.f = open(path, "rb")
        self.d = zlib.decompressobj(-15)
        self.buf = b""

    def readable(self):
        return True

    def readinto(self, b):
        while len(self.buf) < len(b):
            c = self.f.read(1 << 20)
            if not c:
                self.buf += self.d.flush()
                break
            self.buf += self.d.decompress(c)
        n = min(len(b), len(self.buf))
        b[:n] = self.buf[:n]
        self.buf = self.buf[n:]
        return n

    def close(self):
        self.f.close()
        super().close()


def ler_membro(zipnome, nome, usecols, filtro, chunksize=1_000_000, **kw):
    """Itera sobre o CSV de um membro do zip, aplicando `filtro(df)` a cada bloco; devolve o concat."""
    dest, _ = baixar_membro(zipnome, nome)
    partes = []
    raw = _Inflate(dest)
    rd = io.BufferedReader(raw, buffer_size=8 << 20)
    for ch in pd.read_csv(rd, sep=";", encoding="utf-8-sig", usecols=usecols, chunksize=chunksize,
                          dtype=str, **kw):
        ch = filtro(ch)
        if len(ch):
            partes.append(ch)
    raw.close()
    return pd.concat(partes, ignore_index=True) if partes else pd.DataFrame(columns=usecols)




URL_METODOLOGIAS = {
    "metodologia_ibc_2021_2023.pdf": "https://sei.anatel.gov.br/sei/modulos/pesquisa/md_pesq_documento_consulta_externa.php?eEP-wqk1skrd8hSlk5Z3rN4EVg9uLJqrLYJw_9INcO4Yxr9JzBx7a7a-byGQcbkUEkzeU9BmRq4_-adGjI7QmqTMASmADG4JO_jAaJDUwJTUMoFW4XiMvcquOtvF6Jqw",
    "metodologia_ibc_2024.pdf": "https://sei.anatel.gov.br/sei/modulos/pesquisa/md_pesq_documento_consulta_externa.php?HWH32bONvibUcMC3mewfUpIX7e-9fyZZC4iEjI2QHwXAoLCOrVZwNzRf5vR3YcCMWNZ4eCgQDLmVzIOFPcg7Rh3LXmDlNOEykOjxWvmQHMFng9whS0n__BgQ9jRf8MdF",
}


def baixar_metodologias():
    """Relatórios metodológicos do IBC (v1 2021-2023 e v2 2024+), só para consulta; não entram nos cálculos."""
    for nome, url in URL_METODOLOGIAS.items():
        dest = os.path.join(BRUTO, nome)
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            continue
        try:
            r = requests.get(url, headers=HDR, timeout=120)
            if r.ok and r.content[:4] == b"%PDF":
                open(dest, "wb").write(r.content)
        except requests.RequestException as e:
            print("metodologia não baixada (opcional):", nome, e)

# ---------------------------------------------------------------------------
# Extratos dos dados abertos de acessos (ANATEL), só AL e só os meses pedidos
# ---------------------------------------------------------------------------
EXTR = os.path.join(BRUTO, "extratos")
os.makedirs(EXTR, exist_ok=True)


def _filtrar_agregar(chave, meses):
    def f(d):
        d = d[d["UF"].isin(UFS)]
        if meses is not None:
            d = d[d["Mês"].isin([str(x) for x in meses])]
        if not len(d):
            return d
        d = d.copy()
        d["Acessos"] = pd.to_numeric(d["Acessos"], errors="coerce").fillna(0)
        return d.groupby(chave, dropna=False, as_index=False)["Acessos"].sum()
    return f


def extrato_smp(ano, sem, meses=None):
    """SMP (telefonia móvel) por município/empresa/geração. 2019+ (antes disso só há UF/DDD)."""
    nome = f"Acessos_Telefonia_Movel_{ano}_{sem}S.csv"
    out = os.path.join(EXTR, f"smp_{ano}_{sem}S.csv.gz")
    if os.path.exists(out):
        return pd.read_csv(out, dtype=str)
    chave = ["Ano", "Mês", "UF", "Código IBGE Município", "Grupo Econômico", "Empresa", "Tecnologia Geração",
             "Tipo de Produto"]
    df = ler_membro("acessos_telefonia_movel", nome, chave + ["Acessos"], _filtrar_agregar(chave, meses))
    df = df.groupby(chave, dropna=False, as_index=False)["Acessos"].sum()
    df.to_csv(out, index=False, compression="gzip")
    os.remove(os.path.join(TMP, nome + ".deflate"))
    return df


def extrato_scm(arquivo, meses=None):
    """SCM (banda larga fixa) por município/empresa/faixa de velocidade. `arquivo` = nome do CSV no zip."""
    out = os.path.join(EXTR, "scm_" + arquivo.replace("Acessos_Banda_Larga_Fixa_", "").replace(".csv", "") + ".csv.gz")
    if os.path.exists(out):
        return pd.read_csv(out, dtype=str)
    # cabeçalhos mudam entre os arquivos: lê o que existir
    dest, _ = baixar_membro("acessos_banda_larga_fixa", arquivo)
    raw = _Inflate(dest)
    cab = io.BufferedReader(raw, buffer_size=1 << 20).readline().decode("utf-8-sig").strip().split(";")
    raw.close()
    cand = ["Ano", "Mês", "UF", "Código IBGE Município", "Grupo Econômico", "Empresa", "Faixa de Velocidade",
            "Velocidade", "Tecnologia", "Tipo de Produto", "Tipo de Pessoa"]
    chave = [c for c in cand if c in cab]
    df = ler_membro("acessos_banda_larga_fixa", arquivo, chave + ["Acessos"], _filtrar_agregar(chave, meses))
    df = df.groupby(chave, dropna=False, as_index=False)["Acessos"].sum()
    df.to_csv(out, index=False, compression="gzip")
    os.remove(os.path.join(TMP, arquivo + ".deflate"))
    return df


def extrato_smp_antigo(meses=(12,)):
    """SMP 2005-2018: só UF/DDD (sem município e sem tipo de produto). Mantém dezembro."""
    nome = "Acessos_Telefonia_Movel_2005-2018_Tecnologia.csv"
    out = os.path.join(EXTR, "smp_2005_2018.csv.gz")
    if os.path.exists(out):
        return pd.read_csv(out, dtype=str)
    chave = ["Ano", "Mês", "UF", "Grupo Econômico", "Empresa", "Tecnologia Geração"]
    df = ler_membro("acessos_telefonia_movel", nome, chave + ["Acessos"], _filtrar_agregar(chave, list(meses)))
    df = df.groupby(chave, dropna=False, as_index=False)["Acessos"].sum()
    df.to_csv(out, index=False, compression="gzip")
    os.remove(os.path.join(TMP, nome + ".deflate"))
    return df



def extrato_erb():
    """Estações do SMP (snapshot atual do licenciamento, ANATEL): só as dos 9 estados, colunas úteis."""
    out = os.path.join(EXTR, "estacoes_smp_AL.csv.gz")
    if os.path.exists(out):
        return pd.read_csv(out, dtype=str)
    nome = "Estacoes_SMP.csv"
    cols = ["Número Fistel", "Número Estação", "Tecnologia", "Geração", "Data Primeiro Licenciamento",
            "Data Licenciamento", "AnoMesLic", "Situacao", "Empresa Estação", "Código IBGE", "UF",
            "Latitude decimal", "Longitude decimal", "Entidade"]
    dest = os.path.join(TMP, nome + ".deflate")
    url = "https://www.anatel.gov.br/dadosabertos/paineis_de_dados/outorga_e_licenciamento/estacoes_smp.zip"
    info = _info_membro(url, nome)
    if not (os.path.exists(dest) and os.path.getsize(dest) == info.compress_size):
        r = requests.get(url, headers={**HDR, "Range": f"bytes={info.header_offset}-{info.header_offset + 29}"}, timeout=120)
        n, m = struct.unpack("<HH", r.content[26:30])
        ini = info.header_offset + 30 + n + m
        feito = os.path.getsize(dest) if os.path.exists(dest) else 0
        print("baixando", nome, f"({info.compress_size / 1e6:.0f} MB comprimidos)")
        while feito < info.compress_size:
            try:
                with requests.get(url, headers={**HDR, "Range": f"bytes={ini + feito}-{ini + info.compress_size - 1}"},
                                  stream=True, timeout=120) as rr:
                    assert rr.status_code == 206
                    with open(dest, "ab") as f:
                        for ch in rr.iter_content(1 << 20):
                            f.write(ch)
                            feito += len(ch)
            except requests.RequestException:
                time.sleep(3)
                feito = os.path.getsize(dest)
    partes = []
    raw = _Inflate(dest)
    rd = io.BufferedReader(raw, buffer_size=8 << 20)
    for ch in pd.read_csv(rd, sep=";", encoding="utf-8-sig", usecols=cols, chunksize=500_000, dtype=str):
        ch = ch[ch.UF.isin(UFS)]
        if len(ch):
            partes.append(ch)
    raw.close()
    df = pd.concat(partes, ignore_index=True)
    df.to_csv(out, index=False, compression="gzip")
    os.remove(dest)
    return df

# ---------------------------------------------------------------------------
# População (denominador das densidades), igual à usada pela ANATEL no IBC
# ---------------------------------------------------------------------------
COD_UF = {"RO": "11", "AC": "12", "AM": "13", "RR": "14", "PA": "15", "AP": "16", "TO": "17", "MA": "21", "MT": "51"}
UF_COD = {v: k for k, v in COD_UF.items()}
SIDRA = "https://apisidra.ibge.gov.br/values"


def sidra(path):
    for _ in range(4):
        try:
            r = requests.get(SIDRA + path, headers=HDR, timeout=180)
            if r.status_code == 200:
                return r.json()
        except requests.RequestException:
            pass
        time.sleep(3)
    raise RuntimeError("SIDRA falhou: " + path)


def populacao_uf():
    """População por UF e ano usada como denominador (confere com a implícita nos acessos/densidade da ANATEL):
    estimativas IBGE (SIDRA 6579) 2008-2009, 2011-2021 e 2024; Censo 2010 (SIDRA 202); Censo 2022 (soma dos
    municípios, SIDRA 4709) para 2022 e 2023; 2025 repete a estimativa de 2024 (como o IBC 2025 da ANATEL)."""
    out = os.path.join(SAIDA, "populacao_uf_denominador.csv")
    ufs = ",".join(COD_UF[u] for u in UFS)
    rows = []
    j = sidra(f"/t/6579/n3/{ufs}/p/all/v/9324?formato=json")
    for x in j[1:]:
        if 2008 <= int(x["D2C"]) <= 2024:
            rows.append((UF_COD[x["D1C"]], int(x["D2C"]), float(x["V"]), "IBGE estimativas (SIDRA 6579)"))
    j = sidra(f"/t/202/n3/{ufs}/v/93/p/2010/c1/0/c2/0?formato=json")
    for x in j[1:]:
        rows.append((UF_COD[x["D1C"]], 2010, float(x["V"]), "IBGE Censo 2010 (SIDRA 202)"))
    pm = carregar_pop_censo2022()
    pm["uf"] = pm.cod_ibge.str[:2].map(UF_COD)
    for u, v in pm.dropna(subset=["uf"]).groupby("uf").populacao.sum().items():
        for a in (2022, 2023):
            rows.append((u, a, float(v), "IBGE Censo 2022 (SIDRA 4709, soma dos municípios)"))
    df = pd.DataFrame(rows, columns=["uf", "ano", "populacao", "fonte"])
    est24 = df[(df.ano == 2024)].copy()
    est24["ano"] = 2025
    est24["fonte"] = "repete a estimativa IBGE 2024 (convenção do IBC 2025)"
    df = pd.concat([df, est24]).sort_values(["uf", "ano"]).reset_index(drop=True)
    df.to_csv(out, index=False)
    return df


# ---------------------------------------------------------------------------
# 3. PNAD Contínua TIC (SIDRA) — contexto
# ---------------------------------------------------------------------------
def serie_pnad_tic():
    ufs = ",".join(COD_UF[u] for u in UFS)
    rows = []
    # 7307: domicílios por existência de utilização da internet (% — var 9784; Situação = Total)
    j = sidra(f"/t/7307/n3/{ufs}/p/all/v/9784/c1/0/c688/all?formato=json")
    for x in j[1:]:
        if x["D5N"] == "Havia utilização de internet" and x["V"] not in ("-", "..", "..."):
            rows.append((UF_COD[x["D1C"]], int(x["D2C"]), "domicilios_com_internet_pct", float(x["V"]),
                         "% dos domicílios", "PNAD Contínua TIC, SIDRA 7307 (v. 9784)"))
    # 7325: pessoas 10+ que utilizaram a internet (% — var 10648; Sexo = Total)
    j = sidra(f"/t/7325/n3/{ufs}/p/all/v/10648/c2/0/c422/all?formato=json")
    for x in j[1:]:
        if x["D5N"] == "Utilizaram internet" and x["V"] not in ("-", "..", "..."):
            rows.append((UF_COD[x["D1C"]], int(x["D2C"]), "pessoas_10mais_usaram_internet_pct", float(x["V"]),
                         "% das pessoas de 10 anos ou mais", "PNAD Contínua TIC, SIDRA 7325 (v. 10648)"))
    # 7342: domicílios com internet por tipo de conexão (% dos domicílios com internet — var 10630)
    j = sidra(f"/t/7342/n3/{ufs}/p/all/v/10630/c691/all?formato=json")
    alvo = {"Banda larga fixa": "dom_internet_banda_larga_fixa_pct"}
    for x in j[1:]:
        if x["D4N"] in alvo and x["V"] not in ("-", "..", "..."):
            rows.append((UF_COD[x["D1C"]], int(x["D2C"]), alvo[x["D4N"]], float(x["V"]),
                         "% dos domicílios com internet", "PNAD Contínua TIC, SIDRA 7342 (v. 10630)"))
    df = pd.DataFrame(rows, columns=["uf", "ano", "indicador", "valor", "unidade", "fonte"])
    df["uf"] = pd.Categorical(df.uf, UFS, ordered=True)
    df = df.sort_values(["indicador", "uf", "ano"]).reset_index(drop=True)
    arquivos = {"domicilios_com_internet_pct": "pnad_tic_domicilios_internet_uf_ano.csv",
                "pessoas_10mais_usaram_internet_pct": "pnad_tic_pessoas_internet_uf_ano.csv",
                "dom_internet_banda_larga_fixa_pct": "pnad_tic_banda_larga_fixa_domicilios_uf_ano.csv"}
    for nome in sorted(set(arquivos.values())):
        gravar(df[df.indicador.map(arquivos) == nome], nome)
    return df


def serie_cobertura_fibra():
    """Cobertura populacional 4G/5G e proporção de municípios com backhaul de fibra, por UF, como publicados no
    IBC estadual da ANATEL (2021-2025). Não existe histórico aberto anterior a 2021."""
    _, uf = carregar_ibc_municipal()
    u = uf[uf.UF.isin(UFS)].copy()
    u["uf"] = u.UF
    u["ano"] = u.Ano
    out = pd.concat([
        pd.DataFrame({"uf": u.uf, "ano": u.ano, "indicador": "cobertura_pop_4g5g_pct",
                      "valor": (u["Cobertura Pop. 4G5G"] * 100).round(2), "unidade": "% da população coberta (4G ou superior)"}),
        pd.DataFrame({"uf": u.uf, "ano": u.ano, "indicador": "municipios_com_backhaul_fibra_pct",
                      "valor": (u["Fibra"] * 100).round(2), "unidade": "% dos municípios com backhaul de fibra"})])
    out["fonte"] = "ANATEL, IBC estadual (Meu Município, ibc.zip), indicadores originais"
    out["uf"] = pd.Categorical(out.uf, UFS, ordered=True)
    out = out.sort_values(["indicador", "uf", "ano"]).reset_index(drop=True)
    gravar(out[out.indicador == "cobertura_pop_4g5g_pct"], "cobertura_pop_4g5g_uf_ano.csv")
    gravar(out[out.indicador == "municipios_com_backhaul_fibra_pct"], "municipios_backhaul_fibra_uf_ano.csv")
    return out


# ---------------------------------------------------------------------------
# 2. Componentes do IBC v1 (2021-2023) reconstruídos dos dados abertos e estendidos para trás
# ---------------------------------------------------------------------------
PROD_PADRAO = ["VOZ+DADOS", "DADOS", "VOZ"]  # SMP sem M2M e sem ponto de serviço (confere com o IBC v1)
# Faixas da ANATEL -> peso v1 (<=2 Mbps: 0,1; 2-10 Mbps: 0,35; >10 Mbps: 1). "2Mbps a 12Mbps" é tratada como média;
# "2Mbps a 34Mbps" (só 2007-2010, 5-15% dos acessos) também como média (0,35). Com peso 1,0 nessa faixa, a densidade
# de 2007-2010 subiria até ~0,5 acesso ponderado por 100 hab. (coluna `sensibilidade_faixa_2a34` em densidade_scm_v1).
FAIXA_V1 = {"0Kbps a 64Kbps": 0.1, "0Kbps a 512Kbps": 0.1, "64Kbps a 512Kbps": 0.1, "512kbps a 2Mbps": 0.1,
            "2Mbps a 12Mbps": 0.35, "2Mbps a 34Mbps": 0.35, "12Mbps a 34Mbps": 1.0, "> 34Mbps": 1.0}
GER_V1 = {"2G": 0.1, "3G": 0.35, "4G": 1.0, "5G": 1.0}
SOMA_PESOS = 1.45  # 1 + 0,35 + 0,1: divisor que reproduz as densidades do IBC v1 (testado, 2021, 9 UFs)


def carregar_scm():
    ps = []
    for f in sorted(os.listdir(EXTR)):
        if f.startswith("scm_") and f.endswith(".csv.gz"):
            d = pd.read_csv(os.path.join(EXTR, f), dtype=str)
            ps.append(d)
    d = pd.concat(ps, ignore_index=True)
    d["Ano"] = d.Ano.astype(int)
    d["Mês"] = d["Mês"].astype(int)
    d["Acessos"] = d.Acessos.astype(float)
    d["v"] = pd.to_numeric(d["Velocidade"].str.replace(",", "."), errors="coerce") if "Velocidade" in d else np.nan
    return d


def carregar_smp():
    ps = []
    for f in sorted(os.listdir(EXTR)):
        if f.startswith("smp_") and f.endswith(".csv.gz"):
            ps.append(pd.read_csv(os.path.join(EXTR, f), dtype=str))
    d = pd.concat(ps, ignore_index=True)
    d["Ano"] = d.Ano.astype(int)
    d["Mês"] = d["Mês"].astype(int)
    d["Acessos"] = d.Acessos.astype(float)
    return d



# ---------------------------------------------------------------------------
# 1. IBC ponderado pela população municipal
# ---------------------------------------------------------------------------
def carregar_ibc_municipal():
    """IBC municipal (original) 2021-2025 dos 9 estados. Reusa dados/anatel/ibc.zip."""
    local = os.path.join(DADOS, "anatel", "ibc.zip")
    zpath = local if os.path.exists(local) else baixar(URL_IBC_ZIP, os.path.join(BRUTO, "ibc.zip"))
    with zipfile.ZipFile(zpath) as z:
        mun = pd.read_csv(z.open("IBC_municipios_indicadores_originais.csv"), sep=";", decimal=",",
                          encoding="utf-8-sig", dtype={"Código Município": str})
        uf = pd.read_csv(z.open("IBC_UF_indicadores_originais.csv"), sep=";", decimal=",",
                         encoding="utf-8-sig")
    return mun, uf


def carregar_pop_censo2022():
    """População municipal, Censo 2022 (SIDRA 4709, variável 93). Mesmos pesos do script do painel."""
    local = os.path.join(DADOS, "ibge_pop", "pop_mun_censo2022.csv")
    if not (os.path.exists(local) and os.path.getsize(local) > 100):
        local = os.path.join(BRUTO, "pop_mun_censo2022.csv")
        if not os.path.exists(local):
            import json
            print("baixando SIDRA 4709")
            req = urllib.request.Request(URL_POP_CENSO, headers=HDR)
            dados = json.loads(urllib.request.urlopen(req, timeout=300).read().decode("utf-8"))
            with open(local, "w", newline="", encoding="utf-8") as f:
                w = csv.writer(f)
                w.writerow(["cod_ibge", "municipio", "populacao"])
                for x in dados[1:]:
                    w.writerow([x["D1C"], x["D1N"], x["V"].replace(".", "")])
    pop = pd.read_csv(local, dtype={"cod_ibge": str})
    assert len(pop) >= 5500, "população municipal incompleta"
    return pop


def serie1_ibc_ponderado():
    mun, uf = carregar_ibc_municipal()
    pop = carregar_pop_censo2022()
    m = mun[mun.UF.isin(UFS)].merge(pop[["cod_ibge", "populacao"]], left_on="Código Município",
                                    right_on="cod_ibge", how="left")
    assert m.populacao.notna().all()
    m["w"] = m.IBC * m.populacao
    rows = []
    for (u, a), d in m.groupby(["UF", "Ano"]):
        rows.append((u, int(a), d.w.sum() / d.populacao.sum()))
    for a, d in m.groupby("Ano"):
        rows.append(("AL", int(a), d.w.sum() / d.populacao.sum()))
    df = pd.DataFrame(rows, columns=["uf", "ano", "valor"])
    df["valor"] = df.valor.round(2)
    df["unidade"] = "pontos (0-100)"
    df["fonte"] = ("ANATEL, IBC municipal (Meu Município, ibc.zip) ponderado pela população municipal "
                   "do Censo 2022 (IBGE, SIDRA 4709)")
    df["metodologia"] = df.ano.map(lambda a: "v1 (2021-2023)" if a <= 2023 else "v2 (2024+)")
    # atenção: "AL" no arquivo da ANATEL é Alagoas; a linha AL desta série (Amazônia Legal) fica sem IBC estadual
    ufs = uf[uf.UF.isin(UFS)][["UF", "Ano", "IBC"]].rename(
        columns={"UF": "uf", "Ano": "ano", "IBC": "ibc_estadual_anatel"})
    df = df.merge(ufs, on=["uf", "ano"], how="left")
    df["uf"] = pd.Categorical(df.uf, UFS + ["AL"], ordered=True)
    df = df.sort_values(["uf", "ano"]).reset_index(drop=True)
    gravar(df, "ibc_ponderado_pop_uf_ano.csv")
    return df



def _pop_series():
    pop = populacao_uf()
    return pop.set_index(["uf", "ano"]).populacao


def comp_densidade_smp_v1(smp, pop):
    """Densidade ponderada de acessos móveis (IBC v1): (4G+5G + 0,35*3G + 0,1*2G)/(1,45*pop)*100, dezembro.
    A partir de 2019 só entram VOZ+DADOS, DADOS e VOZ (sem M2M e ponto de serviço); antes, o arquivo da ANATEL
    não traz tipo de produto (M2M vem marcado como 'geração' e fica de fora; ponto de serviço não dá para tirar)."""
    d = smp[smp["Mês"] == 12].copy()
    d["w"] = d["Tecnologia Geração"].map(GER_V1)
    assert set(d[d.w.isna()]["Tecnologia Geração"].dropna()) <= {"M2M"}, "geração SMP sem peso"
    d = d[d.w.notna() & (d["Tipo de Produto"].isin(PROD_PADRAO) | d["Tipo de Produto"].isna())]
    g = (d.Acessos * d.w).groupby([d.UF, d.Ano]).sum().rename("num").reset_index()
    return _densidade(g, pop)


def comp_densidade_scm_v1(scm, pop):
    """Densidade ponderada de acessos SCM por faixa de velocidade (IBC v1): (0,1*<=2Mbps + 0,35*2-10 + >10)/(1,45*pop)*100.
    2021+: velocidade contratada exata; antes: faixas da ANATEL (2 a 12 Mbps tratada como média)."""
    d = scm[scm["Mês"] == 12].copy()
    d["w_faixa"] = d["Faixa de Velocidade"].map(FAIXA_V1)
    assert d.w_faixa.notna().all(), sorted(d[d.w_faixa.isna()]["Faixa de Velocidade"].unique())
    d["w_exato"] = np.where(d.v <= 2, 0.1, np.where(d.v <= 10, 0.35, 1.0))
    d.loc[d.v.isna(), "w_exato"] = np.nan
    d["w"] = d.w_exato.where(d.Ano >= 2021, d.w_faixa)
    d["origem"] = np.where(d.Ano >= 2021, "velocidade exata", "faixas de velocidade")
    g = (d.Acessos * d.w).groupby([d.UF, d.Ano]).sum().rename("num").reset_index()
    out = _densidade(g, pop)
    gf = (d.Acessos * d.w_faixa).groupby([d.UF, d.Ano]).sum().rename("num").reset_index()
    out = out.merge(_densidade(gf, pop)[["uf", "ano", "valor"]].rename(columns={"valor": "valor_so_faixas"}),
                    on=["uf", "ano"])
    out["origem"] = np.where(out.ano >= 2021, "velocidade exata", "faixas de velocidade")
    w_alt = d.w_faixa.where(d["Faixa de Velocidade"] != "2Mbps a 34Mbps", 1.0)
    ga = (d.Acessos * w_alt).groupby([d.UF, d.Ano]).sum().rename("num").reset_index()
    out = out.merge(_densidade(ga, pop)[["uf", "ano", "valor"]].rename(columns={"valor": "sensibilidade_faixa_2a34"}),
                    on=["uf", "ano"])
    return out


def _densidade(g, pop, divisor=SOMA_PESOS):
    g = g.rename(columns={"UF": "uf", "Ano": "ano"})
    g["pop"] = [pop.get((u, a), np.nan) for u, a in zip(g.uf, g.ano)]
    g = g[g["pop"].notna()].copy()
    # AL: soma dos 9 estados
    tot = g.groupby("ano")[["num", "pop"]].sum().reset_index()
    tot["uf"] = "AL"
    g = pd.concat([g, tot], ignore_index=True)
    g["valor"] = g.num / g["pop"] / divisor * 100
    g = _com_pop_fixa(g, pop, g.num / divisor * 100)
    return g[["uf", "ano", "valor", "num", "pop", "valor_pop2022"]]


def _com_pop_fixa(g, pop, numerador):
    """Coluna `valor_pop2022`: mesmo numerador, mas com a população do Censo 2022 em todos os anos (sem os saltos
    que a troca de denominador estimativa -> Censo 2022 -> estimativa 2024 provoca no valor oficial)."""
    fixa = {u: pop.get((u, 2022), np.nan) for u in UFS}
    fixa["AL"] = sum(fixa[u] for u in UFS)
    g = g.copy()
    g["valor_pop2022"] = numerador / g.uf.map(fixa)
    return g


def comp_hhi(df):
    """HHI (0-10000) das participações das empresas (acessos) por UF, dezembro; AL = mercado conjunto dos 9 estados."""
    d = df[df["Mês"] == 12]
    g = d.groupby(["UF", "Ano", "Empresa"]).Acessos.sum()
    t = g.groupby(["UF", "Ano"]).transform("sum")
    uf = ((g / t) ** 2 * 10000).groupby(["UF", "Ano"]).sum().rename("valor").reset_index()
    ga = d.groupby(["Ano", "Empresa"]).Acessos.sum()
    ta = ga.groupby("Ano").transform("sum")
    al = ((ga / ta) ** 2 * 10000).groupby("Ano").sum().rename("valor").reset_index()
    al["UF"] = "AL"
    out = pd.concat([uf, al], ignore_index=True).rename(columns={"UF": "uf", "Ano": "ano"})
    return out[["uf", "ano", "valor"]]


def populacao_municipal():
    """Denominadores municipais: estimativas IBGE 2021 e 2024 (SIDRA 6579, N6) e Censo 2022 (SIDRA 4709)."""
    out = os.path.join(SAIDA, "populacao_municipal_denominadores.csv")
    if os.path.exists(out):
        return pd.read_csv(out, dtype={"cod": str})
    rows = {}
    for u, c in COD_UF.items():
        j = sidra(f"/t/6579/n6/in%20n3%20{c}/p/2021,2024/v/9324?formato=json")
        for x in j[1:]:
            v = pd.to_numeric(x["V"], errors="coerce")
            if pd.notna(v):
                rows.setdefault(x["D1C"], {})[f"pop_est{x['D2C']}"] = v
    df = pd.DataFrame.from_dict(rows, orient="index").rename_axis("cod").reset_index()
    cen = carregar_pop_censo2022().rename(columns={"cod_ibge": "cod", "populacao": "pop_censo2022"})
    df = df.merge(cen[["cod", "pop_censo2022"]], on="cod", how="inner")
    df["uf"] = df.cod.str[:2].map(UF_COD)
    df.to_csv(out, index=False)
    return df


def densidades_v2_municipio(smp, scm):
    """Densidades do IBC v2 por município e ano (2021-2025), dezembro:
    SMP = acessos 4G+5G (VOZ+DADOS, DADOS, VOZ) por 100 hab; SCM = acessos INTERNET >= 100 Mbps por 100 hab.
    Devolve os acessos (o denominador é aplicado depois)."""
    a = smp[(smp["Mês"] == 12) & smp["Tecnologia Geração"].isin(["4G", "5G"]) & smp["Tipo de Produto"].isin(PROD_PADRAO)]
    a = a.groupby(["Ano", "Código IBGE Município"]).Acessos.sum().rename("smp_4g5g").reset_index()
    b = scm[(scm["Mês"] == 12) & (scm.Ano >= 2021) & (scm["Tipo de Produto"] == "INTERNET") & (scm.v >= 100)]
    b = b.groupby(["Ano", "Código IBGE Município"]).Acessos.sum().rename("scm_100m").reset_index()
    m = a.merge(b, on=["Ano", "Código IBGE Município"], how="outer").rename(columns={"Código IBGE Município": "cod"})
    m["cod"] = m.cod.astype(str)
    return m.fillna({"smp_4g5g": 0, "scm_100m": 0})


def erb_municipal_sobreviventes():
    """Nº de estações SMP por município e ano (Número Estação únicas, hoje licenciadas, primeiro licenciamento até
    31/12). Em 2025 reproduz o `Adensamento Estações` publicado (MAE 0,05 por 10 mil hab., 96% dos municípios
    dentro de 0,05). O arquivo só preenche o código do município em parte das linhas: usa o primeiro não nulo."""
    e = extrato_erb()
    e["dp"] = pd.to_datetime(e["Data Primeiro Licenciamento"], format="%d/%m/%Y", errors="coerce")
    g = e.groupby("Número Estação").agg(dp=("dp", "min"), cod=("Código IBGE", "first")).dropna().reset_index()
    rows = []
    for ano in range(2021, 2026):
        c = g[g.dp <= pd.Timestamp(ano, 12, 31)].groupby("cod").size().rename("n_erb").reset_index()
        c["Ano"] = ano
        rows.append(c)
    return pd.concat(rows, ignore_index=True)


def serie_nucleo_v2(acc, pm):
    """IBC-AMZ 'núcleo' na regra v2 (2024+) para 2021-2025, sem a variável de cobertura agrícola (que só existe
    de 2024 em diante): 7 variáveis da v2, normalizadas pelos limites teóricos da v2, pesos da v2 renormalizados
    (/0,87). Cobertura, HHI, ERB e fibra: valores publicados pela ANATEL; densidades: recalculadas dos acessos
    com a definição v2, com denominador fixo (Censo 2022) em `valor` e com o denominador oficial do ano em
    `valor_denominador_anatel`."""
    mun, _ = carregar_ibc_municipal()
    mun = mun[mun.UF.isin(UFS)].copy()
    mun["cod"] = mun["Código Município"]
    mun = mun.merge(pm, on="cod", how="inner")
    mun = mun.merge(acc.rename(columns={"Ano": "ano_acc"}), left_on=["cod", "Ano"], right_on=["cod", "ano_acc"], how="left")
    mun = mun.fillna({"smp_4g5g": 0, "scm_100m": 0})
    for c in ["Cobertura Pop. 4G5G", "Densidade SMP", "HHI SMP", "Densidade SCM", "HHI SCM", "Adensamento Estações", "Fibra"]:
        mun[c] = pd.to_numeric(mun[c], errors="coerce")
    pop_anatel = np.where(mun.Ano == 2021, mun.pop_est2021, np.where(mun.Ano.isin([2022, 2023]), mun.pop_censo2022, mun.pop_est2024))
    mun["pop_anatel"] = pop_anatel
    cob = mun["Cobertura Pop. 4G5G"].clip(upper=1) * 100
    hhi_s = np.where(mun.Ano <= 2023, 10000 - mun["HHI SMP"], mun["HHI SMP"]) / 100
    hhi_c = np.where(mun.Ano <= 2023, 10000 - mun["HHI SCM"], mun["HHI SCM"]) / 100
    fibra = mun["Fibra"].clip(upper=1) * 100
    erb_n = mun["Adensamento Estações"] * mun.pop_anatel / 1e4  # nº de estações implícito
    mun = mun.merge(erb_municipal_sobreviventes(), on=["cod", "Ano"], how="left")
    mun["n_erb"] = mun.n_erb.fillna(0)
    res = {}
    for nome, pop in (("valor", mun.pop_censo2022), ("valor_denominador_anatel", mun.pop_anatel)):
        ds = (mun.smp_4g5g / pop * 100 / 150).clip(upper=1) * 100
        dc = (mun.scm_100m / pop * 100 / 40).clip(upper=1) * 100
        erb = (erb_n / pop * 1e4 / 20).clip(upper=1) * 100
        core = (0.15 * cob + 0.15 * ds + 0.07 * hhi_s + 0.14 * dc + 0.07 * hhi_c + 0.13 * erb + 0.16 * fibra) / 0.87
        res[nome] = core
        if nome == "valor":  # sensibilidade: estações pela contagem de sobreviventes em todos os anos
            erb2 = (mun.n_erb / pop * 1e4 / 20).clip(upper=1) * 100
            res["valor_erb_sobreviventes"] = (0.15 * cob + 0.15 * ds + 0.07 * hhi_s + 0.14 * dc + 0.07 * hhi_c
                                              + 0.13 * erb2 + 0.16 * fibra) / 0.87
    mun = mun.assign(**res)
    # população fixa Censo 2022 como peso (mesmos pesos da série 1)
    rows = []
    for (u, a), d in mun.groupby(["uf", "Ano"]):
        rows.append((u, int(a)) + tuple((d[c] * d.pop_censo2022).sum() / d.pop_censo2022.sum() for c in res))
    for a, d in mun.groupby("Ano"):
        rows.append(("AL", int(a)) + tuple((d[c] * d.pop_censo2022).sum() / d.pop_censo2022.sum() for c in res))
    df = pd.DataFrame(rows, columns=["uf", "ano"] + list(res))
    # IBC publicado (série 1) e IBC publicado sem a agrícola, para conferência em 2024-2025
    return df, mun


def comp_densidade_smp_v2(smp, pop):
    """Densidade de acessos 4G+5G (definição do IBC v2): acessos 4G/5G (sem M2M/ponto de serviço) por 100 hab."""
    d = smp[(smp["Mês"] == 12) & smp["Tecnologia Geração"].isin(["4G", "5G"])]
    d = d[d["Tipo de Produto"].isin(PROD_PADRAO) | d["Tipo de Produto"].isna()]
    g = d.groupby(["UF", "Ano"]).Acessos.sum().rename("num").reset_index()
    return _densidade(g, pop, divisor=1.0)


def comp_densidade_scm_v2(scm, pop):
    """Densidade de acessos SCM do tipo INTERNET com velocidade >= 100 Mbps (IBC v2), por 100 hab. 2021+."""
    d = scm[(scm["Mês"] == 12) & (scm.Ano >= 2021) & (scm["Tipo de Produto"] == "INTERNET") & (scm.v >= 100)]
    g = d.groupby(["UF", "Ano"]).Acessos.sum().rename("num").reset_index()
    return _densidade(g, pop, divisor=1.0)


def comp_erb(pop):
    """Estações do SMP por 10 mil hab.: estações (Número Estação, únicas) hoje licenciadas, com primeiro
    licenciamento até 31/12 de cada ano (base de sobreviventes: subestima o passado)."""
    e = extrato_erb()
    e["dp"] = pd.to_datetime(e["Data Primeiro Licenciamento"], format="%d/%m/%Y", errors="coerce")
    e = e.sort_values("dp").drop_duplicates("Número Estação")
    rows = []
    for ano in range(2008, 2026):
        x = e[e.dp <= pd.Timestamp(ano, 12, 31)]
        n = x.groupby("UF").size()
        for u in UFS:
            rows.append((u, ano, int(n.get(u, 0)), pop.get((u, ano), np.nan)))
    g = pd.DataFrame(rows, columns=["uf", "ano", "num", "pop"])
    al = g.groupby("ano")[["num", "pop"]].sum().reset_index()
    al["uf"] = "AL"
    g = pd.concat([g, al], ignore_index=True)
    g["valor"] = g.num / g["pop"] * 1e4
    g = _com_pop_fixa(g, pop, g.num * 1e4)
    return g[["uf", "ano", "valor", "num", "pop", "valor_pop2022"]]


def ordenar(df):
    df = df.copy()
    df["uf"] = pd.Categorical(df.uf, UFS + ["AL"], ordered=True)
    return df.sort_values(["uf", "ano"]).reset_index(drop=True)


def validar_v1(comp, nome_ibc, anos=(2021, 2022, 2023), rotulo=None):
    """Compara o componente reconstruído com o original do IBC estadual (IBC_UF_indicadores_originais.csv)."""
    _, uf = carregar_ibc_municipal()
    u = uf[uf.UF.isin(UFS)][["UF", "Ano", nome_ibc]].rename(columns={"UF": "uf", "Ano": "ano", nome_ibc: "ibc"})
    u = u[u.ano.isin(anos)]
    x = comp[comp.uf.isin(UFS)].merge(u, on=["uf", "ano"])
    x["dif"] = x.valor - x.ibc
    x["componente"] = rotulo or nome_ibc
    return x[["componente", "uf", "ano", "valor", "ibc", "dif"]]


def conferir_painel(s1):
    """Compara a série 1 com o painel (somente leitura de dashboard/conteudo/valores.csv)."""
    try:
        v = pd.read_csv(os.path.join(RAIZ, "dashboard", "conteudo", "valores.csv"), dtype=str)
        v = v[v.codigo == "I4.1.1"]
        p25 = v[v.campo.isna() & v.ano.isna()].set_index("uf").valor.astype(float)
        p24 = v[v.campo == "ponderado2024"].set_index("uf").valor.astype(float)
        for a, ref in ((2025, p25), (2024, p24)):
            c = s1[(s1.ano == a) & s1.uf.isin(UFS)].set_index("uf").valor
            print(f"conferência com o painel {a}: máx |dif| = {(c - ref).abs().max():.3f} nas 9 UFs")
        al = s1[(s1.ano == 2025) & (s1.uf == "AL")].valor.iloc[0]
        print(f"AL 2025 = {al:.2f} (linha de base da ficha: 53,52)")
    except FileNotFoundError:
        print("painel ausente: conferência pulada")


F_SMP = "ANATEL, dados abertos: acessos de telefonia móvel (SMP), dezembro; população IBGE"
F_SCM = "ANATEL, dados abertos: acessos de banda larga fixa (SCM), dezembro; população IBGE"


def baixar_extratos():
    """Baixa (só os trechos necessários dos zips da ANATEL) e filtra os 9 estados."""
    for ano in (2021, 2022, 2023, 2024):
        extrato_scm(f"Acessos_Banda_Larga_Fixa_{ano}.csv", meses=[6, 12] if ano == 2021 else [12])
    extrato_scm("Acessos_Banda_Larga_Fixa_2025.csv", meses=[6, 9, 10, 11, 12])
    for arq in ["2007-2010", "2011-2012", "2013-2014", "2015-2016", "2017-2018", "2019-2020"]:
        extrato_scm(f"Acessos_Banda_Larga_Fixa_{arq}.csv", meses=[12])
    extrato_smp_antigo()
    for ano in range(2019, 2026):
        extrato_smp(ano, 2, meses=[12] if ano < 2021 else None)
    extrato_erb()


def serie2_componentes():
    pop = _pop_series()
    smp, scm = carregar_smp(), carregar_scm()
    val = []

    ds = ordenar(comp_densidade_smp_v1(smp, pop))
    out = pd.DataFrame({
        "uf": ds.uf, "ano": ds.ano, "valor": ds.valor.round(4),
        "unidade": "acessos ponderados por geração (4G/5G=1; 3G=0,35; 2G=0,1) por 100 hab., dividido por 1,45",
        "fonte": F_SMP, "acessos_ponderados": ds.num.round(1), "populacao": ds["pop"].round(0),
        "valor_pop2022": ds.valor_pop2022.round(4),
        "definicao": np.where(ds.ano >= 2019, "IBC v1 (sem M2M e ponto de serviço)",
                              "IBC v1; antes de 2019 o arquivo não traz tipo de produto (M2M vem à parte e é excluído)"),
        "extrato": np.where(ds.ano >= 2019, "arquivo 2019+ (por município)", "arquivo 2005-2018 (por UF/DDD)")})
    gravar(out, "densidade_smp_v1_uf_ano.csv")
    val.append(validar_v1(out, "Densidade SMP"))

    dc = ordenar(comp_densidade_scm_v1(scm, pop))
    out = pd.DataFrame({
        "uf": dc.uf, "ano": dc.ano, "valor": dc.valor.round(4),
        "unidade": "acessos ponderados por velocidade (>10 Mbps=1; 2-10=0,35; <=2=0,1) por 100 hab., dividido por 1,45",
        "fonte": F_SCM, "acessos_ponderados": dc.num.round(1), "populacao": dc["pop"].round(0),
        "valor_pop2022": dc.valor_pop2022.round(4), "valor_so_faixas": dc.valor_so_faixas.round(4),
        "sensibilidade_faixa_2a34": dc.sensibilidade_faixa_2a34.round(4), "origem_velocidade": dc.origem})
    gravar(out, "densidade_scm_v1_uf_ano.csv")
    val.append(validar_v1(out, "Densidade SCM"))

    for nome, df, col in (("hhi_smp_uf_ano.csv", smp, "HHI SMP"), ("hhi_scm_uf_ano.csv", scm, "HHI SCM")):
        h = ordenar(comp_hhi(df))
        out = pd.DataFrame({"uf": h.uf, "ano": h.ano, "valor": h.valor.round(2),
                            "unidade": "HHI (0-10000; maior = mais concentrado)",
                            "fonte": "ANATEL, dados abertos: acessos por empresa, dezembro"})
        if col == "HHI SMP":
            # o arquivo de 2005-2018 é outro extrato (UF/DDD): as participações das empresas dão salto em AC, AM e AP
            # entre 2018 e 2019; por isso o trecho até 2018 vai em arquivo separado (proxy)
            gravar(out[out.ano <= 2018], "hhi_smp_2009_2018_uf_ano.csv")
            out = out[out.ano >= 2019]
        gravar(out, nome)
        val.append(validar_v1(out, col))

    d2 = ordenar(comp_densidade_smp_v2(smp, pop))
    out = pd.DataFrame({"uf": d2.uf, "ano": d2.ano, "valor": d2.valor.round(4), "unidade": "acessos 4G+5G por 100 hab.",
                        "fonte": F_SMP, "acessos": d2.num.round(0), "populacao": d2["pop"].round(0),
                        "valor_pop2022": d2.valor_pop2022.round(4)})
    gravar(out, "densidade_smp_4g5g_v2_uf_ano.csv")
    val.append(validar_v1(out, "Densidade SMP", anos=(2024, 2025), rotulo="Densidade SMP v2"))
    d3 = ordenar(comp_densidade_scm_v2(scm, pop))
    out = pd.DataFrame({"uf": d3.uf, "ano": d3.ano, "valor": d3.valor.round(4),
                        "unidade": "acessos de internet fixa >= 100 Mbps por 100 hab.", "fonte": F_SCM,
                        "acessos": d3.num.round(0), "populacao": d3["pop"].round(0),
                        "valor_pop2022": d3.valor_pop2022.round(4)})
    gravar(out, "densidade_scm_100mbps_v2_uf_ano.csv")
    val.append(validar_v1(out, "Densidade SCM", anos=(2024, 2025), rotulo="Densidade SCM v2"))

    e = ordenar(comp_erb(pop))
    out = pd.DataFrame({"uf": e.uf, "ano": e.ano, "valor": e.valor.round(4), "unidade": "estações SMP por 10 mil hab.",
                        "fonte": "ANATEL, Estações SMP (snapshot do licenciamento: Número Estação únicos, primeiro "
                                 "licenciamento até 31/12 do ano); população IBGE",
                        "estacoes": e.num, "populacao": e["pop"].round(0),
                        "valor_pop2022": e.valor_pop2022.round(4)})
    gravar(out, "erb_por_10mil_hab_uf_ano.csv")
    val.append(validar_v1(out, "Adensamento Estações", anos=range(2021, 2026)))

    v = pd.concat(val, ignore_index=True)
    v["valor"] = v.valor.round(3)
    v["dif"] = v.dif.round(3)
    gravar(v, "validacao_componentes_vs_ibc_estadual.csv")
    return v


def nucleo_publicado(pm):
    """Núcleo v2 calculado só com os componentes normalizados PUBLICADOS pela ANATEL em 2024-2025 (mesma fórmula,
    sem cobertura agrícola), ponderado pela população do Censo 2022. Serve de conferência do núcleo recalculado."""
    cols = ["Cobertura Pop. 4G5G", "Densidade SMP", "HHI SMP", "Densidade SCM", "HHI SCM", "Adensamento Estações", "Fibra"]
    peso = dict(zip(cols, [0.15, 0.15, 0.07, 0.14, 0.07, 0.13, 0.16]))
    local = os.path.join(DADOS, "anatel", "ibc.zip")
    zpath = local if os.path.exists(local) else os.path.join(BRUTO, "ibc.zip")
    with zipfile.ZipFile(zpath) as z:
        n = pd.read_csv(z.open("IBC_municipios_indicadores_normalizados.csv"), sep=";", encoding="utf-8-sig", dtype=str)
    for c in cols:
        n[c] = pd.to_numeric(n[c].str.replace(",", "."), errors="coerce").clip(upper=100)
    n["Ano"] = n.Ano.astype(int)
    n = n[n.UF.isin(UFS) & n.Ano.isin([2024, 2025])].copy()
    n["core"] = sum(peso[c] * n[c] for c in cols) / 0.87
    n = n.merge(pm[["cod", "pop_censo2022"]], left_on="Código Município", right_on="cod")
    rows = [(u, int(a), (d.core * d.pop_censo2022).sum() / d.pop_censo2022.sum()) for (u, a), d in n.groupby(["UF", "Ano"])]
    rows += [("AL", int(a), (d.core * d.pop_censo2022).sum() / d.pop_censo2022.sum()) for a, d in n.groupby("Ano")]
    return pd.DataFrame(rows, columns=["uf", "ano", "nucleo_publicado"])


def serie3_nucleo_v2():
    smp, scm = carregar_smp(), carregar_scm()
    pm = populacao_municipal()
    acc = densidades_v2_municipio(smp, scm)
    nuc, _ = serie_nucleo_v2(acc, pm)
    nuc = ordenar(nuc)
    nuc["valor"] = nuc.valor.round(2)
    nuc["valor_denominador_anatel"] = nuc.valor_denominador_anatel.round(2)
    nuc["valor_erb_sobreviventes"] = nuc.valor_erb_sobreviventes.round(2)
    nuc["unidade"] = "pontos (0-100)"
    nuc["fonte"] = ("Reconstrução: IBC v2 sem a variável de cobertura agrícola. ANATEL (IBC municipal publicado, "
                    "acessos SMP/SCM), IBGE (Censo 2022, estimativas de população)")
    gravar(nuc, "ibc_nucleo_v2_ponderado_uf_ano.csv")
    cf = ordenar(nucleo_publicado(pm)).merge(nuc[["uf", "ano", "valor", "valor_denominador_anatel"]], on=["uf", "ano"])
    cf["dif_denominador_anatel"] = (cf.valor_denominador_anatel - cf.nucleo_publicado).round(3)
    cf["dif_denominador_fixo"] = (cf.valor - cf.nucleo_publicado).round(3)
    cf["nucleo_publicado"] = cf.nucleo_publicado.round(3)
    gravar(cf, "validacao_nucleo_v2_vs_publicado.csv")
    return nuc


def main():
    s1 = serie1_ibc_ponderado()
    conferir_painel(s1)
    baixar_metodologias()
    baixar_extratos()
    v = serie2_componentes()
    nuc = serie3_nucleo_v2()
    serie_cobertura_fibra()
    serie_pnad_tic()
    return s1, v, nuc


if __name__ == "__main__":
    s1, v, nuc = main()
    print(s1.pivot(index="uf", columns="ano", values="valor"))
    print(nuc.pivot(index="uf", columns="ano", values="valor"))
