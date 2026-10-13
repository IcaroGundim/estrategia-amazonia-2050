import { aoEntrarNaPagina, BANDEIRA_REGIAO, bindMenu, bindVista, escape, flagImage, readResponse, sinalDaPagina } from './shared.js';
import { mapPath, projecaoPara } from './mapa.js';
import { idiomaAtual, t, tp } from '../i18n/index.js';

// A carteira de projetos da COP30 (public/data/projetos.json), com três
// recortes que se somam — estado, eixo da Estratégia e faixa de orçamento — e
// a busca. Os projetos aparecem em páginas de quatro, dois por dois. O recorte
// e a página vivem no endereço (`?uf=PA&eixo=3&p=2`), então dá para
// compartilhar uma seleção e para outras páginas apontarem para ela.
//
// O texto de cada projeto é o do órgão que o propôs, e o cartão o mostra na
// língua da página: `textos` traz os dois, o do site e a tradução do painel.
// Quando o mesmo projeto tem uma ficha em cada língua (`par`), aparece só a da
// página. Ficha ainda sem tradução (`semTraducao`) aparece como o site a
// escreveu, com o aviso da língua.
const ANCORA = '#projetos-lista';
const POR_PAGINA = 4;

const state = { dados: null, projetos: [], uf: '', eixo: 0, faixa: '', busca: '', pagina: 1, mapa: null };

const ROTULO_DA_FAIXA = {
  'ate-500k': 'até 500 mil',
  '500k-1m': '500 mil a 1 milhão',
  '1m-3.5m': '1 a 3,5 milhões',
  '3.5m-5m': '3,5 a 5 milhões',
  '5m-10m': '5 a 10 milhões',
  'acima-10m': 'acima de 10 milhões'
};

