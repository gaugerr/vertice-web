# Schema de espaços — homologação

`schema.sql` substitui o rascunho individual de `../user-data`; não aplicar ambos.
Permanece fora das migrações ativas e não altera Auth, licenças ou Cakto.
O ator é verificado pela Edge Function e validado por identidade Google no comando SQL.
Somente `service_role` chama o comando; o cliente autenticado tem leitura protegida por RLS.

Fluxos, limites, configuração e testes: [documentação dos espaços](../../../shared/workspaces/README.md).

O verificador `verify.mjs` foi executado no PostgreSQL 17.11 descartável com
identidades sintéticas. Ele testa RLS, destinatário/uso de convites, licença do titular,
pagamento parcial, conflito, idempotência e remoção. Nunca executar o fixture em produção.

```sh
POSTGRES_CONTAINER=<container-pg17> node supabase/drafts/shared-spaces/verify.mjs
```

Antes de uma migração ativa: homologar Data API, Realtime e Google real, executar
advisors, conferir a concessão de licença de teste e revisar o plano de migração
dos dados locais. O piloto com pessoas reais não é substituído pelos testes sintéticos.
