"""Eixo 5 / I5.1.1 — recursos de financiamento climático recebidos pelos governos estaduais.

A ficha pede o montante obtido **anualmente** pelos nove estados com programas
jurisdicionais de crédito de carbono, financiamento climático e ambiental e
fundos multilaterais. Não existe base consolidada por estado e ano (CPI/PUC-Rio
é nacional; o Informe de Carteira do Fundo Amazônia é contratado e acumulado).
Este script monta a série com os dois componentes que têm registro datado de
dinheiro efetivamente recebido pelo governo estadual:

1. Fundo Amazônia (BNDES): desembolsos dos 27 projetos cuja "Natureza do
   Responsável" é "Estados", nos nove estados. Cada página de projeto traz a
   tabela "Desembolsos" com data e valor de cada parcela; o script relê e confere
   natureza e UF. A lista vem da busca do site com o filtro natureza =
   Estados; projetos estaduais fora da Amazônia Legal (BA, CE, ES, MS, PR) e
   federais multiestaduais ficam fora.
2. REM Acre (KfW/BMZ, BMU; Noruega/Reino Unido na fase II): pagamentos por
   resultado liberados ao Estado do Acre — fase I para o Fundo Estadual de
   Florestas, fase II para a conta do programa (Fonte 200). Valores dos
   relatórios oficiais (programarem.ac.gov.br), escritos aqui com a página.

Fora da série, com o motivo:
- REM Mato Grosso: o dinheiro vai ao Funbio, gestor privado, e o relatório
  executivo 2025 só dá o total recebido da fase I (R$ 267,7 mi), sem ano. Entra
  como campo auxiliar de MT.
- LEAF/Emergent (PA), Mercuria (TO) e demais acordos de crédito jurisdicional:
  pagam na emissão dos créditos, e a ART não emitiu crédito para nenhum estado
  até set/2026. Nada foi recebido.
- Dois contratos estaduais do Amazonas no BNDES sem página no site do Fundo
  (13208991, R$ 5,90 mi; 14200031, R$ 10,13 mi desembolsados): sem data.

Valor principal por UF e ano, R$. 2026 é parcial (parcelas até jul/2026) e fica
só na tabela de detalhe; o valor atual é 2025.

Saídas: proposta (``--aplicar`` = Aceitar tudo) e
dashboard/public/data/csv/financiamento_climatico_estados.csv.

Uso:  python scripts/eixo5_financiamento_climatico.py [--aplicar] [--atualizar]
"""
from __future__ import annotations

import csv
import html
import re
import sys
import time
import urllib.request
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from estrategia_set2026 import UFS, aplica  # noqa: E402
from proposta import Proposta  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
BRUTO = RAIZ / "dados" / "eixo5" / "financiamento"
CSV_PAINEL = RAIZ / "dashboard" / "public" / "data" / "csv"
FA = "https://www.fundoamazonia.gov.br/pt/projeto/"
PROJETOS = [
    ("AC", "CAR-Acre"), ("AC", "Valorizacao-do-Ativo-Ambiental-Florestal"), ("AC", "Rumo-ao-Desmatamento-Ilegal-Zero-no-Acre"),
    ("AC", "Acre-Incendios-Florestais-Zero"),
    ("AM", "ProAmazon-Projeto-de-Combate-a-Incendios-e-Desmatamento-no-Amazonas"), ("AM", "Reflorestamento-no-Sul-do-Estado-do-Amazonas"),
    ("AM", "CAR-Amazonas"),
    ("AP", "Projeto-de-Prevencao-e-Combate-a-Incendios-Florestais-e-Queimadas-Nao-Autorizadas-no-Amapa"),
    ("MA", "Mais-Sustentabilidade-no-Campo"), ("MA", "Amazonia-Protegida"),
    ("MT", "Mato-Grosso-Sustentavel"), ("MT", "Terra-a-Limpo"), ("MT", "Mato-Grosso-2025"), ("MT", "Bombeiros-Florestais-de-Mato-Grosso"),
    ("PA", "Programa-Municipios-Verdes"), ("PA", "Para-Combatendo-os-Incendios-Florestais-e-Queimadas-Nao-Autorizadas"),
    ("PA", "Para-Amazonia-2025"), ("PA", "Para-Mais-Sustentavel"), ("PA", "Semas-Para"),
    ("RO", "Projeto-de-Desenvolvimento-Socioeconomico-Ambiental-Integrado"), ("RO", "Rondonia-Mais-Verde-Fase-II"), ("RO", "Rondonia-Mais-Verde"),
    ("RR", "CAR-Roraima"), ("RR", "Roraima-Verde"),
    ("TO", "CAR-Tocantins-Legal"), ("TO", "Bombeiro-Militar-Florestal-Tocantins"), ("TO", "Protecao-Florestal-Tocantins"),
]
LOCAL = {"AC": "acre", "AM": "amazonas", "AP": "amapa", "MA": "maranhao", "MT": "mato-grosso",
         "PA": "para", "RO": "rondonia", "RR": "roraima", "TO": "tocantins"}

