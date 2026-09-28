// Monta as pranchetas do canvas "Painel Estratégia Amazônia 2050" (Claude Design, tipo Design)
// a partir das capturas do DOM renderizado (servir.mjs, POST /__captura/<nome>) e do manifesto
// dos assets enviados (manifesto-assets.mjs). A marcação é a do site, com as classes reais; a CSS
// de origem entra como asset no <head> de cada prancheta. Topo e rodapé viram componentes
// compartilhados (Topbar.dc.html, Rodape.dc.html) importados por todas as telas.
// Uso: node .design-sync/tools/montar-canvas.mjs [canvas.json publicado] → .design-sync/.cache/canvas/project/
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CACHE = '.design-sync/.cache';
export const SAIDA = join(CACHE, 'canvas', 'project');
const manifesto = JSON.parse(readFileSync(join(CACHE, 'canvas-assets', 'manifesto.json'), 'utf8'));
export const captura = (nome) => JSON.parse(readFileSync(join(CACHE, 'capturas', `${nome}.json`), 'utf8'));
export const blob = (chave) => {
  if (!manifesto[chave]) throw new Error(`asset sem upload: ${chave}`);
  return manifesto[chave];
};

export const CSS = {
  base: ['css/global.css', 'css/mobile.css'],
  visaoGeral: ['css/global.css', 'css/mobile.css', 'css/overview-slides.css', 'css/overview-compositions.css'],
  ficha: ['css/global.css', 'css/mobile.css', 'css/katex.css']
};
const FONTES = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&amp;family=Libre+Franklin:wght@400;500;600&amp;display=swap';

const DESKTOP = { metodologia: 'Main.dc.html', metas: 'Metas.dc.html', index: 'Panorama.dc.html' };
const CELULAR = { metodologia: 'Celular-VisaoGeral.dc.html', metas: 'Celular-Metas.dc.html', index: 'Celular-Panorama.dc.html' };
const LAMINAS = {
  'a-estrategia': 'Main.dc.html', 'visao-2050': 'VisaoGeral-02-Visao2050.dc.html',
  'eixos-de-implementacao': 'VisaoGeral-03-Eixos.dc.html', governanca: 'VisaoGeral-04-Governanca.dc.html',
  calculo: 'VisaoGeral-05-Painel.dc.html'
};

const PRANCHETAS = [
  { arquivo: 'Main.dc.html', captura: 'vg-1', titulo: 'Visão Geral · 01 Estratégia', ativo: 'metodologia', css: CSS.visaoGeral },
  { arquivo: 'VisaoGeral-02-Visao2050.dc.html', captura: 'vg-2', titulo: 'Visão Geral · 02 Visão 2050', ativo: 'metodologia', css: CSS.visaoGeral },
  { arquivo: 'VisaoGeral-03-Eixos.dc.html', captura: 'vg-3', titulo: 'Visão Geral · 03 Eixos', ativo: 'metodologia', css: CSS.visaoGeral },
  { arquivo: 'VisaoGeral-04-Governanca.dc.html', captura: 'vg-4', titulo: 'Visão Geral · 04 Governança', ativo: 'metodologia', css: CSS.visaoGeral },
  { arquivo: 'VisaoGeral-05-Painel.dc.html', captura: 'vg-5', titulo: 'Visão Geral · 05 Este painel', ativo: 'metodologia', css: CSS.visaoGeral },
  { arquivo: 'Metas.dc.html', captura: 'metas', titulo: 'Metas · Os cinco eixos', ativo: 'metas', css: CSS.base },
  ...[1, 2, 3, 4, 5].map((n) => ({ arquivo: `Metas-Eixo${n}.dc.html`, captura: `metas-eixo-${n}`, titulo: `Metas · Eixo ${n} aberto`, ativo: 'metas', css: CSS.base })),
  { arquivo: 'Metas-Trajetoria2050.dc.html', captura: 'metas-trajetoria', titulo: 'Metas · Trajetória 2050', ativo: 'metas', css: CSS.base },
  { arquivo: 'Metas-FichaTecnica.dc.html', captura: 'metas-ficha', titulo: 'Metas · Ficha técnica', ativo: 'metas', css: CSS.ficha },
  { arquivo: 'Panorama.dc.html', captura: 'panorama', titulo: 'Panorama · Visão geral', ativo: 'index', css: CSS.base },
  { arquivo: 'Panorama-Comparacao.dc.html', captura: 'panorama-comparacao', titulo: 'Panorama · Comparação estadual', ativo: 'index', css: CSS.base },
  { arquivo: 'Celular-VisaoGeral.dc.html', captura: 'mobile-vg', titulo: 'Celular · Visão Geral', ativo: 'metodologia', css: CSS.visaoGeral, celular: true },
  { arquivo: 'Celular-Metas.dc.html', captura: 'mobile-metas', titulo: 'Celular · Metas', ativo: 'metas', css: CSS.base, celular: true },
  { arquivo: 'Celular-Panorama.dc.html', captura: 'mobile-panorama', titulo: 'Celular · Panorama', ativo: 'index', css: CSS.base, celular: true }
];

