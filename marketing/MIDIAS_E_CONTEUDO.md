# Mídias e conteúdo para substituir

As capturas reais do aplicativo e da planilha substituem os espaços reservados.
A planilha usa o modelo de demonstração com valores de exemplo. Não há imagens
inventadas do produto, clientes fictícios, vendas ou avaliações fabricadas.

## Checklist de arquivos reais

- [ ] **GIF/vídeo do app no mercado:** 10–15 segundos, vertical 9:16; ideal 540×960
      ou 1080×1920. Slot `app-market-demo`, seção `#demonstracao`. Mostrar marcação de
      produtos, valor e total. Não mostrar notificações, e-mail ou outros dados pessoais.
- [x] **Captura completa do app no celular:** `app-captura-completa.jpg`, com
      total de R$ 94,12 e os itens da compra. O enquadramento remove somente os 36 px
      superiores da barra de notificações, preservando toda a largura e o restante
      da altura. Slots `app-phone-photo` e `app-market-demo`.
- [x] **Painel real da planilha:** `planilha-dashboard.webp`, 2161×1600, no slot
      `spreadsheet-photo`. Cabeçalho, indicadores e quatro gráficos preservados.
      O link abre a ampliação e funciona sem JavaScript abrindo o WebP.
- [x] **Telas variadas da planilha:** `planilha-lancamentos.webp`,
      `planilha-contas-fixas.webp`, `planilha-orcamento.webp`, `planilha-metas.webp`
      e `planilha-resumo-anual.webp`, no carrossel `#planilha-em-detalhes`.
      Todos são recortes da exportação PDF gerada pelo Google a partir do modelo
      de demonstração atual. Não são interfaces reconstruídas nem capturas do
      computador pessoal. Orçamento e resumo anual têm miniaturas com recorte
      superior; a ampliação mostra a região completa de cada imagem. Valores são
      exemplos, incluindo previsões de contas fixas futuras no resumo anual.
      A ampliação tem rolagem para ler as colunas. Não publicar a exportação PDF
      completa ou arquivos de planilha pagos junto das imagens.
- [x] **Telas reais do app:** galeria em `#na-vida-real`, com cinco originais JPG:
      `app-orcamento`, `app-categorias`, `app-comparador`, `app-sugestoes` e
      `app-historico`. Três cartões no desktop, dois no tablet e rolagem por toque
      no celular. Os links abrem as imagens sem JavaScript; com JavaScript, abrem
      um diálogo ampliado, com Escape, retorno de foco e navegação por setas.
      Enquadramentos SVG destacam orçamento, categoria, resultado da comparação,
      sugestões e referência de preço. A barra de notificações fica fora da
      miniatura e da ampliação. Não reconstruir a interface nem tratar os valores
      do exemplo como economia garantida. A captura de histórico mostra um preço
      ainda em edição.
- [x] **Resumo real da compra:** `app-captura-completa.jpg` no slot `app-market-demo`.
      É uma captura estática identificada, não um vídeo. O vídeo acima segue opcional.
- [ ] **Três depoimentos reais:** texto original curto, autorização de publicação e
      identificação combinada com o autor. Nome completo, foto e avaliação em estrelas
      não são necessários. Os três textos de exemplo estão no `<template
id="testimonials-placeholder">`, marcados `PLACEHOLDER`, e não são exibidos.
- [x] **Imagem social:** `social.png`, PNG 1200×630, já criada com tipografia e cores
      da marca. Fonte vetorial: `social.svg`. Substituir é opcional. Uma eventual nova
      versão deve manter 1200×630 e o nome `social.png` ou atualizar as metatags.

## Como substituir uma foto ou GIF

1. Copie o arquivo real para `marketing/media/`.
2. Em `index.html`, localize o comentário `TROCAR` ou o atributo `data-media-slot`.
3. Troque o `src` pelo caminho `/media/seu-arquivo.webp` ou `.gif`.
4. Atualize o `alt` para descrever o conteúdo real; mantenha `width`, `height`,
   `loading="lazy"` e `decoding="async"` para preservar proporção e carregamento.
5. Remova `data-placeholder="true"` e o aviso “MÍDIA REAL EM PREPARAÇÃO”. Escreva
   uma legenda curta que corresponda ao arquivo mostrado.

Exemplo de vídeo no lugar da imagem do primeiro slot:

```html
<!-- TROCAR: GIF do app no mercado, 10-15s, vertical -->
<figure class="media-slot media-slot-portrait" data-media-slot="app-market-demo">
  <video
    controls
    playsinline
    preload="none"
    width="540"
    height="960"
    aria-label="Demonstração real do app Vértice durante uma compra no mercado"
  >
    <source src="/media/app-no-mercado.mp4" type="video/mp4" />
    Seu navegador não suporta este vídeo. Use a lista ilustrativa acima.
  </video>
  <figcaption>Marque os produtos e acompanhe o total durante a compra.</figcaption>
</figure>
```

`preload="none"` evita baixar o vídeo antes de a pessoa interagir. Use controles;
não habilite reprodução automática com som. As fotos/GIFs já têm carregamento lazy.

## Depoimentos

Substitua os três exemplos pelo texto real e autorizado, atualize as legendas e só
então mova `.testimonial-grid` de dentro do `<template>` para a seção visível.
Remova a mensagem de que os relatos ainda estão sendo reunidos. Não publique os
exemplos como se fossem experiências de compradores.

## Controles manuais

`site-config.js` concentra `checkoutUrl`, `whatsapp` e `launchSlots`.

- O checkout oficial é <https://pay.cakto.com.br/jjnk3vv_1241258>. Se mudar,
  atualize também os links `data-checkout-link` no HTML, que funcionam sem JavaScript.
- O número de suporte inclui país e DDD, somente dígitos: `5551980614158`.
- `launchSlots: 100` é a capacidade total do lote; não é contagem de vagas restantes.
- O pagamento é feito na Cakto. A página não coleta contatos nem faz reservas.
  Mantenha os preços e as condições coerentes entre página e checkout.
- Acesso automático após a confirmação do pagamento, usando a mesma conta Google
  informada na compra. Planilhas e tutorial ficam em Vértice Financeiro, no app.
  Garantia anunciada: 7 dias após a entrega do kit, com solicitação de reembolso
  pela Cakto e suporte pelo WhatsApp.
