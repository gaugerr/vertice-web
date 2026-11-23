# Vértice — handoff para humanos e agentes

**Atualizado em 23/11/2026 (America/Sao_Paulo).** Este documento é um retrato do repositório e do estado registrado no GitHub nesta data. Não substitui a conferência dos serviços antes de qualquer operação.

## 1. Resumo executivo

O Vértice está em duas etapas distintas:

- **Produto oficial (main):** app de compras React/TypeScript, dados locais IndexedDB/Dexie, login Google e licenciamento; inclui uma central de acesso a modelos financeiros Google Sheets/Excel. O login não sincroniza as compras.
- **Ecossistema (preview/controle-financeiro):** Compras + Financeiro, espaços pessoais e compartilhados, Supabase, fila offline, sincronização, conflitos e backups. Está em desenvolvimento e revisão no PR #28, ainda draft. Não está integrado ao app oficial.

O PR #29 foi fechado como merged em 11/11/2026 somente na branch `preview/controle-financeiro`. O PR #28 continua aberto e draft contra `main`; o ecossistema não está integrado ao app oficial. Não fazer merge em `main` sem autorização explícita.

## 2. Links e ambientes

- Repositório: https://github.com/gaugerr/vertice-web
- PR #28: https://github.com/gaugerr/vertice-web/pull/28
- Branch de desenvolvimento: preview/controle-financeiro
- App oficial: https://app.usevertice.app.br
- Página de vendas: https://usevertice.app.br
- Preview: https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev/
- Homologação conectada: https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev/staging/
- Ações: https://github.com/gaugerr/vertice-web/actions

A raiz da preview usa demonstração fictícia local. `/staging/` usa Google e Supabase Vértice e pode conter dados reais. Nunca confundir os dois endereços.

### Estado do GitHub verificado em 23/11/2026

| Referência                    | Estado verificado                                                                                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`                        | Branch padrão; head `8e16a5a` (05/11/2026).                                                                                                                                                                |
| `preview/controle-financeiro` | Head `0b9213e` (13/11/2026), 41 commits à frente de `main` e nenhum atrás; head do PR #28.                                                                                                                 |
| PR #27                        | Aberto, draft, base `main`; registra a migração inicial `20261109173641`, já presente no ecossistema e registrada como aplicada ao projeto Vértice.                                                        |
| PR #28                        | Aberto, draft, base `main`, head `preview/controle-financeiro`; 41 commits e 96 arquivos. Não integrado ao app oficial.                                                                                    |
| PR #29                        | Fechado como merged em 11/11/2026 para `preview/controle-financeiro`; não foi integrado a `main`. Registra o ledger v2, a migração `20261111225724` e a atualização da Edge Function `workspaces` para v2. |
| PR #30                        | Aberto, draft, base `preview/controle-financeiro`, head `docs/ecosystem-handoff`; documentação apenas, mergeable na consulta de 23/11.                                                                            |
| PR #31                        | Fechado sem merge; a alteração proposta não foi integrada por esse PR.                                                                                                                                     |

Heads verificadas em 23/11: `main` continua em `8e16a5a` (05/11) e `preview/controle-financeiro` em `0b9213e` (13/11), 41 commits à frente de `main`. Não há checks nem workflow runs associados a essas heads exatas. O commit atual da preview foi criado com `[skip ci]`.

O último conjunto de checks disparado por pull request para a preview foi em 13/11, no commit `edf14e3`: [Access integration](https://github.com/gaugerr/vertice-web/actions/runs/43334289213) e [Workspace database regression](https://github.com/gaugerr/vertice-web/actions/runs/43334289121) passaram; [Web checks](https://github.com/gaugerr/vertice-web/actions/runs/43334289183) falhou em `npm run lint`, no `prettier --check`, por formatação de `previews/controle-financeiro/ui.css`. `typecheck` e `typecheck:cakto` passaram antes da falha; testes, build e E2E foram ignorados após o lint falhar. O [Web checks` de push](https://github.com/gaugerr/vertice-web/actions/runs/43334283006) no mesmo commit passou, mas não substitui o resultado do evento de PR. Na `main`, os últimos checks encontrados são de 04/11 no commit `a5a0e4c` e passaram; não há execução associada à head atual `8e16a5a`. Portanto, não há CI verde atual comprovada para a head da preview ou o resultado de merge do PR #28.

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

O PR #29 registra que `20261111225724_finance_accounts_cards_series` foi aplicada ao projeto Supabase Vértice existente, com RLS e acesso ao comando verificados, e que somente a Edge Function `workspaces` foi atualizada para v2. O PR #28 registra a versão hospedada alinhada. A consulta remota do histórico de migrações não foi feita nesta revisão; trate isso como registro do GitHub e não reaplique a migração. Antes de qualquer alteração, consultar o histórico real do Supabase e os arquivos em supabase/migrations.

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

A descrição atualizada do PR #28 (13/11) registra 44 testes financeiros/rotas e 28 testes de persistência/sincronização aprovados, build, ESLint, Prettier, diff e Playwright nas dez telas em 280/390/1440 px. Também registra duas suítes PostgreSQL opcionais não executadas naquela revisão visual e deixa teclado físico e sessão Google real para revisão do titular. São registros da PR, não uma leitura de CI ao vivo. A situação de Actions consultada em 23/11 está descrita na seção 2; a head atual da preview não tem execução associada e não há CI verde atual comprovada. Testes sintéticos não substituem piloto com duas contas reais e dois dispositivos.

## 7. Próximas etapas e critérios para integração

1. Resolver a falha de formatação registrada em `previews/controle-financeiro/ui.css` e obter novos checks disparados pelo PR #28 para a head atual; não usar o check de push como substituto.
2. Retomar o desenvolvimento a partir do head atual de preview/controle-financeiro; verificar commits e PR #28 antes de editar.
2. Concluir os fluxos pendentes e manter docs/AI-HANDOFF.md atualizado.
3. Homologar com duas contas Google e dois dispositivos: convite, isolamento, troca de espaço, edição concorrente, offline/online, remoção/reentrada, backups e restauração.
4. Testar falhas de rede, resposta perdida, duplicidade, conflito, migração e atualização de cliente antigo.
5. Revisar acessibilidade, PWA, rotas e integração com o shell oficial.
6. Fazer plano de rollout/rollback e só então propor integração ao main.

**Não fazer merge nem deploy oficial sem autorização explícita do proprietário.**

## 8. Mapa da documentação

Veja docs/README.md para a lista por assunto. Comece por este handoff e AGENTS.md; use os documentos detalhados como contratos técnicos, não como prova de estado atual.
