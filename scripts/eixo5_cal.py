"""Eixo 5 / I5.2.2 — recursos captados pelo Consórcio da Amazônia Legal (CAL).

A coleta de 30/08 parou no Wix do CAL: a tabela "Orçamento Anual" carrega por
JavaScript com token de sessão. As páginas de item, porém, são renderizadas no
servidor e estão listadas nos sitemaps do próprio site, então dá para ler cada
instrumento sem navegador:

  dynamic-contratos-rateio_...-sitemap.xml   contratos de rateio (estado -> CAL)
  dynamic-acordos-e-termos_...-sitemap.xml   acordos, patrocínios, termos
  dynamic-orcamento-anual-item_...-sitemap.xml  orçamento anual (OAC) por ano

O orçamento é todo financiado por rateio entre os nove estados (art. 2º das
resoluções do OAC). De 2019 a 2025 o rateio ordinário é um contrato coletivo;
a parte de cada estado vem do Anexo I da resolução do ano, igual entre eles:

  2019  R$ 125.000   Res. 01/2019 (vigência 01/08 a 31/12/2019)
  2020  R$ 500.000   Res. 02/2019        2021  R$ 500.000   Res. 01/2020
  2022  R$ 500.000   Res. 01/2021        2023  R$ 500.000   Res. 04/2022
  2024  R$ 680.000   Res. 01/2024        2025  R$ 680.000   Res. 05/2024

Em 2026 cada estado tem contrato próprio, com valores diferentes (Res.
001/2026: soma R$ 6.120.000,00). As resoluções de 2019 e 2020 são digitalizadas
(imagem), por isso a divisão por estado fica escrita aqui e não é extraída.

Valor principal de I5.2.2 por UF e ano = soma dos contratos de rateio do estado
com o CAL no ano (ordinário + específicos, como o HUB Amazônia Legal de 2024).
A soma dos nove é o que o CAL capta dos estados. Recursos de terceiros
(patrocínios, acordos com repasse ao CAL) não têm estado e vão para a tabela de
detalhe, junto com todos os instrumentos. Valores contratados/orçados, não
execução: o CAL não publica execução por ano.

Saídas: proposta de valores (``--aplicar`` = Aceitar tudo) e
dashboard/public/data/csv/cal_instrumentos.csv.

Uso:  python scripts/eixo5_cal.py [--aplicar] [--atualizar]
"""
from __future__ import annotations

import csv
import html
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from estrategia_set2026 import UFS, aplica  # noqa: E402
from proposta import Proposta  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
CSV_PAINEL = RAIZ / "dashboard" / "public" / "data" / "csv"
BRUTO = RAIZ / "dados" / "eixo5" / "cal"
SITE = "https://www.consorcioamazonialegal.gov.br"
SITEMAPS = {
    "rateio": f"{SITE}/dynamic-contratos-rateio_p_0333c4c9_4273_46e6_af50_2a2dedd593d7_0_5000-sitemap.xml",
    "acordo": f"{SITE}/dynamic-acordos-e-termos_p_6e87f9db_9a3b_4298_9748_efb24fc921c3_0_5000-sitemap.xml",
}
NOMES = {"Acre": "AC", "Amapá": "AP", "Amazonas": "AM", "Maranhão": "MA", "Mato Grosso": "MT",
         "Pará": "PA", "Rondônia": "RO", "Roraima": "RR", "Tocantins": "TO"}
# Parte de cada estado no rateio ordinário coletivo (Anexo I da resolução do OAC).
RATEIO_IGUAL = {"2019": 125_000, "2020": 500_000, "2021": 500_000, "2022": 500_000,
                "2023": 500_000, "2024": 680_000, "2025": 680_000}
RESOLUCAO = {"2019": "Res. 01/2019", "2020": "Res. 02/2019", "2021": "Res. 01/2020", "2022": "Res. 01/2021",
             "2023": "Res. 04/2022", "2024": "Res. 01/2024", "2025": "Res. 05/2024", "2026": "Res. 001/2026"}
