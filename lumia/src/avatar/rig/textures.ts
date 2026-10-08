import * as THREE from 'three';

/** Texturas procedurais pequenas (geradas em canvas, sem download). */

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

let rngSeed = 1234;
const rnd = () => {
  rngSeed = (rngSeed * 16807) % 2147483647;
  return (rngSeed - 1) / 2147483646;
};

export function irisTexture(hue = '#3d2614'): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = '#f2ece6';
  g.fillRect(0, 0, 256, 256);
  const cx = 128;
  const R = 127;
  const grad = g.createRadialGradient(cx, cx, 18, cx, cx, R);
  grad.addColorStop(0, '#2a1a10');
  grad.addColorStop(0.25, hue);
  grad.addColorStop(0.75, '#4a311b');
  grad.addColorStop(0.93, '#3a2414');
  grad.addColorStop(1, '#120b07');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cx, R, 0, Math.PI * 2);
  g.fill();
  // fibras radiais
  for (let i = 0; i < 260; i++) {
    const a = rnd() * Math.PI * 2;
    const r0 = 30 + rnd() * 20;
    const r1 = 70 + rnd() * 40;
    g.strokeStyle = `rgba(${170 + rnd() * 60},${120 + rnd() * 50},${60 + rnd() * 30},${0.08 + rnd() * 0.14})`;
    g.lineWidth = 1 + rnd() * 1.5;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cx + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a + (rnd() - 0.5) * 0.1) * r1, cx + Math.sin(a + (rnd() - 0.5) * 0.1) * r1);
    g.stroke();
  }
  // pupila
  g.fillStyle = '#050403';
  g.beginPath();
  g.arc(cx, cx, 36, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function noiseTexture(size = 256, scale = 1, contrast = 0.5): THREE.CanvasTexture {
  const [c, g] = canvas(size, size);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (rnd() - 0.5) * 255 * contrast;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (scale > 1) {
    g.globalAlpha = 0.5;
    g.drawImage(c, 0, 0, size * scale, size * scale);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Fios de cabelo: listras finas variando na direção U (azimute). */
export function hairTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(1024, 8);
  for (let x = 0; x < 1024; x++) {
    const v = 90 + rnd() * 140;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(x, 0, 1, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

/** Malha de tecido (tricô fino) para a roupa escura do intérprete. */
export function knitTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    for (let x = 0; x < 128; x += 4) {
      const v = 110 + rnd() * 60;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath();
      g.ellipse(x + 2, y + 2, 1.6, 2.1, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}
