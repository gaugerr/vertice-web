# Personalização do checkout Cakto

Proposta visual em `/checkout-preview.html`, usando a mesma árvore de componentes
de `marketing/checkout-proposal.json`. O formulário é uma ilustração sem inputs,
envio, criação de pedido ou cobrança. A renderização nativa da Cakto pode diferir.
Não ligar essa prévia aos botões de compra da página de vendas.

## Estado e aprovação

- Checkout principal: `1241258`, produto `988379d3-cbaa-465f-930b-14aa7d48422e`.
- Link preservado: <https://pay.cakto.com.br/jjnk3vv_1241258>.
- Configuração original lida em 28/10/2026: `config: null`.
- Backup original privado no Supabase, `cakto_private.checkout_backups`, registro 1.
- Somente leituras foram feitas na API Cakto. Não foi publicado o tema proposto.
- Usuário confirmou R$ 19,90 como valor pretendido. A leitura pública mostrou
  R$ 5,00 de oferta + R$ 0,99 de taxa, total R$ 5,99. A proposta mostra o total
  desejado, e não uma alteração já aplicada. Confirmar tratamento da taxa antes
  da publicação. O JSON do tema não altera preços, ofertas ou taxas.

## Publicação futura

Após aprovação visual, reler o checkout, comparar com o backup e preservar nome,
`default`, ofertas associadas e contador atualizado de visitas. Não sobrescrever
mudanças concorrentes. Verificar preço e repasse da taxa separadamente no editor
da oferta; não inferir que o preço do produto controla todas as ofertas.

Enviar o tema pelos endpoints documentados da Cakto, mantendo um componente
`checkout` em cada versão desktop/mobile. Validar a resposta e abrir o checkout
real nos dois tamanhos antes de considerar concluído. Validar texto do botão
nativo por meio de pagamento. Não criar pedido de teste pago sem autorização.

Se houver falha visual, restaurar a configuração original do backup, preservando
os contadores e metadados atuais. A oferta continua vinculada ao mesmo checkout.

Credenciais ficam no Vault do servidor. Nenhuma chave, token ou valor de secret
deve entrar nesta pasta, no frontend, nos logs ou nos artefatos de prévia. A ponte
privada de leitura não tem agendamento nem endpoint público e não deve ser
convertida em proxy genérico. A prévia não depende dessa ponte em tempo de uso.

Referências oficiais:

- <https://docs.cakto.com.br/conceitos/checkout-builder>
- <https://docs.cakto.com.br/api-reference/checkouts/update>
