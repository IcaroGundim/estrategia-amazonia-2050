// Gera as telas do UI kit do Claude Design a partir do build real do painel.
//
// Em vez de recriar as páginas em React, este script pega o HTML que o Astro
// pré-renderiza (dashboard/dist/client), a CSS de origem (src/styles, sem
// minificar, com os comentários) e os scripts de página (src/scripts, empacotados
// com esbuild sem minificar), e reescreve os endereços absolutos para caminhos
// relativos. O resultado abre sozinho num iframe do Claude Design, idêntico ao
// site, e toda classe e todo trecho de marcação corresponde 1:1 ao repositório.
//
// Uso (da raiz do repositório, depois de `npm run build --prefix dashboard`):
//   node .design-sync/tools/gerar-telas.mjs [pasta-de-saida]
// Saída padrão: .design-sync/projeto/ui_kits/painel-estrategia-2050 (gerada; fora do git)
import { createRequire } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAINEL = join(RAIZ, 'dashboard');
const DIST = join(PAINEL, 'dist', 'client');
const SAIDA = resolve(process.argv[2] || join(RAIZ, '.design-sync', 'projeto', 'ui_kits', 'painel-estrategia-2050'));
const PRODUCAO = 'https://estrategia2050.vercel.app';

const require = createRequire(join(PAINEL, 'package.json'));
const esbuild = require('esbuild');
const KATEX = JSON.parse(readFileSync(join(PAINEL, 'node_modules', 'katex', 'package.json'), 'utf8')).version;
const KATEX_CDN = `https://cdn.jsdelivr.net/npm/katex@${KATEX}/dist`;

// As três rotas públicas em português. `css` segue a ordem em que o build as
// entrega no <head>: a folha do layout (global + mobile) e depois a da página.
const PAGINAS = [
  {
    arquivo: 'index.html', origem: 'index.html', script: 'metodologia.js',
    css: ['global.css', 'mobile.css', 'overview-slides.css', 'overview-compositions.css'],
    card: { nome: 'Visão Geral', subtitulo: 'As cinco lâminas da Estratégia, com a trilha de progresso e as abas laterais — rota /' }
  },
  {
    arquivo: 'metas.html', origem: 'metas/index.html', script: 'metas.js',
    css: ['global.css', 'mobile.css'],
    card: { nome: 'Metas e indicadores', subtitulo: 'Metas em cartões, catálogo, resultado por estado, trajetória 2050 e ficha técnica — rota /metas' }
  },
  {
    arquivo: 'panorama.html', origem: 'panorama/index.html', script: 'app.js',
    css: ['global.css', 'mobile.css'],
    card: { nome: 'Panorama', subtitulo: 'Mapa dos nove estados, comparação estadual e trajetória até 2050 — rota /panorama' }
  }
];

// Rotas do site → arquivos do kit. O inglês não vem junto: o link vira âncora morta.
const ROTAS = { '/': 'index.html', '/panorama': 'panorama.html', '/metas': 'metas.html', '/metodologia': 'index.html' };
const PASTAS_PUBLICAS = ['data', 'flags', 'photos', 'ornaments', 'idiomas', 'capa'];

const referenciados = new Set();

// O cpSync e o rmSync do Node 24 falham no Windows quando o caminho tem acento ("estratégia");
// o rmSync com `force` ainda engole o erro. Daí as duas funções à mão.
function apagar(caminho) {
  if (!existsSync(caminho)) return;
  if (statSync(caminho).isDirectory()) {
    for (const nome of readdirSync(caminho)) apagar(join(caminho, nome));
    rmdirSync(caminho);
  } else {
    unlinkSync(caminho);
  }
}

function copiar(origem, destino) {
  if (statSync(origem).isDirectory()) {
    for (const nome of readdirSync(origem)) copiar(join(origem, nome), join(destino, nome));
    return;
  }
  mkdirSync(dirname(destino), { recursive: true });
  copyFileSync(origem, destino);
}

