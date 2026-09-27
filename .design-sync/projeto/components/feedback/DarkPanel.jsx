import React from 'react';

/** Bloco de leitura em verde-mata: a frase que interpreta o número. */
export function DarkPanel({ label, children, note, radius = 8, padding = '16px', style, ...rest }) {
  return (
    <div
      {...rest}
      style={{
        padding, borderRadius: typeof radius === 'number' ? radius + 'px' : radius,
        background: 'var(--mata)', color: 'var(--areia)',
        ...style
      }}
    >
      {label ? (
        <span style={{ display: 'block', marginBottom: '12px', color: 'var(--ocre)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      ) : null}
      <div style={{ color: 'rgba(245, 240, 232, 0.72)', fontSize: '12px', lineHeight: 1.5 }}>{children}</div>
      {note ? (
        <p style={{ margin: '9px 0 0', paddingTop: '9px', borderTop: '1px solid rgba(245, 240, 232, 0.16)', color: 'rgba(245, 240, 232, 0.56)', fontSize: '10.5px', lineHeight: 1.5 }}>{note}</p>
      ) : null}
    </div>
  );
}
