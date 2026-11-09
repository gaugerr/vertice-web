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

O schema canônico está em `supabase/migrations`, com as migrações
`20261109173641_shared_shopping_finance_workspaces` e
`20261109180048_workspace_preview_signing`. Já foram aplicadas no projeto Vértice
existente com autorização do proprietário. Os arquivos em `supabase/drafts` são
históricos; não reaplicá-los. Tabelas usam `workspace_id`, autoria, versões e
exclusões lógicas. Auth/licenças/Cakto permanecem preservados.

Leitura direta passa por RLS e participação ativa. Apenas o serviço autenticado
pode chamar `workspace_command` e gravar dados; o navegador não recebe privilégios
de escrita direta. O helper privado `can_read` usa `SECURITY DEFINER` e retorna
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

## Preview conectada autorizada

A entrada `/staging/` do endereço estável usa o banco Vértice existente. Essa
conexão foi autorizada expressamente para evitar um projeto Supabase adicional.
A demonstração principal continua fictícia, sem importar dados para a conta real.
O build só ativa o arquivo público `connected-preview.json` na branch autorizada
Cloudflare; o runtime exige origem, projeto, endpoint e modo explícitos.

Google usa PKCE e armazenamento separado. A sessão é estabelecida antes de montar
o iframe de compras. Registrar o retorno exato nos Redirect URLs do Supabase,
preservando os endereços existentes; não alterar Site URL/provedor Google/Cakto.
Os plugins atuais não expõem a edição dessa configuração de Auth.

A chave ES256 dedicada está criptografada no Vault (`vertice-workspace-signing-v1`).
O backend acessa somente esse segredo por uma função privada `SECURITY DEFINER`,
com `search_path` vazio e verificação explícita de JWT `service_role`. Um wrapper
RPC com direitos do invocador também é exclusivo do serviço. Navegadores não podem
executar essas funções. A chave de licença existente não é lida ou rotacionada.
Somente a chave pública entra no frontend. A Edge Function `workspaces` pode usar
`WORKSPACE_SIGNING_JWK` e `WORKSPACE_ISSUER` próprios quando configurados; nenhum
segredo `ACCESS_*` é necessário para seu funcionamento.

O endpoint foi habilitado somente para a origem exata da preview. Ele usa
`auth.getUser` para autenticar todas as solicitações de dados. A publicação não
ativa a interface oficial, não faz importação automática e não concede licenças.
O uso offline exige arquivos previamente carregados; a integração oficial precisa
incluir esses módulos no preparo da PWA.

Procedimentos, resultados e piloto: [Preview conectada](../../docs/CONNECTED-PREVIEW.md).
A publicação/sondas sem sessão não comprovam login Google real nem sincronização
entre aparelhos; validar com duas contas antes da liberação oficial.

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
