import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

export default defineConfig({
  // Saída estática, com o adapter só para as rotas sob demanda da administração
  // (src/pages/admin/* e src/pages/api/admin/*, marcadas com `prerender = false`).
  // O adapter escreve `.vercel/output/`; na Vercel o Root Directory do projeto
  // precisa ser `dashboard`.
  adapter: vercel(),
  // Usado para gerar a URL absoluta da imagem de Open Graph no layout.
  // Trocar aqui se o domínio de produção mudar.
  site: 'https://estrategia-amazonia-2050.vercel.app',
  // Saída em pastas (`metas/index.html`): é o que a Vercel serve em `/metas`
  // sem depender de `cleanUrls`, que ela ignora quando o adapter gera a própria
  // configuração de rotas. `never` faz o adapter redirecionar `/metas/` → `/metas`.
  build: { format: 'directory' },
  trailingSlash: 'never',
  // A rota de indicadores foi absorvida pelas metas e continua respondendo, mas
  // o `redirects` daqui não serve: em saída estática ele vira um
  // `<meta http-equiv="refresh">`, que descarta o `#` do endereço — e é
  // justamente o código do indicador que viaja ali. O salto está escrito à mão
  // em `public/indicadores/index.html`. Os endereços antigos `/api/*` viram
  // redirecionamentos para os JSONs, que o adapter grava como rotas na Vercel.
  redirects: {
    // A Visão Geral passou a ser a raiz e o Panorama foi para /panorama;
    // os endereços antigos continuam chegando ao lugar certo.
    '/metodologia': '/',
    '/en/overview': '/en',
    '/api/dashboard': '/data/dashboard.json',
    '/api/geo': '/data/geo.json',
    '/api/catalogo': '/data/catalogo.json',
    '/api/metas': '/data/metas.json'
  },
  // Os links do menu estão sempre visíveis: o Astro busca o HTML da próxima
  // rota assim que ela entra na viewport, tirando uma ida à rede do clique.
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  devToolbar: { enabled: false }
});
