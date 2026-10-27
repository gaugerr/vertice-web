# Página de vendas do Kit Vértice

Produção: <https://usevertice.app.br>. App: <https://app.usevertice.app.br>.
Repositório `gaugerr/vertice-web`, branch `main`, diretório `marketing/`.
Cloudflare Pages `vertice-kit`: raiz `/marketing`, comando `node build.mjs`, saída
`dist`, Node 24. O app usa outro projeto e não foi alterado por esta página.

## Código completo

- `index.html`: página, checkout, 17 perguntas, oferta e placeholders comentados.
- `styles.css`: identidade visual existente; `conversion.css`: novas seções.
- `script.js`: links do checkout, suporte pelo WhatsApp e chamada fixa no celular.
- `interactive-demo.js` e `interactive-demo.css`: prévias do app e do painel financeiro.
- `app-gallery.js` e `app-gallery.css`: galeria responsiva de telas reais e ampliação.
- `site-config.js`: checkout Cakto, telefone de suporte e capacidade total do lote.
- `media/`: capturas reais do app e espaço reservado para o painel da planilha.
- `social.png`: imagem social real de marca, PNG 1200×630; fonte `social.svg`.
- `MIDIAS_E_CONTEUDO.md`: checklist e instruções para substituir todo conteúdo provisório.

Para gerar o site, execute `node build.mjs` dentro desta pasta. Não há dependências
nem servidor próprio. O build não inclui instruções internas nem arquivos pagos.

## Compra e atendimento

Todos os CTAs de compra levam diretamente a
<https://pay.cakto.com.br/jjnk3vv_1241258>. O endereço fica em `checkoutUrl` no
`site-config.js`, com links reais no HTML para funcionar sem JavaScript. Ao trocar
o checkout, atualizar também esses fallbacks. O WhatsApp **(51) 98061-4158** é usado
somente para dúvidas e suporte, sem formulário de lista de espera.

O pagamento acontece na Cakto. Este site não coleta nome ou contato, não salva
leads nem processa pagamentos. Não há cookies de marketing ou chamadas ao Supabase
na página de vendas. A liberação ocorre no app, pela integração Cakto existente,
após a confirmação do pagamento. O comprador deve informar no checkout o mesmo
e-mail da conta Google que usará no app. As planilhas e o tutorial são acessados
pela seção Vértice Financeiro.

## Oferta e limites reais

Pagamento único, R$ 19,90 para as 100 primeiras compras; R$ 59,00 é referência para
após o lançamento, não um histórico de vendas. `launchSlots` é o tamanho TOTAL do
lote, nunca um contador de vagas restantes. O proprietário deve manter o preço e
a condição de lançamento coerentes entre página e checkout.

A garantia anunciada é de 7 dias após a entrega, com solicitação de reembolso pela
Cakto ou atendimento pelo WhatsApp. Não há promessa de versões pagas futuras
incluídas nem de disponibilidade eterna de serviços online.

App e planilha são independentes; o total é registrado manualmente na planilha.
Compras ficam no navegador, sem sincronização automática. Backup é feito por arquivo;
a autorização offline precisa de renovação online em até sete dias.

Os três depoimentos de exemplo estão em um template inerte e não aparecem como
prova social. As capturas do app são reais; o painel da planilha continua reservado.
Não publicar os arquivos pagos do kit nem dados pessoais de quem usa o produto.

## Demonstrações interativas

O resumo do app permite abrir categorias, marcar itens, editar preços e orçamento.
O painel financeiro tem receitas, quatro gastos de exemplo, distribuição por
categoria, entradas/saídas, comparação com orçamento e formas de pagamento.
As abas Lançamentos, Orçamento e Metas são editáveis. Os gráficos mostram os
valores do mês de exemplo, sem inventar histórico. Valores são somados em
centavos inteiros; entradas inválidas preservam o último resultado válido.

Todo estado existe só na memória da página. Não há envio, persistência, importação
de compras reais ou alteração dos arquivos pagos. As duas prévias são independentes;
não há card nem botão para transferir o total entre os exemplos. As telas reais do
app ficam em `media/`; a captura da planilha continua pendente.

O início apresenta explicitamente o app de lista de compras inteligente e offline
e a planilha de controle financeiro completa, com dashboard e gráficos. A nota de
uso offline informa o preparo e a validação do acesso.
