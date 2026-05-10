const canvas = document.querySelector("#game");
const startScreen = document.querySelector("#start-screen");
const pauseScreen = document.querySelector("#pause-screen");
const startButton = document.querySelector("#start-button");
const statusText = document.querySelector("#status");
const context = canvas.getContext("2d");

const settings = {
  walkSpeed: 8.5,
  sprintMultiplier: 1.45,
  jumpVelocity: 8.7,
  gravity: 24,
  mouseSensitivity: 0.0022,
  eyeHeight: 1.72,
  fieldOfView: Math.PI / 3,
  nearClip: 0.08,
};

const player = {
  position: { x: 0, y: settings.eyeHeight, z: 8 },
  velocity: { x: 0, y: 0, z: 0 },
  yaw: Math.PI,
  pitch: 0,
  grounded: true,
};

const keys = new Set();
let lastTime = performance.now();
let isPointerLocked = false;

const world = {
  floorSize: 44,
  blocks: [
    { x: -7, y: 1.2, z: -8, width: 3, height: 2.4, depth: 3, color: "#4dabf7" },
    { x: 5, y: 0.8, z: -11, width: 5, height: 1.6, depth: 2.6, color: "#51cf66" },
    { x: 10, y: 2, z: 0, width: 2.5, height: 4, depth: 2.5, color: "#ff922b" },
    { x: -10, y: 1.5, z: 4, width: 2.4, height: 3, depth: 5, color: "#be4bdb" },
    { x: 0, y: 0.25, z: -3, width: 3, height: 0.5, depth: 3, color: "#ffd43b" },
  ],
};

