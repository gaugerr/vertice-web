# Acesso Google e licenças

A implementação fica na branch `feat/google-access`. A produção continua em `legacy` até o primeiro login real e a migração do proprietário serem verificados. Não há sincronização de compras nesta entrega.

## Configuração externa necessária

1. No Google Cloud, crie um aplicativo OAuth externo para Web, com escopos apenas `openid`, `email`, `profile`. Enquanto estiver em teste, adicione `gustavojosiasg@gmail.com` como usuário de teste. Para vender, publique o aplicativo OAuth e revise os requisitos mostrados pelo Google; manter em teste restringe compradores.
2. URI autorizada de redirecionamento do Google: `https://wqutcsjdozcukwxvkbtc.supabase.co/auth/v1/callback`. O segredo Google vai somente no painel Supabase → Authentication → Sign In / Providers → Google. Não envie esse segredo pelo chat.
3. Supabase Authentication → URL Configuration: Site URL do app e Redirect URLs exatas com `/auth/callback`, incluindo a origem estável da versão de testes. Não use curingas gerais para previews. Desative Email, Phone e Anonymous; mantenha Google e a criação de novos usuários pelo OAuth para que os compradores possam fazer o primeiro login.
4. A chave privada já foi gerada no ambiente de implementação em `.secrets/license.env`, fora do Git e dos artefatos. O arquivo `src/access/license-public-key.json` contém só a chave pública. Configure `LICENSE_SIGNING_JWK` em Supabase → Edge Functions → Secrets, copiando somente o valor após `=` do arquivo privado. Se não tiver mais esse arquivo, execute `npm ci` e `node tools/create-access-key.mjs` num ambiente seguro, envie a nova chave privada ao Supabase e publique novamente a chave pública. Nunca troque somente uma das duas.
5. Configure também o segredo `ACCESS_ALLOWED_ORIGINS` no Supabase: origens exatas separadas por vírgula, sem barra final, como `https://vertice-web-navy.vercel.app,https://ORIGEM-ESTAVEL-DO-PREVIEW`.
6. A branch `feat/google-access` já configura o preview com o acesso obrigatório, a URL e a chave pública do projeto através de `tools/build-vercel.mjs`. Isso não exige gravar segredos na Vercel. Variáveis de ambiente podem substituir URL/chave pública para uma rotação futura. A conexão Vercel disponível retornou 403 para administrar variáveis; a configuração pública por branch mantém a entrega testável pelo GitHub. Produção permanece `legacy`.
7. Faça o primeiro login Google real no preview. O acesso ficará pendente até criar o administrador explicitamente com `supabase/bootstrap-admin.sql`. Esse script só aceita a identidade Google verificada de `gustavojosiasg@gmail.com`; não promove o primeiro usuário. Execute no SQL Editor do projeto Vértice. Volte ao app e clique **Verificar acesso**.
8. Confirme a transferência das listas locais para esse e-mail. A transferência só encontra listas na **mesma origem do navegador**. O preview não enxerga os dados salvos no domínio de produção: teste a transferência com uma cópia importada no preview; a transferência real das listas de produção acontece no mesmo domínio quando o acesso for ativado.
9. Valide no Chrome e no PWA instalado: Google, lista antiga, cadastro de comprador, licença pendente, revogação e reativação, modo avião, retorno à internet e exportação. Só depois configure as variáveis de **Production**, publique a branch validada e ative `enforced` no domínio público.

## Operação

O administrador abre `/admin`, informa o e-mail Google usado pelo comprador e, opcionalmente, uma referência de pedido. O UUID da licença é automático. O UID do cliente só é vinculado quando ele faz o primeiro login com a identidade Google verificada correspondente. Emails são normalizados apenas com trim/lower: pontos e `+` não são removidos.

A licença comercial não expira. A autorização offline ES256 dura no máximo 604800 segundos e é renovada ao abrir, voltar ao app, reconectar e periodicamente a cada 15 minutos em primeiro plano. Falha de rede não equivale a revogação. Uma revogação confirmada remove a autorização; aparelhos desconectados podem manter o restante do prazo anterior. Reembolsos são revogados manualmente nesta fase.

Cada conta usa um IndexedDB próprio. A migração preserva o banco anônimo, exige confirmação e mantém registro local da conta que o recebeu. Não é um backup na nuvem. Os backups JSON continuam v5 e não contêm credenciais.

Administração sempre exige internet e verificação atual da permissão no servidor. Mostrar um link no app não concede privilégio. As funções RPC administrativas não podem ser executadas por anon/authenticated. As funções Edge verificam o usuário no Supabase e usam CORS por origem; CORS é uma restrição adicional, não substitui autorização.

Não habilite um modo de teste no deploy público. Integrações de teste usam Supabase local com identidades sintéticas, nunca a conta Google real. A autorização offline é uma barreira comercial para uso normal; um proprietário do dispositivo ainda pode modificar o código e o armazenamento locais. Sem servidor nas compras offline não existe proteção absoluta contra adulteração do cliente.
