#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Baixa focos de calor anuais por estado (INPE Queimadas, satélite de referência)
para 2015-2025 e agrega contagem por UF/ano.
"""
import os, csv, io, zipfile, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

BASE = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/anual/EstadosBr_sat_ref"
UFS = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]
ANOS = list(range(2015, 2026))
OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "dados", "focos")
os.makedirs(OUTDIR, exist_ok=True)

def fetch(url, timeout=120):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=timeout) as r:
        return r.read()

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

def count_focos(path):
    """conta linhas de dados do CSV dentro do zip (ignora header)"""
    with zipfile.ZipFile(path) as z:
        name = [n for n in z.namelist() if n.endswith(".csv")][0]
        with z.open(name) as f:
            total = 0
            first = True
            for line in f:
                if first:
                    first = False
                    continue
                total += 1
            return total

def main():
    results = {}
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=6) as ex:
        futs = [ex.submit(download_one, uf, ano) for uf in UFS for ano in ANOS]
        for i, fut in enumerate(as_completed(futs), 1):
            uf, ano, status, size = fut.result()
            results[(uf, ano)] = (status, size)
            if status == "ok":
                print(f"[{i}/99] {uf} {ano}: {size/1e6:.1f}MB", flush=True)
    print("downloads:", {s: sum(1 for v in results.values() if v[0] == s) for s in ("ok", "cached")}, "erros:", [k for k, v in results.items() if v[0] != "ok" and v[0] != "cached"], flush=True)

    # agrega
    rows = []
    for uf in UFS:
        for ano in ANOS:
            fname = f"focos_br_{uf.lower()}_ref_{ano}.zip"
            path = os.path.join(OUTDIR, fname)
            if os.path.exists(path):
                try:
                    n = count_focos(path)
                    rows.append((uf, ano, n))
                except Exception as e:
                    print("erro contando", fname, e)
    outcsv = os.path.join(OUTDIR, "focos_calor_uf_ano.csv")
    with open(outcsv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["uf", "ano", "focos_sat_ref"])
        w.writerows(sorted(rows))
    print("CSV final:", outcsv, "linhas:", len(rows))
    print("tempo total: %.1f min" % ((time.time() - t0) / 60))

if __name__ == "__main__":
    main()
