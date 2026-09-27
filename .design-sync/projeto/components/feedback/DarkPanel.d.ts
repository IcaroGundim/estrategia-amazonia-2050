import * as React from 'react';

/**
 * Bloco verde-mata que fecha uma coluna ou uma seção com a leitura do dado
 * (state-reading no Panorama, method-vision na Visão Geral). O texto vai em
 * areia a 72%; o que precisa de peso vai em areia cheia dentro de strong.
 */
export interface DarkPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Rótulo em ocre acima do texto, por exemplo "Visão 2050". */
  label?: string;
  /** Ressalva de método, separada por um filete. */
  note?: React.ReactNode;
  radius?: number | string;
  padding?: string;
  children?: React.ReactNode;
}

export declare function DarkPanel(props: DarkPanelProps): JSX.Element;
