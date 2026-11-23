/* Pixel avatar and floor navigation, in the same world coordinates as the room. */
'use strict';
const MOVE_SPEED = 225; // Room units per second.
const WALK_FRAME_RATE = 8; // Animation frames per second, independent of travel.
const WALK_DIRECTIONS = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] };
const movementDirection = key => WALK_DIRECTIONS[key.length === 1 ? key.toLowerCase() : key];
const player = { x: 345, y: 467, facing: 1, back: false, walkTime: 0 };
const obstacles = [
  { left: 202, right: 487, top: 361, bottom: 430 }, // bench plus foot clearance
  { left: 607, right: 691, top: 337, bottom: 364 }, // pedestal
  { left: -13, right: 72, top: 337, bottom: 364 }, // AirPods pedestal
];
let route = [];
let exhibitWalk = null;
let animationFrame = 0;
let lastTime = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let hoveredPlaque = null;
let shineStarted = 0;
const SHINE_DURATION = 700;
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const inside = (p, r) => p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const floorTop = () => scene.floorTop ?? 351;
const playerMargin = () => activeScene === 'doe' ? Math.ceil(scene.avatarHeight * .36) : 19;
const sceneObstacles = () => scene.obstacles ?? obstacles;

function floorPoint(point) {
  const p = {
    x: clamp(point.x, scene.left + playerMargin(), scene.right - playerMargin()),
    y: clamp(point.y, floorTop(), scene.bottom - 10),
  };
  for (const r of sceneObstacles()) {
    if (!inside(p, r)) continue;
    const exits = [
      { x: r.left - 1, y: p.y }, { x: r.right + 1, y: p.y },
      { x: p.x, y: r.top - 1 }, { x: p.x, y: r.bottom + 1 },
    ].filter(q => q.x >= scene.left + playerMargin() && q.x <= scene.right - playerMargin() && q.y >= floorTop() && q.y <= scene.bottom - 10);
    exits.sort((a, b) => distance(p, a) - distance(p, b));
    if (exits.length) Object.assign(p, exits[0]);
  }
  return p;
}

// Segment/rectangle intersection: routes go around furniture, never through it.
function clearPath(a, b) {
  return !sceneObstacles().some(r => {
    let enter = 0, leave = 1;
    for (const [axis, min, max] of [['x', r.left, r.right], ['y', r.top, r.bottom]]) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < .0001) {
        if (a[axis] <= min || a[axis] >= max) return false;
      } else {
        const t1 = (min - a[axis]) / delta, t2 = (max - a[axis]) / delta;
        enter = Math.max(enter, Math.min(t1, t2));
        leave = Math.min(leave, Math.max(t1, t2));
      }
    }
    return enter < leave && leave > 0 && enter < 1;
  });
}

function findRoute(destination) {
  const nodes = [{ x: player.x, y: player.y }, floorPoint(destination)];
  for (const r of sceneObstacles()) {
    for (const x of [r.left - 2, r.right + 2]) {
      for (const y of [r.top - 2, r.bottom + 2]) {
        if (x >= scene.left + playerMargin() && x <= scene.right - playerMargin() && y >= floorTop() && y <= scene.bottom - 10) nodes.push({ x, y });
      }
    }
  }
  const costs = nodes.map(() => Infinity), previous = [], visited = new Set();
  costs[0] = 0;
  for (let step = 0; step < nodes.length; step++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (!visited.has(i) && (current < 0 || costs[i] < costs[current])) current = i;
    }
    if (current < 0 || !Number.isFinite(costs[current])) break;
    if (current === 1) {
      const path = [];
      for (let at = 1; at !== 0; at = previous[at]) path.unshift(nodes[at]);
      return path;
    }
    visited.add(current);
    for (let next = 0; next < nodes.length; next++) {
      if (visited.has(next) || !clearPath(nodes[current], nodes[next])) continue;
      const cost = costs[current] + distance(nodes[current], nodes[next]);
      if (cost < costs[next]) { costs[next] = cost; previous[next] = current; }
    }
  }
  return [];
}

