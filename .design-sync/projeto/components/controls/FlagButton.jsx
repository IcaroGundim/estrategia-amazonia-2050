import React from 'react';

/** Bandeira de estado como botão de recorte. Selecionada, ganha anel urucum. */
export function FlagButton({ src, alt = '', active = false, ratio, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      aria-pressed={active}
      title={alt}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      {...rest}
      style={{
        width: '42px', height: '28px', padding: 0, display: 'grid', placeContent: 'center',
        border: '1px solid ' + (active ? 'var(--urucum)' : hover ? 'var(--mata-500)' : 'var(--linha)'),
        borderRadius: 'var(--raio-selo)', background: 'var(--papel)', overflow: 'hidden', cursor: 'pointer',
        boxShadow: active ? 'var(--anel-selecao)' : 'none',
        transition: 'var(--transicao-borda)',
        ...style
      }}
    >
      <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', aspectRatio: ratio }} />
    </button>
  );
}
