{
  const train = drizzleWorld.querySelector('.drizzle-train');
  const layer = train.querySelector('canvas');
  const context = layer.getContext('2d');
  const openPhone = drizzleWorld.querySelector('.drizzle-open-phone');
  const phone = document.querySelector('#drizzle-phone');
  const lockScreen = phone.querySelector('.drizzle-phone-lock');
  const homeScreen = phone.querySelector('.drizzle-phone-home');
  const closePhone = phone.querySelector('.doe-preview-close');
  const researchIcon = phone.querySelector('.drizzle-research-icon');
  const research = phone.querySelector('#drizzle-research');
  const phoneApps = Array.from(phone.querySelectorAll('.drizzle-phone-app-icon'), icon => ({
    icon,
    panel: document.getElementById(icon.getAttribute('aria-controls')),
  }));
  const boardViewport = research.querySelector('.drizzle-research-viewport');
  const boardImage = boardViewport.querySelector('img');
  const zoomOut = research.querySelector('[data-zoom="out"]');
  const zoomIn = research.querySelector('[data-zoom="in"]');
  const minBoardWidth = 1500;
  const maxBoardWidth = Number(boardImage.getAttribute('width'));
  let boardDrag = null;
  const aisleTop = 711;
  const aisleBottom = 920;
  const spriteHeight = 340;
  const spawn = { x: layer.width / 2, y: 840, back: false, facing: 1 };
  const rider = { ...spawn };
  let target = null;
  let animation = 0;
  let lastTime;
  let walkTime = 0;

  const idle = new Image();
  const walk = new Image();
  const phonePose = new Image();
  for (const image of [idle, walk, phonePose]) image.addEventListener('load', paintRider);
  idle.src = 'assets/drizzle/commuter-idle.png';
  walk.src = 'assets/drizzle/commuter-walk.png';
  phonePose.src = 'assets/drizzle/commuter-phone.png';

  function paintRider() {
    if (!drizzleWorld.open) return;
    context.clearRect(0, 0, layer.width, layer.height);
    const moving = target && walk.naturalWidth && !reducedMotion.matches;
    const useIdle = !moving && idle.naturalWidth;
    const checkingPhone = phone.open && phonePose.naturalWidth;
    const sprite = checkingPhone ? phonePose : useIdle ? idle : walk;
    if (!sprite.naturalWidth) return;

    const phase = Math.floor(walkTime * WALK_FRAME_RATE) % 4;
    let frame = useIdle
      ? [rider.back ? 1055 : 315, 32, 405, 832]
      : [Math.round((phase + .5) * walk.naturalWidth / 4) - 105, rider.back ? 457 : 13, 210, 418];
    if (checkingPhone) frame = [147, 48, 587, 1640];
    const [sx, sy, sw, sh] = frame;
    const width = Math.round(spriteHeight * sw / sh);
    const shadowHalfWidth = Math.round(width * .29);
    context.imageSmoothingEnabled = false;
    context.save();
    context.translate(Math.round(rider.x), Math.round(rider.y));
    context.fillStyle = '#232e4a66';
    context.fillRect(-shadowHalfWidth, -4, shadowHalfWidth * 2, 7);
    context.scale(checkingPhone ? 1 : rider.facing, 1);
    context.drawImage(sprite, sx, sy, sw, sh, -Math.round(width / 2), -spriteHeight, width, spriteHeight);
    context.restore();
  }

  function aislePoint(point) {
    const scene = train.getBoundingClientRect();
    const view = drizzleWorld.getBoundingClientRect();
    const scale = layer.width / scene.width;
    const margin = Math.min(spriteHeight * .24, view.width * scale / 4);
    return {
      x: clamp(point.x, Math.max(0, (view.left - scene.left) * scale) + margin,
        Math.min(layer.width, (view.right - scene.left) * scale) - margin),
      y: clamp(point.y, aisleTop, aisleBottom),
    };
  }

  function step(time) {
    const elapsed = Math.min((time - (lastTime ?? time)) / 1000, .05);
    lastTime = time;
    const dx = target.x - rider.x;
    const dy = target.y - rider.y;
    const remaining = Math.hypot(dx, dy);
    if (remaining > .1) {
      if (Math.abs(dx) > .1) rider.facing = dx < 0 ? -1 : 1;
      rider.back = dy < -Math.abs(dx) * .6;
    }
    const travel = elapsed * 300;
    if (remaining <= travel || remaining <= .1) {
      Object.assign(rider, target);
      target = null;
      animation = 0;
      lastTime = undefined;
      walkTime = 0;
    } else {
      rider.x += dx / remaining * travel;
      rider.y += dy / remaining * travel;
      walkTime += elapsed;
      animation = requestAnimationFrame(step);
    }
    paintRider();
  }

  function walkTo(point) {
    target = aislePoint(point);
    if (!animation) animation = requestAnimationFrame(step);
  }

  function stopWalking() {
    cancelAnimationFrame(animation);
    animation = 0;
    target = null;
    lastTime = undefined;
    walkTime = 0;
  }

  function showPhoneApp(app) {
    const atHome = phone.classList.contains('is-unlocked') && !app;
    homeScreen.setAttribute('aria-hidden', String(!atHome));
    for (const { icon, panel } of phoneApps) {
      icon.hidden = !atHome;
      panel.hidden = app !== panel;
    }
  }

  function sizeResearchBoard(width) {
    boardImage.style.setProperty('--research-board-width', `${width}px`);
    zoomOut.disabled = width <= minBoardWidth;
    zoomIn.disabled = width >= maxBoardWidth;
  }

  function zoomResearchBoard(factor) {
    const currentWidth = boardImage.offsetWidth;
    const nextWidth = clamp(Math.round(currentWidth * factor), minBoardWidth, maxBoardWidth);
    const halfWidth = boardViewport.clientWidth / 2;
    const halfHeight = boardViewport.clientHeight / 2;
    const scale = nextWidth / currentWidth;
    const left = (boardViewport.scrollLeft + halfWidth) * scale - halfWidth;
    const top = (boardViewport.scrollTop + halfHeight) * scale - halfHeight;
    sizeResearchBoard(nextWidth);
    boardViewport.scrollTo(left, top);
  }

  train.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const bounds = train.getBoundingClientRect();
    const y = (event.clientY - bounds.top) * layer.height / bounds.height;
    if (y < aisleTop) return;
    train.focus({ preventScroll: true });
    walkTo({ x: (event.clientX - bounds.left) * layer.width / bounds.width, y });
  });

  drizzleWorld.addEventListener('keydown', event => {
    const direction = movementDirection(event.key);
    if (!direction) return;
    event.preventDefault();
    const from = target ?? rider;
    walkTo({ x: from.x + direction[0] * 36, y: from.y + direction[1] * 36 });
  });

  new ResizeObserver(() => {
    if (!drizzleWorld.open) return;
    Object.assign(rider, aislePoint(rider));
    if (target) target = aislePoint(target);
    paintRider();
  }).observe(drizzleWorld);

  const enterWorld = document.querySelector('#drizzle-enter-world');
  const transitionFrameDuration = 1000 / 24;
  const fullyCoveredFrame = 7;
  let transitionFrames;
  let enteringWorld = false;

  function loadTransitionFrames() {
    transitionFrames ??= Promise.all(Array.from({ length: 20 }, (_, index) => {
      const image = new Image();
      const number = String(index + 1).padStart(2, '0');
      image.src = `assets/drizzle/transition/frame-${number}.png`;
      return image.decode().then(() => image);
    })).catch(() => null);
    return transitionFrames;
  }

  function showTrain() {
    Object.assign(rider, spawn);
    drizzleWorld.showModal();
    drizzlePreview.close();
    paintRider();
  }

  drizzlePreview.addEventListener('focusin', () => {
    if (!reducedMotion.matches) loadTransitionFrames();
  });

  for (const dialog of [drizzlePreview, drizzleWorld]) {
    dialog.addEventListener('cancel', event => {
      if (enteringWorld) event.preventDefault();
    });
  }

  enterWorld.addEventListener('click', async () => {
    if (enteringWorld || drizzleWorld.open || !drizzlePreview.open) return;
    enteringWorld = true;
    const wipe = document.createElement('canvas');

    try {
      const frames = reducedMotion.matches ? null : await loadTransitionFrames();
      if (!drizzlePreview.open) return;
      const context = frames && wipe.getContext('2d');
      if (!context) {
        showTrain();
        return;
      }

      wipe.className = 'drizzle-train-transition';
      wipe.setAttribute('aria-hidden', 'true');
      wipe.width = frames[0].naturalWidth;
      wipe.height = frames[0].naturalHeight;
      drizzlePreview.append(wipe);
      drizzlePreview.inert = true;

      await new Promise(resolve => {
        let index = 0;
        let nextFrameAt;

        function drawFrame(now) {
          nextFrameAt ??= now;
          if (now >= nextFrameAt) {
            if (index === frames.length) {
              resolve();
              return;
            }

            context.clearRect(0, 0, wipe.width, wipe.height);
            context.drawImage(frames[index], 0, 0);

            // Swap scenes under the fully opaque train so its tail reveals the interior.
            if (index === fullyCoveredFrame) {
              drizzleWorld.append(wipe);
              showTrain();
              drizzleWorld.inert = true;
            }

            index += 1;
            nextFrameAt = Math.max(nextFrameAt + transitionFrameDuration, now);
          }
          requestAnimationFrame(drawFrame);
        }

        requestAnimationFrame(drawFrame);
      });
    } finally {
      wipe.remove();
      drizzlePreview.inert = false;
      drizzleWorld.inert = false;
      enteringWorld = false;
      if (drizzleWorld.open) train.focus({ preventScroll: true });
    }
  });
  drizzleWorld.querySelector('.back-button').addEventListener('click', () => drizzleWorld.close());
  openPhone.addEventListener('click', () => {
    stopWalking();
    phone.classList.remove('is-unlocked');
    lockScreen.inert = false;
    showPhoneApp(null);
    phone.showModal();
    paintRider();
  });
  lockScreen.addEventListener('click', () => {
    phone.classList.add('is-unlocked');
    showPhoneApp(null);
    researchIcon.focus({ preventScroll: true });
    lockScreen.inert = true;
  });
  researchIcon.addEventListener('click', () => {
    showPhoneApp(research);
    sizeResearchBoard(1900);
    boardViewport.scrollTo(boardImage.offsetWidth * .475, 0);
    boardViewport.focus({ preventScroll: true });
  });
  research.querySelector('.drizzle-research-home').addEventListener('click', () => {
    showPhoneApp(null);
    researchIcon.focus({ preventScroll: true });
  });
  for (const { icon, panel } of phoneApps) {
    if (!panel.classList.contains('drizzle-phone-preview')) continue;
    const tabs = panel.querySelectorAll('.drizzle-phone-preview-nav button');
    const views = panel.querySelectorAll('.drizzle-phone-preview-views img');
    function showView(tab) {
      const viewId = tab.getAttribute('aria-controls');
      for (const view of views) view.hidden = view.id !== viewId;
      for (const button of tabs) {
        if (button === tab) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
      }
    }
    icon.addEventListener('click', () => {
      showView(tabs[0]);
      showPhoneApp(panel);
      tabs[0].focus({ preventScroll: true });
    });
    for (const tab of tabs) tab.addEventListener('click', () => showView(tab));
    panel.querySelector('.drizzle-phone-preview-home').addEventListener('click', () => {
      showPhoneApp(null);
      icon.focus({ preventScroll: true });
    });
  }
  zoomOut.addEventListener('click', () => zoomResearchBoard(1 / 1.35));
  zoomIn.addEventListener('click', () => zoomResearchBoard(1.35));
  boardViewport.addEventListener('pointerdown', event => {
    if (event.button !== 0 || boardDrag) return;
    boardDrag = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: boardViewport.scrollLeft,
      top: boardViewport.scrollTop,
    };
    boardViewport.setPointerCapture(event.pointerId);
  });
  boardViewport.addEventListener('pointermove', event => {
    if (boardDrag?.pointerId !== event.pointerId) return;
    boardViewport.scrollTo(
      boardDrag.left + boardDrag.x - event.clientX,
      boardDrag.top + boardDrag.y - event.clientY,
    );
  });
  boardViewport.addEventListener('lostpointercapture', () => { boardDrag = null; });
  closePhone.addEventListener('click', () => phone.close());
  phone.addEventListener('close', paintRider);
  drizzleWorld.addEventListener('close', () => {
    if (phone.open) phone.close();
    stopWalking();
    drizzleOpener?.focus({ preventScroll: true });
  });
}
