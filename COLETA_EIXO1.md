# Coleta do Eixo 1: Território, Ambiente e Clima (07/10/2026)

Vinte agentes de pesquisa (Haiku 5.5, esforço xhigh) cobriram os 22 indicadores do Eixo 1, cada um com uma tarefa:
- **7 de séries longas** estenderam para trás os indicadores que o painel já mostra.
- **13 documentais** procuraram o que existe para os indicadores sem dado.

- **Dados**: `dados/eixo1_coleta/<tarefa>/`, cerca de 1,8 GB, fora do versionamento como o resto de `dados/`. Cada pasta traz:
  - `achados.md`, com o relato por UF e as fontes;
  - `series.csv`, em formato longo, com as colunas `codigo,serie,rotulo,uf,ano,valor,unidade,fonte_url,nota`;
  - `fontes.csv`;
  - `atos.csv`, nas tarefas documentais, com uma linha por ato ou edição;
  - `brutos/`.
- **Coletores**: 17 scripts `scripts/eixo1_coleta_*.py`. Rodam a partir da raiz com `python -I scripts/<nome>.py`.
- **Nada foi gravado** em `dashboard/conteudo/`, em `propostas/` nem em `public/data/`.

Os rótulos são os mesmos do Eixo 4:
- **exata**: mede o indicador como a ficha define.
- **componente**: é um termo da fórmula.
- **proxy**: mede algo próximo.
- **contexto**: só serve de leitura.

Nos CSVs, `AL` quer dizer Amazônia Legal.

## Duas ressalvas antes de usar

**1. Nove tarefas documentais pararam no meio.** O Claude Code limita a 200 buscas web por turno, somando todos os agentes. O limite acabou quando ainda rodavam PPCDQ (A e B), PRA, SAFs, destinação, conflitos, fogo, SICARF e, em parte, segurança e monitoramento. Nessas tarefas, "não encontrado" quer dizer "não procurado" em vários estados. Cada `achados.md` diz quais.

**2. Não houve verificadores independentes, como no Eixo 4.** Eu conferi o seguinte:

| Conferência | Resultado |
|---|---|
| Focos 2015–2025: série nova contra `valores.csv` | 99 de 99 células iguais |
| Focos 2013: baixei o `focos_br_ref_2013.zip` do INPE e contei de novo | 7 de 7 UFs iguais (AC, AM, MA, MT, PA, RO, TO) |
| CNUC 2018–2026: série nova contra `valores.csv` | 72 de 72 células iguais |
| CNUC 2023: baixei a extração do CKAN do MMA (`cnuc_2023_07_v3.xlsx`) e calculei de novo | AL 24,08% (46 de 191); AM, MT, PA e RO iguais |
| PRODES Cerrado 2025: MA e TO contra a nota técnica do INPE | Iguais (2.006,02 e 1.488,68 km²) |
| Sinaflor ASV no CKAN do IBAMA, sem login | Existe (atualizado em 10/04/2026) |
| ZEE de RR: texto da LC 323/2022 | Art. 1º confirmado ("ZEE-RR, na escala geográfica de 1:250.000") |
| ZEE do AP | O Decreto 1.211/2026 cita a "Lei nº 3.208, de 24 de abril de 2025" |

Todo o resto é a palavra do agente, com URL e trecho no `achados.md`, e deve ser tratado como **não verificado**.

---

## Resumo

