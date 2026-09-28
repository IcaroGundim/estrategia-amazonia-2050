# Estratégia Amazônia 2050 — design system

Sistema de design do **Observatório da Estratégia Regional Amazônia 2050**, o painel público de
metas e indicadores do **Consórcio Interestadual da Amazônia Legal** (nove estados: AC, AP, AM, MA,
MT, PA, RO, RR, TO).

A Estratégia Amazônia 2050 é um instrumento de planejamento regional de longo prazo, construído em
2025 em processo participativo com os nove estados, apoio técnico do IPAM e oficina presencial em
Belém, e apresentado na COP30. Ela organiza cinco eixos de implementação e uma matriz de 59
indicadores, dos quais 16 têm meta mensurável hoje. O painel existe para acompanhar essa matriz enquanto a
metodologia oficial de monitoramento não é definida — o que explica o tom do produto: cada número
aparece acompanhado de fonte, ano de referência, método de agregação e, quando é o caso, da
ressalva que impede a leitura errada.

## Fontes deste sistema

Tudo aqui foi lido do código do produto, não de capturas de tela:

- **Repositório:** <https://github.com/IcaroGundim/estrategia-amazonia-2050> (branch `main`)
  - `dashboard/src/styles/global.css` — tokens (`:root`), componentes e responsividade
  - `dashboard/src/styles/overview-slides.css` e `overview-compositions.css` — a Visão Geral em lâminas
  - `dashboard/src/layouts/Base.astro` — barra do topo (marca com "Amazônia" cursivo, rotas,
    seletor de idioma), rodapé, fontes, ícones de rota
  - `dashboard/src/pages/{index,panorama,metas}.astro` e `src/components/Pagina*.astro` — as três rotas
  - `dashboard/src/scripts/{app,metas,fichas,metodologia,shared,mapa}.js` — marcação gerada, rótulos e métodos
  - `dashboard/conteudo/textos.json` e `interface.json` — todos os textos do painel, em português e inglês
  - `dashboard/public/{flags,idiomas,ornaments,photos}` e `logo-consorcio-clara.avif` — os ativos originais
  - `dashboard/public/data/*.json` — dados reais usados nas telas
- **Produção:** <https://estrategia2050.vercel.app> (inglês em `/en`)

Vale explorar o repositório para ir além do que está registrado aqui: os comentários no CSS e nos
scripts explicam a razão de quase toda decisão de layout, e são a melhor fonte sobre casos-limite
(telas estreitas, ano parcial, indicador sem série).

## Produtos

Um produto só, com três rotas, nesta ordem no menu — é o que o repositório define:

| Rota | Nome | O que faz |
| --- | --- | --- |
| `/` | Visão Geral | Cinco lâminas sobre a Estratégia — a Estratégia (com a capa do documento), a Visão 2050, os cinco eixos de implementação, a governança e como o painel lê os dados —, com trilha de progresso embaixo e abas laterais para avançar |
| `/metas` | Metas e indicadores | A matriz completa: 59 indicadores, 19 com meta mensurável. Abre nos cinco eixos, cada um com a jornada e a coleta; o eixo aberto mostra os cartões e o detalhe ao lado com Resultado, Trajetória 2050 e Ficha técnica. As metas são lidas para a Amazônia Legal como um todo; os estados entram no detalhe como complemento. Os coletados sem meta numérica mostram o valor da região e uma faixa de calor por estado |
| `/panorama` | Panorama | Mapa dos nove estados, seletor de indicador e ano, coluna lateral com o painel do estado ou a comparação estadual e, abaixo, a trajetória de cada indicador até 2050 |

As três existem também em inglês (`/en`, `/en/goals`, `/en/panorama`), com os textos de
`conteudo/textos.json`. O endereço antigo `/metodologia` leva à raiz.

---

## Fundamentos de conteúdo

**Idioma.** Português do Brasil, sempre. Números em formato pt-BR: vírgula decimal, ponto de
milhar, notação compacta acima de um milhão (`29,7 mi`), travessão (`—`) quando não há valor.

**Pessoa e voz.** Terceira pessoa, voz do dado. O painel não diz "você" nem "nós": diz *"A Amazônia
Legal registra 21,1 / 100 mil em Segurança (CVLI)"*. Verbos no presente para o que é, no futuro só
quando se cita a visão pactuada (*"Em 2050, a Amazônia Legal terá alcançado…"*).

