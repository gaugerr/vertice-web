# Validação — comparador de embalagens

Publicado em **https://vertice-web-navy.vercel.app**, projeto Vercel `vertice-web`, repositório [gaugerr/vertice-web](https://github.com/gaugerr/vertice-web).

Código validado e publicado na `main`: `193bbaed34f5e4d96e3e255bb2b78de97b573bde`. O registro posterior desta validação altera somente a documentação. Desenvolvimento isolado na branch `feat/package-comparator`.

## Comportamento entregue

- Botão **Comparar** na página das listas e dentro das categorias, próximo aos filtros.
- Janela **Qual compensa?** com duas opções fixas, A e B, e modos Peso (g/kg), Volume (ml/L) e Unidades.
- Resultado automático com preços por kg, L ou unidade, opção mais barata, economia normalizada e percentual em relação à opção mais cara.
- Comparação por produtos cruzados exatos; arredondamento apenas na apresentação. Diferenças inferiores a um centavo ou 0,1% são explicitadas, sem falso empate.
- Valores positivos, preço com até duas casas decimais e conteúdo com até três. Quantidades por unidade exigem números inteiros.
- Primeiro preço recebe foco ao abrir por toque; Enter percorre os campos. Janela ajustada ao visualViewport, com rolagem interna e sem transbordamento horizontal em 320 px.
- Fechar preserva a rolagem da compra, os campos ainda não salvos e o foco do botão de abertura.
- Cada modo mantém seu próprio rascunho no sessionStorage da aba. Fechar a janela, mudar de categoria ou recarregar a mesma aba preserva os campos.
- Limpar afeta apenas o modo atual. Armazenamento bloqueado mantém o cálculo em memória e apresenta aviso discreto.
- Uso totalmente local e offline após o carregamento/cache inicial do PWA. Sem chamadas de API ou dependência de inteligência artificial.

## Proteção dos dados existentes

- O comparador não grava no banco financeiro. Um teste compara o conteúdo real do IndexedDB antes e depois do uso, exigindo igualdade.
- Sem migração nova: banco Dexie permanece na versão 2 e backup JSON na versão 3.
- Listas, orçamento, compras, categorias, importação e exportação continuam nos fluxos existentes.
- Rascunhos do comparador ficam exclusivamente na chave `vertice:package-comparator:v1`. Dados inválidos são descartados apenas nesse espaço.
- A economia exibida usa uma quantidade de referência comum; não representa um lançamento financeiro ou o total de uma compra.

## Checks do código

[Execução na main 39516074316](https://github.com/gaugerr/vertice-web/actions/runs/39516074316): **success**.

[Execução final da branch 39515736922](https://github.com/gaugerr/vertice-web/actions/runs/39515736922): **success**.

- TypeScript estrito, ESLint e Prettier: aprovados.
- Vitest: **70 testes aprovados**, em dez arquivos.
- Build de produção: aprovado.
- JavaScript total, incluindo módulos sob demanda: **154,8 KiB gzip**, abaixo do orçamento de 250 KiB.
- Playwright em Chromium e WebKit: **23 cenários aprovados e 3 deliberadamente ignorados**.
- Os três casos ignorados em WebKit são os fluxos de instalação/reabertura offline existente, atualização do service worker e comparador após recarga offline; esses fluxos são executados em Chromium.

Cobertura nova: unidades mistas, empates exatos, diferenças escondidas pelo arredondamento, valores normalizados elevados, economia inferior a um centavo, rejeição de valores inválidos, foco por toque, sequência de Enter, largura de 320 px, rascunhos por modo e categoria, recarga, armazenamento bloqueado, isolamento do IndexedDB e preservação de valores ainda não salvos.

A suíte também mantém a cobertura anterior de orçamento, migração de banco antigo, compatibilidade dos backups, filtros, múltiplas abas e compra rápida.

[Pacote compilado validado](https://github.com/gaugerr/vertice-web/actions/runs/39516074316/artifacts/12307797618). Deve ser servido por HTTP/HTTPS.

## Checks do endereço público

[Execução 39516344913](https://github.com/gaugerr/vertice-web/actions/runs/39516344913): **success**.

- Identificação da versão `pwa-package-comparator-v1-production` confirmada no HTML público.
- HTTPS, manifesto standalone, service worker JavaScript e cache conferidos; asset inexistente retorna 404.
- **22 cenários aprovados e 2 deliberadamente ignorados** no endereço da Vercel.
- Comparador exercitado sem conexão, com recarga da mesma aba e rascunhos preservados.
- Fluxos existentes de compra e orçamento também executados na aplicação publicada.
- O teste de atualização sintética do service worker é exclusivo do servidor local de testes.

## Limites

Foco e toque foram verificados em navegadores automatizados, com revisão de capturas em largura de celular. Teclado virtual, desempenho e instalação em aparelhos físicos não são comprovados por esses testes.

Rascunhos são temporários e não constituem histórico ou backup. A comparação pressupõe produtos equivalentes; qualidade, concentração e rendimento podem mudar a decisão.

Os checks completos rodaram no GitHub Actions; código, lockfile e build validado estão disponíveis no workspace. O aplicativo continua local, sem login, controle de compradores ou sincronização em nuvem.
