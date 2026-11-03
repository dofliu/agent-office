// 動態畫面（運鏡、點選操作、圓框模式）逐格錄製工具。
// 看板在真實時間載入完資料與 3D 場景後，切換成「虛擬時鐘」：每一格手動把時間往前推 1/30 秒、
// 讓 three.js 畫一張、再截圖，所以不論機器多慢，畫面都是平順的 30 fps。
// 鏡頭由 shots.js 的路徑控制；點擊用真的滑鼠事件（畫面上另外畫一個游標）。
//
// 隱私與「不談技術細節」的處理都在 HIDE_CSS／installBlur：
//   標題上方的「Google Drive · 雲端紀錄資料夾」、頁尾資料來源與原始碼連結、選單底部「不會寫入雲端」隱藏；
//   側欄的 email 一律模糊，內文裡的 email、@帳號模糊，網址用色塊遮住。重拍時不要拿掉。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const SIZES = {
  land: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },   // 1920×1080
  ui: { viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 },      // 1920×1080，介面字放大兩倍（側欄、選單、圓框）
  port: { viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 }      // 1080×1920（手機版面）
};

const HIDE_CSS = `
.eyebrow{visibility:hidden!important}
footer.src{visibility:hidden!important}
.o-menu-f{display:none!important}
.d-title .email{filter:blur(9px)!important}
.pv-blur{color:transparent!important;text-shadow:0 0 9px rgba(40,50,60,.75)!important}
.pv-mask{color:transparent!important;text-shadow:none!important;background:rgba(96,108,122,.3);border-radius:6px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
#__cur{position:fixed;left:0;top:0;width:34px;height:34px;z-index:99999;pointer-events:none;display:none;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))}
#__cur svg{width:34px;height:34px;display:block}
#__cur i{position:absolute;left:-26px;top:-26px;width:52px;height:52px;border-radius:50%;border:4px solid #2dd4bf;opacity:0;transform:scale(.3)}
#__cur.click i{animation:__ripple .6s ease-out both}
@keyframes __ripple{0%{opacity:.95;transform:scale(.3)}100%{opacity:0;transform:scale(1.4)}}
`;
const FULL_OFFICE_CSS = '#office{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;border:0!important;border-radius:0!important;z-index:5;margin:0!important}';

// 在頁面最前面執行：時間位移到快照時刻、可切換的虛擬時鐘、固定亂數種子、停掉 30 秒整頁重繪。
function initScript(cfg) {
  const RD = Date, rnow = RD.now.bind(RD), rperf = performance.now.bind(performance);
  const SHIFT = cfg.nowEpoch ? cfg.nowEpoch - rnow() : 0;
  const S = window.__vc = { on: false, perf: 0, epoch: 0, timers: [], seq: 1e7, rafs: [], base: new WeakMap() };
  const epochNow = () => (S.on ? S.epoch : rnow() + SHIFT);
  function VDate(...a) { if (!new.target) return new RD(epochNow()).toString(); return a.length ? new RD(...a) : new RD(epochNow()); }
  VDate.now = epochNow; VDate.parse = RD.parse; VDate.UTC = RD.UTC; VDate.prototype = RD.prototype;
  window.Date = VDate;
  try { performance.now = () => (S.on ? S.perf : rperf()); } catch (e) {}
  let seed = cfg.seed >>> 0 || 20261103;
  Math.random = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rRAF = window.requestAnimationFrame.bind(window), rCAF = window.cancelAnimationFrame.bind(window);
  const rST = window.setTimeout.bind(window), rSI = window.setInterval.bind(window), rCT = window.clearTimeout.bind(window), rCI = window.clearInterval.bind(window);
  window.requestAnimationFrame = cb => { if (!S.on) return rRAF(cb); const id = ++S.seq; S.rafs.push([id, cb]); return id; };
  window.cancelAnimationFrame = id => { if (id > 1e7) S.rafs = S.rafs.filter(r => r[0] !== id); else rCAF(id); };
  window.setTimeout = (fn, d, ...a) => { if (!S.on) return rST(fn, d, ...a); const id = ++S.seq; S.timers.push({ id, fn, due: S.perf + (+d || 0), a, every: null }); return id; };
  window.setInterval = (fn, d, ...a) => {
    if (+d === 30e3) return 0;   // 看板每 30 秒整頁重繪（更新「N 分鐘前」），錄影時不需要，還會讓側欄重播動畫
    if (!S.on) return rSI(fn, d, ...a); const id = ++S.seq, e = Math.max(1, +d || 0); S.timers.push({ id, fn, due: S.perf + e, a, every: e }); return id;
  };
  window.clearTimeout = window.clearInterval = id => { if (id > 1e7) S.timers = S.timers.filter(t => t.id !== id); else { rCT(id); rCI(id); } };
  S.start = () => {
    S.perf = rperf(); S.epoch = rnow() + SHIFT; S.on = true;
    for (const an of document.getAnimations()) S.base.set(an, S.perf - (an.currentTime == null ? 0 : an.currentTime));
  };
  S.step = ms => {
    S.perf += ms; S.epoch += ms;
    for (let g = 0; g < 5000; g++) {
      const due = S.timers.filter(t => t.due <= S.perf).sort((a, b) => a.due - b.due); if (!due.length) break;
      const t = due[0]; if (t.every == null) S.timers = S.timers.filter(x => x !== t); else t.due += t.every;
      try { t.fn(...t.a); } catch (e) { console.error(e); }
    }
    const batch = S.rafs; S.rafs = [];
    for (const [, cb] of batch) { try { cb(S.perf); } catch (e) { console.error(e); } }
    for (const an of document.getAnimations()) {
      let b = S.base.get(an); if (b === undefined) { b = S.perf; S.base.set(an, b); }
      try { an.pause(); an.currentTime = Math.max(0, S.perf - b); } catch (e) {}
    }
  };
  // 游標（只是畫面上的圖示；真正的點擊由 Playwright 的滑鼠送出）
  window.__cursor = (x, y, show = true) => {
    let c = document.getElementById('__cur');
    if (!c) { c = document.createElement('div'); c.id = '__cur';
      c.innerHTML = '<i></i><svg viewBox="0 0 24 24"><path d="M3 2l16 9.5-7.2 1.6L8.6 20z" fill="#fff" stroke="#0b141c" stroke-width="1.6" stroke-linejoin="round"/></svg>';
      document.body.append(c); }
    c.style.display = show ? 'block' : 'none'; c.style.transform = `translate(${x - 4}px,${y - 3}px)`;
  };
  window.__ripple = () => { const c = document.getElementById('__cur'); if (!c) return; c.classList.remove('click'); void c.offsetWidth; c.classList.add('click'); };
}

