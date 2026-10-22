import { useRouteError } from 'react-router-dom';
import { BackLink } from './BackLink';

export function RouteError() {
  const error = useRouteError();
  console.error('Vértice:', error);
  return (
    <main className="main-content state-panel">
      <h1>Não foi possível abrir esta tela</h1>
      <p>Seus registros salvos continuam no aparelho.</p>
      <BackLink to="/" reloadDocument>
        Voltar ao início
      </BackLink>
    </main>
  );
}
