// Code.gs 的本機模擬測試：node apps-script/test_sim.js apps-script/Code.gs（模擬 DriveApp、CacheService 等，造 60 天約 3000 個檔案）
// Apps Script 模擬：DriveApp / CacheService / LockService / PropertiesService / Utilities / ContentService / ScriptApp
const fs = require('fs'), crypto = require('crypto');
let clock = Date.parse('2026-11-06T10:00:00Z'); const realNow = Date.now; Date.now = () => clock;
const tick = ms => { clock += ms; };
let blobReads = 0, idc = 0; const nid = () => 'id' + String(++idc).padStart(12, '0');
const byId = new Map();
class It { constructor(a) { this.a = a; this.i = 0; } hasNext() { return this.i < this.a.length; } next() { return this.a[this.i++]; } }
class MFile { constructor(name, content, parent, updated) { this.id = nid(); this.name = name; this.content = content; this.parents = [parent]; this.updated = updated || clock; this.trashed = false; byId.set(this.id, this); }
  getId() { return this.id; } getName() { return this.name; } getMimeType() { return 'application/json'; } getLastUpdated() { return new Date(this.updated); } isTrashed() { return this.trashed; }
  getBlob() { blobReads++; tick(BLOB_MS); const c = this.content; return { getDataAsString: () => c }; } setContent(t) { this.content = t; this.updated = clock; }
  setTrashed(v) { this.trashed = v; } getParents() { return new It(this.parents); }
  moveTo(f) { for (const p of this.parents) p.files = p.files.filter(x => x !== this); this.parents = [f]; f.files.push(this); } }
class MFolder { constructor(name) { this.id = nid(); this.name = name; this.files = []; this.folders = []; byId.set(this.id, this); }
  getId() { return this.id; } getName() { return this.name; }
  getFiles() { return new It(this.files.filter(f => !f.trashed)); }
  searchFiles(q) { const m = /modifiedDate > "([^"]+)"/.exec(q); const t = m ? Date.parse(m[1]) : 0; return new It(this.files.filter(f => !f.trashed && f.updated > t)); }
  getFoldersByName(n) { return new It(this.folders.filter(f => f.name === n)); } createFolder(n) { const f = new MFolder(n); this.folders.push(f); return f; }
  getFilesByName(n) { return new It(this.files.filter(f => f.name === n && !f.trashed)); }
  createFile(n, c) { const f = new MFile(n, c, this); this.files.push(f); return f; } }
let BLOB_MS = 0;
const root = new MFolder('我的雲端硬碟');
const FOL = { records: new MFolder('雲端紀錄'), meetings: new MFolder('會議室'), commands: new MFolder('指令') };
const cacheStore = new Map();
global.CacheService = { getScriptCache: () => ({ get: k => { const v = cacheStore.get(k); return v && v.exp > clock ? v.v : null; }, getAll: ks => { const o = {}; for (const k of ks) { const v = cacheStore.get(k); if (v && v.exp > clock) o[k] = v.v; } return o; },
  put: (k, v, t) => cacheStore.set(k, { v, exp: clock + (t || 600) * 1000 }), putAll: (o, t) => { for (const k in o) cacheStore.set(k, { v: o[k], exp: clock + (t || 600) * 1000 }); }, removeAll: ks => ks.forEach(k => cacheStore.delete(k)) }) };
global.LockService = { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) };
const props = { ADMIN_KEY: 'adm', READ_KEY: 'rk' };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) };
global.Utilities = { sleep: () => {}, DigestAlgorithm: {}, Charset: {}, computeDigest: (a, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => b > 127 ? b - 256 : b),
  formatDate: (d, tz, f) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(d).map(x => [x.type, x.value]));
    return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour === '24' ? '00' : p.hour).replace('mm', p.minute).replace('ss', p.second); } };
