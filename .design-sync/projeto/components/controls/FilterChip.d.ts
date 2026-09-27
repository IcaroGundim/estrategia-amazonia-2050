import * as React from 'react';

/** Pastilha de filtro em cápsula. Ativa, inverte para verde-mata cheio. */
export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** Contagem opcional ao lado do rótulo. */
  count?: number | string;
  children?: React.ReactNode;
}

export declare function FilterChip(props: FilterChipProps): JSX.Element;
