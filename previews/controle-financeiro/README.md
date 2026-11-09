# Vértice — Preview de Compras e Financeiro

Preview fixo: https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev

Menu ☰ troca entre Compras, Financeiro e Configurações. As abas inferiores Resumo,
Lançamentos, Orçamento e Metas aparecem somente no Financeiro, no celular e no desktop.
A última área é lembrada; o primeiro acesso abre Compras. Voltar/avançar respeita a navegação.

As telas reais de compras são reutilizadas, com banco exclusivo de demonstração e sem
alterar src/, autenticação, banco ou publicação oficiais. O painel de compras permanece
montado durante a troca de área para preservar rascunhos. Financeiro mantém seus exemplos
na chave local existente. Nenhuma transferência automática de dados entre as áreas.

Build: `node build.mjs`. Instala dependências fixadas da raiz se necessário.
Arquivos gerados em dist/ não devem ser versionados. Para testar localmente, sirva dist/
por HTTP. Contas, gráficos e metas financeiras continuam sendo protótipos locais.
