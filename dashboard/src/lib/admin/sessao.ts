// Sessão da tela de administração, sem banco: um cookie assinado.
//
// O valor do cookie é o conteúdo da sessão em base64url mais um HMAC-SHA256 com
// o segredo de `SESSION_SECRET`. Quem não tem o segredo não forja nem altera;
// quem tem o cookie não consegue estender o prazo. Trocar o segredo derruba
// todas as sessões de uma vez, o que é o jeito de "deslogar todo mundo".
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';

export const NOME_COOKIE = 'sessao';
const DURACAO_MS = 12 * 60 * 60 * 1000;
const VERSAO = 1;

export interface Sessao {
  usuario: string;
  nome: string;
  exp: number;
  v: number;
}

function segredo(): string {
  const valor = import.meta.env.SESSION_SECRET;
  if (valor && valor.length >= 32) return valor;
  if (import.meta.env.DEV) {
    // Em desenvolvimento um segredo fixo evita cadastrar variável só para
    // abrir a tela; em produção a falta é erro, nunca um padrão silencioso.
    return 'segredo-de-desenvolvimento-nao-use-em-producao-000000';
  }
  throw new Error('SESSION_SECRET não definido ou com menos de 32 caracteres.');
}

function assina(texto: string): string {
  return createHmac('sha256', segredo()).update(texto).digest('base64url');
}

export function criaSessao(usuario: string, nome: string): string {
  const sessao: Sessao = { usuario, nome, exp: Date.now() + DURACAO_MS, v: VERSAO };
  const corpo = Buffer.from(JSON.stringify(sessao)).toString('base64url');
  return `${corpo}.${assina(corpo)}`;
}

export function leSessao(valor: string | undefined): Sessao | null {
  if (!valor) return null;
  const [corpo, assinatura] = valor.split('.');
  if (!corpo || !assinatura) return null;
  const esperada = assina(corpo);
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const sessao = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as Sessao;
    if (sessao.v !== VERSAO || !sessao.usuario || sessao.exp < Date.now()) return null;
    return sessao;
  } catch {
    return null;
  }
}

export function gravaCookie(cookies: AstroCookies, valor: string): void {
  cookies.set(NOME_COOKIE, valor, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.env.DEV,
    maxAge: DURACAO_MS / 1000
  });
}

export function apagaCookie(cookies: AstroCookies): void {
  cookies.delete(NOME_COOKIE, { path: '/' });
}

// Mutações só de quem está no próprio site: um formulário em outro domínio
// chega com outro Origin, e o cookie SameSite=Lax já não viaja em POST de fora.
export function origemConfere(request: Request): boolean {
  const origem = request.headers.get('origin');
  if (!origem) return true;
  const alvo = new URL(request.url);
  try {
    return new URL(origem).host === alvo.host;
  } catch {
    return false;
  }
}