| Indicador | O que saiu | Rótulo | Situação |
|---|---|---|---|
| I1.1.2 UCs com plano e conselho | **2018–2026 sem lacunas**: entra 2023 (AL 24,1%) | exata | Pronto para o painel. Antes de 2018 não há dado por UF |
| I1.3.4 Focos de calor | **2012–2025** no método do painel; 2002–2011 retroativa | exata / proxy | Pronto. A quebra de satélite precisa aparecer |
| I1.3.2 Desmatamento | Taxa PRODES 1988–2025 já existia; agora há **estado inteiro** (Amazônia + Cerrado + Pantanal) de 2008 a 2024 | componente | Pronto como componente |
| I1.3.2 Autorizações | **Sinaflor ASV e UAS 2018–2026 por UF, em dado aberto** | componente | Abre o segundo termo da fórmula. Falta decidir bioma e tipo de autorização |
| I1.5.5 Florestas públicas | **CNFP 2010–2025** (sem 2021 e 2023): % de florestas estaduais destinadas | exata | Candidata. Antes, confirmar com o SFB os saltos de RR, 2018 e AC 2025 |
| I1.1.1 ZEE | 48 atos nas 9 UFs; série 1/0 de 2000 a 2025 | exata (provisória) | Depende de a ficha definir o que conta como ZEE |
| I1.3.8 PPCDQ | Edições por UF desde 2009 (MT e TO completos; AM e AC parciais) | exata / componente | Incompleto: limite de busca |
| I1.4.1 PRA | Regulamentado (1/0) 2023–2025 nas 9 UFs; termos de compromisso 2020–2025 em 6 UFs | exata / proxy | Hectares não formam série |
| I1.3.5 Delegacias | 2014–2018 (MJSP) e 2023 (FBSP) por UF; frota 2023 e 2024 | exata | Usável como existência, não "em operação" |
| I1.3.3 Monitoramento | MapBiomas RAD: % de alertas com fiscalização ou autorização, 2019–2024; DETER 2016–2026 | proxy / contexto | Nenhuma UF publica a medida da ficha |
| I1.5.3 Conflitos | CPT, conflitos por terra por UF, 2009–2025 (sem 2017 e 2018) | contexto | Os numeradores da ficha não existem em fonte aberta |
| I1.5.1 e I1.5.2 Destinação | UCs estaduais criadas por ano (1978–2026); títulos quilombolas estaduais (PA, MA e TO) | proxy / componente | Sem denominador. Nenhuma câmara de destinação deliberativa confirmada |
| I1.2.1 e I1.2.2 PEA | **Nenhum PEA geral aprovado** nas 9 UFs; planos ABC+ em 5 UFs como proxy | proxy | Falta decidir se o ABC+ conta |
| I1.3.7 Manejo do fogo | Nenhum PMIF estadual. Prazo legal: Res. COMIF 2/2025, art. 10 (até 2027) | contexto | Sisfogo não publica a lista de planos |
| I1.1.3 PNGATI/PNGTAQ | Um instrumento, em RO (ACT FUNAI–EMATER-RO, abr/2026) | exata | 1 de 9 em 2026. DOU não consultado |
| I1.5.8 e I1.5.7 CAR | CAR/PCT inscritos em MA, PA e MT, 2022–2025 (CPI/PUC-Rio); sobreposição só em recortes avulsos | componente / proxy | Boletins do SFB fora do ar; pedir por LAI |
| I1.4.2 SAFs | Só contexto: Censo Agro 2006 e 2017; MapBiomas 1985–2025 | contexto | Não há área restaurada por técnica em fonte aberta |
| I1.5.4 e I1.5.6 SICARF | Proxy fraco: CAR no Sicar federal ou em sistema estadual, 2024–2026 | proxy | A busca nem chegou a rodar. Refazer |
| I1.3.1 IIVCM | **Não existe série**: cada indicador do AdaptaBrasil tem um único ano | proxy | O valor de 2025 do painel não se reproduz pela fórmula |
| I1.3.6 Sistema regional | Não existe. O Igarapé e o CAL propõem a padronização (mar/2026) | — | Indicador a construir |

---

## Séries longas

### I1.1.2: UCs estaduais com plano de manejo e conselho gestor

As 16 extrações do CKAN do MMA cobrem **2018 a 2026 sem lacunas**. O 2023 entra com a extração de julho de 2023 (`cnuc_2023_07_v3.xlsx`, publicada no CKAN como "2º Semestre"). A conta reproduz o painel nas 72 células UF × ano que ele tem.

| AL | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|
| % com ambos | 20,3 | 20,0 | 27,6 | 27,6 | 27,6 | **24,1** | 20,4 | 20,8 | 21,1 |

- **Antes de 2018 não há recorte por UF.** O portal começa em 2018-09, e os PDFs nacionais de 2011 a 2018 só trazem o total do Brasil. Nesta coleta, a conclusão da anterior se confirma.
- Para 2020, quem bate com o painel em 9 de 9 UFs é a extração do 2º semestre, não a do 1º.
- Há uma decisão pendente para 2026-07: o Parque Estadual do Araguaia é de GO e MT. Se entrar, MT vai a 12,8% e a AL a 21,5%.
- Proxy: UCs estaduais existentes por ano de criação, de 1978 a 2026. Superestima em 16 UCs em 2018 por atraso de cadastro, então serve só como ordem de grandeza.

