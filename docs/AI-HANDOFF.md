# Retomada do Vértice por outro modelo

Atualizado em 11/11/2026 (America/Sao_Paulo). Registro de estado observado, não
substitui consultas atuais aos serviços. Começar por este arquivo e AGENTS.md.

## Reformulação visual — 12/11/2026

Padrões visuais da entrada de revisão estão em `ui.css`, carregado após os estilos
existentes; `ui.mjs` centraliza SVGs e hidrata ícones estáticos. Ambos são copiados
para a raiz e `/staging/` pelo build. Sem novas dependências, alterações em src/, banco,
cálculos, armazenamento, sincronização ou rotas.

- Tema escuro/roxo preservado; cards, tipografia, cores, progressos, seletores,
  listas, menus e formulários padronizados em todas as telas financeiras/configurações.
  Ícones próprios de categorias armazenadas permanecem intactos.
- Pesquisa visível; filtros recolhidos, contador de critérios ativos e Limpar.
  Indicadores continuam refletindo os filtros. Editar permanece direto; copiar e
  excluir ficam em Mais ações, com teclado/Escape e fechamento ao clicar fora.
- Formulários com valor destacado, campos de 16px, gerenciamento de categorias/
  pagamentos acessível por ícone identificado e ações fixadas ao rodapé do diálogo.
  Data/método visíveis; opções adicionais preservadas. Salvamento mostra estado
  ocupado e mantém rascunho em falha. Metas, recorrências, parcelas e backups intactos.
- Removidos slogans/subtítulos redundantes e símbolos improvisados da navegação;
  orientações financeiras e de recuperação permanecem. Gráfico semanal distingue
  receitas verdes de despesas rosas, acompanhando os demais indicadores.
- Corrigida a largura herdada pelos ícones do mês em telas estreitas. Indicadores
  fora do Resumo são compactos para aproximar pesquisa e planejamento do topo.
- Validação: 44 testes financeiros/rotas, build, ESLint/diff e Playwright para todas
  as dez telas em 280/390/1440, filtros/limpeza, teclado, falha de valor/rascunho,
  altura de 500px (aproxima teclado; não substitui aparelho físico), valores altos/
  negativos, crédito sem cartão, edição/exclusão, pagamento/desfazer/reconfirmar,
  backup/restauração/cópia anterior, persistência e configurações. Capturas em /tmp.
  Sem leitura/gravação de registros reais; sessão Google e teclado físico ficam
  para a revisão do titular no endereço conectado existente.

## Simplificação e indicadores consistentes — 12/11/2026

Esta revisão substitui a apresentação/navegação descrita nas seções históricas abaixo.
Auditoria: o Financeiro é o app DOM em `previews/controle-financeiro`, com regras
puras em `finance-domain.mjs`/`finance-ledger.mjs`, persistência transacional e fila
em `shared/workspaces/core.mjs`, mapeamento normalizado em `mapping.mjs` e comando
SQL por espaço. Schema/migração existente revisados; nenhuma mudança no banco.

- Barra principal: Resumo, Lançamentos, Planejamento e Análises. Mais continua no
  menu lateral, com categorias, métodos, patrimônio e configurações/backups.
  Contas/cartões já existentes permanecem acessíveis ali para preservar recursos
  e registros. Nenhuma expansão bancária foi adicionada; aliases/rotas preservados.
- `summaryTotals` é a fonte dos indicadores em Resumo, Lançamentos e Análises.
  `operatingExpense`: despesa paga sem Reserva e Investimentos; `resultBeforeSaving`:
  receitas menos essa despesa; `remainingAfterSaving`: resultado menos reserva.
  `expense`/`balance` legados continuam incluindo reserva, sem mudar o protocolo.
  Investimentos já eram despesas: nunca descontar duas vezes. Aportes de metas
  permanecem independentes, sem inferir vínculos ou criar débitos automaticamente.
  Lançamentos usa os mesmos cálculos sobre as linhas filtradas, inclusive na busca.
  Orçamento continua considerando despesas pagas e previstas, incluindo reserva;
  projeção considera receitas/despesas previstas, sem duplicar pagamentos de fatura.
- Resumo: restante, receitas/despesas/guardado, orçamento, vencimentos, últimos cinco,
  categorias e comparação. Explicação de cálculo recolhida; gráfico semanal em Análises.
  Indicadores e orçamento restante reutilizados nas demais telas pertinentes.
- Método de pagamento e data ficam visíveis no formulário. Novos registros começam
  no dia atual; edições/cópias preservam data. Crédito genérico funciona sem cartão.
  Parcelamento, recorrência, observações e vínculos opcionais ficam nas opções adicionais.
