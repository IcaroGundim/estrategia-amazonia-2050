# Séries históricas do Eixo 4 — coleta de 07/10/2026

Busca de séries anuais por UF para os seis indicadores do Eixo 4. Foram seis agentes de pesquisa, um por indicador, e seis verificadores independentes. Cada verificador buscou de novo na fonte original duas ou três células de cada série, sem usar o CSV salvo nem o script do pesquisador.

- **64 séries** encontradas: **60 confirmadas** na fonte e **4 divergentes**, todas de contexto (ver o fim de cada seção).
- **Dados**: `dados/eixo4_series/<código>/`, cerca de 1,65 GB, fora do versionamento como o resto de `dados/`.
- **Coletores**: `scripts/eixo4_series_{ibc,trafegabilidade,iteq,renovaveis,saneamento,capacidade_adaptativa}.py`. Cada um roda do zero a partir da raiz com o Python do sistema (`python scripts/eixo4_series_<slug>.py`). O `.venv` desta máquina aponta para outro usuário e não funciona.
- **Nada foi gravado** em `dashboard/conteudo/`, em `propostas/` ou em `public/data/`.

Rótulos das séries:
- **exata**: reproduz o valor que o painel mostra hoje.
- **componente**: é um termo da fórmula da ficha.
- **proxy**: mede algo próximo do indicador.
- **contexto**: serve de leitura, mas não substitui o indicador.

Nos CSVs, `AL` quer dizer **Amazônia Legal** (as nove UFs inteiras), não Alagoas. Atenção: nos arquivos da própria ANATEL, `AL` é Alagoas.

---

## Resumo

| Indicador | Série exata nova | O que mais saiu | Recomendação |
|---|---|---|---|
| I4.1.1 IBC | **IBC ponderado 2021–2025** (reproduz 2024 e 2025 do painel em 9/9 UFs) | Componentes desde 2008/2009 (densidades SMP e SCM, HHI, ERBs), cobertura 4G e fibra 2021–2025, PNAD TIC | Trocar a série 2021–2025 do painel pela ponderada e desligar a projeção até haver 3 anos na regra v2 (a de hoje diz "alcança 80 em 2031" por efeito da quebra) |
| I4.2.1 Trafegabilidade | — | CNT por UF de 2010 a 2025 (painéis Power BI e PDFs) e PNV 2001–2010 | Só proxy e contexto; antes, revisar a base de 2025 |
| I4.3.1 ITEQ | — | Termos da fórmula: POP_SISOL 2018–2025, DEC/FEC 2004–2025, conformidade DEC/FEC, renovabilidade do SIN | Indicador continua sem valor; os termos vão para tabela de detalhe |
| I4.3.2 Renováveis | **Fotografias da potência**, 13 datas de 2002 a 2026 (o mesmo conceito do painel) | Reconstrução anual 2008–2025, energia ONS 2000–2025, hídrica CFURH, GD solar, EPE | Pontos datados como trajetória; o resto vai para detalhe |
| I4.4.1 ISGR | — (decisão registrada mantida) | PNAD Contínua 2016–2025, PNAD 2001–2015, SNIS, SINISA, fatores da MUNIC por edição | Tabela de detalhe "Saneamento em outras pesquisas" |
| I4.4.2 Capacidade adaptativa | — (estrutural, confirmado) | ODS 11.b.2 (2013, 2017, 2020) como contexto | Manter o valor único |

---

## I4.1.1 — Conectividade digital (IBC-AMZ)

**Exata.** `ibc_ponderado_pop_uf_ano.csv` é o IBC municipal ponderado pela população do Censo 2022, o mesmo método do painel, de 2021 a 2025. O verificador recalculou do zero as 50 células UF-ano (diferença máxima de 0,005). Os anos 2024 e 2025 batem com o painel nas nove UFs.

| AL | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|
| IBC ponderado | 54,27 | 55,59 | 55,92 | 51,67 | 53,52 |

