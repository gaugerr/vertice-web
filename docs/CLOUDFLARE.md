# Hospedagem na Cloudflare Pages

Projeto: `gaugerr/vertice-web`, branch de produção `main`, nome `use-vertice`.
Aplicativo: <https://app.usevertice.app.br>. Página de vendas:
<https://usevertice.app.br>, projeto Pages `vertice-kit` (raiz `/marketing`).
Endereços alternativos: <https://use-vertice.pages.dev> para o app e
<https://vertice-kit.pages.dev> para a apresentação. A integração Git publica a
`main`; previews automáticos ficam desabilitados por padrão. A revisão de
Vértice Financeiro autoriza somente a branch `feat/vertice-financeiro`, em modo
custom. Não habilitar recursos pagos.

## Criar o projeto

1. Cloudflare → Workers & Pages → Create application → Pages → Connect to Git.
2. Autorizar o GitHub App somente para `gaugerr/vertice-web`.
3. Selecionar `main`, diretório raiz `/`, comando de build
   `node tools/build-cloudflare.mjs` e saída `dist`.
4. Usar Node 24 (`NODE_VERSION=24`). Instalar pelo `package-lock.json` com npm.
5. Habilitar deploys de produção. Deixar previews automáticos desabilitados;
   previews futuros precisam de autorização de origem e callback próprios.

O build mantém acesso obrigatório, URL e chave pública do mesmo Supabase da
Vercel. Variáveis públicas podem substituir URL/chave; nunca colocar `service_role`,
segredo Google ou chave privada de assinatura no frontend. A chave pública de
verificação existente no repositório é preservada. `tools/validate-access.mjs`
impede builds Pages em modo `legacy`.

## Liberar o endereço no Supabase

Para o domínio do app, usar a origem exata `https://app.usevertice.app.br` e o
callback `https://app.usevertice.app.br/auth/callback`. O site de vendas não chama
as funções de licença e não precisa ser incluído nas origens de acesso.

Depois de obter a origem HTTPS exata do projeto:

1. Authentication → URL Configuration: adicionar `<origem>/auth/callback` aos
   Redirect URLs. Preservar os endereços anteriores enquanto forem utilizados.
2. Quando a migração estiver pronta, definir Site URL como a nova origem.
3. Edge Functions → Secrets: acrescentar a nova origem, sem barra final, a
   `ACCESS_ALLOWED_ORIGINS`, separada por vírgula e preservando as demais origens.
4. O callback do cliente Google continua sendo o endereço do Supabase
   `https://wqutcsjdozcukwxvkbtc.supabase.co/auth/v1/callback`.

Não usar curingas para contornar CORS ou o callback. Esses ajustes ficam no
Supabase, não na hospedagem Cloudflare; podem ser feitos pelo painel sem enviar
credenciais pelo chat.

## Rotas, cache e dados

`public/_headers` mantém `sw.js` e `online.txt` sem cache e assets com nomes
versionados em cache longo. `public/_redirects` reescreve as rotas reais para o
HTML `app-shell.html`, cópia de `index.html` gerada pelo build para evitar o
redirecionamento canônico de `index.html` à raiz e preservar callbacks e rotas
diretas. O build também copia `index.html` para `404.html`, desabilitando o fallback
SPA implícito da Pages: assets inexistentes retornam HTTP 404. Rotas desconhecidas
também retornam 404, com o app exibindo a tela apropriada.

As compras são locais e vinculadas à origem do navegador. Antes de trocar de
endereço, exportar o backup no endereço antigo. No novo, entrar com a mesma conta
e importar o backup; a restauração substitui as compras já existentes no destino.
Não apagar dados nem desativar o endereço antigo para forçar a migração. A
instalação PWA antiga permanece vinculada ao endereço antigo.

## Conferência curta após publicar

- Raiz, `/login`, `/settings`, `/privacy` e callback abrem corretamente.
- `manifest.webmanifest`, `sw.js` e ícones respondem por HTTPS; worker sem cache.
- `/assets/does-not-exist.js` responde 404; `online.txt` não usa cache.
- CORS aceita somente as origens permitidas; OAuth retorna para a nova origem.
- Login real, licença, backup e uso offline são conferidos sem fixtures de teste
  no Supabase de produção. Não registrar tokens ou estados autenticados.

Somente após concluir esses passos divulgar o endereço como pronto para clientes.

## Publicação inicial verificada

Em 23/10/2026, deploy de produção aprovado pela Cloudflare. Conferência em
navegador remoto a 390 px: login visível, compras protegidas, largura sem excesso,
rotas e manifesto HTTP 200, worker/conectividade sem cache e asset ausente HTTP 404. Google habilitado; as duas funções de licença aceitam CORS da nova origem e
rejeitam chamadas sem sessão com HTTP 401. O proprietário confirmou os ajustes de
callback/origem no Supabase; o login completo na conta real deve ser conferido
pelo proprietário.

## Domínios próprios

Em 23/10/2026, a zona `usevertice.app.br`, o domínio raiz e o subdomínio `app`
ficaram ativos na Cloudflare, com certificados HTTPS ativos. Os CNAMEs apontam,
respectivamente, para `vertice-kit.pages.dev` e `use-vertice.pages.dev`.

A verificação inicial do domínio próprio abriu o app e suas rotas por HTTPS, mas
identificou bloqueio CORS nas funções de licença. Foi solicitado ao proprietário
acrescentar a nova origem em `ACCESS_ALLOWED_ORIGINS` e o callback em Redirect URLs,
preservando os endereços antigos. A ativação DNS sozinha não configura o Supabase.

Não redirecionar o app antigo automaticamente: cada origem tem compras e sessão
locais próprias. A migração dos registros continua sendo feita por backup.