# Contratos de rateio que não têm página no site mas estão nos relatórios de
# gestão: (UF, ano, valor, número, fonte).
RATEIO_FORA_DO_SITE = [
    ("RR", "2025", 445_000.00, "01/2025",
     "https://www.consorcioamazonialegal.gov.br/_files/ugd/6a4a97_34beae48bef2411aa401d2fef6a29cb8.pdf (RG 2025, p. 100: "
     "aporte de Roraima para a participação do Consórcio na COP30, Res. 02/2025-PR/CAL)"),
]


# Execução orçamentária anual do CAL (regional, sem divisão por estado), para a
# tabela de detalhe cal_orcamento_execucao.csv. 2019-2023: relatórios de gestão
# (RG), com a página; 2024 em diante: API de despesas do sistema de
# transparência (Fiorilli), lida ao rodar. 2021 fica em branco: o RG publica o
# total por ação e o total da unidade não fecha (liquidado maior que empenhado).
RG = f"{SITE}/_files/ugd/"
EXECUCAO_RG = {
    # ano: (dotação inicial, dotação atualizada, empenhado, receita arrecadada, fonte)
    "2019": (1_135_000, None, 272_890.26, 700_678.05, f"{RG}d5cffb_902fe10a6d4c492cb33c113a1334ba3e.pdf (RG 2019, p. 42)"),
    "2020": (4_545_000, None, 875_032.82, 3_107_592.44, f"{RG}d5cffb_1a76ecbfe0f44b9c8786f69afaed29e3.pdf (RG 2020, p. 55)"),
    "2021": (4_545_000, None, None, None, f"{RG}6a4a97_1b46c46c4b92460ba2a00d75b6367876.pdf (execução por ação; total da unidade não publicado de forma consistente)"),
    "2022": (4_500_000, 8_303_191.58, 5_420_387.17, 6_036_400.00, f"{RG}d5cffb_28b7bc2ea157400aa4cb95dedaa7bc2a.pdf (RG 2022, p. 49 e 170; o RG 2023 dá 6.372.937,31 como receita do exercício anterior)"),
    "2023": (4_545_000, 9_301_248.43, 7_998_578.52, 4_799_461.08, f"{RG}6a4a97_94f9922422404845b62298a4b0356c54.pdf (RG 2023, p. 69 e 157)"),
}
API = ("https://gestao.cegep.inf.br:29920/transparencia/VersaoJson/Despesas/?ConectarExercicio={ano}&Listagem=DespesasPorOrgao"
       "&DiaInicioPeriodo=01&MesInicialPeriodo=01&DiaFinalPeriodo=31&MesFinalPeriodo=12&Ano={ano}&Empresa=1&MostraDadosConsolidado=False")
RECEITA_RG_2024 = (9_464_875.18, f"{RG}6a4a97_b6fe053a2a734abeb8d38d263b1498da.pdf (RG 2024, p. 98)")


def execucao_api(ano: str) -> dict:
    import json
    import ssl
    copia = BRUTO / f"api_despesas_{ano}.json"
    if copia.exists() and "--atualizar" not in sys.argv and ano != str(time.localtime().tm_year):
        return json.loads(copia.read_text(encoding="utf-8"))
    contexto = ssl.create_default_context()
    contexto.check_hostname = False
    contexto.verify_mode = ssl.CERT_NONE  # certificado do servidor da Fiorilli não valida na cadeia pública
    req = urllib.request.Request(API.format(ano=ano), headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120, context=contexto) as r:
        dados = json.loads(r.read().decode("utf-8"))[0]
    copia.write_text(json.dumps(dados, ensure_ascii=False, indent=1), encoding="utf-8")
    return dados


