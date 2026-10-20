import {CircleAlert, LoaderCircle, ShoppingBasket} from 'lucide-react';
import {Link} from 'react-router-dom';
import {errorMessage} from '../lib/errors';
import {Button} from './Button';

export function ErrorMessage({message}: {message: string}) {
  return message ? <p role="alert" className="error-message"><CircleAlert size={17} aria-hidden="true" />{message}</p> : null;
}
export function Loading() {return <div className="state-panel" role="status"><LoaderCircle className="animate-spin" aria-hidden="true" /><p>Abrindo seus dados…</p></div>}
export function QueryError({error}: {error: unknown}) {
  return <div className="state-panel"><CircleAlert size={32} aria-hidden="true" /><h2>Não foi possível abrir os dados</h2>
    <p>{errorMessage(error)}</p><p>Use o navegador atualizado e permita o armazenamento, fora do modo privado.</p>
    <Button onClick={() => window.location.reload()}>Tentar novamente</Button></div>;
}
export function Missing({label = 'Esta lista não está mais disponível.'}: {label?: string}) {
  return <div className="state-panel"><ShoppingBasket size={36} aria-hidden="true" /><h2>{label}</h2><Link className="text-link" to="/">Voltar às listas</Link></div>;
}
