// Onde a administração lê e grava `conteudo/`.
//
// Na Vercel o disco é só leitura e a fonte de verdade é o repositório: o
// depósito é o GitHub, na branch de rascunho. Cada "salvar" é um commit; a
// prévia é o deploy dessa branch; "publicar" leva a branch para a main. Em
// desenvolvimento (`astro dev`), ou com ADMIN_ARMAZENAMENTO=local, o depósito
// é a própria pasta `conteudo/` em disco — serve para trabalhar sem token e
// para testar a mesclagem de edições.
//
// Versão de um arquivo: no GitHub é o sha do blob; em disco é um hash do
// conteúdo. É ela que a tela devolve ao salvar, para a mesclagem a três vias
// saber de onde a pessoa partiu.
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const executa = promisify(execFile);

export interface Versao {
  texto: string;
  versao: string;
}

export interface Autor {
  usuario: string;
  nome: string;
}

export interface Commit {
  sha: string;
  data: string;
  autor: string;
  mensagem: string;
}

export interface Estado {
  modo: 'github' | 'local';
  branch: string;
  head: Commit | null;
  pendentes: Commit[];
  previewUrl: string | null;
  podePublicar: boolean;
  aviso: string | null;
}

export interface Deposito {
  modo: 'github' | 'local';
  le(caminho: string): Promise<Versao>;
  leVersao(caminho: string, versao: string): Promise<string | null>;
  /** Nomes dos arquivos de uma pasta (só o nome). Pasta inexistente = lista vazia. */
  lista(pasta: string): Promise<string[]>;
  /** Grava (ou apaga, com `texto: null`) um ou mais arquivos num único commit. */
  grava(arquivos: { caminho: string; texto: string | null }[], mensagem: string, autor: Autor, opcoes?: OpcoesDeGravacao): Promise<string>;
  estado(): Promise<Estado>;
  atualizarPrevia(autor: Autor): Promise<void>;
  publicar(autor: Autor): Promise<string>;
}

export class ErroDeDeposito extends Error {}

/** `principal`: commita direto na branch principal, fora do rascunho (contas). */
export interface OpcoesDeGravacao {
  principal?: boolean;
}

const raizDashboard = fileURLToPath(new URL('../../../', import.meta.url));

// ---------- em disco ----------

const memoriaDeVersoes = new Map<string, string>();
const hashDe = (texto: string) => createHash('sha1').update(texto).digest('hex').slice(0, 12);

class DepositoLocal implements Deposito {
  modo = 'local' as const;

  async le(caminho: string): Promise<Versao> {
    const texto = await readFile(new URL(caminho, `file://${raizDashboard.replace(/\\/g, '/')}`), 'utf8');
    const versao = hashDe(texto);
    memoriaDeVersoes.set(`${caminho}@${versao}`, texto);
    return { texto, versao };
  }

  async leVersao(caminho: string, versao: string): Promise<string | null> {
    return memoriaDeVersoes.get(`${caminho}@${versao}`) ?? null;
  }

  async lista(pasta: string): Promise<string[]> {
    try {
      const itens = await readdir(new URL(`${pasta.replace(/\/$/, '')}/`, `file://${raizDashboard.replace(/\\/g, '/')}`), { withFileTypes: true });
      return itens.filter((item) => item.isFile()).map((item) => item.name).sort();
    } catch {
      return [];
    }
  }

  async grava(arquivos: { caminho: string; texto: string | null }[]): Promise<string> {
    let versao = '';
    for (const { caminho, texto } of arquivos) {
      const url = new URL(caminho, `file://${raizDashboard.replace(/\\/g, '/')}`);
      if (texto === null) {
        await unlink(url).catch(() => undefined);
        continue;
      }
      await mkdir(dirname(fileURLToPath(url)), { recursive: true });
      await writeFile(url, texto);
      versao = hashDe(texto);
      memoriaDeVersoes.set(`${caminho}@${versao}`, texto);
    }
    return versao;
  }

