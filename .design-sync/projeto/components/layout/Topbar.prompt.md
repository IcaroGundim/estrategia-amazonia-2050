Barra do topo do painel — verde-mata, presa ao topo, com a marca da Estratégia e as três rotas do produto.

    <Topbar
      logoSrc="assets/logo-consorcio-clara.avif"
      active="metodologia"
      action={<Button variant="outline">Baixar nota técnica</Button>}
      languages={[
        { code: 'pt-BR', flagSrc: 'assets/idiomas/Bandeira_do_Brasil.svg', ratio: '10 / 7', label: 'Ler esta página em português' },
        { code: 'en', flagSrc: 'assets/idiomas/Bandeira_EUA_Reino_Unido.svg', ratio: '3 / 2', label: 'Read this page in English' }
      ]}
      language="pt-BR"
    />

A marca é fixa e provisória até sair o manual de uso da marca: "ESTRATÉGIA REGIONAL" em versalete
sobre "Amazônia 2050" em Bricolage Grotesque 800 (30px), com o ano em ocre no mesmo corpo da
palavra, separada do logo por um fio claro. É toda em texto: não use letra cursiva nem manuscrita. As rotas vêm nesta ordem — Visão
Geral (chave `metodologia`, a raiz do site), Metas e indicadores (`metas`) e Panorama (`index`, em
/panorama). A rota ativa é ocre com filete de 2px; as demais ficam em areia a 70%. A ação da direita
muda por rota: Baixar nota técnica (Visão Geral), Sobre a Estratégia (Metas), Como ler os dados
(Panorama). O idioma da página aparece aceso e sublinhado; o outro, apagado, é o link.

No site, a primeira abertura revela "Amazônia" da esquerda para a direita com uma borda macia,
como água, e o ano entra ao lado quando a palavra se completa; aqui a marca aparece pronta. Abaixo de 1180px as rotas saem da barra e vão para uma barra
inferior de ícones; abaixo de 760px a marca da Estratégia some e fica só o logo (showBrand={false}).
