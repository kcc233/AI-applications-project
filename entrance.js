'use strict';

const entrance = document.querySelector('#entrance');
const gallery = document.querySelector('.gallery');

entrance.querySelector('.enter-museum').addEventListener('click', () => {
  entrance.hidden = true;
  gallery.inert = false;
  canvas.focus({ preventScroll: true });
});
