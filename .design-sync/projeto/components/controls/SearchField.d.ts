import * as React from 'react';

/** Campo de busca de 47px com o caractere ⌕ como ícone e foco em verde-mata. */
export interface SearchFieldProps extends React.HTMLAttributes<HTMLLabelElement> {
  placeholder?: string;
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export declare function SearchField(props: SearchFieldProps): JSX.Element;
