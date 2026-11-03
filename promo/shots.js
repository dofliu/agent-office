// 兩支影片用到的動態畫面（運鏡、點選、圓框模式）＝「鏡頭表」。每個鏡頭各開一次看板、從同一個時間點開始，所以可以單獨重拍。
//   node shots.js                      全部重拍（work/footage/<鏡頭>/f_000001.jpg …）
//   node shots.js --only corridor,screen --jobs 2
//   node shots.js --preview corridor   只拍幾張檢查構圖（work/preview/<鏡頭>/p_<秒>.jpg）
// 需要：repo 根目錄開 python3 -m http.server 8765 --bind 127.0.0.1。
// 資料：預設讀線上資料；FEED=快照.json NOW=2026-11-03T12:12:00+08:00 可以固定成同一份資料與時間（兩支影片才會一致）。
const path = require('path');
const { spawn } = require('child_process');
const M = require('./motion.js');

const OUT = path.join(__dirname, 'work');
const S = (x, y, h) => `S(${x},${y},${h})`;   // 場景座標（x 東、y 北、h 高），在頁面裡換成 three 座標
const K = rows => `(t, d, C) => { const S = C.S; return C.keys([${rows.map(r => `[${r.join(',')}]`).join(',')}])(t); }`;
// 2026-11-03 北側多了會議室 2、3，樓層寬 42.5 m（茶水間以東整排往東移 12 m）
const ROOMS = `(d, C) => ({ 'B+ 會議／試播室': [4, 1.2, -12.6], '會議室 2': [11.25, 1.2, -12.6], '會議室 3': [17.25, 1.2, -12.6], 'DofLab 辦公室': [5.2, 1, -3.4], '茶水間': [24.5, 1.2, -12.6], 'DofGM 辦公室': [16.1, 1, -3.4],
  '錄課棚': [32, 1.2, -12.6], 'NCUT_PJ 辦公室': [25.3, 1, -3.4], '共用座位': [39, 1, -13.1], '電話亭W': [0.85, 2.5, -8.3], '電話亭E': [41.65, 2.5, -8.3] })`;
const MEETING8 = ['小毅', '瑞弘', '小弘', '杜夫', '阿仁', '黃謙', '雛田', '小智'];
const meetSetup = `() => { for (const n of ${JSON.stringify(MEETING8)}) window.__st.cmd(n, 'meet', { place: true, freeze: true });
  for (const ag of window.__dbg.agents.values()) ag.bubble.spr.visible = false; }`;   // 抵達時的「來開會」泡泡先收掉
const say = (t, n, text, sec = 1.7) => ({ t, js: `() => window.__st.say(${JSON.stringify(n)}, ${JSON.stringify(text)}, ${sec})` });

