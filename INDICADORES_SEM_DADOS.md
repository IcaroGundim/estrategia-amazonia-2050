# Indicadores sem dados: o que falta e por quê

Levantamento do que **não** foi possível coletar dos 59 indicadores da matriz de
resultados, com a evidência de cada caso. Serve para não se refazer a mesma busca e
para separar o que depende de articulação institucional do que depende de uma chave
de API ou de esperar um sistema voltar ao ar.

Sondagens feitas em **7 de setembro de 2026**. Onde há código HTTP ou medição, foi
verificado nessa data — não é herança da anotação anterior do catálogo.

---

## Resumo

O catálogo tem **41 indicadores sem valores coletados**: 27 dependem dos estados e 14
têm base externa. Desses 14, um foi resolvido — o **IDEB**, cuja nota de bloqueio
estava desatualizada —, então restam 13.

| Situação | Indicadores | Seção |
|---|---|---|
| Sem base secundária por natureza — dependem dos estados | 27 | 1 |
| Base externa existe, mas está bloqueada ou incompleta | 13 | 2 |
| Dado coletado, série histórica impossível | 4 | 3 |
| Série obtida, mas não ligada ao painel de propósito | 4 | 4 |

Os grupos 3 e 4 **não** fazem parte dos 41: são indicadores que já têm valor no
painel, mas cuja série esbarra em limite da fonte ou em decisão pendente.

Os indicadores **resolvidos** nesta rodada — IDEB, mortalidade evitável, telessaúde,
focos de calor, PEVS, PIA, RAIS, frequência escolar, atenção primária e P&D — não
aparecem aqui. Estão documentados no README do dashboard.

---

## 1. Dependem dos estados, não de base secundária (27)

São status administrativos de política estadual: se existe lei, se o plano foi
aprovado, se a câmara técnica foi instalada, quantos hectares o órgão fundiário
regularizou. **Nenhuma varredura de dados abertos resolve isso** — a informação está
nas secretarias, e a coleta é por ofício ou pactuação no âmbito do Consórcio.

Não são "difíceis de achar": são dados que só existem se o estado os produzir e
entregar.

### Eixo 1 — Território, Ambiente e Clima (13)

| Código | Indicador | Onde está |
|---|---|---|
| I1.1.1 | ZEE vigente e atualizado | Legislação e portal das secretarias estaduais |
| I1.1.3 | Cooperação técnica PNGATI/PNGTAQ | Estados / Diário Oficial |
| I1.2.1 | Planos Estaduais de Adaptação aprovados | Diário Oficial / portal da secretaria |
| I1.2.2 | PEAs alinhados ao Plano Clima/ENA | Texto do PEA, cotejado com o Plano Clima |
| I1.3.3 | Monitoramento por sensoriamento remoto | Estados |
| I1.3.8 | PPCDQ vigente | Diário Oficial / portal da secretaria |
| I1.5.1 | Regularização de áreas públicas estaduais | Órgãos fundiários estaduais |
| I1.5.2 | Câmaras Técnicas de Destinação | Órgãos fundiários estaduais |
| I1.5.3 | Mediação de conflitos fundiários | Órgãos fundiários estaduais |
| I1.5.4 | Adesão ao SICARF Federativo | Órgãos fundiários estaduais |
| I1.5.5 | Destinação de florestas públicas estaduais | Órgãos fundiários estaduais |
| I1.5.6 | Integração das bases fundiárias/ambientais | Órgãos fundiários estaduais |
| I1.5.7 | Sobreposições de CAR | Órgãos fundiários estaduais |

### Eixo 2 — Pessoas e Bem-estar (1)

| Código | Indicador | Onde está |
|---|---|---|
| I2.1.2 | Cobertura de programas de inclusão produtiva | Estados |

### Eixo 3 — Desenvolvimento econômico sustentável (8)

| Código | Indicador | Onde está |
|---|---|---|
| I3.2.1 | Cadeias produtivas estruturadas | Estados |
| I3.3.1 | Política de trabalho verde | Estados |
| I3.3.2 | Pessoas capacitadas em sociobioeconomia | Estados |
| I3.3.3 | Programas permanentes de formação técnica | Estados |
| I3.4.1 | Beneficiários de PSA | Estados — mas há caminho parcial, ver seção 2 |
| I3.4.2 | Operações de PSA e mercados de serviços ecossistêmicos | Estados |
| I3.5.1 | Política de agregação de valor mineral | Estados |
| I3.5.2 | Projetos minerais com critérios socioambientais | Estados |

### Eixo 5 — Governança e parcerias (5)

| Código | Indicador | Onde está |
|---|---|---|
| I5.1.1 | Financiamento climático captado/executado | Estados |
| I5.2.1 | Taxa de alavancagem (blended finance) | Estados |
| I5.3.1 | Arranjo jurídico climático estadual | Estados |
| I5.3.2 | Interoperabilidade de dados prioritários | Estados |
| I5.5.3 | Modelos regionais de governança compartilhada | Estados e CAL |

---

## 2. Base externa existe, mas está bloqueada ou incompleta (13)

