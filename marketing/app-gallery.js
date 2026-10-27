const gallery = document.querySelector('[data-app-gallery]');

if (gallery) {
  const track = gallery.querySelector('.app-gallery-track');
  const cards = [...track.querySelectorAll('.screen-card')];
  const previous = gallery.querySelector('[data-gallery-prev]');
  const next = gallery.querySelector('[data-gallery-next]');
  const range = gallery.querySelector('[data-gallery-range]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const updateControls = () => {
    const bounds = track.getBoundingClientRect();
    const visible = cards
      .map((card, index) => ({ index, bounds: card.getBoundingClientRect() }))
      .filter(
        (card) => card.bounds.left >= bounds.left - 2 && card.bounds.right <= bounds.right + 2,
      );
    previous.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2;
    if (visible.length) {
      const first = visible[0].index + 1;
      const last = visible.at(-1).index + 1;
      range.textContent = `${first === last ? first : `${first}–${last}`} de ${cards.length}`;
    }
  };

  const moveTrack = (direction) => {
    const distance = cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
    track.scrollBy({
      left: direction * distance,
      behavior: reducedMotion.matches ? 'auto' : 'smooth',
    });
  };

  previous.addEventListener('click', () => moveTrack(-1));
  next.addEventListener('click', () => moveTrack(1));
  let frame;
  const queueUpdate = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateControls);
  };
  track.addEventListener('scroll', queueUpdate, { passive: true });
  window.addEventListener('resize', queueUpdate);
  gallery.querySelector('[data-gallery-controls]').hidden = false;
  updateControls();

  const viewer = document.querySelector('[data-gallery-viewer]');
  if (typeof viewer?.showModal === 'function') {
    const links = [...gallery.querySelectorAll('[data-gallery-open]')];
    const image = viewer.querySelector('[data-viewer-image]');
    const canvas = viewer.querySelector('[data-viewer-canvas]');
    const clip = viewer.querySelector('[data-viewer-crop]');
    const title = viewer.querySelector('[data-viewer-title]');
    const position = viewer.querySelector('[data-viewer-position]');
    const viewerPrevious = viewer.querySelector('[data-viewer-prev]');
    const viewerNext = viewer.querySelector('[data-viewer-next]');
    let active = 0;
    let opener;
    let oldOverflow;

    const showImage = (index) => {
      active = Math.max(0, Math.min(links.length - 1, index));
      const link = links[active];
      const [x, y, width, height] = link.dataset.expandedCrop.split(' ').map(Number);
      const [sourceWidth, sourceHeight] = link.dataset.sourceSize.split(' ').map(Number);
      canvas.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
      canvas.setAttribute('width', width);
      canvas.setAttribute('height', height);
      canvas.setAttribute(
        'aria-label',
        link.querySelector('.screen-crop').getAttribute('aria-label'),
      );
      for (const [name, value] of Object.entries({ x, y, width, height })) {
        clip.setAttribute(name, value);
      }
      image.setAttribute('href', link.href);
      image.setAttribute('width', sourceWidth);
      image.setAttribute('height', sourceHeight);
      title.textContent = cards[active].querySelector('h3').textContent;
      position.textContent = `${active + 1} de ${links.length}`;
      viewerPrevious.disabled = active === 0;
      viewerNext.disabled = active === links.length - 1;
      viewer.scrollTop = 0;
    };

    for (const [index, link] of links.entries()) {
      link.addEventListener('click', (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        opener = link;
        showImage(index);
        viewer.showModal();
        oldOverflow = document.documentElement.style.overflow;
        document.documentElement.style.overflow = 'hidden';
      });
    }

    viewerPrevious.addEventListener('click', () => showImage(active - 1));
    viewerNext.addEventListener('click', () => showImage(active + 1));
    viewer.querySelector('[data-viewer-close]').addEventListener('click', () => viewer.close());
    viewer.addEventListener('click', (event) => {
      if (event.target === viewer) viewer.close();
    });
    viewer.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        showImage(active + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    });
    viewer.addEventListener('close', () => {
      document.documentElement.style.overflow = oldOverflow;
      opener?.focus({ preventScroll: true });
    });
  }
}