- **A queda de 2023 para 2024 é troca de método, não piora.** O IBC v1 (2021–2023) normaliza por mínimo e máximo entre as 27 UFs, ou seja, é uma escala relativa. O v2 (2024 em diante) usa escala fixa. A ANATEL decidiu não recalcular 2021–2023.
- **A série anual do painel hoje é o IBC estadual simples, que não é o mesmo número.** Exemplo: AC 2021 = 33,41 no estadual simples contra 54,89 no ponderado. No v1, MA 2023 tem zero nas duas densidades porque é o mínimo da escala.
- **Não existe IBC antes de 2021.** O índice foi criado em 2023 e o `ibc.zip` só traz 2021–2025.
- **Antes desta mudança, a trajetória do painel saía distorcida por isso.** Ela usava o IBC estadual simples, e a média dos estados ia de 36,3 (2021) a 54,0 (2025). A reta dava +4,9 pontos por ano, classe "no ritmo", alcançando 80 em 2031. Só que esse salto era a troca de escala do v1 para o v2. Com a série ponderada, a reta ficaria levemente negativa ("contrário"), também por efeito da quebra. Por isso a projeção do I4.1.1 foi desligada (`trajetoria: { desligada: true, nota }` em `metas.json`, como já se faz no I3.4.1) até haver três anos na regra v2.

**Componentes**, todos confirmados: densidade SMP v1 (2009–2025), densidade SCM v1 (2008–2025), HHI SMP (2019–2025), HHI SCM (2007–2025), densidade 4G+5G v2 (2013–2025), banda larga ≥ 100 Mbps v2 (2021–2025), população coberta por 4G ou superior (2021–2025) e municípios com backhaul de fibra (2021–2025).
- Só são o termo oficial do IBC nos anos em que o índice existe. Antes disso, são a fórmula estendida para trás.
- Para ver tendência, use as colunas `valor_pop2022`, porque o denominador oficial muda de fonte em 2022 e em 2024.

**Proxy:**
- ERBs por 10 mil habitantes (2008–2025).
- HHI SMP de 2009 a 2018, tirado de outro extrato.
- "IBC núcleo v2" reconstruído sem cobertura agrícola: na AL, vai de 53,8 em 2021 a 59,0 em 2025, sem o salto de método. Não é o IBC oficial e não se compara com a meta de 80.

**Contexto:** PNAD Contínua TIC por UF (2016–2025, sem 2020): domicílios com internet, pessoas que usaram internet e banda larga fixa.

**Diferença pequena:** em MT 2023, o IBC_UF da ANATEL dá 69,79 e os dados abertos atuais dão 71,00 na densidade SMP. Provavelmente houve revisão dos dados abertos.

---

## I4.2.1 — Adequação e trafegabilidade de transportes

**A razão do painel (46,44% na AL em 2025) não se reproduz por fonte aberta.** O xlsx da Estratégia só traz o resultado de 2025, sem fórmula. Os km de lá são comprimentos de geometria, sem a junção entre a CNT e a malha estadual.

**A rota dada como morta abriu.** A Pesquisa CNT de Rodovias tem painéis Power BI publicados na web (2021–2025). Eles podem ser consultados sem autenticação pelo endpoint público `querydata` (cluster `wabi-brazil-south-d`). As chaves vieram do JavaScript de `pesquisarodovias.cnt.org.br`, numa versão do Wayback de 16/07/2026. O resultado conferiu 50 de 50 contra as tabelas dos PDFs.

| Série | Rótulo | Anos |
|---|---|---|
| S1: km avaliados pela CNT por classe do Estado Geral, rodovias estaduais | componente | 2021–2025 (7 UFs) |
| S2: razão ponderada com os pesos da ficha, a partir de S1 | proxy | 2021–2025 |
| S3: razão ponderada, rodovias federais e estaduais | proxy | 2010–2025, sem 2020 (não houve edição) |
| S4: uma classe por rodovia estadual | contexto, **divergente** | 2011–2018 e 2022 |
| S5: % pavimentada da rede estadual no PNV/DNIT | contexto | 2001–2010 |

Linha AL da S3: 42,1 (2010) · 40,2 · 35,7 · 36,1 · 41,6 · 49,2 · 48,6 · 42,3 · 49,0 · 47,5 (2019) · 47,0 (2021) · 42,3 · 43,9 · 43,3 · **46,2 (2025)**. Em 2025 fica a 0,25 pp da base do painel, mas a S3 mistura rodovias federais e o ajuste por UF não bate.