function drawPlayer() {
  const moving = route.length > 0;
  const phase = moving ? Math.floor(player.walkTime * WALK_FRAME_RATE) % 4 : 0;
  const swing = moving ? [0, 1, 0, -1][phase] : 0;
  const bob = moving && !reducedMotion.matches && phase % 2 ? -1 : 0;
  const perspective = clamp(.86 + (player.y - floorTop()) / 650, .86, 1.25);
  if (activeScene === 'doe') {
    drawDoePlayer(phase, bob, perspective);
    return;
  }
  ctx.save();
  ctx.translate(Math.round(player.x), Math.round(player.y));
  ctx.fillStyle = '#3b2b1a45';
  ctx.fillRect(-13 * perspective, -2, 26 * perspective, 4);
  ctx.fillRect(-9 * perspective, 2, 18 * perspective, 2);
  ctx.scale(player.facing * perspective * 3, perspective * 3);
  drawMuseumVisitor(ctx, swing, bob, player.back);
  ctx.restore();
}

function drawMuseumVisitor(painter, swing, bob, back) {
  const pixel = (x, y, w, h, color) => {
    painter.fillStyle = color;
    painter.fillRect(x, y + bob, w, h);
  };
  const skin = '#f0c99f', shade = '#cf9b78', hair = '#69442f';
  const shirt = '#a2af83', pants = '#344958';
  // Alternating legs, boots, and arms form a four-frame eight-bit walk cycle.
  pixel(-3, -6, 3, 5 + swing, pants);
  pixel(1, -6, 3, 5 - swing, pants);
  pixel(-4, -1 + swing, 4, 1, '#2d332a');
  pixel(1, -1 - swing, 4, 1, '#2d332a');
  pixel(-5, -12 - swing, 2, 7, shirt);
  pixel(-5, -8 - swing, 2, 3, skin);
  pixel(-3, -12, 6, 6, shirt);
  pixel(3, -12 + swing, 2, 7, shirt);
  pixel(3, -8 + swing, 2, 3, shade);
  pixel(-3, -12, 1, 5, '#f6e9c9');
  pixel(-1, -14, 2, 2, skin);
  pixel(-4, -13, 3, 1, '#293e31');
  pixel(1, -13, 3, 1, '#293e31');
  pixel(-4, -21, 8, 7, skin);
  pixel(2, -19, 2, 5, shade);
  pixel(-4, -21, 8, 3, hair);
  pixel(-4, -18, 3, 1, hair);
  pixel(-4, -16, 1, 2, hair);
  pixel(3, -16, 1, 2, hair);
  if (back) {
    pixel(-4, -18, 8, 3, hair);
    pixel(-3, -15, 6, 1, hair);
  } else {
    pixel(-2, -18, 1, 1, '#294333');
    pixel(1, -18, 1, 1, '#294333');
    pixel(-1, -16, 2, 1, shade);
  }
}

function shineIsMoving(time) {
  return hoveredPlaque !== null && !reducedMotion.matches && time - shineStarted < SHINE_DURATION;
}

