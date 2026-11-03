// 拍側欄的長圖（2 倍解析度）：raw/x2_meeting_parts/（會議紀錄，分段捲動拍）與 raw/x2_plan.png（規劃頁，一次拍完）。
// 拍完執行 python3 stitch.py 接成 raw/x2_meeting_safe.png，再跑 build.py。
// 隱私：側欄標題的 email 一律模糊；發言內文裡的 email 與網址（含分享金鑰 sk= 的舊 Artifact 網址）也逐字模糊。
// 重拍時不要拿掉。只拍會議紀錄：ONLY=meeting；只拍規劃頁：ONLY=plan。
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/raw/';
const BASE = process.env.BASE || 'http://localhost:8765/index.html';
const MEETING = process.env.MEETING || 'M202611030011skun';   // 辦公空間會議
const ONLY = process.env.ONLY || '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HIDE_CSS = '.d-title .email{filter:blur(8px)} .drawer,.scrim{animation:none!important;transition:none!important}' +
  ' .pv-blur{color:transparent!important;text-shadow:0 0 9px rgba(40,50,60,.75)!important}' +
  ' .pv-mask{color:transparent!important;text-shadow:none!important;background:rgba(96,108,122,.3);border-radius:6px;-webkit-box-decoration-break:clone;box-decoration-break:clone}';
// 在頁面裡安裝 window.__pvBlur()：側欄文字裡的 email 包成 .pv-blur（模糊），網址包成 .pv-mask（不透明色塊，
// 分享金鑰連模糊的字形都不留）；只動那幾個字，版面不變。回傳目前有幾處被遮住。看板重繪側欄時會把 span 洗掉，所以用 MutationObserver 每次重繪後再套一次。
function installBlur() {
  const pat = 'https?://[!-~]+|[!-~]*sk=[!-~]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*';
  const apply = () => {
    const root = document.querySelector('.drawer'); if (!root) return;
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
  };
  const obs = new MutationObserver(() => { obs.disconnect(); apply(); obs.observe(document.body, { childList: true, subtree: true, characterData: true }); });
  apply(); obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  window.__pvBlur = () => { apply(); return document.querySelectorAll('.drawer .pv-blur, .drawer .pv-mask').length; };
}

async function page(b, height) {
  const pg = await b.newPage({ viewport: { width: 1920, height }, deviceScaleFactor: 2 });
  pg.on('pageerror', e => console.log('pageerror', e.message));
  await pg.addInitScript(() => {
    try { localStorage.setItem('cloudlog.focus', '0'); } catch (e) {}
    // 看板每 30 秒整頁重繪一次（更新「N 分鐘前」），會洗掉模糊並把側欄捲回頂端；拍照時停掉這一個
    const si = window.setInterval; window.setInterval = (fn, ms, ...a) => (ms === 30e3 ? 0 : si(fn, ms, ...a));
  });
  await pg.goto(BASE);
  await pg.waitForFunction(() => window.cloudlogBridge && /上次/.test(document.getElementById('syncText').textContent), null, { timeout: 90000 });
  await sleep(2500);
  await pg.addStyleTag({ content: HIDE_CSS });
  await pg.evaluate(installBlur);
  return pg;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  // 會議紀錄很長：拍標題列＋逐段捲動拍內文，stitch.py 再接起來
  if (ONLY !== 'plan') {
  const pg = await page(b, 1080);
  await pg.evaluate(id => window.cloudlogBridge.meetings(id), MEETING); await sleep(1200);
  console.log('blurred', await pg.evaluate(() => window.__pvBlur()));
  const info = await pg.evaluate(() => { const h = document.querySelector('.d-head').getBoundingClientRect(), b = document.querySelector('.d-body'), r = b.getBoundingClientRect();
    return { head: [h.x, h.y, h.width, h.height], body: [r.x, r.y, r.width, r.height], total: b.scrollHeight, view: b.clientHeight }; });
  const dir = OUT + 'x2_meeting_parts/'; fs.mkdirSync(dir, { recursive: true });
  await pg.screenshot({ path: dir + 'head.png', clip: { x: info.head[0], y: info.head[1], width: info.head[2], height: info.head[3] } });
  const parts = [];
  for (let top = 0, i = 0; i < 40; i++, top += info.view - 40) {
    const actual = await pg.evaluate(t => { const b = document.querySelector('.d-body'); b.scrollTop = t; return b.scrollTop; }, top);
    await sleep(250);
    const f = `part_${String(i).padStart(2, '0')}.png`;
    await pg.screenshot({ path: dir + f, clip: { x: info.body[0], y: info.body[1], width: info.body[2], height: info.body[3] } });
    parts.push({ f, top: actual });
    if (actual + info.view >= info.total - 1) break;
  }
  fs.writeFileSync(dir + 'parts.json', JSON.stringify({ ...info, parts }));
  console.log('x2_meeting parts', parts.length, 'height', info.total);
  await pg.close();
  }
  if (ONLY === 'meeting') { await b.close(); return; }

  // 規劃頁：側欄重新繪製時會跳回頂端，所以改用很高的視窗一次拍完
  const tall = await page(b, 2400);
  await tall.evaluate(() => window.cloudlogBridge.plan()); await sleep(1200);
  console.log('blurred', await tall.evaluate(() => window.__pvBlur()));
  const r = await tall.evaluate(() => { const d = document.querySelector('.drawer').getBoundingClientRect(), b = document.querySelector('.d-body');
    return { x: d.x, y: d.y, w: d.width, h: Math.min(d.height, b.getBoundingClientRect().y + b.scrollHeight + 20) }; });
  await tall.screenshot({ path: OUT + 'x2_plan.png', clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
  console.log('x2_plan', r);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
