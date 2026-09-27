import React from 'react';

const ESTILO_BASE = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  border: '1px solid transparent',
  cursor: 'pointer',
  font: '600 11px var(--text)',
  textDecoration: 'none',
  transition: 'var(--transicao-borda)'
};

const VARIANTES = {
  primary: {
    minHeight: 'var(--alvo-minimo)', padding: '0 18px', borderRadius: 'var(--raio-link)',
    borderColor: 'var(--urucum)', background: 'var(--urucum)', color: 'var(--areia)'
  },
  secondary: {
    minHeight: 'var(--alvo-minimo)', padding: '0 18px', borderRadius: 'var(--raio-link)',
    borderColor: 'var(--mata)', background: 'transparent', color: 'var(--mata)'
  },
  outline: {
    minHeight: 'var(--altura-botao)', padding: '0 15px', borderRadius: 'var(--raio-botao)',
    borderColor: 'rgba(245, 240, 232, 0.34)', background: 'transparent', color: 'var(--areia)', fontSize: '12px'
  },
  ghost: {
    minHeight: '36px', padding: '0 12px', borderRadius: 'var(--raio-opcao)',
    borderColor: 'var(--linha)', background: 'var(--papel)', color: 'var(--mata)', fontSize: '11.5px'
  },
  text: {
    minHeight: 'auto', padding: '0 0 3px', borderRadius: '0', borderWidth: '0 0 1px',
    borderColor: 'currentColor', background: 'none', color: 'var(--mata)'
  }
};

const HOVER = {
  primary: { background: 'var(--urucum-escuro)', borderColor: 'var(--urucum-escuro)' },
  secondary: { background: 'var(--mata)', color: 'var(--areia)' },
  outline: { background: 'rgba(245, 240, 232, 0.1)' },
  ghost: { background: 'var(--verde-selecao)', borderColor: 'var(--mata)' },
  text: { color: 'var(--urucum)' }
};

/** Botão do painel. Cinco tratamentos, todos com o mesmo corpo de 600/11px. */
export function Button({ variant = 'primary', href, disabled = false, style, children, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const Tag = href ? 'a' : 'button';
  const estilo = {
    ...ESTILO_BASE,
    ...(VARIANTES[variant] || VARIANTES.primary),
    ...(hover && !disabled ? HOVER[variant] : null),
    ...(disabled ? { opacity: 0.6, cursor: 'not-allowed' } : null),
    ...style
  };
  return (
    <Tag
      {...rest}
      href={href}
      disabled={Tag === 'button' ? disabled : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={estilo}
    >
      {children}
    </Tag>
  );
}