**S4 é divergente.** O filtro "prefixo da UF" descartou rodovias estaduais coincidentes com prefixo T, como MAT-402/BR-402, AMT-174/BR-174 e TOT-010/BR-010. Com isso, MA fica 2 a 3 pp abaixo e AM até 5 pp abaixo em 2011–2018. Em 2022 essas rodovias entram, então a série tem uma quebra de cobertura.

**Problemas na base atual do painel. Vale levar à equipe que montou o xlsx:**
- AP e MT estão em exatamente 50,00%, ou seja, nenhum trecho recebeu classe. Mesmo assim, a CNT avaliou 82 km de rodovias estaduais no AP e 2.947 km em MT em 2025.
- RO (49,89%) e RR (50,59%) não têm nenhuma avaliação estadual da CNT. O piso de 0,5 sozinho não explica RR acima de 50.
- O km físico por UF não coincide com nada que a CNT publica. MT tem 1.047 km no painel contra 2.947 km de estaduais na CNT. MA tem 10.297 km contra 1.342.

---

## I4.3.1 — Transição energética (ITEQ)

**Não há como calcular nem reproduzir o ITEQ.** A linha de base de 60,13% não sai por nenhuma leitura, porque a ficha não dá:
- a função de Fdist (penalização por DEC/FEC);
- o Fiso;
- os pesos socioambientais das fontes;
- a base municipal de R_SISOL.

Duas leituras opostas chegam a cerca de 1 pp do alvo, então essa proximidade não identifica a fórmula. O que bloqueia o indicador é a especificação, não o dado.

| Série | Rótulo | Anos |
|---|---|---|
| POP_SISOL: população em sistemas isolados por UF (relatórios da EPE, sem o PASI) | componente | 2018–2025 (8 ciclos) |
| POP_SISOL / população total | componente | 2018–2025 |
| DEC e FEC apurados por UF | componente | 2004–2025 |
| % dos consumidores em conjuntos dentro dos limites de DEC/FEC (no lugar de Fdist) | proxy | 2004–2025 |
| Renovabilidade da geração do SIN por UF (ONS, em energia) | proxy | 2000–2025 |
| Foto da potência limpa do SIGA (01/10/2026) | proxy (rebaixada de componente) | 2026 |
| ITEQ montado com Fiso = 1 e R_SISOL = 0 | proxy, **não usar** | 2018–2025 |
| PNAD: domicílios com energia elétrica | contexto, **divergente** | 2001–2025 |
| PNAD Contínua: rede geral em tempo integral | contexto | 2016–2025 |
| Consumidores em sistemas isolados, Brasil | contexto | 2011–2025 |
| Luz para Todos nas regiões remotas, por UF | contexto | 2020–2025 |

- O ITEQ montado oscila cerca de 20 pp entre 2020 e 2021 por efeito de limiar e fica 6 pp acima da linha de base.
- **A série da PNAD é divergente** por dois motivos:
  - de 2001 a 2015 o CSV usa a razão de contagens arredondadas, não o percentual publicado (variável 1000096), e chega a errar 0,96 pp;
  - até 2003 a PNAD não cobria a área rural do Norte, então as quedas de AM e AC em 2004 são artefato.
- **Atualizar o status do catálogo.** O DEC/FEC por conjunto elétrico existe nos dados abertos da ANEEL, em CSV e parquet, e o POP_SISOL por UF existe nos relatórios da EPE desde 2018.

---

## I4.3.2 — Participação de renováveis (PER)

**Exata em relação ao painel.** `per_potencia_fotografias_uf.csv` traz 13 fotografias da potência em operação por UF e fonte. Elas vêm do BIG da ANEEL guardado no Wayback (2002, 2008, 2011, 2016) e de CSVs do SIGA no Wayback e no CKAN (2022 a 2026).
- Cada fotografia é a lista real de usinas naquela data. Por isso não tem o viés de sobrevivência da reconstrução que foi descartada.
- A fotografia de 25/08/2026 reproduz o painel (AL 85,22 contra 85,2; nove UFs dentro de 0,05).