function mapearEndereco(valor) {
  if (!valor.startsWith('/') || valor.startsWith('//')) return valor;
  const [caminho, sufixo = ''] = valor.split(/(?=[#?])/);
  if (caminho in ROTAS) return ROTAS[caminho] + sufixo;
  if (caminho === '/en' || caminho.startsWith('/en/')) return '#';
  if (caminho.startsWith('/downloads/') || caminho.startsWith('/_astro/')) return PRODUCAO + valor;
  referenciados.add(decodeURIComponent(caminho));
  return 'public' + valor;
}

function transformarHtml(html, pagina, codigo) {
  let saida = html;
  // Fora: roteador, pré-carregamentos, canônicos e ícones — nada disso existe num iframe.
  saida = saida.replace(/<script type="module" src="\/_astro\/[^"]+"><\/script>/g, '');
  saida = saida.replace(/<meta name="astro-view-transitions-[^>]*>/g, '');
  saida = saida.replace(/<link rel="(?:preload|canonical|alternate|icon|apple-touch-icon)"[^>]*>/g, '');
  // A folha empacotada dá lugar às de origem, na mesma posição.
  let primeira = true;
  saida = saida.replace(/<link rel="stylesheet" href="\/_astro\/[^"]+\.css">/g, () => {
    if (!primeira) return '';
    primeira = false;
    return pagina.css.map((nome) => `<link rel="stylesheet" href="css/${nome}">`).join('\n');
  });
  saida = saida.replace(/\s(src|href|poster)="([^"]*)"/g, (_, atributo, valor) => ` ${atributo}="${mapearEndereco(valor)}"`);
  saida = saida.replace(/\ssrcset="([^"]*)"/g, (_, valor) => ` srcset="${valor.split(',').map((parte) => {
    const [url, ...resto] = parte.trim().split(/\s+/);
    return [mapearEndereco(url), ...resto].join(' ');
  }).join(', ')}"`);
  // O script vai embutido, e não num .js ao lado: o Claude Design compila todo .js/.jsx de
  // ui_kits/ para dentro do _ds_bundle.js que os designs carregam, e estes módulos de página
  // (com import da CDN) não podem entrar lá.
  const embutido = codigo.replace(/<\/(script)/gi, '<\\/$1');
  saida = saida.replace('</body>', () => `<script type="module">\n${embutido}</script>\n</body>`);
  const cartao = `<!-- @dsCard group="Telas do painel" viewport="1440x900" name="${pagina.card.nome}" subtitle="${pagina.card.subtitulo}" -->\n`;
  return cartao + saida.replace(/^\s*/, '');
}

