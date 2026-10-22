# Vértice — guia do projeto

## Visão geral

PWA de listas de compras, pensado para uso rápido no mercado e funcionamento
offline. Este repositório é `gaugerr/vertice-web`; o app Flutter e o Docery são
projetos separados. Produção: <https://use-vertice.vercel.app>.

- **Stack:** React 19, TypeScript, Vite 7, Tailwind CSS 4, React Router 7,
  Dexie/IndexedDB, Zod, big.js e lucide-react. Node 24 e npm; versões no lockfile.
- **Compras:** dados locais no navegador. Login não faz backup nem sincronização.
- **Acesso:** Google via Supabase, licença vitalícia liberada manualmente e
  autorização offline assinada de até sete dias após validação online.
- **Ainda não existem:** sincronização de compras na nuvem, checkout/webhook de
  venda, leitura de etiquetas/códigos de barras ou integração automática com planilha.

## Arquitetura e entrada

Fluxo: **tela → `useRepository()` → `ShoppingRepository` → repositório Dexie →
IndexedDB**. Regras puras ficam em `src/domain/services/`; componentes não escrevem
diretamente nas tabelas. Formulários guardam rascunhos, não uma segunda cópia global
dos registros. `useQuery` usa `useLiveQuery` para atualizar telas e outras abas.

| Responsabilidade                                   | Arquivos principais                                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Inicialização e estilos                            | `src/main.tsx`, `src/styles/globals.css`, `index.html`                                               |
| Rotas e proteção de acesso                         | `src/app/router.tsx`, `src/app/Root.tsx`                                                             |
| Cabeçalho, navegação, rodapé e saída com rascunhos | `src/app/App.tsx`                                                                                    |
| Injeção do repositório e escopo de conta           | `src/app/repository-context.ts`, `src/app/services.ts`                                               |
| Modelos, contrato e validação de entradas          | `src/domain/models/shopping.ts`, `src/domain/models/repository.ts`, `src/domain/schemas/shopping.ts` |
| Banco, versões e gravações em andamento            | `src/data/database/database.ts`, `src/data/database/writes.ts`                                       |
| Consultas, transações e operações de compras       | `src/data/repositories/dexie-shopping-repository.ts`                                                 |
| Consultas reativas, mutações e rascunhos           | `src/shared/hooks/useQuery.ts`, `src/shared/hooks/useMutation.ts`, `src/shared/lib/drafts.ts`        |

Rotas: `/` listas; `/lists/:listId` categorias/resumo;
`/lists/:listId/categories/:id` produtos; `/settings` dados/app; `/login` acesso;
`/auth/callback` retorno Google; `/admin` licenças; `/privacy` privacidade.

## Mapa das funcionalidades

Nos caminhos abaixo, `src/features/` contém as telas e componentes da funcionalidade.

| Funcionalidade                                              | Onde alterar                                                                                                                                             |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início, listas em andamento/finalizadas e chamada principal | `src/features/shopping-lists/pages/ListsPage.tsx`                                                                                                        |
| Criar, editar, copiar e excluir listas                      | `src/features/shopping-lists/components/ListForm.tsx`, `ListCard.tsx`, `ListActions.tsx`; operações no repositório Dexie                                 |
| Categorias e resumo da compra                               | `src/features/categories/pages/CategoriesPage.tsx`                                                                                                       |
| Itens, filtros e marcação como comprado                     | `src/features/items/pages/ItemsPage.tsx`, `src/features/items/components/ItemRow.tsx`                                                                    |
| Inclusão rápida, teclado e foco contínuo                    | `src/features/items/components/AddItemForm.tsx`                                                                                                          |
| Edição completa e preço rápido após marcar o checkbox       | `src/features/items/components/ItemForm.tsx`, `PurchaseForm.tsx`                                                                                         |
| Marca, embalagem e nome exibido                             | `src/features/items/components/ProductDetailsFields.tsx`, `src/features/items/hooks/useProductDetailsDraft.ts`, `src/domain/services/product-details.ts` |
| Sugestões compactas de compras anteriores                   | `src/features/items/hooks/useItemSuggestions.ts`, `src/domain/services/item-suggestions.ts`; apresentação no `AddItemForm.tsx`                           |
| Referência do último preço compatível                       | `src/features/items/hooks/usePriceReferences.ts`, `src/features/items/components/LastPriceReference.tsx`, `src/domain/services/price-history.ts`         |
| Orçamento da lista, saldo e alertas                         | `src/features/budget/components/`, `src/domain/services/budget.ts`                                                                                       |
| Finalizar/reabrir compra e revisão                          | `src/features/shopping-lists/components/CompletionDialog.tsx`, `ListActions.tsx`, `src/domain/services/completion.ts`                                    |
| Comparar preço por peso, volume ou unidade                  | `src/features/comparator/components/`, `src/features/comparator/session.ts`, `src/domain/services/comparison.ts`                                         |
| Decimais, totais e apresentação em reais                    | `src/domain/services/money.ts`                                                                                                                           |
| Exportar/importar backup e formato Flutter                  | `src/features/backup/components/BackupPanel.tsx`, `src/data/backup/backup.ts`                                                                            |
| Configurações e informações de armazenamento                | `src/features/settings/pages/SettingsPage.tsx`                                                                                                           |
| Instalação, avisos offline e atualização                    | `src/pwa/registration.ts`, `src/pwa/connectivity.ts`, `src/pwa/components/`                                                                              |
| Logo reutilizável e identidade visual                       | `src/shared/ui/Brand.tsx`, `src/styles/globals.css`, `public/icons/`                                                                                     |
| Diálogos, botões, erros e estados vazios comuns             | `src/shared/ui/Dialog.tsx`, `Button.tsx`, `Feedback.tsx`, `RouteError.tsx`                                                                               |