| AL | 2002 | ≈2007 | 2011 | 2016 | 2022 | ≈2024 | ≈2025 | 25/08/2026 (painel) | 01/10/2026 |
|---|---|---|---|---|---|---|---|---|---|
| Média simples dos estados (é o que o painel mostra) | 36,5 | 48,2 | 44,7 | 55,8 | 60,4 | 60,8 | 61,0 | 60,9 | 60,6 |
| Ponderado pela potência | 67,2 | 77,2 | 75,1 | 78,8 | 85,8 | 85,7 | 85,7 | 85,2 | 83,8 |

No painel, entra um ponto por ano: a fotografia mais próxima de 31/12. O ponto de 2026 é a fotografia de 25/08/2026, que é a mesma base do valor atual. A de 01/10/2026 fica de fora (ver "Aplicado no painel local").

Cuidados ao usar:
- A coluna `principal_do_ano` escolhe para 2026 o ponto de 01/10. Esse ponto **já não bate** com o painel, porque nesse intervalo entraram térmicas a gás: Novo Tempo Barcarena (PA, 629 MW) e Manaus I (AM, 115 MW).
- Use `ano_referencia`, não `ano`: a captura de 12/01/2008 representa o fim de 2007.
- Não há fotografia entre março de 2016 e agosto de 2022. As capturas do BIG depois de 2017 são páginas de erro.

**Proxy e componentes:**
- **Reconstrução anual (2008–2025) entre as fotografias.** Proxy, com erro médio de 1 a 2 pp e até 12 pp quando uma térmica foi desligada. Não usar MA 2008.
- **PER de energia do ONS (2000–2025).** Proxy. A cobertura muda por UF:
  - PA e MT desde 2000;
  - TO desde 2002;
  - RO desde 2010;
  - MA desde 2012;
  - AM desde 2014;
  - AP desde 2015;
  - RR desde 2022;
  - AC sem dado.
- **GWh por UF e fonte (ONS).** Componente.
- **Geração hídrica CFURH (1997–2025).** Componente.
- **GD solar acumulada (2015–2026).** Rebaixada para contexto, porque a potência fiscalizada não inclui geração distribuída.
- **Tabelas da EPE.** Contexto.

**Nenhuma definição testada reproduz as linhas de base da ficha** (65,24% no catálogo e 62,5% na projeção).
- O mais perto foi a média simples dos estados no SIGA de 22/09/2025, 60,83.
- O ONS em 2025 dá 88,4% sem MMGD.
- Para reconciliar, é preciso a metodologia, com os pesos wk.

Outros dois pontos:
- O `matriz-eletrica.json` usa a Tabela 2.1 da EPE como série principal, e ela diverge da ANEEL em até 2 vezes em MT e TO.
- O verificador de I4.3.1 achou PA 98,6 no painel contra 95,98 no SIGA de 01/10. A diferença é de data da fotografia, não de método: o painel é de 25/08.

---

## I4.4.1 — Saneamento básico e gestão de riscos (ISGR)

**A decisão registrada foi mantida: nenhuma outra medida entra com o rótulo de ISGR.** O pipeline da MUNIC 2024 que o agente montou reproduz o ISGR do painel nas 9 UFs (diferença de 0,00 pp; AL 47,17).

| Série | Rótulo | Anos |
|---|---|---|
| PNAD Contínua: água por rede como fonte principal | proxy | 2016–2019, 2022–2025 |
| PNAD Contínua: água adequada, limites inferior e superior | proxy | 2016–2025 / 2019–2025 |
| PNAD Contínua: ligação à rede de água | proxy | 2019, 2022–2025 |
| PNAD Contínua: esgoto por rede, pluvial ou fossa ligada | proxy | 2016–2019, 2022–2025 |
| PNAD Contínua: esgoto adequado pela definição da ficha | contexto | 2019, 2022–2025 |
| PNAD 2001–2015: rede de água e rede coletora de esgoto | proxy | 2001–2015, sem 2010 |
| ODS 6.1.1 e 6.2.1 (IBGE) | contexto | 2016–2023 / 2017–2018 |
| SNIS IN055 (água) e IN056 (esgoto) | contexto, **divergentes** | 2001–2022 |
| SINISA: água e esgoto | contexto | 2023–2024 |
| MUNIC: Magr18 e Mhab088 | componente | 2017, 2020, 2024 |
| MUNIC: Mgov086 e fator FGov | componente | 2014, 2019, 2024 |
| MUNIC: Mtic266 | proxy (enunciado diferente em 2019) | 2019, 2024 |
| MUNIC: FClima com 2 das 3 variáveis | proxy | 2017, 2020, 2024 |