const SHOTS = {
  // ───────────── 橫式（3 分鐘介紹片）1920×1080；介面鏡頭用 960×540 @2，字比較大 ─────────────
  aerial_open: { size: 'land', mode: 'full', sec: 9.6,
    cam: K([[0, S(16.85, 3.2, 54), S(21.25, 8.3, 0), 40], [4.8, S(12.55, -5.0, 39), S(21.25, 8.2, 0), 40], [9.6, S(19.85, -12.8, 29), S(21.25, 8.0, 0), 40]]),
    events: [{ t: .2, js: `() => { window.__st.cmd('瑞弘', 'pantry'); window.__st.cmd('阿茂', 'meet'); }` }] },
  corridor: { size: 'land', mode: 'full', sec: 14.4,
    setup: `() => { window.__st.cmd('阿翰', 'call', { place: true, freeze: true }); window.__st.cmd('杜夫', 'call'); window.__st.cmd('阿茂', 'meet'); }`,
    cam: K([[0, S(-3.0, 10.6, 3.6), S(3.5, 6.8, .6), 52], [3, S(1.5, 8.4, 3.4), S(9, 11.2, .6), 52], [6, S(10, 8.35, 3.3), S(17, 5.6, .6), 52],
      [9, S(19, 8.25, 3.3), S(26, 11.5, .7), 52], [12, S(28, 8.35, 3.4), S(34, 6.0, .7), 52], [14.4, S(35, 7.6, 4.5), S(41.6, 9.6, .9), 52]]),
    events: [say(.3, '阿翰', '視訊通話中', 3), say(10.8, '杜夫', '視訊通話中', 3.5)], track: ROOMS },
  office: { size: 'land', mode: 'full', sec: 10.4,
    setup: `() => { for (const n of ['阿翰', '黃謙', '小櫻', '瑞弘']) window.__st.seat(n, false); }`,
    cam: `(t, d, C) => { const k = C.ease(t / 10.4, .3), a = C.lerp(2.25, .62, k), r = C.lerp(6.4, 5.6, k), h = C.lerp(4.6, 3.0, k);
      return { p: C.S(5.2 + r * Math.sin(a), 3.3 - r * Math.cos(a), h), l: C.S(4.9, 3.2, .85), fov: 46 }; }`,
    events: [{ t: .3, js: `() => window.__st.cmd('小智', 'stand')` }],
    track: `(d, C) => ({ desk: [6.05, 1.35, -3.0], dual: [2.45, 1.4, -3.0], board: [.25, 1.45, -3.5] })` },
  screen: { size: 'land', mode: 'full', sec: 10.4,
    setup: `() => { window.__st.seat('小智', false); }`,
    cam: K([[0, S(8.2, -.9, 3.0), S(6.1, 2.6, .9), 42], [4.5, S(7.0, .6, 2.1), S(6.1, 2.9, 1.0), 42], [8, S(6.62, 1.45, 1.9), S(6.18, 3.0, 1.08), 40], [10.4, S(6.6, 1.5, 1.88), S(6.18, 3.0, 1.08), 40]]),
    track: `(d, C) => { const s = window.__st.screenOf('小智'); return { main: window.__st.wp(s.holders[0]).toArray(), side: window.__st.wp(s.holders[1]).toArray() }; }` },
  panel: { size: 'ui', mode: 'focus', sec: 9.4,
    setup: `() => { const d = window.__dbg; d.focusRoom(d.floor.byTeam.get('doflab')); }`,
    cam: `(t, d, C) => { const b = document.querySelector('.d-body'); if (b && t > 4.6) b.scrollTop = C.smooth((t - 4.6) / 4) * 380; return null; }`,
    cursor: [[.4, .4, [470, 330]], [.6, 1.5, 'ag:小智:1.0'], [2.0, 2.9, 'btn:查看紀錄與指令'], [3.5, 3.6, 'hide']],
    events: [{ t: 1.7, click: true }, { t: 3.15, click: true }] },
  circle: { size: 'ui', mode: 'ui', sec: 10.4,
    cursor: [[.5, .5, [520, 330]], [.7, 1.7, 'el:#vBubbles'], [2.3, 3.1, [560, 420]], [4.9, 5.7, 'el:#stage .orb:nth-child(4) .bubble'], [7.5, 8.2, [880, 515]], [8.7, 8.8, 'hide']],
    events: [{ t: 1.9, click: true }, { t: 5.8, move: true }, { t: 8.3, move: true }] },
  meetroom: { size: 'land', mode: 'full', sec: 10.4, setup: meetSetup,
    cam: K([[0, S(9.4, 7.0, 4.6), S(3.9, 12.9, .7), 44], [10.4, S(7.6, 8.4, 3.4), S(4.0, 12.9, .9), 44]]),
    events: [say(.6, '瑞弘', '提案：A～D 四項'), say(2.2, '小弘', 'E、F 併入 B → B+'), say(3.8, '杜夫', '加一個 G 專注區'), say(5.4, '阿仁', 'H：GPU 運算站'),
      say(7.0, '雛田', '錄課棚加直式拍攝位'), say(8.6, '小毅', '結論交老闆裁示')] },
  // B+ 西牆看板牆：左邊狀態、右邊今日回傳工作排名
  kanban: { size: 'land', mode: 'full', sec: 9.6,
    cam: K([[0, S(5.6, 11.9, 2.6), S(.12, 12.8, 1.45), 52], [5, S(3.3, 12.75, 1.75), S(.12, 12.8, 1.5), 44], [9.6, S(2.85, 12.8, 1.62), S(.12, 12.8, 1.56), 37]]),
    track: `(d, C) => ({ status: [.12, 1.7, -12.25], rank: [.12, 1.75, -13.35] })` },
  // 會議結束 → 投影幕播放會議簡報 → 老師點投影幕直接核准（依 M202611030011skun 的真實結論重現；寫入在本機假裝回應）
  slides: { size: 'land', mode: 'full', sec: 12.6, admin: true,
    cam: `(t, d, C) => t > 6.4 ? null : C.keys([[0, C.S(4.0, 8.2, 2.6), C.S(4.0, 15.2, 1.4), 44], [6.4, C.S(4.0, 11.7, 1.75), C.S(4.0, 15.2, 1.55), 42]])(t)`,
    events: [{ t: 0, js: `() => window.__dbg.slideTo(0)` }, { t: 2.0, js: `() => window.__dbg.slideTo(1)` }, { t: 3.9, js: `() => window.__dbg.slideTo(2)` }, { t: 5.6, js: `() => window.__dbg.slideTo(5)` },
      { t: 6.75, click: true }, { t: 8.55, click: true }, { t: 10.15, click: true }],
    cursor: [[5.6, 5.6, [1500, 980]], [5.8, 6.6, 'w:4.0,15.2,1.55'], [7.6, 8.4, 'btn:核准執行（派出 1 條指令）'], [9.2, 10.0, 'btn:確定核准，派出 1 條指令'], [11.4, 11.5, 'hide']] },
  bplus: { size: 'land', mode: 'full', sec: 11.4,
    cam: K([[0, S(3.6, 12.95, 1.9), S(.12, 12.8, 1.5), 46], [3.6, S(3.0, 12.85, 1.85), S(.12, 12.8, 1.5), 46], [5.4, S(3.9, 12.3, 2.0), S(4.0, 15.4, 1.5), 50],
      [7.2, S(4.7, 12.35, 1.9), S(7.88, 12.4, 1.45), 46], [11.4, S(5.15, 12.55, 1.75), S(7.8, 12.75, 1.4), 44]]),
    track: `(d, C) => ({ kanban: [.12, 1.55, -12.8], trial: [7.88, 1.62, -11.9], portrait: [7.5, 1.22, -13.65] })` },
  studio: { size: 'land', mode: 'full', sec: 10.4,
    setup: `() => { window.__st.cmd('瑞弘', 'studio', { place: true, freeze: true }); window.__st.cmd('雛田', 'studio', { place: true, freeze: true }); }`,
    cam: K([[0, S(31.35, 8.1, 1.42), S(31.45, 9.6, 1.36), 40], [1.8, S(31.35, 8.0, 1.5), S(31.45, 9.6, 1.36), 40], [5.6, S(31.9, 8.3, 4.1), S(32.0, 12.6, .8), 46], [10.4, S(33.1, 8.9, 3.9), S(32.4, 13.0, .85), 46]]),
    track: `(d, C) => ({ onair: [31.45, 1.3, -9.58], mic: [31.4, .95, -14.3], spot: [34.3, 1.25, -11.9] })` },
  aerial_end: { size: 'land', mode: 'full', sec: 8.4,
    cam: K([[0, S(5.5, 6.0, 5.5), S(4.5, 10.5, .6), 46], [8.4, S(21.25, -13, 40.5), S(21.25, 8.3, 0), 40]]) },

  // ───────────── 直式（Shorts）540×960 @2 = 1080×1920 ─────────────
  p_aerial: { size: 'port', mode: 'full', sec: 6.4,
    cam: K([[0, S(16.5, 8.3, 62), S(21.25, 8.3, 0), 40], [6.4, S(-5.5, 8.3, 9.5), S(9, 8.3, .2), 46]]),
    events: [{ t: .2, js: `() => window.__st.cmd('瑞弘', 'pantry')` }] },
  p_office: { size: 'port', mode: 'full', sec: 5.8,
    setup: `() => { window.__st.seat('雛田', false); }`,
    cam: K([[0, S(23.6, 3.3, 4.8), S(15.6, 3.2, .5), 50], [5.8, S(21.9, 3.1, 3.5), S(15.2, 3.15, .75), 50]]),
    events: [{ t: .2, js: `() => window.__st.cmd('小毅', 'stand')` }] },
  p_screen: { size: 'port', mode: 'full', sec: 5.8,
    setup: `() => { window.__st.seat('雛田', false); }`,
    cam: K([[0, S(15.7, .3, 2.6), S(15.0, 3.0, .95), 50], [5.8, S(15.08, 1.42, 1.98), S(14.9, 3.0, 1.14), 50]]) },
  p_circle: { size: 'port', mode: 'ui', sec: 6.2,
    cursor: [[.3, .3, [300, 640]], [.5, 1.3, 'el:#vBubbles'], [1.9, 2.0, 'hide']],
    events: [{ t: 1.5, click: true }] },
  p_meet: { size: 'port', mode: 'full', sec: 6.6, setup: meetSetup,
    cam: K([[0, S(11.0, 12.8, 6.4), S(3.6, 12.8, .6), 48], [6.6, S(9.6, 12.8, 5.3), S(3.9, 12.8, .8), 48]]),
    events: [say(.4, '瑞弘', '提案：A～D 四項', 1.2), say(1.7, '小弘', 'E、F 併入 B → B+', 1.2), say(3.0, '阿仁', 'H：GPU 運算站', 1.2), say(4.3, '雛田', '錄課棚加直式拍攝位', 1.2), say(5.5, '小毅', '結論交老闆裁示', 1.1)] },
  p_studio: { size: 'port', mode: 'full', sec: 4.0,
    setup: `() => { window.__st.cmd('瑞弘', 'studio', { place: true, freeze: true }); window.__st.cmd('雛田', 'studio', { place: true, freeze: true }); }`,
    cam: K([[0, S(31.4, 7.5, 1.5), S(31.45, 9.6, 1.4), 46], [1.0, S(31.4, 7.45, 1.55), S(31.45, 9.6, 1.4), 46], [4.0, S(31.9, 8.4, 4.8), S(32.2, 12.8, .7), 50]]) },
  p_booth: { size: 'port', mode: 'full', sec: 4.0,
    setup: `() => { window.__st.cmd('阿翰', 'call', { place: true, freeze: true }); }`,
    cam: K([[0, S(3.9, 5.6, 2.8), S(.85, 8.3, 1.3), 46], [4.0, S(4.1, 5.2, 3.1), S(.9, 8.3, 1.25), 46]]),
    events: [say(.2, '阿翰', '視訊通話中', 3.6)] }
};

