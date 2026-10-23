const config = window.VERTICE_MARKETING;
for (const label of document.querySelectorAll('[data-launch-slots]')) {
  label.textContent = String(config.launchSlots);
}

for (const link of document.querySelectorAll('[data-whatsapp-link]')) {
  const url = new URL('https://wa.me/' + config.whatsapp);
  url.searchParams.set('text', 'Olá! Quero entrar na lista de espera do Kit Vértice.');
  link.href = url.href;
}

const form = document.querySelector('#waitlist-form');
const nameInput = document.querySelector('#waitlist-name');
const contactInput = document.querySelector('#waitlist-contact');
const submitButton = document.querySelector('#waitlist-submit');
const errorOutput = document.querySelector('#waitlist-error');
const confirmation = document.querySelector('#waitlist-confirmation');
const readyLink = document.querySelector('#whatsapp-ready-link');

function updateContactMethod() {
  const isEmail = form.elements.contactType.value === 'email';
  contactInput.type = isEmail ? 'email' : 'tel';
  contactInput.inputMode = isEmail ? 'email' : 'tel';
  contactInput.autocomplete = isEmail ? 'email' : 'tel';
  contactInput.maxLength = isEmail ? 120 : 24;
  contactInput.placeholder = isEmail ? 'voce@exemplo.com' : '(51) 99999-9999';
  contactInput.setCustomValidity('');
  document.querySelector('#waitlist-contact-label').textContent = isEmail
    ? 'Seu e-mail'
    : 'Seu WhatsApp com DDD';
  document.querySelector('#contact-hint').textContent = isEmail
    ? 'Pode ser o seu contato habitual. O e-mail Google para liberar o app será confirmado na compra.'
    : 'Informe seu número com DDD. A mensagem será enviada ao WhatsApp do Vértice.';
}
for (const radio of form.querySelectorAll('input[name="contactType"]')) {
  radio.addEventListener('change', updateContactMethod);
}
for (const input of [nameInput, contactInput]) {
  input.addEventListener('input', () => {
    input.setCustomValidity('');
    errorOutput.textContent = '';
  });
}
submitButton.disabled = false;
updateContactMethod();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  errorOutput.textContent = '';
  const name = nameInput.value.trim().replace(/\s+/g, ' ');
  const contactType = form.elements.contactType.value;
  const contact = contactInput.value.trim();
  nameInput.setCustomValidity(
    name.length >= 2 ? '' : 'Informe seu nome com pelo menos dois caracteres.',
  );
  const digits = contact.replace(/\D/g, '');
  const phoneIsValid = /^\d{10,11}$/.test(digits) || /^55\d{10,11}$/.test(digits);
  contactInput.setCustomValidity(
    contactType === 'whatsapp' && !phoneIsValid
      ? 'Informe um WhatsApp válido com DDD, por exemplo (51) 99999-9999.'
      : '',
  );
  if (!form.reportValidity()) return;

  const opening = config.launchListOpen
    ? 'Olá! Quero entrar na lista de espera do Kit Vértice e confirmar a condição de lançamento de R$ 19,90, dentro do lote de ' +
      config.launchSlots +
      ' compras.'
    : 'Olá! Quero saber sobre a próxima disponibilidade do Kit Vértice.';
  const message = [
    opening,
    '',
    'Nome: ' + name,
    (contactType === 'email' ? 'E-mail: ' : 'WhatsApp: ') + contact,
    '',
    'Autorizo contato sobre a lista e o lançamento. Entendo que a reserva depende da confirmação do atendimento e que este cadastro não é uma compra.',
  ].join('\n');
  const url = new URL('https://wa.me/' + config.whatsapp);
  url.searchParams.set('text', message);
  readyLink.href = url.href;
  confirmation.hidden = false;
  form.hidden = true;
  confirmation.focus({ preventScroll: true });
  window.open(url.href, '_blank', 'noopener,noreferrer');
});

document.querySelector('#edit-waitlist').addEventListener('click', () => {
  confirmation.hidden = true;
  form.hidden = false;
  readyLink.removeAttribute('href');
  nameInput.focus({ preventScroll: true });
});

// Transparência ao encerrar o lote: a capacidade é total, não um contador de sobras.
if (!config.launchListOpen) {
  document.querySelector('.waitlist-panel-intro').textContent =
    'Converse sobre a próxima disponibilidade do kit, sem reserva de preço neste momento.';
  document.querySelector('#confirmation-message').textContent =
    'Envie a mensagem no WhatsApp para conversar sobre a próxima disponibilidade. Este contato não reserva a condição de lançamento.';
  document.querySelector('.waitlist-promise').textContent =
    'O lote de lançamento está encerrado. Fale com a gente para conhecer a próxima disponibilidade.';
  document.querySelector('.waitlist-conditions').textContent =
    'Não há reserva de R$ 19,90 disponível neste momento. Você pode enviar uma mensagem para saber dos próximos passos.';
  document.querySelector('.sales-status').textContent = 'Lote de lançamento encerrado';
  document.querySelector('.launch-capacity').textContent = 'Lote de lançamento encerrado';
  document.querySelector('.reference-price').hidden = true;
  document.querySelector('.price').hidden = true;
  document.querySelector('.price-description').hidden = true;
  document.querySelector('.price-reference-note').hidden = true;
  document.querySelector('.hero-price').textContent =
    'Converse sobre a próxima disponibilidade do kit.';
  document.querySelector('.mobile-offer > div > span').textContent = 'Próxima disponibilidade';
  submitButton.firstChild.textContent = 'Conversar pelo WhatsApp ';
}

const mobileOffer = document.querySelector('.mobile-offer');
const offer = document.querySelector('#lista-de-espera');
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
