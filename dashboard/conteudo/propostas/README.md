# Propostas dos scripts de coleta

Cada arquivo `AAAA-MM-DD-<script>-<sufixo>.json` nesta pasta é uma proposta de
valores gerada por um script de coleta (`scripts/proposta.py`,
`scripts/gerar_propostas.py`). Ela não altera o painel: a tela de administração
(Propostas) mostra o que é novo, alterado ou igual em relação a `valores.csv`, e
quem edita aceita tudo, aceita parte ou rejeita. Ao aceitar, as células vão para
`valores.csv` com `origem = script` e a proposta vai para `aplicadas/`; ao
rejeitar, vai para `rejeitadas/`.
