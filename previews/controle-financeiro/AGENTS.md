# Preview fixo de controle financeiro

Este diretório contém o preview de navegação entre Compras e Financeiro.
Não publica mudanças na interface oficial. A entrada autenticada pode usar as novas tabelas do banco Vértice existente, conforme autorização explícita do proprietário; preservar Auth/licenças/Cakto.

- Conta Cloudflare: ab0452392516e43ea097317ea48c57d5.
- Projeto Pages: vertice-financeiro-preview.
- Branch de trabalho: preview/controle-financeiro.
- Raiz de build: previews/controle-financeiro.
- Build: node build.mjs. Saída: dist (não versionar).
- Publicação automática: somente esta branch. Produção deste projeto desabilitada.
- Usar o alias retornado pela Cloudflare para esta branch como endereço estável.
- Financeiro ativo e compras: IndexedDB por projeto/usuário/espaço, com fila transacional e conflitos. O titular fictício importa os dados antigos da preview uma vez; preservar o localStorage vertice-finance-preview-v2 e o IndexedDB antigos como fontes de recuperação.
- Migrar v1 uma única vez, conservando a chave original e vertice-finance-preview-v1-backup. Nunca restaurar exemplos automaticamente se houver erro de leitura.
- Categorias e pagamentos usam IDs estáveis; arquivar mantém as referências históricas. Não inferir categorias ou pagamentos ausentes nos dados antigos.
- Contas fixas são versões mensais com ocorrências únicas por conta/competência. Pagamentos entram nos indicadores pela competência, preservando também a data real e o valor efetivo. Não somar o cadastro da recorrência aos lançamentos.
- Pagamento parcial mantém uma ocorrência com paidAmount e remainingAmount. Totais confirmados usam paidAmount; orçamento usa amount completo. Novos pagamentos acumulam; correção altera o total. Pagamentos legados sem settled continuam quitados. Desconto exige quitação explícita. Histórico de movimentos soma o total pago.
- Limites aceitam zero; campo vazio significa sem limite. Edição de legado pode preservar método nulo, novos lançamentos e cópias não podem.
- Limites por mês em monthlyBudgets, com fallback aos limites antigos. Alterar/copiar um mês cria um retrato próprio, nunca reescreve outros meses. Valores nulos antigos significam sem limite.
- Pendências anteriores são consultadas separadamente do resultado mensal; abrir o mês original mantém a competência. Comparação mensal usa os totais canônicos confirmados.
- Metas têm saldo inicial e histórico de aportes com IDs/datas. Corrigir/subtrair aportes recalcula o progresso e nunca cria lançamentos implícitos. Preservar metas antigas sem inferir histórico.
- Backups financeiros versionados não incluem Compras. Validar arquivo/referências/históricos antes de confirmar restauração; guardar cópia anterior antes de substituir. Não alterar dados em erro ou cancelamento. Migração futura para banco deve impor isolamento por usuário no servidor.
- Compras: reutiliza telas/repositório reais de src/ através de shopping.tsx, agora com WorkspaceClient.shopping e banco isolado por espaço. O banco vertice_shopping_navigation_preview_v1 é lido somente para preservar a demonstração anterior do titular.
- shell.js mantém o menu de áreas, breadcrumbs e abas inferiores apenas do Financeiro.
- Abas: Resumo, Lançamentos, Contas Fixas, Orçamento e Metas. Cadastros editáveis ficam em Configurações e nos formulários.
- O build instala as dependências fixadas da raiz e compila compras com Vite. Alterações compartilhadas em src/ exigem testes. Não publicar a interface oficial nesta etapa.
- Não inicializar service worker, OAuth ou conexões externas na demonstração principal. Somente /staging/ do endereço estável autorizado pode usar Google e o banco Vértice existente, com modo existing-project-preview explícito. Em builds locais, essa conexão fica desativada por padrão.
- Preservar rascunhos de compras ao trocar de área: não desmontar o painel de compras.
- Convites da demonstração são locais; os da entrada conectada são reais. Chave privada dedicada no Vault, nunca no frontend/Git. Não importar dados fictícios automaticamente. Configuração em docs/CONNECTED-PREVIEW.md.
- Manter o endereço e a origem para preservar alterações de demonstração no navegador.
- Melhorias ficam nesta branch até o proprietário autorizar a integração ao app oficial.
- Seletor de espaço não pode descartar rascunhos. Backup e recuperação devem respeitar usuário/espaço. Nunca reenviar fila de uma participação removida após novo convite.
- Testes do casal: Vitest com shared/workspaces/vitest.config.mjs e fluxo mobile shared/workspaces/browser-check.mjs; o schema de homologação e verificador estão em supabase/drafts/shared-spaces.

Validação a partir da raiz: node --test --test-isolation=none previews/controle-financeiro/finance-domain.test.mjs previews/controle-financeiro/finance-improvements.test.mjs; node previews/controle-financeiro/build.mjs.
Testar cadastros, migração, falha de gravação, troca de mês, pagamento, reajuste,
correção, desfazer pagamento, orçamento e metas quando afetados.
Valores em centavos inteiros; preservar as contas e os textos de demonstração.
