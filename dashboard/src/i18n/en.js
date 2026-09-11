// Inglês do painel. A chave é o português tal como está no código — ver o
// cabeçalho de `index.js` para o porquê.
//
// Três regras seguidas aqui:
//
// 1. Nome de instituição e de programa não se traduz. IBGE, INPE, PRODES,
//    CNUC/MMA, Sinaflor/IBAMA, CAPAG/STN e PNAD Contínua são o endereço do dado:
//    trocá-los por uma versão em inglês romperia a trilha até a fonte. Quando a
//    sigla não diz nada sozinha, entra um aposto na primeira menção.
// 2. Sigla que é jargão em português vira palavra em inglês. "UCs" são
//    protected areas; "AL" é the Legal Amazon. Deixá-las cruas seria escrever
//    em português com letras inglesas.
// 3. Texto de tela é reescrito, não decalcado. "Jornada" não é "journey" numa
//    barra de progresso; é "of the way". "Ficha técnica" não é "technical
//    file"; é "technical sheet".

export const en = {
  // -------------------------------------------------------------------------
  // Esqueleto: topbar, navegação, rodapé
  // -------------------------------------------------------------------------
  'Estratégia 2050': 'Amazônia 2050',
  'Estratégia 2050 — Amazônia Legal': 'Amazônia 2050 — the Legal Amazon',
  'Estratégia Amazônia 2050 · Consórcio da Amazônia Legal':
    'Amazônia 2050 Strategy · Interstate Consortium for the Legal Amazon',
  'Estratégia 2050 do Consórcio da Amazônia Legal, início':
    'Amazônia 2050, Interstate Consortium for the Legal Amazon — home',
  'Pular para o conteúdo': 'Skip to content',
  'Navegação principal': 'Main navigation',
  'Seções do painel': 'Dashboard sections',
  Menu: 'Menu',
  Fechar: 'Close',
  'Abrir menu': 'Open menu',
  // Curto de propósito: com o seletor de idioma na barra, o rótulo longo
  // quebrava em duas linhas num aparelho de 320px.
  'Ver como no computador': 'Desktop view',
  'Ver versão para celular': 'Mobile view',

  // As três rotas. "Panorama" vira "Explore" porque a página é o explorador de
  // dados, e porque "Overview" já é o nome da outra — em português os dois
  // rótulos não colidem, em inglês colidiriam.
  Panorama: 'Explore',
  'Visão Geral': 'The Strategy',
  'Metas e indicadores': 'Goals & indicators',

  'Como ler os dados': 'How to read the data',
  'Sobre a Estratégia': 'About the Strategy',
  'Baixar nota técnica': 'Download the technical note',

  // Rodapé do inglês: o painel publica números oficiais, e a redação que vale
  // é a portuguesa.
  'English is a courtesy translation. The official wording is the Portuguese one.':
    'English is a courtesy translation. The official wording is the Portuguese one.',

  // -------------------------------------------------------------------------
  // Panorama
  // -------------------------------------------------------------------------
  'Painel de metas e indicadores dos nove estados da Amazônia Legal.':
    'Goals and indicators for the nine states of the Legal Amazon.',
  'Nove estados, 59 indicadores e evidências para acompanhar a Amazônia Legal.':
    'Nine states, 59 indicators and the evidence to follow the Legal Amazon.',
  'Panorama - ': 'At a glance - ',
  'Amazônia Legal.': 'the Legal Amazon.',
  'Explore os indicadores oficiais e compare os nove estados':
    'Explore the official indicators and compare the nine states',
  'Indicador exibido': 'Indicator shown',
  'Ano exibido': 'Year shown',
  'Carregando indicador…': 'Loading the indicator…',
  'Amazônia Legal, visão regional': 'The Legal Amazon, regional view',
  'Amazônia Legal — visão regional': 'The Legal Amazon — regional view',
  'Mapa dos estados da Amazônia Legal. Selecione um estado para atualizar o painel lateral.':
    'Map of the states of the Legal Amazon. Select a state to update the side panel.',
  'Escala de desempenho relativo': 'Relative performance scale',
  'menor desempenho': 'lower performance',
  'maior desempenho': 'higher performance',

  'Resumo regional': 'Regional summary',
  'População observada': 'Population',
  'projeção IBGE para 2025': 'IBGE projection for 2025',
  Território: 'Territory',
  'área total dos nove estados': 'combined area of the nine states',
  Municípios: 'Municipalities',
  'na Amazônia Legal · base AdaptaBrasil': 'in the Legal Amazon · AdaptaBrasil',
  'Unidades de conservação': 'Protected areas',
  'federais e estaduais · CNUC/MMA 2026': 'federal and state · CNUC/MMA 2026',

  'Detalhes e comparação estadual': 'State detail and comparison',
  'Conteúdo da coluna lateral': 'Side column content',
  'Visão geral': 'Overview',
  'Comparação estadual': 'State comparison',
  'Visão geral da região ou do estado selecionado':
    'Overview of the region or of the selected state',
  'Carregando painel…': 'Loading panel…',
  'Síntese comparativa': 'Comparative index',
  'maior pontuação = melhor posição': 'higher score = better rank',
  Critérios: 'Criteria',

  // -------------------------------------------------------------------------
  // Metas e indicadores
  // -------------------------------------------------------------------------
  'Metas — Estratégia 2050': 'Goals — Amazônia 2050',
  'Cumprimento das metas da Estratégia Amazônia 2050 e catálogo completo dos indicadores da matriz de resultados.':
    'Progress against the Amazônia 2050 Strategy targets, with the full catalogue of the results matrix.',
  'Onde a Amazônia Legal já cumpre as metas da Estratégia, quanto falta e a ficha técnica de cada indicador.':
    'Where the Legal Amazon already meets the Strategy targets, how far the rest have to go, and the technical sheet behind each indicator.',
  'Metas - ': 'Goals - ',
  'Estado exibido na progressão das metas': 'State shown in the goal progress',
  'Busca e filtros': 'Search and filters',
  'Todos os indicadores': 'All indicators',
  'Buscar meta, indicador ou código': 'Search goals, indicators or codes',
  Eixo: 'Pillar',
  Coleta: 'Status',
  Baixar: 'Download',
  'Seleção atual em CSV': 'Current selection as CSV',
  'Matriz completa em XLSX': 'Full matrix as XLSX',
  'Metas e indicadores da Estratégia': 'Goals and indicators of the Strategy',
  'Metas e indicadores por eixo': 'Goals and indicators by pillar',
  'Todos os eixos': 'All pillars',
  Todos: 'All',
  Todas: 'All',

  // -------------------------------------------------------------------------
  // Quadro de metas: lista, gráfico e painel de detalhe
  //
  // "Jornada" é quanto do caminho até o patamar já foi percorrido. Em inglês
  // "journey" soaria a viagem; numa barra de progresso o que se diz é "of the
  // way", e como rótulo de coluna, "Progress".
  // -------------------------------------------------------------------------
  'Amazônia Legal (região)': 'The Legal Amazon (region)',
  'Amazônia Legal e estados': 'The Legal Amazon and its states',
  'Valores por estado': 'Figures by state',
  Ano: 'Year',
  'Selecionar ano': 'Select year',
  'Não há valores anuais disponíveis para este indicador.':
    'No annual figures are available for this indicator.',
  'Não há classificações estaduais disponíveis para {ano}.':
    'No state ratings are available for {ano}.',
  'Não há valores estaduais disponíveis para {ano}.':
    'No state figures are available for {ano}.',
  '{estado}: classificação {nota}': '{estado}: rated {nota}',
  'Classificação CAPAG dos estados em {ano}': 'CAPAG rating of the states in {ano}',
  'Escala CAPAG, de D a A mais': 'CAPAG scale, from D to A plus',
  'meta mínima: B': 'minimum target: B',
  'Valor da Amazônia Legal e dos estados em {ano}':
    'Figures for the Legal Amazon and its states in {ano}',
  'marcador da meta': 'target marker',

  'Valor atual': 'Current figure',
  Meta: 'Target',
  Jornada: 'Progress',
  jornada: 'of the way',
  'sem escala': 'no scale',
  'Meta pactuada': 'Agreed target',
  'Meta não informada.': 'No target recorded.',
  'Critério do patamar': 'How the target was set',
  Referência: 'Reference year',
  'Não informada': 'Not recorded',
  Critério: 'Criterion',
  'Meta declarada': 'Target stated in the matrix',
  'Meta inferida': 'Target inferred here',
  'Meta derivada da baseline': 'Target derived from the baseline',
  'Critério não informado': 'Criterion not recorded',
  'Leitura regional:': 'Regional figure:',
  'meta {patamar}{prazo}': 'target {patamar}{prazo}',
  ' até {prazo}': ' by {prazo}',
  'nos 9 estados': 'across the 9 states',
  'A ou B nos {total} estados': 'A or B in all {total} states',
  '{cumprem} de {total} estados': '{cumprem} of {total} states',
  '{cumprem} de {total}': '{cumprem} of {total}',
  'Sem dado': 'No data',
  'Sem escala': 'No scale',
  'sem dado': 'no data',

  Resultado: 'Result',
  'Ficha técnica': 'Technical sheet',
  'Faces deste indicador': 'Views of this indicator',
  'Fechar detalhes do indicador': 'Close indicator detail',
  'Carregando ficha técnica…': 'Loading technical sheet…',
  'Atualize a página para tentar novamente.': 'Reload the page to try again.',

  'Metas com patamar mensurável': 'Goals with a measurable target',
  'Demais indicadores do eixo': 'Other indicators in this pillar',
  'Indicadores do eixo': 'Indicators in this pillar',
  'Nenhum indicador corresponde aos filtros selecionados.':
    'No indicator matches the filters selected.',
  'Eixo {n}': 'Pillar {n}',
  '{n} eixo': '{n} pillar',
  '{n} eixos': '{n} pillars',
  '{n} indicador': '{n} indicator',
  '{n} indicadores': '{n} indicators',
  '<span>{total}</span> indicador · <span>{comMeta}</span> com meta mensurável':
    '<span>{total}</span> indicator · <span>{comMeta}</span> with a measurable target',
  '<span>{total}</span> indicadores · <span>{comMeta}</span> com meta mensurável':
    '<span>{total}</span> indicators · <span>{comMeta}</span> with a measurable target',
  'Não foi possível exportar': 'Export failed',
  'Preparando…': 'Preparing…',

  // Ficha técnica
  'Resumo do indicador': 'Indicator summary',
  'Dados complementares da ficha': 'Further detail from the sheet',
  'Cobertura nos estados': 'Coverage across the states',
  'Valor em {estado}': 'Figure for {estado}',
  'sem valor coletado': 'no figure collected',
  '{n} de 9': '{n} of 9',
  estados: 'states',
  'ref. {ano}': 'ref. {ano}',
  'Situação da coleta': 'Collection status',
  Prazo: 'Target year',
  Frequência: 'Frequency',
  'Fontes e referências': 'Sources and references',
  'Abrir referência{n}': 'Open reference{n}',
  'Método de cálculo': 'How it is calculated',
  'Como o indicador é medido': 'What the indicator measures',
  'Dados complementares': 'Further detail',
  'Linha de ação': 'Action line',
  Unidade: 'Unit',
  Pontuação: 'Score',
  'Definição não informada.': 'No definition recorded.',
  'Fórmula não informada na ficha técnica.': 'No formula recorded in the technical sheet.',
  'Ficha técnica não localizada no documento.': 'Technical sheet not found in the source document.',
  'Este indicador consta na matriz consolidada; são exibidas abaixo apenas as informações disponíveis no catálogo.':
    'This indicator appears in the consolidated matrix; what follows is only what the catalogue carries.',
  'Não foi possível carregar o catálogo.': 'The catalogue could not be loaded.',
  'Não foi possível carregar a nota metodológica.': 'The methodological note could not be loaded.',
  'As fontes não puderam ser carregadas.': 'The sources could not be loaded.',

  // Valores enumerados das fichas. São poucos e repetem-se entre os 59, então
  // vivem aqui em vez de uma entrada por indicador na sobreposição de conteúdo.
  Anual: 'Annual',
  anual: 'annual',
  Mensal: 'Monthly',
  'A cada ciclo oficial de atualização das séries do AdaptaBrasil/MCTI':
    'With each official update of the AdaptaBrasil/MCTI series',
  'elaboração inicial - 2027 / revisão contínua até 2050':
    'first version by 2027 / revised continuously through 2050',
  Pessoas: 'People',
  pessoas: 'people',
  Programas: 'Programmes',
  'Por morte': 'Per death',
  '0 a 100': '0 to 100',
  '0 a 100%': '0 to 100%',
  '0 a 10': '0 to 10',
  '0 a 10.000': '0 to 10,000',
  '0 a 4': '0 to 4',
  '0 100': '0 to 100',
  '100 mil pessoas': '100,000 people',
  planos: 'plans',
  reais: 'reais',
  Reais: 'Reais',
  'bancos de dados integrados': 'integrated databases',
  'E até A': 'E to A',
  Modelos: 'Models',
  'quanto menor melhor': 'lower is better',
  Positiva: 'Positive',

  // Unidades do catálogo. "nº" é a abreviação portuguesa de número; em inglês
  // não há abreviação equivalente de uso corrente, então vira "no. of" ou
  // simplesmente o plural do que se conta.
  '% / Sim-Não': '% / yes-no',
  'nº (0-9)': 'number (0–9)',
  'nº / Sim-Não': 'number / yes-no',
  'pontos (0-100)': 'points (0–100)',
  '% / ha': '% / hectares',
  '% / dias': '% / days',
  nº: 'number',
  'Sim-Não / ha': 'yes-no / hectares',
  'nº / %': 'number / %',
  'nº de programas': 'programmes',
  'taxa / 100 mil': 'rate per 100,000',
  'nº de municípios': 'municipalities',
  'nº de cadeias': 'value chains',
  'nº de UFs': 'states',
  'nº de beneficiários': 'beneficiaries',
  'nº / R$': 'number / R$',
  'nº de vínculos': 'formal jobs',
  'R$ (mil)': 'R$ (thousands)',
  '% de municípios': '% of municipalities',
  'R$ privado / R$ público': 'private R$ / public R$',
  '% / bases': '% / databases',
  '% do PIB': '% of GDP',
  'grau A-C': 'grade A–C',
  modelos: 'models',

  // Por que um indicador não entra no quadro de metas. Sete frases escritas
  // pelo metas.mjs — texto nosso, e não das planilhas de origem.
  'O indicador ainda não tem valores coletados para os nove estados.':
    'This indicator has no figures collected for the nine states yet.',
  'A meta não define um patamar numérico comparável aos valores coletados.':
    'The target sets no numerical threshold that the collected figures can be measured against.',
  'A meta é de redução de 50% na região, sem baseline informada no catálogo. Sem o ponto de partida não há como dizer se um estado está cumprindo.':
    'The target is a 50% regional reduction, but the catalogue records no baseline. Without a starting point there is no way to say whether a state is on track.',
  'A meta é de cobertura de 100% da população, mas os valores coletados são o número de equipes de atenção primária, não o percentual de cobertura.':
    'The target is 100% population coverage, but what was collected is the number of primary care teams, not the coverage rate.',
  'A meta é ter telessaúde em pelo menos 50% dos municípios; o valor coletado é a contagem absoluta de municípios atendidos, sem o total municipal por estado no catálogo.':
    'The target is telehealth in at least 50% of municipalities; what was collected is the raw count of municipalities served, and the catalogue carries no municipal total per state.',
  'A meta de aumento de R$ 100 milhões não indica a que baseline se refere nem se é por estado ou regional.':
    'The R$ 100 million increase does not say which baseline it refers to, nor whether it is per state or regional.',
  'A ficha define estruturação de cadeias produtivas de forma qualitativa, sem patamar numérico.':
    'The technical sheet defines value-chain development in qualitative terms, with no numerical threshold.',
  'A meta é de crescimento de 10% ao ano em valores nominais. Avaliar cumprimento por um único ano de variação diria mais sobre inflação e base de comparação do que sobre a meta de 2050.':
    'The target is 10% growth a year in nominal terms. Judging it on a single year of change would say more about inflation and the comparison base than about the 2050 goal.',

  // Unidades de metas.js
  'pontos percentuais': 'percentage points',
  hectares: 'hectares',
  ocorrências: 'cases',
  'por 100 mil habitantes': 'per 100,000 inhabitants',
  pontos: 'points',

  // -------------------------------------------------------------------------
  // Situação da coleta
  // -------------------------------------------------------------------------
  Coletado: 'Collected',
  Parcial: 'Partial',
  Pendente: 'Pending',
  'Não coletado': 'Not collected',

  // -------------------------------------------------------------------------
  // Visão Geral — as cinco lâminas
  //
  // Copy institucional. PPA, LDO e LOA são os instrumentos do ciclo orçamentário
  // brasileiro e não têm equivalente em inglês: ficam com o nome e um aposto na
  // primeira menção, porque um leitor de fora precisa saber o que são e um de
  // dentro precisa reconhecê-los.
  // -------------------------------------------------------------------------
  'Visão Geral — Estratégia 2050': 'The Strategy — Amazônia 2050',
  carrossel: 'carousel',
  'Visão Geral da Estratégia Amazônia 2050': 'Overview of the Amazônia 2050 Strategy',
  'Slides; use as setas para navegar': 'Slides; use the arrow keys to move between them',
  'Navegação dos slides': 'Slide navigation',
  'Slide anterior': 'Previous slide',
  'Próximo slide': 'Next slide',
  Anterior: 'Previous',
  Próximo: 'Next',

  'Consórcio da Amazônia Legal · Brasília, 2026':
    'Interstate Consortium for the Legal Amazon · Brasília, 2026',
  'A Estratégia Regional': 'The regional strategy',
  'Amazônia 2050': 'Amazônia 2050',
  'Um instrumento de planejamento regional de longo prazo, que estabelece uma visão compartilhada de desenvolvimento sustentável para os nove estados da Amazônia Legal até 2050. É distinta do Planejamento Estratégico do Consórcio, que organiza a atuação institucional da autarquia.':
    'A long-term regional planning instrument that sets out a shared vision of sustainable development for the nine states of the Legal Amazon through to 2050. It is a separate document from the Consortium’s own Strategic Plan, which governs how the authority itself operates.',
  'estados consorciados': 'member states',
  'temas estratégicos': 'strategic themes',
  'horizonte pactuado': 'agreed target year',
  'Construída ao longo de 2025 em processo participativo, a partir da solicitação do Ministério do Planejamento e Orçamento para a Estratégia Brasil 2050. Teve Grupo de Trabalho com os nove estados, oficina presencial em Belém e apoio técnico do IPAM. Foi apresentada na COP30 como uma das principais entregas do Consórcio.':
    'Built through 2025 in a participatory process, at the request of the Ministry of Planning and Budget for the Brasil 2050 Strategy. It drew on a working group with all nine states, an in-person workshop in Belém and technical support from IPAM. It was presented at COP30 as one of the Consortium’s flagship deliverables.',
  'Primeiro Planejamento do Consórcio, com as diretrizes regionais essenciais.':
    'The Consortium’s first plan, setting out the essential regional guidelines.',
  'Revisão do instrumento, consolidando aprendizados e novas prioridades.':
    'A revision of the instrument, consolidating lessons learned and new priorities.',
  'Planejamento Estratégico, que orienta a atuação institucional.':
    'Strategic Plan, which guides how the institution operates.',
  'Estratégia Amazônia 2050, o horizonte regional de longo prazo.':
    'Amazônia 2050 Strategy, the long-term regional horizon.',

  'O horizonte': 'The horizon',
  'A visão regional para 2050': 'The regional vision for 2050',
  'Visão 2050': 'Vision 2050',
  'Em 2050, a Amazônia Legal terá alcançado o desenvolvimento regional sustentável e a resiliência climática, conciliando conservação ambiental, crescimento econômico e justiça social. A região será reconhecida pelo equilíbrio entre produção e conservação, pela valorização de seus ativos ambientais e pela melhoria dos indicadores socioeconômicos.':
    'By 2050 the Legal Amazon will have achieved sustainable regional development and climate resilience, reconciling environmental conservation, economic growth and social justice. The region will be known for the balance it strikes between production and conservation, for the value it places on its environmental assets, and for improvement across its socioeconomic indicators.',
  'Os saberes e modos de vida dos povos e comunidades tradicionais serão preservados, assegurando qualidade de vida, inclusão e contribuição efetiva para a estabilidade climática global.':
    'The knowledge and ways of life of Indigenous peoples and traditional communities will be preserved, securing quality of life, inclusion and a real contribution to global climate stability.',
  'Na prática': 'In practice',
  'Como a Estratégia auxilia os estados': 'What the Strategy does for the states',
  'Alinha a visão de longo prazo ao planejamento governamental de médio prazo.':
    'Aligns the long-term vision with medium-term government planning.',
  'Subsidia a revisão e a formulação de PPAs, LDOs e planos setoriais.':
    'Informs the drafting and revision of multi-year plans (PPA), budget guidelines (LDO) and sector plans.',
  'Dá coerência entre as prioridades estaduais e a agenda regional.':
    'Keeps state priorities and the regional agenda coherent with one another.',
  'Fortalece a articulação com a União, organismos multilaterais e financiadores.':
    'Strengthens engagement with the federal government, multilateral bodies and funders.',
  'Qualifica a priorização de investimentos estruturantes.':
    'Sharpens the case for prioritising structural investment.',

  'Estrutura da Estratégia': 'How the Strategy is organised',
  'Seis temas estratégicos': 'Six strategic themes',
  'Os temas organizam as prioridades regionais e servem de referência para a leitura dos indicadores deste painel.':
    'The themes organise the regional priorities and frame how the indicators in this dashboard should be read.',
  'Integração regional': 'Regional integration',
  'Ordenamento territorial, segurança fundiária, conectividade física e digital e cooperação interestadual e transfronteiriça.':
    'Land-use planning, secure land tenure, physical and digital connectivity, and cooperation between states and across borders.',
  'Sistemas produtivos sustentáveis': 'Sustainable production systems',
  'Uma economia de baixo carbono, inovadora e centrada na sociobiodiversidade, gerando valor e renda a partir da floresta em pé.':
    'A low-carbon, innovative economy built on socio-biodiversity, generating value and income from the forest left standing.',
  'Soluções baseadas na natureza': 'Nature-based solutions',
  'Valorização econômica dos ativos ambientais, com conservação, restauração e uso sustentável dos ecossistemas.':
    'Putting economic value on environmental assets, through conservation, restoration and sustainable use of ecosystems.',
  'Transição energética': 'Energy transition',
  'A Amazônia como polo de inovação em energia limpa, ampliando o acesso à energia renovável.':
    'The Amazon as a hub for clean-energy innovation, widening access to renewable power.',
  'Inclusão social e resiliência': 'Social inclusion and resilience',
  'Redução de desigualdades, acesso a serviços essenciais e resiliência das populações frente às mudanças climáticas.':
    'Narrowing inequality, securing access to essential services, and building people’s resilience to climate change.',
  'Infraestrutura sustentável': 'Sustainable infrastructure',
  'Infraestrutura física, logística e digital integrada e resiliente, respeitando os limites socioambientais.':
    'Physical, logistical and digital infrastructure that is integrated and resilient, and that respects social and environmental limits.',

  Implementação: 'Implementation',
  'Governança e próximos passos': 'Governance and next steps',
  'Priorização e aderência': 'Priorities that fit',
  'Consolidar e validar as prioridades estaduais, com aderência à realidade de cada território.':
    'Consolidate and validate state priorities so that they match the reality of each territory.',
  'Qualificação de projetos': 'Project readiness',
  'Mapear os projetos prioritários, identificando maturidade, gargalos e oportunidades.':
    'Map the priority projects, identifying how ready each one is, where it is stuck and where the openings are.',
  'Compatibilização institucional': 'Fitting the budget cycle',
  'Integrar a Estratégia aos PPAs, LDOs, LOAs e planos setoriais.':
    'Write the Strategy into the multi-year plans (PPA), budget guidelines (LDO), annual budgets (LOA) and sector plans.',
  'Articulação transversal': 'Working across departments',
  'Articular secretarias finalísticas e áreas técnicas entre as agendas.':
    'Bring line departments and technical teams together across the agendas.',
  'Interdependência regional': 'Regional interdependence',
  'Incorporar a lógica regional ao planejamento estadual.':
    'Build the regional logic into state-level planning.',
  'Monitoramento e avaliação': 'Monitoring and evaluation',
  'Acompanhar a Estratégia e manter indicadores e metas atualizados.':
    'Track the Strategy and keep its indicators and targets current.',
  'Definição de prioridades regionais': 'Set the regional priorities',
  'Compatibilização com os PPAs estaduais': 'Align with the state multi-year plans',
  'Desdobramento em LDO, LOA e planos setoriais':
    'Carry through into budget guidelines, annual budgets and sector plans',
  'Monitoramento e avaliação regional': 'Monitor and evaluate at regional level',

  'Este painel': 'This dashboard',
  'Como os dados são lidos aqui': 'How the data is read here',
  'O painel organiza indicadores de fontes públicas para comparar os nove estados. Ele antecipa uma leitura enquanto a metodologia de monitoramento da Estratégia não é definida.':
    'The dashboard draws indicators from public sources so the nine states can be compared. It is a first reading, standing in until the Strategy’s own monitoring methodology is settled.',
  'Períodos diferentes': 'Different reference years',
  'Cada base entra com seu período mais recente, então os anos de referência não são uniformes entre indicadores.':
    'Each source comes in at its own most recent period, so reference years are not uniform across indicators.',
  'Fontes consolidadas': 'Consolidated sources',
  'Carregando fontes…': 'Loading sources…',
  'Ver o cumprimento das metas': 'See progress against the targets',
  'Explorar metas e indicadores': 'Explore goals and indicators',
  'A Estratégia': 'The Strategy',
  'Temas estratégicos': 'Strategic themes',
  Governança: 'Governance',

  // Fotografias das lâminas. Topônimo e nome de autor ficam; descrição e frase
  // de abertura são reescritas.
  'Rio Solimões · Amazonas': 'Rio Solimões · Amazonas',
  'Floresta amazônica · Amazonas': 'Amazon rainforest · Amazonas',
  'Jalapão · Tocantins': 'Jalapão · Tocantins',
  'Ver-o-Peso · Belém, Pará': 'Ver-o-Peso · Belém, Pará',
  'Teatro Amazonas · Manaus': 'Teatro Amazonas · Manaus',
  'Vista aérea do rio Solimões entre áreas de floresta amazônica.':
    'Aerial view of the Solimões river running between stretches of Amazon rainforest.',
  'Vista aérea da floresta e de um rio próximo a Manaus, no Amazonas.':
    'Aerial view of forest and a river near Manaus, in Amazonas.',
  'Paisagem do Parque Estadual do Jalapão, no Tocantins.':
    'Landscape of the Jalapão State Park, in Tocantins.',
  'O Mercado de Ferro do Ver-o-Peso, com suas torres, e barcos de pesca atracados à frente, em Belém.':
    'The turreted iron market hall at Ver-o-Peso, with fishing boats moored in front of it, in Belém.',
  'Fachada e cúpula do Teatro Amazonas, em Manaus.':
    'The façade and dome of the Teatro Amazonas, in Manaus.',
  // -------------------------------------------------------------------------
  // Painel do Panorama: os dezoito indicadores do mapa
  //
  // A legenda "menor taxa = melhor posição" é a chave de leitura do ranking, e
  // em inglês a forma natural é a comparativa curta: "lower rate = better rank".
  // -------------------------------------------------------------------------
  'Desmatamento PRODES': 'Deforestation (PRODES)',
  'menor taxa = melhor posição': 'lower rate = better rank',
  'Área desmatada detectada pelo PRODES, ajustada para cada mil km² do território estadual.':
    'Area cleared as detected by PRODES, expressed per thousand km² of the state’s territory.',
  'PRODES/INPE': 'PRODES/INPE',
  'Focos de calor': 'Fire hotspots',
  'menos focos = melhor posição': 'fewer hotspots = better rank',
  'Focos de calor detectados pelo satélite de referência do INPE, por mil km² de área do estado. É contagem de focos, não área queimada.':
    'Fire hotspots detected by INPE’s reference satellite, per thousand km² of state area. It counts hotspots, not burned area.',
  'INPE/Queimadas · satélite de referência': 'INPE/Queimadas · reference satellite',
  Pobreza: 'Poverty',
  'menor percentual = melhor posição': 'lower share = better rank',
  'Percentual da população abaixo da linha de pobreza regional do IBGE (indicador ODS P1.1.1), na série anual da PNAD Contínua.':
    'Share of the population below IBGE’s regional poverty line (SDG indicator P1.1.1), from the annual PNAD Contínua series.',
  'IBGE/PNADc · ODS P1.1.1': 'IBGE/PNADc · SDG P1.1.1',
  'Frequência escolar 15–17': 'School attendance, ages 15–17',
  'maior percentual = melhor posição': 'higher share = better rank',
  'Parcela das pessoas de 15 a 17 anos que frequentam a escola em cada estado, na série anual da PNAD Contínua.':
    'Share of 15-to-17-year-olds attending school in each state, from the annual PNAD Contínua series.',
  'IBGE/PNADc · módulo Educação': 'IBGE/PNADc · education module',
  'Segurança (CVLI)': 'Violent deaths (CVLI)',
  'Crimes violentos letais intencionais registrados para cada 100 mil habitantes.':
    'Intentional violent deaths recorded per 100,000 inhabitants.',
  'Sinesp/MJ': 'Sinesp/MJ',
  'Atenção primária': 'Primary health care',
  'maior cobertura = melhor posição': 'wider coverage = better rank',
  'Cobertura populacional estimada da Atenção Primária à Saúde. A partir de 2021 a medida parte da capacidade de atendimento das equipes e por isso passa de 100% em vários estados.':
    'Estimated share of the population covered by primary health care. From 2021 the measure starts from what the teams can handle, which is why several states come out above 100%.',
  'MS/e-Gestor · cobertura APS': 'Ministry of Health / e-Gestor · primary care coverage',
  'Vulnerabilidade climática': 'Climate vulnerability',
  'menor índice = melhor posição': 'lower index = better rank',
  'Média estadual do índice municipal de vulnerabilidade às mudanças climáticas.':
    'State average of the municipal index of vulnerability to climate change.',
  'AdaptaBrasil · linha de base 2025': 'AdaptaBrasil · 2025 baseline',
  'Gestão de unidades de conservação': 'Protected-area management',
  'Percentual de unidades estaduais com plano de manejo e conselho gestor registrados.':
    'Share of state protected areas with a registered management plan and governing council.',
  'CNUC/MMA · referência 2026': 'CNUC/MMA · 2026 reference',
  'Conectividade digital (IBC-AMZ)': 'Digital connectivity (IBC-AMZ)',
  'maior índice = melhor posição': 'higher index = better rank',
  'Índice de Conectividade da Amazônia Legal ponderado pela população municipal.':
    'Legal Amazon connectivity index, weighted by municipal population.',
  ANATEL: 'ANATEL',
  'Renovabilidade da matriz elétrica': 'Renewable share of power capacity',
  'Participação de fontes renováveis na potência de geração fiscalizada em operação.':
    'Share of renewable sources in the licensed generating capacity in operation.',
  'ANEEL/SIGA · base ago. 2026': 'ANEEL/SIGA · Aug 2026 extract',
  'Saneamento e gestão de riscos': 'Sanitation and risk management',
  'Proxy do ISGR com água e esgoto adequados (Censo 2022) e fatores climáticos e de governança (MUNIC 2024).':
    'Proxy for the ISGR index, combining adequate water and sewerage (2022 Census) with climate and governance factors (MUNIC 2024).',
  'IBGE · Censo 2022 + MUNIC 2024': 'IBGE · 2022 Census + MUNIC 2024',
  'Produção da sociobioeconomia': 'Socio-bioeconomy output',
  'maior valor = melhor posição': 'higher value = better rank',
  'Valor da produção da extração vegetal (PEVS), proxy da sociobioeconomia da Estratégia 2050.':
    'Value of plant extraction and forestry output (PEVS), used as a proxy for the Strategy’s socio-bioeconomy.',
  'IBGE/PEVS': 'IBGE/PEVS',
  'Transformação industrial': 'Industrial output',
  'Valor da transformação industrial das empresas com 5 ou mais pessoas ocupadas.':
    'Value added by manufacturing in firms with five or more employees.',
  'IBGE/PIA-Empresa': 'IBGE/PIA-Empresa',
  'IDEB anos iniciais': 'IDEB, primary',
  'maior nota = melhor posição': 'higher score = better rank',
  'Índice de Desenvolvimento da Educação Básica nos anos iniciais do ensino fundamental, rede total. Bienal.':
    'Basic Education Development Index (IDEB) for primary education, years 1 to 5, all school systems. Published every two years.',
  'INEP/IDEB': 'INEP/IDEB',
  'IDEB anos finais': 'IDEB, lower secondary',
  'Índice de Desenvolvimento da Educação Básica nos anos finais do ensino fundamental, rede total. Bienal.':
    'Basic Education Development Index (IDEB) for lower secondary education, years 6 to 9, all school systems. Published every two years.',
  'IDEB ensino médio': 'IDEB, upper secondary',
  'Índice de Desenvolvimento da Educação Básica no ensino médio, rede total. Bienal.':
    'Basic Education Development Index (IDEB) for upper secondary education, all school systems. Published every two years.',
  'P&D estadual (% do PIB)': 'State R&D (% of GDP)',
  'Dispêndio dos governos estaduais em pesquisa e desenvolvimento como parcela do PIB, no último ano disponível de cada estado (2022–2023).':
    'State government spending on research and development as a share of GDP, in each state’s latest available year (2022–2023).',
  'MCTI + IBGE/SIDRA': 'MCTI + IBGE/SIDRA',

  // Como o valor regional é montado, e o que cada método ressalva.
  'área desmatada dos nove estados sobre a área da região':
    'area cleared across the nine states over the area of the region',
  'total de focos sobre a área da região': 'total hotspots over the area of the region',
  'total de CVLI sobre a população regional': 'total violent deaths over the regional population',
  'média ponderada pela população': 'population-weighted average',
  'média simples dos nove estados': 'simple average of the nine states',
  'soma dos nove estados': 'sum of the nine states',
  'unidades com plano e conselho sobre o total de unidades':
    'areas with a plan and a council over all protected areas',
  'A contagem vem só do satélite de referência do INPE. A série de todos os satélites é maior, mas não serve para comparar anos, porque o número de satélites mudou ao longo do tempo.':
    'The count comes from INPE’s reference satellite alone. The all-satellite series is larger, but it cannot be compared across years, because the number of satellites changed over time.',
  'Rondônia fica sem 2006 e sem 2016: para esses dois anos o servidor do INPE entrega o arquivo do ano anterior, então não há medição própria a mostrar.':
    'Rondônia has no figure for 2006 or 2016: for those two years INPE’s server returns the previous year’s file, so there is no measurement of its own to show.',
  'Nos anos anteriores a ponderação usa a população de 2025, a única que o painel carrega; o ano de referência é exato.':
    'For earlier years the weighting uses the 2025 population, the only one the dashboard loads; the reference year itself is exact.',
  'A cobertura acima de 100% não é erro: desde 2021 a medida compara a capacidade de atendimento das equipes com a população, e não o número de pessoas efetivamente cadastradas.':
    'Coverage above 100% is not a mistake: since 2021 the measure compares what the teams can handle against the population, rather than counting people actually registered.',
  'A série tem quebra de metodologia em 2021. Até 2020 vale a regra da Atenção Básica, que divide equipes parametrizadas pela população e trava em 100%; de 2021 em diante vale a do Previne Brasil. O salto entre os dois anos é mudança de definição, não de cobertura.':
    'The series breaks methodologically in 2021. Up to 2020 it follows the old primary-care rule, which divides standardised teams by population and caps at 100%; from 2021 it follows the Previne Brasil rule. The jump between those two years is a change of definition, not of coverage.',
  'Ponderação pela população total de cada estado, e não pela população de 15 a 17 anos, que não está na base consolidada.':
    'Weighted by each state’s total population rather than by its 15-to-17-year-olds, which the consolidated base does not carry.',
  'O módulo de Educação da PNAD Contínua não foi a campo em 2020 e 2021, então esses dois anos não estão no seletor e o intervalo de 2019 a 2022 não é uma variação anual.':
    'The PNAD Contínua education module was not fielded in 2020 or 2021, so those years are absent from the selector and the 2019-to-2022 gap is not a year-on-year change.',
  'Média simples dos nove estados. A leitura correta ponderaria pelo número de municípios de cada estado, que não está na base consolidada.':
    'Simple average of the nine states. A correct reading would weight by each state’s number of municipalities, which the consolidated base does not carry.',
  'Média simples dos nove estados. A leitura regional correta ponderaria pela potência instalada de cada estado, que não está na base consolidada.':
    'Simple average of the nine states. A correct regional reading would weight by each state’s installed capacity, which the consolidated base does not carry.',
  'Média ponderada pela população total do estado. O correto seria ponderar pelo número de matrículas da etapa, que o painel não carrega. O IDEB é bienal, então a série tem um ponto a cada dois anos.':
    'Weighted by each state’s total population. The right weight would be enrolment in the relevant stage, which the dashboard does not carry. IDEB is published every two years, so the series has one point every other year.',
  'Média simples dos nove estados. Ponderar pelo PIB exigiria o PIB do mesmo ano de referência em todos os estados, o que a série não oferece.':
    'Simple average of the nine states. Weighting by GDP would require GDP for the same reference year in every state, which the series does not offer.',
  'Em 2021 e 2023 só oito estados têm valor, então a média desses anos não é composta pelos mesmos estados dos demais.':
    'In 2021 and 2023 only eight states have a figure, so the average for those years is not built from the same set of states as the rest.',

  // -------------------------------------------------------------------------
  // Painel lateral do Panorama
  // -------------------------------------------------------------------------
  'Perspectiva regional': 'Regional view',
  'Amazônia Legal': 'The Legal Amazon',
  'Bandeira da Amazônia Legal': 'Flag of the Legal Amazon',
  'Bandeira do {estado}': 'Flag of {estado}',
  'Resumo da região': 'Regional summary',
  População: 'Population',
  'projeção IBGE 2025': 'IBGE projection, 2025',
  'Área territorial': 'Land area',
  'base cartográfica': 'cartographic base',
  'UCs cadastradas': 'Protected areas',
  'federais e estaduais': 'federal and state',
  '{estados} estados · {municipios} municípios': '{estados} states · {municipios} municipalities',
  '{valor} pessoas': '{valor} people',
  'Indicador selecionado na região': 'Selected indicator for the region',
  'ano de referência': 'reference year',
  'sem valor regional': 'no regional figure',
  'Não se aplica': 'Not applicable',
  '{indicador} · por {metodo}': '{indicador} · by {metodo}',
  '{indicador} é uma escala relativa entre os nove estados, então a média regional seria sempre próxima de 50 e não descreveria a região.':
    '{indicador} is a relative scale across the nine states, so a regional average would always sit near 50 and would say nothing about the region.',
  'Série histórica regional': 'Regional time series',
  'Trajetória da região': 'How the region has moved',
  'Amplitude entre os estados': 'Range across the states',
  'Amplitude entre os nove': 'Range across the nine states',
  'A <strong>Amazônia Legal</strong> registra <strong>{valor}</strong> em {indicador}{ano}{faixa}.':
    'The <strong>Legal Amazon</strong> records <strong>{valor}</strong> for {indicador}{ano}{faixa}.',
  ', em {ano}': ', in {ano}',
  ', entre {menor} e {maior}': ', ranging from {menor} to {maior}',
  'Escolha um indicador oficial no seletor acima do mapa para ver o valor da Amazônia Legal como um todo.':
    'Pick an official indicator in the selector above the map to see the figure for the Legal Amazon as a whole.',
  'Ano em curso: a série ainda não fechou, então o valor não é comparável aos anos anteriores.':
    'Year in progress: the series has not closed yet, so this figure is not comparable with earlier years.',
  'Não foi possível carregar os dados do painel.': 'The dashboard data could not be loaded.',

  // Unidades e rótulos curtos do cartão do indicador.
  'mil km²': 'thousand km²',
  '100 mil': '100,000',
  pts: 'pts',
  'R$ {valor} bi': 'R$ {valor}bn',
  'Indicadores oficiais': 'Official indicators',
  'Ano em curso': 'Year in progress',
  'Série histórica': 'Time series',
  Leitura: 'How to read it',
  Fonte: 'Source',
  'Entenda o cálculo': 'See the method',
  'Série histórica de {estado}': 'Time series for {estado}',
  'Conjunto dos 9 Estados': 'All nine states',
  'Mapa comparativo da Amazônia Legal para {indicador}':
    'Comparative map of the Legal Amazon for {indicador}',
  'Detalhamento do estado': 'State detail',
  'Resumo do estado': 'State summary',
  'Indicador selecionado': 'Selected indicator',
  'Trajetória do estado': 'How the state has moved',
  '{posicao} de 9 · ciclo 2025–2026': '{posicao} of 9 · 2025–2026 cycle',
  '{posicao} entre os nove estados': '{posicao} of the nine states',
  'Capital {cidade}': 'Capital: {cidade}',
  'estimativa 2025': '2025 estimate',
  'UCs estaduais': 'State protected areas',
  'unidades cadastradas': 'registered areas',
  '<strong>{estado}</strong> está na {posicao} posição entre os nove estados para o indicador exibido.':
    '<strong>{estado}</strong> ranks {posicao} of the nine states on the indicator shown.',

  'Um território. Um futuro compartilhado.': 'One territory. One shared future.',
  'Floresta em pé, qualidade de vida.': 'Forest left standing, lives made better.',
  'Conectar prioridades. Valorizar o território.':
    'Connect the priorities. Value the territory.',
  'Cooperação que atravessa fronteiras.': 'Cooperation that crosses borders.',
  'Evidências para orientar o futuro.': 'Evidence to steer what comes next.',
  'recorte de exibição': 'cropped for display'
};
