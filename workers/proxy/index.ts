// Segunda porta do painel: um Worker na Cloudflare que repassa tudo para a
// publicação na Vercel. Serve para redes corporativas cujo filtro retém ou
// bloqueia *.vercel.app; o navegador só fala com *.workers.dev, e a perna
// bloqueada sai do caminho. Ver segunda-porta-cloudflare.md na raiz.
//
// Decisões que não são óbvias:
//
// 1. `new Request(alvo, request)` reaproveita método, headers e corpo; o Host
//    é derivado da nova URL, então a Vercel recebe o hostname dela mesma.
// 2. `Origin` e `Referer` são reescritos para a origem. As rotas sob demanda
//    da administração (Astro) recusam um POST cujo Origin não bate com a URL
//    do pedido, e o navegador manda o Origin do próprio Worker.
// 3. `redirect: 'manual'`: quem segue a redireção é o navegador, e o
//    `Location` que aponte para a origem é reescrito para o Worker; qualquer
//    outro destino passa intacto.
// 4. O cookie de sessão da administração não tem atributo Domain, então o
//    navegador o guarda para o host do Worker sem nenhuma reescrita. A sessão
//    é por endereço: quem usa os dois faz login em cada um.
// 5. Cache: a Vercel manda `max-age=0` no HTML, e `cacheEverything` respeita
//    isso; as páginas públicas são estáticas no build, então o TTL é forçado.
//    Nada de /admin e /api entra no cache, nem pedidos que não sejam GET.

interface Env {
  ORIGEM: string;
}

const ASSET = /\.(js|mjs|css|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|geojson|txt|xml|webmanifest)$/i;

type Cache = { cacheEverything?: boolean; cacheTtl?: number };

function politicaDeCache(request: Request, url: URL): Cache {
  if (request.method !== 'GET' && request.method !== 'HEAD') return {};
  const caminho = url.pathname;
  if (caminho.startsWith('/admin') || caminho.startsWith('/api')) return {};
  // Assets com hash no nome (/_astro/*) e imagens: um dia na borda.
  if (caminho.startsWith('/_astro/') || ASSET.test(caminho)) return { cacheEverything: true, cacheTtl: 86400 };
  // JSON de dados e downloads: obedecem ao Cache-Control da origem.
  if (/\.[a-z0-9]+$/i.test(caminho)) return { cacheEverything: true };
  // Páginas: HTML estático do build, um minuto na borda.
  return { cacheEverything: true, cacheTtl: 60 };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origem = new URL(env.ORIGEM);
    const url = new URL(request.url);
    const proxy = url.origin;
    const alvo = new URL(url.pathname + url.search, origem);

    const pedido = new Request(alvo.toString(), request);
    const cabecalhos = new Headers(pedido.headers);
    for (const nome of ['origin', 'referer']) {
      const valor = cabecalhos.get(nome);
      if (valor && valor.startsWith(proxy)) cabecalhos.set(nome, origem.origin + valor.slice(proxy.length));
    }

    const resposta = await fetch(new Request(pedido, { headers: cabecalhos, redirect: 'manual' }), {
      cf: politicaDeCache(request, url)
    } as RequestInit);

    const saida = new Headers(resposta.headers);
    const location = saida.get('location');
    if (location) {
      const destino = new URL(location, alvo);
      if (destino.host === origem.host) saida.set('location', proxy + destino.pathname + destino.search + destino.hash);
    }
    return new Response(resposta.body, { status: resposta.status, statusText: resposta.statusText, headers: saida });
  }
};
