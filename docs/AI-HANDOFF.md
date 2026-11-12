# Vértice — handoff para humanos e agentes

**Atualizado em 12/11/2026 (America/Sao_Paulo).** Este documento é um retrato do repositório e do estado registrado no GitHub nesta data. Não substitui a conferência dos serviços antes de qualquer operação.

## 1. Resumo executivo

O Vértice está em duas etapas distintas:

- **Produto oficial (main):** app de compras React/TypeScript, dados locais IndexedDB/Dexie, login Google e licenciamento; inclui uma central de acesso a modelos financeiros Google Sheets/Excel. O login não sincroniza as compras.
- **Ecossistema (preview/controle-financeiro):** Compras + Financeiro, espaços pessoais e compartilhados, Supabase, fila offline, sincronização, conflitos e backups. Está em desenvolvimento e revisão no PR #28, ainda draft. Não está integrado ao app oficial.

O PR #29 foi integrado à branch preview. A descrição atual do PR #28 registra a migração financeira mais recente, validações e publicação exclusiva na preview. Não fazer merge em main sem autorização explícita.

## 2. Links e ambientes

- Repositório: https://github.com/gaugerr/vertice-web
- PR #28: https://github.com/gaugerr/vertice-web/pull/28
- Branch de desenvolvimento: preview/controle-financeiro
- App oficial: https://app.usevertice.app.br
- Página de vendas: https://usevertice.app.br
- Preview: https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev/
- Homologação conectada: https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev/staging/
- Ações: https://github.com/gaugerr/vertice-web/actions

A raiz da preview usa demonstração fictícia local. /staging/ usa Google e Supabase Vértice e pode conter dados reais. Nunca confundir os dois endereços.

## 3. Arquitetura

### Aplicativo oficial

- React 19, TypeScript, Vite, Tailwind CSS 4.
- src/domain: modelos, schemas Zod e regras de compras.
- src/data: Dexie/IndexedDB, repositórios, transações e backup.
- src/features: listas, itens, categorias, orçamento, comparador, histórico e detalhes de produto.
- src/access: Supabase Auth/Google, licenças assinadas, administração e migração local por conta.
- src/pwa: service worker, instalação, conectividade e atualização.

As telas usam ShoppingRepository; o repositório Dexie concentra persistência e transações. Compras ficam locais no main. O Financeiro em main é a central de planilhas, não o ledger financeiro nativo da preview.

### Ecossistema em preview

- previews/controle-financeiro: shell e interface financeira DOM/JavaScript; integra Compras reutilizando o código React via shopping.tsx.
- finance-domain.mjs e finance-ledger.mjs: regras financeiras puras e cálculos.
- finance-store.mjs e finance-backup.mjs: estado local, persistência e backup financeiro.
- shared/workspaces: IndexedDB por projeto/usuário/espaço, transações, outbox, sincronização, conflitos, mapeamento e transporte.
- supabase/functions/workspaces: endpoint autenticado de operações por workspace.
- supabase/migrations: schema remoto e políticas RLS.

A sincronização não deve duplicar regras de domínio. O financeiro usa centavos inteiros; compras preservam preços/quantidades decimais exatos.

## 4. Ecossistema: comportamento e contratos

### Espaços e convites

- Espaço pessoal e espaço compartilhado do casal.
- Um espaço compartilhado ativo por pessoa; no máximo duas pessoas.
- Cada pessoa usa seu próprio Google verificado.
- Titular com licença ativa convida o parceiro; convite vinculado à identidade verificada, token armazenado como hash, uso único e validade de sete dias.
- O convidado não recebe licença própria. Convite não concede licença.
- Meu espaço e Nossa casa são separados. A cópia de dados entre espaços é explícita; não presumir transferência automática.

### Sincronização e offline

- Escritas locais e operações da outbox são persistidas atomicamente.
- Operações têm IDs, versões esperadas e recibos idempotentes; o servidor mantém journal e revisão por espaço.
- Alterações concorrentes em registros diferentes são preservadas. Conflitos no mesmo registro exigem revisão e preservam a versão local para recuperação.
- Remoção de participante bloqueia novas operações; fila de geração anterior fica em quarentena.
- Autorização offline registrada no handoff: até 24 horas no espaço compartilhado e até sete dias no pessoal. Confirmar implementação atual antes de alterar.
- Não prometer sincronização com app fechado. Reabertura, foco e reconexão recuperam pendências.
- Dados exportados ou baixados não podem ser revogados remotamente.

