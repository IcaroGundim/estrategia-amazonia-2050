import React from 'react';

/** Barra fina de comparação por estado, com marca opcional do patamar. */
export function BarMeter({ label, value, fill = 0, target, tone = 'padrao', style, ...rest }) {
  const cores = { padrao: 'var(--mata-300)', cumprida: 'var(--mata)', selecionada: 'var(--urucum)', regional: 'var(--mata)' };
  const regional = tone === 'regional';
  return (
    <div
      {...rest}
      style={{
        display: 'grid', gridTemplateColumns: '22px minmax(0, 1fr) auto', alignItems: 'center', gap: '7px', minWidth: 0,
        marginBottom: regional ? '3px' : 0, paddingBottom: regional ? '8px' : 0,
        borderBottom: regional ? '1px solid var(--linha-2)' : 'none',
        ...style
      }}
    >
      <span style={{ color: regional ? 'var(--mata)' : 'var(--tinta-3)', fontSize: '9.5px', fontWeight: regional ? 800 : 700 }}>{label}</span>
      <span style={{ position: 'relative', height: '8px', display: 'block', borderRadius: '3px', background: 'var(--linha-2)' }}>
        <i style={{ position: 'absolute', inset: '0 auto 0 0', minWidth: '2px', width: Math.max(0, Math.min(100, fill)) + '%', borderRadius: '3px', background: cores[tone] || cores.padrao }} />
        {target !== undefined && target !== null ? (
          <i style={{ position: 'absolute', top: '-2px', bottom: '-2px', left: target + '%', width: '2px', borderRadius: '1px', background: 'var(--tinta-2)', transform: 'translateX(-1px)' }} />
        ) : null}
      </span>
      <b style={{ minWidth: '48px', color: tone === 'selecionada' ? 'var(--urucum)' : regional ? 'var(--mata)' : 'var(--tinta-2)', fontSize: '9.5px', fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: regional ? 800 : 700 }}>{value}</b>
    </div>
  );
}
