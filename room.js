/* A hand-drawn, deterministic canvas scene. No images, libraries, or build step. */
'use strict';
const canvas = document.querySelector('#room');
const plaqueCanvas = document.querySelector('#plaque-labels');
const museumForeground = document.querySelector('#museum-foreground');
let ctx = canvas.getContext('2d', { alpha: false });
let scene = null;
let activeScene = 'museum';
const artworks = [
  { title: 'Whack-a-Mole', file: 'whack-a-mole.png', ratio: 1101 / 1428 },
  { title: 'Puma Dunk', file: 'puma-dunk.png', ratio: 1672 / 941 },
  { title: 'Drizzle App', file: 'vancouver-weather.png', ratio: 854 / 1844 },
  { title: 'HTML CSS Project', file: 'snowboarder.png', ratio: 1536 / 1024 },
  { title: 'Moonlit Dragon and Castle', file: 'moonlit-dragon.png', ratio: 1672 / 941 },
  { title: 'DOE Antlered Warrior', file: 'doe-warrior.png', ratio: 1086 / 1448 },
];
// Shuffle once per visit so the side gallery stays stable while resizing.
const sideArtOrder = ['peaks', 'flowers', 'sail', 'vase', 'planet', 'desert'];
for (let i = sideArtOrder.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [sideArtOrder[i], sideArtOrder[j]] = [sideArtOrder[j], sideArtOrder[i]];
}
const caseArtwork = { title: 'Clay AirPods case', file: 'airpods-case.png' };
const statueArt = new Image();
const statueReady = new Promise(resolve => {
  statueArt.onload = resolve;
  statueArt.onerror = resolve;
});
statueArt.src = 'assets/statue/golden-bust.png';
const statueBounds = { x: 619, y: 153, width: 61, height: 200 };
// Load local originals once; the room cache keeps movement inexpensive.
const artworkReady = Promise.all([...artworks, caseArtwork].map(artwork => new Promise(resolve => {
  const image = new Image();
  artwork.image = image;
  image.onload = () => {
    artwork.ratio = image.naturalWidth / image.naturalHeight;
    resolve();
  };
  image.onerror = () => {
    console.error(`Could not load gallery artwork: ${artwork.title}`);
    resolve();
  };
  image.src = `assets/artworks/${artwork.file}`;
})));

function renderRoom() {
plaqueCanvas.hidden = activeScene !== 'museum';
museumForeground.hidden = plaqueCanvas.hidden;
if (activeScene === 'doe') {
  renderDoeRoom();
  return;
}
// Keep the complete composition visible, then draw real scenery into extra space.
const viewportWidth = Math.max(1, canvas.clientWidth);
const viewportHeight = Math.max(1, canvas.clientHeight);
const scale = Math.min(viewportWidth / 790, viewportHeight / 510);
const roomWidth = Math.ceil(viewportWidth / scale - 1e-8);
const roomHeight = Math.ceil(viewportHeight / scale - 1e-8);
const left = 345 - roomWidth / 2;
const right = left + roomWidth;
const top = -Math.floor((roomHeight - 510) * .45);
const bottomEdge = top + roomHeight;
canvas.width = roomWidth;
canvas.height = roomHeight;
museumForeground.width = roomWidth;
museumForeground.height = roomHeight;
ctx.imageSmoothingEnabled = false;
ctx.translate(-left, -top);
let seed = 17926;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
const between = (a, b) => a + random() * (b - a);
const pick = colors => colors[Math.floor(random() * colors.length)];
function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
}
function polygon(points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(Math.round(x), Math.round(y)) : ctx.moveTo(Math.round(x), Math.round(y)));
  ctx.closePath(); ctx.fill();
}
function line(points, color, width = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
}
function texture(x, y, w, h, count, colors, size = 2) {
  for (let i = 0; i < count; i++) rect(between(x, x + w), between(y, y + h), size, size, pick(colors));
}
function clipped(points, draw) {
  ctx.save(); ctx.beginPath();
  points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
  ctx.closePath(); ctx.clip(); draw(); ctx.restore();
}
const gold = ['#674114', '#855113', '#a86a17', '#c68a25', '#dfa83b', '#f2c15b', '#ffe092'];

