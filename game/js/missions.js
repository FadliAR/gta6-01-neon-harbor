// NEON HARBOR — 3 chained jobs, 5 checkpoints, one 150 s clock, $950 total.
import * as THREE from 'three';
import { CFG } from './config.js';
import { glowSprite } from './look.js';

const JOBS = [
  {
    name: 'Harbor Pickup',
    brief: 'Pick up the package at the pier, then bring it back to the plaza.',
    points: ['dockPos', 'plazaEdge'],
    pay: 200,
  },
  {
    name: 'Hot Wheels',
    brief: 'A car is waiting. Hit the marina, then the north gate — fast.',
    points: ['marinaPos', 'northGatePos'],
    pay: 300,
  },
  {
    name: 'Spire Run',
    brief: 'Final run: get to the Harbor Spire before the clock dies.',
    points: ['spirePos'],
    pay: 450,
  },
];

export class Missions {
  constructor(scene, places) {
    this.scene = scene;
    this.places = places;
    this.jobIdx = 0;
    this.pointIdx = 0;
    this.active = false;
    this.timeLeft = CFG.missionTime;
    this.done = false;
    this.beacon = new THREE.Group();
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, 30, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    cyl.position.y = 15;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.25, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23f })
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.3;
    this.beacon.add(cyl, ring);
    const beaconGlow = glowSprite(0xffd23f, 11, 0.4);
    beaconGlow.position.y = 5;
    this.beacon.add(beaconGlow);
    this.beacon.visible = false;
    scene.add(this.beacon);
    // cash pickups
    this.coins = [];
    const coinGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.18, 12);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.9, roughness: 0.2, emissive: 0x664400 });
    for (const spot of places.coinSpots) {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.position.copy(spot);
      scene.add(m);
      this.coins.push({ mesh: m, pos: spot.clone(), taken: false });
    }
  }

  start(G) {
    this.active = true;
    this.timeLeft = CFG.missionTime;
    this.jobIdx = 0; this.pointIdx = 0;
    this.moveBeacon(G);
    G.hud.setObjective(`${JOBS[0].name}: ${JOBS[0].brief}`);
    G.hud.setChecklist(this.list());
    G.hud.toast('JOB 1 — HARBOR PICKUP');
    G.audio.jingle();
  }

  list() {
    return JOBS.map((j, i) => ({
      text: `${i + 1}. ${j.name} — $${j.pay}`,
      cls: i < this.jobIdx ? 'done' : i === this.jobIdx ? 'now' : '',
    }));
  }

  currentTarget() {
    if (!this.active || this.done) return null;
    return this.places[JOBS[this.jobIdx].points[this.pointIdx]];
  }

  moveBeacon(G) {
    const t = this.currentTarget();
    if (!t) { this.beacon.visible = false; return; }
    this.beacon.position.set(t.x, 0, t.z);
    this.beacon.visible = true;
  }

  update(dt, G) {
    // coins
    for (const c of this.coins) {
      if (c.taken) continue;
      c.mesh.rotation.y += dt * 2;
      c.mesh.position.y = 1 + Math.sin(G.time * 2 + c.pos.x) * 0.25;
      if (G.player.pos.distanceTo(c.pos) < 2.2) {
        c.taken = true; c.mesh.visible = false;
        G.cash += CFG.coinValue;
        G.hud.toast(`+$${CFG.coinValue} CASH`);
        G.audio.pickup();
        G.effects.burst(c.pos, 0xffd23f, G);
      }
    }
    if (!this.active || this.done) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.active = false;
      this.beacon.visible = false;
      G.hud.setObjective('Chain failed — the clock ran out. Talk to the fixer to retry.');
      G.hud.toast('TIME UP — CHAIN FAILED');
      return;
    }
    const t = this.currentTarget();
    if (t && G.player.pos.distanceTo(t) < 4.5) {
      G.audio.pickup();
      G.effects.burst(t, 0x39ff88, G);
      this.pointIdx++;
      const job = JOBS[this.jobIdx];
      if (this.pointIdx >= job.points.length) {
        G.cash += job.pay;
        G.hud.toast(`JOB DONE — +$${job.pay}`);
        G.audio.jingle();
        this.jobIdx++;
        this.pointIdx = 0;
        if (this.jobIdx >= JOBS.length) {
          this.done = true; this.active = false;
          this.beacon.visible = false;
          G.complete();
          return;
        }
        const nj = JOBS[this.jobIdx];
        G.hud.setObjective(`${nj.name}: ${nj.brief}`);
      }
      this.moveBeacon(G);
      G.hud.setChecklist(this.list());
    }
    const mm = Math.floor(Math.max(0, this.timeLeft) / 60);
    const ss = String(Math.floor(Math.max(0, this.timeLeft) % 60)).padStart(2, '0');
    G.hud.setTimer(`${mm}:${ss}`);
  }

  reset(G) {
    this.jobIdx = 0; this.pointIdx = 0;
    this.active = false; this.done = false;
    this.timeLeft = CFG.missionTime;
    this.beacon.visible = false;
    for (const c of this.coins) { c.taken = false; c.mesh.visible = true; }
    G.hud.setChecklist([]);
    G.hud.setTimer('');
  }
}
