import * as React from 'react';

/** Rótulo curto em versalete (10px, 600, tracking 0.14em) que nomeia a seção. */
export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  /** O tom "acento" em urucum é o padrão; "claro" (ocre) só sobre verde-mata. */
  tone?: 'acento' | 'suave' | 'claro' | 'corpo';
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
}

export declare function Eyebrow(props: EyebrowProps): JSX.Element;
