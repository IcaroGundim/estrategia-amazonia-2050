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

## Celular e tablet

O painel tem quatro faixas de largura, e a do meio era a que faltava. Até aqui havia o
computador e o **fluxo corrido** de uma coluna (≤920px), com o mapa preso abaixo da topbar
enquanto o painel e o ranking rolam por baixo dele. O que ficava sem tratamento era o
**tablet em paisagem** (921–1180px), que recebia o desenho de computador espremido: o
título e os 484px de seletores não cabiam lado a lado e o texto de abertura escorria por
baixo do rótulo do seletor; a linha da lista de indicadores mantinha o piso de 820px, então
a coluna "Situação" ficava inteira fora da tela sem nenhum sinal de que existia; e
"5,1 mi km²" aparecia como "5,1 mi k…" na lateral. Agora a consulta de 1180px empilha o
cabeçalho, empilha o mapa e a ficha do indicador, transforma cada linha da lista em cartão
com as quatro células visíveis e deixa os valores da lateral quebrarem em duas linhas em
vez de sumirem por reticências.

O **tablet em retrato** (621–920px) herda o fluxo de uma coluna, que é o arranjo certo,
mas não o orçamento de tela do celular: numa caixa de ~715px, um mapa de 300px de altura
desenhava a projeção com 430px e deixava quase 300px de branco de cada lado. A altura do
mapa passou a ser uma variável (`--mapa-altura`), consumida também pelo topo do bloco
fixo, pelo topo da legenda e pela margem de rolagem do painel — antes o mesmo `clamp()`
estava escrito em dois lugares, com a observação de que precisavam andar juntos. A legenda
da escala de cores deixou de flutuar solta na areia e passou a ficar presa logo abaixo do
mapa, com a mesma moldura: as duas peças formam um cartão só e não se separam na rolagem.

A **Visão Geral** tem duas mecânicas para o mesmo HTML, e o `metodologia.js` troca entre
elas na virada da consulta de mídia. Do tablet para cima é o carrossel de cinco lâminas.
No celular (≤620px) as cinco seções viram um **documento contínuo**: a lâmina tem altura
fixa e o texto rolava dentro dela, mas essa barra de rolagem interna não é desenhada em
aparelho de toque, então a leitura terminava cortada no meio de uma frase sem nenhum sinal
de que havia mais. No documento a fotografia abre cada seção como faixa, o texto vem
inteiro e a barra de seções vira índice fixo no topo. No tablet a lâmina deixou de ter
altura fixa e passou a crescer com o texto — em 768px a primeira precisa de cerca de 870px
e a caixa tinha 804, o que cortava o fim da linha do tempo.

Na lista de indicadores, os filtros e os cinco downloads somam cerca de 600px e no celular
empurravam a lista para bem abaixo da dobra. Viraram um painel recolhível, fechado por
padrão, com o resumo do que está filtrado no próprio botão — a lista agora começa a 184px
do topo. Em `/metas`, tocar numa meta abria o detalhe como último bloco da página, abaixo
das doze linhas: agora a tela vai até ele, pela mesma regra que o painel do Panorama já
usava em `app.js`.

Os alvos de toque seguem a consulta `(pointer: coarse)`, e não a largura: um tablet em
paisagem tem 1024px e continua sendo operado com o dedo, enquanto uma janela estreita no
computador segue com o mouse. Onde crescer a caixa mudaria o desenho — texto sublinhado,
bandeira de estado —, quem cresce é a área sensível, num `::after` invisível. Nas bandeiras
a folga é só vertical: elas ficam lado a lado com 5px de vão, e ampliar na horizontal faria
a área de uma invadir a da vizinha.

**Conferência** — `node scripts/conferir-mobile.mjs` percorre seis larguras (320, 390, 768,
834, 1024 e 1180px) e nove cenas, incluindo as que só existem depois de um toque (estado
selecionado no mapa, aba de comparação, detalhe da meta, ficha do indicador, filtros
abertos). Ele acusa rolagem horizontal, elemento que transborda sem um pai que o recorte,
conteúdo cortado em caixa sem rolagem própria, alvo de toque baixo e erro de JavaScript, e
grava as capturas em `.shots/conferencia/`. O playwright não é dependência do projeto: vem
do cache do `npx`, e o caminho entra por `PLAYWRIGHT_PATH`.

