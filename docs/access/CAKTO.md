# Integração Cakto — etapa 1: captura passiva

Esta branch prepara o recebimento autenticado de notificações. **Não libera nem
revoga licenças**, não envia e-mails e não publica configurações na Cakto. A função
fica desativada por padrão. Nenhuma mudança precisa ser feita no Google OAuth,
nos domínios autorizados ou no login atual.

## O que está preparado

- `supabase/functions/cakto-webhook/`: adaptador Edge e handler independente,
  validando HMAC-SHA256 sobre o corpo original e timestamp com tolerância de cinco
  minutos. Não aceita autenticação pelo `secret` do corpo como alternativa à
  assinatura. Não exige sessão Google, pois o chamador é o servidor da Cakto.
- Formatos V1 (objeto) e V2 (lista), até 25 pedidos por entrega e 128 KiB por corpo.
  Esses limites são nossos; conferir uma entrega real antes de ativar.
- Captura de `purchase_approved`, `refund` e `chargeback`, somente dos IDs de
  produto configurados. Status como `MED` são preservados para análise futura.
  Não interpreta o status como direito de acesso nesta etapa.
- Tabela `access_private.cakto_events` com RLS, sem acesso de clientes. A RPC
  `public.cakto_capture_events` só pode ser executada pelo `service_role`, usa
  direitos do invocador e armazena cada lote em uma transação.
- O hash dos campos normalizados identifica uma observação; repetições aumentam
  `seen_count` e atualizam `last_received_at`. Uma mudança de evento, status ou
  dados relevantes preserva outra observação do mesmo pedido. A chave **não** é
  uma decisão de concessão; o processador futuro precisa reconciliar o pedido.
- O armazenamento retém apenas pedido/produto/oferta, e-mail, evento, status e
  datas. Não guarda o corpo original, segredo, assinatura, CPF, telefone ou cartão.

## Configuração futura (não executar para ativar vendas ainda)

As variáveis são **somente do servidor**, sem prefixo `VITE_`:

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
4. Só conectar vendas reais depois de implementar e revisar o processamento de
   licenças, a recuperação de falhas e a visibilidade administrativa abaixo.

## Respostas e falhas

`200` confirma que todos os pedidos relevantes foram persistidos, ou que o evento
foi ignorado por produto/tipo não configurado. A resposta indica `mode: capture`;
**não significa acesso liberado**. `401` rejeita assinatura inválida/antiga;
`400` rejeita estrutura inválida; `413` limita o corpo; `415` exige JSON;
`405` exige POST; `503` indica configuração ausente, desativação ou erro interno.
Um membro inválido de lote relevante impede a captura inteira; é preciso corrigir
e reenviar. Não existe confirmação antecipada seguida de gravação em background.

A documentação da Cakto informa que resposta HTTP não-2xx, inclusive 500/503,
**não recebe nova tentativa automática**. Falhas de rede/timeout podem ser
retentadas. Até existir recuperação automática, acompanhar o histórico da Cakto
e reenviar manualmente falhas de entrega. Não habilitar a captura em produção
como se ela já fosse a entrega do produto.

## Próxima etapa antes de liberar automaticamente

- Confirmar produto/oferta, payload real e instrução para usar o mesmo e-mail da
  conta Google na compra. Preservar `+` e pontos; não inventar equivalências entre
  endereços.
- Criar registros de pedidos e concessões separados das licenças manuais. Tratar
  várias compras por e-mail e bloqueios administrativos; não sobrescrever uma
  revogação manual nem revogar outra compra válida.
- Reconciliar aprovações, reembolsos e contestações com o estado atual do pedido,
  inclusive eventos fora de ordem, antes de alterar uma licença.
- Criar processador transacional, tentativas internas, rotina de conciliação das
  entregas perdidas e histórico/reprocessamento no painel do administrador.
- Definir retenção dos eventos e observabilidade sem dados sensíveis. Esta etapa
  não cria cron de limpeza, alertas ou processador de fila.
- Validar compra controlada e reembolso de ponta a ponta, com acompanhamento.
  Manter liberação manual e mecanismo para pausar o processamento.
- Documentar o limite da revogação offline (até sete dias atualmente) e que cópias
  de Google Planilhas/Excel já entregues não podem ser recolhidas.

## Verificação

`npm run typecheck:cakto` e `npm run test:cakto` verificam o handler com dados
sintéticos. `supabase test db` executa `supabase/tests/cakto_capture.sql` no banco
**local**, incluindo permissões, deduplicação, lote atômico e preservação de
licenças. A CI de acesso já executa os testes SQL com Supabase isolado.
O adaptador Deno deve ser conferido com o import map existente antes da publicação.
`tools/test-cakto-integration.mjs` é executado pela CI com o Supabase isolado e
valida a entrega assinada através da função Edge e da RPC até o banco. O script
recusa qualquer URL diferente de `http://127.0.0.1:54321`.

Referências oficiais: [Webhooks Cakto](https://docs.cakto.com.br/conceitos/webhooks)
e [autenticação de Edge Functions](https://supabase.com/docs/guides/functions/auth).
