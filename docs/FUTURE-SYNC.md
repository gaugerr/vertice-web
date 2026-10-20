# Evolução para Supabase e acesso comercial

Este documento descreve uma etapa futura. Não há autenticação, pagamentos, fila de sincronização ou SDK Supabase nesta versão.

## Fluxo pretendido

```text
Ação do usuário
  → transação no banco local
  → atualização da interface
  → operação persistente na fila de saída
  → envio autenticado quando houver internet
  → confirmação e atualização do estado de sincronização
```

A gravação do registro e da operação pendente deverá ser atômica. O envio usará IDs de operação para suportar reenvios sem duplicação, retentativas com espera progressiva e exclusões representadas de forma sincronizável. Não remova uma operação antes da confirmação do servidor.

## Decisões necessárias nessa etapa

- Política de conflito para edições em aparelhos diferentes, com versões do servidor. Horário do cliente sozinho não define qual alteração vence.
- Separação dos bancos ou das chaves por usuário. Trocar ou sair da conta não pode expor dados de outra pessoa.
- Oferta explícita de vincular/importar os registros locais sem conta ao primeiro login.
- Cursor e versões para baixar mudanças e exclusões com segurança.
- Estados de interface: salvo localmente, pendente, enviando, confirmado e erro. Conectado à internet não significa sincronizado.
- Expiração da sessão offline e regras comerciais para dispositivos previamente autorizados.

Não há garantia de sincronização com o aplicativo fechado, principalmente em iOS. O caminho obrigatório será sincronizar enquanto aberto e ao retomar/focar/recuperar conexão. Service worker e Background Sync serão apenas melhorias opcionais conforme suporte.

## Login, compra e autorização

São três partes distintas. Supabase Auth identifica o usuário. Uma concessão de acesso validada no servidor registra o direito de usar o produto. Checkout e webhooks confirmam a compra de forma autenticada e idempotente.

O cliente nunca pode conceder acesso a si mesmo nem usar um campo editável de perfil como prova de compra. Acesso vitalício é uma regra comercial, não uma propriedade do cache offline.

Antes de implementar, consultar o changelog e a documentação atual do Supabase. No frontend usar somente URL e chave pública apropriada. Chaves secretas e `service_role` ficam no servidor. Habilitar RLS nas tabelas expostas e validar propriedade por usuário tanto na leitura quanto na alteração, incluindo `WITH CHECK` nas políticas de atualização.

Validar com duas contas diferentes que ninguém lê, altera, exclui ou reatribui registros de outra pessoa. O teste de compra deve verificar o estado no servidor, não somente ocultar um botão na interface.