// 側欄裡的 email 模糊、網址遮色塊（同 capture_drawers.js）。看板重繪側欄時用 MutationObserver 再套一次。
function installBlur() {
  const pat = 'https?://[!-~]+|[!-~]*sk=[!-~]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*|@[A-Za-z0-9._-]{2,}';
  const apply = () => {
    for (const root of document.querySelectorAll('.drawer, .o-menu, #stage')) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes = [];
      for (let t; (t = walker.nextNode());)
        if (!(t.parentNode.classList && (t.parentNode.classList.contains('pv-blur') || t.parentNode.classList.contains('pv-mask'))) && new RegExp(pat).test(t.nodeValue)) nodes.push(t);
      for (const t of nodes) {
        const s = t.nodeValue, frag = document.createDocumentFragment(), re = new RegExp(pat, 'g');
        let last = 0, m;
        while ((m = re.exec(s))) {
          if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
          const sp = document.createElement('span'); sp.className = /^https?:|sk=/i.test(m[0]) ? 'pv-mask' : 'pv-blur'; sp.textContent = m[0]; frag.appendChild(sp);
          last = m.index + m[0].length;
        }
        if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
        t.parentNode.replaceChild(frag, t);
      }
    }
  };
  const obs = new MutationObserver(() => { obs.disconnect(); apply(); obs.observe(document.body, { childList: true, subtree: true, characterData: true }); });
  apply(); obs.observe(document.body, { childList: true, subtree: true, characterData: true });
}