- Preservados dados, IDs, metas, parcelamentos, recorrências, histórico, backups,
  autenticação, licenças, Cakto, RLS, compartilhamento, fila offline e conflitos.
  Sem dados fictícios, exclusões ou alterações no app oficial/página de vendas.
- Validação: 44 testes financeiros/rotas, 28 de persistência/sincronização; build,
  ESLint e diff. Duas suítes PostgreSQL opcionais não executadas nesta revisão
  de interface/domínio. Playwright: conta vazia/com dados, registro rápido, crédito
  sem cartão, edição/exclusão, busca/filtros/indicadores, orçamento, parcelas/faturas
  existentes, recarga/backup, navegação e ausência de overflow em 280/390/1440 px.
  Casos de pessoas reais e sessões Google devem ser revisados pelo titular em /staging/.

## Registro rápido, contas, cartões e séries — 11/11/2026

**Ativado na versão de revisão.** O proprietário autorizou explicitamente a
migração no banco real e a atualização de `workspaces`. Aplicação concluída:
três tabelas novas com RLS, comando restrito ao serviço e Edge Function na versão 2,
preservando sua autenticação/origem. A PR #29 foi integrada somente à branch
`preview/controle-financeiro`; interface confirmada em `/staging/` e checks
PostgreSQL/Web/Access/Cloudflare aprovados. Não houve merge em `main`.
A migração está alinhada à versão hospedada `20261111225724`; não reaplicar.

O proprietário autorizou estes recursos nesta etapa, substituindo a restrição
anterior de não criar cartões/parcelamentos. Formulário comum começa com valor,
descrição e categoria sugerida; tipo, data e pagamento usam histórico/dia civil.
Data, conta/cartão, frequência e observação ficam em detalhes. Não prometer dez
segundos para qualquer pessoa/rede: o teste automatizado valida o caminho de dois
campos sem seleções obrigatórias adicionais. Busca ignora acentos.

`finance-ledger.mjs`: contas manuais com saldo inicial (não receita), transferências
fora de receitas/despesas, cartões com fechamento/vencimento, parcelas e repetições
mensais de 2 a 120 meses. Parcelas distribuem centavos exatos; somente a primeira
pode começar paga. Receita recorrente é uma série finita explícita; contas fixas
continuam com a recorrência mensal existente. Edição altera uma ocorrência;
encerrar série preserva pagamentos e faturas já parcialmente pagas.

Compra no dia do fechamento entra na fatura seguinte, conforme escolha do usuário.
As competências seguem o vencimento de cada fatura, não o mês do pagamento bancário.
Pagamentos parciais de fatura geram baixas vinculadas às compras, sem novo lançamento
de despesa; a conta é debitada uma vez pelo movimento de fatura. Alocação FIFO
determinística. Reverter pagamentos precede edição de compras de fatura já paga.
Saldos até hoje incluem apenas movimentos vinculados, posteriores ao saldo inicial.
Não há Open Finance, conciliação automática, rotativo, cálculo de juros ou importação
bancária. Não inferir dívidas/despesas antigas de um meio genérico Cartão de Crédito.

Orçamento admite limite total mensal independente das categorias, inclusive zero,
e cópia para o mês seguinte. Metas existentes continuam independentes; guardar uma
meta não cria débito bancário automaticamente.

Migração `20261111225724_finance_accounts_cards_series`: adiciona `finance_wallets`,
`finance_cards`, `finance_moves`, metadata `finance_entries.extra`, vínculos de baixa
em `finance_payments` e `finance_budget_months.total_limit_cents`. RLS por espaço e
escrita pelo comando do serviço. `workspace_command` mantém assinatura, envolve o
comando anterior em validação, e protege dados novos contra clientes antigos.
Operações novas enviam `ledger_version: 2`; filas antigas sem dados novos continuam
válidas. Não recriar tabelas, reimportar exemplos ou reaplicar a migração. Sessões,
Auth/licenças/Cakto e jobs não foram alterados.

Backups mantêm compatibilidade com o formato existente e incluem os campos novos.
Testes críticos em `finance-ledger.test.mjs`, `shared/workspaces/ledger-postgres.test.mjs`
e `ledger-browser-check.mjs`: competências/centavos, repetição, transferências,
fatura parcial/reversão, saldos, duplicidade, concorrência e fluxo mobile/backup.

## Navegação financeira em cinco acessos — 11/11/2026

Inventário anterior: Resumo, Lançamentos, Orçamento, Contas Fixas, Metas,
Análises, Patrimônio e Configurações. Não existem contas bancárias nem faturas de
cartões; conta Google/compartilhamento e formas de pagamento são os recursos reais.

