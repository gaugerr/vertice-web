# Do Flutter para React

| Flutter                                | Neste projeto                                                  |
| -------------------------------------- | -------------------------------------------------------------- |
| Widget                                 | Componente React, uma função que retorna JSX                   |
| `State` e `setState`                   | `useState` mantém valores e solicita atualização do componente |
| `TextEditingController`                | Valor do campo ligado ao estado com `value` e `onChange`       |
| `ChangeNotifier` / `ListenableBuilder` | Consultas reativas `useLiveQuery` para os dados persistidos    |
| `Navigator` e rotas                    | React Router e URLs navegáveis                                 |
| `sqflite` / Drift                      | Dexie sobre IndexedDB, usando tabelas e índices em vez de SQL  |
| `ThemeData`                            | Tokens CSS, Tailwind e componentes compartilhados              |
| `Form` e validadores                   | Formulário HTML, validações nativas e schemas Zod              |
| `Future`                               | `Promise`, com `async` e `await`                               |
| `flutter build web`                    | `npm run build`, gerando `dist`                                |
| `pubspec.yaml` e lock                  | `package.json` e `package-lock.json`                           |

## Caminho de uma alteração

1. O usuário confirma o formulário.
2. Um hook bloqueia submissões duplicadas e chama o repositório.
3. O repositório valida os dados e grava em uma transação local.
4. Dexie detecta a mudança nas consultas observadas.
5. Os componentes que consultam os registros recebem os valores confirmados.

O React não é o banco. Rascunhos pertencem ao formulário; dados salvos pertencem ao IndexedDB. A rede não participa desse caminho na primeira versão.

## Navegador e PWA

O navegador desenha HTML e CSS. O service worker guarda o código estático para abrir offline; o IndexedDB guarda listas e produtos. São armazenamentos com responsabilidades diferentes.

As ferramentas do navegador permitem inspecionar Interface, Console, Network e Application. Em Application, confira IndexedDB, Cache Storage e Service Workers. Para validar offline, prepare o cache antes de desconectar a rede.

Para adicionar uma função, comece pelos tipos e regras de domínio, implemente a operação no repositório e só então conecte o formulário/tela. Evite colocar cálculo financeiro dentro de JSX.