REM_F1 = "https://programarem.ac.gov.br/wp-content/uploads/2024/06/1.-Relatorio-A-implementacao-do-Programa-REM-Fase-I-Bases-Conceituais-Resultados-e-Aprendizados.pdf"
REM_2022 = "https://programarem.ac.gov.br/wp-content/uploads/2025/02/Relatorio-Anual-2022-REM-Acre-Fase-2_final-com-anexos.pdf"
REM_2025 = "https://programarem.ac.gov.br/wp-content/uploads/2026/09/Relatorio_Anual_REM_Acre_Fase-II-2025.pdf"
# (data, valor R$, descrição, fonte). Fase I: anos pela Figura 11 e valores pela
# tabela do relatório (as quatro parcelas BMZ somam R$ 53.822.691,44, o total
# convertido citado no texto). Fase II: Figura 57 (2022) e Figura 22 (2025).
REM_ACRE = [
    ("2012", 5_132_582.68, "REM fase I, BMZ, 1ª parcela (EUR 1,9 mi)", f"{REM_F1} (p. 15-16)"),
    ("2013", 30_377_658.76, "REM fase I, BMZ, 2ª parcela (EUR 9,3 mi)", f"{REM_F1} (p. 15-16)"),
    ("2013", 29_510_100.00, "REM fase I, BMU, parcela única (EUR 9 mi)", f"{REM_F1} (p. 16, Tabela 03)"),
    ("2015", 13_237_950.00, "REM fase I, BMZ, 3ª parcela (EUR 3,3 mi)", f"{REM_F1} (p. 15-16)"),
    ("2016", 5_074_500.00, "REM fase I, BMZ, 4ª parcela (EUR 1,5 mi)", f"{REM_F1} (p. 15-16)"),
    ("dez/2017", 19_665_000.00, "REM fase II, liberação KfW/BEIS", f"{REM_2022} (p. 78, Figura 57)"),
    ("dez/2018", 46_614_685.31, "REM fase II, liberação KfW/BEIS", f"{REM_2022} (p. 78, Figura 57)"),
    ("ago/2021", 24_757_898.95, "REM fase II, liberação KfW/BEIS", f"{REM_2022} (p. 78, Figura 57)"),
    ("ago/2024", 40_506_139.43, "REM fase II, liberação KfW/BEIS", f"{REM_2025} (p. 81, Figura 22)"),
    ("set/2025", 47_113.86, "REM fase II, liberação KfW/BEIS", f"{REM_2025} (p. 81, Figura 22)"),
]
REM_MT = "https://rem.sema.mt.gov.br/wp-content/uploads/2026/03/RELATORIO-EXECUTIVO-EDICAO-2025-1.pdf"


def baixa(url: str) -> str:
    for tentativa in range(5):
        time.sleep(1 + 3 * tentativa)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", errors="ignore")
        except Exception:
            if tentativa == 4:
                raise
    raise RuntimeError(url)


