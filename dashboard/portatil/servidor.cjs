'use strict';
// Servidor da versão portátil do painel (sem internet).
//
// Vai dentro do executável gerado por `npm run portatil`: o Node embutido roda
// este arquivo e o site inteiro viaja junto como um único recurso ("site"),
// montado por portatil/empacotar.mjs a partir de .vercel/output/static.
// Ao abrir, o servidor escuta só neste computador (127.0.0.1), escolhe uma
// porta livre a partir da 4321 e abre o navegador padrão no painel.
//
// Fora do executável, para conferir sem empacotar:
//   node portatil/servidor.cjs portatil/.cache/site.bin
//
// CommonJS e sem dependências: é o formato que o executável do Node aceita.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORTA_INICIAL = 4321;
const TENTATIVAS = 30;
const HOST = '127.0.0.1';
// Responde a esta rota para que um segundo clique no executável reconheça o
// painel já aberto e só abra o navegador, em vez de subir outra cópia.
const ROTA_SINAL = '/__amazonia2050';

const TIPOS = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  ico: 'image/x-icon',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  webmanifest: 'application/manifest+json'
};

// ---------------------------------------------------------------------------
// O pacote: [4 bytes com o tamanho do índice][índice em JSON][arquivos colados]

function lerPacote() {
  let bytes;
  try {
    const sea = require('node:sea');
    if (sea.isSea()) bytes = Buffer.from(sea.getAsset('site'));
  } catch {
    // Node sem suporte a executável único: segue para o arquivo em disco.
  }
  if (!bytes) {
    const arquivo = process.argv[2] || path.join(__dirname, '.cache', 'site.bin');
    bytes = fs.readFileSync(arquivo);
  }
  const tamanhoIndice = bytes.readUInt32LE(0);
  const indice = JSON.parse(bytes.subarray(4, 4 + tamanhoIndice).toString('utf8'));
  const dados = bytes.subarray(4 + tamanhoIndice);
  const arquivos = new Map();
  for (const [caminho, [inicio, tamanho]] of Object.entries(indice.arquivos)) {
    arquivos.set(caminho, dados.subarray(inicio, inicio + tamanho));
  }
  return { arquivos, redirecionamentos: indice.redirecionamentos || [], info: indice.info || {} };
}

// ---------------------------------------------------------------------------
// Páginas que o site publicado gera no servidor e que aqui não existem.

function paginaSimples(titulo, texto) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo} | Estratégia Amazônia 2050</title>
<link rel="stylesheet" href="/fonts/fontes.css"><link rel="icon" href="/favicon.ico">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f3ec;color:#1d2a22;font-family:'Libre Franklin',system-ui,sans-serif}
  main{max-width:34rem;padding:2rem 1.5rem;text-align:center}
  h1{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-weight:800;font-size:2rem;margin:0 0 .75rem}
  p{line-height:1.55;margin:0 0 1.5rem}
  a{display:inline-block;padding:.7rem 1.2rem;border-radius:999px;background:#1d4d35;color:#fff;text-decoration:none;font-weight:600}
</style></head>
<body><main><h1>${titulo}</h1><p>${texto}</p><a href="/">Ir para o painel</a></main></body></html>`;
}

const PAGINA_404 = paginaSimples('Página não encontrada', 'Este endereço não existe no painel.');
const PAGINA_ADMIN = paginaSimples(
  'Administração indisponível',
  'Esta é a versão portátil do painel, para consulta sem internet. A administração (edição de valores e textos) funciona só no site publicado.'
);

// ---------------------------------------------------------------------------

function criarServidor(site) {
  // Os redirecionamentos do site publicado (endereços antigos), lidos do
  // config.json da Vercel na hora de empacotar.
  const regras = site.redirecionamentos.map((r) => ({ padrao: new RegExp(r.src), destino: r.location, status: r.status }));

  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end();
    }

    const url = new URL(req.url, `http://${HOST}`);
    let caminho;
    try {
      caminho = decodeURIComponent(url.pathname);
    } catch {
      return enviar(res, req, 400, 'text/plain; charset=utf-8', 'Endereço inválido');
    }

    if (caminho === ROTA_SINAL) return enviar(res, req, 200, 'text/plain; charset=utf-8', 'ok');

    // O site não usa barra no fim: /metas/ → /metas, como na Vercel.
    if (caminho.length > 1 && caminho.endsWith('/')) {
      return redirecionar(res, caminho.replace(/\/+$/, '') + url.search, 308);
    }

    for (const regra of regras) {
      if (regra.padrao.test(url.pathname)) {
        return redirecionar(res, url.pathname.replace(regra.padrao, regra.destino) + url.search, regra.status);
      }
    }

    if (caminho === '/admin' || caminho.startsWith('/admin/') || caminho.startsWith('/api/admin')) {
      return enviar(res, req, 200, TIPOS.html, PAGINA_ADMIN);
    }

    // Saída em pastas: /metas é metas/index.html; a raiz é index.html.
    const relativo = path.posix.normalize(caminho).replace(/^\/+/, '');
    const candidatos = relativo === '' ? ['index.html'] : [relativo, `${relativo}/index.html`];
    for (const candidato of candidatos) {
      const conteudo = site.arquivos.get(candidato);
      if (!conteudo) continue;
      const extensao = candidato.split('.').pop().toLowerCase();
      const cabecalhos = {};
      if (candidato.startsWith('_astro/') || candidato.startsWith('fonts/')) {
        cabecalhos['Cache-Control'] = 'public, max-age=31536000, immutable';
      } else {
        cabecalhos['Cache-Control'] = 'no-cache';
      }
      if (candidato.startsWith('downloads/')) cabecalhos['Content-Disposition'] = 'attachment';
      return enviar(res, req, 200, TIPOS[extensao] || 'application/octet-stream', conteudo, cabecalhos);
    }

    return enviar(res, req, 404, TIPOS.html, PAGINA_404);
  });
}

