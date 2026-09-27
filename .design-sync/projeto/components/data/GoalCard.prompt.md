Cartão de meta — a rota Metas e indicadores empilha estes cartões em duas colunas, por eixo.

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
      <GoalCard name="UCs estaduais com plano de manejo e conselho gestor"
        reading="53%" current="21,11%" target="40%" targetNote="até 2035" progress={53} active />
      <GoalCard name="Desmatamento ilegal" reading="—" current="6.518 ha" currentNote="sem escala"
        target="≤ 0 ha" targetNote="até 2030" progress={0} />
      <GoalCard variant="catalogo" name="ZEE vigente e atualizado"
        reason="O indicador ainda não tem valores coletados para os nove estados."
        status={<StatusBadge status="pendente" />} />
    </div>

A jornada é a leitura principal (display 800, 26px): a fração do caminho até o patamar, não o
valor absoluto. Quando a meta não tem ponto de partida, a jornada é "—" e o cartão diz "sem escala"
sob o valor atual. A barra mostra a mesma jornada, com o hachurado em urucum a 12% no que falta;
verde-mata cheio quando a meta está cumprida. Aberto no painel de detalhe, o cartão ganha contorno
urucum. No catálogo não há barra nem jornada: nome, motivo em itálico e o selo de coleta.

Os indicadores coletados sem meta numérica usam um terceiro cartão, com o valor da região e uma
faixa de calor por estado — veja `.goals-row.is-coletado` no UI kit (ui_kits/painel-estrategia-2050/metas.html).