// 鏡頭路徑小工具（頁面裡用）：依弧長等速的 Catmull-Rom 曲線＋頭尾緩入緩出。
function installCamLib() {
  const lerp = (a, b, k) => a + (b - a) * k;
  const cr = (p0, p1, p2, p3, u) => { const u2 = u * u, u3 = u2 * u;
    return p1.map((_, i) => .5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * u + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u3)); };
  function curve(pts) {   // returns f(s), s in [0,1] by arc length
    if (pts.length === 1) return () => pts[0].slice();
    const P = [pts[0].map((v, i) => 2 * v - pts[1][i]), ...pts, pts[pts.length - 1].map((v, i) => 2 * v - pts[pts.length - 2][i])];
    const samp = [], N = 60;
    for (let k = 1; k < P.length - 2; k++) for (let j = 0; j < N; j++) samp.push(cr(P[k - 1], P[k], P[k + 1], P[k + 2], j / N));
    samp.push(pts[pts.length - 1].slice());
    const L = [0]; for (let i = 1; i < samp.length; i++) L.push(L[i - 1] + Math.hypot(...samp[i].map((v, j) => v - samp[i - 1][j])));
    const tot = L[L.length - 1] || 1;
    return s => { const x = Math.min(1, Math.max(0, s)) * tot; let lo = 0, hi = L.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (L[mid] < x) lo = mid; else hi = mid; }
      const k = L[hi] > L[lo] ? (x - L[lo]) / (L[hi] - L[lo]) : 0; return samp[lo].map((v, i) => lerp(v, samp[hi][i], k)); };
  }
  // ease: 0..1 → 0..1，前後各 a 比例加減速，中段等速
  const ease = (k, a = .22) => { k = Math.min(1, Math.max(0, k)); const v = 1 / (1 - a);
    if (k < a) return v * k * k / (2 * a); if (k > 1 - a) return 1 - v * (1 - k) * (1 - k) / (2 * a); return v * (k - a / 2); };
  const S = (x, y, h) => [x, h, -y];   // 場景座標（x 東、y 北、h 高）→ three
  // 依時間的關鍵格：K = [[秒, 鏡頭位置, 看向, fov?], ...]；中間點平順通過，頭尾與重複點（停住）速度為 0
  function keys(K) {
    const n = K.length, same = (a, b) => a.every((v, j) => Math.abs(v - b[j]) < 1e-9);
    const tan = (i, idx) => {
      if (i === 0 || i === n - 1) return K[i][idx].map(() => 0);
      const a = K[i - 1], b = K[i + 1], c = K[i];
      if (same(a[idx], c[idx]) || same(b[idx], c[idx])) return c[idx].map(() => 0);
      return c[idx].map((_, j) => (b[idx][j] - a[idx][j]) / (b[0] - a[0]));
    };
    return t => {
      if (t <= K[0][0]) return { p: K[0][1], l: K[0][2], fov: K[0][3] };
      if (t >= K[n - 1][0]) return { p: K[n - 1][1], l: K[n - 1][2], fov: K[n - 1][3] };
      let i = 0; while (t > K[i + 1][0]) i++;
      const a = K[i], b = K[i + 1], h = b[0] - a[0], s = (t - a[0]) / h, s2 = s * s, s3 = s2 * s;
      const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
      const mix = idx => { const m0 = tan(i, idx), m1 = tan(i + 1, idx); return a[idx].map((v, j) => h00 * v + h10 * h * m0[j] + h01 * b[idx][j] + h11 * h * m1[j]); };
      const fov = a[3] != null && b[3] != null ? a[3] + (b[3] - a[3]) * (3 * s2 - 2 * s3) : (a[3] != null ? a[3] : b[3]);
      return { p: mix(1), l: mix(2), fov };
    };
  }
  window.__camlib = { curve, keys, ease, lerp, S, smooth: k => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); } };
}