### I1.3.4: Focos de calor

A série com o mesmo método do painel (arquivo `sat_ref` anual do INPE, estado inteiro) vai agora de **2012 a 2025**. O ano de 2011 entra só a partir de 22/08.

| AL (soma das 9) | 2012 | 2013 | 2014 | 2015 | … | 2024 | 2025 |
|---|---|---|---|---|---|---|---|
| Focos | 144.557 | 89.019 | 124.337 | 152.745 | … | 198.972 | 76.371 |

- **Os satélites de referência são estes:**
  - NOAA-12 até 09/08/2007;
  - NOAA-15 até 21/08/2011;
  - AQUA_M-T só depois (aviso técnico do INPE de 2011).
- **A série de 2002 a 2011 é um reprocessamento retroativo do AQUA.** Somada na AL, vai de 228 mil focos (2003) a 91 mil (2011).
- **O agente verificou que o arquivo `sat_ref` de 2003 a 2011 é idêntico ao recorte AQUA_M-T.** Então existe uma série de 2003 a 2025 com o mesmo satélite. Ela só leva o rótulo proxy antes de 2012 porque, naquela época, a referência oficial do INPE era o NOAA. **Decisão sua:** usar a série do AQUA desde 2003 no painel, com uma nota, ou ficar em 2012.
- **As séries do NOAA de 1998 a 2011 não se emendam com as do AQUA.** A razão entre os satélites vai de 1,2 a 20 vezes.
- **A baseline está diferente na ficha e no painel.** A ficha diz 2015–2025 e o painel usa a média de 2015–2024. Como 2025 já está completo, é preciso decidir qual vale.
- **O `dados/focos/focos_calor_uf_ano.csv` local está errado em RO 2016:** repete 13.113, que é o valor de 2015. O painel está certo, com 11.474. O erro é só do arquivo bruto antigo.

### I1.3.2: Desmatamento (PRODES)

- **A taxa local de 1988 a 2025 confere com o TerraBrasilis em 342 de 342 células.** O 2024 também bate com a nota técnica consolidada do INPE.
- **Componentes novos por bioma:**
  - Amazônia floresta, 2008–2025;
  - Amazônia não floresta, 2002–2024;
  - Cerrado, 2002–2025 (bienal até 2012);
  - Pantanal (MT), 2004–2025.
  O Cerrado e o Pantanal de 2024 e 2025 batem exatamente com as notas do INPE.
- **O desmatamento do estado inteiro dá números bem maiores que a taxa da Amazônia no Cerrado.** É a soma dos biomas, com valores para 2008–2024 e lacunas em 2009, 2011, 2012, 2015 e 2017, e muda a leitura de MA, TO e MT. Em 2024 a soma dos biomas dá MA 2.686 km² contra 307 da taxa Amazônia, TO 2.030 contra 32, e MT 1.979 contra 1.257.
- **Para 2025 só há um proxy**, sem a parte de não floresta.
- O DETER de 2016 a 2026 entra como contexto. No ciclo de 2026 ele não reconcilia com o MMA (diferença de 2,6% a 2,8%).

### I1.3.2: Autorizações de supressão (o segundo termo da fórmula)

- **O "Sinaflor exige login" do catálogo está desatualizado.** O IBAMA publica em dado aberto, sem login, a ASV (29.082 autorizações) e o UAS (42.525), por UF e com emissões desde 2018. Conferi o conjunto no CKAN.
- O agente calculou faixas da parcela sem autorização para AC, AM, AP, PA, RO e RR, de 2019 a 2025. Elas são ordem de grandeza: em AP 2025 e em RR 2024–2025, a área autorizada passa do PRODES.
- Contexto: no MapBiomas (RAD 2024), a parcela da área de alertas com autorização, acumulada de 2019 a 2024, é de 59,6% em TO, mas fica abaixo de 1,5% em PA e AM.

**Decisões pendentes antes de pôr no painel:**
- **Tipo de autorização.** ASV, UAS ou as duas? Em MA e TO, quase tudo está no UAS.
- **Bioma do denominador.** Em MA, MT e TO a supressão é de Cerrado, e o PRODES Amazônia não serve.
- **Unidade.** A ficha diz %, mas a fórmula dá hectares.

### I1.5.5: Florestas públicas estaduais (CNFP)

