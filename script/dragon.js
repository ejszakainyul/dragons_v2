const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");
document.body.appendChild(canvas);
canvas.style.position = "fixed";
canvas.style.top = "0";
canvas.style.left = "0";
canvas.style.pointerEvents = "none";
canvas.style.zIndex = "2";
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const mirrorCanvas = document.createElement("canvas");
const mirrorCtx = mirrorCanvas.getContext("2d");
document.body.appendChild(mirrorCanvas);
mirrorCanvas.style.position = "fixed";
mirrorCanvas.style.bottom = "0";
mirrorCanvas.style.left = "0";
mirrorCanvas.style.pointerEvents = "none";
mirrorCanvas.style.zIndex = "3";
const mirrorHeight = 150;
mirrorCanvas.width = window.innerWidth;
mirrorCanvas.height = mirrorHeight;

let raindrops = [];
const numRaindrops = 100;

let lightningTimer = 0;
let lightningFrequencyMin = 5000;
let lightningFrequencyMax = 10000;
let lightningActive = false;
let lightningPoints = [];

function now() {
  return performance.now();
}

function initRain() {
  raindrops = [];
  for (let i = 0; i < numRaindrops; i++) {
    raindrops.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      length: Math.random() * 20 + 10,
      speed: Math.random() * 4 + 4,
      opacity: Math.random() * 0.5 + 0.2
    });
  }
}

function updateRain() {
  for (let drop of raindrops) {
    drop.y += drop.speed;
    if (drop.y > canvas.height) {
      drop.y = -drop.length;
      drop.x = Math.random() * canvas.width;
    }
  }
}

function drawRain() {
  for (let drop of raindrops) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(174,194,224,${drop.opacity})`;
    ctx.lineWidth = 1;
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x, drop.y + drop.length);
    ctx.stroke();
  }
}

function drawLightning() {
  if (!lightningActive) return;
  ctx.beginPath();
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(255,255,255,1)";
  ctx.shadowBlur = 15;
  
  ctx.moveTo(lightningPoints[0].x, lightningPoints[0].y);
  for (let i = 1; i < lightningPoints.length; i++) {
    let fadeFactor = 1 - (lightningPoints[i].y / canvas.height);
    ctx.strokeStyle = `rgba(255,255,255,${fadeFactor})`;
    ctx.lineTo(lightningPoints[i].x, lightningPoints[i].y);
    ctx.stroke();
  }

  lightningPoints.slice(1).forEach(point => {
    if (Math.random() < 0.5) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      let branchLength = Math.random() * 40 + 20;
      let angle = Math.random() * Math.PI * 2;
      ctx.lineTo(point.x + Math.cos(angle) * branchLength, point.y + Math.sin(angle) * branchLength);
      ctx.stroke();
    }
  });
  ctx.shadowBlur = 0;
}

function triggerLightning() {
  lightningPoints = [];
  const startX = Math.random() * canvas.width;
  let x = startX;
  let y = 0;
  lightningPoints.push({ x, y });
  const segments = Math.floor(Math.random() * 4 + 4);
  for (let i = 0; i < segments; i++) {
    x += Math.random() * 80 - 40;
    let minYIncrement = (canvas.height / 2 - y) / (segments - i);
    let maxYIncrement = (canvas.height - y) / (segments - i);
    let yIncrement = Math.random() * (maxYIncrement - minYIncrement) + minYIncrement;
    y += yIncrement;
    lightningPoints.push({ x, y });
  }
  lightningActive = true;
  setTimeout(() => {
    lightningActive = false;
  }, 150);
}

function updateMirror() {
  mirrorCtx.clearRect(0, 0, mirrorCanvas.width, mirrorCanvas.height);
  mirrorCtx.globalAlpha = 0.6;
  for (let drop of raindrops) {
    if (drop.y + drop.length > canvas.height - mirrorHeight) {
      let dist = (drop.y + drop.length) - (canvas.height - mirrorHeight);
      let reflectedY = mirrorCanvas.height - dist;
      let distortion = Math.sin((drop.y + drop.x) / 15) * 8;
      mirrorCtx.beginPath();
      mirrorCtx.strokeStyle = `rgba(174,194,224,${drop.opacity * 0.7})`;
      mirrorCtx.lineWidth = 1;
      mirrorCtx.moveTo(drop.x + distortion, reflectedY);
      mirrorCtx.lineTo(drop.x + distortion, reflectedY - drop.length * 0.8);
      mirrorCtx.stroke();
    }
  }
  mirrorCtx.globalAlpha = 1;
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateRain();
  drawRain();
  drawLightning();

  lightningTimer += 16.67;
  if (lightningTimer > (Math.random() * (lightningFrequencyMax - lightningFrequencyMin) + lightningFrequencyMin)) {
    triggerLightning();
    lightningTimer = 0;
  }
  updateMirror();
  requestAnimationFrame(animate);
}

function startWeather() {
  initRain();
  animate();
  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    mirrorCanvas.width = window.innerWidth;
  });
}

// Akkor is elindul, ha a scriptet a DOMContentLoaded után töltjük be
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startWeather, { once: true });
} else {
  startWeather();
}

window.setLightningFrequency = function(min, max) {
  lightningFrequencyMin = min;
  lightningFrequencyMax = max;
  console.log(`Villám gyakoriság beállítva: ${min} - ${max} ms`);
};
