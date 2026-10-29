# Operações do Vértice

Guia para um novo chat/agente com acesso ao repositório, sem depender de arquivos
temporários ou do histórico da conversa. Última conferência: **29/10/2026 UTC**.
Estado observado é um registro datado, não substitui consultar os serviços.
Mapa das funcionalidades e regras do produto: [AGENTS.md](../AGENTS.md).

## Retomada e diagnóstico de conexão

1. Descobrir as ferramentas conectadas disponíveis nesta sessão. GitHub, Cloudflare
   e Supabase são integrações distintas; login em uma não autentica as outras.
   Consultar os skills correspondentes quando disponíveis.
2. Em ambiente gerenciado, consultar `cloud_environment.environment_status` e ler
   `/etc/codex/network-policy.json` antes de usar rede/CLI. Preservar proxy e TLS.
   Não ler arquivos de credenciais, imprimir o ambiente ou contornar o proxy.
3. Confirmar acesso com consultas de leitura abaixo. HTTP 401/403, ferramenta
   ausente e timeout são falhas diferentes. Não disparar deploy, SQL de escrita ou
   cobrança como teste. Ausência de ferramenta exige reconexão; não significa que
   os recursos foram apagados.
4. As ferramentas podem ter nomes prefixados pela plataforma. Redescobrir os nomes
   e parâmetros em vez de depender de um nome integral ou ID de sessão antigo.

GitHub: `gaugerr/vertice-web`. Ler `git/ref/heads/main` pela API e conferir o
commit/tree atual antes de criar branch. Conferir `git status --short` local;
preservar alterações que já existiam. Não publicar um checkout antigo inteiro.
As verificações em `.github/workflows/checks.yml` e `access.yml` incluem testes
do app e Supabase isolado; o bot de formatação pode atualizar o HEAD da branch.
Verificar novamente o SHA antes do merge. Não usar fixtures no banco real.

## Cloudflare: app e página de vendas

Conta: **`ab0452392516e43ea097317ea48c57d5`**.

| Projeto Pages | Domínio oficial                 | Origem alternativa              | Raiz / build / saída                             |
| ------------- | ------------------------------- | ------------------------------- | ------------------------------------------------ |
| `use-vertice` | `https://app.usevertice.app.br` | `https://use-vertice.pages.dev` | `/` / `node tools/build-cloudflare.mjs` / `dist` |
| `vertice-kit` | `https://usevertice.app.br`     | `https://vertice-kit.pages.dev` | `/marketing` / `node build.mjs` / `dist`         |

Ambos usam o GitHub `gaugerr/vertice-web`, produção na `main`, Node 24 e deploy
automático de produção. Um merge documental também pode disparar os builds pela
integração existente; não é necessário criar deploy manual adicional.

Para verificar pelo plugin, primeiro usar a busca do OpenAPI e depois executar:

```js
async () => {
  const account = 'ab0452392516e43ea097317ea48c57d5';
  const response = await cloudflare.request({
    method: 'GET',
    path: `/accounts/${account}/pages/projects`,
  });
  return {
    success: response.success,
    projects: response.result?.map((project) => ({
      name: project.name,
      domains: project.domains,
      branch: project.production_branch,
      build: project.build_config,
      deployment: {
        id: project.canonical_deployment?.id,
        environment: project.canonical_deployment?.environment,
        stage: project.canonical_deployment?.latest_stage,
        commit: project.canonical_deployment?.deployment_trigger?.metadata?.commit_hash,
      },
    })),
  };
};
```

O exemplo roda no executor do plugin Cloudflare, não no console do site. Não
retornar `deployment_configs`/variáveis do projeto, que podem conter segredos.
Para investigar um deploy, GET de
`/accounts/{account_id}/pages/projects/{project_name}/deployments/{deployment_id}`;
conferir ambiente, branch, commit e estágio `deploy: success`. Não considerar um
build iniciado como publicação concluída.

