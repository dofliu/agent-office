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
  anchors.water.push({ id: `${room.id}:water`, type: 'POI', position: [x0 + w - 1.2, wy, 0], yaw_deg: -90 });
  const pl = prefab(['Plant'], .7, -.7); pl.position.set(x0 + w - .6, 0, -(doorSide === 'N' ? y0 + d - .6 : y0 + .6)); g.add(pl);
  room.anchors = anchors; room.group = g; scene.add(g);
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
  floor.devFx = new Map(room.anchors.devices.map(a => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), transparent: true, depthWrite: false, color: a.use === 'microwave' ? 0xffb347 : a.use === 'fridge' ? 0x9fd8ff : 0xfff1c9 }));
    const p = B2T(a.position); sp.position.set(p.x, 1.35, p.z); sp.scale.set(.7, .7, 1); sp.visible = false; scene.add(sp); room.extra.push(sp); return [a.id, sp]; }));
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
    x.fillStyle = '#0b141c'; x.font = `700 20px ${F}`; x.textBaseline = 'middle'; x.fillText(g.account.split('@')[0] + ' · ' + (g.team ? g.team.label : ''), 12, 18);
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
  x.fillStyle = color; x.font = `700 18px ${F}`; x.textBaseline = 'middle'; x.fillText(g.account.split('@')[0], 14, 26);
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
    x.fillText(`主持 ${ag.host ? String(ag.host.name || ag.host.account || '').split('@')[0] : '—'} · 與會 ${(ag.attendees || []).length} 人 · 發言 ${cur.msgs.length} 則`, 40, 118);
    x.fillStyle = '#d5dce3'; x.fillRect(40, 146, 944, 2);
    const recent = cur.msgs.slice(-3);
    if (!recent.length) { x.fillStyle = '#566676'; x.font = `500 30px ${F}`; x.fillText('等待與會代理人發言…', 40, 220);
      (ag.agenda || []).slice(0, 4).forEach((a, i) => { x.fillStyle = '#14202b'; x.font = `500 28px ${F}`; x.fillText(`${i + 1}. ${a}`, 60, 290 + i * 48); }); }
    recent.forEach((q, i) => {
      const y = 186 + i * 128, who = q.from ? (q.from.name || String(q.from.account || '').split('@')[0]) : '—';
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
  floor = { rooms, W, D: D + CORR + 7, extra: [], screens: new Map() };
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
function makePerson(color) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color, roughness: .6 });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: .7 });
  const pants = new THREE.MeshStandardMaterial({ color: PANTS, roughness: .8 });
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
  return { g, hips, torso, head, armL, armR, ring, cup, mats: [shirt, skin, pants] };
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

// ---------- agents ----------
const agents = new Map();   // key -> agent
const deskOf = new Map();   // key -> seat anchor (reassigned when the floor is rebuilt)
const held = new Map();     // anchor id -> key
let lastGroups = [], lastOpts = { fresh: new Set(), active: true }, firstPlacement = true;

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
  ag.wait = ag.mode === 'patrol' ? 2.5 + Math.random() * 2 : ag.mode === 'rest' ? (ag.restPhase === 'device' ? 6 + Math.random() * 3 : 15 + Math.random() * 10) : Infinity;
}

