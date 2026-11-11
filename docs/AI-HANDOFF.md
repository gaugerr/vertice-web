# Retomada do Vértice por outro modelo

Atualizado em 09/11/2026 (America/Sao_Paulo). Registro de estado observado, não
substitui consultas atuais aos serviços. Começar por este arquivo e AGENTS.md.

## Interface para o usuário — 11/11/2026

A interface da branch `preview/controle-financeiro` não mostra mais badges, avisos,
títulos ou ferramentas de preview/demonstração. Foram removidos os botões e o
handler de restauração de exemplos, troca de perfis fictícios, simulação offline
e licença, além do link para demonstração na entrada Google. Primeiro acesso sem
registros usa `emptyState()`, nunca `initialState()` com exemplos. Registros já
armazenados e fontes legadas são preservados; não limpar armazenamento para
atualizar a interface. Categorias e formas padrão continuam disponíveis.

Backups reais, cópia anterior à restauração, recuperação de pendências e formato
existente de backup continuam compatíveis. Mensagens de salvamento orientam a
acompanhar a sincronização, sem prometer confirmação remota imediata. A origem,
o caminho `/staging/`, os identificadores de armazenamento e as restrições técnicas
de conexão permanecem. O servidor local de demonstração continua apenas como
infraestrutura isolada de teste; não foi conectado ao banco real.

Validação: 29 testes financeiros, 28 de sincronização, ESLint, build; navegador
com conta vazia/com dados, pagamento/desfazer/reconfirmar, backup/importação/cópia
anterior, compras, configurações e larguras 280–1440. Fluxos de casal, offline,
reconexão, isolamento/remoção e cache autorizado também conferidos com identidades
sintéticas. Scripts `shared/workspaces/user-interface-browser-check.mjs`,
`browser-check.mjs` e `cache-browser-check.mjs`. Não usa conta Google real nem
altera pagamentos de clientes. O piloto real do casal continua pendente.

A correção anterior de pagamento está no commit `174079f`: comandos que reativam
IDs excluídos enviam `deleted_at: null`, evitando que pagamentos reconfirmados
voltem a pendentes. Regressão PostgreSQL desse commit aprovada na CI.

## Produto e ambientes

- Repositório: `gaugerr/vertice-web`. `main` continua com o app oficial de compras
  e acesso às planilhas. Não contém automaticamente a interface financeira nova.
- App oficial: https://app.usevertice.app.br — Pages `use-vertice`.
- Vendas: https://usevertice.app.br — Pages `vertice-kit`. Preservar a página.
- Preview: https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev/.
  A raiz é demonstração fictícia local. Dados diferentes nessa raiz são esperados.
- Entrada real: o mesmo endereço com `/staging/`. Google, banco e dados reais da
  conta. Usar sempre esse caminho nos testes de sincronização.
- Branch de trabalho: `preview/controle-financeiro`. PR #28 é rascunho unificado;
  PR #27 registra a base do banco e está contido no trabalho da preview. Não fazer
  merges de ambos sem revisar sobreposição. Nenhum merge oficial foi autorizado.
- Pages da preview: `vertice-financeiro-preview`, raiz `previews/controle-financeiro`,
  build `node build.mjs`, saída `dist`; produção desabilitada e branch autorizada
  explicitamente. Conta Cloudflare `ab0452392516e43ea097317ea48c57d5`.

## Decisões do produto

Manter facilidade de uso; não adicionar cartões/faturas/parcelamentos nesta fase.
Menu de áreas troca Compras/Financeiro; abas inferiores pertencem ao Financeiro.
Categorias e formas de pagamento editáveis, contas fixas versionadas, pagamentos
parciais/correções, orçamento mensal, metas/aportes, resumo e backups já existem
na preview. Resumo usa os mesmos cálculos canônicos dos lançamentos.

