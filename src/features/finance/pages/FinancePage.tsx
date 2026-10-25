import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, BookOpen, Download, FileSpreadsheet, Sheet, WifiOff } from 'lucide-react';
import { useAccountScope } from '../../../app/repository-context';
import { BackLink } from '../../../shared/ui/BackLink';
import { Button } from '../../../shared/ui/Button';
import { getPwaState, subscribePwa } from '../../../pwa/registration';
import { financeFormats } from '../config';
import { financeFaq, guideSteps, quickStart, routine, sheetMap } from '../guide';
import { markFinanceVisited } from '../visit';
import { CopyTemplateLink } from '../components/CopyTemplateLink';

export default function FinancePage() {
  const scope = useAccountScope();
  const [format, setFormat] = useState<'google' | 'excel'>('google');
  const selected = financeFormats.find((option) => option.id === format)!;
  const { online } = useSyncExternalStore(subscribePwa, getPwaState);
  const guideHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    markFinanceVisited(scope);
  }, [scope]);

  function showGuide() {
    guideHeading.current?.focus({ preventScroll: true });
    guideHeading.current?.scrollIntoView({ block: 'start' });
  }

  return (
    <div className="finance-page">
      <BackLink to="/">Minhas listas</BackLink>
      <div className="finance-heading">
        <div className="page-heading">
          <p className="eyebrow">SEU KIT VÉRTICE</p>
          <h1>Vértice Financeiro</h1>
          <p>
            Suas contas, seu orçamento e seus próximos passos. Escolha uma planilha para começar.
          </p>
        </div>
        <Button variant="secondary" onClick={showGuide}>
          <BookOpen size={17} aria-hidden="true" />
          Como utilizar?
        </Button>
      </div>

      <section className="finance-delivery" aria-labelledby="finance-format-title">
        <h2 id="finance-format-title">Escolha seu formato</h2>
        <div className="finance-format-options" role="group" aria-label="Formato da planilha">
          {financeFormats.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={format === option.id}
              onClick={() => setFormat(option.id)}
            >
              {option.id === 'google' ? (
                <Sheet size={23} aria-hidden="true" />
              ) : (
                <FileSpreadsheet size={23} aria-hidden="true" />
              )}
              <span>
                <strong>{option.title}</strong>
                <small>
                  {option.id === 'google'
                    ? 'Uma cópia na sua conta'
                    : 'Arquivo .xlsx no dispositivo'}
                </small>
              </span>
            </button>
          ))}
        </div>
        <p className="finance-format-description">{selected.description}</p>
        <div className="finance-versions">
          {selected.versions.map((version, index) => (
            <article className="finance-version" key={`${format}-${version.title}`}>
              <p className="eyebrow">{index === 0 ? 'PARA SEUS REGISTROS' : 'PARA EXPLORAR'}</p>
              <h3>{version.title}</h3>
              <p>{version.description}</p>
              <a
                className={`button button-${index === 0 ? 'primary' : 'secondary'}`}
                href={version.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-describedby="finance-online-note"
              >
                {format === 'google' ? (
                  <ArrowUpRight size={17} aria-hidden="true" />
                ) : (
                  <Download size={17} aria-hidden="true" />
                )}
                {version.action}
                <span className="sr-only"> (abre em outra aba)</span>
              </a>
              {format === 'google' && <CopyTemplateLink url={version.url} title={version.title} />}
            </article>
          ))}
        </div>
        <p className="finance-hint">{selected.note}</p>
        {format === 'google' && (
          <div className="finance-mobile-help">
            <strong>No celular, abriu no app Planilhas?</strong>
            <p>
              O app do Google pode abrir o modelo sem mostrar a tela de cópia. Nele, procure no menu
              “Compartilhar e exportar” → “Fazer uma cópia” (os nomes podem variar). Trabalhe na
              cópia criada na sua conta.
            </p>
            <p>
              Outra opção: use “Copiar link” acima e cole no navegador. Se o celular continuar
              abrindo o aplicativo, faça a cópia em um computador. Depois, ela estará no seu Drive
              para usar no celular.
            </p>
          </div>
        )}
        <p
          id="finance-online-note"
          className={`finance-hint ${!online ? 'finance-offline' : ''}`}
          role="status"
        >
          {!online && <WifiOff size={16} aria-hidden="true" />}
          {online
            ? 'Criar cópias e baixar arquivos exige internet. Os links abrem em outra aba.'
            : 'Você está offline. Conecte-se para criar cópias ou baixar arquivos. O guia continua disponível.'}
        </p>
      </section>

      <aside className="finance-note">
        <strong>Uma compra no app. Uma visão do mês na planilha.</strong>
        <p>
          São ferramentas separadas: registre manualmente o total da compra na categoria Mercado.
          Para o dia a dia, abra a cópia que você já salvou, em vez de criar outra a cada visita.
        </p>
      </aside>

      <section className="finance-section" aria-labelledby="finance-guide-title">
        <p className="eyebrow">COMECE PELO ESSENCIAL</p>
        <h2 id="finance-guide-title" ref={guideHeading} tabIndex={-1}>
          Como utilizar suas planilhas
        </h2>
        <p className="finance-section-intro">
          Primeiro conheça a Demonstração. Depois, transforme o Modelo limpo no seu controle
          financeiro.
        </p>
        <ol className="finance-quick-start">
          {quickStart.map(([title, description], index) => (
            <li key={title}>
              <span className="finance-step-number" aria-hidden="true">
                0{index + 1}
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
        <div className="finance-accordion">
          {guideSteps.map((step, index) => (
            <details key={step.title}>
              <summary>
                <span className="finance-detail-number" aria-hidden="true">
                  {index + 1}
                </span>
                {step.title}
              </summary>
              <div className="finance-detail-body">
                {step.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="finance-section" aria-labelledby="finance-sheets-title">
        <h2 id="finance-sheets-title">Encontre o que precisa em cada aba</h2>
        <dl className="finance-sheet-map">
          {sheetMap.map(([title, description]) => (
            <div key={title}>
              <dt>{title}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="finance-section" aria-labelledby="finance-routine-title">
        <p className="eyebrow">UM POUCO A CADA DIA</p>
        <h2 id="finance-routine-title">Uma rotina que cabe no seu mês</h2>
        <p className="finance-section-intro">
          Uma planilha atualizada é mais útil que um planejamento detalhado que você não consegue
          manter.
        </p>
        <ul className="finance-routine">
          {routine.map(([title, description]) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="finance-section" aria-labelledby="finance-faq-title">
        <h2 id="finance-faq-title">Dúvidas do dia a dia</h2>
        <div className="finance-accordion">
          {financeFaq.map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <div className="finance-detail-body">
                <p>{answer}</p>
              </div>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
