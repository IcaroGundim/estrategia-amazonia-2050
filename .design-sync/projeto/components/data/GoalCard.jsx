import React from 'react';

/** Um dos dois números do topo do cartão: rótulo em versalete, valor e nota. */
function Numero({ label, value, note, meta }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '2px 0 2px 10px', lineHeight: 1.15 }}>
      <span style={{ color: 'var(--tinta-4)', font: '600 9px var(--text)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      <b style={{ color: meta ? 'var(--mata)' : 'var(--tinta-2)', font: (meta ? '800' : '700') + ' 16px/1.15 var(--display)', fontVariantNumeric: 'tabular-nums' }}>{value}</b>
      {note ? <small style={{ color: 'var(--tinta-4)', fontSize: '10px' }}>{note}</small> : null}
    </span>
  );
}

/**
 * Cartão de meta da rota Metas e indicadores. Com patamar: a jornada em número grande
 * à esquerda, o valor atual e a meta lado a lado e a barra da jornada. No catálogo
 * (variant="catalogo"): nome, motivo em itálico e o selo de coleta à direita.
 */
export function GoalCard({
  variant = 'meta',
  name,
  reading,
  readingLabel = 'jornada',
  current,
  currentNote,
  target,
  targetNote,
  progress = 0,
  met = false,
  active = false,
  reason,
  status,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const catalogo = variant === 'catalogo';
  const vazio = !catalogo && (reading === undefined || reading === null || reading === '—');
  const p = Math.max(0, Math.min(100, progress));

  const nome = (
    <span style={{ display: 'block', flex: catalogo ? undefined : 1, minWidth: 0, color: hover ? 'var(--mata)' : 'var(--tinta)', fontSize: '15px', fontWeight: 500, lineHeight: 1.3 }}>
      {name}
      {catalogo && reason ? <small style={{ display: 'block', marginTop: '2px', color: 'var(--tinta-4)', fontSize: '10px', fontWeight: 400, fontStyle: 'italic' }}>{reason}</small> : null}
    </span>
  );

  return (
    <button
      type="button"
      aria-expanded={active}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
      style={{
        position: 'relative', width: '100%', minWidth: 0, padding: '12px 14px',
        display: 'grid', gridTemplateColumns: catalogo ? 'minmax(0, 1fr) auto' : '64px minmax(0, 1fr)',
        alignItems: catalogo ? 'center' : 'start', gap: '2px 12px',
        border: '1px solid ' + (active ? 'var(--urucum)' : hover ? 'var(--mata-300)' : 'var(--linha-2)'),
        borderRadius: '10px', background: 'var(--papel)', textAlign: 'left', cursor: 'pointer',
        boxShadow: active ? 'inset 0 0 0 1px var(--urucum)' : 'none',
        transition: 'border-color 160ms ease, box-shadow 180ms ease',
        font: 'inherit',
        ...style
      }}
    >
      {catalogo ? (
        <React.Fragment>
          {nome}
          <span style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>{status}</span>
        </React.Fragment>
      ) : (
        <React.Fragment>
          <span style={{ gridRow: '1 / 3', alignSelf: 'center', whiteSpace: 'nowrap' }}>
            <b style={{ display: 'block', color: vazio ? 'var(--tinta-4)' : 'var(--mata)', font: '800 26px/1 var(--display)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{vazio ? '—' : reading}</b>
            <small style={{ display: 'block', marginTop: '3px', color: 'var(--tinta-4)', fontSize: '10px' }}>{readingLabel}</small>
          </span>
          <span style={{ minWidth: 0, display: 'block' }}>
            <span style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              {nome}
              <span style={{ flex: 'none', display: 'flex', gap: '8px', alignItems: 'flex-start', whiteSpace: 'nowrap' }}>
                <Numero label="atual" value={current} note={currentNote} />
                <Numero label="meta" value={target} note={targetNote} meta />
              </span>
            </span>
            <span aria-hidden="true" style={{ position: 'relative', height: '10px', marginTop: '8px', display: 'block', overflow: 'hidden', borderRadius: '4px', background: 'var(--linha-2)' }}>
              <i style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, transparent 0 5px, rgba(192, 69, 31, 0.12) 5px 10px)' }} />
              <i style={{ position: 'absolute', inset: '0 auto 0 0', width: p + '%', borderRadius: '4px 2px 2px 4px', background: met ? 'var(--mata)' : 'var(--mata-500)', transition: 'width 620ms var(--curva), background 300ms ease' }} />
            </span>
          </span>
        </React.Fragment>
      )}
    </button>
  );
}
