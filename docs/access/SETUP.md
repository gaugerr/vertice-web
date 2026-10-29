# Acesso Google e licenças

A implementação está na `main`. A produção principal usa Cloudflare Pages em `https://use-vertice.pages.dev`, com build `node tools/build-cloudflare.mjs`; veja [CLOUDFLARE.md](../CLOUDFLARE.md). Produção e previews usam exclusivamente Cloudflare Pages e exigem login Google e licença. A ativação do domínio principal foi autorizada pelo proprietário após o login real no preview e a configuração das origens no Supabase. Não há sincronização de compras nesta entrega.

## Configuração externa necessária

1. No Google Cloud, crie um aplicativo OAuth externo para Web, com escopos apenas `openid`, `email`, `profile`. Enquanto estiver em teste, adicione `gustavojosiasg@gmail.com` como usuário de teste. Para vender, publique o aplicativo OAuth e revise os requisitos mostrados pelo Google; manter em teste restringe compradores.
2. URI autorizada de redirecionamento do Google: `https://wqutcsjdozcukwxvkbtc.supabase.co/auth/v1/callback`. O segredo Google vai somente no painel Supabase → Authentication → Sign In / Providers → Google. Não envie esse segredo pelo chat.
3. Supabase Authentication → URL Configuration: Site URL `https://app.usevertice.app.br` e Redirect URL `https://app.usevertice.app.br/auth/callback`, incluindo também os callbacks dos endereços anteriores e da origem estável de testes enquanto forem usados. Não use curingas gerais para previews. Desative Email, Phone e Anonymous; mantenha Google e a criação de novos usuários pelo OAuth para que os compradores possam fazer o primeiro login.
4. A chave privada já foi gerada no ambiente de implementação em `.secrets/license.env`, fora do Git e dos artefatos. O arquivo `src/access/license-public-key.json` contém só a chave pública. Configure `LICENSE_SIGNING_JWK` em Supabase → Edge Functions → Secrets, copiando somente o valor após `=` do arquivo privado. Se não tiver mais esse arquivo, execute `npm ci` e `node tools/create-access-key.mjs` num ambiente seguro, envie a nova chave privada ao Supabase e publique novamente a chave pública. Nunca troque somente uma das duas.
5. Configure também o segredo `ACCESS_ALLOWED_ORIGINS` no Supabase: origens exatas separadas por vírgula, sem barra final. Use `https://app.usevertice.app.br,https://use-vertice.pages.dev` e acrescente somente as origens exatas dos previews Cloudflare em uso. Remova origens da hospedagem anterior ao concluir sua desativação.
6. `tools/build-cloudflare.mjs` configura acesso obrigatório, URL e chave pública do projeto nos builds Cloudflare de produção e preview. Não há segredos nesse arquivo. Variáveis de ambiente podem substituir URL/chave pública para uma rotação futura. O build local comum continua em `legacy` para desenvolvimento; use `.env.example` para testar o acesso obrigatório localmente.
7. Faça o primeiro login Google real no preview. O acesso ficará pendente até criar o administrador explicitamente com `supabase/bootstrap-admin.sql`. Esse script só aceita a identidade Google verificada de `gustavojosiasg@gmail.com`; não promove o primeiro usuário. Execute no SQL Editor do projeto Vértice. Volte ao app e clique **Verificar acesso**.
8. Confirme a transferência das listas locais para esse e-mail. A transferência só encontra listas na **mesma origem do navegador**. O preview não enxerga os dados salvos no domínio de produção: teste a transferência com uma cópia importada no preview; a transferência real das listas de produção acontece no mesmo domínio quando o acesso for ativado.
9. No domínio principal, entre com Google e confirme a transferência das listas antigas, se oferecida. Valide também no PWA instalado: cadastro de comprador, licença pendente, revogação e reativação, modo avião, retorno à internet e exportação. O workflow `Hosted PWA checks` verifica o login público, o callback da própria origem, Google habilitado e as funções reais rejeitando chamadas sem sessão; as compras autenticadas e a migração são verificadas pelo CI com Supabase local.

## Troca de endereço

O endereço oficial é `https://app.usevertice.app.br`. No Google Auth Platform, atualize as informações de marca para a página inicial nesse endereço e a política de privacidade em `https://app.usevertice.app.br/privacy`. O callback OAuth cadastrado no cliente Google continua sendo `https://wqutcsjdozcukwxvkbtc.supabase.co/auth/v1/callback`.

Cada domínio tem armazenamento local próprio. Para levar listas do domínio anterior ao novo, exporte o backup no endereço antigo e importe no novo depois do login com a mesma conta. Mantenha o endereço antigo acessível sem redirecionamento obrigatório enquanto houver dados para transferir. Essa operação não envia compras para o Supabase. O PWA instalado no endereço antigo também continua ligado àquela origem; a instalação do novo endereço é independente.

O cliente OAuth calcula `/auth/callback` a partir da origem da página; não há um callback do site fixo no código. O workflow hospedado e a configuração Playwright usam o novo domínio por padrão.

## Operação

O administrador abre `/admin`, informa o e-mail Google usado pelo comprador e, opcionalmente, uma referência de pedido. O UUID da licença é automático. O UID do cliente só é vinculado quando ele faz o primeiro login com a identidade Google verificada correspondente. Emails são normalizados apenas com trim/lower: pontos e `+` não são removidos.

A licença comercial não expira. A autorização offline ES256 dura no máximo 604800 segundos e é renovada ao abrir, voltar ao app, reconectar e periodicamente a cada 15 minutos em primeiro plano. Falha de rede não equivale a revogação. Uma revogação confirmada remove a autorização; aparelhos desconectados podem manter o restante do prazo anterior. Reembolsos são revogados manualmente nesta fase.

Cada conta usa um IndexedDB próprio. A migração preserva o banco anônimo, exige confirmação e mantém registro local da conta que o recebeu. Não é um backup na nuvem. Os backups JSON continuam v5 e não contêm credenciais.

Administração sempre exige internet e verificação atual da permissão no servidor. Mostrar um link no app não concede privilégio. As funções RPC administrativas não podem ser executadas por anon/authenticated. As funções Edge verificam o usuário no Supabase e usam CORS por origem; CORS é uma restrição adicional, não substitui autorização.

Não habilite um modo de teste no deploy público. Integrações de teste usam Supabase local com identidades sintéticas, nunca a conta Google real. A autorização offline é uma barreira comercial para uso normal; um proprietário do dispositivo ainda pode modificar o código e o armazenamento locais. Sem servidor nas compras offline não existe proteção absoluta contra adulteração do cliente.
