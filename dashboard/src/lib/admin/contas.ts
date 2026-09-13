// Contas da administração pela tela: criar, redefinir senha, desativar e
// reativar, e a troca da própria senha. Tudo grava `conteudo/usuarios.json`
// direto na branch principal — contas não passam pelo rascunho — e vale a
// partir do deploy seguinte, porque o arquivo entra no pacote da função.
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { deposito, type Autor } from './deposito';
import { ARQUIVOS, ErroDeEdicao } from './edicao';
import type { Usuario } from './usuarios';

interface Arquivo { _leia?: string; usuarios: Usuario[] }

const CUSTO = 11;

export async function leContas(): Promise<{ dados: Arquivo; versao: string }> {
  const { texto, versao } = await deposito().le(ARQUIVOS.usuarios);
  return { dados: JSON.parse(texto) as Arquivo, versao };
}

// Legível e sem caracteres que se confundem (0/O, 1/l/I).
export function senhaAleatoria(tamanho = 14): string {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return [...randomBytes(tamanho)].map((byte) => alfabeto[byte % alfabeto.length]).join('');
}

async function grava(dados: Arquivo, mensagem: string, autor: Autor): Promise<void> {
  await deposito().grava([{ caminho: ARQUIVOS.usuarios, texto: `${JSON.stringify(dados, null, 2)}\n` }], mensagem, autor, { principal: true });
}

export function validaNomeDeUsuario(usuario: string): string {
  const limpo = usuario.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(limpo)) throw new ErroDeEdicao('O usuário tem de 3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.');
  return limpo;
}

export async function criaConta(usuario: string, nome: string, autor: Autor): Promise<string> {
  const limpo = validaNomeDeUsuario(usuario);
  const { dados } = await leContas();
  if (dados.usuarios.some((item) => item.usuario === limpo)) throw new ErroDeEdicao(`Já existe a conta ${limpo}.`);
  const senha = senhaAleatoria();
  dados.usuarios.push({ usuario: limpo, nome: nome.trim() || limpo, hash: bcrypt.hashSync(senha, CUSTO), ativo: true, trocarSenha: true, criadoEm: new Date().toISOString().slice(0, 10) });
  await grava(dados, `cria a conta ${limpo}`, autor);
  return senha;
}

export async function redefineSenha(usuario: string, autor: Autor): Promise<string> {
  const { dados } = await leContas();
  const conta = dados.usuarios.find((item) => item.usuario === usuario);
  if (!conta) throw new ErroDeEdicao(`Não existe a conta ${usuario}.`);
  const senha = senhaAleatoria();
  conta.hash = bcrypt.hashSync(senha, CUSTO);
  conta.trocarSenha = true;
  await grava(dados, `redefine a senha de ${usuario}`, autor);
  return senha;
}

export async function ativaConta(usuario: string, ativo: boolean, autor: Autor): Promise<void> {
  const { dados } = await leContas();
  const conta = dados.usuarios.find((item) => item.usuario === usuario);
  if (!conta) throw new ErroDeEdicao(`Não existe a conta ${usuario}.`);
  if (!ativo && usuario === autor.usuario) throw new ErroDeEdicao('Você não pode desativar a própria conta.');
  if (!ativo && dados.usuarios.filter((item) => item.ativo && item.usuario !== usuario).length === 0) throw new ErroDeEdicao('Não dá para desativar a última conta ativa.');
  conta.ativo = ativo;
  await grava(dados, `${ativo ? 'reativa' : 'desativa'} a conta ${usuario}`, autor);
}

export async function trocaPropriaSenha(usuario: string, senhaAtual: string, senhaNova: string, autor: Autor): Promise<void> {
  if (senhaNova.length < 10) throw new ErroDeEdicao('A senha nova precisa ter ao menos 10 caracteres.');
  const { dados } = await leContas();
  const conta = dados.usuarios.find((item) => item.usuario === usuario && item.ativo);
  if (!conta) throw new ErroDeEdicao('Conta não encontrada.');
  if (!(await bcrypt.compare(senhaAtual, conta.hash))) throw new ErroDeEdicao('A senha atual não confere.');
  conta.hash = bcrypt.hashSync(senhaNova, CUSTO);
  conta.trocarSenha = false;
  await grava(dados, `troca a própria senha`, autor);
}
