export const quickStart = [
  [
    'Escolha um formato',
    'Google Planilhas na sua conta ou arquivo Excel no seu dispositivo. Escolha uma versão principal: elas não se atualizam entre si.',
  ],
  [
    'Explore e comece',
    'Conheça os exemplos da Demonstração. Para seus registros, use o Modelo limpo. Renomeie a cópia e salve um atalho para ela.',
  ],
  [
    'Monte seu primeiro mês',
    'Selecione mês e ano no Dashboard, cadastre as contas recorrentes e registre suas receitas e gastos avulsos.',
  ],
] as const;

export const guideSteps = [
  {
    title: 'Prepare sua cópia',
    paragraphs: [
      'No Google Planilhas, toque em criar cópia e escolha sua conta. No Excel, baixe o arquivo e salve uma cópia de trabalho. Um nome como “Minhas finanças — Vértice” ajuda a encontrar depois.',
      'Use a Demonstração para aprender e o Modelo limpo para começar. Você não precisa apagar os exemplos um por um.',
      'Preencha os campos indicados em lavanda. Preserve fórmulas, células automáticas, colunas auxiliares e abas técnicas. Use as categorias disponíveis; não renomeie categorias com registros sem conferir as instruções da sua versão.',
    ],
  },
  {
    title: 'Escolha mês e ano no Dashboard',
    paragraphs: [
      'Selecione o mês e o ano que deseja acompanhar no topo do Dashboard. Os indicadores e relatórios usam esse período.',
      'Receitas são as entradas consideradas pela planilha. Despesas incluem Contas Fixas e Lançamentos avulsos. Saldo do período é receitas menos despesas; não é necessariamente o saldo da sua conta bancária.',
      'A pagar mostra as pendências identificadas nos registros. A taxa de poupança é um indicador calculado: ela não confirma que você transferiu dinheiro para uma reserva.',
    ],
  },
  {
    title: 'Cadastre contas fixas e seus valores',
    paragraphs: [
      'Em Contas Fixas, cadastre a conta, categoria, dia de vencimento, forma de pagamento e mês de início. Exemplos: aluguel, internet e assinaturas.',
      'Em Reajustes, selecione a conta cadastrada e informe o início do valor e o valor mensal. O valor atual em Contas Fixas é automático.',
      'Pagou? Preencha “Mês pago” com o mês/ano correspondente. Esse campo identifica a competência paga; não o trate como um extrato completo do histórico de pagamentos.',
      'O preço mudou? Acrescente uma linha em Reajustes com a nova vigência. Mantenha os registros antigos e use apenas um valor por conta e mês de início. Para encerrar a recorrência, informe Fim em Contas Fixas; não reutilize a conta para outra despesa.',
      'Não registre a mesma conta também em Lançamentos: as despesas recorrentes já entram nos cálculos da planilha.',
    ],
  },
  {
    title: 'Registre receitas e gastos avulsos',
    paragraphs: [
      'Em Lançamentos, preencha as colunas A a G: Data, Descrição, Categoria, Forma de pagamento, Valor, Status e Observação, se necessário. Informe o valor sempre positivo.',
      'A categoria determina automaticamente Receita ou Despesa. Use o status adequado: Recebido para uma entrada confirmada, Pago para uma despesa paga ou Pendente quando ainda estiver em aberto. Tipo, Mês e Ano são automáticos.',
      'Finalizou uma compra de R$ 126,40 no app? Registre uma linha com a data, “Compra no supermercado”, categoria Mercado, forma de pagamento, valor 126,40 e o status correspondente.',
      'Se registrou o total da compra, não registre também os produtos separadamente. O app não envia esse total para a planilha: a passagem é manual.',
    ],
  },
  {
    title: 'Defina um orçamento possível',
    paragraphs: [
      'Em Orçamento, informe a Meta mensal por categoria e a meta de poupança em percentual. Comece pelas categorias que mais pesam no seu mês.',
      'Compare Meta no período, Realizado e Diferença. Os indicadores ajudam a revisar seus limites; não movimentam dinheiro nem bloqueiam gastos.',
      'Antes da próxima ida ao mercado, consulte quanto resta na categoria Mercado e use isso como referência para definir o orçamento da lista no app.',
    ],
  },
  {
    title: 'Transforme objetivos em metas',
    paragraphs: [
      'Em Metas, informe o nome do objetivo, Valor alvo, Já guardado e Aporte mensal. Atualize “Já guardado” conforme a reserva real.',
      'Falta, percentual e previsão são calculados a partir do preenchimento. A previsão é uma estimativa; cadastrar uma meta não transfere dinheiro nem atualiza sua reserva automaticamente.',
      'Neste modelo, aportes lançados na categoria Reserva e Investimentos entram como despesa nos relatórios. Considere isso ao interpretar o saldo e evite registrar o mesmo aporte duas vezes.',
    ],
  },
  {
    title: 'Revise e preserve seu histórico',
    paragraphs: [
      'Confira o Dashboard e o Resumo Anual para observar os meses do ano selecionado. Continue usando as datas dos registros; não apague o mês anterior para começar o próximo.',
      'No Google, confira se as alterações foram salvas na sua cópia. No Excel, salve o arquivo e mantenha uma cópia de segurança.',
      'Esses botões abrem os modelos de entrega, não sua cópia pessoal. Para o uso diário, abra o arquivo que você já salvou no Drive ou no dispositivo.',
    ],
  },
] as const;

