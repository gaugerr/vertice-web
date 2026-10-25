// Delivery links only. These open the templates, never the buyer's personal copy.
export const financeFormats = [
  {
    id: 'google',
    title: 'Google Planilhas',
    description: 'Crie uma cópia na sua conta Google e mantenha seus registros nela.',
    note: 'O Google pode pedir login na conta em que você deseja salvar a cópia.',
    versions: [
      {
        title: 'Modelo limpo',
        description: 'Pronto para começar com seus próprios registros.',
        action: 'Criar cópia do modelo limpo',
        url: 'https://docs.google.com/spreadsheets/d/1lqra8SGALrb8N6l4W8vn_r8MUDxTdQU1xV1mn3fdnmg/copy',
      },
      {
        title: 'Demonstração',
        description: 'Dados de exemplo para conhecer a planilha antes de começar.',
        action: 'Criar cópia da demonstração',
        url: 'https://docs.google.com/spreadsheets/d/1CM5orJ2dGeLOrMGZkPLzIpaiopT48CQIKJAi6GwW4dc/copy',
      },
    ],
  },
  {
    id: 'excel',
    title: 'Microsoft Excel',
    description: 'Baixe o arquivo .xlsx para usar no Excel e salve suas alterações.',
    note: 'Os arquivos ficam nos downloads do seu dispositivo. Use um aplicativo compatível com .xlsx.',
    versions: [
      {
        title: 'Modelo limpo',
        description: 'Pronto para começar com seus próprios registros.',
        action: 'Baixar modelo limpo — .xlsx',
        url: 'https://drive.google.com/uc?export=download&id=1wGGyAMfwU6yVzaZHfx7KGcNi8Yo0AsPY',
      },
      {
        title: 'Demonstração',
        description: 'Dados de exemplo para conhecer a planilha antes de começar.',
        action: 'Baixar demonstração — .xlsx',
        url: 'https://drive.google.com/uc?export=download&id=1JNbdnGF9lD6rJ-Jjx222Gi1B2fKjeNyY',
      },
    ],
  },
] as const;