global.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: t => ({ text: t, setMimeType() { return this; } }) };
const triggers = []; global.ScriptApp = { getProjectTriggers: () => triggers, deleteTrigger: t => triggers.splice(triggers.indexOf(t), 1), newTrigger: h => { const b = { timeBased: () => b, everyMinutes: () => b, atHour: () => b, everyDays: () => b, inTimezone: () => b, create: () => triggers.push({ getHandlerFunction: () => h }) }; return b; } };
global.Logger = { log: m => console.log('  [log]', m) };
global.DriveApp = { getFolderById: id => { const f = byId.get(id); if (!(f instanceof MFolder)) throw new Error('no folder'); return f; }, getFileById: id => { const f = byId.get(id); if (!(f instanceof MFile)) throw new Error('no file'); return f; }, createFile: (n, c) => root.createFile(n, c) };
let src = fs.readFileSync(process.argv[2], 'utf8');
src = src.replace(/records:\s*'[^']+'/, `records: '${FOL.records.id}'`).replace(/meetings:\s*'[^']+'/, `meetings: '${FOL.meetings.id}'`).replace(/commands:\s*'[^']+'/, `commands: '${FOL.commands.id}'`);
const G = new Function(src + '\nreturn { doGet, doPost, maintain, archiveOld, setup, feedText_, loadIndex_ };')();
const day = 86400000, ts = d => Utilities.formatDate(new Date(d), 'Asia/Taipei', 'yyyyMMddHHmmss');
// 造資料：過去 60 天，每天 40 筆紀錄、一場會議（議程＋3 發言＋結論）、2 條指令（指令＋回報）
for (let k = 60; k >= 0; k--) { const t0 = clock - k * day;
  for (let i = 0; i < 40; i++) { const t = t0 + i * 60000; FOL.records.createFile(`雲端紀錄_${ts(t)}_a${i}.json`, JSON.stringify({ topic: '工作' + i, content: 'x', last_time: ts(t), account: 'moredof@gmail.com', team: 'DofLab' })).updated = t; }
  const mid = 'M' + ts(t0).slice(0, 12) + 'ab' + String(k).padStart(2, '0');
  for (const [suffix, o] of [['agenda', { type: 'agenda', meeting_id: mid, title: '會議' + k, host: { account: 'moredof@gmail.com', team: 'DofLab' }, attendees: [] }], ['msg_1', { type: 'message', meeting_id: mid }], ['msg_2', { type: 'message', meeting_id: mid }], ['minutes', { type: 'minutes', meeting_id: mid, summary: 's' }]])
    FOL.meetings.createFile(`會議_${mid}_${suffix}.json`, JSON.stringify(o)).updated = t0 + 3600000;
  for (let c = 0; c < 2; c++) { const cid = 'C' + ts(t0) + 'cd' + c + (k % 10); FOL.commands.createFile(`指令_${cid}.json`, JSON.stringify({ type: 'command', command_id: cid, to: { account: 'moredof@gmail.com', team: 'DEV' }, title: 't' })).updated = t0;
    FOL.commands.createFile(`指令_${cid}_ack_${ts(t0)}_x.json`, JSON.stringify({ type: 'ack', command_id: cid, status: 'done' })).updated = t0 + 7200000; }
}
// 一個 50 天前開始、昨天還有新回報的指令：封存時整組要留著
const longC = 'C' + ts(clock - 50 * day) + 'long'; FOL.commands.createFile(`指令_${longC}.json`, JSON.stringify({ type: 'command', command_id: longC })).updated = clock - 50 * day;
FOL.commands.createFile(`指令_${longC}_ack_${ts(clock - day)}_y.json`, JSON.stringify({ type: 'ack', command_id: longC, status: 'in_progress' })).updated = clock - day;
const total = () => FOL.records.files.length + FOL.meetings.files.length + FOL.commands.files.length;
const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; };
console.log('檔案總數', total());
// 1. 第一次讀（沒有索引）：公開精簡版
BLOB_MS = 50; blobReads = 0; let t0 = clock;
let pub = JSON.parse(G.doGet().text);
const want = d => [...Object.values(FOL)].flatMap(f => f.files).filter(f => f.updated >= clock - 30 * day).length;
ok(pub.public === true, '沒密碼時 GET 回公開精簡版');
ok(pub.records.length + pub.meetings.length + pub.commands.length > 0, `第一次讀到 ${pub.records.length + pub.meetings.length + pub.commands.length} 個檔案（讀檔 ${blobReads} 次，模擬耗時 ${(clock - t0) / 1000}s）`);
let idx = G.loadIndex_(CacheService.getScriptCache());
console.log('  索引 partial =', idx.partial, '筆數', Object.keys(idx.files).length);
// 2. 建完索引（setup → maintain，必要時多跑幾次）
G.setup(); for (let i = 0; i < 5 && G.loadIndex_(CacheService.getScriptCache()).partial; i++) { tick(600000); G.maintain(); }
idx = G.loadIndex_(CacheService.getScriptCache());
ok(!idx.partial && Object.keys(idx.files).length === want(), `索引建完：${Object.keys(idx.files).length} 個（應為最近 30 天的 ${want()} 個）`);
ok(triggers.length === 2, '安裝了 maintain 與 archiveOld 兩個觸發器');
// 3. 之後的讀取：只讀新檔
tick(120000); blobReads = 0; t0 = clock;
FOL.records.createFile(`雲端紀錄_${ts(clock)}_new1.json`, JSON.stringify({ topic: '新紀錄', last_time: ts(clock), account: 'a@b.c', team: 'DofLab' }));
tick(1000);
let full = JSON.parse(G.doPost({ postData: { contents: JSON.stringify({ action: 'read', key: 'rk' }) } }).text);
ok(full.records.some(r => r.data && r.data.topic === '新紀錄'), `讀取密碼拿到完整版，新紀錄出現；這次只讀檔 ${blobReads} 次、模擬耗時 ${(clock - t0) / 1000}s`);
ok(!full.records.some(r => Date.parse(r.modified) < clock - 31 * day), '只回最近 30 天');
// 4. 快取期間不重讀
blobReads = 0; G.doGet(); ok(blobReads === 0, '60 秒內再讀：直接用快取，不讀檔');
// 5. 寫入：下指令，馬上出現在下一次讀取
const w = JSON.parse(G.doPost({ postData: { contents: JSON.stringify({ action: 'createCommand', key: 'adm', to: { account: 'moredof@gmail.com', team: 'DEV' }, title: '測試', instruction: '加果汁機' }) } }).text);
ok(w.ok, '管理密碼下指令成功' + (w.ok ? '' : '：' + JSON.stringify(w)));
full = JSON.parse(G.doPost({ postData: { contents: JSON.stringify({ action: 'read', key: 'adm' }) } }).text);
ok(full.commands.some(c => c.data && c.data.title === '測試'), '新指令立刻出現在讀取結果');
// 6. 移到垃圾桶：從索引消失
const victim = full.records.find(r => r.data && r.data.topic === '新紀錄');
const tr = JSON.parse(G.doPost({ postData: { contents: JSON.stringify({ action: 'trash', key: 'adm', ids: [victim.id] }) } }).text);
full = JSON.parse(G.doPost({ postData: { contents: JSON.stringify({ action: 'read', key: 'rk' }) } }).text);
ok(tr.ok && !full.records.some(r => r.id === victim.id), '移到垃圾桶後立刻從讀取結果消失');
// 7. 別人直接在 Drive 刪掉／搬走的檔案：每小時完整比對時清掉
const gone = FOL.records.files.find(f => f.updated > clock - 2 * day); FOL.records.files = FOL.records.files.filter(f => f !== gone);
tick(3700000); G.maintain(); idx = G.loadIndex_(CacheService.getScriptCache());
ok(!idx.files[gone.id], '在 Drive 外部刪掉的檔案，完整比對後從索引移除');
// 8. 封存
const before = total(); G.archiveOld();
const arch = FOL.records.folders.find(f => f.name === '封存');
const archived = arch ? arch.folders.reduce((s, m) => s + m.folders.reduce((s2, d) => s2 + d.files.length, 0), 0) : 0;
ok(archived > 0 && total() + archived === before, `封存搬走 ${archived} 個檔案（沒有刪除）`);
ok(FOL.commands.files.some(f => f.name.includes(longC)) && FOL.commands.files.filter(f => f.name.includes(longC)).length === 2, '還有新回報的老指令整組留在原處');
ok(![...Object.values(FOL)].flatMap(f => f.files).some(f => f.updated < clock - 46 * day && !f.name.includes(longC)), '超過 45 天、整組結束的都搬走了');
ok(arch && arch.folders.every(m => /^\d{4}-\d{2}$/.test(m.name)), '封存依年-月分資料夾：' + (arch ? arch.folders.map(m => m.name + '(' + m.folders.map(d => d.name).join('/') + ')').join(' ') : ''));
// 9. 封存後讀取照常
tick(3700000); G.maintain(); blobReads = 0; pub = JSON.parse(G.doGet().text);
ok(pub.records.length > 0 && blobReads === 0, '封存後讀取照常，沒有重讀舊檔');
