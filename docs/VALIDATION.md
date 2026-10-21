# Validação — finalização e cópia de compras

Publicado em **https://vertice-web-navy.vercel.app**, projeto Vercel `vertice-web`, repositório [gaugerr/vertice-web](https://github.com/gaugerr/vertice-web).

Código validado e publicado na `main`: `3d52ed33049ab892a8be476a1f033da9391fbf0a`. Desenvolvimento isolado em `feat/list-completion`. O registro posterior desta validação altera somente a documentação.

## Comportamento entregue

- Finalização no resumo geral, com total, contagens, orçamento, mercado opcional e data local editável.
- Revisão recebe foco no resumo; os campos opcionais não são focados automaticamente.
- Exige pelo menos um produto comprado e preço maior que zero em todos os comprados. Produtos não comprados permanecem identificados, sem entrar no total.
- Compras finalizadas ficam separadas das listas em andamento e somente para consulta.
- Reabertura preserva os dados e libera correções. Finalizar novamente atualiza a mesma compra, sem criar outro registro.
- Cópia nos cartões e no resumo: nova lista independente com categorias/produtos, quantidades/unidades preservadas, preços zerados e todos os itens desmarcados.
- Nome, data, descrição e orçamento da cópia são editáveis. Mercado e informações de finalização não são copiados.
- Funciona offline após o carregamento/cache inicial do PWA.

## Integridade e compatibilidade

- Estado verificado no repositório, dentro das transações de escrita; uma aba antiga não pode alterar uma compra finalizada.
- Revisão consistente de listas, categorias e produtos. Mudanças em outra aba exigem nova conferência; a confirmação compara os registros dentro da transação.
- Revisão não depende exclusivamente de timestamps: alterações dentro do mesmo milissegundo também são detectadas.
- Confirmação duplicada é impedida na interface e duas confirmações concorrentes são serializadas no banco.
- Cópias são atômicas, com identificadores e relações novos; falha de armazenamento não deixa registros parciais.
- Rascunhos de preço e metadados permanecem visíveis se outra aba finalizar a compra; gravação fica bloqueada.
- Dexie evolui de v2 para v3, preservando banco anterior e inicializando as listas existentes em andamento.
- Backup JSON v4 inclui estado, mercado e datas; importação v1 Flutter e v2/v3 web preservada com schemas das versões antigas.
- Restauração continua transacional e rejeita finalizações incoerentes antes de substituir os dados.
- Sem nova dependência, API, login ou sincronização.

## Checks do código

[Execução na main 39521359472](https://github.com/gaugerr/vertice-web/actions/runs/39521359472): **success**.

[Execução final da branch 39520966034](https://github.com/gaugerr/vertice-web/actions/runs/39520966034): **success**.

- TypeScript estrito, ESLint e Prettier: aprovados.
- Vitest: **91 testes aprovados**, em **12 arquivos**.
- Build de produção: aprovado.
- JavaScript total, incluindo módulos sob demanda: **158,0 KiB gzip**, abaixo do limite de 250 KiB.
- Playwright em Chromium e WebKit: **32 cenários aprovados e 4 deliberadamente ignorados**.
- Os quatro cenários ignorados são os ciclos offline/service worker no WebKit; esses cenários são executados no Chromium.

Cobertura: migração real de bancos antigos, total com quantidades fracionárias, orçamento excedido, preços ausentes, leitura de compras fechadas, reabertura/correção, cópia de listas abertas/fechadas/vazias, rollback em falhas, conflito de revisão, duas confirmações concorrentes, rascunhos em três abas, cópia independente, recarga offline e restauração de backup v4.

As suítes anteriores de compra rápida, orçamento, importação Flutter e comparador também passaram. Um caso novo detectou e verificou a correção de uma mudança de layout ao fechar o comparador vazio: a validação no blur não desloca mais botões/seletores durante o clique.

[Pacote compilado validado](https://github.com/gaugerr/vertice-web/actions/runs/39521359472/artifacts/12310869514). Deve ser servido por HTTP/HTTPS.

## Checks do endereço público

[Execução 39521612834](https://github.com/gaugerr/vertice-web/actions/runs/39521612834): **success**.

- Versão de finalização identificada no HTML público.
- HTTPS, manifesto standalone, service worker JavaScript, política de cache e resposta 404 de asset inexistente verificados.
- **31 cenários aprovados e 3 deliberadamente ignorados** na aplicação publicada.
- Finalização, consulta, correção, cópia, conflito entre abas e uso offline exercitados no endereço da Vercel.
- O teste de atualização sintética do service worker é exclusivo do servidor local de testes.

## Limites

Foco e interação foram verificados em navegadores automatizados, com revisão de capturas em largura de celular. Teclado virtual, instalação e desempenho em aparelhos físicos não são comprovados por esses testes.

Histórico de preços por produto, marca e conteúdo da embalagem ficam para uma próxima etapa. O registro desta entrega é a compra finalizada, com seus produtos e valores locais. Não há controle de compradores ou cópia automática em nuvem; exportar o backup continua sendo necessário para guardar os dados fora do navegador.
