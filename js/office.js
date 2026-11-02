// Office view: one small office per TEAM + a shared meeting room, built from DofLab scene-library pieces.
// Agents are people at their own team's desks and act out their latest record.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Teams that get their own office, in floor order. Any other TEAM sits in the shared hot-desk room.
const CFG = window.AGENT_OFFICE_CONFIG || {};
const OFFICE_TEAMS = (CFG.officeTeams || ['DofLab', 'DofGM', 'NCUT_PJ']).map(t => String(t).replace(/^team\s+/i, '').trim().toLowerCase());

const box = document.getElementById('office'), info = document.getElementById('oInfo'), legend = document.getElementById('oLegend');
// Scenes come straight from the indoor-scenes repo (config.sceneBase), so updates there show up here.
const SCENE_BASE = (CFG.sceneBase || './').replace(/\/?$/, '/');
const LIB_OFFICE = SCENE_BASE + 'scenes/001_open_office/', LIB_MEET = SCENE_BASE + 'scenes/002_meeting_room/', LIB_PANTRY = SCENE_BASE + 'scenes/004_pantry/';
const USE_ZH = { coffee: '泡咖啡', microwave: '微波便當', fridge: '開冰箱', vending: '買飲料', sink: '洗杯子', water: '倒水' };
// Devices people (and the viewer) can operate. fx = glow colour; steam = little puffs while running; done = bubble when finished.
const DEV = {
  coffee:    { name: '咖啡機', act: '沖一杯咖啡', run: '沖煮中', fx: 0xfff1c9, steam: true, done: '咖啡好了 ☕' },
  microwave: { name: '微波爐', act: '加熱便當',   run: '加熱中', fx: 0xffb347, done: '叮！' },
  fridge:    { name: '冰箱',   act: '打開冰箱',   run: '門開著', fx: 0x9fd8ff, done: '關門' },
  vending:   { name: '販賣機', act: '買一瓶飲料', run: '出貨中', fx: 0xb9f0c4, done: '咚！' },
  sink:      { name: '水槽',   act: '開水龍頭',   run: '流水中', fx: 0x9fd8ff, done: '洗好了' },
  water:     { name: '飲水機', act: '倒一杯熱水', run: '出水中', fx: 0xbfe6ff, steam: true, done: '水好了' }
};
const RUN_SEC = 8;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const B2T = p => new THREE.Vector3(p[0], p[2] || 0, -p[1]);   // scene coords (x east, y north) -> three
const MIN = 60e3, HOUR = 3600e3, CELL = .25;
const STATES = {
  work:    { label: '工作中', tok: '--s-work' },
  meet:    { label: '開會',   tok: '--s-meet' },
  present: { label: '報告',   tok: '--s-present' },
  patrol:  { label: '巡檢',   tok: '--s-patrol' },
  rest:    { label: '休息',   tok: '--s-break' },
  idle:    { label: '閒置',   tok: '--s-idle' }
};
const ORDER = ['work', 'meet', 'present', 'patrol', 'rest', 'idle'];
let showNames = true;
try { showNames = localStorage.getItem('cloudlog.names') !== '0'; } catch {}
const teamKey = t => (t || '').replace(/^team\s+/i, '').trim().toLowerCase() || '—';

function classify(g) {
  if (g.meetMsg) return 'meet';
  const age = Date.now() - g.latest.ts, txt = g.latest.topic + ' ' + (g.latest.content || '');
  if (age > 6 * HOUR) return 'idle';
  if (age > 45 * MIN) return 'rest';
  if (/會議|討論|開會|規劃|評估|審查|訪談|review|meeting/i.test(txt)) return 'meet';
  if (/巡檢|檢查|測試|驗證|監看|test|check/i.test(txt)) return 'patrol';
  if (/簡報|報告|週報|論文|投稿|教材|講義|slides|manuscript/i.test(txt)) return 'present';
  return 'work';
}

// ---------- three setup ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
box.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = 1.32; controls.minDistance = 3; controls.maxDistance = 90;
let userMoved = false; controls.addEventListener('start', () => { userMoved = true; });
scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.15));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-10, 20, 12); scene.add(sun);
const setBg = () => { scene.background = new THREE.Color(css('--office-bg') || '#d6e0e7'); };
setBg();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { setBg(); relabelAll(); });
new MutationObserver(() => { setBg(); relabelAll(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

const loader = new GLTFLoader();
async function loadGlb(url) {   // binary .glb from the scene repo
  const r = await fetch(url); if (!r.ok) throw new Error(url.replace(SCENE_BASE, '') + ' HTTP ' + r.status);
  return loader.parseAsync(await r.arrayBuffer(), '');
}

// ---------- floor state ----------
let lib = null, meetMeta = null, pantryMeta = null;   // loaded assets
let lastMeetings = [], projSig = '';
let floor = null;                                   // current built floor
let layoutSig = '', fittedSig = '', lastPortrait = null;
const nav = { walk: new Set(), free: (x, z) => nav.walk.has(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) };

function resize() {
  const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (floor && (!userMoved || (w / h < 1) !== lastPortrait)) fit();
}
new ResizeObserver(resize).observe(box);

function fit() {
  const { W, D } = floor, t = new THREE.Vector3(W / 2, 0.3, -D / 2);
  const portrait = camera.aspect < 1; lastPortrait = portrait;
  const dir = portrait ? new THREE.Vector3(0.62, 1.3, 0).normalize() : new THREE.Vector3(-0.06, 1.25, 0.78).normalize();
  const across = portrait ? D : W, along = portrait ? W : D;
  const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const dist = Math.max((across / 2 + (portrait ? 2.6 : 1.2)) / Math.tan(hf / 2), (along / 2 + 1.2) * 1.0 / Math.tan(vf / 2)) * (portrait ? 1.08 : 1);
  controls.target.copy(t); camera.position.copy(t).addScaledVector(dir, dist); controls.update(); userMoved = false;
}

// ---------- nav helpers (scene coords in, cells in three x/z) ----------
function navRect(x0, y0, x1, y1, on = true) {
  const i0 = Math.floor(x0 / CELL), i1 = Math.ceil(x1 / CELL), j0 = Math.floor(-y1 / CELL), j1 = Math.ceil(-y0 / CELL);
  for (let i = i0; i < i1; i++) for (let j = j0; j < j1; j++) {
    const cx = (i + .5) * CELL, cz = (j + .5) * CELL;
    if (cx < x0 || cx > x1 || -cz < y0 || -cz > y1) continue;
    const k = i + ',' + j; on ? nav.walk.add(k) : nav.walk.delete(k);
  }
}
function navFromMesh(obj) {
  obj.updateMatrixWorld(true);
  obj.traverse(o => { if (!o.isMesh) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index, v = new THREE.Vector3();
    const tri = (a, b, c) => { const A = [a, b, c].map(i => v.fromBufferAttribute(pos, i).clone().applyMatrix4(o.matrixWorld));
      nav.walk.add(Math.floor((A[0].x + A[1].x + A[2].x) / 3 / CELL) + ',' + Math.floor((A[0].z + A[1].z + A[2].z) / 3 / CELL)); };
    if (idx) for (let i = 0; i < idx.count; i += 3) tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
    else for (let i = 0; i < pos.count; i += 3) tri(i, i + 1, i + 2);
  });
}
function snap(x, z) { if (nav.free(x, z)) return [x, z]; let b = [x, z], bd = 1e9;
  for (const k of nav.walk) { const [i, j] = k.split(',').map(Number), cx = (i + .5) * CELL, cz = (j + .5) * CELL, d = (cx - x) ** 2 + (cz - z) ** 2; if (d < bd) { bd = d; b = [cx, cz]; } } return b; }
function astar(sx, sz, gx, gz) {
  const c = CELL, ci = v => Math.floor(v / c), [s0, s1] = snap(sx, sz), [g0, g1] = snap(gx, gz);
  const si = ci(s0), sj = ci(s1), gi = ci(g0), gj = ci(g1), k = (i, j) => i + ',' + j, open = new Map(), came = new Map(), G = new Map(), h = (i, j) => Math.hypot(i - gi, j - gj);
  G.set(k(si, sj), 0); open.set(k(si, sj), h(si, sj));
  const N = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let guard = 0;
  while (open.size && guard++ < 40000) { let bk = null, bf = 1e9; for (const [kk, f] of open) if (f < bf) { bf = f; bk = kk; }
    open.delete(bk); const [i, j] = bk.split(',').map(Number); if (i === gi && j === gj) break;
    for (const [di, dj] of N) { const ni = i + di, nj = j + dj, nk = k(ni, nj); if (!nav.walk.has(nk)) continue;
      if (di && dj && (!nav.walk.has(k(i + di, j)) || !nav.walk.has(k(i, j + dj)))) continue;
      const g = G.get(bk) + Math.hypot(di, dj); if (g < (G.get(nk) ?? 1e9)) { G.set(nk, g); came.set(nk, bk); open.set(nk, g + h(ni, nj)); } } }
  const gk = k(gi, gj); if (!came.has(gk) && gk !== k(si, sj)) return [[sx, sz], [gx, gz]];
  const cells = []; let cu = gk; while (cu) { cells.push(cu); cu = came.get(cu); } cells.reverse();
  const pts = cells.map(q => { const [i, j] = q.split(',').map(Number); return [(i + .5) * c, (j + .5) * c]; }); pts[0] = [s0, s1]; pts[pts.length - 1] = [g0, g1];
  const los = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (c * .4)); for (let t = 1; t < n; t++) { if (!nav.free(a[0] + (b[0] - a[0]) * t / n, a[1] + (b[1] - a[1]) * t / n)) return false; } return true; };
  const out = [pts[0]]; let a = 0; while (a < pts.length - 1) { let b = pts.length - 1; while (b > a + 1 && !los(pts[a], pts[b])) b--; out.push(pts[b]); a = b; }
  out.push([gx, gz]);
  return out;
}

// ---------- building blocks ----------
const WALL_H = 1.0, WALL_T = .12;
const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: .9 });
function prefab(names, cx, cz) {   // clone library objects into a group relative to (cx, cz) in three coords
  const g = new THREE.Group();
  for (const n of names) { const o = lib.getObjectByName(n); if (!o) continue; const c = o.clone(true); c.position.x -= cx; c.position.z -= cz; g.add(c); }
  return g;
}
function wall(group, x0, y0, x1, y1) {   // axis-aligned wall segment in scene coords
  const len = Math.hypot(x1 - x0, y1 - y0); if (len < .05) return;
  const m = new THREE.Mesh(new THREE.BoxGeometry(x0 === x1 ? WALL_T : len, WALL_H, x0 === x1 ? len : WALL_T), wallMat);
  m.position.set((x0 + x1) / 2, WALL_H / 2, -(y0 + y1) / 2); group.add(m);
}
function floorPlane(group, x0, y0, x1, y1, color, opacity = 1, lift = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshStandardMaterial({ color, roughness: .95, transparent: opacity < 1, opacity }));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, .005 + lift, -(y0 + y1) / 2); group.add(m); return m;
}
function textPlane(text, color, w, h) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const x = cv.getContext('2d');
  x.font = '800 150px "Noto Sans TC","PingFang TC",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = color; x.fillText(text, 512, 132);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: .55, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; return m;
}

