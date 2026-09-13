// Porta da administração. Só corre nas rotas servidas sob demanda (`/admin/*`
// e `/api/admin/*`); o resto do site é estático e não passa por aqui.
//
// Sem sessão válida: página redireciona para o login guardando o destino;
// API responde 401. Com sessão, o usuário fica em `locals.sessao` para as
// páginas e funções assinarem o que gravam.
import { defineMiddleware } from 'astro:middleware';
import { leSessao, NOME_COOKIE } from './lib/admin/sessao';
import { buscaUsuario } from './lib/admin/usuarios';

const LIVRES = new Set(['/admin/login', '/api/admin/entrar']);

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = context.url;
  const protegida = pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/');
  if (!protegida || LIVRES.has(pathname)) return next();

  // A sessão vale enquanto a conta existir e estiver ativa: desativar uma
  // conta derruba o acesso dela no deploy seguinte, sem esperar o cookie vencer.
  const sessao = leSessao(context.cookies.get(NOME_COOKIE)?.value);
  if (sessao && buscaUsuario(sessao.usuario)) {
    context.locals.sessao = sessao;
    return next();
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
