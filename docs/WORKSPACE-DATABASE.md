# Banco de compras, financeiro e casal

> **Estado atual e retomada por IA (09/11/2026):** leia [AI-HANDOFF](AI-HANDOFF.md).
> App oficial, demonstração local e preview conectada são ambientes distintos.
> Resultados e instruções anteriores abaixo devem ser interpretados no contexto do ambiente e da data; o handoff registra as pendências atuais.

## Escopo desta etapa

A migração `shared_shopping_finance_workspaces` adiciona a estrutura ao projeto
Supabase Vértice existente, sem criar projeto ou branch pagos. Não altera
`auth.users`, `auth.identities`, `public.licenses`, schemas `access_private` e
`cakto_private`, funções/segredos da Cakto ou seus jobs. Não faz backfill de usuários,
licenças, espaços ou dados do navegador. A interface oficial e a demonstração local
não passam a sincronizar por causa desta migração.

Aplicada em 09/11/2026 como `20261109173641`, no projeto
`wqutcsjdozcukwxvkbtc`. O arquivo versionado usa o mesmo identificador do histórico
remoto. Resultado da conferência: [validação da implantação](WORKSPACE-DATABASE-VALIDATION.md).

O schema compartilhado substitui os rascunhos da branch de preview; não aplicar
esses rascunhos em cima da migração. Todas as tabelas de dados têm `workspace_id`,
autoria, versão e exclusão lógica. IDs, centavos inteiros e quantidades decimais
mantêm os contratos existentes.

## Estrutura

- `workspace_private`: espaços pessoais/compartilhados, participantes, convites,
  recibos idempotentes e histórico ordenado de mudanças.
- `public.shopping_*`: listas, categorias e produtos. Total de produto usa
  `numeric`, arredondamento para centavos e não multiplica o conteúdo da embalagem.
- `public.finance_*`: categorias, formas de pagamento, contas fixas/versionamento,
  lançamentos, pagamentos, limites mensais e metas/aportes.
- `public.user_import_batches`: recibos para a futura importação explícita.
- `public.workspace_heads`: revisão para sinalização Realtime, se disponível.
- `finance_entry_totals` e `finance_goal_totals`: consultas com `security_invoker`.

## Acesso e relação com a licença

O titular precisa de licença ativa existente. O parceiro usa seu próprio Google,
sem ganhar uma licença na tabela de pagamentos. São no máximo duas pessoas e um
espaço compartilhado ativo por conta. Convites expiram em sete dias, vinculam-se ao
e-mail Google verificado e guardam somente o hash do token. Tokens devem ser gerados
em serviço autenticado, nunca por uma RPC pública de navegador.

Licença revogada bloqueia novas gravações, preservando consulta e exportação dos
participantes ativos. As consultas verificam o status atual de `public.licenses`;
não há trigger nova nessa tabela. Assim, pagamento, reembolso e override manual
continuam sob responsabilidade da integração existente. Remoção e encerramento
não apagam os dados nem mudam a licença.

Todas as tabelas novas usam RLS. Clientes autenticados têm somente leitura dos
espaços autorizados; anônimos não têm acesso. Escrita direta e execução de
`public.workspace_command` são exclusivas de `service_role`. O serviço deve obter
o UID por `auth.getUser`, validar Google/origem e nunca aceitar ator do cliente.
Não expor a chave de serviço. O único helper `SECURITY DEFINER` novo está no schema
privado, retorna um booleano e consulta `auth.uid()`; seu `search_path` é vazio.

Operações bloqueiam o espaço, verificam versões, persistem os registros, recibo e
journal na mesma transação. Pagamentos/aportes também conferem a versão do pai.
Reentrada no casal muda a geração, impedindo replay da fila antiga. Cópia exige
destino vazio e preserva o espaço pessoal original. Não há merge automático.

## Validação e operação

```sh
# Somente um container descartável, isolado e sem portas expostas
docker run -d --name vertice-workspaces-test --network none \
  -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine
POSTGRES_CONTAINER=vertice-workspaces-test node tools/test-workspaces-db.mjs
docker rm -f vertice-workspaces-test

# Handler HMAC existente (não chama produção)
npm run test:cakto
```

O teste aplica as migrações reais de acesso/Cakto, exceto a instalação de cron do
Supabase, em banco PostgreSQL descartável. Valida concessão, deduplicação,
reembolso, reativação, preservação de licença manual, participantes, RLS, cálculos,
pagamentos concorrentes, remoção e reentrada. Identidades e eventos são sintéticos.
A workflow `workspaces-db.yml` reproduz essa regressão sem credenciais remotas.

`tools/sql/access-fingerprint.sql` é somente leitura. Compara definições,
permissões, índices, políticas e conteúdo das licenças antes/depois, retornando
hashes sem e-mails, segredos ou corpos de webhook. Jobs e versões das Edge Functions
devem ser conferidos à parte. Nunca enviar eventos assinados fictícios ao webhook
real. Uma requisição sem assinatura deve retornar 401 e não gravar eventos.

Os avisos `RLS enabled, no policy` dos schemas privados são esperados: o acesso é
exclusivo do serviço, que possui `bypassrls`; não adicionar políticas públicas para
eliminar esses avisos. Não alterar os avisos preexistentes da Cakto nesta tarefa.
Índices sem uso também são esperados enquanto as tabelas novas estão vazias.

A migração limita espera de locks a três segundos e duração a trinta segundos.
Aplicar como transação única. Não reexecutar migrations antigas, cron ou scripts
de retry para diagnosticar esta etapa. Havendo falha, corrigir o SQL local e
revalidar antes de tentar novamente. Para pausar a futura sincronização, desativar
o endpoint novo; não apagar tabelas com dados como forma de rollback.

## Próxima integração

Conectar o serviço de workspaces e uma preview autenticada ao projeto autorizado,
com configuração explícita para esse ambiente e chave de assinatura dedicada.
Preservar a demonstração fictícia separada e os guards anteriores até adaptar essa
configuração deliberadamente. Não remover o bloqueio de produção indiscriminadamente.
Depois validar duas contas Google reais e migração confirmada dos dados locais,
mantendo backup/origem. Login real e sincronização entre aparelhos não são
comprovados pelos testes de banco desta etapa.