**Caixa.** Frases em caixa normal. Versalete (caixa alta + tracking) só em rótulos curtos:
sobrelinhas (`PERSPECTIVA REGIONAL`), títulos de seletor (`INDICADOR EXIBIDO`, `ANO EXIBIDO`), rótulos de número (`JORNADA DO EIXO`), rótulos de campo
(`POPULAÇÃO`, `FONTE`) e selos de coleta (`COLETADO`). Títulos nunca em caixa alta.

**Títulos com ênfase.** O padrão da casa é `Panorama - <em>Amazônia Legal.</em>` — a segunda parte em
urucum, com ponto final dentro da ênfase. Na Visão Geral o título é `Estratégia Regional` sobre
`<em>Amazônia 2050</em>` em urucum, maior.

**O número nunca vem sozinho.** Toda medida traz procedência em 10px logo abaixo
(*"projeção IBGE para 2025"*, *"federais e estaduais · CNUC/MMA 2026"*) e, quando o método é
aproximado, uma nota que diz exatamente qual é o limite:

> Média simples dos nove estados. A leitura correta ponderaria pelo número de municípios de cada
> estado, que não está na base consolidada.

> Ano em curso: a série ainda não fechou, então o valor não é comparável aos anos anteriores.

**Honestidade sobre lacunas.** Indicador sem dado não é escondido: entra na lista com o selo
`NÃO COLETADO` e o motivo em itálico — *"O indicador ainda não tem valores coletados para os nove
estados."* A ficha técnica ausente é declarada: *"Ficha técnica não localizada no documento."*

**Rótulos de ação.** Frases curtas e literais: `Ver o cumprimento das metas`, `Como ler os dados`,
`Baixar nota técnica`, `Explorar metas e indicadores`, `Seleção atual em CSV`. Nada de imperativos
publicitários, nada de "descubra", "explore agora", "clique aqui".

**Vocabulário fixo.** Use *eixo* (não "categoria"), *meta pactuada* (não "objetivo"), *patamar*
(não "alvo" no texto corrido), *jornada* (o percurso da região desde a baseline até o patamar;
quando a meta não diz a baseline, ela é a média dos últimos 10 anos, ou 5), *ficha técnica*
(não "detalhes"), *situação da coleta* (não "status"), *Amazônia Legal* ou *a região* (não "AL" em
texto corrido — a sigla só aparece em rótulo de gráfico).

**Separadores.** Metadados são unidos por meio-ponto: `PRODES/INPE · 2025`,
`9 estados · 808 municípios`, `Jalapão · Tocantins`. Faixas de anos usam meia-risca: `2016–2025`.

**Sem emoji.** Nenhum, em nenhuma superfície.

---

## Fundamentos visuais

### Paleta

Um verde institucional, dois acentos de terra e um sistema de papéis. O verde-mata `#0e2b22` é a
barra, o rodapé e todo bloco de leitura; o urucum `#c0451f` é **seleção e ação**; o ocre `#e0a83c`
é **ressalva** (notas, avisos, ano parcial) e a única cor de destaque sobre fundo escuro. Nunca
troque os dois: urucum em nota vira alarme, ocre em botão perde a hierarquia.

Fundos: `#e8e0d6` (barro-claro) é o documento, `#f5f0e8` (areia) é a página, `#ffffff` (papel) é o
cartão. Duas linhas de borda — `#ddd3c6` para o contorno de cartão, `#ede6dc` para o filete entre
linhas. Quatro tintas, de `#1a1613` a `#8a8078`, na ordem corpo → leitura → apoio → procedência.

Cada estado tem uma cor fixa (`--uf-*`) e a região usa `#00766d`. O mapa não usa essas cores: ele
usa a rampa de cinco degraus (areia → verde-mata) que classifica desempenho relativo.

### Tipografia

Duas famílias, ambas do Google Fonts, como no produto original:

- **Bricolage Grotesque** — títulos, números e rótulos de peso. Sempre 800, tracking `-0.03em`
  (`-0.04em` em números grandes). Nunca em texto corrido.