// Plaster and soft, irregular mineral marks.
const wall = ctx.createLinearGradient(0, 0, 690, 320);
wall.addColorStop(0, '#d1b075'); wall.addColorStop(.43, '#ebcf90'); wall.addColorStop(1, '#cfac6c');
rect(left, top, roomWidth, roomHeight, wall);
texture(left, top, roomWidth, 314 - top, Math.ceil(roomWidth * (314 - top) * .1), ['#b8955520', '#fff1ba25', '#976f3410', '#e5c78c50']);
for (let i = 0; i < 350; i++) {
  const x = between(0,690), y = between(0,310);
  texture(x, y, between(3,20), between(3,16), 12, ['#a9844719','#fff0b921']);
}

// Project each beam between the visible surface edges. Reference points set
// its angle, but don't limit its length when the room expands.
function paintLightBeam(start, end, surfaceTop, surfaceBottom, color, flecks) {
  const edgeAt = (i, y) => start[i] + (end[i] - start[i]) * (y - start[2]) / (end[2] - start[2]);
  const beam = [
    [edgeAt(0, surfaceTop), surfaceTop], [edgeAt(1, surfaceTop), surfaceTop],
    [edgeAt(1, surfaceBottom), surfaceBottom], [edgeAt(0, surfaceBottom), surfaceBottom],
  ];
  const beamLeft = Math.max(left, Math.min(...beam.map(([x]) => x)));
  const beamRight = Math.min(right, Math.max(...beam.map(([x]) => x)));
  if (beamRight <= beamLeft) return;
  const height = surfaceBottom - surfaceTop;
  const width = beamRight - beamLeft;
  clipped(beam, () => {
    rect(beamLeft, surfaceTop, width, height, color);
    texture(beamLeft, surfaceTop, width, height, Math.ceil(width * height * .09), flecks);
  });
}

// Window light: the rays continue off the left and upper edges of the wall.
const lightBands = [
  [[13,78,0],[298,367,313]],
  [[186,229,0],[473,521,313]],
  [[-51,-10,0],[195,238,313]],
  [[-112,-74,0],[143,180,313]],
  [[-176,-132,0],[72,115,313]],
];
for (const [start, end] of lightBands) {
  paintLightBeam(start, end, top, 312, '#ffeab37d', ['#fff3c82e','#ffe7a329']);
}

// Wooden skirting along the back wall.
rect(left,312,roomWidth,28,'#593818');
rect(left,312,roomWidth,3,'#93612c'); rect(left,315,roomWidth,2,'#c28a42');
rect(left,318,roomWidth,2,'#4f321b'); rect(left,322,roomWidth,15,'#795028');
texture(left,321,roomWidth,17,Math.ceil(roomWidth * 2.8),['#c18b4435','#39241140','#e2a14a25']);
line([[left,338],[right,338]],'#3d2b19',2);

// Perspective stone floor.
const floor = ctx.createLinearGradient(0,339,0,bottomEdge);
floor.addColorStop(0,'#c6a064'); floor.addColorStop(1,'#b98d4d');
rect(left,340,roomWidth,bottomEdge-340,floor);
const rows = [340,354,373,398,430,469,516];
while (rows[rows.length - 1] < bottomEdge) {
  const last = rows.length - 1;
  rows.push(rows[last] + Math.ceil((rows[last] - rows[last - 1]) * 1.2));
}
const columnCount = Math.ceil(roomWidth / 116) + 1;
for (let row = 0; row < rows.length - 1; row++) {
  const top=rows[row], bottom=rows[row+1];
  for (let col = -columnCount; col < columnCount; col++) {
    const a=345+col*(58+(top-340)*.52), b=345+col*(58+(bottom-340)*.52);
    const c=345+(col+1)*(58+(bottom-340)*.52), d=345+(col+1)*(58+(top-340)*.52);
    const tile=[[a,top],[d,top],[c,bottom],[b,bottom]];
    clipped(tile,()=>{
      polygon(tile,pick(['#ba9155','#c09b60','#c9a366','#caa569','#b38a4d','#d2ad70']));
      texture(Math.min(a,b),top,Math.max(c,d)-Math.min(a,b),bottom-top,260,['#75532724','#f8d89755','#e7c18165','#8d6b3b2a']);
    });
    line([[a,top],[b,bottom]],'#745735',1.5);
    line([[a+2,top],[b+2,bottom]],'#e6c287',1);
  }
  line([[left,bottom],[right,bottom]],'#80603a',2);
  line([[left,bottom+2],[right,bottom+2]],'#e0ba7d',1);
}

