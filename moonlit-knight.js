{
  const world = document.querySelector('#moonlit-world');
  const balcony = world.querySelector('.moonlit-balcony');
  const easel = balcony.querySelector('.moonlit-easel');
  const scraps = balcony.querySelector('.moonlit-scraps');
  const parchmentPhotos = document.querySelector('#moonlit-photo-preview');
  const referenceAssets = document.querySelector('#moonlit-assets-preview');
  const balconyArt = balcony.querySelector('img');
  const extension = world.querySelector('#moonlit-floor');
  const layer = world.querySelector('#moonlit-knight');
  const painter = layer.getContext('2d');
  const floor = { left: 221, right: 1451, top: 868, bottom: layer.height - 22 };
  const moveSpeed = 300; // Castle scene units per second.
  const spriteHeight = 180;
  const spawnY = 1055;
  const edgeMargin = 48;
  const propClearance = 32;
  const props = [
    { element: balcony.querySelector('.moonlit-sketchbook'), base: [.31, .65, .897], approach: .48 },
    { element: easel, base: [.25, .80, 1], approach: .42 },
  ];
  const knight = { x: 836, y: spawnY, facing: 1, back: false, walkTime: 0 };
  let limits = floor;
  let obstacles = [];
  let destination = null;
  let exhibit = null;
  let animation = 0;
  let lastTime = 0;
  let needsSpawn = true;

  const frontIdle = new Image();
  const rearIdle = new Image();
  const walk = new Image();
  frontIdle.addEventListener('load', paintKnight);
  rearIdle.addEventListener('load', paintKnight);
  walk.addEventListener('load', paintKnight);
  frontIdle.src = 'assets/moonlit/knight-idle.png';
  rearIdle.src = 'assets/moonlit/knight-idle-rear.png';
  walk.src = 'assets/moonlit/knight-walk.png';

  function paintFloorExtension() {
    const ground = extension.getContext('2d');
    const { width, height } = extension;
    const originalHeight = balconyArt.naturalHeight;
    const horizon = 500;
    ground.imageSmoothingEnabled = false;
    let rowStart = 0;
    // Reuse the foreground stone texture and widen its seams toward the viewer.
    for (const [index, rowDepth] of [65, 83, 108].entries()) {
      for (let row = 0; row < rowDepth; row += 2) {
        const phase = row / rowDepth;
        const sourceY = Math.round(originalHeight - 1 - 42 * (index % 2 ? 1 - phase : phase));
        const y = rowStart + row;
        const sourceWidth = width * (sourceY - horizon) / (originalHeight + y - horizon);
        ground.drawImage(balconyArt, (width - sourceWidth) / 2, sourceY, sourceWidth, 1,
          0, y, width, Math.min(2, rowDepth - row));
      }
      rowStart += rowDepth;
    }
    const shade = ground.createLinearGradient(0, 0, 0, height);
    shade.addColorStop(0, '#040e2800');
    shade.addColorStop(1, '#040e2860');
    ground.fillStyle = shade;
    ground.fillRect(0, 0, width, height);
    paintBalconyEdges();
  }

  function paintBalconyEdges() {
    // Reflect only the outer stone, beyond the torches, at its original scale.
    const stripWidth = 48;
    const tile = document.createElement('canvas');
    tile.width = stripWidth * 2;
    tile.height = layer.height;
    const edge = tile.getContext('2d');
    for (const side of ['left', 'right']) {
      const sourceX = side === 'left' ? 0 : layer.width - stripWidth;
      const originalX = side === 'left' ? 0 : stripWidth;
      for (const [art, height, y] of [[balconyArt, balconyArt.naturalHeight, 0], [extension, extension.height, balconyArt.naturalHeight]]) {
        edge.drawImage(art, sourceX, 0, stripWidth, height, originalX, y, stripWidth, height);
        edge.save();
        edge.translate(stripWidth * 2, 0);
        edge.scale(-1, 1);
        edge.drawImage(art, sourceX, 0, stripWidth, height, originalX, y, stripWidth, height);
        edge.restore();
      }
      balcony.style.setProperty(`--balcony-${side}-edge`, `url("${tile.toDataURL()}")`);
    }
  }

  if (balconyArt.naturalWidth) paintFloorExtension();
  else balconyArt.addEventListener('load', paintFloorExtension, { once: true });

  function paintKnight() {
    if (!world.open) return;
    painter.clearRect(0, 0, layer.width, layer.height);
    painter.imageSmoothingEnabled = false;
    const phase = destination ? Math.floor(knight.walkTime * WALK_FRAME_RATE) % 4 : 0;
    const idle = knight.back ? rearIdle : frontIdle;
    const useIdle = !destination && idle.naturalWidth;
    const sprite = useIdle ? idle : walk;
    if (!sprite.naturalWidth) return;

    // Crop around the armor and keep the boots anchored to the floor.
    const cellWidth = walk.naturalWidth / 4;
    const [x, y, width, height] = useIdle
      ? [205, 110, 614, knight.back ? 1352 : 1349]
      : [Math.round((phase + .5) * cellWidth) - 98, knight.back ? 456 : 12, 196, 412];
    const drawWidth = Math.round(spriteHeight * width / height);
    const bob = destination && phase % 2 && !reducedMotion.matches ? -1 : 0;
    painter.save();
    painter.translate(Math.round(knight.x), Math.round(knight.y));
    painter.fillStyle = '#050c228c';
    painter.fillRect(-21, -2, 42, 5);
    painter.scale(knight.facing, 1);
    painter.drawImage(sprite, x, y, width, height, -Math.round(drawWidth / 2), -spriteHeight + bob, drawWidth, spriteHeight);
    painter.restore();
  }

  function updateVisibleFloor() {
    if (!world.open) return;
    const sceneRect = balcony.getBoundingClientRect();
    const view = world.getBoundingClientRect();
    if (!sceneRect.width || !view.width) return;
    const scale = layer.width / sceneRect.width;
    limits = {
      ...floor,
      left: Math.max(floor.left, (view.left - sceneRect.left) * scale + edgeMargin),
      right: Math.min(floor.right, (view.right - sceneRect.left) * scale - edgeMargin),
    };
    obstacles = props.map(({ element, base: [left, right, bottom], approach }) => {
      const rect = element.getBoundingClientRect();
      return {
        element,
        left: (rect.left + rect.width * left - sceneRect.left) * scale - propClearance,
        right: (rect.left + rect.width * right - sceneRect.left) * scale + propClearance,
        top: floor.top - 1,
        bottom: (rect.top + rect.height * bottom - sceneRect.top) * scale + 12,
        approachX: (rect.left + rect.width * approach - sceneRect.left) * scale,
      };
    });
    knight.x = needsSpawn ? (limits.left + limits.right) / 2 : clamp(knight.x, limits.left, limits.right);
    needsSpawn = false;
    for (const obstacle of obstacles) {
      if (knight.x > obstacle.left && knight.x < obstacle.right && knight.y < obstacle.bottom) {
        knight.y = obstacle.bottom;
      }
    }
    if (exhibit) continueExhibitApproach();
    else if (destination) walkTo(destination.x, destination.y);
    paintKnight();
  }

  function animateKnight(time) {
    animation = 0;
    const elapsed = lastTime ? Math.min((time - lastTime) / 1000, .05) : 0;
    lastTime = time;
    const dx = destination.x - knight.x;
    const dy = destination.y - knight.y;
    const remaining = Math.hypot(dx, dy);
    const step = elapsed * moveSpeed;
    if (Math.abs(dx) > .1) knight.facing = dx < 0 ? -1 : 1;
    if (remaining > 0) knight.back = dy < -Math.abs(dx) * .6;
    if (remaining <= step) {
      Object.assign(knight, destination, { walkTime: 0 });
      destination = null;
      lastTime = 0;
    } else {
      knight.x += dx / remaining * step;
      knight.y += dy / remaining * step;
      knight.walkTime += elapsed;
      animation = requestAnimationFrame(animateKnight);
    }
    paintKnight();
    if (!destination && exhibit) continueExhibitApproach();
  }

  function obstacleEntry(target, obstacle) {
    let entry = 0;
    let exit = 1;
    for (const [axis, low, high] of [['x', obstacle.left, obstacle.right], ['y', obstacle.top, obstacle.bottom]]) {
      const start = knight[axis];
      const delta = target[axis] - start;
      if (delta === 0) {
        if (start <= low || start >= high) return 1;
        continue;
      }
      const first = (low - start) / delta;
      const second = (high - start) / delta;
      entry = Math.max(entry, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
    }
    return entry < exit ? entry : 1;
  }

  function walkTo(x, y) {
    const target = { x: clamp(x, limits.left, limits.right), y: clamp(y, floor.top, floor.bottom) };
    const entry = Math.min(1, ...obstacles.map(obstacle => obstacleEntry(target, obstacle)));
    if (entry < 1) {
      // Leave a tiny gap so the next move can slide along the edge.
      const distance = Math.hypot(target.x - knight.x, target.y - knight.y);
      const fraction = Math.max(0, entry - .05 / distance);
      target.x = knight.x + (target.x - knight.x) * fraction;
      target.y = knight.y + (target.y - knight.y) * fraction;
    }
    if (target.x === knight.x && target.y === knight.y && !destination) return;
    destination = target;
    if (!animation) animation = requestAnimationFrame(animateKnight);
  }

  function continueExhibitApproach() {
    const { element, dialog } = exhibit;
    const stand = obstacles.find(obstacle => obstacle.element === element);
    let x, y;
    if (stand) {
      x = stand.approachX;
      y = stand.bottom;
    } else {
      const papers = element.getBoundingClientRect();
      const scene = balcony.getBoundingClientRect();
      const scale = layer.width / scene.width;
      x = (papers.left + papers.width / 2 - scene.left) * scale;
      y = (papers.bottom - scene.top) * scale + 12;
    }
    x = clamp(x, limits.left, limits.right);
    y = clamp(y, floor.top, floor.bottom);
    if (knight.y < y) {
      walkTo(knight.x, y);
    } else if (knight.x !== x || knight.y !== y) {
      walkTo(x, y);
    } else {
      stopKnight();
      knight.back = true;
      paintKnight();
      if (world.open && !dialog.open) dialog.showModal();
    }
  }

  scraps.addEventListener('pointerdown', event => event.stopPropagation());
  for (const [element, dialog] of [[easel, parchmentPhotos], [scraps, referenceAssets]]) {
    element.addEventListener('click', () => {
      if (!world.open || dialog.open) return;
      if (!obstacles.length) updateVisibleFloor();
      exhibit = { element, dialog };
      continueExhibitApproach();
    });
    dialog.querySelector('.doe-preview-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => element.focus({ preventScroll: true }));
  }

  balcony.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const clickedProp = event.target.closest('.moonlit-prop');
    if (clickedProp === easel) return;
    const prop = obstacles.find(obstacle => obstacle.element === clickedProp);
    if (prop) {
      exhibit = null;
      balcony.focus({ preventScroll: true });
      walkTo(prop.approachX, prop.bottom);
      return;
    }
    const rect = balcony.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * layer.width;
    const y = (event.clientY - rect.top) / rect.height * layer.height;
    if (x < floor.left || x > floor.right || y < floor.top) return;
    exhibit = null;
    balcony.focus({ preventScroll: true });
    walkTo(x, y);
  });

  world.addEventListener('keydown', event => {
    const direction = movementDirection(event.key);
    if (!direction) return;
    exhibit = null;
    event.preventDefault();
    const from = destination ?? knight;
    walkTo(from.x + direction[0] * 28, from.y + direction[1] * 28);
  });

  function stopKnight() {
    cancelAnimationFrame(animation);
    animation = 0;
    lastTime = 0;
    destination = null;
    exhibit = null;
    knight.walkTime = 0;
  }

  world.addEventListener('close', () => {
    stopKnight();
    needsSpawn = true;
    Object.assign(knight, { y: spawnY, facing: 1, back: false });
  });

  new ResizeObserver(updateVisibleFloor).observe(world);
}
