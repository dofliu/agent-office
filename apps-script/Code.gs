/**
 * 雲端紀錄看板的資料來源（Google Apps Script 網頁應用程式）。
 *
 * GET  ：以部署者本人的身分讀取三個 Drive 資料夾中的 JSON 檔，合併成一份 JSON 給看板（公開唯讀）。
 * POST ：管理模式的寫入（發起會議、老師發言、下指令、核准指令、改 TEAM、移到垃圾桶），需要管理密碼。
 *        密碼放在「專案設定 → 指令碼屬性」的 ADMIN_KEY；沒設定時一律拒絕寫入。
 *
 * 部署：script.google.com 新專案貼上本檔 → 部署 → 新增部署作業 → 「網頁應用程式」
 *       → 執行身分「我」、存取權「所有人」。修改後用「管理部署作業 → 編輯 → 新版本」，網址不變。
 */
const FOLDERS = {
  records:  '1tQdylp4A4dEwwrIg02F_rXz_YQMlh0P9', // 雲端紀錄
  meetings: '1pnAenSepEr8SwEWr_nM6rozP-f73MJcp', // 雲端紀錄/會議室
  commands: '1kkskSf6TDcHaAxDwv9M_ZDxgsBmYGMGm'  // 雲端紀錄/指令
};
const MAX_DAYS = 120;      // 只回傳最近 N 天內更新過的檔案
const FEED_TTL = 60;       // 整份回應快取秒數
const FILE_TTL = 21600;    // 單檔內容快取秒數（6 小時，檔案更新時 key 會變）

