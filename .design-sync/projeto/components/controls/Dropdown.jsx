import React from 'react';

function Chevron({ open }) {
  return (
    <i
      aria-hidden="true"
      style={{
        width: '9px', height: '9px', flex: 'none',
        marginTop: open ? '4px' : '-4px',
        borderRight: '2px solid var(--urucum)', borderBottom: '2px solid var(--urucum)',
        transform: open ? 'rotate(-135deg)' : 'rotate(45deg)',
        transition: 'transform var(--dur-seta) ease'
      }}
    />
  );
}

/** Seletor do painel: gatilho alto com rótulo e grupo, menu agrupado abaixo. */
export function Dropdown({ options = [], value, onChange, label, disabled = false, menuWidth = 'max(100%, 420px)', style, ...rest }) {
  const [open, setOpen] = React.useState(false);
  const atual = options.find((option) => option.value === value) || options[0];
  let grupoAnterior = null;

  return (
    <div {...rest} style={{ position: 'relative', ...style }}>
      {label ? (
        <span style={{ display: 'block', margin: '0 0 10px', color: 'var(--tinta-3)', font: '600 var(--eyebrow-tamanho)/1.2 var(--text)', letterSpacing: 'var(--eyebrow-tracking)', textTransform: 'uppercase' }}>{label}</span>
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((estado) => !estado)}
        style={{
          width: '100%', minHeight: 'var(--altura-campo)', padding: '9px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
          border: '1px solid ' + (open ? 'var(--urucum)' : disabled ? 'var(--linha)' : 'var(--mata-500)'),
          borderRadius: 'var(--raio-campo)',
          background: disabled ? 'var(--linha-2)' : 'var(--papel)',
          color: disabled ? 'var(--tinta-4)' : 'var(--mata)',
          boxShadow: open ? 'var(--foco-acento)' : 'none',
          textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'var(--transicao-borda)'
        }}
      >
        <span style={{ minWidth: 0, display: 'block' }}>
          <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600 }}>{atual ? atual.label : '—'}</strong>
          <small style={{ display: 'block', marginTop: '3px', color: 'var(--tinta-4)', fontSize: '8px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{atual && atual.groupLabel ? atual.groupLabel : ''}</small>
        </span>
        <Chevron open={open} />
      </button>

      {open && !disabled ? (
        <ul
          role="listbox"
          style={{
            position: 'absolute', zIndex: 25, top: 'calc(100% + 9px)', right: 0,
            width: menuWidth, maxHeight: '430px', margin: 0, padding: '7px', overflowY: 'auto',
            border: '1px solid var(--linha)', borderRadius: 'var(--raio-menu)', background: 'var(--papel)',
            boxShadow: 'var(--sombra-menu)', listStyle: 'none'
          }}
        >
          {options.map((option) => {
            const selecionada = option.value === value;
            const cabecalho = option.groupLabel && option.groupLabel !== grupoAnterior ? option.groupLabel : null;
            grupoAnterior = option.groupLabel;
            return (
              <React.Fragment key={option.value}>
                {cabecalho ? (
                  <li aria-hidden="true" style={{ padding: '11px 12px 7px', color: 'var(--urucum)', fontSize: '8px', fontWeight: 600, letterSpacing: '0.13em', textTransform: 'uppercase' }}>{cabecalho}</li>
                ) : null}
                <li
                  role="option"
                  aria-selected={selecionada}
                  onClick={() => { setOpen(false); if (onChange) onChange(option.value); }}
                  style={{
                    minHeight: '52px', padding: '8px 10px 8px 12px', display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 24px', alignItems: 'center', gap: '12px',
                    borderRadius: 'var(--raio-opcao)', cursor: 'pointer',
                    color: selecionada ? 'var(--mata)' : 'var(--tinta-2)',
                    background: selecionada ? 'var(--verde-selecao)' : 'transparent'
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', overflow: 'hidden', fontSize: '12px', fontWeight: selecionada ? 600 : 500, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{option.label}</strong>
                    {option.sublabel ? <small style={{ display: 'block', marginTop: '3px', color: 'var(--tinta-4)', fontSize: '9px' }}>{option.sublabel}</small> : null}
                  </span>
                  <i style={{
                    width: '21px', height: '21px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%', background: selecionada ? 'var(--mata)' : 'transparent',
                    color: 'var(--areia)', fontSize: '10px', fontStyle: 'normal'
                  }}>{selecionada ? '✓' : ''}</i>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