Dois pontos de contraste ficam registrados sem correção, porque são escolhas de paleta e
não defeitos de arranjo: o cinza de texto secundário (`--tinta-4`) dá 3,86:1 sobre o papel,
abaixo dos 4,5:1 da WCAG AA para texto pequeno, e é usado no site inteiro; e o ocre sobre
o verde-mata-500 do primeiro segmento do fluxo de governança dá 2,75:1. O que era defeito
foi corrigido: a nota "Fórmula não informada na ficha técnica" usava o cinza de fundo claro
dentro do cartão de método, que é verde escuro, e dava 1,2:1 — existia no HTML e não se lia.

## Fontes e períodos

O servidor consolida os arquivos que já estão na pasta superior: PRODES/INPE (2020-2025), INPE Queimadas (2015-2024), CNUC/MMA (2026), IBGE/PNADc via SIDRA (pobreza, série 2012-2024; frequência escolar 15-17, série 2016-2025 sem 2020 e 2021), projeção populacional IBGE (2025), Sinesp/MJ (2020-2025), MS/e-Gestor (cobertura da APS, série 2007-2026), AdaptaBrasil (linha de base 2025), IBGE PEVS e PIA-Empresa (2015-2024), RAIS/MTE (2023-2024), ANATEL IBC-AMZ (2021-2025), ANEEL SIGA (base ago. 2026), Censo 2022 + MUNIC 2024 (saneamento), MCTI P&D (2000-2024) e STN CAPAG (2018-2025).

A série de pobreza do painel (`dados/ibge_ods/pobreza_uf_ano.csv`, 2012-2024) vem da tabela SIDRA 10660 — indicador ODS P1.1.1, linha de pobreza regional — pelo script `scripts/pobreza_ods_sidra.py`. Os valores coincidem com a coluna `pct_pobreza_usd365` do SIS que o painel publicava antes (US$ 3,65 por dia, PPC 2017) dentro de 1,1 p.p. no ano de referência, o que indica a mesma linha; os metadados da tabela não publicam a definição, então o painel não afirma o valor da linha. O catálogo e a página de metas continuam com os valores do SIS, que vêm dos workbooks — a divergência entre as duas páginas é dessa ordem.

O agregado regional impresso pelo script pondera pela população de cada ano; o painel pondera pela população de 2025, a única que carrega, como já fazia com o CVLI. Os dois números não são idênticos nos anos antigos, e a nota da série no painel registra isso.

### Indicadores pendentes: o que foi sondado e o que não existe

Dos 41 indicadores do catálogo sem valores coletados, **cerca de trinta têm "Estados" como fonte** — são status administrativos de política estadual (tem ZEE vigente, tem plano de adaptação aprovado, tem câmara técnica instalada, tem PRA regulamentado). Nenhuma base secundária fornece isso: dependem de coleta junto às secretarias, e nenhuma varredura de dados abertos resolve.

Dos que têm base secundária, ficou o registro do que foi sondado nesta rodada (07/09/2026), para não se repetir o caminho:

| Indicador | Fonte | Resultado da sondagem |
|---|---|---|
| I2.3.1 IDEB | INEP | **Resolvido.** A nota de bloqueio estava desatualizada; ver acima. |
| I5.5.2 Transparência (EBT 360) | CGU | Segue bloqueado, e não por falha do dia: `mbt.cgu.gov.br` redireciona para uma página de manutenção que diz "O Sistema Mapa Brasil Transparente está temporariamente fora do ar para atualizações. Previsão de retorno: novembro/2026". O `dadosabertos.cgu.gov.br` não resolve mais em DNS. |
| I2.4.2 e I4.4.2 (AdaptaBrasil) | MCTI | A API `sistema.adaptabrasil.mcti.gov.br` devolve 403 mesmo com Referer e Origin do próprio portal. Independente disso, o AdaptaBrasil publica índices por recorte de cenário (presente, 2030, 2050), não por ano histórico — não é série temporal. |
| I4.2.1 Transportes | CNT/DNIT | A nota do catálogo continua válida: o painel da CNT é Power BI sem API e o vgeo do DNIT só publica geometria, sem estado de conservação. |
| I1.5.7 e I1.5.8 (CAR) | SICAR | O `car.gov.br` exige TLS legado para conectar (`OP_LEGACY_SERVER_CONNECT` mais `SECLEVEL=1`); com isso a conexão abre, mas o que o SICAR publica é shapefile por estado e boletim em PDF, não série por UF com o recorte que as fichas pedem. |

