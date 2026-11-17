// NEON HARBOR — bootstrap, game loop, state machine, input, screenshot hooks.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './rng.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { TrafficCar, buildParkedCars } from './vehicles.js';
import { Driving } from './driving.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { FollowCamera } from './camera.js';
import { AudioSys } from './audio.js';
import { Effects } from './effects.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot'); // chase | street | docks | spire (screenshots)

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1024);
scene.fog = new THREE.Fog(0x070b16, 130, 400);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);
scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x1a2028, 0.9));
const sun = new THREE.DirectionalLight(0xffe0b3, 1.1);
sun.position.set(120, 180, 60);
scene.add(sun);

// shared game state — every subsystem reads/writes this one object
const G = {
  scene, camera, renderer,
  rng: makeRng(CFG.seed),
  time: 0, state: 'title', // title | playing | paused | busted | wasted | complete
  cash: 0, speedKmh: 0, lastCrimeT: -99,
  keys: {},
  colliders: [], places: null, traffic: [], parked: [],
  player: null, driving: null, peds: null, police: null,
  missions: null, hud: null, cam: null, audio: null, effects: null,
};
G.places = buildCity(scene, G.rng);
G.colliders = G.places.colliders;
G.player = new Player(scene);
G.driving = new Driving(scene);
G.traffic = Array.from({ length: CFG.trafficCount }, () => new TrafficCar(scene, G.rng, G.places.streets));
G.parked = buildParkedCars(scene, G.places.parkCarSpots, G.rng);
G.peds = new Pedestrians(scene, G.rng, G.places.streets);
G.police = new Police(scene);
G.missions = new Missions(scene, G.places);
G.hud = new Hud();
G.cam = new FollowCamera(camera);
G.audio = new AudioSys();
G.effects = new Effects(scene);

G.busted = () => {
  if (G.state !== 'playing') return;
  G.state = 'busted';
  G.cash = Math.max(0, G.cash - 50);
  G.police.clear(G);
  show('busted');
  G.audio.sirenStop();
};
G.complete = () => {
  G.state = 'complete';
  document.getElementById('completeText').textContent =
    `All three jobs done — $${G.cash} banked in ${Math.round(G.time)}s. The harbor is yours.`;
  show('complete');
  G.audio.jingle();
};
G.wasted = () => {
  if (G.state !== 'playing') return;
  G.state = 'wasted';
  G.cash = Math.max(0, G.cash - 100);
  show('wasted');
  G.audio.sirenStop();
};

const overlays = ['title', 'pause', 'busted', 'wasted', 'complete'];
function show(id) {
  for (const o of overlays) document.getElementById(o).classList.toggle('hidden', o !== id);
  if (!id) for (const o of overlays) document.getElementById(o).classList.add('hidden');
}

