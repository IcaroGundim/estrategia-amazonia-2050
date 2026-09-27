import * as React from 'react';

/**
 * Ressalva sobre o dado. Nenhum número do painel aparece sem contexto: a nota é
 * onde a quebra de série, o ano em curso ou o método aproximado são declarados.
 */
export interface NoteProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "ficha" (filete ocre sobre areia), "ano" (aviso curto de ano parcial) ou "fonte" (bloco de procedência). */
  variant?: 'ficha' | 'ano' | 'fonte';
  children?: React.ReactNode;
}

export declare function Note(props: NoteProps): JSX.Element;