- **SNIS divergente.** Nas planilhas oficiais, TO fica 7 a 8 pp abaixo na água e cerca de 5 pp abaixo no esgoto. O G12A oficial de TO é maior que a própria população do estado, o que sugere dupla contagem no resumo oficial. O CSV é o mais plausível, mas não é o número publicado.
- **Ruído amostral.** A PNAD tem CV de até 10,6% na água (AP) e até 26% no esgoto. O esgoto do AP oscila entre 69,3 e 36,7 de 2019 a 2025.
- **Reprovada.** A PNAD "rede + fossa séptica" de 2001 a 2015 erra o Censo 2010 em 20 a 50 pp e ficou em `descartadas/`.
- **FClima de 2 variáveis distorce AM.** Em 2024 dá 0,9125 contra 0,994 com as 3, porque só Manaus se salva pelo Mtic266.
- **Corrigir a documentação.** INDICADORES_SEM_DADOS.md e `saneamento-censos.json` dizem que as MUNIC anteriores "têm outro questionário". O certo: nenhuma edição anterior reúne as 4 variáveis juntas, mas Magr18, Mhab088 e Mgov086 têm equivalentes em 2014, 2017, 2019 e 2020.

---

## I4.4.2 — Capacidade adaptativa urbana

**Estrutural, confirmado.** O escore é um corte único: cada nó do AdaptaBrasil tem um ano só.
- Os rótulos 2015, 2017, 2019 e 2020 dependem do setor e não são safras.
- O mesmo dado muda de rótulo entre versões da plataforma, com valores idênticos.

**Muda a documentação:**
- A API `sistema.adaptabrasil.mcti.gov.br`, dada como 403, hoje responde 200.
- O Painel Cidades também tem API pública (`api.painelcidades.adaptabrasil.mcti.gov.br/public/v1/`).
- O coletor pode passar a ser reproduzível.

**O valor do painel não se reproduz a partir do CSV bruto.** A média simples dos 36 subindicadores dá 27 municípios acima de 0,5 (25 escolhendo um id por nome). A planilha da Estratégia, que dá os 2,46% (19 de 773), não traz a regra.

**Contexto:**
- **SIDRA 6673 (ODS 11.b.2):** % de municípios com estratégia local de redução de risco de desastres, por UF, em 2013, 2017 e 2020. Mede uma coisa distinta do indicador.
- **11 índices oficiais de capacidade adaptativa:** % de municípios acima de 0,5. São cortes únicos e não formam série.

---

## Aplicado no painel local (07/10/2026, sem commit)

Nada foi commitado. As mudanças estão só nestes dois arquivos:
- `dashboard/conteudo/valores.csv`: +99 linhas, −45 linhas, todas de I4.1.1 e I4.3.2. Nenhuma outra linha mudou, e a ordem e o fim de linha do arquivo foram mantidos.
- `dashboard/conteudo/metas.json`: o bloco `trajetoria` do I4.1.1 e do I4.3.2.

Para desfazer:

```bash
git checkout -- dashboard/conteudo/valores.csv dashboard/conteudo/metas.json
```

Depois, rode `npm run build:static`.

**I4.1.1:** as 45 células de 2021 a 2025 trocam o IBC estadual simples pelo ponderado (`origem = script`, `por = eixo4_series_ibc`). A trajetória fica desligada, com nota.

