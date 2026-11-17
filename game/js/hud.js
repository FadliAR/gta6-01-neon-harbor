// NEON HARBOR — DOM HUD: stars, cash, health, objective, checklist, minimap, speedo.
export class Hud {
  constructor() {
    this.el = {
      stars: document.getElementById('stars'),
      cash: document.getElementById('cash'),
      healthbar: document.getElementById('healthbar'),
      objective: document.getElementById('objective'),
      checklist: document.getElementById('checklist'),
      minimap: document.getElementById('minimap'),
      speedo: document.getElementById('speedo'),
      toast: document.getElementById('toast'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.toastT = null;
    this.setStars(0);
  }

  setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '<span class="off">★</span>';
    this.el.stars.innerHTML = s;
  }

  setCash(n) { this.el.cash.textContent = `$${n}`; }
  setHealth(h) { this.el.healthbar.style.width = `${Math.max(0, h)}%`; }
  setObjective(t) { this.el.objective.textContent = t; }
  setTimer(t) { /* appended to objective by main loop via setObjectiveTimer */ this.timer = t; }
  setChecklist(items) {
    this.el.checklist.innerHTML = items.map((i) => `<div class="${i.cls}">${i.text}</div>`).join('');
  }
  setSpeedo(kmh, show) {
    this.el.speedo.style.display = show ? 'block' : 'none';
    if (show) this.el.speedo.innerHTML = `${Math.round(kmh)}<span>km/h</span>`;
  }
  toast(msg) {
    this.el.toast.textContent = msg;
    this.el.toast.style.opacity = 1;
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => { this.el.toast.style.opacity = 0; }, 2200);
  }

  // minimap: roads + plaza + water + player/cops/checkpoint/coins
  drawMinimap(G) {
    const g = this.mm, S = 180, k = S / 460;
    const X = (x) => (x + 230) * k, Z = (z) => (z + 230) * k;
    g.fillStyle = '#0a1020'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#0a3550'; g.fillRect(0, Z(205), S, S - Z(205)); // water
    g.strokeStyle = '#2c3a5e'; g.lineWidth = 5;
    for (const s of G.places.streets) {
      g.beginPath(); g.moveTo(0, Z(s)); g.lineTo(S, Z(s)); g.stroke();
      g.beginPath(); g.moveTo(X(s), 0); g.lineTo(X(s), S); g.stroke();
    }
    g.fillStyle = '#39c6ff';
    g.beginPath(); g.arc(X(0), Z(0), 7, 0, 7); g.fill(); // plaza/spire
    const t = G.missions.currentTarget();
    if (t) {
      g.fillStyle = '#ffd23f';
      g.beginPath(); g.arc(X(t.x), Z(t.z), 5, 0, 7); g.fill();
    }
    for (const c of G.missions.coins) {
      if (c.taken) continue;
      g.fillStyle = '#aa8800';
      g.fillRect(X(c.pos.x) - 1.5, Z(c.pos.z) - 1.5, 3, 3);
    }
    for (const c of G.police.cops) {
      g.fillStyle = '#3a6bff'; g.fillRect(X(c.pos.x) - 2, Z(c.pos.z) - 2, 4, 4);
    }
    for (const pc of G.police.copCars) {
      g.fillStyle = '#2244ff'; g.fillRect(X(pc.pos.x) - 2.5, Z(pc.pos.z) - 2.5, 5, 5);
    }
    // player arrow
    const px = X(G.player.pos.x), pz = Z(G.player.pos.z);
    g.save();
    g.translate(px, pz); g.rotate(Math.PI - G.player.heading);
    g.fillStyle = '#39ff88';
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill();
    g.restore();
  }
}
