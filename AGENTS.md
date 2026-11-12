# Instruções para agentes e contribuidores

Leia primeiro docs/AI-HANDOFF.md. Ele registra o estado atual, os ambientes, as decisões e os riscos. Use docs/README.md para localizar a documentação detalhada.

## Regra principal: identificar o ambiente

- main: aplicativo oficial de compras, acesso Google/licença e central de planilhas financeiras.
- preview/controle-financeiro: ecossistema em desenvolvimento, associado ao PR #28.
- Raiz da preview: demonstração fictícia local.
- /staging/ na preview: homologação conectada ao Supabase Vértice; pode conter dados reais.
- vertice-kit: página de vendas separada.

Nunca trate código da preview como funcionalidade já entregue no app oficial. Não faça merge, deploy, migração, alteração de configuração ou operação comercial sem autorização explícita do proprietário.

## Antes de editar

1. Consulte o branch, commit e arquivos atuais no GitHub. Não confie em SHA, deploy ou estado copiado de conversas antigas.
2. Verifique o diff e preserve alterações existentes.
3. Leia o documento específico da área afetada e os testes correspondentes.
4. Faça a menor alteração coerente. Não reescreva módulos ou troque tecnologias sem necessidade comprovada.
5. Atualize a documentação quando uma decisão, contrato, comportamento ou validação mudar.

## Arquitetura e limites

- Compras oficiais: React + TypeScript + Vite + Tailwind CSS 4; domínio em src/domain, persistência Dexie/IndexedDB em src/data, telas em src/features.
- As telas de compras acessam dados pelo contrato ShoppingRepository. Não escrever diretamente nas tabelas Dexie a partir de componentes.
- Financeiro da preview: aplicação DOM/JavaScript em previews/controle-financeiro, com regras em finance-domain.mjs e finance-ledger.mjs.
- A preview reutiliza as telas/repositório React de Compras via shopping.tsx.
- shared/workspaces mantém persistência local, outbox, mapeamento, sincronização, versões, recibos idempotentes e conflitos.
- Supabase é a fonte remota por espaço; acesso de escrita passa pelo serviço workspaces e workspace_command. Nunca usar service_role no navegador.
- Valores financeiros são centavos inteiros. Preços e quantidades de compras usam representação decimal exata; não usar float para dinheiro.
- Datas de competência são datas civis; distinguir competência de instante UTC e data real de pagamento.

## Segurança e integridade

- Nunca ler, imprimir, versionar ou pedir segredos. Nunca incluir tokens, cookies, service_role, chaves privadas ou dados pessoais em logs, commits, documentação ou respostas.
- Não alterar Auth, licenças, Cakto, Vault, cron, domínios, callbacks ou políticas sem escopo e autorização explícitos.
- Não reaplicar migrações já registradas. Migrações históricas em supabase/drafts não são instruções de deploy.
- Não resetar o Supabase Vértice, não tocar no projeto Docery e nunca usar fixtures ou eventos sintéticos no banco real.
- Preservar RLS, isolamento por workspace, validação de ator no servidor e escrita privilegiada exclusiva do serviço.
- Não apagar dados para corrigir UI. Migrações Dexie/SQL devem ser aditivas, testadas e documentadas.
- Backup/restauração devem validar o arquivo antes de substituir dados e preservar cópia recuperável.

## Sincronização e espaços

- A gravação local e a outbox devem ser atômicas.
- Reenvios precisam ser idempotentes; não remover pendências antes da confirmação do servidor.
- Conflitos no mesmo registro exigem revisão explícita. Não resolver usando apenas o relógio do cliente.
- Pagamentos e aportes devem verificar também a versão do registro pai.
- Ao remover participante, colocar fila antiga em quarentena; nunca reenviar operações de uma geração anterior após novo convite.
- Não prometer sincronização com o app fechado nem revogação instantânea enquanto o dispositivo estiver offline.
- Dados exportados ou já baixados não podem ser apagados remotamente.

## Validação

Na raiz: npm ci, npm run typecheck, npm run lint, npm test e npm run build conforme o escopo.

Para a preview financeira, execute os testes específicos descritos em previews/controle-financeiro/AGENTS.md e shared/workspaces/README.md. Testes PostgreSQL usam fixtures isoladas; nunca apontar para produção.

Diferencie teste automatizado, homologação com identidades sintéticas e validação manual com contas/dispositivos reais. Não diga que uma etapa foi validada se ela não foi executada nesta revisão.

## Publicação e integração

- PR #28 é draft e não representa autorização de merge em main.
- A branch preview é o ambiente de evolução. Documentação e código do ecossistema devem permanecer nela até decisão explícita.
- Antes de integrar: revisar diff completo, migrações, RLS, compatibilidade de dados, autenticação/licenças, backup/restauração, fluxo offline/online, conflitos, duas contas e dois dispositivos, PWA/rotas e rollback.
- A página de vendas e os projetos Cloudflare existentes devem permanecer intactos.
