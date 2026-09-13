// Atualizar a prévia: um commit vazio marcado com [previa] na branch de
// rascunho, que é o único que a Vercel constrói nessa branch (ver vercel.json).
export const prerender = false;

import type { APIRoute } from 'astro';
import { deposito, ErroDeDeposito } from '../../../lib/admin/deposito';

export const POST: APIRoute = async ({ locals, redirect }) => {
  const sessao = locals.sessao!;
  try {
    await deposito().atualizarPrevia({ usuario: sessao.usuario, nome: sessao.nome });
    const mensagem = deposito().modo === 'local'
      ? 'Dados do servidor de desenvolvimento regenerados a partir de conteudo/.'
      : 'Prévia pedida. Ela fica pronta em 1 a 2 minutos no endereço de prévia.';
    return redirect(`/admin?msg=${encodeURIComponent(mensagem)}`, 303);
  } catch (erro) {
    const texto = erro instanceof ErroDeDeposito ? erro.message : 'Não consegui pedir a prévia. Tente de novo em instantes.';
    return redirect(`/admin?erro=${encodeURIComponent(texto)}`, 303);
  }
};
