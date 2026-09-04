// Gera a bandeira da Amazônia Legal (public/flags/Bandeira_da_Amazonia_Legal.svg).
// A região não tem bandeira oficial, então a marca é a silhueta dos nove estados
// desenhada a partir da MESMA malha que o mapa do painel usa — se o geo.json
// mudar, rode `node scripts/gerar_bandeira_regiao.mjs` na raiz para refazer.

import fs from 'node:fs';

const geo = JSON.parse(fs.readFileSync('dashboard/public/data/geo.json', 'utf8'));

// Anéis externos de todos os estados. Como o desenho é uma silhueta única em
// branco, as fronteiras internas somem sozinhas e não é preciso unir polígonos.
const rings = [];
for (const f of geo.features) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const poly of polys) rings.push(poly[0]);
}

let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
for (const r of rings) for (const [lon, lat] of r) {
  if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
  if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
}

const W = 900, H = 600, PAD = 34;
const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180); // equirretangular
const project = ([lon, lat]) => [lon * k, -lat];
const [x0] = project([minLon, 0]), [x1] = project([maxLon, 0]);
const [, y0] = project([0, maxLat]), [, y1] = project([0, minLat]);
const scale = Math.min((W - 2 * PAD) / (x1 - x0), (H - 2 * PAD) / (y1 - y0));
const offX = (W - (x1 - x0) * scale) / 2, offY = (H - (y1 - y0) * scale) / 2;
const toPx = (c) => { const [x, y] = project(c); return [(x - x0) * scale + offX, (y - y0) * scale + offY]; };

const TOL = 0.55;   // px entre pontos consecutivos
const MIN_ILHA = 2; // px de lado — ilhas menores viram sujeira no traço
const paths = [];
for (const ring of rings) {
  const pts = [];
  for (const c of ring) {
    const p = toPx(c);
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= TOL) pts.push(p);
  }
  if (pts.length < 4) continue;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  if (Math.max(...xs) - Math.min(...xs) < MIN_ILHA && Math.max(...ys) - Math.min(...ys) < MIN_ILHA) continue;
  const f = (n) => Number(n.toFixed(1));
  paths.push('M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z');
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Bandeira da Amazônia Legal">
  <title>Bandeira da Amazônia Legal</title>
  <rect width="${W}" height="${H}" fill="#13342a"/>
  <path fill="#ffffff" fill-rule="nonzero" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round" d="${paths.join('')}"/>
</svg>
`;
fs.writeFileSync('dashboard/public/flags/Bandeira_da_Amazonia_Legal.svg', svg);
console.log('anéis:', paths.length, '| KB:', (svg.length / 1024).toFixed(1));
