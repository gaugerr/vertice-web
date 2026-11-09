# Preview fixo de controle financeiro

Este diretório contém o preview de navegação entre Compras e Financeiro.
Não altera as rotas, autenticação, banco, app de compras ou página de vendas oficiais.

- Conta Cloudflare: ab0452392516e43ea097317ea48c57d5.
- Projeto Pages: vertice-financeiro-preview.
- Branch de trabalho: preview/controle-financeiro.
- Raiz de build: previews/controle-financeiro.
- Build: node build.mjs. Saída: dist (não versionar).
- Publicação automática: somente esta branch. Produção deste projeto desabilitada.
- Usar o alias retornado pela Cloudflare para esta branch como endereço estável.
- Financeiro: dados fictícios em localStorage, chave vertice-finance-preview-v1.
- Compras: reutiliza telas/repositório reais de src/ através de shopping.tsx, com IndexedDB exclusivo vertice_shopping_navigation_preview_v1.
- shell.js mantém o menu de áreas, breadcrumbs e abas inferiores apenas do Financeiro.
- O build instala as dependências fixadas da raiz se necessário e compila a entrada shopping com Vite. Não muda src/, login ou banco oficial.
- Não inicializar service worker, OAuth ou conexões externas neste preview de demonstração.
- Preservar rascunhos de compras ao trocar de área: não desmontar o painel de compras.
- Sem conexão ao Supabase, dados pessoais, login, bancos ou dados oficiais.
- Manter o endereço e a origem para preservar alterações de demonstração no navegador.
- Melhorias ficam nesta branch até o proprietário autorizar a integração ao app oficial.

Validação: node --check app.js; node build.mjs. Testar adição/edição/exclusão,
validação monetária, troca de mês, pagamento, orçamento e metas quando afetados.
Valores em centavos inteiros; preservar as contas e os textos de demonstração.
