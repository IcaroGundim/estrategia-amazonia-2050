# -*- coding: utf-8 -*-
"""I1.3.2 - PRODES por UF (Amazonia, Cerrado, Pantanal) e DETER como contexto.

Rodar da raiz do projeto, do zero:
    python -I scripts/eixo1_coleta_I1_3_2_prodes.py

Grava em dados/eixo1_coleta/I1.3.2_prodes/:
    brutos/       downloads publicos (JSON do painel TerraBrasilis, WFS, PDFs do INPE/MMA)
    series.csv    formato longo (codigo,serie,rotulo,uf,ano,valor,unidade,fonte_url,nota)
    fontes.csv    url,titulo,orgao,tipo,data_documento,acessado_em,arquivo_local

Usa apenas a biblioteca padrao. Os arquivos baixados sao tratados como dado: nada e executado.
"""
import csv
import io
import json
import os
import re
import time
import urllib.parse
import urllib.request
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT = os.path.join(ROOT, 'dados', 'eixo1_coleta', 'I1.3.2_prodes')
BR = os.path.join(OUT, 'brutos')
REL = 'dados/eixo1_coleta/I1.3.2_prodes/brutos/'
ACESSO = '2026-10-07'
UA = 'Mozilla/5.0 (pesquisa de dados; Estrategia Amazonia 2050)'
TB = 'https://terrabrasilis.dpi.inpe.br'
DASH = TB + '/app/prodes/dashboard/deforestation/files/'
WFS = TB + '/geoserver/ows'
PAGE = 20000

