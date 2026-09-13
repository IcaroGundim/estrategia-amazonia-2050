"""Gera uma proposta a partir dos JSONs de detalhe que os coletores gravam em
``dashboard/public/data/``.

Os coletores (eixo2_ideb_inep.py, baixar_focos.py, eixo2_atencao_primaria.py…)
continuam escrevendo esses JSONs; este script os lê e monta a proposta para as
métricas do Panorama que vêm deles. Roda depois dos coletores::

    python scripts/gerar_propostas.py            # todas as séries
    python scripts/gerar_propostas.py ideb focos # só algumas

A proposta vai para dashboard/conteudo/propostas/ e é aceita ou rejeitada na
tela de administração (Propostas). Nada é gravado em valores.csv por aqui.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from proposta import RAIZ, Proposta

DADOS = RAIZ / "dashboard" / "public" / "data"


def le(nome: str) -> dict:
    return json.loads((DADOS / nome).read_text(encoding="utf-8"))


# nome curto → (arquivo, função que devolve {codigo: {uf: {ano: valor}}}, fonte)
SERIES = {
    "focos": ("focos-calor.json", lambda d: {"focos": d["serie"]}, "INPE Queimadas (satélite de referência)"),
    "escola": ("frequencia-escolar-15a17.json", lambda d: {"school": d["serieAnual"]}, "IBGE/PNADc"),
    "aps": ("atencao-primaria.json", lambda d: {"apsCobertura": d["series"]["coberturaPct"], "apsEquipes": d["series"]["equipes"]}, "MS/e-Gestor"),
    "pd": ("pd-estadual.json", lambda d: {"pdPctPib": d["seriePctPib"]}, "MCTI + IBGE/SIDRA"),
    "pevs": ("pevs-extracao-vegetal.json", lambda d: {"pevsBilhoes": d["seriePrecosCorrentes"]["serie"]}, "IBGE/PEVS"),
    "pia": ("pia-transformacao-industrial.json", lambda d: {"piaBilhoes": d["seriePrecosCorrentes"]["serie"]}, "IBGE/PIA-Empresa"),
    "ideb": ("ideb.json", lambda d: {
        "idebAnosIniciais": d["idebObservado"]["anos iniciais"],
        "idebAnosFinais": d["idebObservado"]["anos finais"],
        "idebEnsinoMedio": d["idebObservado"]["ensino médio"],
    }, "INEP/IDEB"),
}


def main(argv: list[str]) -> int:
    # O console do Windows nem sempre aceita UTF-8; sem isto um acento derruba o script.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    escolhidas = [nome for nome in argv if nome in SERIES] or list(SERIES)
    desconhecidas = [nome for nome in argv if nome not in SERIES]
    if desconhecidas:
        print(f"séries desconhecidas: {', '.join(desconhecidas)}. Opções: {', '.join(SERIES)}")
        return 1
    proposta = Proposta("gerar_propostas", descricao=f"Séries dos coletores: {', '.join(escolhidas)}")
    fontes = []
    for nome in escolhidas:
        arquivo, extrai, fonte = SERIES[nome]
        try:
            dados = le(arquivo)
        except FileNotFoundError:
            print(f"{nome}: {arquivo} não existe; rode o coletor antes")
            continue
        for codigo, por_uf in extrai(dados).items():
            antes = len(proposta.valores)
            proposta.serie(codigo, por_uf)
            print(f"{nome}: {codigo} - {len(proposta.valores) - antes} celula(s)")
        fontes.append(fonte)
    proposta.fonte = "; ".join(dict.fromkeys(fontes))
    caminho = proposta.gravar()
    if caminho is None:
        print("nada a propor")
        return 0
    print(f"proposta gravada: {caminho.relative_to(RAIZ)} ({len(proposta.valores)} células)")
    print("Aceite ou rejeite em Administracao > Propostas. Se estiver na Vercel, faça commit e push do arquivo.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
