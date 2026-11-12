# Vértice

Aplicativo de compras e ferramentas financeiras, em evolução para um ecossistema com espaços pessoais e compartilhados, sincronização entre dispositivos e gestão financeira.

> **Importante:** o aplicativo oficial e o ecossistema em desenvolvimento são ambientes diferentes. O conteúdo da branch de preview não está automaticamente disponível no app oficial.

## Estado do produto

| Ambiente                       | Branch / projeto                             | O que contém                                                                                                                        |
| ------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| App oficial                    | main · Cloudflare Pages use-vertice          | Compras, acesso Google/licença e central de modelos financeiros Google Sheets/Excel. Compras permanecem locais no navegador.        |
| Página de vendas               | main · Cloudflare Pages vertice-kit          | Site comercial. Não misturar alterações do app com este projeto.                                                                    |
| Ecossistema em desenvolvimento | preview/controle-financeiro · PR #28 (draft) | Compras + Financeiro, espaços pessoais/compartilhados, fila offline, sincronização e conflitos. Ainda não integrado ao app oficial. |
| Preview de demonstração        | raiz do endereço de preview                  | Dados fictícios locais, sem conexão com a conta real.                                                                               |
| Preview conectada              | mesmo endereço + /staging/                   | Homologação autorizada com Google e banco Supabase Vértice. Pode conter dados reais.                                                |

O PR #29 foi integrado à branch de preview. A descrição do PR #28 registra migrações e validações nessa branch. Isso não significa que o ecossistema foi publicado na main.

## Começar

Requisitos: Node 24 LTS e npm.

    nvm use
    npm ci
    npm run dev

Verificações da aplicação React:

    npm run typecheck
    npm run lint
    npm test
    npm run build

Para executar o app financeiro/compartilhado da preview, consulte o guia de retomada e o README em previews/controle-financeiro. O build específico é executado de dentro dessa pasta com node build.mjs.

## Mapa do código

- src/domain: modelos, schemas e regras de domínio de compras.
- src/data: IndexedDB/Dexie, repositórios e backups locais.
- src/features: telas e componentes por funcionalidade.
- src/access: autenticação Google, licenças e administração.
- src/pwa: instalação, cache, conectividade e atualização.
- previews/controle-financeiro: shell da preview, Financeiro e integração visual com Compras.
- shared/workspaces: armazenamento por espaço, outbox, sincronização, conflitos e transporte.
- supabase/migrations e supabase/functions: banco, políticas e funções de servidor.
- docs: arquitetura, operação, validação e handoff.

## Documentação

Comece por [índice da documentação](docs/README.md). Para retomar o desenvolvimento com outra IA, leia [docs/AI-HANDOFF.md](docs/AI-HANDOFF.md) e depois [AGENTS.md](AGENTS.md).

## Princípios que não podem ser quebrados

1. Não confundir main, preview de demonstração e preview conectada.
2. Não integrar o PR #28 ao app oficial sem homologação e autorização explícita.
3. Não apagar, recriar ou migrar bancos para resolver problemas de interface.
4. Não expor segredos, service_role, tokens, chaves privadas ou dados pessoais.
5. Preservar Auth, licenças, Cakto, dados existentes, IDs, backups e compatibilidade.
6. Não afirmar que há sincronização no app oficial: ela está na branch do ecossistema, ainda não integrada.

Estado e validações são datados. Consulte GitHub Actions, Cloudflare e Supabase antes de operações ou decisões de publicação.