O **F3.2 (empregos e estabelecimentos) foi de 2 para 7 anos**, 2018-2025, pelo `scripts/eixo3_rais.py`. Mesma fonte e mesmo critério: RAIS Estabelecimentos do MTE, estabelecimentos com `Ind Atividade Ano` = 1 e vínculos ativos em 31/12. Os dois anos que já estavam no painel batem exatamente, e 2025 é mais recente do que o painel tinha.

A série começa em 2018 porque é de lá em diante que o FTP publica um único `RAIS_ESTAB_PUB.7z` nacional; antes disso os microdados vêm partidos por UF (`AC2017.7z`), com outro formato. Três armadilhas de leitura ficaram resolvidas: o nome do arquivo dentro do 7z muda por ano (`.COMT` em 2023-2025, `.txt` em 2018-2021, `.txt.txt` em 2022), o separador muda junto (vírgula no `.COMT`, ponto-e-vírgula no `.txt`), e os `.COMT` descompactados passam de 1 GB cada, então o script apaga a extração a cada ano para não encher o disco.

**2022 fica fora da série, e isso é da fonte, não da leitura.** Naquela edição o campo `Ind Atividade Ano` vem praticamente todo com o código 9 em vez de 1: no Acre são 23.199 linhas com 9 contra 139 com 1, enquanto 2021 traz 11.127 com 1. Sem esse campo não há como saber quais estabelecimentos estavam ativos, e adotar outro critério só nesse ano quebraria a comparação. O script tem uma guarda que descarta o ano quando menos de 5% das linhas da região têm o indicador preenchido — limiar calibrado pelo dado, porque a proporção varia legitimamente de 74-77% nos anos em `.txt` a 20-24% nos anos em `.COMT`, e 2022 fica em 0,28%, duas ordens de grandeza abaixo de qualquer ano válido. Um limiar de 20%, que cheguei a usar, descartaria 2025 sem motivo.

O **I2.2.3 (telessaúde) ganhou 15 anos**, 2012-2026, pelo `scripts/eixo2_telessaude_cnes.py`. O catálogo trazia só jul/2026. A fonte é a mesma: CNES via TabNet, filtrando o tipo de estabelecimento 35, "TELESSAUDE". A conferência bateu exatamente — os nove estados e o total de 56 estabelecimentos em jul/2026 são idênticos aos do catálogo.

A consulta é **por município, não por UF**, porque a ficha define o indicador como "municípios com estabelecimento de telessaúde ativo / total de municípios da Amazônia Legal": é preciso contar municípios com ao menos um, e não estabelecimentos. A consulta por município dá os dois de uma vez — a soma das linhas é o total de estabelecimentos e a contagem de linhas com valor é o número de municípios cobertos. A diferença importa: os 56 estabelecimentos de 2026 estão em apenas **40 municípios**. O recorte anual é a competência de dezembro, ou a mais recente no ano corrente, porque estabelecimento é estoque.

A série começa em 2012 e não em 2005, onde começam as competências do CNES, simplesmente porque antes disso não havia estabelecimento desse tipo na região. E o retrato é duro: dos 808 municípios da Amazônia Legal, 16 tinham telessaúde em 2015 e 40 em 2026 — **menos de 5%**. Tocantins e Maranhão seguem em 1% e 2%.

O **I2.2.1 (mortalidade evitável) ganhou 31 anos**, 1996-2026, pelo `scripts/eixo2_mortalidade_evitavel.py`. O catálogo trazia só 2024; o TabNet publica a mesma tabulação desde 1996. A fonte e a definição não mudam: `sim/cnv/evita10uf.def`, cujo título é "Óbitos por causas evitáveis em menores de 5 anos" — a Lista Brasileira de Causas de Mortes Evitáveis no recorte de 0 a 4 anos, que é o que a coleta de 2024 já usava. O incremento é "óbitos por residência", que atribui o óbito ao estado onde a pessoa morava.

