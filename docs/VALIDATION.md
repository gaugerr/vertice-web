# Validação da versão 0.1.0

## Resultado

Aplicativo publicado em **https://vertice-web-navy.vercel.app**, projeto Vercel `vertice-web`, equipe `gaugerrs-projects`. O repositório é [gaugerr/vertice-web](https://github.com/gaugerr/vertice-web), branch `main`.

Código validado no commit `b68c0bac01b3a01dbbc22ebe74f394593284a3f2`, que formata a implementação `71ee99b6364c050bffd55103b5530c3e20b4745a`. Alterações posteriores nesta entrega são de documentação.

## Checks do código

[Execução 39399340118](https://github.com/gaugerr/vertice-web/actions/runs/39399340118): **success**.

- Dependências exatas instaladas; `package-lock.json` gerado e versionado.
- TypeScript estrito: aprovado.
- ESLint e Prettier: aprovados.
- Vitest: **25 testes aprovados**, em quatro arquivos.
- Build de produção: aprovado.
- JavaScript total, incluindo módulos sob demanda: **149,2 KiB gzip**, abaixo do orçamento de 250 KiB.
- Playwright: **10 cenários aprovados e 2 deliberadamente ignorados**, em Chromium e WebKit.
- Ciclo de instalação/reabertura offline e atualização de service worker executado em Chromium; os dois casos equivalentes não são executados em WebKit.

Os testes cobrem aritmética decimal, arredondamento por item, isolamento entre listas, validações, rollback, exclusão em cascata, backups, restauração vazia, conversão do Flutter e preservação da ordem dos itens importados.

No navegador: criação e edição, quantidades fracionárias, preço, checkbox, recarga direta de rotas, foco dos diálogos, exclusão, importação/exportação, duas abas e rolagem até o último de 100 itens. O teste offline bloqueia a rede de verdade, cria dados, fecha a aba, reabre e exporta os registros. O teste de atualização aguarda a recarga efetiva e verifica que os dados continuam presentes.

[Pacote compilado](https://github.com/gaugerr/vertice-web/actions/runs/39399340118/artifacts/12254825933). É um site estático: deve ser servido por HTTP/HTTPS, não aberto diretamente como arquivo local.

## Checks do endereço público

[Execução 39399586366](https://github.com/gaugerr/vertice-web/actions/runs/39399586366): **success**.

- HTTPS público confirmado, sem sessão de login da Vercel.
- Manifesto em modo standalone e service worker JavaScript confirmado.
- Service worker com `Cache-Control: no-store`.
- Asset inexistente retorna 404, sem receber HTML da SPA.
- Fluxos de interface executados contra a URL da Vercel: **9 cenários aprovados e 1 ignorado**.
- O ciclo de atualização sintética é exclusivo do servidor de testes local; a navegação, persistência offline, backups, múltiplas abas e lista de 100 itens também foram verificados no site publicado.

## Limites da validação

As verificações automatizadas não medem a GPU, o teclado virtual ou a instalação em um celular físico. Instalação e experiência no iPhone físico ainda precisam ser conferidas no aparelho.

O ambiente local não consegue acessar o registry npm pelo proxy; os checks completos foram executados no GitHub Actions. O código e o lockfile exatos estão disponíveis no repositório, e o build validado foi baixado para `dist` no workspace.

Esta versão funciona localmente, sem login, controle de compradores ou sincronização em nuvem.
