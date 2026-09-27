import * as React from 'react';

/**
 * Cartão de meta — a peça central da rota Metas e indicadores, sempre em grade de
 * duas colunas. Meta com patamar: a jornada em número grande à esquerda, o valor
 * atual e a meta lado a lado no topo e, embaixo, a barra da jornada (hachurado em
 * urucum no que falta). Indicador de catálogo (sem patamar): nome, motivo em
 * itálico e o selo de coleta à direita.
 */
export interface GoalCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** "meta" (com patamar e jornada) ou "catalogo" (sem patamar). */
  variant?: 'meta' | 'catalogo';
  name: string;
  /** Jornada já formatada, por exemplo "53%". Vazio ou "—" mostra o travessão em tinta-4. */
  reading?: string;
  /** Legenda sob a jornada. Padrão: "jornada". */
  readingLabel?: string;
  /** Valor de hoje, já formatado ("21,11%"). */
  current?: React.ReactNode;
  /** Nota sob o valor atual, por exemplo "sem escala". */
  currentNote?: string;
  /** Meta, já formatada ("40%", "≤ 52,1", "≤ 0 ha"). */
  target?: React.ReactNode;
  /** Nota sob a meta, normalmente o prazo ("até 2035"). */
  targetNote?: string;
  /** Jornada percorrida, de 0 a 100: largura da barra. */
  progress?: number;
  /** Meta cumprida: a barra escurece para verde-mata cheio. */
  met?: boolean;
  /** Cartão aberto no painel de detalhe: contorno urucum de 2px. */
  active?: boolean;
  /** Catálogo: por que o indicador está fora do quadro de metas. */
  reason?: string;
  /** Catálogo: o selo de coleta, normalmente um StatusBadge. */
  status?: React.ReactNode;
}

export declare function GoalCard(props: GoalCardProps): JSX.Element;