Duas notas técnicas sobre o acesso, que custaram tempo: o `tabnet.datasus.gov.br` **exige TLS legado** para conectar (`OP_LEGACY_SERVER_CONNECT` mais `SECLEVEL=1`), e o HTML que ele devolve **não fecha `<TR>` nem `<TD>`**, então a leitura da tabela é por corte no `<TD` e não por casamento de tags. O script descobre os anos lendo o próprio formulário, em vez de fixar a faixa.

**Grava só a contagem, de propósito.** A ficha define a taxa como óbitos sobre população, e o painel divide pela população de 0 a 4 anos da revisão de 2024 da projeção do IBGE — que não está publicada na SIDRA: a tabela 7358 traz a revisão de 2018 e dá 82.857 crianças no Acre em 2024, contra as 88.080 que o painel usa. Calcular a taxa com outra revisão poria uma quebra de denominador no meio da série, o mesmo motivo pelo qual a taxa de CVLI não foi injetada. A contagem é o dado bruto e não depende de denominador.

Duas ressalvas ficam registradas no JSON. O TabNet declara dados **finais até 2024**, preliminares em 2025 e primeira prévia em 2026 — o script lê essa nota do rodapé e deriva `anosPreliminares` dela, então a marcação se atualiza sozinha. E **a revisão mexe nos números**: o catálogo registrou 317 óbitos no Acre em 2024 e a extração de hoje dá 298, então rebaixar o mesmo ano pode mudar o resultado.

Uma observação de rótulo, não de dado: o catálogo declara `unidade: "taxa / 100 mil"` para o I2.2.1, mas a conta que ele publica é óbitos sobre população de 0 a 4 em milhares — ou seja, por mil crianças, não por 100 mil. Vale alinhar quando os workbooks forem atualizados.

O **IDEB (I2.3.1) saiu de pendente para série completa**, 2005-2025, pelo `scripts/eixo2_ideb_inep.py`. O catálogo registrava "INEP Data sem API aberta; download.inep.gov.br bloqueado", mas o host não está bloqueado: a página de resultados carrega os links por aba via AJAX, e o conteúdo real está em `.../ideb/resultados/2005-2025`, de onde saem os arquivos oficiais. São 11 edições bienais, nas três etapas (anos iniciais, finais e ensino médio), por UF e pelos 808 municípios da Amazônia Legal.

O arquivo grava **duas séries de extensões diferentes, de propósito**. O IDEB observado existe nas 11 edições. Já o indicador como a ficha o define — "% de municípios/estados que atingiram ou superaram a meta" — só é calculável de 2007 a 2021: o INEP projetou metas até 2021 e parou, e as edições de 2023 e 2025 saíram sem meta. Juntar as duas numa linha só faria a segunda parecer interrompida por falta de dado, quando o que acabou foi a meta.

Duas escolhas de rede, porque o INEP não usa a mesma nos dois níveis: na UF vale o "Total", que soma pública e privada e é onde a meta do ente é projetada; no arquivo municipal não existe "Total" — as redes são Estadual, Municipal, Federal e Pública —, então vale a **Pública**, que é a agregada e cobre 808 dos municípios com meta. O rótulo do INEP traz marcadores de nota (`Total (3)(4)`, `Pública (4)`), que o script normaliza.

O que os dados mostram é duro. O IDEB observado sobe em todos os nove estados nas três etapas — Amazonas nos anos iniciais vai de 3,1 em 2005 para 6,0 em 2025. Mas o **cumprimento da meta despencou**: nos anos iniciais, a parcela de municípios que bateram a meta caiu de 86-100% em 2007 para 0% no Amapá e em Roraima, 3% no Tocantins e 10% em Rondônia em 2021. As metas subiam mais rápido que o avanço real.

O IDEB entrou no painel como **três métricas novas** — anos iniciais, anos finais e ensino médio —, cada uma com a nota observada e a série completa de 2005 a 2025. Exibe-se a nota, e não o percentual que atingiu a meta, porque a meta acabou em 2021: o painel mostraria um indicador parado há duas edições e sem 2023 nem 2025. O cumprimento de meta continua em `public/data/ideb.json`, e a nota da série no painel explica a escolha. As três não entram na síntese comparativa, e o valor plano é o de 2025, então a inclusão foi puramente aditiva: 387 chaves novas no `dashboard.json`, nenhuma removida, nenhum score ou ranking existente alterado. O agregado regional pondera pela população do estado, quando o correto seria ponderar por matrículas da etapa — que o painel não carrega —, e a nota registra isso. O `catalogo.json` vem dos workbooks, então o status "pendente" do I2.3.1 só muda quando eles forem atualizados.

