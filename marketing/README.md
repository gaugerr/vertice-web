# Página de vendas do Vértice

Landing page estática, independente do aplicativo. Sem dependências, chamadas ao
Supabase, coleta de dados ou arquivos pagos do kit no build.

## Publicação

No Cloudflare Pages, projeto `vertice-kit`, repositório `gaugerr/vertice-web`, branch
`main`, diretório raiz `/marketing`, comando `node build.mjs`, saída `dist`, Node 24.
Produção: <https://usevertice.app.br>. Endereço alternativo:
<https://vertice-kit.pages.dev>. Aplicativo: <https://app.usevertice.app.br>.

Para gerar os arquivos, execute `node build.mjs` dentro de `marketing/`.

## Produto e oferta

- R$ 19,90, pagamento único, condição prevista para as primeiras 100 compras aprovadas.
- Vendas ainda em preparação. O botão abre um aviso, sem receber pagamentos.
- Integrar checkout, limite real da oferta, entrega, atendimento e condições de
  reembolso antes de abrir as vendas. Não usar contador fictício ou depoimentos inventados.
- App e planilha são separados. O total da compra é digitado manualmente na planilha.
- Recibo e painel são ilustrações, identificadas na página. O botão de exemplo só
  altera a ilustração local; não grava dados no app nem na planilha do comprador.
- A compra do app exige licença liberada; os registros ficam no navegador, sem backup
  automático. A autorização offline precisa de renovação online em até sete dias.
- Não incluir XLSX, scripts de preparação do kit ou links públicos de download pagos.
