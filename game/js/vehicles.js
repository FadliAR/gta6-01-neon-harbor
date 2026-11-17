// NEON HARBOR — cars: parked (stealable) + traffic AI (car-following loops).
import * as THREE from 'three';
import { CFG } from './config.js';

const CAR_COLORS = [0xd21f3c, 0x1f6fd2, 0xf2c200, 0x22b573, 0xe8e8e8, 0x222222, 0x8a5cf6, 0xff7a1a];

export function makeCarMesh(color, police = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: police ? 0x11151f : color, roughness: 0.35, metalness: 0.6,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), paint);
  body.position.y = 0.62;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.65, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.15, metalness: 0.8 })
  );
  cabin.position.set(0, 1.3, -0.2);
  group.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    group.add(w); wheels.push(w);
  }
  // headlights + taillights
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe9a8, emissiveIntensity: 1.2 });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    h.position.set(x, 0.65, 2.21); group.add(h);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2233, emissive: 0xaa0011, emissiveIntensity: 1 });
  for (const x of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    t.position.set(x, 0.65, -2.21); group.add(t);
  }
  if (police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 2 })
    );
    bar.position.set(0, 1.75, -0.2); group.add(bar);
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
