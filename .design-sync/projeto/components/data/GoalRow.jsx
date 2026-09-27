import React from 'react';

/** Linha de meta: nome, jornada até o patamar, leitura e a seta de abrir. */
export function GoalRow({ name, target, progress = 0, valueLabel, reading, active = false, met = false, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const p = Math.max(0, Math.min(100, progress));
  const dentro = p >= 22;
  return (
    <button
      type="button"
      aria-expanded={active}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
      style={{
        position: 'relative', width: '100%', padding: '12px 0', paddingLeft: active ? '12px' : 0,
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(150px, 220px) auto 14px',
        alignItems: 'center', gap: '14px', border: 0, background: 'transparent', textAlign: 'left',
        boxShadow: hover ? 'var(--sombra-linha-hover)' : 'none', cursor: 'pointer',
        transition: 'padding-left 220ms ease, box-shadow 180ms ease',
        ...style
      }}
    >
      {active ? <i style={{ position: 'absolute', top: '10px', bottom: '10px', left: 0, width: '3px', borderRadius: '2px', background: 'var(--urucum)' }} /> : null}
      <span style={{ minWidth: 0, color: hover || active ? 'var(--mata)' : 'var(--tinta)', fontSize: '13px', fontWeight: 500, lineHeight: 1.3 }}>
        {name}
        <small style={{ display: 'block', marginTop: '2px', color: 'var(--tinta-4)', fontSize: '10px', fontWeight: 400 }}>{target}</small>
      </span>
      <span aria-hidden="true" style={{ position: 'relative', height: '14px', display: 'block', overflow: 'hidden', borderRadius: 'var(--raio-barra)', background: 'var(--linha-2)' }}>
        <i style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, transparent 0 5px, rgba(192, 69, 31, 0.12) 5px 10px)' }} />
        <i style={{ position: 'absolute', inset: '0 auto 0 0', width: p + '%', borderRadius: '4px 2px 2px 4px', background: met ? 'var(--mata)' : 'var(--mata-500)', transition: 'var(--transicao-barra)' }} />
        {valueLabel ? (
          <em style={{
            position: 'absolute', top: '50%', left: p + '%',
            transform: dentro ? 'translate(calc(-100% - 6px), -50%)' : 'translate(6px, -50%)',
            color: dentro ? 'var(--areia)' : 'var(--tinta-2)',
            font: '700 10px/1 var(--text)', fontStyle: 'normal', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap'
          }}>{valueLabel}</em>
        ) : null}
      </span>
      <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <b style={{ display: 'block', color: 'var(--mata)', font: '800 14px var(--display)', fontVariantNumeric: 'tabular-nums' }}>{reading}</b>
        <small style={{ color: 'var(--tinta-4)', fontSize: '10px' }}>jornada</small>
      </span>
      <span aria-hidden="true" style={{ color: active ? 'var(--urucum)' : 'var(--tinta-4)', font: '700 20px/1 var(--display)', transform: active ? 'translateX(2px)' : 'none', transition: 'transform var(--dur-seta) ease, color var(--dur-seta) ease' }}>›</span>
    </button>
  );
}