function upsert(g, i) {
  let ag = agents.get(g.key);
  const mode = classify(g), color = colorOf(g);
  if (!ag) {
    const p = makePerson(new THREE.Color(color)); p.g.userData.key = g.key;
    const label = makeLabel();
    ag = { key: g.key, group: g, p, label, mode, step: i, lift: (agents.size % 2) * .25, path: [], walking: false, wait: Infinity, phase: Math.random() * 6, seated: false };
    scene.add(p.g); scene.add(label.spr); agents.set(g.key, ag);
    if (firstPlacement) placeAt(ag, targetFor(ag));
    else { const d = B2T(homeOf(g).anchors.door.position); p.g.position.set(d.x, 0, d.z); goTo(ag, targetFor(ag)); }
  } else { ag.group = g; if (ag.mode !== mode) { ag.mode = mode; goTo(ag, targetFor(ag)); } }
  ag.mode = mode; ag.group = g;
  ag.p.mats[0].color.set(color); ag.p.ring.material.color.set(color);
  setFaded(ag.p, mode === 'idle'); ag.p.cup.visible = mode === 'rest';
  const topic = mode === 'meet' && g.meetMsg ? '說：' + g.meetMsg.content : mode === 'rest' && ag.activity ? ag.activity : g.latest.topic;
  ag.label.set({ team: g.team ? g.team.label : '—', teamColor: color, name: g.account.split('@')[0], state: STATES[mode].label,
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
    for (const ag of agents.values()) { scene.remove(ag.p.g); scene.remove(ag.label.spr); }
    agents.clear(); deskOf.clear(); held.clear(); firstPlacement = true;
    buildFloor(teams, shared);
  }
  const keep = new Set(groups.map(g => g.key));
  for (const [k, ag] of agents) if (!keep.has(k)) { scene.remove(ag.p.g); scene.remove(ag.label.spr); release(k); deskOf.delete(k); agents.delete(k); }
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
      p.armL.rotation.set(sw * .55, 0, 0); p.armR.rotation.set(-sw * .55, 0, 0); p.head.rotation.set(0, 0, 0);
      return;
    }
  }
  p.g.position.y = ag.seated ? -.04 : 0;
  p.hips.rotation.x = ag.seated ? Math.PI / 2 : 0;
  p.head.rotation.set(0, 0, 0); p.armL.rotation.set(0, 0, 0); p.armR.rotation.set(0, 0, 0);
  switch (ag.mode) {
    case 'work': p.armL.rotation.x = 1.25 + Math.sin(t * 13 + ph) * .1; p.armR.rotation.x = 1.25 + Math.sin(t * 13 + ph + 1.7) * .1; p.head.rotation.x = .12 + Math.sin(t * 1.3 + ph) * .04; break;
    case 'meet': p.armL.rotation.x = .9; p.armR.rotation.x = .9 + Math.max(0, Math.sin(t * .8 + ph)) * .7; p.head.rotation.x = Math.max(0, Math.sin(t * 2.2 + ph)) * .18; p.head.rotation.y = Math.sin(t * .5 + ph) * .35; break;
    case 'present': p.armR.rotation.x = 2.3 + Math.sin(t * 2 + ph) * .25; p.armR.rotation.z = .25; p.armL.rotation.x = .3 + Math.sin(t * 1.4 + ph) * .2; break;
    case 'patrol': p.head.rotation.y = Math.sin(t * 1.6 + ph) * .7; p.armL.rotation.z = -.15; p.armR.rotation.x = .5; break;
    case 'rest':
      if (ag.restPhase === 'device') { p.armL.rotation.x = 1.2 + Math.sin(t * 6 + ph) * .15; p.armR.rotation.x = 1.35 + Math.sin(t * 6 + ph + 1) * .2; p.cup.visible = false; p.head.rotation.x = .15; }
      else { p.cup.visible = true; p.armR.rotation.x = 1.5 + Math.max(0, Math.sin(t * .9 + ph)) * .9; p.armL.rotation.z = -.08; p.head.rotation.y = Math.sin(t * .6 + ph) * .3; }
      break;
    default: p.head.rotation.x = .35; p.armL.rotation.x = ag.seated ? .9 : 0; p.armR.rotation.x = ag.seated ? .9 : 0;
  }
  if (ag.wait !== Infinity) { ag.wait -= dt; if (ag.wait <= 0) goTo(ag, targetFor(ag)); }
}
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .1);
  if (document.hidden || box.hidden || !box.clientWidth) return;
  const t = clock.elapsedTime;
  if (floor && floor.devFx) { const inUse = new Set(); for (const ag of agents.values()) if (ag.mode === 'rest' && ag.restPhase === 'device' && !ag.walking && ag.device) inUse.add(ag.device.id.replace(/~$/, ''));
    for (const [id, sp] of floor.devFx) { sp.visible = inUse.has(id); if (sp.visible) { const s = .55 + Math.sin(t * 5) * .12; sp.scale.set(s, s, 1); } } }
  if (floor && t - (floor.scrT || 0) > .5) { floor.scrT = t; for (const scr of floor.screens.values()) if (scr.agent) drawScreen(scr, scr.agent, t); }
  for (const ag of agents.values()) {
    animate(ag, dt, t);
    const gp = ag.p.g.position;
    ag.label.spr.visible = showNames;
    ag.label.spr.position.set(gp.x, (ag.seated && !ag.walking ? 1.4 : 1.65) + (ag.lift || 0), gp.z);
    const s = camera.aspect < 1 ? .085 : .11; ag.label.spr.scale.set(s, s / 4, 1);
  }
  controls.update(); renderer.render(scene, camera);
});

// ---------- picking ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
renderer.domElement.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const targets = [...agents.values()].flatMap(ag => [ag.p.g, ...(showNames ? [ag.label.spr] : [])]);
  if (floor && floor.projector) targets.push(floor.projector.mesh);
  const hit = ray.intersectObjects(targets, true)[0];
  if (!hit) return;
  if (hit.object.userData.projector || (hit.object.parent && hit.object.parent.userData.projector)) { if (window.cloudlogBridge) window.cloudlogBridge.meetings(floor.projector.meetingId || 'list'); return; }
  let o = hit.object; while (o && !o.userData.key) o = o.parent;
  const key = o ? o.userData.key : [...agents.values()].find(ag => ag.label.spr === hit.object)?.key;
  if (key && window.cloudlogBridge) window.cloudlogBridge.open(key);
});

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
window.cloudlogOffice = { update };
boot();
