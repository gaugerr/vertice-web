# Validação da base de dados — 09/11/2026

> **Estado atual e retomada por IA (09/11/2026):** leia [AI-HANDOFF](AI-HANDOFF.md).
> App oficial, demonstração local e preview conectada são ambientes distintos.
> Resultados e instruções anteriores abaixo devem ser interpretados no contexto do ambiente e da data; o handoff registra as pendências atuais.

Migração aplicada: `20261109173641_shared_shopping_finance_workspaces`.
Projeto: Vértice (`wqutcsjdozcukwxvkbtc`). Nenhum projeto ou branch Supabase pago
foi criado. O projeto Docery não foi alterado.

## Resultado

| Verificação                                                       | Resultado                                            |
| ----------------------------------------------------------------- | ---------------------------------------------------- |
| Migração registrada no histórico do Supabase                      | Confirmado                                           |
| Tabelas novas                                                     | 21, todas com RLS                                    |
| Estrutura, índices, políticas e permissões de Auth/licenças/Cakto | Iguais à captura anterior                            |
| Funções SQL protegidas                                            | 27 definições e permissões iguais                    |
| Conteúdo das licenças                                             | Hash igual; 6 registros, 4 ativos e 2 revogados      |
| Eventos Cakto                                                     | 5 aplicados, sem eventos de teste novos              |
| Edge Functions existentes                                         | Mesmas versões e hashes; webhook v6, check/admin v17 |
| Processamento da fila Cakto                                       | Ativo, a cada 5 minutos, mesmo comando               |
| Limpeza do histórico de cron                                      | Ativa, diária, mesmo comando                         |
| Endpoint Cakto sem assinatura                                     | HTTP 401, antes e depois                             |
| RPC nova acessível a anônimos/autenticados                        | Não; exclusiva do serviço                            |
| Espaços e registros novos populados                               | Nenhum                                               |
| Interface oficial e dados locais                                  | Nenhuma alteração ou importação                      |

## Testes

`tools/test-workspaces-db.mjs`: **44 verificações aprovadas** em PostgreSQL 17.11,
em container descartável sem rede e sem portas expostas. As migrações existentes
de licenças/Cakto foram aplicadas antes da migração nova. Instalação de cron foi
excluída desse container; sua configuração real foi conferida por consulta.

Cobertura: captura/deduplicação, concessão, reembolso, reativação, preservação de
licenças manuais; convite vinculado à identidade, limite de membros, isolamento
pessoal/casal, RLS, escrita privilegiada, versões e recibos idempotentes,
pagamentos parciais e concorrentes, cálculo decimal de compras, relações entre
registros, remoção e reentrada. Reembolso de licença automática bloqueou gravação
nova, preservando consulta aos registros existentes.

Handler Cakto existente: **15 testes aprovados**. ESLint, Prettier dos arquivos
alterados e `git diff --check` aprovados.

Os testes de pagamento usam exclusivamente identidades e eventos sintéticos no
banco local. A produção recebeu a migração aditiva, consultas de verificação e uma
sonda HTTP sem assinatura; nenhuma compra/reembolso fictício foi enviado ao webhook
real. Login Google de duas pessoas e sincronização entre aparelhos pertencem à
próxima etapa; não foram ativados por esta migração.

## Advisors

Sem novos avisos de segurança em nível WARN/ERROR. Permanece o aviso anterior
de [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection);
essa configuração de Auth não foi alterada.

As cinco tabelas do schema privado novo geram o aviso informativo
[RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
Isso corresponde ao acesso exclusivo do serviço: RLS ativado e nenhuma permissão
de tabela para navegador. Não foi criada política pública para silenciar o aviso.

Nenhuma chave estrangeira nova sem índice foi apontada. Permanecem quatro avisos
anteriores desse tipo no schema Cakto, preservado nesta tarefa. O aviso
[índice sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
é esperado para as tabelas recém-criadas e vazias.

## Continuidade

A base está pronta para conectar o serviço e a preview autenticada. A demonstração
local continua separada. Não reaplicar os rascunhos anteriores nem executar scripts
de cron/retry como parte dessa conexão. Manter migração explícita com recuperação
dos dados locais e testar duas contas Google antes de integrar a interface oficial.
