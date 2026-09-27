import React from 'react';

/** Filete de rio: duas curvas rasas que separam o conteúdo do rodapé. */
export function RiverRule({ style, ...rest }) {
  const curva = { position: 'absolute', left: '-4%', width: '108%', height: '34px', borderRadius: '50%' };
  return (
    <div
      {...rest}
      aria-hidden="true"
      style={{ position: 'relative', height: '32px', overflow: 'hidden', background: 'var(--areia)', ...style }}
    >
      <i style={{ ...curva, top: '18px', borderTop: '3px solid var(--urucum)' }} />
      <i style={{ ...curva, top: '25px', borderTop: '2px solid var(--linha)' }} />
    </div>
  );
}
