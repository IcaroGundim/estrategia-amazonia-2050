import React from 'react';

/** Cabeçalho de eixo: número em quadrado verde, nome e contagem. */
export function AxisHeader({ number, title, meta, style, ...rest }) {
  return (
    <header
      {...rest}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '7px', borderBottom: '2px solid var(--mata)', ...style }}
    >
      <span aria-hidden="true" style={{
        display: 'grid', placeContent: 'center', flex: 'none', width: '22px', height: '22px',
        borderRadius: '6px', background: 'var(--mata)', color: 'var(--areia)', font: '800 12px var(--display)'
      }}>{number}</span>
      <h3 style={{ margin: 0, font: '800 13.5px var(--display)', letterSpacing: '0.01em', color: 'var(--tinta)' }}>{title}</h3>
      {meta ? <span style={{ color: 'var(--tinta-4)', fontSize: '10.5px' }}>{meta}</span> : null}
    </header>
  );
}