function drawPlaqueShine(time) {
  if (hoveredPlaque === null) return;
  const plaque = scene.plaques[hoveredPlaque];
  if (!plaque) return;
  const progress = reducedMotion.matches ? .5 : clamp((time - shineStarted) / SHINE_DURATION, 0, 1);
  if (progress >= 1) return;
  const { x, y, width, height } = plaque;
  const sweepX = Math.round(x - 28 + progress * (width + 56));
  ctx.save();
  ctx.translate(-scene.left, -scene.top);
  // Clip the reflection inside the brass bevel, leaving the wall untouched.
  ctx.beginPath(); ctx.rect(x + 2, y + 2, width - 4, height - 4); ctx.clip();
  const shine = ctx.createLinearGradient(sweepX - 10, 0, sweepX + 16, 0);
  shine.addColorStop(0, '#fff6c200');
  shine.addColorStop(.4, '#fff6c24d');
  shine.addColorStop(.5, '#fffef0b3');
  shine.addColorStop(.62, '#fff6c266');
  shine.addColorStop(1, '#fff6c200');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.moveTo(sweepX, y); ctx.lineTo(sweepX + 26, y);
  ctx.lineTo(sweepX + 14, y + height); ctx.lineTo(sweepX - 12, y + height);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function paintScene(time = performance.now()) {
  if (!scene) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(scene.background, 0, 0);
  drawPlaqueShine(time);
  const paintAvatar = () => {
    ctx.save(); ctx.translate(-scene.left, -scene.top); drawPlayer(); ctx.restore();
  };
  if (scene.bench) {
    if (player.y < 430) paintAvatar();
    ctx.drawImage(scene.bench, 0, 0);
    if (player.y >= 430) paintAvatar();
  } else paintAvatar();
}

function animate(time) {
  animationFrame = 0;
  const elapsed = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
  lastTime = time;
  if (route.length) player.walkTime += elapsed;
  let remaining = elapsed * MOVE_SPEED;
  while (route.length && remaining > 0) {
    const target = route[0], length = distance(player, target);
    const dx = target.x - player.x, dy = target.y - player.y;
    const step = Math.min(remaining, length);
    if (Math.abs(dx) > .1) player.facing = dx < 0 ? -1 : 1;
    player.back = dy < -Math.abs(dx) * .6;
    if (length > 0) { player.x += dx / length * step; player.y += dy / length * step; }
    remaining -= step;
    if (length <= step + .001) route.shift();
  }
  const arrived = !route.length ? exhibitWalk : null;
  if (arrived) player.back = true;
  paintScene(time);
  if (!route.length) { lastTime = 0; player.walkTime = 0; }
  if (arrived) exhibitWalk = null;
  if (route.length || shineIsMoving(time)) animationFrame = requestAnimationFrame(animate);
  if (arrived) arrived.onArrival();
}

function moveTo(destination, onArrival = null) {
  route = findRoute(destination);
  exhibitWalk = onArrival && route.length ? { destination, onArrival, sceneName: activeScene } : null;
  if (!animationFrame && route.length) animationFrame = requestAnimationFrame(animate);
}

function approachDoeExhibit() {
  approachMuseumFrame(5, doePreview, showDoePreview);
}

function approachMoonlitExhibit() {
  approachMuseumFrame(MOONLIT_FRAME_INDEX, moonlitPreview, showMoonlitPreview);
}

function approachMuseumFrame(index, preview, onArrival) {
  if (activeScene !== 'museum' || openingDoe || preview.open || exhibitWalk?.onArrival === onArrival) return;
  const frame = scene.frames.find(frame => frame.index === index);
  if (!frame) return;
  canvas.focus({ preventScroll: true });
  moveTo({ x: frame.x + frame.width / 2, y: floorTop() + 8 }, onArrival);
}

function pointerPosition(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) / bounds.width * canvas.width + scene.left,
    y: (event.clientY - bounds.top) / bounds.height * canvas.height + scene.top,
  };
}

function handleGalleryHover(event) {
  if (!scene || event.pointerType === 'touch') return;
  const point = pointerPosition(event);
  const index = scene.plaques.findIndex(p => point.x >= p.x && point.x <= p.x + p.width && point.y >= p.y && point.y <= p.y + p.height);
  const nextPlaque = index < 0 ? null : index;
  if (nextPlaque === hoveredPlaque) return;
  hoveredPlaque = nextPlaque;
  shineStarted = performance.now();
  if (hoveredPlaque !== null && !reducedMotion.matches && !animationFrame) animationFrame = requestAnimationFrame(animate);
  paintScene();
}
function clearGalleryHover() {
  hoveredPlaque = null;
  paintScene();
}
canvas.addEventListener('pointermove', handleGalleryHover);
canvas.addEventListener('pointerleave', clearGalleryHover);

