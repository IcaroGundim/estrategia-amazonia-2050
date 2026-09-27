import React from 'react';

/** Campo de busca da barra de filtros. O ícone é o caractere ⌕, não um SVG. */
export function SearchField({ placeholder = 'Buscar meta, indicador ou código', value, onChange, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label
      {...rest}
      style={{
        width: '100%', minHeight: '47px', padding: '0 15px', display: 'flex', alignItems: 'center', gap: '10px',
        border: '1px solid ' + (focus ? 'var(--mata)' : 'var(--linha)'), borderRadius: 'var(--raio-botao)',
        background: 'var(--papel)', color: 'var(--tinta-4)',
        boxShadow: focus ? 'var(--foco-mata)' : 'none',
        ...style
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '15px', lineHeight: 1 }}>⌕</span>
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        autoComplete="off"
        style={{ width: '100%', border: 0, outline: 0, background: 'transparent', color: 'var(--tinta)', font: '13px var(--text)' }}
      />
    </label>
  );
}
