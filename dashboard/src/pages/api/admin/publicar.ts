// Publicar: leva o rascunho para a branch principal. A Vercel reconstrói o
// site em 1 a 2 minutos. Volta para o início da administração com o resultado.
export const prerender = false;

import type { APIRoute } from 'astro';
import { deposito, ErroDeDeposito } from '../../../lib/admin/deposito';

export const POST: APIRoute = async ({ locals, redirect }) => {
  const sessao = locals.sessao!;
  try {
    await deposito().publicar({ usuario: sessao.usuario, nome: sessao.nome });
    const mensagem = deposito().modo === 'local'
      ? 'Dados do servidor de desenvolvimento regenerados a partir de conteudo/.'
      : 'Publicado. O site atualiza em 1 a 2 minutos.';
    return redirect(`/admin?msg=${encodeURIComponent(mensagem)}`, 303);
  } catch (erro) {
    const texto = erro instanceof ErroDeDeposito ? erro.message : 'Não consegui publicar. Tente de novo em instantes.';
    return redirect(`/admin?erro=${encodeURIComponent(texto)}`, 303);
  }
};
