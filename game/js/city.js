// NEON HARBOR — the city. Deterministic layout (seed 1337): 7x7 street grid,
// downtown towers, central plaza + Harbor Spire, parks, marina, docks + pier,
// water to the south. Returns colliders + named places for missions/spawns.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './rng.js';
import { facadeTextures, asphaltTextures, groundTexture, pavingTexture, skyDome, glowSprite } from './look.js';

const STREETS = [-168, -112, -56, 0, 56, 112, 168];
const PALETTE = [0x2a3550, 0x3a2a4d, 0x27384a, 0x4d2a35, 0x2a4d42, 0x453a2a, 0x35425e];
// Shared facade variants (color map + lit-window emissive map per variant).
const FACADES = [11, 23, 37, 41, 53, 67].map((s) => facadeTextures(s * 131));
// Visual-only rng: keeps the gameplay rng stream (and therefore the whole
// deterministic layout) untouched by cosmetic choices.
const vrng = makeRng(4242);

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

  scene.add(skyDome());

  // ground + roads
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.groundSize, CFG.groundSize),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);
  const asphalt = asphaltTextures();
  const roadMatX = new THREE.MeshStandardMaterial({ map: asphalt.xTex, roughness: 1 });
  const roadMatZ = new THREE.MeshStandardMaterial({ map: asphalt.zTex, roughness: 1 });
  for (const s of STREETS) {
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(CFG.groundSize, 12), roadMatX);
    rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.02, s); rx.receiveShadow = true; scene.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(12, CFG.groundSize), roadMatZ);
    rz.rotation.x = -Math.PI / 2; rz.position.set(s, 0.02, 0); rz.receiveShadow = true; scene.add(rz);
  }
  // water south — darker, smoother, more reflective
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.groundSize, 120),
    new THREE.MeshStandardMaterial({ color: 0x0d4066, roughness: 0.12, metalness: 0.85 })
  );
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.4, CFG.waterZ + 55);
  scene.add(water);

  // central plaza — paved stone
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(34, 24),
    new THREE.MeshStandardMaterial({ map: pavingTexture(), roughness: 0.9 })
  );
  plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.03, 0);
  plaza.receiveShadow = true;
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
  const tipGlow = glowSprite(0xff4d6d, 17, 0.55);
  tipGlow.position.y = CFG.spireHeight + 2; spire.add(tipGlow);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(7, 0.5, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xaa7711, emissiveIntensity: 1 })
  );
  ring.rotation.x = Math.PI / 2; ring.position.y = CFG.spireHeight * 0.62; spire.add(ring);
  scene.add(spire);
  addCollider(0, 0, 7, 7);

  // Buildings are COMPOSED, not single slabs: a solid podium, a narrower
  // tower (two tiers with a setback on tall downtown blocks), a parapet
  // cap, and one rooftop prop (water tank / antenna / plant block). The
  // composition stays inside the original w x d footprint, so the
  // collider below still matches the silhouette.
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x141926, roughness: 0.95 });
  const podiumMat = new THREE.MeshStandardMaterial({ color: 0x232b3f, roughness: 0.9 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
  const antennaMat = new THREE.MeshStandardMaterial({ color: 0x39415a, roughness: 0.6, metalness: 0.5 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: 0xff2244, emissiveIntensity: 2.2 });
  const tankGeo = new THREE.CylinderGeometry(1.5, 1.5, 2.6, 10);
  const tankLidGeo = new THREE.CylinderGeometry(1.65, 1.65, 0.35, 10);
  const antennaGeo = new THREE.CylinderGeometry(0.09, 0.13, 1, 5);
  const tipGeo = new THREE.SphereGeometry(0.22, 8, 6);

  const mkBuilding = (x, z, w, h, d, downtown) => {
    const tint = rng.pick(PALETTE); // the one gameplay-rng call, as before
    const facade = FACADES[Math.floor(vrng.next() * FACADES.length)];
    const sideMat = new THREE.MeshStandardMaterial({
      color: tint, roughness: 0.75, metalness: 0.2,
      map: facade.map, emissiveMap: facade.emissiveMap,
      emissive: 0xffffff, emissiveIntensity: downtown ? 0.8 : 0.55,
    });
    const grp = new THREE.Group();
    grp.position.set(x, 0, z);
    const part = (geo, mat, px, py, pz) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(px, py, pz);
      m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
      return m;
    };
    // podium: full footprint, solid stone base
    const podiumH = Math.min(5, h * 0.22);
    part(new THREE.BoxGeometry(w, podiumH, d), podiumMat, 0, podiumH / 2, 0);
    // tower: one tier, or two with a setback on tall downtown blocks
    const tw = w * vrng.range(0.74, 0.88), td = d * vrng.range(0.74, 0.88);
    const towerH = h - podiumH;
    const tiers = downtown && h > 44 ? 2 : 1;
    let topW = tw, topD = td, yBase = podiumH;
    for (let t = 0; t < tiers; t++) {
      const th = t === 0 ? towerH * (tiers === 2 ? 0.58 : 1) : towerH * 0.42;
      const s = t === 0 ? 1 : 0.76;
      part(new THREE.BoxGeometry(tw * s, th, td * s), sideMat, 0, yBase + th / 2, 0);
      topW = tw * s; topD = td * s;
      yBase += th;
    }
    // parapet cap
    part(new THREE.BoxGeometry(topW + 0.7, 0.7, topD + 0.7), roofMat, 0, h + 0.3, 0);
    // rooftop prop (visual rng only)
    const prop = vrng.next();
    const px = (vrng.next() - 0.5) * topW * 0.4, pz = (vrng.next() - 0.5) * topD * 0.4;
    if (prop < 0.38) { // water tank
      part(tankGeo, tankMat, px, h + 1.9, pz);
      part(tankLidGeo, roofMat, px, h + 3.3, pz);
    } else if (prop < 0.68 && h > 26) { // antenna + red beacon tip
      const ah = vrng.range(3.5, 6.5);
      const ant = part(antennaGeo, antennaMat, px, h + ah / 2, pz);
      ant.scale.y = ah;
      part(tipGeo, beaconMat, px, h + ah + 0.2, pz);
    } else { // plant / stair block
      part(new THREE.BoxGeometry(topW * 0.34, 1.5, topD * 0.34), roofMat, px, h + 0.75, pz);
    }
    scene.add(grp);
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

  // parks: green + trees (icosahedron canopies — no more cones)
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 3, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 });
  const canopyGeo = new THREE.IcosahedronGeometry(2.7, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1f7a3a, roughness: 1, flatShading: true });
  const canopyMat2 = new THREE.MeshStandardMaterial({ color: 0x2c8f47, roughness: 1, flatShading: true });
  const treeMesh = (x, z) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5; trunk.castShadow = true;
    const c1 = new THREE.Mesh(canopyGeo, canopyMat);
    c1.position.y = 5.4; c1.castShadow = true;
    const c2 = new THREE.Mesh(canopyGeo, canopyMat2);
    c2.position.set(1.1, 6.6, 0.5); c2.scale.setScalar(0.62); c2.castShadow = true;
    g.add(trunk, c1, c2);
    g.position.set(x, 0, z);
    g.rotation.y = vrng.next() * Math.PI * 2;
    scene.add(g);
  };
  const tree = (x, z) => { treeMesh(x, z); addCollider(x, z, 1, 1); };
  for (const [px, pz] of [[-84, 84], [140, -84]]) {
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 44),
      new THREE.MeshStandardMaterial({ color: 0x1d5c2e, roughness: 1 })
    );
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(px, 0.03, pz); scene.add(lawn);
    for (let i = 0; i < 6; i++) tree(px + rng.range(-18, 18), pz + rng.range(-18, 18));
  }
  // plaza rim: trees + benches (visual only — no new colliders)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    treeMesh(Math.cos(a) * 30.5, Math.sin(a) * 30.5);
  }
  const benchWood = new THREE.MeshStandardMaterial({ color: 0x74522e, roughness: 0.95 });
  const benchIron = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.6, metalness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.15;
    const bx = Math.cos(a) * 26, bz = Math.sin(a) * 26;
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.7), benchWood);
    seat.position.y = 0.55; seat.castShadow = true;
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 0.14), benchWood);
    back.position.set(0, 1.0, -0.3);
    const legA = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.6), benchIron);
    legA.position.set(-1.1, 0.27, 0);
    const legB = legA.clone(); legB.position.x = 1.1;
    bench.add(seat, back, legA, legB);
    bench.position.set(bx, 0, bz);
    bench.rotation.y = -a + Math.PI / 2 + Math.PI; // face the Spire
    scene.add(bench);
  }

  // marina + docks + pier (south edge)
  const pier = box(10, 1.5, 46, 0x6a4a2a, 0, 0.4, CFG.waterZ + 8);
  scene.add(pier);
  // mooring posts along the pier edges
  const postGeo = new THREE.CylinderGeometry(0.18, 0.22, 2.4, 7);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4c3620, roughness: 0.95 });
  for (let pz = CFG.waterZ - 10; pz <= CFG.waterZ + 30; pz += 8) {
    for (const pxo of [-4.6, 4.6]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pxo, 0.9, pz);
      post.castShadow = true;
      scene.add(post);
    }
  }
  // boat hull from an extruded side profile (pointed bow, flat stern)
  const hullShape = new THREE.Shape();
  hullShape.moveTo(-7, 1.55);
  hullShape.lineTo(5.2, 1.55);
  hullShape.quadraticCurveTo(6.8, 1.3, 7.2, 0.75);
  hullShape.quadraticCurveTo(5.6, 0.05, 3.5, 0.0);
  hullShape.lineTo(-5.2, 0.0);
  hullShape.quadraticCurveTo(-6.8, 0.25, -7, 0.8);
  hullShape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 4.4, bevelEnabled: false, steps: 1 });
  hullGeo.translate(0, -0.85, -2.2);
  hullGeo.rotateY(-Math.PI / 2); // profile length -> world z, bow to +z
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.4, metalness: 0.2 });
  const boatCabMat = new THREE.MeshStandardMaterial({ color: 0x39c6ff, roughness: 0.2, metalness: 0.4 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x8a8f9a, roughness: 0.5, metalness: 0.6 });
  for (const px of [-56, 56]) {
    const dock = box(30, 1.2, 10, 0x6a4a2a, px, 0.3, CFG.waterZ - 2);
    scene.add(dock);
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.castShadow = true;
    const cab = box(3.4, 1.7, 4.2, 0x39c6ff, 0, 1.55, -0.8);
    cab.material = boatCabMat;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.5, 6), mastMat);
    mast.position.set(0, 3.4, 1.6);
    boat.add(hull, cab, mast); boat.position.set(px, 0.4, CFG.waterZ + 22);
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
      const glow = glowSprite(0xffd9a0, 6.5, 0.42);
      glow.position.set(sx + 7.5, 7.1, sz + 7.5); scene.add(glow);
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
