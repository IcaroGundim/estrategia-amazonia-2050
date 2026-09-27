import React from 'react';

/** Cartão de número: rótulo em versalete, valor no display e uma linha de procedência. */
export function MetricCard({ label, value, footnote, compact = false, style, ...rest }) {
  return (
    <article
      {...rest}
      style={{
        minHeight: '126px', padding: 'var(--recheio-metrica)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        border: '1px solid var(--linha)', borderRadius: 'var(--raio-cartao)', background: 'var(--papel)',
        ...style
      }}
    >
      <p style={{ margin: '0 0 10px', color: 'var(--tinta-3)', fontSize: 'var(--eyebrow-tamanho)', fontWeight: 600, letterSpacing: 'var(--eyebrow-tracking)', textTransform: 'uppercase' }}>{label}</p>
      <p style={{ margin: '6px 0', color: 'var(--mata)', font: (compact ? '800 22px/1' : '800 30px/1') + ' var(--display)', letterSpacing: 'var(--titulo-tracking-forte)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {footnote ? <p style={{ margin: 0, color: 'var(--tinta-4)', fontSize: 'var(--texto-mudo)' }}>{footnote}</p> : null}
    </article>
  );
}
