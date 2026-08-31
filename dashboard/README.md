# Observatório Amazônia 2050

Dashboard em Node.js e JavaScript nativo para os nove estados da Amazônia Legal. A interface não utiliza framework de frontend nem biblioteca de mapas: o servidor lê os arquivos da pesquisa, entrega os indicadores e converte o shapefile em GeoJSON para a visualização interativa.

> **Escopo deste repositório.** Aqui está apenas o site: `dashboard/`, com os dados já
> congelados em `public/data/`. As pastas de trabalho que alimentam o gerador (`dados/`,
> `entregaveis/`, `scripts/`, o shapefile `BR_UF_2025 (2)/`, as bandeiras e a identidade
> visual) ficam fora do versionamento — veja o `.gitignore` na raiz. Sem elas, `npm start`
> e `npm run build:static` não rodam; o site publicado, sim, porque não depende de
> nenhuma delas em tempo de execução.

## Como executar

No diretório `dashboard`:

```powershell
npm install
npm start
```

Abra `http://localhost:4173`.

## O que está no painel

- Mapa e lista exploráveis por indicador (não uma síntese fixa), com as nove geometrias do shapefile fornecido.
- Rota `/metas` com o quadro de cumprimento: para cada meta da Estratégia com patamar mensurável, se o estado já cumpre e quanto falta. O foco é o cumprimento, não a comparação entre estados. A parametrização das metas vive em `metas.mjs`, que declara também os indicadores deixados de fora e o motivo (a página os lista).
- Rota `/indicadores` com busca, filtros por eixo, estado e disponibilidade, paginação, exportação CSV e download dos cinco workbooks XLSX (Eixos 1 a 5).
- Rota `/metodologia` com a fórmula de normalização, pesos, política para dados ausentes, fontes e limites de interpretação.
- Ficha estadual lateral orientada pela identidade visual, com dados territoriais, indicador ativo, dimensões e leitura contextual; o card lateral tem três subabas — Estado selecionado, Comparação estadual e **Perfil completo** (radar comparando o estado à média da Amazônia Legal e 14 indicadores com ranking, incluindo os do Eixo 3 (PEVS, PIA), Eixo 4 (IBC-AMZ, PER, ISGR) e Eixo 5 (P&D)).
- Catálogo completo dos 59 indicadores da matriz de resultados da Estratégia Amazônia 2050 — Eixo 1 (Território, Ambiente e Clima), Eixo 2 (Pessoas e Bem-estar), Eixo 3 (Desenvolvimento econômico sustentável, incluindo as fichas F3.2 e F3.5), Eixo 4 (Infraestrutura e integração regional sustentável) e Eixo 5 (Governança e parcerias) — agrupados por linha de ação: meta 2050, status de coleta, valores por estado e série histórica quando existem, ou nota de fonte/prazo quando o dado ainda não foi coletado.
- Seis novos indicadores dos Eixos 3 a 5 disponíveis no mapa e no ranking do panorama: IBC-AMZ ponderado (ANATEL), renovabilidade da matriz elétrica (ANEEL/SIGA), saneamento e gestão de riscos (IBGE), produção da sociobioeconomia (PEVS), transformação industrial (PIA) e P&D estadual % do PIB (MCTI).
- Síntese comparativa (0–100) mantida como opção secundária no seletor do mapa, explicitamente marcada como experimental e limitada aos oito indicadores originais dos Eixos 1 e 2 com disponibilidade para todos os estados.
- Imagem de compartilhamento em `public/og.png`.

## Fontes e períodos

O servidor consolida os arquivos que já estão na pasta superior: PRODES/INPE (2020-2025), INPE Queimadas (2015-2024), CNUC/MMA (2026), IBGE/SIS (ano-base 2024), projeção populacional IBGE (2025), Sinesp/MJ (2020-2025), CNES/DATASUS (jul. 2026), AdaptaBrasil (linha de base 2025), IBGE PEVS e PIA-Empresa (2015-2024), RAIS/MTE (2023-2024), ANATEL IBC-AMZ (2021-2025), ANEEL SIGA (base ago. 2026), Censo 2022 + MUNIC 2024 (saneamento), MCTI P&D (2000-2024) e STN CAPAG (2018-2025).

O catálogo de indicadores (`dados/catalogo/indicadores.json`) é gerado a partir dos cinco workbooks `entregaveis/Indicadores_Resultado_Eixo1..5_Amazonia2050.xlsx` pelo script `scripts/exportar_catalogo.py` (requer `openpyxl`; reexecute-o sempre que os workbooks forem atualizados). A síntese comparativa normaliza apenas os oito indicadores com disponibilidade para todos os estados e não substitui o catálogo, análise temática ou metas pactuadas.

## Persistência e deploy

**Todos os dados exibidos pelo painel vivem como arquivos dentro do projeto** — o servidor não consulta nenhuma API externa em tempo de execução e não grava nada em disco ao rodar:

