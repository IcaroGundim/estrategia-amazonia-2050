import * as React from 'react';

export interface TabItem {
  key: string;
  label: string;
}

/**
 * Abas do painel. A variante "sidebar" reparte a largura da coluna lateral
 * (Visão geral / Comparação estadual); a variante "detail" abre as duas faces de
 * um indicador (Resultado / Ficha técnica).
 */
export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  items: TabItem[];
  value?: string;
  onChange?: (key: string) => void;
  variant?: 'sidebar' | 'detail';
}

export declare function Tabs(props: TabsProps): JSX.Element;