Conferências:
- **Recálculo próprio:** refiz o cálculo a partir de `dados/anatel/IBC_municipios_indicadores_originais.csv`, o arquivo da ANATEL que já estava no projeto, com os pesos de `dados/ibge_pop/pop_mun_censo2022.csv`. Deu 50 de 50 células iguais.
- **Cobertura:** o número de municípios é constante em todos os anos.
- **Painel atual:** 2024 e 2025 batem com o painel nas 9 UFs.
- **Panorama:** a métrica `ibc` já tinha exatamente essas 45 células desde a migração de 13/09. Só a página de Metas usava outra série.
- **Efeito na página:** o valor (53,51) e a base de comparação não mudam. Sai a projeção "no ritmo, alcança 80 em 2031", que era efeito da troca de escala, e o IBC passa a aparecer em "Trajetória desligada".

**I4.3.2:** 54 células novas, nos anos 2011, 2015, 2022, 2024, 2025 e 2026, uma fotografia por ano. A nota de cada célula diz a data da fotografia.

O que ficou de fora, e por quê:
- **2002 e 2007:** MA não tem medida válida (0 MW em 2002 e 17 MW em 2007, contra 247 MW oficiais). Sem MA, a média simples regional desses anos seria de 8 estados.
- **01/10/2026:** o valor atual do painel continua sendo o de 25/08/2026. A fotografia de outubro já tem as térmicas novas do PA e do AM.

Conferências:
- **Capacidade oficial:** comparei os totais por UF com a série oficial da ANEEL (`capacidade-instalada-geracao-uf.csv`, 2006–2026). Bateram 97 de 108 pontos dentro de ±3%.
  - MA 2007 era o ponto ruim e ficou de fora.
  - AC 2022 (73 MW) confere com o oficial.
  - Agosto de 2011 fica abaixo do oficial de dezembro de 2011 em MA, TO e MT, porque Estreito e Dardanelos entraram em operação nesse intervalo. **Conferido:** nos 9 estados, a fotografia de agosto fica entre os números oficiais de dezembro de 2010 e de dezembro de 2011. A única exceção é RR, em que agosto é igual a dezembro de 2011 (122,6 MW) porque uma usina saiu antes.
- **Valor atual:** a fotografia de 2026 reproduz o painel em 9 de 9 UFs (diferença de arredondamento).

Efeito na página:
- O valor atual não muda (60,94).
- A base de comparação passa de 65,24 (escrito na meta) para 60,97, o valor da própria série em 2025. É a regra do pipeline: o número declarado só vale quando a série não tem o ano.
- A trajetória passa de "sem série" para "acelerar": +0,5 ponto por ano contra os 2,1 necessários, alcançando 80 em 2065.
- Por estado:
  - AP, MT, PA, RO e TO já estão em "cumprida";
  - MA fica em "contrário";
  - AC, AM e RR ficam em "acelerar", com ano de alcance acima de 2050, que a página mostra como "> 2050".

Contagem da trajetória regional no Panorama:
- "no ritmo" passa de 5 para 4;
- "acelerar" passa de 5 para 6;
- "sem série" passa de 14 para 13;
- "desligada" passa de 1 para 2.

**Validação:**
- `npm run build:static` passa pela validação da fonte.
- `npm run check:i18n` está em dia.
- Não há erro no console nem no servidor.

As notas de trajetória ficam só em português, como as que já existem (I1.1.2, I3.4.1).

Ferramenta quebrada: `npm run check:data` não roda mais sem argumento, porque compara com JSONs que deixaram de ser versionados. Com uma pasta de referência funciona:

```bash
node scripts/conferir-derivacao.mjs <pasta>
```

---

## Correções de documentação apontadas pela coleta

1. **RELATORIO_DE_COLETA §12 e INDICADORES_SEM_DADOS:**
   - CNT: há endpoint público dos painéis Power BI.
   - ANEEL: o DEC/FEC existe em dados abertos.
   - AdaptaBrasil: a API responde 200.
   - MUNIC: há equivalentes parciais em edições anteriores.
2. **Catálogo:** o status de I4.3.1 deve dizer que o bloqueio é a especificação (Fdist, Fiso, pesos, base municipal), não o dado.
3. **`anoRef` de I4.4.2:** "2020" é um rótulo da plataforma. Os insumos vão do Censo 2010 a 2023.
4. **Sigla `AL`:** qualquer junção com arquivos da ANATEL por `uf` mistura Amazônia Legal e Alagoas.
