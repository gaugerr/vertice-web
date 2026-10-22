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
