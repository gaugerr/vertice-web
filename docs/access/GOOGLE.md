# Primeiro passo: criar o login Google

Você não precisa comprar domínio nem criar senha para o Vértice. Use a conta Google que administra o projeto e não envie senhas ou segredos pelo chat.

1. Abra https://console.cloud.google.com/ e crie ou selecione um projeto para o Vértice.
2. Procure **Google Auth Platform** (ou **APIs e serviços → Tela de consentimento OAuth**, dependendo do painel). Preencha o nome Vértice e os e-mails de suporte/contato solicitados.
3. Escolha público **Externo**. Enquanto estiver configurando, mantenha em **Teste** e adicione `gustavojosiasg@gmail.com` em **Usuários de teste**. Os futuros compradores só conseguirão entrar depois de publicar o aplicativo OAuth; confirme os requisitos mostrados pelo Google nessa etapa.
4. Em **Clientes → Criar cliente**, escolha **Aplicativo da Web**. Nome sugerido: `Vértice`.
5. Em **URIs de redirecionamento autorizados**, adicione exatamente:

   `https://wqutcsjdozcukwxvkbtc.supabase.co/auth/v1/callback`

   Esse endereço é do Supabase. O endereço `/auth/callback` do app entra na configuração de Redirect URLs do Supabase, no próximo passo.

6. Copie o **ID do cliente** e o **segredo do cliente** diretamente para **Supabase → projeto vertice-web → Authentication → Sign In / Providers → Google**. Ative o provedor e salve. O segredo fica somente no Supabase.
7. Em **Supabase → Authentication → URL Configuration**, configure Site URL como `https://use-vertice.vercel.app` e adicione `https://use-vertice.vercel.app/auth/callback` aos Redirect URLs. Inclua também a URL exata do preview com `/auth/callback`. Encontre a URL pelo botão **Visit** no deploy da branch `feat/google-access` na Vercel. Não use o endereço do painel `vercel.com/...` nem uma lista de previews com curinga.
8. Depois, conclua os segredos de assinatura e as origens permitidas descritos em [SETUP.md](./SETUP.md). Só então faça o primeiro login real com `gustavojosiasg@gmail.com` para que possamos vincular o administrador ao UUID verdadeiro da sua conta.

Os únicos escopos usados pelo app são `openid email profile`. Não há acesso à caixa de e-mail, Drive ou senha Google. Email/senha, telefone e login anônimo devem ficar desativados no projeto hospedado.
