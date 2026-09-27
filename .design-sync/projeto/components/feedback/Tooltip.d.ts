import * as React from 'react';

/** Dica flutuante do mapa: nome em ocre, indicador em cinza-claro e valor em branco. */
export interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** Indicador e ano, em 8px. */
  meta?: string;
  value: string;
}

export declare function Tooltip(props: TooltipProps): JSX.Element;
