# Administração de licenças

O painel `/admin` usa o login Google existente. O servidor confere a identidade
verificada e o cadastro de administrador em todas as operações.

**Excluir licença** exige digitar o e-mail exatamente como aparece no cadastro.
Remove somente a linha da licença, em uma transação com o registro da exclusão.
Mantém a conta Auth/identidade Google, as compras/eventos Cakto e a auditoria.
Os vínculos históricos com a licença removida ficam nulos; os registros continuam
preservados. Uma nova liberação usa a mesma conta Google e seu UID existente.
Licenças de administradores não podem ser excluídas por esta operação.

A remoção passa a bloquear o acesso na próxima verificação online. Autorizações
offline já emitidas continuam sujeitas ao prazo existente de até sete dias.
Excluir uma licença não solicita reembolso nem remove cópias de planilhas ou
dados locais. Uma nova notificação válida da Cakto pode criar a licença novamente;
para um bloqueio com prioridade sobre a automação, usar **Revogar**.

A função `license-admin` direciona `action: delete` para a RPC
`access_admin_delete_license`. Somente `service_role` pode executá-la, com direitos
do invocador, após verificar administrador, identidade Google e confirmação.
Fixtures e testes destrutivos são executados somente no Supabase isolado.
