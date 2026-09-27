Seletor do painel — usado para escolher o indicador exibido e o ano da série.

    <Dropdown
      label="Indicador exibido"
      value="prodesRate"
      options={[{ value: 'prodesRate', label: 'Desmatamento PRODES', sublabel: 'menor taxa = melhor posição', groupLabel: 'Indicadores oficiais' }]}
      onChange={setIndicador}
    />

O gatilho tem 58px e borda verde-mata que vira urucum ao abrir; a seta é um quadrado girado,
não um ícone. O menu ancora à direita, tem largura mínima de 420px e agrupa por cabeçalho
em urucum. Desabilitado (indicador sem série) fica em linha-2 com texto tinta-4.