// A team office: `pods` desk pods (4 seats each), whiteboard on the side wall, water + plant, door facing the corridor.
function buildOffice(room) {
  const { x0, y0, w, d, doorSide, pods, color, label } = room, g = new THREE.Group();
  floorPlane(g, x0, y0, x0 + w, y0 + d, color, .16, .002);
  const sign = textPlane(label, color, Math.min(w - 1, 6), 1.4);
  sign.position.set(x0 + w / 2, .02, -(doorSide === 'N' ? y0 + .95 : y0 + d - .95)); g.add(sign);
  const dx = x0 + w / 2, dy = doorSide === 'N' ? y0 + d : y0;
  wall(g, x0, y0, x0, y0 + d); wall(g, x0 + w, y0, x0 + w, y0 + d);
  if (doorSide === 'N') { wall(g, x0, y0, x0 + w, y0); wall(g, x0, y0 + d, dx - .6, y0 + d); wall(g, dx + .6, y0 + d, x0 + w, y0 + d); }
  else { wall(g, x0, y0 + d, x0 + w, y0 + d); wall(g, x0, y0, dx - .6, y0); wall(g, dx + .6, y0, x0 + w, y0); }
  navRect(x0 + .3, y0 + .3, x0 + w - .3, y0 + d - .3);
  navRect(dx - .45, dy - .6, dx + .45, dy + .6);                 // through the door
  const anchors = { seats: [], board: [], water: [], door: { position: [dx, doorSide === 'N' ? dy - .7 : dy + .7, 0], yaw_deg: 0 } };
  const podCY = y0 + d / 2 - (doorSide === 'N' ? .35 : -.35);
  for (let p = 0; p < pods; p++) {
    const pcx = x0 + 2.2 + p * 3.4 + 1.2, pg = prefab(['Rug', 'Divider_1', 'Desk_01', 'Desk_02', 'Desk_03', 'Desk_04', 'Chair_01', 'Chair_02', 'Chair_03', 'Chair_04',
      'Keyboard_01', 'Keyboard_02', 'Keyboard_03', 'Keyboard_04'], 5.5, -3.9);
    pg.position.set(pcx, 0, -podCY); g.add(pg);
    navRect(pcx - 1.65, podCY - .75, pcx + 1.65, podCY + .75, false);
    for (const [ox, oy, yaw] of [[-.75, -1.15, 0], [.75, -1.15, 0], [-.75, 1.15, 180], [.75, 1.15, 180]]) {
      const seat = { id: `${room.id}:seat${anchors.seats.length}`, type: 'SEAT', position: [pcx + ox, podCY + oy, 0], yaw_deg: yaw };
      anchors.seats.push(seat); addScreen(g, seat);
    }
  }
  // whiteboard on the west wall, standing spots in front of it
  const wb = prefab(['Whiteboard'], .2, -9); wb.position.set(x0 + .2, 0, -(y0 + d / 2)); g.add(wb);
  for (const oy of [-.45, .45]) anchors.board.push({ id: `${room.id}:board${anchors.board.length}`, type: 'STAND', position: [x0 + 1.1, y0 + d / 2 + oy, 0], yaw_deg: 90 });
  // water dispenser + plant in the east corners
  const wy = doorSide === 'N' ? y0 + .6 : y0 + d - .6;
  const wd = prefab(['WaterDispenser'], 15.5, -2.8); wd.position.set(x0 + w - .45, 0, -wy); g.add(wd);
  anchors.water.push({ id: `${room.id}:water`, type: 'POI', use: 'water', position: [x0 + w - 1.2, wy, 0], yaw_deg: -90 });
  const pl = prefab(['Plant'], .7, -.7); pl.position.set(x0 + w - .6, 0, -(doorSide === 'N' ? y0 + d - .6 : y0 + .6)); g.add(pl);
  room.anchors = anchors; room.group = g; scene.add(g);
  addDevice(room, anchors.water[0], g, null);
}

