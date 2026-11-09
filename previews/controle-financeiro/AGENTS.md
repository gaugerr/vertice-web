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
- Financeiro: dados locais de demonstração em localStorage, chave vertice-finance-preview-v2.
- Migrar v1 uma única vez, conservando a chave original e vertice-finance-preview-v1-backup. Nunca restaurar exemplos automaticamente se houver erro de leitura.
- Categorias e pagamentos usam IDs estáveis; arquivar mantém as referências históricas. Não inferir categorias ou pagamentos ausentes nos dados antigos.
- Contas fixas são versões mensais com ocorrências únicas por conta/competência. Pagamentos entram nos indicadores pela competência, preservando também a data real e o valor efetivo. Não somar o cadastro da recorrência aos lançamentos.
- Pagamento parcial mantém uma ocorrência com paidAmount e remainingAmount. Totais confirmados usam paidAmount; orçamento usa amount completo. Novos pagamentos acumulam; correção altera o total. Pagamentos legados sem settled continuam quitados. Desconto exige quitação explícita. Histórico de movimentos soma o total pago.
- Limites aceitam zero; campo vazio significa sem limite. Edição de legado pode preservar método nulo, novos lançamentos e cópias não podem.
- Limites por mês em monthlyBudgets, com fallback aos limites antigos. Alterar/copiar um mês cria um retrato próprio, nunca reescreve outros meses. Valores nulos antigos significam sem limite.
- Pendências anteriores são consultadas separadamente do resultado mensal; abrir o mês original mantém a competência. Comparação mensal usa os totais canônicos confirmados.
- Metas têm saldo inicial e histórico de aportes com IDs/datas. Corrigir/subtrair aportes recalcula o progresso e nunca cria lançamentos implícitos. Preservar metas antigas sem inferir histórico.
- Backups financeiros versionados não incluem Compras. Validar arquivo/referências/históricos antes de confirmar restauração; guardar cópia anterior antes de substituir. Não alterar dados em erro ou cancelamento. Migração futura para banco deve impor isolamento por usuário no servidor.
- Compras: reutiliza telas/repositório reais de src/ através de shopping.tsx, com IndexedDB exclusivo vertice_shopping_navigation_preview_v1.
- shell.js mantém o menu de áreas, breadcrumbs e abas inferiores apenas do Financeiro.
- Abas: Resumo, Lançamentos, Contas Fixas, Orçamento e Metas. Cadastros editáveis ficam em Configurações e nos formulários.
- O build instala as dependências fixadas da raiz se necessário e compila a entrada shopping com Vite. Não muda src/, login ou banco oficial.
- Não inicializar service worker, OAuth ou conexões externas neste preview de demonstração.
- Preservar rascunhos de compras ao trocar de área: não desmontar o painel de compras.
- Sem conexão ao Supabase, dados pessoais, login, bancos ou dados oficiais.
- Manter o endereço e a origem para preservar alterações de demonstração no navegador.
- Melhorias ficam nesta branch até o proprietário autorizar a integração ao app oficial.

Validação a partir da raiz: node --test --test-isolation=none previews/controle-financeiro/finance-domain.test.mjs previews/controle-financeiro/finance-improvements.test.mjs; node previews/controle-financeiro/build.mjs.
Testar cadastros, migração, falha de gravação, troca de mês, pagamento, reajuste,
correção, desfazer pagamento, orçamento e metas quando afetados.
Valores em centavos inteiros; preservar as contas e os textos de demonstração.