SCOPE = ['AC', 'AM', 'AP', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO']
CER_SCOPE = ['MA', 'MT', 'PA', 'RO', 'TO']   # UFs do escopo listadas no PRODES Cerrado
CER_ALL = ['BA', 'DF', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PI', 'PR', 'RO', 'SP', 'TO']  # 13 UFs do Cerrado (checagem)
PAN_SCOPE = ['MT']                          # UFs do escopo listadas no PRODES Pantanal

NOME_UF = {
    'Acre': 'AC', 'Amazonas': 'AM', 'Amapá': 'AP', 'Maranhão': 'MA', 'Mato Grosso': 'MT',
    'Pará': 'PA', 'Rondônia': 'RO', 'Roraima': 'RR', 'Tocantins': 'TO',
    'Mato Grosso do Sul': 'MS', 'Minas Gerais': 'MG', 'Piauí': 'PI', 'Paraná': 'PR',
    'Goiás': 'GO', 'Bahia': 'BA', 'São Paulo': 'SP', 'Distrito Federal': 'DF',
}

# Valores publicados em notas tecnicas do INPE/MMA (conferidos no texto dos PDFs baixados).
NT_AMZ_2024 = {'AC': 449, 'AM': 1223, 'AP': 27, 'MA': 307, 'MT': 1257, 'PA': 2395, 'RO': 360, 'RR': 468, 'TO': 32}
NT_AMZ_2025_EST = {'AC': 325, 'AM': 1016, 'AP': 14, 'MA': 227, 'MT': 1572, 'PA': 2098, 'RO': 239, 'RR': 293, 'TO': 12}
NT_CER_TOTAL = {2024: 8174.17, 2025: 7235.27}
NT_CER_UF_2025 = {'MA': 2006.02, 'TO': 1488.68}
NT_PAN_TOTAL = {2024: 842.44, 2025: 291.21}
NT_PAN_UF_2025 = {'MT': 53.51, 'MS': 237.69}
MMA_AMZ_BIOMA = {2016: 7078, 2017: 6758, 2018: 6958, 2019: 10701, 2020: 10352, 2021: 12177,
                 2022: 12474, 2023: 7806, 2024: 6071, 2025: 5111}
MMA_CER = {2016: 7497, 2017: 7117, 2018: 7260, 2019: 6319, 2020: 7903, 2021: 8531,
           2022: 10689, 2023: 11012, 2024: 8174, 2025: 7235}
MMA_PAN = {2016: 619, 2017: 712, 2018: 499, 2019: 514, 2020: 678, 2021: 824,
           2022: 789, 2023: 723, 2024: 842, 2025: 291}
MMA_DETER_AMZ_2025_26 = 2874.38
MMA_DETER_CER_2025_26 = 5119.46

U_RATES = DASH + 'rates2025.json?v=3.5.4'
U_AMZ = DASH + 'data/prodes_amazon.json?v=3.5.4'
U_NF = DASH + 'data/prodes_amazon_nf.json?v=3.5.4'
U_CER = DASH + 'data/prodes_cerrado.json?v=3.5.4'
U_PAN = DASH + 'data/prodes_pantanal.json?v=3.5.4'
U_DETER_AMZ = WFS + '?service=WFS&request=GetFeature&typeName=deter-amz:deter_amz'
U_DETER_CER = WFS + '?service=WFS&request=GetFeature&typeName=deter-cerrado-nb:deter_cerrado'

DOWNLOADS = [
    (DASH + 'rates2025.json?v=3.5.4', 'rates2025.json'),
    (DASH + 'last_update_date.json?v=3.5.4', 'last_update_date.json'),
    (U_AMZ, 'prodes_amazon_incremento.json'),
    (DASH + 'data/prodes_legal_amazon.json?v=3.5.4', 'prodes_legal_amazon_incremento.json'),
    (U_NF, 'prodes_amazon_nf_incremento.json'),
    (U_CER, 'prodes_cerrado_incremento.json'),
    (U_PAN, 'prodes_pantanal_incremento.json'),
    (DASH + 'config/loinames/prodes_legal_amazon.json?v=3.5.4', 'loinames_prodes_legal_amazon.json'),
    (DASH + 'config/loinames/prodes_amazon.json?v=3.5.4', 'loinames_prodes_amazon.json'),
    (DASH + 'config/loinames/prodes_amazon_nf.json?v=3.5.4', 'loinames_prodes_amazon_nf.json'),
    (DASH + 'config/loinames/prodes_cerrado.json?v=3.5.4', 'loinames_prodes_cerrado.json'),
    (DASH + 'config/loinames/prodes_pantanal.json?v=3.5.4', 'loinames_prodes_pantanal.json'),
    (TB + '/app/dashboard/deforestation/biomes/legal_amazon/rates', 'painel_pagina_legal_amazon_rates.html'),
    (TB + '/downloads/', 'terrabrasilis_downloads.html'),
    ('https://sinaflor.ibama.gov.br/', 'sinaflor_pagina_inicial.html'),
    (WFS + '?service=WFS&version=2.0.0&request=GetCapabilities', 'wfs_getcapabilities.xml'),
    ('https://www.gov.br/inpe/pt-br/assuntos/ultimas-noticias/20251015Nota_tcnica_EstimativaPRODES_2025.pdf',
     'NT_INPE_EstimativaPRODES_2025_20251015.pdf'),
    ('https://data.inpe.br/wp-content/uploads/sites/3/2025/10/2025_1022NT_PRODESCerrado_2025.pdf',
     'NT_INPE_PRODESCerrado_2025.pdf'),
    ('https://data.inpe.br/biomasbr/wp-content/uploads/sites/3/2025/11/NT_Prodes_Pantanal_2025_final.pdf',
     'NT_INPE_PRODES_Pantanal_2025.pdf'),
    ('https://www.gov.br/mma/pt-br/noticias-defeso-eleitoral/2026_0807divulgacao_deter-claudio_final.pdf/',
     'MMA_divulgacao_DETER_2026-08-07.pdf'),
]


def get(url, timeout=600, tries=6):
    """Baixa uma URL publica; repete em falha transitoria (429/5xx com espera maior)."""
    erro = None
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                time.sleep(0.3)  # pausa curta entre requisicoes ao servidor
                return r.read()
        except Exception as e:  # noqa: BLE001 - registra e tenta de novo
            erro = e
            codigo = getattr(e, 'code', None)
            espera = 30 * (k + 1) if codigo in (429, 500, 502, 503, 504) else 4 * (k + 1)
            time.sleep(espera)
    raise RuntimeError('falha ao baixar %s: %s' % (url, erro))


def baixa(url, nome):
    dados = get(url)
    os.makedirs(BR, exist_ok=True)
    with open(os.path.join(BR, nome), 'wb') as f:
        f.write(dados)
    print('  ok', nome, len(dados), 'bytes')


def wfs_hits(typename, cql):
    q = {'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature', 'typeName': typename,
         'resultType': 'hits', 'CQL_FILTER': cql}
    t = get(WFS + '?' + urllib.parse.urlencode(q)).decode('utf-8', 'replace')
    m = re.search(r'numberMatched="(\d+)"', t)
    if not m:
        raise RuntimeError('resposta sem numberMatched: ' + t[:200])
    return int(m.group(1))


def wfs_pagina(typename, cql, props, inicio, ordem='gid'):
    """Uma pagina de feicoes em CSV. ordem=None para camadas sem campo gid (usar so em consultas < 20.000 linhas)."""
    q = {'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature', 'typeName': typename,
         'outputFormat': 'csv', 'propertyName': props, 'CQL_FILTER': cql,
         'startIndex': str(inicio), 'count': str(PAGE)}
    if ordem:
        q['sortBy'] = ordem
    return get(WFS + '?' + urllib.parse.urlencode(q)).decode('utf-8-sig')


def baixa_deter(typename, ufs, anos, props, nome):
    """Baixa o DETER por UF e ano civil, paginando, e confere linhas x numberMatched."""
    arq = os.path.join(BR, nome)
    total = 0
    cabecalho_gravado = False
    with open(arq, 'wb') as fh:
        for uf in ufs:
            for a in anos:
                cql = "uf='%s' AND view_date>='%d-01-01' AND view_date<'%d-01-01'" % (uf, a, a + 1)
                n = wfs_hits(typename, cql)
                if n == 0:
                    continue
                lidos = 0
                while lidos < n:
                    linhas = wfs_pagina(typename, cql, props, lidos).splitlines(keepends=True)
                    if len(linhas) < 2:
                        break
                    if not cabecalho_gravado:
                        fh.write(linhas[0].encode('utf-8'))
                        cabecalho_gravado = True
                    dados = linhas[1:]
                    fh.write(''.join(dados).encode('utf-8'))
                    lidos += len(dados)
                if lidos != n:
                    raise RuntimeError('DETER %s %s %d: lidos %d de %d' % (typename, uf, a, lidos, n))
                total += lidos
        print('  ok', nome, total, 'registros (conferidos com numberMatched)')
    return total


def ler_painel(arq_dados, arq_lois):
    """Retorna lista (inicio, fim, uf, valor) do nivel UF (loi == 1) de um JSON do painel."""
    lois = json.load(open(arq_lois, encoding='utf-8'))
    mapa = {}
    for lo in lois['lois']:
        if lo['name'] == 'uf':
            for x in lo['loinames']:
                mapa[x['gid']] = NOME_UF[x['loiname']]
    d = json.load(open(arq_dados, encoding='utf-8'))
    out = []
    for p in d['periods']:
        ini = p['startDate']['year']
        fim = p['endDate']['year']
        vistos = set()
        for f in p['features']:
            if f['loi'] != 1:
                continue
            uf = mapa[f['loiname']]
            if uf in vistos:
                raise RuntimeError('UF repetida no periodo %s-%s' % (ini, fim))
            vistos.add(uf)
            for a in f['areas']:
                if a['type'] != 1:
                    raise RuntimeError('tipo de area inesperado: %s' % a['type'])
                out.append((ini, fim, uf, float(a['area'])))
    return out


def ano_prodes(data):
    """Ano PRODES (ago-jul; rotulado pelo ano final) para uma data AAAA-MM-DD."""
    a = int(data[:4])
    m = int(data[5:7])
    return a + 1 if m >= 8 else a


def pct(a, b):
    return 100.0 * (a - b) / b if b else float('nan')


def main():
    os.makedirs(BR, exist_ok=True)
    print('== 1. Downloads de fontes publicas')
    for url, nome in DOWNLOADS:
        baixa(url, nome)

    print('== 2. Painel PRODES (JSON do TerraBrasilis)')
    taxa_leg = ler_painel(os.path.join(BR, 'rates2025.json'),
                          os.path.join(BR, 'loinames_prodes_legal_amazon.json'))
    inc_amz = ler_painel(os.path.join(BR, 'prodes_amazon_incremento.json'),
                         os.path.join(BR, 'loinames_prodes_amazon.json'))
    inc_leg = ler_painel(os.path.join(BR, 'prodes_legal_amazon_incremento.json'),
                         os.path.join(BR, 'loinames_prodes_legal_amazon.json'))
    inc_nf = ler_painel(os.path.join(BR, 'prodes_amazon_nf_incremento.json'),
                        os.path.join(BR, 'loinames_prodes_amazon_nf.json'))
    inc_cer = ler_painel(os.path.join(BR, 'prodes_cerrado_incremento.json'),
                         os.path.join(BR, 'loinames_prodes_cerrado.json'))
    inc_pan = ler_painel(os.path.join(BR, 'prodes_pantanal_incremento.json'),
                         os.path.join(BR, 'loinames_prodes_pantanal.json'))
    ultima = json.load(open(os.path.join(BR, 'last_update_date.json'), encoding='utf-8'))['last_date']
    print('  data da ultima atualizacao do painel:', ultima)

    # Taxa oficial (Amazonia Legal, floresta): ano = fim do periodo ago-jul
    taxa = {(uf, fim): int(round(v)) for ini, fim, uf, v in taxa_leg if uf in SCOPE}
    # Incrementos: separa acumulados (inicio 1500) de periodos anuais/plurianuais
    amz = {(uf, fim): (ini, v) for ini, fim, uf, v in inc_amz if uf in SCOPE and ini != 1500}
    amz_acum = {uf: v for ini, fim, uf, v in inc_amz if ini == 1500 and uf in SCOPE}
    nf = {(uf, fim): (ini, v) for ini, fim, uf, v in inc_nf if uf in SCOPE and ini != 1500}
    nf_acum = {uf: v for ini, fim, uf, v in inc_nf if ini == 1500 and uf in SCOPE}
    cer = {(uf, fim): (ini, v) for ini, fim, uf, v in inc_cer if ini != 1500}
    cer_acum = {uf: v for ini, fim, uf, v in inc_cer if ini == 1500}
    pan = {(uf, fim): (ini, v) for ini, fim, uf, v in inc_pan if ini != 1500}
    pan_acum = {uf: v for ini, fim, uf, v in inc_pan if ini == 1500}
    leg = {(uf, fim): v for ini, fim, uf, v in inc_leg if ini != 1500 and uf in SCOPE}

    print('== 3. Checagens contra fontes primarias')
    ok_taxa = 0
    dif_taxa = []
    local = os.path.join(ROOT, 'dados', 'prodes', 'prodes_rates_uf.csv')
    with open(local, encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            k = (r['uf'], int(r['ano']))
            if taxa.get(k) == int(r['taxa_km2']):
                ok_taxa += 1
            else:
                dif_taxa.append((k, r['taxa_km2'], taxa.get(k)))
    print('  CSV local dados/prodes/prodes_rates_uf.csv: %d de %d celulas iguais a rates2025.json'
          % (ok_taxa, ok_taxa + len(dif_taxa)))

    for uf in SCOPE:
        n24 = taxa.get((uf, 2024))
        n25 = taxa.get((uf, 2025))
        print('  taxa %s 2024: painel %s x NT consolidado %s | 2025: painel %s x estimativa NT %s'
              % (uf, n24, NT_AMZ_2024[uf], n25, NT_AMZ_2025_EST[uf]))
    tot24 = sum(taxa[(u, 2024)] for u in SCOPE)
    tot25 = sum(taxa[(u, 2025)] for u in SCOPE)
    print('  total Amazonia Legal: 2024 painel %d (NT 6518) | 2025 painel %d (estimativa NT 5796)' % (tot24, tot25))

    print('  Amazonia bioma (floresta, incremento) x MMA 2016-2025:')
    for ano in range(2016, 2026):
        s = sum(v for (uf, fim), (ini, v) in amz.items() if fim == ano)
        print('    %d: painel %.1f | MMA %d' % (ano, s, MMA_AMZ_BIOMA[ano]))
    print('  Cerrado (13 UFs, incremento) x NT 2024/2025: %.2f / %.2f (NT %.2f / %.2f)'
          % (sum(v for (uf, fim), (ini, v) in cer.items() if fim == 2024),
             sum(v for (uf, fim), (ini, v) in cer.items() if fim == 2025),
             NT_CER_TOTAL[2024], NT_CER_TOTAL[2025]))
    print('  Pantanal (MT+MS, incremento) x NT 2024/2025: %.2f / %.2f (NT %.2f / %.2f)'
          % (sum(v for (uf, fim), (ini, v) in pan.items() if fim == 2024),
             sum(v for (uf, fim), (ini, v) in pan.items() if fim == 2025),
             NT_PAN_TOTAL[2024], NT_PAN_TOTAL[2025]))

    print('== 4. Verificacao WFS (amostra por UF e ano)')
    verif = []
    for uf, ano, cql in [
        ('AC', 2024, "state='AC' AND year=2024"),
        ('AC', 2025, "state='AC' AND year=2025"),
    ]:
        n = wfs_hits('prodes-legal-amz:yearly_deforestation', cql)
        props = 'state,year,area_km,main_class,class_name,image_date,pub_date'
        txt = wfs_pagina('prodes-legal-amz:yearly_deforestation', cql, props, 0, ordem=None)
        nome = 'verif_wfs_legal_%s_%d.csv' % (uf, ano)
        open(os.path.join(BR, nome), 'w', encoding='utf-8', newline='').write(txt)
        rows = list(csv.DictReader(io.StringIO(txt)))
        soma = sum(float(r['area_km']) for r in rows)
        ref = leg.get((uf, ano))
        verif.append((nome, n, len(rows), round(soma, 2), ref))
        print('  %s: hits %d, linhas %d, soma WFS %.2f | painel %s' % (nome, n, len(rows), soma, ref))
    cql = "year=2024 AND (state='MATO GROSSO' OR state='MT')"
    n = wfs_hits('prodes-cerrado-nb:yearly_deforestation', cql)
    txt = wfs_pagina('prodes-cerrado-nb:yearly_deforestation', cql, 'state,year,class_name,area_km', 0, ordem=None)
    rows = list(csv.DictReader(io.StringIO(txt)))
    soma = sum(float(r['area_km']) for r in rows)
    nome = 'verif_wfs_cerrado_MT_2024.csv'
    open(os.path.join(BR, nome), 'w', encoding='utf-8', newline='').write(txt)
    print('  %s: hits %d, linhas %d, soma WFS %.2f | painel %s'
          % (nome, n, len(rows), soma, cer.get(('MT', 2024), (0, None))[1]))
    print('  nota: campo state do WFS usa nomes por extenso e siglas; WFS limita a 50.000 linhas sem paginacao')

    print('== 5. DETER (contexto), PRODES-ano (ago-jul)')
    anos = list(range(2015, 2027))
    n_amz = baixa_deter('deter-amz:deter_amz', SCOPE, anos,
                        'gid,uf,classname,view_date,areamunkm,areauckm', 'deter_amazonia_raw.csv')
    n_cer = baixa_deter('deter-cerrado-nb:deter_cerrado', CER_ALL, anos,
                        'gid,uf,classname,view_date,areatotalkm,areauckm', 'deter_cerrado_raw.csv')
    deter_amz = defaultdict(lambda: [0.0, 0.0, 0])   # (uf, ano PRODES) -> [CR+VEG, todas, n]
    deter_cer = defaultdict(lambda: [0.0, 0.0, 0])
    cob = {'amz': ['', ''], 'cer': ['', '']}           # [primeira data, ultima data] do layer
    for chave, arq, dic, campo in [
        ('amz', 'deter_amazonia_raw.csv', deter_amz, 'areamunkm'),
        ('cer', 'deter_cerrado_raw.csv', deter_cer, 'areatotalkm'),
    ]:
        with open(os.path.join(BR, arq), encoding='utf-8', newline='') as f:
            for r in csv.DictReader(f):
                a = ano_prodes(r['view_date'])
                v = float(r[campo]) if r[campo] not in ('', None) else 0.0
                c = dic[(r['uf'], a)]
                c[1] += v
                if r['classname'] in ('DESMATAMENTO_CR', 'DESMATAMENTO_VEG'):
                    c[0] += v
                c[2] += 1
                d = r['view_date']
                if not cob[chave][0] or d < cob[chave][0]:
                    cob[chave][0] = d
                if d > cob[chave][1]:
                    cob[chave][1] = d
    print('  DETER Amazonia: %d registros; cobertura %s a %s' % (n_amz, cob['amz'][0], cob['amz'][1]))
    print('  DETER Cerrado (13 UFs): %d registros; cobertura %s a %s' % (n_cer, cob['cer'][0], cob['cer'][1]))
    soma_amz_26 = sum(v[0] for (u, a), v in deter_amz.items() if a == 2026)
    soma_cer13_26 = sum(v[1] for (u, a), v in deter_cer.items() if a == 2026 and u in CER_ALL)
    print('  DETER Amazonia PRODES 2026 (ago/25-jul/26): CR+VEG %.2f (MMA %.2f, dif %.1f%%)'
          % (soma_amz_26, MMA_DETER_AMZ_2025_26, pct(soma_amz_26, MMA_DETER_AMZ_2025_26)))
    print('  DETER Cerrado 13 UFs PRODES 2026: %.2f (MMA %.2f, dif %.1f%%)'
          % (soma_cer13_26, MMA_DETER_CER_2025_26, pct(soma_cer13_26, MMA_DETER_CER_2025_26)))

    print('== 6. Diagnosticos de metodo (2008-2025)')
    print('  UF  ano  legal_incr  bioma_floresta  dif(fora do bioma)  taxa-incr')
    for uf in SCOPE:
        for ano in (2008, 2012, 2020, 2024, 2025):
            li = leg.get((uf, ano))
            bf = amz.get((uf, ano), (0, None))[1]
            tx = taxa.get((uf, ano))
            if li is None or bf is None:
                continue
            print('  %s %d %10.1f %12.1f %16.1f %10.1f' % (uf, ano, li, bf, li - bf, (tx or 0) - bf))

    # ----- montagem das series -----
    rows = []
    gaps = []

    def add(serie, uf, ano, valor, nota, url, rot, uni):
        if uni == 'ha':
            fmt = '%.2f' % valor
        elif isinstance(valor, int):
            fmt = '%d' % valor
        else:
            fmt = '%.2f' % valor
        rows.append({'codigo': 'I1.3.2', 'serie': serie, 'rotulo': rot, 'uf': uf, 'ano': ano,
                     'valor': fmt, 'unidade': uni, 'fonte_url': url, 'nota': nota})

    def nota_span(ini, fim):
        if fim - ini <= 1:
            return ''
        return ('PERIODO PLURIANUAL: %d anos (PRODES %d-%d) lancados no ano %d; valor do periodo, nao anual; '
                % (fim - ini, ini + 1, fim, fim))

    # 1) Taxa oficial Amazonia Legal (floresta), 1988-2025
    for (uf, ano), v in sorted(taxa.items(), key=lambda x: (x[0][0], x[0][1])):
        n = 'taxa oficial PRODES Amazonia Legal (floresta, regiao legal; nao o estado inteiro); ano = fim do periodo ago-jul; igual ao CSV local (342/342). '
        if ano == 2024:
            n += 'Confere com NT INPE 15/10/2025 Tab.2 (consolidado 2024 = %d). ' % NT_AMZ_2024[uf]
        if ano == 2025:
            n += ('Valor do painel atualizado em %s; estimativa NT 15/10/2025 (282 tiles) = %d; '
                  'taxa consolidada 516 tiles nao localizada em fonte aberta. ') % (ultima, NT_AMZ_2025_EST[uf])
        add('prodes_taxa_amazonia_legal_floresta_km2', uf, ano, v, n.strip(), U_RATES, 'componente', 'km2')

    # 2) Incremento bioma Amazonia (floresta), 2008-2025
    for (uf, ano), (ini, v) in sorted(amz.items()):
        if ano < 2008:
            continue
        add('prodes_incremento_amazonia_floresta_km2', uf, ano, round(v, 2),
            'incremento mapeado (soma de poligonos, bioma Amazonia, floresta); ano = fim do periodo ago-jul; ' + nota_span(ini, ano),
            U_AMZ, 'componente', 'km2')

    # 3) Incremento bioma Amazonia nao floresta (dashboard), 2000-2024
    for (uf, ano), (ini, v) in sorted(nf.items()):
        add('prodes_incremento_amazonia_nao_floresta_km2', uf, ano, round(v, 2),
            'incremento mapeado, classe nao florestal do bioma Amazonia (dashboard "PRODES AMAZON NF"); '
            'sem ano 2025 no painel; ' + nota_span(ini, ano), U_NF, 'componente', 'km2')

    # 4) Incremento bioma Cerrado (5 UFs do escopo), 2002-2025
    for (uf, ano), (ini, v) in sorted(cer.items()):
        if uf not in CER_SCOPE:
            continue
        add('prodes_incremento_cerrado_km2', uf, ano, round(v, 2),
            'incremento mapeado, bioma Cerrado (todas as fitofisionomias de supressao; area minima 1 ha); '
            + nota_span(ini, ano), U_CER, 'componente', 'km2')

    # 5) Incremento bioma Pantanal (MT), 2000-2025
    for (uf, ano), (ini, v) in sorted(pan.items()):
        if uf not in PAN_SCOPE:
            continue
        add('prodes_incremento_pantanal_km2', uf, ano, round(v, 2),
            'incremento mapeado, bioma Pantanal (supressao de vegetacao nativa); ' + nota_span(ini, ano),
            U_PAN, 'componente', 'km2')

    # 6) Desmatamento do estado inteiro = floresta + nao floresta + Cerrado + Pantanal (incremento), 2008-2025
    for uf in SCOPE:
        for ano in range(2008, 2026):
            partes = []
            aviso = []
            if (uf, ano) not in amz:
                gaps.append((uf, ano, 'floresta'))
                continue
            partes.append(amz[(uf, ano)][1])
            if (uf, ano) not in nf:
                gaps.append((uf, ano, 'nao floresta (sem valor anual)'))
                continue
            partes.append(nf[(uf, ano)][1])
            if nf[(uf, ano)][0] != ano - 1:
                aviso.append('Amazonia NF plurianual (%d-%d)' % (nf[(uf, ano)][0], ano))
            if uf in CER_SCOPE:
                if (uf, ano) not in cer:
                    gaps.append((uf, ano, 'cerrado (sem valor anual)'))
                    continue
                partes.append(cer[(uf, ano)][1])
                if cer[(uf, ano)][0] != ano - 1:
                    aviso.append('Cerrado plurianual (%d-%d)' % (cer[(uf, ano)][0], ano))
            if uf in PAN_SCOPE:
                if (uf, ano) not in pan:
                    gaps.append((uf, ano, 'pantanal (sem valor anual)'))
                    continue
                partes.append(pan[(uf, ano)][1])
                if pan[(uf, ano)][0] != ano - 1:
                    aviso.append('Pantanal plurianual (%d-%d)' % (pan[(uf, ano)][0], ano))
            total = sum(partes)
            urls_total = [U_AMZ, U_NF] + ([U_CER] if uf in CER_SCOPE else []) + ([U_PAN] if uf in PAN_SCOPE else [])
            base = ('soma: floresta + nao floresta' + (' + Cerrado' if uf in CER_SCOPE else '')
                    + (' + Pantanal' if uf in PAN_SCOPE else '') + ' (incrementos mapeados); '
                    'assume biomas sem sobreposicao (inferencia); '
                    'exclui floresta da Amazonia Legal fora do bioma; ')
            if uf not in CER_SCOPE:
                base += 'UF sem Cerrado na lista do PRODES Cerrado; '
            if aviso:
                base += 'ATENCAO: ' + '; '.join(aviso) + '. '
            add('desmatamento_estado_total_km2', uf, ano, round(total, 2), base.strip(), ' | '.join(urls_total),
                'componente', 'km2')
            add('desmatamento_estado_total_ha', uf, ano, round(total * 100, 2), base.strip(),
                ' | '.join(urls_total), 'componente', 'ha')

    # 6b) Proxy sem nao floresta: floresta + Cerrado + Pantanal, em todos os anos com valor anual de cada bioma.
    #     Serie separada (nao substitui o total); permite 2025 e cobre anos que o total com nao floresta perde.
    for uf in SCOPE:
        for ano in range(2008, 2026):
            if (uf, ano) not in amz:
                continue
            partes = [amz[(uf, ano)][1]]
            urls_p = [U_AMZ]
            aviso = []
            if uf in CER_SCOPE:
                if (uf, ano) not in cer:
                    continue
                partes.append(cer[(uf, ano)][1])
                urls_p.append(U_CER)
                if cer[(uf, ano)][0] != ano - 1:
                    aviso.append('Cerrado plurianual (%d-%d)' % (cer[(uf, ano)][0], ano))
            if uf in PAN_SCOPE:
                if (uf, ano) not in pan:
                    continue
                partes.append(pan[(uf, ano)][1])
                urls_p.append(U_PAN)
                if pan[(uf, ano)][0] != ano - 1:
                    aviso.append('Pantanal plurianual (%d-%d)' % (pan[(uf, ano)][0], ano))
            nota_p = ('proxy SEM nao floresta: floresta + ' + ('Cerrado + ' if uf in CER_SCOPE else '')
                      + ('Pantanal + ' if uf in PAN_SCOPE else '') + 'nao inclui a supressao nao florestal do bioma Amazonia; '
                      + ('UF sem Cerrado na lista do PRODES Cerrado; ' if uf not in CER_SCOPE else '')
                      + 'assume biomas sem sobreposicao (inferencia); '
                      + ('ATENCAO: ' + '; '.join(aviso) + '. ' if aviso else '')
                      + ('2025 incluido (sem nao floresta, que nao existe no painel).' if ano == 2025 else ''))
            add('desmatamento_estado_proxy_sem_nao_floresta_km2', uf, ano, round(sum(partes), 2), nota_p.strip(),
                ' | '.join(urls_p), 'proxy', 'km2')

    # 7) Acumulados ate 2000 (contexto; nao e taxa anual)
    for uf, v in sorted(cer_acum.items()):
        if uf in CER_SCOPE:
            add('prodes_cerrado_acumulado_ate_2000_km2', uf, 2000, round(v, 2),
                'acumulado do periodo base 1500-2000 (todo o desmatamento identificavel ate 2000); NAO e taxa anual',
                U_CER, 'contexto', 'km2')
    for uf, v in sorted(pan_acum.items()):
        if uf in PAN_SCOPE:
            add('prodes_pantanal_acumulado_ate_2000_km2', uf, 2000, round(v, 2),
                'acumulado do periodo base 1500-2000; NAO e taxa anual', U_PAN, 'contexto', 'km2')
    for uf, v in sorted(nf_acum.items()):
        add('prodes_amazonia_nao_floresta_acumulado_ate_2000_km2', uf, 2000, round(v, 2),
            'acumulado do periodo base 1500-2000; NAO e taxa anual', U_NF, 'contexto', 'km2')

    # 8) DETER (contexto), por ano PRODES; anos sem alerta entram como 0 (consulta WFS sem feicoes)
    def cobertura(k):
        return 'cobertura do layer no WFS: %s a %s' % (cob[k][0], cob[k][1])
    # Cobertura: DETER Amazonia comeca em 2016-08 (PRODES 2017 = primeiro ano completo);
    # DETER Cerrado comeca em 2018-05 (PRODES 2018 parcial; anos sem registro nao viram zero).
    for uf in SCOPE:
        for ano in range(2017, 2028):
            cr_veg, todas, n = deter_amz.get((uf, ano), [0.0, 0.0, 0])
            ob = ('campo areamunkm (inferencia); ano PRODES ago-jul; filtro anonimo do WFS (areamunkm >= 0,0625 km2); '
                  'desmatamento = DESMATAMENTO_CR + DESMATAMENTO_VEG; %d alertas' % n)
            ob = ob.replace("filtro anonimo do WFS (areamunkm >= 0,0625 km2)",
                            "filtro anonimo (resumo da camada: 'Filtered by areatotalkm >= 0.0625'; campo areatotalkm nao exposto em deter_amz)")
            if n == 0:
                ob = 'nenhum alerta no WFS para o ano PRODES; ' + ob
            if ano == 2027:
                ob += '; PARCIAL (ago-set/2026)'
            add('deter_amazonia_desmatamento_km2', uf, ano, round(cr_veg, 2), ob + '; ' + cobertura('amz'),
                U_DETER_AMZ, 'contexto', 'km2')
            ob_todas = ('todas as classes DETER (inclui degradacao, cicatriz de queimada, mineracao, corte seletivo); '
                        'campo areamunkm (inferencia); ano PRODES ago-jul; filtro anonimo do WFS; %d alertas' % n)
            if n == 0:
                ob_todas = 'nenhum alerta no WFS para o ano PRODES; ' + ob_todas
            if ano == 2027:
                ob_todas += '; PARCIAL (ago-set/2026)'
            add('deter_amazonia_todas_classes_km2', uf, ano, round(todas, 2),
                ob_todas + '; ' + cobertura('amz'), U_DETER_AMZ, 'contexto', 'km2')
    for uf in CER_SCOPE:
        for ano in range(2018, 2028):
            if ano == 2018 and (uf, ano) not in deter_cer:
                continue
            desm, todas, n = deter_cer.get((uf, ano), [0.0, 0.0, 0])
            ob = ("campo areatotalkm; ano PRODES ago-jul; filtro anonimo (resumo da camada: 'Filtered by areatotalkm >= 0.03'); "
                  'classe unica DESMATAMENTO_CR; %d alertas' % n)
            if n == 0:
                ob = 'nenhum alerta no WFS para o ano PRODES; ' + ob
            if ano == 2018:
                ob += '; PRODES 2018 parcial (layer comeca em %s)' % cob['cer'][0]
            if ano == 2027:
                ob += '; PARCIAL (ago-set/2026)'
            add('deter_cerrado_desmatamento_km2', uf, ano, round(desm, 2), ob + '; ' + cobertura('cer'),
                U_DETER_CER, 'contexto', 'km2')

    rows.sort(key=lambda r: (r['serie'], r['uf'], int(r['ano'])))
    with open(os.path.join(OUT, 'series.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['codigo', 'serie', 'rotulo', 'uf', 'ano', 'valor', 'unidade', 'fonte_url', 'nota'])
        w.writeheader()
        w.writerows(rows)

    fontes = [
        (TB + '/app/dashboard/deforestation/biomes/legal_amazon/rates', 'TerraBrasilis - painel PRODES Amazonia Legal (taxas)', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'painel_pagina_legal_amazon_rates.html'),
        (U_RATES, 'PRODES Legal Amazon - taxas por UF e periodo (arquivo do painel)', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'rates2025.json'),
        (DASH + 'last_update_date.json?v=3.5.4', 'Data da ultima atualizacao do painel PRODES', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'last_update_date.json'),
        (U_AMZ, 'PRODES Amazonia (bioma) - incrementos por UF e periodo', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'prodes_amazon_incremento.json'),
        (DASH + 'data/prodes_legal_amazon.json?v=3.5.4', 'PRODES Amazonia Legal - incrementos por UF e periodo', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'prodes_legal_amazon_incremento.json'),
        (U_NF, 'PRODES Amazonia nao floresta - incrementos por UF e periodo', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'prodes_amazon_nf_incremento.json'),
        (U_CER, 'PRODES Cerrado - incrementos por UF e periodo', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'prodes_cerrado_incremento.json'),
        (U_PAN, 'PRODES Pantanal - incrementos por UF e periodo', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'prodes_pantanal_incremento.json'),
        (DASH + 'config/loinames/prodes_legal_amazon.json?v=3.5.4', 'Mapeamento loiname -> UF (Amazonia Legal)', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'loinames_prodes_legal_amazon.json'),
        (DASH + 'config/loinames/prodes_amazon.json?v=3.5.4', 'Mapeamento loiname -> UF (Amazonia bioma)', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'loinames_prodes_amazon.json'),
        (DASH + 'config/loinames/prodes_amazon_nf.json?v=3.5.4', 'Mapeamento loiname -> UF (Amazonia nao floresta)', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'loinames_prodes_amazon_nf.json'),
        (DASH + 'config/loinames/prodes_cerrado.json?v=3.5.4', 'Mapeamento loiname -> UF (Cerrado)', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'loinames_prodes_cerrado.json'),
        (DASH + 'config/loinames/prodes_pantanal.json?v=3.5.4', 'Mapeamento loiname -> UF (Pantanal)', 'INPE / TerraBrasilis', 'primaria', ultima, ACESSO, REL + 'loinames_prodes_pantanal.json'),
        (WFS + '?service=WFS&version=2.0.0&request=GetCapabilities', 'GeoServer TerraBrasilis - capabilities WFS (titulos e resumos das camadas)', 'INPE / TerraBrasilis', 'primaria', 'sem data no documento', ACESSO, REL + 'wfs_getcapabilities.xml'),
        (U_DETER_AMZ, 'DETER Amazonia - alertas por UF e data (WFS, filtro anonimo)', 'INPE / TerraBrasilis', 'primaria', 'dados de ' + cob['amz'][0] + ' a ' + cob['amz'][1], ACESSO, REL + 'deter_amazonia_raw.csv'),
        (U_DETER_CER, 'DETER Cerrado - alertas por UF e data (WFS, filtro anonimo)', 'INPE / TerraBrasilis', 'primaria', 'dados de ' + cob['cer'][0] + ' a ' + cob['cer'][1], ACESSO, REL + 'deter_cerrado_raw.csv'),
        ('https://www.gov.br/inpe/pt-br/assuntos/ultimas-noticias/20251015Nota_tcnica_EstimativaPRODES_2025.pdf', 'Nota tecnica INPE - Estimativa de desmatamento na Amazonia Legal para 2025 (5.796 km2)', 'INPE / MCTI', 'primaria', '2025-10-15', ACESSO, REL + 'NT_INPE_EstimativaPRODES_2025_20251015.pdf'),
        ('https://data.inpe.br/wp-content/uploads/sites/3/2025/10/2025_1022NT_PRODESCerrado_2025.pdf', 'Nota tecnica INPE - PRODES Cerrado 2025 (7.235,27 km2)', 'INPE / MCTI', 'primaria', '2025-10-22', ACESSO, REL + 'NT_INPE_PRODESCerrado_2025.pdf'),
        ('https://data.inpe.br/biomasbr/wp-content/uploads/sites/3/2025/11/NT_Prodes_Pantanal_2025_final.pdf', 'Nota tecnica INPE/BiomasBR - PRODES Pantanal 2025 (291,21 km2)', 'INPE / BiomasBR', 'primaria', '2025-11 (dia nao identificado)', ACESSO, REL + 'NT_INPE_PRODES_Pantanal_2025.pdf'),
        ('https://www.gov.br/mma/pt-br/noticias-defeso-eleitoral/2026_0807divulgacao_deter-claudio_final.pdf/', 'Apresentacao MMA/INPE - PRODES 2024/2025 e DETER 2025/2026 por bioma', 'MMA / INPE', 'primaria', '2026-08-07 (pelo nome do arquivo)', ACESSO, REL + 'MMA_divulgacao_DETER_2026-08-07.pdf'),
        (WFS + '?' + urllib.parse.urlencode({'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature',
            'typeName': 'prodes-legal-amz:yearly_deforestation', 'outputFormat': 'csv',
            'propertyName': 'state,year,area_km,main_class,class_name,image_date,pub_date',
            'CQL_FILTER': "state='AC' AND year=2024"}),
         'Verificacao WFS - feicoes PRODES Amazonia Legal, AC 2024 (soma de area_km)', 'INPE / TerraBrasilis',
         'primaria', 'pub_date das feicoes 2026-07-17', ACESSO, REL + 'verif_wfs_legal_AC_2024.csv'),
        (WFS + '?' + urllib.parse.urlencode({'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature',
            'typeName': 'prodes-legal-amz:yearly_deforestation', 'outputFormat': 'csv',
            'propertyName': 'state,year,area_km,main_class,class_name,image_date,pub_date',
            'CQL_FILTER': "state='AC' AND year=2025"}),
         'Verificacao WFS - feicoes PRODES Amazonia Legal, AC 2025 (soma de area_km)', 'INPE / TerraBrasilis',
         'primaria', 'pub_date das feicoes 2026-07-17', ACESSO, REL + 'verif_wfs_legal_AC_2025.csv'),
        (WFS + '?' + urllib.parse.urlencode({'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature',
            'typeName': 'prodes-cerrado-nb:yearly_deforestation', 'outputFormat': 'csv',
            'propertyName': 'state,year,class_name,area_km',
            'CQL_FILTER': "year=2024 AND (state='MATO GROSSO' OR state='MT')"}),
         'Verificacao WFS - feicoes PRODES Cerrado, MT 2024 (soma de area_km)', 'INPE / TerraBrasilis',
         'primaria', 'sem data no documento', ACESSO, REL + 'verif_wfs_cerrado_MT_2024.csv'),
        ('https://sinaflor.ibama.gov.br/', 'SINAFLOR (IBAMA) - pagina inicial: "Login SSO" (acesso exige login; nao acessado alem da pagina)', 'IBAMA', 'primaria', 'sem data no documento', ACESSO, REL + 'sinaflor_pagina_inicial.html'),
        (TB + '/downloads/', 'TerraBrasilis - downloads (lista PRODES por bioma)', 'INPE / TerraBrasilis', 'primaria', 'sem data no documento', ACESSO, REL + 'terrabrasilis_downloads.html'),
    ]
    with open(os.path.join(OUT, 'fontes.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['url', 'titulo', 'orgao', 'tipo', 'data_documento', 'acessado_em', 'arquivo_local'])
        for r in fontes:
            w.writerow(r)

    print('== 7. Resumo')
    por = defaultdict(int)
    for r in rows:
        por[(r['serie'], r['rotulo'])] += 1
    for (s, rot), n in sorted(por.items()):
        print('  %-48s %-11s %4d linhas' % (s, rot, n))
    print('  lacunas do estado total (uf, ano, faltou):')
    for g in gaps:
        print('   ', g)
    print('  gravados:', os.path.join(OUT, 'series.csv'), len(rows), 'linhas;', os.path.join(OUT, 'fontes.csv'), len(fontes), 'fontes')


if __name__ == '__main__':
    main()
