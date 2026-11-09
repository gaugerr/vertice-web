# Preview fixo de controle financeiro

Este diretório contém somente o protótipo independente do Vértice Financeiro.
Não altera as rotas, autenticação, banco, app de compras ou página de vendas oficiais.

- Conta Cloudflare: ab0452392516e43ea097317ea48c57d5.
- Projeto Pages: vertice-financeiro-preview.
- Branch de trabalho: preview/controle-financeiro.
- Raiz de build: previews/controle-financeiro.
- Build: node build.mjs. Saída: dist (não versionar).
- Publicação automática: somente esta branch. Produção deste projeto desabilitada.
- Usar o alias retornado pela Cloudflare para esta branch como endereço estável.
- Dados fictícios em localStorage, chave vertice-finance-preview-v1.
- Sem conexão ao Supabase, dados pessoais, login, bancos ou dados oficiais.
- Manter o endereço e a origem para preservar alterações de demonstração no navegador.
- Melhorias ficam nesta branch até o proprietário autorizar a integração ao app oficial.

Validação: node --check app.js; node build.mjs. Testar adição/edição/exclusão,
validação monetária, troca de mês, pagamento, orçamento e metas quando afetados.
Valores em centavos inteiros; preservar as contas e os textos de demonstração.