function doGet() {
  const cache = CacheService.getScriptCache();
  let body = getChunked_(cache, 'feed');
  if (!body) {
    const since = Date.now() - MAX_DAYS * 86400000;
    const feed = { generated: new Date().toISOString() };
    for (const name in FOLDERS) feed[name] = readFolder_(FOLDERS[name], since, cache);
    body = JSON.stringify(feed);
    putChunked_(cache, 'feed', body, FEED_TTL);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function readFolder_(folderId, since, cache) {
  const files = [], it = DriveApp.getFolderById(folderId).getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (!/\.json$/i.test(f.getName()) && f.getMimeType() !== 'application/json') continue;
    const updated = f.getLastUpdated().getTime();
    if (updated < since) continue;
    files.push({ f: f, key: 'f:' + f.getId() + ':' + updated });
  }
  const hits = files.length ? cache.getAll(files.map(x => x.key)) : {};
  const fresh = {}, out = [];
  for (const x of files) {
    let data = null, raw = hits[x.key];
    if (raw) { try { data = JSON.parse(raw); } catch (e) { data = null; } }
    if (!data) {
      try {
        raw = x.f.getBlob().getDataAsString('UTF-8').replace(/^﻿/, '');
        data = JSON.parse(raw);
        if (raw.length < 90000) fresh[x.key] = JSON.stringify(data);
      } catch (e) { data = null; }
    }
    out.push({ id: x.f.getId(), title: x.f.getName(), modified: x.f.getLastUpdated().toISOString(), data: data });
  }
  if (Object.keys(fresh).length) cache.putAll(fresh, FILE_TTL);
  return out;
}

// CacheService 單一值上限 100 KB，整份回應拆段存放。
function putChunked_(cache, key, text, ttl) {
  const size = 90000, parts = {}, n = Math.ceil(text.length / size);
  for (let i = 0; i < n; i++) parts[key + ':' + i] = text.slice(i * size, (i + 1) * size);
  parts[key + ':n'] = String(n);
  cache.putAll(parts, ttl);
}
function getChunked_(cache, key) {
  const n = Number(cache.get(key + ':n') || 0); if (!n) return null;
  const keys = []; for (let i = 0; i < n; i++) keys.push(key + ':' + i);
  const got = cache.getAll(keys); let text = '';
  for (const k of keys) { if (got[k] == null) return null; text += got[k]; }
  return text;
}

// ---------------------------------------------------------------- 寫入（管理模式）
const TZ = 'Asia/Taipei';
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'bad_request' }); }
  const key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!key) return out_({ ok: false, error: 'admin_disabled' });
  if (!req || req.key !== key) { Utilities.sleep(1000); return out_({ ok: false, error: 'wrong_key' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const fn = ACTIONS[req.action];
    if (!fn) return out_({ ok: false, error: 'bad_request', message: 'unknown action' });
    const res = fn(req);
    clearFeed_();
    return out_(Object.assign({ ok: true }, res));
  } catch (err) {
    return out_({ ok: false, error: err.code || 'error', message: String(err.message || err) });
  } finally { lock.releaseLock(); }
}

const ACTIONS = {
  ping: () => ({}),

  createMeeting: req => {
    const t = now14_(), id = 'M' + t.slice(0, 12) + rand4_();
    const hours = Math.min(168, Math.max(1, Number(req.hours) || 24));
    const attendees = arr_(req.attendees, 30).map(party_).filter(Boolean);
    if (!str_(req.title, 60) || !attendees.length) throw bad_('需要主題與至少一位與會者');
    const obj = {
      type: 'agenda', meeting_id: id, title: str_(req.title, 60), goal: str_(req.goal, 500),
      agenda: arr_(req.agenda, 12).map(x => str_(x, 120)).filter(Boolean),
      host: party_(req.host) || attendees[0], attendees: attendees,
      created_by: '劉老師（看板）', created: t, deadline: fmt14_(new Date(Date.now() + hours * 3600000))
    };
    return { file: create_(FOLDERS.meetings, '會議_' + id + '_agenda.json', obj) };
  },

  postMessage: req => {
    const mid = str_(req.meeting_id, 40);
    if (!/^M\w+$/.test(mid) || !str_(req.content, 1000)) throw bad_('需要會議與發言內容');
    const t = now14_(), msgId = t + '_' + rand4_();
    const kind = ['opinion', 'question', 'instruction', 'answer', 'info'].indexOf(req.kind) >= 0 ? req.kind : 'opinion';
    const obj = {
      type: 'message', meeting_id: mid, msg_id: msgId, from: { account: 'teacher', team: 'HUMAN', name: '劉老師' }, time: t,
      reply_to: str_(req.reply_to, 40) || null, mentions: arr_(req.mentions, 30).map(party_).filter(Boolean), kind: kind, content: str_(req.content, 1000)
    };
    return { file: create_(FOLDERS.meetings, '會議_' + mid + '_msg_' + msgId + '.json', obj) };
  },

  createCommand: req => {
    const to = party_(req.to);
    if (!to || !str_(req.instruction, 2000)) throw bad_('需要對象與指令內容');
    const t = now14_(), id = 'C' + t + rand4_();
    const obj = {
      type: 'command', command_id: id, to: to, from: '劉老師（看板）', created: t,
      title: str_(req.title, 40) || str_(req.instruction, 20), instruction: str_(req.instruction, 2000),
      priority: req.priority === 'high' ? 'high' : 'normal', source_meeting: null,
      needs_approval: req.needs_approval === true, approval_reason: str_(req.approval_reason, 200)
    };
    return { file: create_(FOLDERS.commands, '指令_' + id + '.json', obj) };
  },

  // 老師核准／駁回一條需要核准的指令（對外寄信、公開發布、花錢、以老師名義對外承諾）
  approveCommand: req => {
    const cid = str_(req.command_id, 40);
    if (!/^C\d{14}[0-9a-z]{4}$/i.test(cid)) throw bad_('指令編號格式不對');
    const decision = req.decision === 'rejected' ? 'rejected' : req.decision === 'approved' ? 'approved' : '';
    if (!decision) throw bad_('decision 需為 approved 或 rejected');
    const t = now14_();
    const obj = { type: 'approval', command_id: cid, by: { account: 'teacher', team: 'HUMAN', name: '劉老師' }, time: t, decision: decision, note: str_(req.note, 300) };
    return { file: create_(FOLDERS.commands, '指令_' + cid + '_approval_' + t + '_' + rand4_() + '.json', obj) };
  },

  // 移到垃圾桶（30 天內可在 Drive 還原）；只接受三個資料夾裡的檔案
  trash: req => {
    const trashed = [];
    for (const id of arr_(req.ids, 200)) {
      const f = ownFile_(id); if (!f) continue;
      f.setTrashed(true); trashed.push(f.getId());
    }
    return { trashed: trashed };
  },

  // 改 TEAM：用新 TEAM 另存一份（同檔名），再把原檔移到垃圾桶
  retag: req => {
    const team = str_(req.team, 40); if (!team) throw bad_('需要新的 TEAM 名稱');
    const created = [], trashed = [];
    for (const id of arr_(req.ids, 200)) {
      const f = ownFile_(id, FOLDERS.records); if (!f) continue;
      const obj = JSON.parse(f.getBlob().getDataAsString('UTF-8').replace(/^﻿/, ''));
      const k = ['team', 'TEAM', 'Team', '所屬'].filter(x => x in obj)[0] || 'team';
      obj[k] = team;
      created.push(create_(FOLDERS.records, f.getName(), obj));
      f.setTrashed(true); trashed.push(f.getId());
    }
    return { created: created, trashed: trashed };
  }
};

function create_(folderId, name, obj) {
  const f = DriveApp.getFolderById(folderId).createFile(name, JSON.stringify(obj), 'application/json');
  return { id: f.getId(), title: f.getName(), modified: f.getLastUpdated().toISOString(), data: obj };
}
function ownFile_(id, onlyFolder) {
  if (!/^[\w-]{10,}$/.test(String(id || ''))) return null;
  let f; try { f = DriveApp.getFileById(id); } catch (e) { return null; }
  const allowed = onlyFolder ? [onlyFolder] : Object.keys(FOLDERS).map(k => FOLDERS[k]);
  const ps = f.getParents();
  while (ps.hasNext()) if (allowed.indexOf(ps.next().getId()) >= 0) return f;
  const e = new Error('not_allowed'); e.code = 'not_allowed'; throw e;
}
function party_(p) {
  if (!p || typeof p !== 'object') return null;
  const account = str_(p.account, 120).toLowerCase(); if (!account) return null;
  return { account: account, team: str_(p.team, 40) || null };
}
const str_ = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr_ = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const bad_ = msg => { const e = new Error(msg); e.code = 'bad_request'; return e; };
const now14_ = () => fmt14_(new Date());
const fmt14_ = d => Utilities.formatDate(d, TZ, 'yyyyMMddHHmmss');
const rand4_ = () => Math.random().toString(36).slice(2, 6);
function clearFeed_() { CacheService.getScriptCache().remove('feed:n'); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
