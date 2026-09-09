import { defineConfig } from 'astro/config';

export default defineConfig({
  // Usado para gerar a URL absoluta da imagem de Open Graph no layout.
  // Trocar aqui se o domínio de produção mudar.
  site: 'https://estrategia-amazonia-2050.vercel.app',
  // `file` emite metas.html em vez de metas/index.html, mantendo o mesmo formato
  // de saída que o vercel.json (cleanUrls + trailingSlash: false) já esperava.
  build: { format: 'file' },
  // A rota de indicadores foi absorvida pelas metas e continua respondendo, mas
  // o `redirects` daqui não serve: em saída estática ele vira um
  // `<meta http-equiv="refresh">`, que descarta o `#` do endereço — e é
  // justamente o código do indicador que viaja ali. O salto está escrito à mão
  // em `public/indicadores.html`.
  // Os links do menu estão sempre visíveis: o Astro busca o HTML da próxima
  // rota assim que ela entra na viewport, tirando uma ida à rede do clique.
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  devToolbar: { enabled: false }
});
