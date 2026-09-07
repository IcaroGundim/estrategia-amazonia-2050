# Observatório Amazônia 2050

Dashboard dos nove estados da Amazônia Legal, construído em [Astro](https://astro.build) com JavaScript nativo no cliente. Não há biblioteca de mapas nem framework de UI no navegador: o Astro gera HTML estático no build e as páginas leem JSONs pré-gerados. O mapa é SVG desenhado a partir do shapefile convertido em GeoJSON.

> **Escopo deste repositório.** Aqui está apenas o site: `dashboard/`, com os dados já
> congelados em `public/data/`. As pastas de trabalho que alimentam o gerador (`dados/`,
> `entregaveis/`, `scripts/`, o shapefile `BR_UF_2025 (2)/`, as bandeiras e a identidade
> visual) ficam fora do versionamento — veja o `.gitignore` na raiz. Sem elas, `npm start`
> e `npm run build:static` não rodam; o site publicado, sim, porque não depende de
> nenhuma delas em tempo de execução.

## Estrutura

```
src/
  layouts/Base.astro     head, topbar, navegação, rodapé — um único lugar
  pages/*.astro          uma página por rota; só o conteúdo do <main>
  scripts/*.js           JS de cliente, um módulo por página
  scripts/shared.js      escape, number, flagImage, readResponse, bindMenu
  styles/global.css      folha única, importada pelo layout
public/                  copiado literalmente para dist/ (data, flags, downloads, og)
build-static.mjs         gera public/data/* a partir das fontes locais
server.mjs               pipeline de dados (CSVs, shapefile, catálogo)
metas.mjs                parametrização e avaliação das metas
```

As páginas **não** leem dados no frontmatter do Astro: todo carregamento é no cliente, via `fetch('/data/*.json')`. Isso é deliberado — as fontes (`dados/`, shapefile, `entregaveis/`) não estão neste repositório, então qualquer leitura em tempo de build quebraria o deploy na Vercel enquanto passaria na máquina local.

## Como executar

No diretório `dashboard`:

```powershell
npm install
npm run dev
```

Abra `http://localhost:4321`. Para conferir a saída real do build, use `npm run build && npm run preview`.

### Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento do Astro (é o que a Vercel **não** roda). |
| `npm run build` | `astro build` → gera `dist/`. É o comando que a Vercel executa. |
| `npm run preview` | Serve `dist/` para conferir o resultado do build. |
| `npm run build:static` | Regenera os dados em `public/data/` a partir das fontes locais. |
| `npm run snapshot` | Grava o snapshot de auditoria do payload do painel. |
| `npm run prepare-data` | Valida a leitura das bases sem gerar nada. |

## O que está no painel

- Mapa e lista exploráveis por indicador (não uma síntese fixa), com as nove geometrias do shapefile fornecido.
- Rota `/metas` com o quadro de cumprimento: para cada meta da Estratégia com patamar mensurável, se o estado já cumpre e quanto falta. O foco é o cumprimento, não a comparação entre estados. A parametrização das metas vive em `metas.mjs`, que declara também os indicadores deixados de fora e o motivo (a página os lista).
- Rota `/indicadores` com busca, filtros por eixo, estado e disponibilidade, paginação, exportação CSV, download dos cinco workbooks XLSX (Eixos 1 a 5) e visualização das fichas técnicas dentro do próprio card da lista, com retorno ao estado anterior.
- Rota `/metodologia` com a fórmula de normalização, pesos, política para dados ausentes, fontes e limites de interpretação.
- Ficha estadual lateral orientada pela identidade visual, com dados territoriais, indicador ativo, dimensões e leitura contextual; o card lateral tem três subabas — Estado selecionado, Comparação estadual e **Perfil completo** (radar comparando o estado à média da Amazônia Legal e 14 indicadores com ranking, incluindo os do Eixo 3 (PEVS, PIA), Eixo 4 (IBC-AMZ, PER, ISGR) e Eixo 5 (P&D)).
- Catálogo completo dos 59 indicadores da matriz de resultados da Estratégia Amazônia 2050 — Eixo 1 (Território, Ambiente e Clima), Eixo 2 (Pessoas e Bem-estar), Eixo 3 (Desenvolvimento econômico sustentável, incluindo as fichas F3.2 e F3.5), Eixo 4 (Infraestrutura e integração regional sustentável) e Eixo 5 (Governança e parcerias) — agrupados por linha de ação: meta 2050, status de coleta, valores por estado e série histórica quando existem, ou nota de fonte/prazo quando o dado ainda não foi coletado.
- Seis novos indicadores dos Eixos 3 a 5 disponíveis no mapa e no ranking do panorama: IBC-AMZ ponderado (ANATEL), renovabilidade da matriz elétrica (ANEEL/SIGA), saneamento e gestão de riscos (IBGE), produção da sociobioeconomia (PEVS), transformação industrial (PIA) e P&D estadual % do PIB (MCTI).
- Síntese comparativa (0–100) mantida como opção secundária no seletor do mapa, explicitamente marcada como experimental e limitada aos oito indicadores originais dos Eixos 1 e 2 com disponibilidade para todos os estados.
- Imagem de compartilhamento em `public/og.png`.

## Fontes e períodos

O servidor consolida os arquivos que já estão na pasta superior: PRODES/INPE (2020-2025), INPE Queimadas (2015-2024), CNUC/MMA (2026), IBGE/PNADc via SIDRA (pobreza, série 2012-2024; frequência escolar 15-17, série 2016-2025 sem 2020 e 2021), projeção populacional IBGE (2025), Sinesp/MJ (2020-2025), MS/e-Gestor (cobertura da APS, série 2007-2026), AdaptaBrasil (linha de base 2025), IBGE PEVS e PIA-Empresa (2015-2024), RAIS/MTE (2023-2024), ANATEL IBC-AMZ (2021-2025), ANEEL SIGA (base ago. 2026), Censo 2022 + MUNIC 2024 (saneamento), MCTI P&D (2000-2024) e STN CAPAG (2018-2025).

A série de pobreza do painel (`dados/ibge_ods/pobreza_uf_ano.csv`, 2012-2024) vem da tabela SIDRA 10660 — indicador ODS P1.1.1, linha de pobreza regional — pelo script `scripts/pobreza_ods_sidra.py`. Os valores coincidem com a coluna `pct_pobreza_usd365` do SIS que o painel publicava antes (US$ 3,65 por dia, PPC 2017) dentro de 1,1 p.p. no ano de referência, o que indica a mesma linha; os metadados da tabela não publicam a definição, então o painel não afirma o valor da linha. O catálogo e a página de metas continuam com os valores do SIS, que vêm dos workbooks — a divergência entre as duas páginas é dessa ordem.

O agregado regional impresso pelo script pondera pela população de cada ano; o painel pondera pela população de 2025, a única que carrega, como já fazia com o CVLI. Os dois números não são idênticos nos anos antigos, e a nota da série no painel registra isso.

A série de frequência escolar de 15 a 17 anos (`public/data/frequencia-escolar-15a17.json`, 2016-2025) vem da tabela SIDRA 7138 — PNAD Contínua anual, módulo Educação — pelo script `scripts/eixo2_frequencia_escolar.py`, que também grava os CSVs de trabalho em `dados/ibge_educacao/`. É o mesmo conceito da taxa bruta de frequência escolar da Tabela 4.1 do SIS, e os nove estados bateram exatamente com o valor de 2024 já publicado no catálogo. **A série tem oito pontos, não dez:** o módulo de Educação não foi a campo em 2020 e 2021 por causa da pandemia, e o IBGE não publica substituto — o FTP só tem as tabelas de Educação de 2016 a 2018 e a divulgação seguinte pula de 2019 para 2022. Os dois anos entram no JSON como `null` para que o gráfico desenhe a lacuna em vez de ligar 2019 a 2022. O agregado da Amazônia Legal é a razão entre os totais das tabelas 7136 (estudantes) e 7109 (população) na mesma faixa, e não a média das nove taxas. O arquivo traz ainda o Censo 2022 por município (tabela 10139, 808 municípios — Recursolândia/TO em 49,1% contra 95,7% no topo, dispersão que a média estadual esconde) e o trecho 2007-2009 da PNAD antiga (tabela 1184), de metodologia diferente e que não deve ser emendado na mesma linha.

A série de atenção primária (`public/data/atencao-primaria.json`, 2007-2026) vem da API pública dos Relatórios da APS do Ministério da Saúde (`https://relatorioaps-prd.saude.gov.br`, para onde o antigo e-Gestor redireciona), pelo script `scripts/eixo2_atencao_primaria.py`, com CSVs de trabalho em `dados/ms_aps/`. São dois endpoints e **duas metodologias que não formam uma série**: `/cobertura/ab` cobre 07/2007 a 12/2020 e divide equipes parametrizadas pela população, travando em 100%; `/cobertura/aps` começa em 01/2021 com a regra do Previne Brasil, que parte da capacidade de atendimento e por isso passa de 100% (Tocantins em 140,2% e Maranhão em 136,4% na competência mais recente). O salto de 2020 para 2021 no Brasil, de 76,1% para 87,9%, é quebra de definição e não ganho de cobertura. O JSON traz por isso três séries separadas: `esfPor100mil` (equipes de Saúde da Família, única definição contínua nos vinte anos), `equipesPor100mil` (eSF + eAP, o que o painel exibe, só a partir de 2021 porque a eAP foi criada pela Portaria 2.979/2019) e `coberturaPct` (o indicador oficial do I2.2.2, com a quebra marcada em `metodologiaPorAno`). O recorte anual é a competência de dezembro — equipe é estoque, então a leitura certa é uma fotografia, não soma nem média de meses —, e 2026 entra como parcial porque a última competência publicada é 06/2026.

Os números do e-Gestor são sempre menores que os do CSV do CNES que o painel usa hoje, de −1,2% no Maranhão a −14,5% no Amazonas: o CNES conta equipe cadastrada e o e-Gestor conta equipe credenciada e homologada para pagamento. Trocar a fonte mantém os cinco primeiros colocados, mas reordena a base — Rondônia sobe de 8º para 6º e o Amazonas cai de 7º para 9º.

A série de **P&D estadual (I5.4.1) passou de 5 para 22 anos** sem trocar de fonte. O gargalo não era o dado: o `scripts/eixo5_pd.py` pedia `p/last 5` ao SIDRA, então o `pct_pib` só existia para cinco anos embora o dispêndio do MCTI (tabela 1.2.2.5) venha desde 2000. A t5938 cobre 2002-2023 no nível de UF, e a série agora vai de ponta a ponta desse intervalo. Os valores dos anos que já existiam não mudaram — Amazonas 2023 em 0,1329% e Acre 2022 em 0,0558% continuam iguais —, e as lacunas do Acre em 2021 e 2023 são do próprio MCTI, não da mudança.

A série começa em 2002, e não em 2000, porque é aí que começa o PIB por UF da referência 2010; termina em 2023 porque o PIB de 2024 ainda não saiu, embora o dispêndio de 2024 já exista. Dava para alcançar 2000 e 2001 pela tabela SIDRA 21 (referência 2002, 1999-2012), mas nos dez anos de sobreposição as duas referências divergem 4,3% em média e até 17,7% no Pará de 2012 — poria uma quebra de referência bem no início da linha, então ficou de fora e a medição está registrada em `limites.extensaoDescartada` no JSON.

O `server.mjs` não precisou de mudança: ele já monta `series.pdPctPib` a partir da coluna `pct_pib` do CSV, então a extensão entra sozinha no próximo `build:static`. O `pdPctPib` também não entra na síntese comparativa, e seu valor plano segue a regra do ano mais recente com dado em cada UF — por isso a extensão não mexeu em score nem em ranking. Como os CSVs do MCTI só existem na máquina de trabalho, o script cai para o `catalogo.json` quando eles faltam: é a mesma série 2000-2024 do mesmo workbook, e a conferência bateu em todos os anos que já estavam no painel.

Para a **renovabilidade da matriz elétrica (I4.3.2) não existe série histórica publicada por UF**, e o script `scripts/eixo4_matriz_eletrica.py` documenta a busca para ninguém refazer o caminho. Nenhuma fonte oficial cruza unidade da federação com fonte de geração ao longo do tempo: na ANEEL, `capacidade-instalada-por-unidade-da-federacao` é UF × ano sem fonte e `empreendimentos-em-operacao` é fonte × ano sem UF; o ONS declara que `capacidade-geracao` não tem histórico e cobre só usina despachada, deixando de fora os sistemas isolados, que é onde está o diesel; no Anuário da EPE a Tabela 2.1 é UF × ano sem fonte, a 2.3 é fonte × ano sem UF e a 2.8 traz a renovabilidade apenas nacional.

Reconstruir a série pelo `DatEntradaOperacao` do SIGA não funciona, e o script mede o erro em vez de afirmá-lo. São dois defeitos de sinais opostos, que não se cancelam: **sobrevivência** — o SIGA só tem as fases "Operação", "Construção" e "Construção não iniciada", nunca "Desativada", então as térmicas a diesel aposentadas somem do passado e a série sai renovável demais (Amazonas 2010: 978 MW reconstruídos contra 2.140 MW reais) — e **datação**, porque usina escalonada entra numa linha só (Belo Monte é um registro de 11.233 MW datado 2016-04-20, e o Pará de 2016 sai 70% acima do real). O erro só converge no fim da série, 1,8% em 2024-2025. O `diagnostico_siga_reconstrucao.csv` guarda a medição por UF e ano.

O que o script grava é o que é medido de verdade: capacidade instalada total por UF (Anuário da EPE, Tabela 2.1, 2004-2025 — total, sem quebra por fonte), o índice de renovabilidade nacional (Tabela 2.8, do Balanço Energético Nacional, o conceito exato do indicador mas só para o Brasil) e a fotografia atual por UF e fonte do SIGA. Uma ressalva sobre o total por UF: as duas séries oficiais discordam em **75 dos 170 pontos comparáveis**, e a da ANEEL tem erro grosseiro em Roraima 2014, com 4.746 MW entre 122,6 MW em junho e 124,4 MW em março seguinte, contra 119,2 MW da EPE no mesmo ano. Por isso a série publicada é a da EPE, e as divergências ficam listadas em `conferenciaAneel` no JSON.

O painel segue exibindo a fotografia do SIGA, sem seletor de ano, porque não há série para ligar.

Como o `build:static` não roda em quem só fez `git pull` — `dados/`, `entregaveis/`, o shapefile e as bandeiras estão no `.gitignore` e não vêm no clone —, o script `dashboard/scripts/aplicar-series.mjs` injeta as séries no `public/data/dashboard.json` já versionado lendo apenas arquivos do repositório: elas saem do `frequencia-escolar-15a17.json` e do `atencao-primaria.json`, e os demais indicadores saem do próprio `dashboard.json`. Ele cobre os dois indicadores de uma vez e recalcula a síntese comparativa uma única vez no fim — aplicar um de cada vez daria score intermediário errado. Repete o cálculo do server.mjs (mesmo `minMaxScore`, mesmos pesos), é idempotente e produz o mesmo resultado que o `build:static` produzirá na máquina de trabalho, então não precisa ser desfeito antes de reassar.

O painel lê a série do CSV por UF (`dados/ibge_educacao/freq_escolar_15a17_uf_ano.csv`) e o ano de referência segue 2024, não 2025: é o ano que a tela já mostrava a partir do SIS, e os nove estados batem na casa decimal, então a troca da fonte não mexe em score, ranking nem ordem dos estados — só acrescenta o histórico ao seletor. A SIDRA publica com uma casa decimal e o xls do SIS carregava a precisão cheia, então os valores por UF variam até 0,03 p.p. e a dimensão "pessoas" da síntese sobe 1 ponto no Amapá (47 para 48) e no Maranhão (26 para 27); nada mais se move. O catálogo e a página de metas continuam com o valor do SIS, que vem dos workbooks (`montar_workbook_eixo2.py` ainda lê `dados/ibge_sis/sis_freq_escolar_uf.csv`); aqui, ao contrário da pobreza, as duas páginas não divergem. O JSON consolidado está fora da lista `DATA_GERADOS` do `build-static.mjs`, então `npm run build:static` não o apaga.

O catálogo de indicadores (`dados/catalogo/indicadores.json`) é gerado a partir dos cinco workbooks `entregaveis/Indicadores_Resultado_Eixo1..5_Amazonia2050.xlsx` pelo script `scripts/exportar_catalogo.py` (requer `openpyxl`; reexecute-o sempre que os workbooks forem atualizados). A síntese comparativa normaliza apenas os oito indicadores com disponibilidade para todos os estados e não substitui o catálogo, análise temática ou metas pactuadas.

Os detalhes das fichas técnicas publicados em `public/data/fichas.json` são extraídos do arquivo `Fichas Técnicas Indicadores - Amazonia2050.docx` pelo script `dashboard/scripts/extract-fichas.ps1`. O documento contém 52 fichas; os sete indicadores que existem apenas no catálogo são identificados como “ficha técnica não localizada” no painel, sem preenchimento inferido.

## Persistência e deploy

**Todos os dados exibidos pelo painel vivem como arquivos dentro do projeto** — o servidor não consulta nenhuma API externa em tempo de execução e não grava nada em disco ao rodar:

| Consumido por | Arquivo no projeto |
|---|---|
| `/api/catalogo` | `dados/catalogo/indicadores.json` (pré-gerado dos 5 workbooks) |
| `/api/dashboard` | 15 CSVs em `dados/` (PRODES, focos, CNUC, IIVCM, Sinesp, IBGE, PNADc/ODS, CNES, PEVS, PIA, ANATEL, ANEEL, saneamento, P&D) |
| `/api/metas` | `metas.mjs` sobre o catálogo + o payload do `/api/dashboard` |
| `/api/geo` | `BR_UF_2025 (2)/BR_UF_2025.shp + .dbf` |
| `/flags/*` | 9 SVGs na pasta de bandeiras |
| `/downloads/*` | 5 workbooks de `entregaveis/` + `RELATORIO_DE_COLETA.md` |

**Deploy na Vercel** — a Vercel roda `npm install && npm run build` (`astro build`) e publica `dist/`. Os arquivos pesados (`dados/`, o shapefile, `entregaveis/`) ficam fora do repositório: eles são consumidos **na sua máquina** pelo `build-static.mjs`, que congela o resultado em `public/`, e o Astro copia `public/` para `dist/` no build.

1. Gere os artefatos (sempre que os dados ou os workbooks mudarem):

   ```powershell
   cd dashboard
   npm install
   npm run build:static
   ```

   Isso escreve, dentro de `public/`: `data/dashboard.json`, `data/geo.json`, `data/catalogo.json`, `data/metas.json`, `flags/*.svg` e `downloads/*` (5 XLSX + `RELATORIO_DE_COLETA.md`).

2. Versione o resultado no git — **`public/data/`, `public/flags/` e `public/downloads/` precisam estar commitados**, pois são a carga do deploy.

3. Na Vercel, crie o projeto apontando para este repositório. **Não é preciso ajustar o Root Directory**: o `vercel.json` da raiz do repositório instala e constrói dentro de `dashboard/` e publica `dashboard/dist`. Se você preferir definir **Root Directory = `dashboard`**, também funciona — nesse caso vale o `dashboard/vercel.json` e o da raiz é ignorado. O preset Astro é detectado sozinho; o `vercel.json` define `outputDirectory: dist`, `cleanUrls`, `Content-Disposition: attachment` em `/downloads/*` e mantém as reescritas de `/api/dashboard|geo|catalogo|metas` para os JSONs em `/data/` — hoje as páginas já buscam `/data/*.json` direto, as reescritas ficam só para não quebrar links antigos.

O domínio das metatags Open Graph vem de `site` em `astro.config.mjs`. Para publicar em outro domínio, altere esse valor — o layout monta a URL absoluta a partir dele.

> **Nota:** `node server.mjs` ainda sobe o servidor HTTP antigo, mas ele não serve mais as páginas (não há HTML em `public/`). Use `npm run dev`. O `server.mjs` permanece como pipeline de dados, importado por `build-static.mjs` e `snapshot.mjs`.

**Deploy em servidor Node** (alternativa, se preferir o servidor dinâmico em vez da Vercel): copie o projeto mantendo a estrutura — `dashboard/`, `dados/`, `entregaveis/`, `BR_UF_2025 (2)/`, a pasta `Bandeiras - Amazônia Legal-…/` e `RELATORIO_DE_COLETA.md` (dispensa `.venv/` e `fontes_originais/`) — e rode `cd dashboard && npm install && npm start` (porta via `PORT`; padrão 4173). Python não é necessário no servidor.

**Snapshot de auditoria** — `npm run snapshot` grava `dados/catalogo/dashboard_snapshot.json` com o payload exato que o `/api/dashboard` serve no momento da geração (com `generatedAt`). Serve como registro persistido dos valores publicados e para conferência pós-deploy. Fluxo de atualização de dados:

```bash
# na máquina de trabalho (com o venv do projeto):
.venv/Scripts/python.exe scripts/exportar_catalogo.py        # workbooks → catálogo
.venv/Scripts/python.exe scripts/eixo2_frequencia_escolar.py # SIDRA → frequência escolar 15-17
.venv/Scripts/python.exe scripts/eixo2_atencao_primaria.py   # e-Gestor → cobertura da APS
.venv/Scripts/python.exe scripts/eixo4_aneel_siga.py         # SIGA → PER do momento
.venv/Scripts/python.exe scripts/eixo4_matriz_eletrica.py    # EPE + ANEEL → capacidade e renovabilidade
.venv/Scripts/python.exe scripts/eixo5_pd.py                  # MCTI + SIDRA → P&D % do PIB (2002-2023)
cd dashboard && npm run snapshot                             # payload do dashboard → snapshot
# depois: copiar os arquivos alterados para o servidor
```

## Metas: o que entra no quadro

`metas.mjs` é a única fonte da parametrização. Uma meta só entra no quadro quando o patamar pode ser confrontado com os valores já coletados, na mesma unidade. Cada parâmetro declara seu `tipo`:

- `declarada` — o número está escrito na meta do catálogo (ex.: CVLI ≤ 10 por 100 mil; ISGR 80).
- `inferida` — a meta é qualitativa ou regional e foi operacionalizada aqui; a página mostra a nota explicando a escolha (ex.: “universalizar o atendimento escolar” lido como 100%).
- `derivada` — o alvo é calculado por estado a partir da própria série (ex.: redução de 30% sobre a média histórica de focos de calor).

Os valores vêm sempre do catálogo, para que meta e valor não possam divergir. A única exceção é `I5.4.1`: os valores do catálogo estão em R$ milhões, então o percentual do PIB vem do campo já consolidado pelo `/api/dashboard`. O objeto `EXCLUSOES` registra, com justificativa, os indicadores que têm dados mas cuja meta não é confrontável; os demais aparecem como “sem dados coletados”. As duas listas são renderizadas na própria página — a cobertura é parte do resultado, não uma omissão.
