# Vértice — Preview de Compras e Financeiro

Preview fixo: https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev

Menu ☰ troca entre Compras, Financeiro e Configurações. As abas inferiores Resumo,
Lançamentos, Contas Fixas, Orçamento e Metas aparecem somente no Financeiro, no celular e no desktop.
A última área é lembrada; o primeiro acesso abre Compras. Voltar/avançar respeita a navegação.

As telas reais de compras são reutilizadas, com banco exclusivo de demonstração e sem
alterar src/, autenticação, banco ou publicação oficiais. O painel de compras permanece
montado durante a troca de área para preservar rascunhos. Nenhuma transferência automática de dados entre as áreas.

## Base financeira provisória

- Categorias de receitas/despesas e formas de pagamento editáveis em Configurações e nos formulários. Arquivar impede novos usos e mantém registros existentes.
- Lançamentos com categoria, pagamento, observação e filtros por categoria, pagamento, situação, origem e tipo.
- Contas fixas mensais com início/fim, vencimento, reajustes por competência e ajuste de valor somente no mês selecionado. Dias 29–31 são limitados ao último dia do mês quando necessário.
- Pagamento registra data real e valor efetivo. É possível corrigir ou desfazer; o histórico pago preserva os dados da época. Um pagamento de novembro realizado em dezembro continua nos indicadores de novembro.
- Resumo, lançamentos e orçamento usam as mesmas ocorrências mensais para evitar contagem duplicada. O saldo do resumo é da competência, sem representar um saldo bancário.

Os cadastros, regras e armazenamento estão separados em `finance-domain.mjs`,
`finance-store.mjs`, `finance-backup.mjs` e `app.js` para facilitar alterações futuras.
Cartões/faturas/parcelas não são calculados.

## Melhorias com uso simples

- Resumo mostra pendências de meses anteriores em um bloco expansível. O restante de pagamentos parciais é preservado; abrir o mês original permite pagar a obrigação sem duplicá-la no mês atual.
- Comparação no Resumo mostra entradas recebidas, saídas pagas e resultado versus o mês anterior. Não calcula variações percentuais quando falta uma base; avisa que meses em andamento podem estar incompletos.
- Limites são por competência em `monthlyBudgets`. Até personalizar um mês, os limites anteriores de `budgets` continuam como base. Alterações e cópia do mês anterior criam um retrato independente e não alteram o histórico. Campo vazio remove um limite somente daquele mês.
- Metas podem ser criadas, editadas e excluídas. Aportes têm IDs próprios e datas, com correção e exclusão. O valor legado vira saldo inicial do histórico ao registrar o primeiro aporte; não são inventadas datas de aportes antigos. O seletor de mês fica oculto em Metas, pois o progresso é global.
- Backup financeiro em Configurações exporta JSON com identificação e versão. Importação limita a 5 MB, valida referências e totais, mostra uma prévia e pede confirmação. Não faz mesclagem nem altera Compras. A cópia anterior é guardada em `vertice-finance-preview-before-restore` e pode ser baixada. Se a cópia ou gravação falhar, o financeiro atual é preservado.

As regras permanecem independentes do navegador; o armazenamento fica em `FinanceStore`.
IDs e datas dos registros são preservados na restauração. A futura conexão ao banco
deve tratar a propriedade por usuário, autorização no servidor, sincronização e migração
dos dados locais. A preview não cria contas nem simula proteção por usuário.

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

Financeiro salva em `vertice-finance-preview-v2`, com revisão para detectar alterações
em outra aba. A migração preserva `vertice-finance-preview-v1` e uma cópia literal em
`vertice-finance-preview-v1-backup`. Categorias genéricas antigas são mantidas como
legado, pagamentos antigos ficam “Não informado” e nenhum avulso vira recorrência
automaticamente. Valores, metas, limites e situação de pagamento são conservados.

Dados ilegíveis não são apagados nem substituídos por exemplos; a tela oferece download
dos dados preservados. Uma falha ao salvar mantém o formulário e o estado anterior.
Tudo permanece apenas neste navegador/origem, sem sincronização ou banco oficial.

## Validação

Na raiz do repositório:

```sh
node --test --test-isolation=none previews/controle-financeiro/finance-domain.test.mjs previews/controle-financeiro/finance-improvements.test.mjs
node previews/controle-financeiro/build.mjs
```

Build: `node build.mjs`. Instala dependências fixadas da raiz se necessário.
Arquivos gerados em dist/ não devem ser versionados. Para testar localmente, sirva dist/
por HTTP. Contas, gráficos e metas financeiras continuam sendo protótipos locais.
