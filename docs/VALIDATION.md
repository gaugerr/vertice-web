# Validação — marca, embalagem e nome automático

Publicado em **https://use-vertice.vercel.app**, projeto Vercel `vertice-web`, repositório [gaugerr/vertice-web](https://github.com/gaugerr/vertice-web).

Código validado e publicado na main: `2b09e4c5c183c329221c30629bdf1d20257f2867`. Desenvolvimento em `feat/product-details`. O registro posterior altera somente a documentação.

## Comportamento entregue

- Marca e conteúdo por embalagem ficam visíveis e opcionais nos formulários rápido e completo.
- Marcar como comprado continua selecionando o preço; Enter permite salvar sem preencher os detalhes.
- Conteúdo aceita g, kg, ml, L ou un. Peso/volume admitem até três casas decimais; contagem exige valor inteiro positivo.
- Nome base, marca e conteúdo são armazenados separadamente. A apresentação usa, por exemplo, Café · Marca X · 500 g.
- Prévia local durante a edição; nome da lista muda somente após gravação bem-sucedida.
- Limpar marca ou conteúdo remove apenas o detalhe escolhido.
- Cópias preservam marca e embalagem, zerando preços e desmarcando produtos. Alterações na cópia não modificam a origem.
- Quantidade comprada e tamanho da embalagem são independentes. Nenhum novo campo altera o total ou converte cobranças por kg/L.
- Apresentação consistente em produtos, prévias de categoria, revisão de preços ausentes, controles acessíveis e confirmação de exclusão.
- Operações funcionam offline após o cache inicial do PWA.

## Integridade e compatibilidade

- Atualizações omitem os detalhes não editados, preservando alterações feitas em outra aba.
- Preço, quantidade e detalhes alterados são gravados em uma única transação; falhas não deixam alterações parciais.
- Compras finalizadas continuam protegidas no repositório. Rascunhos permanecem visíveis e ficam bloqueados se outra aba finalizar a compra.
- A revisão da finalização inclui marca e conteúdo, detectando alterações mesmo sem mudança de preço ou timestamp.
- Migração Dexie v3 → v4 inicializa os campos nulos, preservando registros, valores e compras finalizadas.
- Backup JSON v5 preserva os detalhes; leitores v1 Flutter e v2/v3/v4 web utilizam o formato antigo dos itens e recebem detalhes nulos.
- Nomes antigos não são interpretados para deduzir marcas ou tamanhos.
- Restauração permanece transacional e valida os novos dados antes de substituir o banco.
- Sem novas dependências, tabelas, APIs ou serviços externos.

## Checks do código

[Execução na main 39526018439](https://github.com/gaugerr/vertice-web/actions/runs/39526018439): **success**.

[Execução final da branch 39525601892](https://github.com/gaugerr/vertice-web/actions/runs/39525601892): **success**.

- TypeScript estrito, ESLint e Prettier: aprovados.
- Vitest: **107 testes aprovados**, em **15 arquivos**.
- Build de produção: aprovado.
- JavaScript total, incluindo módulos sob demanda: **159,2 KiB gzip**, abaixo do limite de 250 KiB.
- Playwright em Chromium e WebKit: **39 cenários aprovados e 5 deliberadamente ignorados**.
- Os casos ignorados são ciclos offline/service worker no WebKit, executados em Chromium.

Cobertura nova: nomes combinados sem reescrever o nome base, normalização decimal, limites de marca, contagens inteiras, limpeza independente, invariância dos totais, campos preservados em falhas, omissão de metadados não editados, migração de banco v3 populado com compra finalizada, importação v4 e exportação/restauração v5, cópias independentes, conflito de revisão e nomes longos em 320 px.

As suítes anteriores de compra rápida, orçamento, comparador, finalização e backups também passaram.

[Pacote compilado validado](https://github.com/gaugerr/vertice-web/actions/runs/39526018439/artifacts/12313191840). Deve ser servido por HTTP/HTTPS.

## Checks do endereço público

[Execução 39526367547](https://github.com/gaugerr/vertice-web/actions/runs/39526367547): **success**.

- Versão de detalhes dos produtos identificada no HTML público.
- HTTPS, manifesto standalone, JavaScript do service worker, cache e resposta 404 de asset inexistente verificados.
- **38 cenários aprovados e 4 deliberadamente ignorados** no endereço publicado.
- Inclui salvar detalhes offline, recarregar, finalizar, restaurar backup e copiar mantendo os dados.
- O cenário de atualização sintética do service worker é exclusivo do servidor local de testes.

## Limites

Foco e interação foram verificados em navegadores automatizados, com revisão de capturas em largura de celular. Teclado virtual, instalação e desempenho em aparelhos físicos não são comprovados por esses testes.

Histórico de preços, identificação de produtos entre compras e avisos automáticos de comparação ficam para a próxima etapa. Os dados continuam locais, sem sincronização em nuvem; exporte backups para guardá-los fora do armazenamento do navegador.
