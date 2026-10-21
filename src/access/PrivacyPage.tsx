import { Link } from 'react-router-dom';
export default function PrivacyPage() {
  return (
    <main className="access-page">
      <article className="access-card">
        <h1>Privacidade no Vértice</h1>
        <p>
          Usamos sua conta Google para identificar você e validar sua licença de acesso. Não
          recebemos sua senha Google e não acessamos seus e-mails ou arquivos.
        </p>
        <p>
          Seu identificador Google, e-mail e registro da licença ficam no Supabase. A administração
          mantém registros de liberação e revogação para controlar o acesso.
        </p>
        <p>
          Suas listas, itens e histórico de preços ficam no armazenamento deste navegador. Nesta
          versão, não são enviados à nuvem e não aparecem automaticamente em outro aparelho. Limpar
          os dados do navegador pode apagar essas compras; use a exportação de backup.
        </p>
        <p>
          Após uma validação online, uma autorização assinada permite usar o app offline por até
          sete dias. Sair da conta remove a autorização deste navegador. Os dados locais são
          separados por conta.
        </p>
        <p>
          Para solicitar ajuda ou exclusão de dados da conta, use o contato do vendedor indicado na
          sua compra. Revogar uma licença impede novas autorizações, mas um aparelho offline pode
          conservar o acesso pelo prazo já concedido.
        </p>
        <Link to="/">Voltar ao aplicativo</Link>
      </article>
    </main>
  );
}
