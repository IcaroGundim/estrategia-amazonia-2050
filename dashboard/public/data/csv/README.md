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
| `focos_calor_uf_ano.csv` | 3 KB | Focos de calor por UF e ano |
