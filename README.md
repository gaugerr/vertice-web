# Vértice Web

Aplicativo de listas de compras em React, TypeScript, Vite e Tailwind CSS 4. Os dados ficam no IndexedDB, através do Dexie, e o aplicativo foi estruturado para funcionar offline após o primeiro carregamento completo.

Este projeto é independente do Flutter. Não substitui automaticamente o site já publicado.

**[Abrir o aplicativo publicado](https://vertice-web-navy.vercel.app)** · [Resultados da validação](docs/VALIDATION.md)

## Executar

Use Node 24 LTS e npm. Nenhuma variável de ambiente ou conta de serviço é necessária.

```sh
nvm use
npm ci
npm run dev
```

Em um checkout inicial que ainda não contenha `package-lock.json`, execute `npm install` uma vez e versione o lockfile gerado. As dependências diretas já estão fixadas no `package.json`. A CI exige o lockfile.

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

O build está em `dist`. O orçamento de JavaScript de 250 KiB gzip inclui também os módulos carregados sob demanda; o build informa os tamanhos e falha se esse orçamento for ultrapassado. Para formatar: `npm run format`. Para testes em modo observação: `npm run test:watch`.

## O que está implementado

- Listas com nome, data civil e descrição opcional; criação, edição e exclusão.
- Seis categorias padrão por lista, criadas transacionalmente.
- Inclusão rápida de itens, edição de nome/preço/quantidade/unidade e marcação como comprado.
- Filtros de itens pendentes e comprados.
- Totais em reais com aritmética decimal e arredondamento por item.
- IndexedDB com consultas reativas, transações e atualização entre abas.
- Exportação e restauração de backups JSON; importação do formato Flutter v1.
- Manifesto e ícones instaláveis; service worker de produção com cache e atualização por confirmação.
- Avisos de conectividade, preparo offline e alterações não salvas.
- Interface em português, tema escuro, roxo e verde, com layout para celular e desktop.

Login, pagamento, controle de compradores e sincronização com Supabase são etapas futuras. Esta versão local não limita o acesso a compradores.

## Organização

```text
src/app/                  inicialização, serviços e rotas
src/domain/               entidades, contratos, validações e cálculos
src/data/database/        versão e índices do IndexedDB
src/data/repositories/    consultas e operações transacionais
src/data/backup/          validação, conversão e arquivos de backup
src/features/             telas e componentes por função
src/shared/               componentes, hooks e utilitários comuns
src/pwa/                  instalação, conectividade e atualização
src/styles/               Tailwind 4, tokens e estilos
e2e/                      cenários de navegador no build de produção
tools/                    medição do build e servidor exclusivo de testes
```

Componentes executam operações pela interface `ShoppingRepository`. O repositório Dexie implementa esse contrato e concentra transações. As telas não escrevem diretamente nas tabelas. O IndexedDB é a fonte dos registros; não há cópia global paralela em Redux/Zustand.

As consultas `useLiveQuery` observam as leituras do repositório. Formulários mantêm apenas seus rascunhos no React. Editar campos de um produto não altera seu estado de compra, preservando marcações feitas por outra aba.

## Dados e cálculos

O banco `vertice_web`, versão 1, contém listas, categorias e itens. As chaves são UUIDs e as relações são verificadas pelo repositório. IndexedDB não tem chaves estrangeiras; criação e exclusão compostas e restauração usam transações explícitas.

Preço e quantidade são strings decimais canônicas. `big.js` calcula o produto, arredonda cada linha para centavos usando metade para cima e soma somente os itens comprados. Os cálculos verificam o limite de inteiros seguros. A unidade não altera a fórmula.

Datas de compra são strings civis `YYYY-MM-DD`, sem conversão UTC na apresentação. `createdAt` e `updatedAt` são instantes UTC ISO. Migrações futuras devem incrementar a versão Dexie e preservar registros; nunca recriar o banco para atualizar a interface.

## Offline e instalação

O service worker não é registrado no desenvolvimento. Para testar a experiência real:

```sh
npm run build
npm run preview
```

Abra o endereço local com internet e aguarde **Pronto para usar offline**. A partir daí, o aplicativo, as rotas e os recursos estáticos ficam em cache, e as compras são lidas e gravadas no IndexedDB. O primeiro acesso completo precisa de conexão.

No Chrome, use Instalar Vértice quando o navegador oferecer essa opção, ou o menu de instalação. No iPhone, use Compartilhar → Adicionar à Tela de Início. A instalação no iPhone físico exige validação no aparelho; um teste de WebKit no computador não comprova essa etapa.

`online.txt` não é armazenado pelo service worker. A verificação usa uma requisição sem cache ao abrir/retomar a página e periodicamente enquanto visível. O estado de conexão não bloqueia gravações locais.

Quando uma nova versão estiver instalada e aguardando, aparece uma ação de atualização. O aplicativo solicita confirmação se houver rascunhos e aguarda gravações locais em andamento antes de recarregar. O cache do aplicativo é separado dos registros no IndexedDB.

O navegador pode negar armazenamento persistente, limitar espaço ou apagar dados. Limpar os dados do site, usar outro domínio, outro navegador ou outro aparelho não transporta os registros. Exporte backups regularmente. Se o banco não abrir, o app exibe erro; não passa silenciosamente para armazenamento temporário.

## Backup e migração do Flutter

Em Dados e aplicativo, exporte um JSON e guarde fora do armazenamento do site. O novo formato usa `format: "vertice-backup"`, `version: 2`, `exportedAt`, `lists`, `categories` e `items`.

A importação aceita formatos v1 (Flutter) e v2. Valida até 10 MiB, no máximo 50 mil registros em cada coleção, tipos, duplicatas e relações. Antes de substituir, exibe quantidades e pede confirmação. Toda a substituição é transacional; uma falha não deve deixar um banco parcialmente restaurado.

No Flutter, exporte o backup existente e importe o arquivo aqui. Os IDs numéricos antigos são mapeados para UUIDs mantendo referências. Preços e quantidades são preservados como decimais; o estado 0/1 vira booleano. Datas legadas em milissegundos são interpretadas no fuso local do navegador que importa. Confira a data se estiver migrando entre fusos diferentes.

O app não lê diretamente o banco SQLite/WASM do Flutter e não oferece mesclagem de backups nesta versão. Restaurar substitui todo o conteúdo atual.

## Testes

```sh
npm test
npx playwright install --with-deps chromium webkit
npm run build
npm run test:e2e
```

Vitest cobre regras financeiras, validações, transações, relacionamentos, backups e preservação de formulários em falhas. Playwright usa o build real em Chromium e WebKit para CRUD, foco, backups, rotas, duas abas e 100 itens. Os cenários de fechamento/reabertura offline e ciclo de atualização do service worker rodam em Chromium.

O servidor `tools/serve-test.mjs` é exclusivo de testes e inclui um endpoint que muda o service worker em memória. Ele não faz parte de `dist` nem da publicação na Vercel.

Consulte [VALIDATION.md](docs/VALIDATION.md) para o estado efetivamente verificado. Arquivos de testes escritos não significam testes aprovados.

## Hospedagem na Vercel

Importe este repositório como um **projeto novo**. O projeto Flutter e o Docery não devem ser alterados.

- Framework: Vite.
- Instalação: `npm ci`.
- Build: `npm run build`.
- Saída: `dist`.
- Nenhum segredo ou variável de ambiente nesta etapa.

`vercel.json` define as rotas SPA, revalidação de HTML/service worker e cache longo apenas para assets com hash. Verifique no deployment: rota interna abre diretamente, `/assets/inexistente.js` retorna 404, `/sw.js` retorna JavaScript com `no-store`, e `/online.txt` não é substituído por HTML.

O projeto não inclui login do comprador e não usa Supabase. O plano da hospedagem deve ser adequado ao uso comercial antes das vendas.

## Para quem vem do Flutter

Veja [FLUTTER-TO-WEB.md](docs/FLUTTER-TO-WEB.md). A evolução para nuvem está descrita em [FUTURE-SYNC.md](docs/FUTURE-SYNC.md).
