// NEON HARBOR — the city. Deterministic layout (seed 1337): 7x7 street grid,
// downtown towers, central plaza + Harbor Spire, parks, marina, docks + pier,
// water to the south. Returns colliders + named places for missions/spawns.
import * as THREE from 'three';
import { CFG } from './config.js';

const STREETS = [-168, -112, -56, 0, 56, 112, 168];
const PALETTE = [0x2a3550, 0x3a2a4d, 0x27384a, 0x4d2a35, 0x2a4d42, 0x453a2a, 0x35425e];

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#0c1220'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 10) {
      g.fillStyle = Math.random() < 0.45 ? '#ffd23f' : '#1d2a44';
      g.fillRect(x, y, 6, 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.1, ...opts })
  );
  m.position.set(x, y, z);
  return m;
}

export function buildCity(scene, rng) {
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const addCollider = (x, z, hw, hd) => colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd });

  // ground + roads
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.groundSize, CFG.groundSize),
    new THREE.MeshStandardMaterial({ color: 0x1a2132, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x11151f, roughness: 1 });
  for (const s of STREETS) {
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(CFG.groundSize, 12), roadMat);
    rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.02, s); scene.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(12, CFG.groundSize), roadMat);
    rz.rotation.x = -Math.PI / 2; rz.position.set(s, 0.02, 0); scene.add(rz);
  }
  // water south
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.groundSize, 120),
    new THREE.MeshStandardMaterial({ color: 0x0a3550, roughness: 0.25, metalness: 0.5 })
  );
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.4, CFG.waterZ + 55);
  scene.add(water);

  // central plaza
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(34, 24),
    new THREE.MeshStandardMaterial({ color: 0x2c3550, roughness: 0.9 })
  );
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.03, 0);
  scene.add(plaza);

  // Harbor Spire — 78 m landmark
  const spire = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 5, CFG.spireHeight, 8),
    new THREE.MeshStandardMaterial({ color: 0x39c6ff, roughness: 0.3, metalness: 0.6, emissive: 0x0a2a44 })
  );
  shaft.position.y = CFG.spireHeight / 2; spire.add(shaft);
  const tip = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0xff4d6d, emissive: 0xff2a55, emissiveIntensity: 2 })
  );
  tip.position.y = CFG.spireHeight + 2; spire.add(tip);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(7, 0.5, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xaa7711, emissiveIntensity: 1 })
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = CFG.spireHeight * 0.62; spire.add(ring);
  scene.add(spire);
  addCollider(0, 0, 7, 7);

  const winTex = windowTexture();
  const mkBuilding = (x, z, w, h, d, downtown) => {
    const color = rng.pick(PALETTE);
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.8, metalness: 0.15,
      emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: downtown ? 0.55 : 0.35,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2, z);
    scene.add(b);
    const roof = box(w * 0.5, 1.2, d * 0.5, 0x11151f, x, h + 0.6, z);
    scene.add(roof);
    addCollider(x, z, w / 2 + 0.5, d / 2 + 0.5);
  };

  // buildings per block; skip plaza block, parks, south dock row
  const parks = new Set(['-2,1', '2,-2']);
  for (let bx = -3; bx <= 2; bx++) {
    for (let bz = -3; bz <= 2; bz++) {
      const key = `${bx},${bz}`;
      if (bx === -1 && bz === -1) continue; // plaza block (center is -0.5? see below)
      if (parks.has(key)) continue;
      if (bz === 2) continue; // dock row
      const cx = (bx + 0.5) * CFG.pitch, cz = (bz + 0.5) * CFG.pitch;
      if (Math.abs(cx) < 40 && Math.abs(cz) < 40) continue; // keep plaza clear
      const downtown = Math.abs(cx) < 120 && Math.abs(cz) < 120;
      const n = downtown ? rng.int(2, 3) : rng.int(1, 2);
      for (let i = 0; i < n; i++) {
        const w = rng.range(14, 26), d = rng.range(14, 26);
        const h = downtown ? rng.range(28, 68) : rng.range(8, 24);
        const ox = rng.range(-10, 10), oz = rng.range(-10, 10);
        mkBuilding(cx + ox, cz + oz, w, h, d, downtown);
      }
    }
  }

  // parks: green + trees
  const tree = (x, z) => {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.7, 3, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a3a22 })
    );
    trunk.position.set(x, 1.5, z); scene.add(trunk);
    const top = new THREE.Mesh(
      new THREE.ConeGeometry(3, 7, 8),
      new THREE.MeshStandardMaterial({ color: 0x1f7a3a, roughness: 1 })
    );
    top.position.set(x, 6, z); scene.add(top);
    addCollider(x, z, 1, 1);
  };
  for (const [px, pz] of [[-84, 84], [140, -84]]) {
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 44),
      new THREE.MeshStandardMaterial({ color: 0x1d5c2e, roughness: 1 })
    );
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(px, 0.03, pz); scene.add(lawn);
    for (let i = 0; i < 6; i++) tree(px + rng.range(-18, 18), pz + rng.range(-18, 18));
  }

  // marina + docks + pier (south edge)
  const pier = box(10, 1.5, 46, 0x6a4a2a, 0, 0.4, CFG.waterZ + 8);
  scene.add(pier);
  for (const px of [-56, 56]) {
    const dock = box(30, 1.2, 10, 0x6a4a2a, px, 0.3, CFG.waterZ - 2);
    scene.add(dock);
    const boat = new THREE.Group();
    const hull = box(6, 2, 14, 0xe8e8e8, 0, 0, 0);
    const cab = box(4, 2.4, 5, 0x39c6ff, 0, 2, -1);
    boat.add(hull, cab); boat.position.set(px, 0.4, CFG.waterZ + 22);
    boat.rotation.y = rng.range(-0.2, 0.2); scene.add(boat);
  }
  addCollider(0, CFG.waterZ + 8, 5, 23);

  // streetlights at intersections
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd23f, emissiveIntensity: 1.6 });
  for (const sx of STREETS) {
    for (const sz of STREETS) {
      if ((sx + sz) % 112 !== 0) continue;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), lampMat);
      pole.position.set(sx + 7.5, 3.5, sz + 7.5); scene.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), bulbMat);
      bulb.position.set(sx + 7.5, 7.1, sz + 7.5); scene.add(bulb);
    }
  }

  // named places (mission / spawn / screenshot anchors)
  return {
    colliders,
    streets: STREETS,
    plaza: new THREE.Vector3(0, 0, 0),
    plazaEdge: new THREE.Vector3(14, 0, 14),
    spirePos: new THREE.Vector3(10, 0, 10),
    playerSpawn: new THREE.Vector3(14, 0, 24),
    dockPos: new THREE.Vector3(0, 0, 186),   // pier start — reachable on foot
    marinaPos: new THREE.Vector3(-56, 0, CFG.waterZ - 8),
    northGatePos: new THREE.Vector3(0, 0, -196),
    westGatePos: new THREE.Vector3(-196, 0, 0),
    coinSpots: [
      [0, -56], [56, 0], [-56, 112], [112, -112], [-112, 56],
      [0, 168], [168, -56], [-168, 0], [56, 168], [-112, -168],
    ].map(([x, z]) => new THREE.Vector3(x, 1, z)),
    parkCarSpots: [
      [64, -56, 0], [-48, 56, Math.PI], [56, -48, Math.PI / 2], [-56, 48, -Math.PI / 2],
      [120, -112, 0], [-104, 112, Math.PI], [64, 112, Math.PI / 2], [-48, -112, -Math.PI / 2],
    ].map(([x, z, a]) => ({ pos: new THREE.Vector3(x, 0, z), angle: a })),
  };
}

// Circle-vs-AABB push-out. Returns true when a collision was resolved.
export function collideCircle(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        pos.x = c.maxX + radius; // inside: push out east
      }
    }
  }
  return hit;
}

export function clampToCity(pos, margin = 200) {
  pos.x = Math.max(-margin, Math.min(margin, pos.x));
  pos.z = Math.max(-margin, Math.min(CFG.waterZ - 2, pos.z));
}
