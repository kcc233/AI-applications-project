{
  const world = document.querySelector('#moonlit-world');
  const balcony = world.querySelector('.moonlit-balcony');
  const balconyArt = balcony.querySelector('img');
  const extension = world.querySelector('#moonlit-floor');
  const layer = world.querySelector('#moonlit-knight');
  const painter = layer.getContext('2d');
  const floor = { left: 221, right: 1451, top: 868, bottom: layer.height - 22 };
  const moveSpeed = 300; // Castle scene units per second.
  const spriteHeight = 134;
  const spawnY = 1055;
  const edgeMargin = 38;
  const knight = { x: 836, y: spawnY, facing: 1, back: false, walkTime: 0 };
  let limits = floor;
  let spriteAspectCorrection = 1;
  let destination = null;
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
    const drawHeight = Math.round(spriteHeight * spriteAspectCorrection);
    const bob = destination && phase % 2 && !reducedMotion.matches ? -1 : 0;
    painter.save();
    painter.translate(Math.round(knight.x), Math.round(knight.y));
    painter.fillStyle = '#050c228c';
    painter.fillRect(-16, -2, 32, 5);
    painter.scale(knight.facing, 1);
    painter.drawImage(sprite, x, y, width, height, -Math.round(drawWidth / 2), -drawHeight + bob, drawWidth, drawHeight);
    painter.restore();
  }

  function updateVisibleFloor() {
    if (!world.open) return;
    const sceneRect = balcony.getBoundingClientRect();
    const view = world.getBoundingClientRect();
    if (!sceneRect.width || !view.width) return;
    const scale = layer.width / sceneRect.width;
    spriteAspectCorrection = layer.height / (sceneRect.height * scale);
    limits = {
      ...floor,
      left: Math.max(floor.left, (view.left - sceneRect.left) * scale + edgeMargin),
      right: Math.min(floor.right, (view.right - sceneRect.left) * scale - edgeMargin),
    };
    knight.x = needsSpawn ? (limits.left + limits.right) / 2 : clamp(knight.x, limits.left, limits.right);
    needsSpawn = false;
    if (destination) destination.x = clamp(destination.x, limits.left, limits.right);
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
    knight.back = dy < -Math.abs(dx) * .6;
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
  }

  function walkTo(x, y) {
    const target = { x: clamp(x, limits.left, limits.right), y: clamp(y, floor.top, floor.bottom) };
    if (target.x === knight.x && target.y === knight.y && !destination) return;
    destination = target;
    if (!animation) animation = requestAnimationFrame(animateKnight);
  }

  balcony.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = balcony.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * layer.width;
    const y = (event.clientY - rect.top) / rect.height * layer.height;
    if (x < floor.left || x > floor.right || y < floor.top) return;
    balcony.focus({ preventScroll: true });
    walkTo(x, y);
  });

  world.addEventListener('keydown', event => {
    const direction = movementDirection(event.key);
    if (!direction) return;
    event.preventDefault();
    const from = destination ?? knight;
    walkTo(from.x + direction[0] * 28, from.y + direction[1] * 28);
  });

  world.addEventListener('close', () => {
    cancelAnimationFrame(animation);
    animation = 0;
    lastTime = 0;
    destination = null;
    needsSpawn = true;
    Object.assign(knight, { y: spawnY, facing: 1, back: false, walkTime: 0 });
  });

  new ResizeObserver(updateVisibleFloor).observe(world);
}
