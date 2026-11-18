// NEON HARBOR — shared visual helpers for the de-boxing pass: canvas
// textures (facades, asphalt, paving), gradient sky dome, additive glow
// sprites, and a capsule person rig shared by player / peds / cops.
// All procedural, all offline; geometries and textures are built once and
// shared — no per-frame allocation.
import * as THREE from 'three';
import { mulberry32 } from './rng.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---- building facades -------------------------------------------------
// One window layout drives both the color map (panel + dark glass + a hint
// of lit windows) and the emissive map (only the lit windows glow).
export function facadeTextures(seed, cols = 8, rows = 18) {
  const rand = mulberry32(seed);
  const W = cols * 16, H = rows * 16;
  const colC = makeCanvas(W, H), emiC = makeCanvas(W, H);
  const g = colC.getContext('2d'), e = emiC.getContext('2d');
  g.fillStyle = '#c9cedb'; g.fillRect(0, 0, W, H);
  for (let x = 0; x < cols; x++) { // subtle per-column panel shading
    g.fillStyle = `rgba(20,26,44,${(rand() * 0.13).toFixed(3)})`;
    g.fillRect(x * 16, 0, 16, H);
  }
  for (let y = 0; y < rows; y++) { // faint floor bands
    g.fillStyle = 'rgba(20,26,44,0.18)';
    g.fillRect(0, y * 16 + 14, W, 2);
  }
  e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const wx = x * 16 + 4, wy = y * 16 + 4, ww = 8, wh = 9;
      g.fillStyle = '#131a29'; g.fillRect(wx, wy, ww, wh); // dark glass
      if (rand() < 0.42) { // lit window: warm mostly, some cool
        const warm = rand() < 0.72;
        const c = warm ? '#ffd9a0' : '#bfe0ff';
        const dim = 0.5 + rand() * 0.5;
        e.fillStyle = c; e.globalAlpha = dim;
        e.fillRect(wx, wy, ww, wh);
        e.globalAlpha = 1;
        g.fillStyle = c; g.globalAlpha = 0.45 * dim;
        g.fillRect(wx, wy, ww, wh);
        g.globalAlpha = 1;
      }
    }
  }
  return { map: toTex(colC), emissiveMap: toTex(emiC) };
}

// ---- ground surfaces --------------------------------------------------
export function asphaltTextures() {
  const rand = mulberry32(777);
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#161b26'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2800; i++) { // aggregate speckle
    g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.18)';
    g.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  g.fillStyle = 'rgba(232,232,222,0.45)'; // edge lines
  g.fillRect(0, 9, 256, 3); g.fillRect(0, 244, 256, 3);
  g.fillStyle = 'rgba(255,210,63,0.8)'; // dashed centre line (along u)
  g.fillRect(28, 124, 92, 7);
  const xTex = toTex(c, 26, 1);
  const zTex = xTex.clone();
  zTex.center.set(0.5, 0.5);
  zTex.rotation = Math.PI / 2;
  zTex.needsUpdate = true;
  return { xTex, zTex };
}

export function groundTexture() {
  const rand = mulberry32(31337);
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#1d2537'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.14)';
    g.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; // slab joints
  g.strokeRect(0, 0, 256, 256);
  g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256);
  g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
  return toTex(c, 30, 30);
}

export function pavingTexture() {
  const rand = mulberry32(555);
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#39415c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    g.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(10,12,20,0.55)'; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
  }
  return toTex(c, 9, 9);
}

// ---- sky + glow -------------------------------------------------------
export function skyDome() {
  const c = makeCanvas(64, 512), g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.00, '#04061a');
  grad.addColorStop(0.30, '#0c1a3d');
  grad.addColorStop(0.43, '#2a4470');
  grad.addColorStop(0.485, '#8a4a5e');
  grad.addColorStop(0.50, '#ff9a5c'); // horizon glow at the equator
  grad.addColorStop(0.53, '#54304a');
  grad.addColorStop(0.62, '#0a1226');
  grad.addColorStop(1.00, '#04061a');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(860, 24, 16),
    new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false })
  );
  dome.renderOrder = -10;
  return dome;
}

let glowTex = null;
export function glowSprite(color, scale, opacity = 0.5) {
  if (!glowTex) {
    const c = makeCanvas(128, 128), g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.42)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  s.scale.set(scale, scale, 1);
  return s;
}

// ---- people ------------------------------------------------------------
// Capsule rig with pivoted limbs. legL/legR/armL/armR are pivot Groups at
// the hip/shoulder joints — set .rotation.x to swing them.
const personGeos = {
  torso: new THREE.CapsuleGeometry(0.31, 0.52, 4, 10),
  head: new THREE.SphereGeometry(0.30, 12, 10),
  leg: new THREE.CapsuleGeometry(0.15, 0.56, 3, 8),
  arm: new THREE.CapsuleGeometry(0.115, 0.44, 3, 8),
};

export function makePerson({ shirt = 0xffffff, pants = 0x1c2440, skin = 0xd9a066 } = {}) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 });

  const body = new THREE.Mesh(personGeos.torso, shirtMat);
  body.position.y = 1.30;
  const head = new THREE.Mesh(personGeos.head, skinMat);
  head.position.y = 1.98;

  const limb = (geo, mat, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = geo === personGeos.leg ? -0.45 : -0.35;
    pivot.add(m);
    return pivot;
  };
  const legL = limb(personGeos.leg, pantsMat, -0.21, 0.88);
  const legR = limb(personGeos.leg, pantsMat, 0.21, 0.88);
  const armL = limb(personGeos.arm, shirtMat, -0.44, 1.66);
  const armR = limb(personGeos.arm, shirtMat, 0.44, 1.66);

  group.add(body, head, legL, legR, armL, armR);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group, body, head, legL, legR, armL, armR };
}
