# Sincronização com o Claude Design — notas

Projeto: "Estratégia Amazônia 2050 Design System"
(https://claude.ai/design/p/81a706d4-55a9-438a-bd59-44f136ecfd85), fixado em `config.json`.

## Como este projeto é montado

- **Não é saída do conversor do /design-sync.** O projeto nasceu em 10/09/2026 pela importação do
  próprio Claude Design: componentes React escritos à mão (`components/**/*.jsx`, estilos inline com
  os tokens), guias em HTML, templates `.dc.html` e ativos. O painel é Astro com JS puro, sem
  componentes React para o conversor empacotar. Por isso `config.json` só tem `projectId`, sem `pkg`
  nem `shape` — não rode `package-build.mjs` aqui.
- **Fonte local:** `.design-sync/projeto/` espelha os arquivos de texto que mantemos (componentes,
  tokens, templates, `readme.md`, `github.md`, `SKILL.md`, `styles.css`, `assets/idiomas/`). Guias
  (`guidelines/`), fotos, bandeiras e logo em `assets/` e o runtime dos templates (`support.js`,
  `ds-base.js`) só existem no projeto remoto e não foram alterados.
- **UI kit gerado:** `ui_kits/painel-estrategia-2050/` sai de `node .design-sync/tools/gerar-telas.mjs`
  depois de `npm run build --prefix dashboard`. Pega o HTML pré-renderizado (`dashboard/dist/client`),
  copia a CSS de origem, empacota os scripts de página com o esbuild do próprio dashboard (sem
  minificar) e reescreve os endereços para caminhos relativos. Fica fora do git.
- **O bundle é do app.** O Claude Design compila `_ds_bundle.js` sozinho a partir de todo `.jsx` do
  projeto e dos `.js` de `assets/` e `ui_kits/` (os de `templates/` ficam de fora), com o namespace
  `window.EstratGiaAmazNia2050DesignSystem_81a706`. Não envie `_ds_bundle.js`: envie os `.jsx` e a
  sentinela `_ds_needs_recompile`. O `_ds_bundle.js` local vem de `tools/montar-bundle.mjs` e serve
  só para conferir os cartões no navegador.
- **Nada de `.js` solto no UI kit.** Pela regra acima, um `.js` em `ui_kits/` entraria no bundle de
  todos os designs. Os scripts das telas vão embutidos no HTML (`<script type="module">`).

## Canvas de design (pranchetas editáveis)

Além do design system, a interface está num canvas do tipo Design:
https://claude.ai/artifact/2MR4Mo7QE1t9HMefDqjmgk ("Painel Estratégia Amazônia 2050"). São 13 telas
(5 lâminas da Visão Geral, Metas em 3 abas, Panorama em 2 visões, 3 telas de celular) e dois
componentes importados por todas (`Topbar.dc.html`, `Rodape.dc.html`, com a prop `ativo`).

- A marcação é o DOM renderizado do site, capturado do UI kit gerado (`tools/capturar.js` +
  POST `/__captura/<nome>` do `servir.mjs`), com as classes reais; a CSS de origem, as imagens e as
  fontes do KaTeX são assets do canvas (`/_blob/<id>`), listados em
  `.cache/canvas-assets/manifesto.json` (`tools/manifesto-assets.mjs` lê as respostas dos uploads).
- `tools/montar-canvas.mjs` gera `project/*.dc.html` e `project/canvas.json` em `.cache/canvas/`.
  Os nomes de atributo ficam como no HTML (`stroke-width`, `tabindex`): lida como documento, a
  prancheta passa pelo parser do navegador, que baixa tudo para minúsculas e mataria um
  `strokeWidth`. Booleanos vazios (`hidden=""`) viram `hidden="hidden"`.
- AVIF não entra como asset: o logo vai em WebP (convertido com o `sharp` do dashboard).
- Para testar localmente, a prancheta precisa do React antes do `support.js` e de um iframe do
  tamanho dela (a emulação de celular do navegador usa viewport de 980px sem meta viewport).
- Proposta "Metas por eixos" (fileira à direita das Metas): `tools/montar-proposta-eixos.mjs`
  gera `Metas-Eixos.dc.html` e `Metas-Eixo1..5.dc.html` a partir de `public/data/metas.json` e das
  capturas `metas-eixo-N` (cada eixo filtrado, primeiro indicador aberto; o filtro de eixo do site
  acumula seleção, então cada captura parte de uma página recarregada). Recebe o `canvas.json`
  publicado e só acrescenta as chaves dela.
- Publicar de novo: o mesmo `url`, com `root` em `.cache/canvas` e só os arquivos alterados; o
  `canvas.json` só quando mudar o layout. Edições feitas no canvas pelo editor se perdem se as
  pranchetas forem regeneradas por cima — leia a versão publicada antes.

## Conferir antes de enviar

1. `npm run build --prefix dashboard` e `node .design-sync/tools/gerar-telas.mjs`.
2. `node .design-sync/tools/montar-bundle.mjs` (bundle local dos componentes).
3. Servidor `design-kit` do `.claude/launch.json` (porta 4330; `/assets/*` cai para
   `dashboard/public/`). Abrir `ui_kits/painel-estrategia-2050/{index,metas,panorama}.html` e
   `components/*/*.card.html`. Os templates `.dc.html` só rodam localmente com o React carregado
   antes do `support.js` (no Claude Design o app injeta o React).

## Armadilhas

- Node 24 no Windows: `cpSync` e `rmSync` falham com o "é" de "estratégia" no caminho (o `rmSync`
  com `force` engole o erro e deixa arquivos velhos). As ferramentas usam cópia e remoção à mão.
- A ordem das folhas no kit segue a do build: `global.css`, `mobile.css` e, na Visão Geral,
  `overview-slides.css` e `overview-compositions.css` (ver a memória sobre a ordem da CSS no Astro).
- KaTeX (fórmulas da ficha técnica) vem da CDN jsdelivr na versão instalada no dashboard.
- A ficha técnica das Metas abre no painel lateral, como Resultado e Trajetória 2050 (desde
  27/09/2026; antes ocupava a largura toda com `.goals-board.has-ficha`, que saiu). Canvas na versão
  24, com a prancheta da ficha recapturada e a `global.css` em `/_blob/4ac6f490…`.

## Riscos para a próxima sincronização

- Sincronização de 27/09/2026 (fim do dia): UI kit regerado com as Metas por eixos, as metas
  avaliadas pela Amazônia Legal (baseline declarada ou média de 10/5 anos) e a marca provisória em
  texto ("Amazônia 2050", sem a cursiva, até sair o manual de uso da marca). Topbar.jsx, as docs de
  GoalCard e FlagButton, o readme e o template ListaDeMetas foram atualizados junto.
- Ainda desatualizados: o componente `AxisHeader` e o template `ListaDeMetas` reproduzem a lista
  antiga (cabeçalho de eixo e filtros de eixo), que o site não usa mais — faltam componentes para o
  cartão de eixo e o cabeçalho do eixo aberto.
- Canvas de pranchetas atualizado em 27/09/2026 (versão 18): marca em texto no `Topbar.dc.html`, CSS
  nova (global e mobile reenviadas como assets; o manifesto aponta os endereços novos) e a fileira
  das Metas trocada pelas telas reais — os cinco eixos (`Metas.dc.html`), cada eixo aberto
  (`Metas-Eixo1..5`), Trajetória 2050 e Ficha técnica (as duas de I1.1.2). A fileira da proposta e a
  prancheta `Metas-Eixos.dc.html` saíram; `montar-proposta-eixos.mjs` ficou só como registro.
  Capturas antigas em `.cache/capturas-antigas/`.
- `montar-canvas.mjs` recebe o `canvas.json` publicado como argumento e mantém as chaves que o
  editor guarda nele (`createdOnFiles`, `attachments`...), trocando só pranchetas, ordem e notas.
- A tela dos cinco eixos (título "Eixos - Amazônia Legal.", eixos 1–3 em cima e 4–5 nos vãos, texto
  de cada eixo sob o nome, vindo de `conteudo/textos.json` > `visaoGeral.eixos`) nasceu no canvas e
  foi levada ao site em 27/09/2026; o ajuste manual saiu do `montar-canvas.mjs` e a prancheta volta a
  ser captura pura (canvas na versão 26, `global.css` em `/_blob/6e760926…`).
- Versão 22 do canvas: o gráfico "Trajetória da região" do Panorama ganhou eixos (valores no Y,
  anos no X) no site, e as três pranchetas do Panorama foram recapturadas com a CSS nova
  (`global.css` em `/_blob/652483d8…`). As demais pranchetas ainda apontam a `global.css` anterior,
  que só não tem os estilos dos eixos; a próxima regeração completa unifica.
- A marca "Amazônia" é provisória: quando o manual de uso sair, ela muda no site
  (`dashboard/src/layouts/Base.astro`, `.brand-product` em global.css), no `Topbar.jsx`, no readme e
  na capa da nota técnica.
- O `servir.mjs` também serve o build do painel (`dashboard-build` no `.claude/launch.json`):
  `/metas` cai em `metas/index.html` ou `metas.html`.

- O UI kit é uma foto do build: qualquer mudança no painel pede `npm run build` + `gerar-telas.mjs` +
  novo envio. Os componentes React (`Topbar`, `GoalCard` e os demais) são recriações e não
  acompanham o site sozinhos — confira-os contra `global.css` quando o topo ou as metas mudarem.
- A contagem "19 metas com patamar mensurável · 59 indicadores" está escrita no template
  `ListaDeMetas` e no `readme.md`, e os números de exemplo do template e do `data.card.html` são
  copiados à mão do `metas.json`.
- A versão em inglês e a administração (`/admin`) não estão no projeto.
- O remoto não tem `_ds_sync.json`: cada sincronização compara pelo `list_files` e pelo backup em
  `.design-sync/.cache/backup-*` (fora do git).