def grava_execucao(oac: dict[str, float]):
    num = lambda s: float(str(s).replace(",", "."))
    linhas = []
    for ano, (inicial, atualizada, empenhado, receita, fonte) in EXECUCAO_RG.items():
        linhas.append([ano, oac.get(ano), inicial, atualizada or "", empenhado or "", "", "", receita or "", fonte])
    ano_atual = time.localtime().tm_year
    for ano in range(2024, ano_atual + 1):
        d = execucao_api(str(ano))
        receita, fonte_receita = RECEITA_RG_2024 if ano == 2024 else ("", "")
        parcial = " (ano em curso: valores até a data da consulta)" if ano == ano_atual else ""
        linhas.append([str(ano), oac.get(str(ano)), num(d["DOTAC"]), num(d["DOTACAO_ATUALIZADA"]), num(d["EMPENHADO"]),
                       num(d["LIQUIDADO"]), num(d["PAGO"]), receita,
                       API.format(ano=ano) + parcial + (f"; receita: {fonte_receita}" if fonte_receita else "")])
    with (CSV_PAINEL / "cal_orcamento_execucao.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["ano", "oac_rateio_reais", "dotacao_inicial", "dotacao_atualizada", "empenhado", "liquidado", "pago",
                    "receita_arrecadada", "fonte"])
        w.writerows(linhas)
    print("tabela: cal_orcamento_execucao.csv", [(l[0], l[4]) for l in linhas])


def baixa(url: str, tentativas: int = 5) -> str:
    """GET com pausa e nova tentativa: o Wix devolve 429 a rajadas."""
    for tentativa in range(tentativas):
        time.sleep(1.5 + 4 * tentativa)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", errors="ignore")
        except urllib.error.HTTPError as erro:
            if erro.code != 429 or tentativa == tentativas - 1:
                raise
    raise RuntimeError(url)


def texto(pagina: str) -> str:
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", pagina, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    t = re.sub(r"\s+", " ", t)
    return t[t.find("Voltar"): t.find("Informações atualizadas")]


def reais(s: str | None) -> float | None:
    m = re.search(r"R\$ ?([\d\.]+,\d{2})", s or "")
    return float(m.group(1).replace(".", "").replace(",", ".")) if m else None


def campo(t: str, rotulo: str, ate: str) -> str:
    m = re.search(rf"{rotulo}:? (.*?) {ate}", t)
    return m.group(1).strip() if m else ""


def le_itens(tipo: str):
    urls = re.findall(r"<loc>(.*?)</loc>", baixa(SITEMAPS[tipo]))
    BRUTO.mkdir(parents=True, exist_ok=True)
    itens = []
    for url in urls:
        # Cópia local em dados/eixo5/cal/: rodar de novo não baixa o que já tem,
        # a menos que se peça --atualizar.
        copia = BRUTO / f"{tipo}_{url.rsplit('/', 1)[-1]}.html"
        if copia.exists() and "--atualizar" not in sys.argv:
            pagina = copia.read_text(encoding="utf-8")
        else:
            pagina = baixa(url)
            copia.write_text(pagina, encoding="utf-8")
        t = texto(pagina)
        itens.append((url, t))
    return itens