Aqui a fonte é identificável. O que impede é acesso, formato ou maturidade do sistema.

### I3.4.1 — Beneficiários de PSA

**O caminho existe e falta uma chave.** O endpoint
`api.portaldatransparencia.gov.br/api-de-dados/bolsa-verde-por-municipio` responde
**401, não 404** — existe e entrega dados por município. Basta a chave de API, que o
Portal da Transparência concede a quem se cadastra.

Duas ressalvas antes de usá-la:

- O **CNPSA**, cadastro nacional que a Lei 14.119/2021 criou justamente para
  consolidar beneficiários de PSA, **ainda está em construção**, com conclusão
  prevista para o ano seguinte. É ele que resolveria o indicador inteiro.
- O Bolsa Verde é **um** programa. Os estaduais — Bolsa Floresta no Amazonas, REM no
  Acre e Mato Grosso — não estão em base consolidada nenhuma. Uma série só do Bolsa
  Verde é recorte federal, não o total de beneficiários da região, e o painel
  precisaria dizer isso.

O painel do Bolsa Verde no gov.br/mma está sob **restrição de defeso eleitoral até
25/10/2026**, e o programa não aparece em nenhum dos 39 conjuntos de download em
massa do Portal da Transparência.

### I5.5.2 — Transparência pública (EBT 360)

Bloqueado, e **não por falha do dia da coleta**: `mbt.cgu.gov.br` redireciona para uma
página de manutenção que declara *"O Sistema Mapa Brasil Transparente está
temporariamente fora do ar para atualizações. Previsão de retorno: novembro/2026"*.
O `dadosabertos.cgu.gov.br` **não resolve mais em DNS**.

Vale reconferir depois de novembro de 2026.

### I2.4.2 e I4.4.2 — AdaptaBrasil

Dois problemas independentes:

1. A API `sistema.adaptabrasil.mcti.gov.br` devolve **403** mesmo com `Referer` e
   `Origin` do próprio portal.
2. Mais decisivo: o AdaptaBrasil publica índices por **recorte de cenário** (presente,
   2030, 2050), **não por ano histórico**. Mesmo com a API aberta, não existe série
   temporal a extrair — é outra natureza de dado.

### I4.2.1 — Adequação e trafegabilidade de transportes

A nota do catálogo continua válida: o painel da CNT é **Power BI sem API** e o `vgeo`
do DNIT publica **só geometria**, sem estado de conservação. O indicador precisa do
estado de conservação, que é justamente o que não sai em formato aberto.

### I2.5.1 — Renda da sociobioeconomia

A Plataforma da Ecosociobiodiversidade do MMA, que a ficha aponta como fonte, **está
em construção**. Mesma situação do CNPSA: a fonte foi criada, mas ainda não publica.

### I4.3.1 — Transição energética (ITEQ)

Parcial. Os componentes de geração são coletáveis pelo SIGA da ANEEL, mas o índice
composto depende do PASI/EPE, cujo endpoint de downloads devolveu **500**. Ver também
a seção 3, sobre o problema estrutural da matriz elétrica.

### I1.5.8 e I1.5.7 — CAR

O `car.gov.br` **exige TLS legado** para conectar — `OP_LEGACY_SERVER_CONNECT` mais
`SECLEVEL=1`; sem isso a conexão nem abre. Isso foi resolvido. O que resta é que o
SICAR publica **shapefile por estado e boletim em PDF**, não série por UF com o
recorte que as fichas pedem (sobreposições; territórios de povos e comunidades
tradicionais inscritos e analisados).

### I1.3.5, I1.3.6, I1.3.7, I1.4.1, I1.4.2 — coleta manual

FBSP (Cartografias da Violência na Amazônia), CAL/Igarapé, Sisfogo/IBAMA,
Observatório do Código Florestal e registros de TCA/PRADA. São estudos e registros
publicados como relatório, não como base consultável, e o recorte que as fichas pedem
(nº de delegacias especializadas, planos registrados, área restaurada com SAFs) sai de
leitura de documento, não de consulta.

### I5.2.2 — Governança regional / recursos executados pelo CAL

O site do Consórcio é **Wix**, e a tabela de orçamento carrega por JavaScript — não há
endpoint estável para automatizar. É leitura de página.

---

## 3. Dado coletado, série histórica impossível (4)

Estes têm valor no painel, mas **não podem ter série** — e a razão é da fonte, não da
coleta.

### I4.3.2 — Participação de renováveis (PER)

**Nenhuma fonte cruza UF com fonte de geração ao longo do tempo.** Verificado:

| Fonte | O que tem | O que falta |
|---|---|---|
| ANEEL `capacidade-instalada-por-unidade-da-federacao` | UF × ano, 2006-2026 | fonte de geração |
| ANEEL `empreendimentos-em-operacao` | fonte × ano, 2001+ | UF |
| ANEEL SIGA | UF × fonte | é fotografia do momento |
| ONS `capacidade-geracao` | — | declara não ter histórico; só usina despachada |
| EPE Anuário, Tabela 2.1 | UF × ano, 2004-2025 | fonte de geração |
| EPE Anuário, Tabela 2.3 | fonte × ano | UF |
| EPE Anuário, Tabela 2.8 | renovabilidade | só nacional |

