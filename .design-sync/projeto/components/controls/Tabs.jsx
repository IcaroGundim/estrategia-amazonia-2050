import React from 'react';

/** Abas do painel: "sidebar" divide a largura em partes iguais; "detail" fica à esquerda. */
export function Tabs({ items = [], value, onChange, variant = 'sidebar', style, ...rest }) {
  const lateral = variant === 'sidebar';
  return (
    <div
      role="tablist"
      {...rest}
      style={{
        display: lateral ? 'grid' : 'flex',
        gridTemplateColumns: lateral ? 'repeat(' + items.length + ', 1fr)' : undefined,
        gap: lateral ? 0 : '4px',
        padding: lateral ? '0 22px' : 0,
        margin: lateral ? 0 : '15px 0 0',
        borderBottom: '1px solid var(--linha)',
        ...style
      }}
    >
      {items.map((item) => {
        const ativo = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange && onChange(item.key)}
            style={{
              position: 'relative',
              minHeight: lateral ? '52px' : 'auto',
              marginBottom: lateral ? 0 : '-1px',
              padding: lateral ? '4px 6px 0' : '9px 12px',
              border: 0, borderBottom: '2px solid ' + (ativo ? 'var(--urucum)' : 'transparent'),
              background: 'transparent',
              color: ativo ? 'var(--mata)' : 'var(--tinta-4)',
              font: '600 ' + (lateral ? '12px' : '12.5px') + ' var(--text)',
              cursor: 'pointer', transition: 'color var(--dur-borda) ease, border-color var(--dur-borda) ease'
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
