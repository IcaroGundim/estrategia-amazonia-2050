import * as React from 'react';

/** Legenda do mapa: cinco degraus (linha-2, mata-100, mata-300, mata-500, mata-700). */
export interface LegendRampProps extends React.HTMLAttributes<HTMLDivElement> {
  from?: string;
  to?: string;
}

export declare function LegendRamp(props: LegendRampProps): JSX.Element;