// The entrance runner continues sideways along the exhibition wall.
const runnerLeft = Math.ceil(left) + 12;
const runnerWidth = roomWidth - 24;
const runnerRight = runnerLeft + runnerWidth;
const runnerTop = 348;
const runnerHeight = 54;
const floorSeed = seed;
rect(runnerLeft - 1, runnerTop + 1, runnerWidth + 3, runnerHeight + 2, '#54332055');
rect(runnerLeft, runnerTop, runnerWidth, runnerHeight, '#6f3024');
rect(runnerLeft + 2, runnerTop + 2, runnerWidth - 4, runnerHeight - 4, '#923d2a');
texture(runnerLeft + 3, runnerTop + 3, runnerWidth - 7, runnerHeight - 7,
  Math.ceil(runnerWidth * 5), ['#bd64364a','#61241e45','#da764318'], 1);

// Tone-on-tone scrollwork beneath the gold weave.
for (let x = runnerLeft + 10; x < runnerRight - 20; x += 16) {
  for (const y of [runnerTop + 13, runnerTop + 28, runnerTop + 40]) {
    line([[x,y+3],[x+3,y],[x+9,y],[x+12,y+3],[x+9,y+6],[x+6,y+6],[x+5,y+4],[x+8,y+3]], '#ca6a3f55');
  }
}
for (const inset of [3, 7]) {
  const border = inset === 3 ? '#e4a339' : '#ba7729';
  rect(runnerLeft + inset, runnerTop + inset, runnerWidth - 2 * inset, 1, border);
  rect(runnerLeft + inset, runnerTop + runnerHeight - inset - 1, runnerWidth - 2 * inset, 1, border);
  rect(runnerLeft + inset, runnerTop + inset, 1, runnerHeight - 2 * inset, border);
  rect(runnerRight - inset - 1, runnerTop + inset, 1, runnerHeight - 2 * inset, border);
}
for (let x = runnerLeft + 9; x < runnerRight - 9; x += 4) {
  const offset = x % 8 === (runnerLeft + 9) % 8 ? 0 : 1;
  rect(x, runnerTop + 5 + offset, 2, 1, '#f2b950');
  rect(x, runnerTop + runnerHeight - 6 - offset, 2, 1, '#f2b950');
}
const runnerMedallion = [
  [[0,-9],[3,-6],[2,-3],[0,-4],[-2,-3],[-3,-6]],
  [[5,-3],[7,-6],[10,-6],[8,-3],[12,-4],[12,-2],[15,0],[12,2],[12,4],[8,3],[10,6],[7,6],[5,3],[7,0]],
];
const firstMedallion = 345 - Math.floor((345 - runnerLeft - 23) / 62) * 62;
for (let x = firstMedallion; x < runnerRight - 23; x += 62) {
  ctx.save();
  ctx.translate(x, runnerTop + runnerHeight / 2);
  const thread = '#e6a63b';
  for (const motif of runnerMedallion) {
    polygon(motif, thread);
    polygon(motif.map(([dx, dy]) => [-dx, -dy]), thread);
  }
  polygon([[0,-4],[5,0],[0,4],[-5,0]], '#f4ba4c');
  rect(-1, -1, 3, 2, '#9d4827');
  ctx.restore();
}
seed = floorSeed;

