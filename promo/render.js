// 逐格渲染場景 HTML → 每景一支 MP4（虛擬時鐘，畫面平順、可重現）。
//   node render.js intro/storyboard.json [--only i04_fly,i06_screen] [--jobs 4]
// 輸出 work/<片名>/<景>.mp4 與 check_<景>.png（85% 時間點的抽查格，出片前逐張看）。
// 虛擬時鐘的做法來自 intro-video 技能的 render_scenes.py；多了運鏡畫面：每格先等 window.__frameReady() 把那一格的圖畫好。
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');

const VCLOCK = `(() => {
  if (window.__vClockInstalled) return; window.__vClockInstalled = true;
  let now = 0; const RealDate = Date;
  try { window.performance.now = () => now; } catch (e) {}
  function VDate(...a) { return a.length ? new RealDate(...a) : new RealDate(Date.UTC(2026, 10, 3, 4, 12) + now); }
  VDate.now = () => Date.UTC(2026, 10, 3, 4, 12) + now; VDate.parse = RealDate.parse; VDate.UTC = RealDate.UTC; VDate.prototype = RealDate.prototype; window.Date = VDate;
  let rafs = [], seq = 0, timers = [];
  window.requestAnimationFrame = cb => { const id = ++seq; rafs.push([id, cb]); return id; };
  window.cancelAnimationFrame = id => { rafs = rafs.filter(([i]) => i !== id); };
  window.setTimeout = (fn, d, ...a) => { const id = ++seq; timers.push({ id, fn, due: now + (+d || 0), a, every: null }); return id; };
  window.setInterval = (fn, d, ...a) => { const id = ++seq, e = Math.max(1, +d || 0); timers.push({ id, fn, due: now + e, a, every: e }); return id; };
  window.clearTimeout = window.clearInterval = id => { timers = timers.filter(t => t.id !== id); };
  window.__advanceFrame = ms => {
    now += ms;
    for (let g = 0; g < 10000; g++) { const due = timers.filter(t => t.due <= now).sort((a, b) => a.due - b.due); if (!due.length) break;
      const t = due[0]; if (t.every == null) timers = timers.filter(x => x !== t); else t.due += t.every; try { t.fn(...t.a); } catch (e) {} }
    const batch = rafs; rafs = []; for (const [, cb] of batch) { try { cb(now); } catch (e) {} }
    for (const an of document.getAnimations()) { try { an.pause(); an.currentTime = now; } catch (e) {} }
    return now;
  };
})();`;

async function renderScene(htmlPath, outMp4, { dur, fps, W, H }) {
  const N = Math.max(1, Math.round(dur * fps));
  const b = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu'] });
  try {
    const pg = await b.newPage({ viewport: { width: W, height: H } });
    pg.on('pageerror', e => console.log('  [pageerror]', path.basename(htmlPath), e.message));
    await pg.addInitScript(VCLOCK);
    await pg.goto('file://' + path.resolve(htmlPath), { waitUntil: 'load' });
    await pg.evaluate(() => document.fonts.ready.then(() => 0));
    await pg.waitForTimeout(400);
    fs.mkdirSync(path.dirname(outMp4), { recursive: true });
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(fps), outMp4], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => ff.on('exit', c => c ? rej(new Error('ffmpeg ' + c)) : res()));
    for (let i = 0; i < N; i++) {
      await pg.evaluate(() => (window.__frameReady ? window.__frameReady() : 0));
      const buf = await pg.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      await pg.evaluate(d => window.__advanceFrame(d), 1000 / fps);
    }
    ff.stdin.end(); await done;
  } finally { await b.close(); }
  const check = path.join(path.dirname(outMp4), 'check_' + path.basename(outMp4, '.mp4') + '.png');
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', (dur * .85).toFixed(2), '-i', outMp4, '-frames:v', '1', check]);
}

async function main() {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const sbPath = args[0], sb = JSON.parse(fs.readFileSync(sbPath, 'utf8')), base = path.dirname(sbPath);
  const work = path.join(__dirname, 'work', path.basename(path.resolve(base)));
  const only = opt('--only') ? new Set(opt('--only').split(',')) : null, jobs = +(opt('--jobs') || 4);
  const todo = sb.scenes.filter(s => !only || only.has(path.basename(s.file, '.html'))).sort((a, b) => b.duration - a.duration);
  console.log(`[render] ${todo.length} 景，${jobs} 個同時 → ${work}`);
  let bad = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, todo.length) }, async () => {
    while (todo.length) {
      const s = todo.shift(), stem = path.basename(s.file, '.html'), t0 = Date.now();
      try { await renderScene(path.join(base, s.file), path.join(work, stem + '.mp4'), { dur: s.duration, fps: sb.fps || 30, W: sb.width, H: sb.height });
        console.log(`[render] ✓ ${stem}  ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
      catch (e) { bad++; console.log(`[render] ✗ ${stem}: ${e.message}`); }
    }
  }));
  console.log('[render] 完成' + (bad ? `（${bad} 景失敗）` : '') + '，記得逐張看 check_*.png');
  if (bad) process.exit(1);
}
main().catch(e => { console.error(e); process.exit(1); });
