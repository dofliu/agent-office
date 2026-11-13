// 場景：把同一層樓「搬到另一個地方」。房間配置、家具位置、人物與協作功能都不變，
// 換掉的是外面的環境（海、庭園）、牆與門的樣式、地板材質。風格在 js/themes.js 用 scene: '名稱' 指定。
// 新增場景：在這裡加一個 SCENES.<名稱>(ctx) → { group, tick(t) }，需要的地板或牆面花紋加到 PATTERNS。
// 視角提醒：橫式畫面鏡頭在南邊上方往北看、直式在東邊上方往西看，所以高的東西放北邊和西邊，南邊和東邊只放矮的。
import * as THREE from 'three';

// ---------- 花紋（用 canvas 畫，重複貼圖）----------
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const PATTERNS = {
  // 名稱: [一格幾公尺, 粗糙度, 畫法]
  tatami: [1.82, .95, (x, S) => {   // 兩張榻榻米，深色布邊
    x.fillStyle = '#c3bd86'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) { x.fillStyle = rnd() < .5 ? 'rgba(120,125,70,.16)' : 'rgba(235,230,180,.18)'; x.fillRect(rnd() * S, rnd() * S, 14 + rnd() * 30, 1); }
    x.fillStyle = '#2f3a2c'; for (const y of [0, S / 2]) { x.fillRect(0, y, S, 5); x.fillRect(0, y + S / 2 - 5, S, 5); } x.fillRect(0, 0, 3, S); x.fillRect(S - 3, 0, 3, S); }],
  planks: [1.6, .7, (x, S) => {   // 緣側木地板
    for (let i = 0; i < 4; i++) { x.fillStyle = ['#9c6c42', '#a67448', '#93643c', '#a06f45'][i]; x.fillRect(0, i * S / 4, S, S / 4);
      for (let k = 0; k < 26; k++) { x.fillStyle = 'rgba(60,35,15,.13)'; x.fillRect(rnd() * S, i * S / 4 + rnd() * S / 4, 30 + rnd() * 80, 1); }
      x.fillStyle = '#4e331d'; x.fillRect(0, i * S / 4, S, 2); x.fillRect((i * 97) % S, i * S / 4, 2, S / 4); } }],
  gravel: [2.4, 1, (x, S) => {   // 枯山水的耙紋白砂
    x.fillStyle = '#e4dece'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 1400; i++) { x.fillStyle = rnd() < .5 ? 'rgba(150,140,120,.25)' : 'rgba(255,255,255,.5)'; x.fillRect(rnd() * S, rnd() * S, 2, 2); }
    x.strokeStyle = 'rgba(140,130,110,.55)'; x.lineWidth = 3; for (let y = 8; y < S; y += 16) { x.beginPath(); x.moveTo(0, y); x.lineTo(S, y); x.stroke(); } }],
  moss: [5, 1, (x, S) => {
    x.fillStyle = '#5c7a3c'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 500; i++) { x.fillStyle = ['rgba(80,110,50,.5)', 'rgba(110,140,70,.45)', 'rgba(60,90,45,.5)'][i % 3]; x.beginPath(); x.arc(rnd() * S, rnd() * S, 3 + rnd() * 9, 0, 7); x.fill(); } }],
  tile: [1.2, .6, (x, S) => {   // 屋瓦
    x.fillStyle = '#3d4349'; x.fillRect(0, 0, S, S);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { x.fillStyle = (r + c) % 2 ? '#454c53' : '#363c42'; x.beginPath(); x.roundRect(c * S / 4 + 2, r * S / 4 + 2, S / 4 - 4, S / 4 + 8, 12); x.fill(); x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(c * S / 4 + 6, r * S / 4 + 4, 6, S / 4 - 6); } }],
  shoji: [.9, .9, (x, S) => {   // 紙拉門：和紙＋木格
    x.fillStyle = '#f5f0e2'; x.fillRect(0, 0, S, S); x.fillStyle = '#5b3d27';
    x.fillRect(0, 0, S, 14); x.fillRect(0, S - 26, S, 26); x.fillRect(0, 0, 7, S); x.fillRect(S - 7, 0, 7, S);
    for (const f of [1 / 3, 2 / 3]) { x.fillRect(S * f - 2, 0, 4, S); x.fillRect(0, 14 + (S - 40) * f - 2, S, 4); } }],
  deck: [2, .55, (x, S) => {   // 平台鋼板：防滑花紋
    x.fillStyle = '#6f7d83'; x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 3;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const cx = c * 32 + 16, cy = r * 32 + 16, d = (r + c) % 2 ? 1 : -1; x.beginPath(); x.moveTo(cx - 8, cy - 8 * d); x.lineTo(cx + 8, cy + 8 * d); x.stroke(); }
    x.fillStyle = 'rgba(30,40,45,.5)'; x.fillRect(0, 0, S, 3); x.fillRect(0, 0, 3, S); }],
  rubber: [2, .85, (x, S) => {   // 艙內防滑地墊
    x.fillStyle = '#b9c6cc'; x.fillRect(0, 0, S, S);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.arc(c * 32 + 16, r * 32 + 16, 7, 0, 7); x.fill(); x.fillStyle = 'rgba(70,90,100,.18)'; x.beginPath(); x.arc(c * 32 + 17, r * 32 + 18, 7, 0, 7); x.fill(); }
    x.fillStyle = 'rgba(60,80,90,.35)'; x.fillRect(0, 0, S, 2); x.fillRect(0, 0, 2, S); }],
  grate: [1.2, .5, (x, S) => {   // 走道格柵
    x.fillStyle = '#4d595f'; x.fillRect(0, 0, S, S); x.fillStyle = '#8b989e';
    for (let i = 0; i < S; i += 16) { x.fillRect(i, 0, 5, S); x.fillRect(0, i, S, 3); } }],
  bulkhead: [1.2, .6, (x, S) => {   // 艙壁：白色鋼板、橘色警示條、鉚釘
    x.fillStyle = '#e6ecef'; x.fillRect(0, 0, S, S); x.fillStyle = '#f08a24'; x.fillRect(0, 0, S, 34); x.fillStyle = '#39454c'; x.fillRect(0, S - 30, S, 30);
    x.fillStyle = 'rgba(60,75,85,.35)'; x.fillRect(0, 0, 3, S); for (let y = 60; y < S - 40; y += 44) { x.beginPath(); x.arc(14, y, 4, 0, 7); x.fill(); x.beginPath(); x.arc(S - 14, y, 4, 0, 7); x.fill(); } }],
  sea: [26, .3, (x, S) => {
    const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#176a93'); g.addColorStop(1, '#1f7ea6'); x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) { x.strokeStyle = `rgba(255,255,255,${.06 + rnd() * .16})`; x.lineWidth = 1 + rnd() * 2; const px = rnd() * S, py = rnd() * S, l = 14 + rnd() * 40; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + l / 2, py - 5, px + l, py); x.stroke(); } }],
  helipad: [1, .7, (x, S) => {
    x.fillStyle = '#2f7d5b'; x.fillRect(0, 0, S, S); x.strokeStyle = '#f4d23c'; x.lineWidth = 10; x.beginPath(); x.arc(S / 2, S / 2, S * .4, 0, 7); x.stroke();
    x.strokeStyle = '#fff'; x.lineWidth = 6; x.beginPath(); x.arc(S / 2, S / 2, S * .3, 0, 7); x.stroke(); x.fillStyle = '#fff'; x.font = '900 120px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('H', S / 2, S / 2 + 6); }]
};
const texCache = new Map();
function pattern(name) {
  if (texCache.has(name)) return texCache.get(name);
  const [size, rough, draw] = PATTERNS[name], c = document.createElement('canvas'); c.width = c.height = 256; draw(c.getContext('2d'), 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const p = { t, size, rough }; texCache.set(name, p); return p;
}
const matCache = new Map();
// 一塊 w × d 公尺的面要用的材質（花紋依大小重複）；tint 可把花紋染色
export function patternMat(name, w, d, tint) {
  const key = [name, w.toFixed(2), d.toFixed(2), tint || ''].join('|'); if (matCache.has(key)) return matCache.get(key);
  const p = pattern(name), t = p.t.clone(); t.needsUpdate = true; t.repeat.set(Math.max(.05, w / p.size), Math.max(.05, d / p.size));
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: p.rough, color: tint || '#ffffff' }); matCache.set(key, m); return m;
}
const flat = new Map();
const M = (c, r = .8, e) => { const k = c + '|' + r + '|' + (e || ''); if (!flat.has(k)) flat.set(k, new THREE.MeshStandardMaterial({ color: c, roughness: r, ...(e ? { emissive: e, emissiveIntensity: 1 } : {}) })); return flat.get(k); };

// 地板：場景座標（x 東、y 北）的矩形
export function floorPatch(group, name, x0, y0, x1, y1, lift = 0, tint) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), patternMat(name, x1 - x0, y1 - y0, tint));
  m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, .004 + lift, -(y0 + y1) / 2); group.add(m); return m;
}
// 牆：st = { tex 花紋, cap 壓頂顏色, post 柱子顏色 }；沿 x 或 y 的直線段
export function styledWall(group, st, x0, y0, x1, y1, H, TK) {
  const len = Math.hypot(x1 - x0, y1 - y0); if (len < .05) return;
  const g = new THREE.Group(), side = patternMat(st.tex, len, pattern(st.tex).size), end = M(st.cap, .8);
  const body = new THREE.Mesh(new THREE.BoxGeometry(len, H, TK), [end, end, end, end, side, side]); body.position.y = H / 2; g.add(body);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(len + .04, .07, TK + .08), end); cap.position.y = H + .035; g.add(cap);
  if (st.post) for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.15, H + .16, .15), M(st.post, .8)); p.position.set(s * len / 2, (H + .16) / 2, 0); g.add(p); }
  g.position.set((x0 + x1) / 2, 0, -(y0 + y1) / 2); if (x0 === x1) g.rotation.y = Math.PI / 2; group.add(g);
}
// 門口的門框（門都開在南北向的牆上）：和風＝木門框＋暖簾＋燈籠；風場＝黃色艙門框＋警示燈
export function doorFrame(group, kind, x, y, color) {
  const g = new THREE.Group(); g.position.set(x, 0, -y);
  const box = (w, h, d, m, px, py, pz = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(px, py, pz); g.add(o); return o; };
  if (kind === 'machiya') { const wood = M('#4a3122', .8);
    for (const s of [-1, 1]) box(.1, 2.05, .1, wood, s * .66, 1.025);
    box(1.6, .1, .14, wood, 0, 2.05); box(1.75, .06, .2, wood, 0, 2.14);
    for (const s of [-1, 0, 1]) { const c = new THREE.Mesh(new THREE.PlaneGeometry(.38, .5), new THREE.MeshStandardMaterial({ color, roughness: .9, side: THREE.DoubleSide })); c.position.set(s * .4, 1.74, 0); g.add(c); }
    const dot = new THREE.Mesh(new THREE.CircleGeometry(.09, 16), new THREE.MeshBasicMaterial({ color: '#fbf7ec', side: THREE.DoubleSide })); dot.position.set(0, 1.74, .006); g.add(dot); const d2 = dot.clone(); d2.position.z = -.006; g.add(d2);
    const lan = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .22, 10), M('#fff1cf', .6, '#ffb65c')); lan.position.set(.82, 1.72, 0); g.add(lan); box(.02, .14, .02, wood, .82, 1.9);
  } else { const y1 = M('#f2b705', .6), dark = M('#27323a', .7);
    for (const s of [-1, 1]) { box(.12, 2.0, .16, y1, s * .68, 1.0); box(.125, .18, .165, dark, s * .68, .5); box(.125, .18, .165, dark, s * .68, 1.3); }
    box(1.48, .14, .16, y1, 0, 2.03);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 8), M(color, .4, color)); lamp.position.set(0, 2.17, 0); g.add(lamp); }
  group.add(g);
}