Para o **saneamento (I4.4.1) o ISGR não retroage**, e o `scripts/eixo4_saneamento_censos.py` registra por quê. O índice é `min(água adequada, esgoto adequado) × FClima × FGov`, e dois dos três insumos nascem em 2022. A água do ISGR é `72144 + 72145 + 72154` da classificação 1821, que cruza *existência de ligação à rede* com *forma principal de abastecimento* — duas perguntas que o Censo 2022 passou a fazer separadamente. Em 2000 e 2010 havia só a forma principal, que não identifica quem tem ligação mas usa outra fonte nem separa poço profundo de poço raso. Os fatores FClima e FGov vêm da MUNIC 2024, e edições anteriores têm outro questionário.

O que dá para levar aos três censos, e é o que o script grava, é a substância que o índice mede. **Esgoto adequado** (rede geral ou pluvial mais fossa séptica) usa a mesma classificação 11558 em 2000, 2010 e 2022 — o IBGE só partiu a fossa séptica em ligada e não ligada à rede em 2022, e somadas elas dão o mesmo conceito. **Água por rede geral como forma principal** é o recorte mais próximo que atravessa os três: em 2010 quem tinha ligação mas usava principalmente um poço respondia "poço", então o equivalente de 2022 é a categoria 72144 sozinha. A comparação é boa, não perfeita — a parcela ambígua (72145) vale de 2,7% a 9,7% conforme o estado, e isso está registrado na ressalva do JSON.

O tamanho do que não dá para reconstruir ficou medido: a água do ISGR fica até **33 p.p. acima** da definição comparável (Pará e Amapá), e a decomposição mostra que o grosso é poço profundo sem ligação à rede — 26% dos domicílios no Amapá e no Pará. Os dados vão em `public/data/saneamento-censos.json`, por UF e pelos 808 municípios, **marcados como não sendo o ISGR**: são séries da substância, não do índice. Ficou decidido que elas **não sobem para o painel** — a metodologia do I4.4.1 diz que o indicador é o ISGR, e exibir outra medida sob o mesmo rótulo trocaria o indicador mantendo o nome. O JSON carrega `usoNoPainel: "não"` para que a decisão não se perca.

O que elas mostram é substantivo. O esgoto adequado sobe em todos os nove estados entre 2000 e 2022 — Tocantins de 19,8% para 50,9%, Mato Grosso de 29,8% para 58,0% —, mas com uma queda generalizada em 2010 em Amazonas, Roraima, Pará e Amapá. Já a água por rede geral estagnou no Pará (42,6% para 48,9% em 22 anos) e **caiu no Amapá**, de 54,5% em 2010 para 43,4% em 2022 — queda que persiste mesmo somando a parcela ambígua, então não é artefato de questionário.

A base do **CVLI (I2.4.1) foi de 7 para 12 anos**, 2015-2026, pelo `scripts/agregar_cvli.py`. A definição não muda — segue a soma de homicídio doloso, roubo seguido de morte e lesão corporal seguida de morte, agregada pelo ano que consta no dado e não pelo nome do arquivo. O script deixou de depender de planilhas já baixadas à mão e passa a buscar os `bancovde-AAAA.xlsx` do MJ; o servidor bloqueia HEAD, então a existência de cada ano se descobre pelo próprio GET, e como ele corta a conexão no meio com frequência (`IncompleteRead`) há quatro tentativas por ano — sem isso o ano sumiria da série sem aviso. A contagem de 2025 confere com a do painel em todos os estados.

Uma ressalva da própria fonte: os números refletem o estágio de consolidação de cada UF no Sinesp VDE **na data da extração**, então rebaixar o mesmo ano pode devolver valores diferentes, e o ano corrente está sempre incompleto.

O painel exibe a taxa por 100 mil, não a contagem, e a taxa depende da população do ano. O `server.mjs` já monta essa série a partir do CSV, então os anos novos aparecem sozinhos no próximo `build:static` — desde que `dados/ibge_pop/populacao_uf_ano.csv` cubra 2015-2019. Por isso a série de taxa **não** foi injetada no `dashboard.json` versionado: a população que o painel usa é a revisão de 2024 da projeção do IBGE, que não está publicada na SIDRA (a tabela 7358 traz a revisão de 2018, que diverge em até 218 mil pessoas no Amazonas em 2026). Misturar revisões dentro de uma mesma série quebraria justamente a consistência metodológica que o resto deste trabalho preserva.