- **Libre Franklin** — corpo (400), rótulos e botões (600), valores de tabela (500/600).
- **Marca da Estratégia** — provisória até sair o manual de uso da marca: "ESTRATÉGIA REGIONAL"
  em versalete sobre "Amazônia 2050" em Bricolage Grotesque 800, com o ano em ocre no mesmo corpo
  (em `components/layout/Topbar.jsx`). É toda em texto: não use letra cursiva nem manuscrita na
  marca, nem recrie uma marca "Amazônia" desenhada, até o manual defini-la.

Escala: h1 `clamp(42px, 5vw, 68px)/0.96`, h2 `clamp(24px, 2.2vw, 34px)/1.04`, h3 21px, corpo
15px/1.55, abertura 16px, cartão 13px, nota 11px, procedência 10px, microrrótulo 8–9px. O painel
desce a 8px em rótulos de grupo — é denso de propósito, e por isso os tamanhos pequenos só carregam
versalete curto, nunca frase. Números sempre com `font-variant-numeric: tabular-nums`.

### Espaço, forma e densidade

Espaçamento em passos de 4 a 58px: 10–14px entre irmãos, 18–26px dentro do cartão, 34–58px entre
seções. Recheio de cartão: 22px (mapa), 24px (ranking, filtros), 17px (cartão de número), 19px
(ficha em areia). Margem da página: `clamp(24px, 3.2vw, 72px)`; largura máxima 2200px — o painel
foi desenhado para telas largas e usa a largura toda.

Cantos: 14px no cartão, 12px no menu, 11px no campo alto, 9px no botão, 8px na opção, 7px no link e
na dica, 4px na bandeira e na barra, `999px` na pastilha de filtro. Nada acima de 14px, exceto
pílulas e o deck da Visão Geral (15px).

### Sombra e elevação

Quase nada. Cartões não têm sombra — a hierarquia vem da borda e do fundo. Sombra existe em cinco
lugares: coluna presa (`0 16px 38px rgba(43,31,23,.07)`), barra do topo
(`0 4px 20px rgba(14,43,34,.16)`), menu suspenso (`0 24px 64px rgba(43,31,23,.2)`), dica do mapa
(`0 10px 24px rgba(14,43,34,.18)`) e linha em hover (`0 4px 14px rgba(14,43,34,.09)`). Todas em
marrom-tinta ou verde-mata, nunca em preto puro.

### Fundos e imagem

O fundo é cor chapada — areia na página, verde-mata na barra. Há um único gradiente decorativo em
todo o produto: um radial de ocre a 10% no canto superior direito da Visão Geral. As texturas que
existem são funcionais: hachura diagonal em urucum a 12% para "o que falta para a meta", e um
`repeating-linear-gradient` de três cores no topo do índice de metodologia.

Fotografia só na Visão Geral: na primeira lâmina, a capa da própria publicação (inteira, sem
legenda — título e marca já estão nela); nas outras quatro, imagens da região (Wikimedia Commons,
CC BY-SA), sempre
em recorte por CSS com degradê verde-mata por cima (`rgba(14,43,34,.02)` no topo a `.94` embaixo)
para o texto claro assentar. Cor quente, natural, sem filtro nem granulação. Crédito, autoria e
licença em 9px no canto inferior — obrigatórios.

Os ornamentos (rio, trama, ramo, estuário, folhagem) são gravuras geométricas originais, sempre
decorativas, em baixa opacidade, fora dos blocos de leitura.

### Movimento

Discreto e curto. Trocas de cor e borda em 140–160ms `ease`. O que muda de tamanho ou posição usa
`cubic-bezier(0.22, 1, 0.36, 1)`: barra de meta 620ms, grade do detalhe 420ms, abertura do painel
260ms com um leve `translateY(10px)` e desfoque de 3px que se dissolve. Menus entram em 130ms com
5px de deslocamento. Nada de bounce, nada de escala, nada de rotação — exceto a seta do seletor,
que gira de 45° para −135°. Tudo é desligado em `prefers-reduced-motion`.

### Interação

- **Hover:** troca de cor de borda e de fundo. Seletor: borda vira urucum e o fundo vai para
  `#fffdfa`. Linha de lista: fundo `#f5f1ea`. Linha de meta: ganha a sombra de 9%. Estado no mapa:
  `saturate(1.06) brightness(1.04)` e um pequeno salto de translação.
