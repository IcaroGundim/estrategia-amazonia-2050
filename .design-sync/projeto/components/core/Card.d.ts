import * as React from 'react';

/**
 * Cartão de papel do painel: borda de 1px em linha, raio de 14px e fundo branco.
 */
export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** Fundo do cartão. O valor "mata" inverte o texto para areia e dispensa a borda. */
  tone?: 'papel' | 'areia' | 'mata' | 'transparente';
  /** Sombra opcional; o padrão do painel é cartão sem sombra. */
  elevation?: 'none' | 'cartao' | 'lateral';
  /** Recheio em px (22 é o do cartão do mapa) ou qualquer valor CSS. */
  padding?: number | string;
  /** Elemento renderizado. */
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
}

export declare function Card(props: CardProps): JSX.Element;