// Library rooms (002 meeting room, 004 pantry) with walls cut down so you can see in from above.
function buildLibRoom(room, src, navSrc, meta, signText) {
  const g = src.clone(true);
  g.traverse(o => {
    if (!o.isMesh) return;
    if (/^(Ceiling|LightPanel|Frames|Projector($|_|\.)|ProjectorScreen)/.test(o.name)) o.visible = false;
    if (/^Wall_/.test(o.name)) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; o.scale.y = WALL_H / Math.max(.1, bb.max.y - bb.min.y); }
  });
  g.position.set(room.x0, 0, -room.y0); scene.add(g); room.group = g;
  const nm = navSrc.clone(true); nm.position.set(room.x0, 0, -room.y0); navFromMesh(nm);
  const sign = textPlane(signText, css('--muted') || '#566676', 4, 1); sign.position.set(room.x0 + room.w / 2, .02, -(room.y0 + .9)); scene.add(sign); room.extra = [sign];
  const A = meta.anchors.map(a => ({ ...a, id: room.id + ':' + a.id, position: [a.position[0] + room.x0, a.position[1] + room.y0, 0] }));
  const south = meta.doors.filter(d => d.wall === 'S');
  for (const dr of south) { const x = dr.position[0] + room.x0, y = room.y0; navRect(x - .45, y - .7, x + .45, y + .7); }
  const d0 = south[0] || meta.doors[0];
  return { A, door: { id: room.id + ':door', type: 'STAND', position: [d0.position[0] + room.x0, room.y0 - .8, 0], yaw_deg: 0 } };
}
function buildMeeting(room) {
  const { A, door } = buildLibRoom(room, lib.meetScene, lib.meetNav, meetMeta, '會議室');
  room.anchors = { seats: A.filter(a => /SEAT_meeting/.test(a.id)), stands: A.filter(a => /STAND_/.test(a.id)), water: A.filter(a => /POI_water/.test(a.id)), door };
  for (const a of room.anchors.water) addDevice(room, { ...a, use: 'water' }, scene, room.extra);
  // projector screen on the north side showing the current meeting
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 576;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.03), new THREE.MeshBasicMaterial({ map: tex }));
  scr.position.set(room.x0 + 4, 1.55, -(room.y0 + 5.6)); scr.userData.projector = true;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.75, 2.18, .06), new THREE.MeshStandardMaterial({ color: 0x222a33 })); frame.position.set(0, 0, -.04); scr.add(frame);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(.08, .55, .08), new THREE.MeshStandardMaterial({ color: 0x222a33 })); leg.position.set(0, -1.28, -.05); scr.add(leg);
  scene.add(scr); room.extra.push(scr);
  floor.projector = { mesh: scr, cv, ctx: cv.getContext('2d'), tex, meetingId: null }; projSig = '';
}
function buildPantry(room) {
  const { A, door } = buildLibRoom(room, lib.pantryScene, lib.pantryNav, pantryMeta, '茶水間');
  room.anchors = { devices: A.filter(a => a.type === 'POI'), seats: A.filter(a => a.type === 'SEAT'), door };
  for (const a of room.anchors.devices) addDevice(room, a, scene, room.extra);
}
// A device: glow + steam effects, a small name tag and an invisible hit box, so it can be clicked and operated.
function addDevice(room, a, parent, extra) {
  const info = DEV[a.use]; if (!info) return;
  const yaw = (a.yaw_deg || 0) * Math.PI / 180, fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const c = B2T(a.position).addScaledVector(fwd, a.use === 'water' ? .7 : .55), tall = a.use === 'vending' || a.use === 'fridge';
  const add = o => { parent.add(o); if (extra) extra.push(o); return o; };
  const glow = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, color: info.fx })));
  glow.position.set(c.x, tall ? 1.2 : 1.05, c.z); glow.scale.set(.7, .7, 1); glow.visible = false;
  const steam = [];
  if (info.steam) for (let i = 0; i < 6; i++) { const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, color: 0xffffff })));
    sp.position.set(c.x, 1.1, c.z); sp.visible = false; steam.push(sp); }
  const hit = add(new THREE.Mesh(new THREE.BoxGeometry(.8, tall ? 2 : 1.3, .8), new THREE.MeshBasicMaterial()));
  hit.position.set(c.x, tall ? 1 : .65, c.z); hit.visible = false;
  const tag = add(makeTag(info.name)); tag.position.set(c.x, tall ? 2.25 : 1.6, c.z);
  const dev = { id: a.id, use: a.use, info, anchor: a, room, pos: c, glow, steam, hit, tag, runUntil: 0, bubble: null };
  hit.userData.device = tag.userData.device = dev;
  floor.devices.set(a.id, dev);
}
function makeTag(text) {   // small world-space pill above a device
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 72; const x = cv.getContext('2d');
  x.font = `700 34px ${F}`; const w = Math.min(248, x.measureText(text).width + 40), x0 = (256 - w) / 2;
  x.fillStyle = 'rgba(255,255,255,.92)'; x.strokeStyle = 'rgba(20,32,43,.35)'; x.lineWidth = 3;
  x.beginPath(); x.roundRect(x0, 8, w, 54, 27); x.fill(); x.stroke();
  x.fillStyle = '#14202b'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 36);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(1.1, .31, 1); sp.renderOrder = 5;
  return sp;
}
let _glow = null;
function glowTex() { if (_glow) return _glow; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c); return _glow; }

// ---------- desk screens ----------
function addScreen(group, seat) {
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 216;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const yaw = seat.yaw_deg * Math.PI / 180, fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const p = B2T(seat.position).addScaledVector(fwd, 1.0), north = seat.yaw_deg === 180;
  const holder = new THREE.Group(); holder.position.set(p.x, north ? 1.5 : 1.1, p.z); holder.rotation.y = yaw;
  const front = new THREE.Mesh(new THREE.PlaneGeometry(.92, .52), mat); holder.add(front);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(.92, .52), mat); back.rotation.y = Math.PI; back.position.z = -.03; holder.add(back);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(.98, .58, .02), new THREE.MeshStandardMaterial({ color: 0x1d242c })); bezel.position.z = -.015; holder.add(bezel);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(.05, north ? .78 : .38, .05), new THREE.MeshStandardMaterial({ color: 0x1d242c }));
  stand.position.set(0, north ? -.64 : -.44, -.03); holder.add(stand);
  group.add(holder);
  const scr = { seat, cv, ctx: cv.getContext('2d'), tex, sig: '', agent: null };
  (floor.screens || (floor.screens = new Map())).set(seat.id, scr);
  drawOff(scr);
}
function drawOff(scr) { const x = scr.ctx; x.fillStyle = '#0d1218'; x.fillRect(0, 0, 384, 216); scr.tex.needsUpdate = true; scr.sig = 'off'; }
const F = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
function wrapText(x, text, maxW, maxLines) {
  const out = []; let line = '';
  for (const ch of String(text || '')) { if (ch === '\n') { out.push(line); line = ''; continue; } if (x.measureText(line + ch).width > maxW) { out.push(line); line = ch; } else line += ch; if (out.length >= maxLines) break; }
  if (out.length < maxLines && line) out.push(line);
  if (out.length === maxLines && x.measureText(out[maxLines - 1]).width > maxW - 20) out[maxLines - 1] = out[maxLines - 1].slice(0, -1) + '…';
  return out.slice(0, maxLines);
}
function drawScreen(scr, ag, t) {
  const g = ag.group, x = scr.ctx, color = colorOf(g), working = ag.mode === 'work' && !ag.walking;
  if (working) {   // status screen, redrawn only when it changes
    const sig = ['w', g.latest.topic, g.latest.content, g.pending, color].join('|'); if (sig === scr.sig) return; scr.sig = sig;
    x.fillStyle = '#f4f8fb'; x.fillRect(0, 0, 384, 216);
    x.fillStyle = color; x.fillRect(0, 0, 384, 34);
    x.fillStyle = '#0b141c'; x.font = `700 20px ${F}`; x.textBaseline = 'middle'; x.fillText(nickOf(g) + ' · ' + (g.team ? g.team.label : ''), 12, 18);
    x.fillStyle = '#1f8a45'; x.font = `700 18px ${F}`; x.fillText('● 工作中', 12, 56);
    x.fillStyle = '#14202b'; x.font = `700 24px ${F}`; wrapText(x, g.latest.topic, 360, 2).forEach((l, i) => x.fillText(l, 12, 90 + i * 30));
    x.fillStyle = '#4a5866'; x.font = `400 16px ${F}`; wrapText(x, g.latest.content || '', 360, 2).forEach((l, i) => x.fillText(l, 12, 152 + i * 21));
    if (g.pending) { x.fillStyle = '#b8700c'; x.font = `700 16px ${F}`; x.fillText(`待辦指令 ${g.pending}`, 280, 56); }
    scr.tex.needsUpdate = true; return;
  }
  // screensaver: a turning wind turbine, the clock and where the agent went
  scr.sig = 's';
  const away = ag.mode === 'meet' ? '開會中' : ag.mode === 'rest' ? '休息中' : ag.mode === 'patrol' ? '巡檢中' : ag.mode === 'present' ? '報告中' : ag.mode === 'idle' ? '閒置' : '離開座位';
  const grd = x.createLinearGradient(0, 0, 0, 216); grd.addColorStop(0, '#1f5f86'); grd.addColorStop(1, '#5fa8c8'); x.fillStyle = grd; x.fillRect(0, 0, 384, 216);
  const cx = 270 + Math.sin(t * .2 + ag.phase) * 30, cy = 92;
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, 214); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.9)';
  for (let k = 0; k < 3; k++) { const a = t * 1.6 + ag.phase + k * 2.094; x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath(); x.moveTo(-3, 0); x.quadraticCurveTo(-6, -30, 0, -62); x.quadraticCurveTo(6, -30, 3, 0); x.fill(); x.restore(); }
  x.beginPath(); x.arc(cx, cy, 5, 0, 7); x.fill();
  x.fillStyle = color; x.font = `700 18px ${F}`; x.textBaseline = 'middle'; x.fillText(nickOf(g), 14, 26);
  x.fillStyle = '#ffffff'; x.font = `800 40px ${F}`;
  const now = new Date(); x.fillText(now.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }), 14, 74);
  x.fillStyle = '#cfe2ee'; x.font = `700 18px ${F}`; x.fillText(away, 14, 120);
  x.font = `400 15px ${F}`; x.fillStyle = '#9fb7c6';
  const line = ag.mode === 'meet' && g.meetMsg ? g.meetMsg.meetingTitle : ag.mode === 'rest' && ag.activity ? ag.activity : g.latest.topic;
  wrapText(x, line, 210, 2).forEach((l, i) => x.fillText(l, 14, 150 + i * 20));
  scr.tex.needsUpdate = true;
}
function drawProjector() {
  const pj = floor && floor.projector; if (!pj) return;
  const cur = lastMeetings.find(q => q.open) || null, last = lastMeetings[0] || null;
  const sig = JSON.stringify(cur ? [cur.id, cur.msgs.length, cur.title] : ['none', last && last.id, last && !!last.minutes]); if (sig === projSig) return; projSig = sig;
  const x = pj.ctx; pj.meetingId = cur ? cur.id : last ? last.id : null;
  x.fillStyle = '#f6f8fa'; x.fillRect(0, 0, 1024, 576);
  x.textBaseline = 'middle';
  if (cur) {
    x.fillStyle = '#b8700c'; x.beginPath(); x.roundRect(40, 34, 150, 52, 26); x.fill();
    x.fillStyle = '#fff'; x.font = `800 30px ${F}`; x.fillText('會議中', 70, 61);
    x.fillStyle = '#14202b'; x.font = `800 46px ${F}`; x.fillText(wrapText(x, cur.title, 780, 1)[0] || '', 210, 62);
    const ag = cur.agenda || {}; x.fillStyle = '#566676'; x.font = `500 24px ${F}`;
    x.fillText(`主持 ${ag.host ? partyName(ag.host) : '—'} · 與會 ${(ag.attendees || []).length} 人 · 發言 ${cur.msgs.length} 則`, 40, 118);
    x.fillStyle = '#d5dce3'; x.fillRect(40, 146, 944, 2);
    const recent = cur.msgs.slice(-3);
    if (!recent.length) { x.fillStyle = '#566676'; x.font = `500 30px ${F}`; x.fillText('等待與會代理人發言…', 40, 220);
      (ag.agenda || []).slice(0, 4).forEach((a, i) => { x.fillStyle = '#14202b'; x.font = `500 28px ${F}`; x.fillText(`${i + 1}. ${a}`, 60, 290 + i * 48); }); }
    recent.forEach((q, i) => {
      const y = 186 + i * 128, who = q.from ? partyName(q.from) : '—';
      x.fillStyle = q.from && q.from.team === 'HUMAN' ? '#b8700c' : '#0f7f97'; x.font = `800 28px ${F}`; x.fillText(who, 40, y);
      x.fillStyle = '#14202b'; x.font = `400 27px ${F}`; wrapText(x, q.content, 940, 2).forEach((l, k) => x.fillText(l, 40, y + 40 + k * 36));
    });
  } else {
    x.fillStyle = '#14202b'; x.font = `800 52px ${F}`; x.fillText('會議室', 40, 70);
    x.fillStyle = '#566676'; x.font = `500 30px ${F}`; x.fillText('目前沒有進行中的會議', 40, 136);
    if (last) { x.fillStyle = '#14202b'; x.font = `700 30px ${F}`; x.fillText('上一場：' + (wrapText(x, last.title, 820, 1)[0] || ''), 40, 220);
      x.font = `400 26px ${F}`; x.fillStyle = '#33414e'; wrapText(x, last.minutes ? last.minutes.summary : `${last.msgs.length} 則發言`, 940, 5).forEach((l, k) => x.fillText(l, 40, 274 + k * 38)); }
    else { x.font = `400 26px ${F}`; x.fillStyle = '#33414e'; x.fillText('在看板的「會議」按「發起會議」，代理人排程執行時會來這裡發言。', 40, 220); }
  }
  pj.tex.needsUpdate = true;
}

