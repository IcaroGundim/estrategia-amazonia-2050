// Prévia de uma importação: recebe o lote (JSON) e devolve, célula a célula,
// o que é novo, o que muda, o que é igual e o que não passou.
export const prerender = false;

import type { APIRoute } from 'astro';
import { ErroDeEdicao, leJson, leValores } from '../../../../lib/admin/edicao';
import { codigosDisponiveis, comparaLote, normalizaLote, ufsDe } from '../../../../lib/admin/valores';

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export const POST: APIRoute = async ({ request }) => {
  try {
    const corpo = await request.json().catch(() => null) as { linhas?: unknown } | null;
    const [{ dados: catalogo }, { dados: panorama }, atuais] = await Promise.all([leJson<any>('catalogo'), leJson<any>('panorama'), leValores()]);
    const codigos = new Set(codigosDisponiveis(catalogo, panorama).map((item) => item.codigo));
    const { linhas, problemas } = normalizaLote(corpo?.linhas, codigos, ufsDe(panorama));
    const diferencas = comparaLote(linhas, atuais.dados);
    return json({ versao: atuais.versao, diferencas, problemas, resumo: {
      novas: diferencas.filter((item) => item.situacao === 'nova').length,
      alteradas: diferencas.filter((item) => item.situacao === 'alterada').length,
      iguais: diferencas.filter((item) => item.situacao === 'igual').length,
      avisos: diferencas.filter((item) => item.aviso).length
    } });
  } catch (erro) {
    return json({ erro: erro instanceof ErroDeEdicao ? erro.message : `Não consegui ler o lote: ${(erro as Error).message}` }, 400);
  }
};
