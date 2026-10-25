import { Link } from 'react-router-dom';
import { ArrowRight, Sheet } from 'lucide-react';
import { useAccountScope } from '../../../app/repository-context';
import { hasVisitedFinance } from '../visit';

export function FinanceEntry() {
  const scope = useAccountScope();
  const compact = hasVisitedFinance(scope);
  return (
    <section
      className={`finance-entry ${compact ? 'is-compact' : ''}`}
      aria-labelledby="finance-entry-title"
    >
      <span className="finance-icon">
        <Sheet size={26} aria-hidden="true" />
      </span>
      <div className="finance-entry-copy">
        <h2 id="finance-entry-title">Vértice Financeiro</h2>
        <p>
          {compact ? 'Suas planilhas sempre à mão.' : 'Suas planilhas e instruções em um só lugar.'}
        </p>
        {!compact && (
          <p className="finance-formats-label">
            Google Planilhas <span aria-hidden="true">·</span> Excel
          </p>
        )}
      </div>
      <Link to="/financeiro" className={`button button-${compact ? 'secondary' : 'primary'}`}>
        Acessar planilhas <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
