// NEON HARBOR — wanted system: heat -> 0-5 stars, foot cops + police cars,
// BUSTED on grab, heat decays when calm.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh } from './vehicles.js';
import { collideCircle } from './city.js';
import { makePerson } from './look.js';

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.heat = 0;
    this.stars = 0;
    this.cops = [];      // foot cops {group,pos,heading,grabT}
    this.copCars = [];   // police cars {mesh,pos,heading,speed}
    this.sirenT = 0;
  }

  get wanted() { return this.stars; }

  addHeat(n, G) {
    if (this.heat <= 0 && n > 0) G.audio.sirenStart();
    this.heat = Math.min(CFG.heatPerStar * 5, this.heat + n);
  }

  update(dt, G) {
    const target = Math.min(5, Math.floor(this.heat / CFG.heatPerStar));
    if (target !== this.stars) {
      this.stars = target;
      G.hud.setStars(this.stars);
      if (this.stars === 0) G.audio.sirenStop();
    }
    // calm decay
    if (this.heat > 0) {
      const recentCrime = G.time - G.lastCrimeT < 8;
      if (!recentCrime) this.heat = Math.max(0, this.heat - CFG.heatDecay * dt);
    }
    // spawn / despawn to match stars
    const wantCops = Math.min(this.stars, 3);
    const wantCars = this.stars >= 2 ? Math.min(this.stars - 1, 3) : 0;
    while (this.cops.length < wantCops) this.spawnCop(G);
    while (this.copCars.length < wantCars) this.spawnCopCar(G);
    while (this.cops.length > wantCops) this.removeCop(this.cops.pop());
    while (this.copCars.length > wantCars) this.removeCopCar(this.copCars.pop());

    const pp = G.player.pos;
    for (const c of this.cops) {
      const to = pp.clone().sub(c.pos); to.y = 0;
      const dist = to.length();
      if (dist > 0.5) {
        to.normalize();
        c.heading = Math.atan2(to.x, to.z);
        c.pos.addScaledVector(to, 4.6 * dt);
      }
      collideCircle(c.pos, 0.6, G.colliders);
      c.pos.x = THREE.MathUtils.clamp(c.pos.x, -198, 198);
      c.pos.z = THREE.MathUtils.clamp(c.pos.z, -198, CFG.waterZ - 4);
      c.group.position.copy(c.pos);
      c.group.rotation.y = c.heading;
      c.phase += dt * 9;
      c.legL.rotation.x = Math.sin(c.phase) * 0.6;
      c.legR.rotation.x = -Math.sin(c.phase) * 0.6;
      if (dist < CFG.bustedDist && !G.driving.inCar) {
        c.grabT += dt;
        if (c.grabT > CFG.bustedTime) { G.busted(); return; }
      } else c.grabT = 0;
    }
    for (const pc of this.copCars) {
      const to = pp.clone().sub(pc.pos); to.y = 0;
      const dist = to.length();
      if (dist > 1) {
        to.normalize();
        const want = Math.atan2(to.x, to.z);
        let d = want - pc.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        pc.heading += THREE.MathUtils.clamp(d, -dt * 2.5, dt * 2.5);
        pc.speed = Math.min(26, pc.speed + 14 * dt);
        pc.pos.x += Math.sin(pc.heading) * pc.speed * dt;
        pc.pos.z += Math.cos(pc.heading) * pc.speed * dt;
      }
      // ram the player's car (effect gated 0.4 s so it cannot machine-gun)
      if (G.driving.inCar && dist < 4.2) {
        G.driving.car.speed *= 0.82;
        G.player.hurt(6 * dt * 10);
        if (G.time - (G.lastCrashT || -99) > 0.4) {
          G.lastCrashT = G.time;
          G.effects.crash(pc.pos, G);
        }
      }
      pc.mesh.position.copy(pc.pos);
      pc.mesh.rotation.y = pc.heading;
      this.sirenT += dt;
      const bar = pc.mesh.userData.lightBar;
      if (bar) bar.material.emissive.setHex(Math.sin(this.sirenT * 10) > 0 ? 0xff2233 : 0x2244ff);
    }
  }

  spawnCop(G) {
    const rig = makePerson({ shirt: 0x1a2a55, pants: 0x1a2a55, skin: 0xd9a066 });
    const g = rig.group;
    const navy = new THREE.MeshStandardMaterial({ color: 0x1a2a55, roughness: 0.85 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.16, 10), navy);
    cap.position.y = 2.24; cap.castShadow = true;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 10), navy);
    brim.position.set(0, 2.17, 0.08);
    g.add(cap, brim);
    const a = G.rng.range(0, Math.PI * 2);
    const pos = G.player.pos.clone().add(new THREE.Vector3(Math.sin(a) * 55, 0, Math.cos(a) * 55));
    pos.x = THREE.MathUtils.clamp(pos.x, -195, 195);
    pos.z = THREE.MathUtils.clamp(pos.z, -195, CFG.waterZ - 4);
    g.position.copy(pos);
    this.scene.add(g);
    this.cops.push({ group: g, legL: rig.legL, legR: rig.legR, pos, heading: 0, grabT: 0, phase: 0 });
  }

  removeCop(c) { this.scene.remove(c.group); }

  spawnCopCar(G) {
    const mesh = makeCarMesh(0, true);
    const a = G.rng.range(0, Math.PI * 2);
    const pos = G.player.pos.clone().add(new THREE.Vector3(Math.sin(a) * 60, 0, Math.cos(a) * 60));
    pos.x = THREE.MathUtils.clamp(pos.x, -195, 195);
    pos.z = THREE.MathUtils.clamp(pos.z, -195, CFG.waterZ - 4);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.copCars.push({ mesh, pos, heading: 0, speed: 12 });
  }

  removeCopCar(pc) { this.scene.remove(pc.mesh); }

  clear(G) {
    this.heat = 0; this.stars = 0;
    G.hud.setStars(0); G.audio.sirenStop();
    while (this.cops.length) this.removeCop(this.cops.pop());
    while (this.copCars.length) this.removeCopCar(this.copCars.pop());
  }
}
