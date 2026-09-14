# Como manter o painel da Estratégia Amazônia 2050

Guia para quem atualiza os dados e os textos do painel pela tela de
administração. Não é preciso saber programar. O endereço da administração é o
do painel seguido de `/admin` (por exemplo, `https://SEU-PAINEL/admin`).

## 1. Entrar e sair

- Abra `/admin/login`, informe o usuário e a senha que recebeu.
- Na primeira vez, troque a senha temporária em **Minha senha** (canto superior
  direito). Ao menos 10 caracteres.
- A sessão dura 12 horas. Para sair, use **Sair**.
- Esqueceu a senha? Peça a alguém com conta para gerar uma nova em **Contas**.

## 2. Rascunho, prévia e publicação

Tudo o que você salva vai para um **rascunho**. O site público não muda até
alguém **publicar**. Isso permite conferir antes.

1. Faça as edições (valores, textos, catálogo) e salve cada tela.
2. Na página inicial da administração, clique em **Atualizar prévia**. Em 1 a
   2 minutos a prévia fica pronta; abra-a por **Abrir prévia** e confira as
   páginas afetadas.
3. Se estiver tudo certo, clique em **Publicar no site**. O site público
   atualiza em 1 a 2 minutos.

A página inicial lista as alterações salvas e ainda não publicadas, com quem
fez e quando. Publicar leva todas elas de uma vez.

## 3. Atualizar valores

Em **Valores** cada indicador é um card, agrupado por eixo; os sem valores
têm contorno tracejado. A busca e o filtro (Todos, Com valores, Sem valores)
ficam no topo. Ao abrir um card aparece a grade: estados nas linhas, colunas
"Atual" (o valor sem ano, que aparece nas listas), os anos da série e os
campos auxiliares (números de apoio, como totais).

- **Digitar**: clique na célula, escreva o número (ponto ou vírgula como
  decimal) e clique em **Salvar no rascunho**.
- **Colar do Excel**: copie um bloco com os estados nas linhas e os anos nas
  colunas, na mesma ordem da grade, e cole na célula do canto superior esquerdo
  do bloco. As células preenchidas ficam amarelas até salvar.
- **Ano novo**: escreva o ano em "Acrescentar ano" e clique em **Coluna**; a
  coluna aparece vazia para preencher.
- **Apagar**: deixe a célula vazia e salve.

Para muitos indicadores de uma vez, use a faixa **Importar em lote**, logo
abaixo da busca:

1. Clique em **modelo** para baixar a planilha preenchida. Ela tem uma linha
   por célula: `codigo, campo, uf, ano, valor, nota`.
2. Edite ou acrescente linhas no Excel (deixe `ano` vazio para o valor atual e
   `campo` vazio para o valor principal). Salve.
3. Solte o arquivo na faixa ou clique em **Escolher arquivo**. A conferência
   acontece sozinha: a tela mostra o que é novo, o que muda e o que já está
   igual, e avisa quando um valor varia mais de 50% em relação ao ano anterior
   (só um aviso). A mesma lista em JSON entra por **cole o JSON** e depois
   **Conferir**.
4. Se estiver certo, **Gravar no rascunho**; **Descartar** limpa a faixa.

Os códigos das métricas do mapa (por exemplo `prodesKm2`, `focos`, `POP`,
`AREA`) estão na mesma tela, no grupo "Panorama".

## 4. Aceitar propostas da coleta automática

Alguns indicadores são baixados de fontes públicas por scripts. Eles não mudam
o painel sozinhos: cada execução vira uma **proposta**, listada em
**Propostas dos scripts de coleta**.

- Abra a proposta. A tela mostra, célula a célula, o valor gravado e o
  proposto, marcando o que é novo, o que muda e o que é igual.
- **Aceitar tudo** grava tudo o que muda; **Aceitar só as marcadas** grava as
  células que você marcar; **Rejeitar** arquiva a proposta com um motivo.
- O que foi aceito entra no rascunho, como qualquer outra edição.

## 5. Catálogo, metas, textos e fichas

- **Catálogo de indicadores**: nome, meta pactuada, descrição, unidade, fonte,
  prazo e situação da coleta de cada indicador, em português e inglês. Também
  cria indicadores novos (o código tem a forma `I1.2.3`).
- **Metas confrontáveis**: para cada indicador, se a meta é avaliada (com alvo,
  direção e forma de calcular o valor regional), se fica fora do quadro com um
  motivo próprio, ou fora com o motivo padrão.
- **Textos**: todo texto do painel, em português e inglês. Escolha a
  página no seletor (Visão Geral, Panorama, Metas e indicadores): o quadro
  mostra essa página como ela vai ficar e a lista traz só os textos que
  aparecem nela, das lâminas da Visão Geral à barra superior, legendas do
  mapa e fichas. O quadro se refaz enquanto você digita, antes de salvar;
  nas lâminas, ele pula para a lâmina do campo em edição. Um inglês vazio
  faz a versão em inglês mostrar o português naquele ponto. Use o filtro
  para achar um texto pelo que se lê na tela. Na Visão Geral há também o grupo
  **Nota técnica**: são os textos da síntese comparativa que vão para o PDF
  de "Baixar nota técnica", gerado à parte; nenhuma página os mostra, e por
  isso o quadro não muda ao editá-los.
- **Trajetória** (na mesma tela da meta): o Panorama mostra, para cada meta
  confrontável, o ritmo dos últimos anos e o ano em que o alvo seria alcançado
  se o ritmo se mantivesse. É uma projeção mecânica a partir da série, sem
  previsão. Dá para escolher quantos anos entram no ritmo (padrão 5, mínimo
  3), o método (linear ou composto) e desligar a trajetória numa meta cuja
  série tem quebra, com uma nota explicando.
- **Ficha técnica**: a partir do indicador no catálogo, o detalhe que abre na
  página de Metas (definição, fórmula, fontes, frequência).
- **Data e constantes**: a data "atualizado em" que o painel exibe.

## 6. Configuração do Panorama

Em **Configuração do Panorama** estão as métricas do mapa, na ordem do
seletor (setas para subir e descer), com rótulo, descrição, fonte, formato do
número e como o valor da Amazônia Legal é calculado. Em **Síntese** ficam os
pesos do índice de 0 a 100 e as dimensões; os pesos precisam somar 1. Só mexa
aqui com orientação técnica: mudar pesos muda o ranking dos estados.

## 7. Contas

Em **Contas**, quem tem conta pode criar outra (a senha temporária aparece
uma única vez), gerar senha nova para alguém que esqueceu, e desativar ou
reativar contas. Contas mudam de imediato no rascunho, mas só valem no site
depois do próximo deploy, em 1 a 2 minutos.

## 8. Quando aparece um aviso

- **"Outra pessoa alterou o mesmo que você"**: alguém salvou a mesma célula
  entre você abrir a tela e salvar. Nada foi gravado. Recarregue a página e
  refaça só a sua mudança. Mudanças em células diferentes não conflitam: são
  juntadas sozinhas.
- **"A mudança não passou na validação"**: a mensagem diz o que está errado
  (um código repetido, um ano inválido, pesos que não somam 1). Corrija e salve
  de novo.
- **"Publicar só funciona no endereço de produção"**: você está na prévia.
  Publique pelo endereço principal do painel.

## 9. O que fica por conta da equipe técnica

- Rodar os scripts de coleta e enviar as propostas ao repositório.
- Gerar a nota técnica em PDF.
- Manter as variáveis do serviço (segredo da sessão, token do GitHub) e o
  endereço da prévia.