function clearFloor() {
  if (!floor) return;
  for (const r of floor.rooms) { if (r.group) scene.remove(r.group); (r.extra || []).forEach(o => scene.remove(o)); }
  projSig = '';
  (floor.extra || []).forEach(o => scene.remove(o));
  nav.walk.clear(); floor = null;
}

// Lay out: team offices along the south side of a corridor, meeting room (and the shared room if needed) on the north side.
function buildFloor(teams, needShared) {
  clearFloor();
  const D = 7, CORR = 2.6, GAP = .5, rooms = [];
  let x = 0;
  for (const t of teams) {
    const pods = Math.max(1, Math.ceil((t.count + 1) / 4)), w = Math.max(7, 2.2 + pods * 3.4 + 1.4);
    rooms.push({ id: 'office:' + t.key, kind: 'office', team: t.key, label: t.label, color: t.color, pods, x0: x, y0: 0, w, d: D, doorSide: 'N' });
    x += w + GAP;
  }
  const southW = Math.max(x - GAP, 8);
  const north = [{ id: 'meet', kind: 'meeting', w: 8, d: 6 }, { id: 'pantry', kind: 'pantry', w: 8, d: 6 }];
  if (needShared) north.push({ id: 'office:__shared', kind: 'office', team: '__shared', label: '共用座位', color: css('--muted') || '#566676', pods: Math.max(1, Math.ceil((needShared + 1) / 4)), d: D, doorSide: 'S' });
  for (const r of north) if (r.kind === 'office') r.w = Math.max(7, 2.2 + r.pods * 3.4 + 1.4);
  const northW = north.reduce((s, r) => s + r.w, 0) + GAP * (north.length - 1);
  const W = Math.max(southW, northW); let nx = (W - northW) / 2;
  for (const r of north) { r.x0 = nx; r.y0 = D + CORR; nx += r.w + GAP; rooms.push(r); }
  floor = { rooms, W, D: D + CORR + 7, extra: [], screens: new Map(), devices: new Map() };
  // base floor + corridor
  const base = new THREE.Group();
  floorPlane(base, -1, -1, W + 1, floor.D + 1, new THREE.Color(css('--office-bg') || '#d6e0e7').offsetHSL(0, 0, -.06));
  floorPlane(base, 0, D, W, D + CORR, 0xc9d2d9, 1, .001);
  scene.add(base); floor.extra.push(base);
  navRect(.3, D + .3, W - .3, D + CORR - .3);
  for (const r of rooms) r.kind === 'meeting' ? buildMeeting(r) : r.kind === 'pantry' ? buildPantry(r) : buildOffice(r);
  // corridor waypoints for patrols
  floor.corridor = [0.15, 0.4, 0.65, 0.9].map((f, i) => ({ id: 'corr' + i, type: 'STAND', position: [W * f, D + CORR / 2, 0], yaw_deg: 0 }));
  floor.byTeam = new Map(rooms.filter(r => r.kind === 'office').map(r => [r.team, r]));
  floor.meeting = rooms.find(r => r.kind === 'meeting'); floor.pantry = rooms.find(r => r.kind === 'pantry');
  drawProjector(); fit();
}

