# Validação da versão 0.1.0

Publicado em **https://vertice-web-navy.vercel.app**, projeto Vercel `vertice-web`, repositório [gaugerr/vertice-web](https://github.com/gaugerr/vertice-web), branch `main`.

Código validado: `44a28f945f7f67a5e061ee8938fdc5fde3f9583b`. O registro posterior desta validação altera somente a documentação.

## Fluxo rápido no mercado

- Adicionar pelo Enter ou pelo botão + mantém o campo ativo, sem desativá-lo durante a gravação.
- Texto alterado enquanto o banco salva não é apagado quando a gravação anterior termina.
- Marcar um item abre preço, quantidade e unidade na própria linha. O preço recebe foco e seleção no mesmo gesto de toque, antes da gravação assíncrona; o campo solicita teclado decimal.
- Enter no preço ou “Salvar valores” grava os dados e fecha a edição.
- O filtro “Pendentes” mantém o item visível enquanto seus valores são editados.
- O total deixa de flutuar durante a edição para não cobrir os campos ou o botão.
- A marcação é gravada ao tocar no checkbox. Os valores novos só são gravados ao confirmar; fechar com alterações pede confirmação para descartá-las.
- Salvar valores não sobrescreve nomes ou marcações modificados por outra aba.

## Checks do código

[Execução na main 39447954682](https://github.com/gaugerr/vertice-web/actions/runs/39447954682): **success**. A mesma revisão passou antes na [branch separada](https://github.com/gaugerr/vertice-web/actions/runs/39447601478).

- TypeScript estrito, ESLint e Prettier: aprovados.
- Vitest: **29 testes aprovados**, em cinco arquivos.
- Build de produção: aprovado.
- JavaScript total, incluindo módulos sob demanda: **149,9 KiB gzip**, abaixo do orçamento de 250 KiB.
- Playwright em Chromium e WebKit: **12 cenários aprovados e 2 deliberadamente ignorados**.
- Instalação/reabertura offline e atualização do service worker são verificadas em Chromium; esses dois casos não são executados em WebKit.

Os testes incluem foco com toque simulado, seleção integral do preço, inclusão contínua por Enter e +, salvamento com quantidade fracionária, filtros, acesso ao botão de salvar sem sobreposição e recarga. Também cobrem falhas de armazenamento, preservação de rascunhos, edição concorrente, cálculos, backups, importação do Flutter, múltiplas abas e rolagem entre 100 itens.

[Pacote compilado validado](https://github.com/gaugerr/vertice-web/actions/runs/39447601478/artifacts/12276677922). Deve ser servido por HTTP/HTTPS, não aberto como arquivo local.

## Checks do endereço público

[Execução 39448256326](https://github.com/gaugerr/vertice-web/actions/runs/39448256326): **success**.

- Aguardou a identificação desta versão no HTML público.
- HTTPS, manifesto standalone, service worker JavaScript e política de cache conferidos.
- Asset inexistente retorna 404.
- **11 cenários aprovados e 1 ignorado** contra o endereço da Vercel.
- Inclui tocar no checkbox, digitar o preço selecionado, salvar valores offline, fechar a aba, reabrir e conferir os valores e o total.
- O teste de atualização sintética é exclusivo do servidor local de testes.

## Limites da validação

Toque, foco e seleção foram verificados em navegadores automatizados. A abertura e permanência do teclado virtual, desempenho e instalação em celulares físicos ainda precisam ser conferidos no aparelho.

O ambiente local bloqueou o download das dependências pelo proxy. Os checks completos rodaram no GitHub Actions; o código, o lockfile e o build validado estão disponíveis no workspace.

O aplicativo continua local, sem login, controle de compradores ou sincronização em nuvem.
