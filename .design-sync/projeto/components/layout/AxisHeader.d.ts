import * as React from 'react';

/** Cabeçalho de um eixo da matriz: quadrado verde com o número, nome e contagem. */
export interface AxisHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Número do eixo (1 a 5). */
  number: React.ReactNode;
  title: string;
  /** Texto de apoio à direita, por exemplo "6 indicadores". */
  meta?: string;
}

export declare function AxisHeader(props: AxisHeaderProps): JSX.Element;
