import {useEffect} from 'react';
import {Link, NavLink, Outlet, useBlocker, useLocation, useNavigation} from 'react-router-dom';
import {ArrowUpRight, HardDrive, Settings2, ShoppingBasket} from 'lucide-react';
import {PwaStatus} from '../pwa/components/PwaStatus';
import {InstallButton} from '../pwa/components/InstallButton';
import {hasUnsavedChanges} from '../shared/lib/drafts';
import {hasPendingWrites} from '../data/database/writes';

export default function App() {
  const location = useLocation();
  const navigation = useNavigation();
  const blocker = useBlocker(() => hasUnsavedChanges() || hasPendingWrites());
  useEffect(() => {
    if (blocker.state === 'blocked') {
      if (!hasPendingWrites() && window.confirm('Descartar as alterações não salvas e sair desta tela?')) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges() || hasPendingWrites()) {event.preventDefault(); event.returnValue = ''}
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, []);
  useEffect(() => {window.scrollTo(0, 0)}, [location.pathname]);
  return <><a href="#main" className="skip-link">Pular para o conteúdo</a><PwaStatus /><header className="site-header"><div className="header-inner"><Link to="/" className="brand" aria-label="Vértice, minhas listas"><span className="brand-mark" aria-hidden="true">V</span><span>vértice<span className="brand-dot">.</span></span></Link><nav aria-label="Navegação principal"><NavLink to="/" end><ShoppingBasket size={17} aria-hidden="true" /><span>Minhas listas</span></NavLink><NavLink to="/settings" aria-label="Dados e aplicativo"><Settings2 size={19} aria-hidden="true" /><span className="nav-settings-label">Dados e aplicativo</span></NavLink></nav></div></header>
    <main id="main" className="main-content" aria-busy={navigation.state === 'loading'}><Outlet /></main>
    <footer className="site-footer"><div><span className="footer-brand">vértice.</span><span>Menos imprevistos. Mais clareza.</span></div><div><HardDrive size={14} aria-hidden="true" /><span>Dados neste aparelho</span><InstallButton /><Link to="/settings" aria-label="Abrir configurações"><ArrowUpRight size={17} /></Link></div></footer>
  </>;
}