Os controles de voltar usam `src/shared/ui/BackLink.tsx`.

Arquivos citados apenas pelo nome na mesma linha pertencem ao último diretório
explícito daquela linha. Testes de regras/componentes ficam próximos ao código em
`*.test.ts`/`*.test.tsx`; fluxos de navegador ficam em `e2e/`.

## Regras que precisam ser preservadas

- **Dinheiro:** preço e quantidade são strings decimais canônicas; calcular com
  big.js, arredondar cada item para centavos e somar só os comprados. Não substituir
  por multiplicação de `number`/ponto flutuante. Orçamento é inteiro em centavos.
- **Datas:** compra usa `YYYY-MM-DD` civil, sem conversão UTC na apresentação;
  timestamps de criação/alteração são ISO UTC. Utilitário: `src/shared/lib/date.ts`.
- **Embalagem ≠ quantidade:** três pacotes de 500 g são quantidade 3 e conteúdo
  500 g; o conteúdo não multiplica o valor cobrado. Nome base, marca e embalagem
  ficam separados; o nome exibido é derivado.
- **Rapidez:** adicionar vários produtos mantém o teclado/foco. Marcar como comprado
  abre os valores com o preço selecionado. Detalhes opcionais não podem atrapalhar.
- **Finalização:** exige ao menos um comprado, preços positivos e revisão atual.
  Compra finalizada é somente leitura até reabrir, inclusive no repositório.
  Cópia é independente, preserva quantidades/detalhes, zera preços e desmarca itens.
- **Histórico:** vem de itens comprados de outras listas finalizadas; não há tabela
  separada de preços. Correspondência por nome, marca, embalagem equivalente e
  unidade de cobrança; sem aproximação de nomes. Reabrir/excluir retira a referência.
- **Sugestões:** após dois caracteres, até três linhas pequenas; consideram compras
  finalizadas e evitam variantes já presentes na lista. Copiam detalhes, com
  quantidade 1/preço zero/desmarcado; não substituem o texto livre nem puxam preços.
- **Comparador:** independente das compras; rascunho no sessionStorage, cálculos
  decimais, não altera itens/orçamento nem integra o backup.
- **Orçamento:** gasto global da lista, independente de filtros/categorias; aviso
  a partir de 80%, sem bloquear a compra.

## Persistência, conta e segurança

- Dexie está na **versão 5**: `lists`, `categories`, `items` e recibos `migrations`.
  Migrações futuras incrementam a versão e preservam registros; não apagar/recriar
  banco, alterar nomes ou limpar armazenamento para resolver mudanças de interface.
- Modo local `legacy`: banco `vertice_web`. Modo protegido: banco
  `vertice_web_<projeto>_<uid>`, via `src/access/account-repository.ts`.
  A transferência confirmada do legado fica em `src/access/legacy-migration.ts`;
  mantém o original e um diário separado `vertice_account_migrations`.
- Exclusões em cascata, cópia, finalização e restauração devem continuar
  transacionais, com validação de relações e proteção contra alterações entre abas.
- Backup **v5**, aceita v1–v5; até 10 MiB e 50 mil registros por coleção.
  Restaurar substitui os dados da conta após confirmação; não faz mesclagem.
  Nunca incluir sessões, credenciais ou autorizações de acesso no backup.
- Trocar domínio/navegador/aparelho não transporta compras. Limpar dados do site
  pode apagá-las. Não prometer armazenamento em nuvem ou persistência garantida.