// ---------------------------------------------------------------------------
// Atributos: o runtime do Claude Design passa os atributos ao React. Os nomes ficam como no
// HTML (stroke-width, tabindex): quando a prancheta é lida como documento, o navegador já
// baixou tudo para minúsculas, e um strokeWidth viraria "strokewidth" e se perderia; o nome
// original o React repassa como atributo (com um aviso no console, só).
const BOOLEANOS = new Set(['hidden', 'disabled', 'checked', 'selected', 'open', 'required', 'multiple', 'autofocus', 'inert', 'novalidate', 'readonly']);
const TAG = /<([a-zA-Z][^\s/>]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/g;
const ATRIBUTO = /([^\s"'>/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;

export function converterAtributos(html, mapearUrl) {
  return html.replace(TAG, (inteiro, tag, atributos, fecha) => {
    if (!atributos) return inteiro;
    const novos = [];
    for (const [, nomeBruto, valorBruto] of atributos.matchAll(ATRIBUTO)) {
      let nome = nomeBruto;
      let valor = valorBruto === undefined ? '' : valorBruto.replace(/^["']|["']$/g, '');
      if (nome === 'sizes' || nome === 'srcset' || nome === 'loading') continue;
      // Booleano vazio (hidden="") chegaria ao React como "" e seria lido como falso.
      if (BOOLEANOS.has(nome.toLowerCase())) valor = nome.toLowerCase();
      if (['src', 'href', 'xlink:href', 'poster'].includes(nome)) valor = mapearUrl(valor);
      if (nome === 'style') valor = valor.replace(/url\((&quot;|'|")?(public\/[^)&'"]+)\1\)/g, (_, aspas, url) => `url(${mapearUrl(url)})`);
      novos.push(`${nome}="${valor.replace(/"/g, '&quot;')}"`);
    }
    return `<${tag}${novos.length ? ' ' + novos.join(' ') : ''}${fecha ? ' /' : ''}>`;
  });
}

export function mapeadorDeUrl(celular) {
  const rotas = celular ? CELULAR : DESKTOP;
  return (valor) => {
    const [caminho, hash] = valor.split('#');
    if (caminho.startsWith('public/')) {
      const arquivo = caminho.split('?')[0].split('/').pop();
      if (arquivo === 'capa-estrategia-2050.jpg') return blob('img/capa-estrategia-2050-1241.webp');
      if (arquivo === 'logo-consorcio-clara.avif') return blob('img/logo-consorcio-clara.webp');
      return blob(`img/${decodeURIComponent(arquivo)}`);
    }
    // Cartões e abas de eixo (#eixo-3) abrem a prancheta do eixo no modo Play. No celular
    // não há prancheta por eixo: o link fica parado.
    if (caminho === '' && /^eixo-[1-5]$/.test(hash || '')) return celular ? '#' : `Metas-Eixo${hash.slice(5)}.dc.html`;
    if (caminho === 'index.html' || (caminho === '' && hash && LAMINAS[hash])) {
      if (celular) return hash ? `#${hash}` : rotas.metodologia;
      return hash && LAMINAS[hash] ? LAMINAS[hash] : rotas.metodologia;
    }
    if (caminho === 'metas.html') return rotas.metas;
    if (caminho === 'panorama.html') return rotas.index;
    return valor;
  };
}

// ---------------------------------------------------------------------------
// Recortes do <body> capturado: topo, principal e rodapé.
export function recortar(html, abre, fecha, desde = 0) {
  const inicio = html.indexOf(abre, desde);
  if (inicio < 0) return null;
  const fim = html.indexOf(fecha, inicio) + fecha.length;
  return { inicio, fim, texto: html.slice(inicio, fim) };
}

export function partes(html) {
  const semComentarios = html.replace(/<!--[\s\S]*?-->/g, '');
  const topo = recortar(semComentarios, '<header class="topbar"', '</header>');
  const principal = recortar(semComentarios, '<main', '</main>');
  const abas = recortar(semComentarios, '<nav class="tabbar"', '</nav>');
  const rio = recortar(semComentarios, '<div class="river-ornament"', '</div>');
  const rodape = recortar(semComentarios, '<footer', '</footer>');
  if (!topo || !principal || !abas || !rio || !rodape) throw new Error('recorte incompleto');
  // O que sobrar entre o fim do rodapé e o fim do body (dicas, diálogos) vai junto com o principal.
  const resto = semComentarios.slice(rodape.fim).trim();
  return { topo: topo.texto, principal: principal.texto + (resto ? '\n' + resto : ''), abas: abas.texto, rio: rio.texto, rodape: rodape.texto };
}

// Links das rotas nos componentes compartilhados: destino, classe e aria-current vêm do renderVals.
const CHAVE_DA_ROTA = { 'Main.dc.html': 'metodologia', 'Metas.dc.html': 'metas', 'Panorama.dc.html': 'index' };
function rotasDinamicas(html) {
  return html.replace(/<a ([^>]*?)href="(Main|Metas|Panorama)\.dc\.html"([^>]*)>/g, (inteiro, antes, pagina, depois) => {
    const chave = CHAVE_DA_ROTA[`${pagina}.dc.html`];
    const resto = `${antes} ${depois}`.replace(/\s*class="(?:is-active)?"/, '').replace(/\s*aria-current="page"/, '').replace(/\s+/g, ' ').trim();
    const ehMarca = /class="brand"/.test(inteiro);
    if (ehMarca) return `<a href="{{ links.metodologia }}" ${resto}>`;
    return `<a href="{{ links.${chave} }}" class="{{ classe.${chave} }}" aria-current="{{ atual.${chave} }}"${resto ? ' ' + resto : ''}>`;
  });
}

const LOGICA_ROTAS = `class Component extends DCLogic {
  renderVals() {
    const ativo = this.props.ativo ?? 'metodologia';
    const celular = this.props.celular === true;
    const links = celular
      ? ${JSON.stringify(CELULAR)}
      : ${JSON.stringify(DESKTOP)};
    const classe = {};
    const atual = {};
    for (const chave of ['metodologia', 'metas', 'index']) {
      classe[chave] = chave === ativo ? 'is-active' : undefined;
      atual[chave] = chave === ativo ? 'page' : undefined;
    }
    const acoes = {
      metodologia: { href: 'https://estrategia2050.vercel.app/downloads/nota-tecnica-painel-amazonia-2050.pdf', rotulo: 'Baixar nota técnica' },
      metas: { href: links.metodologia, rotulo: 'Sobre a Estratégia' },
      index: { href: links.metodologia, rotulo: 'Como ler os dados' }
    };
    return { links, classe, atual, celular, acao: acoes[ativo] || acoes.metodologia };
  }
}`;

export function documento({ titulo, css, largura, altura, corpo, props, logica, raiz }) {
  const links = css.map((chave) => `<link rel="stylesheet" href="${blob(chave)}">`).join('\n');
  const dataProps = JSON.stringify({ ...props, $preview: { width: largura, height: altura } }).replace(/'/g, '&#39;');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${titulo}</title>
<script src="./support.js"></script>
${links}
</head>
<body>
<x-dc>
<helmet>
<link href="${FONTES}" rel="stylesheet">
<style>body{margin:0}</style>
</helmet>
<div style="${raiz}">
${corpo}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='${dataProps}'>
${logica}
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Só roda quando chamado direto: montar-proposta-eixos.mjs importa as funções acima.
function principal() {
  if (existsSync(SAIDA)) for (const nome of readdirSync(SAIDA)) if (statSync(join(SAIDA, nome)).isFile()) unlinkSync(join(SAIDA, nome));
  mkdirSync(SAIDA, { recursive: true });

  // Componentes compartilhados, tirados da primeira lâmina (desktop).
  const base = partes(converterAtributos(captura('vg-1').html, mapeadorDeUrl(false)));
  if (base.topo.includes('{{') || base.principal.includes('{{')) throw new Error('texto com {{ na captura');

  let topo = rotasDinamicas(base.topo);
  topo = topo.replace(/<a ([^>]*)class="outline-button action-link"([^>]*)>[^<]*<\/a>/, (_, antes, depois) => {
    const resto = `${antes} ${depois}`.replace(/\s*href="[^"]*"/, '').replace(/\s+/g, ' ').trim();
    return `<a class="outline-button action-link" href="{{ acao.href }}"${resto ? ' ' + resto : ''}>{{ acao.rotulo }}</a>`;
  });
  // "Ver como no computador" só aparece no celular; no site quem decide é html[data-vista], que a prancheta não tem.
  topo = topo.replace(/<button class="vista-toggle"[^>]*>[\s\S]*?<\/button>/,
    '<sc-if value="{{ celular }}" hint-placeholder-val="{{ false }}"><button class="vista-toggle" type="button" style="display: inline-flex; align-items: center"><span class="vista-para-desktop">Ver como no computador</span></button></sc-if>');
  if (!topo.includes('{{ acao.rotulo }}') || !topo.includes('{{ links.index }}')) throw new Error('topo sem as rotas dinâmicas');

  const propsRotas = {
    ativo: { editor: 'enum', options: ['metodologia', 'metas', 'index'], default: 'metodologia' },
    celular: { editor: 'boolean', default: false }
  };
  writeFileSync(join(SAIDA, 'Topbar.dc.html'), documento({
    titulo: 'Barra do topo', css: CSS.base, largura: 1440, altura: 84, corpo: topo,
    props: propsRotas, logica: LOGICA_ROTAS, raiz: 'width: 100%'
  }));
  const rodape = rotasDinamicas(`${base.abas}\n${base.rio}\n${base.rodape}`);
  writeFileSync(join(SAIDA, 'Rodape.dc.html'), documento({
    titulo: 'Rodapé e barra inferior', css: CSS.base, largura: 1440, altura: 120, corpo: rodape,
    props: propsRotas, logica: LOGICA_ROTAS, raiz: 'width: 100%'
  }));

  const tamanhos = {};
  for (const p of PRANCHETAS) {
    const dados = captura(p.captura);
    const largura = dados.largura;
    const altura = p.altura ?? Math.min(8000, dados.altura);
    let { principal } = partes(converterAtributos(dados.html, mapeadorDeUrl(!!p.celular)));
    // "← Todos os eixos" é um botão no site; na prancheta vira link para a tela dos eixos.
    if (p.ajuste) principal = p.ajuste(principal);
    if (!p.celular) {
      principal = principal.replace(/<button class="eixo-voltar"[^>]*>([\s\S]*?)<\/button>/,
        (_, rotulo) => `<a class="eixo-voltar" href="${DESKTOP.metas}" style="display: inline-flex; align-items: center">${rotulo}</a>`);
    }
    if (principal.includes('{{')) throw new Error(`texto com {{ em ${p.captura}`);
    const celular = p.celular ? ' celular="{{ sim }}"' : '';
    const corpo = `<dc-import name="Topbar" ativo="${p.ativo}"${celular} hint-size="100%,${p.celular ? 68 : 84}px"></dc-import>
  ${principal}
  <dc-import name="Rodape" ativo="${p.ativo}"${celular} hint-size="100%,120px"></dc-import>`;
    writeFileSync(join(SAIDA, p.arquivo), documento({
      titulo: p.titulo, css: p.css, largura, altura, corpo, props: {},
      logica: `class Component extends DCLogic {\n  renderVals() {\n    return { sim: true };\n  }\n}`,
      raiz: `position: relative; width: ${largura}px; height: ${altura}px; overflow: hidden; background: #e8e0d6`
    }));
    tamanhos[p.arquivo] = { w: largura, h: altura, title: p.titulo };
  }

  // Índice do canvas: uma fileira por rota, o celular abaixo e as peças compartilhadas por último.
  const daRota = (ativo, celular = false) => PRANCHETAS.filter((p) => p.ativo === ativo && !p.celular === !celular).map((p) => p.arquivo);
  const FILEIRAS = [
    { titulo: 'Visão Geral', arquivos: daRota('metodologia') },
    { titulo: 'Metas e indicadores', arquivos: daRota('metas') },
    { titulo: 'Panorama', arquivos: daRota('index') },
    { titulo: 'Celular', arquivos: PRANCHETAS.filter((p) => p.celular).map((p) => p.arquivo) },
    { titulo: 'Peças compartilhadas', arquivos: ['Topbar.dc.html', 'Rodape.dc.html'] }
  ];
  tamanhos['Topbar.dc.html'] = { w: 1440, h: 84, title: 'Barra do topo (compartilhada)' };
  tamanhos['Rodape.dc.html'] = { w: 1440, h: 120, title: 'Rodapé e barra inferior (compartilhados)' };

  const boards = {};
  const order = [];
  const notes = {};
  let y = 0;
  FILEIRAS.forEach((fileira, indice) => {
    let x = 0;
    let alturaDaFileira = 0;
    for (const arquivo of fileira.arquivos) {
      const { w, h, title } = tamanhos[arquivo];
      boards[arquivo] = { x, y, w, h, title };
      order.push(arquivo);
      x += w + 80;
      alturaDaFileira = Math.max(alturaDaFileira, h);
    }
    notes[`fileira-${indice + 1}`] = { x: 0, y: y - 300, text: fileira.titulo, kind: 'title1', maxW: Math.min(8000, Math.max(1440, x - 80)) }; // o editor não passa de 8000
    y += alturaDaFileira + 420;
  });
  // Como navegar nas Metas no modo Play, ao lado da última prancheta da fileira.
  const ultimaDasMetas = boards[FILEIRAS[1].arquivos.at(-1)];
  notes['metas-como'] = {
    x: ultimaDasMetas.x + ultimaDasMetas.w + 80, y: ultimaDasMetas.y, w: 420, maxH: 360,
    text: 'No modo Play, clicar num eixo abre a prancheta dele; as abas de eixo trocam de uma para outra, e "← Todos os eixos" volta à primeira. A jornada é sempre a da Amazônia Legal: o percurso desde a baseline até a meta.'
  };
  const pecas = boards['Rodape.dc.html'];
  notes.pecas = {
    x: pecas.x + pecas.w + 80, y: boards['Topbar.dc.html'].y, w: 420, maxH: 360,
    text: 'A barra do topo e o rodapé (com a barra inferior do celular) são componentes: toda tela importa estes dois. Edite aqui e a mudança vale para todas. Nas telas, a propriedade "ativo" marca a rota acesa.'
  };

  // Com o canvas.json publicado como argumento, o índice mantém o que o editor guardou nele
  // (createdOnFiles, attachments, designSystems...) e só troca pranchetas, ordem e notas.
  const publicado = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], 'utf8')) : null;
  const indice = publicado ? { ...publicado, boards, order, notes } : {
    v: 3,
    createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') },
    title: 'Painel Estratégia Amazônia 2050',
    launch: { view: 'canvas' },
    pages: [],
    boards,
    order,
    notes,
    designSystems: []
  };
  writeFileSync(join(SAIDA, 'canvas.json'), JSON.stringify(indice, null, 1));

  for (const nome of readdirSync(SAIDA)) console.log(`${nome.padEnd(36)} ${(statSync(join(SAIDA, nome)).size / 1024).toFixed(1)} KB`);
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) principal();