canvas.addEventListener('pointerdown', event => {
  if (!scene || (event.button !== undefined && event.button !== 0)) return;
  const point = pointerPosition(event);
  if (activeScene === 'museum' && [...scene.frames, ...scene.plaques].some(target => target.index === 5 &&
    point.x >= target.x && point.x <= target.x + target.width && point.y >= target.y && point.y <= target.y + target.height)) {
    approachDoeExhibit();
    return;
  }
  // Wall clicks do not send the character into paintings or sculptures.
  if (point.y < floorTop() - 11) return;
  canvas.focus({ preventScroll: true });
  moveTo(point);
});
canvas.addEventListener('keydown', event => {
  if (event.key === 'Escape' && activeScene === 'doe') {
    event.preventDefault(); returnToMuseum(); return;
  }
  const direction = movementDirection(event.key);
  if (!direction || !scene) return;
  event.preventDefault();
  const from = route.length ? route[route.length - 1] : player;
  moveTo({ x: from.x + direction[0] * 28, y: from.y + direction[1] * 28 });
});
canvas.addEventListener('galleryresize', () => {
  const pendingWalk = exhibitWalk;
  cancelAnimationFrame(animationFrame);
  animationFrame = 0; lastTime = 0; route = [];
  exhibitWalk = null;
  hoveredPlaque = null;
  Object.assign(player, floorPoint(player));
  updateSceneControls();
  paintScene();
  if (pendingWalk?.sceneName === activeScene) {
    if (pendingWalk.onArrival === showDoeConceptBoard) walkToDoeConceptBoard();
    else if (pendingWalk.onArrival === showDoeHologram) walkToDoeHologram();
    else moveTo(pendingWalk.destination, pendingWalk.onArrival);
  }
});

const doePortal = document.querySelector('#doe-portal');
const doePlaquePortal = document.querySelector('#doe-plaque-portal');
const doePreview = document.querySelector('#doe-preview');
const doePosterHover = document.querySelector('#doe-poster-hover');
const doePreviewClose = document.querySelector('#doe-preview-close');
const doeEnterWorld = document.querySelector('#doe-enter-world');
const MAGAZINE_FRAME_INDEX = 3;
const magazinePortal = document.querySelector('#magazine-portal');
const magazinePlaquePortal = document.querySelector('#magazine-plaque-portal');
const magazinePreview = document.querySelector('#magazine-preview');
const magazineFrame = magazinePreview.querySelector('iframe');
let magazineOpener;
const MOONLIT_FRAME_INDEX = 4;
const moonlitPortal = document.querySelector('#moonlit-portal');
const moonlitPreview = document.querySelector('#moonlit-preview');
const moonlitWorld = document.querySelector('#moonlit-world');
let openingMoonlitWorld = false;
const doeConceptBoard = document.querySelector('#doe-concept-board');
const doeHologram = document.querySelector('#doe-hologram');
const doeHologramPreview = document.querySelector('#doe-hologram-preview');
const doeHologramPanel = document.querySelector('#doe-hologram-panel');
const doeHologramActivation = document.querySelector('#doe-hologram-activation');
const doeHologramClose = document.querySelector('#doe-hologram-close');
let hologramFrameTimer;
const doeBoardPreview = document.querySelector('#doe-board-preview');
const doeBoardClose = document.querySelector('#doe-board-close');
const doeSmoke = document.querySelector('#doe-smoke');
const doeSmokeFrames = Array.from({ length: 8 }, (_, index) => {
  const frame = document.createElement('div');
  frame.className = 'doe-smoke-cloud';
  frame.style.backgroundPosition = `${(index % 4) * 100 / 3}% ${index < 4 ? 0 : 100}%`;
  doeSmoke.append(frame);
  return frame;
});
const museumBack = document.querySelector('#back-to-museum');
const sceneStatus = document.querySelector('#scene-status');
const museumDescription = canvas.getAttribute('aria-label');
let museumPlayer = null;
let openingDoe = false;

