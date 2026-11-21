function bindArtworkCarousel(dialog) {
  const carousel = dialog.querySelector('.doe-carousel');
  const stack = carousel.querySelector('.doe-carousel-cards');
  const cards = Array.from(stack.querySelectorAll('button'));
  const position = carousel.querySelector('.doe-carousel-position');
  const status = carousel.querySelector('.doe-carousel-status');
  const original = carousel.querySelector('.doe-carousel-original');
  let current = 0;
  let lastScroll = -Infinity;
  let touchStart = null;

  function select(index) {
    const count = cards.length;
    const radius = Math.floor(count / 2);
    current = (index + count) % count;
    const selected = cards[current];
    const shouldMoveFocus = stack.contains(document.activeElement);

    cards.forEach((card, cardIndex) => {
      const offset = (cardIndex - current + radius + count) % count - radius;
      card.classList.toggle('wraps', Math.abs(offset - Number(card.dataset.offset)) > radius);
      card.dataset.offset = offset;
      card.tabIndex = offset === 0 ? 0 : -1;
      card.setAttribute('aria-current', String(offset === 0));
    });

    position.textContent = `${current + 1} / ${count}`;
    status.textContent = `${selected.getAttribute('aria-label')}, ${current + 1} of ${count}`;
    original.href = selected.dataset.original || selected.querySelector('img').src;
    if (shouldMoveFocus) selected.focus({ preventScroll: true });
  }

  cards.forEach((card, index) => {
    card.addEventListener('click', () => {
      if (index === current) original.click();
      else select(index);
    });
  });

  carousel.querySelector('.doe-carousel-prev').addEventListener('click', () => select(current - 1));
  carousel.querySelector('.doe-carousel-next').addEventListener('click', () => select(current + 1));
  dialog.addEventListener('keydown', event => {
    if (!carousel.getClientRects().length) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    select(current + (event.key === 'ArrowLeft' ? -1 : 1));
  });

  carousel.addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    if (event.timeStamp - lastScroll < 320) return;
    lastScroll = event.timeStamp;
    select(current + Math.sign(delta));
  }, { passive: false });

  stack.addEventListener('touchstart', event => {
    touchStart = event.touches.length === 1 ? event.touches[0] : null;
  }, { passive: true });

  stack.addEventListener('touchend', event => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const x = touch.clientX - touchStart.clientX;
    const y = touch.clientY - touchStart.clientY;
    touchStart = null;
    if (Math.abs(x) < 30 || Math.abs(x) <= Math.abs(y)) return;
    event.preventDefault();
    select(current - Math.sign(x));
  }, { passive: false });

  stack.addEventListener('touchcancel', () => { touchStart = null; });
  dialog.addEventListener('close', () => select(0));
  select(0);
}

document.querySelectorAll('dialog[data-carousel]').forEach(bindArtworkCarousel);