const semAcento = (valor) => String(valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const linguaDaPagina = () => (idiomaAtual() === 'en' ? 'en' : 'pt');
const nomeDoEixo = (eixo) => (linguaDaPagina() === 'en' && eixo.en) || eixo.nome;
const estadoDe = (uf) => state.dados.estados.find((estado) => estado.uf === uf);

// Cada recorte conta os projetos que os *outros* recortes deixam passar: o
// número ao lado de um estado diz quantos projetos aparecem se ele for escolhido.
function passa(projeto, { uf = state.uf, eixo = state.eixo, faixa = state.faixa } = {}) {
  if (uf && !projeto.ufs.includes(uf)) return false;
  if (eixo && projeto.eixo !== eixo) return false;
  if (faixa && projeto.faixa !== faixa) return false;
  if (state.busca && !projeto.indice.includes(state.busca)) return false;
  return true;
}
const conta = (recorte) => state.projetos.filter((projeto) => passa(projeto, recorte)).length;

function leEndereco() {
  const busca = new URLSearchParams(location.search);
  const uf = (busca.get('uf') || '').toUpperCase();
  state.uf = state.dados.estados.some((estado) => estado.uf === uf) ? uf : '';
  const eixo = Number(busca.get('eixo'));
  state.eixo = state.dados.eixos.some((item) => item.numero === eixo) ? eixo : 0;
  const faixa = busca.get('faixa') || '';
  state.faixa = state.dados.faixas.includes(faixa) ? faixa : '';
  state.busca = semAcento(busca.get('q') || '').trim();
  state.pagina = Math.max(1, Math.floor(Number(busca.get('p'))) || 1);
}
function gravaEndereco() {
  const url = new URL(location.href);
  const poe = (chave, valor) => (valor ? url.searchParams.set(chave, valor) : url.searchParams.delete(chave));
  poe('uf', state.uf);
  poe('eixo', state.eixo ? String(state.eixo) : '');
  poe('faixa', state.faixa);
  poe('q', document.querySelector('#projetos-busca')?.value.trim() || '');
  poe('p', state.pagina > 1 ? String(state.pagina) : '');
  history.replaceState(history.state, '', url);
}

function opcao({ chave, valor, rotulo, quantos, ativo }) {
  return `<button type="button" class="projetos-opcao${ativo ? ' is-active' : ''}" data-${chave}="${escape(valor)}" aria-pressed="${ativo}"${!quantos && !ativo ? ' disabled' : ''}>
    <span>${escape(rotulo)}</span><small>${quantos}</small>
  </button>`;
}

function renderFiltros() {
  const estados = document.querySelector('#projetos-estados');
  // A bandeira leva a contagem embaixo; a moldura (`goals-flag`) é a mesma das
  // outras páginas, aqui num `span` porque o botão é o conjunto.
  const total = conta({ uf: '' });
  estados.innerHTML = `<button type="button" class="projetos-estado${state.uf ? '' : ' is-active'}" data-uf="" aria-pressed="${!state.uf}" aria-label="${escape(t('Todos os estados'))}" title="${escape(t('Todos os estados'))}"><span class="goals-flag">${flagImage(BANDEIRA_REGIAO)}</span><small>${total}</small></button>`
    + state.dados.estados.map((estado) => {
      const quantos = conta({ uf: estado.uf });
      const ativo = state.uf === estado.uf;
      const rotulo = tp('{estado}: {n} projetos', { estado: estado.name, n: quantos });
      return `<button type="button" class="projetos-estado${ativo ? ' is-active' : ''}" data-uf="${estado.uf}" aria-pressed="${ativo}" aria-label="${escape(rotulo)}" title="${escape(rotulo)}"${!quantos && !ativo ? ' disabled' : ''}><span class="goals-flag">${flagImage(estado)}</span><small>${quantos}</small></button>`;
    }).join('');

  document.querySelector('#projetos-eixos').innerHTML = opcao({ chave: 'eixo', valor: '0', rotulo: t('Todos os eixos'), quantos: conta({ eixo: 0 }), ativo: !state.eixo })
    + state.dados.eixos.map((eixo) => opcao({ chave: 'eixo', valor: String(eixo.numero), rotulo: `${eixo.numero} · ${nomeDoEixo(eixo)}`, quantos: conta({ eixo: eixo.numero }), ativo: state.eixo === eixo.numero })).join('');

  document.querySelector('#projetos-faixas').innerHTML = opcao({ chave: 'faixa', valor: '', rotulo: t('Todas'), quantos: conta({ faixa: '' }), ativo: !state.faixa })
    + state.dados.faixas.map((faixa) => opcao({ chave: 'faixa', valor: faixa, rotulo: t(ROTULO_DA_FAIXA[faixa]), quantos: conta({ faixa }), ativo: state.faixa === faixa })).join('');
}

// Sem foto no site, o cartão mostra onde o projeto acontece: a região inteira
// em tom baixo e o estado dele aceso. Os contornos são calculados uma vez.
const MAPA = { width: 320, height: 180 };
function preparaMapa(geo) {
  const projeta = projecaoPara(geo.features, { ...MAPA, padding: 12 });
  state.mapa = geo.features.map((feature) => ({ uf: feature.properties.uf || feature.properties.SIGLA_UF, d: mapPath(feature.geometry, projeta) }));
}
function mapaDe(projeto, estados) {
  if (!state.mapa) return '';
  const rotulo = tp('Mapa da Amazônia Legal com {estado} em destaque', { estado: estados.map((estado) => estado.name).join(', ') });
  return `<svg class="projeto-cartao-mapa" viewBox="0 0 ${MAPA.width} ${MAPA.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escape(rotulo)}">${
    state.mapa.map(({ uf, d }) => `<path d="${d}"${projeto.ufs.includes(uf) ? ' class="is-destaque"' : ''}/>`).join('')
  }</svg>`;
}

function cartao(projeto) {
  const estados = projeto.ufs.map(estadoDe).filter(Boolean);
  const texto = projeto.textos[linguaDaPagina()];
  const outraLingua = Boolean(projeto.semTraducao?.includes(linguaDaPagina()));
  const lingua = outraLingua ? ` lang="${projeto.idioma === 'en' ? 'en' : 'pt-BR'}"` : '';
  const fatos = [
    projeto.faixa ? `<div><dt>${escape(t('Orçamento'))}</dt><dd>US$ ${escape(t(ROTULO_DA_FAIXA[projeto.faixa]))}</dd></div>` : '',
    projeto.duracaoMeses ? `<div><dt>${escape(t('Duração'))}</dt><dd>${escape(tp('{n} meses', { n: projeto.duracaoMeses }))}</dd></div>` : ''
  ].join('');
  // A foto é decorativa (não se sabe o que ela mostra): quem lê a tela tem o título.
  return `<article class="projeto-cartao${projeto.foto ? '' : ' is-sem-foto'}" role="listitem">
    <div class="projeto-cartao-foto">
      ${projeto.foto ? `<img src="${escape(projeto.foto)}" alt="" decoding="async">` : mapaDe(projeto, estados)}
      ${projeto.credito ? `<a class="projeto-cartao-credito" href="${escape(projeto.credito.pagina)}" target="_blank" rel="noopener" title="${escape(tp('Foto ilustrativa do estado, não do projeto. Autor: {autor}. Licença: {licenca}. Origem: Wikimedia Commons.', projeto.credito))}"><span>${escape(t('Foto ilustrativa'))} ·</span> <b>${escape(projeto.credito.autor)}</b> <span>· ${escape(projeto.credito.licenca)}</span></a>` : ''}
      <span class="projeto-cartao-estado">${estados.map((estado) => `<i>${flagImage(estado)}</i>`).join('')}<b>${escape(estados.map((estado) => estado.name).join(' · '))}</b></span>
    </div>
    <div class="projeto-cartao-corpo">
      <h2 class="projeto-cartao-titulo"${lingua} title="${escape(texto.titulo)}">${escape(texto.titulo)}</h2>
      ${texto.entidade ? `<p class="projeto-cartao-entidade"${lingua}>${escape(texto.entidade)}</p>` : ''}
      ${texto.resumo ? `<p class="projeto-cartao-resumo"${lingua}>${escape(texto.resumo)}</p>` : ''}
      <div class="projeto-cartao-pe">
        ${fatos ? `<dl class="projeto-cartao-fatos">${fatos}</dl>` : ''}
        <span class="projeto-cartao-link">
          <a href="${escape(projeto.url)}" target="_blank" rel="noopener">${escape(t('Ver o projeto completo'))} ↗</a>
          ${outraLingua ? `<small>${escape(projeto.idioma === 'en' ? t('texto em inglês') : t('texto em português'))}</small>` : ''}
        </span>
      </div>
    </div>
  </article>`;
}

function renderLista() {
  const visiveis = state.projetos.filter((projeto) => passa(projeto));
  const total = state.projetos.length;
  const filtrado = Boolean(state.uf || state.eixo || state.faixa || state.busca);
  const paginas = Math.max(1, Math.ceil(visiveis.length / POR_PAGINA));
  state.pagina = Math.min(state.pagina, paginas);
  document.querySelector('#projetos-resumo').textContent = filtrado
    ? tp('{n} de {total} projetos', { n: visiveis.length, total })
    : tp('{total} projetos', { total });
  document.querySelector('#projetos-limpar').hidden = !filtrado;

  // A paginação existe em cima e embaixo; a de baixo só aparece quando os
  // cartões empilham e o fim da página fica longe da de cima.
  for (const navegacao of document.querySelectorAll('.projetos-paginas')) {
    navegacao.hidden = paginas < 2;
    navegacao.querySelector('[data-pagina-atual]').textContent = tp('Página {n} de {total}', { n: state.pagina, total: paginas });
    navegacao.querySelector('[data-pagina="-1"]').disabled = state.pagina <= 1;
    navegacao.querySelector('[data-pagina="1"]').disabled = state.pagina >= paginas;
  }

  const lista = document.querySelector(ANCORA);
  const daPagina = visiveis.slice((state.pagina - 1) * POR_PAGINA, state.pagina * POR_PAGINA);
  lista.innerHTML = daPagina.length
    ? daPagina.map(cartao).join('')
    : `<p class="projetos-aviso">${escape(t('Nenhum projeto com esse recorte.'))}</p>`;
  // A troca de página entra com um aceno curto, para se ver que mudou.
  lista.classList.remove('is-trocando');
  void lista.offsetWidth;
  lista.classList.add('is-trocando');
}

function renderNumeros() {
  const estados = new Set(state.projetos.flatMap((projeto) => projeto.ufs)).size;
  const orgaos = new Set(state.projetos.map(({ textos }) => textos[linguaDaPagina()]).map((texto) => semAcento(texto.entidade || texto.titulo))).size;
  document.querySelector('#projetos-numeros').innerHTML = [
    [state.projetos.length, t('projetos')],
    [estados, t('estados')],
    [orgaos, t('órgãos')]
  ].map(([numero, rotulo]) => `<div><dt>${escape(rotulo)}</dt><dd>${numero}</dd></div>`).join('');
}

function renderFonte() {
  const { fonte } = state.dados;
  const data = new Date(`${fonte.coletadoEm}T12:00:00`).toLocaleDateString(linguaDaPagina() === 'en' ? 'en-US' : 'pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const link = `<a href="${escape(fonte.url)}" target="_blank" rel="noopener">Brazilian Amazon Projects</a>`;
  // O link entra depois do escape: é o único HTML da frase.
  document.querySelector('#projetos-fonte').innerHTML = escape(tp('Fonte: {site}, do Consórcio Interestadual da Amazônia Legal, lido em {data}. O texto de cada projeto é do órgão que o propôs; onde ele foi escrito em outra língua, a tradução é deste painel, e o projeto completo abre no site do Consórcio na língua original. Estado, faixa de orçamento e duração foram padronizados, e o eixo da Estratégia é a leitura deste painel. Onde o projeto não traz foto, a imagem é uma paisagem do estado, do Wikimedia Commons, com autor e licença indicados no cartão.', { site: '§', data })).replace('§', link);
}

function render() {
  renderFiltros();
  renderLista();
}

function vaiPara(pagina) {
  state.pagina = Math.max(1, pagina);
  gravaEndereco();
  renderLista();
  // Com os cartões empilhados, quem passou a página lá embaixo volta ao começo dela.
  const quadro = document.querySelector('.projetos-quadro');
  if (quadro.getBoundingClientRect().top < 0) quadro.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function init() {
  bindMenu();
  bindVista();
  const sinal = sinalDaPagina();
  // O mapa só serve aos cartões sem foto: se a malha não vier, eles ficam sem ele.
  const [dados, geo] = await Promise.all([
    fetch('/data/projetos.json').then(readResponse),
    fetch('/data/geo.json').then(readResponse).catch(() => null)
  ]);
  if (sinal.aborted) return;
  state.dados = dados;
  if (geo) preparaMapa(geo);
  const lingua = linguaDaPagina();
  const porId = new Map(dados.projetos.map((projeto) => [projeto.id, projeto]));
  state.projetos = dados.projetos
    // Com as duas línguas publicadas, fica a da página.
    .filter((projeto) => !projeto.par || projeto.idioma === lingua || porId.get(projeto.par)?.idioma !== lingua)
    // A busca acha o projeto pelo texto de qualquer das duas línguas.
    .map((projeto) => ({ ...projeto, indice: semAcento(`${Object.values(projeto.textos).flatMap(Object.values).join(' ')} ${projeto.areas}`) }))
    // Quem tem foto do próprio projeto vem primeiro, na ordem da carteira; os
    // demais levam uma foto ilustrativa do estado (`credito`).
    .sort((a, b) => Boolean(b.foto && !b.credito) - Boolean(a.foto && !a.credito));

  leEndereco();
  const busca = document.querySelector('#projetos-busca');
  busca.value = new URLSearchParams(location.search).get('q') || '';
  renderNumeros();
  renderFonte();
  render();

  document.querySelector('.projetos-filtros').addEventListener('click', (evento) => {
    const botao = evento.target.closest('button[data-uf], button[data-eixo], button[data-faixa]');
    if (!botao) return;
    // Clicar no que já está escolhido desfaz a escolha.
    if ('uf' in botao.dataset) state.uf = state.uf === botao.dataset.uf ? '' : botao.dataset.uf;
    if ('eixo' in botao.dataset) state.eixo = state.eixo === Number(botao.dataset.eixo) ? 0 : Number(botao.dataset.eixo);
    if ('faixa' in botao.dataset) state.faixa = state.faixa === botao.dataset.faixa ? '' : botao.dataset.faixa;
    state.pagina = 1;
    gravaEndereco();
    render();
    // O render refaz os botões; o foco volta para o que foi acionado.
    const [chave, valor] = Object.entries(botao.dataset)[0];
    document.querySelector(`.projetos-filtros button[data-${chave}="${CSS.escape(valor)}"]`)?.focus({ preventScroll: true });
  }, { signal: sinal });

  busca.addEventListener('input', () => {
    state.busca = semAcento(busca.value).trim();
    state.pagina = 1;
    gravaEndereco();
    render();
  }, { signal: sinal });

  document.querySelector('#projetos-limpar').addEventListener('click', () => {
    Object.assign(state, { uf: '', eixo: 0, faixa: '', busca: '', pagina: 1 });
    busca.value = '';
    gravaEndereco();
    render();
  }, { signal: sinal });

  document.querySelector('.projetos-quadro').addEventListener('click', (evento) => {
    const botao = evento.target.closest('.projetos-paginas button[data-pagina]');
    if (botao && !botao.disabled) vaiPara(state.pagina + Number(botao.dataset.pagina));
  }, { signal: sinal });

  // As setas do teclado passam as páginas, fora de um campo de texto.
  document.addEventListener('keydown', (evento) => {
    if (evento.altKey || evento.ctrlKey || evento.metaKey || evento.target.closest?.('input, textarea, select')) return;
    const passo = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
    const paginas = Math.ceil(state.projetos.filter((projeto) => passa(projeto)).length / POR_PAGINA);
    if (!passo || state.pagina + passo < 1 || state.pagina + passo > paginas) return;
    evento.preventDefault();
    vaiPara(state.pagina + passo);
  }, { signal: sinal });
}

aoEntrarNaPagina(ANCORA, () => init().catch((error) => {
  const lista = document.querySelector(ANCORA);
  if (lista) lista.innerHTML = `<p class="projetos-aviso">${escape(error.message)}</p>`;
}));
