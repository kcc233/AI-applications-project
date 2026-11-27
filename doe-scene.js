/* The DOE world uses generated local art and the gallery's movement engine. */
'use strict';
function loadDoeImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${path}`));
    image.src = path;
  });
}
const doeArt = { background: null, portrait: null, sprite: null };
const doeAssetsReady = Promise.all([
  loadDoeImage('assets/scenes/doe-workshop-wide.png'),
  loadDoeImage('assets/scenes/doe-workshop-portrait.png'),
  loadDoeImage('assets/characters/doe-cannon-warrior.png'),
]).then(([background, portrait, sprite]) => Object.assign(doeArt, { background, portrait, sprite }));
// Loading errors are reported when the visitor tries to enter the world.
doeAssetsReady.catch(() => {});

// Both layouts are complete, matching pixel-art environments. Protect the three
// exhibits at a uniform scale; only the added side scenery and foreground adapt.
function drawWorkshopBackground(painter, width, height) {
  const portrait = width / height < .9;
  const image = portrait ? doeArt.portrait : doeArt.background;
  const imageWidth = image.naturalWidth, imageHeight = image.naturalHeight;
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const side = portrait ? .1 : .25;
  const floorSplit = portrait ? .69 : .74;
  const sourceX = [0, imageWidth * side, imageWidth * (1 - side), imageWidth];
  const centerWidth = (sourceX[2] - sourceX[1]) * scale;
  const targetX = [0, (width - centerWidth) / 2, (width + centerWidth) / 2, width];
  const sourceY = [0, imageHeight * floorSplit, imageHeight];
  const targetY = [0, sourceY[1] * scale, height];
  // Every source pixel is included; there are no drawn filler panels or borders.
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 3; column++) {
      painter.drawImage(image,
        sourceX[column], sourceY[row], sourceX[column + 1] - sourceX[column], sourceY[row + 1] - sourceY[row],
        targetX[column], targetY[row], targetX[column + 1] - targetX[column], targetY[row + 1] - targetY[row]);
    }
  }
  const projectX = source => {
    const column = source < sourceX[1] ? 0 : source < sourceX[2] ? 1 : 2;
    const fraction = (source - sourceX[column]) / (sourceX[column + 1] - sourceX[column]);
    return targetX[column] + fraction * (targetX[column + 1] - targetX[column]);
  };
  const projectY = fraction => {
    const source = fraction * imageHeight;
    return source <= sourceY[1] ? source * scale
      : targetY[1] + (source - sourceY[1]) / (imageHeight - sourceY[1]) * (height - targetY[1]);
  };
  const projectRect = ([x, y, w, h]) => ({
    left: projectX(x), right: projectX(x + w),
    top: projectY(y / imageHeight), bottom: projectY((y + h) / imageHeight),
  });
  // Trace the pinned sheets separately so the wood and desk stay dark.
  const papers = portrait
    ? [[115,815,121,139], [243,813,73,77], [244,894,87,75], [100,907,20,26], [321,854,28,36]]
    : [[539,239,116,129], [664,232,68,76], [665,312,85,72], [523,331,20,24], [745,273,29,35]];
  return {
    floorY: projectY(portrait ? .69 : .68),
    spawnY: projectY(portrait ? .84 : .9),
    avatarHeight: imageHeight * scale * (portrait ? .18 : .33) * 1.12,
    conceptBoard: {
      bounds: projectRect(portrait ? [99,805,252,165] : [520,225,256,161]),
      papers: papers.map(projectRect),
    },
    hologram: {
      bounds: projectRect(portrait ? [366, 774, 184, 377] : [865, 193, 185, 354]),
      screenBottom: projectY((portrait ? 974 : 389) / imageHeight),
    },
    finalPoster: projectRect(portrait ? [592, 800, 173, 251] : [1164, 211, 190, 260]),
  };
}

function renderDoeRoom() {
  const viewportWidth = Math.max(1, canvas.clientWidth);
  const viewportHeight = Math.max(1, canvas.clientHeight);
  const scale = Math.min(viewportWidth / 790, viewportHeight / 510);
  const width = Math.ceil(viewportWidth / scale - 1e-8);
  const height = Math.ceil(viewportHeight / scale - 1e-8);
  const left = 345 - width / 2;
  const top = -Math.floor((height - 510) * .45);
  const bottom = top + height;
  canvas.width = width; canvas.height = height;
  museumForeground.width = width;
  museumForeground.height = height;
  ctx.imageSmoothingEnabled = false;
  const background = document.createElement('canvas');
  background.width = width; background.height = height;
  const painter = background.getContext('2d', { alpha: false });
  painter.imageSmoothingEnabled = false;
  const layout = drawWorkshopBackground(painter, width, height);
  scene = {
    left, right: left + width, top, bottom, floorTop: top + layout.floorY, background,
    artworkBounds: { x: left, y: top, width, height },
    avatarHeight: layout.avatarHeight,
    conceptBoard: layout.conceptBoard,
    hologram: layout.hologram,
    finalPoster: layout.finalPoster,
    spawn: { x: 345, y: top + layout.spawnY },
    bench: null, plaques: [], frames: [], obstacles: [],
  };
  canvas.dispatchEvent(new CustomEvent('galleryresize'));
}

// Each row contains one idle pose followed by four walking poses.
// Shared vertical crops keep the antlers and foot baseline steady through each cycle.
const doeSpriteFrames = [
  [85, 10, 209, 466], [389, 10, 209, 466], [676, 10, 210, 466],
  [965, 10, 210, 466], [1254, 10, 208, 466],
];
const doeBackSpriteFrames = [
  [85, 523, 208, 466], [384, 523, 209, 466], [673, 523, 208, 466],
  [961, 523, 208, 466], [1249, 523, 209, 466],
];
function drawDoePlayer(phase, bob, perspective, painter) {
  const frames = player.back ? doeBackSpriteFrames : doeSpriteFrames;
  const [x, y, width, height] = frames[route.length ? phase + 1 : 0];
  const spriteScale = scene.avatarHeight / 466;
  painter.save();
  painter.translate(Math.round(player.x), Math.round(player.y));
  painter.fillStyle = '#00000065';
  const shadowWidth = scene.avatarHeight * .22 * perspective;
  painter.fillRect(-shadowWidth / 2, -2, shadowWidth, 5);
  painter.scale(player.facing * perspective, perspective);
  painter.drawImage(doeArt.sprite, x, y, width, height,
      -width * spriteScale / 2, -height * spriteScale + bob,
      width * spriteScale, height * spriteScale);
  painter.restore();
}
