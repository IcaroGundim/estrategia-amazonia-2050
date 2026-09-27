import React from 'react';

/** Dica do mapa: caixa verde-mata com o estado, o indicador e o valor. */
export function Tooltip({ title, meta, value, style, ...rest }) {
  return (
    <div
      role="status"
      {...rest}
      style={{
        width: 'max-content', minWidth: '170px', maxWidth: '230px', padding: '11px 13px',
        border: '1px solid rgba(245, 240, 232, 0.18)', borderRadius: '7px',
        background: 'var(--mata)', color: 'var(--areia)', boxShadow: 'var(--sombra-tooltip)',
        pointerEvents: 'none',
        ...style
      }}
    >
      <strong style={{ display: 'block', color: 'var(--ocre)', font: '800 14px var(--display)' }}>{title}</strong>
      {meta ? <span style={{ display: 'block', marginTop: '3px', color: 'rgba(245, 240, 232, 0.62)', fontSize: '8px' }}>{meta}</span> : null}
      <b style={{ display: 'block', marginTop: '7px', color: '#fff', font: '800 15px var(--display)' }}>{value}</b>
    </div>
  );
}
