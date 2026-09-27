import React from 'react';

/** Ressalva de método: filete ocre à esquerda e fundo claro. */
export function Note({ variant = 'ficha', children, style, ...rest }) {
  const variantes = {
    ficha: { padding: '13px 16px', borderLeft: '3px solid var(--ocre)', background: 'var(--areia)', color: 'var(--tinta-3)', fontSize: '12px', lineHeight: 1.55 },
    ano: { padding: '8px 10px', borderLeft: '2px solid var(--ocre)', background: 'rgba(224, 168, 60, 0.12)', color: 'var(--tinta-3)', fontSize: '9.5px', lineHeight: 1.45 },
    fonte: { padding: '21px 23px', border: '1px solid var(--linha)', borderRadius: 'var(--raio-botao)', background: 'var(--papel)', color: 'var(--tinta-3)', fontSize: '13.5px', lineHeight: 1.6 }
  };
  return (
    <div {...rest} style={{ margin: 0, ...(variantes[variant] || variantes.ficha), ...style }}>
      {children}
    </div>
  );
}
