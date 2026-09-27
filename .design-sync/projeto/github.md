repo: IcaroGundim/estrategia-amazonia-2050
branch: main
path: dashboard

## Last sync

date: 2026-09-27T18:00:00Z
commit: aa87fc7

### Updated in this project

- UI kit refeito a partir do build real: as três rotas (Visão Geral em `/`, Metas em `/metas`,
  Panorama em `/panorama`) com a CSS de origem, os scripts de página sem minificar e os dados de
  `public/data/`. Substitui a recriação em React de 10/09, que ficou para trás com a Visão Geral em
  cinco eixos, as metas em cartões e a trajetória até 2050.
- `Topbar` com a marca atual ("Estratégia Regional", "Amazônia" cursivo, "2050"), a nova ordem das
  rotas e o seletor de idioma.
- `GoalCard` novo: o cartão de meta das Metas (jornada, atual e meta lado a lado, barra) e a variante
  de catálogo. `GoalRow` fica para listas de uma coluna.
- Templates com a ordem nova das rotas e com `GoalCard`; bandeiras de idioma em `assets/idiomas/`.

### Como regenerar

Do repositório: `npm run build --prefix dashboard` e depois `node .design-sync/tools/gerar-telas.mjs`
(detalhes em `.design-sync/NOTES.md`).

## Screen map

| Tela / arquivo | Origem no repositório |
| --- | --- |
| `tokens/*.css` | `dashboard/src/styles/global.css` (`:root`), `overview-compositions.css` |
| `components/layout/Topbar.jsx`, `Footer.jsx`, `RiverRule.jsx` | `dashboard/src/layouts/Base.astro`, `global.css` (`.topbar`, `.brand-*`, `.idioma-toggle`) |
| `components/controls/*` | `global.css` (`.dropdown`, `.indicator-search`, `.status-filter`, `.sidebar-tabs`, `.goals-flag`), `src/scripts/app.js` |
| `components/data/GoalCard.jsx` | `global.css` (`.goals-cards`, `.goals-row`, `.goals-card-*`), `src/scripts/metas.js` |
| `components/data/*` (demais) | `global.css` (`.overview`, `.rank-item`, `.legend-ramp`, `.spark*`), `src/scripts/app.js`, `metas.js` |
| `components/feedback/*` | `global.css` (`.ind-status`, `.indicator-detail-note`, `.state-reading`, `.map-tooltip`), `src/scripts/fichas.js` |
| `ui_kits/painel-estrategia-2050/index.html` | `dashboard/src/pages/index.astro`, `src/components/PaginaVisaoGeral.astro`, `SlidePhoto.astro`, `src/scripts/metodologia.js` |
| `ui_kits/painel-estrategia-2050/metas.html` | `dashboard/src/pages/metas.astro`, `src/components/PaginaMetas.astro`, `src/scripts/metas.js`, `fichas.js` |
| `ui_kits/painel-estrategia-2050/panorama.html` | `dashboard/src/pages/panorama.astro`, `src/components/PaginaPanorama.astro`, `src/scripts/app.js`, `mapa.js` |
| `ui_kits/painel-estrategia-2050/css/*.css` | `dashboard/src/styles/{global,mobile,overview-slides,overview-compositions}.css`, cópia fiel |
| `<script type="module">` no fim de cada tela | `dashboard/src/scripts/*.js`, empacotados com esbuild sem minificar e embutidos no HTML |
| `ui_kits/painel-estrategia-2050/public/**` | `dashboard/public/{data,flags,idiomas,photos,ornaments}` e `logo-consorcio-clara.avif` |
| `assets/**` | `public/logo-consorcio-clara.avif`, `public/flags`, `public/idiomas`, `public/ornaments`, `public/photos`, `public/data/geo.json` |
