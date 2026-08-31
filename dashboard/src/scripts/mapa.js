// Geometria do mapa da Amazônia Legal, compartilhada pelo Panorama e pelas Metas.
// Projeção equirretangular simples: as nove UFs cabem numa faixa estreita de
// latitude, então a distorção é irrelevante na escala do painel.

export function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i]; const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

export function ringCentroid(ring) {
  const area = ringArea(ring);
  if (area === 0) {
    const fallback = ring.reduce((sum, [x, y]) => [sum[0] + x, sum[1] + y], [0, 0]);
    return [fallback[0] / ring.length, fallback[1] / ring.length];
  }
  let cx = 0; let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i]; const [x2, y2] = ring[i + 1];
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  return [cx / (6 * area), cy / (6 * area)];
}

export function centroidOf(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const largestPolygon = polygons.reduce((largest, polygon) => Math.abs(ringArea(polygon[0])) > Math.abs(ringArea(largest[0])) ? polygon : largest);
  return ringCentroid(largestPolygon[0]);
}

export function coordinatesOf(geometry) {
  const points = [];
  const walk = (coordinates) => {
    if (typeof coordinates[0] === 'number') points.push(coordinates);
    else coordinates.forEach(walk);
  };
  walk(geometry.coordinates);
  return points;
}

export function mapPath(geometry, project) {
  const ringPath = (ring) => `${ring.map((coordinate, index) => `${index ? 'L' : 'M'}${project(coordinate).join(',')}`).join('')}Z`;
  if (geometry.type === 'Polygon') return geometry.coordinates.map(ringPath).join('');
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flatMap((polygon) => polygon.map(ringPath)).join('');
  return '';
}

export function extent(points, index) {
  let min = Infinity; let max = -Infinity;
  for (const point of points) {
    const value = point[index];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return [min, max];
}

// Ajusta as feições à caixa informada e devolve a função de projeção.
export function projecaoPara(features, { width, height, padding = 34 }) {
  const all = features.flatMap((feature) => coordinatesOf(feature.geometry));
  const [minX, maxX] = extent(all, 0);
  const [minY, maxY] = extent(all, 1);
  const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  return ([x, y]) => [offsetX + (x - minX) * scale, height - offsetY - (y - minY) * scale];
}