| Consumido por | Arquivo no projeto |
|---|---|
| `/api/catalogo` | `dados/catalogo/indicadores.json` (pré-gerado dos 5 workbooks) |
| `/api/dashboard` | 15 CSVs em `dados/` (PRODES, focos, CNUC, IIVCM, Sinesp, IBGE, CNES, PEVS, PIA, ANATEL, ANEEL, saneamento, P&D) |
| `/api/metas` | `metas.mjs` sobre o catálogo + o payload do `/api/dashboard` |
| `/api/geo` | `BR_UF_2025 (2)/BR_UF_2025.shp + .dbf` |
| `/flags/*` | 9 SVGs na pasta de bandeiras |
| `/downloads/*` | 5 workbooks de `entregaveis/` + `RELATORIO_DE_COLETA.md` |

**Deploy na Vercel** — o site é publicado como estático puro: `dashboard/public/` é a única pasta enviada, sem build e sem Node em execução na Vercel. Os arquivos pesados (`dados/`, o shapefile, `entregaveis/`) ficam fora do deploy: eles são consumidos **na sua máquina** pelo gerador `build-static.mjs`, que congela o resultado dentro de `public/`.

1. Gere os artefatos (sempre que os dados ou os workbooks mudarem):

   ```powershell
   cd dashboard
   npm install
   npm run build:static
   ```

   Isso escreve, dentro de `public/`: `data/dashboard.json`, `data/geo.json`, `data/catalogo.json`, `data/metas.json`, `flags/*.svg`, `downloads/*` (5 XLSX + `RELATORIO_DE_COLETA.md`) e grava a URL absoluta da imagem Open Graph nos HTMLs.

2. Versione o resultado no git — **`public/data/`, `public/flags/` e `public/downloads/` precisam estar commitados**, pois são a carga do deploy.

3. Na Vercel, crie o projeto apontando para este repositório e defina **Root Directory = `dashboard`**. O `vercel.json` já cuida do resto: sem build command, `outputDirectory: public`, `cleanUrls` (que resolve `/indicadores` e `/metodologia`), reescritas de `/api/dashboard|geo|catalogo|metas` para os JSONs em `/data/` e `Content-Disposition: attachment` em `/downloads/*`.

O domínio usado nas metatags Open Graph é `https://estrategia-amazonia-2050.vercel.app`. Para publicar em outro domínio, rode o gerador com a variável `SITE_URL`:

```powershell
$env:SITE_URL = "https://seu-dominio.com"; npm run build:static
```

**Desenvolvimento local** continua idêntico: `npm start` sobe o `server.mjs`, que serve `/api/*`, `/flags/*` e `/downloads/*` dinamicamente a partir das pastas originais. O gerador apenas importa as mesmas funções do servidor, então as duas rotas de execução leem exatamente os mesmos dados.

**Deploy em servidor Node** (alternativa, se preferir o servidor dinâmico em vez da Vercel): copie o projeto mantendo a estrutura — `dashboard/`, `dados/`, `entregaveis/`, `BR_UF_2025 (2)/`, a pasta `Bandeiras - Amazônia Legal-…/` e `RELATORIO_DE_COLETA.md` (dispensa `.venv/` e `fontes_originais/`) — e rode `cd dashboard && npm install && npm start` (porta via `PORT`; padrão 4173). Python não é necessário no servidor.

**Snapshot de auditoria** — `npm run snapshot` grava `dados/catalogo/dashboard_snapshot.json` com o payload exato que o `/api/dashboard` serve no momento da geração (com `generatedAt`). Serve como registro persistido dos valores publicados e para conferência pós-deploy. Fluxo de atualização de dados:

```bash
# na máquina de trabalho (com o venv do projeto):
.venv/Scripts/python.exe scripts/exportar_catalogo.py   # workbooks → catálogo
cd dashboard && npm run snapshot                        # payload do dashboard → snapshot
# depois: copiar os arquivos alterados para o servidor
```

## Metas: o que entra no quadro

`metas.mjs` é a única fonte da parametrização. Uma meta só entra no quadro quando o patamar pode ser confrontado com os valores já coletados, na mesma unidade. Cada parâmetro declara seu `tipo`:

- `declarada` — o número está escrito na meta do catálogo (ex.: CVLI ≤ 10 por 100 mil; ISGR 80).
- `inferida` — a meta é qualitativa ou regional e foi operacionalizada aqui; a página mostra a nota explicando a escolha (ex.: “universalizar o atendimento escolar” lido como 100%).
- `derivada` — o alvo é calculado por estado a partir da própria série (ex.: redução de 30% sobre a média histórica de focos de calor).

Os valores vêm sempre do catálogo, para que meta e valor não possam divergir. A única exceção é `I5.4.1`: os valores do catálogo estão em R$ milhões, então o percentual do PIB vem do campo já consolidado pelo `/api/dashboard`. O objeto `EXCLUSOES` registra, com justificativa, os indicadores que têm dados mas cuja meta não é confrontável; os demais aparecem como “sem dados coletados”. As duas listas são renderizadas na própria página — a cobertura é parte do resultado, não uma omissão.
