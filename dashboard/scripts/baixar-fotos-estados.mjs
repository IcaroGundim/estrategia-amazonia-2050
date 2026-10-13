// Baixa do Wikimedia Commons as fotos ilustrativas dos estados, usadas na
// página /projetos pelos projetos que o site do Consórcio publica sem foto.
// Ferramenta de trabalho: não entra no build.
//
// Uso: node scripts/baixar-fotos-estados.mjs
//
// A escolha é manual e mora em conteudo/fotos-estados.json: cada entrada diz o
// estado (`uf`) e o arquivo no Commons (`commons`, "File:…"). O script busca no
// Commons o autor e a licença de cada uma, recusa o que não for de uso livre
// (CC BY, CC BY-SA, CC0 ou domínio público), baixa a imagem, recorta em
// 800×450 e grava em public/fotos-projetos/estados/. Autor, licença e a
// página de origem voltam para o JSON, porque a licença exige o crédito e é o
// JSON que a página lê para mostrá-lo.
//
// Para trocar ou acrescentar uma foto: edite a lista (só `uf` e `commons`
// bastam) e rode de novo. O que já foi baixado não é pedido outra vez.
//
// O `sharp` não é dependência declarada do projeto: vem junto com o Astro.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const LISTA = fileURLToPath(new URL('../conteudo/fotos-estados.json', import.meta.url));
const PASTA = fileURLToPath(new URL('../public/fotos-projetos/estados/', import.meta.url));
const API = 'https://commons.wikimedia.org/w/api.php';
// O Commons pede um agente que diga quem é e como falar com quem roda o script.
const AGENTE = 'PainelEstrategiaAmazonia2050/1.0 (https://estrategia2050.vercel.app; fotos ilustrativas dos estados)';
const LIVRE = /^(CC BY(-SA)?( \d\.\d)?( [a-z]{2})?|CC0( 1\.0)?|Public domain)$/i;
const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const semHtml = (texto) => String(texto || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// "Fulano from Fortaleza, BR" e "Original: Fulano" são como o Flickr e o Commons anotam o autor; fica só o nome.
const autorLimpo = (texto) => semHtml(texto).replace(/^(original|own work|obra do próprio)\s*:?\s*/i, '').replace(/\s+from\s+.+$/i, '').replace(/\s*\(own work\)$/i, '').replace(/^User:/i, '').slice(0, 80) || 'autor não informado';
// O nome leva um resumo do título inteiro: séries como "… Foto Fulano (01)" e
// "(02)" só diferem no fim, que o corte do nome joga fora.
const nomeDoArquivo = (uf, titulo) => {
  const base = titulo.replace(/^File:/, '').replace(/\.\w+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 44);
  return `${uf.toLowerCase()}-${base}-${createHash('sha1').update(titulo).digest('hex').slice(0, 6)}.jpg`;
};

async function metadados(titulos) {
  const saida = new Map();
  for (let i = 0; i < titulos.length; i += 40) {
    const parametros = new URLSearchParams({
      action: 'query', format: 'json', formatversion: '2', prop: 'imageinfo', titles: titulos.slice(i, i + 40).join('|'),
      iiprop: 'url|size|extmetadata', iiurlwidth: '960', iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist'
    });
    const dados = await fetch(`${API}?${parametros}`, { headers: { 'User-Agent': AGENTE } }).then((resposta) => resposta.json());
    const normalizados = new Map((dados.query.normalized || []).map((item) => [item.to, item.from]));
    for (const pagina of dados.query.pages) {
      const info = pagina.imageinfo?.[0];
      if (info) saida.set(normalizados.get(pagina.title) || pagina.title, info);
    }
    await espera(400);
  }
  return saida;
}

const lista = JSON.parse(await readFile(LISTA, 'utf8'));
await mkdir(PASTA, { recursive: true });
const infos = await metadados(lista.fotos.map((foto) => foto.commons));
let baixadas = 0;
for (const foto of lista.fotos) {
  const info = infos.get(foto.commons);
  if (!info) throw new Error(`Não achei no Commons: ${foto.commons}`);
  const licenca = semHtml(info.extmetadata?.LicenseShortName?.value);
  if (!LIVRE.test(licenca)) throw new Error(`${foto.commons}: licença "${licenca}" não é de uso livre; tire da lista.`);
  foto.arquivo = `/fotos-projetos/estados/${nomeDoArquivo(foto.uf, foto.commons)}`;
  foto.autor = autorLimpo(info.extmetadata?.Artist?.value);
  foto.licenca = licenca;
  foto.licencaUrl = info.extmetadata?.LicenseUrl?.value || null;
  foto.pagina = info.descriptionurl;
  const destino = join(PASTA, nomeDoArquivo(foto.uf, foto.commons));
  if (existsSync(destino)) continue;
  const resposta = await fetch(info.thumburl, { headers: { 'User-Agent': AGENTE } });
  if (!resposta.ok) throw new Error(`${foto.commons}: HTTP ${resposta.status} ao baixar`);
  // Recorte central em 16:9, a proporção do cartão; `attention` puxa o corte para onde a foto tem assunto.
  await sharp(Buffer.from(await resposta.arrayBuffer())).resize(800, 450, { fit: 'cover', position: 'attention' }).jpeg({ quality: 74, mozjpeg: true }).toFile(destino);
  baixadas += 1;
  await espera(500);
}
lista._leia = 'Fotos ilustrativas dos estados, do Wikimedia Commons, para os projetos da carteira que o site do Consórcio publica sem foto (pipeline/projetos.mjs as distribui). São paisagens do estado, não do projeto, e a página avisa isso com o crédito. A escolha é manual: para trocar ou acrescentar, edite `uf` e `commons` e rode scripts/baixar-fotos-estados.mjs, que baixa a imagem e preenche autor, licença e página de origem. Só entram licenças de uso livre (CC BY, CC BY-SA, CC0, domínio público); o crédito é exigência delas.';
await writeFile(LISTA, `${JSON.stringify(lista, null, 2)}\n`);
console.log(`${lista.fotos.length} fotos na lista, ${baixadas} baixadas agora.`);
