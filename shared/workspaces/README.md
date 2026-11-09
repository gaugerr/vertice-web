# Espaços pessoais e do casal

Implementação experimental, desativada no aplicativo oficial. A preview principal
usa exclusivamente um servidor de demonstração em IndexedDB e três identidades
fictícias. Não há Google, envio de convite, Cakto nem compartilhamento entre
aparelhos nessa demonstração. Duas abas no mesmo navegador podem testar o casal.

## O que está implementado

- Espaço pessoal e um casal ativo por pessoa, com no máximo dois participantes.
- Titular com licença ativa convida uma pessoa sem exigir outra licença pessoal.
- Convite por link, destinatário Google verificado, hash do token, validade de sete
  dias, cancelamento, rotação e aceite transacional.
- Ambos editam compras e financeiro; somente o titular administra participantes.
- Seletor de espaço, proteção de formulários abertos, cópia opcional para destino
  vazio, saída, remoção e encerramento com consulta pelo titular.
- Banco local por projeto/usuário/espaço. Dados e fila são gravados na mesma
  transação IndexedDB. Dados antigos da preview são preservados e importados
  somente no espaço pessoal fictício do titular.
- Operações com UUID, versões esperadas, confirmação idempotente, journal por
  espaço e detecção de resposta perdida. Versões do registro e da obrigação-pai
  protegem pagamentos e aportes concorrentes.
- Alterações em registros diferentes são preservadas; conflitos no mesmo registro
  conservam a versão local para download e permitem usar os dados atuais do servidor.
  A reaplicação é uma nova edição após revisão, nunca um pagamento reenviado às cegas.
- Autorização offline ES256 por 24 horas no casal e até sete dias no pessoal,
  vinculada a usuário, origem, espaço e geração da participação. O token é
  revalidado antes da escrita, inclusive quando vem do cache.
- Remoção bloqueia novas solicitações ao servidor. Filas antigas ficam em
  quarentena; um novo aceite preserva sua recuperação e inicia outra geração.
- Financeiro mantém centavos, competência, histórico parcial, limites mensais e
  metas existentes. Backups e restaurações ficam restritos ao espaço ativo.

Dados já baixados ou exportados não podem ser recolhidos remotamente. A aplicação
bloqueia a navegação ao detectar remoção; não promete apagar cópias externas.

## Arquitetura

- `core.mjs`: repositórios locais, outbox, conflitos, confirmações, geração de vínculo.
- `mapping.mjs`: conversão entre os modelos atuais e as tabelas normalizadas.
- `demo.mjs`: servidor local fictício para explorar a interface sem tocar no Supabase.
- `http.mjs` e `lease.mjs`: transporte autenticado, eventos e validação da autorização assinada.
- `real.mjs`: entrada de homologação Google PKCE, separada e desativada por padrão.
- `runtime.mjs`: seleciona exclusivamente demonstração ou homologação configurada.

O financeiro usa `WorkspaceFinanceStore`; compras reutilizam as telas e o
repositório existentes dentro de uma transação que também persiste a outbox.
Regras financeiras ficam no domínio atual. A sincronização não altera os cálculos.
Ocorrências fixas sem ajuste ou pagamento continuam derivadas das vigências;
as ocorrências com histórico são materializadas e preservadas. As views SQL
mostram registros materializados; o Resumo do app inclui também os derivados.

## Backend e regras de acesso

O schema em `supabase/drafts/shared-spaces/schema.sql` **substitui** o rascunho
individual em `supabase/drafts/user-data`; não aplicar os dois juntos. Ele continua
fora da pasta de migrações ativas. Tabelas de dados usam `workspace_id`, com
referências compostas, autoria, versões e tombstones. Auth/licenças/Cakto não são alterados.

Leitura direta passa por RLS e participação ativa. Apenas o serviço autenticado
pode chamar `workspace_command` e gravar dados; o navegador não recebe privilégios
de escrita direta. O helper privado `can_read` é o único `SECURITY DEFINER`: retorna
somente um booleano para `auth.uid()`, com caminho de busca vazio e sem execução
anônima. Não aceita um ID arbitrário de usuário.

A Edge Function `workspaces` valida origem e token com `auth.getUser`, exige
identidade Google verificada e define o ator no servidor. Convites nunca criam
licenças. A licença do titular determina gravação; licença inativa permite consulta
e exportação dos participantes ativos. Remoção e saída continuam disponíveis.

