# Mídias e conteúdo para substituir

Todos os espaços visíveis são placeholders declarados. Não há imagens inventadas do
produto, clientes fictícios publicados, números de vendas ou avaliações fabricadas.

## Checklist de arquivos reais

- [ ] **GIF/vídeo do app no mercado:** 10–15 segundos, vertical 9:16; ideal 540×960
  ou 1080×1920. Slot `app-market-demo`, seção `#demonstracao`. Mostrar marcação de
  produtos, valor e total. Não mostrar notificações, e-mail ou outros dados pessoais.
- [ ] **Foto do app no celular:** vertical 9:16, WebP/JPG. Slot `app-phone-photo`,
  seção “O app de compras”.
- [ ] **Foto ou captura real da planilha:** horizontal 16:10, ideal 1600×1000,
  WebP/PNG. Slot `spreadsheet-photo`, seção “A planilha financeira”. Usar o modelo
  de demonstração ou ocultar dados pessoais. O kit pago não deve virar download público.
- [ ] **Prints reais do app:** montagem horizontal 16:10 com lista, orçamento e total.
  Slot `real-app-screenshots`, seção `#na-vida-real`.
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
  <video controls playsinline preload="none" width="540" height="960"
    aria-label="Demonstração real do app Vértice durante uma compra no mercado">
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

`site-config.js` concentra `whatsapp`, `launchSlots` e `launchListOpen`.

- O número inclui país e DDD, somente dígitos: `5551980614158`.
- `launchSlots: 100` é a capacidade total do lote; não é contagem de vagas restantes.
- O proprietário confirma e controla as reservas pelo WhatsApp. Ao encerrar o lote,
  altere `launchListOpen` para `false`; a página retira a chamada de reserva e passa
  a oferecer conversa sobre a próxima disponibilidade. A lista não é um checkout.
- Antes de vender: definir checkout, prazo de entrega/liberação, canal oficial de
  atendimento e reembolso e prazo de atendimento. Garantia anunciada: 7 dias após
  a entrega do kit. O site não cobra nem concede licenças.
