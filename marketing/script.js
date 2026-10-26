const config = window.VERTICE_MARKETING;
for (const label of document.querySelectorAll('[data-launch-slots]')) {
  label.textContent = String(config.launchSlots);
}

// The HTML also has the checkout URL so purchase links work without JavaScript.
for (const link of document.querySelectorAll('[data-checkout-link]')) {
  link.href = config.checkoutUrl;
}

for (const link of document.querySelectorAll('[data-whatsapp-link]')) {
  const url = new URL('https://wa.me/' + config.whatsapp);
  url.searchParams.set('text', 'Olá! Tenho uma dúvida sobre o Kit Vértice.');
  link.href = url.href;
}

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