// ---------- 小工具 ----------
function kit(g) {
  const add = o => { g.add(o); return o; };
  return { add,
    box: (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return add(o); },
    cyl: (rt, rb, h, m, x, y, z, seg = 14) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); return add(o); },
    ball: (r, m, x, y, z, sy = 1) => { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m); o.position.set(x, y, z); o.scale.y = sy; return add(o); },
    strut: (a, b, r, m) => { const v = new THREE.Vector3().subVectors(b, a), o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 8), m); o.position.copy(a).addScaledVector(v, .5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); return add(o); } };
}

// ---------- 離岸風場運維中心：海上平台 ----------
function offshore({ W, D }) {
  const g = new THREE.Group(), k = kit(g), ticks = [], mg = 4, SEA = -12.5;
  const cx = W / 2, cz = -D / 2, dw = W + mg * 2, dd = D + mg * 2, xa = -mg, xb = W + mg, za = mg, zb = -(D + mg);
  const yel = M('#f2b705', .6), white = M('#eef2f4', .6), dark = M('#2c363d', .7), steel = M('#8d999f', .5), orange = M('#e8611a', .6), red = M('#c8322b', .6);
  // 甲板、黃色踢腳、欄杆
  const side = M('#56636a', .6);
  k.add(new THREE.Mesh(new THREE.BoxGeometry(dw, .6, dd), [side, side, patternMat('deck', dw, dd), side, side, side])).position.set(cx, -.31, cz);
  for (const [w, d, x, z] of [[dw, .14, cx, za], [dw, .14, cx, zb], [.14, dd, xa, cz], [.14, dd, xb, cz]]) k.box(w, .16, d, yel, x, .08, z);
  for (const y of [.6, 1.1]) for (const [w, d, x, z] of [[dw, .05, cx, za], [dw, .05, cx, zb], [.05, dd, xa, cz], [.05, dd, xb, cz]]) k.box(w, .05, d, yel, x, y, z);
  const posts = []; for (let x = xa; x <= xb + .01; x += 2) posts.push([x, za], [x, zb]); for (let z = zb + 2; z < za; z += 2) posts.push([xa, z], [xb, z]);
  const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(.07, 1.1, .07), yel, posts.length), mt = new THREE.Matrix4();
  posts.forEach(([x, z], i) => pm.setMatrixAt(i, mt.makeTranslation(x, .55, z))); g.add(pm);
  for (let x = xa + 6; x < xb; x += 12) { const b = k.add(new THREE.Mesh(new THREE.TorusGeometry(.3, .09, 8, 18), orange)); b.position.set(x, .75, za + .08); }   // 救生圈
  // 支撐腳與斜撐
  const legs = [[xa + 3, za - 3], [xb - 3, za - 3], [xa + 3, zb + 3], [xb - 3, zb + 3], [cx, za - 3], [cx, zb + 3]];
  for (const [x, z] of legs) { k.cyl(1.0, 1.0, 14, yel, x, -7.6, z, 16); k.cyl(1.25, 1.25, 1.2, dark, x, SEA + .9, z, 16); }
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const z of [za - 3, zb + 3]) { k.strut(V(xa + 3, -2, z), V(cx, -10, z), .22, steel); k.strut(V(cx, -2, z), V(xa + 3, -10, z), .22, steel); k.strut(V(cx, -2, z), V(xb - 3, -10, z), .22, steel); k.strut(V(xb - 3, -2, z), V(cx, -10, z), .22, steel); }
  for (const x of [xa + 3, xb - 3]) { k.strut(V(x, -2, za - 3), V(x, -10, zb + 3), .22, steel); k.strut(V(x, -2, zb + 3), V(x, -10, za - 3), .22, steel); }
  // 海
  const seaMat = patternMat('sea', 900, 900); seaMat.metalness = .15;
  const sea = k.add(new THREE.Mesh(new THREE.PlaneGeometry(900, 900), seaMat)); sea.rotation.x = -Math.PI / 2; sea.position.set(cx, SEA, cz);
  ticks.push(t => { seaMat.map.offset.set(t * .012, t * .02); });
  // 直升機甲板（東側）
  const hx = xb + 6, hpad = k.add(new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, .35, 8), [dark, patternMat('helipad', 1, 1), dark])); hpad.position.set(hx, -.18, cz); hpad.rotation.y = Math.PI / 8;
  k.box(2.4, .2, 3, patternMat('grate', 2.4, 3), xb + .9, -.11, cz);
  k.strut(V(hx, -.4, cz), V(xb - 3, -8, za - 3), .2, steel); k.strut(V(hx, -.4, cz), V(xb - 3, -8, zb + 3), .2, steel);
  // 吊車（西北角）
  const crane = new THREE.Group(), ck = kit(crane); crane.position.set(xa + 1.6, 0, zb + 1.6); g.add(crane);
  ck.cyl(.55, .7, 4.6, yel, 0, 2.3, 0); ck.box(1.8, 1.5, 1.8, white, 0, 5.3, 0); ck.box(1.82, .5, 1.82, dark, 0, 5.4, 0);
  const boom = new THREE.Group(), bk = kit(boom); boom.position.set(.6, 5.6, 0); boom.rotation.z = .5; crane.add(boom);
  for (let i = 0; i < 6; i++) bk.box(2, .34, .34, i % 2 ? white : red, 1 + i * 2, 0, 0);
  crane.rotation.y = -.5;
  // 備用葉片與貨櫃（北側甲板、西側甲板）
  const blade = k.add(new THREE.Mesh(new THREE.CylinderGeometry(.12, .75, 15, 10), white)); blade.rotation.z = Math.PI / 2; blade.scale.z = .3; blade.position.set(cx + 9, .75, zb + 1.5);
  const tip = k.add(new THREE.Mesh(new THREE.CylinderGeometry(.12, .2, 1.6, 10), red)); tip.rotation.z = Math.PI / 2; tip.scale.z = .3; tip.position.set(cx + 2.2, .75, zb + 1.5);
  for (const dx of [4, 9, 14]) k.box(.3, .55, 1.1, yel, cx + dx, .28, zb + 1.5);
  k.box(5.8, 2.5, 2.4, M('#1f6fb0', .6), xa + 8.2, 1.25, zb + 1.6); k.box(5.8, 2.5, 2.4, orange, xa + 14.6, 1.25, zb + 1.6);
  // 氣象桅杆與雷達（東北角，細，不擋視線）
  k.cyl(.07, .1, 7, steel, xb - 1.4, 3.5, zb + 1.4, 8);
  const radar = k.box(1.6, .16, .3, white, xb - 1.4, 7.1, zb + 1.4); ticks.push(t => { radar.rotation.y = t * 1.6; });
  // 運維船（南邊海面）
  const boat = new THREE.Group(), tk = kit(boat); tk.box(8, 1.3, 2.8, M('#17406b', .6), 0, .2, 0); tk.box(8.02, .25, 2.82, orange, 0, .8, 0); tk.box(3, 1.5, 2.2, white, -1, 1.7, 0); tk.box(1.2, .1, 2.3, dark, -1, 2.0, 0); tk.cyl(.04, .04, 1.6, steel, -1.8, 3.2, 0, 6);
  boat.position.set(W * .3, SEA, zb - 9); boat.rotation.y = .25; g.add(boat); ticks.push(t => { boat.position.y = SEA + Math.sin(t * 1.3) * .12; boat.rotation.z = Math.sin(t * .9) * .03; });
  // 風機（北邊與西邊的海上）
  const turbine = (x, z, s, ph) => { const tg = new THREE.Group(), q = kit(tg); tg.position.set(x, SEA, z); tg.scale.setScalar(s);
    q.cyl(1.25, 1.25, 6, yel, 0, 3, 0, 16); q.cyl(.55, 1.0, 36, white, 0, 24, 0, 16); q.box(1.8, 1.6, 4.2, white, 0, 42.6, -.6);
    const rotor = new THREE.Group(), r = kit(rotor); rotor.position.set(0, 42.6, 1.9); r.ball(.9, white, 0, 0, 0);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(.14, .8, 19, 8), white); b.scale.z = .28; b.position.y = 9.9; const arm = new THREE.Group(); arm.add(b); arm.rotation.z = i * Math.PI * 2 / 3; rotor.add(arm); }
    tg.add(rotor); g.add(tg); ticks.push(t => { rotor.rotation.z = -(t * .55 + ph); }); };
  [[cx - 17, zb - 14, .55], [W - 5, zb - 17, .55], [-34, zb - 30, 1], [cx - 14, zb - 42, 1], [cx + 22, zb - 34, 1], [W + 36, zb - 52, 1], [-70, zb - 80, 1.05], [cx, zb - 95, 1.05], [W + 78, zb - 100, 1.05], [-62, cz + 6, 1], [-110, cz - 30, 1.05]].forEach(([x, z, s], i) => turbine(x, z, s, i * 1.3));
  return { group: g, tick: t => { for (const f of ticks) f(t); } };
}