function playDoeSmoke(covering) {
  const still = reducedMotion.matches;
  const duration = still ? 100 : covering ? 560 : 680;
  const veil = doeSmoke.animate(covering ? [
    { backgroundColor: 'transparent' },
    { backgroundColor: 'transparent', offset: .5 },
    { backgroundColor: '#501018', offset: .75 },
    { backgroundColor: '#501018' },
  ] : [
    { backgroundColor: '#501018' },
    { backgroundColor: '#501018', offset: .23 },
    { backgroundColor: 'transparent', offset: .62 },
    { backgroundColor: 'transparent' },
  ], { duration, easing: 'ease-in-out', fill: 'forwards' });
  if (still) return [veil];
  // Blend each pose over the previous one, then hold the dense frame at the cut.
  const frames = covering ? doeSmokeFrames.slice(0, 4) : doeSmokeFrames.slice(3);
  const clouds = frames.map((frame, index) => {
    const interval = 1 / frames.length;
    const last = index === frames.length - 1;
    const keys = index === 0 ? [{ opacity: 1, offset: 0 }] : [
      { opacity: 0, offset: 0 },
      { opacity: 0, offset: (index - .65) * interval },
      { opacity: 1, offset: index * interval },
    ];
    if (!last) {
      const next = (index + 1) * interval;
      keys.push({ opacity: 1, offset: next }, { opacity: 0, offset: next + .01 });
    }
    if (last && !covering) keys.push({ opacity: 1, offset: .84 });
    keys.push({ opacity: last && covering ? 1 : 0, offset: 1 });
    return frame.animate(keys, { duration, fill: 'both' });
  });
  return [veil, ...clouds];
}

function updateSceneControls() {
  museumBack.hidden = activeScene !== 'doe';
  const hologram = scene.hologram;
  doeHologram.hidden = activeScene !== 'doe' || !hologram;
  if (!doeHologram.hidden) {
    const { left, right, top, bottom } = hologram.bounds;
    Object.assign(doeHologram.style, {
      left: `${left / canvas.width * 100}%`, top: `${top / canvas.height * 100}%`,
      width: `${(right - left) / canvas.width * 100}%`, height: `${(bottom - top) / canvas.height * 100}%`,
    });
    doeHologram.style.setProperty('--hologram-screen-height', `${(hologram.screenBottom - top) / (bottom - top) * 100}%`);
  }
  const board = scene.conceptBoard;
  doeConceptBoard.hidden = activeScene !== 'doe' || !board;
  if (!doeConceptBoard.hidden) {
    const { left, right, top, bottom } = board.bounds;
    const width = right - left, height = bottom - top;
    Object.assign(doeConceptBoard.style, {
      left: `${left / canvas.width * 100}%`, top: `${top / canvas.height * 100}%`,
      width: `${width / canvas.width * 100}%`, height: `${height / canvas.height * 100}%`,
    });
    board.papers.forEach((paper, index) => {
      Object.assign(doeConceptBoard.children[index].style, {
        left: `${(paper.left - left) / width * 100}%`, top: `${(paper.top - top) / height * 100}%`,
        width: `${(paper.right - paper.left) / width * 100}%`,
        height: `${(paper.bottom - paper.top) / height * 100}%`,
      });
    });
  }
  doePortal.hidden = activeScene !== 'museum';
  doePlaquePortal.hidden = activeScene !== 'museum';
  moonlitPortal.hidden = activeScene !== 'museum';
  magazinePortal.hidden = activeScene !== 'museum';
  magazinePlaquePortal.hidden = activeScene !== 'museum';
  if (activeScene === 'museum') {
    positionGalleryPortal(doePortal, scene.frames.find(frame => frame.index === 5));
    positionGalleryPortal(doePlaquePortal, scene.plaques.find(plaque => plaque.index === 5));
    positionGalleryPortal(moonlitPortal, scene.frames.find(frame => frame.index === MOONLIT_FRAME_INDEX));
    positionGalleryPortal(magazinePortal, scene.frames.find(frame => frame.index === MAGAZINE_FRAME_INDEX));
    positionGalleryPortal(magazinePlaquePortal, scene.plaques.find(plaque => plaque.index === MAGAZINE_FRAME_INDEX));
  }
  canvas.setAttribute('aria-label', activeScene === 'doe'
    ? 'DOE design workshop. An antlered armored character explores a workshop with a concept desk, green assembly hologram, and final DOE display. Click or tap the tiled floor to walk.'
    : museumDescription);
}

function positionGalleryPortal(portal, artwork) {
  if (!artwork) return;
  Object.assign(portal.style, {
    left: `${(artwork.x - scene.left) / canvas.width * 100}%`,
    top: `${(artwork.y - scene.top) / canvas.height * 100}%`,
    width: `${artwork.width / canvas.width * 100}%`,
    height: `${artwork.height / canvas.height * 100}%`,
  });
}

