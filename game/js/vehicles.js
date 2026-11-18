// NEON HARBOR — cars: parked (stealable) + traffic AI (car-following loops).
// Bodies are EXTRUDED side profiles (hood slope, trunk, nose) — the
// silhouette reads as a car, not stacked boxes. Dimensions unchanged:
// 4.4 long, ~1.9 wide, wheels at the same spots, physics untouched.
import * as THREE from 'three';
import { CFG } from './config.js';

const CAR_COLORS = [0xd21f3c, 0x1f6fd2, 0xf2c200, 0x22b573, 0xe8e8e8, 0x222222, 0x8a5cf6, 0xff7a1a];

// ---- shared geometry / materials (built once) ----
let bodyGeo = null, glassGeo = null;
function carGeos() {
  if (bodyGeo) return;
  // lower body: beltline and below (shape x = length, y = height)
  const b = new THREE.Shape();
  b.moveTo(-2.2, 0.32);
  b.lineTo(-2.2, 0.92);
  b.quadraticCurveTo(-2.2, 1.04, -2.02, 1.06);
  b.lineTo(-1.3, 1.08);            // trunk deck
  b.lineTo(1.32, 1.03);            // beltline to the windshield base
  b.lineTo(1.95, 0.94);            // hood
  b.quadraticCurveTo(2.2, 0.88, 2.2, 0.7);
  b.lineTo(2.2, 0.32);
  b.closePath();
  bodyGeo = new THREE.ExtrudeGeometry(b, {
    depth: 1.78, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1, steps: 1,
  });
  bodyGeo.translate(0, 0, -0.89);
  bodyGeo.rotateY(-Math.PI / 2); // length -> +z (nose forward)
  // glasshouse: sloped windshield + roof + sloped rear window
  const g = new THREE.Shape();
  g.moveTo(-1.34, 1.02);
  g.quadraticCurveTo(-1.02, 1.4, -0.58, 1.43);
  g.lineTo(0.42, 1.43);
  g.quadraticCurveTo(0.94, 1.39, 1.36, 1.01);
  g.closePath();
  glassGeo = new THREE.ExtrudeGeometry(g, {
    depth: 1.58, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, steps: 1,
  });
  glassGeo.translate(0, 0, -0.79);
  glassGeo.rotateY(-Math.PI / 2);
}
const glassMat = new THREE.MeshStandardMaterial({ color: 0x10161f, roughness: 0.08, metalness: 0.9 });
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.32, 10);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
const hubMat = new THREE.MeshStandardMaterial({ color: 0xb9c0cc, roughness: 0.35, metalness: 0.8 });
const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe9a8, emissiveIntensity: 1.2 });
const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2233, emissive: 0xaa0011, emissiveIntensity: 1 });
const lightGeo = new THREE.BoxGeometry(0.36, 0.16, 0.08);
const paintMats = new Map();
function paintMat(color, police) {
  const key = police ? 'police' : color;
  if (!paintMats.has(key)) {
    paintMats.set(key, new THREE.MeshStandardMaterial({
      color: police ? 0x11151f : color, roughness: 0.35, metalness: 0.6,
    }));
  }
  return paintMats.get(key);
}
function makeWheel() {
  const grp = new THREE.Group();
  const tire = new THREE.Mesh(wheelGeo, wheelMat);
  tire.rotation.z = Math.PI / 2;
  const hub = new THREE.Mesh(hubGeo, hubMat);
  hub.rotation.z = Math.PI / 2;
  grp.add(tire, hub);
  return grp;
}

export function makeCarMesh(color, police = false) {
  carGeos();
  const group = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, paintMat(color, police));
  body.castShadow = true;
  const glass = new THREE.Mesh(glassGeo, glassMat);
  group.add(body, glass);
  const wheels = [];
  for (const [x, z] of [[-0.9, 1.45], [0.9, 1.45], [-0.9, -1.45], [0.9, -1.45]]) {
    const w = makeWheel();
    w.position.set(x, 0.42, z);
    group.add(w); wheels.push(w);
  }
  // headlights + taillights
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(lightGeo, headMat);
    h.position.set(x, 0.72, 2.2); group.add(h);
    const t = new THREE.Mesh(lightGeo, tailMat);
    t.position.set(x, 0.78, -2.2); group.add(t);
  }
  if (police) {
    // white door band on both flanks
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.4, metalness: 0.3 });
    for (const x of [-0.97, 0.97]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 1.7), bandMat);
      band.position.set(x, 0.72, 0); group.add(band);
    }
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 2 })
    );
    bar.position.set(0, 1.58, -0.1); group.add(bar);
    group.userData.lightBar = bar;
  }
  group.userData.wheels = wheels;
  return group;
}

// One traffic car: drives a rectangle loop on the street grid, slows for the car ahead.
export class TrafficCar {
  constructor(scene, rng, streets) {
    this.mesh = makeCarMesh(rng.pick(CAR_COLORS));
    scene.add(this.mesh);
    const a = rng.pick(streets), b = rng.pick(streets);
    const c = rng.pick(streets), d = rng.pick(streets);
    this.loop = [
      new THREE.Vector3(a, 0, c), new THREE.Vector3(b, 0, c),
      new THREE.Vector3(b, 0, d), new THREE.Vector3(a, 0, d),
    ];
    this.wp = 0;
    this.pos = this.loop[0].clone();
    this.heading = 0;
    this.speed = rng.range(7, 11);
    this.cruise = this.speed;
  }

  update(dt, others) {
    const target = this.loop[this.wp];
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) { this.wp = (this.wp + 1) % this.loop.length; return; }
    const want = Math.atan2(dx, dz);
    let d = want - this.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.heading += THREE.MathUtils.clamp(d, -dt * 2.2, dt * 2.2);
    // car-following: slow when someone is close ahead
    let slow = false;
    for (const o of others) {
      if (o === this) continue;
      const ox = o.pos.x - this.pos.x, oz = o.pos.z - this.pos.z;
      const ahead = ox * Math.sin(this.heading) + oz * Math.cos(this.heading);
      const side = Math.abs(ox * Math.cos(this.heading) - oz * Math.sin(this.heading));
      if (ahead > 0 && ahead < 11 && side < 3) { slow = true; break; }
    }
    const v = slow ? this.cruise * 0.25 : this.cruise;
    this.speed += (v - this.speed) * Math.min(1, dt * 2);
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    for (const w of this.mesh.userData.wheels) w.rotation.x += this.speed * dt * 2;
  }
}

export function buildParkedCars(scene, spots, rng) {
  return spots.map((s, i) => {
    const mesh = makeCarMesh(CAR_COLORS[i % CAR_COLORS.length]);
    mesh.position.copy(s.pos);
    mesh.rotation.y = s.angle;
    scene.add(mesh);
    return { mesh, pos: s.pos.clone(), angle: s.angle, taken: false, color: CAR_COLORS[i % CAR_COLORS.length] };
  });
}