Conferência em 29/10/2026: os dois projetos tinham deploy de produção bem-sucedido
do commit `44e6725e2971cb7b10af3d76667e6b636443596f`. Buscar o commit atual na
próxima sessão; este valor não deve ser usado para forçar rollback ou atualização.

### Preview, OAuth e publicação

- App: previews automáticos em modo `custom`, incluindo somente
  `feat/vertice-financeiro` na conferência. Vendas: automáticos em `none`;
  previews manuais por branch foram usados. Não habilitar previews globais para
  resolver uma tarefa pontual. Um preview manual deve informar branch e commit
  explicitamente; omiti-los pode publicar a `main`.
- O app deve manter acesso protegido também no preview. Autorizar a origem exata
  em `ACCESS_ALLOWED_ORIGINS` e `<origem>/auth/callback` nos Redirect URLs do
  Supabase antes de testar login. Preservar valores anteriores e não usar curingas.
  A página de vendas não precisa das funções de licença nem dessas permissões.
- O callback do provedor Google é
  `https://wqutcsjdozcukwxvkbtc.supabase.co/auth/v1/callback`, distinto do retorno
  do aplicativo. Não trocar cliente Google ou chaves para testar preview.
- Cloudflare app: `tools/build-cloudflare.mjs`, `tools/validate-access.mjs`,
  `public/_headers` e `public/_redirects`. Rotas reais usam `app-shell.html`;
  assets inexistentes devem continuar retornando 404.
- Marketing: build executado dentro de `marketing/`; o HTML gerado referencia CSS
  com hash do conteúdo. Não editar nomes gerados ou commitar `dist/`.
- Após publicação do app, conferir rotas, OAuth, manifesto, `sw.js`/`online.txt`
  sem cache e asset ausente 404. Após vendas, conferir CTAs, preço, galerias,
  demonstrações e layout móvel. Ver [hospedagem](CLOUDFLARE.md).
- A Vercel também tem integração existente com o app. Não removê-la nem trocar
  origens como parte de uma tarefa na Cloudflare. Compras pertencem à origem do
  navegador: mudanças de domínio exigem exportação/importação de backup.

## Supabase: banco e automação

Projeto: **`vertice`**, ref **`wqutcsjdozcukwxvkbtc`**, região `us-east-1`.
URL pública: `https://wqutcsjdozcukwxvkbtc.supabase.co`.
Conexão usada: nome `Supabase`, ID `link_6acfe773755081919a0d054cf101d061`.
Se indisponível, redescobrir as conexões e listar projetos; não escolher outro
projeto apenas por ter conexão chamada `Primary`. Docery é separado.

Usar `execute_sql` de leitura no projeto correto. As consultas seguintes não
retornam dados de compradores nem segredos. Algumas ferramentas mostram somente
o último resultado de um lote; executá-las separadamente quando necessário.

```sql
select now() as checked_at,
       pg_size_pretty(pg_database_size(current_database())) as database_size;
```

```sql
select product_id, processing_enabled
from access_private.cakto_products;
```

```sql
select jobid, jobname, schedule, active, command
from cron.job
where jobname in (
  'vertice-cakto-process-pending',
  'vertice-cakto-cron-history-cleanup'
);
```

```sql
select processing_status, count(*) as events
from access_private.cakto_events
group by processing_status;
```

```sql
select j.jobname, r.status, r.start_time, r.end_time
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname in (
  'vertice-cakto-process-pending',
  'vertice-cakto-cron-history-cleanup'
)
order by r.start_time desc
limit 10;
```

Estado observado em 29/10/2026:

- Projeto `ACTIVE_HEALTHY`, Postgres 17, banco com aproximadamente **12 MB**.
  É uma medição, não uma projeção de capacidade. Preservar plano gratuito;
  verificar uso real antes de sugerir qualquer mudança de plano.