export const sheetMap = [
  ['Dashboard', 'Escolha o período e acompanhe os indicadores do mês.'],
  ['Lançamentos', 'Registre receitas e despesas avulsas, sem duplicar as recorrentes.'],
  ['Contas Fixas', 'Cadastre recorrências, vencimentos, início, fim e mês pago.'],
  ['Reajustes', 'Informe os valores das contas e preserve as vigências anteriores.'],
  ['Orçamento', 'Defina metas mensais por categoria e compare com o realizado.'],
  ['Resumo Anual', 'Observe os meses do ano selecionado no Dashboard.'],
  ['Metas', 'Acompanhe objetivos, valores guardados e aportes planejados.'],
  ['Config', 'Consulte categorias e opções. Preserve o catálogo e as fórmulas.'],
] as const;

export const routine = [
  [
    'Depois da compra',
    'Confira o total final no app e registre uma única vez na categoria Mercado.',
  ],
  [
    'No dia a dia',
    'Reserve alguns minutos para registrar gastos avulsos e entradas. Consistência vale mais que preencher tudo de uma vez.',
  ],
  [
    'Uma vez por semana',
    'Confira pendências e comprovantes. Veja quais categorias estão perto da meta e ajuste as próximas compras.',
  ],
  [
    'Antes do mercado',
    'Consulte o orçamento mensal de Mercado e defina o limite da próxima lista no app.',
  ],
  [
    'Quando o preço mudar',
    'Acrescente uma vigência em Reajustes, sem sobrescrever o valor antigo.',
  ],
  ['Ao receber renda', 'Atualize o lançamento e revise se o planejamento do mês continua viável.'],
  [
    'No fim do mês',
    'Confira diferenças, reveja assinaturas e ajuste o planejamento do próximo período, preservando o histórico.',
  ],
] as const;

export const financeFaq = [
  [
    'O celular abriu o modelo no app Google Planilhas. Como copiar?',
    'O aplicativo do Google pode assumir o link /copy e abrir o modelo diretamente. Toque nos três pontinhos ⋮ → Compartilhar e exportar → Fazer uma cópia. Escolha um nome e confirme. Depois, use a cópia salva no seu Drive. Os nomes das opções podem variar conforme a versão do aplicativo. Não edite o modelo original.',
  ],
  [
    'Preciso usar Google e Excel?',
    'Não. Escolha uma versão principal para seus registros. As duas versões são independentes; editar uma não atualiza a outra. A Demonstração é opcional, para consulta.',
  ],
  [
    'O app envia minhas compras para a planilha?',
    'Não. Registre manualmente o total final em Lançamentos, na categoria Mercado. Não há sincronização com compras, bancos ou cartão.',
  ],
  [
    'Por que o botão pede para criar outra cópia?',
    'Ele abre o modelo original de entrega. Sua cópia anterior continua na sua conta Google. Abra-a pelo Drive ou salve-a nos favoritos para o uso diário. No Excel, reabrir o download não recupera alterações de outro arquivo.',
  ],
  [
    'A planilha é minha? O Vértice vê meus registros?',
    'Você trabalha na sua própria cópia ou no arquivo baixado. Esta seção não lê nem recebe seus dados financeiros. Confira as permissões de compartilhamento da sua cópia antes de enviar o link a alguém.',
  ],
  [
    'Por que o saldo não bate com meu banco?',
    'Confira o mês e o ano, as pendências, os valores e possíveis duplicidades entre Contas Fixas e Lançamentos. O saldo é um indicador do período e pode incluir aportes em Reserva e Investimentos; não representa uma conciliação bancária automática.',
  ],
  [
    'Como evitar duplicar gastos do cartão?',
    'Não conte a compra e o pagamento da fatura como duas despesas. Adote um critério consistente para seus registros. Este modelo não promete controle automático de faturas ou parcelamentos.',
  ],
  [
    'Posso usar sem internet?',
    'O tutorial pode ser consultado offline depois do preparo do app. Criar cópias no Google e baixar pelo Drive exige internet. O uso offline no Google Planilhas tem configuração própria; a autorização offline do Vértice não o configura. No Excel, salve o arquivo no dispositivo.',
  ],
  [
    'Minha cópia recebe atualizações do modelo?',
    'Não automaticamente. Preserve seus registros e backups antes de trocar de versão. Um novo download ou uma nova cópia não substitui nem atualiza seu arquivo de trabalho.',
  ],
  [
    'E se o link não abrir ou o download falhar?',
    'Confira a conexão e tente abrir no navegador. Para copiar no Google, entre na conta desejada. Para Excel, confira a pasta Downloads e use um aplicativo compatível com .xlsx. Se aparecer um pedido de permissão no modelo, informe ao suporte; não é necessário editar o arquivo original.',
  ],
] as const;