// ---------- people ----------
const SKIN = 0xf0c8a4, PANTS = 0x2d3640;
// A low-poly person. `look` (config.agents[].look) sets hair colour/style, clothes, skin and accessories.
function makePerson(color, look = {}) {
  const g = new THREE.Group(), mats = [];
  const mat = (c, r = .7) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: r }); mats.push(m); return m; };
  const shirt = mat(look.shirt || color, .6), skin = mat(look.skin || SKIN), pants = mat(look.pants || PANTS, .8);
  const hips = new THREE.Group(); hips.position.y = .5; g.add(hips);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(.3, .5, .2), pants); legs.position.y = -.25; hips.add(legs);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .3, 4, 12), shirt); torso.position.y = .84; g.add(torso);
  const head = new THREE.Group(); head.position.y = 1.32; g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(.15, 18, 14), skin));
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.032, 8, 6), skin); nose.position.set(0, -.01, -.15); head.add(nose);
  const arm = side => { const pv = new THREE.Group(); pv.position.set(side * .27, 1.08, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(.055, .32, 3, 8), shirt); m.position.y = -.21; pv.add(m); g.add(pv); return pv; };
  const armL = arm(-1), armR = arm(1);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.34, .42, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .02; g.add(ring);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.045, .04, .1, 10), new THREE.MeshStandardMaterial({ color: 0xffffff })); cup.position.set(0, -.44, -.03); cup.visible = false; armR.add(cup);
  dress({ g, head, torso, mat }, look);
  return { g, hips, torso, head, armL, armR, ring, cup, mats };
}
// Hair and accessories. The face looks toward -z.
function dress({ g, head, torso, mat }, look) {
  const add = (parent, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o); return o; };
  const style = look.style || 'short', extra = new Set(look.extra || []);
  if (look.hair) {
    const hair = mat(look.hair, .85);
    // cap: upper part of a slightly larger sphere, tipped back so the forehead stays visible
    const cap = add(head, new THREE.SphereGeometry(.162, 18, 10, 0, Math.PI * 2, 0, Math.PI * .55), hair, 0, .012, .012, .38);
    if (style === 'spiky') for (const [x, y, z, rx, rz] of [[0, .14, .04, -.5, 0], [-.08, .12, .05, -.4, .55], [.08, .12, .05, -.4, -.55], [-.04, .1, .12, -1.1, .3], [.04, .1, .12, -1.1, -.3], [0, .13, -.06, .35, 0], [-.11, .05, .06, -.3, 1.1], [.11, .05, .06, -.3, -1.1]])
      add(head, new THREE.ConeGeometry(.06, .19, 6), hair, x * 1.25, y * 1.1, z * 1.2, -rx * 1.15, 0, rz * 1.15);
    if (style === 'long') add(head, new THREE.CapsuleGeometry(.12, .3, 3, 10), hair, 0, -.18, .07, -.12);
    if (style === 'ponytail') { add(head, new THREE.SphereGeometry(.05, 8, 6), hair, 0, .13, .1); for (const rz of [-.5, 0, .5]) add(head, new THREE.ConeGeometry(.035, .14, 5), hair, Math.sin(rz) * .05, .2, .13, -.6, 0, rz); }
    if (style === 'lowtail') add(head, new THREE.CapsuleGeometry(.03, .26, 3, 6), hair, 0, -.2, .16, .15);
    if (style === 'twintail') for (const sx of [-1, 1]) add(head, new THREE.CapsuleGeometry(.035, .26, 3, 6), hair, sx * .07, -.22, .15, .2);
    if (style === 'bun') add(head, new THREE.SphereGeometry(.07, 10, 8), hair, 0, .12, .11);
    cap.userData.hair = true;
  }
  if (extra.has('headband') || extra.has('hairband')) {
    const band = extra.has('hairband') ? mat(0xc8323c, .6) : mat(0x283a5c, .6);
    add(head, new THREE.TorusGeometry(.158, .016, 6, 24), band, 0, .055, 0, Math.PI / 2 + .18);
    if (extra.has('headband')) add(head, new THREE.BoxGeometry(.11, .045, .012), mat(0xc9d1d9, .3), 0, .07, -.152, -.18);
  }
  if (extra.has('mask')) add(head, new THREE.SphereGeometry(.158, 16, 8, Math.PI * 1.1, Math.PI * .8, Math.PI * .47, Math.PI * .33), mat(0x1f2a3d, .8), 0, 0, 0);
  if (extra.has('vest')) add(g, new THREE.CapsuleGeometry(.215, .22, 4, 12), mat(0x5d6b3c, .8), 0, .88, 0);
  if (extra.has('cape')) add(g, new THREE.BoxGeometry(.5, .78, .03), mat(look.capeColor || 0xf2f2ee, .8), 0, .7, .22, -.08);
  if (extra.has('cloak')) { const cl = mat(0x16171d, .8); add(g, new THREE.CylinderGeometry(.22, .3, .8, 12), cl, 0, .68, 0);
    for (const [x, y, z] of [[.12, .8, .2], [-.15, .55, .22], [.18, .5, -.2], [-.1, .85, -.21]]) add(g, new THREE.SphereGeometry(.05, 8, 6), mat(0xc0282d, .7), x, y, z).scale.set(1.4, .8, .4); }
  if (extra.has('gourd')) { const gd = mat(0xb68a5a, .7); add(g, new THREE.SphereGeometry(.15, 12, 10), gd, .04, .72, .24); add(g, new THREE.SphereGeometry(.1, 12, 10), gd, -.02, .98, .24); }
}
function setFaded(p, faded) { for (const m of p.mats) { m.transparent = faded; m.opacity = faded ? .42 : 1; m.depthWrite = !faded; } p.ring.visible = !faded; }

// Compact name tag: team-coloured pill with a state dot and the short name. Details live in the panel.
function makeLabel() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  spr.renderOrder = 10; spr.center.set(.5, 0);
  let sig = '';
  function set(d) {
    const s = JSON.stringify([d.name, d.teamColor, d.stateColor, d.faded]); if (s === sig) return; sig = s;
    ctx.clearRect(0, 0, 256, 64);
    const F = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
    ctx.font = `700 30px ${F}`;
    let name = d.name; while (name.length > 1 && ctx.measureText(name).width > 180) name = name.slice(0, -1);
    if (name !== d.name) name += '…';
    const w = Math.min(248, ctx.measureText(name).width + 62), x0 = (256 - w) / 2;
    ctx.globalAlpha = d.faded ? .55 : 1;
    ctx.fillStyle = d.teamColor; ctx.beginPath(); ctx.roundRect(x0, 6, w, 46, 23); ctx.fill();
    ctx.beginPath(); ctx.moveTo(122, 51); ctx.lineTo(128, 60); ctx.lineTo(134, 51); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x0 + 24, 29, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = d.stateColor; ctx.beginPath(); ctx.arc(x0 + 24, 29, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b141c'; ctx.textBaseline = 'middle'; ctx.fillText(name, x0 + 44, 30);
    ctx.globalAlpha = 1; tex.needsUpdate = true;
  }
  return { spr, set };
}
// Speech bubble (screen-space, like the name tag) for short lines: greetings, device sounds, what someone is doing.
function makeBubble() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
  const ctx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  spr.renderOrder = 11; spr.center.set(.5, 0); spr.visible = false;
  const b = { spr, until: 0, text: '' };
  b.say = (text, sec, now) => {
    b.until = now + sec; spr.visible = true; if (text === b.text) return; b.text = text;
    ctx.clearRect(0, 0, 512, 96); ctx.font = `700 34px ${F}`;
    let t = String(text); while (t.length > 1 && ctx.measureText(t).width > 440) t = t.slice(0, -1);
    if (t !== String(text)) t += '…';
    const w = Math.min(500, ctx.measureText(t).width + 44), x0 = (512 - w) / 2;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(20,32,43,.45)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x0, 4, w, 70, 22); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(244, 72); ctx.lineTo(256, 90); ctx.lineTo(268, 72); ctx.fill();
    ctx.fillStyle = '#14202b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, 256, 40);
    tex.needsUpdate = true;
  };
  return b;
}

// ---------- agents ----------
const agents = new Map();   // key -> agent
const deskOf = new Map();   // key -> seat anchor (reassigned when the floor is rebuilt)
const held = new Map();     // anchor id -> key
let lastGroups = [], lastOpts = { fresh: new Set(), active: true }, firstPlacement = true;

const nickOf = g => g.nick || g.account.split('@')[0];
const partyName = q => window.cloudlogBridge && window.cloudlogBridge.name ? window.cloudlogBridge.name(q) : (q && (q.name || String(q.account || '').split('@')[0])) || '—';
function colorOf(g) { const m = /var\((--[\w-]+)\)/.exec(g.team ? g.team.hue : ''); return css(m ? m[1] : '--t5') || '#888'; }
const homeOf = g => floor.byTeam.get(OFFICE_TEAMS.includes(g.teamKey) ? g.teamKey : '__shared') || floor.rooms.find(r => r.kind === 'office');
function release(key) { for (const [id, k] of held) if (k === key) held.delete(id); }
function claim(key, list) { for (const a of list) { const h = held.get(a.id); if (!h || h === key) { held.set(a.id, key); return a; } } return null; }
function deskFor(ag) {
  if (!deskOf.has(ag.key)) {
    const seats = homeOf(ag.group).anchors.seats, used = new Set([...deskOf.values()].map(a => a.id));
    deskOf.set(ag.key, seats.find(s => !used.has(s.id)) || jitter(seats[0], ag.key, .9));
  }
  return deskOf.get(ag.key);
}
function jitter(a, key, r = .45) {
  let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  const ang = (Math.abs(h) % 360) * Math.PI / 180;
  const [sx, sz] = snap(a.position[0] + Math.cos(ang) * r, -(a.position[1] + Math.sin(ang) * r));
  return { ...a, id: a.id + '~', position: [sx, -sz, 0], shared: true };
}
function targetFor(ag) {
  const k = ag.key, home = homeOf(ag.group), meet = floor.meeting.anchors; release(k);
  switch (ag.mode) {
    case 'meet': return claim(k, meet.seats) || jitter(meet.door, k, .8);
    case 'present': return claim(k, meet.stands) || claim(k, home.anchors.board) || deskFor(ag);
    case 'patrol': {
      const route = [home.anchors.board[0], home.anchors.water[0], home.anchors.door, ...floor.corridor, meet.door, home.anchors.door];
      return jitter(route[ag.step++ % route.length], k + ag.step, .35);
    }
    case 'rest': {
      const pt = floor.pantry && floor.pantry.anchors;
      if (!pt) return jitter(home.anchors.water[0], k, .6);
      if (ag.restPhase !== 'device') {
        const pick = [...pt.devices].sort(() => Math.random() - .5);
        const d = claim(k, pick) || jitter(pick[0], k, .5);
        ag.restPhase = 'device'; ag.device = d; ag.activity = USE_ZH[d.use] || '使用設備'; return d;
      }
      const prev = ag.device && ag.device.use; ag.restPhase = 'sit';
      ag.activity = prev === 'microwave' ? '吃便當' : prev === 'vending' || prev === 'fridge' ? '喝飲料聊天' : '喝咖啡';
      return claim(k, [...pt.seats].sort(() => Math.random() - .5)) || jitter(pt.door, k, .8);
    }
    default: return deskFor(ag);
  }
}
function placeAt(ag, a) { const p = B2T(a.position); ag.p.g.position.set(p.x, 0, p.z); ag.path = []; arrive(ag, a); }
function goTo(ag, a) { ag.target = a; ag.seated = false; const p = B2T(a.position), cur = ag.p.g.position; ag.path = astar(cur.x, cur.z, p.x, p.z).slice(1); ag.walking = true; }
function arrive(ag, a) {
  ag.walking = false; ag.target = a;
  ag.p.g.rotation.y = (a.yaw_deg || 0) * Math.PI / 180;
  ag.seated = a.type === 'SEAT' && !a.shared;
  const p = B2T(a.position); ag.p.g.position.x = p.x; ag.p.g.position.z = p.z;
  if (ag.ov) { const s = ag.ov.steps[ag.ov.i]; ag.wait = s.hold; if (s.say) say(ag, s.say, Math.min(s.hold, 4)); return; }
  ag.wait = ag.mode === 'patrol' ? 2.5 + Math.random() * 2 : ag.mode === 'rest' ? (ag.restPhase === 'device' ? 6 + Math.random() * 3 : 15 + Math.random() * 10) : Infinity;
}