- Produto `988379d3-cbaa-465f-930b-14aa7d48422e` com `processing_enabled=true`.
- `vertice-cakto-process-pending` ativo: `*/5 * * * *`, chamando
  `select public.cakto_process_pending(true, 20);`.
- `vertice-cakto-cron-history-cleanup` ativo: `15 4 * * *` (04:15 UTC), remove
  somente execuções encerradas há mais de sete dias desses dois jobs.
- Funções Edge `license-check`, `license-admin` e `cakto-webhook` ativas. As três
  estão com `verify_jwt=false` no gateway e fazem autenticação no próprio código:
  licença/admin validam sessão Google; webhook valida HMAC. Não interpretar isso
  como permissão para tornar os handlers públicos sem validação.
- O proprietário confirmou as flags de captura/processamento imediato durante a
  ativação e testou compra, login e reembolso. Valores dos secrets Edge não foram
  lidos nesta revisão; estado de jobs/produto não comprova sozinho essas flags.

### O que cada armazenamento contém

- **IndexedDB/Dexie, versão 5:** `lists` → `categories` → `items`, com IDs e
  relações validados pelo repositório e operações transacionais. `migrations`
  guarda recibos de migração de conta. Compras não são tabelas no Supabase.
  Backup v5 aceita versões anteriores suportadas; restauração substitui os dados
  da conta, sem mesclagem. Não apagar/recriar banco para corrigir interface.
- **Auth:** Google OAuth e identidade verificada; login não concede licença
  automaticamente nem cria um administrador. A licença pode existir antes do
  primeiro login e é vinculada ao UID pela RPC `access_license_check`.
- **`public.licenses`:** e-mail normalizado único, UID único quando vinculado,
  `active`/`revoked`, versão, origem `manual`/`cakto` e override `allow`/`deny`.
  Cliente autenticado lê só a própria linha vinculada via RLS. Operações de
  administração passam pelas verificações do servidor.
- **`access_private`:** `admins`, `audit`, inbox `cakto_events`, estado de pedidos
  `cakto_orders`, flags `cakto_products`, auditoria `cakto_license_changes`.
  Não expor tabelas privadas à Data API ou ao navegador para facilitar consultas.
- **`cakto_private`:** backups do checkout e ponte manual de leitura da API;
  owner-only, sem acesso de `anon`, `authenticated` ou `service_role`. Não é usado
  pelo app nem pelo processador de vendas.
- **Vault:** credenciais para operações externas. Não incluir tokens, segredos ou
  chaves privadas em respostas, logs, frontend, backups de compras ou Git.

O histórico de preços é derivado de itens comprados em outras listas finalizadas,
não de uma tabela remota. Copiar uma lista gera novos registros independentes,
zera preços e desmarca itens. Marcas/embalagens não multiplicam o preço da compra.
As regras monetárias usam strings decimais e big.js; somam apenas os comprados.

### Liberação, revogação e recuperação

Webhook assinado → normalização/deduplicação em `cakto_events` → tentativa imediata
se habilitada → agregação do pedido em `cakto_orders` → sincronização da licença
e auditoria, atomicamente. O cron recupera pendências já capturadas sem fazer
requisições HTTP ou novas invocações de Edge Function. Rodar a cada cinco minutos
não significa que toda compra tenha de esperar cinco minutos.

O processador considera todos os pedidos válidos do e-mail, preserva concessões
manuais e overrides do produtor. Reembolso/chargeback/MED bloqueia o pedido;
aprovação atrasada não o desbloqueia. Outra compra válida pode preservar acesso.
Após falhas transitórias há até cinco tentativas, depois revisão manual.
Regras completas em [Cakto](access/CAKTO.md).

**Limite da recuperação:** eventos nunca recebidos não aparecem nessa fila.
Conciliação automática por API, alertas e painel de revisão ainda não existem.
Acompanhar entregas na Cakto e reenviar falhas conforme necessidade; não estimar
uma taxa de falha sem métricas. Não criar uma segunda rotina para a mesma fila.

