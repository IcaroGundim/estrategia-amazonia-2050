import * as React from 'react';

/**
 * Barra de comparação por estado dentro do painel de detalhe: sigla, trilho de 8px
 * e valor tabular. A marca vertical em tinta-2 é o patamar pactuado.
 */
export interface BarMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Sigla do estado, ou "AL" para a região. */
  label: string;
  value: string;
  /** Preenchimento de 0 a 100. */
  fill?: number;
  /** Posição da marca do patamar, de 0 a 100. */
  target?: number;
  tone?: 'padrao' | 'cumprida' | 'selecionada' | 'regional';
}

export declare function BarMeter(props: BarMeterProps): JSX.Element;
