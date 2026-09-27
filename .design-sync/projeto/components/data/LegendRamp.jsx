import React from 'react';

/** Escala de desempenho relativo do mapa: cinco degraus de areia a verde-mata. */
export function LegendRamp({ from = 'menor desempenho', to = 'maior desempenho', style, ...rest }) {
  const degraus = ['var(--rampa-1)', 'var(--rampa-2)', 'var(--rampa-3)', 'var(--rampa-4)', 'var(--rampa-5)'];
  return (
    <div
      {...rest}
      style={{
        minHeight: '34px', paddingTop: '15px', display: 'flex', alignItems: 'center', gap: '11px',
        borderTop: '1px solid var(--linha-2)', color: 'var(--tinta-4)', fontSize: '10px',
        ...style
      }}
    >
      <span style={{ whiteSpace: 'nowrap' }}>{from}</span>
      <i style={{ width: 'min(240px, 34%)', height: '10px', display: 'flex', overflow: 'hidden', borderRadius: '5px' }}>
        {degraus.map((cor) => <b key={cor} style={{ flex: 1, background: cor }} />)}
      </i>
      <span style={{ whiteSpace: 'nowrap' }}>{to}</span>
    </div>
  );
}