Nova barra: Início, Lançamentos, Planejamento, Análises e Mais. Planejamento
reutiliza Orçamentos, Contas fixas e Metas em abas internas, com os mesmos
formulários. Análises concentra gráfico semanal, distribuição e comparação;
Início mantém apenas resumos e os três valores (resultado mensal, entradas e
saídas), sem bloco de saldo inicial/disponível não informado. Mais abre conta,
formas de pagamento, patrimônio, categorias e configurações/backups existentes.
Patrimônio aponta às metas em Planejamento sem replicar sua gestão.

`finance-navigation.mjs` centraliza grupos e rotas. Canônicas: `home`,
`transactions`, `planning/budget|fixed|goals`, `analysis`, `more`, `more/wealth`,
após `#financeiro/`. Aliases antigos `overview`, `budget`, `fixed`, `goals`,
`wealth`, `analysis` e `transactions` continuam funcionando; `#configuracoes`
permanece. Voltar/Avançar usa histórico; renderizações de dados não empilham rotas.
IDs das telas, formulários, bancos e backups são preservados. Sem migrações.
Validação focada: teste do mapeamento de rotas, build/lint e navegador para cinco
acessos, abas internas, cadastros/backups, histórico e aliases em 280/390/1440 px.

## Resumo reorganizado — 11/11/2026

Substitui a apresentação minimalista anterior. Ordem: saldo disponível (Não
informado, por escolha do proprietário, sem estimativa bancária), resultado
mensal separado e entradas/saídas, orçamento, cinco últimos lançamentos, até três
contas futuras do mês, gastos pagos em cinco categorias + Outros, comparação.
Orçamento resume os limites por categoria existentes e os gastos pagos/previstos
apenas nessas categorias; avisa sobre gastos fora dos limites. Não cria limite
global implícito. Zero e orçamento excedido continuam válidos.

Categorias e Outros abrem os filtros existentes de Lançamentos. O gráfico semanal
fica em Análises; investimentos mensais e metas existentes ficam em Patrimônio,
ambos no menu. Não tratar investimentos do mês/metas como patrimônio acumulado.
Novo lançamento flutua acima das abas no celular. Nenhum schema ou saldo inicial
foi adicionado. `overviewData` agrupa dados sem persistir uma segunda cópia.
Validação focada: teste do agrupamento/orçamento, build/lint e navegador para
ordem, saldos, agrupamento/filtros, acessos, botão e larguras 280/390/1440.

## Menu compacto — 11/11/2026

Seletor de espaço, Compartilhar e Sair ficam dentro do menu lateral (280 px,
máximo 85vw), sem descrições das áreas nem rodapé promocional. Removida a faixa
superior. O cabeçalho tem ícone acessível de sincronização; toque abre popover
nativo com estado, última sincronização e revisão de pendências quando aplicável.
Mantidos os IDs internos, proteções de troca com rascunho e handlers existentes.
Mensagens vazias não ocupam espaço; bloqueios de troca também aparecem no menu.
Validação focada: build, lint dos fontes alterados e navegador para menu,
troca de espaço/rascunho e estados do indicador. Sem reexecutar suítes financeiras
ou de banco por esta alteração de apresentação.

## Resumo minimalista — 11/11/2026

Resumo destaca Saldo restante (recebidos menos pagos), com Entradas, Saídas e
Saldo investido compactos. Investido é o valor efetivamente pago no mês em
Reserva e Investimentos (ID padrão D15 preservado ao renomear/arquivar; também
reconhece o nome exato de uma categoria importada). Inclui parciais pela
competência, não soma metas e não desconta investimentos novamente do saldo.
Não representa patrimônio acumulado. Regras em `summaryTotals` no domínio.

Os cinco últimos lançamentos do mês vêm de `monthlyRows`, em ordem decrescente
de data de referência, logo abaixo dos indicadores. Pendências/parciais ficam
identificadas; Ver todos abre Lançamentos. Gráficos, comparação mensal, orçamento,
contas pendentes e metas continuam abaixo. As outras telas mantêm os indicadores
anteriores. Sem migração ou alteração dos dados persistidos.

Validação: 31 testes financeiros, 28 de sincronização, build/lint/formatação;
`shared/workspaces/summary-browser-check.mjs` verifica os cálculos visíveis,
lista de cinco, navegação, troca de mês, persistência e larguras 280–1440.
O fluxo existente de interface/backups/pagamentos também foi validado.

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

Manter facilidade de uso; contas/cartões/parcelamentos manuais foram autorizados na atualização de 11/11/2026, conforme o registro acima.
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
