// Three.js presentation of a level: tabletop board, dice, animations and effects.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from '../core/rules.js';
import { DIRS, DIR_KEYS } from '../core/dice.js';

const ROAD_Y = 0.05;          // top of the road surface
const DICE_SIZE = 0.72;
const DICE_HALF = DICE_SIZE / 2;
const DICE_BASE = ROAD_Y + 0.012;
const ROAD_W = 0.66;

// Shared palette (GDD 11.2) + per-world board colours.
const PAL = {
  wood: '#c98a52', woodDark: '#8f5a30', felt: 0x35a583, road: 0xf7dfae, roadEdge: 0xa9682f,
  dot: 0xb98f55, stone: 0x66708a, stoneTop: 0x8892aa,
  point: '#ff5a5f', pointDark: '#d93a4c', solved: '#b9ffd9', solvedDark: '#35c98d',
  glow: 0x9dffd0, gold: '#ffc93c', ivory: '#f8f1df', pip: '#2b2433',
};
const WORLD_PAL = {
  0: { felt: 0x2e3f8f, road: 0xf3e6c8, roadEdge: 0x8a6a3a, dot: 0xb39a6a, stone: 0x4d5680, stoneTop: 0x6c76a3, wood: '#7b5a9e' }, // daily challenge
  1: { felt: 0x35a583, road: 0xf7dfae, roadEdge: 0xa9682f, dot: 0xb98f55, stone: 0x66708a, stoneTop: 0x8892aa, wood: '#c98a52' },
  2: { felt: 0x3f8ccf, road: 0xf4ead6, roadEdge: 0x8d6d4a, dot: 0xb4a07e, stone: 0x5d6b7d, stoneTop: 0x7f8ea3, wood: '#b9875c' },
  3: { felt: 0x8a5cc9, road: 0xfbe7d2, roadEdge: 0x93603e, dot: 0xc09a7c, stone: 0x5a4f78, stoneTop: 0x7d70a3, wood: '#a8754e' },
  4: { felt: 0x2b3f7a, road: 0xe9e4f5, roadEdge: 0x5e5a8a, dot: 0xa49fc4, stone: 0x45507a, stoneTop: 0x66729e, wood: '#6f5a8f' },
  5: { felt: 0xc2603e, road: 0xf8e2c0, roadEdge: 0x8e4f2c, dot: 0xc69a6a, stone: 0x6d5a52, stoneTop: 0x8f7a70, wood: '#9e6a44' },
};
const ARROW_ROT = { U: 0, L: Math.PI / 2, D: Math.PI, R: -Math.PI / 2 };

// ---------- tiny tween system ----------
const ease = {
  linear: (t) => t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  backOut: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
};

class Tweens {
  constructor() { this.list = []; }
  add(duration, fn, easing = ease.linear) {
    return new Promise((resolve) => this.list.push({ t: 0, duration, fn, easing, resolve }));
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.duration);
      tw.fn(tw.easing(p));
      if (p >= 1) { this.list.splice(i, 1); tw.resolve(); }
    }
  }
  clear() { const l = this.list; this.list = []; for (const tw of l) tw.resolve(); }
}

// ---------- canvas textures ----------
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const PIPS = {
  1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

function diceFaceTexture(n, skin = { body: PAL.ivory, pip: PAL.pip }) {
  return canvasTex(256, (g, s) => {
    g.fillStyle = skin.body; g.fillRect(0, 0, s, s);
    const shade = g.createRadialGradient(s / 2, s / 2, s * 0.2, s / 2, s / 2, s * 0.75);
    shade.addColorStop(0, 'rgba(255,255,255,0)'); shade.addColorStop(1, 'rgba(60,40,20,0.22)');
    g.fillStyle = shade; g.fillRect(0, 0, s, s);
    if (skin.sparkle) {
      let seed = n * 97;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
        g.beginPath(); g.arc(rnd() * s, rnd() * s, 0.6 + rnd() * 2.2, 0, Math.PI * 2); g.fill();
      }
    }
    const pos = [0.27, 0.5, 0.73];
    for (const [cx, cy] of PIPS[n]) {
      const x = pos[cx] * s, y = pos[cy] * s, r = s * (n === 1 ? 0.13 : 0.092);
      g.fillStyle = skin.pip; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.3, 0, Math.PI * 2); g.fill();
    }
  });
}

