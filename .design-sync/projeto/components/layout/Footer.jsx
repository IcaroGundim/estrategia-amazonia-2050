import React from 'react';

/** Rodapé do painel: nome do produto à esquerda, atribuição institucional à direita. */
export function Footer({ product = 'Estratégia 2050', owner = 'Estratégia Amazônia 2050 · Consórcio da Amazônia Legal', style, ...rest }) {
  return (
    <footer
      {...rest}
      style={{
        padding: '24px var(--margem-pagina)', display: 'flex', justifyContent: 'space-between', gap: '24px',
        background: 'var(--mata)', color: 'rgba(245, 240, 232, 0.72)', fontSize: '11px',
        ...style
      }}
    >
      <span style={{ color: 'var(--areia)', font: '800 14px var(--display)' }}>{product}</span>
      <span>{owner}</span>
    </footer>
  );
}
