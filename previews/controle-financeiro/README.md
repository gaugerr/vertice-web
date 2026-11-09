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
`finance-store.mjs` e `app.js` para facilitar alterações futuras. Limites do orçamento
continuam compartilhados entre os meses nesta etapa; cartões/faturas/parcelas não são calculados.

## Dados locais e migração

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
node --test --test-isolation=none previews/controle-financeiro/finance-domain.test.mjs
node previews/controle-financeiro/build.mjs
```

Build: `node build.mjs`. Instala dependências fixadas da raiz se necessário.
Arquivos gerados em dist/ não devem ser versionados. Para testar localmente, sirva dist/
por HTTP. Contas, gráficos e metas financeiras continuam sendo protótipos locais.