async function openDoeWorld() {
  if (openingDoe || activeScene === 'doe') return;
  openingDoe = true;
  doePortal.disabled = true;
  doePlaquePortal.disabled = true;
  canvas.setAttribute('aria-busy', 'true');
  sceneStatus.hidden = true;
  const museum = canvas.parentElement;
  museum.inert = true;
  doeSmoke.hidden = false;
  const cover = playDoeSmoke(true);
  try {
    await Promise.all(cover.map(animation => animation.finished));
    await doeAssetsReady;
    museumPlayer = { ...player, walkTime: 0 };
    activeScene = 'doe';
    renderRoom();
    Object.assign(player, {
      x: scene.spawn.x, y: scene.spawn.y,
      facing: 1, back: false, walkTime: 0,
    });
    paintScene();
  } catch (error) {
    console.error(error);
    sceneStatus.textContent = 'This world couldn’t open. Please try again.';
    sceneStatus.hidden = false;
  } finally {
    const clear = playDoeSmoke(false);
    cover.forEach(animation => animation.cancel());
    await Promise.allSettled(clear.map(animation => animation.finished));
    doeSmoke.hidden = true;
    clear.forEach(animation => animation.cancel());
    museum.inert = false;
    openingDoe = false;
    doePortal.disabled = false;
    doePlaquePortal.disabled = false;
    canvas.removeAttribute('aria-busy');
    (activeScene === 'doe' ? canvas : doePortal).focus({ preventScroll: true });
  }
}

function returnToMuseum() {
  if (activeScene !== 'doe') return;
  activeScene = 'museum';
  renderRoom();
  if (museumPlayer) Object.assign(player, museumPlayer, floorPoint(museumPlayer));
  paintScene();
  doePortal.focus({ preventScroll: true });
}
function showDoePreview() {
  if (activeScene !== 'museum' || doePreview.open || openingDoe) return;
  route = [];
  exhibitWalk = null;
  lastTime = 0;
  player.walkTime = 0;
  paintScene();
  doePreview.showModal();
}

doePortal.addEventListener('click', approachDoeExhibit);
doePlaquePortal.addEventListener('click', approachDoeExhibit);
function bindArtworkTilt(surface, dialog) {
  const resetTilt = () => {
    surface.style.removeProperty('--tilt-x');
    surface.style.removeProperty('--tilt-y');
  };
  surface.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || reducedMotion.matches) return;
    // Measure the wrapper so pointer coordinates don't shift as the art tilts.
    const bounds = surface.getBoundingClientRect();
    const x = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
    const y = clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1);
    surface.style.setProperty('--tilt-x', `${y * 7}deg`);
    surface.style.setProperty('--tilt-y', `${-x * 8}deg`);
  });
  surface.addEventListener('pointerleave', resetTilt);
  surface.addEventListener('pointercancel', resetTilt);
  dialog.addEventListener('close', resetTilt);
}

bindArtworkTilt(doePosterHover, doePreview);
function showMoonlitPreview() {
  if (activeScene === 'museum' && !moonlitPreview.open && !openingDoe) moonlitPreview.showModal();
}

function showMagazinePreview() {
  if (!magazineFrame.hasAttribute('src')) magazineFrame.src = 'magazineproject/index.html';
  magazinePreview.showModal();
}

for (const portal of [magazinePortal, magazinePlaquePortal]) {
  portal.addEventListener('click', () => {
    magazineOpener = portal;
    approachMuseumFrame(MAGAZINE_FRAME_INDEX, magazinePreview, showMagazinePreview);
  });
}
magazinePreview.querySelector('.doe-preview-close').addEventListener('click', () => magazinePreview.close());
magazinePreview.addEventListener('close', () => magazineOpener.focus({ preventScroll: true }));
magazineFrame.addEventListener('load', () => {
  // Keyboard events inside the embedded page stay in its document.
  magazineFrame.contentDocument?.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !magazinePreview.open) return;
    event.preventDefault();
    magazinePreview.close();
  });
});