const floorLights = [
  [[79,134,340],[0,54,375]],
  [[171,225,340],[94,155,388]],
  [[260,303,340],[210,273,422]],
  [[355,399,340],[368,432,458]],
  [[475,520,340],[532,592,405]],
  [[565,615,340],[649,702,389]],
];
for (const [start, end] of floorLights) {
  paintLightBeam(start, end, 340, bottomEdge, '#ffdf8b8c', ['#fff0b533','#fff1bd35','#d7aa5933']);
}

// Gilded picture frames with layered moldings and carved acanthus details.
function ornament(cx,cy,s=1,rotation=0){
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(rotation); ctx.scale(s,s);
  polygon([[-17,0],[-13,-5],[-7,-4],[-5,-11],[0,-15],[5,-10],[6,-5],[13,-5],[18,0],[13,6],[6,5],[3,12],[-2,15],[-6,7],[-12,6]],gold[0]);
  polygon([[-15,-1],[-12,-4],[-6,-2],[-3,-10],[0,-13],[3,-8],[4,-2],[12,-4],[15,0],[10,4],[4,3],[1,11],[-3,9],[-4,3],[-11,4]],gold[3]);
  line([[-12,-2],[-7,0],[-4,-2],[-2,-9]],gold[5],2);
  line([[1,-10],[2,0],[0,9]],gold[1],2);
  rect(-2,-5,3,9,gold[5]); rect(-1,-11,2,4,gold[6]);
  rect(6,-2,6,2,gold[5]); rect(-10,1,5,2,gold[1]);
  ctx.restore();
}
function frame(x,y,w,h,artwork,paintArt){
  rect(x+5,y+7,w+3,h+3,'#72502235');
  rect(x+8,y+11,w,h,'#66451e25');
  const layers=[['#573c16',0],['#bf8326',2],['#efb548',4],['#895313',6],['#d89b2e',8],['#75480f',11],['#f6cd68',13],['#a77a25',15],['#4c491f',17]];
  for(const [color,n] of layers)rect(x+n,y+n,w-n*2,h-n*2,color);
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,'#404522'); g.addColorStop(.5,'#454827');g.addColorStop(1,'#3d4321');
  rect(x+19,y+19,w-38,h-38,g);
  texture(x+20,y+20,w-40,h-40,1100,['#abb26806','#252c200b'],1);
  if (paintArt) {
    paintArt(x + 19, y + 19, w - 38, h - 38);
  } else if (artwork?.image.complete && artwork.image.naturalWidth > 0) {
    // Contain the original image inside the opening without cropping or stretching.
    const image = artwork.image;
    const fit = Math.min((w - 38) / image.naturalWidth, (h - 38) / image.naturalHeight);
    const width = image.naturalWidth * fit, height = image.naturalHeight * fit;
    ctx.save();
    ctx.beginPath(); ctx.rect(x + 19, y + 19, w - 38, h - 38); ctx.clip();
    ctx.drawImage(image, x + (w - width) / 2, y + (h - height) / 2, width, height);
    ctx.restore();
  }
  // Individual small facets make the gold read as pixel carving.
  for(let i=0;i<390;i++){
    const horizontal=random()>.5;
    const px=horizontal?between(x+2,x+w-4):pick([x+3,x+w-11])+between(-1,5);
    const py=horizontal?pick([y+3,y+h-11])+between(-1,5):between(y+2,y+h-4);
    rect(px,py,between(1,4),between(1,4),pick(gold.slice(1)));
  }
  line([[x+17,y+h-17],[x+17,y+17],[x+w-17,y+17]],'#ffe092',1);
  line([[x+18,y+h-17],[x+w-17,y+h-17],[x+w-17,y+18]],'#b1812d',2);
  ornament(x+w/2,y+4,1.13);ornament(x+w/2,y+h-3,1.04,Math.PI);
  ornament(x+5,y+h/2,.85,-Math.PI/2);ornament(x+w-5,y+h/2,.85,Math.PI/2);
  for(const [cx,cy,r] of [[x+5,y+5,-.7],[x+w-5,y+5,.7],[x+5,y+h-5,-2.4],[x+w-5,y+h-5,2.4]])ornament(cx,cy,.84,r);
}
const plaques = [];
const frames = [];
function plaque(centerX, y, lines, index, { width = 100, studs = true } = {}) {
  const height = 20, x = Math.round(centerX - width / 2);
  y = Math.round(y);
  plaques.push({ x, y, width, height, index, lines, studs });
  // Stepped corners, beveled brass edges, hammered gold, and four square rivets.
  rect(x + 2, y + 2, width, height, '#5b381a40');
  rect(x + 2, y, width - 4, height, '#69400e');
  rect(x, y + 2, width, height - 4, '#69400e');
  rect(x + 2, y + 1, width - 4, height - 2, '#e1a127');
  const brass = ctx.createLinearGradient(x, y, x + width, y + height);
  brass.addColorStop(0, '#ffc84a'); brass.addColorStop(.45, '#e9a124'); brass.addColorStop(1, '#b87615');
  rect(x + 3, y + 3, width - 6, height - 6, brass);
  texture(x + 3, y + 3, width - 8, height - 8, 110, ['#fff09222','#8e4d0920','#ffdc6a33'], 1);
  rect(x + 3, y + 1, width - 6, 1, '#ffe995');
  rect(x + 1, y + 3, 1, height - 6, '#ffd96a');
  rect(x + 3, y + height - 2, width - 6, 1, '#985b13');
  if (studs) {
    for (const boltX of [x + 4, x + width - 8]) {
      for (const boltY of [y + 4, y + height - 8]) {
        rect(boltX, boltY + 1, 5, 4, '#613907');
        rect(boltX, boltY, 4, 4, '#9d5e09');
        rect(boltX + 1, boltY, 2, 3, '#ffd055');
        rect(boltX + 1, boltY, 1, 1, '#fff4bc');
      }
    }
  }
}
const plaqueTitles = [
  ['WHACK-A-MOLE'], ['PUMA DUNK'], ['DRIZZLE APP'],
  ['HTML CSS', 'PROJECT'], ['MOONLIT DRAGON', 'AND CASTLE'],
  ['DOE', 'ANTLERED WARRIOR'],
];
// Leave space for carved tips and plaques between rows and above the skirting.
artworks.forEach((artwork, index) => {
  const portrait = artwork.ratio < 1;
  const innerWidth = portrait ? 58 * artwork.ratio : 100;
  const innerHeight = portrait ? 58 : 100 / artwork.ratio;
  const width = innerWidth + 38, height = innerHeight + 38;
  const centerX = 165 + (index % 3) * 180;
  const frameBottom = index < 3 ? 112 : 274;
  frames.push({ x: centerX - width / 2, y: frameBottom - height, width, height, index });
  frame(centerX - width / 2, frameBottom - height, width, height, artwork);
  plaque(centerX, frameBottom + 16, plaqueTitles[index], index);
});