`supabase/cakto-retry-job.sql` é instalação deliberada: cria/atualiza jobs e os
deixa **inativos**, inclusive jobs já existentes. Não reexecutar como diagnóstico.
Desligar `CAKTO_PROCESSING_ENABLED` pausa só a tentativa imediata; o cron continua.
Desabilitar o produto pausa o processamento dele, sem revogar licenças existentes.
Essas alterações operacionais exigem escopo explícito; não fazê-las em tarefa visual.

**Acesso do app:** autorização ES256 por origem com validade de até sete dias.
`src/access/controller.ts` verifica no início, retorno à conexão/foco e a cada
15 minutos em primeiro plano, com limite comum de uma chamada por minuto.
`lease.ts` valida assinatura/identidade/validade; `AccessBoundary.tsx` protege
telas. Revogação/exclusão é conhecida na próxima validação online, não retira
instantaneamente uma autorização offline já emitida. Timers locais de relógio
não são chamadas ao Supabase.

**Excluir licença** no `/admin` remove só a licença, com confirmação exata do
e-mail. Mantém Auth/UID, eventos, pedidos e auditoria; os vínculos históricos da
licença ficam nulos. Administradores são protegidos. Uma nova notificação válida
pode recriá-la; para bloqueio com prioridade sobre automação, usar **Revogar**.
Não confundir exclusão com reembolso ou remoção de cópias de planilhas.
Ver [Administração](access/ADMIN.md).

## API Cakto sem MCP

O MCP da Cakto não é necessário para o acesso já estabelecido. Não iniciar nova
configuração OAuth do MCP ou pedir novamente as credenciais para retomar o trabalho.

| Recurso          | Identificador                              |
| ---------------- | ------------------------------------------ |
| Produto          | `988379d3-cbaa-465f-930b-14aa7d48422e`     |
| Oferta           | `jjnk3vv`                                  |
| Checkout         | `1241258`                                  |
| Checkout público | `https://pay.cakto.com.br/jjnk3vv_1241258` |
| Base da API      | `https://api.cakto.com.br/public_api/`     |

### Credenciais e leitura segura

As credenciais estão no **Supabase → Integrations → Vault → Secrets**, nomes
exatos `CAKTO_CLIENT_ID` e `CAKTO_CLIENT_SECRET`. São diferentes do
`CAKTO_WEBHOOK_SECRET` das Edge Functions. Nesta revisão ambos os nomes existiam;
nenhum valor foi retornado ao cliente. Verificar só existência quando necessário:

```sql
select name, count(*) as configured
from vault.secrets
where name in ('CAKTO_CLIENT_ID', 'CAKTO_CLIENT_SECRET')
group by name;
```

A função `cakto_private.read_api(text)` já está instalada no banco real. É
`SECURITY INVOKER`, privada, usa `http` no servidor e retorna `{ok,status,body}`
em sucesso ou etapa/status/código seguro em falha. Não instalar outra ponte se
ela já existe; não conceder acesso aos papéis do navegador ou `service_role`.

```sql
select to_regprocedure('cakto_private.read_api(text)') is not null as available;
```

```sql
select cakto_private.read_api(
  'products/988379d3-cbaa-465f-930b-14aa7d48422e/checkouts/1241258/'
);
```

Também aceita `products/{id}/` e `products/{id}/checkouts/`. Exige os caminhos
relativos com barra final; não aceita URL arbitrária, `offers/` ou escrita.
Em 29/10/2026 a consulta do checkout respondeu `ok=true`, HTTP 200.
Autenticação bem-sucedida para leitura não garante autorização para qualquer endpoint.

A ponte e `checkout_backups` foram provisionados operacionalmente no banco real;
não são criados pelas migrações do repositório. Antes de alterar sua implementação,
inspecionar definição/permissões no catálogo. A definição pode ser obtida pelo
owner com `pg_get_functiondef(to_regprocedure('cakto_private.read_api(text)'))`;
ela referencia nomes do Vault e não contém os valores. Não confundir banco local
novo sem essa ponte com perda de configuração do banco real.

