# -*- coding: utf-8 -*-
"""I1.1.2 - UCs estaduais com plano de manejo e conselho gestor (CNUC/MMA).

Rodar da raiz do projeto:  python -I scripts/eixo1_coleta_I1_1_2_cnuc.py

Baixa (se faltarem) o catalogo CKAN do dataset unidadesdeconservacao e as extracoes
tabulares publicas do CNUC para dados/eixo1_coleta/I1.1.2_cnuc/brutos/ e calcula, por
extracao e por UF: total de UCs estaduais, com Plano de Manejo = SIM, com Conselho
Gestor = SIM e com ambos. Grava series.csv, fontes.csv e as verificacoes em _verificacao/.
Nao escreve fora de dados/eixo1_coleta/I1.1.2_cnuc/.
"""
import csv
import io
import json
import os
import re
import unicodedata
import urllib.request

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
PASTA = os.path.join(RAIZ, 'dados', 'eixo1_coleta', 'I1.1.2_cnuc')
BRUTOS = os.path.join(PASTA, 'brutos')
VERIF = os.path.join(PASTA, '_verificacao')
PAINEL = os.path.join(RAIZ, 'dashboard', 'conteudo', 'valores.csv')
ACESSO = '2026-10-07'
CKAN_URL = 'https://dados.mma.gov.br/api/3/action/package_show?id=unidadesdeconservacao'
CKAN_JSON = os.path.join(BRUTOS, 'ckan_package_show_unidadesdeconservacao.json')
UFS = ['AC', 'AM', 'AP', 'MA', 'MT', 'PA', 'RO', 'RR', 'TO']

# posicao do recurso no CKAN -> rotulo da extracao
EXTRACOES = [
    (1, '2018'), (2, '2019-01'), (3, '2019-2S'), (4, '2020-1S'), (5, '2020-2S'),
    (6, '2021-1S'), (7, '2021-2S'), (8, '2022-1S'), (9, '2022-07'), (10, '2023-07'),
    (11, '2024-02'), (13, '2024-10'), (16, '2025-03'), (18, '2025-08'), (20, '2026-03'),
    (22, '2026-07'),
]
ROTULO = dict(EXTRACOES)
# extracao representativa de cada ano: a que o painel usa; 2023 nao existe no painel
REPRESENTATIVA = {2018: 1, 2019: 3, 2020: 5, 2021: 6, 2022: 9, 2023: 10,
                  2024: 13, 2025: 18, 2026: 20}
# extracao mais recente, usada no proxy por ano de criacao
EXTRACAO_PROXY = 22
NOTA_PCT = ('SIM em Plano de Manejo e SIM em Conselho Gestor; o CNUC registra existencia '
            'do conselho, nao seu funcionamento')