- **Foco:** anel de 4px em urucum a 10% no seletor, 3px em verde-mata a 7% na busca; contorno ocre
  de 3px na Visão Geral. O `outline` padrão é removido só onde há substituto visível.
- **Seleção:** urucum, sempre. Barra de 3px à esquerda da linha, contorno de 3px no estado do mapa,
  borda + anel de 1px na bandeira, filete de 2px sob a aba ativa.
- **Desabilitado:** fundo `--linha-2`, texto `--tinta-4`, cursor `not-allowed`, e um motivo escrito
  ("Este indicador não possui série temporal").
- **Toque:** em `(pointer: coarse)` os alvos sobem para 44–56px; quando crescer a caixa mudaria o
  desenho (bandeira, link sublinhado), cresce só a área sensível, com um `::after` invisível.

### Regras de layout

Grade de duas colunas no Panorama (`minmax(0,1fr)` + `clamp(430px, 25vw, 540px)`), com a coluna
lateral presa a 96px do topo. Nas Metas a grade tem três estados: só lista, lista + detalhe
(2fr/1fr) e ficha em largura cheia (a lista recolhe). A barra do topo é `sticky`; abaixo de 1180px
as rotas viram menu, e abaixo de 920px o mapa fica preso ao topo enquanto o resto rola por baixo.
Transparência e desfoque praticamente não existem — só no `blur(3px)` de entrada do painel e nos
fundos `rgba(255,255,255,.28–.5)` de alguns cartões da Visão Geral sobre areia.

---

## Iconografia

**Não há biblioteca de ícones, e não deve haver.** O produto inteiro usa três recursos:

1. **Quatro selos de coleta** (`assets/icons/status-*.svg`) — um disco cheio de 16px com um corte em
   branco: certo (coletado), metade preenchida (parcial), ponteiro de relógio (pendente), traço
   (não coletado). É a única família de glifos do sistema.
2. **Três ícones de rota** (`assets/icons/nav-*.svg`) — traço de 24px sem preenchimento, desenhados
   para a barra inferior do celular: mapa dobrado (Panorama), livro aberto (Visão Geral), alvo
   (Metas). No computador as rotas são texto, sem ícone.
3. **Caracteres** — `⌕` busca, `›` abrir detalhe, `×` fechar, `↗` link externo, `→ ←` navegação,
   `✓` opção escolhida, `—` sem valor, `·` separador. A seta do seletor não é um ícone: é um
   quadrado de 9px com duas bordas, girado 45°.

**Bandeiras** (`assets/flags/`) fazem o trabalho que ícones fariam em outro produto: identificam o
estado no ranking, no seletor de recorte, na amplitude e sobre o mapa. A bandeira da Amazônia Legal
representa a região. Sempre em caixa com borda de 1px e raio de 4px (3px em telas de toque). O
seletor de idioma usa duas bandeiras próprias (`assets/idiomas/`): a do Brasil e a mesclada de EUA
e Reino Unido, sem sigla.

Emoji: nunca. Ilustração: nunca — o lugar do desenho é o ornamento gravado.

---

## Ativos

- `assets/logo-consorcio-clara.avif` — logo do Consórcio Interestadual da Amazônia Legal, versão
  clara (mapa em rede de nós coloridos + tipografia). **É a única versão existente no repositório.**
  Sobre fundo claro, escreva o nome em texto: não recolora nem recrie a marca.
- `assets/flags/*.svg` — as nove bandeiras estaduais e a da Amazônia Legal.
- `assets/idiomas/*.svg` — as bandeiras do seletor de idioma (Brasil; EUA e Reino Unido).
- `assets/ornaments/*.svg` — sete gravuras originais + duas ondas de seção extraídas do CSS.
- `assets/photos/*.jpg` — as fotografias da Visão Geral (crédito em `guidelines/marca-fotografia.html`). A capa
  da publicação, que abre a primeira lâmina, está no UI kit (`ui_kits/painel-estrategia-2050/public/photos/`).
- `assets/icons/*.svg` — selos de coleta, ícones de rota, seta.
- `assets/mapa-amazonia-legal.svg` / `.json` / `.js` — a malha dos nove estados projetada em
  720×500, extraída de `dashboard/public/data/geo.json` com a projeção de `mapa.js`.

### Substituições declaradas