### Autenticação e alteração autorizada

Fluxo já utilizado, inteiramente no servidor:

1. Ler os dois valores de `vault.decrypted_secrets` **somente para variáveis
   PL/pgSQL**, com filtro pelos nomes exatos. Nunca fazer SELECT desses valores
   como resultado, copiar para arquivo ou retorná-los ao agente.
2. POST em `https://api.cakto.com.br/public_api/token/`, com corpo
   `application/x-www-form-urlencoded`: campos `client_id` e `client_secret`.
   A extensão `http_post(url, jsonb_build_object(...))` existente faz esse envio.
3. Extrair `access_token` para variável do servidor; usar exclusivamente no header
   `Authorization: Bearer ...` da chamada necessária. Não imprimir resposta do
   endpoint de token, nem armazenar token no backup ou em configuração pública.
4. Usar timeouts finitos (conexão 5 s, total 15 s), anular variáveis sensíveis e
   restaurar opções `http_reset_curlopt()` também no caminho de erro. Retornar
   somente status, etapa e resultado não secreto; não devolver erro bruto ou headers.

Endpoints usados:

| Operação                  | Método / caminho relativo                       |
| ------------------------- | ----------------------------------------------- |
| Consultar produto         | `GET products/{produto}/`                       |
| Consultar checkout        | `GET products/{produto}/checkouts/{checkout}/`  |
| Atualizar checkout        | `PUT products/{produto}/checkouts/{checkout}/`  |
| Consultar oferta          | `GET offers/jjnk3vv/`                           |
| Atualizar preço da oferta | `PUT offers/jjnk3vv/` com JSON do campo `price` |

Para alterar checkout dentro de uma tarefa autorizada: ler estado atual; salvar
snapshot em `cakto_private.checkout_backups` **e confirmar esse backup em chamada
separada antes da escrita**; reler e abortar se a configuração mudou; executar
uma operação de alvo fixo em bloco SQL anônimo, preservando `name`, `default` e
`visits`; confirmar status da API e formulário público. Não há helper persistente
de escrita instalado; não criar proxy público ou agendamento para uma alteração.
Para oferta, guardar também o estado anterior da oferta e conferir total final.
Não usar ID fixo de backup antigo em uma nova operação.

`checkout_backups` tem `id`, `captured_at`, `product_id`, `checkout_id`, `snapshot`
e `purpose`; RLS e privilégios privados. Consulta de inventário sem conteúdo:

```sql
select id, captured_at, product_id, checkout_id, purpose
from cakto_private.checkout_backups
order by id desc
limit 10;
```

Snapshots antigos contêm o preço de teste de R$ 5,00 e temas já rejeitados.
Nunca restaurar o snapshot inteiro por engano; identificar qual campo precisa
ser recuperado e preservar o resto. Backups 8/9 documentam as últimas mudanças
para o visual nativo; não são IDs a reutilizar em novas publicações.

### Checkout atual e cuidados conhecidos

- Visual **claro nativo**, nome/imagem do produto e formulário original. Nos dois
  dispositivos, `settings.payButton.color="#7c3aed"`, texto branco e
  `settings.text.color.active="#7c3aed"`. Sem blocos de vendas adicionais, chat
  flutuante, popup de saída ou notificações personalizados.
- Uma árvore `rows → columns → components` contendo um componente
  `type:"checkout"` por dispositivo (`desktop` e `mobile`). Preservar o componente;
  a API pode aceitar uma configuração que o omite e deixar de mostrar o formulário.
- `extra.chat`, `extra.exitPopup` e `extra.notification` usam wrappers
  `{id,type,attributes}`. A forma plana já foi aceita pela API e quebrou a página
  pública. HTTP 200 não basta para validar checkout.