// 靜態畫面：介面導覽用的整頁截圖＋各區塊位置（build 時用來放編號）
const STILLS = {
  ui_dash: { size: 'land', mode: 'ui', rects: { sync: '.sync-state', stats: '.stats .stat', views: '.views', meet: '#meetBtn', plan: '#planBtn', chips: '#chips', office: '#office', admin: '#adminBtn', legend: '#oLegend', full: '#oFull' } }
};

async function prepare(pg, shot) {
  if (shot.mode === 'full') await M.fullOffice(pg);
  if (shot.mode === 'focus') { await pg.click('#oFull'); await M.sleep(1500); }
  if (shot.setup) { await pg.evaluate(`(${shot.setup})()`); await M.sleep(1200); }
}

async function runOne(name, preview) {
  const shot = SHOTS[name] || STILLS[name]; if (!shot) throw new Error('沒有這個鏡頭：' + name);
  const b = await M.launch();
  try {
    const pg = await M.openBoard(b, { size: shot.size, feed: process.env.FEED, now: process.env.NOW, admin: shot.admin });
    await prepare(pg, shot);
    if (STILLS[name]) {
      const fs = require('fs'), dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
      await pg.screenshot({ path: path.join(dir, name + '.png') });
      const rects = await pg.evaluate(sel => Object.fromEntries(Object.entries(sel).map(([k, s]) => [k, [...document.querySelectorAll(s)].map(e => { const r = e.getBoundingClientRect();
        return [r.left, r.top, r.width, r.height].map(v => +(v * devicePixelRatio).toFixed(1)); })])), shot.rects);
      fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(rects));
      console.log('  ✓ 靜態', name);
      return;
    }
    const spec = { ...shot, dir: path.join(OUT, preview ? 'preview' : 'footage', name), frames: Math.round(shot.sec * 30) };
    const pv = preview ? [0, shot.sec * .25, shot.sec * .5, shot.sec * .75, shot.sec - .05] : null;
    await M.record(pg, spec, pv);
  } finally { await b.close(); }
}

async function main() {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  if (opt('--one')) return runOne(opt('--one'), args.includes('--preview-mode'));
  const pv = opt('--preview');
  const names = pv ? pv.split(',') : opt('--only') ? opt('--only').split(',') : [...Object.keys(SHOTS), ...Object.keys(STILLS)];
  const jobs = +(opt('--jobs') || 2), queue = [...names];
  // 長的先拍
  queue.sort((a, b) => ((SHOTS[b] || {}).sec || 0) - ((SHOTS[a] || {}).sec || 0));
  let bad = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (queue.length) {
      const n = queue.shift();
      console.log('▶', n);
      const code = await new Promise(res => { const p = spawn(process.execPath, [__filename, '--one', n, ...(pv ? ['--preview-mode'] : [])], { stdio: 'inherit', env: process.env }); p.on('exit', res); });
      if (code) { bad++; console.log('✗', n, '失敗'); }
    }
  }));
  if (bad) process.exit(1);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { SHOTS, STILLS };
