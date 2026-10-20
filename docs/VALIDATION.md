# Validação da versão 0.1.0 — orçamento por lista

Publicado em **https://vertice-web-navy.vercel.app**, projeto Vercel `vertice-web`, repositório [gaugerr/vertice-web](https://github.com/gaugerr/vertice-web).

Código validado e publicado na `main`: `6dd9af431b2784a5aad411a004707cd5e1f8c744`. O registro posterior desta validação altera somente a documentação. Desenvolvimento isolado na branch `feat/list-budget`.

## Comportamento entregue

- Orçamento opcional ao criar ou editar a lista; ajuste rápido no resumo e dentro das categorias. Limpar o campo e salvar remove o limite.
- O gasto considera apenas itens marcados como pegos, com preços e quantidades já salvos. O saldo é da lista inteira, independentemente de categoria ou filtro.
- Aviso discreto a partir de 80%, indicação de limite atingido em 100% e valor excedente acima disso. A barra para em 100%; nenhum aviso bloqueia a compra.
- Valores positivos, até duas casas decimais, guardados em centavos inteiros. A apresentação monetária preserva o último centavo mesmo em valores altos.
- Atualização entre abas, preservação de rascunhos e erros de gravação sem perda do valor digitado.
- Fluxo rápido de inclusão e foco no preço preservado. O total permanece sem flutuação durante a edição dos valores para não cobrir os controles.

## Migração e backups

- IndexedDB `vertice_web` atualizado da versão Dexie 1 para 2, preenchendo orçamento nulo nas listas existentes.
- Migração testada com banco antigo populado, preservando listas, categorias, identificadores, compras, datas, preços e quantidades.
- Exportação JSON na versão 3, incluindo `budgetCents` em cada lista.
- Importação dos formatos Flutter v1, web v2 e web v3; versões anteriores recebem orçamento nulo.
- Dados inválidos são rejeitados antes da restauração; as operações continuam transacionais.

## Checks do código

[Execução 39467907950](https://github.com/gaugerr/vertice-web/actions/runs/39467907950): **success**.

- TypeScript estrito, ESLint e Prettier: aprovados.
- Vitest: **43 testes aprovados**, em sete arquivos.
- Build de produção: aprovado.
- JavaScript total, incluindo módulos sob demanda: **151,0 KiB gzip**, abaixo do orçamento de 250 KiB.
- Playwright em Chromium e WebKit: **16 cenários aprovados e 2 deliberadamente ignorados**.
- Instalação/reabertura offline e atualização do service worker são verificadas em Chromium; esses dois casos não são executados em WebKit.

Cobertura: fronteiras de 80% e 100%, excesso, decimais e limites seguros; isolamento entre listas; edição independente de metadados; migração real de IndexedDB antigo; compatibilidade dos backups; foco por toque; filtros; duas abas; quantidades fracionárias; rolagem entre 100 produtos; falhas de armazenamento e proteção de rascunhos.

[Pacote compilado validado](https://github.com/gaugerr/vertice-web/actions/runs/39467907950/artifacts/12285088384). Deve ser servido por HTTP/HTTPS.

## Checks do endereço público

[Execução 39468192831](https://github.com/gaugerr/vertice-web/actions/runs/39468192831): **success**.

- Identificação da versão de orçamento confirmada no HTML público.
- HTTPS, manifesto standalone, service worker JavaScript e cache conferidos; asset inexistente retorna 404.
- **15 cenários aprovados e 1 ignorado** no endereço da Vercel.
- Inclui definir limite e salvar produtos offline, fechar a aba, reabrir e conferir orçamento, excesso, itens e backup exportado.
- O teste de atualização sintética é exclusivo do servidor local de testes.

## Limites

Foco e toque foram verificados em navegadores automatizados, com revisão de capturas em largura de celular. Teclado virtual, desempenho e instalação em aparelhos físicos não são comprovados por esses testes.

Os checks completos rodaram no GitHub Actions; código, lockfile e build validado estão disponíveis no workspace. O aplicativo continua local, sem login, controle de compradores ou sincronização em nuvem.
