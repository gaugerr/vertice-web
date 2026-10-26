# Integração Cakto — captura e processamento preparados

A branch prepara recebimento autenticado e processamento de notificações para
licenças. **Tudo começa desativado.** A configuração real da Cakto, os secrets,
a publicação das funções e a ativação dos produtos/jobs não são executados pelo
merge. Não envia e-mails. Nenhuma mudança é necessária no Google OAuth, nos
domínios autorizados ou no login atual.

## Produto identificado para a configuração

| Campo        | Valor                                              | Origem                      |
| ------------ | -------------------------------------------------- | --------------------------- |
| Produto      | Kit Vértice — App de Compras + Planilha Financeira | Checkout público            |
| ID completo  | `988379d3-cbaa-465f-930b-14aa7d48422e`             | Informado pelo proprietário |
| Código curto | `3dyrkrb`                                          | Checkout público            |
| Oferta       | `jjnk3vv`                                          | Checkout público            |
| Checkout     | <https://pay.cakto.com.br/jjnk3vv_1241258>         | Informado pelo proprietário |

O checkout consultado exibia pagamento único de R$ 19,90. Esse preço é uma
referência comercial, não uma condição fixa de autorização: cupons e ofertas
futuras não devem ser rejeitados apenas por mudar o valor pago.

`supabase/cakto-capture.env.example` prepara o ID completo com captura desativada
e segredo vazio. É um modelo de configuração de servidor; não é carregado
automaticamente e não contém credenciais. A função continua exigindo configuração
explícita do ambiente. Conferir o par `data.product.id` / `data.product.short_id`
em uma entrega real assinada antes de habilitar a integração. O código da oferta
e o sufixo do checkout não substituem o ID completo do produto.

## O que está preparado

- `supabase/functions/cakto-webhook/`: adaptador Edge e handler independente,
  validando HMAC-SHA256 sobre o corpo original e timestamp com tolerância de cinco
  minutos. Não aceita autenticação pelo `secret` do corpo como alternativa à
  assinatura. Não exige sessão Google, pois o chamador é o servidor da Cakto.
- Formatos V1 (objeto) e V2 (lista), até 25 pedidos por entrega e 128 KiB por corpo.
  Esses limites são nossos; conferir uma entrega real antes de ativar.
- Captura de `purchase_approved`, `refund` e `chargeback`, somente dos IDs de
  produto configurados. A captura não concede acesso; o processador aplica as
  regras de autorização descritas abaixo, incluindo o tratamento de `MED`.
- Tabela `access_private.cakto_events` com RLS, sem acesso de clientes. A RPC
  `public.cakto_capture_events` só pode ser executada pelo `service_role`, usa
  direitos do invocador e armazena cada lote em uma transação.
- O hash dos campos normalizados identifica uma observação; repetições aumentam
  `seen_count` e atualizam `last_received_at`. Uma mudança de evento, status ou
  dados relevantes preserva outra observação do mesmo pedido. A chave **não** é
  uma decisão de concessão; o processador avalia o histórico observado do pedido.
- O armazenamento retém apenas pedido/produto/oferta, e-mail, evento, status e
  datas. Não guarda o corpo original, segredo, assinatura, CPF, telefone ou cartão.

## Configuração futura (não executar para ativar vendas ainda)

As variáveis são **somente do servidor**, sem prefixo `VITE_`. Além da captura,
`CAKTO_PROCESSING_ENABLED=true` solicita processamento logo após a gravação. A
chamada SQL exige `apply_changes=true` e um produto com
`access_private.cakto_products.processing_enabled=true`. O produto real é criado
**desativado** pela migração. O modelo de ambiente mantém as duas flags em `false`.

As variáveis da captura são:

| Variável                                     | Uso                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `CAKTO_CAPTURE_ENABLED`                      | Só o valor exato `true` permite capturar; ausente fica desativado.                                |
| `CAKTO_WEBHOOK_SECRET`                       | Segredo gerado na Cakto, cadastrado de forma segura no Supabase. Nunca colocar no Git ou no chat. |
| `CAKTO_PRODUCT_IDS`                          | IDs completos dos produtos autorizados, separados por vírgula; conferir V1/V2 real.               |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Configuração já fornecida pelo ambiente Edge, nunca pelo navegador.                               |

