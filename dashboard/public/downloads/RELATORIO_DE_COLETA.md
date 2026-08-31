# Relatório de Coleta — Indicadores de Resultado — Estratégia Amazônia 2050

**Data da coleta:** 18/08/2026 (sessão única, ~3h de trabalho com ferramentas) · **Sessão 2 — Eixo 3:** 30/08/2026
**Escopo:** Eixos 1 e 2 (sessão 1) e Eixo 3 (sessão 2) · Indicadores de **RESULTADO** (excluídos os de impacto) · 9 estados da Amazônia Legal (AC, AP, AM, MA, MT, PA, RO, RR, TO)
**Base documental:** `fontes_originais/3. Matriz Metas x Indicadores .xlsx` (aba *"Metas x Indicadores (atualizada)"*, coluna **INDICADOR DE RESULTADO**) e `fontes_originais/Fichas Técnicas Indicadores - Amazonia2050.docx.md`
**Entregáveis:** `entregaveis/Indicadores_Resultado_Eixo1_Amazonia2050.xlsx`, `entregaveis/Indicadores_Resultado_Eixo2_Amazonia2050.xlsx` e `entregaveis/Indicadores_Resultado_Eixo3_Amazonia2050.xlsx` (novo)
**Ambiente:** Windows 10, Python 3.11 (venv em `.venv/` com openpyxl 3.1.5, xlrd e py7zr — instalado na sessão 2), acesso à internet via `curl`/FTP (busca web da ferramenta NÃO configurada — sem chave Firecrawl)

---

## SUMÁRIO