def main():
    linhas_detalhe = []
    por_uf_ano: dict[str, dict[str, float]] = {uf: {} for uf in UFS}

    for url, t in le_itens("rateio"):
        numero = campo(t, "Número do Contrato", "Contratado")
        contratado = campo(t, "Contratado", "Assinatura")
        vigencia = campo(t, "Vigência", "Situação")
        valor = reais(t)
        ano = re.search(r"(20\d\d)", vigencia).group(1)
        objeto = campo(t, "Objeto", "Documentos")
        ufs = [NOMES[n] for n in NOMES if re.search(rf"\b{n}\b", contratado)]
        coletivo = len(ufs) == 9
        if coletivo:
            assert abs(RATEIO_IGUAL[ano] * 9 - valor) < 0.01, (ano, valor)
            for uf in UFS:
                por_uf_ano[uf][ano] = por_uf_ano[uf].get(ano, 0) + RATEIO_IGUAL[ano]
        else:
            assert len(ufs) == 1, contratado
            por_uf_ano[ufs[0]][ano] = por_uf_ano[ufs[0]].get(ano, 0) + valor
        linhas_detalhe.append(["contrato de rateio", ano, "; ".join(ufs), contratado, numero, vigencia, valor,
                               "estado -> CAL", objeto[:200], url])

    for uf, ano, valor, numero, fonte in RATEIO_FORA_DO_SITE:
        por_uf_ano[uf][ano] = por_uf_ano[uf].get(ano, 0) + valor
        linhas_detalhe.append(["contrato de rateio", ano, uf, f"Estado de {[n for n, u in NOMES.items() if u == uf][0]}",
                               numero, ano, valor, "estado -> CAL", "Contrato sem página no site do CAL; registrado no relatório de gestão", fonte])

    for url, t in le_itens("acordo"):
        instituicao = campo(t, "Instituição", "Vigência")
        instrumento = campo(t, "Instrumento", "Instituição")
        ano = campo(t, "Ano", "Instrumento")
        vigencia = campo(t, "Vigência", r"(?:R\$|Sem repasse|De até)")
        valor = reais(t)
        objeto = campo(t, "Objeto", "Documentos")
        if valor is None:
            sentido = "sem repasse"
        elif re.search(r"recebid[oa] pelo Cons[oó]rcio", objeto, re.I):
            sentido = "terceiro -> CAL"
        elif re.search(r"realizad[oa] pelo Cons[oó]rcio|repasse de recursos? financeiros? pelo Cons[oó]rcio", objeto, re.I):
            sentido = "CAL -> terceiro"
        else:
            sentido = "a classificar"
        linhas_detalhe.append([instrumento, ano, "", instituicao, "", vigencia, valor, sentido, objeto[:200], url])

    soma = {ano: sum(por_uf_ano[uf].get(ano, 0) for uf in UFS) for ano in sorted({a for d in por_uf_ano.values() for a in d})}
    print("rateio contratado dos estados por ano:", {a: round(v, 2) for a, v in soma.items()})
    oac = {ano: RATEIO_IGUAL[ano] * 9 for ano in RATEIO_IGUAL}
    oac["2026"] = 6_120_000.00  # Res. 001/2026, Anexo I
    grava_execucao(oac)

    p = Proposta("eixo5_cal", fonte="Consórcio da Amazônia Legal: contratos de rateio e resoluções do OAC",
                 descricao="I5.2.2: recursos repassados por cada estado ao CAL por contrato de rateio, 2019-2026")
    ultimo = max(soma)
    for uf in UFS:
        for ano, valor in sorted(por_uf_ano[uf].items()):
            p.valor("I5.2.2", uf, round(valor, 2), ano=int(ano), nota=f"Contratos de rateio com o CAL; parte do ordinário pela {RESOLUCAO[ano]}")
        p.valor("I5.2.2", uf, round(por_uf_ano[uf][ultimo], 2),
                nota=f"Contrato de rateio {ultimo} (valor contratado, vigência em andamento)")

    with (CSV_PAINEL / "cal_instrumentos.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["tipo", "ano", "ufs", "parte", "numero", "vigencia", "valor_reais", "sentido", "objeto", "url"])
        for linha in sorted(linhas_detalhe, key=lambda l: (l[1], l[0], l[3])):
            w.writerow(["" if v is None else v for v in linha])
    print("tabela: cal_instrumentos.csv", len(linhas_detalhe), "instrumentos")
    terceiros = {}
    for l in linhas_detalhe:
        if l[7] == "terceiro -> CAL":
            terceiros[l[1]] = terceiros.get(l[1], 0) + l[6]
    print("recursos de terceiros recebidos pelo CAL:", terceiros)
    print("a classificar:", [l[3] for l in linhas_detalhe if l[7] == "a classificar"])

    caminho = p.gravar()
    print("proposta:", caminho)
    if "--aplicar" in sys.argv and caminho:
        print("aplicadas:", aplica(caminho), "células")


if __name__ == "__main__":
    main()
