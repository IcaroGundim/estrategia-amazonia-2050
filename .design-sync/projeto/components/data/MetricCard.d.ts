import * as React from 'react';

/**
 * Cartão de número da faixa de resumo: rótulo, valor no display 800 e procedência.
 */
export interface MetricCardProps extends React.HTMLAttributes<HTMLElement> {
  label: string;
  value: React.ReactNode;
  /** Linha de procedência em 10px, por exemplo "projeção IBGE para 2025". */
  footnote?: string;
  /** Reduz o valor de 30px para 22px quando o número é longo. */
  compact?: boolean;
}

export declare function MetricCard(props: MetricCardProps): JSX.Element;