function enviar(res, req, status, tipo, corpo, extras = {}) {
  const bytes = Buffer.isBuffer(corpo) ? corpo : Buffer.from(corpo, 'utf8');
  res.writeHead(status, { 'Content-Type': tipo, 'Content-Length': bytes.length, ...extras });
  res.end(req.method === 'HEAD' ? undefined : bytes);
}

function redirecionar(res, destino, status) {
  res.writeHead(status, { Location: destino });
  res.end();
}

// ---------------------------------------------------------------------------

function escutar(servidor, porta) {
  return new Promise((resolve, reject) => {
    const falhou = (erro) => {
      servidor.off('listening', ouviu);
      reject(erro);
    };
    const ouviu = () => {
      servidor.off('error', falhou);
      resolve(porta);
    };
    servidor.once('error', falhou);
    servidor.once('listening', ouviu);
    servidor.listen(porta, HOST);
  });
}

function painelJaAberto(porta) {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port: porta, path: ROTA_SINAL, timeout: 800 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function abrirNavegador(endereco) {
  // Para testes automáticos: sobe o servidor sem abrir janela.
  if (process.env.AMAZONIA2050_SEM_NAVEGADOR) return;
  const opcoes = { detached: true, stdio: 'ignore' };
  let filho;
  if (process.platform === 'win32') {
    filho = spawn('rundll32', ['url.dll,FileProtocolHandler', endereco], opcoes);
  } else if (process.platform === 'darwin') {
    filho = spawn('open', [endereco], opcoes);
  } else {
    filho = spawn('xdg-open', [endereco], opcoes);
  }
  filho.on('error', () => {
    console.log(`  Não consegui abrir o navegador. Abra este endereço à mão: ${endereco}`);
  });
  filho.unref();
}

function esperarEnterESair(codigo) {
  // No Windows a janela fecha junto com o programa; sem esta pausa, a
  // mensagem de erro sumiria antes de ser lida.
  console.log('\n  Pressione Enter para fechar.');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(codigo));
}

async function iniciar() {
  if (process.platform === 'win32') process.title = 'Estratégia Amazônia 2050';

  const site = lerPacote();
  const servidor = criarServidor(site);

  let porta = null;
  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    const candidata = PORTA_INICIAL + tentativa;
    try {
      porta = await escutar(servidor, candidata);
      break;
    } catch (erro) {
      if (erro.code !== 'EADDRINUSE') throw erro;
      if (await painelJaAberto(candidata)) {
        const endereco = `http://localhost:${candidata}`;
        console.log(`\n  O painel já está aberto em ${endereco}. Abrindo o navegador…`);
        abrirNavegador(endereco);
        setTimeout(() => process.exit(0), 1500);
        return;
      }
    }
  }
  if (porta === null) {
    throw new Error(`nenhuma porta livre entre ${PORTA_INICIAL} e ${PORTA_INICIAL + TENTATIVAS - 1}`);
  }

  const endereco = `http://localhost:${porta}`;
  const linha = '─'.repeat(58);
  console.log(`\n  ${linha}`);
  console.log('   Estratégia Amazônia 2050 · versão portátil (sem internet)');
  console.log(`  ${linha}`);
  console.log(`\n   Painel rodando em  ${endereco}`);
  if (site.info.geradoEm) {
    console.log(`   Dados de           ${site.info.geradoEm}${site.info.commit ? `  (versão ${site.info.commit})` : ''}`);
  }
  console.log('\n   O navegador vai abrir sozinho. Se não abrir, copie o endereço acima.');
  console.log('   Para encerrar o painel, feche esta janela.\n');

  abrirNavegador(endereco);
}

process.on('SIGINT', () => process.exit(0));

iniciar().catch((erro) => {
  console.error(`\n  Não foi possível iniciar o painel: ${erro && erro.message ? erro.message : erro}`);
  esperarEnterESair(1);
});