// Small pixel paintings for the decorative frames, drawn on a common grid.
function paintSideArt(kind, x, y, width, height) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(width / 64, height / 48);
  clipped([[0,0],[64,0],[64,48],[0,48]], () => {
    if (kind === 'peaks') {
      rect(0,0,64,48,'#758cbb');
      rect(47,6,8,8,'#ffe4ac');
      polygon([[0,35],[19,9],[36,33],[47,16],[64,38],[64,48],[0,48]],'#474c79');
      polygon([[9,23],[19,9],[29,23],[22,21],[18,24],[15,20]],'#e1eaf3');
      polygon([[39,26],[47,16],[55,27],[48,24],[44,26]],'#c0d6e9');
      polygon([[0,39],[14,31],[35,38],[55,33],[64,38],[64,48],[0,48]],'#385b57');
      rect(4,43,56,2,'#668b81');
    } else if (kind === 'flowers') {
      rect(0,0,64,48,'#252c38');
      rect(0,39,64,9,'#67483f');
      for (const [stemX, bloomY, color] of [[20,12,'#ea939d'],[32,7,'#f4cb77'],[44,15,'#c6759b']]) {
        line([[32,34],[stemX,bloomY]],'#6d935c',2);
        rect(stemX-4,bloomY-3,9,6,color);
        rect(stemX-2,bloomY-5,5,10,color);
        rect(stemX-1,bloomY-1,3,3,'#fce6a4');
      }
      polygon([[23,28],[41,28],[44,36],[39,45],[25,45],[20,36]],'#679599');
      rect(24,34,3,7,'#a7c9b2');
    } else if (kind === 'sail') {
      rect(0,0,64,48,'#dda47f');
      rect(43,10,9,9,'#ffdf97');
      rect(0,27,64,21,'#406e89');
      for (const [waveX, waveY, size] of [[2,31,12],[43,33,16],[15,38,12],[33,44,21],[4,46,6]]) {
        rect(waveX,waveY,size,1,'#9bbdc0');
      }
      rect(30,12,1,24,'#392b38');
      polygon([[29,14],[15,33],[29,33]],'#fff1c7');
      polygon([[32,18],[43,33],[32,33]],'#e7c896');
      polygon([[14,35],[45,35],[40,40],[20,40]],'#603c38');
    } else if (kind === 'vase') {
      rect(0,0,64,48,'#763f50');
      rect(0,37,64,11,'#966152');
      polygon([[25,8],[39,8],[37,18],[48,25],[47,37],[41,44],[23,44],[17,37],[16,25],[27,18]],'#dca452');
      polygon([[27,20],[25,28],[25,38],[35,44],[23,44],[17,37],[16,25]],'#a15c44');
      rect(22,30,23,2,'#6f3d47');
      rect(22,34,23,2,'#f3cc77');
      rect(37,23,3,6,'#f9db93');
    } else if (kind === 'planet') {
      rect(0,0,64,48,'#242344');
      for (const [starX, starY] of [[4,7],[12,32],[51,7],[55,32],[47,43],[26,5],[5,41]]) {
        rect(starX,starY,2,2,'#e9cfad');
      }
      polygon([[26,9],[38,9],[46,17],[46,29],[39,37],[25,37],[17,29],[17,17]],'#ba7da7');
      polygon([[26,9],[38,9],[43,14],[30,14],[22,24],[17,23],[17,17]],'#ebabb0');
      line([[9,34],[25,31],[43,24],[55,17]],'#f3cd8a',3);
    } else {
      rect(0,0,64,48,'#b96856');
      rect(25,8,14,14,'#ffca76');
      polygon([[0,30],[15,20],[25,21],[35,33],[49,26],[64,30],[64,48],[0,48]],'#e39258');
      polygon([[0,40],[21,31],[32,36],[48,33],[64,39],[64,48],[0,48]],'#944d52');
      rect(45,28,3,16,'#3a4444');
      rect(41,32,12,3,'#3a4444');
      rect(41,29,3,5,'#3a4444');
      rect(50,27,3,7,'#3a4444');
    }
  });
  ctx.restore();
}

