// Contas da tela de administração: `conteudo/usuarios.json`, versionado.
//
// O arquivo entra no bundle da função no build, então uma conta nova ou uma
// senha trocada valem a partir do deploy seguinte — que é o que acontece com
// qualquer commit. O hash (bcrypt) não é segredo; o que protege a conta é a
// senha, que nunca é gravada.
import bcrypt from 'bcryptjs';
import arquivo from '../../../conteudo/usuarios.json';

export interface Usuario {
  usuario: string;
  nome: string;
  hash: string;
  ativo: boolean;
  trocarSenha: boolean;
  criadoEm: string;
}

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