Casal: Google próprio para cada pessoa, um titular e um convidado; uma licença do
titular cobre o convidado. Um casal ativo por conta, no máximo duas pessoas.
Convite vinculado ao e-mail verificado, hash no banco, uso único e validade de sete
dias. Remover/reentrar muda a geração e impede replay da fila antiga. Meu espaço
é privado; Nossa casa é compartilhado. Os registros pessoais não aparecem no casal
sem cópia explícita atualmente. O usuário aprovou automatizar essa transferência
com confirmação de compartilhamento, mas essa evolução ainda NÃO foi implementada.

## Banco e acesso

Supabase Vértice: `wqutcsjdozcukwxvkbtc`, região us-east-1. Docery
`vapycmnoepasbnszcatz` é outro app: não tocar. Nenhuma branch/projeto pago foi criado.
Migrações JÁ aplicadas: `20261109173641_shared_shopping_finance_workspaces` e
`20261109180048_workspace_preview_signing`. Não reaplicar rascunhos em
`supabase/drafts`, não resetar o banco e não empurrar migrações antigas em lote.

Novas tabelas públicas `shopping_*`, `finance_*`, `user_import_batches` e
`workspace_heads`; participação/convites/journal/recibos em `workspace_private`.
RLS limita leitura; escrita somente pelo serviço via `workspace_command`. As views
financeiras usam security_invoker. O endpoint `workspaces` verifica sessão Google
no servidor e só aceita a origem exata da preview. A chave ES256 exclusiva está
criptografada no Vault, nome `vertice-workspace-signing-v1`; leitura restrita ao
serviço por wrapper RPC e helper privado. Nunca imprimir ou versionar seu valor.
Chave pública e publishable key no frontend são públicas por definição.

O callback `/staging/` precisou ser adicionado aos Redirect URLs do Supabase. O
usuário confirmou que Google agora retorna corretamente à preview. Não mudar Site
URL, substituir callbacks existentes ou rotacionar a chave do acesso oficial.

## Cakto: contrato a preservar

`public.licenses`, `access_private`, `cakto_private`, Auth e funções existentes não
foram substituídos. Webhook `cakto-webhook` v6, `license-check`/`license-admin` v17
na última conferência; redescobrir versões antes de alterar. Captura e processamento
usam `cakto_capture_events` e `cakto_process_pending`; cron de processamento ativo
a cada cinco minutos e limpeza diária. Não reexecutar `cakto-retry-job.sql`: ele
pode pausar jobs. Não enviar pagamentos/reembolsos fictícios assinados em produção.
Licença revogada bloqueia novas gravações e preserva consulta autorizada. Convites
não criam licença. Fingerprints de estrutura/permissões e licenças foram comparados
antes/depois; integração existente permaneceu preservada. Detalhes em OPERACOES.md.

## Cache e sincronização

`shared/workspaces`: core local/transações/outbox, mapping dos modelos, transporte
HTTP, lease assinado, ambiente real e demonstração. O financeiro usa
WorkspaceFinanceStore; compras reutilizam telas e repositório Dexie do app.
Bancos locais separados por projeto/usuário/espaço, com fila gravada atomicamente.
Versões, recibos UUID e guardas do registro-pai protegem pagamentos concorrentes;
relógio do cliente não resolve conflitos. Nunca apagar fila em erro de rede.

A melhoria de abertura já está implementada no código: cache completo autorizado
primeiro, revalidação ao fundo, limite de dez segundos por requisição e estados
verdadeiros de atualização. Marcadores `snapshot-ready`, `last-synced` e
`auth-required` usam o workspaceMeta existente, sem migração do servidor.
Autorização offline: até sete dias no pessoal, 24h no casal, assinatura/UID/origem/
geração/relógio conferidos antes da leitura. Sessão encerrada ou remoção conhecida
bloqueia o conteúdo, preservando recuperação. Formulários abertos não são substituídos.

## Estado da publicação e evidências

