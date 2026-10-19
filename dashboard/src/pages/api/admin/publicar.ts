// Publicar: leva o rascunho para a branch principal. A Vercel reconstrói o
// site em 1 a 2 minutos. Volta para a tela de onde veio o pedido (`volta`, só
// endereços da administração) ou para o início, com o resultado.
export const prerender = false;

import type { APIRoute } from 'astro';
import { deposito, ErroDeDeposito } from '../../../lib/admin/deposito';

// Um `volta` de fora da administração, ou de outro domínio, cai no início.
function destinoDe(volta: FormDataEntryValue | null): URL {
  const base = 'http://admin.local';
  const pedido = typeof volta === 'string' && /^\/admin(?:[/?]|$)/.test(volta) ? new URL(volta, base) : null;
  return pedido && pedido.origin === base ? pedido : new URL('/admin', base);
}

export const POST: APIRoute = async ({ locals, redirect, request }) => {
  const sessao = locals.sessao!;
  const dados = await request.formData().catch(() => null);
  const destino = destinoDe(dados?.get('volta') ?? null);
  try {
    await deposito().publicar({ usuario: sessao.usuario, nome: sessao.nome });
    const mensagem = deposito().modo === 'local'
      ? 'Dados do servidor de desenvolvimento regenerados a partir de conteudo/.'
      : 'Publicado. O site atualiza em 1 a 2 minutos.';
    destino.searchParams.set('msg', mensagem);
  } catch (erro) {
    const texto = erro instanceof ErroDeDeposito ? erro.message : 'Não consegui publicar. Tente de novo em instantes.';
    destino.searchParams.set('erro', texto);
  }
  return redirect(`${destino.pathname}${destino.search}`, 303);
};
