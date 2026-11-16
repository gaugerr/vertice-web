# Integração futura do ecossistema ao app oficial

Este documento trata da **integração do ecossistema da preview ao aplicativo oficial**. A sincronização por workspace já existe na branch de desenvolvimento; não descreva mais essa parte como se ainda fosse apenas uma proposta.

Estado consultado em 16/11/2026:

- main: compras locais em IndexedDB/Dexie; login Google controla acesso/licença, não sincroniza compras.
- preview/controle-financeiro: Compras + Financeiro, espaços, Supabase, outbox, sincronização, conflitos e backups em desenvolvimento/homologação.
- PR #27: aberto e draft contra `main`; a migração inicial `20261109173641` está registrada como aplicada e já integra o ecossistema em preview. Não reaplicar nem integrar isoladamente sem revisar a sobreposição.
- PR #28: aberto e draft contra `main`, com `preview/controle-financeiro` como head; 41 commits e 96 arquivos. Ainda não integrado ao app oficial.
- PR #29: fechado como merged em 11/11/2026 somente na branch de preview. Registra a migração `20261111225724` e o ledger v2; `main` não foi alterada.
- PR #30: documentação em draft, direcionada à branch de preview; ainda não integrada.

## O que falta para o app oficial

A integração não é apenas trocar o endpoint ou ativar uma flag. O app oficial precisa adotar a arquitetura por workspace sem perder compatibilidade com bancos locais, backups, licenças, PWA e experiência já publicada.

Checklist mínimo:

1. **Arquitetura e roteamento**
   - Integrar o shell e os módulos sem duplicar regras de domínio.
   - Preservar rotas, deep links, comportamento de instalação e atualização PWA.
   - Manter separação explícita entre Meu espaço e Nossa casa.

2. **Migração de dados**
   - Inventariar bancos Dexie existentes por projeto/UID e formatos de backup.
   - Fazer importação explícita, transacional, idempotente e recuperável.
   - Nunca apagar o banco local de origem após a migração.
   - Testar banco vazio, legado, dados parcialmente migrados e falha durante importação.

3. **Identidade e licença**
   - Reutilizar Auth/licenças existentes; não criar um sistema paralelo.
   - Validar titular, convidado, revogação, troca de conta e remoção.
   - Não permitir que convite ou workspace conceda licença.

4. **Sincronização**
   - Preservar atomicidade local + outbox, IDs de operação, recibos idempotentes, versões, journal e cursor por workspace.
   - Testar resposta perdida, reenvio, duplicidade, ordenação, exclusão lógica, conflitos e cliente antigo.
   - Mostrar estados distintos: salvo localmente, pendente, sincronizando, confirmado e erro.
   - Não prometer sincronização com o app fechado nem usar relógio do cliente como árbitro de conflito.

5. **Segurança e privacidade**
   - Revisar RLS, isolamento por workspace, origem autorizada e derivação do ator no servidor.
   - Confirmar que nenhuma chave privilegiada chega ao navegador.
   - Testar duas contas sem acesso cruzado, remoção e reentrada com nova geração.

6. **Confiabilidade e operação**
   - Testar backup/restauração antes e depois da sincronização.
   - Medir falhas, pendências antigas, latência e taxa de conflito sem registrar dados pessoais.
   - Preparar rollback do frontend sem desfazer migrações aditivas já usadas.
   - Fazer rollout gradual e observar erros antes de ampliar o acesso.

## Critérios de aceite

- Testes automatizados relevantes verdes e CI atual conferida.
- Piloto com duas contas e dois dispositivos reais aprovado.
- Nenhuma perda, duplicação ou vazamento de dados em cenários de falha.
- Migração de dados locais e restauração testadas com cópias recuperáveis.
- Auth, licenças, Cakto, site de vendas e domínios preservados.
- Documentação, suporte e instruções de recuperação atualizados.
- Autorização explícita do proprietário para merge e publicação.

Até esses critérios serem atendidos, mantenha o ecossistema na branch de preview.
