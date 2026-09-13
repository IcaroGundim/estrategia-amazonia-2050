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
  'Estratégia Regional': 'Regional Strategy',
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
  'Baixar nota técnica': 'Technical note (Portuguese)',

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

  'Amazônia 2050': 'Amazônia 2050',
  'estados consorciados': 'member states',

  'Visão 2050': 'Vision 2050',

  'Transição energética': 'Energy transition',

  Implementação: 'Implementation',

  'Este painel': 'This dashboard',
  'Carregando fontes…': 'Loading sources…',
  'Ver o cumprimento das metas': 'See progress against the targets',
  'Explorar metas e indicadores': 'Explore goals and indicators',
  'A Estratégia': 'The Strategy',
  'Temas estratégicos': 'Strategic themes',
  Governança: 'Governance',

  // Fotografias das lâminas. Topônimo e nome de autor ficam; descrição e frase
  // de abertura são reescritas.
  'Floresta amazônica · Amazonas': 'Amazon rainforest · Amazonas',
  'Jalapão · Tocantins': 'Jalapão · Tocantins',
  'Ver-o-Peso · Belém, Pará': 'Ver-o-Peso · Belém, Pará',
  'Teatro Amazonas · Manaus': 'Teatro Amazonas · Manaus',
  'Capa da Estratégia Regional Amazônia 2050: uma arara em voo sobre a floresta escura, com o título da publicação, a marca do Consórcio e as bandeiras dos nove estados consorciados.':
    'Cover of the Amazônia 2050 Regional Strategy: a macaw in flight against dark forest, with the publication title, the Consortium’s logo and the flags of the nine member states.',
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
  'PRODES/INPE': 'PRODES/INPE',
  'Focos de calor': 'Fire hotspots',
  Pobreza: 'Poverty',
  'Sinesp/MJ': 'Sinesp/MJ',
  'Vulnerabilidade climática': 'Climate vulnerability',
  'Conectividade digital (IBC-AMZ)': 'Digital connectivity (IBC-AMZ)',
  ANATEL: 'ANATEL',

  // Como o valor regional é montado, e o que cada método ressalva.
  'total de CVLI sobre a população regional': 'total violent deaths over the regional population',
  'média ponderada pela população': 'population-weighted average',
  'média simples dos nove estados': 'simple average of the nine states',
  'soma dos nove estados': 'sum of the nine states',
  'unidades com plano e conselho sobre o total de unidades':
    'areas with a plan and a council over all protected areas',
  'Média simples dos nove estados. A leitura regional correta ponderaria pela potência instalada de cada estado, que não está na base consolidada.':
    'Simple average of the nine states. A correct regional reading would weight by each state’s installed capacity, which the consolidated base does not carry.',
  'Média simples dos nove estados. Ponderar pelo PIB exigiria o PIB do mesmo ano de referência em todos os estados, o que a série não oferece.':
    'Simple average of the nine states. Weighting by GDP would require GDP for the same reference year in every state, which the series does not offer.',

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

  'Floresta em pé, qualidade de vida.': 'Forest left standing, lives made better.',
  'Conectar prioridades. Valorizar o território.':
    'Connect the priorities. Value the territory.',
  'Cooperação que atravessa fronteiras.': 'Cooperation that crosses borders.',
  'Evidências para orientar o futuro.': 'Evidence to steer what comes next.',
  'recorte de exibição': 'cropped for display'
};
