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

A marca é fixa: "ESTRATÉGIA REGIONAL" em versalete sobre "Amazônia" em letra cursiva (um SVG, não
uma fonte) e "2050" em ocre, separada do logo por um fio claro. As rotas vêm nesta ordem — Visão
Geral (chave `metodologia`, a raiz do site), Metas e indicadores (`metas`) e Panorama (`index`, em
/panorama). A rota ativa é ocre com filete de 2px; as demais ficam em areia a 70%. A ação da direita
muda por rota: Baixar nota técnica (Visão Geral), Sobre a Estratégia (Metas), Como ler os dados
(Panorama). O idioma da página aparece aceso e sublinhado; o outro, apagado, é o link.

No site, a primeira abertura revela o cursivo com uma máscara que corre como um rio e o ano entra
depois; aqui a marca aparece pronta. Abaixo de 1180px as rotas saem da barra e vão para uma barra
inferior de ícones; abaixo de 760px a marca da Estratégia some e fica só o logo (showBrand={false}).