# documentos de arquivo (Wayback) lidos para contexto pre-2018; caminhos relativos a RAIZ
FONTES_ARQUIVO = [
    ('https://web.archive.org/web/20181101052717/http://www.mma.gov.br/areas-protegidas/'
     'cadastro-nacional-de-ucs/dados-consolidados.html',
     'Cadastro Nacional de UCs - Dados Consolidados (captura Wayback 2018-11-01)',
     'primaria', '2018-11-01',
     'dados/eixo1_coleta/I1.1.2_cnuc/_wb/dados_consolidados_2018.html'),
    ('https://web.archive.org/web/20190219194325/http://dados.mma.gov.br/ar/dataset/'
     'unidadesdeconservacao',
     'CKAN do dataset unidadesdeconservacao (captura Wayback 2019-02-19; 2 recursos)',
     'primaria', '2019-02-19',
     'dados/eixo1_coleta/I1.1.2_cnuc/_wb/ckan_dataset_2019_02.html'),
    ('http://www.mma.gov.br/estruturas/sbf_dap_cnuc2/_arquivos/uc_por_esferacnuc_25julho2011_119.pdf',
     'Tabela consolidada das UCs por categoria e esfera (atualizada em 25/07/2011); sem UF',
     'primaria', '2011-07-25',
     'dados/eixo1_coleta/I1.1.2_cnuc/brutos/wayback/wb_uc_por_esferacnuc_2011.pdf'),
    ('https://www.mma.gov.br/images/arquivos/areas_protegidas/cnuc/'
     'tabela_ucs_%20esferagestao_%2012junho2012.pdf',
     'Tabela consolidada das UCs por categoria e esfera (atualizada em 12/06/2012); sem UF',
     'primaria', '2012-06-12',
     'dados/eixo1_coleta/I1.1.2_cnuc/brutos/wayback/wb_tabela_ucs_esferagestao_2012.pdf'),
    ('https://www.mma.gov.br/images/arquivo/80112/CNUC_Categoria_Fevereiro_2015.pdf',
     'Tabela consolidada das UCs por categoria e esfera (atualizada em 17/02/2015); sem UF',
     'primaria', '2015-02-17',
     'dados/eixo1_coleta/I1.1.2_cnuc/brutos/wayback/wb_CNUC_Categoria_Fev2015.pdf'),
    ('http://www.mma.gov.br/images/arquivo/80112/UCporBioma_0214_sem_Logo_copy.pdf',
     'Unidades de Conservacao por Bioma (atualizada em 11/02/2014); sem UF',
     'primaria', '2014-02-11',
     'dados/eixo1_coleta/I1.1.2_cnuc/brutos/wayback/wb_UCporBioma_0214.pdf'),
    ('http://www.mma.gov.br/images/arquivo/80238/CNUC_FEV18%20-%20B_Cat.pdf',
     'Tabela consolidada das UCs por categoria e esfera (atualizada em 01/02/2018); sem UF',
     'primaria', '2018-02-01',
     'dados/eixo1_coleta/I1.1.2_cnuc/brutos/wayback/wb_CNUC_FEV18_B_Cat.pdf'),
    ('http://www.mma.gov.br/images/arquivo/80229/CNUC_JUL18%20-%20B_Cat.pdf',
     'Tabela consolidada das UCs por categoria e esfera (atualizada em jul/2018); sem UF',
     'primaria', '2018-07',
     'dados/eixo1_coleta/I1.1.2_cnuc/brutos/wayback/wb_CNUC_JUL18_B_Cat.pdf'),
    ('http://www.mma.gov.br/images/arquivo/80229/Relatorio-Oficina-UCs-Estaduais.pdf',
     'Relatorio da Oficina de Planejamento das UCs Estaduais (GEF-Mar), mar/2017; 6 UCs',
     'primaria', '2017-03',
     'dados/eixo1_coleta/I1.1.2_cnuc/brutos/wayback/wb_Relatorio_Oficina_UCs_Estaduais.pdf'),
    ('http://www.mma.gov.br/images/arquivo/80229/Relatoria%20Oficina%20Estados_marco_2018_final.pdf',
     'Relatoria da Oficina com os Estados (GEF-Mar), mar/2018; sem contagem por UF',
     'primaria', '2018-03',
     'dados/eixo1_coleta/I1.1.2_cnuc/brutos/wayback/wb_Relatoria_Oficina_Estados_mar2018.pdf'),
]


