# Vértice: instruções para o Claude

PWA de listas de compras: React 19, TypeScript, Vite 7, Tailwind 4, React Router 7, Dexie 5 (IndexedDB), Zod, big.js, lucide-react. Acesso protegido via Supabase (Google OAuth, licenças, webhook Cakto). Hospedagem: Cloudflare Pages. Interface em português.

Guia completo: `AGENTS.md` (mapa de funcionalidades, regras, estado operacional). Operações de Supabase/Cakto: `docs/OPERACOES.md`. Consulte a seção necessária com `rg`; não copie esses documentos para o contexto.

## Comandos

Node 24 (`.nvmrc`). Instalar com `npm ci`.

- `npm run dev`: servidor de desenvolvimento (sem service worker).
- `npm run typecheck`: `tsc -b`.
- `npm test`: Vitest. Arquivo único: `npx vitest run <caminho>`.
- `npm run lint`: ESLint (`--max-warnings 0`) + Prettier `--check`.
- `npm run build`: tsc + Vite + PWA + limite de 250 KiB gzip de JS (`tools/check-size.mjs`).
- `npm run preview`: conferir build e PWA.
- `npm run test:e2e`: Playwright. Rode `npm run build` antes. Suites: `e2e/`, `e2e-access/`, `e2e-hosted/`.
- `npm run typecheck:cakto` e `npm run test:cakto`: funções Cakto.

Valide primeiro o teste mais próximo da mudança e depois o `typecheck`. Para dados, dinheiro, acesso ou offline, rode os cenários relevantes antes de encerrar.

## Arquitetura

Fluxo obrigatório: tela → `useRepository()` → `ShoppingRepository` (`src/domain/models/repository.ts`) → `src/data/repositories/dexie-shopping-repository.ts` → Dexie (`src/data/database/database.ts`) → IndexedDB.

- Componentes não gravam nem leem tabelas Dexie diretamente.
- Regras puras ficam em `src/domain/services/`, sem React nem Dexie.
- Leitura reativa com `useQuery` (`useLiveQuery`); escrita com `useMutation`.
- Rascunhos de formulário (`src/shared/lib/drafts.ts`) não são cópias globais dos registros.
- Telas: `src/features/<área>/`. Compartilhado: `src/shared/`. Acesso: `src/access/`. Servidor: `supabase/`.

## Offline-first e dados locais

- Compras ficam no IndexedDB do aparelho. Login não faz backup nem sincronização. Não mover compras para o Supabase.
- Dexie está na versão 5 (`lists`, `categories`, `items`, `migrations`). Mudança de schema: nova `this.version(n)` preservando dados. Nunca apagar ou recriar o banco, renomear tabelas ou limpar armazenamento para corrigir a interface.
- Dois bancos: `vertice_web` (modo `legacy`) e `vertice_web_<projeto>_<uid>` (modo protegido, `src/access/account-repository.ts`). Não misturar.
- Cascatas de exclusão, cópia, finalização e restauração são transacionais, com validação de relações e proteção entre abas.
- Operação de compra não pode depender de rede. Autorização offline vale até 7 dias (`src/access/lease.ts`).
- Service worker só existe em produção. Atualização pede ação do usuário e não pode descartar rascunhos.
- Backup v5: aceita v1–v5, até 10 MiB e 50 mil registros por coleção. Nunca incluir sessões, credenciais ou autorizações.

## Regras de domínio

- Dinheiro: preço e quantidade são strings decimais canônicas; cálculo com big.js; arredondar cada item em centavos; somar só itens comprados. Sem `number` ou ponto flutuante. Orçamento em centavos inteiros.
- Datas de compra: `YYYY-MM-DD` civil (`src/shared/lib/date.ts`). Timestamps de criação e alteração: ISO UTC.
- Embalagem não multiplica o valor: três pacotes de 500 g são quantidade 3, conteúdo 500 g. Nome base, marca e embalagem ficam separados; o nome exibido é derivado.
- Compra finalizada é somente leitura até reabrir, inclusive no repositório. Finalizar exige ao menos um item comprado, preços positivos e revisão atual.
- Histórico de preços: derivado de itens comprados em listas finalizadas, sem tabela própria. Correspondência exata; sem aproximação de nomes.
- Comparador e orçamento não alteram itens. O comparador não entra no backup.

## Supabase

- Frontend recebe apenas URL, chave publicável e chave pública de assinatura. `service_role`, segredo Google, chave privada e segredos Cakto ficam no servidor ou no Vault.
- Nunca conceder privilégio por e-mail fixo, `user_metadata` ou primeiro login. Administradores vêm de `access_private.admins`, e a autorização é verificada no servidor.
- Schemas privados não são APIs do navegador.
- Projeto correto: `vertice`, ref `wqutcsjdozcukwxvkbtc`. Não usar o projeto Docery. Testes nunca apontam para produção; testes de acesso usam Supabase isolado (`supabase/tests/`).
- Não executar `supabase/cakto-retry-job.sql` como diagnóstico: ele pausa jobs. Não habilitar, pausar ou recriar jobs ou flags sem pedido explícito.
- Não registrar corpos de webhook Cakto: contêm o segredo da integração.
- Antes de mexer em Supabase, confira `docs/OPERACOES.md` e `docs/access/CAKTO.md`.

## Cloudflare e publicação

- Hospedagem exclusivamente Cloudflare Pages: projeto `use-vertice` é o app; `vertice-kit` é a página de vendas (`marketing/`). Não recriar integração com Vercel; `vercel.json` bloqueia deploys Git.
- Build Pages: `tools/build-cloudflare.mjs`, saída `dist`, Node 24. Rotas e cache: `public/_redirects` e `public/_headers`.
- Nunca fazer deploy, nem alterar configuração de projeto Pages, sem permissão explícita. Não usar deploy para testar conexão. Preview não é produção.

## Página de vendas (`marketing/`)

- Build próprio: `node build.mjs`. Considerada finalizada: altere apenas o escopo pedido e preserve as demonstrações interativas e as galerias.
- Não reintroduzir lote de 100 vagas, contador, preço riscado ou prazo. Checkout pelos links `data-checkout-link` (fallback no HTML) e `site-config.js`.
- Capturas em `marketing/media/`. Arquivos pagos do kit não são publicados.

## Economia de contexto

- Localize com `rg` antes de abrir arquivos: `rg -n "simbolo" src`. Leia trechos com `offset` e `limit`.
- Use o mapa de funcionalidades do `AGENTS.md` para achar o arquivo certo.
- Não leia `package-lock.json`, `artes/` nem `marketing/media/`, nem `docs/` inteiro. Alguns documentos são históricos: confirme no código.
- Não adicionar dependências nem atualizar pacotes fora do escopo.

## Convenções

- Textos de interface em português, com acentuação correta, curtos e tema escuro no app.
- Testes ficam ao lado do código (`*.test.ts`/`*.test.tsx`). Não criar testes que apenas espelham texto ou estilo.
- Mudança de layout: conferir telas de 280 a 844 px, foco e ausência de rolagem horizontal (`e2e/responsive.spec.ts`).
- Antes de editar: `git status --short` e branch a partir da `main`. Não resetar nem sobrescrever alterações locais existentes ou cópias antigas do workspace.
- Revisar `git diff` antes de encerrar; informar arquivos alterados e testes executados.