// ---------- 和風町屋：木造屋與庭園 ----------
function machiya({ W, D, rooms }) {
  const g = new THREE.Group(), k = kit(g), ticks = [], cx = W / 2, cz = -D / 2;
  const wood = M('#4a3122', .8), stone = M('#8b8d88', .95), plaster = M('#efe9db', .9), tileM = M('#3d4349', .6);
  // 庭園地面：苔地、南北各一片枯山水白砂
  const moss = k.add(new THREE.Mesh(new THREE.PlaneGeometry(W + 70, D + 70), patternMat('moss', W + 70, D + 70))); moss.rotation.x = -Math.PI / 2; moss.position.set(cx, -.34, cz);
  for (const [y0, y1] of [[-8.2, -2.2], [D + 2.2, D + 7.5]]) { const s = k.add(new THREE.Mesh(new THREE.PlaneGeometry(W + 10, y1 - y0), patternMat('gravel', W + 10, y1 - y0))); s.rotation.x = -Math.PI / 2; s.position.set(cx, -.32, -(y0 + y1) / 2); }
  // 屋子的基座（緣側木地板，四周比房間寬 1.4 公尺）
  const pw = W + 2.8, pd = D + 2.8;
  k.add(new THREE.Mesh(new THREE.BoxGeometry(pw, .34, pd), [wood, wood, patternMat('planks', pw, pd), wood, wood, wood])).position.set(cx, -.18, cz);
  for (const x of [cx - pw / 2 + .2, cx - pw / 4, cx, cx + pw / 4, cx + pw / 2 - .2]) for (const z of [1.2, -(D + 1.2)]) k.box(.3, .3, .3, stone, x, -.34, z);   // 礎石
  // 屋簷：每間房間朝外那一側的瓦片屋簷
  for (const r of rooms) { const north = r.y0 > 1, y = north ? r.y0 + r.d + .55 : r.y0 - .55;
    const e = k.add(new THREE.Mesh(new THREE.BoxGeometry(r.w + .5, .09, 1.3), [tileM, tileM, patternMat('tile', r.w + .5, 1.3), tileM, tileM, tileM])); e.position.set(r.x0 + r.w / 2, 1.0, -y); e.rotation.x = north ? .32 : -.32;
    k.box(r.w + .5, .14, .14, wood, r.x0 + r.w / 2, 1.2, -(north ? r.y0 + r.d : r.y0)); }
  // 圍牆（土牆＋瓦頂，矮矮的）與西側大門
  const wx0 = -9.5, wx1 = W + 9.5, wy0 = -9, wy1 = D + 9;
  const seg = (x0, y0, x1, y1) => { const len = Math.hypot(x1 - x0, y1 - y0), horiz = y0 === y1; k.box(horiz ? len : .3, 1.2, horiz ? .3 : len, plaster, (x0 + x1) / 2, .28, -(y0 + y1) / 2); k.box(horiz ? len : .62, .16, horiz ? .62 : len, tileM, (x0 + x1) / 2, .96, -(y0 + y1) / 2); };
  const gy = (rooms.find(r => r.kind === 'office') || { d: 7 }).d + 1.3;   // 走廊中線
  seg(wx0, wy0, wx1, wy0); seg(wx0, wy1, wx1, wy1); seg(wx1, wy0, wx1, wy1); seg(wx0, wy0, wx0, gy - 1.6); seg(wx0, gy + 1.6, wx0, wy1);
  for (const s of [-1, 1]) k.box(.28, 3.2, .28, wood, wx0, 1.3, -(gy + s * 1.5)); k.box(.5, .22, 4.2, wood, wx0, 2.75, -gy);
  const roof = k.add(new THREE.Mesh(new THREE.BoxGeometry(1.9, .14, 4.8), [tileM, tileM, patternMat('tile', 1.9, 4.8), tileM, tileM, tileM])); roof.position.set(wx0, 3.05, -gy);
  for (let i = 0; i < 9; i++) k.cyl(.36, .4, .08, stone, wx0 + 1 + i * .88, -.3, -(gy + (i % 2 ? .22 : -.22)), 9);   // 飛石
  // 樹：松（北、西）、楓（北）、櫻（西南角外，矮）
  const tree = (x, y, h, leaf, spread = 1) => { k.cyl(.1, .17, h * .6, M('#4b3524', .9), x, h * .3 - .3, -y, 7);
    for (const [dx, dy, dz, r] of [[0, h * .78, 0, .95], [.6, h * .62, .25, .7], [-.55, h * .66, -.3, .75], [.1, h * .95, -.2, .6]]) k.ball(r * spread, leaf, x + dx * spread, dy - .3, -y + dz * spread, .62); };
  const pine = M('#2f5a3a', .9), maple = M('#c4502a', .9), maple2 = M('#e08a2e', .9), sakura = M('#f2b6c6', .9);
  [[-6, D + 5.5, 5.2, pine, 1.25], [cx - 9, D + 6.2, 4.4, maple, 1.1], [cx + 6, D + 6.6, 4.8, pine, 1.2], [W - 8, D + 6, 4.2, maple2, 1.1], [W + 5.5, D + 5.2, 4.6, pine, 1.15],
    [-6.5, 2.5, 4.4, maple, 1.1], [-6, -5.8, 3.3, sakura, 1.2], [cx - 14, -5.6, 2.6, pine, .9], [cx + 3, -6.2, 2.5, maple2, .85]].forEach(a => tree(...a));
  for (let i = 0; i < 16; i++) { const x = -7.6 + rnd() * 2.4, y = D - 4 + rnd() * 6, h = 4.5 + rnd() * 2; k.cyl(.05, .06, h, M('#6f9a4a', .7), x, h / 2 - .3, -y, 6); k.ball(.42, M('#7fae55', .9), x, h - .3, -y, .5); }   // 竹
  // 石燈籠、景石
  const lantern = (x, y) => { k.cyl(.22, .28, .16, stone, x, -.24, -y, 6); k.cyl(.09, .11, .62, stone, x, .15, -y, 6); k.box(.36, .08, .36, stone, x, .5, -y); k.box(.24, .24, .24, M('#fff1cf', .6, '#ffb65c'), x, .66, -y);
    const c = k.add(new THREE.Mesh(new THREE.ConeGeometry(.34, .26, 4), stone)); c.position.set(x, .91, -y); c.rotation.y = Math.PI / 4; };
  [[cx - 6, -4.2], [cx + 20, -3.6], [4, D + 4], [W - 3, D + 4.4], [-4.2, gy - 2.6]].forEach(a => lantern(...a));
  for (const [x, y, s] of [[cx - 4, -5.4, .7], [cx - 3, -5.9, .42], [cx + 9, -4.6, .55], [cx - 22, -4.2, .5], [cx + 2, D + 5.2, .6], [W + 4, -5.5, .6]]) { const r = k.add(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stone)); r.position.set(x, -.3 + s * .45, -y); r.scale.y = .7; r.rotation.y = x; }
  // 錦鯉池（東南）與小橋
  const px = W - 7, py = -5.2, pond = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ color: '#2f7f95', roughness: .15, metalness: .2 }));
  pond.rotation.x = -Math.PI / 2; pond.scale.set(4.4, 2.3, 1); pond.position.set(px, -.3, -py); g.add(pond);
  for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, s = .22 + rnd() * .2; const r = k.add(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stone)); r.position.set(px + Math.cos(a) * 4.5, -.24, -py + Math.sin(a) * 2.4); r.scale.y = .6; }
  [['#f2742b', 1.5, .9, 0], ['#f5f1ea', 2.6, .7, 2], ['#e23b2a', 2.0, -.8, 4], ['#f2b02b', 3.2, .55, 1]].forEach(([c, r, sp, ph]) => { const f = k.add(new THREE.Mesh(new THREE.CapsuleGeometry(.07, .3, 3, 8), M(c, .5))); f.rotation.z = Math.PI / 2;
    ticks.push(t => { const a = t * sp * .5 + ph; f.position.set(px + Math.cos(a) * r, -.27, -py + Math.sin(a) * r * .5); f.rotation.y = -a - (sp > 0 ? Math.PI / 2 : -Math.PI / 2); }); });
  const br = new THREE.Group(), bq = kit(br); br.position.set(px - 1.2, -.3, -py);
  for (let i = -3; i <= 3; i++) bq.box(.3, .07, 1.1, M('#b3261e', .7), i * .3, .42 - i * i * .035, 0); for (const s of [-1, 1]) for (const z of [-.5, .5]) bq.box(.07, .5, .07, M('#b3261e', .7), s * .95, .28, z);
  br.rotation.y = Math.PI / 2; g.add(br);
  return { group: g, tick: t => { for (const f of ticks) f(t); } };
}

export const SCENES = { offshore, machiya };
