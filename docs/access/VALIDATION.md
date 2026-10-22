# Validação da entrega de acesso

As migrações foram aplicadas somente no projeto Supabase Vértice `wqutcsjdozcukwxvkbtc`. Os nomes locais refletem as versões retornadas pelo histórico do servidor. A primeira migração foi inicialmente gerada pela CLI antes de ser aplicada pelo conector.

Permissões verificadas no projeto hospedado:

- `anon` não executa `access_license_check`.
- `authenticated` não executa `access_admin`, não insere licenças e não acessa o schema privado.
- `service_role` executa a validação e lê apenas as colunas de identidade necessárias ao vínculo.
- A rotina de infraestrutura pré-existente `rls_auto_enable` teve o privilégio de execução direta por clientes removido. Seu uso como trigger não precisa desse privilégio.
- A última verificação de segurança não retornou WARN ou ERROR. Os dois INFO de [RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) nas tabelas privadas são intencionais: clientes não têm acesso; o servidor usa uma credencial com BYPASSRLS.

A rotina `bootstrap-admin.sql` foi executada após o primeiro login real da identidade Google verificada de Gustavo. A consulta no servidor confirmou a licença ativa e o papel de administrador de `gustavojosiasg@gmail.com`. O botão administrativo usa a confirmação do servidor vinculada ao UID atual; o e-mail exibido não concede permissão.

O workflow `Access integration` inicia Supabase local, valida permissões com pgTAP, cria identidades sintéticas locais e uma chave ES256 efêmera, serve as mesmas funções Edge e roda o app compilado com acesso obrigatório. Nenhuma conta Google real, chave privada hospedada ou credencial de produção é usada no CI.

A geração de fixtures com senha existe somente nas ferramentas locais de teste. O produto tem apenas o botão de Google; o provedor de Email deve ser desativado no projeto hospedado conforme SETUP.md. O callback Google real permanece uma validação interativa do proprietário.

O proprietário confirmou a configuração do callback e de `ACCESS_ALLOWED_ORIGINS` para `https://vertice-web-navy.vercel.app` e autorizou publicar na `main`. A produção agora compila com acesso obrigatório. A verificação do site publicado testa o bloqueio para visitantes, o callback Google e CORS/autorização das funções sem utilizar contas reais. O login real no domínio principal e a transferência das listas desse domínio continuam sendo validações interativas do proprietário; os dados originais são preservados. Não há sincronização de compras na nuvem.

## Endereço oficial atual

O domínio oficial passou a ser `https://use-vertice.vercel.app`. O workflow hospedado agora verifica esse endereço, incluindo a navegação Google com callback da própria origem e o CORS das funções reais do Supabase. A validação anterior no domínio `vertice-web-navy.vercel.app` permanece como registro histórico. A troca de domínio exige configurar Site URL, Redirect URLs e `ACCESS_ALLOWED_ORIGINS`, além de exportar/importar as compras locais entre origens.

## Isolamento das sessões de integração

A preparação de acesso cria identidades sintéticas e guarda suas credenciais em
`.secrets/fixtures.json`, com permissão `0600`. O helper de integração recusa qualquer
URL diferente de `http://127.0.0.1:54321`; não usa credenciais de produção.

Cada teste de compras abre uma sessão Supabase independente, obtém uma autorização
assinada válida para `http://127.0.0.1:4173` e verifica a assinatura com a chave
efêmera do job antes de iniciar o navegador. As abas do mesmo teste compartilham o
contexto; testes diferentes não compartilham refresh tokens. O encerramento da
fixture usa apenas logout local dessa sessão. Os testes de acesso também fazem um
novo login a cada entrada, inclusive para operações administrativas.

`tools/wait-access.mjs` aguarda as funções locais e verifica a assinatura; não cria
mais um arquivo de estado autenticado para a suíte inteira. O teste de regressão
compara a validação antes/depois do logout, uma sessão independente e um novo login.
Nenhum token ou senha é impresso. Traces são desativados nas suítes autenticadas
para evitar capturar headers e estado de sessão; screenshots e contexto de erros
continuam disponíveis. O modo local sem autenticação mantém seus traces habituais.

Na investigação inicial, os 45 cenários de compras falhavam também na main anterior.
Os artefatos mostravam 44 telas de renovação e uma tela de entrada, com 50 respostas
401 da validação e JWTs ainda dentro da validade. Esse resultado é a linha de base
para comparar a correção, não uma confirmação de 45 defeitos de compras distintos.

As chaves efêmeras de teste só devem ser geradas no runner ou em uma cópia descartável
do repositório. Nunca publicar a chave pública de teste no lugar da chave de produção.
