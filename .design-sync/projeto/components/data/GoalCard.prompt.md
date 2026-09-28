Cartão de meta — na rota Metas e indicadores, o eixo aberto empilha estes cartões em duas colunas.

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
      <GoalCard name="UCs estaduais com plano de manejo e conselho gestor"
        reading="53%" current="21,11%" target="40%" targetNote="até 2035" progress={53} active />
      <GoalCard name="Pobreza (CadÚnico)" reading="21%" current="14,03%"
        target="≤ 3%" targetNote="até 2050" progress={21} />
      <GoalCard variant="catalogo" name="ZEE vigente e atualizado"
        reason="O indicador ainda não tem valores coletados para os nove estados."
        status={<StatusBadge status="pendente" />} />
    </div>

A jornada é a leitura principal (display 800, 26px), e é sempre a da Amazônia Legal — as metas são
da região como um todo, e os estados só aparecem no detalhe, como complemento. Ela é o percurso
desde a baseline até o patamar; sem baseline (série com menos de 5 anos), a posição do valor atual
em relação a ele. Não é o valor absoluto. Quando não há escala, a jornada é "—" e o cartão diz
"sem escala" sob o valor atual. A barra mostra a mesma jornada, com o hachurado em urucum a 12% no que falta;
verde-mata cheio quando a meta está cumprida. Aberto no painel de detalhe, o cartão ganha contorno
urucum. No catálogo não há barra nem jornada: nome, motivo em itálico e o selo de coleta.

Os indicadores coletados sem meta numérica usam um terceiro cartão, com o valor da região e uma
faixa de calor por estado — veja `.goals-row.is-coletado` no UI kit (ui_kits/painel-estrategia-2050/metas.html).