Commits: `cdf30c0` conexão real; `e627f4f` cache; `099840e` corrige prontidão do
PostgreSQL na CI (aguardar servidor TCP final, não socket temporário). Confirmar HEAD
remoto; bot de formatação pode criar commits. A pendência de alias foi resolvida:
em 09/11/2026 23:37 UTC, o endereço fixo respondeu com o bundle de 568.369 bytes,
contendo `snapshot-ready` e `account-shopping-v1:`. Commit `5ab6440` adiciona a
importação automática de Compras vinculadas à conta. O build local e 27 testes
passaram; o teste PostgreSQL foi omitido nesta execução (nenhuma mudança SQL).
CI desse commit: regressão do banco aprovada, Web/Access em execução na consulta.

Usuário confirmou persistência no mesmo Google em aba anônima ao usar `/staging/`.
Antes usava a raiz demonstrativa, causando aparente divergência. O casal apareceu
vazio porque os dados estavam em Meu espaço; não inferir perda de dados.
Não considerar o piloto completo de duas pessoas concluído por essa confirmação.

Últimos checks locais: 26 testes de sincronização incluindo PostgreSQL 17.11 e
28 financeiros aprovados; navegador sintético abriu cache em até 1s com Auth/config/
API suspensas, preservou rascunho e bloqueou sessão invalidada. ESLint e build
aprovados. CI do commit 099840e: banco e Web checks aprovados, Access integration
em execução na última consulta. Os erros internos anteriores do GitHub não provam
resultado de código; ler o job atual. Não generalizar resultados históricos.

## Próximos passos, em ordem

1. Alias fixo conferido com o bundle novo. Preservar origem e dados locais;
   não remover deployments antigos ou alterar infraestrutura oficial por tentativa.
2. Completar teste real do casal, offline/reconexão e concorrência com duas contas.
3. Importação local implementada em `shared/workspaces/local-import.mjs`: somente
   Compras do IndexedDB `vertice_web_<projeto>_<uid>` para Meu espaço, após
   revalidação online. Recibo por lista e outbox na mesma transação; originais
   preservados. IDs existentes, inclusive excluídos, impedem importar a lista inteira,
   sem sobrescrever ou mesclar versões. Falha de rede retoma pela fila; falha antes
   de enfileirar pode repetir ao reabrir. Fontes sem dono e exemplos não entram.
   Financeiro real já está na fila/nuvem; não há fonte financeira legada vinculada
   à conta. A preview não lê IndexedDB do domínio oficial (same-origin); validar
   migração real no domínio oficial ao integrar o router, antes de liberar main.
4. Compartilhamento simples com confirmação explícita de tornar compras e financeiro
   visíveis ao parceiro; definir migração antes de executar, sem merge silencioso.
5. Integrar router/navegação protegida e módulos da PWA ao app oficial. A pasta de
   preview não substitui o ponto de entrada de produção. Preservar admin e backups.
6. CI verde, revisão do diff unificado e autorização final de liberação/merge.

## Retomar com segurança

Consultar status do ambiente, política de rede, AGENTS.md e skills. Serviços
conectados são fontes preferidas; credencial ausente no shell não significa plugin
ausente. Não pedir segredos no chat. Não usar dados reais em fixtures. Não dar
reset em checkouts: há cópias antigas com mudanças já publicadas por API.

Comandos de referência, a partir da raiz:

```sh
node node_modules/vitest/vitest.mjs run --config shared/workspaces/vitest.config.mjs
node --test --test-isolation=none previews/controle-financeiro/finance-domain.test.mjs previews/controle-financeiro/finance-improvements.test.mjs
node previews/controle-financeiro/build.mjs
node shared/workspaces/cache-browser-check.mjs
```

O teste PostgreSQL requer container local descartável explicitamente escolhido;
ver CONNECTED-PREVIEW.md e WORKSPACE-DATABASE.md. Não aponta para Supabase hospedado.
A chave privada temporária de provisionamento pode existir em `.secrets/` ignorado;
não copiar esse diretório, node_modules, dist, sessões ou logs sensíveis para commits.