// 安排人物與游標的小工具（頁面裡用，window.__st）
function installStageLib() {
  const d = window.__dbg, C = window.__camlib;
  const byNick = n => [...d.agents.values()].find(a => a.group.nick === n);
  const projCss = v => { const p = v.clone().project(d.camera), r = d.renderer.domElement.getBoundingClientRect();
    return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height, p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2]; };
  const st = window.__st = {
    ag: byNick,
    // 看板內建的「讓他做…」動作；place = 直接放到目的地，freeze = 停在那裡不結束
    cmd(n, kind, o = {}) { const ag = byNick(n); if (!ag) return false; d.command(ag.key, kind);
      if (o.place && ag.ov) { const s = ag.ov.steps[ag.ov.i]; if (s.to) d.placeAt(ag, s.to); }
      if (o.freeze && ag.ov) ag.wait = Infinity; return !!ag.ov; },
    say(n, text, sec = 2) { const ag = byNick(n); if (ag) d.say(ag, text, sec); },
    seat(n, standing = false) { const ag = byNick(n); if (ag) { ag.standing = standing; ag.standNext = 1e12; } },
    screenOf(n) { const ag = byNick(n); return ag && d.floor.screens.get(d.deskOf.get(ag.key).id); },
    wp(o) { const v = new d.THREE.Vector3(); o.updateWorldMatrix(true, false); o.getWorldPosition(v); return v; },
    projCss,
    // 目標的畫面座標（CSS px）：[x,y]、'ag:暱稱:高度'、'w:x,y,h'（場景座標）、'el:選擇器'、'btn:按鈕文字'、'scr:暱稱:0|1'（座位螢幕）
    pos(tg) {
      if (Array.isArray(tg)) return tg;
      const [k, a, b] = tg.split(':');
      if (k === 'ag') { const ag = byNick(a); if (!ag) return null; const v = ag.p.g.position.clone(); v.y = +(b || 1); return projCss(v); }
      if (k === 'w') { const [x, y, h] = a.split(',').map(Number); return projCss(new d.THREE.Vector3(x, h, -y)); }
      if (k === 'scr') { const s = st.screenOf(a); return s ? projCss(st.wp(s.holders[+b || 0])) : null; }
      const el = k === 'el' ? document.querySelector(tg.slice(3)) : [...document.querySelectorAll('button')].find(x => x.textContent.trim() === tg.slice(4) && x.offsetParent);
      if (!el) return null; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2];
    },
    // 游標：K = [[開始, 到達, 目標], ...]；在 開始→到達 之間平順移過去，之後跟著目標；目標 'hide' = 藏起來
    cur(K, t) {
      if (!K.length || t < K[0][0]) return [0, 0, false];
      let i = 0; while (i + 1 < K.length && t >= K[i + 1][0]) i++;
      const [s, e, tg] = K[i]; if (tg === 'hide') return [0, 0, false];
      const to = st.pos(tg); if (!to) return st.last ? [...st.last, true] : [0, 0, false];
      let out = to;
      if (i > 0 && t < e && K[i - 1][2] !== 'hide') { const from = st.pos(K[i - 1][2]) || st.last;
        if (from) { const k = C.smooth((t - s) / (e - s)); out = [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]; } }
      st.last = [out[0], out[1]]; window.__curPos = st.last; return [out[0], out[1], true];
    }
  };
}

async function launch() {
  return chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

// 開看板：opts.size 'land' | 'port'；opts.feed 快照 JSON（不給就用線上資料）；opts.now 快照時刻（ISO）
async function openBoard(browser, opts = {}) {
  const size = SIZES[opts.size || 'land'];
  const ctx = await browser.newContext({ ...size, colorScheme: 'light', locale: 'zh-TW', timezoneId: 'Asia/Taipei' });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => console.log('  [pageerror]', e.message));
  pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) console.log('  [console]', m.text().slice(0, 200)); });
  await pg.addInitScript(initScript, { nowEpoch: opts.now ? Date.parse(opts.now) : 0, seed: opts.seed || 20261103 });
  await pg.addInitScript(([view]) => {
    try { localStorage.clear(); localStorage.setItem('cloudlog.view', view || 'office'); localStorage.setItem('cloudlog.focus', '0'); localStorage.setItem('cloudlog.names', '1'); localStorage.setItem('cloudlog.team', 'all'); } catch (e) {}
  }, [opts.view || 'office']);
  if (opts.feed) await pg.route(/script\.google(usercontent)?\.com/, r => r.fulfill({ status: 200, contentType: 'application/json', body: fs.readFileSync(opts.feed) }));
  await pg.route(/js\/office\.js/, async r => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()) + `
window.__dbg = { THREE, agents, deskOf, held, scene, camera, controls, renderer, clock, placeAt, goTo, say, command, endOverride, focusFace, focusPoint, focusRoom,
  flyTo, fit, closeMenu, personMenu, deviceMenu, deskScreenMenu, screenMenu, roomMenu, runDevice, B2T, nickOf, devSay,
  get floor() { return floor; }, get fly() { return fly; }, setFly: v => { fly = v; }, setUserMoved: v => { userMoved = v; } };` }); });
  await pg.goto(opts.base || 'http://127.0.0.1:8765/index.html');
  await pg.waitForFunction(() => window.__dbg && window.__dbg.floor && window.__dbg.agents.size > 0 && /上次/.test(document.getElementById('syncText').textContent), null, { timeout: 120000 });
  await pg.addStyleTag({ content: HIDE_CSS });
  await pg.evaluate(installBlur);
  await pg.evaluate(installCamLib);
  await pg.evaluate(installStageLib);
  await pg.evaluate(() => { const c = window.__dbg.controls; c.enableDamping = false; c.minDistance = .05; c.maxDistance = 500; c.maxPolarAngle = Math.PI * .499; });
  await sleep(1500);
  return pg;
}

async function fullOffice(pg, on = true) {
  if (on) await pg.addStyleTag({ content: FULL_OFFICE_CSS + ' #oInfo,#oLegend,#oFull{visibility:hidden!important}' });
  await sleep(800);
}

