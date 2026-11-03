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
  water:     { name: '飲水機', act: '倒一杯熱水', run: '出水中', fx: 0xbfe6ff, steam: true, done: '水好了' },
  studio:    { name: '錄音設備', act: '開始錄音', run: '錄音中', fx: 0xff5a4f, done: '錄好了' },
  booth:     { name: '電話亭',   act: '開始視訊', run: '通話中', fx: 0x7fd1ff, done: '通話結束' }
};
const RUN_SEC = 8;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const B2T = p => new THREE.Vector3(p[0], p[2] || 0, -p[1]);   // scene coords (x east, y north) -> three
const MIN = 60e3, HOUR = 3600e3, CELL = .25;
const STATES = {
  work:    { label: '工作中', tok: '--s-work' },
  meet:    { label: '開會',   tok: '--s-meet' },
  present: { label: '報告',   tok: '--s-present' },
  record:  { label: '錄製',   tok: '--s-record' },
  call:    { label: '通話',   tok: '--s-call' },
  patrol:  { label: '巡檢',   tok: '--s-patrol' },
  rest:    { label: '休息',   tok: '--s-break' },
  idle:    { label: '閒置',   tok: '--s-idle' }
};
const ORDER = ['work', 'meet', 'call', 'present', 'record', 'patrol', 'rest', 'idle'];
let showNames = true;
try { showNames = localStorage.getItem('cloudlog.names') !== '0'; } catch {}
const teamKey = t => (t || '').replace(/^team\s+/i, '').trim().toLowerCase() || '—';

// How recent the agent's newest work is (a record, a report on a command or a meeting message; see app.js `act`):
// within ACTIVE it sits at its own desk and the screen shows that work; ACTIVE..IDLE resting; older than IDLE idle.
const ACTIVE = Math.max(.25, Number(CFG.activeHours) || 2) * HOUR, IDLE = Math.max(ACTIVE, (Number(CFG.idleHours) || 6) * HOUR);
const NOW_WIN = 45 * MIN;   // only very recent work sends people to the booth, studio, meeting room…
const actOf = g => g.act || g.latest;
const ACK_ZH = { received: '已收到', in_progress: '進行中', awaiting_approval: '待核准', done: '完成', declined: '不做', blocked: '卡住' };
const hhmm = ts => new Date(ts).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false });
function classify(g) {
  if (g.meetMsg) return 'meet';
  const a = actOf(g), age = Date.now() - a.ts, txt = a.topic + ' ' + (a.content || '');
  if (age > IDLE) return 'idle';
  if (age > ACTIVE) return 'rest';
  if (age > NOW_WIN) return 'work';
  if (/視訊|線上會議|電話|通話|訪談|zoom|teams|google meet|call/i.test(txt)) return 'call';
  if (/會議|討論|開會|規劃|評估|審查|review|meeting/i.test(txt)) return 'meet';
  if (/錄影|錄音|錄課|錄製|旁白|配音|拍攝|直播|shorts|podcast/i.test(txt)) return 'record';
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
controls.enableDamping = true; controls.maxPolarAngle = 1.32; controls.minDistance = 1.2; controls.maxDistance = 90;
let userMoved = false, fly = null; controls.addEventListener('start', () => { userMoved = true; fly = null; });
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
let lastMeetings = [], lastProjects = [], projSig = '';
let meetAssign = new Map();   // meeting_id -> room (B+ or a small meeting room)
let floor = null;                                   // current built floor
let layoutSig = '', fittedSig = '', lastPortrait = null;
const nav = { walk: new Set(), free: (x, z) => nav.walk.has(Math.floor(x / CELL) + ',' + Math.floor(z / CELL)) };

function resize() {
  const w = box.clientWidth, h = box.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (floor && (!userMoved || (w / h < 1) !== lastPortrait)) fit();
}
new ResizeObserver(resize).observe(box);

function fit(animate = false) {   // whole floor in view; animate = fly there (重設視角, 回到全景)
  const { W, D } = floor, t = new THREE.Vector3(W / 2, 0.3, -D / 2);
  const portrait = camera.aspect < 1; lastPortrait = portrait;
  const dir = portrait ? new THREE.Vector3(0.62, 1.3, 0).normalize() : new THREE.Vector3(-0.06, 1.25, 0.78).normalize();
  const across = portrait ? D : W, along = portrait ? W : D;
  const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  const dist = Math.max((across / 2 + (portrait ? 2.6 : 1.2)) / Math.tan(hf / 2), (along / 2 + 1.2) * 1.0 / Math.tan(vf / 2)) * (portrait ? 1.08 : 1);
  if (animate) flyTo(t, t.clone().addScaledVector(dir, dist));
  else { fly = null; controls.target.copy(t); camera.position.copy(t).addScaledVector(dir, dist); controls.update(); }
  userMoved = false;
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
  let fs = 150; do { x.font = `800 ${fs}px "Noto Sans TC","PingFang TC",sans-serif`; } while (x.measureText(text).width > 980 && (fs -= 10) > 40);
  x.textAlign = 'center'; x.textBaseline = 'middle';
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
    [[-.75, -1.15, 0], [.75, -1.15, 0], [-.75, 1.15, 180], [.75, 1.15, 180]].forEach(([ox, oy, yaw], k) => {
      const seat = { id: `${room.id}:seat${anchors.seats.length}`, type: 'SEAT', position: [pcx + ox, podCY + oy, 0], yaw_deg: yaw };
      anchors.seats.push(seat); addScreen(g, seat);
      addLift(g, seat, pg.getObjectByName('Desk_0' + (k + 1)), pg.getObjectByName('Keyboard_0' + (k + 1)), pg.getObjectByName('Chair_0' + (k + 1)));
    });
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
  const { A, door } = buildLibRoom(room, lib.meetScene, lib.meetNav, meetMeta, 'B+ 會議／試播室');
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
  // B+ upgrade (meeting M202611030011skun): kanban wall (west), 1080p 16:9 trial projection (east), rotatable portrait monitor
  const kb = panel(2.4, 1.35, 1024, 576, 0x222a33); kb.mesh.position.set(room.x0 + .12, 1.55, -(room.y0 + 3.2)); kb.mesh.rotation.y = Math.PI / 2;
  scene.add(kb.mesh); room.extra.push(kb.mesh); floor.kanban = kb; kb.mesh.userData.screen = 'kanban';
  const tr = panel(2.2, 1.24, 768, 432, 0x222a33); tr.mesh.position.set(room.x0 + 7.88, 1.62, -(room.y0 + 2.3)); tr.mesh.rotation.y = -Math.PI / 2;
  scene.add(tr.mesh); room.extra.push(tr.mesh); floor.trial = tr; tr.mesh.userData.screen = 'trial';
  const pm = panel(.36, .64, 216, 384, 0x1d242c, .6); pm.mesh.position.set(room.x0 + 7.5, 1.22, -(room.y0 + 4.05)); pm.mesh.rotation.y = -Math.PI / 2;
  scene.add(pm.mesh); room.extra.push(pm.mesh); floor.portrait = pm; pm.mesh.userData.screen = 'portrait'; drawPortrait(pm);
}
// A canvas screen with a bezel and a stand leg.
function panel(w, h, cw, ch, frameColor, legH = 0) {
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  const fm = new THREE.MeshStandardMaterial({ color: frameColor });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + .1, h + .1, .05), fm); frame.position.z = -.035; mesh.add(frame);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(.07, legH || Math.max(.2, 1.55 - h / 2 - .9), .07), fm);
  leg.position.set(0, -h / 2 - (legH || Math.max(.2, 1.55 - h / 2 - .9)) / 2, -.05); mesh.add(leg);
  return { mesh, cv, ctx: cv.getContext('2d'), tex };
}
function drawKanban() {
  const kb = floor && floor.kanban; if (!kb) return;
  const list = [...agents.values()].sort((a, b) => ORDER.indexOf(a.mode) - ORDER.indexOf(b.mode) || nickOf(a.group).localeCompare(nickOf(b.group)));
  const sig = JSON.stringify(list.map(a => [nickOf(a.group), a.mode, a.group.pending || 0, colorOf(a.group)])); if (sig === kb.sig) return; kb.sig = sig;
  const x = kb.ctx; x.fillStyle = '#0f1a24'; x.fillRect(0, 0, 1024, 576); x.textBaseline = 'middle';
  x.fillStyle = '#e3ecf3'; x.font = `800 38px ${F}`; x.fillText('看板牆 · 代理人進度', 36, 44);
  const cnt = {}; for (const a of list) cnt[a.mode] = (cnt[a.mode] || 0) + 1;
  x.font = `500 22px ${F}`; let cx = 520;
  for (const k of ORDER) if (cnt[k]) { x.fillStyle = css(STATES[k].tok) || '#ccc'; x.beginPath(); x.arc(cx, 46, 8, 0, 7); x.fill(); x.fillStyle = '#b9c7d3'; x.fillText(`${STATES[k].label} ${cnt[k]}`, cx + 14, 46); cx += x.measureText(`${STATES[k].label} ${cnt[k]}`).width + 40; }
  x.fillStyle = '#253647'; x.fillRect(36, 80, 952, 2);
  const rows = Math.ceil(list.length / 2) || 1, rh = Math.min(70, 470 / rows);
  list.forEach((a, i) => { const col = i < rows ? 0 : 1, row = col ? i - rows : i, bx = 36 + col * 484, by = 100 + row * rh;
    x.fillStyle = '#15222f'; x.beginPath(); x.roundRect(bx, by, 464, rh - 10, 10); x.fill();
    x.fillStyle = colorOf(a.group); x.fillRect(bx, by, 8, rh - 10);
    x.fillStyle = css(STATES[a.mode].tok) || '#ccc'; x.beginPath(); x.arc(bx + 34, by + (rh - 10) / 2, 10, 0, 7); x.fill();
    x.fillStyle = '#e3ecf3'; x.font = `700 ${Math.round(rh * .42)}px ${F}`; x.fillText(nickOf(a.group), bx + 56, by + (rh - 10) / 2);
    x.fillStyle = '#8ea1b2'; x.font = `500 ${Math.round(rh * .32)}px ${F}`; x.textAlign = 'right';
    x.fillText(STATES[a.mode].label + (a.group.pending ? ` · 待辦 ${a.group.pending}` : '') + ' · ' + (a.group.team ? a.group.team.label : ''), bx + 448, by + (rh - 10) / 2); x.textAlign = 'left'; });
  kb.tex.needsUpdate = true;
}
function drawTrial(t) {   // 1080p 16:9 trial projection: a looping slide with a turbine and a timeline scrubber
  const tr = floor && floor.trial; if (!tr) return;
  const x = tr.ctx, W = 768, H = 432, f = (t * .06) % 1;
  const grd = x.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#173d55'); grd.addColorStop(1, '#3f86a6'); x.fillStyle = grd; x.fillRect(0, 0, W, H);
  x.textBaseline = 'middle'; x.fillStyle = '#ffffff'; x.font = `800 30px ${F}`; x.fillText('試播 · 1920×1080 · 16:9', 28, 40);
  x.fillStyle = 'rgba(255,255,255,.75)'; x.font = `500 18px ${F}`; x.fillText('簡報／動畫實測與 QA 截圖比對', 28, 76);
  const cx = 560, cy = 190; x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 6; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, 372); x.stroke();
  x.fillStyle = '#ffffff'; for (let k = 0; k < 3; k++) { x.save(); x.translate(cx, cy); x.rotate(t * 1.4 + k * 2.094); x.beginPath(); x.moveTo(-5, 0); x.quadraticCurveTo(-10, -50, 0, -104); x.quadraticCurveTo(10, -50, 5, 0); x.fill(); x.restore(); }
  x.beginPath(); x.arc(cx, cy, 8, 0, 7); x.fill();
  for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(255,255,255,' + (i / 4 < f ? .9 : .35) + ')'; x.fillRect(28, 130 + i * 44, 300 - i * 40, 16); }
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, H - 40, W, 40); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(28, H - 22, W - 56, 4);
  x.fillStyle = '#ffcf5a'; x.fillRect(28, H - 22, (W - 56) * f, 4); x.beginPath(); x.arc(28 + (W - 56) * f, H - 20, 8, 0, 7); x.fill();
  tr.tex.needsUpdate = true;
}
function drawPortrait(pm) {   // rotatable portrait monitor: exam sheet vs. answer key side by side
  const x = pm.ctx; x.fillStyle = '#f7f9fb'; x.fillRect(0, 0, 216, 384); x.fillStyle = '#14202b'; x.font = `700 20px ${F}`; x.textBaseline = 'middle';
  x.fillText('題卷 ↔ 解答', 14, 26); x.fillStyle = '#d5dce3'; x.fillRect(14, 46, 188, 2);
  for (let i = 0; i < 9; i++) { x.fillStyle = '#9aa8b5'; x.fillRect(14, 64 + i * 34, 120 + (i * 37) % 60, 10); x.fillStyle = i % 3 === 2 ? '#c0392b' : '#2c8547'; x.fillRect(184, 62 + i * 34, 14, 14); }
  pm.tex.needsUpdate = true;
}

