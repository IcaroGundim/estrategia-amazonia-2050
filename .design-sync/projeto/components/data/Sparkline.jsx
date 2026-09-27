import React from 'react';

function caminho(pontos) {
  return pontos.map((ponto, indice) => (indice ? 'L' : 'M') + ponto.x + ',' + ponto.y).join('');
}

function escalar(valores, largura, altura) {
  const finitos = valores.filter((valor) => Number.isFinite(valor));
  const min = Math.min(...finitos);
  const max = Math.max(...finitos);
  const amplitude = max - min || 1;
  return valores.map((valor, indice) => ({
    x: +(valores.length > 1 ? (indice / (valores.length - 1)) * largura : largura / 2).toFixed(1),
    y: +(altura - ((valor - min) / amplitude) * altura).toFixed(1)
  }));
}

/** Trajetória de uma série: linha, área a 12% e, quando houver, a régua regional tracejada. */
export function Sparkline({ values = [], reference = [], width = 260, height = 88, style, ...rest }) {
  const pontos = escalar(values, width, height);
  const referencia = reference.length > 1 ? escalar(reference, width, height) : [];
  const area = pontos.length ? caminho(pontos) + 'L' + width + ',' + height + 'L0,' + height + 'Z' : '';
  const ultimo = pontos[pontos.length - 1];
  return (
    <svg
      viewBox={'0 0 ' + width + ' ' + height}
      preserveAspectRatio="none"
      {...rest}
      style={{ width: '100%', height: height + 'px', display: 'block', overflow: 'visible', ...style }}
    >
      {area ? <path d={area} fill="var(--mata-500)" fillOpacity="0.12" /> : null}
      {referencia.length ? <path d={caminho(referencia)} fill="none" stroke="var(--tinta-4)" strokeWidth="1.3" strokeDasharray="4 3" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : null}
      {pontos.length ? <path d={caminho(pontos)} fill="none" stroke="var(--mata-500)" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /> : null}
      {ultimo ? <line x1={ultimo.x} y1="0" x2={ultimo.x} y2={height} stroke="var(--urucum)" strokeWidth="2" vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  );
}