function maskMoonlitFire(sheet) {
  const masked = document.createElement('canvas');
  masked.width = sheet.naturalWidth;
  masked.height = sheet.naturalHeight;
  const context = masked.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(sheet, 0, 0);

  // The sheet has a pale matte. Keep the warm fire colors and feather their edges.
  let pixels;
  try {
    pixels = context.getImageData(0, 0, masked.width, masked.height);
  } catch (error) {
    if (error.name !== 'SecurityError') throw error;
    return null;
  }
  const { data } = pixels;
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] *= clamp((data[i] - data[i + 2] - 22) / 68, 0, 1);
  }
  context.putImageData(pixels, 0, 0);
  return masked;
}

function playMoonlitFire(context, sheet, start, end, duration) {
  const { width, height } = context.canvas;
  return new Promise(resolve => {
    let startedAt;
    function drawFrame(time) {
      startedAt ??= time;
      const progress = Math.min((time - startedAt) / duration, 1);
      const position = start + (end - start) * progress;
      const frame = Math.floor(position);
      const blend = position - frame;
      context.clearRect(0, 0, width, height);
      // Blend neighboring frames without making their shared opaque areas translucent.
      context.globalCompositeOperation = 'lighter';
      for (const [index, opacity] of [[frame, 1 - blend], [frame + 1, blend]]) {
        if (opacity <= 0 || index >= 8) continue;
        context.globalAlpha = opacity;
        context.drawImage(sheet, index % 4 * width, Math.floor(index / 4) * height,
          width, height, 0, 0, width, height);
      }

      // Keep black behind the flames through the cut, then reveal the castle.
      if (start > 0) {
        const backdropOpacity = clamp((end - position) / 3, 0, 1);
        context.canvas.style.setProperty('--fire-backdrop-opacity', backdropOpacity);
      }
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = 1;
      if (progress < 1) requestAnimationFrame(drawFrame);
      else resolve();
    }
    requestAnimationFrame(drawFrame);
  });
}

async function enterMoonlitWorld() {
  if (openingMoonlitWorld || !moonlitPreview.open) return;
  openingMoonlitWorld = true;
  const fire = document.createElement('canvas');
  fire.className = 'moonlit-fire-transition';
  fire.setAttribute('aria-hidden', 'true');

  try {
    if (!reducedMotion.matches) {
      moonlitPreview.inert = true;
      const sheet = new Image();
      sheet.src = 'assets/moonlit/fire-breath-frames.png';
      const loaded = await sheet.decode().then(() => true, () => false);
      if (loaded) {
        const frames = maskMoonlitFire(sheet);
        fire.width = sheet.naturalWidth / 4;
        fire.height = sheet.naturalHeight / 2;
        const context = fire.getContext('2d');
        if (frames && context) {
          moonlitWorld.append(fire);
          moonlitWorld.showModal();
          moonlitWorld.inert = true;
          moonlitPreview.close();
          await playMoonlitFire(context, frames, 0, 3, 390);
          await playMoonlitFire(context, frames, 4, 8, 480);
          return;
        }
      }
    }
    moonlitPreview.close();
    moonlitWorld.showModal();
  } finally {
    fire.remove();
    moonlitPreview.inert = false;
    moonlitWorld.inert = false;
    openingMoonlitWorld = false;
    if (moonlitWorld.open) moonlitWorld.querySelector('.moonlit-balcony').focus({ preventScroll: true });
  }
}

bindArtworkTilt(document.querySelector('#moonlit-artwork-hover'), moonlitPreview);
moonlitPortal.addEventListener('click', approachMoonlitExhibit);
document.querySelector('#moonlit-preview-close').addEventListener('click', () => moonlitPreview.close());
moonlitPreview.addEventListener('close', () => {
  if (!moonlitWorld.open) moonlitPortal.focus({ preventScroll: true });
});
document.querySelector('#moonlit-enter-world').addEventListener('click', enterMoonlitWorld);
for (const dialog of [moonlitPreview, moonlitWorld]) {
  dialog.addEventListener('cancel', event => {
    if (openingMoonlitWorld) event.preventDefault();
  });
}
document.querySelector('#moonlit-world-back').addEventListener('click', () => moonlitWorld.close());
moonlitWorld.addEventListener('close', () => moonlitPortal.focus({ preventScroll: true }));

