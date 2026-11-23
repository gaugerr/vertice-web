# Vértice — Preview de Compras e Financeiro

> **Estado do repositório consultado em 23/11/2026:** leia [AI-HANDOFF](../../docs/AI-HANDOFF.md).
> Esta revisão não sondou Cloudflare, Supabase ou Auth; não comprova disponibilidade atual do serviço.
> App oficial, demonstração local e preview conectada são ambientes distintos.

Preview fixo: https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev

## Espaço do casal — demonstração e homologação

O seletor no cabeçalho separa Meu espaço e Nossa casa. Em Configurações, o titular
pode criar o casal, gerar um link, copiar dados para o destino vazio e remover o
participante. Os perfis de demonstração permitem testar titular e parceiro em duas
abas do mesmo navegador. Não há convite real nem compartilhamento entre aparelhos
na demonstração principal.

Dados, rascunhos, fila de envio e backups ficam separados por usuário e espaço.
Alterações offline são preservadas, conflitos exigem revisão e remoção bloqueia
novos envios. Os dados antigos da preview são conservados e importados apenas no
espaço pessoal fictício do titular. As regras financeiras existentes são mantidas.

A entrada `/staging/` usa Google e o banco Vértice existente, somente no endereço
estável autorizado. A demonstração principal permanece local. Documentação e testes completos:
[Espaços pessoais e do casal](../../shared/workspaces/README.md).

A navegação principal reúne Resumo, Lançamentos, Planejamento e Análises. Cadastros,
patrimônio e configurações continuam acessíveis pelo menu lateral (Mais); aliases e
rotas anteriores são preservados. A navegação respeita voltar/avançar e mantém
rascunhos de Compras ao trocar de área.

As telas reais de compras são reutilizadas, com dados separados por ambiente/usuário/espaço. A interface oficial permanece
inalterada. O formulário de preço também preserva o Enter digitado durante uma
marcação em andamento. O painel de compras permanece
montado durante a troca de área para preservar rascunhos. Nenhuma transferência automática de dados entre as áreas.

## Financeiro nativo da preview

- Categorias de receitas/despesas e formas de pagamento editáveis em Configurações e nos formulários. Arquivar impede novos usos e mantém registros existentes.
- Lançamentos com categoria, pagamento, observação e filtros por categoria, pagamento, situação, origem e tipo.
- Contas fixas mensais com início/fim, vencimento, reajustes por competência e ajuste de valor somente no mês selecionado. Dias 29–31 são limitados ao último dia do mês quando necessário.
- Pagamento registra data real e valor efetivo. É possível corrigir ou desfazer; o histórico pago preserva os dados da época. Um pagamento de novembro realizado em dezembro continua nos indicadores de novembro.
- Resumo, lançamentos e orçamento usam as mesmas ocorrências mensais para evitar contagem duplicada. O saldo do resumo é da competência, sem representar um saldo bancário.

Os cadastros e regras ficam em `finance-domain.mjs` e `finance-ledger.mjs`; o estado
local e os backups usam `finance-store.mjs` e `finance-backup.mjs`. A integração por
espaço está em `shared/workspaces`. Contas, cartões, faturas, transferências,
parcelas e séries fazem parte do ledger v2. Não há Open Finance, conciliação bancária
automática, cálculo de rotativo ou juros.

## Melhorias com uso simples

- Resumo mostra pendências de meses anteriores em um bloco expansível. O restante de pagamentos parciais é preservado; abrir o mês original permite pagar a obrigação sem duplicá-la no mês atual.
- Comparação no Resumo mostra entradas recebidas, saídas pagas e resultado versus o mês anterior. Não calcula variações percentuais quando falta uma base; avisa que meses em andamento podem estar incompletos.
- Limites são por competência em `monthlyBudgets`. Até personalizar um mês, os limites anteriores de `budgets` continuam como base. Alterações e cópia do mês anterior criam um retrato independente e não alteram o histórico. Campo vazio remove um limite somente daquele mês.
- Metas podem ser criadas, editadas e excluídas. Aportes têm IDs próprios e datas, com correção e exclusão. O valor legado vira saldo inicial do histórico ao registrar o primeiro aporte; não são inventadas datas de aportes antigos. O seletor de mês fica oculto em Metas, pois o progresso é global.
- Backup financeiro em Configurações exporta JSON com identificação e versão. Importação limita a 5 MB, valida referências e totais, mostra uma prévia e pede confirmação. Não faz mesclagem nem altera Compras. A cópia anterior é guardada em `vertice-finance-preview-before-restore` e pode ser baixada. Se a cópia ou gravação falhar, o financeiro atual é preservado.

As regras de domínio permanecem independentes da interface. A demonstração local usa
`FinanceStore`; `/staging/` usa o armazenamento por projeto/usuário/espaço e o serviço
autenticado de workspaces. A demonstração principal não cria contas Google nem convites
reais; essas operações pertencem somente à entrada conectada. Nenhum dado da demonstração
é importado automaticamente para `/staging/`.

## Dados locais e migração

Orçamento aceita limite zero; deixar o campo vazio remove o limite. Ao editar um
lançamento antigo sem forma de pagamento, é possível preservar “Não informado”.
Novos lançamentos e cópias continuam exigindo uma forma válida.

Contas fixas aceitam pagamentos parciais: o total pago entra nas saídas confirmadas,
o restante fica pendente e o valor completo permanece no orçamento. Novos pagamentos
somam ao total da competência. O histórico registra cada pagamento e as diferenças
de correções; corrigir altera o total acumulado. “Desfazer” remove todos os pagamentos
da competência. Quitação abaixo do previsto exige marcar “Quitar o restante com
desconto”. Pagamentos antigos sem essa informação preservam a quitação anterior.
Reajustes não mudam o valor de uma competência que já recebeu pagamento parcial.

Na demonstração local, o Financeiro salva em `vertice-finance-preview-v2`, com revisão
para detectar alterações em outra aba. Na entrada conectada, o armazenamento é separado
por projeto, usuário e workspace. A migração preserva `vertice-finance-preview-v1` e uma cópia literal em
`vertice-finance-preview-v1-backup`. Categorias genéricas antigas são mantidas como
legado, pagamentos antigos ficam “Não informado” e nenhum avulso vira recorrência
automaticamente. Valores, metas, limites e situação de pagamento são conservados.

Dados ilegíveis não são apagados nem substituídos por exemplos; a tela oferece download
dos dados preservados. Uma falha ao salvar mantém o formulário e o estado anterior.
Essas regras de migração local descrevem a demonstração principal. `/staging/` usa o
Supabase Vértice e a sincronização por workspace; o app oficial em `main` continua
separado e não recebe essa funcionalidade automaticamente.

## Validação

Na raiz do repositório, os testes de domínio/ledger e o build da preview podem ser
executados assim:

```sh
node --test --test-isolation=none previews/controle-financeiro/finance-domain.test.mjs previews/controle-financeiro/finance-improvements.test.mjs previews/controle-financeiro/finance-ledger.test.mjs
node node_modules/vitest/vitest.mjs run --config shared/workspaces/vitest.config.mjs
node previews/controle-financeiro/build.mjs
```

Build: `node build.mjs`. Instala dependências fixadas da raiz se necessário.
Arquivos gerados em dist/ não devem ser versionados. Para testar localmente, sirva dist/
por HTTP. A demonstração local usa armazenamento do navegador; `/staging/` usa Supabase
Vértice e `WorkspaceClient`. Esses recursos não estão integrados ao app oficial em `main`.
