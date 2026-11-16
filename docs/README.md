# Documentação do Vértice

Comece por [AI-HANDOFF.md](AI-HANDOFF.md) para o estado atual. Este índice separa contexto de produto, contratos técnicos e registros históricos.

## Essenciais

| Documento                        | Para que serve                                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [AI-HANDOFF.md](AI-HANDOFF.md)   | Estado atual, ambientes, arquitetura, riscos e próximos passos. Primeira leitura para qualquer IA ou pessoa nova. |
| [../AGENTS.md](../AGENTS.md)     | Regras obrigatórias para agentes e contribuidores.                                                                |
| [../README.md](../README.md)     | Visão geral do produto, execução local e mapa do código.                                                          |
| [FUTURE-SYNC.md](FUTURE-SYNC.md) | Critérios para levar o ecossistema da preview ao app oficial.                                                     |

## Arquitetura e produto

| Documento                                                                              | Escopo                                                                                                        |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [CONNECTED-PREVIEW.md](CONNECTED-PREVIEW.md)                                           | Diferença entre demonstração local e /staging/, configuração e piloto conectado.                              |
| [FINANCEIRO.md](FINANCEIRO.md)                                                         | Central de modelos Google Sheets/Excel presente no app oficial. Não confundir com o ledger nativo da preview. |
| [WORKSPACE-DATABASE.md](WORKSPACE-DATABASE.md)                                         | Schema Supabase, RLS, workspace_command e contratos de persistência remota.                                   |
| [../shared/workspaces/README.md](../shared/workspaces/README.md)                       | Arquitetura de espaços, outbox, sincronização, conflitos e segurança.                                         |
| [../previews/controle-financeiro/README.md](../previews/controle-financeiro/README.md) | App financeiro/compartilhado da preview.                                                                      |
| [../previews/controle-financeiro/AGENTS.md](../previews/controle-financeiro/AGENTS.md) | Regras específicas para mudanças na preview.                                                                  |

## Operação e acesso

| Documento                            | Escopo                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| [OPERACOES.md](OPERACOES.md)         | Procedimentos de leitura e operação de GitHub, Cloudflare, Supabase e Cakto. Conferir estado atual antes de executar. |
| [CLOUDFLARE.md](CLOUDFLARE.md)       | Projetos Pages, builds e publicação.                                                                                  |
| [access/SETUP.md](access/SETUP.md)   | Configuração de Auth, origens, chaves e licença. Nunca copiar segredos para o cliente.                                |
| [access/GOOGLE.md](access/GOOGLE.md) | Configuração do provedor Google OAuth.                                                                                |
| [access/CAKTO.md](access/CAKTO.md)   | Webhook, captura, processamento e recuperação de licenças. Conferir produção antes de operar.                         |
| [access/ADMIN.md](access/ADMIN.md)   | Administração e permissões.                                                                                           |

## Validação e histórico

| Documento                                                            | Escopo                                                                                                        |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [VALIDATION.md](VALIDATION.md)                                       | Registro histórico de validação do app de compras. Não comprova o deploy atual.                               |
| [WORKSPACE-DATABASE-VALIDATION.md](WORKSPACE-DATABASE-VALIDATION.md) | Evidências registradas da migração inicial e testes isolados. Complementar com Actions e estado remoto atual. |
| [access/VALIDATION.md](access/VALIDATION.md)                         | Testes históricos de acesso/licenças.                                                                         |
| [FLUTTER-TO-WEB.md](FLUTTER-TO-WEB.md)                               | Compatibilidade e importação de dados do app Flutter.                                                         |

## Regras para interpretar documentos

- AI-HANDOFF é o resumo de estado; documentos específicos descrevem contratos mais profundos.
- Datas, hashes, resultados de CI, versões de Edge Functions e estados de serviços são fotografias históricas. Sempre revalidar antes de operar.
- Supabase migrations é o histórico canônico versionado; não reaplicar migrações registradas.
- Arquivos em supabase/drafts são rascunhos ou evidência histórica, não scripts de deploy.
- Não confundir o Financeiro de planilhas no main com o Financeiro nativo da preview.