/** Tile art for the new mechanics (also shown on the intro cards). */
function mechTexture(kind, n) {
  return canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    const pad = 14, c = s / 2;
    const tile = (top, bottom, stroke) => {
      const grad = g.createLinearGradient(0, 0, 0, s);
      grad.addColorStop(0, top); grad.addColorStop(1, bottom);
      roundRect(g, pad, pad, s - pad * 2, s - pad * 2, 44);
      g.fillStyle = grad; g.fill();
      g.lineWidth = 10; g.strokeStyle = stroke; g.stroke();
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (kind === 'stop') {
      tile('#ffd36b', '#f0a12a', 'rgba(255,255,255,0.8)');
      g.beginPath();
      for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; g.lineTo(c + Math.cos(a) * 78, c + Math.sin(a) * 78); }
      g.closePath(); g.fillStyle = '#7a3d0a'; g.fill();
      g.fillStyle = '#fff'; roundRect(g, c - 48, c - 13, 96, 26, 13); g.fill();
    } else if (kind === 'arrow') {
      tile('#7ef0df', '#22b9b0', 'rgba(255,255,255,0.8)');
      g.strokeStyle = '#ffffff'; g.lineWidth = 26;
      g.beginPath(); g.moveTo(c - 58, c + 6); g.lineTo(c, c - 52); g.lineTo(c + 58, c + 6); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 18;
      g.beginPath(); g.moveTo(c - 40, c + 62); g.lineTo(c, c + 22); g.lineTo(c + 40, c + 62); g.stroke();
    } else if (kind === 'portalT' || kind === 'portalU') {
      const [a, b] = kind === 'portalT' ? ['#c58bff', '#6a2fd1'] : ['#ffb36b', '#e4602a'];
      const grad = g.createRadialGradient(c, c, 8, c, c, s / 2 - pad);
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.25, a); grad.addColorStop(1, b);
      g.fillStyle = grad; g.beginPath(); g.arc(c, c, s / 2 - pad, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 9;
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.arc(c, c, 30 + i * 28, i * 2.1, i * 2.1 + Math.PI * 1.1); g.stroke();
      }
    } else if (kind === 'crumble') {
      const grad = g.createLinearGradient(0, 0, 0, s);
      grad.addColorStop(0, '#f2d3a3'); grad.addColorStop(1, '#cf9f66');
      g.fillStyle = grad; roundRect(g, 4, 4, s - 8, s - 8, 30); g.fill();
      g.strokeStyle = '#8a5a2c'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(40, 70); g.lineTo(100, 110); g.lineTo(90, 160); g.lineTo(140, 200);
      g.moveTo(100, 110); g.lineTo(170, 90); g.lineTo(220, 120);
      g.moveTo(170, 90); g.lineTo(160, 40); g.moveTo(140, 200); g.lineTo(200, 220); g.stroke();
    } else if (kind === 'gate') {
      tile('#7fb6ff', '#3769d6', 'rgba(255,255,255,0.85)');
      g.fillStyle = 'rgba(255,255,255,0.95)';
      roundRect(g, c - 66, c - 62, 132, 132, 22); g.fill();
      const pos = [0.32, 0.5, 0.68];
      for (const [px, py] of PIPS[n]) {
        g.fillStyle = '#2445a0'; g.beginPath(); g.arc(pos[px] * s, (pos[py] + 0.03) * s, s * 0.055, 0, Math.PI * 2); g.fill();
      }
      // small padlock
      g.fillStyle = '#ffc93c'; roundRect(g, s - 82, 22, 52, 40, 8); g.fill();
      g.strokeStyle = '#ffc93c'; g.lineWidth = 8; g.beginPath(); g.arc(s - 56, 24, 15, Math.PI, 0); g.stroke();
    }
  });
}

function tileTexture(kind, n) {
  return canvasTex(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    const pad = 14;
    const colors = {
      point: [PAL.point, PAL.pointDark, '#ffffff'],
      solved: [PAL.solved, PAL.solvedDark, '#ffffff'],
      end: ['#39405e', '#22273d', PAL.gold],
      start: ['#ffe2a6', '#e9b765', '#b9793f'],
    }[kind];
    const grad = g.createLinearGradient(0, 0, 0, s);
    grad.addColorStop(0, colors[0]); grad.addColorStop(1, colors[1]);
    roundRect(g, pad, pad, s - pad * 2, s - pad * 2, 44);
    g.fillStyle = grad; g.fill();
    g.lineWidth = 10; g.strokeStyle = kind === 'end' ? PAL.gold : 'rgba(255,255,255,0.75)'; g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (kind === 'point' || kind === 'solved') {
      g.font = '900 150px "Arial Rounded MT Bold", "Segoe UI", system-ui, sans-serif';
      if (kind === 'solved') {
        g.fillStyle = 'rgba(20,110,75,0.9)'; g.fillText(String(n), s / 2, s / 2 + 8);
        // check badge
        g.fillStyle = '#19a56c'; g.beginPath(); g.arc(s - 62, 62, 34, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 10; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(s - 78, 62); g.lineTo(s - 66, 75); g.lineTo(s - 46, 50); g.stroke();
      } else {
        g.fillStyle = 'rgba(120,20,40,0.55)'; g.fillText(String(n), s / 2 + 4, s / 2 + 14);
        g.fillStyle = '#fff'; g.fillText(String(n), s / 2, s / 2 + 8);
      }
    } else if (kind === 'end') {
      // checker ring
      const cells = 4, cs = (s - pad * 2 - 60) / cells, o = pad + 30;
      for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
        g.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,0.92)' : 'rgba(255,201,60,0.95)';
        roundRect(g, o + x * cs + 3, o + y * cs + 3, cs - 6, cs - 6, 8); g.fill();
      }
    } else {
      g.strokeStyle = colors[2]; g.lineWidth = 12; g.beginPath(); g.arc(s / 2, s / 2, 52, 0, Math.PI * 2); g.stroke();
    }
  });
}

