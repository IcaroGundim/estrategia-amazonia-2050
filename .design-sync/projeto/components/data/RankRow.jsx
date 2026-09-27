import React from 'react';

/** Linha do ranking estadual: posição, bandeira, nome e medida com barra segmentada. */
export function RankRow({ position, flagSrc, name, meta, value, fill = 0, selected = false, region = false, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
      style={{
        position: 'relative', width: '100%', minHeight: '46px', padding: '11px 6px',
        display: 'grid', gridTemplateColumns: '28px 32px minmax(120px, 1fr) minmax(125px, 0.85fr)',
        alignItems: 'center', gap: '10px', border: 0, borderRadius: 'var(--raio-opcao)',
        background: selected || hover ? 'var(--areia-selecao)' : 'transparent',
        color: 'var(--tinta)', textAlign: 'left', cursor: 'pointer',
        ...style
      }}
    >
      {selected ? <i style={{ position: 'absolute', zIndex: 2, top: 0, bottom: 0, left: 0, width: '3px', borderRadius: '2px', background: 'var(--urucum)' }} /> : null}
      <span aria-hidden={region} style={{ color: 'var(--urucum)', font: '800 15px var(--display)', fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}>{region ? '' : position}</span>
      <img src={flagSrc} alt="" style={{ justifySelf: 'center', width: 'auto', maxWidth: '100%', height: '21px', border: '1px solid var(--linha)', borderRadius: '3px' }} />
      <span>
        <b style={{ display: 'block', fontSize: '13px', fontWeight: region ? 700 : 500, color: region ? 'var(--mata)' : 'inherit' }}>{name}</b>
        <small style={{ display: 'block', marginTop: '2px', color: region ? 'var(--mata-500)' : 'var(--tinta-4)', fontSize: '9px' }}>{meta}</small>
      </span>
      <span style={{ textAlign: 'right' }}>
        <b style={{ display: 'block', color: 'var(--mata)', font: '600 11px var(--text)', whiteSpace: 'nowrap' }}>{value}</b>
        <i style={{
          height: '8px', display: 'block', marginTop: '5px', overflow: 'hidden', background: 'var(--linha-2)',
          WebkitMask: 'repeating-linear-gradient(90deg, #000 0 calc(100% / 9 - 3px), transparent calc(100% / 9 - 3px) calc(100% / 9))',
          mask: 'repeating-linear-gradient(90deg, #000 0 calc(100% / 9 - 3px), transparent calc(100% / 9 - 3px) calc(100% / 9))'
        }}>
          <em style={{ height: '100%', display: 'block', width: Math.max(0, Math.min(100, fill)) + '%', background: 'var(--mata-500)' }} />
        </i>
      </span>
    </button>
  );
}