function startGame() {
  G.audio.ensure();
  if (G.state === 'title') {
    G.state = 'playing';
    show(null);
    G.missions.start(G);
    G.hud.setObjective('Harbor Pickup: reach the pier beacon');
  } else if (G.state === 'paused') {
    G.state = 'playing'; show(null);
  }
}
function respawn() {
  G.player.reset(G.places.playerSpawn);
  if (G.driving.inCar) { G.driving.exit(G); }
  G.player.health = 100;
  G.state = 'playing'; show(null);
  G.hud.setObjective(G.missions.active ? 'Back on the job.' : 'Explore, or press T to run the job chain.');
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', startGame);
document.getElementById('bustedBtn').addEventListener('click', respawn);
document.getElementById('wastedBtn').addEventListener('click', respawn);
document.getElementById('againBtn').addEventListener('click', () => {
  G.cash = 0; G.player.reset(G.places.playerSpawn);
  G.missions.reset(G); G.police.clear(G);
  G.state = 'playing'; show(null);
  G.missions.start(G);
});

addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  G.keys[e.code] = true;
  if (e.code === 'KeyM') G.audio.toggleMute();
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (G.state === 'playing') { G.state = 'paused'; show('pause'); }
    else if (G.state === 'paused') startGame();
  }
  if (e.code === 'Enter' && G.state === 'title') startGame();
  if (e.code === 'KeyT' && G.state === 'playing' && !G.missions.active && !G.missions.done) {
    G.missions.reset(G); G.missions.start(G);
  }
  if (e.code === 'KeyE' && G.state === 'playing') {
    if (G.driving.inCar) G.driving.exit(G);
    else {
      const car = G.driving.nearestParked(G.player.pos, G.parked);
      if (car) {
        G.driving.enter(car, G);
        G.police.addHeat(CFG.heatStealCar, G);
        G.lastCrimeT = G.time;
        G.hud.toast('CAR STOLEN — THE LAW IS COMING');
        G.audio.jingle();
      }
    }
  }
});
addEventListener('keyup', (e) => { G.keys[e.code] = false; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function readInput() {
  const k = G.keys;
  return {
    f: k.KeyW || k.ArrowUp, b: k.KeyS || k.ArrowDown,
    l: k.KeyA || k.ArrowLeft, r: k.KeyD || k.ArrowRight,
    run: k.ShiftLeft || k.ShiftRight,
    jump: k.Space, punch: k.KeyF,
  };
}

// ---- screenshot presets (?shot=...) — deterministic staged scenes ----
function applyShot() {
  show(null);
  G.state = 'playing';
  G.audio.ensure = () => {}; // silent in headless shots
  if (SHOT === 'chase') {
    const car = G.parked[0];
    G.player.pos.copy(car.pos);
    G.driving.enter(car, G);
    G.driving.car.speed = 26;
    G.driving.car.angle = 0;
    G.police.addHeat(78, G);
    G.police.update(0.1, G);
    G.hud.setObjective('Lose the cops — 3 stars and climbing');
  } else if (SHOT === 'street') {
    G.player.pos.set(28, 0, -28);
    G.hud.setObjective('Downtown Neon Harbor — on foot');
  } else if (SHOT === 'docks') {
    G.player.pos.set(6, 0, 196);
    G.missions.start(G);
    G.hud.setObjective('Harbor Pickup: reach the pier beacon');
  } else if (SHOT === 'spire') {
    G.player.pos.set(30, 0, 60);
    G.hud.setObjective('The Harbor Spire — heart of Neon Harbor');
  }
  G.player.group.position.copy(G.player.pos);
}

// ---- debug handle for headless tests (read-only state) ----
window.__NH = {
  get state() { return G.state; },
  get cash() { return G.cash; },
  get stars() { return G.police.stars; },
  get health() { return Math.round(G.player.health); },
  get mission() {
    return {
      active: G.missions.active, done: G.missions.done,
      job: G.missions.jobIdx, point: G.missions.pointIdx,
      timeLeft: Math.round(G.missions.timeLeft),
    };
  },
  get pos() { return [Math.round(G.player.pos.x), Math.round(G.player.pos.z)]; },
  get speedKmh() { return Math.round(G.speedKmh || 0); },
  get inCar() { return G.driving.inCar; },
  get cops() { return G.police.cops.length + G.police.copCars.length; },
  get copPos() {
    const c = G.police.cops[0] || G.police.copCars[0];
    return c ? [Math.round(c.pos.x), Math.round(c.pos.z)] : null;
  },
  ready: false,
  start: startGame,
};

// test-only hooks, gated behind ?debug=1 (never used by the game itself)
if (params.get('debug') === '1') {
  window.__NH.teleport = (x, z) => {
    G.player.pos.set(x, 0, z);
    G.player.group.position.copy(G.player.pos);
  };
  window.__NH.setHeat = (n) => { G.police.heat = n; };
}

// ---- main loop ----
const clock = new THREE.Clock();
let lastTimerText = '';
let titleAngle = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state === 'title') {
    titleAngle += dt * 0.05;
    const c = new THREE.Vector3(Math.sin(titleAngle) * 120, 70, Math.cos(titleAngle) * 120);
    camera.position.copy(c);
    camera.lookAt(0, 20, 0);
    for (const t of G.traffic) t.update(dt, G.traffic);
    renderer.render(scene, camera);
    window.__NH.ready = true;
    return;
  }
  if (G.state !== 'playing') { renderer.render(scene, camera); return; }
  G.time += dt;
  if (G.effects.hitStop > 0) {
    G.effects.hitStop -= dt;
    renderer.render(scene, camera);
    return;
  }
  const input = readInput();
  if (G.driving.inCar) {
    G.driving.update(dt, input, G);
  } else {
    G.player.update(dt, input, G.cam.yaw, G);
  }
  for (const t of G.traffic) t.update(dt, G.traffic);
  G.peds.update(dt, G);
  G.police.update(dt, G);
  G.missions.update(dt, G);
  G.effects.update(dt, G);
  // health regen + wasted
  if (G.player.health < 100) G.player.health = Math.min(100, G.player.health + 2 * dt);
  if (G.player.health <= 0) G.wasted();
  // camera + audio + HUD
  G.cam.update(dt, G.player.pos, G.driving.inCar ? G.driving.car.angle : G.player.heading, G.driving.inCar, G.speedKmh);
  G.audio.setEngine(G.driving.inCar ? Math.abs(G.driving.car.speed) / CFG.carMaxSpeed : 0);
  G.hud.setCash(G.cash);
  G.hud.setHealth(G.player.health);
  G.hud.setSpeedo(G.speedKmh, G.driving.inCar);
  if (G.missions.active) {
    const txt = `⏱ ${Math.floor(G.missions.timeLeft / 60)}:${String(Math.floor(G.missions.timeLeft % 60)).padStart(2, '0')}`;
    if (txt !== lastTimerText) {
      lastTimerText = txt;
      const base = G.hud.el.objective.textContent.split(' ⏱')[0];
      G.hud.setObjective(`${base}  ${txt}`);
    }
  }
  G.hud.drawMinimap(G);
  renderer.render(scene, camera);
  window.__NH.ready = true;
}

if (SHOT) applyShot();
frame();