| Parte do acesso                                     | Arquivos                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Configuração pública, OAuth e chamadas às funções   | `src/access/config.ts`, `client.ts`, `CallbackPage.tsx`                                                                        |
| Estado da sessão/licença e autorização offline      | `src/access/controller.ts`, `lease.ts`, `use-access.ts`, `license-public-key.json`                                             |
| Bloqueio de telas e preservação de edição           | `src/access/AccessBoundary.tsx`, `AccessScreen.tsx`                                                                            |
| Login, conta, administração e privacidade           | `src/access/LoginPage.tsx`, `AccountPanel.tsx`, `AdminPage.tsx`, `PrivacyPage.tsx`                                             |
| Verificação e administração no servidor             | `supabase/functions/license-check/index.ts`, `supabase/functions/license-admin/index.ts`, `supabase/functions/_shared/http.ts` |
| Tabelas, permissões, administrador inicial e testes | `supabase/migrations/`, `supabase/bootstrap-admin.sql`, `supabase/tests/access.sql`                                            |

O administrador é autorizado pelo servidor; esconder um botão não é autorização.
Não usar email fixo/`user_metadata` do cliente para conceder privilégios nem promover
automaticamente o primeiro usuário. Preservar separação de contas e validação da
assinatura, identidade e validade da autorização offline. Revogação é conhecida na
próxima validação online; não prometer revogação instantânea sem internet.

Somente URL/chave pública e chave pública de assinatura entram no frontend.
`service_role`, segredo Google e chave privada ficam fora do Git/cliente, no servidor.
Não gerar nem rotacionar chaves ao fazer alterações visuais ou de documentação.

## Marca, PWA e publicação

- Interface em português, tema escuro e poucos textos. Marca: **vértice branco**,
  ponto verde, símbolo roxo com V/carrinho. Chamada do início:
  **“Onde suas compras encontram o equilíbrio.”** Preferir SVG leve a banner raster.
- `vite.config.ts`: manifesto, cache Workbox e build; `public/icons/`: SVG e PNGs
  192/512/maskable. Manter as versões coerentes e a área segura do ícone maskable.
- Service worker só em produção; primeiro acesso/preparo exige internet. Com acesso
  protegido, também exige login/licença e renovação da autorização em até sete dias.
  Atualização pede ação do usuário, protege rascunhos e aguarda gravações pendentes.
- `public/online.txt` verifica conectividade real, sem cache. `vercel.json` mantém
  SPA, assets ausentes com 404 e `/sw.js` com `no-store`. Cache não é backup.
- Vercel publica a `main` pelo GitHub. `tools/build-vercel.mjs` impõe acesso protegido
  em produção e no preview `feat/google-access`; o build local padrão é `legacy`.
  Não mudar origem, modo de acesso ou configuração OAuth para uma tarefa visual.

## Comandos e validação

```sh
nvm use
npm ci
npm run dev        # Desenvolvimento; sem service worker
npm run typecheck
npm run lint       # ESLint + Prettier
npm test           # Vitest
npm run build     # TypeScript, PWA e limite de JS: 250 KiB gzip
npm run preview   # Conferir o build/PWA
```

Para fluxos de navegador: `npx playwright install --with-deps chromium webkit`,
depois `npm run build` e `npm run test:e2e`. O servidor `tools/serve-test.mjs`
é só de testes. Configurações: `playwright.config.ts`, `playwright.access.config.ts`
e `playwright.hosted.config.ts`; suites `e2e/`, `e2e-access/` e `e2e-hosted/`.
CI em `.github/workflows/`: `checks.yml` valida o app; `access.yml` testa acesso com
Supabase isolado; `hosted.yml` verifica a hospedagem. Runners fixados em Ubuntu 24.04
por compatibilidade com o Playwright instalado. Nunca apontar fixtures de teste para
o Supabase de produção. WebKit no CI não comprova instalação em iPhone físico.

Para mudanças pequenas, validar só o necessário; não criar testes que apenas
espelham texto/estilo. Para dados, dinheiro, acesso ou offline, executar os cenários
relevantes e preservar cobertura. Conferir telas estreitas, foco e ausência de
rolagem horizontal ao alterar layout. Não atualizar dependências ou publicar fora
do escopo solicitado. Manter este mapa atualizado quando mover ou criar funções.

Detalhes: `README.md`, `docs/access/SETUP.md`, `docs/access/GOOGLE.md`,
`docs/access/VALIDATION.md`, `docs/VALIDATION.md`, `docs/FUTURE-SYNC.md` e
`docs/FLUTTER-TO-WEB.md`. Alguns documentos têm registros históricos; conferir o
código e o estado atual antes de tratar uma descrição antiga como implementação.
