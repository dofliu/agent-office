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
const LIB_LOUNGE = SCENE_BASE + 'scenes/005_lounge/';   // 休憩交誼區（2026-11-05 加入）
const USE_ZH = { coffee: '泡咖啡', microwave: '微波便當', juicer: '打果汁', fridge: '開冰箱', vending: '買飲料', sink: '洗杯子', water: '倒水', tv: '轉電視' };
const LOUNGE_ZH = { sofa: '坐沙發看電視', beanbag: '窩在懶骨頭', pool: '打撞球', foosball: '玩手足球' };
// Devices people (and the viewer) can operate. fx = glow colour; steam = little puffs while running; done = bubble when finished.
const DEV = {
  coffee:    { name: '咖啡機', act: '沖一杯咖啡', run: '沖煮中', fx: 0xfff1c9, steam: true, done: '咖啡好了 ☕' },
  juicer:    { name: '果汁機', act: '打一杯果汁', run: '攪打中', fx: 0xffa84a, done: '果汁好了 🍊' },
  microwave: { name: '微波爐', act: '加熱便當',   run: '加熱中', fx: 0xffb347, done: '叮！' },
  fridge:    { name: '冰箱',   act: '打開冰箱',   run: '門開著', fx: 0x9fd8ff, done: '關門' },
  vending:   { name: '販賣機', act: '買一瓶飲料', run: '出貨中', fx: 0xb9f0c4, done: '咚！' },
  sink:      { name: '水槽',   act: '開水龍頭',   run: '流水中', fx: 0x9fd8ff, done: '洗好了' },
  water:     { name: '飲水機', act: '倒一杯熱水', run: '出水中', fx: 0xbfe6ff, steam: true, done: '水好了' },
  studio:    { name: '錄音設備', act: '開始錄音', run: '錄音中', fx: 0xff5a4f, done: '錄好了' },
  tv:        { name: '電視',     act: '打開電視', run: '播放中', fx: 0x9fb8ff, done: '關電視' }
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
let showNames = true, slowHint = false;
// ---------- 風格（主題）：js/themes.js 定義外觀，這裡只負責套用；協作功能不受影響 ----------
const mergeTheme = (a, b) => { const o = { ...a }; for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' ? mergeTheme(a[k], b[k]) : b[k]; return o; };
const THEMES = { ...(window.AGENT_OFFICE_THEMES || {}) };
for (const k in (CFG.themes || {})) THEMES[k] = THEMES[k] ? mergeTheme(THEMES[k], CFG.themes[k]) : CFG.themes[k];   // config.js 可以加風格或只改幾個欄位
const THEME_BASE = (window.AGENT_OFFICE_THEMES || {}).default || {};
let themeName = 'default';
try { const q = /[?&]theme=([\w-]+)/.exec(location.search); themeName = (q && q[1]) || localStorage.getItem('cloudlog.theme') || CFG.theme || 'default'; } catch { themeName = CFG.theme || 'default'; }
if (!THEMES[themeName]) themeName = 'default';
let T = mergeTheme(THEME_BASE, THEMES[themeName] || {}), U = T.ui;   // T = 目前的風格，U = 螢幕畫面的配色
try { showNames = localStorage.getItem('cloudlog.names') !== '0'; } catch {}
const teamKey = t => (t || '').replace(/^team\s+/i, '').trim().toLowerCase() || '—';

// How recent the agent's newest work is (a record, a report on a command or a meeting message; see app.js `act`):
// within ACTIVE it sits at its own desk and the screen shows that work; ACTIVE..IDLE resting; older than IDLE idle.
const ACTIVE = Math.max(.25, Number(CFG.activeHours) || 2) * HOUR, IDLE = Math.max(ACTIVE, (Number(CFG.idleHours) || 6) * HOUR);
const NOW_WIN = 45 * MIN;   // only very recent work sends people to the studio, meeting room…
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
// 輕量模式（電腦較慢時）：解析度 1 倍、不反鋸齒、每秒最多 24 張、螢幕少更新；設定存在 localStorage，網址加 ?lite=1 也可以
let FLAT = false;   // 像素平面版（2D 俯視）；localStorage cloudlog.flat 或網址 ?flat=1
try { FLAT = /[?&]flat=1/.test(location.search) || (!/[?&]flat=0/.test(location.search) && localStorage.getItem('cloudlog.flat') === '1'); } catch {}
const flat = { cv: null, ctx: null, bg: document.createElement('canvas'), dirty: true, marks: null, v: { cx: 0, cy: 0, s: 20 }, go: null, ox: 0, oy: 0, portrait: false, sprites: new Map() };
let LITE = false;
try { LITE = localStorage.getItem('cloudlog.lite') === '1' || /[?&]lite=1/.test(location.search); } catch {}
const renderer = new THREE.WebGLRenderer({ antialias: !LITE });
const pixelRatio = () => LITE ? 1 : Math.min(devicePixelRatio, 2);
renderer.setPixelRatio(pixelRatio());
let onScreen = true;   // 捲到看不到 3D 時就不畫
new IntersectionObserver(es => { onScreen = es.some(e => e.isIntersecting); }).observe(box);
let lastFrame = 0;
const slow = { t0: 0, n: 0, shown: false };   // 開頭幾秒量一下每秒張數，太慢就提示輕量模式
box.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = 1.32; controls.minDistance = 1.2; controls.maxDistance = 90;
let userMoved = false, fly = null; controls.addEventListener('start', () => { userMoved = true; fly = null; });
const hemi = new THREE.HemisphereLight(0xffffff, 0x556677, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-10, 20, 12); scene.add(sun);
const bgColor = () => T.bg || css('--office-bg') || '#d6e0e7';
const setBg = () => { scene.background = new THREE.Color(bgColor()); };
function applyLights() { const l = T.light; hemi.color.set(l.sky); hemi.groundColor.set(l.floor); hemi.intensity = l.ambient; sun.color.set(l.sun); sun.intensity = l.sunPower; }
// 場景庫模型的材質是共用的：記住原色，再乘上風格的 modelTint
function tintModels() {
  if (!lib) return; const tint = T.modelTint ? new THREE.Color(T.modelTint) : null, seen = new Set();
  for (const root of [lib, lib.meetScene, lib.pantryScene, lib.loungeScene]) if (root) root.traverse(o => {
    for (const m of [].concat(o.material || [])) { if (!m.color || seen.has(m)) continue; seen.add(m);
      if (!m.userData.baseColor) m.userData.baseColor = m.color.clone();
      m.color.copy(m.userData.baseColor); if (tint) m.color.multiply(tint); } });
}
function applyTheme() { U = T.ui; applyLights(); setBg(); wallMat.color.set(T.wall); tintModels(); box.style.background = T.bg || ''; }
function setTheme(name) {
  if (!THEMES[name]) name = 'default';
  themeName = name; T = mergeTheme(THEME_BASE, THEMES[name]); try { localStorage.setItem('cloudlog.theme', name); } catch {}
  applyTheme(); layoutSig = ''; relabelAll(); renderLegend();   // 樓層重建一次，螢幕、名牌、地板都換成新風格
}
setBg();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { setBg(); relabelAll(); });
new MutationObserver(() => { setBg(); relabelAll(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

const loader = new GLTFLoader();
async function loadGlb(url) {   // binary .glb from the scene repo
  const r = await fetch(url); if (!r.ok) throw new Error(url.replace(SCENE_BASE, '') + ' HTTP ' + r.status);
  return loader.parseAsync(await r.arrayBuffer(), '');
}

// ---------- floor state ----------
let lib = null, meetMeta = null, pantryMeta = null, loungeMeta = null;   // loaded assets
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
  if (FLAT) { flatGo(flatRect(-1, -1, W + 1, D + 1), animate); userMoved = false; return; }
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
applyTheme();
const signColor = c => { const k = new THREE.Color(c); return T.sign.amount ? '#' + k.lerp(new THREE.Color(T.sign.tint), T.sign.amount).getHexString() : '#' + k.getHexString(); };
// 房間地板外框的發光線（風格的 outline > 0 時才畫）
const roomColor = r => r.kind === 'office' ? r.color : r.kind === 'meeting' || r.kind === 'smallmeet' ? T.rooms.meet : T.rooms[r.kind];
function roomOutline(r, color) {
  const wd = T.outline; if (!wd || !color) return;
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) }), i = .16;
  const bar = (w, d, x, y) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); o.rotation.x = -Math.PI / 2; o.position.set(x, .035, -y); g.add(o); };
  bar(r.w - i * 2, wd, r.x0 + r.w / 2, r.y0 + i); bar(r.w - i * 2, wd, r.x0 + r.w / 2, r.y0 + r.d - i);
  bar(wd, r.d - i * 2, r.x0 + i, r.y0 + r.d / 2); bar(wd, r.d - i * 2, r.x0 + r.w - i, r.y0 + r.d / 2);
  scene.add(g); floor.extra.push(g);
}
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
  x.fillStyle = signColor(color); x.fillText(text, 512, 132);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: T.sign.opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.userData.sign = true; return m;
}

