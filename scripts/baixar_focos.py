#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Eixo 1 / I1.3.4 — Focos de calor anuais por estado (INPE Queimadas).

Usa a pasta EstadosBr_sat_ref, do **satélite de referência**: é a única série que o
INPE considera comparável ao longo do tempo, porque o número de satélites que
detectam foco mudou muito desde 2003 e a contagem "todos os satélites" não serve
para comparar anos. Trocar de pasta mudaria o indicador, então não se troca.

Os anos não são uma faixa fixa: o script lista o diretório de cada UF e baixa o que
existir. Hoje o INPE publica de 2003 a 2024 — 2025 ainda não está nesta pasta.

Saídas em dados/focos/:
  - focos_calor_uf_ano.csv (uf, ano, focos_sat_ref)
E o consolidado versionado, que vai junto com o site:
  - dashboard/public/data/focos-calor.json
"""
import os, csv, datetime, io, json, re, zipfile, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

BASE = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/anual/EstadosBr_sat_ref"
UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
BASEDIR = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(BASEDIR, "..", "dados", "focos")
PUBLICO = os.path.join(BASEDIR, "..", "dashboard", "public", "data")
os.makedirs(OUTDIR, exist_ok=True)

def fetch(url, timeout=120):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=timeout) as r:
        return r.read()

def anos_publicados(uf):
    """Lista o diretório da UF em vez de fixar a faixa: assim o script incorpora
    sozinho o ano novo quando o INPE publicar, e não tenta baixar o que não existe."""
    html = fetch(f"{BASE}/{uf}/", timeout=120).decode("utf-8", "replace")
    return sorted({int(a) for a in re.findall(rf"focos_br_{uf.lower()}_ref_(\d{{4}})\.zip", html)})


def download_one(uf, ano):
    fname = f"focos_br_{uf.lower()}_ref_{ano}.zip"
    url = f"{BASE}/{uf}/{fname}"
    dest = os.path.join(OUTDIR, fname)
    if os.path.exists(dest) and os.path.getsize(dest) > 1000:
        return uf, ano, "cached", 0
    try:
        data = fetch(url)
        with open(dest, "wb") as f:
            f.write(data)
        return uf, ano, "ok", len(data)
    except Exception as e:
        return uf, ano, f"ERRO: {e}", 0

def count_focos(path, ano):
    """Conta os focos DATADOS no ano pedido, e não as linhas do arquivo.

    A diferença importa: o servidor do INPE devolve o arquivo errado em dois casos
    (focos_br_ro_ref_2006.zip traz 41.649 registros todos de 2005, e o de 2016 traz os
    de 2015). Contar linhas propagaria o ano vizinho como se fosse medição própria e
    deixaria a série com um degrau que nunca existiu. Conferindo a data, esses anos
    ficam ausentes, que é o que de fato se sabe sobre eles.

    A contagem em si continua sendo o total de linhas do arquivo, que é a metodologia
    original do painel: um foco por linha, como o INPE entrega. A data serve só para
    validar de que ano é o arquivo — ler a coluna `data_pas` pelo nome, e não procurar
    um ano em qualquer coluna, porque o `id_bdq` também começa com quatro dígitos e
    parecia data em algumas linhas.

    Devolve (total_de_focos, ano_predominante_no_arquivo).
    """
    with zipfile.ZipFile(path) as z:
        name = [n for n in z.namelist() if n.endswith(".csv")][0]
        texto = z.read(name).decode("utf-8", "replace")
    leitor = csv.reader(io.StringIO(texto))
    cabecalho = next(leitor, None) or []
    coluna = next((i for i, c in enumerate(cabecalho) if c.strip().lower() == "data_pas"), None)
    if coluna is None:
        coluna = next((i for i, c in enumerate(cabecalho) if "data" in c.strip().lower()), None)
    total = 0
    contagem = {}
    for linha in leitor:
        total += 1
        if coluna is not None and len(linha) > coluna:
            marca = linha[coluna].strip()[:4]
            if marca.isdigit():
                contagem[marca] = contagem.get(marca, 0) + 1
    if not contagem:
        return total, None
    return total, int(max(contagem, key=contagem.get))

def main():
    results = {}
    t0 = time.time()
    anos_por_uf = {uf: anos_publicados(uf) for uf in UFS}
    todos = sorted({a for v in anos_por_uf.values() for a in v})
    print(f"anos publicados pelo INPE: {todos[0]}-{todos[-1]} ({len(todos)})", flush=True)
    tarefas = [(uf, ano) for uf in UFS for ano in anos_por_uf[uf]]
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(download_one, uf, ano) for uf, ano in tarefas]
        for i, fut in enumerate(as_completed(futs), 1):
            uf, ano, status, size = fut.result()
            results[(uf, ano)] = (status, size)
            if status == "ok":
                print(f"[{i}/{len(tarefas)}] {uf} {ano}: {size/1e6:.1f}MB", flush=True)
    print("downloads:", {s: sum(1 for v in results.values() if v[0] == s) for s in ("ok", "cached")}, "erros:", [k for k, v in results.items() if v[0] != "ok" and v[0] != "cached"], flush=True)

    # agrega
    rows, descartados = [], []
    for uf in UFS:
        for ano in anos_por_uf[uf]:
            fname = f"focos_br_{uf.lower()}_ref_{ano}.zip"
            path = os.path.join(OUTDIR, fname)
            if os.path.exists(path):
                try:
                    n, predominante = count_focos(path, ano)
                    if predominante is not None and predominante != ano:
                        descartados.append((uf, ano, predominante))
                        continue
                    rows.append((uf, ano, n))
                except Exception as e:
                    print("erro contando", fname, e)
    if descartados:
        print("anos descartados (o INPE serviu arquivo de outro ano):", flush=True)
        for uf, ano, veio in descartados:
            print(f"    {uf} {ano}: o arquivo contém dados de {veio}", flush=True)
    outcsv = os.path.join(OUTDIR, "focos_calor_uf_ano.csv")
    with open(outcsv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["uf", "ano", "focos_sat_ref"])
        w.writerows(sorted(rows))
    print("CSV final:", outcsv, "linhas:", len(rows))

    # ---------- consolidado versionado ----------
    serie = {}
    for uf, ano, n in rows:
        serie.setdefault(uf, {})[str(ano)] = n
    payload = {
        "indicador": "I1.3.4",
        "nome": "Focos de calor (satélite de referência)",
        "unidade": "focos",
        "atualizadoEm": datetime.date.today().isoformat(),
        "fonte": {
            "sistema": "INPE — Programa Queimadas",
            "caminho": BASE,
            "satelite": "satélite de referência (sat_ref)",
            "porQueSatRef": "O número de satélites que detectam foco mudou muito desde 2003, "
                            "então a contagem de todos os satélites não é comparável entre anos. "
                            "O INPE mantém o satélite de referência exatamente para permitir a "
                            "comparação histórica, e é ele que esta série usa.",
        },
        "anos": [str(a) for a in todos],
        "nota": "Contagem de focos, não área queimada. Depende de cobertura de nuvens e do "
                "horário de passagem do satélite, então serve para comparar anos e estados, "
                "não para medir extensão do fogo.",
        "serie": serie,
        "anosAusentes": [{"uf": uf, "ano": str(ano), "arquivoContem": str(veio)} for uf, ano, veio in descartados],
        "notaAusencias": "O servidor do INPE devolve, para esses pares UF/ano, o arquivo de "
                         "outro ano. Contar as linhas repetiria o ano vizinho como se fosse "
                         "medição própria, então eles ficam ausentes da série.",
    }
    destino = os.path.join(PUBLICO, "focos-calor.json")
    with open(destino, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("Consolidado versionado ->", os.path.relpath(destino, os.path.join(BASEDIR, "..")))

    print()
    print("Focos de calor por UF e ano (satélite de referência)")
    print("UF   " + " ".join(f"{a:>7}" for a in todos))
    for uf in UFS:
        v = serie.get(uf, {})
        print(f"{uf:4} " + " ".join(f"{v[str(a)]:7,}" if str(a) in v else "      -" for a in todos))
    print("tempo total: %.1f min" % ((time.time() - t0) / 60))

if __name__ == "__main__":
    main()
