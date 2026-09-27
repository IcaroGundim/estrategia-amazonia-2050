import React from 'react';

/** Pastilha de filtro: eixo, situação da coleta, "Todos". */
export function FilterChip({ active = false, count, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      aria-pressed={active}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
      style={{
        minHeight: '32px', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: '6px',
        border: '1px solid ' + (active || hover ? 'var(--mata)' : 'var(--linha)'),
        borderRadius: 'var(--raio-pilula)',
        background: active ? 'var(--mata)' : '#efede9',
        color: active ? 'var(--areia)' : 'var(--tinta-2)',
        font: (active ? 600 : 400) + ' 10.5px var(--text)',
        cursor: 'pointer', transition: 'var(--transicao-borda)',
        ...style
      }}
    >
      {children}
      {count !== undefined && count !== null ? (
        <small style={{ color: active ? 'rgba(245, 240, 232, 0.72)' : 'var(--tinta-4)', fontVariantNumeric: 'tabular-nums' }}>{count}</small>
      ) : null}
    </button>
  );
}