// ---------- viewer-driven actions (local only: nothing is written to Drive) ----------
const ACTIONS = [
  ['wave', '打招呼'], ['stretch', '伸懶腰'], ['pantry', '去茶水間'], ['meet', '去會議室'],
  ['board', '到白板前'], ['patrol', '巡一圈'], ['desk', '回座位工作']
];
const ACT_NAME = Object.fromEntries(ACTIONS);
const now = () => clock.elapsedTime;
function say(ag, text, sec = 3) { ag.bubble.say(text, sec, now()); }
function devSay(dev, text, sec = 2.5) {
  if (!dev.bubble) { dev.bubble = makeBubble(); scene.add(dev.bubble.spr); (dev.room.extra || (dev.room.extra = [])).push(dev.bubble.spr);
    dev.bubble.spr.position.set(dev.pos.x, dev.tag.position.y + .25, dev.pos.z); }
  dev.bubble.say(text, sec, now());
}
function deviceStep(ag, dev) {
  const spot = claim(ag.key, [dev.anchor]) || jitter(dev.anchor, ag.key, .5);
  return { to: spot, anim: 'use', hold: 7, device: dev, say: USE_ZH[dev.use] || '使用設備' };
}
function planFor(ag, kind, dev) {
  const k = ag.key, home = homeOf(ag.group), meet = floor.meeting.anchors, pt = floor.pantry && floor.pantry.anchors;
  release(k);
  switch (kind) {
    case 'wave': return [{ anim: 'wave', hold: 3.5, say: '嗨！' }];
    case 'stretch': return [{ anim: 'stretch', hold: 3, say: '伸個懶腰～' }];
    case 'device': return [deviceStep(ag, dev)];
    case 'pantry': {
      const free = [...floor.devices.values()].filter(d => d.room === floor.pantry && !held.has(d.id) && d.runUntil <= now());
      const d = free[Math.floor(Math.random() * free.length)] || [...floor.devices.values()].find(d => d.room === floor.pantry);
      const steps = d ? [deviceStep(ag, d)] : [];
      if (pt) steps.push({ to: claim(k, [...pt.seats].sort(() => Math.random() - .5)) || jitter(pt.door, k, .8), anim: 'sip', hold: 16, say: '休息一下' });
      return steps;
    }
    case 'meet': return [{ to: claim(k, meet.seats) || jitter(meet.door, k, .8), anim: 'meet', hold: 25, say: '來開會' }];
    case 'board': return [{ to: claim(k, home.anchors.board) || jitter(home.anchors.board[0], k, .5), anim: 'present', hold: 15, say: '我來說明一下' }];
    case 'patrol': return [home.anchors.water[0], home.anchors.door, ...floor.corridor, home.anchors.door]
      .map((a, i) => ({ to: jitter(a, k + i, .35), anim: 'patrol', hold: 1.8 }));
    case 'desk': return [{ to: deskFor(ag), anim: 'work', hold: 40, say: '回來工作' }];
  }
  return [];
}
function command(key, kind, dev) {
  const ag = agents.get(key); if (!ag || !floor) return;
  const steps = planFor(ag, kind, dev); if (!steps.length) return;
  ag.ov = { kind, steps, i: 0, label: kind === 'device' ? '去用' + dev.info.name : ACT_NAME[kind] };
  setFaded(ag.p, false); runStep(ag);
}
function runStep(ag) {
  const s = ag.ov.steps[ag.ov.i];
  if (s.to) goTo(ag, s.to);
  else { ag.walking = false; ag.path = []; ag.wait = s.hold; if (s.say) say(ag, s.say, s.hold); }
}
function nextStep(ag) {
  const s = ag.ov.steps[ag.ov.i];
  if (s.device && s.device.info.done) devSay(s.device, s.device.info.done);
  if (++ag.ov.i < ag.ov.steps.length) runStep(ag); else endOverride(ag);
}
function endOverride(ag) {
  if (!ag.ov) return;
  ag.ov = null; ag.restPhase = null; release(ag.key); setFaded(ag.p, ag.mode === 'idle'); goTo(ag, targetFor(ag));
}
function runDevice(dev) { dev.runUntil = now() + RUN_SEC; dev.doneSaid = false; devSay(dev, dev.info.run + '…', 2); }
function deviceUser(dev) {
  for (const ag of agents.values()) {
    const s = ag.ov && ag.ov.steps[ag.ov.i];
    if (s && s.device === dev && !ag.walking) return ag;
    if (!ag.ov && ag.mode === 'rest' && ag.restPhase === 'device' && !ag.walking && ag.device && ag.device.id.replace(/~$/, '') === dev.id) return ag;
  }
  return null;
}

function upsert(g, i) {
  let ag = agents.get(g.key);
  const mode = classify(g), color = colorOf(g);
  if (!ag) {
    const p = makePerson(new THREE.Color(color), g.look || {}); p.g.userData.key = g.key;
    const label = makeLabel(), bubble = makeBubble();
    ag = { key: g.key, group: g, p, label, bubble, mode, step: i, lift: (agents.size % 2) * .25, path: [], walking: false, wait: Infinity, phase: Math.random() * 6, seated: false, ov: null };
    scene.add(p.g); scene.add(label.spr); scene.add(bubble.spr); agents.set(g.key, ag);
    if (firstPlacement) placeAt(ag, targetFor(ag));
    else { const d = B2T(homeOf(g).anchors.door.position); p.g.position.set(d.x, 0, d.z); goTo(ag, targetFor(ag)); }
  } else { ag.group = g; if (ag.mode !== mode) { ag.mode = mode; if (!ag.ov) goTo(ag, targetFor(ag)); } }   // a viewer action finishes first
  ag.mode = mode; ag.group = g;
  if (!(g.look && g.look.shirt)) ag.p.mats[0].color.set(color);
  ag.p.ring.material.color.set(color);
  setFaded(ag.p, mode === 'idle' && !ag.ov); ag.p.cup.visible = mode === 'rest';
  const topic = mode === 'meet' && g.meetMsg ? '說：' + g.meetMsg.content : mode === 'rest' && ag.activity ? ag.activity : g.latest.topic;
  ag.label.set({ team: g.team ? g.team.label : '—', teamColor: color, name: nickOf(g), state: STATES[mode].label,
    stateColor: css(STATES[mode].tok) || '#ccc', topic, faded: mode === 'idle' });
  const desk = deskFor(ag), scr = floor.screens.get(desk.id); if (scr) scr.agent = ag;
}
function relabelAll() { if (lib) update(lastGroups, lastOpts); }

