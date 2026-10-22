import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeCode, safeReturnPath } from './client';
import { accessController } from './controller';
import { AccessScreen } from './AccessScreen';
export default function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const target = safeReturnPath(sessionStorage.getItem('vertice:auth:return'));
    if (!code || params.has('error')) {
      window.history.replaceState(null, '', '/auth/callback');
      setError('O login foi cancelado ou expirou. Tente novamente.');
      return;
    }
    void exchangeCode(code)
      .then(async (result) => {
        if (!live) return;
        window.history.replaceState(null, '', '/auth/callback');
        if (result.error) throw result.error;
        await accessController.start();
        await accessController.refresh(true);
        if (live) {
          sessionStorage.removeItem('vertice:auth:return');
          navigate(target, { replace: true });
        }
      })
      .catch(() => {
        if (live) {
          window.history.replaceState(null, '', '/auth/callback');
          setError('Não foi possível concluir o login. Tente novamente.');
        }
      });
    return () => {
      live = false;
    };
  }, [navigate]);
  return (
    <div className="access-page">
      {error ? (
        <>
          <p role="alert">{error}</p>
          <AccessScreen />
        </>
      ) : (
        <section className="access-card">
          <h1>Concluindo seu login…</h1>
        </section>
      )}
    </div>
  );
}