Há edições por UF de 2010 a 2020, 2022, 2024 e 2025. Não existem as de 2021 e 2023. O agente validou a série contra as tabelas oficiais de 2012, 2019, 2020 e 2022.

| AL | 2010 | 2015 | 2020 | 2022 | 2024 | 2025 |
|---|---|---|---|---|---|---|
| % estadual destinada | 54,6 | 54,8 | 55,9 | 58,6 | 58,0 | 62,2 |

- **O CNFP é cadastro dinâmico, e saltos podem ser de cadastro, não de destinação.** RR vai de 0,5% (2010) a 99,4% (2015) e cai para 46,4% (2024). O ano de 2018 tem estrutura própria e duplicatas.
- **A fórmula da ficha está invertida** (não destinada ÷ destinada). A série usa destinada ÷ total.
- **Falta definir o ano da linha de base.**

### I1.3.1: Vulnerabilidade climática (IIVCM)

Agora há evidência para dizer que não existe série temporal.
- **Cada indicador de vulnerabilidade do AdaptaBrasil tem um só ano de referência**, entre 2015 e 2020.
- **Os ciclos antigos da plataforma só trocam o rótulo do ano.** A correlação entre os valores de um ciclo e outro fica entre 0,9999 e 1.

Há dois problemas novos:
- **O valor de 2025 do painel não se reproduz pela fórmula da ficha.** Nenhuma das 48 variantes testadas chega lá (erro mínimo de 1,31 ponto). O `intensidade_vulnerabilidade_climatica.xlsx` citado na ficha não foi localizado.
- **A meta de 52,1 coincide com 59,34 × 0,878**, ou seja, 12,2% abaixo da média dos prioritários. Não é a "média do grupo menos vulnerável" que a ficha descreve, que dá 53,6.

**Recomendação:** marcar o valor de 2025 como não verificado até achar o xlsx de origem.

---

## Documentais

### I1.1.1: ZEE

Foram 48 atos levantados nas 9 UFs, com número e data. O agente leu o texto legal de AC, AM, MA, PA, RO, RR, TO e do decreto do AP. A situação de cada estado:

| UF | Situação |
|---|---|
| RR, AP | ZEE estadual completo, vigente e recente: LC 323/2022 em RR e Lei 3.208/2025 no AP |
| MA | MacroZEE de 2015, que expirou em 2024, e dois ZEEs parciais por bioma |
| AC, AM, PA, RO | Instrumentos antigos ou parciais |
| MT | ZSEE de 2011 suspenso por liminar |
| TO | Sem ZEE estadual normatizado |

- **Licenciamento:** o vínculo formal existe em RR (art. 33) e no MA. É parcial em AM e PA.
- **A série AL depende de duas decisões da equipe.** Ela vai de 2 estados em 2000 a 5 em 2011 e cai a 1 em 2019–2021. A equipe precisa definir se o MacroZEE (escala 1:1.000.000) e os ZEEs parciais contam, e o que é "atualizado".
- **Fonte de apoio:** a página "ZEE nos estados" do MMA está fora do ar no defeso eleitoral. A planilha de dados abertos do MMA (referência 31/12/2025) tem a mesma base.

### I1.3.8: PPCDQ

Esta tarefa ficou incompleta por causa do limite de busca.

| UF | O que se achou |
|---|---|
| MT | Cadeia completa em diário oficial: Decreto 2.943/2010, PPCDIF 3ª fase (Decreto 1.490/2018) e 4ª fase (Decreto 1.160/2021, 2021–2024). Não há 5ª fase |
| TO | Três edições (2009–2014, 2015–2020, 2021–2025) na página da SEMARH, sem número de ato |
| AM | Decreto 42.369/2020 (3ª fase); a 4ª fase (2023–2025) não tem ato localizado |
| AC | 1ª edição em 2009; 2ª fase de 2017 a 2020; a 3ª não foi confirmada |
| AP | Ciclo 2010–2012 |
| PA | Não tem PPCDQ. O Plano Estadual Amazônia Agora (Lei 10.750/2024) pode contar como equivalente |
| RR | Só fonte secundária |
| MA | Decreto de origem em conflito entre as fontes |
| RO | Só o Decreto 15.240/2010 |

### I1.4.1: PRA