function update(groups, opts = {}) {
  lastGroups = groups; lastOpts = { fresh: opts.fresh || new Set(), active: opts.active !== false }; lastMeetings = opts.meetings || lastMeetings;
  if (!lib) return;
  // which offices are needed: the configured teams always get a room; everyone else shares one
  const counts = new Map(); let shared = 0;
  for (const g of groups) { if (OFFICE_TEAMS.includes(g.teamKey)) counts.set(g.teamKey, (counts.get(g.teamKey) || 0) + 1); else shared++; }
  const teams = OFFICE_TEAMS.map(k => {
    const g = groups.find(x => x.teamKey === k);
    return { key: k, label: g && g.team ? g.team.label : k.toUpperCase(), color: g ? colorOf(g) : (css('--muted') || '#888'), count: counts.get(k) || 0 };
  });
  const sig = JSON.stringify([teams.map(t => [t.key, Math.max(1, Math.ceil((t.count + 1) / 4)), t.color, t.label]), shared ? Math.ceil((shared + 1) / 4) : 0, css('--office-bg')]);
  if (sig !== layoutSig) {
    layoutSig = sig;
    for (const ag of agents.values()) { scene.remove(ag.p.g); scene.remove(ag.label.spr); scene.remove(ag.bubble.spr); }
    closeMenu();
    agents.clear(); deskOf.clear(); held.clear(); firstPlacement = true;
    buildFloor(teams, shared);
  }
  const keep = new Set(groups.map(g => g.key));
  for (const [k, ag] of agents) if (!keep.has(k)) { scene.remove(ag.p.g); scene.remove(ag.label.spr); scene.remove(ag.bubble.spr); release(k); deskOf.delete(k); agents.delete(k); }
  for (const scr of floor.screens.values()) scr.agent = null;
  groups.forEach((g, i) => upsert(g, i));
  for (const scr of floor.screens.values()) if (!scr.agent && scr.sig !== 'off') drawOff(scr);
  if (groups.length) firstPlacement = false;
  drawProjector(); renderLegend();
}
function renderLegend() {
  const counts = {}; for (const ag of agents.values()) counts[ag.mode] = (counts[ag.mode] || 0) + 1;
  legend.replaceChildren();
  for (const k of ORDER) {
    const s = document.createElement('span'); s.style.setProperty('--c', `var(${STATES[k].tok})`);
    const i = document.createElement('i'); const b = document.createElement('b'); b.textContent = String(counts[k] || 0);
    s.append(i, STATES[k].label, b); legend.append(s);
  }
  const rv = document.createElement('button'); rv.type = 'button'; rv.textContent = '重設視角'; rv.onclick = () => { if (floor) fit(); }; legend.append(rv);
  const t = document.createElement('button'); t.type = 'button'; t.textContent = showNames ? '隱藏名牌' : '顯示名牌';
  t.onclick = () => { showNames = !showNames; try { localStorage.setItem('cloudlog.names', showNames ? '1' : '0'); } catch {} renderLegend(); };
  legend.append(t);
  if (floor) { const teamRooms = floor.rooms.filter(r => r.kind === 'office' && r.team !== '__shared').length, shared = floor.byTeam.has('__shared');
    info.textContent = box.clientWidth < 560 ? `${teamRooms} 間辦公室 · ${agents.size} 位代理人` : `${teamRooms} 間團隊辦公室${shared ? ' ＋ 共用座位' : ''} ＋ 會議室 ＋ 茶水間 · ${agents.size} 位代理人`; }
}

// ---------- animation ----------
const clock = new THREE.Clock();
function animate(ag, dt, t) {
  const p = ag.p, ph = ag.phase;
  if (ag.walking) {
    if (!ag.path.length) { arrive(ag, ag.target); }
    else {
      const [tx, tz] = ag.path[0], pos = p.g.position, dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz), sp = 1.3 * dt;
      if (d <= sp) { pos.x = tx; pos.z = tz; ag.path.shift(); } else { pos.x += dx / d * sp; pos.z += dz / d * sp; }
      if (d > 1e-3) p.g.rotation.y = Math.atan2(-dx, -dz);
      const sw = Math.sin(t * 9 + ph);
      p.g.position.y = Math.abs(sw) * .035; p.hips.rotation.x = 0;
      p.armL.rotation.set(sw * .55, 0, 0); p.armR.rotation.set(-sw * .55, 0, 0); p.head.rotation.set(0, 0, 0); p.torso.scale.y = 1; p.cup.visible = false;
      return;
    }
  }
  p.g.position.y = ag.seated ? -.04 : 0;
  p.hips.rotation.x = ag.seated ? Math.PI / 2 : 0;
  p.head.rotation.set(0, 0, 0); p.armL.rotation.set(0, 0, 0); p.armR.rotation.set(0, 0, 0); p.torso.scale.y = 1;
  const m = ag.ov ? ag.ov.steps[ag.ov.i].anim : ag.mode === 'rest' ? (ag.restPhase === 'device' ? 'use' : 'sip') : ag.mode;
  p.cup.visible = m === 'sip';
  switch (m) {
    case 'wave': p.armR.rotation.x = 2.75; p.armR.rotation.z = .35 + Math.sin(t * 11 + ph) * .4; p.head.rotation.y = Math.sin(t * 2 + ph) * .15; p.head.rotation.x = -.08; break;
    case 'stretch': { const k = Math.min(1, (3 - Math.max(0, ag.wait)) * 1.6); p.armL.rotation.x = p.armR.rotation.x = 2.95 * k; p.armL.rotation.z = -.25 * k; p.armR.rotation.z = .25 * k; p.head.rotation.x = -.3 * k; p.torso.scale.y = 1 + .06 * k; break; }
    case 'use': p.armL.rotation.x = 1.2 + Math.sin(t * 6 + ph) * .15; p.armR.rotation.x = 1.35 + Math.sin(t * 6 + ph + 1) * .2; p.head.rotation.x = .15; break;
    case 'sip': p.armR.rotation.x = 1.5 + Math.max(0, Math.sin(t * .9 + ph)) * .9; p.armL.rotation.z = -.08; p.head.rotation.y = Math.sin(t * .6 + ph) * .3; break;
    case 'work': p.armL.rotation.x = 1.25 + Math.sin(t * 13 + ph) * .1; p.armR.rotation.x = 1.25 + Math.sin(t * 13 + ph + 1.7) * .1; p.head.rotation.x = .12 + Math.sin(t * 1.3 + ph) * .04; break;
    case 'meet': p.armL.rotation.x = .9; p.armR.rotation.x = .9 + Math.max(0, Math.sin(t * .8 + ph)) * .7; p.head.rotation.x = Math.max(0, Math.sin(t * 2.2 + ph)) * .18; p.head.rotation.y = Math.sin(t * .5 + ph) * .35; break;
    case 'present': p.armR.rotation.x = 2.3 + Math.sin(t * 2 + ph) * .25; p.armR.rotation.z = .25; p.armL.rotation.x = .3 + Math.sin(t * 1.4 + ph) * .2; break;
    case 'patrol': p.head.rotation.y = Math.sin(t * 1.6 + ph) * .7; p.armL.rotation.z = -.15; p.armR.rotation.x = .5; break;
    default: p.head.rotation.x = .35; p.armL.rotation.x = ag.seated ? .9 : 0; p.armR.rotation.x = ag.seated ? .9 : 0;
  }
  if (ag.wait !== Infinity) { ag.wait -= dt; if (ag.wait <= 0) { if (ag.ov) nextStep(ag); else goTo(ag, targetFor(ag)); } }
}
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .1);
  if (document.hidden || box.hidden || !box.clientWidth) return;
  const t = clock.elapsedTime;
  if (floor) for (const dev of floor.devices.values()) {
    if (dev.runUntil && t >= dev.runUntil) { dev.runUntil = 0; devSay(dev, dev.info.done || '好了'); }
    const on = dev.runUntil > t || !!deviceUser(dev);
    dev.glow.visible = on; if (on) { const s = .55 + Math.sin(t * 5) * .12; dev.glow.scale.set(s, s, 1); }
    dev.steam.forEach((sp, i) => { sp.visible = on; if (!on) return; const f = (t * .45 + i / dev.steam.length) % 1;
      sp.position.set(dev.pos.x + Math.sin(f * 6 + i) * .06, 1.15 + f * .8, dev.pos.z); sp.material.opacity = .55 * (1 - f); const s = .12 + f * .22; sp.scale.set(s, s, 1); });
    dev.tag.visible = showNames;
    if (dev.bubble && dev.bubble.spr.visible && t > dev.bubble.until) dev.bubble.spr.visible = false;
    if (dev.bubble) { const s = camera.aspect < 1 ? .085 : .11; dev.bubble.spr.scale.set(s * 2, s * 2 * 96 / 512, 1); }
  }
  if (floor && t - (floor.scrT || 0) > .5) { floor.scrT = t; for (const scr of floor.screens.values()) if (scr.agent) drawScreen(scr, scr.agent, t); }
  for (const ag of agents.values()) {
    animate(ag, dt, t);
    const gp = ag.p.g.position;
    ag.label.spr.visible = showNames;
    ag.label.spr.position.set(gp.x, (ag.seated && !ag.walking ? 1.4 : 1.65) + (ag.lift || 0), gp.z);
    const s = camera.aspect < 1 ? .085 : .11; ag.label.spr.scale.set(s, s / 4, 1);
    const bb = ag.bubble; if (bb.spr.visible && t > bb.until) bb.spr.visible = false;
    if (bb.spr.visible) { bb.spr.position.copy(ag.label.spr.position); bb.spr.center.y = showNames ? -.75 : 0; bb.spr.scale.set(s * 2, s * 2 * 96 / 512, 1); }
  }
  meetingTalk(t);
  if (menu.el && menu.track) placeMenu();
  controls.update(); renderer.render(scene, camera);
});