// A team office: `pods` desk pods (4 seats each), whiteboard on the side wall, water + plant, door facing the corridor.
function buildOffice(room) {
  const { x0, y0, w, d, doorSide, pods, color, label } = room, g = new THREE.Group();
  floorPlane(g, x0, y0, x0 + w, y0 + d, color, T.roomTint, .002);
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
  const sign = textPlane(signText, css('--muted') || U.mute, 4, 1); sign.position.set(room.x0 + room.w / 2, .02, -(room.y0 + .9)); scene.add(sign); room.extra = [sign];
  const A = meta.anchors.map(a => ({ ...a, id: room.id + ':' + a.id, position: [a.position[0] + room.x0, a.position[1] + room.y0, 0] }));
  const south = meta.doors.filter(d => d.wall === 'S');
  for (const dr of south) { const x = dr.position[0] + room.x0, y = room.y0; navRect(x - .45, y - .7, x + .45, y + .7); }
  const d0 = south[0] || meta.doors[0];
  return { A, door: { id: room.id + ':door', type: 'STAND', position: [d0.position[0] + room.x0, room.y0 - .8, 0], yaw_deg: 0 } };
}
function buildMeeting(room) {
  const { A, door } = buildLibRoom(room, lib.meetScene, lib.meetNav, meetMeta, 'B+ 大會議室（15 人）');
  room.anchors = { seats: A.filter(a => /SEAT_meeting/.test(a.id)), stands: A.filter(a => /STAND_/.test(a.id)), water: A.filter(a => /POI_water/.test(a.id)), door };
  // 002 has 12 seats; the big room seats 15, so add a back row of 3 chairs behind the south side of the table (老師 2026-11-05)
  const ch = room.group.getObjectByName('Chair_01');
  if (ch) for (const [i, x] of [4.0, 5.0, 6.0].entries()) {
    const c = ch.clone(true); c.position.set(x, 0, -.95); room.group.add(c);
    room.anchors.seats.push({ id: room.id + ':SEAT_back_' + (i + 1), type: 'SEAT', use: 'meeting', position: [room.x0 + x, room.y0 + .95, 0], yaw_deg: 0 });
  }
  room.cap = room.anchors.seats.length;
  for (const a of room.anchors.water) addDevice(room, { ...a, use: 'water' }, scene, room.extra);
  // projector screen on the north side showing the current meeting
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 576;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.03), new THREE.MeshBasicMaterial({ map: tex }));
  scr.position.set(room.x0 + 4, 1.55, -(room.y0 + 5.6)); scr.userData.projector = true;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.75, 2.18, .06), new THREE.MeshStandardMaterial({ color: T.frame })); frame.position.set(0, 0, -.04); scr.add(frame);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(.08, .55, .08), new THREE.MeshStandardMaterial({ color: T.frame })); leg.position.set(0, -1.28, -.05); scr.add(leg);
  scene.add(scr); room.extra.push(scr);
  floor.projector = { mesh: scr, cv, ctx: cv.getContext('2d'), tex, meetingId: null }; projSig = '';
  // B+ upgrade (meeting M202611030011skun): kanban wall (west), 1080p 16:9 trial projection (east), rotatable portrait monitor
  const kb = panel(2.4, 1.35, 1024, 576, T.frame); kb.mesh.position.set(room.x0 + .12, 1.55, -(room.y0 + 3.2)); kb.mesh.rotation.y = Math.PI / 2;
  scene.add(kb.mesh); room.extra.push(kb.mesh); floor.kanban = kb; kb.mesh.userData.screen = 'kanban';
  const tr = panel(2.2, 1.24, 768, 432, T.frame); tr.mesh.position.set(room.x0 + 7.88, 1.62, -(room.y0 + 2.3)); tr.mesh.rotation.y = -Math.PI / 2;
  scene.add(tr.mesh); room.extra.push(tr.mesh); floor.trial = tr; tr.mesh.userData.screen = 'trial';
  const pm = panel(.36, .64, 216, 384, T.bezel, .6); pm.mesh.position.set(room.x0 + 7.5, 1.22, -(room.y0 + 4.05)); pm.mesh.rotation.y = -Math.PI / 2;
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
  const rank = [...agents.values()].sort((a, b) => (b.group.todayWork || 0) - (a.group.todayWork || 0) || (b.group.todayMeet || 0) - (a.group.todayMeet || 0) || nickOf(a.group).localeCompare(nickOf(b.group)));
  const sig = JSON.stringify([list.map(a => [nickOf(a.group), a.mode, a.group.pending || 0, colorOf(a.group)]), rank.map(a => [a.key, a.group.todayWork || 0, a.group.todayMeet || 0])]); if (sig === kb.sig) return; kb.sig = sig;
  const x = kb.ctx; x.fillStyle = U.dBg; x.fillRect(0, 0, 1024, 576); x.textBaseline = 'middle';
  x.fillStyle = U.dInk; x.font = `800 34px ${F}`; x.fillText('看板牆 · 代理人狀態', 36, 42);
  const cnt = {}; for (const a of list) cnt[a.mode] = (cnt[a.mode] || 0) + 1;
  x.font = `500 19px ${F}`; let cx = 400;
  for (const k of ORDER) if (cnt[k]) { const s = `${STATES[k].label} ${cnt[k]}`; x.fillStyle = css(STATES[k].tok) || '#ccc'; x.beginPath(); x.arc(cx, 44, 7, 0, 7); x.fill(); x.fillStyle = U.dInk2; x.fillText(s, cx + 12, 44); cx += x.measureText(s).width + 30; }
  x.fillStyle = U.dLine; x.fillRect(36, 76, 952, 2);
  // left: everyone's state (one column)
  const LW = 520, n = list.length || 1, rh = Math.min(36, 410 / n), fs = Math.round(Math.min(20, rh * .5));
  list.forEach((a, i) => { const bx = 36, by = 92 + i * rh, h = rh - 6, my = by + h / 2;
    x.fillStyle = U.dCard; x.beginPath(); x.roundRect(bx, by, LW, h, 8); x.fill();
    x.fillStyle = colorOf(a.group); x.fillRect(bx, by, 6, h);
    x.fillStyle = css(STATES[a.mode].tok) || '#ccc'; x.beginPath(); x.arc(bx + 26, my, Math.min(8, h / 3), 0, 7); x.fill();
    x.fillStyle = U.dInk; x.font = `700 ${fs}px ${F}`; x.fillText(nickOf(a.group), bx + 44, my);
    x.fillStyle = U.dMute; x.font = `500 ${Math.round(fs * .82)}px ${F}`; x.textAlign = 'right';
    x.fillText(STATES[a.mode].label + (a.group.pending ? ` · 待辦 ${a.group.pending}` : '') + ' · ' + (a.group.team ? a.group.team.label : ''), bx + LW - 14, my); x.textAlign = 'left'; });
  // right: today's ranking of work returned (cloud-meeting work counted separately)
  const RX = 580, RW = 408;
  x.fillStyle = U.dCard; x.beginPath(); x.roundRect(RX, 92, RW, 420, 12); x.fill();
  x.fillStyle = U.gold; x.font = `800 24px ${F}`; x.fillText('今日回傳工作排名', RX + 18, 118);
  x.fillStyle = U.dMute; x.font = `500 14px ${F}`; x.fillText('不含每小時雲端會議（發言、結論、指令回報）', RX + 18, 146);
  const max = Math.max(1, ...rank.map(a => a.group.todayWork || 0)), rr = Math.min(28, 330 / n);
  rank.forEach((a, i) => { const y = 170 + i * rr + rr / 2, w = a.group.todayWork || 0, mt = a.group.todayMeet || 0, f2 = Math.round(Math.min(17, rr * .55));
    x.fillStyle = i < 3 && w ? [U.gold, '#d9e2ea', '#e0a36a'][i] : U.dMute2; x.font = `800 ${f2}px ${F}`; x.textAlign = 'right'; x.fillText(String(i + 1), RX + 40, y); x.textAlign = 'left';
    x.fillStyle = U.dInk; x.font = `700 ${f2}px ${F}`; x.fillText(nickOf(a.group), RX + 52, y);
    const bx = RX + 132, bw = 190;
    x.fillStyle = U.dTrack; x.fillRect(bx, y - rr * .2, bw, rr * .4);
    if (w) { x.fillStyle = colorOf(a.group); x.fillRect(bx, y - rr * .2, bw * w / max, rr * .4); }
    x.fillStyle = w ? U.dInk : U.dMute2; x.font = `800 ${f2}px ${F}`; x.textAlign = 'right'; x.fillText(String(w), RX + RW - 50, y);
    x.fillStyle = U.dMute2; x.font = `500 ${Math.round(f2 * .78)}px ${F}`; x.fillText(mt ? `會${mt}` : '', RX + RW - 12, y); x.textAlign = 'left'; });
  kb.tex.needsUpdate = true;
}
function drawTrial(t) {   // 1080p 16:9 trial projection: a looping slide with a turbine and a timeline scrubber
  const tr = floor && floor.trial; if (!tr) return;
  const x = tr.ctx, W = 768, H = 432, f = (t * .06) % 1;
  const grd = x.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, U.brandDark); grd.addColorStop(1, U.brand); x.fillStyle = grd; x.fillRect(0, 0, W, H);
  x.textBaseline = 'middle'; x.fillStyle = U.onBrand; x.font = `800 30px ${F}`; x.fillText('試播 · 1920×1080 · 16:9', 28, 40);
  x.fillStyle = 'rgba(255,255,255,.75)'; x.font = `500 18px ${F}`; x.fillText('簡報／動畫實測與 QA 截圖比對', 28, 76);
  const cx = 560, cy = 190; x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 6; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, 372); x.stroke();
  x.fillStyle = U.onBrand; for (let k = 0; k < 3; k++) { x.save(); x.translate(cx, cy); x.rotate(t * 1.4 + k * 2.094); x.beginPath(); x.moveTo(-5, 0); x.quadraticCurveTo(-10, -50, 0, -104); x.quadraticCurveTo(10, -50, 5, 0); x.fill(); x.restore(); }
  x.beginPath(); x.arc(cx, cy, 8, 0, 7); x.fill();
  for (let i = 0; i < 4; i++) { x.fillStyle = 'rgba(255,255,255,' + (i / 4 < f ? .9 : .35) + ')'; x.fillRect(28, 130 + i * 44, 300 - i * 40, 16); }
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, H - 40, W, 40); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(28, H - 22, W - 56, 4);
  x.fillStyle = U.gold; x.fillRect(28, H - 22, (W - 56) * f, 4); x.beginPath(); x.arc(28 + (W - 56) * f, H - 20, 8, 0, 7); x.fill();
  tr.tex.needsUpdate = true;
}
function drawPortrait(pm) {   // rotatable portrait monitor: exam sheet vs. answer key side by side
  const x = pm.ctx; x.fillStyle = U.paper; x.fillRect(0, 0, 216, 384); x.fillStyle = U.ink; x.font = `700 20px ${F}`; x.textBaseline = 'middle';
  x.fillText('題卷 ↔ 解答', 14, 26); x.fillStyle = U.line; x.fillRect(14, 46, 188, 2);
  for (let i = 0; i < 9; i++) { x.fillStyle = U.mute2; x.fillRect(14, 64 + i * 34, 120 + (i * 37) % 60, 10); x.fillStyle = i % 3 === 2 ? U.bad : U.ok; x.fillRect(184, 62 + i * 34, 14, 14); }
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
  const sign = textPlane('錄課棚', T.rooms.studio, 3.2, .8); sign.position.set(x0 + w / 2, .02, -(y0 + .8)); g.add(sign);
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
function setOnAir(on) {
  const a = floor && floor.onAir; if (!a || a.on === on) return; a.on = on;
  const x = a.ctx; x.fillStyle = on ? '#d2202a' : '#3a3f48'; x.fillRect(0, 0, 256, 96);
  x.fillStyle = on ? '#ffffff' : '#8a929c'; x.font = `800 52px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ON AIR', 128, 50);
  a.tex.needsUpdate = true;
}
function buildPantry(room) {
  const { A, door } = buildLibRoom(room, lib.pantryScene, lib.pantryNav, pantryMeta, '茶水間');
  // 咖啡機兩台移除（老師 2026-11-06 指令 C202611061254343wir）：隱藏模型、拿掉兩個咖啡機互動點
  room.group.traverse(o => { if (/^CoffeeMachine/.test(o.name)) o.visible = false; });
  room.anchors = { devices: A.filter(a => a.type === 'POI' && a.use !== 'coffee'), seats: A.filter(a => a.type === 'SEAT'), door };
  // 果汁機（老師 2026-11-05 指令 C202611052023133izz）：放在咖啡機與微波爐之間的檯面上，程式產生模型
  const mw = room.anchors.devices.find(a => a.use === 'microwave');
  if (mw) {
    const ja = { ...mw, id: room.id + ':POI_juicer_01', use: 'juicer', position: [mw.position[0] - .65, mw.position[1], 0] };
    room.anchors.devices.push(ja);
    const jg = new THREE.Group(), p = B2T(ja.position); jg.position.set(p.x, .92, p.z);
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: .5 });
    const jar = new THREE.MeshStandardMaterial({ color: 0xffa84a, roughness: .2, transparent: true, opacity: .8 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.13, .15, .16, 20), dark); base.position.y = .08; jg.add(base);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.14, .1, .3, 20), jar); cup.position.y = .31; jg.add(cup);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(.11, .14, .04, 20), dark); lid.position.y = .48; jg.add(lid);
    scene.add(jg); room.extra.push(jg);
  }
  for (const a of room.anchors.devices) addDevice(room, a, scene, room.extra);
}
// 休憩區（indoor-scenes 005）：沙發、懶骨頭、撞球、手足球、電視。休息的人有時來這裡坐坐或打球。
function buildLounge(room) {
  const { A, door } = buildLibRoom(room, lib.loungeScene, lib.loungeNav, loungeMeta, '休憩區');
  room.anchors = { seats: A.filter(a => a.type === 'SEAT'), games: A.filter(a => a.type === 'STAND'), devices: A.filter(a => a.type === 'POI'), door };
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
  x.fillStyle = T.tag.bg; x.strokeStyle = T.tag.line; x.lineWidth = 3;
  x.beginPath(); x.roundRect(x0, 8, w, 54, 27); x.fill(); x.stroke();
  x.fillStyle = T.tag.ink; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 36);
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
  const bez = new THREE.MeshStandardMaterial({ color: T.bezel });
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
function drawOff(scr) { const x = scr.ctx; x.fillStyle = U.off; x.fillRect(0, 0, 384, 216); scr.tex.needsUpdate = true; scr.sig = 'off';
  if (scr.ctx2) { scr.ctx2.fillStyle = U.off; scr.ctx2.fillRect(0, 0, 256, 160); scr.tex2.needsUpdate = true; scr.sig2 = 'off'; } }
function drawSecond(scr, ag) {   // right-hand monitor: the agent's latest records
  const g = ag.group, list = (g.list || []).slice(0, 4), sig = list.map(r => r.ts + r.topic).join('|'); if (sig === scr.sig2) return; scr.sig2 = sig;
  const x = scr.ctx2; x.fillStyle = U.dBg2; x.fillRect(0, 0, 256, 160); x.textBaseline = 'middle';
  x.fillStyle = U.dMute; x.font = `700 15px ${F}`; x.fillText('最近紀錄', 10, 14);
  list.forEach((r, i) => { const y = 40 + i * 31;
    x.fillStyle = U.dAccent; x.font = `500 13px ${F}`; x.fillText(new Date(r.ts).toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }), 10, y);
    x.fillStyle = U.dInk; x.font = `500 15px ${F}`; x.fillText(wrapText(x, r.topic, 190, 1)[0] || '', 58, y); });
  scr.tex2.needsUpdate = true;
}
// Electric sit-stand desk: the library desk rises on two lift columns, the keyboard and monitors go with it, the chair rolls back.
const LIFT = .36;
function addLift(group, seat, desk, kb, chair) {
  if (!desk) return;
  desk.updateWorldMatrix(true, true);
  const bb = new THREE.Box3().setFromObject(desk), mat = new THREE.MeshStandardMaterial({ color: T.lift, roughness: .4, metalness: .3 });
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
    const a = actOf(g), sig = ['w', a.ts, a.topic, a.content, a.status, a.stage, g.pending, color].join('|'); if (sig === scr.sig) return; scr.sig = sig;
    const kind = (a.kind === 'ack' ? '回報指令' + (ACK_ZH[a.status] ? '・' + ACK_ZH[a.status] : '') : a.kind === 'say' ? '會議發言' : '工作紀錄') + (a.stageLabel && a.kind !== 'ack' ? '・' + a.stageLabel : '');
    x.fillStyle = U.paper; x.fillRect(0, 0, 384, 216);
    x.fillStyle = color; x.fillRect(0, 0, 384, 34);
    x.fillStyle = U.inkHi; x.font = `700 20px ${F}`; x.textBaseline = 'middle'; x.fillText(nickOf(g) + ' · ' + (g.team ? g.team.label : ''), 12, 18);
    x.textAlign = 'right'; x.font = `700 18px ${F}`; x.fillText(hhmm(a.ts), 372, 18); x.textAlign = 'left';
    x.fillStyle = U.ok; x.font = `700 18px ${F}`; x.fillText('● 工作中 · ' + kind, 12, 56);
    x.fillStyle = U.ink; x.font = `700 24px ${F}`; wrapText(x, a.topic, 360, 2).forEach((l, i) => x.fillText(l, 12, 90 + i * 30));
    x.fillStyle = U.ink2; x.font = `400 16px ${F}`; wrapText(x, a.content || '', 360, 2).forEach((l, i) => x.fillText(l, 12, 152 + i * 21));
    if (g.pending) { x.fillStyle = U.warn; x.font = `700 16px ${F}`; x.textAlign = 'right'; x.fillText(`待辦指令 ${g.pending}`, 372, 56); x.textAlign = 'left'; }
    scr.tex.needsUpdate = true; return;
  }
  // screensaver: a turning wind turbine, the clock and where the agent went
  scr.sig = 's';
  const away = ag.mode === 'meet' ? '開會中' : ag.mode === 'rest' ? '休息中' : ag.mode === 'patrol' ? '巡檢中' : ag.mode === 'present' ? '報告中' : ag.mode === 'record' ? '錄製中' : ag.mode === 'call' ? '通話中' : ag.mode === 'idle' ? '閒置' : '離開座位';
  const grd = x.createLinearGradient(0, 0, 0, 216); grd.addColorStop(0, U.saver1); grd.addColorStop(1, U.saver2); x.fillStyle = grd; x.fillRect(0, 0, 384, 216);
  const cx = 270 + Math.sin(t * .2 + ag.phase) * 30, cy = 92;
  x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 4; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx, 214); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.9)';
  for (let k = 0; k < 3; k++) { const a = t * 1.6 + ag.phase + k * 2.094; x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath(); x.moveTo(-3, 0); x.quadraticCurveTo(-6, -30, 0, -62); x.quadraticCurveTo(6, -30, 3, 0); x.fill(); x.restore(); }
  x.beginPath(); x.arc(cx, cy, 5, 0, 7); x.fill();
  x.fillStyle = color; x.font = `700 18px ${F}`; x.textBaseline = 'middle'; x.fillText(nickOf(g), 14, 26);
  x.fillStyle = U.saverInk; x.font = `800 40px ${F}`;
  const now = new Date(); x.fillText(now.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }), 14, 74);
  x.fillStyle = U.saverInk2; x.font = `700 18px ${F}`; x.fillText(away, 14, 120);
  x.font = `400 15px ${F}`; x.fillStyle = U.saverInk3;
  const line = ag.mode === 'meet' && g.meetMsg ? g.meetMsg.meetingTitle : ag.mode === 'rest' && ag.activity ? ag.activity : actOf(g).topic;
  wrapText(x, line, 210, 2).forEach((l, i) => x.fillText(l, 14, 150 + i * 20));
  scr.tex.needsUpdate = true;
}
// After a meeting ends, the B+ projector plays its "slides" (cover, summary, decisions, to-dos, ruling) — meetings
// awaiting the teacher's ruling first, then those that ended in the last 48 h. One page every SLIDE_S seconds;
// clicking the screen can turn pages and (in admin mode) approve the conclusion right there.
const SLIDE_S = 8, RULE_ZH = { approved: '已核准執行', amended: '已修正後核准', rejected: '不通過' };
let slideOff = 0, slideFreeze = null;   // while the projector menu is open the page stays put (slideFreeze = page index)
const slideIndex = t => slideFreeze != null ? slideFreeze : Math.floor(t / SLIDE_S) + slideOff;
function slideDeck() {
  const ended = lastMeetings.filter(q => !q.open && q.minutes);
  const pick = [...ended.filter(q => q.awaitingRuling), ...ended.filter(q => !q.awaitingRuling && Date.now() - (q.minutes.ts || q.lastTs) < 48 * 3600e3).sort((a, b) => b.lastTs - a.lastTs)].slice(0, 3);
  const deck = [];
  for (const q of pick) {
    const mn = q.minutes, dec = mn.decisions || [], acts = mn.actions || [];
    const pages = [{ q, kind: 'cover' }];
    if (mn.summary) pages.push({ q, kind: 'summary' });
    for (let i = 0; i < dec.length; i += 4) pages.push({ q, kind: 'decisions', from: i });
    for (let i = 0; i < acts.length; i += 4) pages.push({ q, kind: 'actions', from: i });
    pages.push({ q, kind: 'ruling' });
    pages.forEach((p, i) => { p.no = i + 1; p.of = pages.length; deck.push(p); });
  }
  return deck;
}
function slideStatus(q) { return q.awaitingRuling ? ['待老師裁示', U.warn] : q.ruling ? [RULE_ZH[q.ruling.decision] || '已裁示', q.ruling.decision === 'rejected' ? U.bad : U.ok] : ['已結束', U.mute]; }
function drawSlide(x, p) {
  const q = p.q, mn = q.minutes, ag = q.agenda || {}, [stTxt, stCol] = slideStatus(q);
  x.fillStyle = U.slide; x.fillRect(0, 0, 1024, 576);
  x.fillStyle = U.brandDark; x.fillRect(0, 0, 1024, 64);
  x.fillStyle = U.onBrand; x.font = `700 24px ${F}`; x.fillText(wrapText(x, '會議簡報 · ' + q.title, 700, 1)[0] || '', 32, 33);
  x.font = `500 20px ${F}`; x.textAlign = 'right'; x.fillText(`${p.no} / ${p.of}`, 992, 33); x.textAlign = 'left';
  x.fillStyle = U.line; x.fillRect(32, 540, 960, 3); x.fillStyle = U.brand; x.fillRect(32, 540, 960 * p.no / p.of, 3);
  const chip = (txt, col, cx, cy) => { x.font = `800 24px ${F}`; const w = x.measureText(txt).width + 40; x.fillStyle = col; x.beginPath(); x.roundRect(cx, cy - 22, w, 44, 22); x.fill(); x.fillStyle = U.onBrand; x.fillText(txt, cx + 20, cy); return w; };
  const H = (t, y = 112) => { x.fillStyle = U.ink; x.font = `800 40px ${F}`; x.fillText(t, 48, y); x.fillStyle = U.brand; x.fillRect(48, y + 30, 64, 5); };
  if (p.kind === 'cover') {
    chip('會議結束', U.brand, 48, 122); chip(stTxt, stCol, 220, 122);
    x.fillStyle = U.ink; x.font = `800 50px ${F}`; wrapText(x, q.title, 920, 2).forEach((l, k) => x.fillText(l, 48, 210 + k * 64));
    x.fillStyle = U.mute; x.font = `500 26px ${F}`;
    x.fillText(`主持 ${ag.host ? partyName(ag.host) : '—'} · 與會 ${(ag.attendees || []).length} 人 · 發言 ${q.msgs.length} 則`, 48, 360);
    x.fillText(`決議 ${(mn.decisions || []).length} 項 · 待辦 ${(mn.actions || []).length} 項`, 48, 404);
    if (ag.goal) { x.fillStyle = U.ink2; x.font = `400 24px ${F}`; x.fillText(wrapText(x, '目標：' + ag.goal, 920, 1)[0] || '', 48, 460); }
  } else if (p.kind === 'summary') {
    H('結論摘要');
    x.fillStyle = U.ink2; x.font = `400 30px ${F}`; wrapText(x, mn.summary, 920, 8).forEach((l, k) => x.fillText(l, 48, 198 + k * 44));
  } else if (p.kind === 'decisions') {
    H('決議' + ((mn.decisions || []).length > 4 ? `（${p.from / 4 + 1}）` : ''));
    let y = 196;
    (mn.decisions || []).slice(p.from, p.from + 4).forEach((d, k) => { const ls = wrapText(x, d, 860, 2);
      x.fillStyle = U.brand; x.beginPath(); x.arc(66, y, 16, 0, 7); x.fill(); x.fillStyle = U.onBrand; x.font = `800 18px ${F}`; x.textAlign = 'center'; x.fillText(String(p.from + k + 1), 66, y + 1); x.textAlign = 'left';
      x.fillStyle = U.ink; x.font = `500 26px ${F}`; ls.forEach((l, j) => x.fillText(l, 100, y + j * 36)); y += 36 * ls.length + 32; });
  } else if (p.kind === 'actions') {
    H('待辦與負責人');
    let y = 200;
    (mn.actions || []).slice(p.from, p.from + 4).forEach(ac => {
      x.fillStyle = U.card; x.beginPath(); x.roundRect(48, y - 34, 928, 72, 12); x.fill();
      x.fillStyle = U.accent; x.font = `800 26px ${F}`; x.fillText(wrapText(x, partyName(ac.to), 200, 1)[0] || '—', 72, y + 2);
      x.fillStyle = U.ink; x.font = `500 24px ${F}`; x.fillText(wrapText(x, ac.task || '', 640, 1)[0] || '', 300, y + 2);
      x.fillStyle = ac.command_id ? U.ok : U.warn; x.font = `700 18px ${F}`; x.textAlign = 'right'; x.fillText(ac.command_id ? '已派指令' : '待派', 956, y + 2); x.textAlign = 'left';
      y += 88; });
  } else {
    H('老師裁示');
    chip(stTxt, stCol, 48, 210);
    x.fillStyle = U.ink2; x.font = `500 28px ${F}`;
    const n = (mn.actions || []).length;
    const lines = q.awaitingRuling ? [n ? `核准後，${n} 項待辦會各自變成一條指令，交給負責的人執行。` : '結論沒有列出待辦；要派工請在會議頁「修正後核准」。', '點這面投影幕即可「核准執行」、「修正後核准」或「不通過」（需管理登入）。']
      : q.ruling ? [q.ruling.note ? '老師說明：' + q.ruling.note : '裁示已送出。', q.ruling.decision === 'rejected' ? '主持人會依原因處理（例如重新討論）。' : '指令已派出，進度在會議頁與各人物的側欄。']
      : [(mn.actions || []).some(a => a.command_id) ? '主持人已派出指令，進度在會議頁與各人物的側欄。' : '這場會議沒有待辦。'];
    let y = 290; for (const t of lines) for (const l of wrapText(x, t, 920, 3)) { x.fillText(l, 48, y); y += 42; } 
  }
}
function drawProjector() {
  const t = performance.now() / 1000, pj = floor && floor.projector; if (!pj) return;
  const cur = lastMeetings.find(q => q.open && q.id === floor.meeting.meetingId) || null, last = lastMeetings[0] || null;
  const deck = cur ? [] : slideDeck(), page = deck.length ? deck[(slideIndex(t) % deck.length + deck.length) % deck.length] : null;
  const sig = JSON.stringify(cur ? [cur.id, cur.msgs.length, cur.title] : page ? ['slide', page.q.id, page.kind, page.from || 0, page.of, slideStatus(page.q)[0], deck.length] : ['none', last && last.id, last && !!last.minutes]); if (sig === projSig) return; projSig = sig;
  const x = pj.ctx; pj.meetingId = cur ? cur.id : page ? page.q.id : last ? last.id : null; pj.slide = page;
  x.fillStyle = U.paper; x.fillRect(0, 0, 1024, 576);
  x.textBaseline = 'middle';
  if (cur) {
    x.fillStyle = U.warn; x.beginPath(); x.roundRect(40, 34, 150, 52, 26); x.fill();
    x.fillStyle = U.onBrand; x.font = `800 30px ${F}`; x.fillText('會議中', 70, 61);
    x.fillStyle = U.ink; x.font = `800 46px ${F}`; x.fillText(wrapText(x, cur.title, 780, 1)[0] || '', 210, 62);
    const ag = cur.agenda || {}; x.fillStyle = U.mute; x.font = `500 24px ${F}`;
    x.fillText(`主持 ${ag.host ? partyName(ag.host) : '—'} · 與會 ${(ag.attendees || []).length} 人 · 發言 ${cur.msgs.length} 則`, 40, 118);
    x.fillStyle = U.line; x.fillRect(40, 146, 944, 2);
    const recent = cur.msgs.slice(-3);
    if (!recent.length) { x.fillStyle = U.mute; x.font = `500 30px ${F}`; x.fillText('等待與會代理人發言…', 40, 220);
      (ag.agenda || []).slice(0, 4).forEach((a, i) => { x.fillStyle = U.ink; x.font = `500 28px ${F}`; x.fillText(`${i + 1}. ${a}`, 60, 290 + i * 48); }); }
    recent.forEach((q, i) => {
      const y = 186 + i * 128, who = q.from ? partyName(q.from) : '—';
      x.fillStyle = q.from && q.from.team === 'HUMAN' ? U.warn : U.accent; x.font = `800 28px ${F}`; x.fillText(who, 40, y);
      x.fillStyle = U.ink; x.font = `400 27px ${F}`; wrapText(x, q.content, 940, 2).forEach((l, k) => x.fillText(l, 40, y + 40 + k * 36));
    });
  } else if (page) {
    drawSlide(x, page);
  } else {
    x.fillStyle = U.ink; x.font = `800 52px ${F}`; x.fillText('會議室', 40, 70);
    x.fillStyle = U.mute; x.font = `500 30px ${F}`; x.fillText('目前沒有進行中的會議', 40, 136);
    if (last) { x.fillStyle = U.ink; x.font = `700 30px ${F}`; x.fillText('上一場：' + (wrapText(x, last.title, 820, 1)[0] || ''), 40, 220);
      x.font = `400 26px ${F}`; x.fillStyle = U.ink2; wrapText(x, last.minutes ? last.minutes.summary : `${last.msgs.length} 則發言`, 940, 5).forEach((l, k) => x.fillText(l, 40, 274 + k * 38)); }
    else { x.font = `400 26px ${F}`; x.fillStyle = U.ink2; x.fillText('在看板的「會議」按「發起會議」，代理人排程執行時會來這裡發言。', 40, 220); }
  }
  pj.tex.needsUpdate = true;
}

// Meeting rooms 2 & 3 and project offices: a table with chairs, a wall screen, door to the corridor.
function buildTableRoom(room, opt) {
  const { x0, y0, w, d } = room, g = new THREE.Group(), dx = x0 + w / 2, south = opt.door === 'S';
  const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: .8 });
  const box = (sx, sy, sz, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, -z); g.add(o); return o; };
  floorPlane(g, x0, y0, x0 + w, y0 + d, opt.color, T.roomTint, .002);
  const doorY = south ? y0 : y0 + d, backY = south ? y0 + d : y0;
  wall(g, x0, y0, x0, y0 + d); wall(g, x0 + w, y0, x0 + w, y0 + d); wall(g, x0, backY, x0 + w, backY);
  wall(g, x0, doorY, dx - .6, doorY); wall(g, dx + .6, doorY, x0 + w, doorY);
  navRect(x0 + .3, y0 + .3, x0 + w - .3, y0 + d - .3); navRect(dx - .45, doorY - .6, dx + .45, doorY + .6);
  const sign = textPlane(opt.sign, opt.signColor, Math.min(w - .6, 5), 1.1); sign.position.set(dx, .02, -(south ? y0 + .75 : y0 + d - .75)); g.add(sign);
  // table + chairs (people sit on both long sides, facing the table)
  const n = opt.seats || 6, per = Math.ceil(n / 2), tw = Math.max(2.2, per * .85), cy = y0 + d / 2 + (south ? .25 : -.25);
  const wood = M(T.table), dark = M(T.tableLeg), cloth = M(opt.color);
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
  const scr = panel(opt.seats ? 2.2 : 1.8, opt.seats ? 1.24 : 1.0, 768, 432, T.frame);
  scr.mesh.position.set(dx, 1.5, -(south ? y0 + d - .12 : y0 + .12)); if (!south) scr.mesh.rotation.y = Math.PI;
  scr.mesh.userData.screen = room.kind; scr.mesh.userData.roomId = room.id; g.add(scr.mesh);
  room.screen = scr; room.sig = ''; room.cap = n;
  room.anchors = { seats, door: { id: room.id + ':door', type: 'STAND', position: [dx, south ? y0 - .8 : y0 + d + .8, 0], yaw_deg: 0 } };
  room.group = g; scene.add(g);
}
// Which room a meeting is held in: biggest meetings first, each takes the smallest free room that seats everyone
// (B+ 15 人、中會議室 8 人、小會議室 6 人); if none fits it takes the biggest free room; with no room left it shares B+.
function assignMeetRooms() {
  meetAssign = new Map(); if (!floor) return;
  const rooms = [floor.meeting, ...(floor.smallMeets || [])];
  const size = q => (q.agenda && q.agenda.attendees || []).length;
  const open = lastMeetings.filter(q => q.open).sort((a, b) => size(b) - size(a) || b.lastTs - a.lastTs || (a.id < b.id ? -1 : 1));
  for (const r of rooms) r.meetingId = null;
  const free = [...rooms].sort((a, b) => (a.cap || 0) - (b.cap || 0));
  for (const q of open) {
    if (!free.length) break;
    const r = free.find(r => (r.cap || 0) >= size(q)) || free[free.length - 1];
    free.splice(free.indexOf(r), 1); meetAssign.set(q.id, r); r.meetingId = q.id;
  }
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
      x.fillStyle = U.paper; x.fillRect(0, 0, W, H); x.textBaseline = 'middle';
      x.fillStyle = U.ink; x.font = `800 40px ${F}`; x.fillText(r.label, 30, 50);
      if (q) {
        x.fillStyle = U.warn; x.beginPath(); x.roundRect(30, 96, 130, 46, 23); x.fill(); x.fillStyle = U.onBrand; x.font = `800 26px ${F}`; x.fillText('會議中', 52, 120);
        x.fillStyle = U.ink; x.font = `800 38px ${F}`; wrapText(x, q.title, 700, 2).forEach((l, i) => x.fillText(l, 30, 196 + i * 50));
        const ag = q.agenda || {}; x.fillStyle = U.mute; x.font = `500 26px ${F}`;
        x.fillText(`主持 ${ag.host ? partyName(ag.host) : '—'} · 與會 ${(ag.attendees || []).length} 人 · 發言 ${q.msgs.length} 則`, 30, 330);
      } else { x.fillStyle = U.mute; x.font = `600 30px ${F}`; x.fillText('目前沒有會議', 30, 200); }
    } else if (r.kind === 'project') {
      const pj = lastProjects.find(q => q.id === r.pid);
      const sig = JSON.stringify(pj || ['none']); if (sig === r.sig) continue; r.sig = sig;
      x.fillStyle = U.projPaper; x.fillRect(0, 0, W, H); x.textBaseline = 'middle';
      x.fillStyle = U.proj; x.fillRect(0, 0, W, 64); x.fillStyle = U.onBrand; x.font = `800 32px ${F}`; x.fillText('專案 · ' + (wrapText(x, pj ? pj.title : '', 560, 1)[0] || ''), 24, 34);
      if (pj) {
        x.fillStyle = U.projInk; x.font = `500 24px ${F}`; wrapText(x, pj.goal || '', 720, 3).forEach((l, i) => x.fillText(l, 24, 104 + i * 34));
        x.fillStyle = U.mute; x.font = `600 24px ${F}`; x.fillText(`負責人 ${pj.lead} · 成員 ${pj.members.length} 人${pj.openMeetings ? ` · 進行中會議 ${pj.openMeetings}` : ''}`, 24, 230);
        x.font = `500 22px ${F}`; wrapText(x, pj.members.join('、'), 720, 1).forEach(l => x.fillText(l, 24, 268));
        const frac = pj.total ? pj.done / pj.total : 0;
        x.fillStyle = U.projTrack; x.beginPath(); x.roundRect(24, 320, 720, 28, 14); x.fill();
        x.fillStyle = U.proj; x.beginPath(); x.roundRect(24, 320, Math.max(28, 720 * frac), 28, 14); x.fill();
        x.fillStyle = U.projInk; x.font = `700 24px ${F}`; x.fillText(pj.total ? `指令完成 ${pj.done} / ${pj.total}` : '還沒有指令', 24, 384);
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
  // 共用座位（老師 2026-11-06 指令 C202611061254343wir）：搬到南側，緊鄰 NCUT_PJ 辦公室（沒有 NCUT_PJ 就接在最後一間團隊辦公室後面）
  const sharedRoom = needShared ? { id: 'office:__shared', kind: 'office', team: '__shared', label: '共用座位', color: css('--muted') || U.mute, pods: Math.max(1, Math.ceil((needShared + 1) / 4)), d: D, doorSide: 'N' } : null;
  const pjAt = teams.findIndex(t => String(t.key).toLowerCase() === 'ncut_pj'), sharedAfter = pjAt >= 0 ? pjAt : teams.length - 1;
  const addOffice = r => { r.w = Math.max(7, 2.2 + r.pods * 3.4 + 1.4); r.x0 = x; r.y0 = 0; rooms.push(r); x += r.w + GAP; };
  teams.forEach((t, i) => {
    addOffice({ id: 'office:' + t.key, kind: 'office', team: t.key, label: t.label, color: t.color, pods: Math.max(1, Math.ceil((t.count + 1) / 4)), d: D, doorSide: 'N' });
    if (sharedRoom && i === sharedAfter) addOffice(sharedRoom);
  });
  if (sharedRoom && !teams.length) addOffice(sharedRoom);
  for (const pj of projects) { rooms.push({ id: 'proj:' + pj.id, kind: 'project', pid: pj.id, label: pj.title, x0: x, y0: 0, w: 7, d: D }); x += 7 + GAP; }   // 進行中的專案各一間
  const southW = Math.max(x - GAP, 8);
  // 北側：B+ 大會議室 15 人、中會議室 8 人、小會議室 6 人、茶水間、休憩區（005，10×8 m）、錄課棚
  const north = [{ id: 'meet', kind: 'meeting', w: 8, d: 6 }, { id: 'meet2', kind: 'smallmeet', label: '中會議室', seats: 8, w: 6.5, d: 6 }, { id: 'meet3', kind: 'smallmeet', label: '小會議室', seats: 6, w: 5.5, d: 6 },
    { id: 'pantry', kind: 'pantry', w: 8, d: 6 }, ...(lib.loungeScene ? [{ id: 'lounge', kind: 'lounge', w: 10, d: 8 }] : []), { id: 'studio', kind: 'studio', w: 6, d: 6 }];
  const northW = north.reduce((s, r) => s + r.w, 0) + GAP * (north.length - 1);
  const W = Math.max(southW, northW); let nx = (W - northW) / 2;
  for (const r of north) { r.x0 = nx; r.y0 = D + CORR; nx += r.w + GAP; rooms.push(r); }
  floor = { rooms, W, D: D + CORR + Math.max(7, ...north.map(r => r.d)), extra: [], screens: new Map(), devices: new Map() };
  // base floor + corridor
  const base = new THREE.Group();
  floorPlane(base, -1, -1, W + 1, floor.D + 1, T.ground ? new THREE.Color(T.ground) : new THREE.Color(bgColor()).offsetHSL(0, 0, -.06));
  floorPlane(base, 0, D, W, D + CORR, new THREE.Color(T.corridor), 1, .001);
  scene.add(base); floor.extra.push(base);
  navRect(.3, D + .3, W - .3, D + CORR - .3);
  for (const r of rooms) r.kind === 'meeting' ? buildMeeting(r) : r.kind === 'pantry' ? buildPantry(r) : r.kind === 'studio' ? buildStudio(r) : r.kind === 'lounge' ? buildLounge(r)
    : r.kind === 'smallmeet' ? buildTableRoom(r, { door: 'S', color: T.rooms.meet, sign: `${r.label}（${r.seats} 人）`, signColor: T.rooms.meetSign || T.rooms.meet, seats: r.seats })
    : r.kind === 'project' ? buildTableRoom(r, { door: 'N', color: T.rooms.project, sign: '專案：' + r.label, signColor: T.rooms.projectSign || T.rooms.project, seats: 8 }) : buildOffice(r);
  for (const r of rooms) roomOutline(r, roomColor(r));
  flat.dirty = true; flat.marks = null;
  // corridor waypoints for patrols
  floor.corridor = [0.15, 0.4, 0.65, 0.9].map((f, i) => ({ id: 'corr' + i, type: 'STAND', position: [W * f, D + CORR / 2, 0], yaw_deg: 0 }));
  floor.byTeam = new Map(rooms.filter(r => r.kind === 'office').map(r => [r.team, r]));
  floor.meeting = rooms.find(r => r.kind === 'meeting'); floor.pantry = rooms.find(r => r.kind === 'pantry'); floor.studio = rooms.find(r => r.kind === 'studio');
  floor.lounge = rooms.find(r => r.kind === 'lounge');
  floor.smallMeets = rooms.filter(r => r.kind === 'smallmeet'); floor.byProject = new Map(rooms.filter(r => r.kind === 'project').map(r => [r.pid, r]));
  drawProjector(); fit();
}

// ---------- people ----------
const SKIN = 0xf0c8a4, PANTS = 0x2d3640;
const EYES = 0x1b1d26, BROWS = 0x3a2a22, MOUTH = 0x8a3b36, SHOES = 0x1d2127;
// A low-poly person. `look` (config.agents[].look) sets hair colour/style, clothes, skin and accessories.
// Optional look fields (all have defaults, so old configs still work):
//   pants 褲子、shoes 鞋子、eyes 眼睛、brows 眉毛（預設髮色）顏色；glasses 眼鏡、badge 識別證（true 或顏色）；height 身高倍率（0.85～1.15，預設 1）。
// Face, legs and blinking follow the 2026-11-03 meeting M202611031429y54f (plan B, command C20261103165839m9c0).
function makePerson(color, look = {}) {
  const g = new THREE.Group(), mats = [];
  const mat = (c, r = .7) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: r }); mats.push(m); return m; };
  const shirt = mat(look.shirt || color, .6), skin = mat(look.skin || SKIN), pants = mat(look.pants || PANTS, .8);
  const hips = new THREE.Group(); hips.position.y = .5; g.add(hips);
  // two legs: hip pivot → thigh → knee pivot → shin + shoe, so they swing when walking and bend when seated
  const shoe = mat(look.shoes || SHOES, .5);
  const leg = side => { const hp = new THREE.Group(); hp.position.x = side * .08; hips.add(hp);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(.13, .26, .18), pants); thigh.position.y = -.13; hp.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -.25; hp.add(knee);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(.12, .23, .16), pants); shin.position.y = -.115; knee.add(shin);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(.13, .05, .22), shoe); sh.position.set(0, -.225, -.03); knee.add(sh);
    hp.userData.knee = knee; return hp; };
  const legL = leg(-1), legR = leg(1);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .3, 4, 12), shirt); torso.position.y = .84; g.add(torso);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.055, .065, .1, 10), skin); neck.position.y = 1.17; g.add(neck);
  const head = new THREE.Group(); head.position.y = 1.32; g.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(.15, 18, 14), skin));
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.032, 8, 6), skin); nose.position.set(0, -.01, -.15); head.add(nose);
  // face (looks toward -z): eyes blink (scale.y), brows, a small smile (half torus)
  const eyeM = mat(look.eyes || EYES, .3), browM = mat(look.brows || look.hair || BROWS, .8);
  const eyes = [-1, 1].map(sx => { const e = new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 8), eyeM); e.position.set(sx * .05, .03, -.142); head.add(e); return e; });
  for (const sx of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.05, .012, .012), browM); b.position.set(sx * .05, .068, -.137); b.rotation.z = -sx * .12; head.add(b); }
  if (!(look.extra || []).includes('mask')) { const mo = new THREE.Mesh(new THREE.TorusGeometry(.03, .007, 6, 12, Math.PI), mat(MOUTH, .6)); mo.position.set(0, -.055, -.142); mo.rotation.z = Math.PI; head.add(mo); }
  const arm = side => { const pv = new THREE.Group(); pv.position.set(side * .27, 1.08, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(.055, .32, 3, 8), shirt); m.position.y = -.21; pv.add(m);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), skin); hand.position.y = -.44; pv.add(hand); g.add(pv); return pv; };
  const armL = arm(-1), armR = arm(1);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.34, .42, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .75, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = .02; g.add(ring);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.045, .04, .1, 10), new THREE.MeshStandardMaterial({ color: 0xffffff })); cup.position.set(0, -.44, -.03); cup.visible = false; armR.add(cup);
  dress({ g, head, torso, mat }, look);
  const height = Math.min(1.15, Math.max(.85, Number(look.height) || 1)); g.scale.setScalar(height);
  return { g, hips, torso, head, armL, armR, legL, legR, eyes, height, ring, cup, mats };
}
// Blink about every 4 s (offset per person); called every frame from animate().
function blink(p, t, ph) { if (!p.eyes) return; const s = (t + ph * 3) % 4.2 < .13 ? .12 : 1; for (const e of p.eyes) e.scale.y = s; }
// Legs swing opposite to the arms while walking (the trailing knee bends); knees bend 90° when seated.
function poseLegs(p, swing, seated) {
  if (!p.legL) return;
  p.legL.rotation.x = -swing; p.legR.rotation.x = swing;
  const k = seated ? -Math.PI / 2 : -Math.abs(swing) * .6;
  p.legL.userData.knee.rotation.x = seated || swing > 0 ? k : 0;
  p.legR.userData.knee.rotation.x = seated || swing < 0 ? k : 0;
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
  if (look.glasses) { const gm = mat(typeof look.glasses === 'string' ? look.glasses : 0x2b2f38, .3);
    for (const sx of [-1, 1]) add(head, new THREE.TorusGeometry(.034, .006, 6, 16), gm, sx * .05, .03, -.158);
    add(head, new THREE.BoxGeometry(.034, .006, .006), gm, 0, .035, -.16); }
  if (look.badge) { add(g, new THREE.BoxGeometry(.07, .09, .012), mat(0xf6f7f9, .4), .1, .95, -.205);
    add(g, new THREE.BoxGeometry(.07, .022, .014), mat(typeof look.badge === 'string' ? look.badge : 0x3a6fd8, .5), .1, .985, -.206); }
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
  return { spr, set, cv };
}
// Speech bubble (screen-space, like the name tag) for short lines: greetings, device sounds, what someone is doing.
function makeBubble() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
  const ctx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
  spr.renderOrder = 11; spr.center.set(.5, 0); spr.visible = false;
  const b = { spr, until: 0, text: '', cv };
  b.say = (text, sec, now) => {
    b.until = now + sec; spr.visible = true; if (text === b.text) return; b.text = text;
    ctx.clearRect(0, 0, 512, 96); ctx.font = `700 34px ${F}`;
    let t = String(text); while (t.length > 1 && ctx.measureText(t).width > 440) t = t.slice(0, -1);
    if (t !== String(text)) t += '…';
    const w = Math.min(500, ctx.measureText(t).width + 44), x0 = (512 - w) / 2;
    ctx.fillStyle = T.bubble.bg; ctx.strokeStyle = T.bubble.line; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(x0, 4, w, 70, 22); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(244, 72); ctx.lineTo(256, 90); ctx.lineTo(268, 72); ctx.fill();
    ctx.fillStyle = T.bubble.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, 256, 40);
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
    case 'call': return deskFor(ag);   // 電話亭移除後，通話就在座位上講
    case 'record': { const st = floor.studio && floor.studio.anchors; return st ? claim(k, st.spots) || jitter(st.door, k, .8) : deskFor(ag); }
    case 'patrol': {
      const route = [home.anchors.board[0], home.anchors.water[0], home.anchors.door, ...floor.corridor, meet.door, home.anchors.door];
      return jitter(route[ag.step++ % route.length], k + ag.step, .35);
    }
    case 'rest': {   // rests at the desk; now and then a trip to the pantry (sometimes a chat at the table), then back
      const pt = floor.pantry && floor.pantry.anchors;
      if (!pt) return jitter(home.anchors.water[0], k, .6);
      if (ag.restPhase === 'desk') {
        const lg = floor.lounge && floor.lounge.anchors;
        if (lg && Math.random() < .4) {   // 四成去休憩區：坐沙發、懶骨頭，或打撞球、手足球
          const spot = claim(k, [...lg.seats, ...lg.games].sort(() => Math.random() - .5));
          if (spot) { ag.restPhase = spot.type === 'SEAT' ? 'lounge' : 'game'; ag.activity = LOUNGE_ZH[spot.use] || '在休憩區休息'; return spot; }
        }
        const pick = [...pt.devices].sort(() => Math.random() - .5);
        const d = claim(k, pick) || jitter(pick[0], k, .5);
        ag.restPhase = 'device'; ag.device = d; ag.activity = USE_ZH[d.use] || '使用設備'; return d;
      }
      if (ag.restPhase === 'device') {
        const prev = ag.device && ag.device.use;
        ag.activity = prev === 'microwave' ? '吃便當' : prev === 'vending' || prev === 'fridge' ? '喝飲料' : '喝咖啡';
        const s = Math.random() < .3 && claim(k, [...pt.seats].sort(() => Math.random() - .5));
        if (s) { ag.restPhase = 'chat'; ag.activity += '聊天'; return s; }
      } else if (ag.restPhase !== 'lounge' && ag.restPhase !== 'game') ag.activity = '';   // just started resting: stay at the desk first, so not everyone heads to the pantry at once
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
  ag.wait = ag.mode === 'patrol' ? 2.5 + Math.random() * 2 : ag.mode === 'rest' ? (ag.restPhase === 'device' ? 6 + Math.random() * 3 : ag.restPhase === 'chat' ? 20 + Math.random() * 15
    : ag.restPhase === 'lounge' || ag.restPhase === 'game' ? 25 + Math.random() * 25 : 40 + Math.random() * 110) : Infinity;
}

// ---------- viewer-driven actions (local only: nothing is written to Drive) ----------
const ACTIONS = [
  ['wave', '打招呼'], ['stretch', '伸懶腰'], ['pantry', '去茶水間'], ['lounge', '去休憩區'], ['meet', '去會議室'],
  ['board', '到白板前'], ['studio', '去錄課棚'], ['stand', '站著工作'], ['patrol', '巡一圈'], ['desk', '回座位工作']
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
    case 'lounge': { const lg = floor.lounge && floor.lounge.anchors; if (!lg) return [];
      const spot = claim(k, [...lg.seats, ...lg.games].sort(() => Math.random() - .5)) || jitter(lg.door, k, .8);
      return [{ to: spot, anim: spot.type === 'SEAT' ? 'relax' : 'use', hold: 20, say: LOUNGE_ZH[spot.use] || '休息一下' }]; }
    case 'meet': return [{ to: claim(k, meet.seats) || jitter(meet.door, k, .8), anim: 'meet', hold: 25, say: '來開會' }];
    case 'board': return [{ to: claim(k, home.anchors.board) || jitter(home.anchors.board[0], k, .5), anim: 'present', hold: 15, say: '我來說明一下' }];
    case 'patrol': return [home.anchors.water[0], home.anchors.door, ...floor.corridor, home.anchors.door]
      .map((a, i) => ({ to: jitter(a, k + i, .35), anim: 'patrol', hold: 1.8 }));
    case 'desk': return [{ to: deskFor(ag), anim: 'work', hold: 40, say: '回來工作' }];
    case 'stand': return [{ to: deskFor(ag), anim: 'work', hold: 45, stand: true, say: '站著工作' }];
    case 'call': return [{ to: deskFor(ag), anim: 'call', hold: 20, say: '視訊通話中' }];
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
  const sig = JSON.stringify([teams.map(t => [t.key, Math.max(1, Math.ceil((t.count + 1) / 4)), t.color, t.label]), shared ? Math.ceil((shared + 1) / 4) : 0, css('--office-bg'), themeName, lastProjects.map(x => [x.id, x.title])]);
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
  const lt = document.createElement('button'); lt.type = 'button'; lt.textContent = LITE ? '一般畫質' : (slowHint ? '畫面慢？試試輕量模式' : '輕量模式');
  lt.title = '輕量模式：降低解析度與更新頻率，較慢的電腦也順暢'; if (slowHint && !LITE) lt.classList.add('hot');
  lt.onclick = () => { LITE = !LITE; slowHint = false; try { localStorage.setItem('cloudlog.lite', LITE ? '1' : '0'); } catch {}
    renderer.setPixelRatio(pixelRatio()); resize(); renderLegend(); };
  legend.append(lt);
  const fb = document.createElement('button'); fb.type = 'button'; fb.textContent = FLAT ? '3D 立體' : '像素平面'; fb.title = '像素平面版：俯視的平面畫面，比 3D 省資源；點螢幕會放大'; fb.onclick = () => setFlat(!FLAT); legend.append(fb);
  const names = Object.keys(THEMES);
  if (names.length > 1) { const tb = document.createElement('button'); tb.type = 'button'; tb.textContent = '風格：' + (T.label || themeName);
    tb.title = '切換辦公室風格（只改外觀，會議、指令等功能不變）'; tb.onclick = () => setTheme(names[(names.indexOf(themeName) + 1) % names.length]); legend.append(tb); }
  if (floor) { const teamRooms = floor.rooms.filter(r => r.kind === 'office' && r.team !== '__shared').length, shared = floor.byTeam.has('__shared');
    const projRooms = floor.byProject ? floor.byProject.size : 0;
    info.textContent = box.clientWidth < 560 ? `${teamRooms} 間辦公室${projRooms ? ` · ${projRooms} 個專案` : ''} · ${agents.size} 位代理人` : `${teamRooms} 間團隊辦公室${shared ? ' ＋ 共用座位' : ''}${projRooms ? ` ＋ ${projRooms} 間專案辦公室` : ''} ＋ 3 間會議室（15／8／6 人） ＋ 茶水間${floor.lounge ? ' ＋ 休憩區' : ''} ＋ 錄課棚 · ${agents.size} 位代理人`; }
}

// ---------- animation ----------
const clock = new THREE.Clock();
function animate(ag, dt, t) {
  const p = ag.p, ph = ag.phase;
  blink(p, t, ph);
  if (ag.walking) {
    if (!ag.path.length) { arrive(ag, ag.target); }
    else {
      const [tx, tz] = ag.path[0], pos = p.g.position, dx = tx - pos.x, dz = tz - pos.z, d = Math.hypot(dx, dz), sp = 1.3 * dt;
      if (d <= sp) { pos.x = tx; pos.z = tz; ag.path.shift(); } else { pos.x += dx / d * sp; pos.z += dz / d * sp; }
      if (d > 1e-3) p.g.rotation.y = Math.atan2(-dx, -dz);
      const sw = Math.sin(t * 9 + ph);
      p.g.position.y = Math.abs(sw) * .035; p.hips.rotation.x = 0;
      p.armL.rotation.set(sw * .55, 0, 0); p.armR.rotation.set(-sw * .55, 0, 0); p.head.rotation.set(0, 0, 0); p.torso.scale.y = 1; p.cup.visible = false;
      poseLegs(p, sw * .5, false);
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
  p.hips.rotation.x = ag.seated ? Math.PI / 2 : 0; poseLegs(p, 0, ag.seated);
  p.head.rotation.set(0, 0, 0); p.armL.rotation.set(0, 0, 0); p.armR.rotation.set(0, 0, 0); p.torso.scale.y = 1;
  const m = ag.ov ? ag.ov.steps[ag.ov.i].anim : ag.mode === 'rest' ? (ag.restPhase === 'device' || ag.restPhase === 'game' ? 'use' : ag.restPhase === 'lounge' ? 'relax' : 'sip') : ag.mode;
  p.cup.visible = m === 'sip';
  switch (m) {
    case 'wave': p.armR.rotation.x = 2.75; p.armR.rotation.z = .35 + Math.sin(t * 11 + ph) * .4; p.head.rotation.y = Math.sin(t * 2 + ph) * .15; p.head.rotation.x = -.08; break;
    case 'stretch': { const k = Math.min(1, (3 - Math.max(0, ag.wait)) * 1.6); p.armL.rotation.x = p.armR.rotation.x = 2.95 * k; p.armL.rotation.z = -.25 * k; p.armR.rotation.z = .25 * k; p.head.rotation.x = -.3 * k; p.torso.scale.y = 1 + .06 * k; break; }
    case 'use': p.armL.rotation.x = 1.2 + Math.sin(t * 6 + ph) * .15; p.armR.rotation.x = 1.35 + Math.sin(t * 6 + ph + 1) * .2; p.head.rotation.x = .15; break;
    case 'relax': p.armL.rotation.x = p.armR.rotation.x = .35; p.armL.rotation.z = -.2; p.armR.rotation.z = .2; p.head.rotation.x = -.05; p.head.rotation.y = Math.sin(t * .4 + ph) * .25; break;
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
  const nowMs = performance.now(); if (LITE && nowMs - lastFrame < 1000 / 24) return;   // skip before getDelta so no time is lost
  lastFrame = nowMs;
  const dt = Math.min(clock.getDelta(), .1);
  if (document.hidden || box.hidden || !box.clientWidth || !onScreen) return;
  if (!LITE && !slow.shown) { if (!slow.t0) slow.t0 = nowMs; slow.n++;
    if (nowMs - slow.t0 > 5000) { slow.shown = true; if (slow.n / ((nowMs - slow.t0) / 1000) < 22) { slowHint = true; renderLegend(); } } }
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
  if (floor && t - (floor.scrT || 0) > (LITE ? 2 : .5)) { floor.scrT = t; for (const scr of floor.screens.values()) if (scr.agent) { drawScreen(scr, scr.agent, t); drawSecond(scr, scr.agent); }
    drawKanban(); drawTrial(t); drawProjector();
    if (floor.studio) { const inside = ag => !ag.walking && ((ag.ov ? ag.ov.steps[ag.ov.i].anim === 'record' : ag.mode === 'record'));
      setOnAir([...agents.values()].some(inside) || [...floor.devices.values()].some(d => d.use === 'studio' && d.runUntil > t)); } }
  for (const ag of agents.values()) {
    animate(ag, dt, t);
    const gp = ag.p.g.position;
    ag.label.spr.visible = showNames;
    ag.label.spr.position.set(gp.x, (ag.seated && !ag.walking ? 1.4 : 1.65) * (ag.p.height || 1) + (ag.lift || 0), gp.z);
    const s = camera.aspect < 1 ? .085 : .11; ag.label.spr.scale.set(s, s / 4, 1);
    const bb = ag.bubble; if (bb.spr.visible && t > bb.until) bb.spr.visible = false;
    if (bb.spr.visible) { bb.spr.position.copy(ag.label.spr.position); bb.spr.center.y = showNames ? -.75 : 0; bb.spr.scale.set(s * 2, s * 2 * 96 / 512, 1); }
  }
  meetingTalk(t);
  stepFly(t);
  if (menu.el && menu.track) placeMenu();
  if (menu.live && t - (menu.liveT || 0) > .25) { menu.liveT = t; for (const [src, dst] of menu.live) dst.getContext('2d').drawImage(src, 0, 0); }
  if (FLAT) drawFlat(t); else { controls.update(); renderer.render(scene, camera); }
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
function closeMenu() { if (menu.el) menu.el.remove(); menu.el = null; menu.track = null; menu.live = null;
  if (slideFreeze != null) { slideOff = slideFreeze - Math.floor(performance.now() / 1000 / SLIDE_S); slideFreeze = null; } }
function placeMenu() {   // keep the menu next to the person / device it belongs to
  const el = menu.el, w = box.clientWidth, h = box.clientHeight;
  if (menu.live) return;   // 放大卡固定在中央（CSS）
  let x, y;
  if (FLAT) { const q = menu.track(); [x, y] = W2S(q.x, -q.z); }
  else { const v = menu.track().clone().project(camera); if (v.z > 1) return; x = (v.x + 1) / 2 * w; y = (1 - v.y) / 2 * h; }
  const mw = el.offsetWidth, mh = el.offsetHeight;
  let left = x + 14, top = y - mh / 2;
  if (menu.below) { left = x - mw / 2; top = y + 12; }   // under a screen, so it doesn't cover it
  else if (left + mw > w - 8) left = x - mw - 14;
  left = Math.max(8, Math.min(left, w - mw - 8)); top = Math.max(8, Math.min(top, h - mh - 8));
  el.style.left = left + 'px'; el.style.top = top + 'px';
}
function showMenu(title, sub, items, track, note = true, below = false, shots = null) {   // shots：像素平面版的放大卡，上方放螢幕畫面
  closeMenu();
  const el = document.createElement('div'); el.className = 'o-menu' + (shots ? ' o-zoom' : ''); el.setAttribute('role', 'menu');
  let view = null, live = null;
  if (shots) { view = document.createElement('div'); view.className = 'o-zoom-v'; live = [];
    for (const src of shots) { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.style.flex = src.width + ' 1 0'; c.getContext('2d').drawImage(src, 0, 0); view.append(c); live.push([src, c]); }
    view.title = '點畫面可以再放大／縮回'; view.onclick = () => view.classList.toggle('big'); }
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
  el.append(head); if (view) el.append(view); el.append(list); if (note) el.append(foot);
  for (const ev of ['pointerdown', 'pointerup', 'wheel']) el.addEventListener(ev, e => e.stopPropagation());
  box.append(el); menu.el = el; menu.track = track; menu.below = below; menu.live = live; placeMenu();
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
  if (FLAT) { flatGo({ cx: p.x, cy: -p.z, s: Math.max(flat.v.s, near <= 6 ? 46 : 40) }, true); userMoved = true; return; }
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
  if (FLAT) { flatGo(flatRect(r.x0 - .6, r.y0 - .6, r.x0 + r.w + .6, r.y0 + r.d + .6), true); userMoved = true; return; }
  const c = new THREE.Vector3(r.x0 + r.w / 2, .4, -(r.y0 + r.d / 2)), portrait = camera.aspect < 1;
  const dir = (portrait ? new THREE.Vector3(.62, 1.3, 0) : new THREE.Vector3(-.06, 1.25, .78)).normalize();
  const across = portrait ? r.d : r.w, along = portrait ? r.w : r.d, { vf, hf } = fovs();
  flyTo(c, c.clone().addScaledVector(dir, Math.max((across / 2 + .9) / Math.tan(hf / 2), (along / 2 + .9) * .9 / Math.tan(vf / 2))));
}
const ROOM_ZH = { meeting: 'B+ 大會議室（會議／試播）', pantry: '茶水間', studio: '錄課棚', lounge: '休憩區' };
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
  projector: { name: '會議室投影幕', sub: '進行中的會議；會議結束後播放會議簡報', w: 3.6, h: 2.03,
    open: ['打開會議紀錄', () => { if (window.cloudlogBridge) window.cloudlogBridge.meetings(floor.projector.meetingId || 'list'); }] },
  kanban: { name: '看板牆', sub: '每位代理人的即時狀態', w: 2.4, h: 1.35, open: ['打開規劃頁', openPlan] },
  trial: { name: '1080p 試播投影', sub: '16:9 試播畫面', w: 2.2, h: 1.24, open: ['打開規劃頁', openPlan] },
  portrait: { name: '直立副螢幕', sub: '題目卷與解答卷並排對照', w: .36, h: .64, open: null }
};
function screenCanvas(kind, obj) { return kind === 'projector' ? floor.projector.cv : kind === 'kanban' ? floor.kanban.cv : kind === 'trial' ? floor.trial.cv : kind === 'portrait' ? floor.portrait.cv
  : ((floor.rooms.find(q => q.id === obj.userData.roomId) || {}).screen || {}).cv; }
function presentScreen(kind, obj, S, sub, items) {
  if (FLAT) { const cv = screenCanvas(kind, obj); showMenu(S.name, sub, items, null, false, false, cv ? [cv] : null); return; }
  const f = focusFace(obj, S.w, S.h), narrow = camera.aspect < 1;
  showMenu(S.name, sub, items, () => narrow ? f.c.clone().setY(f.c.y - S.h / 2) : f.c.clone().addScaledVector(f.right, S.w / 2 + .15), false, narrow);
}
// Projector menu while it plays a meeting's slides: turn pages, open the minutes, approve the conclusion (admin).
function projectorItems(items, kind, obj, confirm = false, msg = null) {
  if (slideFreeze == null) { slideFreeze = slideIndex(performance.now() / 1000); projSig = ''; drawProjector(); }
  const pj = floor.projector, page = pj.slide, br = window.cloudlogBridge, id = pj.meetingId;
  const again = (c, m) => () => { const it = []; projectorItems(it, kind, obj, c, m); it.push(backItem()); const S = SCREENS.projector, pg = floor.projector.slide, fz = slideFreeze;
    presentScreen(kind, obj, S, pg ? '會議簡報：' + pg.q.title : S.sub, it); slideFreeze = fz; return true; };
  if (msg) items.push({ label: msg.text, cls: msg.bad ? 'mut' : 'pri', disabled: true, run: () => {} });
  if (page) {
    const r = br && br.ruling ? br.ruling(page.q.id) : null;
    if (r && r.awaiting && !msg) {
      if (!r.admin) items.push({ label: '管理登入後可在這裡核准', cls: 'pri', run: () => { if (br.login) br.login(); } });
      else if (!r.n) items.push({ label: '沒有待辦，到會議頁裁示', cls: 'pri', run: () => br.meetings(page.q.id) });
      else if (!confirm) items.push({ label: `核准執行（派出 ${r.n} 條指令）`, cls: 'pri', run: again(true) });
      else items.push({ label: `確定核准，派出 ${r.n} 條指令`, cls: 'pri', run: () => { br.approve(page.q.id).then(m => { projSig = ''; drawProjector(); again(false, m)(); }); return true; } },
        { label: '取消', run: again(false) });
      if (r.admin) items.push({ label: '修正後核准／不通過…', run: () => br.meetings(page.q.id) });
    }
    const turn = d => () => { slideFreeze = slideIndex(performance.now() / 1000) + d; projSig = ''; drawProjector(); return again(false)(); };
    items.push({ label: '下一頁', run: turn(1) }, { label: '上一頁', run: turn(-1) });
  }
  items.push({ label: '打開會議紀錄', cls: page ? '' : 'pri', run: () => { if (br) br.meetings(id || 'list'); } });
}
function screenMenu(kind, obj) {
  let S = SCREENS[kind];
  if (kind === 'smallmeet' || kind === 'project') { const r = floor.rooms.find(q => q.id === obj.userData.roomId) || {};
    S = kind === 'smallmeet' ? { name: (r.label || '會議室') + ' 螢幕', sub: r.meetingId ? '進行中的會議' : '目前沒有會議', w: 1.8, h: 1.0,
        open: r.meetingId ? ['打開會議紀錄', () => { if (window.cloudlogBridge) window.cloudlogBridge.meetings(r.meetingId); }] : null }
      : { name: '專案：' + (r.label || ''), sub: '目標、成員與指令進度', w: 2.2, h: 1.24, open: ['打開專案', () => { if (window.cloudlogBridge && window.cloudlogBridge.project) window.cloudlogBridge.project(r.pid); }] }; }
  const items = [];
  if (kind === 'projector') projectorItems(items, kind, obj);
  else if (S.open) items.push({ label: S.open[0], cls: 'pri', run: S.open[1] });
  items.push(backItem());
  const fz = slideFreeze, pg = kind === 'projector' && floor.projector.slide;
  presentScreen(kind, obj, S, pg ? '會議簡報：' + pg.q.title : S.sub, items);
  if (kind === 'projector') slideFreeze = fz;
}
function deskScreenMenu(seatId) {   // close-up of someone's desk monitors
  const scr = floor.screens.get(seatId); if (!scr) return;
  const ag = scr.agent, items = [];
  if (ag) items.push({ label: '查看紀錄與指令', cls: 'pri', run: () => { if (window.cloudlogBridge) window.cloudlogBridge.open(ag.key); } },
    { label: '讓他做…', run: () => { personMenu(ag); return true; } });
  items.push(backItem());
  if (FLAT) { showMenu(ag ? shortName(ag) + ' 的螢幕' : '空座位', ag ? stateText(ag) : '', items, null, false, false, [scr.cv, scr.cv2]); return; }
  const f = focusFace(scr.holders[0], .82, .46, .62, 1.9), narrow = camera.aspect < 1;
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

// ---------- 像素平面版（2D 俯視）----------
// 模擬（人物狀態、走路、房間分配、設備、螢幕內容）和 3D 共用，只有「畫」不同：
// 背景是把 3D 樓層從正上方用低解析度拍一張（每公尺 PPM 像素，樓層或風格改變時重拍），人物、名牌、泡泡、螢幕圖示用 2D 畫。
// 螢幕在俯視圖上看不到內容，所以點螢幕圖示會跳出放大卡（showMenu 的 shots），按鈕與 3D 的選單相同。
const PPM = 16;
flat.cv = document.createElement('canvas'); flat.cv.className = 'o-flat'; flat.cv.hidden = true; flat.ctx = flat.cv.getContext('2d');
renderer.domElement.after(flat.cv);
const W2S = (x, y) => flat.portrait ? [(y - flat.v.cy) * flat.v.s + flat.ox, (x - flat.v.cx) * flat.v.s + flat.oy] : [(x - flat.v.cx) * flat.v.s + flat.ox, (flat.v.cy - y) * flat.v.s + flat.oy];
const S2W = (sx, sy) => flat.portrait ? [(sy - flat.oy) / flat.v.s + flat.v.cx, (sx - flat.ox) / flat.v.s + flat.v.cy] : [(sx - flat.ox) / flat.v.s + flat.v.cx, flat.v.cy - (sy - flat.oy) / flat.v.s];
function flatLayout() { const w = box.clientWidth, h = box.clientHeight; flat.portrait = w < h; flat.ox = w / 2; flat.oy = 44 + Math.max(40, h - 108) / 2; return [w, h]; }
function flatRect(x0, y0, x1, y1) {   // the view that shows this rectangle (scene coords)
  const [w, h] = flatLayout(), P = flat.portrait, aw = w - 16, ah = Math.max(40, h - 108);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s: Math.min(90, aw / (P ? y1 - y0 : x1 - x0), ah / (P ? x1 - x0 : y1 - y0)) };
}
function flatGo(v, animate) { if (animate) flat.go = { t0: clock.elapsedTime, from: { ...flat.v }, to: v }; else { flat.go = null; flat.v = { ...v }; } }
function setFlat(on, quiet) {
  FLAT = on; if (!quiet) { try { localStorage.setItem('cloudlog.flat', on ? '1' : '0'); } catch {} }
  renderer.domElement.hidden = on; flat.cv.hidden = !on; closeMenu();
  if (floor) { userMoved = false; fit(); } renderLegend();
}
// 從正上方拍一張低解析度的樓層當背景（人物、名牌、地板上的字不拍）
function flatSnapshot() {
  const { W, D } = floor, w = Math.round((W + 2) * PPM), h = Math.round((D + 2) * PPM);
  const cam = new THREE.OrthographicCamera(-(W + 2) / 2, (W + 2) / 2, (D + 2) / 2, -(D + 2) / 2, .1, 100);
  cam.position.set(W / 2, 40, -D / 2); cam.up.set(0, 0, -1); cam.lookAt(W / 2, 0, -D / 2);
  const hid = []; scene.traverse(o => { if (o.visible && (o.isSprite || o.userData.key != null || o.userData.sign)) { o.visible = false; hid.push(o); } });
  renderer.setPixelRatio(1); renderer.setSize(w, h, false); renderer.render(scene, cam);
  flat.bg.width = w; flat.bg.height = h; const x = flat.bg.getContext('2d', { willReadFrequently: true }); x.drawImage(renderer.domElement, 0, 0);
  for (const o of hid) o.visible = true;
  try { const im = x.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4) { d[i] = Math.round(d[i] / 24) * 24; d[i + 1] = Math.round(d[i + 1] / 24) * 24; d[i + 2] = Math.round(d[i + 2] / 24) * 24; } x.putImageData(im, 0, 0); } catch {}   // 色階減少，更像像素圖
  renderer.setPixelRatio(pixelRatio()); resize(); flat.dirty = false;
}
// 小人：18×24 的像素圖，依 config 的 look 上色；frame 0 站、1／2 走路、3 坐；back = 背面
function flatSprite(ag, frame, back) {
  const L = ag.group.look || {}, shirt = L.shirt || colorOf(ag.group), key = [L.hair, L.style, shirt, L.skin, L.pants, L.shoes, L.glasses, L.badge, frame, back].join('|');
  let c = flat.sprites.get(key); if (c) return c;
  c = document.createElement('canvas'); c.width = 18; c.height = 24; const x = c.getContext('2d', { willReadFrequently: true });
  const hair = L.hair || '#3a2a20', skin = L.skin || '#f0c8a4', pants = L.pants || '#2d3640', shoes = L.shoes || '#1d2127', st = L.style || 'short';
  const r = (col, px, py, w, h) => { x.fillStyle = col; x.fillRect(px + 1, py + 1, w, h); };
  const leg = (px, len) => { r(pants, px, 16, 2, len); r(shoes, px - (px < 8 ? 1 : 0), 16 + len, 3, 1); };
  if (frame === 3) { leg(5, 2); leg(9, 2); } else { leg(5, frame === 1 ? 3 : 5); leg(9, frame === 2 ? 3 : 5); }
  r(shirt, 4, 9, 8, 7); r(shirt, 3, 10, 1, 4); r(shirt, 12, 10, 1, 4); r(skin, 3, 14, 1, 1); r(skin, 12, 14, 1, 1);
  if (L.badge && !back) r(typeof L.badge === 'string' ? L.badge : '#3a6fd8', 10, 11, 1, 2);
  r(skin, 4, 2, 8, 7); r(hair, 5, 1, 6, 1); r(hair, 4, 2, 8, 2); r(hair, 4, 4, 1, 2); r(hair, 11, 4, 1, 2);
  if (back) r(hair, 4, 2, 8, 6);
  else { r('#1b1d26', 6, 6, 1, 1); r('#1b1d26', 9, 6, 1, 1); if (L.glasses) { const g = typeof L.glasses === 'string' ? L.glasses : '#2b2f38'; r(g, 5, 6, 1, 1); r(g, 7, 6, 2, 1); r(g, 10, 6, 1, 1); } }
  if (st === 'spiky') for (const px of [5, 7, 9]) r(hair, px, 0, 1, 1);
  if (st === 'bun') r(hair, 7, -1, 2, 2);
  if (st === 'long') { r(hair, 3, 3, 1, 9); r(hair, 12, 3, 1, 9); if (back) r(hair, 4, 8, 8, 4); }
  if (st === 'ponytail') r(hair, 12, 4, 2, 6);
  if (st === 'lowtail') r(hair, 12, 7, 2, 5);
  if (st === 'twintail') { r(hair, 2, 4, 2, 6); r(hair, 12, 4, 2, 6); }
  const im = x.getImageData(0, 0, 18, 24), d = im.data, edge = [];   // 深色外框
  const op = (i, j) => i >= 0 && j >= 0 && i < 18 && j < 24 && d[(j * 18 + i) * 4 + 3] > 0;
  for (let j = 0; j < 24; j++) for (let i = 0; i < 18; i++) if (!op(i, j) && (op(i - 1, j) || op(i + 1, j) || op(i, j - 1) || op(i, j + 1))) edge.push(i, j);
  x.fillStyle = '#161a22'; for (let k = 0; k < edge.length; k += 2) x.fillRect(edge[k], edge[k + 1], 1, 1);
  flat.sprites.set(key, c); return c;
}
function flatMarks() {   // 牆面螢幕的位置（樓層重建後算一次）
  if (flat.marks) return flat.marks;
  const L = [], add = (kind, obj, label) => { if (!obj) return; obj.updateWorldMatrix(true, false); const p = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld); L.push({ kind, obj, x: p.x, y: -p.z, label }); };
  if (floor.projector) add('projector', floor.projector.mesh, '投影幕');
  if (floor.kanban) { add('kanban', floor.kanban.mesh, '看板牆'); add('trial', floor.trial.mesh, '試播'); }
  if (floor.portrait) add('portrait', floor.portrait.mesh, '副螢幕');
  for (const r of floor.rooms) if (r.screen) add(r.kind, r.screen.mesh, r.kind === 'project' ? '專案看板' : '螢幕');
  for (const scr of floor.screens.values()) { const h = scr.holders[0]; h.updateWorldMatrix(true, false); const p = new THREE.Vector3().setFromMatrixPosition(h.matrixWorld); scr.fx = p.x; scr.fy = -p.z; }
  return (flat.marks = L);
}
const flatHot = m => m.kind === 'projector' ? !!floor.projector.meetingId : m.kind === 'smallmeet' ? !!(floor.rooms.find(q => q.id === m.obj.userData.roomId) || {}).meetingId : false;
function flatPerson(ag) {   // where and how big someone is drawn
  const gp = ag.p.g.position, [sx, sy] = W2S(gp.x, -gp.z), k = Math.max(1, Math.round(flat.v.s * 1.35 / 24 * 2) / 2);
  return { sx, sy, k, w: 18 * k, h: 24 * k };
}
function drawFlat(t) {
  if (!floor) return; if (flat.dirty) flatSnapshot();
  const cv = flat.cv, x = flat.ctx, dpr = pixelRatio(), [w, h] = flatLayout();
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  if (flat.go) { const g = flat.go, q = Math.min(1, (t - g.t0) / .5), e = q < .5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
    for (const n of ['cx', 'cy', 's']) flat.v[n] = g.from[n] + (g.to[n] - g.from[n]) * e; if (q >= 1) flat.go = null; }
  const v = flat.v, P = flat.portrait, k = v.s / PPM, Y1 = floor.D + 1, narrow = w < 560;
  x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = bgColor(); x.fillRect(0, 0, w, h);
  x.imageSmoothingEnabled = false; x.save();
  if (P) x.transform(0, k, -k, 0, (Y1 - v.cy) * v.s + flat.ox, (-1 - v.cx) * v.s + flat.oy); else x.transform(k, 0, 0, k, (-1 - v.cx) * v.s + flat.ox, (v.cy - Y1) * v.s + flat.oy);
  x.drawImage(flat.bg, 0, 0); x.restore();
  // 房間名稱（左上角）
  x.textBaseline = 'bottom'; x.textAlign = 'left'; x.lineJoin = 'round';
  for (const r of floor.rooms) { const a = W2S(r.x0, r.y0 + r.d), b = W2S(r.x0 + r.w, r.y0), lx = Math.min(a[0], b[0]) + 7, ly = Math.max(a[1], b[1]) - 7, rw = Math.abs(b[0] - a[0]) - 14;
    const name = r.kind === 'meeting' ? 'B+ 大會議室' : r.kind === 'pantry' ? '茶水間' : r.kind === 'studio' ? '錄課棚' : r.kind === 'lounge' ? '休憩區' : r.kind === 'project' ? '專案：' + r.label : r.label;
    let fs = Math.max(10, Math.min(15, v.s * .5)); x.font = `800 ${fs}px ${F}`; let txt = name; while (txt.length > 2 && x.measureText(txt).width > rw) txt = txt.slice(0, -1);
    x.lineWidth = 3; x.strokeStyle = bgColor(); x.strokeText(txt, lx, ly); x.fillStyle = signColor(roomColor(r) || U.mute); x.fillText(txt, lx, ly); }
  x.textBaseline = 'top';
  // 座位螢幕：有人用時亮起（顏色＝狀態）
  const marks = flatMarks();
  for (const scr of floor.screens.values()) { if (!scr.agent) continue; const [sx, sy] = W2S(scr.fx, scr.fy), len = Math.max(8, v.s * .8), th = Math.max(3, v.s * .16);
    x.fillStyle = css(STATES[scr.agent.mode].tok) || U.ok; x.globalAlpha = scr.agent.mode === 'idle' ? .35 : 1;
    P ? x.fillRect(Math.round(sx - th / 2), Math.round(sy - len / 2), Math.round(th), Math.round(len)) : x.fillRect(Math.round(sx - len / 2), Math.round(sy - th / 2), Math.round(len), Math.round(th)); x.globalAlpha = 1; }
  // 設備：運作中閃光
  for (const dev of floor.devices.values()) { const on = dev.runUntil > t || !!deviceUser(dev); if (!on) continue; const [sx, sy] = W2S(dev.pos.x, -dev.pos.z);
    x.fillStyle = '#' + new THREE.Color(dev.info.fx).getHexString(); x.globalAlpha = .45 + Math.sin(t * 5) * .2; const q = Math.round(Math.max(6, v.s * .45)); x.fillRect(Math.round(sx - q / 2), Math.round(sy - q / 2), q, q); x.globalAlpha = 1; }
  // 牆面螢幕圖示（點了放大）
  for (const m of marks) { const [sx, sy] = W2S(m.x, m.y), u = Math.max(2, Math.round(v.s / 14)), bw = 9 * u, bh = 7 * u, x0 = Math.round(sx - bw / 2), y0 = Math.round(sy - bh / 2), hot = flatHot(m);
    x.fillStyle = '#10151d'; x.fillRect(x0, y0, bw, bh - 2 * u); x.fillRect(x0 + 4 * u, y0 + bh - 2 * u, u, u); x.fillRect(x0 + 2 * u, y0 + bh - u, 5 * u, u);
    x.fillStyle = hot ? (Math.floor(t * 2) % 2 ? U.gold : U.warn) : U.dAccent; x.fillRect(x0 + u, y0 + u, bw - 2 * u, bh - 4 * u);
    x.fillStyle = '#10151d'; x.fillRect(x0 + 2 * u, y0 + 2 * u, 3 * u, u);
    if (v.s >= 30) { x.font = `700 10px ${F}`; x.textAlign = 'center'; x.lineWidth = 3; x.strokeStyle = bgColor(); x.strokeText(m.label, sx, y0 + bh + 2); x.fillStyle = T.tag.ink === '#14202b' ? U.mute : T.tag.ink; x.fillText(m.label, sx, y0 + bh + 2); x.textAlign = 'left'; } }
  // 人物（由上往下畫，前面的蓋住後面的）
  const people = [...agents.values()].map(ag => ({ ag, ...flatPerson(ag) })).sort((a, b) => a.sy - b.sy);
  for (const q of people) { const ag = q.ag, gp = ag.p.g.position;
    if (ag.walking && ag.fpx != null) { const [px, py] = W2S(ag.fpx, ag.fpy); if (Math.abs(q.sy - py) > Math.abs(q.sx - px) + .01) ag.fback = q.sy < py; else if (Math.abs(q.sx - px) > .01) ag.fback = false; }
    else if (!ag.walking && ag.target) { const yaw = (((ag.target.yaw_deg || 0) % 360) + 540) % 360 - 180; ag.fback = ag.target.type === 'SEAT' && Math.abs(yaw) < 45 && !P; }
    ag.fpx = gp.x; ag.fpy = -gp.z;
    const frame = ag.walking ? 1 + Math.floor(t * 6 + ag.phase) % 2 : ag.seated ? 3 : 0, sp = flatSprite(ag, frame, !!ag.fback);
    x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(Math.round(q.sx - 5 * q.k), Math.round(q.sy - q.k), 10 * q.k, 2 * q.k);
    x.globalAlpha = ag.mode === 'idle' && !ag.ov ? .55 : 1; x.drawImage(sp, Math.round(q.sx - q.w / 2), Math.round(q.sy - q.h + (frame === 3 ? 4 * q.k : q.k)), q.w, q.h); x.globalAlpha = 1; }
  // 名牌與對話泡泡（沿用 3D 的圖）
  x.imageSmoothingEnabled = true;
  const lw = narrow ? 80 : 100, lh = lw / 4;
  for (const q of people) { const ag = q.ag, top = q.sy - q.h + (ag.seated && !ag.walking ? 4 * q.k : 0);
    if (showNames) x.drawImage(ag.label.cv, Math.round(q.sx - lw / 2), Math.round(top - lh - 1), lw, lh);
    const bb = ag.bubble; if (bb.spr.visible && t > bb.until) bb.spr.visible = false;
    if (bb.spr.visible) x.drawImage(bb.cv, Math.round(q.sx - lw), Math.round(top - (showNames ? lh : 0) - lw * 2 * 96 / 512 - 2), lw * 2, lw * 2 * 96 / 512); }
  for (const dev of floor.devices.values()) { const [sx, sy] = W2S(dev.pos.x, -dev.pos.z);
    if (showNames && v.s >= 38) x.drawImage(dev.tag.material.map.image, Math.round(sx - 32), Math.round(sy - v.s * .5 - 20), 64, 18);
    if (dev.bubble && dev.bubble.spr.visible) x.drawImage(dev.bubble.cv, Math.round(sx - lw), Math.round(sy - v.s * .5 - 22 - lw * 2 * 96 / 512), lw * 2, lw * 2 * 96 / 512); }
}
// 點選：螢幕圖示 → 人物 → 設備 → 座位螢幕 → 房間
function flatPick(sx, sy) {
  if (!floor) return; const v = flat.v, near = (x, y, r) => { const p = W2S(x, y); return Math.hypot(p[0] - sx, p[1] - sy) < r; };
  for (const m of flatMarks()) if (near(m.x, m.y, Math.max(16, v.s * .7))) { screenMenu(m.kind, m.obj); return; }
  const lw = box.clientWidth < 560 ? 80 : 100;
  const hit = [...agents.values()].map(ag => ({ ag, ...flatPerson(ag) })).sort((a, b) => b.sy - a.sy).find(q => (Math.abs(sx - q.sx) < Math.max(10, q.w / 2) && sy < q.sy + 4 && sy > q.sy - q.h - 2)
    || (showNames && Math.abs(sx - q.sx) < lw / 2 && sy < q.sy - q.h && sy > q.sy - q.h - lw / 4 - 2));
  if (hit) { focusPoint(hit.ag.p.g.position.clone().setY(1), 8); personMenu(hit.ag); return; }
  for (const dev of floor.devices.values()) if (near(dev.pos.x, -dev.pos.z, Math.max(14, v.s * .55))) { focusPoint(dev.pos.clone().setY(.9), 6); deviceMenu(dev); return; }
  for (const scr of floor.screens.values()) if (near(scr.fx, scr.fy, Math.max(12, v.s * .45))) { deskScreenMenu(scr.seat.id); return; }
  const [wx, wy] = S2W(sx, sy), pt = new THREE.Vector3(wx, 0, -wy), room = floor.rooms.find(rm => inRoom(rm, pt));
  if (room) roomMenu(room); else closeMenu();
}
// 拖曳平移、滾輪與雙指縮放
{ const pts = new Map(); let moved = 0, pinch = 0;
  const zoomAt = (sx, sy, f) => { const [wx, wy] = S2W(sx, sy); flat.go = null; flat.v.s = Math.max(6, Math.min(110, flat.v.s * f)); const [nx, ny] = S2W(sx, sy); flat.v.cx += wx - nx; flat.v.cy += wy - ny; userMoved = true; };
  const local = e => { const r = flat.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  flat.cv.addEventListener('pointerdown', e => { flat.cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, local(e)); if (pts.size === 1) moved = 0; pinch = 0; });
  flat.cv.addEventListener('pointermove', e => { const p0 = pts.get(e.pointerId); if (!p0) return; const p = local(e);
    if (pts.size === 1) { const dx = p[0] - p0[0], dy = p[1] - p0[1]; moved += Math.hypot(dx, dy);
      if (moved > 6) { flat.go = null; userMoved = true; const s = flat.v.s; if (flat.portrait) { flat.v.cy -= dx / s; flat.v.cx -= dy / s; } else { flat.v.cx -= dx / s; flat.v.cy += dy / s; } } }
    pts.set(e.pointerId, p);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d / pinch); pinch = d; moved = 99; } });
  const up = e => { const p = pts.get(e.pointerId); if (!p) return; pts.delete(e.pointerId); pinch = 0; if (e.type === 'pointerup' && !pts.size && moved <= 6) flatPick(p[0], p[1]); };
  flat.cv.addEventListener('pointerup', up); flat.cv.addEventListener('pointercancel', up);
  flat.cv.addEventListener('wheel', e => { e.preventDefault(); const p = local(e); zoomAt(p[0], p[1], Math.exp(-e.deltaY * .0015)); }, { passive: false }); }

// ---------- boot ----------
async function boot() {
  try {
    const [office, meet, meetNavG, mm, pan, panNav, pm] = await Promise.all([
      loadGlb(LIB_OFFICE + 'scene.glb'), loadGlb(LIB_MEET + 'scene.glb'), loadGlb(LIB_MEET + 'navmesh.glb'),
      fetch(LIB_MEET + 'scene.json').then(r => r.json()),
      loadGlb(LIB_PANTRY + 'scene.glb'), loadGlb(LIB_PANTRY + 'navmesh.glb'), fetch(LIB_PANTRY + 'scene.json').then(r => r.json())]);
    lib = office.scene; lib.meetScene = meet.scene; lib.meetNav = meetNavG.scene; meetMeta = mm;
    lib.pantryScene = pan.scene; lib.pantryNav = panNav.scene; pantryMeta = pm;
    try { const [lo, loNav, lm] = await Promise.all([loadGlb(LIB_LOUNGE + 'scene.glb'), loadGlb(LIB_LOUNGE + 'navmesh.glb'), fetch(LIB_LOUNGE + 'scene.json').then(r => r.json())]);
      lib.loungeScene = lo.scene; lib.loungeNav = loNav.scene; loungeMeta = lm; } catch (e) { console.warn('休憩區場景載入失敗，先不顯示', e); }
    resize(); tintModels(); setFlat(FLAT, true);
    update(lastGroups, lastOpts);
    if (window.cloudlogBridge) window.cloudlogBridge.refresh();
  } catch (e) {
    console.error(e); info.textContent = '辦公室場景載入失敗';
    const d = document.createElement('div'); d.className = 'o-err'; d.textContent = '無法載入 3D 場景：' + (e.message || e) + '。請確認 indoor-scenes 已公開（或已開 GitHub Pages）且 config.js 的 sceneBase 正確；也可以先切換到「圓框」檢視。'; box.append(d);
  }
}
window.cloudlogOffice = { update, command: (key, kind) => command(key, kind) };
boot();