- **Fontes:** o repositório carrega Bricolage Grotesque e Libre Franklin do Google Fonts por `<link>`;
  não há binários versionados. `tokens/fonts.css` reproduz o mesmo `@import`, com os mesmos eixos e
  pesos. Se houver arquivos `.woff2` licenciados, envie-os e eu troco o `@import` por `@font-face`.
- Nenhum ícone foi substituído: todos os glifos vieram do próprio código.

---

## Índice

| Arquivo | O que é |
| --- | --- |
| `styles.css` | Ponto de entrada — só `@import`s |
| `tokens/colors.css` | Paleta base e semântica, rampa do mapa, cor por estado |
| `tokens/typography.css` | Famílias, pesos, escala de títulos e de rótulos |
| `tokens/space.css` | Espaçamento, recheios, trilho da página, cantos, alvos de toque |
| `tokens/elevation.css` | Sombras, anéis de foco e de seleção |
| `tokens/motion.css` | Curvas e durações |
| `tokens/fonts.css` | Carregamento das duas famílias |
| `guidelines/*.html` | 21 cartões de fundamentos (Cores, Tipografia, Espaço e forma, Marca) |
| `components/**` | 23 componentes React, cada um com `.d.ts` e `.prompt.md` |
| `ui_kits/painel-estrategia-2050/` | As três telas do painel geradas do build real (HTML, CSS e scripts do site) |
| `templates/` | Pontos de partida em Design Component |
| `assets/**` | Logo, bandeiras, ornamentos, fotografias, ícones, malha do mapa |
| `SKILL.md` | Descrição do sistema para uso como Agent Skill |
| `github.md` | Associação com o repositório de origem e mapa de telas |

### Componentes

**`components/core/`** — `Card`, `Eyebrow`, `Button`
**`components/controls/`** — `Dropdown`, `SearchField`, `FilterChip`, `Tabs`, `FlagButton`
**`components/data/`** — `MetricCard`, `RankRow`, `GoalCard`, `GoalRow`, `BarMeter`, `LegendRamp`, `Sparkline`
**`components/feedback/`** — `StatusBadge`, `Note`, `DarkPanel`, `Tooltip`
**`components/layout/`** — `Topbar`, `Footer`, `RiverRule`, `AxisHeader`

O inventário é o do produto: cada componente existe porque há uma peça equivalente no CSS ou nos
scripts do repositório. Não há Modal, Toast, Avatar ou Accordion porque o painel não tem nenhum
deles.

**Adições intencionais:** `Eyebrow`, `Note` e `DarkPanel` empacotam padrões que no original são
classes CSS repetidas (`.eyebrow`, `.indicator-detail-note`/`.map-year-warning`, `.state-reading`/
`.method-vision`) — mesmos valores, sem invenção. `RiverRule` e `AxisHeader` isolam dois ornamentos
estruturais que o layout aplica em vários lugares.

### UI kit

`ui_kits/painel-estrategia-2050/` não é uma recriação: são as três rotas do site como o build as
entrega, com a CSS de origem (`css/`, os mesmos arquivos de `dashboard/src/styles/`, com os
comentários) e os scripts de página empacotados sem minificar, embutidos no fim de cada HTML,
lendo os dados reais de `public/data/`. (Embutidos de propósito: todo `.js` do projeto é compilado
para dentro do `_ds_bundle.js`, e estes módulos de página não podem ir para lá — não crie `.js`
soltos em `ui_kits/`.) Cada tela é um cartão: `index.html` (Visão Geral), `metas.html` e `panorama.html`,
e a barra do topo navega entre elas. Toda classe e todo trecho de marcação correspondem 1:1 ao
repositório, então uma alteração feita aqui volta para o código sem tradução:

- mudança de estilo → a regra de mesmo seletor em `dashboard/src/styles/<arquivo>.css`;
- mudança de marcação estática → o `.astro` da página (`src/components/Pagina*.astro`, `src/layouts/Base.astro`);
- mudança do que os scripts desenham (cartões de meta, mapa, listas) → `dashboard/src/scripts/<arquivo>.js`;
- mudança de texto → `dashboard/conteudo/textos.json` ou `interface.json`, não o HTML.

Para desenhar telas novas, prefira os componentes React deste sistema; para variar uma tela que já
existe, parta da tela do UI kit e mexa nas classes dela.