function woodTexture() {
  const tex = canvasTex(512, (g, s) => {
    g.fillStyle = PAL.wood; g.fillRect(0, 0, s, s);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) {
      const y = rnd() * s;
      g.strokeStyle = rnd() > 0.5 ? `rgba(120,70,30,${0.05 + rnd() * 0.12})` : `rgba(255,220,170,${0.04 + rnd() * 0.1})`;
      g.lineWidth = 1 + rnd() * 5;
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + rnd() * 14 - 7, s * 0.7, y + rnd() * 14 - 7, s, y + rnd() * 10 - 5);
      g.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function glowTexture() {
  return canvasTex(128, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
  });
}

// Local direction of each face value on the canonical dice mesh (top 1, front 2, right 3).
const LOCAL = { 1: [0, 1, 0], 6: [0, -1, 0], 3: [1, 0, 0], 4: [-1, 0, 0], 2: [0, 0, 1], 5: [0, 0, -1] };
const _m = new THREE.Matrix4();
function quatFor(o, out) {
  const lr = LOCAL[o[2]], lt = LOCAL[o[0]], lf = LOCAL[o[1]];
  _m.set(lr[0], lr[1], lr[2], 0, lt[0], lt[1], lt[2], 0, lf[0], lf[1], lf[2], 0, 0, 0, 0, 1);
  return out.setFromRotationMatrix(_m);
}
const ROLL_AXIS = {
  R: { axis: new THREE.Vector3(0, 0, 1), sign: -1 },
  L: { axis: new THREE.Vector3(0, 0, 1), sign: 1 },
  D: { axis: new THREE.Vector3(1, 0, 0), sign: 1 },
  U: { axis: new THREE.Vector3(1, 0, 0), sign: -1 },
};

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.tweens = new Tweens();
    this.insets = { top: 190, bottom: 120 };
    this.running = false;
    this.time = 0;
    this.level = null;

    const mobile = matchMedia('(pointer: coarse)').matches;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 0.92;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = (this.scene = new THREE.Scene());
    const pmrem = new THREE.PMREMGenerator(r);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.5, 200);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a7455, 0.6));
    const sun = (this.sun = new THREE.DirectionalLight(0xfff0d8, 1.9));
    sun.position.set(-4.5, 10, 5.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0xa8dcff, 0.7);
    rim.position.set(4, 5, -7);
    scene.add(rim);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.ShadowMaterial({ opacity: 0.32 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.62; ground.receiveShadow = true;
    scene.add(ground);

    this.woodTex = woodTexture();
    this.glowTex = glowTexture();
    this.tileTex = { end: tileTexture('end'), start: tileTexture('start') };
    for (let n = 1; n <= 6; n++) {
      this.tileTex['p' + n] = tileTexture('point', n); this.tileTex['s' + n] = tileTexture('solved', n);
      this.tileTex['g' + n] = mechTexture('gate', n);
    }
    for (const k of ['stop', 'arrow', 'portalT', 'portalU', 'crumble']) this.tileTex[k] = mechTexture(k);

    this.boardGroup = new THREE.Group();
    scene.add(this.boardGroup);
    this._buildDice();
    this._buildParticles();
    this._buildHint();

    this._loop = this._loop.bind(this);
    this.resize();
  }

  // ---------- construction ----------
  /** Dice skin: { body, pip, metal?, sparkle? } (meta.js SKINS). */
  setSkin(skin) {
    if (this.skinId === skin.id) return;
    this.skinId = skin.id;
    const order = [3, 4, 1, 6, 2, 5]; // +x -x +y -y +z -z
    const old = this.diceMesh.material;
    this.diceMesh.material = order.map((n) => new THREE.MeshPhysicalMaterial({
      map: diceFaceTexture(n, skin), roughness: skin.metal ? 0.3 : 0.22, metalness: skin.metal || 0, clearcoat: 1, clearcoatRoughness: 0.12,
    }));
    for (const m of old) { m.map?.dispose(); m.dispose(); }
  }

  /** PNG data URL of a tile's art, for UI cards. */
  tileImage(key) { return this.tileTex[key]?.image.toDataURL() || ''; }

  _buildDice() {
    const order = [3, 4, 1, 6, 2, 5]; // +x -x +y -y +z -z
    const mats = order.map((n) => new THREE.MeshPhysicalMaterial({
      map: diceFaceTexture(n), roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12,
    }));
    this.skinId = 'ivory';
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(DICE_SIZE, DICE_SIZE, DICE_SIZE, 5, 0.11), mats);
    mesh.castShadow = true;
    this.diceMesh = mesh;
    this.dice = new THREE.Group();
    this.dice.add(mesh);
    this.scene.add(this.dice);
    this.diceO = [1, 2, 3];
  }

  _buildParticles() {
    this.particles = [];
    const geo = new THREE.IcosahedronGeometry(0.06, 1);
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
      m.visible = false;
      this.scene.add(m);
      this.particles.push({ mesh: m, busy: false });
    }
  }

  _buildHint() {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.26); shape.lineTo(0.22, 0); shape.lineTo(0.09, 0); shape.lineTo(0.09, -0.22);
    shape.lineTo(-0.09, -0.22); shape.lineTo(-0.09, 0); shape.lineTo(-0.22, 0); shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: 0xff4d57, transparent: true, opacity: 0.95, depthTest: false }));
    mesh.rotation.x = -Math.PI / 2;
    const holder = new THREE.Group();
    holder.add(mesh); holder.visible = false; holder.renderOrder = 5;
    this.hint = holder; this.hintDir = null;
    this.scene.add(holder);
  }

  cellPos(x, y, out = new THREE.Vector3()) {
    return out.set(x - (this.level.w - 1) / 2, 0, y - (this.level.h - 1) / 2);
  }

  loadLevel(level) {
    this.tweens.clear();
    this.level = level;
    const g = this.boardGroup;
    while (g.children.length) {
      const c = g.children.pop();
      c.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
    }
    const { w, h } = level;
    const std = (opts) => new THREE.MeshStandardMaterial(opts);
    const add = (mesh, cast = false, receive = true) => { mesh.castShadow = cast; mesh.receiveShadow = receive; g.add(mesh); return mesh; };

    const wp = WORLD_PAL[level.def.world ?? 1] || WORLD_PAL[1];

    // Board: wooden slab with a felt mat.
    this.woodTex.repeat.set(Math.max(1, w / 4), 1);
    const base = add(new THREE.Mesh(new RoundedBoxGeometry(w + 1.3, 0.56, h + 1.3, 4, 0.16), std({ map: this.woodTex, color: new THREE.Color(wp.wood).lerp(new THREE.Color('#ffffff'), 0.45), roughness: 0.55 })), true);
    base.position.y = -0.33;
    const felt = add(new THREE.Mesh(new RoundedBoxGeometry(w + 0.5, 0.08, h + 0.5, 3, 0.04), std({ color: wp.felt, roughness: 0.95 })));
    felt.position.y = -0.04;

    // Roads (merged), with a darker carved edge underneath.
    const roadGeos = [], edgeGeos = [], dotGeos = [];
    const isRoadLike = (x, y) => x >= 0 && y >= 0 && x < w && y < h && level.cells[y * w + x] !== CELL.EMPTY;
    const box = (list, sx, sy, sz, px, py, pz) => { const b = new THREE.BoxGeometry(sx, sy, sz); b.translate(px, py, pz); list.push(b); };
    const p = new THREE.Vector3();
    const conn = (1 - ROAD_W) / 2;
    this.tiles = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = level.cells[y * w + x];
      if (c === CELL.EMPTY) continue;
      this.cellPos(x, y, p);
      if (c !== CELL.CRUMBLE) {
        box(roadGeos, ROAD_W, ROAD_Y, ROAD_W, p.x, ROAD_Y / 2, p.z);
        box(edgeGeos, ROAD_W + 0.12, ROAD_Y * 0.55, ROAD_W + 0.12, p.x, ROAD_Y * 0.275, p.z);
      }
      for (const d of [DIRS.R, DIRS.D]) {
        if (!isRoadLike(x + d.dx, y + d.dy)) continue;
        const len = conn * 2 + 0.002;
        const cx = p.x + d.dx * 0.5, cz = p.z + d.dy * 0.5;
        box(roadGeos, d.dx ? len : ROAD_W, ROAD_Y, d.dx ? ROAD_W : len, cx, ROAD_Y / 2, cz);
        box(edgeGeos, d.dx ? len : ROAD_W + 0.12, ROAD_Y * 0.55, d.dx ? ROAD_W + 0.12 : len, cx, ROAD_Y * 0.275, cz);
      }
      if (c === CELL.ROAD) {
        const dot = new THREE.CylinderGeometry(0.075, 0.075, 0.012, 16);
        dot.translate(p.x, ROAD_Y + 0.006, p.z); dotGeos.push(dot);
      } else if (c === CELL.OBSTACLE) {
        const rot = ((x * 7 + y * 13) % 5 - 2) * 0.09;
        const rock = add(new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.56, 0.7, 3, 0.1), std({ color: wp.stone, roughness: 0.8 })), true);
        rock.position.set(p.x, ROAD_Y + 0.28, p.z); rock.rotation.y = rot;
        const cap = add(new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.16, 0.44, 2, 0.06), std({ color: wp.stoneTop, roughness: 0.7 })), true);
        cap.position.set(p.x, ROAD_Y + 0.62, p.z); cap.rotation.y = rot + 0.5;
      }
    }
    add(new THREE.Mesh(mergeGeometries(edgeGeos), std({ color: wp.roadEdge, roughness: 0.7 })));
    add(new THREE.Mesh(mergeGeometries(roadGeos), std({ color: wp.road, roughness: 0.6 })), false);
    if (dotGeos.length) add(new THREE.Mesh(mergeGeometries(dotGeos), std({ color: wp.dot, roughness: 0.6 })));

    // Decal tiles: start, end, points.
    const decal = (tex, x, y, size = 0.84) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), std({ map: tex, transparent: true, roughness: 0.45, emissive: 0x000000, emissiveMap: tex }));
      m.rotation.x = -Math.PI / 2;
      this.cellPos(x, y, m.position); m.position.y = ROAD_Y + 0.006;
      m.receiveShadow = true; g.add(m);
      return m;
    };
    const glow = (x, y, color, size = 1.7) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: this.glowTex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      this.cellPos(x, y, m.position); m.position.y = ROAD_Y + 0.02;
      g.add(m);
      return m;
    };
    decal(this.tileTex.start, level.start.x, level.start.y, 0.6);
    this.endTile = decal(this.tileTex.end, level.end.x, level.end.y);
    this.endGlow = glow(level.end.x, level.end.y, 0xffc62e, 1.5);
    this.endReady = false;
    // Flag at the corner of the end tile.
    const fp = this.cellPos(level.end.x, level.end.y);
    const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 8), std({ color: 0xf4efe6, roughness: 0.4 })), true);
    pole.position.set(fp.x - 0.4, ROAD_Y + 0.475, fp.z - 0.4);
    const flagShape = new THREE.Shape(); flagShape.moveTo(0, 0); flagShape.lineTo(0.42, 0.14); flagShape.lineTo(0, 0.28); flagShape.closePath();
    const flag = add(new THREE.Mesh(new THREE.ShapeGeometry(flagShape), std({ color: 0xffc93c, roughness: 0.5, side: THREE.DoubleSide })), true);
    flag.position.set(fp.x - 0.4, ROAD_Y + 0.66, fp.z - 0.4);
    this.flag = flag;

    this.pointTiles = level.points.map((pt) => ({
      tile: decal(this.tileTex['p' + pt.n], pt.x, pt.y),
      glow: glow(pt.x, pt.y, PAL.glow),
      solved: false, n: pt.n, x: pt.x, y: pt.y,
    }));

    // Mechanic tiles.
    this.portalTiles = []; this.crumbleTiles = []; this.arrowTiles = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, c = level.cells[i];
      if (c === CELL.STOP) decal(this.tileTex.stop, x, y, 0.8);
      else if (c === CELL.ARROW) {
        const m = decal(this.tileTex.arrow, x, y, 0.8);
        m.rotation.z = ARROW_ROT[DIR_KEYS[level.arrowAt[i]]];
        this.arrowTiles.push(m);
      } else if (c === CELL.PORTAL) {
        const key = level.def.grid[y][x] === 'T' ? 'portalT' : 'portalU';
        const m = decal(this.tileTex[key], x, y, 0.86);
        m.material.emissive.set(key === 'portalT' ? 0x6a2fd1 : 0xe4602a); m.material.emissiveIntensity = 0.5;
        this.portalTiles.push({ mesh: m, glow: glow(x, y, key === 'portalT' ? 0xc58bff : 0xffb36b, 1.3) });
      } else if (c === CELL.GATE) decal(this.tileTex['g' + level.gateAt[i]], x, y, 0.84);
      else if (c === CELL.CRUMBLE) {
        const slab = new THREE.Group();
        const body = new THREE.Mesh(new RoundedBoxGeometry(ROAD_W + 0.08, 0.1, ROAD_W + 0.08, 2, 0.03), std({ color: 0xd9ad74, roughness: 0.8, transparent: true }));
        body.castShadow = true; body.receiveShadow = true; body.position.y = 0.05;
        const top = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W + 0.06, ROAD_W + 0.06), std({ map: this.tileTex.crumble, transparent: true, roughness: 0.8 }));
        top.rotation.x = -Math.PI / 2; top.position.y = 0.101;
        slab.add(body, top);
        this.cellPos(x, y, slab.position); slab.position.y = ROAD_Y - 0.1 + 0.01;
        g.add(slab);
        this.crumbleTiles[level.crumbleAt[i]] = { group: slab, mats: [body.material, top.material], y0: slab.position.y, gone: false };
      }
    }

    // Shadow frustum + camera.
    const span = Math.max(w, h) / 2 + 2.2;
    const sc = this.sun.shadow.camera;
    sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 40;
    sc.updateProjectionMatrix();

    this.setDice(level.start.x, level.start.y, level.dice);
    this.dice.scale.set(1, 1, 1);
    this.showHint(null);
    this.fitCamera();
  }

  setDice(x, y, o) {
    this.diceO = o.slice();
    this.cellPos(x, y, this.dice.position);
    this.dice.position.y = DICE_BASE + DICE_HALF;
    quatFor(o, this.diceMesh.quaternion);
    this.diceCell = { x, y };
  }

  // ---------- camera ----------
  setInsets(top, bottom) { this.insets = { top, bottom }; if (this.level) this.fitCamera(); }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.width = w; this.height = h;
    this.renderer.setSize(w, h, false);
    if (this.level) this.fitCamera();
  }

  fitCamera() {
    const cam = this.camera, W = this.width, H = this.height, lv = this.level;
    cam.aspect = W / H;
    cam.clearViewOffset();
    const az = THREE.MathUtils.degToRad(9), el = THREE.MathUtils.degToRad(56);
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const hw = lv.w / 2 + 0.75, hh = lv.h / 2 + 0.75;
    const corners = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [-0.5, 1.0]) corners.push(new THREE.Vector3(sx * hw, y, sz * hh));
    const top = Math.min(this.insets.top, H * 0.4), bottom = Math.min(this.insets.bottom, H * 0.3);
    const availY = ((H - top - bottom) / H) * 0.97;
    const v = new THREE.Vector3();
    let range = null;
    const measure = (dist) => {
      cam.position.copy(dir).multiplyScalar(dist);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      let minX = 9, maxX = -9, minY = 9, maxY = -9;
      for (const c of corners) {
        v.copy(c).project(cam);
        minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x); minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      }
      range = { minX, maxX, minY, maxY };
      return Math.max(Math.abs(minX), Math.abs(maxX)) <= 0.96 && (maxY - minY) / 2 <= availY;
    };
    let lo = 3, hi = 120;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (measure(mid)) hi = mid; else lo = mid; }
    measure(hi);
    // Centre the board inside the area left free by the HUD.
    const windowCentre = (bottom - top) / H;
    const delta = windowCentre - (range.maxY + range.minY) / 2;
    cam.setViewOffset(W, H, 0, (delta * H) / 2, W, H);
    cam.updateProjectionMatrix();
  }

  // ---------- animations ----------
  /** Roll through the given steps. onStep(step, index) fires as each cell is reached. */
  async rollSteps(steps, dir, onStep) {
    const q0 = new THREE.Quaternion(), qr = new THREE.Quaternion();
    const from = new THREE.Vector3(), to = new THREE.Vector3();
    const dur = steps.length === 1 ? 0.17 : Math.max(0.085, 0.13 - steps.length * 0.006);
    for (let i = 0; i < steps.length; i++) {
      const st = steps[i];
      if (st.crumble !== undefined) this.collapse(st.crumble);
      if (st.teleport) {
        // Shrink into the portal, reappear at its twin.
        await this.tweens.add(0.14, (t) => this.dice.scale.setScalar(1 - t * 0.95), ease.inOut);
        this.setDice(st.x, st.y, st.o);
        await this.tweens.add(0.16, (t) => this.dice.scale.setScalar(0.05 + t * 0.95), ease.backOut);
        this.dice.scale.setScalar(1);
        if (onStep) onStep(st, i);
        continue;
      }
      const { axis, sign } = ROLL_AXIS[st.dir || dir];
      from.copy(this.dice.position); from.y = DICE_BASE + DICE_HALF;
      this.cellPos(st.x, st.y, to); to.y = from.y;
      q0.copy(this.diceMesh.quaternion);
      const easing = steps.length === 1 ? ease.inOut : i === 0 ? ((t) => t * (0.6 + 0.4 * t)) : ease.linear;
      await this.tweens.add(dur, (t) => {
        const a = t * Math.PI / 2;
        qr.setFromAxisAngle(axis, sign * a);
        this.diceMesh.quaternion.copy(qr).multiply(q0);
        this.dice.position.lerpVectors(from, to, t);
        this.dice.position.y = DICE_BASE + DICE_HALF * (Math.sin(a) + Math.cos(a));
      }, easing);
      this.setDice(st.x, st.y, st.o);
      if (onStep) onStep(st, i);
    }
  }

  /** A crumble tile falls away. */
  collapse(index) {
    const ct = this.crumbleTiles[index];
    if (!ct || ct.gone) return;
    ct.gone = true;
    const p = ct.group.position;
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      this._emit(p.x + Math.cos(a) * 0.25, ROAD_Y, p.z + Math.sin(a) * 0.25, Math.cos(a) * 0.4, -0.4, Math.sin(a) * 0.4, 0xd9ad74, 0.6, 1.4);
    }
    this.tweens.add(0.55, (t) => {
      if (!ct.gone) return;
      ct.group.position.y = ct.y0 - t * t * 1.4;
      ct.group.rotation.z = t * 0.5; ct.group.rotation.x = t * 0.3;
      for (const m of ct.mats) m.opacity = 1 - t;
    }, ease.linear).then(() => { if (ct.gone) ct.group.visible = false; });
  }

  /** Snap the board to a state (used by undo). */
  syncState(state) {
    this.tweens.clear();
    this.dice.scale.set(1, 1, 1);
    this.setDice(state.x, state.y, state.o);
    this.pointTiles.forEach((pt, i) => {
      const solved = !!(state.mask & (1 << i));
      pt.solved = solved;
      pt.tile.material.map = pt.tile.material.emissiveMap = this.tileTex[(solved ? 's' : 'p') + pt.n];
      pt.tile.material.emissive.set(solved ? 0x3ad49a : 0x000000);
      pt.tile.material.color.set(0xffffff);
      pt.tile.material.needsUpdate = true;
      pt.tile.scale.setScalar(1);
      pt.glow.material.opacity = solved ? 0.28 : 0;
      pt.glow.scale.setScalar(1);
    });
    this.crumbleTiles.forEach((ct, i) => {
      if (!ct) return;
      ct.gone = !!((state.gone || 0) & (1 << i));
      ct.group.visible = !ct.gone;
      ct.group.position.y = ct.y0; ct.group.rotation.set(0, 0, 0);
      for (const m of ct.mats) m.opacity = 1;
    });
    for (const p of this.particles) { p.mesh.visible = false; p.busy = false; }
  }

  /** Screen position (CSS px) of a board cell, for UI overlays. */
  screenPos(x, y) {
    const v = this.cellPos(x, y); v.y = DICE_BASE + DICE_HALF;
    v.project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height };
  }

  /** Dust + squash when the dice comes to rest. */
  land() {
    const p = this.dice.position;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random();
      this._emit(p.x + Math.cos(a) * 0.3, DICE_BASE + 0.05, p.z + Math.sin(a) * 0.3, Math.cos(a) * 0.9, 0.5, Math.sin(a) * 0.9, 0xf3e3c3, 0.42, 1.6);
    }
    return this.tweens.add(0.22, (t) => {
      const s = 1 - Math.sin(t * Math.PI) * 0.1;
      this.dice.scale.set(1 + (1 - s) * 0.6, s, 1 + (1 - s) * 0.6);
      this.dice.position.y = DICE_BASE + DICE_HALF * s;
    });
  }

  /** Small nudge for a blocked input. */
  bump(dir) {
    const { dx, dy } = DIRS[dir];
    const base = this.cellPos(this.diceCell.x, this.diceCell.y);
    const { axis, sign } = ROLL_AXIS[dir];
    const q0 = quatFor(this.diceO, new THREE.Quaternion()), qr = new THREE.Quaternion();
    return this.tweens.add(0.2, (t) => {
      const k = Math.sin(t * Math.PI);
      this.dice.position.x = base.x + dx * 0.1 * k;
      this.dice.position.z = base.z + dy * 0.1 * k;
      qr.setFromAxisAngle(axis, sign * 0.16 * k);
      this.diceMesh.quaternion.copy(qr).multiply(q0);
    });
  }

  shakeDice() {
    const base = this.cellPos(this.diceCell.x, this.diceCell.y);
    return this.tweens.add(0.36, (t) => {
      this.dice.position.x = base.x + Math.sin(t * Math.PI * 6) * 0.06 * (1 - t);
    });
  }

  pointSolved(index) {
    const pt = this.pointTiles[index];
    pt.solved = true;
    pt.tile.material.map = pt.tile.material.emissiveMap = this.tileTex['s' + pt.n];
    pt.tile.material.emissive.set(0x3ad49a);
    pt.tile.material.needsUpdate = true;
    const p = this.cellPos(pt.x, pt.y);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this._emit(p.x + Math.cos(a) * 0.35, ROAD_Y + 0.1, p.z + Math.sin(a) * 0.35, Math.cos(a) * 1.3, 2.2 + Math.random(), Math.sin(a) * 1.3, 0xbfffe0, 0.7, 1.2);
    }
    this.tweens.add(0.5, (t) => {
      pt.glow.material.opacity = 0.7 * (1 - t) + 0.28;
      pt.glow.scale.setScalar(1 + (1 - t) * 0.9);
      pt.tile.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.18);
    }, ease.out);
  }

  pointMismatch(index) {
    const pt = this.pointTiles[index];
    const c = pt.tile.material.color;
    this.shakeDice();
    return this.tweens.add(0.45, (t) => {
      const k = Math.abs(Math.sin(t * Math.PI * 2)) * (1 - t);
      c.setRGB(1, 1 - k * 0.75, 1 - k * 0.75);
      pt.tile.material.emissive.setRGB(k * 0.9, 0, 0);
      pt.tile.position.x = this.cellPos(pt.x, pt.y).x + Math.sin(t * Math.PI * 8) * 0.04 * (1 - t);
    });
  }

  endNotReady() {
    const x0 = this.cellPos(this.level.end.x, this.level.end.y).x;
    this.shakeDice();
    return this.tweens.add(0.4, (t) => { this.endTile.position.x = x0 + Math.sin(t * Math.PI * 8) * 0.04 * (1 - t); });
  }

  setEndReady(ready) { this.endReady = ready; if (!ready) this.endGlow.material.opacity = 0; }

  celebrate() {
    const p = this.dice.position;
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.8 + Math.random() * 1.6;
      this._emit(p.x, DICE_BASE + 0.4, p.z, Math.cos(a) * s, 2.5 + Math.random() * 2, Math.sin(a) * s, [0xffc93c, 0xff5a5f, 0x9dffd0, 0xffffff][i % 4], 0.9, 1.3);
    }
    return this.tweens.add(0.7, (t) => {
      this.dice.position.y = DICE_BASE + DICE_HALF + Math.sin(t * Math.PI) * 0.7;
      this.diceMesh.rotation.y += 0.25 * (1 - t);
    }, ease.linear).then(() => quatFor(this.diceO, this.diceMesh.quaternion));
  }

  showHint(dir) {
    this.hintDir = dir;
    this.hint.visible = !!dir;
    if (dir) this.hint.rotation.y = { U: 0, L: Math.PI / 2, D: Math.PI, R: -Math.PI / 2 }[dir];
  }

  _emit(x, y, z, vx, vy, vz, color, life, scale) {
    const p = this.particles.find((q) => !q.busy);
    if (!p) return;
    p.busy = true;
    const m = p.mesh;
    m.material.color.set(color); m.visible = true;
    const x0 = x, y0 = y, z0 = z;
    this.tweens.add(life, (t) => {
      m.position.set(x0 + vx * t * life, y0 + vy * t * life - 4 * t * t * life * life, z0 + vz * t * life);
      m.scale.setScalar(scale * (0.6 + t * 0.8));
      m.material.opacity = 0.85 * (1 - t);
    }, ease.out).then(() => { m.visible = false; p.busy = false; });
  }

  // ---------- loop ----------
  start() { if (this.running) return; this.running = true; this.last = performance.now(); requestAnimationFrame(this._loop); }
  stop() { this.running = false; }

  _loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now; this.time += dt;
    this.tweens.update(dt);
    const t = this.time;
    if (this.level) {
      if (this.endReady) {
        this.endGlow.material.opacity = 0.3 + Math.sin(t * 4) * 0.14;
        this.endGlow.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
      }
      this.flag.rotation.y = Math.sin(t * 2.2) * 0.35;
      for (const pt of this.pointTiles) if (pt.solved) pt.tile.material.emissiveIntensity = 0.45 + Math.sin(t * 3 + pt.x) * 0.15;
      for (const pp of this.portalTiles) {
        pp.mesh.rotation.z = t * 1.6;
        pp.glow.material.opacity = 0.35 + Math.sin(t * 3) * 0.12;
      }
      if (this.hintDir) {
        const { dx, dy } = DIRS[this.hintDir];
        const base = this.cellPos(this.diceCell.x, this.diceCell.y);
        const k = 0.78 + (Math.sin(t * 5) * 0.5 + 0.5) * 0.22;
        this.hint.position.set(base.x + dx * k, ROAD_Y + 0.08, base.z + dy * k);
      }
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
}
