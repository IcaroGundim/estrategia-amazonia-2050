// O mapa dos nove estados da aba Projetos: a mesma projeção simples da Visão
// Geral, num quadro de 300 × 240. Fica num módulo porque a busca do lugar da
// sigla é cara: assim ela roda uma vez por servidor, e não a cada página (a
// prévia da administração renderiza a aba a cada tecla).
import geo from '../../public/data/geo.json';

export const LARGURA = 300;
export const ALTURA = 240;

type Anel = number[][];
const poligonos = (g: { type: string; coordinates: unknown }) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as Anel[][];
const pontos = geo.features.flatMap((f: { geometry: { type: string; coordinates: unknown } }) => poligonos(f.geometry).flat(1).flat(1)) as number[][];
const [x0, x1, y1] = [Math.min(...pontos.map((p) => p[0])), Math.max(...pontos.map((p) => p[0])), Math.max(...pontos.map((p) => p[1]))];
const y0 = Math.min(...pontos.map((p) => p[1]));
const escala = Math.min((LARGURA - 16) / (x1 - x0), (ALTURA - 16) / (y1 - y0));
const projeta = ([lon, lat]: number[]) => [8 + (lon - x0) * escala, 8 + (y1 - lat) * escala];
// pontos a menos de 0,6 do anterior saem: no tamanho do mapa não se veem
const simplifica = (anel: Anel) => {
  const saida: Anel = [];
  for (const c of anel) { const q = projeta(c), u = saida.at(-1); if (u && Math.hypot(q[0] - u[0], q[1] - u[1]) < 0.6) continue; saida.push(q); }
  return saida;
};
const caminho = (anel: Anel) => (anel.length > 2 ? `M${anel.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z` : '');
// a sigla vai no ponto mais longe da borda do maior polígono (busca em grade)
const dentro = (x: number, y: number, an: Anel) => { let d = false; for (let i = 0, j = an.length - 1; i < an.length; j = i++) { const [xi, yi] = an[i], [xj, yj] = an[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d; } return d; };
const distBorda = (x: number, y: number, an: Anel) => { let m = Infinity; for (let i = 0, j = an.length - 1; i < an.length; j = i++) { const [ax, ay] = an[j], [bx, by] = an[i]; const dx = bx - ax, dy = by - ay; const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))); m = Math.min(m, Math.hypot(x - ax - k * dx, y - ay - k * dy)); } return m; };

export const MAPA = geo.features.map((f: { properties: { SIGLA_UF?: string; uf?: string }; geometry: { type: string; coordinates: unknown } }) => {
  const aneis = poligonos(f.geometry).map((pl) => pl.map(simplifica));
  const maior = [...aneis].sort((a, b) => b[0].length - a[0].length)[0][0];
  const xs = maior.map((p) => p[0]), ys = maior.map((p) => p[1]);
  let rot = [0, 0], melhor = -1;
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1.5) for (let y = Math.min(...ys); y <= Math.max(...ys); y += 1.5) if (dentro(x, y, maior)) { const d = distBorda(x, y, maior); if (d > melhor) { melhor = d; rot = [x, y]; } }
  return { uf: f.properties.SIGLA_UF || f.properties.uf || '', d: aneis.map((pl) => pl.map(caminho).join('')).join(''), rot };
});