def chave(texto):
    s = unicodedata.normalize('NFKD', str(texto)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def baixar(url, destino):
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with urllib.request.urlopen(url, timeout=240) as resp:
        conteudo = resp.read()
    with open(destino, 'wb') as f:
        f.write(conteudo)


def carregar_ckan():
    baixar(CKAN_URL, CKAN_JSON)
    with open(CKAN_JSON, encoding='utf-8') as f:
        resultado = json.load(f)['result']
    return resultado, {int(r['position']): r for r in resultado['resources']}


def caminho_bruto(pos, recurso):
    nome = recurso['url'].rsplit('/', 1)[-1]
    return os.path.join(BRUTOS, 'cnuc_pos%02d_%s' % (pos, nome))


def rel(caminho):
    return os.path.relpath(caminho, RAIZ).replace('\\', '/')


def ler_tabela(caminho):
    if caminho.lower().endswith('.xlsx'):
        import openpyxl
        wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
        ws = wb['A_UC']
        linhas = ws.iter_rows(values_only=True)
        cab = ['' if c is None else str(c) for c in next(linhas)]
        saida = []
        for r in linhas:
            if all(v is None for v in r):
                continue
            saida.append({cab[i]: v for i, v in enumerate(r) if i < len(cab)})
        wb.close()
        return saida
    bruto = open(caminho, 'rb').read()
    for enc in ('utf-8-sig', 'cp1252', 'latin-1'):
        try:
            texto = bruto.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    primeira = texto.splitlines()[0]
    sep = ';' if primeira.count(';') >= primeira.count(',') else ','
    return list(csv.DictReader(io.StringIO(texto), delimiter=sep))


def campos(linha):
    return {chave(k): ('' if v is None else str(v).strip())
            for k, v in linha.items() if k is not None}


def pegar(c, prefixo):
    for k, v in c.items():
        if k.startswith(prefixo):
            return v
    return ''


def estatisticas(linhas):
    st = {'total': {u: 0 for u in UFS}, 'plano': {u: 0 for u in UFS},
          'conselho': {u: 0 for u in UFS}, 'ambos': {u: 0 for u in UFS},
          'interestadual_al': 0, 'interestadual_lista': [],
          'estadual_todas_ufs': 0, 'codigos_duplicados': 0}
    vistos = set()
    for linha in linhas:
        c = campos(linha)
        if chave(c.get('esfera administrativa', '')) != 'estadual':
            continue
        st['estadual_todas_ufs'] += 1
        cod = c.get('codigo uc') or c.get('id uc') or ''
        if cod:
            if cod in vistos:
                st['codigos_duplicados'] += 1
            vistos.add(cod)
        uf = c.get('uf', '').upper()
        partes = [p.strip() for p in uf.split(',')]
        pm = c.get('plano de manejo', '').upper() == 'SIM'
        cg = c.get('conselho gestor', '').upper() == 'SIM'
        if len(partes) > 1 and any(p in UFS for p in partes):
            st['interestadual_al'] += 1
            st['interestadual_lista'].append((c.get('nome da uc', ''), uf, pm, cg))
        if uf not in UFS:
            continue
        st['total'][uf] += 1
        st['plano'][uf] += int(pm)
        st['conselho'][uf] += int(cg)
        st['ambos'][uf] += int(pm and cg)
    return st


def criacoes(linhas):
    anos = []
    sem = {u: 0 for u in UFS}
    for linha in linhas:
        c = campos(linha)
        if chave(c.get('esfera administrativa', '')) != 'estadual':
            continue
        uf = c.get('uf', '').upper()
        if uf not in UFS:
            continue
        m = re.search(r'(\d{4})', pegar(c, 'ano de criacao'))
        if m and 1800 <= int(m.group(1)) <= 2026:
            anos.append((uf, int(m.group(1))))
        else:
            sem[uf] += 1
    return anos, sem


def valores(st, u):
    if u == 'AL':
        t = sum(st['total'][x] for x in UFS)
        a = sum(st['ambos'][x] for x in UFS)
        p = sum(st['plano'][x] for x in UFS)
        c = sum(st['conselho'][x] for x in UFS)
    else:
        t, a, p, c = st['total'][u], st['ambos'][u], st['plano'][u], st['conselho'][u]
    return {'total': t, 'plano': p, 'conselho': c, 'ambos': a,
            'pct': (100.0 * a / t) if t else ''}


def fmt_pct(v):
    return '' if v == '' else '%.4f' % v


def ler_painel():
    painel = {}
    with open(PAINEL, encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f):
            if r['codigo'] != 'I1.1.2' or r['origem'] == 'migracao':
                continue
            campo, uf, ano, valor = r['campo'], r['uf'], r['ano'], r['valor']
            m = re.match(r'^(total|comPlano|comConselho|comAmbos)(\d{4})?$', campo)
            if m:
                painel[(m.group(1), uf, int(m.group(2) or 2026))] = float(valor)
            elif campo == '' and ano:
                painel[('pct', uf, int(ano))] = float(valor)
    return painel


def main():
    os.makedirs(VERIF, exist_ok=True)
    meta, recursos = carregar_ckan()
    stats = {}
    for pos, rot in EXTRACOES:
        arq = caminho_bruto(pos, recursos[pos])
        baixar(recursos[pos]['url'], arq)
        stats[pos] = estatisticas(ler_tabela(arq))
        s = stats[pos]
        print('%-8s pos%02d AL total=%d plano=%d conselho=%d ambos=%d pct=%.2f  interest=%d dup=%d' % (
            rot, pos, sum(s['total'].values()), sum(s['plano'].values()),
            sum(s['conselho'].values()), sum(s['ambos'].values()),
            100.0 * sum(s['ambos'].values()) / sum(s['total'].values()),
            s['interestadual_al'], s['codigos_duplicados']))

    painel = ler_painel()
    anos_painel = {a for (_, _, a) in painel}

    # conciliacao representativa x painel
    recon = []
    for y, pos in sorted(REPRESENTATIVA.items()):
        st = stats[pos]
        for u in UFS + ['AL']:
            v = valores(st, u)
            pt = painel.get(('total', u, y))
            pa = painel.get(('comAmbos', u, y))
            pp = painel.get(('pct', u, y))
            if pt is None and pa is None and pp is None:
                situ = 'sem painel'
            else:
                ok = ((pt is None or pt == v['total']) and (pa is None or pa == v['ambos'])
                      and (pp is None or abs(pp - v['pct']) < 0.0005))
                situ = 'bate' if ok else 'diverge'
            recon.append([y, u, ROTULO[pos], v['total'], '' if pt is None else int(pt),
                          v['ambos'], '' if pa is None else int(pa),
                          fmt_pct(v['pct']), '' if pp is None else pp, situ])
    with open(os.path.join(VERIF, 'reconciliacao_painel.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(['ano', 'uf', 'extracao', 'total_script', 'total_painel', 'comAmbos_script',
                    'comAmbos_painel', 'pct_script', 'pct_painel', 'situacao'])
        w.writerows(recon)

    # cada extracao contra o painel do mesmo ano (quantas UFs batem em total e comAmbos)
    ext_painel = []
    for pos, rot in EXTRACOES:
        y = int(rot[:4])
        if y not in anos_painel:
            ext_painel.append([rot, y, 'sem painel neste ano', '', ''])
            continue
        bate_t = bate_a = 0
        for u in UFS:
            v = valores(stats[pos], u)
            bate_t += int(painel.get(('total', u, y)) == v['total'])
            bate_a += int(painel.get(('comAmbos', u, y)) == v['ambos'])
        ext_painel.append([rot, y, 'comparado', '%d/9' % bate_t, '%d/9' % bate_a])
    with open(os.path.join(VERIF, 'extracoes_x_painel.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(['extracao', 'ano', 'situacao', 'ufs_total_batem', 'ufs_comAmbos_batem'])
        w.writerows(ext_painel)

    # sensibilidade: UCs estaduais interestaduais que tocam a AL (fora da contagem por UF)
    sens = []
    for pos, rot in EXTRACOES:
        for nome, uf, pm, cg in stats[pos]['interestadual_lista']:
            sens.append([rot, nome, uf, 'SIM' if pm else 'NAO', 'SIM' if cg else 'NAO'])
    with open(os.path.join(VERIF, 'sensibilidade_interestaduais.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(['extracao', 'nome_uc', 'uf_cnuc', 'plano_de_manejo', 'conselho_gestor'])
        w.writerows(sens)
    for linha in sens:
        print('interestadual', linha)
    for linha in ext_painel:
        print('painel', linha)

    # proxy: UCs estaduais existentes por ano, reconstruidas pelo Ano de Criacao (extracao 2026-07)
    anos_uc, sem_ano = criacoes(ler_tabela(caminho_bruto(EXTRACAO_PROXY, recursos[EXTRACAO_PROXY])))
    ano_min = min(a for _, a in anos_uc)
    proxy = {}
    for ano in range(ano_min, 2027):
        for u in UFS:
            proxy[(u, ano)] = sum(1 for uf, a in anos_uc if uf == u and a <= ano)
        proxy[('AL', ano)] = sum(proxy[(u, ano)] for u in UFS)
    print('proxy: ano minimo de criacao=%d; sem ano de criacao por UF=%s' % (ano_min, sem_ano))

    val = []
    st_ref = stats[REPRESENTATIVA[2026]]
    for y, pos in sorted(REPRESENTATIVA.items()):
        for u in UFS + ['AL']:
            real = valores(stats[pos], u)['total']
            pr = proxy[(u, y)]
            val.append([y, u, ROTULO[pos], real, pr, real - pr, '%.3f' % (pr / real) if real else ''])
    with open(os.path.join(VERIF, 'proxy_validacao.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(['ano', 'uf', 'extracao_real', 'total_real', 'proxy_criacao', 'diferenca', 'razao_proxy_real'])
        w.writerows(val)
    sem_total = sum(sem_ano.values())
    checagem = sum(valores(st_ref, u)['total'] - sem_ano[u] - proxy[(u, 2026)] for u in UFS)
    print('checagem proxy 2026 = total - sem ano (diferenca soma, esperado 0): %d' % checagem)

    # series (formato longo)
    linhas_series = []

    def add(serie, rotulo, uf, ano, valor, unidade, url, nota):
        linhas_series.append(['I1.1.2', serie, rotulo, uf, ano, valor, unidade, url, nota])

    def url_de(pos):
        return recursos[pos]['url']

    for y, pos in sorted(REPRESENTATIVA.items()):
        st = stats[pos]
        extra = '' if y in anos_painel else ' ; ano sem valor no painel (dashboard/conteudo/valores.csv)'
        for u in UFS + ['AL']:
            v = valores(st, u)
            base = 'extracao %s (pos CKAN %d)%s%s' % (
                ROTULO[pos], pos, ' ; agregado AL = soma das 9 UFs' if u == 'AL' else '', extra)
            add('pct_plano_e_conselho_anual', 'exata', u, y, fmt_pct(v['pct']), '%', url_de(pos),
                base + ' ; ' + NOTA_PCT)
            add('n_total_ucs_estaduais_anual', 'componente', u, y, v['total'], 'UCs', url_de(pos), base)
            add('n_com_plano_anual', 'componente', u, y, v['plano'], 'UCs', url_de(pos), base)
            add('n_com_conselho_anual', 'componente', u, y, v['conselho'], 'UCs', url_de(pos), base)
            add('n_com_ambos_anual', 'componente', u, y, v['ambos'], 'UCs', url_de(pos), base)

    for pos, rot in EXTRACOES:
        y = int(rot[:4])
        st = stats[pos]
        for u in UFS + ['AL']:
            v = valores(st, u)
            base = 'extracao %s (pos CKAN %d)%s' % (
                rot, pos, ' ; agregado AL = soma das 9 UFs' if u == 'AL' else '')
            add('pct_plano_e_conselho_ext_' + rot, 'exata', u, y, fmt_pct(v['pct']), '%',
                url_de(pos), base + ' ; ' + NOTA_PCT)
            add('n_total_ucs_estaduais_ext_' + rot, 'componente', u, y, v['total'], 'UCs', url_de(pos), base)
            add('n_com_plano_ext_' + rot, 'componente', u, y, v['plano'], 'UCs', url_de(pos), base)
            add('n_com_conselho_ext_' + rot, 'componente', u, y, v['conselho'], 'UCs', url_de(pos), base)
            add('n_com_ambos_ext_' + rot, 'componente', u, y, v['ambos'], 'UCs', url_de(pos), base)

    for ano in range(ano_min, 2027):
        for u in UFS + ['AL']:
            nota = ('UCs estaduais (Esfera=Estadual; UF unica na AL) da extracao %s com Ano de '
                    'Criacao <= %d; exclui extintas e recategorizadas; sem ano de criacao fora da '
                    'contagem (%s)' % (ROTULO[EXTRACAO_PROXY], ano,
                                       sum(sem_ano.values()) if u == 'AL' else sem_ano[u]))
            add('proxy_ucs_estaduais_criadas_ate_ano', 'proxy', u, ano, proxy[(u, ano)], 'UCs',
                url_de(EXTRACAO_PROXY), nota)

    with open(os.path.join(PASTA, 'series.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(['codigo', 'serie', 'rotulo', 'uf', 'ano', 'valor', 'unidade', 'fonte_url', 'nota'])
        w.writerows(linhas_series)
    print('series.csv: %d linhas' % len(linhas_series))

    # fontes
    fontes = [[CKAN_URL, 'Catalogo CKAN do dataset unidadesdeconservacao (MMA): recursos e datas',
               'Ministerio do Meio Ambiente', 'primaria', meta['metadata_modified'][:10], ACESSO,
               rel(CKAN_JSON)]]
    for pos, rot in EXTRACOES:
        rec = recursos[pos]
        fontes.append([rec['url'],
                       'CNUC/MMA - extracao %s (recurso CKAN "%s", pos %d)' % (rot, rec['name'], pos),
                       'Ministerio do Meio Ambiente (DAP/CNUC)', 'primaria',
                       rec['created'][:10], ACESSO, rel(caminho_bruto(pos, rec))])
    for url, titulo, tipo, data, arq in FONTES_ARQUIVO:
        fontes.append([url, titulo, 'Ministerio do Meio Ambiente (arquivo Wayback)', tipo, data,
                       ACESSO, arq])
    with open(os.path.join(PASTA, 'fontes.csv'), 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(['url', 'titulo', 'orgao', 'tipo', 'data_documento', 'acessado_em', 'arquivo_local'])
        w.writerows(fontes)
    print('fontes.csv: %d linhas' % len(fontes))


if __name__ == '__main__':
    main()
