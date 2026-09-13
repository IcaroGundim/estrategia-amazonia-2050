"""Propostas de valores para o painel.

Os scripts de coleta não escrevem mais nos números do painel: o que trazem
entra como *proposta*, um JSON em ``dashboard/conteudo/propostas/`` que a tela
de administração mostra célula a célula (novo, alterado, igual) para alguém
aceitar ou rejeitar. Só a aceitação grava em ``conteudo/valores.csv``.

Uso num coletor::

    from proposta import Proposta
    p = Proposta("eixo2_ideb_inep", fonte="INEP/IDEB", descricao="IDEB 2025 por UF")
    p.valor("idebAnosIniciais", "AC", 6.3, ano=2025)
    p.valor("I1.1.2", "AC", 6, campo="total")      # campo auxiliar, sem ano
    p.valor("I1.1.2", "AC", 75)                     # valor atual, sem ano
    caminho = p.gravar()

Uma proposta vazia não é gravada. O arquivo tem um id único (data, script e
um sufixo) para duas execuções no mesmo dia não se sobreporem.
"""
from __future__ import annotations

import json
import secrets
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
PASTA_PROPOSTAS = RAIZ / "dashboard" / "conteudo" / "propostas"
UFS = {"AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"}


@dataclass
class Proposta:
    script: str
    fonte: str = ""
    descricao: str = ""
    valores: list[dict] = field(default_factory=list)

    def valor(self, codigo: str, uf: str, valor, ano: int | str | None = None, campo: str = "", nota: str = "") -> None:
        """Acrescenta uma célula. ``valor`` None é ignorado; texto e número são aceitos."""
        if valor is None:
            return
        uf = str(uf).strip().upper()
        if uf not in UFS:
            raise ValueError(f"UF desconhecida: {uf!r}")
        if ano not in (None, ""):
            ano = int(str(ano)[:4])
            if not 1900 <= ano <= 2100:
                raise ValueError(f"ano fora do intervalo: {ano}")
        if isinstance(valor, float) and valor != valor:  # NaN
            return
        registro = {"codigo": str(codigo).strip(), "campo": str(campo or "").strip(), "uf": uf,
                    "ano": "" if ano in (None, "") else str(ano), "valor": valor}
        if nota:
            registro["nota"] = str(nota)
        self.valores.append(registro)

    def serie(self, codigo: str, por_uf_ano: dict, campo: str = "") -> None:
        """Acrescenta uma série ``{uf: {ano: valor}}`` inteira.

        Chaves que não são UF da Amazônia Legal ("BR", "NORTE", agregados de
        contexto que alguns coletores gravam junto) são ignoradas.
        """
        for uf, serie in (por_uf_ano or {}).items():
            if str(uf).strip().upper() not in UFS:
                continue
            for ano, valor in (serie or {}).items():
                self.valor(codigo, uf, valor, ano=ano, campo=campo)

    def gravar(self, pasta: Path = PASTA_PROPOSTAS) -> Path | None:
        if not self.valores:
            return None
        pasta.mkdir(parents=True, exist_ok=True)
        hoje = date.today().isoformat()
        identificador = f"{hoje}-{self.script}-{secrets.token_hex(2)}"
        caminho = pasta / f"{identificador}.json"
        conteudo = {
            "id": identificador,
            "geradoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "script": self.script,
            "fonte": self.fonte,
            "descricao": self.descricao,
            "valores": self.valores,
        }
        caminho.write_text(json.dumps(conteudo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return caminho