A série da **transformação industrial (F3.5) foi de 10 para 18 anos**, 2007-2024, pelo `scripts/eixo3_pia.py`. Começa em 2007 porque é onde a tabela SIDRA 1849 começa; a PIA tem série anterior, mas em CNAE 1.0 e com outro recorte de empresas, e emendá-la mudaria o que o indicador mede. A emenda de 2023 para 2024, que troca para a tabela 10457 porque o IBGE trocou de série, já existia antes desta extensão. Os dez anos que já estavam no painel batem com precisão cheia. Vale a mesma ressalva de preços correntes do PEVS, e o JSON traz a versão deflacionada ao lado — aqui, porém, o crescimento é real: o Pará sai de R$ 25,7 bi para R$ 70,1 bi em reais de 2024.

A série da **sociobioeconomia (I3.1.1) foi de 10 para 31 anos**, 1994-2024, pelo `scripts/eixo3_pevs.py`. Mesma tabela SIDRA 289, mesma variável 145, mesma categoria Total — só a janela mudou, e os dez anos que já estavam no painel batem com precisão cheia. A série começa em 1994 e não em 1986, onde a tabela começa, porque o valor da produção muda de moeda antes disso: Cruzados até 1988, Cruzados Novos em 1989, Cruzeiros até 1992, Cruzeiros Reais em 1993. Só de 1994 em diante a unidade é Mil Reais e os anos são comparáveis. O detalhe por produto continua em 2015-2024, porque serve só ao recorte do ano de referência; a verificação interna de que a soma dos subprodutos bate com o Total passou a rodar apenas nos anos em que esse detalhe existe. Falta apenas Roraima em 1995.

Há uma armadilha nessa série que vale conhecer. O painel exibe **preços correntes**, que é a metodologia da tabela e não muda aqui, mas em três décadas isso engana: o Pará sai de R$ 2,05 bi em 1995 para R$ 2,73 bi em 2024 e parece ter crescido, quando o IPCA subiu sete vezes no período. Em reais de 2024, o valor de 1995 equivale a R$ 11,7 bi — em termos reais a extração vegetal paraense caiu cerca de 77%, e a série corrente mostra o contrário. Por isso o JSON traz, ao lado da série do painel, uma versão deflacionada pelo IPCA (SIDRA 1737) para reais de 2024, marcada como derivada: ela não substitui o indicador, mostra o que a série corrente esconde. A nota da série no painel registra isso.

A série de **focos de calor (I1.3.4) foi de 1 ano para 22**, 2003-2024, pelo `scripts/baixar_focos.py`. O indicador já era pontuado e rankeado no `server.mjs`, mas não tinha série nem aparecia no seletor do painel — agora tem as duas coisas. A fonte não mudou: continua a pasta `EstadosBr_sat_ref` do INPE, do **satélite de referência**, que é a única série que o INPE considera comparável ao longo do tempo, porque o número de satélites que detectam foco mudou muito desde 2003. A contagem de "todos os satélites" é maior e está disponível, mas trocar de pasta mudaria o indicador. A conta do painel também é a mesma de antes: focos por mil km² de área do estado.

A conferência foi exata: nos nove estados e nos dez anos que o catálogo já publicava (2015-2024), zero divergência. Duas correções entraram junto. A primeira é do script, que agora descobre os anos listando o diretório de cada UF em vez de usar faixa fixa, então incorpora sozinho o ano novo quando o INPE publicar — 2025 ainda não está nesta pasta. A segunda é um defeito na fonte: `focos_br_ro_ref_2006.zip` traz 41.649 registros todos datados de 2005, e o arquivo de 2016 traz os de 2015. Contar linhas repetiria o ano anterior como se fosse medição própria, e é o que o catálogo publica hoje para Rondônia em 2016 (13.113, idêntico a 2015). O script passou a validar a coluna `data_pas` de cada arquivo e a descartar o ano quando o conteúdo é de outro; Rondônia fica sem 2006 e sem 2016, que é o que de fato se sabe sobre esses anos. As ausências ficam registradas em `anosAusentes` no JSON.

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

