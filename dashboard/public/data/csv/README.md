# Dados de detalhe

Recortes que não cabem nos JSONs por UF de `public/data/`: município, divisão CNAE,
produto, competência mensal. Gerados pelos pipelines em `scripts/` e copiados para cá
por `scripts/versionar_dados.py`, porque a pasta `dados/` fica fora do versionamento.

| Arquivo | Tamanho | Conteúdo |
|---|---|---|
| `ideb_municipio_ano.csv` | 1116 KB | IDEB por município, etapa e ano (2005-2025) |
| `ideb_uf_ano.csv` | 9 KB | IDEB por UF, com meta e cumprimento |
| `rais_estab_uf_divisao_ano.csv` | 100 KB | RAIS por UF e divisão CNAE |
| `pia_divisoes_uf_ano.csv` | 57 KB | PIA por UF e divisão CNAE |
| `pevs_por_produto_uf.csv` | 63 KB | PEVS por produto extrativo |
| `pevs_madeireiro_uf_ano.csv` | 7 KB | PEVS madeireiro x não-madeireiro |
| `aps_uf_mes.csv` | 103 KB | Atenção primária, competência mensal |
| `aps_municipio_ultima.csv` | 42 KB | Atenção primária por município |
| `freq_escolar_15a17_municipio_2022.csv` | 25 KB | Frequência escolar 15-17 por município |
| `censos_saneamento_municipio.csv` | 76 KB | Saneamento por município nos três censos |
| `diagnostico_siga_reconstrucao.csv` | 5 KB | Medição do erro da reconstrução do SIGA |
| `obitos_evitaveis_uf_ano.csv` | 4 KB | Óbitos evitáveis em menores de 5 anos |
| `telessaude_uf_ano.csv` | 2 KB | Telessaúde por UF e ano |
| `obitos_evitaveis_5a74_uf_ano.csv` | 2 KB | Óbitos evitáveis de 5 a 74 anos (SIM, 2012-2024), recorte da ficha do I2.2.1 |
| `ubs_fluviais_uf_ano.csv` | 1 KB | Unidades móveis fluviais do CNES (2021-2025), primeiro indicador da ficha do I2.2.3 |
| `pia_receita_liquida_uf_ano.csv` | 3 KB | Receita líquida de vendas da indústria de transformação (PIA, 2007-2024, mil R$) |
| `focos_calor_uf_ano.csv` | 3 KB | Focos de calor por UF e ano |
| `cal_instrumentos.csv` | 27 KB | Instrumentos do Consórcio da Amazônia Legal (contratos de rateio, acordos, patrocínios, termos), 2019-2026, com valor, sentido do recurso e URL |
| `transparencia_estados.csv` | 10 KB | Transparência dos governos estaduais: EBT 360 (CGU, 2018 e 2020), PNTP (Atricon, 2022-2025) e ITGP (Transparência Internacional, 2022 e 2025), com a URL de cada edição |
| `cal_orcamento_execucao.csv` | 2 KB | Orçamento e execução do Consórcio da Amazônia Legal por ano (OAC, dotação, empenhado, liquidado, pago, receita), 2019-2026, regional |
| `financiamento_climatico_estados.csv` | 38 KB | Parcelas de financiamento climático recebidas pelos governos estaduais: desembolsos do Fundo Amazônia a projetos estaduais (2011-2026) e liberações do REM Acre (2012-2025), com a fonte de cada uma |
| `leis_clima_estados.csv` | 2 KB | Contexto do I5.3.1: lei de política de clima de cada estado, com o tipo de fonte (oficial ou secundária). Não é valor do indicador, que pede a incorporação de diretrizes regionais ainda inexistentes |

`obitos_evitaveis_5a74_uf_ano.csv`, `ubs_fluviais_uf_ano.csv` e `pia_receita_liquida_uf_ano.csv` vêm de `scripts/estrategia_brutos_set2026.py`, a partir dos dados brutos do pacote "Dados da Estratégia 2050" (set/2026).

`cal_instrumentos.csv` e `cal_orcamento_execucao.csv` vêm de `scripts/eixo5_cal.py`, que lê as páginas de item do site do CAL pelos sitemaps, os relatórios de gestão e a API de despesas do CAL; `transparencia_estados.csv`, de `scripts/eixo5_transparencia.py`; `financiamento_climatico_estados.csv`, de `scripts/eixo5_financiamento_climatico.py`. `leis_clima_estados.csv` é levantamento documental (set/2026), editado à mão; as ementas de MA, MT, RO e TO foram conferidas no LegisWeb.
