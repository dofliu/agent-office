// 拍導覽影片用的真實畫面（上線資料）：3D 樓層、各房間、設備特寫、互動選單 → raw/*.png
// 先在 repo 根目錄開 python3 -m http.server 8765；改造前的畫面用舊版本開在 8766（不需要就設 SKIP_OLD=1）。
const { chromium } = require('playwright');
const OUT = __dirname + '/raw/';
require('fs').mkdirSync(OUT, { recursive: true });
const K = {
  sakura: 'moredof@gmail.com|doflab', sasuke: 'dofliu@gm.ncut.edu.tw|doflab', shika: 'dof.liu@gmail.com|doflab',
  itachi: 'dofliu@ncut.edu.tw|doflab', minato: 'ncutiae.liu@gmail.com|doflab', hinata: 'moredof@gmail.com|dofgm',
  kakashi: 'dofliu@gm.ncut.edu.tw|dofgm', tsunade: 'dof.liu@gmail.com|dofgm', gaara: 'dofliu@ncut.edu.tw|dofgm',
  oro: 'ncutiae.liu@gmail.com|dofgm', naruto: 'moredof@gmail.com|pro', jiraiya: 'dofliu@gm.ncut.edu.tw|ncut_pj'
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function open(b, url) {
  const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  pg.on('pageerror', e => console.log('pageerror', e.message));
  await pg.route(/js\/office\.js/, async r => { const res = await r.fetch(); r.fulfill({ response: res,
    body: (await res.text()) + '\nwindow.__dbg = { agents, get floor() { return floor; }, camera, box, controls, placeAt, deskOf };' }); });
  await pg.goto(url);
  await pg.waitForFunction(() => !/載入/.test(document.getElementById('oInfo').textContent), null, { timeout: 90000 });
  await pg.waitForFunction(() => window.__dbg && window.__dbg.agents.size > 0, null, { timeout: 90000 });
  await sleep(3000);
  return pg;
}
const shot = (pg, name, opts = {}) => pg.screenshot({ path: OUT + name + '.png', ...opts }).then(() => console.log('shot', name));
async function cam(pg, fn, arg) { await pg.evaluate(([f, a]) => { const d = window.__dbg, c = d.camera, ct = d.controls; const r = (new Function('d', 'a', f))(d, a);
  ct.target.set(r.t[0], r.t[1], r.t[2]); c.position.set(r.p[0], r.p[1], r.p[2]); ct.update(); }, [fn, arg]); await sleep(1500); }
async function fullOffice(pg) {   // make the 3D view fill the whole 1920x1080 viewport
  await pg.addStyleTag({ content: '#office{position:fixed!important;left:0!important;top:0!important;width:100vw!important;height:100vh!important;border:0!important;border-radius:0!important;z-index:5;margin:0!important}' });
  await sleep(2500);
}
async function overlays(pg, show) { await pg.evaluate(s => { for (const id of ['oInfo', 'oLegend', 'oFull']) document.getElementById(id).style.visibility = s ? '' : 'hidden'; }, show); }

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  // ---------- BEFORE (pre-upgrade commit) ----------
  if (!process.env.SKIP_OLD) {
    const old = await open(b, 'http://localhost:8766/index.html');
    await old.click('#oFull'); await sleep(1000); await fullOffice(old);
    await overlays(old, false); await shot(old, 'old_floor');
    await old.close();
  }
  // ---------- AFTER (current) ----------
  const pg = await open(b, 'http://localhost:8765/index.html');
  console.log('agents', await pg.evaluate(() => [...window.__dbg.agents.values()].map(a => a.group.nick + ':' + a.mode).join(' ')));
  await shot(pg, 'dash_full');
  // stage people with the built-in interaction commands, then teleport and freeze them
  const plan = [[K.sakura, 'studio'], [K.naruto, 'call'], [K.gaara, 'call'], [K.kakashi, 'stand'], [K.hinata, 'stand'],
    [K.sasuke, 'meet'], [K.shika, 'meet'], [K.minato, 'meet'], [K.oro, 'pantry'], [K.tsunade, 'board'], [K.jiraiya, 'desk'], [K.itachi, 'desk']];
  for (const [k, a] of plan) await pg.evaluate(([k, a]) => window.cloudlogOffice.command(k, a), [k, a]);
  await pg.evaluate(() => { for (const ag of window.__dbg.agents.values()) if (ag.ov) { const s = ag.ov.steps[ag.ov.i]; if (s.to) window.__dbg.placeAt(ag, s.to); } });
  await sleep(1500);
  await pg.evaluate(() => { for (const ag of window.__dbg.agents.values()) if (ag.ov) ag.wait = Infinity; });
  await sleep(9000);   // desks rise, glow/ON AIR update
  await pg.click('#oFull'); await sleep(1000); await fullOffice(pg);
  await shot(pg, 'floor_ui');
  await overlays(pg, false); await shot(pg, 'floor');
  const room = `const r = a === 'meet' ? d.floor.meeting : a === 'pantry' ? d.floor.pantry : a === 'studio' ? d.floor.studio : d.floor.byTeam.get(a);
    const cx = r.x0 + r.w / 2, cz = -(r.y0 + r.d / 2), north = r.y0 > 3;
    return { t: [cx, .6, cz], p: [cx, Math.max(6.2, r.w * .62), cz + (north ? 1 : 1) * Math.max(5.8, r.w * .58)] };`;
  for (const t of ['doflab', 'dofgm', 'ncut_pj', '__shared', 'meet', 'pantry', 'studio']) { await cam(pg, room, t); await shot(pg, 'room_' + t.replace(/_/g, '')); }
  // booths, close-ups
  await cam(pg, `const s = d.floor.booths[0].seat.position; return { t: [s[0] + .2, 1, -s[1]], p: [s[0] + 4.2, 3.4, -s[1] + 3.6] };`); await shot(pg, 'booth_w');
  await cam(pg, `const s = d.floor.booths[1].seat.position; return { t: [s[0] - .2, 1, -s[1]], p: [s[0] - 4.2, 3.4, -s[1] + 3.6] };`); await shot(pg, 'booth_e');
  await cam(pg, `const r = d.floor.meeting; return { t: [r.x0 + .12, 1.5, -(r.y0 + 3.2)], p: [r.x0 + 3.6, 2.3, -(r.y0 + 3.2) + 1.2] };`); await shot(pg, 'kanban');
  await cam(pg, `const r = d.floor.meeting; return { t: [r.x0 + 7.6, 1.4, -(r.y0 + 3.1)], p: [r.x0 + 4.4, 2.6, -(r.y0 + 1.2)] };`); await shot(pg, 'trial');
  await cam(pg, `const r = d.floor.meeting; return { t: [r.x0 + 4, 1.4, -(r.y0 + 5.0)], p: [r.x0 + 4, 3.6, -(r.y0 + 1.0)] };`); await shot(pg, 'projector');
  await cam(pg, `const r = d.floor.byTeam.get('dofgm'); return { t: [r.x0 + r.w / 2 + 1.5, .9, -(r.y0 + r.d / 2)], p: [r.x0 + r.w / 2 + 4.5, 3.0, -(r.y0 + r.d / 2) - 4.4] };`); await shot(pg, 'desks_stand');
  await cam(pg, `const r = d.floor.studio; return { t: [r.x0 + 3, .9, -(r.y0 + 3.4)], p: [r.x0 + 3.2, 4.4, -(r.y0) + 2.2] };`); await shot(pg, 'studio_close');
  await cam(pg, `const r = d.floor.studio, dx = r.x0 + 1.4; return { t: [dx + 1.05, 1.1, -r.y0], p: [dx + 2.6, 2.2, -r.y0 + 4.2] };`); await shot(pg, 'onair');
  // interaction menus on the overview
  await pg.evaluate(() => window.__dbg.controls.reset && 0); await overlays(pg, true);
  await cam(pg, room, 'dofgm');
  const pos = await pg.evaluate(k => { const d = window.__dbg, ag = d.agents.get(k), v = ag.p.g.position.clone(); v.y = 1.0; v.project(d.camera);
    const r = d.box.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, K.tsunade);
  await pg.mouse.click(pos[0], pos[1]); await sleep(800); await shot(pg, 'menu_person');
  await pg.keyboard.press('Escape'); await sleep(300);
  await cam(pg, room, 'pantry');
  const dpos = await pg.evaluate(() => { const d = window.__dbg, dev = [...d.floor.devices.values()].find(x => x.use === 'coffee'), v = dev.pos.clone(); v.y = .8; v.project(d.camera);
    const r = d.box.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; });
  await pg.mouse.click(dpos[0], dpos[1]); await sleep(800); await shot(pg, 'menu_device');
  await pg.keyboard.press('Escape'); await sleep(300);
  // 側欄（會議紀錄、規劃頁）改由 capture_drawers.js 拍，那邊會遮住 email 與分享網址
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
