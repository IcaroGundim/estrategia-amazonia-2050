import * as React from 'react';

/**
 * Linha de uma meta com patamar mensurável: o nome, a jornada percorrida até o
 * patamar (barra hachurada no que falta) e a leitura em porcentagem.
 */
export interface GoalRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name: string;
  /** Texto do patamar, por exemplo "meta 40% até 2035". */
  target?: string;
  /** Jornada percorrida, de 0 a 100. */
  progress?: number;
  /** Valor de hoje escrito sobre a barra. */
  valueLabel?: string;
  /** Leitura à direita, normalmente a porcentagem da jornada. */
  reading?: string;
  active?: boolean;
  /** Meta cumprida: a barra escurece para verde-mata cheio. */
  met?: boolean;
}

export declare function GoalRow(props: GoalRowProps): JSX.Element;