- **Há ato de regulamentação nas 9 UFs:** PA 2015, RO 2016, AM 2016 e 2020, MT 2017, AC 2017 e 2018, AP 2021, MA 2023, TO 2024 e 2025, RR 2024. Só os de AM, PA e MT foram lidos em texto integral.
- **Série 1/0 de 2023 a 2025, tirada das figuras da CPI/PUC-Rio:** TO passa a 1 em 2024 e RR em 2025.
- **Termos de compromisso:** há contagens de 2020 a 2025 para AC, MT, PA, RO e MA, e para AM só em 2025. AP, RR e TO não aparecem em nenhuma edição.
- **Os hectares sob termo não formam série.** Cada edição mede APP, RL ou a área do imóvel.

### I1.3.5 e I1.3.6: Delegacias e sistema regional

- **Delegacias especializadas em meio ambiente por UF:** 2014–2018 vêm da Pesquisa Perfil do MJSP (fonte primária) e 2023 do FBSP. Em 2023, as 9 UFs têm ao menos uma, 11 no total. A única delegacia fluvial fica no PA.
- **Frota por instituição em 2023 e 2024.** As duas edições divergem, por exemplo nas embarcações da Polícia Civil do PA, que vão de 22 para 15.
- **I1.3.6 não existe como sistema.** O relatório Igarapé + CAL (mar/2026) propõe a padronização como próximo passo.

### I1.3.3: Monitoramento por satélite

- **Nenhuma UF publica o % do território monitorado nem o tempo entre alerta e fiscalização.**
- **Proxy:** a RAD do MapBiomas (2019–2024) dá, por UF, o % de alertas com autorização ou fiscalização. A separação entre fiscalização federal e estadual só existe no acumulado.
- **A fórmula da ficha foi copiada do I1.3.4 e fala de focos de calor.**

### I1.5.3: Conflitos fundiários

- **CPT, conflitos por terra por UF:** de 2009 a 2016 e de 2019 a 2025, validado contra os subtotais regionais de cada edição.
- **2017 e 2018 ficaram de fora:** a tabela de 2017 está em imagem e o texto de 2018 está corrompido.
- **Os espaços de mediação achados são do Judiciário,** as Comissões de Soluções Fundiárias dos TJs (Res. CNJ 510/2023). A meta fala dos institutos de terras, que não chegaram a ser pesquisados.

### I1.5.1 e I1.5.2: Destinação de áreas públicas estaduais

- **UCs estaduais criadas, por ano e UF, de 1978 a 2026:** 154 UCs públicas e 41 APAs, separadas.
- **Títulos quilombolas emitidos por órgão estadual (tabela do Incra de 15/06/2026):**
  - PA: 82 títulos;
  - MA: 61;
  - TO: 1;
  - demais UFs: nenhum.
- **Câmara Técnica de Destinação deliberativa:** nenhuma confirmada. A CTAF do PA é consultiva.
- **A % do indicador não é calculável,** porque não existe lista oficial de "áreas públicas prioritárias".

### I1.2.1 e I1.2.2: Planos Estaduais de Adaptação

- **Nenhum PEA geral aprovado nas 9 UFs.**
- **Há planos setoriais da agropecuária (ABC/ABC+) em MA, MT, PA, RR e RO.** Vários se intitulam "Plano Estadual para Adaptação à Mudança do Clima", mas são setoriais. Entram como proxy até a ficha decidir.
- **Planos em elaboração:** AM (diagnóstico de 2025) e TO.
- **Prazos legais vencidos sem plano publicado:** PA (Lei 9.048/2020, art. 36) e MT (Decreto 1.160/2021).
- **I1.2.2 dá zero por construção.** Os planos lidos são anteriores à ENA, aprovada entre dez/2025 e mar/2026. As fontes divergem quanto à data.

### I1.3.7: Manejo integrado do fogo

- **Nenhum PMIF estadual registrado.**
- **Base legal do prazo da ficha:** a Res. COMIF 2/2025, art. 10, manda os estados elaborarem o PMIF em até dois anos e registrá-lo no Sisfogo. Isso cai por volta de mar/2027, por inferência.
- **O portal do Sisfogo não publica a lista de planos.**
- Contexto: Prevfogo 2017–2025 por UF (queima controlada e prescrita, aceiros) e brigadistas em 2025–2026.
- AC, AM, AP, MA, RO e RR não foram pesquisados, por causa do limite de busca.

