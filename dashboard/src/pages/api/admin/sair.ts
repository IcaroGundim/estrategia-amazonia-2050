// Encerra a sessão: apaga o cookie e volta para o login.
export const prerender = false;

import type { APIRoute } from 'astro';
import { apagaCookie, origemConfere } from '../../../lib/admin/sessao';

export const POST: APIRoute = ({ cookies, request, redirect }) => {
  if (!origemConfere(request)) return new Response('Origem não confere.', { status: 403 });
  apagaCookie(cookies);
  return redirect('/admin/login', 303);
};
