import * as React from 'react';

export interface TopbarItem {
  key: string;
  label: string;
  href?: string;
}

export interface TopbarLanguage {
  /** Código do idioma, por exemplo "pt-BR" ou "en". */
  code: string;
  /** Caminho da bandeira (assets/idiomas/…). */
  flagSrc: string;
  /** Proporção da bandeira: "10 / 7" para a do Brasil, "3 / 2" para a de EUA e Reino Unido. */
  ratio?: string;
  /** Frase do link, por exemplo "Read this page in English". */
  label: string;
  href?: string;
}

/**
 * Barra fixa do topo, em verde-mata: logo do Consórcio, a marca da Estratégia
 * ("Estratégia Regional" em versalete sobre "Amazônia 2050" em display 800, com o
 * ano em ocre no mesmo corpo), as rotas do painel, uma ação em contorno claro e o seletor de idioma.
 * A rota ativa fica em ocre, com um filete de 2px sob o rótulo.
 */
export interface TopbarProps extends React.HTMLAttributes<HTMLElement> {
  /** Caminho do logo claro do Consórcio (assets/logo-consorcio-clara.avif). */
  logoSrc?: string;
  /** Rótulo em versalete acima de "Amazônia 2050". Padrão: "Estratégia Regional". */
  eyebrow?: string;
  /** Ano ao lado de "Amazônia", em ocre e no mesmo corpo. Padrão: "2050". */
  year?: string;
  /** Esconde a marca da Estratégia e deixa só o logo, como no celular. */
  showBrand?: boolean;
  /** Rotas; o padrão é Visão Geral, Metas e indicadores e Panorama, nessa ordem. */
  items?: TopbarItem[];
  /** Chave da rota ativa: "metodologia" (Visão Geral), "metas" ou "index" (Panorama). */
  active?: string;
  /** Botão de ação à direita — normalmente um Button variant="outline". */
  action?: React.ReactNode;
  /** Idiomas do seletor à direita; sem esta lista o seletor não aparece. */
  languages?: TopbarLanguage[];
  /** Código do idioma da página. */
  language?: string;
  onNavigate?: (key: string) => void;
  onLanguage?: (code: string) => void;
}

export declare function Topbar(props: TopbarProps): JSX.Element;
