import * as React from 'react';

/**
 * Linha da comparação estadual: posição em urucum, bandeira, nome do estado e a
 * medida com uma barra dividida em nove segmentos — um por estado.
 */
export interface RankRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  position?: number;
  flagSrc: string;
  name: string;
  /** Segunda linha: capital, ano de referência ou método. */
  meta?: string;
  /** Valor já formatado, com unidade. */
  value?: string;
  /** Preenchimento da barra, de 0 a 100. */
  fill?: number;
  selected?: boolean;
  /** Linha da Amazônia Legal: sem número de posição e com o nome em verde. */
  region?: boolean;
}

export declare function RankRow(props: RankRowProps): JSX.Element;
