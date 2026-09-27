import * as React from 'react';

/**
 * Botão e link de ação do painel: "primary" é o urucum cheio, "secondary" o contorno
 * verde-mata, "outline" a versão para a barra escura, "ghost" o botão de apoio sobre
 * papel e "text" o link sublinhado de 11px.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'text';
  /** Quando presente, renderiza um elemento de âncora com a mesma aparência. */
  href?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export declare function Button(props: ButtonProps): JSX.Element;