A função futura terá o caminho `/functions/v1/cakto-webhook` no projeto escolhido.
Antes de cadastrar uma URL de produção:

1. Revisar e aplicar a migração em ambiente de teste, publicar a função e definir
   segredo/IDs **de teste**, mantendo as configurações atuais de acesso.
2. Confirmar com uma entrega assinada se a versão do webhook e os campos reais
   correspondem ao contrato. O teste fixo da Cakto não representa o produto real:
   um produto não configurado será ignorado, mesmo com resposta HTTP 200.
3. Conferir os registros privados e as contagens de repetição. Clientes não têm
   endpoint para consultar ou inserir eventos. Não usar logs de corpos de requisição
   para depuração: o segredo também trafega no JSON enviado pela Cakto.
4. Só conectar vendas reais depois da revisão das regras abaixo, da instalação
   das tentativas periódicas e da validação de uma entrega real assinada.

## Respostas e falhas

`200` confirma que todos os pedidos relevantes foram persistidos, ou que o evento
foi ignorado por produto/tipo não configurado. Sem processamento, a resposta indica
`mode: capture`. Com processamento, indica
`mode: process` e `processing: attempted` ou `pending`. **Nenhuma dessas respostas
confirma uma licença individual**: confirmam recebimento durável e, quando
solicitado, uma tentativa de processar a fila. O login consulta o direito efetivo.
`401` rejeita assinatura inválida/antiga;
`400` rejeita estrutura inválida; `413` limita o corpo; `415` exige JSON;
`405` exige POST; `503` indica configuração ausente, desativação ou erro interno.
Um membro inválido de lote relevante impede a captura inteira; é preciso corrigir
e reenviar. Não existe confirmação antecipada seguida de gravação em background.

A documentação da Cakto informa que resposta HTTP não-2xx, inclusive 500/503,
**não recebe nova tentativa automática**. Falhas de rede/timeout podem ser
retentadas. Até existir recuperação automática, acompanhar o histórico da Cakto
e reenviar manualmente falhas de entrega. Não habilitar a captura em produção
como se ela já fosse a entrega do produto.

## Regras de liberação e revogação

- Só `purchase_approved` com status `paid` constitui uma aprovação. Pagamento
  pendente ou combinação de evento/status desconhecida fica para revisão.
- A decisão agrega as observações já recebidas do mesmo pedido. Reembolso,
  chargeback, MED ou datas de devolução/contestação bloqueiam esse pedido.
  Uma aprovação atrasada não desfaz esse bloqueio, independentemente da ordem de
  chegada. Recuperação de contestação no mesmo pedido exige conferência manual.
- `access_private.cakto_orders` preserva a identidade inicial do pedido. E-mails
  ou produtos conflitantes não transferem acesso: geram revisão. O processador
  considera o histórico recebido, **não consulta a API da Cakto nesta etapa**.
- O direito automático considera todos os pedidos processados do e-mail. Um
  reembolso preserva outra compra válida. Uma nova compra pode reativar uma
  licença automática esgotada, mantendo o mesmo UID Google.
- Todas as licenças anteriores e novas concessões manuais têm origem `manual` e
  ficam fora das alterações automáticas, inclusive as revogadas.
- Nas licenças automáticas, `manual_override` registra a decisão do produtor:
  revogar manualmente bloqueia futuras reativações automáticas; reativar
  manualmente mantém o acesso mesmo após reembolso. A interface administrativa
  explica essa consequência na confirmação.
- O histórico da licença reúne as ações humanas e automáticas, identificadas como
  Cakto. As ações automáticas têm auditoria própria, sem inventar um usuário
  administrador. Só transições efetivas alteram a versão da licença.
- A licença pode ser criada antes do primeiro login; a vinculação continua usando
  a identidade Google verificada no `access_license_check` existente.

## Falhas, tentativas e pausa

`public.cakto_process_pending(true, 20)` é exclusiva do servidor, usa direitos do
invocador e processa um lote limitado. Um lock transacional evita dois workers
simultâneos. Cada decisão de pedido, mudança de licença e auditoria são atômicas.
Uma falha reverte as três e deixa o evento recuperável; o texto do erro SQL nunca
é guardado. Há até cinco tentativas, com intervalos crescentes; depois o evento
fica em `review` com `retry_exhausted` para intervenção.