def projeto(uf: str, slug: str):
    copia = BRUTO / f"fa_{slug}.html"
    if copia.exists() and "--atualizar" not in sys.argv:
        pagina = copia.read_text(encoding="utf-8")
    else:
        pagina = baixa(FA + slug + "/")
        copia.write_text(pagina, encoding="utf-8")
    assert "natureza-responsavel/estados/" in pagina, f"{slug}: natureza não é Estados"
    assert f"local/{LOCAL[uf]}/" in pagina, f"{slug}: local não é {uf}"
    nome = html.unescape(re.search(r"<h1>(.*?)</h1>", pagina, re.S).group(1)).strip()
    responsavel = html.unescape(re.search(r"</h1>\s*<p>(.*?)</p>", pagina, re.S).group(1)).strip()
    tabela = pagina[pagina.find("<caption class=\"hidden\">Desembolsos</caption>"):]
    tabela = tabela[: tabela.find("</tbody>")]
    # Devolução aparece como parcela negativa ("-R$ 1.890.000,00") e entra no ano em que ocorreu.
    # O site separa "R$" do número com espaço não separável (\xa0), que \s cobre.
    parcelas = re.findall(r'data-th="data">\s*(\d\d\.\d\d\.\d{4})</td>\s*<td[^>]*data-th="valor">\s*(-?)R\$\s*([\d\.]+,\d\d)', tabela)
    total = re.search(r"Valor total desembolsado</td>.*?R\$\s*([\d\.]+,\d\d)", pagina, re.S)
    valores = [(d, float(sinal + v.replace(".", "").replace(",", "."))) for d, sinal, v in parcelas]
    # Tabela e total precisam existir e bater: um parser que não lê nada não pode
    # passar como projeto sem desembolso.
    assert parcelas and total, f"{slug}: tabela de desembolsos ou total não encontrados"
    esperado = float(total.group(1).replace(".", "").replace(",", "."))
    assert abs(sum(v for _, v in valores) - esperado) < 0.05, (slug, sum(v for _, v in valores), esperado)
    return nome, responsavel, valores


def main():
    BRUTO.mkdir(parents=True, exist_ok=True)
    por_uf_ano: dict[str, dict[str, float]] = {uf: defaultdict(float) for uf in UFS}
    detalhe = []
    for uf, slug in PROJETOS:
        nome, responsavel, parcelas = projeto(uf, slug)
        for data, valor in parcelas:
            ano = data[-4:]
            por_uf_ano[uf][ano] += valor
            detalhe.append([uf, ano, data, "Fundo Amazônia", nome, responsavel, round(valor, 2), FA + slug + "/"])
    for data, valor, descricao, fonte in REM_ACRE:
        ano = data[-4:]
        por_uf_ano["AC"][ano] += valor
        detalhe.append(["AC", ano, data, "REM Acre", descricao, "Estado do Acre", valor, fonte])

    anos = [str(a) for a in range(2011, 2026)]
    total = {a: round(sum(por_uf_ano[uf].get(a, 0) for uf in UFS) / 1e6, 1) for a in anos + ["2026"]}
    print("recebido pelos estados (R$ mi):", total)

    p = Proposta("eixo5_financiamento_climatico", fonte="Fundo Amazônia (BNDES) e Programa REM Acre",
                 descricao="I5.1.1: desembolsos a governos estaduais, por UF e ano, 2011-2025 (parcial: dois componentes)")
    for uf in UFS:
        for ano in anos:
            p.valor("I5.1.1", uf, round(por_uf_ano[uf].get(ano, 0), 2), ano=int(ano))
        p.valor("I5.1.1", uf, round(por_uf_ano[uf].get("2025", 0), 2),
                nota="2025: Fundo Amazônia (projetos estaduais) + REM Acre; componentes datados disponíveis")
        p.valor("I5.1.1", uf, round(por_uf_ano[uf].get("2026", 0), 2), campo="parcial2026")
    p.valor("I5.1.1", "MT", 267_700_000, campo="remMtFase1Acumulado",
            nota=f"REM Mato Grosso fase I, total recebido (Funbio), sem divisão por ano: {REM_MT} (p. 8)")

    with (CSV_PAINEL / "financiamento_climatico_estados.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["uf", "ano", "data", "componente", "projeto_ou_parcela", "responsavel", "valor_reais", "fonte"])
        w.writerows(sorted(detalhe, key=lambda l: (l[0], l[1], l[3])))
    print("tabela: financiamento_climatico_estados.csv", len(detalhe), "parcelas")

    caminho = p.gravar()
    print("proposta:", caminho)
    if "--aplicar" in sys.argv and caminho:
        print("aplicadas:", aplica(caminho), "células")


if __name__ == "__main__":
    main()
