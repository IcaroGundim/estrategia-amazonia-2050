// Aplica um lote importado (XLSX ou JSON) sobre a tabela de valores, com a
// mesma mesclagem e validação de qualquer gravação. Só as linhas novas ou
// alteradas viram mudança; as iguais são ignoradas.
export const prerender = false;

import type { APIRoute } from 'astro';
import { ErroDeEdicao, leJson, salvaValores } from '../../../../lib/admin/edicao';
import { aplicaLote, codigosDisponiveis, normalizaLote, ufsDe } from '../../../../lib/admin/valores';

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export const POST: APIRoute = async ({ request, locals }) => {
  const sessao = locals.sessao!;
  try {
    const corpo = await request.json().catch(() => null) as { linhas?: unknown; versao?: string; origem?: string } | null;
    if (!corpo?.versao) throw new ErroDeEdicao('Faltou a versão da tabela; refaça a prévia.');
    const [{ dados: catalogo }, { dados: panorama }] = await Promise.all([leJson<any>('catalogo'), leJson<any>('panorama')]);
    const codigos = new Set(codigosDisponiveis(catalogo, panorama).map((item) => item.codigo));
    const { linhas, problemas } = normalizaLote(corpo.linhas, codigos, ufsDe(panorama));
    if (problemas.length) throw new ErroDeEdicao(`O lote tem ${problemas.length} linha(s) com problema; corrija antes de aplicar.`);
    if (!linhas.length) throw new ErroDeEdicao('O lote está vazio.');
    let alteradas = 0;
    const versao = await salvaValores(corpo.versao, (atuais) => {
      const resultado = aplicaLote(atuais, linhas, sessao.usuario);
      alteradas = resultado.alteradas;
      if (!alteradas) throw new ErroDeEdicao('Nada a gravar: todas as células do lote já têm esse valor.');
      return resultado.linhas;
    }, `importa ${linhas.length} valor(es) por ${corpo.origem === 'xlsx' ? 'planilha' : 'JSON'}`, { usuario: sessao.usuario, nome: sessao.nome });
    return json({ ok: true, alteradas, versao });
  } catch (erro) {
    return json({ erro: erro instanceof ErroDeEdicao ? erro.message : `Não consegui aplicar: ${(erro as Error).message}` }, 400);
  }
};
