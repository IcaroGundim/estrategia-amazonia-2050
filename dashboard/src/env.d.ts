/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    sessao?: import('./lib/admin/sessao').Sessao;
    /** Acesso restrito da conta que entrou (`null`: a administração inteira). Definido pelo middleware. */
    acesso?: import('./lib/admin/usuarios').Acesso | null;
    /** Textos de interface do rascunho, definidos só pela prévia da administração. */
    interface?: Record<string, { pt: string; en?: string | null }>;
  }
}

interface ImportMetaEnv {
  readonly SESSION_SECRET?: string;
  readonly GITHUB_TOKEN?: string;
  readonly GITHUB_REPO?: string;
  readonly GITHUB_PASTA?: string;
  readonly BRANCH_PRINCIPAL?: string;
  readonly BRANCH_RASCUNHO?: string;
  readonly PREVIEW_URL?: string;
  readonly VERCEL_ENV?: string;
  readonly ADMIN_ARMAZENAMENTO?: string;
  readonly ADMIN_PERMITE_PUBLICAR?: string;
}