function hangSideRow(from, to, y, height, firstArt) {
  const gap = 22;
  const count = Math.floor((to - from + gap) / (106 + gap));
  if (count < 1) return;
  const width = Math.min(134, (to - from - gap * (count - 1)) / count);
  const start = (from + to - (count * width + (count - 1) * gap)) / 2;
  for (let i = 0; i < count; i++) {
    const kind = sideArtOrder[(firstArt + i) % sideArtOrder.length];
    frame(start + i * (width + gap), y, width, height, null,
      (x, y, w, h) => paintSideArt(kind, x, y, w, h));
  }
}

// Leave the floor ornaments clear in the lower row.
const seedBeforeSideFrames = seed;
const whackFrame = frames[0];
const drizzleFrame = frames[2];
const upperRightStart = 635;
const upperGap = upperRightStart - (drizzleFrame.x + drizzleFrame.width);
const upperLeftEnd = whackFrame.x - upperGap;
const upperSideWidth = Math.min(upperLeftEnd - (left + 18), right - 18 - upperRightStart);
hangSideRow(upperLeftEnd - upperSideWidth, upperLeftEnd, 28, 94, 0);
hangSideRow(upperRightStart, upperRightStart + upperSideWidth, 28, 94, 3);
hangSideRow(left + 18, -44, 164, 104, 1);
hangSideRow(704, right - 18, 164, 104, 4);
seed = seedBeforeSideFrames;

