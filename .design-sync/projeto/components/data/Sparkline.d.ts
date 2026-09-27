import * as React from 'react';

/**
 * Trajetória de um indicador: escala min-max da própria série (a forma, não a
 * distância ao zero), área a 12% e marcador urucum no ano em leitura. A série
 * regional entra tracejada em tinta-4, como pano de fundo.
 */
export interface SparklineProps extends React.SVGAttributes<SVGSVGElement> {
  values: number[];
  /** Série da Amazônia Legal, desenhada tracejada atrás da do estado. */
  reference?: number[];
  width?: number;
  height?: number;
}

export declare function Sparkline(props: SparklineProps): JSX.Element;