### Financeiro

Recursos documentados na preview: lançamentos, categorias e formas de pagamento, orçamento mensal total e por categoria, contas fixas, metas/aportes, contas manuais, transferências, cartões/faturas, parcelas e recorrências.

Regras importantes:

- Dinheiro em centavos inteiros; parcelas distribuem centavos sem perda.
- Saldo inicial de conta não é receita; transferência não é receita nem despesa.
- Pagamento de fatura baixa compras vinculadas e não cria uma segunda despesa.
- Competência da fatura segue vencimento; data real do pagamento é separada.
- Edição de ocorrência não reescreve toda a série; encerrar série preserva pagamentos já feitos.
- Metas não criam movimentações bancárias automaticamente.
- Não há Open Finance, importação bancária, conciliação automática, cálculo de rotativo ou juros.

## 5. Banco, migrações e segurança

Projeto Supabase autorizado: Vértice, ref wqutcsjdozcukwxvkbtc, região us-east-1. Não tocar no projeto Docery.

Migrações registradas no handoff:

- 20261109173641_shared_shopping_finance_workspaces
- 20261109180048_workspace_preview_signing
- 20261111225724_finance_accounts_cards_series

A migração 20261111225724 foi aplicada na homologação conforme registro do PR #28 e não deve ser reaplicada. Antes de qualquer alteração, consultar o histórico real do Supabase e os arquivos em supabase/migrations.

Regras:

- RLS limita leitura aos participantes autorizados.
- Escritas passam pela Edge Function workspaces e pelo comando privilegiado workspace_command.
- O serviço deriva o ator da sessão validada; não aceitar UID do cliente.
- Chave ES256 privada fica no Vault; somente chave pública pode estar no frontend.
- Auth, public.licenses, schemas privados de acesso/Cakto, webhooks e cron existentes devem ser preservados.
- Nunca expor service_role, segredos, JWK privada, tokens ou dados de usuários.
- Arquivos em supabase/drafts são rascunhos/histórico; não aplicar em produção por inferência.

## 6. Build e validação

Raiz:

- Node 24 LTS e npm.
- npm ci
- npm run typecheck
- npm run lint
- npm test
- npm run build

Preview financeira:

- Build específico: executar node build.mjs em previews/controle-financeiro.
- Testes financeiros/rotas: finance-domain.test.mjs, finance-improvements.test.mjs, finance-ledger.test.mjs e demais arquivos \*.test.mjs da pasta.
- Testes de workspace/PostgreSQL: shared/workspaces/vitest.config.mjs, ledger-postgres.test.mjs e tools/test-workspaces-db.mjs conforme ambiente isolado.
- E2E e verificações de navegador estão em e2e/, e2e-hosted/ e shared/workspaces/\*browser-check.mjs.

A descrição do PR #28 registra, em revisões recentes, build, ESLint, Playwright, 44 testes financeiros/rotas e 28 testes de persistência/sincronização aprovados. Ela também registra que duas suítes PostgreSQL opcionais não foram executadas na última revisão visual. Consulte o run mais recente antes de declarar CI verde. Teste sintético não substitui piloto com duas contas reais e dois dispositivos.

## 7. Próximas etapas e critérios para integração

1. Retomar o desenvolvimento a partir do head atual de preview/controle-financeiro; verificar commits e PR #28 antes de editar.
2. Concluir os fluxos pendentes e manter docs/AI-HANDOFF.md atualizado.
3. Homologar com duas contas Google e dois dispositivos: convite, isolamento, troca de espaço, edição concorrente, offline/online, remoção/reentrada, backups e restauração.
4. Testar falhas de rede, resposta perdida, duplicidade, conflito, migração e atualização de cliente antigo.
5. Revisar acessibilidade, PWA, rotas e integração com o shell oficial.
6. Fazer plano de rollout/rollback e só então propor integração ao main.

**Não fazer merge nem deploy oficial sem autorização explícita do proprietário.**

## 8. Mapa da documentação

Veja docs/README.md para a lista por assunto. Comece por este handoff e AGENTS.md; use os documentos detalhados como contratos técnicos, não como prova de estado atual.
