// Contas da administração, pela linha de comando (a tela de contas chega na
// fase 7). Grava em conteudo/usuarios.json; o hash é bcrypt com custo 11.
//
//   node scripts/usuario.mjs criar <usuario> "<Nome>"     cria com senha temporária
//   node scripts/usuario.mjs senha <usuario>              gera senha nova
//   node scripts/usuario.mjs senha <usuario> "<senha>"    define a senha dada
//   node scripts/usuario.mjs desativar <usuario>
//   node scripts/usuario.mjs listar
//
// A senha gerada é impressa uma única vez e não fica em lugar nenhum.
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { conteudoRoot } from '../pipeline/fonte.mjs';

const CAMINHO = join(conteudoRoot, 'usuarios.json');
const CUSTO = 11;

async function le() {
  try {
    return JSON.parse(await readFile(CAMINHO, 'utf8'));
  } catch {
    return {
      _leia: 'Contas da tela de administração. O hash é bcrypt e não é segredo; a senha nunca é gravada. Contas valem a partir do deploy seguinte ao commit.',
      usuarios: []
    };
  }
}

async function grava(dados) {
  await writeFile(CAMINHO, `${JSON.stringify(dados, null, 2)}\n`);
}

// Legível e sem caracteres que se confundem (0/O, 1/l/I).
function senhaAleatoria(tamanho = 14) {
  const alfabeto = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(tamanho);
  return [...bytes].map((byte) => alfabeto[byte % alfabeto.length]).join('');
}

const [comando, nomeBruto, extra] = process.argv.slice(2);
const usuario = String(nomeBruto || '').trim().toLowerCase();
const dados = await le();
const acha = () => dados.usuarios.find((item) => item.usuario === usuario);

if (comando === 'listar') {
  for (const item of dados.usuarios) console.log(`${item.usuario.padEnd(16)} ${item.nome.padEnd(28)} ${item.ativo ? 'ativo' : 'inativo'}${item.trocarSenha ? '  (senha temporária)' : ''}`);
  if (!dados.usuarios.length) console.log('nenhuma conta');
} else if (comando === 'criar') {
  if (!/^[a-z0-9._-]{3,32}$/.test(usuario)) throw new Error('usuário: 3 a 32 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado');
  if (acha()) throw new Error(`já existe: ${usuario}`);
  const senha = senhaAleatoria();
  dados.usuarios.push({
    usuario,
    nome: extra || usuario,
    hash: bcrypt.hashSync(senha, CUSTO),
    ativo: true,
    trocarSenha: true,
    criadoEm: new Date().toISOString().slice(0, 10)
  });
  await grava(dados);
  console.log(`conta criada: ${usuario}\nsenha temporária: ${senha}`);
} else if (comando === 'senha') {
  const conta = acha();
  if (!conta) throw new Error(`não existe: ${usuario}`);
  const senha = extra || senhaAleatoria();
  if (senha.length < 10) throw new Error('a senha precisa ter ao menos 10 caracteres');
  conta.hash = bcrypt.hashSync(senha, CUSTO);
  conta.trocarSenha = !extra;
  await grava(dados);
  console.log(extra ? `senha definida para ${usuario}` : `senha nova de ${usuario}: ${senha}`);
} else if (comando === 'desativar') {
  const conta = acha();
  if (!conta) throw new Error(`não existe: ${usuario}`);
  conta.ativo = false;
  await grava(dados);
  console.log(`desativada: ${usuario}`);
} else {
  console.log('uso: node scripts/usuario.mjs criar|senha|desativar|listar [usuario] [nome ou senha]');
  process.exitCode = 1;
}