doePreviewClose.addEventListener('click', () => doePreview.close());
doeEnterWorld.addEventListener('click', () => {
  doePreview.close();
  openDoeWorld();
});
doePlaquePortal.addEventListener('pointermove', handleGalleryHover);
doePlaquePortal.addEventListener('pointerleave', clearGalleryHover);
magazinePlaquePortal.addEventListener('pointermove', handleGalleryHover);
magazinePlaquePortal.addEventListener('pointerleave', clearGalleryHover);
museumBack.addEventListener('click', returnToMuseum);
function showDoeConceptBoard() {
  if (activeScene === 'doe' && !doeBoardPreview.open) doeBoardPreview.showModal();
}

function walkToDoeConceptBoard() {
  if (activeScene !== 'doe' || !scene.conceptBoard || openingDoe || doeBoardPreview.open ||
      exhibitWalk?.onArrival === showDoeConceptBoard) return;
  const { left, right } = scene.conceptBoard.bounds;
  canvas.focus({ preventScroll: true });
  moveTo({ x: scene.left + (left + right) / 2, y: floorTop() + 14 }, showDoeConceptBoard);
}
doeConceptBoard.addEventListener('click', walkToDoeConceptBoard);
function walkToDoeHologram() {
  if (activeScene !== 'doe' || !scene.hologram || openingDoe || doeHologramPreview.open ||
      exhibitWalk?.onArrival === showDoeHologram) return;
  const { left, right } = scene.hologram.bounds;
  canvas.focus({ preventScroll: true });
  moveTo({ x: scene.left + (left + right) / 2, y: floorTop() + 14 }, showDoeHologram);
}

function showDoeHologram() {
  if (activeScene !== 'doe' || doeHologramPreview.open) return;
  clearTimeout(hologramFrameTimer);
  doeHologramPanel.hidden = true;
  doeHologramClose.hidden = true;
  doeHologramActivation.hidden = false;
  doeHologramPreview.showModal();

  function showFrame(frame) {
    if (!doeHologramPreview.open) return;
    if (frame < 8) {
      // Select each cell directly so the browser never scrolls across the sheet.
      doeHologramActivation.style.backgroundPosition = `${(frame % 4) * 100 / 3}% ${frame < 4 ? 0 : 100}%`;
      hologramFrameTimer = setTimeout(() => showFrame(frame + 1), frame === 7 ? 130 : 95);
      return;
    }
    doeHologramActivation.hidden = true;
    doeHologramPanel.hidden = false;
    doeHologramClose.hidden = false;
    doeHologramClose.focus({ preventScroll: true });
  }
  showFrame(0);
}

doeHologram.addEventListener('click', walkToDoeHologram);
doeHologramClose.addEventListener('click', () => doeHologramPreview.close());
doeHologramPreview.addEventListener('close', () => {
  clearTimeout(hologramFrameTimer);
  doeHologram.focus({ preventScroll: true });
});
doeBoardClose.addEventListener('click', () => doeBoardPreview.close());
doeBoardPreview.addEventListener('close', () => doeConceptBoard.focus({ preventScroll: true }));

const doeSketchPreview = document.querySelector('#doe-sketch-preview');
const doeSketchImage = document.querySelector('#doe-sketch-image');
const doeSketchHover = document.querySelector('#doe-sketch-hover');
let activeSketchButton = null;
bindArtworkTilt(doeSketchHover, doeSketchPreview);
for (const sketchButton of doeBoardPreview.querySelectorAll('.doe-board-sketches button')) {
  sketchButton.addEventListener('click', () => {
    if (doeSketchPreview.open) return;
    const drawing = sketchButton.querySelector('img');
    doeSketchImage.alt = drawing.alt;
    doeSketchImage.width = Number(drawing.getAttribute('width'));
    doeSketchImage.height = Number(drawing.getAttribute('height'));
    doeSketchImage.src = drawing.src;
    activeSketchButton = sketchButton;
    doeSketchPreview.showModal();
  });
}
document.querySelector('#doe-sketch-close').addEventListener('click', () => doeSketchPreview.close());
doeSketchPreview.addEventListener('close', () => {
  activeSketchButton?.focus({ preventScroll: true });
  activeSketchButton = null;
});
updateSceneControls();
paintScene();