function resizeCanvas() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * pixelRatio);
  canvas.height = Math.floor(window.innerHeight * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function requestPointerLock() {
  canvas.requestPointerLock();
}

function updatePointerLockState() {
  isPointerLocked = document.pointerLockElement === canvas;
  startScreen.classList.toggle("hidden", isPointerLocked || startScreen.dataset.dismissed === "true");
  pauseScreen.classList.toggle("hidden", isPointerLocked || startScreen.dataset.dismissed !== "true");
  statusText.textContent = isPointerLocked ? "Pointer locked" : "Paused";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalize2D(x, z) {
  const length = Math.hypot(x, z);
  if (length === 0) {
    return { x: 0, z: 0 };
  }
  return { x: x / length, z: z / length };
}

function updatePlayer(deltaTime) {
  const forwardInput = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
  const strafeInput = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
  const input = normalize2D(strafeInput, forwardInput);
  const speed = settings.walkSpeed * (keys.has("ShiftLeft") || keys.has("ShiftRight") ? settings.sprintMultiplier : 1);

  const sinYaw = Math.sin(player.yaw);
  const cosYaw = Math.cos(player.yaw);
  const forward = { x: sinYaw, z: cosYaw };
  const right = { x: cosYaw, z: -sinYaw };

  player.velocity.x = (right.x * input.x + forward.x * input.z) * speed;
  player.velocity.z = (right.z * input.x + forward.z * input.z) * speed;

  if (keys.has("Space") && player.grounded) {
    player.velocity.y = settings.jumpVelocity;
    player.grounded = false;
  }

  player.velocity.y -= settings.gravity * deltaTime;
  player.position.x += player.velocity.x * deltaTime;
  player.position.y += player.velocity.y * deltaTime;
  player.position.z += player.velocity.z * deltaTime;

  if (player.position.y <= settings.eyeHeight) {
    player.position.y = settings.eyeHeight;
    player.velocity.y = 0;
    player.grounded = true;
  }

  const boundary = world.floorSize / 2 - 1;
  player.position.x = clamp(player.position.x, -boundary, boundary);
  player.position.z = clamp(player.position.z, -boundary, boundary);
}

function rotatePoint(point) {
  const translated = {
    x: point.x - player.position.x,
    y: point.y - player.position.y,
    z: point.z - player.position.z,
  };

  const sinYaw = Math.sin(-player.yaw);
  const cosYaw = Math.cos(-player.yaw);
  const yawed = {
    x: translated.x * cosYaw - translated.z * sinYaw,
    y: translated.y,
    z: translated.x * sinYaw + translated.z * cosYaw,
  };

  const sinPitch = Math.sin(-player.pitch);
  const cosPitch = Math.cos(-player.pitch);
  return {
    x: yawed.x,
    y: yawed.y * cosPitch - yawed.z * sinPitch,
    z: yawed.y * sinPitch + yawed.z * cosPitch,
  };
}

function project(point) {
  const cameraPoint = rotatePoint(point);
  if (cameraPoint.z <= settings.nearClip) {
    return null;
  }

  const scale = (window.innerHeight / 2) / Math.tan(settings.fieldOfView / 2);
  return {
    x: window.innerWidth / 2 + (cameraPoint.x / cameraPoint.z) * scale,
    y: window.innerHeight / 2 - (cameraPoint.y / cameraPoint.z) * scale,
    depth: cameraPoint.z,
  };
}

function drawPolygon(points, fillStyle, strokeStyle = "rgb(255 255 255 / 12%)") {
  const projected = points.map(project);
  if (projected.some((point) => point === null)) {
    return;
  }

  context.beginPath();
  context.moveTo(projected[0].x, projected[0].y);
  for (const point of projected.slice(1)) {
    context.lineTo(point.x, point.y);
  }
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
  context.strokeStyle = strokeStyle;
  context.stroke();
}

function shadeColor(hexColor, lightness) {
  const color = hexColor.replace("#", "");
  const red = parseInt(color.slice(0, 2), 16);
  const green = parseInt(color.slice(2, 4), 16);
  const blue = parseInt(color.slice(4, 6), 16);
  return `rgb(${Math.round(red * lightness)} ${Math.round(green * lightness)} ${Math.round(blue * lightness)})`;
}

function getBlockFaces(block) {
  const halfWidth = block.width / 2;
  const halfDepth = block.depth / 2;
  const minX = block.x - halfWidth;
  const maxX = block.x + halfWidth;
  const minY = block.y - block.height / 2;
  const maxY = block.y + block.height / 2;
  const minZ = block.z - halfDepth;
  const maxZ = block.z + halfDepth;

  return [
    { depth: block.z + halfDepth, color: shadeColor(block.color, 0.9), points: [{ x: minX, y: minY, z: maxZ }, { x: maxX, y: minY, z: maxZ }, { x: maxX, y: maxY, z: maxZ }, { x: minX, y: maxY, z: maxZ }] },
    { depth: block.z - halfDepth, color: shadeColor(block.color, 0.62), points: [{ x: maxX, y: minY, z: minZ }, { x: minX, y: minY, z: minZ }, { x: minX, y: maxY, z: minZ }, { x: maxX, y: maxY, z: minZ }] },
    { depth: block.x + halfWidth, color: shadeColor(block.color, 0.76), points: [{ x: maxX, y: minY, z: maxZ }, { x: maxX, y: minY, z: minZ }, { x: maxX, y: maxY, z: minZ }, { x: maxX, y: maxY, z: maxZ }] },
    { depth: block.x - halfWidth, color: shadeColor(block.color, 0.7), points: [{ x: minX, y: minY, z: minZ }, { x: minX, y: minY, z: maxZ }, { x: minX, y: maxY, z: maxZ }, { x: minX, y: maxY, z: minZ }] },
    { depth: block.y + block.height / 2, color: shadeColor(block.color, 1.05), points: [{ x: minX, y: maxY, z: maxZ }, { x: maxX, y: maxY, z: maxZ }, { x: maxX, y: maxY, z: minZ }, { x: minX, y: maxY, z: minZ }] },
  ];
}

function drawSky() {
  const gradient = context.createLinearGradient(0, 0, 0, window.innerHeight);
  gradient.addColorStop(0, "#14213d");
  gradient.addColorStop(0.58, "#27496d");
  gradient.addColorStop(1, "#101820");
  context.fillStyle = gradient;
  context.fillRect(0, 0, window.innerWidth, window.innerHeight);
}

function drawFloor() {
  const size = world.floorSize;
  drawPolygon([
    { x: -size / 2, y: 0, z: -size / 2 },
    { x: size / 2, y: 0, z: -size / 2 },
    { x: size / 2, y: 0, z: size / 2 },
    { x: -size / 2, y: 0, z: size / 2 },
  ], "#1f7a4d", "rgb(255 255 255 / 10%)");

  context.strokeStyle = "rgb(255 255 255 / 11%)";
  for (let line = -size / 2; line <= size / 2; line += 2) {
    drawPolygon([{ x: line, y: 0.012, z: -size / 2 }, { x: line + 0.025, y: 0.012, z: -size / 2 }, { x: line + 0.025, y: 0.012, z: size / 2 }, { x: line, y: 0.012, z: size / 2 }], "rgb(255 255 255 / 8%)", "transparent");
    drawPolygon([{ x: -size / 2, y: 0.013, z: line }, { x: size / 2, y: 0.013, z: line }, { x: size / 2, y: 0.013, z: line + 0.025 }, { x: -size / 2, y: 0.013, z: line + 0.025 }], "rgb(255 255 255 / 8%)", "transparent");
  }
}

function drawCrosshair() {
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  context.strokeStyle = "rgb(255 255 255 / 72%)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(centerX - 9, centerY);
  context.lineTo(centerX - 3, centerY);
  context.moveTo(centerX + 3, centerY);
  context.lineTo(centerX + 9, centerY);
  context.moveTo(centerX, centerY - 9);
  context.lineTo(centerX, centerY - 3);
  context.moveTo(centerX, centerY + 3);
  context.lineTo(centerX, centerY + 9);
  context.stroke();
}

function render() {
  drawSky();
  drawFloor();

  const faces = world.blocks.flatMap((block) => getBlockFaces(block));
  faces.sort((a, b) => b.points.reduce((sum, point) => sum + rotatePoint(point).z, 0) - a.points.reduce((sum, point) => sum + rotatePoint(point).z, 0));
  for (const face of faces) {
    drawPolygon(face.points, face.color);
  }

  drawCrosshair();
}

function gameLoop(now) {
  const deltaTime = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  if (isPointerLocked) {
    updatePlayer(deltaTime);
  }
  render();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("resize", resizeCanvas);
document.addEventListener("pointerlockchange", updatePointerLockState);
document.addEventListener("mousemove", (event) => {
  if (!isPointerLocked) {
    return;
  }

  player.yaw -= event.movementX * settings.mouseSensitivity;
  player.pitch = clamp(player.pitch - event.movementY * settings.mouseSensitivity, -Math.PI / 2 + 0.08, Math.PI / 2 - 0.08);
});

document.addEventListener("keydown", (event) => {
  keys.add(event.code);
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ShiftRight"].includes(event.code)) {
    event.preventDefault();
  }
});

document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

startButton.addEventListener("click", () => {
  startScreen.dataset.dismissed = "true";
  requestPointerLock();
});

canvas.addEventListener("click", () => {
  startScreen.dataset.dismissed = "true";
  requestPointerLock();
});

resizeCanvas();
updatePointerLockState();
requestAnimationFrame(gameLoop);