  async estado(): Promise<Estado> {
    let pendentes: Commit[] = [];
    try {
      const { stdout } = await executa('git', ['status', '--porcelain', '--', 'conteudo'], { cwd: raizDashboard });
      pendentes = stdout.trim().split('\n').filter(Boolean).map((linha) => ({
        sha: '', data: '', autor: 'disco', mensagem: `${linha.slice(3).trim()} (alterado em disco, sem commit)`
      }));
    } catch {
      pendentes = [];
    }
    return {
      modo: 'local',
      branch: 'conteudo/ em disco',
      head: null,
      pendentes,
      previewUrl: null,
      podePublicar: true,
      aviso: 'Sem GitHub configurado, as edições vão para a pasta desta máquina e "Publicar" só regenera os dados do servidor local; o commit e o push ficam por sua conta.'
    };
  }

  async atualizarPrevia(): Promise<void> {
    await executa(process.execPath, ['build-static.mjs'], { cwd: raizDashboard });
  }

  async publicar(): Promise<string> {
    await executa(process.execPath, ['build-static.mjs'], { cwd: raizDashboard });
    return 'local';
  }
}

// ---------- GitHub ----------

interface ConfigGitHub {
  token: string;
  repo: string;
  /** Pasta do painel dentro do repositório (os caminhos das telas são relativos a ela). */
  pasta: string;
  main: string;
  rascunho: string;
  previewUrl: string | null;
  producao: boolean;
}

class DepositoGitHub implements Deposito {
  modo = 'github' as const;
  private config: ConfigGitHub;
  private rascunhoGarantida = false;

  constructor(config: ConfigGitHub) {
    this.config = config;
  }

  // `conteudo/valores.csv` na tela é `dashboard/conteudo/valores.csv` no repositório.
  private noRepo(caminho: string): string {
    const pasta = this.config.pasta.replace(/^\/+|\/+$/g, '');
    return pasta ? `${pasta}/${caminho}` : caminho;
  }