A função é chamada depois da captura quando a flag do servidor está habilitada.
`supabase/cakto-retry-job.sql` prepara dois jobs **inativos**: recuperação a cada
cinco minutos (`*/5 * * * *`) e limpeza diária do histórico de execução às 04:15
UTC. A limpeza remove somente registros encerrados há mais de sete dias desses
dois jobs em `cron.job_run_details`; preserva eventos de pagamento, pedidos,
licenças, auditoria e histórico de outros jobs. Reexecutar o script pausa os dois
jobs, inclusive se já estiverem ativos.

O script depende da extensão `pg_cron` e deve ser executado deliberadamente no
projeto certo. Depois de revisar os comandos, ativar ambos pelo painel Cron ou
com `cron.alter_job(job_id := <id do job>, active := true)`. A recuperação não
precisa de outra venda: chama a função diretamente no Postgres, sem segredos,
requisições HTTP ou invocações adicionais de Edge Functions. São 8.640 execuções
em 30 dias; CPU e histórico continuam consumindo recursos do banco. O intervalo
de cinco minutos é da recuperação, não um atraso obrigatório na compra: a
tentativa imediata continua no webhook quando habilitada.

Para pausar **todo** processamento, desabilitar o produto em `cakto_products`;
isso não revoga acessos existentes. A flag de ambiente desliga somente a tentativa
imediata no webhook; um job SQL já ativo continua independente dela. O script
fornecido não é executado pela migração nem pela CI.

Em 26/10/2026, os dois jobs foram instalados e ativados no projeto Vértice, com
recuperação a cada cinco minutos e limpeza restrita a sete dias. A execução direta
do processador retornou zero alterações e o resumo criptográfico das licenças foi
preservado. O produto permanece com `processing_enabled=false`: o agendamento
está ativo, mas a liberação/revogação automática geral ainda está pausada.

## Antes de ativar vendas reais

1. Revisar as migrações, o produto e as decisões para bloqueios manuais. Confirmar
   com uma entrega real o par de IDs e o formato V1/V2. Usar o e-mail Google na
   compra, preservando `+` e pontos sem inventar equivalências entre endereços.
2. Publicar/configurar em ambiente de teste; criar e observar o job de recuperação,
   começando inativo. O segredo deve ser cadastrado com segurança no Supabase.
3. Conferir o histórico de entregas da Cakto e definir conciliação de eventos que
   nunca chegaram ao banco. A fila recupera falhas **após a captura**; ela não
   descobre sozinha vendas/reembolsos perdidos na origem. Conciliação pela API,
   alertas, retenção e painel de fila/revisão são etapas operacionais pendentes.
4. Validar compra controlada, login e reembolso de ponta a ponta. Habilitar o
   produto e as flags só na ativação acordada, confirmando que o job está ativo e
   mantendo atendimento e
   liberação manual disponíveis. Revisar a política de privacidade para os novos
   registros de pedidos.
5. Preservar o limite da revogação offline (até sete dias atualmente) e informar
   que cópias de Google Planilhas/Excel já entregues não podem ser recolhidas.

## Verificação

`npm run typecheck:cakto` e `npm run test:cakto` verificam o handler com dados
sintéticos. `supabase test db` executa `supabase/tests/cakto_capture.sql` no banco
**local**, incluindo permissões, deduplicação, lote atômico e preservação de
licenças. `cakto_processing.sql` cobre concessões, várias compras, revogações,
ordem de chegada, overrides, histórico, rollback e recuperação de falhas.
A CI de acesso já executa os testes SQL com Supabase isolado.
O adaptador Deno deve ser conferido com o import map existente antes da publicação.
`tools/test-cakto-integration.mjs` é executado pela CI com o Supabase isolado e
valida captura desativada por produto e, depois, aprovação assinada, criação de
licença, vinculação à identidade Google local, autorização assinada, reembolso e
nova compra, sem tocar em dados reais. O script recusa qualquer URL diferente de
`http://127.0.0.1:54321`.

Referências oficiais: [Webhooks Cakto](https://docs.cakto.com.br/conceitos/webhooks)
e [autenticação de Edge Functions](https://supabase.com/docs/guides/functions/auth).

Agendamento: [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart).
