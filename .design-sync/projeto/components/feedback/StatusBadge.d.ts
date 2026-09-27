import * as React from 'react';

/**
 * Situação da coleta de um indicador. Quatro estados, cada um com um disco
 * cheio e um corte em branco: certo, metade, relógio e traço.
 */
export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: 'coletado' | 'parcial' | 'pendente' | 'manual';
  /** Substitui o rótulo padrão (Coletado, Parcial, Pendente, Não coletado). */
  label?: string;
  /** Lado do glifo em px; 13 na lista, 17 no resumo da ficha. */
  size?: number;
}

export declare function StatusBadge(props: StatusBadgeProps): JSX.Element;