- O tema escuro anterior foi retirado a pedido do proprietário: textos ricos
  trocavam de preto para branco durante carregamento e transmitiam insegurança.
  Não reintroduzir personalização pesada. Atributo `text.attributes.color` foi
  ignorado pelo renderizador; blocos de imagem também tiveram incompatibilidade
  entre API e frontend. A imagem nativa do produto funciona.
- Manter o rótulo de pagamento nativo, como “Gerar PIX”; não substituí-lo por
  chamada publicitária. Não gerar cobranças para verificar somente aparência.
- Preço configurado em 28/10/2026: oferta **R$ 18,91**, taxa do comprador
  observada **R$ 0,99**, total à vista **R$ 19,90**. Revalidar taxa/total antes de
  qualquer alteração de preço; parcelamento e outros meios podem ter condições
  próprias. Valor recebido pelo produtor não é o total pago pelo cliente.
- A condição de lançamento não tem limite anunciado de 100 compras, prazo,
  contador ou preço anterior riscado. Não reintroduzir escassez fictícia.

Referências: [Autenticação](https://docs.cakto.com.br/authentication),
[Checkout](https://docs.cakto.com.br/api-reference/checkouts/update),
[Builder](https://docs.cakto.com.br/conceitos/checkout-builder),
[Ofertas](https://docs.cakto.com.br/api-reference/offers/update).
Conferir contratos atuais antes de novas alterações.

## Planilhas, mídia e próximas tarefas

- Central `/financeiro`: `src/features/finance/config.ts` contém os quatro links
  reais (Google limpo/demonstração e Excel limpo/demonstração); `guide.ts` contém
  tutorial, dicas e FAQ. Não duplicar esses links em vários lugares.
- Google abre `/copy` em nova aba, mas o Android pode interceptar e abrir o modelo
  no Planilhas. O tutorial ensina menu de três pontinhos → Compartilhar e exportar
  → Fazer uma cópia. No computador, Arquivo → Fazer uma cópia; download Excel em
  Arquivo → Fazer download → Microsoft Excel (.xlsx). Ver [Financeiro](FINANCEIRO.md).
- Modelos externos e cópias dos compradores são independentes; o login Google do
  app não elimina eventual autenticação do Drive. Não editar originais para
  testar fórmulas; usar cópias. Não publicar planilhas pagas ou PDF completo no Git.
  A revisão anterior ampliou o espaço para 25 categorias de gastos e incluiu guia
  de cópia/download; revalidar os arquivos externos antes de prometer fórmulas ou
  compatibilidade, pois não são versionados junto com o app.
- Logos: `artes/vertice/` e seu README. Capturas reais públicas:
  `marketing/media/`. Galerias: `marketing/app-gallery.js`/`.css`; demos:
  `interactive-demo.js`/`.css`. Originais podem conter a barra do aparelho;
  enquadramentos SVG na página a recortam. Não reconstruir dados de capturas.
- Instagram atual **@usevertice.app**, WhatsApp **5551980614158**; o site continua
  `usevertice.app.br`. A página de vendas foi considerada finalizada. O checkout
  atual fica na Cakto e não é gerado pelo HTML do site.
- Próxima melhoria planejada, **ainda não implementada**: até cinco itens por card
  de categoria, pendentes primeiro, comprados completando vagas, ordem preservada
  em cada grupo; “+ N itens…” para excedentes, com singular quando necessário.
  Totais/status usam todos os registros; card abre a categoria completa. Trabalhar
  em `src/features/categories/pages/CategoriesPage.tsx` e estilos correspondentes,
  mantendo banco, fórmulas monetárias e detalhes dos itens.

Arquivos temporários de conversas, sessões de navegador, IDs de conexão e pastas
em `/workspace` não são dependências permanentes do projeto. Recomeçar pelos
arquivos do repositório e pelas verificações deste guia.