// Nos scripts, os endereços são relativos à página.
function transformarJs(codigo) {
  return codigo
    .replace(/(['"`])\/downloads\//g, `$1${PRODUCAO}/downloads/`)
    .replace(new RegExp(`(['"\`])\\/(${PASTAS_PUBLICAS.join('|')})\\/`, 'g'), '$1public/$2/')
    .replace(/(['"`])\/(logo-consorcio-clara\.avif)/g, '$1public/$2');
}

const pluginPainel = {
  name: 'painel-para-design',
  setup(build) {
    // `?url` é do Vite: aqui a folha do KaTeX vem da CDN, como o próprio módulo.
    build.onResolve({ filter: /^katex\/dist\/katex\.min\.css\?url$/ }, () => ({ path: 'katex-css', namespace: 'painel' }));
    build.onLoad({ filter: /^katex-css$/, namespace: 'painel' }, () => ({ contents: `export default ${JSON.stringify(`${KATEX_CDN}/katex.min.css`)};`, loader: 'js' }));
    build.onResolve({ filter: /^katex$/ }, () => ({ path: `${KATEX_CDN}/katex.mjs`, external: true }));
    // As rotas em português apontam para os arquivos do kit.
    build.onLoad({ filter: /[\\/]i18n[\\/]index\.js$/ }, (args) => {
      let fonte = readFileSync(args.path, 'utf8');
      for (const [rota, arquivo] of Object.entries(ROTAS)) {
        fonte = fonte.replace(`'pt-BR': '${rota}'`, `'pt-BR': '${arquivo}'`);
      }
      return { contents: fonte, loader: 'js' };
    });
  }
};

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`Sem build em ${DIST}. Rode antes: npm run build --prefix dashboard`);
  process.exit(1);
}
// Esvazia a saída sem remover a pasta, que pode estar aberta num terminal ou num servidor.
if (existsSync(SAIDA)) for (const nome of readdirSync(SAIDA)) apagar(join(SAIDA, nome));
mkdirSync(join(SAIDA, 'css'), { recursive: true });

for (const nome of new Set(PAGINAS.flatMap((pagina) => pagina.css))) {
  copiar(join(PAINEL, "src", "styles", nome), join(SAIDA, "css", nome));
}

const scripts = {};
for (const script of new Set(PAGINAS.map((pagina) => pagina.script))) {
  const resultado = await esbuild.build({
    entryPoints: [join(PAINEL, 'src', 'scripts', script)],
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: false,
    write: false,
    charset: 'utf8',
    legalComments: 'none',
    loader: { '.json': 'json' },
    plugins: [pluginPainel],
    banner: { js: `// Gerado de dashboard/src/scripts/${script} (e dos módulos que ele importa) por .design-sync/tools/gerar-telas.mjs.\n// Pode ser alterado à vontade para explorar a tela; para levar a mudança ao site, aplique-a no arquivo de origem.` }
  });
  const codigo = transformarJs(resultado.outputFiles[0].text);
  // Os JSONs que o script busca entram na lista de ativos a copiar.
  for (const [, caminho] of codigo.matchAll(/['"`]public(\/data\/[^'"`$]+\.json)['"`]/g)) referenciados.add(caminho);
  scripts[script] = codigo;
}

for (const pagina of PAGINAS) {
  const html = readFileSync(join(DIST, pagina.origem), 'utf8');
  writeFileSync(join(SAIDA, pagina.arquivo), transformarHtml(html, pagina, scripts[pagina.script]));
}

// Ativos: o que o HTML e os scripts referenciam, mais as bandeiras, cujos nomes os scripts montam
// em tempo de execução a partir dos dados.
const publico = join(PAINEL, 'public');
for (const pasta of ['flags', 'idiomas']) {
  copiar(join(publico, pasta), join(SAIDA, "public", pasta));
}
for (const caminho of referenciados) {
  const origem = join(publico, caminho);
  if (!existsSync(origem)) { console.warn(`! referência sem arquivo: ${caminho}`); continue; }
  copiar(origem, join(SAIDA, "public", caminho));
}

writeFileSync(join(SAIDA, 'README.md'), `# Painel Estratégia 2050 — UI kit

As três rotas públicas do painel, em português, tiradas do build real do site
(\`dashboard/dist/client\`) por \`.design-sync/tools/gerar-telas.mjs\`. Não é uma recriação: o HTML é
o que o Astro pré-renderiza, a CSS é a de origem e os scripts são os do site, empacotados sem
minificar. Os dados vêm de \`public/data/\`, os mesmos JSONs que o painel publica.

| Arquivo | Tela | Rota no site |
| --- | --- | --- |
| \`index.html\` | Visão Geral — as cinco lâminas, a trilha de progresso e as abas laterais | \`/\` |
| \`metas.html\` | Metas e indicadores — cartões por eixo, detalhe com Resultado, Trajetória 2050 e Ficha técnica | \`/metas\` |
| \`panorama.html\` | Panorama — mapa, comparação estadual e trajetória até 2050 | \`/panorama\` |

A barra do topo navega entre as três. O seletor de idioma e os downloads apontam para o site em
produção; a versão em inglês não está aqui.

## Onde mexer

| Pasta | Conteúdo | Origem no repositório |
| --- | --- | --- |
| \`css/\` | \`global.css\`, \`mobile.css\` e, na Visão Geral, \`overview-slides.css\` e \`overview-compositions.css\`, nessa ordem | \`dashboard/src/styles/\` |
| \`<script type="module">\` no fim de cada tela | \`metodologia.js\` (Visão Geral), \`metas.js\` e \`app.js\` (Panorama), com os módulos que importam | \`dashboard/src/scripts/\` |
| \`public/\` | dados, bandeiras, fotografias, logo | \`dashboard/public/\` |

Classes e marcação são as do repositório, então uma alteração feita aqui volta ao código pelo mesmo
seletor ou pelo mesmo trecho: estilo em \`src/styles/\`, marcação estática nos \`.astro\` de
\`src/components/\` e \`src/layouts/Base.astro\`, o que os scripts desenham (cartões de meta, mapa,
listas) em \`src/scripts/\`, e texto em \`dashboard/conteudo/textos.json\` e \`interface.json\`.

Os scripts vão embutidos no fim de cada HTML, e não em arquivos \`.js\`, de propósito: o Claude
Design compila os \`.js\` do projeto para dentro do \`_ds_bundle.js\`, e estes módulos de página não
podem entrar lá. Ao criar arquivos novos neste kit, siga a mesma regra.

A \`mobile.css\` vale abaixo de 1180px: redimensione a tela para ver a barra inferior de ícones e as
lâminas em coluna.
`);

console.log(`Telas geradas em ${relative(RAIZ, SAIDA)}`);
for (const pagina of PAGINAS) console.log(`  ${pagina.arquivo}  ←  dashboard/dist/client/${pagina.origem}`);
console.log(`  ${referenciados.size} ativos referenciados pelo HTML e pelos scripts; flags/ e idiomas/ copiados inteiros`);