// D recording studio (same meeting): mic desk with acoustic shield, a 9:16 shooting spot with ring light and backdrop, ON AIR light.
function buildStudio(room) {
  const { x0, y0, w, d } = room, g = new THREE.Group(), dx = x0 + 1.4;
  const M = (c, r = .8, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...(e ? { emissive: e, emissiveIntensity: .9 } : {}) });
  const box = (sx, sy, sz, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); g.add(o); return o; };
  const cyl = (rt, rb, h, m, x, y, z) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 12), m); o.position.set(x, y, z); g.add(o); return o; };
  floorPlane(g, x0, y0, x0 + w, y0 + d, 0x3a3f4a, .55, .002);
  wall(g, x0, y0, x0, y0 + d); wall(g, x0 + w, y0, x0 + w, y0 + d); wall(g, x0, y0 + d, x0 + w, y0 + d);
  wall(g, x0, y0, dx - .6, y0); wall(g, dx + .6, y0, x0 + w, y0);
  navRect(x0 + .3, y0 + .3, x0 + w - .3, y0 + d - .3); navRect(dx - .45, y0 - .6, dx + .45, y0 + .6);
  const sign = textPlane('錄課棚', '#c0392b', 3.2, .8); sign.position.set(x0 + w / 2, .02, -(y0 + .8)); g.add(sign);
  // acoustic foam on the inside of the north and west walls
  const foam = M(0x2a2f3a, 1);
  for (let i = 0; i < 9; i++) box(.5, .8, .06, foam, x0 + .45 + i * .6, .5, -(y0 + d - .1));
  for (let i = 0; i < 6; i++) box(.06, .8, .5, foam, x0 + .1, .5, -(y0 + .7 + i * .8));
  // mic desk (north), facing north
  const desk = M(0x8a7a66, .7), dark = M(0x1d222b, .5), metal = M(0x9aa3ad, .35);
  const deskX = x0 + 2.4, deskY = y0 + d - 1.3;
  box(1.6, .06, .7, desk, deskX, .75, -deskY); for (const sx of [-.72, .72]) box(.05, .72, .6, desk, deskX + sx, .37, -deskY);
  cyl(.012, .012, .35, metal, deskX + .15, .95, -(deskY - .12)); const mic = cyl(.04, .03, .14, dark, deskX + .15, 1.15, -(deskY - .12)); mic.rotation.x = .5;
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .2, 14, 1, true, Math.PI * .5, Math.PI), M(0x3b4250, 1)); shield.material.side = THREE.DoubleSide;
  shield.position.set(deskX + .15, 1.15, -(deskY - .02)); g.add(shield);
  box(.55, .34, .03, dark, deskX - .4, 1.0, -(deskY + .2));
  box(.5, .04, .45, M(0x4a5260, .9), deskX, .46, -(deskY - .75));   // stool
  cyl(.03, .03, .44, metal, deskX, .22, -(deskY - .75));
  // 9:16 shooting spot (east): backdrop, phone on a tripod with a ring light, two softboxes
  const sx0 = x0 + w - .35, sy = y0 + 2.3;
  box(.04, 1.7, 1.6, M(0x5d7f8f, 1), sx0, .85, -sy);
  const camX = sx0 - 1.9; for (const a of [0, 2.1, 4.2]) { const lg = cyl(.012, .012, 1.2, dark, camX + Math.cos(a) * .12, .6, -(sy + Math.sin(a) * .12)); lg.rotation.set(Math.sin(a) * .2, 0, -Math.cos(a) * .2); }
  box(.02, .3, .16, dark, camX + .02, 1.3, -sy);
  const ringMat = M(0xffffff, .3, 0xfff2d6);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.2, .025, 8, 28), ringMat); ring.position.set(camX, 1.3, -sy); ring.rotation.y = Math.PI / 2; g.add(ring);
  for (const oy of [-1.05, 1.05]) { cyl(.015, .015, 1.5, dark, camX + .5, .75, -(sy + oy)); const sb = box(.08, .45, .45, M(0xffffff, .4, 0xfff6e8), camX + .55, 1.55, -(sy + oy)); sb.rotation.y = oy > 0 ? -.5 : .5; }
  // ON AIR light above the door, facing the corridor
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const air = new THREE.Mesh(new THREE.PlaneGeometry(.9, .34), new THREE.MeshBasicMaterial({ map: tex }));
  air.position.set(dx + 1.05, 1.3, -(y0 - .02)); g.add(air);   // faces the corridor (+z)
  const airBack = new THREE.Mesh(new THREE.BoxGeometry(.96, .4, .05), dark); airBack.position.set(dx + 1.05, 1.3, -(y0 + .015)); g.add(airBack);
  cyl(.02, .02, .3, dark, dx + 1.05, 1.0, -(y0 + .02));
  floor.onAir = { cv, ctx: cv.getContext('2d'), tex, on: null };
  setOnAir(false);
  room.anchors = {
    spots: [{ id: room.id + ':desk', type: 'SEAT', use: 'studio', position: [deskX, deskY - .75, 0], yaw_deg: 0 },
            { id: room.id + ':cam', type: 'STAND', position: [sx0 - .6, sy, 0], yaw_deg: 90 }],
    door: { id: room.id + ':door', type: 'STAND', position: [dx, y0 - .8, 0], yaw_deg: 0 }
  };
  navRect(deskX - .85, deskY - .4, deskX + .85, deskY + .4, false);
  navRect(camX - .25, sy - .25, camX + .25, sy + .25, false);
  room.group = g; scene.add(g);
  addDevice(room, room.anchors.spots[0], g, null);
}
// Soundproof phone booth (A 辦公室升級) at a corridor end: glass box, shelf, stool, busy lamp on the roof. dir = which way the opening faces (+1 east).
function buildBooth(fl, x0, D, CORR, dir) {
  const g = new THREE.Group(), w = 1.2, d = 1.4, y0 = D + (CORR - d) / 2, cx = x0 + w / 2, cy = y0 + d / 2, H = 2.1;
  const frame = new THREE.MeshStandardMaterial({ color: 0x2b333d, roughness: .5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe3f2, transparent: true, opacity: .28, roughness: .1, depthWrite: false });
  const felt = new THREE.MeshStandardMaterial({ color: 0x4f6b5e, roughness: 1 });
  const box = (sx, sy, sz, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, -z); g.add(o); return o; };
  const backX = dir > 0 ? x0 : x0 + w, openX = dir > 0 ? x0 + w : x0;
  box(w, .06, d, frame, cx, .03, cy); box(w + .04, .08, d + .04, frame, cx, H, cy);   // floor + roof
  box(.05, H, d, felt, backX + dir * .03, H / 2, cy);                                     // felt back wall
  for (const sy of [y0, y0 + d]) box(w, H - .1, .03, glass, cx, H / 2, sy);               // glass side walls
  box(.03, H - .1, d * .5, glass, openX, H / 2, y0 + d * .25);                              // half glass front, door opening on the other half
  for (const [px, py] of [[x0, y0], [x0 + w, y0], [x0, y0 + d], [x0 + w, y0 + d]]) box(.05, H, .05, frame, px, H / 2, py);
  box(.3, .04, .9, new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: .7 }), backX + dir * .2, 1.0, cy);   // shelf
  box(.36, .03, .22, new THREE.MeshStandardMaterial({ color: 0x1d242c }), backX + dir * .16, 1.25, cy).rotation.z = dir * .25;   // laptop screen
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x3fbf6a, emissive: 0x3fbf6a, emissiveIntensity: .8 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.07, 12, 10), lampMat); lamp.position.set(cx, H + .1, -cy); g.add(lamp);
  navRect(x0 - .05, y0 - .05, x0 + w + .05, y0 + d + .05, false);
  navRect(Math.min(backX, openX) + (dir > 0 ? .3 : .25), y0 + .25, Math.max(backX, openX) - (dir > 0 ? .25 : .3), y0 + d - .25);   // inside
  navRect(Math.min(openX, openX + dir * .6) - .05, y0 + d * .55, Math.max(openX, openX + dir * .6) + .05, y0 + d - .2);   // through the opening
  scene.add(g); fl.extra.push(g);
  const seat = { id: 'booth' + (dir > 0 ? 'W' : 'E'), type: 'STAND', use: 'booth', position: [backX + dir * .62, cy, 0], yaw_deg: dir > 0 ? 90 : -90 };
  const room = { id: seat.id, kind: 'booth', label: '電話亭', extra: [] };
  addDevice(room, seat, g, null);
  return { seat, lampMat, room, busy: null };
}
function setBoothLamp(b, busy) { if (b.busy === busy) return; b.busy = busy; const c = busy ? 0xe0463c : 0x3fbf6a; b.lampMat.color.set(c); b.lampMat.emissive.set(c); }
function setOnAir(on) {
  const a = floor && floor.onAir; if (!a || a.on === on) return; a.on = on;
  const x = a.ctx; x.fillStyle = on ? '#d2202a' : '#3a3f48'; x.fillRect(0, 0, 256, 96);
  x.fillStyle = on ? '#ffffff' : '#8a929c'; x.font = `800 52px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ON AIR', 128, 50);
  a.tex.needsUpdate = true;
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
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));   // the seat's right-hand side
  const bez = new THREE.MeshStandardMaterial({ color: 0x1d242c });
  const monitor = (w, h, m, dx, turn) => {   // dual monitors (A 辦公室升級): main + a smaller one angled in on the right
    const hd = new THREE.Group(); hd.position.set(p.x + side.x * dx, north ? 1.5 : 1.1, p.z + side.z * dx); hd.rotation.y = yaw + turn;
    hd.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), m));
    const bk = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); bk.rotation.y = Math.PI; bk.position.z = -.03; hd.add(bk);
    const bz = new THREE.Mesh(new THREE.BoxGeometry(w + .06, h + .06, .02), bez); bz.position.z = -.015; hd.add(bz);
    const st = new THREE.Mesh(new THREE.BoxGeometry(.05, north ? .78 : .38, .05), bez); st.position.set(0, north ? -.64 : -.44 + (.52 - h) / 2, -.03); hd.add(st);
    group.add(hd); return hd;
  };
  const holder = monitor(.82, .46, mat, -.2, 0);
  const cv2 = document.createElement('canvas'); cv2.width = 256; cv2.height = 160;
  const tex2 = new THREE.CanvasTexture(cv2); tex2.colorSpace = THREE.SRGBColorSpace;
  const holder2 = monitor(.5, .31, new THREE.MeshBasicMaterial({ map: tex2 }), .52, -.35);
  const scr = { seat, cv, ctx: cv.getContext('2d'), tex, sig: '', agent: null, cv2, ctx2: cv2.getContext('2d'), tex2, sig2: '', holders: [holder, holder2] };
  for (const h of scr.holders) h.userData.deskScreen = seat.id;
  (floor.screens || (floor.screens = new Map())).set(seat.id, scr);
  drawOff(scr);
}
function drawOff(scr) { const x = scr.ctx; x.fillStyle = '#0d1218'; x.fillRect(0, 0, 384, 216); scr.tex.needsUpdate = true; scr.sig = 'off';
  if (scr.ctx2) { scr.ctx2.fillStyle = '#0d1218'; scr.ctx2.fillRect(0, 0, 256, 160); scr.tex2.needsUpdate = true; scr.sig2 = 'off'; } }
function drawSecond(scr, ag) {   // right-hand monitor: the agent's latest records
  const g = ag.group, list = (g.list || []).slice(0, 4), sig = list.map(r => r.ts + r.topic).join('|'); if (sig === scr.sig2) return; scr.sig2 = sig;
  const x = scr.ctx2; x.fillStyle = '#16232f'; x.fillRect(0, 0, 256, 160); x.textBaseline = 'middle';
  x.fillStyle = '#8ea1b2'; x.font = `700 15px ${F}`; x.fillText('最近紀錄', 10, 14);
  list.forEach((r, i) => { const y = 40 + i * 31;
    x.fillStyle = '#5ec1d8'; x.font = `500 13px ${F}`; x.fillText(new Date(r.ts).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }), 10, y);
    x.fillStyle = '#e3ecf3'; x.font = `500 15px ${F}`; x.fillText(wrapText(x, r.topic, 190, 1)[0] || '', 58, y); });
  scr.tex2.needsUpdate = true;
}
// Electric sit-stand desk: the library desk rises on two lift columns, the keyboard and monitors go with it, the chair rolls back.
const LIFT = .36;
function addLift(group, seat, desk, kb, chair) {
  if (!desk) return;
  desk.updateWorldMatrix(true, true);
  const bb = new THREE.Box3().setFromObject(desk), mat = new THREE.MeshStandardMaterial({ color: 0x3a424c, roughness: .4, metalness: .3 });
  const cols = [bb.min.x + .12, bb.max.x - .12].map(cx => { const c = new THREE.Mesh(new THREE.BoxGeometry(.07, 1, .07), mat);
    c.position.set(cx, 0, (bb.min.z + bb.max.z) / 2); c.scale.y = .001; c.visible = false; group.add(c); return c; });
  const yaw = seat.yaw_deg * Math.PI / 180, back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  seat.rig = { desk, kb, chair, cols, lift: 0, target: 0, y0: { desk: desk.position.y, kb: kb ? kb.position.y : 0 }, c0: chair ? chair.position.clone() : null, back };
}
function updateLift(seat, dt) {
  const r = seat.rig; if (!r || Math.abs(r.target - r.lift) < 1e-4) return;
  r.lift += Math.sign(r.target - r.lift) * Math.min(Math.abs(r.target - r.lift), .16 * dt);   // ~2 s from sitting to standing
  r.desk.position.y = r.y0.desk + r.lift; if (r.kb) r.kb.position.y = r.y0.kb + r.lift;
  for (const c of r.cols) { c.visible = r.lift > .01; c.scale.y = Math.max(.001, r.lift); c.position.y = r.lift / 2; }
  if (r.chair) r.chair.position.copy(r.c0).addScaledVector(r.back, .45 * r.lift / LIFT);
  const scr = floor.screens.get(seat.id); if (scr) scr.holders.forEach(h => { h.position.y = (seat.yaw_deg === 180 ? 1.5 : 1.1) + r.lift; });
}
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
  if (working) {   // status screen showing the newest work, redrawn only when it changes
    const a = actOf(g), sig = ['w', a.ts, a.topic, a.content, a.status, g.pending, color].join('|'); if (sig === scr.sig) return; scr.sig = sig;
    const kind = a.kind === 'ack' ? '回報指令' + (ACK_ZH[a.status] ? '・' + ACK_ZH[a.status] : '') : a.kind === 'say' ? '會議發言' : '工作紀錄';
    x.fillStyle = '#f4f8fb'; x.fillRect(0, 0, 384, 216);
    x.fillStyle = color; x.fillRect(0, 0, 384, 34);
    x.fillStyle = '#0b141c'; x.font = `700 20px ${F}`; x.textBaseline = 'middle'; x.fillText(nickOf(g) + ' · ' + (g.team ? g.team.label : ''), 12, 18);
    x.textAlign = 'right'; x.font = `700 18px ${F}`; x.fillText(hhmm(a.ts), 372, 18); x.textAlign = 'left';
    x.fillStyle = '#1f8a45'; x.font = `700 18px ${F}`; x.fillText('● 工作中 · ' + kind, 12, 56);
    x.fillStyle = '#14202b'; x.font = `700 24px ${F}`; wrapText(x, a.topic, 360, 2).forEach((l, i) => x.fillText(l, 12, 90 + i * 30));
    x.fillStyle = '#4a5866'; x.font = `400 16px ${F}`; wrapText(x, a.content || '', 360, 2).forEach((l, i) => x.fillText(l, 12, 152 + i * 21));
    if (g.pending) { x.fillStyle = '#b8700c'; x.font = `700 16px ${F}`; x.textAlign = 'right'; x.fillText(`待辦指令 ${g.pending}`, 372, 56); x.textAlign = 'left'; }
    scr.tex.needsUpdate = true; return;
  }
  // screensaver: a turning wind turbine, the clock and where the agent went
  scr.sig = 's';
  const away = ag.mode === 'meet' ? '開會中' : ag.mode === 'rest' ? '休息中' : ag.mode === 'patrol' ? '巡檢中' : ag.mode === 'present' ? '報告中' : ag.mode === 'record' ? '錄製中' : ag.mode === 'call' ? '通話中' : ag.mode === 'idle' ? '閒置' : '離開座位';
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
  const line = ag.mode === 'meet' && g.meetMsg ? g.meetMsg.meetingTitle : ag.mode === 'rest' && ag.activity ? ag.activity : actOf(g).topic;
  wrapText(x, line, 210, 2).forEach((l, i) => x.fillText(l, 14, 150 + i * 20));
  scr.tex.needsUpdate = true;
}
function drawProjector() {
  const pj = floor && floor.projector; if (!pj) return;
  const cur = lastMeetings.find(q => q.open && q.id === floor.meeting.meetingId) || null, last = lastMeetings[0] || null;
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

// Meeting rooms 2 & 3 and project offices: a table with chairs, a wall screen, door to the corridor.
function buildTableRoom(room, opt) {
  const { x0, y0, w, d } = room, g = new THREE.Group(), dx = x0 + w / 2, south = opt.door === 'S';
  const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 });
  const box = (sx, sy, sz, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, -z); g.add(o); return o; };
  floorPlane(g, x0, y0, x0 + w, y0 + d, opt.color, .16, .002);
  const doorY = south ? y0 : y0 + d, backY = south ? y0 + d : y0;
  wall(g, x0, y0, x0, y0 + d); wall(g, x0 + w, y0, x0 + w, y0 + d); wall(g, x0, backY, x0 + w, backY);
  wall(g, x0, doorY, dx - .6, doorY); wall(g, dx + .6, doorY, x0 + w, doorY);
  navRect(x0 + .3, y0 + .3, x0 + w - .3, y0 + d - .3); navRect(dx - .45, doorY - .6, dx + .45, doorY + .6);
  const sign = textPlane(opt.sign, opt.signColor, Math.min(w - .6, 5), 1.1); sign.position.set(dx, .02, -(south ? y0 + .75 : y0 + d - .75)); g.add(sign);
  // table + chairs (people sit on both long sides, facing the table)
  const n = opt.seats || 6, per = Math.ceil(n / 2), tw = Math.max(2.2, per * .85), cy = y0 + d / 2 + (south ? .25 : -.25);
  const wood = M(0x9b7b57), dark = M(0x39414b), cloth = M(opt.color);
  box(tw, .06, 1.0, wood, dx, .74, cy); for (const sx of [-tw / 2 + .12, tw / 2 - .12]) box(.08, .72, .8, dark, dx + sx, .36, cy);
  navRect(dx - tw / 2 - .1, cy - .55, dx + tw / 2 + .1, cy + .55, false);
  const seats = [];
  for (let i = 0; i < n; i++) {
    const side = i < per ? 1 : -1, j = i < per ? i : i - per, cnt = i < per ? per : n - per;
    const sx = dx + (j - (cnt - 1) / 2) * .85, sy = cy + side * .95;
    seats.push({ id: room.id + ':seat' + i, type: 'SEAT', position: [sx, sy, 0], yaw_deg: side > 0 ? 180 : 0 });
    box(.46, .07, .46, cloth, sx, .45, sy); box(.46, .5, .06, cloth, sx, .72, sy + side * .23); box(.05, .42, .05, dark, sx, .22, sy);
  }
  // wall screen on the far wall, facing into the room
  const scr = panel(opt.seats ? 2.2 : 1.8, opt.seats ? 1.24 : 1.0, 768, 432, 0x222a33);
  scr.mesh.position.set(dx, 1.5, -(south ? y0 + d - .12 : y0 + .12)); if (!south) scr.mesh.rotation.y = Math.PI;
  scr.mesh.userData.screen = room.kind; scr.mesh.userData.roomId = room.id; g.add(scr.mesh);
  room.screen = scr; room.sig = '';
  room.anchors = { seats, door: { id: room.id + ':door', type: 'STAND', position: [dx, south ? y0 - .8 : y0 + d + .8, 0], yaw_deg: 0 } };
  room.group = g; scene.add(g);
}
// Which room a meeting is held in: the biggest open meeting gets B+, the next two the small rooms, the rest share B+.
function assignMeetRooms() {
  meetAssign = new Map(); if (!floor) return;
  const rooms = [floor.meeting, ...(floor.smallMeets || [])];
  const size = q => (q.agenda && q.agenda.attendees || []).length;
  const open = lastMeetings.filter(q => q.open).sort((a, b) => size(b) - size(a) || b.lastTs - a.lastTs || (a.id < b.id ? -1 : 1));
  for (const r of rooms) r.meetingId = null;
  open.slice(0, rooms.length).forEach((q, i) => { meetAssign.set(q.id, rooms[i]); rooms[i].meetingId = q.id; });
}
const meetRoomOf = id => (id && meetAssign.get(id)) || floor.meeting;
const meetKeyOf = g => g.meetMsg ? meetRoomOf(g.meetMsg.meeting_id).id : '';
const projKeyOf = g => { const a = actOf(g); return a.project_id && floor && floor.byProject && floor.byProject.has(a.project_id) ? a.project_id : ''; };
const projRoomOf = g => { const k = projKeyOf(g); return k ? floor.byProject.get(k) : null; };
// small meeting room screens (which meeting is on) and project office boards (goal, members, progress)
function drawRoomScreens() {
  if (!floor) return;
  for (const r of floor.rooms) {
    if (!r.screen) continue;
    const x = r.screen.ctx, W = 768, H = 432;
    if (r.kind === 'smallmeet') {
      const q = r.meetingId ? lastMeetings.find(m => m.id === r.meetingId) : null;
      const sig = JSON.stringify(q ? [q.id, q.title, q.msgs.length] : ['none']); if (sig === r.sig) continue; r.sig = sig;
      x.fillStyle = '#f6f8fa'; x.fillRect(0, 0, W, H); x.textBaseline = 'middle';
      x.fillStyle = '#14202b'; x.font = `800 40px ${F}`; x.fillText(r.label, 30, 50);
      if (q) {
        x.fillStyle = '#b8700c'; x.beginPath(); x.roundRect(30, 96, 130, 46, 23); x.fill(); x.fillStyle = '#fff'; x.font = `800 26px ${F}`; x.fillText('會議中', 52, 120);
        x.fillStyle = '#14202b'; x.font = `800 38px ${F}`; wrapText(x, q.title, 700, 2).forEach((l, i) => x.fillText(l, 30, 196 + i * 50));
        const ag = q.agenda || {}; x.fillStyle = '#566676'; x.font = `500 26px ${F}`;
        x.fillText(`主持 ${ag.host ? partyName(ag.host) : '—'} · 與會 ${(ag.attendees || []).length} 人 · 發言 ${q.msgs.length} 則`, 30, 330);
      } else { x.fillStyle = '#7a8794'; x.font = `600 30px ${F}`; x.fillText('目前沒有會議', 30, 200); }
    } else if (r.kind === 'project') {
      const pj = lastProjects.find(q => q.id === r.pid);
      const sig = JSON.stringify(pj || ['none']); if (sig === r.sig) continue; r.sig = sig;
      x.fillStyle = '#f4f6fd'; x.fillRect(0, 0, W, H); x.textBaseline = 'middle';
      x.fillStyle = '#4a5bc0'; x.fillRect(0, 0, W, 64); x.fillStyle = '#fff'; x.font = `800 32px ${F}`; x.fillText('專案 · ' + (wrapText(x, pj ? pj.title : '', 560, 1)[0] || ''), 24, 34);
      if (pj) {
        x.fillStyle = '#2a3346'; x.font = `500 24px ${F}`; wrapText(x, pj.goal || '', 720, 3).forEach((l, i) => x.fillText(l, 24, 104 + i * 34));
        x.fillStyle = '#566676'; x.font = `600 24px ${F}`; x.fillText(`負責人 ${pj.lead} · 成員 ${pj.members.length} 人${pj.openMeetings ? ` · 進行中會議 ${pj.openMeetings}` : ''}`, 24, 230);
        x.font = `500 22px ${F}`; wrapText(x, pj.members.join('、'), 720, 1).forEach(l => x.fillText(l, 24, 268));
        const frac = pj.total ? pj.done / pj.total : 0;
        x.fillStyle = '#d9def2'; x.beginPath(); x.roundRect(24, 320, 720, 28, 14); x.fill();
        x.fillStyle = '#4a5bc0'; x.beginPath(); x.roundRect(24, 320, Math.max(28, 720 * frac), 28, 14); x.fill();
        x.fillStyle = '#2a3346'; x.font = `700 24px ${F}`; x.fillText(pj.total ? `指令完成 ${pj.done} / ${pj.total}` : '還沒有指令', 24, 384);
      }
    }
    r.screen.tex.needsUpdate = true;
  }
}

function clearFloor() {
  if (!floor) return;
  for (const r of floor.rooms) { if (r.group) scene.remove(r.group); (r.extra || []).forEach(o => scene.remove(o)); }
  projSig = '';
  (floor.extra || []).forEach(o => scene.remove(o));
  nav.walk.clear(); floor = null;
}

// Lay out: team offices along the south side of a corridor, meeting room (and the shared room if needed) on the north side.
function buildFloor(teams, needShared, projects = []) {
  clearFloor();
  const D = 7, CORR = 2.6, GAP = .5, rooms = [];
  let x = 0;
  for (const t of teams) {
    const pods = Math.max(1, Math.ceil((t.count + 1) / 4)), w = Math.max(7, 2.2 + pods * 3.4 + 1.4);
    rooms.push({ id: 'office:' + t.key, kind: 'office', team: t.key, label: t.label, color: t.color, pods, x0: x, y0: 0, w, d: D, doorSide: 'N' });
    x += w + GAP;
  }
  for (const pj of projects) { rooms.push({ id: 'proj:' + pj.id, kind: 'project', pid: pj.id, label: pj.title, x0: x, y0: 0, w: 7, d: D }); x += 7 + GAP; }   // 進行中的專案各一間
  const southW = Math.max(x - GAP, 8);
  const north = [{ id: 'meet', kind: 'meeting', w: 8, d: 6 }, { id: 'meet2', kind: 'smallmeet', label: '會議室 2', w: 5.5, d: 6 }, { id: 'meet3', kind: 'smallmeet', label: '會議室 3', w: 5.5, d: 6 },
    { id: 'pantry', kind: 'pantry', w: 8, d: 6 }, { id: 'studio', kind: 'studio', w: 6, d: 6 }];
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
  for (const r of rooms) r.kind === 'meeting' ? buildMeeting(r) : r.kind === 'pantry' ? buildPantry(r) : r.kind === 'studio' ? buildStudio(r)
    : r.kind === 'smallmeet' ? buildTableRoom(r, { door: 'S', color: 0xb88a3e, sign: r.label, signColor: '#a0701f' })
    : r.kind === 'project' ? buildTableRoom(r, { door: 'N', color: 0x5b6fd6, sign: '專案：' + r.label, signColor: '#4a5bc0', seats: 8 }) : buildOffice(r);
  // corridor waypoints for patrols
  floor.booths = [buildBooth(floor, .25, D, CORR, 1), buildBooth(floor, W - 1.45, D, CORR, -1)];
  floor.corridor = [0.15, 0.4, 0.65, 0.9].map((f, i) => ({ id: 'corr' + i, type: 'STAND', position: [W * f, D + CORR / 2, 0], yaw_deg: 0 }));
  floor.byTeam = new Map(rooms.filter(r => r.kind === 'office').map(r => [r.team, r]));
  floor.meeting = rooms.find(r => r.kind === 'meeting'); floor.pantry = rooms.find(r => r.kind === 'pantry'); floor.studio = rooms.find(r => r.kind === 'studio');
  floor.smallMeets = rooms.filter(r => r.kind === 'smallmeet'); floor.byProject = new Map(rooms.filter(r => r.kind === 'project').map(r => [r.pid, r]));
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
    case 'meet': { const mr = meetRoomOf(ag.group.meetMsg && ag.group.meetMsg.meeting_id).anchors; return claim(k, mr.seats) || jitter(mr.door, k, .8); }
    case 'present': return claim(k, meet.stands) || claim(k, home.anchors.board) || deskFor(ag);
    case 'call': { const bs = floor.booths.map(b => b.seat); return claim(k, bs) || jitter(bs[0], k, 1.2); }
    case 'record': { const st = floor.studio && floor.studio.anchors; return st ? claim(k, st.spots) || jitter(st.door, k, .8) : deskFor(ag); }
    case 'patrol': {
      const route = [home.anchors.board[0], home.anchors.water[0], home.anchors.door, ...floor.corridor, meet.door, home.anchors.door];
      return jitter(route[ag.step++ % route.length], k + ag.step, .35);
    }
    case 'rest': {   // rests at the desk; now and then a trip to the pantry (sometimes a chat at the table), then back
      const pt = floor.pantry && floor.pantry.anchors;
      if (!pt) return jitter(home.anchors.water[0], k, .6);
      if (ag.restPhase === 'desk') {
        const pick = [...pt.devices].sort(() => Math.random() - .5);
        const d = claim(k, pick) || jitter(pick[0], k, .5);
        ag.restPhase = 'device'; ag.device = d; ag.activity = USE_ZH[d.use] || '使用設備'; return d;
      }
      if (ag.restPhase === 'device') {
        const prev = ag.device && ag.device.use;
        ag.activity = prev === 'microwave' ? '吃便當' : prev === 'vending' || prev === 'fridge' ? '喝飲料' : '喝咖啡';
        const s = Math.random() < .3 && claim(k, [...pt.seats].sort(() => Math.random() - .5));
        if (s) { ag.restPhase = 'chat'; ag.activity += '聊天'; return s; }
      } else ag.activity = '';   // just started resting: stay at the desk first, so not everyone heads to the pantry at once
      ag.restPhase = 'desk'; return deskFor(ag);
    }
    default: { const pr = ag.mode === 'work' && projRoomOf(ag.group); return pr ? claim(k, pr.anchors.seats) || jitter(pr.anchors.door, k, .8) : deskFor(ag); }
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
  ag.wait = ag.mode === 'patrol' ? 2.5 + Math.random() * 2 : ag.mode === 'rest' ? (ag.restPhase === 'device' ? 6 + Math.random() * 3 : ag.restPhase === 'chat' ? 20 + Math.random() * 15 : 40 + Math.random() * 110) : Infinity;
}

// ---------- viewer-driven actions (local only: nothing is written to Drive) ----------
const ACTIONS = [
  ['wave', '打招呼'], ['stretch', '伸懶腰'], ['pantry', '去茶水間'], ['meet', '去會議室'],
  ['board', '到白板前'], ['studio', '去錄課棚'], ['call', '進電話亭'], ['stand', '站著工作'], ['patrol', '巡一圈'], ['desk', '回座位工作']
];
const ACT_NAME = Object.fromEntries(ACTIONS);
const now = () => clock.elapsedTime;
function say(ag, text, sec = 3) { ag.bubble.say(text, sec, now()); }
function devSay(dev, text, sec = 2.5) {
  if (!dev.bubble) { dev.bubble = makeBubble(); scene.add(dev.bubble.spr); (dev.room.kind === 'booth' ? floor.extra : (dev.room.extra || (dev.room.extra = []))).push(dev.bubble.spr);
    dev.bubble.spr.position.set(dev.pos.x, dev.tag.position.y + .25, dev.pos.z); }
  dev.bubble.say(text, sec, now());
}
function deviceStep(ag, dev) {
  const spot = claim(ag.key, [dev.anchor]) || jitter(dev.anchor, ag.key, .5);
  if (dev.use === 'booth') return { to: spot, anim: 'call', hold: 15, device: dev, say: '視訊通話中' };
  return dev.use === 'studio' ? { to: spot, anim: 'record', hold: 12, device: dev, say: '開始錄音' }
    : { to: spot, anim: 'use', hold: 7, device: dev, say: USE_ZH[dev.use] || '使用設備' };
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
    case 'stand': return [{ to: deskFor(ag), anim: 'work', hold: 45, stand: true, say: '站著工作' }];
    case 'call': { const b = floor.booths.find(b => !held.has(b.seat.id)); if (!b) return [];
      return [{ to: claim(k, [b.seat]), anim: 'call', hold: 20, say: '視訊通話中' }]; }
    case 'studio': { const st = floor.studio && floor.studio.anchors; if (!st) return [];
      return [{ to: claim(k, st.spots) || jitter(st.door, k, .8), anim: 'record', hold: 20, say: '開始錄製' }]; }
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
  } else { ag.group = g; const pk = projKeyOf(g);
    if (ag.mode !== mode || (mode === 'work' && pk !== ag.projKey) || (mode === 'meet' && meetKeyOf(g) !== ag.meetKey)) { ag.mode = mode; if (!ag.ov) goTo(ag, targetFor(ag)); } }   // a viewer action finishes first
  ag.projKey = projKeyOf(g); ag.meetKey = meetKeyOf(g);
  ag.mode = mode; ag.group = g;
  if (!(g.look && g.look.shirt)) ag.p.mats[0].color.set(color);
  ag.p.ring.material.color.set(color);
  setFaded(ag.p, mode === 'idle' && !ag.ov); ag.p.cup.visible = mode === 'rest';
  const topic = mode === 'meet' && g.meetMsg ? '說：' + g.meetMsg.content : mode === 'rest' && ag.activity ? ag.activity : actOf(g).topic;
  ag.label.set({ team: g.team ? g.team.label : '—', teamColor: color, name: nickOf(g), state: STATES[mode].label,
    stateColor: css(STATES[mode].tok) || '#ccc', topic, faded: mode === 'idle' });
  const desk = deskFor(ag), scr = floor.screens.get(desk.id); if (scr) scr.agent = ag;
}
function relabelAll() { if (lib) update(lastGroups, lastOpts); }

function update(groups, opts = {}) {
  lastGroups = groups; lastOpts = { fresh: opts.fresh || new Set(), active: opts.active !== false }; lastMeetings = opts.meetings || lastMeetings; lastProjects = opts.projects || lastProjects;
  if (!lib) return;
  // which offices are needed: the configured teams always get a room; everyone else shares one
  const counts = new Map(); let shared = 0;
  for (const g of groups) { if (OFFICE_TEAMS.includes(g.teamKey)) counts.set(g.teamKey, (counts.get(g.teamKey) || 0) + 1); else shared++; }
  const teams = OFFICE_TEAMS.map(k => {
    const g = groups.find(x => x.teamKey === k);
    return { key: k, label: g && g.team ? g.team.label : k.toUpperCase(), color: g ? colorOf(g) : (css('--muted') || '#888'), count: counts.get(k) || 0 };
  });
  const sig = JSON.stringify([teams.map(t => [t.key, Math.max(1, Math.ceil((t.count + 1) / 4)), t.color, t.label]), shared ? Math.ceil((shared + 1) / 4) : 0, css('--office-bg'), lastProjects.map(x => [x.id, x.title])]);
  if (sig !== layoutSig) {
    layoutSig = sig;
    for (const ag of agents.values()) { scene.remove(ag.p.g); scene.remove(ag.label.spr); scene.remove(ag.bubble.spr); }
    closeMenu();
    agents.clear(); deskOf.clear(); held.clear(); firstPlacement = true;
    buildFloor(teams, shared, lastProjects);
  }
  assignMeetRooms();
  const keep = new Set(groups.map(g => g.key));
  for (const [k, ag] of agents) if (!keep.has(k)) { scene.remove(ag.p.g); scene.remove(ag.label.spr); scene.remove(ag.bubble.spr); release(k); deskOf.delete(k); agents.delete(k); }
  for (const scr of floor.screens.values()) scr.agent = null;
  groups.forEach((g, i) => upsert(g, i));
  for (const scr of floor.screens.values()) if (!scr.agent && scr.sig !== 'off') drawOff(scr);
  if (groups.length) firstPlacement = false;
  drawProjector(); drawRoomScreens(); renderLegend();
}
function renderLegend() {
  const counts = {}; for (const ag of agents.values()) counts[ag.mode] = (counts[ag.mode] || 0) + 1;
  legend.replaceChildren();
  for (const k of ORDER) {
    const s = document.createElement('span'); s.style.setProperty('--c', `var(${STATES[k].tok})`);
    const i = document.createElement('i'); const b = document.createElement('b'); b.textContent = String(counts[k] || 0);
    s.append(i, STATES[k].label, b); legend.append(s);
  }
  const rv = document.createElement('button'); rv.type = 'button'; rv.textContent = '重設視角'; rv.onclick = () => { if (floor) { closeMenu(); fit(true); } }; legend.append(rv);
  const t = document.createElement('button'); t.type = 'button'; t.textContent = showNames ? '隱藏名牌' : '顯示名牌';
  t.onclick = () => { showNames = !showNames; try { localStorage.setItem('cloudlog.names', showNames ? '1' : '0'); } catch {} renderLegend(); };
  legend.append(t);
  if (floor) { const teamRooms = floor.rooms.filter(r => r.kind === 'office' && r.team !== '__shared').length, shared = floor.byTeam.has('__shared');
    const projRooms = floor.byProject ? floor.byProject.size : 0;
    info.textContent = box.clientWidth < 560 ? `${teamRooms} 間辦公室${projRooms ? ` · ${projRooms} 個專案` : ''} · ${agents.size} 位代理人` : `${teamRooms} 間團隊辦公室${shared ? ' ＋ 共用座位' : ''}${projRooms ? ` ＋ ${projRooms} 間專案辦公室` : ''} ＋ 3 間會議室 ＋ 茶水間 ＋ 錄課棚 ＋ 電話亭 · ${agents.size} 位代理人`; }
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
  { // sit-stand: at their own desk, working people sometimes raise the desk and stand for a while
    const desk = deskOf.get(ag.key), atDesk = desk && ag.target && ag.target.id === desk.id && !desk.shared && desk.rig;
    const step = ag.ov && ag.ov.steps[ag.ov.i], working = step ? step.anim === 'work' : ag.mode === 'work';
    if (atDesk && working) {
      if (step && step.stand) ag.standing = true;
      else if (!ag.standNext || t > ag.standNext) { ag.standing = Math.random() < .35; ag.standNext = t + 60 + Math.random() * 120; }
      const up = desk.rig.lift > LIFT * .6; ag.seated = !(ag.standing || up);
    } else if (ag.standing) { ag.standing = false; }
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
    case 'call': p.armR.rotation.x = 2.5; p.armR.rotation.z = -.55; p.head.rotation.z = .12; p.head.rotation.x = Math.max(0, Math.sin(t * 3 + ph)) * .1;
      p.armL.rotation.x = .4 + Math.max(0, Math.sin(t * 1.3 + ph)) * .6; break;
    case 'record': p.head.rotation.x = Math.max(0, Math.sin(t * 6 + ph)) * .08; p.head.rotation.y = Math.sin(t * .7 + ph) * .15;
      p.armR.rotation.x = 1.0 + Math.sin(t * 2.3 + ph) * .35; p.armL.rotation.x = ag.seated ? .9 : .5 + Math.sin(t * 1.7 + ph + 1) * .3; break;
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
  if (floor) for (const r of floor.rooms) if (r.anchors && r.anchors.seats) for (const st of r.anchors.seats) if (st.rig) {
    const scr = floor.screens.get(st.id), ag = scr && scr.agent; st.rig.target = ag && ag.standing ? LIFT : 0; updateLift(st, dt); }
  if (floor && t - (floor.scrT || 0) > .5) { floor.scrT = t; for (const scr of floor.screens.values()) if (scr.agent) { drawScreen(scr, scr.agent, t); drawSecond(scr, scr.agent); }
    drawKanban(); drawTrial(t);
    for (const b of floor.booths || []) { const dev = floor.devices.get(b.seat.id); setBoothLamp(b, held.has(b.seat.id) || !!(dev && (dev.runUntil > t || deviceUser(dev)))); }
    if (floor.studio) { const inside = ag => !ag.walking && ((ag.ov ? ag.ov.steps[ag.ov.i].anim === 'record' : ag.mode === 'record'));
      setOnAir([...agents.values()].some(inside) || [...floor.devices.values()].some(d => d.use === 'studio' && d.runUntil > t)); } }
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
  stepFly(t);
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
const menu = { el: null, track: null, below: false };
function closeMenu() { if (menu.el) menu.el.remove(); menu.el = null; menu.track = null; }
function placeMenu() {   // keep the menu next to the person / device it belongs to
  const el = menu.el, w = box.clientWidth, h = box.clientHeight;
  const v = menu.track().clone().project(camera);
  if (v.z > 1) return;
  const x = (v.x + 1) / 2 * w, y = (1 - v.y) / 2 * h, mw = el.offsetWidth, mh = el.offsetHeight;
  let left = x + 14, top = y - mh / 2;
  if (menu.below) { left = x - mw / 2; top = y + 12; }   // under a screen, so it doesn't cover it
  else if (left + mw > w - 8) left = x - mw - 14;
  left = Math.max(8, Math.min(left, w - mw - 8)); top = Math.max(8, Math.min(top, h - mh - 8));
  el.style.left = left + 'px'; el.style.top = top + 'px';
}
function showMenu(title, sub, items, track, note = true, below = false) {
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
  el.append(head, list); if (note) el.append(foot);
  for (const ev of ['pointerdown', 'pointerup', 'wheel']) el.addEventListener(ev, e => e.stopPropagation());
  box.append(el); menu.el = el; menu.track = track; menu.below = below; placeMenu();
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
// ---------- camera focus: clicking a room, a screen, a person or a device brings the camera to it ----------
const _q = new THREE.Quaternion(), FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function flyTo(t, p, sec = .9) {
  fly = { t0: clock.elapsedTime, sec, ft: controls.target.clone(), fp: camera.position.clone(), tt: t.clone(), tp: p.clone() };
  userMoved = true;
}
function stepFly(t) {
  if (!fly) return;
  const k = Math.min(1, (t - fly.t0) / fly.sec), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;   // ease in-out
  controls.target.lerpVectors(fly.ft, fly.tt, e); camera.position.lerpVectors(fly.fp, fly.tp, e);
  if (k >= 1) fly = null;
}
function fovs() { const vf = camera.fov * Math.PI / 180; return { vf, hf: 2 * Math.atan(Math.tan(vf / 2) * camera.aspect) }; }
function focusPoint(p, near) {   // pan to p keeping the viewing direction; come in to `near` metres when further away
  const off = camera.position.clone().sub(controls.target), d = off.length();
  const el = Math.min(1.1, Math.max(.5, Math.asin(off.y / d)));
  const flat = new THREE.Vector3(off.x, 0, off.z); if (flat.lengthSq() < 1e-6) flat.set(0, 0, 1); flat.normalize();
  flyTo(p, p.clone().addScaledVector(new THREE.Vector3(flat.x * Math.cos(el), Math.sin(el), flat.z * Math.cos(el)), Math.min(d, near)));
}
function focusFace(obj, w, h, el = .32, margin = 1.6) {   // look straight at a flat screen (its front is the local +z)
  if (camera.aspect < 1) margin = Math.min(margin, 1.15);   // phones: fill the narrow width, the menu goes under it
  obj.updateWorldMatrix(true, false);
  const c = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
  const n = new THREE.Vector3(0, 0, 1).applyQuaternion(obj.getWorldQuaternion(_q)); n.y = 0; n.normalize();
  const { vf, hf } = fovs(), dist = Math.max(controls.minDistance + .05, (w * margin / 2) / Math.tan(hf / 2), (h * margin / 2) / Math.tan(vf / 2));
  flyTo(c, c.clone().addScaledVector(new THREE.Vector3(n.x * Math.cos(el), Math.sin(el), n.z * Math.cos(el)), dist));
  return { c, right: new THREE.Vector3(n.z, 0, -n.x) };   // right-hand side as seen from the front
}
function focusRoom(r) {   // the whole room, seen from the same side as the floor overview
  const c = new THREE.Vector3(r.x0 + r.w / 2, .4, -(r.y0 + r.d / 2)), portrait = camera.aspect < 1;
  const dir = (portrait ? new THREE.Vector3(.62, 1.3, 0) : new THREE.Vector3(-.06, 1.25, .78)).normalize();
  const across = portrait ? r.d : r.w, along = portrait ? r.w : r.d, { vf, hf } = fovs();
  flyTo(c, c.clone().addScaledVector(dir, Math.max((across / 2 + .9) / Math.tan(hf / 2), (along / 2 + .9) * .9 / Math.tan(vf / 2))));
}
const ROOM_ZH = { meeting: 'B+ 會議／試播室', pantry: '茶水間', studio: '錄課棚' };
const roomName = r => ROOM_ZH[r.kind] || (r.kind === 'smallmeet' ? r.label : r.kind === 'project' ? '專案：' + r.label : r.team === '__shared' ? '共用座位' : r.label + ' 辦公室');
const inRoom = (r, v) => v.x >= r.x0 && v.x <= r.x0 + r.w && -v.z >= r.y0 && -v.z <= r.y0 + r.d;
const backItem = () => ({ label: '回到全景', cls: 'mut', run: () => fit(true) });
function roomMenu(r) {
  focusRoom(r);
  const here = [...agents.values()].filter(ag => inRoom(r, ag.p.g.position));
  const items = here.map(ag => ({ label: shortName(ag) + '（' + stateText(ag) + '）', dot: colorOf(ag.group),
    run: () => { focusPoint(ag.p.g.position.clone().setY(1), 8); personMenu(ag); return true; } }));
  if (!here.length) items.push({ label: '目前沒有人', disabled: true, run: () => {} });
  items.push(backItem());
  showMenu(roomName(r), here.length ? `${here.length} 位代理人在這裡` : '', items, () => new THREE.Vector3(r.x0 + r.w, 1, -(r.y0 + r.d / 2)), false);
}
const openPlan = () => { if (window.cloudlogBridge && window.cloudlogBridge.plan) window.cloudlogBridge.plan(); };
const SCREENS = {
  projector: { name: '會議室投影幕', sub: '進行中的會議；沒有時顯示上一場結論', w: 3.6, h: 2.03,
    open: ['打開會議紀錄', () => { if (window.cloudlogBridge) window.cloudlogBridge.meetings(floor.projector.meetingId || 'list'); }] },
  kanban: { name: '看板牆', sub: '每位代理人的即時狀態', w: 2.4, h: 1.35, open: ['打開規劃頁', openPlan] },
  trial: { name: '1080p 試播投影', sub: '16:9 試播畫面', w: 2.2, h: 1.24, open: ['打開規劃頁', openPlan] },
  portrait: { name: '直立副螢幕', sub: '題目卷與解答卷並排對照', w: .36, h: .64, open: null }
};
function screenMenu(kind, obj) {
  let S = SCREENS[kind];
  if (kind === 'smallmeet' || kind === 'project') { const r = floor.rooms.find(q => q.id === obj.userData.roomId) || {};
    S = kind === 'smallmeet' ? { name: (r.label || '會議室') + ' 螢幕', sub: r.meetingId ? '進行中的會議' : '目前沒有會議', w: 1.8, h: 1.0,
        open: r.meetingId ? ['打開會議紀錄', () => { if (window.cloudlogBridge) window.cloudlogBridge.meetings(r.meetingId); }] : null }
      : { name: '專案：' + (r.label || ''), sub: '目標、成員與指令進度', w: 2.2, h: 1.24, open: ['打開專案', () => { if (window.cloudlogBridge && window.cloudlogBridge.project) window.cloudlogBridge.project(r.pid); }] }; }
  const f = focusFace(obj, S.w, S.h), items = [];
  if (S.open) items.push({ label: S.open[0], cls: 'pri', run: S.open[1] });
  items.push(backItem());
  const narrow = camera.aspect < 1;
  showMenu(S.name, S.sub, items, () => narrow ? f.c.clone().setY(f.c.y - S.h / 2) : f.c.clone().addScaledVector(f.right, S.w / 2 + .15), false, narrow);
}
function deskScreenMenu(seatId) {   // close-up of someone's desk monitors
  const scr = floor.screens.get(seatId); if (!scr) return;
  const f = focusFace(scr.holders[0], .82, .46, .62, 1.9), ag = scr.agent, items = [];
  if (ag) items.push({ label: '查看紀錄與指令', cls: 'pri', run: () => { if (window.cloudlogBridge) window.cloudlogBridge.open(ag.key); } },
    { label: '讓他做…', run: () => { personMenu(ag); return true; } });
  items.push(backItem());
  const narrow = camera.aspect < 1;
  showMenu(ag ? shortName(ag) + ' 的螢幕' : '空座位', ag ? stateText(ag) : '', items, () => narrow ? f.c.clone().setY(f.c.y - .25) : f.c.clone().addScaledVector(f.right, .75), false, narrow);
}
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  if (!floor) return;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const targets = [...agents.values()].flatMap(ag => [ag.p.g, ...(showNames ? [ag.label.spr] : [])]);
  if (floor.projector) targets.push(floor.projector.mesh);
  if (floor.kanban) targets.push(floor.kanban.mesh, floor.trial.mesh);
  if (floor.portrait) targets.push(floor.portrait.mesh);
  for (const rm of floor.rooms) if (rm.screen) targets.push(rm.screen.mesh);
  for (const scr of floor.screens.values()) targets.push(...scr.holders);
  for (const dev of floor.devices.values()) targets.push(dev.hit, ...(showNames ? [dev.tag] : []));
  const hit = ray.intersectObjects(targets, true).find(h => h.object.visible || h.object.userData.device);
  const tagged = k => { for (let o = hit && hit.object; o; o = o.parent) if (o.userData[k] != null) return o; return null; };
  if (hit) {
    let o;
    if (tagged('projector')) { screenMenu('projector', floor.projector.mesh); return; }
    if (hit.object.userData.device) { const dev = hit.object.userData.device; focusPoint(dev.pos.clone().setY(.9), 6); deviceMenu(dev); return; }
    if ((o = tagged('screen'))) { screenMenu(o.userData.screen, o); return; }
    o = tagged('key');
    const key = o ? o.userData.key : [...agents.values()].find(ag => ag.label.spr === hit.object)?.key;
    const ag = key && agents.get(key);
    if (ag) { focusPoint(ag.p.g.position.clone().setY(1), 8); personMenu(ag); return; }
    if ((o = tagged('deskScreen'))) { deskScreenMenu(o.userData.deskScreen); return; }
  }
  // nothing clickable under the pointer: fly to the room that was clicked
  const pt = new THREE.Vector3();
  const room = ray.ray.intersectPlane(FLOOR_PLANE, pt) && floor.rooms.find(rm => inRoom(rm, pt));
  if (room) roomMenu(room); else closeMenu();
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
