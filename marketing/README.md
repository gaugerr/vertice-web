# Página de vendas do Kit Vértice

Produção: <https://usevertice.app.br>. App: <https://app.usevertice.app.br>.
Repositório `gaugerr/vertice-web`, branch `main`, diretório `marketing/`.
Cloudflare Pages `vertice-kit`: raiz `/marketing`, comando `node build.mjs`, saída
`dist`, Node 24. O app usa outro projeto e não foi alterado por esta página.

## Código completo

- `index.html`: página, formulário, 17 perguntas, oferta e placeholders comentados.
- `styles.css`: identidade visual existente; `conversion.css`: novas seções.
- `script.js`: recibo, exemplo manual, formulário e chamada ao WhatsApp.
- `site-config.js`: telefone, capacidade total do lote e abertura da lista.
- `media/`: espaços reservados para fotos/GIFs reais, com proporções fixas.
- `social.png`: imagem social real de marca, PNG 1200×630; fonte `social.svg`.
- `MIDIAS_E_CONTEUDO.md`: checklist e instruções para substituir todo conteúdo provisório.

Para gerar o site, execute `node build.mjs` dentro desta pasta. Não há dependências
nem servidor próprio. O build não inclui instruções internas nem arquivos pagos.

## Lista de espera e privacidade

O formulário exige nome, e-mail ou WhatsApp e consentimento. Ele prepara uma mensagem
para **(51) 98061-4158** e abre `wa.me/5551980614158`. A pessoa precisa tocar em Enviar
no WhatsApp. A página não consegue verificar esse envio nem confirmar a reserva.
A confirmação deixa isso explícito, apresenta um link para tentar novamente e
permite revisar os dados. Não há banco de leads, localStorage, cookies de marketing,
chamada ao Supabase, disparo automático de mensagens ou dados pessoais na URL do site.
O contato só segue para o WhatsApp no link de mensagem preparado pelo usuário.

O proprietário controla manualmente a lista e confirma a condição de lançamento.
`launchSlots` é o tamanho TOTAL do lote, nunca uma contagem de vagas restantes.
O botão fixo e os CTAs levam diretamente a `#lista-de-espera`. Ao encerrar o lote,
use `launchListOpen: false` para retirar a promessa de reserva.

## Oferta e limites reais

Pagamento único, R$ 19,90 para as 100 primeiras compras; R$ 59,00 é referência para
após o lançamento, não um histórico de vendas. O cadastro não cobra nem libera acesso.
A garantia anunciada é de 7 dias após a entrega, com reembolso integral mediante
solicitação ao atendimento. Canal oficial, prazo de atendimento, checkout e prazo
de liberação devem ser definidos antes de abrir vendas. A licença é vinculada ao
e-mail Google informado e liberada manualmente. Não há promessa de versões pagas
futuras incluídas nem de disponibilidade eterna de serviços online.

App e planilha são independentes; o total é registrado manualmente na planilha.
Compras ficam no navegador, sem sincronização automática. Backup é feito por arquivo;
a autorização offline precisa de renovação online em até sete dias.

Os três depoimentos de exemplo estão em um template inerte e não aparecem como
prova social. As fotos e a demonstração em vídeo são espaços reservados declarados.
Não publicar os arquivos pagos do kit nem dados pessoais de quem usa o produto.
