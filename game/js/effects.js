// NEON HARBOR — particles, hit-stop, crash shake. One pooled burst system.
import * as THREE from 'three';
import { CFG } from './config.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.hitStop = 0;
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(geo, this.mat.clone());
      m.visible = false;
      scene.add(m);
      this.particles.push({ mesh: m, vel: new THREE.Vector3(), life: 0 });
    }
  }

  burst(pos, color, G, n = 14) {
    let made = 0;
    for (const p of this.particles) {
      if (made >= n) break;
      if (p.life > 0) continue;
      p.life = 0.6;
      p.mesh.visible = true;
      p.mesh.material.color.setHex(color);
      p.mesh.position.set(pos.x, (pos.y || 0) + 1, pos.z);
      p.vel.set((Math.random() - 0.5) * 9, Math.random() * 7 + 2, (Math.random() - 0.5) * 9);
      made++;
    }
  }

  crash(pos, G) {
    this.burst(pos, 0xff8a3c, G, 18);
    G.camera.addTrauma(0.45);
  }

  // punch: nearest ped/cop in range takes damage, flies back, hit-stop freezes a beat
  punch(player, G) {
    const origin = player.pos;
    const fwd = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    let hitAny = false;
    const tryHit = (pos, radius, onHit) => {
      const to = pos.clone().sub(origin); to.y = 0;
      const d = to.length();
      if (d < CFG.punchRange + radius && to.dot(fwd) > -0.2) { onHit(to.normalize(), d); return true; }
      return false;
    };
    for (const p of G.peds.list) {
      if (p.hp <= 0) continue;
      if (tryHit(p.pos, 0.6, (dir) => {
        p.hp -= CFG.punchDamage;
        p.pos.addScaledVector(dir, 2.5);
        p.state = 'flee'; p.fleeT = 3;
        p.target = p.pos.clone().addScaledVector(dir, 30);
        this.burst(p.pos, 0xffffff, G, 8);
      })) hitAny = true;
    }
    for (const c of G.police.cops) {
      tryHit(c.pos, 0.6, (dir) => {
        c.pos.addScaledVector(dir, 2);
        this.burst(c.pos, 0x3a6bff, G, 8);
        G.police.addHeat(CFG.heatPunch, G);
        G.lastCrimeT = G.time;
      });
      hitAny = true;
    }
    if (hitAny) {
      this.hitStop = 0.07;
      G.camera.addTrauma(0.25);
      G.peds.scare(origin, 12);
    }
  }

  update(dt, G) {
    for (const p of this.particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vel.y -= 18 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 6;
      p.mesh.rotation.y += dt * 5;
    }
  }
}
