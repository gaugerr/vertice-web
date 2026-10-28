const root = document.querySelector('#checkout');
const response = await fetch('/checkout-proposal.json', { cache: 'no-store' });
if (!response.ok) throw new Error('Não foi possível carregar a proposta.');
const proposal = await response.json();
const mobile = matchMedia('(max-width: 719px)');

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function field(label, value) {
  const node = make('div', 'field', label);
  node.append(make('div', 'field-value', value));
  return node;
}

function nativeForm() {
  const panel = make('section', 'native-form');
  panel.setAttribute('aria-label', 'Ilustração do formulário da Cakto');
  panel.append(make('h2', '', '1. Seus dados'));
  panel.append(field('Nome completo', 'Seu nome completo'));
  panel.append(field('E-mail', 'seunome@gmail.com'));
  panel.append(field('Confirme seu e-mail', 'Repita seu e-mail'));
  const grid = make('div', 'form-grid');
  grid.append(field('Celular', '(DDD) 00000-0000'), field('CPF/CNPJ', 'Seu documento'));
  panel.append(grid);
  panel.append(
    make(
      'p',
      'field-hint',
      'No checkout real, a Cakto informa as condições de contato pelo WhatsApp.',
    ),
  );
  const payment = make('section', 'form-section');
  payment.append(make('h2', '', '2. Forma de pagamento'));
  const options = make('div', 'payment-options');
  for (const [i, label] of ['PIX', 'Cartão de crédito', 'PicPay', 'Google Pay'].entries()) {
    options.append(make('div', `payment-option${i === 0 ? ' selected' : ''}`, label));
  }
  payment.append(
    options,
    make('p', 'pay-note', 'As opções disponíveis são apresentadas pela Cakto.'),
  );
  panel.append(payment);
  const summary = make('section', 'form-section');
  summary.append(make('h2', '', 'Resumo do pedido'));
  const line = make('div', 'summary-line');
  line.append(
    make('span', '', 'Kit Vértice — App + Planilha Financeira'),
    make('strong', '', 'R$ 19,90'),
  );
  const total = make('div', 'summary-line summary-total');
  total.append(make('strong', '', 'Total proposto'), make('strong', '', 'R$ 19,90'));
  summary.append(line, total);
  const button = make('button', 'pay-button', 'Gerar PIX');
  button.type = 'button';
  button.disabled = true;
  summary.append(button, make('p', 'pay-note', 'Botão demonstrativo · Não gera pagamento'));
  summary.append(make('p', 'secure', '✓ Compra processada pela Cakto'));
  panel.append(summary);
  return panel;
}

function renderComponent(component) {
  const a = component.attributes;
  if (component.type === 'header') {
    const header = make('header', 'checkout-heading');
    header.append(make('h1', '', a.titleText));
    if (a.showSubtitle) header.append(make('p', '', a.subtitleText));
    return header;
  }
  if (component.type === 'checkout') return nativeForm();
  if (component.type === 'image') {
    const img = make('img', 'builder-image');
    img.src = a.image;
    img.alt = 'Vértice';
    img.width = 2172;
    img.height = 724;
    return img;
  }
  if (component.type === 'text') {
    const p = make('p', 'builder-text', a.text);
    p.style.color = a.color;
    p.style.backgroundColor = a.backgroundColor;
    p.style.borderRadius = `${a.borderRadius || 0}px`;
    return p;
  }
  if (component.type === 'list') {
    const section = make('section', 'benefits');
    section.style.backgroundColor = a.backgroundColor;
    section.append(make('h2', '', a.title));
    const ul = make('ul');
    for (const item of a.items) ul.append(make('li', '', item.text));
    section.append(ul);
    return section;
  }
  throw new Error(`Componente não suportado na prévia: ${component.type}`);
}

function render() {
  const device = proposal.config[mobile.matches ? 'mobile' : 'desktop'];
  const fragment = document.createDocumentFragment();
  for (const row of device.rows) {
    const rowNode = make('div', 'builder-row');
    rowNode.dataset.layout = row.layout.join(',');
    for (const col of row.columns) {
      const column = make('div', 'builder-column');
      for (const component of col.components) column.append(renderComponent(component));
      rowNode.append(column);
    }
    fragment.append(rowNode);
  }
  root.replaceChildren(fragment);
  const support = make('a', 'support-link', 'Dúvidas? Fale com o produtor pelo WhatsApp');
  support.href =
    'https://wa.me/5551980614158?text=Ol%C3%A1%21%20Tenho%20uma%20d%C3%BAvida%20sobre%20o%20Kit%20V%C3%A9rtice.';
  support.target = '_blank';
  support.rel = 'noopener noreferrer';
  root.append(support);
}
render();
mobile.addEventListener('change', render);