// Carved marble pedestal for the AirPod exhibit.
function drawPedestal(x) {
  ctx.save();
  ctx.translate(x - 620, 0);
  polygon([[629,254],[673,252],[690,266],[690,352],[664,357],[624,351]],'#6a4e2935');
  rect(620,251,58,8,'#8b7042'); rect(621,249,55,6,'#e8c88a');
  rect(625,259,49,74,'#a88b56'); rect(627,260,6,70,'#f0d295');
  rect(634,262,33,65,'#c5a66a'); rect(637,263,2,63,'#e4c28a');
  rect(668,260,5,71,'#8b713e');
  texture(640,264,26,64,330,['#80633424','#f9dda44c','#856a3826']);
  rect(622,331,55,8,'#dbc18b');rect(619,339,61,12,'#b69b67');
  rect(620,337,59,3,'#efdaa2');rect(620,351,59,2,'#7f6843');
  rect(626,340,3,9,'#e2c891');rect(675,341,3,9,'#8a7048');
  ctx.restore();
}

drawPedestal(0);

if (caseArtwork.image.complete && caseArtwork.image.naturalWidth > 0) {
  // The original PNG has transparent margins. Position its visible base on the top.
  ctx.drawImage(caseArtwork.image, 0, 195, 60, 59);
}
plaque(29, 270, ['AIRPOD', 'PROTOTYPE'], null, { width: 44, studs: false });

if (statueArt.naturalWidth) {
  polygon([[629,254],[673,252],[690,266],[690,352],[664,357],[624,351]],'#6a4e2935');
  const { x, y, width, height } = statueBounds;
  ctx.drawImage(statueArt, 120, 9, 572, 1909, x, y, width, height);
}

// Cache the bench separately so it can sit in front of a character behind it.
const backgroundContext = ctx;
const benchLayer = document.createElement('canvas');
benchLayer.width = roomWidth;
benchLayer.height = roomHeight;
ctx = benchLayer.getContext('2d');
ctx.translate(-left, -top);
// Bench, including its shadow, mortise joints, rails, and wood grain.
polygon([[229,404],[499,402],[511,423],[250,426],[222,419]],'#49311c66');
rect(229,368,14,45,'#422b14');rect(446,368,16,46,'#422a12');
rect(234,376,11,31,'#7b4618');rect(448,375,11,34,'#754015');
polygon([[241,375],[254,375],[244,392],[239,392]],'#432b13');
polygon([[433,375],[445,375],[449,393],[442,390]],'#4d3013');
rect(236,401,8,12,'#a46625');rect(449,402,10,11,'#9d6023');
rect(226,410,16,9,'#4c2d13');rect(448,411,17,9,'#4b2c12');
rect(228,410,11,3,'#9b632b');rect(450,411,10,3,'#b47a30');
rect(225,369,241,8,'#462b11');rect(233,372,224,3,'#8f531b');
polygon([[222,347],[461,347],[474,359],[474,369],[215,369],[215,359]],'#452b13');
polygon([[226,346],[460,346],[472,359],[216,359]],'#a56624');
line([[227,347],[459,347]],'#e2a34a',2);
line([[223,351],[463,351]],'#61380f',2);
line([[220,354],[467,354]],'#d48a32',2);
line([[218,358],[470,358]],'#e3a149',2);
rect(217,360,255,7,'#754215');rect(218,360,253,2,'#b7792b');
rect(218,366,254,2,'#35240f');rect(222,370,3,7,'#a26b29');
for(let i=0;i<230;i++){
  const x=between(228,459),y=between(347,358);
  rect(x,y,between(2,11),1,pick(['#e4aa514f','#5b330e60','#f5bf6d4a']));
}
rect(228,379,3,23,'#a56b25');rect(234,382,2,17,'#4f2f11');
rect(449,379,3,24,'#ab732c');rect(457,379,3,28,'#37240f');

