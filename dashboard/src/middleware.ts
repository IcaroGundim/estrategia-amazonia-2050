// Porta da administração. Só corre nas rotas servidas sob demanda (`/admin/*`
// e `/api/admin/*`); o resto do site é estático e não passa por aqui.
//
// Sem sessão válida: página redireciona para o login guardando o destino;
// API responde 401. Com sessão, o usuário fica em `locals.sessao` para as
// páginas e funções assinarem o que gravam.
//
// É aqui também que vale o acesso restrito de uma conta (`acesso` em
// usuarios.json): a conta de quem só revisa texto não abre as outras telas nem
// as chama por endereço. O acesso é lido da conta a cada pedido, e não do
// cookie, então mudá-lo vale no deploy seguinte, sem esperar a sessão vencer.
import { defineMiddleware } from 'astro:middleware';
import { leSessao, NOME_COOKIE } from './lib/admin/sessao';
import { buscaUsuario, caminhoLiberado, inicioDe } from './lib/admin/usuarios';

const LIVRES = new Set(['/admin/login', '/api/admin/entrar']);

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;
  const protegida = pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
  if (!protegida || LIVRES.has(pathname)) return next();

  // A sessão vale enquanto a conta existir e estiver ativa: desativar uma
  // conta derruba o acesso dela no deploy seguinte, sem esperar o cookie vencer.
  const sessao = leSessao(context.cookies.get(NOME_COOKIE)?.value);
  const conta = sessao ? buscaUsuario(sessao.usuario) : null;
  if (sessao && conta) {
    context.locals.sessao = sessao;
    context.locals.acesso = conta.acesso ?? null;
    if (caminhoLiberado(conta.acesso, pathname)) return next();
    const inicio = inicioDe(conta.acesso);
    // Fora do que a conta abre: a API recusa; a página leva à tela dela (o
    // `/admin` de quem só revisa texto é a tela de Textos). Se nem a tela
    // inicial abre, o acesso gravado é inválido: recusa em vez de girar.
    if (pathname.startsWith('/api/') || !caminhoLiberado(conta.acesso, inicio)) {
      return new Response(JSON.stringify({ erro: 'Esta conta não tem acesso a esta parte da administração.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      });
    }
    return context.redirect(inicio, 302);
  }
  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ erro: 'Sessão expirada. Entre de novo.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
  const voltar = encodeURIComponent(pathname + context.url.search);
  return context.redirect(`/admin/login?voltar=${voltar}`, 302);
});
