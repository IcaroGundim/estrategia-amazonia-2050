import { defineConfig } from 'astro/config';

export default defineConfig({
  // Usado para gerar a URL absoluta da imagem de Open Graph no layout.
  // Trocar aqui se o domínio de produção mudar.
  site: 'https://estrategia-amazonia-2050.vercel.app',
  // `file` emite metas.html em vez de metas/index.html, mantendo o mesmo formato
  // de saída que o vercel.json (cleanUrls + trailingSlash: false) já esperava.
  build: { format: 'file' },
  devToolbar: { enabled: false }
});
