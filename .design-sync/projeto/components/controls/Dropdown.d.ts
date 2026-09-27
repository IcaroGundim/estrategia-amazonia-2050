import * as React from 'react';

export interface DropdownOption {
  value: string;
  label: string;
  /** Segunda linha da opção, por exemplo "menor taxa = melhor posição". */
  sublabel?: string;
  /** Título do grupo; opções seguidas com o mesmo rótulo dividem um cabeçalho. */
  groupLabel?: string;
}

/**
 * Seletor de indicador e de ano do painel: gatilho de 58px com rótulo e grupo,
 * menu agrupado de 420px com marcação em círculo verde.
 */
export interface DropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  options: DropdownOption[];
  value?: string;
  onChange?: (value: string) => void;
  /** Rótulo em versalete acima do gatilho ("Indicador exibido"). */
  label?: string;
  disabled?: boolean;
  menuWidth?: string;
}

export declare function Dropdown(props: DropdownProps): JSX.Element;
