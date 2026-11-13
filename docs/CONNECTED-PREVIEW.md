# Preview conectada do Vértice

> **Estado atual e retomada por IA (09/11/2026):** leia [AI-HANDOFF](AI-HANDOFF.md).
> App oficial, demonstração local e preview conectada são ambientes distintos.
> Resultados e instruções anteriores abaixo devem ser interpretados no contexto do ambiente e da data; o handoff registra as pendências atuais.

Entrada autenticada: <https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev/staging/>.
Demonstração fictícia preservada: o mesmo endereço sem `/staging/`.

O proprietário autorizou o uso do banco Vértice existente. Dados registrados na
entrada autenticada são dados reais da conta e ficam separados da demonstração.
Nenhum projeto/branch Supabase pago foi criado. A interface oficial permanece na
`main`; conectar a preview não significa que o app oficial já esteja sincronizando.

## Configuração e limites

- Build Cloudflare: `connected-preview.json` é ativado exclusivamente em
  `preview/controle-financeiro`. Só contém valores públicos. Builds locais ficam
  desativados por padrão; `VITE_WORKSPACE_DISABLE_REAL=1` força essa condição.
- Runtime: exige modo `existing-project-preview`, projeto Vértice, endpoint e
  origem estável exatos. Outros aliases não podem conectar a esse banco.
- `workspaces`: Edge Function separada. Valida sessão pelo Supabase Auth,
  identidade Google verificada, origem e participação. Nenhuma alteração em
  `license-check`, `license-admin` ou `cakto-webhook`.
- Chave ES256 dedicada criptografada no Vault. `workspace_signing_jwk` só pode ser
  executada por `service_role`; seu leitor privado verifica também a claim de
  serviço. Nenhum outro segredo/URL Cakto é acessado. Não retornar a chave privada
  em diagnósticos, logs ou respostas do endpoint.
- A licença do titular é vinculada pelo fluxo de acesso existente. O convidado
  não recebe licença. Revogação consulta o status atual e bloqueia escrita;
  leitura/exportação dos participantes ativos é preservada.

## Retorno do Google

No projeto Vértice, em **Authentication → URL Configuration → Redirect URLs**,
adicionar e preservar:

```text
https://preview-controle-financeiro.vertice-financeiro-preview.pages.dev/staging/
```

Não substituir os URLs existentes, Site URL, configuração Google ou webhook.
O callback do provedor Google continua sendo o Supabase existente. Os plugins
disponíveis nesta sessão não expõem a edição/leitura dessa lista de Auth; confirmar
esse item no painel. O teste sem sessão/provider redirect não comprova que o retorno
real está autorizado. Não usar curingas ou redirecionar pelo app oficial para contornar isso.

## Piloto com duas contas

1. Titular entra com seu Google licenciado na entrada autenticada. Criar uma lista
   e uma despesa pequenas, recarregar e conferir a persistência.
2. Em Configurações → Compartilhar, criar Nossa casa e convidar o Google da outra
   pessoa. Ela abre o link em outro navegador/aparelho e entra com a própria conta.
3. Conferir que ambos veem a lista/despesa do casal, podem editar e que Meu espaço
   continua separado. O espaço compartilhado começa vazio; cópia é explícita.
4. Com o app aberto e carregado, tirar a conexão, editar e reconectar. Conferir
   envio/versão final nos dois aparelhos. Editar o mesmo registro nos dois deve
   exigir revisão, preservando os valores locais.
5. Remover o parceiro; conferir bloqueio online e fila em quarentena. A validade
   offline limita a revogação conhecida sem conexão. Não prometer apagar exports.

Dados antigos da preview e do app oficial não são importados automaticamente.
Backups financeiros/compras são separados; a importação deve ser explícita no
espaço pessoal correto, conservando o arquivo original. Comparar totais e relações
antes de qualquer migração em massa.

## Verificação técnica

A abertura usa primeiro o cache do mesmo usuário/projeto/espaço, somente com
autorização ES256 ainda válida. O primeiro download completo marca o snapshot
como pronto, inclusive quando vazio. Caches anteriores recebem essa marca após
uma sincronização completa; dados e filas anteriores são preservados.

Configuração, identidade e espaços são conferidos em segundo plano. Falhas não
apagam dados nem significam sincronização concluída. A interface indica a última
conferência completa, pendências e necessidade de reconexão. Cada requisição tem
limite de dez segundos. Logout, sessão rejeitada e remoção conhecida bloqueiam
nova leitura do cache; operações pendentes são preservadas.

`node shared/workspaces/cache-browser-check.mjs` verifica a abertura em até um
segundo com configuração/Auth/API suspensas, autorização sintética assinada,
atualização posterior e rascunho preservado. Todo HTTP do teste é interceptado;
não usa contas reais. Esse teste pressupõe os arquivos do app carregados e não
comprova instalação/preparo offline da PWA oficial.

O teste PostgreSQL usa as migrações reais de licenças/Cakto e identidades sintéticas
em container descartável sem rede. Cobre também as permissões do segredo dedicado.
O cliente é verificado com IndexedDB, transporte HTTP e assinatura ES256. O navegador
testa compras, financeiro, dois perfis fictícios, reconexão e layout. Esses testes
não substituem o piloto Google com contas reais.

O endpoint publicado deve responder: OPTIONS da origem autorizada → 200; sem sessão
→ 401; origem oficial/não autorizada → 403. Sondas não criam espaços nem licenças.
Comparar os fingerprints de acesso/Cakto, versões de Edge Functions e cron após
publicar. Nunca enviar eventos Cakto assinados fictícios em produção.

## Antes de integrar à main

Fechar piloto Google/duas contas, verificar transferência recuperável dos dados
locais, preparar os módulos da PWA e integrar a navegação financeira ao ponto de
entrada protegido oficial. A pasta de preview não substitui automaticamente o
router oficial. Preservar administração de licenças, backup e acesso offline.
Exigir CI verde e revisar o diff unificado, sem rascunhos duplicados de schema.
O PR de banco pode ser revisado separadamente; a interface ainda requer essa etapa.