Reconstruir pelo `DatEntradaOperacao` do SIGA **não funciona**, e o erro foi medido,
não suposto. São dois defeitos de sinais opostos:

- **Sobrevivência** — o SIGA não guarda usina desativada (só as fases Operação,
  Construção e Construção não iniciada). As térmicas a diesel aposentadas somem do
  passado: Amazonas em 2010 sai com **978 MW contra 2.140 MW reais**.
- **Datação** — usina escalonada entra numa linha só. Belo Monte é um registro de
  11.233 MW datado 2016-04-20, e o Pará de 2016 sai **70% acima** do real.

A medição por UF e ano está em `public/data/csv/diagnostico_siga_reconstrucao.csv`.

### I4.4.1 — Saneamento e gestão de riscos (ISGR)

O índice é `min(água adequada, esgoto adequado) × FClima × FGov`, e **dois dos três
insumos nascem em 2022**:

- **Água**: a definição usa a classificação 1821 do Censo 2022, que cruza *existência
  de ligação à rede* com *forma principal de abastecimento* — duas perguntas que só
  passaram a ser feitas separadamente naquele censo. Em 2000 e 2010 há só a forma
  principal, que não identifica quem tem ligação mas usa outra fonte nem separa poço
  profundo de poço raso.
- **FClima e FGov**: vêm da MUNIC 2024, e edições anteriores têm outro questionário.

O que **é** comparável entre os três censos foi coletado e está em
`public/data/saneamento-censos.json` — mas marcado como **não sendo o ISGR**, por
decisão registrada: exibir outra medida sob o mesmo rótulo trocaria o indicador
mantendo o nome.

### I1.1.2 — Gestão de unidades de conservação (CNUC)

O CNUC é registro do estado atual. Não encontrei edições históricas publicadas como
série. Esta é a conclusão de que tenho **menos certeza** neste documento: parei na
página do portal e não esgotei a busca.

### I1.3.1 — Vulnerabilidade climática (IIVCM)

Mesmo caso do AdaptaBrasil acima: índice por cenário, não por ano.

---

## 4. Série obtida, mas não ligada ao painel de propósito (4)

Aqui o dado **existe e está salvo no repositório**. O que falta é uma decisão ou um
insumo, e ligar assim mesmo produziria número errado.

### I2.2.1 (mortalidade evitável) e I2.4.1 (CVLI) — falta o denominador certo

As duas fichas definem taxa sobre população. O painel divide pela **revisão de 2024 da
projeção do IBGE**, que **não está publicada na SIDRA** — a tabela 7358 traz a revisão
de 2018, que dá 82.857 crianças de 0 a 4 anos no Acre em 2024 contra as **88.080** que
o painel usa, e diverge em até **218 mil pessoas** no Amazonas em 2026.

Calcular a taxa com outra revisão poria uma quebra de denominador no meio da série. As
**contagens** estão salvas (31 anos de óbitos evitáveis, 12 anos de CVLI) e a taxa se
monta quando a série de população estiver disponível — no caso do CVLI, ela entra
sozinha no próximo `build:static` na máquina que tem `dados/ibge_pop/`.

### I2.2.3 (telessaúde) e F3.2 (RAIS) — dado salvo, métrica não criada

Ambos ganharam série (15 e 7 anos) e estão versionados. Não viraram métrica do painel
porque isso é decisão de escopo do painorama, não de coleta.

### I4.4.1 — saneamento nos censos

Coletado, versionado, **e deliberadamente fora do painel** — ver seção 3.

---

## 5. Duas correções pendentes que não são de dado

Achadas na revisão das referências, e que só podem ser corrigidas na origem porque o
`fichas.json` é gerado do `.docx`:

- **I3.4.1 e I3.4.2** (ambos de PSA) trazem no campo `indicador` o texto do **I5.1.1**:
  "Montante de recursos obtidos pelos nove estados com programas jurisdicionais de
  crédito de carbono". A **meta** dos dois está correta; o texto do indicador é que foi
  copiado do lugar errado.
- **I2.5.1** descreve "Participação da Bioeconomia no PIB" enquanto o catálogo fala em
  "Volume de renda no painel da sociobioeconomia". Pode ser divergência legítima de
  redação entre a ficha e o workbook, mas convém conferir.

Rodar `python scripts/auditar_fichas.py` reexecuta essa conferência e aponta se algo
voltou depois de uma reextração do `.docx`.

---

## Como reconferir

```bash
python scripts/auditar_fichas.py     # ficha x catálogo: órgão trocado, link órfão, texto trocado
```

Os casos com data marcada — EBT 360 (novembro/2026), defeso eleitoral do MMA
(25/10/2026), CNPSA e Plataforma da Ecosociobiodiversidade (ambos "ano seguinte") —
merecem nova sondagem depois desses prazos. Os demais dependem de decisão
institucional, não de tentar de novo.