// Meeting speech: one short bubble at a time, taking turns among people sitting in the meeting room.
const TALK_EVERY = 6, TALK_CHARS = 14;
let talkAt = 0, talkTurn = 0;
function meetingTalk(t) {
  if (t < talkAt) return;
  talkAt = t + TALK_EVERY;
  const list = [...agents.values()].filter(ag => ag.mode === 'meet' && ag.group.meetMsg && !ag.ov && !ag.walking)
    .sort((a, b) => a.group.meetMsg.ts - b.group.meetMsg.ts);
  if (!list.length) return;
  const ag = list[talkTurn++ % list.length], text = String(ag.group.meetMsg.content || '').replace(/\s+/g, ' ').trim();
  if (text) say(ag, text.length > TALK_CHARS ? text.slice(0, TALK_CHARS) + '…' : text, TALK_EVERY - 1);
}

// ---------- picking + action menu ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
const menu = { el: null, track: null };
function closeMenu() { if (menu.el) menu.el.remove(); menu.el = null; menu.track = null; }
function placeMenu() {   // keep the menu next to the person / device it belongs to
  const el = menu.el, w = box.clientWidth, h = box.clientHeight;
  const v = menu.track().clone().project(camera);
  if (v.z > 1) return;
  const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h, mw = el.offsetWidth, mh = el.offsetHeight;
  let left = x + 14, top = y - mh / 2;
  if (left + mw > w - 8) left = x - mw - 14;
  left = Math.max(8, Math.min(left, w - mw - 8)); top = Math.max(8, Math.min(top, h - mh - 8));
  el.style.left = left + 'px'; el.style.top = top + 'px';
}
function showMenu(title, sub, items, track) {
  closeMenu();
  const el = document.createElement('div'); el.className = 'o-menu'; el.setAttribute('role', 'menu');
  const head = document.createElement('div'); head.className = 'o-menu-h';
  const b = document.createElement('b'); b.textContent = title; head.append(b);
  if (sub) { const sp = document.createElement('span'); sp.textContent = sub; head.append(sp); }
  const x = document.createElement('button'); x.type = 'button'; x.className = 'o-menu-x'; x.textContent = '×'; x.setAttribute('aria-label', '關閉'); x.onclick = closeMenu; head.append(x);
  const list = document.createElement('div'); list.className = 'o-menu-l';
  for (const it of items) {
    if (it.sep) { const hr = document.createElement('div'); hr.className = 'o-menu-sep'; hr.textContent = it.sep; list.append(hr); continue; }
    const bt = document.createElement('button'); bt.type = 'button'; bt.setAttribute('role', 'menuitem'); bt.className = it.cls || '';
    if (it.dot) { const i = document.createElement('i'); i.style.background = it.dot; bt.append(i); }
    bt.append(it.label); bt.disabled = !!it.disabled;
    bt.onclick = ev => { ev.stopPropagation(); const keep = it.run(); if (!keep) closeMenu(); };
    list.append(bt);
  }
  const foot = document.createElement('div'); foot.className = 'o-menu-f'; foot.textContent = '只在這個畫面播放，不會寫入雲端';
  el.append(head, list, foot);
  for (const ev of ['pointerdown', 'pointerup', 'wheel']) el.addEventListener(ev, e => e.stopPropagation());
  box.append(el); menu.el = el; menu.track = track; placeMenu();
  const first = list.querySelector('button:not(:disabled)'); if (first) first.focus({ preventScroll: true });
}
const shortName = ag => nickOf(ag.group);
function stateText(ag) { return ag.ov ? '指揮中：' + ag.ov.label : STATES[ag.mode].label + (ag.mode === 'rest' && ag.activity ? '・' + ag.activity : ''); }
function personMenu(ag) {
  const items = [{ label: '查看紀錄與指令', cls: 'pri', run: () => { if (window.cloudlogBridge) window.cloudlogBridge.open(ag.key); } }, { sep: '讓他做…' }];
  for (const [k, name] of ACTIONS) items.push({ label: name, run: () => command(ag.key, k) });
  if (ag.ov) items.push({ label: '停止，回到自動', cls: 'mut', run: () => endOverride(ag) });
  showMenu(shortName(ag) + (ag.group.team ? ' · ' + ag.group.team.label : ''), stateText(ag), items, () => ag.p.g.position.clone().setY(1.2));
}
function deviceMenu(dev, pickPerson = false) {
  const user = deviceUser(dev), running = dev.runUntil > now();
  const status = user ? shortName(user) + ' 正在' + (USE_ZH[dev.use] || '使用') : running ? dev.info.run : '待機中';
  const roomName = dev.room.kind === 'pantry' ? '茶水間' : dev.room.kind === 'meeting' ? '會議室' : dev.room.label;
  const track = () => dev.pos.clone().setY(1.1);
  if (pickPerson) {   // choose who should come and use it, nearest first
    const list = [...agents.values()].sort((a, b) => a.p.g.position.distanceTo(dev.pos) - b.p.g.position.distanceTo(dev.pos));
    const items = [{ label: '← 返回', cls: 'mut', run: () => { deviceMenu(dev); return true; } }];
    for (const ag of list) items.push({ label: shortName(ag) + '（' + stateText(ag) + '）', dot: colorOf(ag.group), disabled: ag === user, run: () => command(ag.key, 'device', dev) });
    showMenu('叫誰來用' + dev.info.name + '？', roomName, items, track); return;
  }
  showMenu(dev.info.name + ' · ' + roomName, status, [
    { label: dev.info.act, cls: 'pri', disabled: running, run: () => runDevice(dev) },
    { label: '叫人來用…', disabled: !agents.size, run: () => { deviceMenu(dev, true); return true; } }
  ], track);
}
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const targets = [...agents.values()].flatMap(ag => [ag.p.g, ...(showNames ? [ag.label.spr] : [])]);
  if (floor && floor.projector) targets.push(floor.projector.mesh);
  if (floor) for (const dev of floor.devices.values()) targets.push(dev.hit, ...(showNames ? [dev.tag] : []));
  const hit = ray.intersectObjects(targets, true).find(h => h.object.visible || h.object.userData.device);
  if (!hit) { closeMenu(); return; }
  if (hit.object.userData.projector || (hit.object.parent && hit.object.parent.userData.projector)) { closeMenu(); if (window.cloudlogBridge) window.cloudlogBridge.meetings(floor.projector.meetingId || 'list'); return; }
  if (hit.object.userData.device) { deviceMenu(hit.object.userData.device); return; }
  let o = hit.object; while (o && !o.userData.key) o = o.parent;
  const key = o ? o.userData.key : [...agents.values()].find(ag => ag.label.spr === hit.object)?.key;
  const ag = key && agents.get(key); if (ag) personMenu(ag); else closeMenu();
});
addEventListener('keydown', e => { if (e.key === 'Escape' && menu.el) closeMenu(); });

// ---------- boot ----------
async function boot() {
  try {
    const [office, meet, meetNavG, mm, pan, panNav, pm] = await Promise.all([
      loadGlb(LIB_OFFICE + 'scene.glb'), loadGlb(LIB_MEET + 'scene.glb'), loadGlb(LIB_MEET + 'navmesh.glb'),
      fetch(LIB_MEET + 'scene.json').then(r => r.json()),
      loadGlb(LIB_PANTRY + 'scene.glb'), loadGlb(LIB_PANTRY + 'navmesh.glb'), fetch(LIB_PANTRY + 'scene.json').then(r => r.json())]);
    lib = office.scene; lib.meetScene = meet.scene; lib.meetNav = meetNavG.scene; meetMeta = mm;
    lib.pantryScene = pan.scene; lib.pantryNav = panNav.scene; pantryMeta = pm;
    resize();
    update(lastGroups, lastOpts);
    if (window.cloudlogBridge) window.cloudlogBridge.refresh();
  } catch (e) {
    console.error(e); info.textContent = '辦公室場景載入失敗';
    const d = document.createElement('div'); d.className = 'o-err'; d.textContent = '無法載入 3D 場景：' + (e.message || e) + '。請確認 indoor-scenes 已公開（或已開 GitHub Pages）且 config.js 的 sceneBase 正確；也可以先切換到「圓框」檢視。'; box.append(d);
  }
}
window.cloudlogOffice = { update, command: (key, kind) => command(key, kind) };
boot();