As fichas e o catálogo descrevem os mesmos indicadores a partir de origens independentes — o `.docx` e os workbooks —, então divergir entre eles é sinal de erro de digitação. O `scripts/auditar_fichas.py` cruza os dois e separa o que é troca de assunto do que é só redação diferente. Uma revisão das referências encontrou o seguinte.

**Corrigido:** o **I2.3.1 (IDEB)** trazia `Fontes: ANATEL` e apontava para o painel de conectividade da ANATEL — exatamente a fonte e o link do I4.1.1. O texto do indicador estava certo, só a fonte e a referência é que eram de outro indicador. Passou a apontar para a página de resultados do IDEB no INEP. Vale notar que a ficha era *internamente coerente* (fonte ANATEL, link da ANATEL): só o cruzamento com o catálogo, que diz "INEP (IDEB)", revelou a troca.

**Pendente de correção no `.docx`,** porque o `fichas.json` é derivado dele e não dá para inventar o texto certo: **I3.4.1** e **I3.4.2** (ambos de PSA) trazem o texto do indicador de financiamento climático — "Montante de recursos obtidos pelos nove estados com programas jurisdicionais de crédito de carbono", que é o I5.1.1. E o **I2.5.1** descreve "Participação da Bioeconomia no PIB" enquanto o catálogo fala em "Volume de renda no painel da sociobioeconomia"; pode ser divergência legítima de redação entre a ficha e o workbook, mas convém conferir.

**Conferido e correto:** as 35 referências respondem (três dão 403, 500 ou erro de TLS por hostilidade a robô, não por link errado), as seis tabelas SIDRA citadas batem com o assunto do indicador que as cita, e nenhum link aponta para órgão fora das fontes declaradas.

Como a correção do I2.3.1 foi aplicada no `fichas.json`, que é gerado, **ela se perde se o `.docx` for reextraído sem ser corrigido na origem**. Rodar `python scripts/auditar_fichas.py` depois de cada extração mostra se voltou; com `--falhar-se-houver` o script sai com código 1, para uso em verificação automática.

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
python scripts/baixar_focos.py                               # INPE → focos de calor (2003-2024)
python scripts/eixo3_pevs.py                                 # SIDRA 289 → PEVS (1994-2024)
python scripts/eixo3_pia.py                                  # SIDRA 1849+10457 → PIA (2007-2024)
python scripts/agregar_cvli.py                               # Sinesp/VDE → CVLI (2015-2026)
python scripts/eixo4_saneamento_censos.py                    # censos 2000/2010/2022 → saneamento
python scripts/eixo2_ideb_inep.py                            # INEP → IDEB (2005-2025)
python scripts/eixo2_mortalidade_evitavel.py                 # SIM/TabNet → óbitos evitáveis (1996-2026)
python scripts/eixo2_telessaude_cnes.py                      # CNES/TabNet → telessaúde (2012-2026)
python scripts/eixo3_rais.py                                 # RAIS/MTE → empregos e estabelecimentos (2018-2025)
cd dashboard && npm run snapshot                             # payload do dashboard → snapshot
# depois: copiar os arquivos alterados para o servidor
```

## Metas: o que entra no quadro

`metas.mjs` é a única fonte da parametrização. Uma meta só entra no quadro quando o patamar pode ser confrontado com os valores já coletados, na mesma unidade. Cada parâmetro declara seu `tipo`:

- `declarada` — o número está escrito na meta do catálogo (ex.: CVLI ≤ 10 por 100 mil; ISGR 80).
- `inferida` — a meta é qualitativa ou regional e foi operacionalizada aqui; a página mostra a nota explicando a escolha (ex.: “universalizar o atendimento escolar” lido como 100%).
- `derivada` — o alvo é calculado por estado a partir da própria série (ex.: redução de 30% sobre a média histórica de focos de calor).

Os valores vêm sempre do catálogo, para que meta e valor não possam divergir. A única exceção é `I5.4.1`: os valores do catálogo estão em R$ milhões, então o percentual do PIB vem do campo já consolidado pelo `/api/dashboard`. O objeto `EXCLUSOES` registra, com justificativa, os indicadores que têm dados mas cuja meta não é confrontável; os demais aparecem como “sem dados coletados”. As duas listas são renderizadas na própria página — a cobertura é parte do resultado, não uma omissão.
