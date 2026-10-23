const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const items = [...document.querySelectorAll('input[name="demo-item"]')];
const totalOutput = document.querySelector('#demo-total');
const remainingOutput = document.querySelector('#demo-remaining');
const budgetFill = document.querySelector('#budget-fill');
const budgetTrack = document.querySelector('.budget-track');
const sheetPurchase = document.querySelector('#sheet-purchase');

function updateDemo() {
  const cents = items.reduce((sum, item) => sum + (item.checked ? Number(item.value) : 0), 0);
  const formatted = money.format(cents / 100);
  totalOutput.textContent = formatted;
  remainingOutput.textContent = `Ainda cabem ${money.format((7000 - cents) / 100)} no orçamento.`;
  budgetFill.style.width = `${(cents / 7000) * 100}%`;
  budgetTrack.setAttribute('aria-valuenow', String(cents));
  budgetTrack.setAttribute('aria-valuetext', `${formatted} de R$ 70,00`);
}

for (const item of items) item.addEventListener('change', updateDemo);
updateDemo();

document.querySelector('#fill-sheet-example').addEventListener('click', () => {
  sheetPurchase.textContent = totalOutput.textContent;
  document.querySelector('#manual-demo-status').textContent =
    `Exemplo preenchido com ${totalOutput.textContent}. Na sua planilha, você digita esse total.`;
});

const dialog = document.querySelector('#launch-dialog');
let returnFocus = null;
for (const button of document.querySelectorAll('.purchase-button')) {
  button.addEventListener('click', () => {
    returnFocus = button;
    dialog.showModal();
    dialog.querySelector('.close-dialog').focus();
  });
}
for (const button of dialog.querySelectorAll('.close-dialog, .close-dialog-action')) {
  button.addEventListener('click', () => dialog.close());
}
dialog.addEventListener('close', () => returnFocus?.focus({ preventScroll: true }));
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    dialog.close();
});

const mobileOffer = document.querySelector('.mobile-offer');
const offer = document.querySelector('#oferta');
let offerVisible = false;
let offerHasBeenReached = false;
const observer = new IntersectionObserver(
  ([entry]) => {
    offerVisible = entry.isIntersecting;
    if (offerVisible) offerHasBeenReached = true;
    refreshMobileOffer();
  },
  { threshold: 0.08 },
);
observer.observe(offer);

function refreshMobileOffer() {
  mobileOffer.classList.toggle(
    'visible',
    window.scrollY > 650 && !offerVisible && !offerHasBeenReached,
  );
}
window.addEventListener('scroll', refreshMobileOffer, { passive: true });
refreshMobileOffer();
