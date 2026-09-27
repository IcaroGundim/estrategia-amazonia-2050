import * as React from 'react';

/** Rodapé em verde-mata com o nome do produto e a atribuição institucional. */
export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  product?: string;
  owner?: string;
}

export declare function Footer(props: FooterProps): JSX.Element;