ctx = backgroundContext;

// A subtle warm edge vignette integrates the pixel layers.
const vignette=ctx.createRadialGradient(345,220,160,345,245,470);
vignette.addColorStop(0,'#59371600');vignette.addColorStop(1,'#59371625');
rect(left,top,roomWidth,roomHeight,vignette);
const background = document.createElement('canvas');
background.width = roomWidth;
background.height = roomHeight;
background.getContext('2d').drawImage(canvas, 0, 0);
scene = { left, right, top, bottom: bottomEdge, floorTop: 351, background, bench: benchLayer, plaques, frames };
paintPlaqueLabels(viewportWidth, viewportHeight);
canvas.dispatchEvent(new CustomEvent('galleryresize'));
}

const plaqueLetters = {
  A:'010101111101101', B:'110101110101110', C:'011100100100011',
  D:'110101101101110', E:'111100110100111', F:'111100110100100',
  G:'011100101101011', H:'101101111101101', I:'111010010010111',
  J:'001001001101010', K:'101101110101101', L:'100100100100111',
  M:'101111111101101', N:'101111111111101', O:'010101101101010',
  P:'110101110100100', Q:'010101101111011', R:'110101110101101',
  S:'011100010001110', T:'111010010010010', U:'101101101101111',
  V:'101101101101010', W:'101101111111101', X:'101101010101101',
  Y:'101101010010010', Z:'111001010100111', '-':'000000111000000',
};

function paintPlaqueLabels(viewportWidth, viewportHeight) {
  const pixelRatio = window.devicePixelRatio || 1;
  plaqueCanvas.width = Math.max(1, Math.round(viewportWidth * pixelRatio));
  plaqueCanvas.height = Math.max(1, Math.round(viewportHeight * pixelRatio));

  const labels = plaqueCanvas.getContext('2d');
  labels.fillStyle = '#321a08';
  const scaleX = plaqueCanvas.width / canvas.width;
  const scaleY = plaqueCanvas.height / canvas.height;
  const cellHeight = 1.2 * scaleY;
  const lineHeight = 8 * scaleY;

  for (const { x, y, width, height, lines, studs } of scene.plaques) {
    const cellWidth = (studs ? 1.18 : 1.05) * scaleX;
    const textHeight = 5 * cellHeight + (lines.length - 1) * lineHeight;
    const centerX = (x - scene.left + width / 2) * scaleX;
    const textTop = (y - scene.top + height / 2) * scaleY - textHeight / 2;

    lines.forEach((text, row) => {
      const lineLeft = centerX - (text.length * 4 - 1) * cellWidth / 2;
      const lineTop = textTop + row * lineHeight;
      [...text].forEach((letter, column) => {
        const bitmap = plaqueLetters[letter];
        if (!bitmap) return;
        for (let i = 0; i < bitmap.length; i++) {
          if (bitmap[i] !== '1') continue;
          const pixelX = lineLeft + (column * 4 + i % 3) * cellWidth;
          const pixelY = lineTop + Math.floor(i / 3) * cellHeight;
          // Align both edges to physical pixels so the scene's scaling cannot soften them.
          const left = Math.round(pixelX);
          const top = Math.round(pixelY);
          labels.fillRect(left, top, Math.round(pixelX + cellWidth) - left,
            Math.round(pixelY + cellHeight) - top);
        }
      });
    });
  }
}

let resizeFrame;
const observer = new ResizeObserver(() => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(renderRoom);
});
observer.observe(canvas);
renderRoom();
Promise.all([artworkReady, statueReady]).then(() => {
  if (activeScene === 'museum') renderRoom();
});
