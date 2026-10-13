// Contas da tela de administração: `conteudo/usuarios.json`, versionado.
//
// O arquivo entra no bundle da função no build, então uma conta nova ou uma
// senha trocada valem a partir do deploy seguinte — que é o que acontece com
// qualquer commit. O hash (bcrypt) não é segredo; o que protege a conta é a
// senha, que nunca é gravada.
import bcrypt from 'bcryptjs';
import arquivo from '../../../conteudo/usuarios.json';

/**
 * Acesso restrito de uma conta. Sem o campo, a conta abre a administração
 * inteira. `textos` é de quem só revisa texto: abre a tela de Textos (com a
 * prévia), a Ajuda e a troca da própria senha, e mais nada.
 */
export type Acesso = 'textos';

export interface Usuario {
  usuario: string;
  nome: string;
  hash: string;
  ativo: boolean;
  trocarSenha: boolean;
  criadoEm: string;
  acesso?: Acesso;
}

export const NOME_DO_ACESSO: Record<Acesso, string> = { textos: 'só textos' };

// O que cada acesso restrito abre: o caminho exato ou qualquer coisa abaixo
// dele. Sair vale para todos. Salvar texto grava no rascunho; atualizar a
// prévia publicada e publicar (/api/admin/*) ficam de fora de propósito.
const SEMPRE = ['/api/admin/sair'];
const LIBERADO: Record<Acesso, string[]> = {
  textos: ['/admin/textos', '/admin/ajuda', '/admin/senha']
};

/**
 * Se a conta com este acesso pode abrir o caminho. Um valor de `acesso` que
 * este código não conhece (erro de digitação no JSON) não abre nada além de
 * sair: na dúvida, fecha.
 */
export function caminhoLiberado(acesso: Acesso | null | undefined, caminho: string): boolean {
  if (!acesso) return true;
  return [...SEMPRE, ...(LIBERADO[acesso] ?? [])].some((raiz) => caminho === raiz || caminho.startsWith(`${raiz}/`));
}

/** A primeira tela de quem entra. */
export const inicioDe = (acesso: Acesso | null | undefined) => (acesso ? LIBERADO[acesso]?.[0] ?? '/admin' : '/admin');

const usuarios = (arquivo as { usuarios: Usuario[] }).usuarios;

// Conta que não existe, para o login conferir uma senha mesmo quando o usuário
// digitado não existe: assim o tempo de resposta não entrega quais nomes
// existem. O hash é calculado uma vez por instância da função.
export const CONTA_FALSA: Usuario = {
  usuario: '',
  nome: '',
  hash: bcrypt.hashSync('conta-inexistente', 11),
  ativo: false,
  trocarSenha: false,
  criadoEm: ''
};

export function buscaUsuario(nome: string): Usuario | null {
  const chave = String(nome || '').trim().toLowerCase();
  return usuarios.find((item) => item.usuario === chave && item.ativo) ?? null;
}

export async function senhaConfere(usuario: Usuario, senha: string): Promise<boolean> {
  if (!senha) return false;
  return bcrypt.compare(senha, usuario.hash);
}
