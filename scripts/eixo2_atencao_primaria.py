#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 2 / I2.2.2 — Atenção primária: série histórica pelo e-Gestor AB.

Fonte: API pública dos Relatórios da APS do Ministério da Saúde
(https://relatorioaps-prd.saude.gov.br), a mesma que alimenta o
relatorioaps.saude.gov.br — para onde o antigo egestorab.saude.gov.br redireciona.
Endpoints usados, ambos GET com `unidadeGeografica`, `coUf` e `nuCompInicio/Fim`:

  /cobertura/ab   competências 07/2007 a 12/2020 — metodologia anterior
  /cobertura/aps  competências 01/2021 em diante — metodologia do Previne Brasil

O corte entre os dois é exato: a série de cobertura tem uma quebra metodológica em
2021 e não deve ser lida como uma linha só. A antiga divide equipes parametrizadas
pela população e trava em 100%; a nova parte da capacidade de atendimento das
equipes e passa de 100% em vários estados. São indicadores diferentes com o mesmo
nome, então este script grava a coluna `metodologia` em toda linha.

O que atravessa as duas sem quebra é `qtEsf`, o número de equipes de Saúde da
Família: 07/2007 a hoje, mesma definição. É a série longa confiável. Já a soma
eSF + eAP, que é o que o painel exibe, só existe de 2021 em diante — a equipe de
Atenção Primária foi criada pela Portaria 2.979/2019 e não tem correspondente antes.

Os números do e-Gestor não batem com o CSV do CNES que o painel usa hoje: o CNES
conta o que está cadastrado e o e-Gestor conta o que está credenciado e homologado
para pagamento. A conferência no fim do script mede a diferença por UF.

CSVs de trabalho em dados/ms_aps/ (pasta local, como nos demais pipelines):
  - aps_uf_mes.csv          (uf, ano, mes, metodologia, esf, eap, populacao, cobertura)
  - aps_uf_ano.csv          (recorte anual: dezembro, ou a última competência do ano)
  - aps_municipio_ultima.csv (municípios das 9 UFs na competência mais recente)

E o consolidado versionado, que vai junto com o site:
  - dashboard/public/data/atencao-primaria.json
"""
import csv
import datetime
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

sys.stdout.reconfigure(encoding="utf-8")

BASE = os.path.dirname(os.path.abspath(__file__))
PASTA = os.path.dirname(BASE)
SAIDA = os.path.join(PASTA, "dados", "ms_aps")
PUBLICO = os.path.join(PASTA, "dashboard", "public", "data")
os.makedirs(SAIDA, exist_ok=True)

API = "https://relatorioaps-prd.saude.gov.br"
UFS = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA",
       "16": "AP", "17": "TO", "21": "MA", "51": "MT"}
# A API é servida atrás de um certificado que a cadeia local não valida; o dado é
# público e não há credencial em jogo, então segue sem verificação, como o navegador
# faria ao abrir o relatório.
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE


def api(caminho):
    url = API + caminho
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    for tentativa in range(3):
        try:
            with urllib.request.urlopen(req, timeout=300, context=CTX) as r:
                return json.loads(r.read())
        except Exception as e:
            print("  retry", tentativa + 1, "erro:", e)
            if tentativa == 2:
                raise


def competencia(valor):
    """A API devolve 'MM/AAAA' no /cobertura/aps e 'AAAAMM' no /cobertura/ab."""
    texto = str(valor).strip()
    if "/" in texto:
        mes, ano = texto.split("/")
        return int(ano), int(mes)
    return int(texto[:4]), int(texto[4:])


def num(v):
    """O /cobertura/aps devolve número; o /cobertura/ab devolve texto com vírgula de
    milhar no padrão americano ("816,687" = 816687, "88.85" = 88.85)."""
    if v in (None, "", "-"):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).strip().replace(",", ""))
    except ValueError:
        return None


def gravar(nome, campos, linhas):
    destino = os.path.join(SAIDA, nome)
    with open(destino, "w", encoding="utf-8", newline="") as f:
        escritor = csv.DictWriter(f, fieldnames=campos)
        escritor.writeheader()
        escritor.writerows(linhas)
    print(f"  {len(linhas)} linhas -> {destino}")


def coletar(unidade, codigo=None, rotulo=None):
    """Junta as duas metodologias numa lista de meses ordenada."""
    filtro = f"unidadeGeografica={unidade}"
    if unidade == "UF":
        filtro += f"&coUf={codigo}"
    elif unidade == "REGIAO":
        filtro += f"&coRegiao={codigo}"
    linhas = []
    for endpoint, metodologia, ini, fim in (
        ("ab", "AB", "200701", "202012"),
        ("aps", "APS", "202101", "203012"),
    ):
        for r in api(f"/cobertura/{endpoint}?{filtro}&nuCompInicio={ini}&nuCompFim={fim}"):
            ano, mes = competencia(r["nuComp"])
            esf = num(r.get("qtEsf"))
            eap = None
            if metodologia == "APS":
                eap = (num(r.get("qtEap30")) or 0) + (num(r.get("qtEap20")) or 0)
            linhas.append({
                "uf": rotulo,
                "ano": ano,
                "mes": mes,
                "metodologia": metodologia,
                "esf": esf,
                "eap": eap,
                "equipes": None if eap is None else esf + eap,
                "populacao": num(r.get("qtPopulacao")),
                # No /cobertura/ab o percentual é `pcCoberturaAb`; `qtCoberturaAb` é a
                # contagem de pessoas cobertas. No /cobertura/aps `qtCobertura` já é o %.
                "cobertura": num(r["qtCobertura"]) if metodologia == "APS" else num(r.get("pcCoberturaAb")),
            })
    linhas.sort(key=lambda x: (x["ano"], x["mes"]))
    return linhas


print("e-Gestor AB / Relatórios da APS — cobertura e equipes por UF")
mensal = []
for codigo, sigla in UFS.items():
    linhas = coletar("UF", codigo, sigla)
    mensal.extend(linhas)
    print(f"  {sigla}: {len(linhas)} competências ({linhas[0]['ano']}/{linhas[0]['mes']:02d} a {linhas[-1]['ano']}/{linhas[-1]['mes']:02d})")
mensal.extend(coletar("REGIAO", "1", "Norte"))
mensal.extend(coletar("BRASIL", None, "BR"))
gravar("aps_uf_mes.csv", ["uf", "ano", "mes", "metodologia", "esf", "eap", "equipes", "populacao", "cobertura"], mensal)

# --------------- Recorte anual: dezembro, ou a última competência do ano ---------------
# Equipe é estoque, não fluxo: o certo é uma fotografia, não uma soma nem uma média
# de meses. Dezembro é a fotografia de fim de ano; no ano corrente vale a última
# competência publicada, que o JSON marca como parcial.
anual = {}
for linha in mensal:
    chave = (linha["uf"], linha["ano"])
    atual = anual.get(chave)
    if atual is None or linha["mes"] > atual["mes"]:
        anual[chave] = linha

linhas_ano = []
for (uf, ano), linha in sorted(anual.items()):
    pop = linha["populacao"]
    por100mil = lambda v: round(v / pop * 100000, 1) if v is not None and pop else None
    linhas_ano.append({
        "uf": uf, "ano": ano, "mes_ref": linha["mes"], "metodologia": linha["metodologia"],
        "esf": linha["esf"], "eap": linha["eap"], "equipes": linha["equipes"],
        "populacao": pop,
        "esf_por_100mil": por100mil(linha["esf"]),
        "equipes_por_100mil": por100mil(linha["equipes"]),
        "cobertura_pct": linha["cobertura"],
    })
gravar("aps_uf_ano.csv",
       ["uf", "ano", "mes_ref", "metodologia", "esf", "eap", "equipes", "populacao",
        "esf_por_100mil", "equipes_por_100mil", "cobertura_pct"], linhas_ano)

anos = sorted({l["ano"] for l in linhas_ano})
ultima = max((l["ano"], l["mes"]) for l in mensal)
parcial = ultima[1] != 12
print(f"  anos: {anos[0]}-{anos[-1]} · competência mais recente: {ultima[1]:02d}/{ultima[0]}"
      + (" (ano em curso)" if parcial else ""))

# --------------- Municípios na competência mais recente ---------------
print(f"\nMunicípios das 9 UFs em {ultima[1]:02d}/{ultima[0]}")
comp = f"{ultima[0]}{ultima[1]:02d}"
linhas_mun = []
for codigo, sigla in UFS.items():
    for r in api(f"/cobertura/aps?unidadeGeografica=MUNICIPIO&coUf={codigo}&nuCompInicio={comp}&nuCompFim={comp}"):
        pop = num(r.get("qtPopulacao"))
        equipes = (num(r.get("qtEsf")) or 0) + (num(r.get("qtEap30")) or 0) + (num(r.get("qtEap20")) or 0)
        linhas_mun.append({
            "uf": sigla,
            "cod_municipio": r.get("coMunicipioIbge"),
            "municipio": r.get("noMunicipioAcentuado") or r.get("noMunicipioIbge"),
            "esf": num(r.get("qtEsf")),
            "equipes": equipes,
            "populacao": pop,
            "equipes_por_100mil": round(equipes / pop * 100000, 1) if pop else None,
            "cobertura_pct": num(r.get("qtCobertura")),
        })
linhas_mun.sort(key=lambda x: (x["uf"], x["municipio"] or ""))
gravar("aps_municipio_ultima.csv",
       ["uf", "cod_municipio", "municipio", "esf", "equipes", "populacao", "equipes_por_100mil", "cobertura_pct"],
       linhas_mun)

# --------------- Consolidado versionado para o painel ---------------
rotulos = list(UFS.values()) + ["Norte", "BR"]
serie = lambda campo: {
    uf: {str(l["ano"]): l[campo] for l in linhas_ano if l["uf"] == uf and l[campo] is not None}
    for uf in rotulos
}
payload = {
    "indicador": "I2.2.2",
    "nome": "Atenção primária — equipes e cobertura populacional",
    "atualizadoEm": datetime.date.today().isoformat(),
    "competenciaMaisRecente": f"{ultima[1]:02d}/{ultima[0]}",
    "fonte": {
        "sistema": "Ministério da Saúde — e-Gestor Atenção Básica / Relatórios Públicos da APS",
        "api": API,
        "endpoints": {"ab": "/cobertura/ab (07/2007 a 12/2020)", "aps": "/cobertura/aps (01/2021 em diante)"},
        "recorteAnual": "dezembro de cada ano; no ano corrente, a competência mais recente",
    },
    "anos": [str(a) for a in anos],
    "anosParciais": [str(ultima[0])] if parcial else [],
    "quebraMetodologica": {
        "ano": 2021,
        "nota": "A cobertura muda de definição em 2021. Até 2020 é a metodologia da Atenção "
                "Básica, que divide equipes parametrizadas pela população e trava em 100%. De "
                "2021 em diante é a do Previne Brasil, que parte da capacidade de atendimento "
                "das equipes e por isso ultrapassa 100%. Os dois trechos não formam uma série.",
    },
    "series": {
        # Única sem quebra: mesma definição de 2007 até hoje.
        "esfPor100mil": serie("esf_por_100mil"),
        # Definição que o painel exibe (eSF + eAP); a eAP só existe a partir de 2021.
        "equipesPor100mil": serie("equipes_por_100mil"),
        # Indicador oficial do I2.2.2, com a quebra acima.
        "coberturaPct": serie("cobertura_pct"),
        # Contagens absolutas, para o painel não precisar do CSV em dados/.
        "equipes": serie("equipes"),
        "esf": serie("esf"),
    },
    "metodologiaPorAno": {str(a): next(l["metodologia"] for l in linhas_ano if l["ano"] == a) for a in anos},
    "municipios": [
        {"uf": l["uf"], "codigo": l["cod_municipio"], "nome": l["municipio"],
         "equipesPor100mil": l["equipes_por_100mil"], "coberturaPct": l["cobertura_pct"]}
        for l in linhas_mun
    ],
}
destino_json = os.path.join(PUBLICO, "atencao-primaria.json")
with open(destino_json, "w", encoding="utf-8") as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"\nConsolidado versionado -> {destino_json}")

# --------------- Relatório ---------------
recentes = [a for a in anos if a >= anos[-1] - 9]
print("\nEquipes de Saúde da Família por 100 mil habitantes (dezembro de cada ano)")
print("UF   " + " ".join(f"{a:>6}" for a in recentes))
for uf in rotulos:
    v = {l["ano"]: l["esf_por_100mil"] for l in linhas_ano if l["uf"] == uf}
    print(f"{uf:5}" + " ".join(f"{v[a]:6.1f}" if v.get(a) is not None else "     -" for a in recentes))

print("\nCobertura populacional (%) — AB até 2020, APS de 2021 em diante")
print("UF   " + " ".join(f"{a:>6}" for a in recentes))
for uf in rotulos:
    v = {l["ano"]: l["cobertura_pct"] for l in linhas_ano if l["uf"] == uf}
    print(f"{uf:5}" + " ".join(f"{v[a]:6.1f}" if v.get(a) is not None else "     -" for a in recentes))

# Conferência contra o que o painel publica hoje (CNES jul/2026, eSF + eAP).
painel = os.path.join(PUBLICO, "dashboard.json")
if os.path.exists(painel):
    with open(painel, encoding="utf-8") as f:
        estados = {e["uf"]: e for e in json.load(f)["states"]}
    print(f"\nConferência — CNES jul/2026 (painel) x e-Gestor {ultima[1]:02d}/{ultima[0]} (eSF + eAP):")
    for uf in sorted(UFS.values()):
        atual = estados.get(uf, {}).get("esfTeams")
        novo = next((l["equipes"] for l in linhas_ano if l["uf"] == uf and l["ano"] == ultima[0]), None)
        if atual is None or novo is None:
            continue
        print(f"  {uf}  CNES {atual:6.0f}   e-Gestor {novo:6.0f}   dif {novo - atual:+.0f} ({(novo - atual) / atual * 100:+.1f}%)")
else:
    print(f"\n(sem {painel} — conferência contra o painel pulada)")