// 錄一段。spec = {
//   dir, frames, fps(30),
//   cam:    '(t, d, C) => ({ p, l, fov })' 字串；回傳 null 時交給看板自己的鏡頭（點人物、點房間時的飛行）
//   cursor: '[[開始, 到達, 目標], ...]' 字串（見 __st.cur）
//   events: [{ t, js: '頁面裡執行的字串' } | { t, click: true } | { t, move: true }]
//   track:  '(d, C) => ({ 名稱: [x, y, z] })' 字串；每格把這些 3D 點投影到畫面，存成 track.json（給影片標籤跟著跑）
// }
// preview = [秒, ...]：只用 10 fps 跑一遍、只拍這幾個時間點（檢查構圖用）
async function record(pg, spec, preview = null) {
  const fps = preview ? 10 : (spec.fps || 30), dur = spec.frames / (spec.fps || 30), N = Math.round(dur * fps);
  const dir = spec.dir, dsf = await pg.evaluate(() => devicePixelRatio);
  if (!preview) { fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); }
  else fs.mkdirSync(dir, { recursive: true });
  const evs = (spec.events || []).map(e => ({ ...e, done: false }));
  await pg.evaluate(([cam, cursor, track]) => {
    window.__shotCam = cam ? (new Function('return ' + cam))() : null;
    window.__shotCursorK = cursor ? JSON.parse(cursor) : null;
    window.__shotTrack = track ? (new Function('return ' + track))()(window.__dbg, window.__camlib) : null;
    if (!window.__vc.on) window.__vc.start();
  }, [spec.cam || null, spec.cursor ? JSON.stringify(spec.cursor) : null, spec.track || null]);
  const shots = preview ? new Set(preview.map(s => Math.min(N - 1, Math.round(s * fps)))) : null;
  const trackOut = [];
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const t = i / fps;
    for (const e of evs) if (!e.done && e.t <= t + 1e-6) {
      e.done = true;
      if (e.js) await pg.evaluate(`(${e.js})()`);
      if (e.click || e.move) { const c = await pg.evaluate(() => window.__curPos);
        if (c) { if (e.click) { await pg.mouse.click(c[0], c[1]); await pg.evaluate(() => window.__ripple()); } else await pg.mouse.move(c[0], c[1]); } }
    }
    const tr = await pg.evaluate(([t, i, fps]) => {
      const d = window.__dbg, C = window.__camlib;
      if (window.__shotCam) { const r = window.__shotCam(t, d, C);
        if (r) { d.setFly(null); d.camera.position.set(...r.p); d.controls.target.set(...r.l); if (r.fov && d.camera.fov !== r.fov) { d.camera.fov = r.fov; d.camera.updateProjectionMatrix(); } } }
      window.__vc.step(i === 0 ? 0 : 1000 / fps);
      if (window.__shotCursorK) { const c = window.__st.cur(window.__shotCursorK, t); window.__cursor(c[0], c[1], c[2]); }
      if (!window.__shotTrack) return null;
      const out = {}; for (const [k, v] of Object.entries(window.__shotTrack)) { const q = window.__st.projCss(new d.THREE.Vector3(...v)); out[k] = [+(q[0] * devicePixelRatio).toFixed(1), +(q[1] * devicePixelRatio).toFixed(1), q[2] ? 1 : 0]; }
      return out;
    }, [t, i, fps]);
    if (tr) trackOut.push(tr);
    if (!preview || shots.has(i)) await pg.screenshot({ path: path.join(dir, preview ? `p_${t.toFixed(1)}.jpg` : `f_${String(i + 1).padStart(6, '0')}.jpg`), type: 'jpeg', quality: preview ? 80 : 92 });
    if (!preview && i % 30 === 29) process.stdout.write(`  ${path.basename(dir)} ${i + 1}/${N}  ${((Date.now() - t0) / (i + 1)).toFixed(0)} ms/格\r`);
  }
  if (!preview && trackOut.length) fs.writeFileSync(path.join(dir, 'track.json'), JSON.stringify({ fps, dsf, frames: trackOut }));
  if (!preview) fs.writeFileSync(path.join(dir, 'info.json'), JSON.stringify({ fps, frames: N, dsf }));
  process.stdout.write(`\n  ✓ ${path.basename(dir)} ${preview ? '預覽' : N + ' 格'}，${((Date.now() - t0) / 1000).toFixed(0)} 秒\n`);
}

module.exports = { launch, openBoard, fullOffice, record, sleep, SIZES };
