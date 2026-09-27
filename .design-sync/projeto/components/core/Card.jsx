import React from 'react';

/** Cartão de papel: a caixa branca de 14px de raio que sustenta quase todo o painel. */
export function Card({ tone = 'papel', elevation = 'none', padding = 22, as = 'div', style, children, ...rest }) {
  const Tag = as;
  const fundos = { papel: 'var(--papel)', areia: 'var(--areia)', mata: 'var(--mata)', transparente: 'transparent' };
  const sombras = { none: 'none', cartao: 'var(--sombra-cartao)', lateral: 'var(--sombra-lateral)' };
  return (
    <Tag
      {...rest}
      style={{
        border: tone === 'mata' ? '0' : '1px solid var(--linha)',
        borderRadius: 'var(--raio-cartao)',
        background: fundos[tone] || fundos.papel,
        color: tone === 'mata' ? 'var(--areia)' : 'var(--tinta)',
        boxShadow: sombras[elevation] || 'none',
        padding: typeof padding === 'number' ? padding + 'px' : padding,
        ...style
      }}
    >
      {children}
    </Tag>
  );
}