  private async api<T = unknown>(caminho: string, opcoes: { metodo?: string; corpo?: unknown; aceita?: number[] } = {}): Promise<{ status: number; dados: T }> {
    const resposta = await fetch(`https://api.github.com/repos/${this.config.repo}${caminho}`, {
      method: opcoes.metodo || 'GET',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'painel-amazonia-2050-admin',
        ...(opcoes.corpo ? { 'Content-Type': 'application/json' } : {})
      },
      body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined
    });
    const dados = resposta.status === 204 ? null : await resposta.json().catch(() => null);
    const aceitos = opcoes.aceita || [200, 201];
    if (!aceitos.includes(resposta.status)) {
      const mensagem = (dados as { message?: string } | null)?.message || resposta.statusText;
      throw new ErroDeDeposito(`GitHub ${resposta.status} em ${caminho}: ${mensagem}`);
    }
    return { status: resposta.status, dados: dados as T };
  }

  private async shaDaBranch(branch: string): Promise<string | null> {
    const { status, dados } = await this.api<{ object: { sha: string } }>(`/git/ref/heads/${branch}`, { aceita: [200, 404] });
    return status === 200 ? dados.object.sha : null;
  }

  // A branch de rascunho nasce da main na primeira vez que alguém a usa. Duas
  // leituras em paralelo passam pela mesma promessa, e um "já existe" da API
  // (422) vale como sucesso: outra instância da função pode ter chegado antes.
  private garantia: Promise<string> | null = null;

  private garanteRascunho(): Promise<string> {
    if (!this.garantia) {
      this.garantia = (async () => {
        const existente = await this.shaDaBranch(this.config.rascunho);
        if (existente) { this.rascunhoGarantida = true; return existente; }
        const main = await this.shaDaBranch(this.config.main);
        if (!main) throw new ErroDeDeposito(`a branch ${this.config.main} não existe no repositório`);
        const { status } = await this.api('/git/refs', { metodo: 'POST', aceita: [201, 422], corpo: { ref: `refs/heads/${this.config.rascunho}`, sha: main } });
        this.rascunhoGarantida = true;
        return status === 422 ? (await this.shaDaBranch(this.config.rascunho)) || main : main;
      })().catch((erro) => { this.garantia = null; throw erro; });
    }
    return this.garantia;
  }

  async le(caminho: string): Promise<Versao> {
    if (!this.rascunhoGarantida) await this.garanteRascunho();
    return this.leNaBranch(caminho, this.config.rascunho);
  }

  private async leNaBranch(caminho: string, branch: string): Promise<Versao> {
    const { dados } = await this.api<{ content: string; sha: string; encoding: string }>(`/contents/${this.noRepo(caminho)}?ref=${branch}`);
    return { texto: Buffer.from(dados.content, 'base64').toString('utf8'), versao: dados.sha };
  }

  async leVersao(_caminho: string, versao: string): Promise<string | null> {
    const { status, dados } = await this.api<{ content: string }>(`/git/blobs/${versao}`, { aceita: [200, 404] });
    return status === 200 ? Buffer.from(dados.content, 'base64').toString('utf8') : null;
  }

  async lista(pasta: string): Promise<string[]> {
    if (!this.rascunhoGarantida) await this.garanteRascunho();
    const { status, dados } = await this.api<{ type: string; name: string }[]>(`/contents/${this.noRepo(pasta.replace(/\/$/, ''))}?ref=${this.config.rascunho}`, { aceita: [200, 404] });
    if (status !== 200 || !Array.isArray(dados)) return [];
    return dados.filter((item) => item.type === 'file').map((item) => item.name).sort();
  }

  private committer(autor: Autor) {
    return { name: autor.nome || autor.usuario, email: `${autor.usuario}@painel.amazonia2050.local` };
  }

  async grava(arquivos: { caminho: string; texto: string | null }[], mensagem: string, autor: Autor, opcoes: OpcoesDeGravacao = {}): Promise<string> {
    if (!this.rascunhoGarantida) await this.garanteRascunho();
    const branch = opcoes.principal ? this.config.main : this.config.rascunho;
    const texto = `admin(${autor.usuario}): ${mensagem}`;
    if (arquivos.length === 1 && arquivos[0].texto !== null) {
      // Um arquivo: a API de conteúdo faz o commit inteiro numa chamada e o
      // `sha` que ela exige é o do blob atual — a corrida entre ler e gravar é
      // pequena, e a retentativa cobre.
      const [{ caminho, texto: conteudo }] = arquivos;
      for (let tentativa = 0; tentativa < 3; tentativa += 1) {
        const atual = await this.leNaBranch(caminho, branch);
        const { status, dados } = await this.api<{ content: { sha: string } }>(`/contents/${this.noRepo(caminho)}`, {
          metodo: 'PUT',
          aceita: [200, 201, 409],
          corpo: { message: texto, content: Buffer.from(conteudo).toString('base64'), sha: atual.versao, branch, committer: this.committer(autor), author: this.committer(autor) }
        });
        if (status !== 409) return dados.content.sha;
      }
      throw new ErroDeDeposito('o repositório mudou três vezes seguidas durante a gravação; tente de novo');
    }
    // Vários arquivos: um commit só, pela Git Data API.
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const head = await this.shaDaBranch(branch);
      const { dados: commitBase } = await this.api<{ tree: { sha: string } }>(`/git/commits/${head}`);
      const tree = await Promise.all(arquivos.map(async ({ caminho, texto: conteudo }) => {
        // `sha: null` numa árvore apaga o arquivo.
        if (conteudo === null) return { path: this.noRepo(caminho), mode: '100644', type: 'blob', sha: null };
        const { dados: blob } = await this.api<{ sha: string }>('/git/blobs', { metodo: 'POST', corpo: { content: conteudo, encoding: 'utf-8' } });
        return { path: this.noRepo(caminho), mode: '100644', type: 'blob', sha: blob.sha };
      }));
      const { dados: novaTree } = await this.api<{ sha: string }>('/git/trees', { metodo: 'POST', corpo: { base_tree: commitBase.tree.sha, tree } });
      const { dados: commit } = await this.api<{ sha: string }>('/git/commits', { metodo: 'POST', corpo: { message: texto, tree: novaTree.sha, parents: [head], author: this.committer(autor), committer: this.committer(autor) } });
      const { status } = await this.api(`/git/refs/heads/${branch}`, { metodo: 'PATCH', aceita: [200, 422], corpo: { sha: commit.sha, force: false } });
      if (status === 200) return commit.sha;
    }
    throw new ErroDeDeposito('o repositório mudou três vezes seguidas durante a gravação; tente de novo');
  }

  async estado(): Promise<Estado> {
    const sha = await this.garanteRascunho();
    const { dados: head } = await this.api<{ sha: string; commit: { author: { name: string; date: string }; message: string } }>(`/commits/${sha}`);
    const { dados: comparacao } = await this.api<{ ahead_by: number; commits: { sha: string; commit: { author: { name: string; date: string }; message: string } }[] }>(`/compare/${this.config.main}...${this.config.rascunho}`);
    const paraCommit = (item: typeof head): Commit => ({ sha: item.sha, data: item.commit.author.date, autor: item.commit.author.name, mensagem: item.commit.message.split('\n')[0] });
    return {
      modo: 'github',
      branch: this.config.rascunho,
      head: paraCommit(head),
      pendentes: comparacao.commits.map(paraCommit).reverse(),
      previewUrl: this.config.previewUrl,
      podePublicar: this.config.producao,
      aviso: this.config.producao ? null : 'Publicar só funciona no endereço de produção do painel, não numa prévia.'
    };
  }

  async atualizarPrevia(autor: Autor): Promise<void> {
    const branch = this.config.rascunho;
    const head = await this.garanteRascunho();
    const { dados: commitBase } = await this.api<{ tree: { sha: string } }>(`/git/commits/${head}`);
    const { dados: commit } = await this.api<{ sha: string }>('/git/commits', {
      metodo: 'POST',
      corpo: { message: `admin(${autor.usuario}): atualiza a prévia [previa]`, tree: commitBase.tree.sha, parents: [head], author: this.committer(autor), committer: this.committer(autor) }
    });
    await this.api(`/git/refs/heads/${branch}`, { metodo: 'PATCH', corpo: { sha: commit.sha, force: false } });
  }

  async publicar(autor: Autor): Promise<string> {
    if (!this.config.producao) throw new ErroDeDeposito('publicar só é permitido no endereço de produção');
    const rascunho = await this.garanteRascunho();
    // Primeiro tenta avançar a main direto; se ela andou por fora, mescla.
    const { status } = await this.api(`/git/refs/heads/${this.config.main}`, { metodo: 'PATCH', aceita: [200, 422], corpo: { sha: rascunho, force: false } });
    let novaMain = rascunho;
    if (status === 422) {
      const { dados } = await this.api<{ sha: string }>('/merges', {
        metodo: 'POST',
        aceita: [201, 204],
        corpo: { base: this.config.main, head: this.config.rascunho, commit_message: `admin(${autor.usuario}): publica as edições do rascunho` }
      });
      novaMain = dados?.sha || (await this.shaDaBranch(this.config.main))!;
    }
    await this.api(`/git/refs/heads/${this.config.rascunho}`, { metodo: 'PATCH', corpo: { sha: novaMain, force: false } });
    return novaMain;
  }
}

// ---------- escolha ----------

let instancia: Deposito | null = null;

export function deposito(): Deposito {
  if (instancia) return instancia;
  const env = import.meta.env;
  const local = env.ADMIN_ARMAZENAMENTO === 'local' || (env.DEV && !env.GITHUB_TOKEN);
  if (local) {
    instancia = new DepositoLocal();
    return instancia;
  }
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    throw new ErroDeDeposito('GITHUB_TOKEN e GITHUB_REPO precisam estar definidos para a administração gravar no repositório.');
  }
  instancia = new DepositoGitHub({
    token: env.GITHUB_TOKEN,
    repo: env.GITHUB_REPO,
    pasta: env.GITHUB_PASTA ?? 'dashboard',
    main: env.BRANCH_PRINCIPAL || 'main',
    rascunho: env.BRANCH_RASCUNHO || 'rascunho',
    previewUrl: env.PREVIEW_URL || null,
    producao: env.VERCEL_ENV === 'production' || env.ADMIN_PERMITE_PUBLICAR === '1'
  });
  return instancia;
}