### I1.1.3: PNGATI/PNGTAQ

- **Um instrumento:** o ACT FUNAI–EMATER-RO, assinado em abr/2026 por 5 anos. A signatária é uma autarquia estadual, e a equipe precisa decidir se ela conta como "estado".
- **PA:** protocolo de intenções de 2024, sem ACT assinado.
- **PNGTAQ:** 18 adesões no total, de estados e municípios, sem lista por UF.
- **O DOU não foi consultado.**

### I1.5.8 e I1.5.7: CAR

- **CAR/PCT inscritos por UF:** MA (2022–2025), PA e MT, pela CPI/PUC-Rio. As outras UFs só aparecem em faixas.
- **Análise e validação de CAR/PCT por UF:** não há em fonte aberta. O painel do SFB é Power BI sem acesso público, e o boletim PCT da Semas-PA estava fora do ar.
- **Sobreposições:** só em recortes avulsos. São a nota técnica da PGR/MPF de 2020, o de MT em 2023, o do PA em 2025 e o da AL em 2024 (CSR/UFMG). Não formam série nem linha de base.
- **O proxy do painel tem zeros em 8 UFs.** Os denominadores implícitos do PA (cerca de 152 a 183 registros) não batem com a CPI. Vale conferir na `pesquisa/` do Mac.

### I1.4.2: SAFs e I1.5.4 e I1.5.6: SICARF

- **I1.4.2:** não há área restaurada por técnica em fonte aberta. Saiu só contexto (Censo Agro e MapBiomas).
- **I1.5.4 e I1.5.6:** a busca web nem chegou a rodar.
  - **"SICARF-Federativo" e "Terras do Brasil" não aparecem nas fontes do INCRA.** O programa vigente é o Terra Cidadã, que substituiu o Titula Brasil.
  - **Precisa de uma nova rodada.**

---

## Problemas nas fichas, por ordem de impacto

1. **I1.3.3:** a fórmula foi copiada do I1.3.4 (focos de calor) e a unidade % não serve para o tempo de resposta.
2. **I1.5.5 e I1.5.7:** as fórmulas estão invertidas (base ÷ resolvido).
3. **I1.3.2:** a unidade (% contra ha) e o bioma do denominador não estão definidos. Também não diz qual autorização conta (ASV ou UAS).
4. **I1.3.1:** a fórmula não reproduz o valor do painel, o xlsx de origem está ausente e a meta de 52,1 é descrita de um jeito diferente do que ela é.
5. **I1.3.4:** baseline 2015–2025 na ficha contra 2015–2024 no painel, e satélite não especificado.
6. **I1.1.1, I1.2.1 e I1.3.8:** falta definir "atualizado", "instrumento equivalente", "em execução" e se o MacroZEE, os ZEEs parciais e os planos ABC+ contam.
7. **I1.5.1, I1.5.3 e I1.4.2:** não têm denominador nem fonte que publique o numerador.
8. **I1.1.2:** a fórmula foi gravada sem a barra de divisão (`NConformesNTotal`), e o CNUC não mede "em funcionamento" nem "atualizado".

## Próximos passos

**Prontos para levar ao painel, conferidos por mim na fonte** (mexe em `valores.csv`, então precisa de decisão sua):
- I1.1.2 com 2023;
- I1.3.4 com 2012–2014, ou desde 2003 se ficar com a série do AQUA.

**Candidatos, depois de confirmar:**
- I1.5.5 (CNFP): confirmar as anomalias de cadastro com o SFB.
- I1.3.2: decidir o tipo de autorização e o bioma para fechar o total do estado e as autorizações.

**Segunda rodada para as tarefas cortadas pelo limite de busca:**
- PPCDQ (A e B), PRA, fogo, destinação, conflitos, SICARF, SAFs e o resto de segurança e monitoramento.
- O limite de 200 buscas reinicia a cada mensagem nova: uma busca voltou a funcionar no turno seguinte.
- Na primeira rodada, os primeiros agentes gastaram a cota e os últimos ficaram sem. Na próxima, cada agente precisa de um teto próprio, cerca de 20 buscas.

**Pedidos por LAI:**
- SFB: CAR/PCT analisado e validado, e sobreposições.
- IBAMA: lista de PMIF registrados no Sisfogo.
- MIR: adesões à PNGTAQ por UF.
- FUNAI: lista de ACTs com governos estaduais.
