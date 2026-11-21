'use strict';

const airpodExhibit = document.querySelector('#airpod-exhibit');
const airpodBook = document.querySelector('#airpod-book');
const bookCover = airpodBook.querySelector('.book-cover');
const bookClose = airpodBook.querySelector('.book-close');
const bookReader = airpodBook.querySelector('.book-reader');
const bookPage = airpodBook.querySelector('.book-page');
const bookPrevious = airpodBook.querySelector('.book-previous');
const bookNext = airpodBook.querySelector('.book-next');
const bookStatus = airpodBook.querySelector('.book-status');
const bookFullPage = airpodBook.querySelector('.book-full-page');
const bookLeaf = airpodBook.querySelector('.book-leaf');
const bookSparkles = airpodBook.querySelector('.book-sparkles');
const leafFront = bookLeaf.querySelector('.book-leaf-front img');
const leafBack = bookLeaf.querySelector('.book-leaf-back img');
const bookPages = [
  ['title', 'Project 02: Fix it AirPod case, by Reece Catalogo, with Scooby-Doo and AirPods'],
  ['index', 'Index'],
  ['persona', 'Empathy: Jordan Blake persona'],
  ['day-in-the-life', 'Empathy: A day in the life of Jordan'],
  ['empathy-map', 'Empathy map'],
  ['problem-definition', 'Problem definition'],
  ['sketches', 'Ideate: Sketches — six ideas'],
  ['prototype', 'Prototype: Dog command speaker'],
  ['summary', 'Summary'],
];
const pagePath = index => `assets/airpod-book/${bookPages[index][0]}.png`;
let bookPageIndex = 0;
let bookAnimation = null;

for (let index = 0; index < 14; index++) {
  const sparkle = document.createElement('span');
  const angle = index * 2 * Math.PI / 14;
  sparkle.style.setProperty('--spark-x', `${Math.round(Math.cos(angle) * (index % 2 ? 34 : 43))}vmin`);
  sparkle.style.setProperty('--spark-y', `${Math.round(Math.sin(angle) * (index % 2 ? 27 : 38))}vmin`);
  sparkle.style.setProperty('--spark-delay', `${(index % 4) * 45}ms`);
  bookSparkles.append(sparkle);
}

function layoutAirpodExhibit() {
  airpodExhibit.hidden = activeScene !== 'museum';
  if (airpodExhibit.hidden) return;
  Object.assign(airpodExhibit.style, {
    left: `${(-scene.left) / canvas.width * 100}%`,
    top: `${(194 - scene.top) / canvas.height * 100}%`,
    width: `${60 / canvas.width * 100}%`,
    height: `${96 / canvas.height * 100}%`,
  });
}

function showBookPage(index) {
  bookPageIndex = index;
  const [, title] = bookPages[index];
  bookPage.src = pagePath(index);
  bookPage.alt = title;
  bookStatus.textContent = `${index + 1} / ${bookPages.length} · ${title}`;
  bookFullPage.href = pagePath(index);
  bookPrevious.disabled = index === 0;
  bookNext.disabled = index === bookPages.length - 1;
  if (index > 0) new Image().src = pagePath(index - 1);
  if (index + 1 < bookPages.length) new Image().src = pagePath(index + 1);
}

function revealAirpodBook() {
  if (activeScene !== 'museum' || airpodBook.open) return;
  bookCover.hidden = false;
  bookReader.hidden = true;
  showBookPage(0);
  airpodBook.showModal();
  bookCover.focus();
}

async function playBookAnimation(element, keyframes, duration) {
  if (reducedMotion.matches) return true;
  const animation = element.animate(keyframes, { duration, easing: 'ease-in-out', fill: 'both' });
  bookAnimation = animation;
  try {
    await animation.finished;
    return airpodBook.open;
  } catch {
    return false;
  } finally {
    if (bookAnimation === animation) bookAnimation = null;
    animation.cancel();
  }
}

async function openBookCover() {
  if (bookAnimation || bookCover.hidden) return;
  const opened = await playBookAnimation(bookCover, [
    { transform: 'perspective(850px) rotateY(0deg)' },
    { transform: 'perspective(850px) rotateY(-100deg)', opacity: 0 },
  ], 420);
  if (!opened) return;
  bookCover.hidden = true;
  bookReader.hidden = false;
  bookNext.focus({ preventScroll: true });
}

async function turnBookPage(direction) {
  const next = bookPageIndex + direction;
  if (bookAnimation || bookReader.hidden || next < 0 || next >= bookPages.length) return;
  bookLeaf.classList.toggle('turn-backwards', direction < 0);
  leafFront.src = pagePath(bookPageIndex);
  leafBack.src = pagePath(next);
  bookLeaf.hidden = reducedMotion.matches;
  showBookPage(next);
  const turned = await playBookAnimation(bookLeaf, [
    { transform: 'rotateY(0deg)' },
    { transform: `rotateY(${direction * -180}deg)` },
  ], 470);
  if (!turned) return;
  bookLeaf.hidden = true;
  const edge = direction > 0 ? bookNext : bookPrevious;
  if (edge.disabled) (direction > 0 ? bookPrevious : bookNext).focus({ preventScroll: true });
}

airpodExhibit.addEventListener('click', () => {
  if (activeScene !== 'museum' || exhibitWalk?.onArrival === revealAirpodBook) return;
  moveTo({ x: 29, y: 370 }, revealAirpodBook);
});
airpodExhibit.addEventListener('pointermove', handleGalleryHover);
airpodExhibit.addEventListener('pointerleave', clearGalleryHover);
canvas.addEventListener('galleryresize', layoutAirpodExhibit);
bookCover.addEventListener('click', openBookCover);
bookPrevious.addEventListener('click', () => turnBookPage(-1));
bookNext.addEventListener('click', () => turnBookPage(1));
bookClose.addEventListener('click', () => airpodBook.close());
airpodBook.addEventListener('keydown', event => {
  if (bookReader.hidden || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  turnBookPage(event.key === 'ArrowRight' ? 1 : -1);
});
airpodBook.addEventListener('close', () => {
  bookAnimation?.cancel();
  bookLeaf.hidden = true;
  airpodExhibit.focus({ preventScroll: true });
});
layoutAirpodExhibit();
