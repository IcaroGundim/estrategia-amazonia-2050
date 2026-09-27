import React from 'react';

const SITUACOES = {
  coletado: { label: 'Coletado', color: 'var(--status-ok)', mark: 'check' },
  parcial: { label: 'Parcial', color: 'var(--status-parcial)', mark: 'half' },
  pendente: { label: 'Pendente', color: 'var(--status-pendente)', mark: 'clock' },
  manual: { label: 'Não coletado', color: 'var(--status-manual)', mark: 'dash' }
};

function Glifo({ mark, size }) {
  const corte = { fill: 'none', stroke: 'var(--papel)', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" style={{ flex: 'none', width: size, height: size, fill: 'currentColor' }}>
      <circle cx="8" cy="8" r="7" />
      {mark === 'check' ? <path d="M4.8 8.5l2.2 2.2 4.2-5" style={corte} /> : null}
      {mark === 'half' ? <path d="M8 1a7 7 0 0 0 0 14z" style={{ fill: 'var(--papel)', stroke: 'none' }} /> : null}
      {mark === 'clock' ? <path d="M8 4.5V8l2.2 1.8" style={corte} /> : null}
      {mark === 'dash' ? <path d="M5 8h6" style={corte} /> : null}
    </svg>
  );
}

/** Situação da coleta de um indicador: glifo em disco e rótulo em versalete. */
export function StatusBadge({ status = 'coletado', label, size = 13, style, ...rest }) {
  const situacao = SITUACOES[status] || SITUACOES.manual;
  return (
    <span
      {...rest}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '7px',
        color: situacao.color, fontSize: '10px', fontWeight: 700,
        letterSpacing: '0.09em', textTransform: 'uppercase', whiteSpace: 'nowrap',
        ...style
      }}
    >
      <Glifo mark={situacao.mark} size={size} />
      {label || situacao.label}
    </span>
  );
}
