import React from 'react';

/** Sobrelinha em versalete que abre praticamente toda seção do painel. */
export function Eyebrow({ tone = 'acento', as = 'p', style, children, ...rest }) {
  const Tag = as;
  const cores = { acento: 'var(--urucum)', suave: 'var(--tinta-4)', claro: 'var(--ocre)', corpo: 'var(--tinta-3)' };
  return (
    <Tag
      {...rest}
      style={{
        margin: '0 0 10px',
        color: cores[tone] || cores.acento,
        font: '600 var(--eyebrow-tamanho)/1.2 var(--text)',
        letterSpacing: 'var(--eyebrow-tracking)',
        textTransform: 'uppercase',
        ...style
      }}
    >
      {children}
    </Tag>
  );
}