1. [Estrutura da pasta](#1-estrutura-da-pasta)
2. [Resumo executivo](#2-resumo-executivo)
3. [Eixo 1 — resultados completos por estado](#3-eixo-1--resultados-completos-por-estado)
4. [Eixo 2 — resultados completos por estado](#4-eixo-2--resultados-completos-por-estado)
5. [Metodologia detalhada por fonte (fluxos que funcionaram)](#5-metodologia-detalhada-por-fonte-fluxos-que-funcionaram)
6. [Registro completo de tentativas falhadas](#6-registro-completo-de-tentativas-falhadas)
7. [Erros meus encontrados e corrigidos](#7-erros-meus-encontrados-e-corrigidos)
8. [Pendentes — status e caminho de obtenção](#8-pendentes--status-e-caminho-de-obtenção)
9. [Linha do tempo da sessão](#9-linha-do-tempo-da-sessão)
10. [Anexo A — catálogo completo dos indicadores](#10-anexo-a--catálogo-completo-dos-indicadores)
11. [Anexo B — reprodução](#11-anexo-b--reprodução)
12. [Adendo — Eixo 4 (30/08/2026)](#12-adendo--eixo-4-30082026)
13. [Adendo — Eixo 5: Governança e parcerias (30/08/2026)](#13-adendo--eixo-5-governança-e-parcerias-30082026)
14. [Adendo — Sessão 2: Eixo 3 (30/08/2026)](#14-adendo--sessão-2-eixo-3--desenvolvimento-econômico-sustentável-30082026)
15. [Incorporação dos Eixos 3-5 ao Observatório (31/08/2026)](#15-incorporação-dos-eixos-3-5-ao-observatório-31082026)

---

## 1. Estrutura da pasta

```
Nova pasta (2)/
├── entregaveis/                        ← WORKBOOKS FINAIS
│   ├── Indicadores_Resultado_Eixo1_Amazonia2050.xlsx   (9 abas)
│   ├── Indicadores_Resultado_Eixo2_Amazonia2050.xlsx   (10 abas)
│   └── Indicadores_Resultado_Eixo3_Amazonia2050.xlsx   (9 abas)   ← sessão 2
├── fontes_originais/
│   ├── 3. Matriz Metas x Indicadores .xlsx
│   └── Fichas Técnicas Indicadores - Amazonia2050.docx.md
├── dados/                              ← organizado por FONTE
│   ├── prodes/     prodes_rates_uf.csv (taxas km²/ano por UF, 1987-2025)
│   ├── focos/      focos_calor_uf_ano.csv + 90 zips anuais por UF (2015-2024)
│   ├── cnuc/       cnuc.csv (base CNUC 03/2026, 3.421 UCs)
│   ├── iivcm/      iivcm.csv (808 municípios da AL, baseline 2025)
│   ├── sinesp/     bancovde-2020..2026.xlsx (7 bases ~20-30MB) + cvli_uf_ano.csv
│   ├── ibge_pop/   projecoes_2024_idade_simples.xlsx + populacao_uf_ano.csv + populacao_faixas_0_17.csv
│   ├── ibge_sis/   sis_renda/ (Tabela 2.18 Pobr_Geo) + sis_educacao/ (Tabela 4.1 FreqBrut_Geo) + CSVs processados
│   ├── cnes/       cnes_uf_tipo.csv (telessaúde) + cnes_equipes_uf.csv (equipes eSF/eAP)
│   ├── sim/        sim_evitaveis_menores5_2024.csv (mortalidade evitável <5 anos)
│   └── eixo3/      ← sessão 2
│       ├── pevs_total_uf_ano.csv + pevs_por_produto_uf.csv + pevs_madeireiro_uf_ano.csv (SIDRA 289)
│       ├── pia_industria_uf_ano.csv + pia_divisoes_uf_ano.csv (SIDRA 1849/10457)
│       ├── rais_estab_uf_ano.csv + rais_estab_uf_divisao_ano.csv (RAIS/MTE FTP)
│       ├── cnae_divisoes.csv (nomes das 87 divisões CNAE 2.0)
│       └── rais/   RAIS_ESTAB_PUB_2023.7z + RAIS_ESTAB_PUB_2024.7z (~130-140 MB cada, brutos)
├── scripts/                            ← 13 scripts (reproduzíveis)
│   ├── baixar_focos.py      (download 99 zips INPE + agregação)
│   ├── agregar_cvli.py      (Sinesp xlsx → CVLI por UF/ano)
│   ├── populacao_taxas.py   (projeção IBGE → população + taxas)
│   ├── sis_pobreza_escola.py (SIS xls → pobreza e frequência escolar)
│   ├── montar_workbook.py   (Eixo 1 → xlsx)
│   ├── montar_workbook_eixo2.py (Eixo 2 → xlsx)
│   ├── auditar.py           (auditoria de sanidade do Eixo 1)
│   ├── exportar_catalogo.py (workbooks → dados/catalogo/indicadores.json p/ dashboard)
│   ├── eixo3_pevs.py        (SIDRA 289 → PEVS valor/quantidade, 2015-2024)   ← sessão 2
│   ├── eixo3_pia.py         (SIDRA 1849+10457 → PIA transformação industrial) ← sessão 2
│   ├── eixo3_rais.py        (FTP MTE 7z → RAIS estabelecimentos/vínculos)    ← sessão 2
│   └── montar_workbook_eixo3.py (Eixo 3 → xlsx)                              ← sessão 2
├── .venv/
└── RELATORIO_DE_COLETA.md              ← este documento
```

---

## 2. Resumo executivo

| | Eixo 1 | Eixo 2 | Eixo 3 (sessão 2) |
|---|---|---|---|
| Indicadores de resultado na matriz | 23 | 10 | 9 |
| Com dados coletados (fonte oficial) | 4 | 6 | 3 (2 proxies PEVS/RAIS + 1 PIA) — ver nota |
| Parciais (com dado de referência) | 1 (PRODES sem Sinaflor) | 2 (LBE <5; equipes APS) | — |
| Pendentes (sem automação viável) | 18 | 2 (IDEB, bioeconomia) + 2 documentais | 6 (todos documentais/jurisdicionais) |
| Dados brutos baixados | ~45 MB + 43 MB de zips | ~180 MB (bases Sinesp) | ~270 MB (2 arquivos RAIS 7z) |

Nota Eixo 3: dos 9 indicadores da matriz, 6 são documentais (informação jurisdicional dos estados). Coletados via script: I3.1.1 (proxy PEVS/IBGE — a fonte oficial MMA segue em construção), I3.5.1 da **ficha técnica** (PIA-Empresa — o da matriz é documental) e o indicador de **empregos/empresas** da ficha da linha 3.2 (proxy RAIS/MTE 2023-2024).

---

## 3. Eixo 1 — resultados completos por estado

### I1.1.2 — % de UCs estaduais com plano de manejo e conselho gestor ativos (meta: 40% até 2035)
Fonte: CNUC/MMA, base 03/2026 (dados.mma.gov.br). Esfera estadual, UCs que abrangem a AL (nenhuma interestadual encontrada).

| UF | UCs estaduais | Plano de manejo (Sim) | Conselho gestor (Sim) | Ambos | % ambos |
|---|---|---|---|---|---|
| AC | 8 | 6 | 8 | 6 | **75,0%** |
| AP | 5 | 2 | 4 | 2 | **40,0%** |
| AM | 41 | 11 | 22 | 11 | **26,8%** |
| MA | 13 | 3 | 4 | 2 | **15,4%** |
| MT | 38 | 8 | 10 | 4 | **10,5%** |
| PA | 28 | 10 | 24 | 10 | **35,7%** |
| RO | 49 | 15 | 11 | 4 | **8,2%** |
| RR | 4 | 0 | 0 | 0 | **0,0%** |
| TO | 13 | 4 | 8 | 3 | **23,1%** |
| **AL** | **199** | **59** | **91** | **42** | **21,1%** |

### I1.3.1 — IIVCM médio dos municípios prioritários (meta: convergência a 52,1 pts; baseline 2025)
Fonte: lista oficial da ficha técnica (AdaptaBrasil/MCTI). 808 municípios da AL; 162 prioritários (= 20%).

| UF | Municípios prioritários | Média IIVCM |
|---|---|---|
| AC | 4 | 60,23 |
| AP | 2 | 60,08 |
| AM | 17 | 58,90 |
| MA | 45 | 59,21 |
| MT | 17 | 59,21 |
| PA | 64 | 59,52 |
| RO | 10 | 59,31 |
| RR | 1 | 57,77 |
| TO | 2 | 59,64 |

### I1.3.2 — Desmatamento PRODES (componente do % de desmatamento ilegal; meta: zero ilegal em 2030)
Fonte: PRODES/INPE via TerraBrasilis (rates2025.json — versão revisada do ciclo 2025). Ano = fim do período de medição (ago/jul). km²/ano.

| UF | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|
| AC | 706 | 889 | 840 | 601 | 449 | 324 |
| AP | 24 | 17 | 14 | 17 | 27 | 17 |
| AM | 1.512 | 2.306 | 2.594 | 1.610 | 1.223 | 979 |
| MA | 336 | 350 | 271 | 306 | 307 | 210 |
| MT | 1.779 | 2.213 | 1.927 | 2.048 | 1.257 | 1.593 |
| PA | 4.899 | 5.238 | 4.162 | 3.299 | 2.395 | 2.064 |
| RO | 1.273 | 1.673 | 1.480 | 867 | 360 | 229 |
| RR | 297 | 315 | 279 | 284 | 468 | 285 |
| TO | 25 | 37 | 27 | 32 | 32 | 30 |
| **AL** | **10.851** | **13.038** | **11.594** | **9.064** | **6.518** | **5.731** |

Validação: 2020=10.851, 2021=13.038, 2022=11.594, 2023=9.064 (na série completa 1987-2025) — **diferença zero** contra a série oficial divulgada. Nota: o rates2025.json traz a versão revisada (2024 = 6.518 vs. 6.288 da divulgação original).
**Falta a componente Sinaflor** (autorizações de supressão, ha) — exige login SSO do IBAMA — para calcular o % ilegal.

### I1.3.4 — Nº de focos de calor (satélite de referência; meta: −30% vs. baseline 2015-2025)
Fonte: INPE Queimadas (data.inpe.br/queimadas/dados-abertos), arquivos `focos_br_<uf>_ref_<ano>.zip`.

| UF | 2015 | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | Média 15-24 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AC | 5.779 | 7.684 | 6.295 | 6.626 | 6.802 | 9.193 | 8.828 | 11.840 | 6.562 | 8.658 | **7.827** |
| AP | 2.936 | 2.595 | 1.946 | 1.206 | 1.277 | 750 | 676 | 990 | 2.552 | 2.014 | **1.694** |
| AM | 13.419 | 11.173 | 11.685 | 11.446 | 12.676 | 16.729 | 14.848 | 21.217 | 19.601 | 25.499 | **15.829** |
| MA | 28.436 | 21.789 | 25.576 | 13.892 | 18.521 | 16.817 | 16.077 | 20.224 | 21.113 | 22.879 | **20.532** |
| MT | 27.741 | 27.305 | 30.911 | 18.032 | 31.169 | 47.708 | 22.520 | 29.039 | 21.723 | 50.551 | **30.670** |
| PA | 43.164 | 29.724 | 49.770 | 22.080 | 30.165 | 38.603 | 22.876 | 41.421 | 41.715 | 56.070 | **37.559** |
| RO | 13.113 | 13.113 | 11.313 | 10.255 | 11.230 | 11.145 | 10.030 | 12.460 | 7.417 | 10.692 | **11.077** |
| RR | 2.452 | 3.870 | 1.565 | 2.383 | 4.784 | 1.930 | 989 | 1.223 | 2.659 | 5.358 | **2.721** |
| TO | 15.705 | 14.494 | 15.673 | 8.033 | 13.625 | 12.093 | 10.007 | 12.145 | 9.641 | 17.251 | **12.867** |

2025 não publicado pelo INPE (arquivo anual só sai no ano seguinte). Total AL 2015-2024: 1.407.761 focos.

---

## 4. Eixo 2 — resultados completos por estado

### I2.1.1 — Pobreza (meta: ≤3% da população em situação de pobreza em 2050)
Fonte: IBGE, Síntese de Indicadores Sociais 2025 (PNAD Contínua 2024), Tabela 2.18 — linhas de pobreza Banco Mundial (PPC 2017). O indicador oficial da matriz usa CadÚnico (MDS); a coluna **% < US$ 3,65/dia** é a proxy mais próxima da linha do Bolsa Família.

| UF | Pop. (mil) | % <US$ 2,15 (extrema) | % <US$ 3,65 (pobreza) | % <US$ 6,85 | % até 50% mediana | Linha 50% mediana (R$) |
|---|---|---|---|---|---|---|
| AC | 860 | 7,6 | **18,0** | 45,9 | 42,9 | 375,19 |
| AP | 794 | 3,9 | **11,2** | 35,8 | 34,7 | 457,90 |
| AM | 4.116 | 5,1 | **14,0** | 39,2 | 37,8 | 406,89 |
| MA | 6.965 | 10,1 | **22,1** | 45,8 | 43,9 | 358,51 |
| MT | 3.788 | 1,6 | **3,3** | 13,1 | 11,7 | 804,06 |
| PA | 8.607 | 4,6 | **14,8** | 38,6 | 37,3 | 418,89 |
| RO | 1.732 | 1,7 | **5,5** | 20,5 | 19,3 | 626,84 |
| RR | 627 | 6,5 | **14,3** | 37,6 | 36,0 | 439,40 |
| TO | 1.561 | 3,8 | **9,1** | 23,9 | 23,1 | 580,40 |

### I2.2.1 — Mortalidade por causas evitáveis (dado de referência: LBE infantil <5 anos, 2024)
Fonte: SIM/DATASUS TabNet (`sim/cnv/evita10uf.def`). O indicador oficial é a LBE completa (0-74), indisponível via TabNet.

| UF | Óbitos evitáveis <5 anos (2024) | Pop. 0-4 (2024, aprox.) | Taxa/1.000 (ref.) |
|---|---|---|---|
| AC | 317 | 88.080 | 3,60 |
| AP | 275 | 84.262 | 3,26 |
| AM | 1.173 | 439.528 | 2,67 |
| MA | 1.430 | 611.962 | 2,34 |
| MT | 953 | 354.860 | 2,69 |
| PA | 1.922 | 775.733 | 2,48 |
| RO | 363 | 148.655 | 2,44 |
| RR | 295 | 85.616 | 3,45 |
| TO | 362 | 139.963 | 2,59 |

Nota: o denominador usa a soma das faixas 0-3 e 4-5 da Projeção IBGE (aproximação de 0-4 anos — superestima ligeiramente; o cálculo oficial usaria nascidos vivos).

### I2.2.2 — Cobertura APS (dado de referência: equipes eSF, CNES Jul/2026)
Fonte: CNES/DATASUS TabNet (`cnes/cnv/equipebr.def`), equipes ATIVAS. O % oficial exige e-Gestor (autenticado). Fórmula da ficha: (eSF×3.500 + eAP20h×1.750 + eAP30h×2.625 + vinculados eCR/eSFR/eAPP) ÷ população × 100.

| UF | eSF tipo 01 | eSF tipo 70 | Total eSF | eAP (76) | Pop. 2026 (IBGE) |
|---|---|---|---|---|---|
| AC | 2 | 274 | **276** | 34 | 887.794 |
| AP | 0 | 280 | **280** | 14 | 809.953 |
| AM | 0 | 1.151 | **1.151** | 155 | 4.360.926 |
| MA | 2 | 2.737 | **2.739** | 42 | 7.024.557 |
| MT | 0 | 1.100 | **1.100** | 64 | 3.950.330 |
| PA | 0 | 2.583 | **2.583** | 94 | 8.756.324 |
| RO | 2 | 500 | **502** | 25 | 1.757.338 |
| RR | 0 | 257 | **257** | 3 | 761.012 |
| TO | 0 | 632 | **632** | 20 | 1.595.994 |

Nota: os códigos 01 (novo) e 70 (legado) são as duas classificações de eSF no CNES; o total é a soma. Os valores de eAP (76) podem incluir equipes em implantação.

### I2.2.3 — Telessaúde (proxy: estabelecimentos TELESSAUDE ativos; meta: ≥50% dos municípios com serviço ativo em 2050)
Fonte: CNES/DATASUS TabNet (`cnes/cnv/estabbr.def`), competência Jul/2026.

| UF | AC | AP | AM | MA | MT | PA | RO | RR | TO | **AL** |
|---|---|---|---|---|---|---|---|---|---|---|
| Estab. TELESSAUDE | 1 | 1 | 13 | 8 | 7 | 17 | 2 | 4 | 3 | **56** |

### I2.3.2 — Taxa de atendimento escolar (indicador: 4-17 anos e creche 0-3; meta: universalizar em 2050)
Fonte: IBGE, SIS 2025 (PNADc 2024), Tabela 4.1 (taxa bruta de frequência escolar). "4-17 (ponderado)" = média ponderada pelas populações de 4-5, 6-14 e 15-17 (Projeção IBGE 2024).

| UF | 0-3 (creche) | 4-5 | 6-10 | 11-14 | 6-14 | 15-17 | 4-17 (ponderado) |
|---|---|---|---|---|---|---|---|
| AC | 16,6 | 80,5 | 97,6 | 99,1 | 98,3 | 91,2 | **94,2** |
| AP | 8,6 | 69,0 | 97,8 | 99,8 | 98,8 | 91,9 | **92,9** |
| AM | 17,0 | 83,8 | 99,4 | 99,0 | 99,2 | 92,4 | **95,6** |
| MA | 38,2 | 94,5 | 99,6 | 99,5 | 99,6 | 91,4 | **96,9** |
| MT | 35,6 | 94,2 | 99,7 | 99,5 | 99,6 | 93,3 | **97,5** |
| PA | 25,4 | 92,0 | 99,2 | 98,9 | 99,1 | 91,7 | **96,4** |
| RO | 21,2 | 85,3 | 98,6 | 99,8 | 99,2 | 93,6 | **96,0** |
| RR | 25,0 | 87,5 | 98,1 | 95,6 | 96,9 | 91,8 | **94,4** |
| TO | 33,2 | 97,1 | 99,5 | 99,9 | 99,7 | 92,7 | **97,8** |

### I2.4.1 — CVLI (meta: 10 mortes/100 mil em 2050)
Fonte: Sinesp/VDE (MJ), bases `bancovde-2020..2026.xlsx` (CVLI = homicídio doloso + latrocínio + lesão corporal seguida de morte, vítimas) + População: Projeção IBGE 2024.

| UF | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 (jan-jul) | Pop. 2025 | **Taxa 2025 /100 mil** |
|---|---|---|---|---|---|---|---|---|---|
| AC | 282 | 172 | 209 | 184 | 161 | 171 | 83 | 884.372 | **19,3** |
| AP | 261 | 314 | 222 | 331 | 224 | 195 | 108 | 806.517 | **24,2** |
| AM | 1.009 | 1.548 | 1.413 | 1.324 | 1.101 | 739 | 394 | 4.321.616 | **17,1** |
| MA | 1.884 | 1.880 | 1.736 | 1.788 | 1.982 | 1.890 | 1.031 | 7.018.211 | **26,9** |
| MT | 803 | 749 | 916 | 893 | 881 | 696 | 349 | 3.893.659 | **17,9** |
| PA | 2.362 | 2.398 | 2.406 | 2.150 | 1.909 | 1.757 | 956 | 8.711.196 | **20,2** |
| RO | 390 | 442 | 488 | 425 | 434 | 420 | 175 | 1.751.950 | **24,0** |
| RR | 189 | 219 | 186 | 158 | 121 | 139 | 72 | 738.772 | **18,8** |
| TO | 443 | 360 | 421 | 371 | 249 | 259 | 151 | 1.586.859 | **16,3** |

---

## 5. Metodologia detalhada por fonte (fluxos que funcionaram)

### 5.1 TabNet/DATASUS (CNES, SIM) — o fluxo completo
1. **Descobrir o def**: `GET http://tabnet.datasus.gov.br/cgi/tabcgi.exe?<area>/cnv/<tabela>.def` → página de seleção com os `<select name="Linha|Coluna|Arquivos">` e filtros `S*`.
2. **POST obrigatório em ISO-8859-1**: `urllib.parse.urlencode(params, encoding='latin-1')` — em UTF-8 retorna "Tabela de conversão não encontrada".
3. **NÃO enviar filtros** com "TODAS_AS_CATEGORIAS__" (zera a consulta: "Nenhum registro selecionado").
4. **Resultado vem como link de CSV temporário**: `<A HREF=/csv/<nome>.csv>` → baixar `http://tabnet.datasus.gov.br/csv/<nome>.csv`.
5. Defs úteis descobertos: `cnes/cnv/estabbr.def` (estabelecimentos por tipo — coluna TELESSAUDE), `cnes/cnv/equipebr.def` (equipes — colunas 01/70 ESF, 76 EAP), `sim/cnv/evita10uf.def` (óbitos evitáveis <5 anos, arquivos `evitauf<ano>.dbf`), `ibge/cnv/projpop2024uf.def` (população — **campo de medida quebrado**, ver 7.3).
6. **Pegadinha**: defs inexistentes retornam HTTP 200 com "Arquivo DEF não encontrado" — sempre conferir o conteúdo.

### 5.2 PRODES/INPE (TerraBrasilis)
- API do dashboard: `https://terrabrasilis.dpi.inpe.br/app/prodes/dashboard/deforestation/files/rates2025.json` (taxas por período) + `config/loinames/prodes_legal_amazon.json` (mapeia gid 18277-18288 → UFs).
- **Rótulo do ano = `endDate.year`** (período ago/jul), NÃO o startDate.
- Validação: somar os 9 estados → série oficial (2020-2023 com dif zero).
- Alternativa testada e descartada: WFS `prodes-legal-amz:yearly_deforestation` (500 mil+ polígonos, limitado a 50k por página pelo GeoServer).

### 5.3 Focos de calor (INPE Queimadas)
- URL: `https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/anual/EstadosBr_sat_ref/<UF>/focos_br_<uf>_ref_<ano>.zip`
- Cada zip contém **apenas focos daquele estado** (verificado: coluna `estado` = UF) — contagem de linhas = focos do ano.
- 90/99 downloads OK (2025 não publicado). 6 threads, ~12s por UF/ano.

### 5.4 CNUC/MMA
- `https://dados.mma.gov.br/dataset/unidadesdeconservacao` → resource `cnuc_2026_03_atualizado.csv` (delimiter `;`, latin-1).
- Colunas-chave: `Esfera Administrativa`, `UF` (pode ser multivalorada), `Plano de Manejo`, `Conselho Gestor`.

### 5.5 Sinesp/VDE (MJ)
- `https://www.gov.br/mj/pt-br/assuntos/sua-seguranca/seguranca-publica/estatistica/download/dnsp-base-de-dados/bancovde-<ano>.xlsx/@@download/file`
- 485 mil linhas/ano; colunas: uf, municipio, evento, data_referencia, agente, arma, faixa_etaria, feminino, masculino, nao_informado.
- CVLI = eventos "Homicídio doloso" + "Roubo seguido de morte (latrocínio)" + "Lesão corporal seguida de morte".
- 2 arquivos vieram corrompidos no 1º download (2020, 2022) — re-baixar com `--retry 3`.

### 5.6 Projeção populacional IBGE 2024
- `https://ftp.ibge.gov.br/Projecao_da_Populacao/Projecao_da_Populacao_2024/projecoes_2024_tab1_idade_simples.xlsx`
- Estrutura: IDADE | SEXO | CÓD. | SIGLA | LOCAL | 2000...2070. **Usar apenas linhas SEXO="Ambos"** (Homens+Mulheres duplicariam).
- Populações conferidas com estimativas conhecidas (AC 884 mil, PA 8,7 mi em 2025).

### 5.7 SIS 2025 / PNADc 2024 (IBGE)
- `https://ftp.ibge.gov.br/Indicadores_Sociais/Sintese_de_Indicadores_Sociais/Sintese_de_Indicadores_Sociais_2025/Tabelas/xls/`
- `2_Distribuicao_Renda_xls.zip` → "Tabela 2.18 (Pobr_Geo).xls" (pobreza por UF); `4_Educacao_xls.zip` → "Tabela 4.1 (FreqBrut_Geo).xls" (frequência escolar por faixa).
- Arquivos .xls antigos → ler com `xlrd`.

### 5.8 IIVCM (AdaptaBrasil)
- A ficha técnica trazia o link: `https://docs.google.com/spreadsheets/d/1HkN4GzKAQ66aM5Zya8ILhSdaS0_DPIKq/export?format=csv` (município, UF, prioritário, IIVCM).

---

## 6. Registro completo de tentativas falhadas

### 6.1 Ferramentas de busca (indisponíveis)
| Ferramenta | Resultado |
|---|---|
| web_search / web_extract (Firecrawl) | Não configurado — "Set FIRECRAWL_API_KEY... run `hermes model`" |
| DuckDuckGo HTML via curl | Bloqueado (página "anomaly/challenge") |
| Bing via curl | Responde 200 mas **sequestra a query** (ignora aspas, retorna "programas Windows") |
| Busca do gov.br | 26 bytes — bloqueada para bots |

### 6.2 IBGE SIDRA/API
| Endpoint | Resultado |
|---|---|
| `servicodados.ibge.gov.br/api/v1/tabelas/6579/resultados?nivel=NC&geo=UF` | **503** (o dia todo, retries falharam) |
| `apisidra.ibge.gov.br/api/v1/tabelas/6579/resultados?...` | **404** |
| Tabela 6579 via HTML | Existe, mas é "População residente estimada" (não pobreza) |

### 6.3 INEP (IDEB) — 12+ abordagens
| Tentativa | Resultado |
|---|---|
| `download.inep.gov.br/dados_abertos/ideb/` (diretório) | 403 |
| `.../ideb/2023/ideb_municipios_2023.csv` / `.zip` / `.xlsx` | 404 |
| `.../ideb/2023/divulgacao_ideb_2023_uf.csv` | 404 (1º timeout, retry 404) |
| `.../ideb/ideb_2023.csv` | 404 |
| `educacao_basica/portal_ideb/planilhas_para_download/2023/divulgacao_ideb_2023_municipios.xlsx` | 404 |
| `.../2025/divulgacao_ideb_2025_municipios.xlsx` (4 variações) | 404 |
| `ideb.inep.gov.br/resultado/` | Redireciona para **Power BI** (sem API) |
| `inepdata.inep.gov.br/api/v1` / `analytics/saw.dll?Go` | 404 |
| Qedu (`qedu.org.br/brasil/ideb`, `/brasil/ideb/estados`) | 200 com headers de browser, mas **dados não extraíveis** (só `api/search/`; números no HTML são taxas de fluxo) |
| Página "Resultados" do INEP (gov.br/inep) | Sem links de arquivo (só `ideb.inep.gov.br`) |
| Busca gov.br | Bloqueada |

### 6.4 Outras fontes
| Fonte | Resultado |
|---|---|
| Sinaflor (IBAMA) | Redireciona para **login SSO** (`servicos.ibama.gov.br/sso-externo/login`) |
| e-Gestor APS (`relatorioaps.saude.gov.br/cobertura/aps`) | SPA Angular; JS retorna HTML para qualquer rota; sem API |
| Atlas da Violência (IPEA) | Site Next.js; `dados-api` 404 em 6 paths; chunks JS sem endpoints legíveis |
| Painel do Fogo (IBAMA) | Timeout (000) |
| AdaptaBrasil API (`sistema.adaptabrasil.mcti.gov.br/api/*`) | **403** |
| AdaptaBrasil /planos | SPA fechada (main.js 7,2MB minificado, sem endpoints) |
| MMA bioeconomia | Página institucional; painel da sociobioeconomia **em construção** (404) |
| PEVS (IBGE) | FTP: `Producao_da_Extracao_Vegetal_e_da_Silvicultura/` e `Producao_Agricola/...` vazios/inexistentes |
| SICAR/CAR | `consultapublica.car.gov.br` exige sessão interativa (cookies não bastam; endpoints `/publico/imoveis/filtro` 404) |
| TabNet `sim/cnv/evita74uf.def`, `evitae10uf.def`, `evitae74uf.def`, `evita5074uf.def` | "Arquivo DEF não encontrado" (com HTTP 200!) |
| TabNet `ibge/cnv/projpopuf.def` | Desativado ("População não mais em uso") — aponta para projpop2024uf |
| Qedu `/api/v1` | 403 |

---

## 7. Erros meus encontrados e corrigidos

| # | Erro | Detalhe concreto | Correção |
|---|---|---|---|
| 1 | **PRODES deslocado 1 ano** | Usei `startDate.year`; o período 2019-08→2020-07 é a taxa oficial **2020** (10.851 km²), que eu rotulei como 2019 | `endDate.year`; validação: 2020-2023 com dif **zero** contra a série oficial |
| 2 | **CNUC excluía interestaduais** | UCs com UF "AM, MT" não casavam com `UF in UFS` | Split da UF + pertinência; auditoria mostrou que não há UC estadual interestadual na AL (total permanece 199) |
| 3 | **População IBGE duplicada** | O xlsx tem 3 linhas por idade (Ambos/Homens/Mulheres); somando as 3, AC 2025 = 1,77 milhão (2x) | Filtrar SEXO="Ambos"; AC 2025 = 884.372 ✓ |
| 4 | **Parse CNES: aspas** | 1ª coluna vem `"11 Rondônia"` (com aspas) | `strip('"')` em todas as colunas |
| 5 | **Parse CNES: regex de acentos** | `[A-ZÀ-Ü ]+` parava em "R" de "Rondônia" (ô fora do range) | `[A-Za-zÀ-Üà-ü ]+` |
| 6 | **TabNet: encoding** | POST em UTF-8 → "Tabela de conversão não encontrada" | `urlencode(..., encoding='latin-1')` |
| 7 | **TabNet: filtros zerando** | Enviar `STipo_de_Estabelecimento=TODAS_AS_CATEGORIAS__` → "Nenhum registro selecionado" | Não enviar filtros |
| 8 | **TabNet: campo Incremento** | `Incremento=` → "Campo Incremento não encontrado" | Remover o parâmetro |
| 9 | **Bases Sinesp corrompidas** | 2020 e 2022 baixados truncados ("File is not a zip file") | Re-baixar com `--retry 3 --retry-delay 2` |
| 10 | **Workbook Eixo 2: ZeroDivision** | Parse do telessaúde falhava silenciosamente → total 0 | Debug linha a linha; causa = aspas + regex (itens 4-5) |
| 11 | **defaultdict não importado** | Bloco novo usava defaultdict sem import | `from collections import defaultdict` |
| 12 | **Caminhos após reorganização** | Arquivos movidos para subpastas de `dados/` e `entregaveis/` | Scripts atualizados e re-testados (montadores + auditoria OK) |
| 13 | **Valores de memória no relatório** | Na 1ª versão deste relatório, algumas tabelas (PRODES 2020-2023, UCs PM/CG por UF, focos anuais, população 0-4/2026, eSF/eAP) foram escritas de memória e continham números errados | **Todas as tabelas foram re-extraídas dos CSVs/arquivos brutos e corrigidas** (18/08/2026); as somas AL batem com as séries oficiais (PRODES 2020-2023 com dif zero; focos total 1.407.761) |

---

## 8. Pendentes — status e caminho de obtenção

### Eixo 1 (18 indicadores sem automação)
| Grupo | Indicadores | Fonte prevista | Como obter |
|---|---|---|---|
| ZEE / planos territoriais | I1.1.1, I1.1.3 | Secretarias estaduais de meio ambiente; Diário Oficial | Levantamento documental por estado (9) |
| Adaptação climática | I1.2.1, I1.2.2 | PEAs estaduais; Plano Clima/ENA (MMA) | Texto dos planos nos Diários Oficiais |
| Monitoramento/fiscalização | I1.3.3, I1.3.5, I1.3.6, I1.3.7, I1.3.8 | Estados; FBSP; CAL/Igarapé; Sisfogo; Diários Oficiais | Documental; FBSP publica "Cartografias da Violência na Amazônia" em PDF |
| Recuperação/restauração | I1.4.1, I1.4.2 | Observatório do Código Florestal; CAR/SICAR; PRAs | Documental (OCF não tem painel público acessível) |
| Fundiário | I1.5.1–I1.5.8 | Órgãos fundiários estaduais; INCRA; SICAR | Documental; SICAR sem API aberta |
| **% desmatamento ilegal** | I1.3.2 (complemento) | Sinaflor/IBAMA | Solicitar extração ao IBAMA (login SSO) |

### Eixo 2
| Indicador | Por que não saiu | Como obter |
|---|---|---|
| **I2.3.1 IDEB** | INEP sem API (12+ tentativas, ver 6.3) | **1 download manual**: planilha de divulgação do IDEB 2025 na página de Resultados do INEP, ou SIC |
| **I2.1.2 ≥4 programas** | PNAE/PAA/Bolsa Verde/Brasil Sem Fome em sistemas distintos sem API | Coleta documental; sugestão: usar dados do FNDE (PNAE), SAGI/MDS (PAA), ICMBio (Bolsa Verde) por município |
| **I2.4.2 segurança cidadã + planos municipais** | PRONASCI 2 sem lista pública; planos municipais sem base; AdaptaBrasil 403 | Portarias de habilitação do MJ por UF; prefeituras |
| **I2.5.1 renda sociobioeconomia** | Plataforma MMA em construção | Aguardar; alternativa: IBGE PEVS via SIDRA quando voltar |

---

## 9. Linha do tempo da sessão

| Hora (aprox.) | Evento |
|---|---|
| 18:40 | Identificação do framework (Estratégia Amazônia 2050) nas fontes da pasta; clarificação do eixo 1 |
| 18:50-19:10 | Eixo 1: PRODES (TerraBrasilis), CNUC, IIVCM, focos INPE (download 99 zips em background) |
| 19:10-19:20 | Workbook Eixo 1 gerado; **auditoria → erro do ano do PRODES encontrado e corrigido** |
| 19:20-19:35 | Eixo 2: Sinesp/MJ (7 bases), CNES telessaúde (TabNet), primeiro workbook Eixo 2 |
| 19:35-20:00 | População IBGE (FTP), taxas CVLI; SIS 2025 (pobreza + frequência escolar); mortalidade <5 |
| 20:00-20:10 | Tentativas finais: IDEB (12+ abordagens), AdaptaBrasil, PRONASCI, bioeconomia — todas sem API |
| 20:10-20:25 | Reorganização da pasta + RELATORIO_DE_COLETA.md + re-teste dos scripts |

---

## 10. Anexo A — catálogo completo dos indicadores

### Eixo 1 (23 indicadores de resultado)
I1.1.1 ZEE vigente/atualizado · I1.1.2 % UCs com plano de manejo + conselho ✓ · I1.1.3 Cooperação PNGATI/PNGTAQ · I1.2.1 PEA aprovado com LOA ✓parcial-doc · I1.2.2 PEA alinhado à ENA · I1.3.1 IIVCM ✓ · I1.3.2 % desmatamento ilegal (PRODES ✓ + Sinaflor ⏳) · I1.3.3 Monitoramento SR/tempo resposta · I1.3.4 Focos de calor ✓ · I1.3.5 Delegacias especializadas · I1.3.6 Sistema regional crimes ambientais · I1.3.7 Plano Manejo Integrado do Fogo (Sisfogo) · I1.3.8 PPCDQ vigente · I1.4.1 PRA regulamentado + ha sob TCA · I1.4.2 % restauração com SAFs · I1.5.1 % área pública regularizada · I1.5.2 Câmaras Técnicas de Destinação · I1.5.3 Mediação de conflitos · I1.5.4 Adesão SICARF · I1.5.5 Florestas públicas destinadas · I1.5.6 Integração de bases · I1.5.7 Sobreposições de CAR · I1.5.8 CAR/PCT

### Eixo 2 (10 indicadores de resultado)
I2.1.1 Pobreza ✓(proxy) · I2.1.2 ≥4 programas ⏳ · I2.2.1 Mortalidade evitável ⚠️(<5) · I2.2.2 Cobertura APS ⚠️(eSF) · I2.2.3 Telessaúde ✓(proxy) · I2.3.1 IDEB ⏳ · I2.3.2 Atendimento escolar ✓ · I2.4.1 CVLI ✓ · I2.4.2 Segurança cidadã ⏳ · I2.5.1 Bioeconomia ⏳

### Eixo 3 (9 indicadores de resultado — sessão 2, 30/08/2026)
I3.1.1 Valor da produção sociobioeconomia ✓(proxy PEVS/IBGE; fonte oficial MMA em construção) · I3.2.1 Cadeias estruturadas ⏳ + F3.2 empregos/empresas ✓(proxy RAIS) · I3.3.1 Política trabalho verde ⏳ · I3.3.2 Capacitados ⏳ · I3.3.3 Programas formação ⏳ · I3.4.1 Beneficiários PSA ⏳ · I3.4.2 Operações PSA/mercados ⏳ · I3.5.1 Política valor mineral ⏳ + F3.5 transformação industrial ✓(PIA) · I3.5.2 Projetos minerais conformes ⏳

---

## 11. Anexo B — reprodução

```bash
cd "C:\Users\faker\OneDrive\Documentos\Nova pasta (2)"
.venv/Scripts/python.exe scripts/agregar_cvli.py          # Sinesp → CVLI por UF/ano
.venv/Scripts/python.exe scripts/populacao_taxas.py       # população IBGE + taxas
.venv/Scripts/python.exe scripts/sis_pobreza_escola.py    # SIS: pobreza + frequência escolar
.venv/Scripts/python.exe scripts/montar_workbook.py       # entregaveis/Eixo1.xlsx
.venv/Scripts/python.exe scripts/montar_workbook_eixo2.py # entregaveis/Eixo2.xlsx
.venv/Scripts/python.exe scripts/auditar.py               # auditoria de sanidade
.venv/Scripts/python.exe scripts/eixo3_pevs.py            # SIDRA 289 → PEVS (sessão 2)
.venv/Scripts/python.exe scripts/eixo3_pia.py             # SIDRA 1849+10457 → PIA (sessão 2)
.venv/Scripts/python.exe scripts/eixo3_rais.py            # FTP MTE → RAIS 2023/2024 (sessão 2)
.venv/Scripts/python.exe scripts/montar_workbook_eixo3.py # entregaveis/Eixo3.xlsx (sessão 2)
```

**Próximos passos recomendados**
1. Habilitar a busca web (`hermes model` / chave Firecrawl) → destravaria IDEB, ZEE, PEA, PPCDQ, PRA e delegacias.
2. Solicitar ao IBAMA a extração do Sinaflor por UF (fecha o I1.3.2).
3. ~~Retentar a SIDRA (pobreza oficial CadÚnico/PNADc e PAM/PEVS para o Eixo 3)~~ — **FEITO na sessão 2 (Eixo 3): a SIDRA voltou ao ar** (PEVS 289 e PIA 1849/10457 coletadas); a pobreza CadÚnico/PNADc via SIDRA ainda pode ser retentada para o Eixo 2.
4. Eixos 3-5: reaproveitar os fluxos 5.1-5.7 (TabNet, FTP IBGE, Sinesp, TerraBrasilis).

---

## 12. Adendo — Eixo 4 (30/08/2026)

**Escopo:** Eixo 4 — Infraestrutura e integração regional sustentável · 6 indicadores de resultado (linhas 4.1 a 4.4; 4.3 e 4.4 têm dois cada) · 9 estados da AL.
**Entregável:** `entregaveis/Indicadores_Resultado_Eixo4_Amazonia2050.xlsx` (8 abas).
**Auditoria:** `scripts/auditar_eixo4.py` — 16/16 verificações OK.

### Status

| Indicador | Fonte | Status |
|---|---|---|
| I4.1.1 IBC-AMZ ponderado pela população | ANATEL (dados brutos do painel Meu Município) | **coletado** (2021-2025, UF + ponderado por população municipal) |
| I4.2.1 Adequação/trafegabilidade de transportes | CNT; DNIT | **pendente** (Power BI sem API; vgeo só geometria) |
| I4.3.1 ITEQ (transição energética) | EPE PASI; ANEEL | **parcial** (PASI exige autenticação; DEC/FEC sem API) |
| I4.3.2 Participação de renováveis (PER) | ANEEL SIGA (CKAN) | **coletado** (proxy sobre potência fiscalizada, base 25/08/2026) |
| I4.4.1 ISGR (saneamento + riscos) | IBGE Censo 2022 (SIDRA) + MUNIC 2024 (FTP) | **coletado** (proxy com FHidro=1, fator não publicado) |
| I4.4.2 Capacidade adaptativa >0,5 | AdaptaBrasil Painel Cidades | **pendente** (SPA sem API; API geral 403) |

### I4.1.1 — IBC-AMZ (2025; meta: 80,00 até 2050; baseline 53,52)
Fonte: ANATEL `dadosabertos/paineis_de_dados/meu_municipio/ibc.zip` (séries 2021-2025, UF e município). Ponderação: Σ(IBC_mun × pop_mun Censo 2022 SIDRA 4709)/Σ pop_mun. **Validação: AL 2025 = 53,52 — idêntico ao baseline da ficha (2º decimal).**

| UF | IBC 2025 | Ponderado 2025 |
|---|---|---|
| AC | 52,43 | 52,12 |
| AP | 54,89 | 56,95 |
| AM | 46,74 | 48,80 |
| MA | 55,56 | 52,56 |
| MT | 61,31 | 60,42 |
| PA | 53,05 | 53,10 |
| RO | 58,45 | 56,13 |
| RR | 46,53 | 49,19 |
| TO | 53,73 | 53,92 |
| **AL** | — | **53,52** |

### I4.3.2 — PER (proxy sobre potência fiscalizada em operação; meta 80% até 2050, baseline 65,24%)
Fonte: ANEEL SIGA via CKAN (`siga-empreendimentos-geracao.csv`, 25.133 empreendimentos, base 25/08/2026). Renováveis da ficha: hídrica, solar, eólica, biomassa.

| UF | Potência (MW) | Renovável (MW) | PER % |
|---|---|---|---|
| AC | 142,9 | 2,2 | 1,6% |
| AP | 973,7 | 947,7 | 97,3% |
| AM | 2.509,4 | 295,5 | 11,8% |
| MA | 4.481,4 | 1.825,3 | 40,7% |
| MT | 4.256,0 | 3.682,6 | 86,5% |
| PA | 22.849,6 | 22.523,8 | 98,6% |
| RO | 8.213,0 | 7.801,0 | 95,0% |
| RR | 515,8 | 92,4 | 17,9% |
| TO | 1.987,4 | 1.968,8 | 99,1% |
| **AL** | **45.929,2** | **39.139,3** | **85,2%** |

Nota: proxy sobre POTÊNCIA (não energia ofertada) — por isso o resultado difere do baseline oficial (65,24% pondera a oferta de energia).

### I4.4.1 — ISGR (Censo 2022 + MUNIC 2024; meta 80% até 2050, baseline 41,52%)
Fonte: SIDRA 6803 (água) e 6805 (esgoto) nos 808 municípios da AL + `Base_MUNIC_2024_20251107.xlsx` (FTP IBGE) para FClima (Magr18/Mhab088/Mtic266) e FGov (Mgov086), conforme fórmula da ficha. FHidro não publicado => 1.

| UF | % água adequada | % esgoto adequado | ISGR % |
|---|---|---|---|
| AC | 71,9 | 49,7 | 49,33 |
| AP | 76,2 | 48,9 | 48,61 |
| AM | 88,7 | 51,0 | 50,44 |
| MA | 90,0 | 42,8 | 41,31 |
| MT | 94,8 | 58,0 | 56,67 |
| PA | 81,9 | 47,1 | 45,47 |
| RO | 71,1 | 39,5 | 38,83 |
| RR | 89,5 | 72,7 | 68,97 |
| TO | 91,5 | 50,9 | 48,45 |
| **AL** | **86,2** | **48,6** | **47,17** |

8,6 milhões de domicílios particulares permanentes ocupados na AL. O resultado fica acima do baseline oficial (41,52%) porque o fator FHidro (vulnerabilidade à escassez hídrica) não é publicado e foi assumido 1.

Ressalvas documentadas (revisão de 30/08/2026):
1. **Mhab088** ("priorização de áreas vulneráveis no plano habitacional") tem valor "-" (não aplicável) em **548 dos 808 municípios** — só 260 respondem. Onde não aplicável, vale a penalidade 0,9 conforme a regra da ficha ("NÃO ou em branco"). FClima efetivo depende então de Magr18 (440 Sim) e Mtic266 (26 Sim).
2. **"Água adequada"** da ficha inclui a categoria "possui ligação à rede geral, mas utiliza principalmente outra forma" (SIDRA 72145: poço raso, carro-pipa, chuva, rios). Na definição **estrita** (só rede utilizada 72144 + poço profundo 72154), a AL teria **79,1%** em vez de 86,2%. A coleta segue a leitura literal dos três itens da ficha.

### Revisão independente (30/08/2026 — scripts/revisar_eixo4.py)

Validações externas além da consistência interna (auditar_eixo4.py):

| Verificação | Resultado |
|---|---|
| População municipal (Censo 2022): soma por UF vs SIDRA n3 | 9/9 UFs exatos |
| Agregação municipal água/esgoto vs SIDRA n3 por UF | 0 divergências (27 comparativos) |
| Esgoto adequado Brasil (recalculado n1) | 77,4% — coerente com a divulgação do Censo 2022 |
| Spot-check municipal (Porto Velho) vs SIDRA direto | água/esgoto/total exatos |
| Spot-check fatores MUNIC (Porto Velho, Boa Vista) na planilha | fclima/fgov exatos |
| SIGA: maiores usinas do PA | Belo Monte 11,23 GW + Tucuruí 8,54 GW no topo ✓ |
| SIGA: total nacional em operação | 219 GW (plausível vs matriz ANEEL) |
| IBC: re-ponderação com implementação independente | AL 2025 = 53,5214 (baseline 53,52) e 9/9 UFs iguais |
| Workbook vs CSVs (3 abas de dados) | 0 divergências |

Correções feitas durante a revisão (erros do próprio revisor, não dos dados): coluna errada na conferência do workbook (col 8 = ponderado 2024, não 2025); tolerância de rounding PER; limiares de plausibilidade mal calibrados; um valor transitório "-" da SIDRA n3 (total de RO) numa chamada agregada — a coleta usa dados municipais (n6), que conferem.

### Tentativas que não funcionaram (Eixo 4)
| Fonte | Resultado |
|---|---|
| CNT data.cnt.org.br (painel rodovias) | Embed Power BI — sem API/dados abertos dos trechos por estado de conservação |
| DNIT vgeo (servicos.dnit.gov.br/vgeo) | Geometria de rodovias sem atributo de qualidade — insuficiente para a fórmula |
| EPE PASI (pasi.epe.gov.br) | Endpoints `ExportarDadosMercado*`/`ObterEstadosCiclo` retornam 500/400 (exige token da aplicação SPA) |
| ANEEL portalrelatorios DEC/FEC | Página responde, mas sem API documentada (exportação manual) |
| AdaptaBrasil Painel Cidades | SPA: `env.js` entrega HTML; sem endpoints expostos (API geral do AdaptaBrasil 403, reconfirmado 30/08) |

### Reprodução (Eixo 4)
```bash
.venv/Scripts/python.exe scripts/eixo4_ibc_anatel.py        # IBC ANATEL + ponderação populacional
.venv/Scripts/python.exe scripts/eixo4_aneel_siga.py        # SIGA → PER por UF
.venv/Scripts/python.exe scripts/eixo4_saneamento_sidra.py  # SIDRA 6803/6805 + MUNIC → ISGR
.venv/Scripts/python.exe scripts/montar_workbook_eixo4.py   # entregaveis/Eixo4.xlsx
.venv/Scripts/python.exe scripts/auditar_eixo4.py           # 16 verificações de sanidade
```

**Nota:** o Eixo 3 foi coletado na sessão 2 deste mesmo agente — ver seção 14.

---

## 13. Adendo — Eixo 5: Governança e parcerias (30/08/2026)

**Escopo:** Eixo 5 — Governança e parcerias · 9 indicadores de resultado (linhas 5.1 a 5.5; 5.2, 5.3 e 5.5 têm dois cada) · 9 estados da AL.
**Entregável:** `entregaveis/Indicadores_Resultado_Eixo5_Amazonia2050.xlsx` (6 abas).
**Dados brutos:** `dados/eixo5/capag/` (9 CSVs STN), `dados/eixo5/pd/` (2 CSVs MCTI), `dados/eixo5/capag_uf_ano.csv` e `dados/eixo5/pd_uf_ano.csv` (agregados).

### Status

| Indicador | Fonte | Status |
|---|---|---|
| I5.1.1 Financiamento climático captado/executado por estado | Estados | coleta manual |
| I5.2.1 Taxa de alavancagem (blended finance) | Estados | coleta manual |
| I5.2.2 Governança regional / recursos executados pelo CAL | CAL | pendente via automação (site Wix; ref. da ficha registrada) |
| I5.3.1 Estados que incorporaram diretrizes do arranjo jurídico climático | Estados | coleta manual |
| I5.3.2 % bases de dados prioritárias integradas | Estados | coleta manual |
| I5.4.1 Dispêndio P&D % do PIB estadual | MCTI + IBGE | **parcial** (público estadual coletado; privado exige PINTEC por UF) |
| I5.5.1 CAPAG A ou B | STN/Tesouro Transparente | **coletado** (2018-2025) |
| I5.5.2 EBT 360 (transparência) | CGU | pendente (MBT fora do ar; retorno prev. nov/2026) |
| I5.5.3 Modelos regionais de governança compartilhada | Estados e CAL | coleta manual |

### I5.5.1 — CAPAG dos estados (STN; meta: fortalecimento da capacidade de gestão)

Classificação final da CAPAG (endividamento + poupança corrente + liquidez). A+/B+ aplicados pela STN a partir da avaliação 2024; contagem "A ou B" usa a letra base.

| UF | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|---|---|
| AC | B | B | B | B | B | B | C | C |
| AP | B | C* | Suspensa | C | C | C | B | A |
| AM | B | B | B | B | B | B | B+ | B+ |
| MA | C | C | C | B | C | C | B | A |
| MT | C | C | C | A | A | A | A+ | A+ |
| PA | B | B | B | B | A | B | B | B+ |
| RO | B | B | A | A | A | A | A+ | A+ |
| RR | B | C | C | A | A | B | A | A |
| TO | C | C | C | C | B | B | B+ | B+ |
| **AL em A/B** | **6/9** | **4/9** | **4/9** | **7/9** | **7/9** | **7/9** | **8/9** | **8/9** |

Fonte: CKAN do Tesouro Transparente, dataset "capag-estados" (CSVs anuais 2018-2025; para 2024 usada a revisão de 04/2025). AP "C*" (2019, nota com ressalva) e "Suspensa" (2020) mantidos como publicados. Estrito (somente A/B sem "+" neles): 2024 = 4/9, 2025 = 3/9 — diferença documentada na aba do workbook.

### I5.4.1 — Dispêndio estadual em P&D (componente público; meta: 1% do PIB, público + privado)

P&D dos governos estaduais (incl. IES estaduais), R$ milhões correntes (MCTI, t.1.2.2.5) e % do PIB (P&D ÷ PIB corrente, SIDRA t5938):

| UF | P&D 2022 (R$ mi) | P&D 2023 (R$ mi) | P&D 2024 (R$ mi) | P&D/PIB 2023 |
|---|---|---|---|---|
| AC | 13,2 | n/p | 5,64 | n/p |
| AP | 14,2 | 5,59 | 9,10 | 0,020% |
| AM | 201,9 | 215,07 | 260,33 | 0,133% |
| MA | 111,1 | 136,62 | 150,24 | 0,092% |
| MT | 137,6 | 120,66 | 161,55 | 0,044% |
| PA | 158,5 | 168,89 | 168,08 | 0,066% |
| RO | 6,7 | 9,88 | 8,91 | 0,013% |
| RR | 21,3 | 30,06 | 31,97 | 0,120% |
| TO | 5,7 | 14,77 | 18,27 | 0,023% |
| **AL** | **670,2** | **701,54** | **814,09** | **0,066%** |

Série completa 2000-2024 por UF no workbook (aba 5.4.1, com % P&D/receita da t.1.2.2.7). Limitação: a série não inclui dispêndio empresarial/privado nem federal — o alcance da meta de 1% do PIB exige PINTEC por UF (disponível só para UFs selecionadas).

### I5.2.2 — CAL: tentativa de coleta e referência da ficha

- Site `consorcioamazonialegal.gov.br/orcamento-anual` (Wix): a tabela "Orçamento Anual" carrega via `_api/cloud-data` com token de sessão — sem token retorna `WDE0117: MetaSite not found`; sem JSON estático no HTML; `dynamic-pages-router` (prefixo `orcamento-anual-item`, coleção `OrcamentoAnual`) retornou 404 nos formatos testados. → coleta manual junto ao CAL.
- Referência documentada na ficha técnica (metodologia de projeção do próprio CAL): orçamento executado 2026 = **R$ 6.120.000**; crescimento médio do histórico 2019-2026 = **R$ 483.566/ano**; projeção = 6.120.000 + 483.566 × (ano − 2026) → 2030: R$ 8.054.264; 2035: R$ 10.472.094; 2050: R$ 17.725.584.

### Tentativas que não funcionaram (Eixo 5)

| Fonte | Resultado |
|---|---|
| dadosabertos.cgu.gov.br | DNS não resolve (SOA sem registro A/AAAA) — reconfirmado 30/08 |
| mbt.cgu.gov.br (EBT 360 / Mapa Brasil Transparente) | "Sistema temporariamente fora do ar para atualizações. Previsão de retorno: novembro/2026" |
| CAL `_api/cloud-data/v1` e `v2` (com/sem headers gridAppId, metaSiteId, siteId) | 400 `WDE0117: MetaSite not found` (exige token de sessão do browser) |
| CAL `dynamic-pages-router/v1` (router e prefixo, GET/POST com bodyData da página) | 404 |
| `buscalai.cgu.gov.br` / páginas de resultados EBT 360 no gov.br | Dependem do MBT (fora do ar) |

### Reprodução (Eixo 5)

```bash
.venv/Scripts/python.exe scripts/eixo5_capag.py          # CAPAG STN 2018-2025 → dados/eixo5/capag_uf_ano.csv
.venv/Scripts/python.exe scripts/eixo5_pd.py             # MCTI P&D + SIDRA PIB → dados/eixo5/pd_uf_ano.csv
.venv/Scripts/python.exe scripts/montar_workbook_eixo5.py # entregaveis/Eixo5.xlsx
.venv/Scripts/python.exe scripts/auditar_eixo5.py        # auditoria de sanidade
.venv/Scripts/python.exe scripts/verificar_eixo5.py      # verificação independente bruto↔CSV↔workbook (10 checks)
```

### Verificação (30/08/2026)

Verificação independente (`scripts/verificar_eixo5.py`): 10/10 checks OK — CAPAG (72 células) e P&D/%receita (bruto == agregado == workbook); PIB conferido por re-fetch da SIDRA. Validações externas: PIB Brasil 2023 pela SIDRA = R$ 10,94 tri (bate com o oficial IBGE); RO A+ 2025 confirmado por notícia do governo estadual ("6º ano consecutivo na nota máxima", 06/2026 — consistente com a série A desde 2020); Boletim STN 03/2025 (21 estados + DF em A/B) coerente com 8/9 na AL; diff da revisão CAPAG 2024 vs original altera apenas o DF (fora da AL). Ajuste na revisão: PIB gravado com precisão integral (3 decimais) no CSV — nenhum indicador alterado.

**Nota:** o Eixo 4 foi coletado em sessão paralela (seção 12); o Eixo 3, pelo mesmo agente desta sessão (seção 14).

---

## 14. Adendo — Sessão 2: Eixo 3 — Desenvolvimento econômico sustentável (30/08/2026)

**Escopo:** Eixo 3 — Desenvolvimento econômico sustentável · 9 indicadores de resultado (linhas 3.1 a 3.5, coluna INDICADOR DE RESULTADO da aba atualizada) + 2 indicadores das fichas técnicas das linhas 3.2 e 3.5 · 9 estados da AL.
**Entregável:** `entregaveis/Indicadores_Resultado_Eixo3_Amazonia2050.xlsx` (9 abas: Sobre, Catalogo_Indicadores, Matriz_UF, 3.1.1_Pevs_serie, 3.1.1_Pevs_produtos_2024, F3.2_Rais_empregos, F3.2_Rais_divisoes, F3.5_Pia_transformacao, Pendentes_anotacoes).
**Dados brutos:** `dados/eixo3/` (7 CSVs processados) + `dados/eixo3/rais/` (2 arquivos 7z brutos, ~270 MB).
**Dependência nova:** `py7zr` (instalado no venv via pip para extrair os 7z da RAIS).

### Status

| Indicador | Fonte da matriz/ficha | Status |
|---|---|---|
| I3.1.1 Valor da produção da sociobioeconomia | MMA (Plataforma da Ecosociobiodiversidade) | **coletado** (proxy: PEVS/IBGE, SIDRA 289, série 2015-2024; a plataforma oficial segue em construção) |
| I3.2.1 Cadeias produtivas estruturadas (matriz) | Estados | **pendente** (documental — critérios de "cadeia estruturada" não definidos publicamente) |
| F3.2 Empregos/empresas nas cadeias (ficha 3.2) | MMA; proxy MTE | **coletado** (RAIS Estabelecimentos 2023-2024: vínculos ativos 31/12 e estabelecimentos ativos por UF × divisão CNAE) |
| I3.3.1 Política de trabalho verde | Estados | **pendente** (documental) |
| I3.3.2 Colaboradores/cidadãos capacitados (10 mil) | Estados | **pendente** (documental) |
| I3.3.3 Programas permanentes de formação | Estados | **pendente** (documental) |
| I3.4.1 Beneficiários ativos de PSA | Estados | **pendente** (documental — a ficha diz "Estados devem possuir esta informação") |
| I3.4.2 Operações de PSA, créditos ambientais, fundos verdes | Estados | **pendente** (documental) |
| I3.5.1 Política de agregação de valor mineral (matriz) | Estados ("PNAD" na matriz = provável erro tipográfico) | **pendente** (documental) |
| F3.5 Valor da transformação industrial (ficha 3.5, cita SIDRA 10457) | IBGE | **coletado** (PIA-Empresa: 1849 série 2015-2023 + 10457 ano 2024) |
| I3.5.2 Projetos minerais conformes com matriz socioambiental | Estados | **pendente** (documental — a própria matriz exige definir os critérios junto aos estados) |

Resumo: **3 coletados via script** (todos com proxy documentada), **0 parciais**, **6 pendentes documentais** (informação jurisdicional dos estados, sem base pública consolidada).

### I3.1.1 — Valor da produção da extração vegetal (proxy sociobioeconomia; R$ mil correntes, PEVS/IBGE)

| UF | 2015 | 2020 | 2023 | 2024 |
|---|---|---|---|---|
| AC | 80.754 | 59.276 | 113.796 | 115.843 |
| AP | 39.045 | 59.349 | 70.542 | 79.934 |
| AM | 298.130 | 284.755 | 351.313 | 376.141 |
| MA | 352.692 | 269.608 | 300.107 | 425.492 |
| MT | 627.229 | 705.664 | 651.474 | 1.042.643 |
| PA | 1.457.353 | 1.582.422 | 2.615.443 | 2.735.080 |
| RO | 185.331 | 147.860 | 143.835 | 230.816 |
| RR | 37.827 | 49.055 | 77.858 | 60.644 |
| TO | 88.143 | 40.065 | 60.619 | 42.609 |
| **AL** | **3.166.504** | **3.198.054** | **4.384.987** | **5.109.202** |

Cadeias líderes por valor em 2024: PA — madeira em tora (R$ 1,68 bi) e açaí (R$ 801,9 mi); MT — madeira em tora (R$ 754,1 mi); AM — açaí (R$ 141,6 mi); MA — carvão vegetal (R$ 242,9 mi) e babaçu (R$ 60,3 mi); AC — castanha-do-pará (R$ 58,6 mi). Detalhe completo (1.387 linhas produto × UF × ano) em `dados/eixo3/pevs_por_produto_uf.csv`.

Limitação declarada: a PEVS cobre extração vegetal (madeireira e não-madeireira) — NÃO cobre agricultura familiar não extrativista, pesca nem manejo de fauna; por isso é proxy parcial do indicador do MMA. O IBGE não publica o total de QUANTIDADE da extração (soma heterogênea) — quantidade (t) existe apenas por produto.

### F3.2 — Empregos formais e estabelecimentos (RAIS/MTE, 2023-2024)

| UF | Estab 2023 | Estab 2024 | Vínculos 2023 | Vínculos 2024 | Var vínculos (%) |
|---|---|---|---|---|---|
| AC | 11.994 | 12.547 | 172.265 | 177.291 | 2,9 |
| AP | 8.954 | 9.649 | 154.513 | 152.991 | -1,0 |
| AM | 38.181 | 40.636 | 776.964 | 793.706 | 2,2 |
| MA | 70.221 | 74.981 | 948.843 | 969.147 | 2,1 |
| MT | 149.926 | 159.934 | 1.129.867 | 1.194.886 | 5,8 |
| PA | 96.238 | 101.703 | 1.396.509 | 1.431.632 | 2,5 |
| RO | 48.718 | 51.098 | 389.151 | 407.713 | 4,8 |
| RR | 9.420 | 10.101 | 143.519 | 146.857 | 2,3 |
| TO | 43.507 | 46.375 | 375.427 | 404.248 | 7,7 |
| **AL** | **477.159** | **507.024** | **5.487.058** | **5.678.471** | **3,5** |

A agregação por divisão CNAE (740 linhas × 2 anos, com nomes das 87 divisões do IBGE) permite medir qualquer cadeia produtiva que os estados escolham — aba `F3.2_Rais_divisoes` com filtros. Maiores empregadores formais em todas as UFs: divisão 84 (administração pública) e 47 (comércio varejista) — as cadeias verdes (ex.: 02 florestas, 03 pesca, 10 alimentos, 16 madeira) podem ser isoladas no filtro.

### F3.5 — Valor da transformação industrial (PIA-Empresa/IBGE, R$ mil correntes)

| UF | 2015 | 2020 | 2023 | 2024 | CAGR 15-24 (%) |
|---|---|---|---|---|---|
| AC | 394.082 | 320.242 | 649.323 | 925.342 | 9,9 |
| AP | 488.161 | 963.936 | 514.770 | 592.145 | 2,2 |
| AM | 35.914.870 | 43.511.856 | 62.646.346 | 75.577.158 | 8,6 |
| MA | 7.031.763 | 11.219.119 | 12.319.388 | 14.534.906 | 8,4 |
| MT | 15.762.391 | 24.049.984 | 38.526.666 | 41.521.382 | 11,4 |
| PA | 26.731.282 | 91.708.270 | 62.596.977 | 70.146.964 | 11,3 |
| RO | 2.763.391 | 3.301.806 | 5.910.248 | 6.091.511 | 9,2 |
| RR | 91.620 | 131.162 | 250.891 | 378.434 | 17,1 |
| TO | 1.488.246 | 2.085.879 | 4.739.960 | 5.597.138 | 15,9 |
| **AL** | **90.665.806** | **177.292.254** | **188.154.569** | **215.364.980** | — |

Empresas com 5+ pessoas. A ficha do indicador 3.5 cita a tabela 10457 (série nova, 2024-) — para dar profundidade histórica foi somada a série antiga 1849 (2007-2023), **com quebra de série documentada** entre 2023 e 2024. Detalhe por divisão CNAE (2023 e 2024) em `dados/eixo3/pia_divisoes_uf_ano.csv`.

### Metodologia (fluxos que funcionaram)

**5.9 SIDRA/API IBGE (voltou ao ar — o 503 da sessão 1 era transitório)**
- Metadados: `servicodados.ibge.gov.br/api/v3/agregados/{tabela}/metadados` — as respostas vêm **gzip** mesmo com `Accept-Encoding: identity`; descomprimir se os 2 primeiros bytes forem `1f 8b`.
- Valores: `apisidra.ibge.gov.br/values/t/{tab}/n3/{codigos_uf}/v/{vars}/p/{anos}/c{clas}/{categoria}` — **n3 = Unidade da Federação** (n6 é município; e `n1/2` dá erro "Unidade territorial 2 inexistente" quando o Brasil é código 1).
- A 1ª linha da resposta é um descritor (valores nos campos D1C..D4N); filtrar `D1C.isdigit()`.
- Níveis de UF confirmados: PEVS 289 (n1-n2-n3-n6-n8-n9), PIA 1849 (n1-n3), 10457 (n3).
- Variáveis só existem na tabela certa (2086/13816 só na 10457): misturar variáveis de duas tabelas numa chamada → 400.
- Tabela **1848 está vazia** (todos os valores "..."): a série por UF da PIA-Empresa série antiga é a **1849** ("por UF, segundo as divisões") — descoberto por eliminação entre 1848/1849/5602/1987/1988.
- Nomes das divisões CNAE 2.0: `servicodados.ibge.gov.br/api/v2/cnae/divisoes` (87 divisões, com seção).

**5.10 RAIS/MTE por FTP**
- FTP anônimo: `ftp://ftp.mtps.gov.br/pdet/microdados/RAIS/{ano}/RAIS_ESTAB_PUB.7z` (127-141 MB/ano). O 7z contém **um único arquivo `RAIS_ESTAB_PUB.COMT`** (~1,3-1,4 GB) — CSV nacional, separador **vírgula** (não ponto-e-vírgula), latin-1, com colunas: `UF - Código` (código IBGE 11-51), `CNAE 2.0 Classe - Código` (entre aspas, com espaços), `Qtd Vínculos Ativos`, `Ind Atividade Ano - Código` (1 = ativo no ano), `Município - Código` etc.
- Extração com py7zr (o 7-Zip não estava no sistema; `pip install py7zr`).
- Agregação: filtrar UFs da AL, contar estabelecimentos com `Ind Atividade Ano = 1` e somar vínculos ativos, por UF × divisão (2 primeiros dígitos da classe CNAE). 2,0-2,5 milhões de linhas da AL por ano.
- Validado contra a imagem pública: PA ~1,43 mi vínculos formais em 2024, MT ~1,19 mi, AC ~177 mil — plausíveis.

### Erros/pegadinhas desta sessão

| # | Erro | Detalhe | Correção |
|---|---|---|---|
| 1 | 400 "Unidade territorial 2 inexistente" | Usei `n1/2` na URL da SIDRA | Remover o n1 (ou usar n1/1); UF = n3 |
| 2 | 400 "Parâmetro P mal especificado" | Sintaxe `p/-4` (últimos 4) não existe na apisidra | Períodos explícitos (`p/2015-2024` funciona) |
| 3 | KeyError no parse | A 1ª linha da resposta tem descritores nos campos D*C | Pular linhas com `D1C` não numérico |
| 4 | Série PIA vazia | Tabela 1848 retorna "..." para tudo | Série antiga por UF = **1849** |
| 5 | 400 na PIA | Chamei a 1848/1849 com variáveis da 10457 (2086, 13816) | Variáveis por tabela: 706/631/810/811/835/673 na 1849; +2086/13816 na 10457 |
| 6 | RAIS: 0 arquivos extraídos | Esperei CSVs regionais no 7z; o namelist tem 1 único `.COMT` | Extrair e tratar `RAIS_ESTAB_PUB.COMT` como CSV nacional |
| 7 | RAIS: parser ';' falhou | Layout 2023/2024 usa **vírgula** (diferente do layout antigo ';') | csv.reader com vírgula + colunas detectadas pelo nome |
| 8 | Quantidade PEVS nula no total | IBGE suprime o total de quantidade (soma heterogênea em toneladas) | Quantidade mantida só por produto |

### Tentativas que não funcionaram (Eixo 3)

| Fonte | Resultado |
|---|---|
| API Novo CAGED (`apidatalake.mte.gov.br`) | DNS inexistente (endpoint aposentado) — o fluxo mensal exigiria os microdados do FTP `NOVO CAGED/` (~108 zips/ano); estoque RAIS cobre o indicador |
| Plataforma da Ecosociobiodiversidade (MMA) | Em construção (página institucional) — reconfirmado |
| Tabela 1848 (SIDRA) | Existe e responde, mas sem dados (todos "...") |
| Tabelas 1987/1988 (CNAE 1.0, 1996-2007) | Funcionam, mas desnecessárias para a série 2015-2024 |
| Tabela 5602 | N3 incompatível (nível municipal) — não aplicável a UF |

### Pendentes e caminho de obtenção (Eixo 3)

| Indicador | Como obter |
|---|---|
| I3.2.1 Cadeias estruturadas | Levantamento documental junto às secretarias estaduais (lista de cadeias + critérios); a proxy RAIS por divisão CNAE já permite monitorar cada cadeia escolhida |
| I3.3.1 Política de trabalho verde | Leis/decretos estaduais nos Diários Oficiais dos 9 estados |
| I3.3.2 Capacitados / I3.3.3 Programas | Secretarias estaduais de qualificação (SINE/SETAS), SENAI/SENAC; sistemas sem API pública |
| I3.4.1 Beneficiários PSA / I3.4.2 Operações | Programas estaduais de PSA/REDD+, Bolsa Verde (ICMBio), Floresta+ (IBAMA); a ficha indica que os estados possuem a informação |
| I3.5.1 Política mineral (matriz) | Documental: planos estaduais de mineração (PEM) |
| I3.5.2 Projetos minerais conformes | Depende da definição da matriz de critérios; base auxiliar possível: SIGMINE/ANM |
| I3.1.1 (fonte oficial) | Aguardar a abertura da Plataforma da Ecosociobiodiversidade do MMA e substituir/ajustar a proxy PEVS |

### Revisão independente (30/08/2026 — scripts/revisar_eixo3.py)

18 verificações, todas passando após correções (ver "Achados da revisão"):

| Verificação | Resultado |
|---|---|
| PEVS: re-consulta SIDRA (padrão de URL diferente, 2020 e 2024) = CSV salvo | 9/9 UFs idênticos em ambos os anos |
| PEVS: 9 chamadas individuais por UF (2023) = CSV | 9/9 — sem troca de linha/UF no parse |
| PEVS: soma dos SUBPRODUTOS = categoria Total (9 UFs, 2024) | OK (após correção do agregador) |
| PEVS Brasil (SIDRA n1, 2024) = R$ 7.034.087 mil | **= divulgação IBGE: "R$ 7,0 bilhões" (extração vegetal)** |
| PEVS: açaí no Pará 2024 = R$ 801.911 mil | **= divulgação IBGE: "R$ 801,9 milhões" (exato)** |
| PEVS: soma AL = 72,6% do Brasil | plausível (açaí, castanha, babaçu e madeira nativa concentrados na AL; fora dela: erva-mate, carnaúba, pinho) |
| PIA 1849 (2023) e 10457 (2024): re-consulta VTI + pessoal = CSV | 9/9 UFs em ambas |
| PIA: soma das divisões ≤ Total, com TODA lacuna explicada por 'X' de sigilo | OK — lacunas: RR 16-23%, AP 52% (2024), TO 22-25%, MA 24% etc. (estados com base industrial concentrada; comportamento padrão da SIDRA) |
| PIA Brasil 2024 (soma 27 UFs) = R$ 2.546.525.142 mil | **= divulgação IBGE: "R$ 2,5 trilhões" de VTI (unidades locais 5+)** |
| RAIS: re-extração dos 7z e re-agregação com implementação independente = CSVs | OK (estabelecimentos por UF e 736/739 pares UF×divisão, 2023 e 2024) |
| RAIS: sensibilidade do filtro 'Ind Atividade Ano = 1' | vínculos em estabelecimentos inativos = **0** em 5,5 mi (2023) e 6,5 mi (2024) linhas — o filtro não altera o estoque |
| RAIS Brasil 2024 (soma nacional do arquivo bruto) = **57.132.156 vínculos** | **MATCH EXATO com o Sumário Executivo oficial da RAIS 2024 (MTE): 57.132.156** |
| RAIS: variação AL 2023→2024 = +3,5% | coerente com a variação nacional oficial (+3,3%) |
| RAIS: AL = 9,9% do estoque nacional | plausível (população AL ≈ 11,6%; informalidade maior na região) |
| Workbook vs CSVs: abas PEVS série (90 células), PIA série (90), RAIS empregos (36), Matriz_UF (9) e RAIS divisões PA (85 divisões × 2 colunas) | 0 divergências |

**Achados da revisão (e correções aplicadas):**

1. **BUG REAL corrigido — PEVS madeireiro/não-madeireiro** (`pevs_madeireiro_uf_ano.csv`): o agregado "não-madeireiro" somava também as categorias de GRUPO da SIDRA (ex.: "1 - Alimentícios"), que são somatório dos subprodutos → dupla contagem. Corrigido em `eixo3_pevs.py` (agregação agora usa apenas categorias folha "N.M - ..."), CSV e workbook regenerados; adicionado check interno automático (soma das folhas = Total para todas as UF/ano). Afetava apenas as colunas "madeireiros/não-madeireiros 2024" da aba 3.1.1_Pevs_serie — os totais e o detalhe por produto SEMPRE estiveram corretos.
2. **BUG REAL corrigido — aba 3.1.1_Pevs_produtos_2024**: exibia categorias de grupo como se fossem produtos e calculava a participação % sobre denominador inflado. Agora exibe só subprodutos, com share recalculado (soma = Total da SIDRA).
3. **Documentação acrescentada**: em nível de divisão, a PIA suprime valores por sigilo ('X') — a soma das divisões fica abaixo do Total; nota incluída na aba F3.5 do workbook. A série do workbook usa o Total (completo).
4. Bugs do próprio script de revisão (não dos dados): chaves UF em código numérico vs sigla na comparação RAIS; colunas trocadas na leitura do workbook; faixas de plausibilidade arbitrárias — substituídas pelos valores oficiais divulgados (match exato nos 3 casos).

### Reprodução (Eixo 3)

```bash
.venv/Scripts/python.exe scripts/eixo3_pevs.py            # SIDRA 289 → PEVS 2015-2024
.venv/Scripts/python.exe scripts/eixo3_pia.py             # SIDRA 1849+10457 → PIA 2015-2024
.venv/Scripts/python.exe scripts/eixo3_rais.py            # FTP MTE → RAIS 2023/2024 (baixa ~270 MB e extrai ~2,7 GB)
.venv/Scripts/python.exe scripts/montar_workbook_eixo3.py # entregaveis/Eixo3.xlsx
.venv/Scripts/python.exe scripts/revisar_eixo3.py         # revisão independente (18 verificações + re-agregação RAIS)
```

---

## 15. Incorporação dos Eixos 3-5 ao Observatório (31/08/2026)

**Problema:** os dados dos Eixos 3, 4 e 5 (coletados em sessões paralelas, seções 12-14) existiam apenas nos workbooks de `entregaveis/` e nos CSVs de `dados/` — o dashboard (Observatório Amazônia 2050) ainda cobria somente os Eixos 1 e 2 (33 indicadores), e o servidor só oferecia download dos workbooks 1 e 2. Esta seção documenta a incorporação de fato de todos os dados coletados ao painel.

### O que mudou

| Camada | Antes | Depois |
|---|---|---|
| `scripts/exportar_catalogo.py` | Gerava o catálogo só dos Eixos 1-2 (33 indicadores) | Gera os **5 eixos (59 indicadores)**, incluindo as fichas F3.2 (RAIS) e F3.5 (PIA) |
| `dados/catalogo/indicadores.json` | 2 eixos, 10 indicadores com valores | 5 eixos, **18 com valores por UF** (E1 4, E2 6, E3 3, E4 3, E5 2) |
| `/api/dashboard` (server.mjs) | Só indicadores dos Eixos 1-2 | Novos campos por estado: `pevsBilhoes` (PEVS 2024), `piaBilhoes` (PIA 2024), `ibc` (ponderado 2025), `perRenovavel`, `isgr`, `pdPctPib` (2023) |
| Panorama do painel | 8 métricas no mapa/ranking | **14 métricas** — acrescentadas as 6 dos Eixos 3-5 |
| Perfil completo do estado | 8 indicadores na ficha | 14 indicadores (com ranking entre os 9 estados) |
| `/indicadores` | Filtros de 2 eixos; download de 2 workbooks | Filtros de 5 eixos; download dos **5 workbooks**; contagem e data de consolidação atualizadas (59 · 30/08/2026) |
| `index.html` | "33 indicadores" (og/twitter) | "59 indicadores" |

### Detalhes de implementação

1. **Parser numérico (`num()` em `exportar_catalogo.py`) reescrito**: os workbooks dos Eixos 3-5 armazenam números como TEXTO em formato brasileiro (`80.754` = 80.754 mil; `2,9` = 2,9%). O parser antigo (`replace(",","")` + float) truncava valores (`115.843` virava 115,843; `2,9` virava 29). Agora: vírgula decimal com pontos de milhar, múltiplos pontos → milhar, ponto único seguido de exatamente 3 dígitos (`^\d{1,3}\.\d{3}$`) → milhar, demais casos → float. Validado contra as tabelas do próprio relatório (PEVS, RAIS, PIA, IBC, PER, ISGR, P&D, CAPAG).
2. **I5.4.1**: valores de 2024 + série 2000-2024 (R$ mi) extraídos do primeiro bloco da aba `5.4.1_PnD_MCTI_IBGE`; o `% do PIB 2023` vem do segundo bloco (linhas após o cabeçalho interno `UF | 2019..2023`); AC fica sem 2023 (n/p na fonte) — `pctPib2023` null, coerente com o relatório.
3. **I5.5.1 (CAPAG)**: as notas são textuais (`A`, `B+`, `Suspensa` etc.) — o catálogo as carrega como strings em `valores` (nota 2025) e `serieAnual` (2018-2025); o `valueCell` de `indicadores.js` foi ajustado para exibir valores textuais e contar presença por UF.
4. **I4.1.1**: `valores` usa o IBC **ponderado pela população** (2025); a série anual 2021-2025 usa o IBC estadual simples (o ponderado só existe para 2024-2025 — `extra.ponderado2024`).
5. **Síntese comparativa (0-100) intencionalmente mantida nos 8 indicadores originais**: I5.4.1 não cobre os 9 estados em 2023 (AC sem dado) e os demais indicadores novos seriam acrescidos sem pactuação metodológica — decisão documentada como experimental no README e na `/metodologia`.

### Validação

- Somas por UF conferidas contra as tabelas das seções 12-14 (PEVS AL 2024 = 5.109.202; RAIS vínculos AL 2024 = 5.678.471; PIA AL 2024 = 215.364.980; IBC ponderado AL 2025 = 53,52; PER AL = 85,2%; ISGR AL = 47,17; CAPAG 2025 = 8/9 em A/B).
- `node server.mjs --validate` executa `buildDashboard()` sem erro com os 15 CSVs.
- `/api/catalogo` retorna 5 eixos / 59 indicadores; downloads dos 5 workbooks respondem.

### Reprodução

```bash
.venv/Scripts/python.exe scripts/exportar_catalogo.py     # 5 workbooks → dados/catalogo/indicadores.json
cd dashboard && node server.mjs --validate                # valida buildDashboard
```

### Persistência e deploy (31/08/2026)

Garantia de que todo indicador exibido vive como arquivo dentro do projeto (o servidor não consulta APIs externas em runtime nem grava nada ao rodar): `dados/catalogo/indicadores.json` (catálogo dos 59), 15 CSVs em `dados/` (fonte do `/api/dashboard`), shapefile, 9 bandeiras SVG, 5 workbooks e o relatório. Auditados 45/45 ativos (~22 MB sem venv/node_modules). Adicionados: `dashboard/snapshot.mjs` (`npm run snapshot`) — grava `dados/catalogo/dashboard_snapshot.json` com o payload exato servido pelo `/api/dashboard` (registro persistido dos valores publicados); `buildDashboard` exportado e o listener do servidor protegido por guarda de invocação direta (importar `server.mjs` não abre mais porta); seção "Persistência e deploy" no README do dashboard (unidade de publicação = projeto inteiro; `npm install && npm start`; Python desnecessário no servidor).
