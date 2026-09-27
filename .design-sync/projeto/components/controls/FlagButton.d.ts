import * as React from 'react';

/**
 * Bandeira de um dos nove estados (ou da Amazônia Legal) usada como botão de recorte.
 * Selecionada, recebe borda e anel de 1px em urucum — o mesmo código de seleção do mapa.
 */
export interface FlagButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Caminho do SVG da bandeira (assets/flags/…). */
  src: string;
  alt?: string;
  active?: boolean;
  /** Proporção da bandeira, por exemplo "3 / 2" para a da região. */
  ratio?: string;
}

export declare function FlagButton(props: FlagButtonProps): JSX.Element;