Todas as mutações bloqueiam a linha do espaço, conferem permissões e versões,
persistem dados, resultado idempotente e journal na mesma transação. O cursor é uma
revisão por espaço, não o relógio do cliente. O pull retorna lotes completos em ordem,
com paginação de 100 operações. Eventos de `workspace_heads` sinalizam mudanças;
foco, reconexão e consulta periódica recuperam eventos perdidos.

O serviço aceita ações `list`, `create`, `invite`, `inspect_invite`, `accept`,
`members`, `remove`, `leave`, `close`, `revoke_invite`, `access`, `pull`, `apply`,
`copy`. Não existe ação de concessão de licença pelo cliente. Payload máximo de
6 MB; a fila local rejeita previamente conjuntos acima de 5.000 alterações/5 MB
sem modificar os dados anteriores. Não usar `service_role` no frontend.

## Homologação autenticada — configuração ainda necessária

O endereço `/staging/` é uma entrada real preparada para Google e Supabase, mas
fica desativado enquanto não houver configuração explícita. O build e o runtime
recusam o projeto de produção `wqutcsjdozcukwxvkbtc`. A preview principal continua
fictícia mesmo após configurar o endereço de homologação.

1. Disponibilizar um projeto Supabase de homologação separado, com Auth e a
   estrutura de licenças existente. Não copiar usuários, dados pessoais, segredos
   ou credenciais/webhooks Cakto de produção.
2. Validar o schema nesse projeto e executar os advisors antes de aplicar. Não
   colocar automaticamente o rascunho no pipeline de produção.
3. Configurar o Google para o projeto de homologação e registrar o retorno
   `https://<preview-host>/staging/`. Usar duas contas de teste; conceder licença
   somente ao titular, exclusivamente no banco de homologação.
4. Gerar uma chave ES256 exclusiva. Guardar o JWK privado somente como
   `WORKSPACE_SIGNING_JWK` na Edge Function. A chave pública deve corresponder à
   chave usada no frontend. Não reutilizar nem publicar o segredo da licença oficial.
5. Implantar `workspaces` somente na homologação, com imports de
   `supabase/functions/deno.json`. Configurar `WORKSPACES_ENABLED=true`,
   `WORKSPACE_ALLOWED_ORIGINS` com o host exato da preview e `ACCESS_ISSUER` com a
   URL do projeto de homologação. `verify_jwt=false` é intencional: a função valida
   o JWT explicitamente; desabilitar o gateway não desabilita a autenticação.
6. Configurar o build da preview com `VITE_WORKSPACE_STAGING_URL`,
   `VITE_WORKSPACE_STAGING_PUBLISHABLE_KEY` e `VITE_WORKSPACE_STAGING_PUBLIC_JWK`.
   O build rejeita chave de serviço e JWK privado. São valores públicos; nenhum
   segredo deve ter prefixo `VITE_`.
7. Validar com Google e dois aparelhos antes de qualquer integração oficial.
   A restauração de backups pessoais no espaço pessoal da homologação permite
   testar migração explícita. Não importar a demonstração fictícia automaticamente.

Ainda não foram executados login Google real, configuração de provider, piloto
em dois aparelhos ou ativação de nuvem. Esses passos dependem desse ambiente e
das contas de teste. A implementação e os testes locais não afirmam que isso já ocorreu.
O uso offline exige os arquivos do app previamente carregados; a integração oficial
deverá incluir os novos módulos no preparo da PWA existente.

## Validação reproduzível

```sh
# Regras, autorização, conflitos, idempotência e cache com identidades sintéticas
node node_modules/vitest/vitest.mjs run --config shared/workspaces/vitest.config.mjs

# Acrescenta cliente → HTTP → PostgreSQL 17 (container descartável, sem portas)
POSTGRES_CONTAINER=<container-pg17> node node_modules/vitest/vitest.mjs run --config shared/workspaces/vitest.config.mjs

# Verificações de schema, RLS e convites no mesmo container
POSTGRES_CONTAINER=<container-pg17> node supabase/drafts/shared-spaces/verify.mjs

# Financeiro existente e build completo da preview
node --test --test-isolation=none previews/controle-financeiro/finance-domain.test.mjs previews/controle-financeiro/finance-improvements.test.mjs
node previews/controle-financeiro/build.mjs

# Servir dist em 5195 e rodar o fluxo mobile com o Chromium disponível
node shared/workspaces/browser-check.mjs
```

Os testes PostgreSQL criam bancos descartáveis com três identidades sintéticas.
Não apontar `POSTGRES_CONTAINER` para um ambiente existente ou de produção.
O teste do navegador usa a demonstração, duas abas e perfis fictícios; não comprova
Google real nem compartilhamento entre aparelhos. Verificar a etapa autenticada
separadamente na homologação antes da liberação.
