/**
 * 雲端紀錄看板的資料來源（Google Apps Script 網頁應用程式）。
 *
 * GET  ：以部署者本人的身分讀取三個 Drive 資料夾中的 JSON 檔，合併成一份 JSON 給看板。
 *        指令碼屬性有設 READ_KEY 時，GET 只回「公開精簡版」：沒有紀錄內容、會議發言、指令內文，email 換成雜湊碼。
 *        完整內容要用 POST {action:'read', key:READ_KEY（或 ADMIN_KEY）} 取得。沒設 READ_KEY 時 GET 回完整內容（舊行為）。
 * POST ：read 以外都是管理模式的寫入（發起會議、老師發言、下指令、核准指令、改 TEAM、移到垃圾桶），需要管理密碼。
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
  const locked = !!PropertiesService.getScriptProperties().getProperty('READ_KEY');
  return ContentService.createTextOutput(feedText_(locked)).setMimeType(ContentService.MimeType.JSON);
}
// 完整版或公開精簡版的整份 JSON（各自快取 FEED_TTL 秒）
function feedText_(publicOnly) {
  const cache = CacheService.getScriptCache(), key = publicOnly ? 'feedp' : 'feed';
  let body = getChunked_(cache, key);
  if (!body) {
    let full = publicOnly ? getChunked_(cache, 'feed') : null;
    let feed;
    if (full) feed = JSON.parse(full);
    else {
      const since = Date.now() - MAX_DAYS * 86400000;
      feed = { generated: new Date().toISOString() };
      for (const name in FOLDERS) feed[name] = readFolder_(FOLDERS[name], since, cache);
      putChunked_(cache, 'feed', JSON.stringify(feed), FEED_TTL);
    }
    if (publicOnly) feed = publicFeed_(feed);
    body = JSON.stringify(feed);
    if (publicOnly) putChunked_(cache, 'feedp', body, FEED_TTL);
  }
  return body;
}

// ---------------------------------------------------------------- 公開精簡版
// 只留 3D 辦公室需要的骨架：誰（email 換成雜湊碼）、哪個 TEAM、什麼時間、會議與指令的狀態。
// 紀錄主題與內容、會議主題與發言、結論、指令內文、回報說明一律拿掉。
function hashAcc_(a) {
  a = String(a || '').trim().toLowerCase();
  if (!a || a === 'teacher') return a;
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, a, Utilities.Charset.UTF_8);
  return '#' + d.slice(0, 5).map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}
function hp_(p) { return p && typeof p === 'object' ? { account: hashAcc_(p.account), team: p.team || null, name: p.team === 'HUMAN' ? p.name : undefined } : null; }
function publicFeed_(feed) {
  // 檔名也可能夾帶 email 或主題（代理人沒照標準檔名時）：紀錄只留時間，其他檔名把 email 洗掉
  const scrub = t => String(t || '').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, '#');
  const pick = (files, fn, rec) => (files || []).map(f => ({ id: f.id, modified: f.modified, data: f.data ? fn(f.data) : null,
    title: rec ? '雲端紀錄_' + ((/\d{14}/.exec(f.title || '') || [''])[0]) + '.json' : scrub(f.title) })).filter(f => f.data);
  const hps = arr => (Array.isArray(arr) ? arr : []).map(hp_).filter(Boolean);
  const rec = o => {
    const acc = o.account || o.email || o['帳號']; if (!acc) return null;
    return { account: hashAcc_(acc), team: o.team || o.TEAM || o.Team || o['所屬'] || '', last_time: o.last_time || o.time || o.timestamp || o['時間'] || '', topic: '工作紀錄', content: '', project_id: o.project_id || undefined };
  };
  const meet = o => {
    switch (o.type) {
      case 'agenda': return { type: 'agenda', meeting_id: o.meeting_id, title: '會議', host: hp_(o.host), attendees: hps(o.attendees), created: o.created, deadline: o.deadline, project_id: o.project_id || undefined, review: o.review || undefined,
        source_request: o.source_request || undefined, requested_by: hp_(o.requested_by) || undefined };
      case 'message': return { type: 'message', meeting_id: o.meeting_id, msg_id: o.msg_id, from: hp_(o.from), time: o.time, reply_to: o.reply_to || null, mentions: [], kind: o.kind, content: '' };
      case 'minutes': return { type: 'minutes', meeting_id: o.meeting_id, by: hp_(o.by), time: o.time, summary: '', decisions: [], actions: (o.actions || []).map(x => ({ to: hp_(x.to), task: '', command_id: x.command_id || null })) };
      case 'meeting_request': return { type: 'meeting_request', request_id: o.request_id, from: hp_(o.from), created: o.created, title: '會議請求', host: hp_(o.host), attendees: hps(o.attendees), hours: o.hours };
      case 'request_decision': return { type: 'request_decision', request_id: o.request_id, time: o.time, decision: o.decision, meeting_id: o.meeting_id || null };
      case 'minutes_decision': return { type: 'minutes_decision', meeting_id: o.meeting_id, time: o.time, decision: o.decision, note: '', actions: (o.actions || []).map(x => ({ to: hp_(x.to), task: '', command_id: x.command_id })) };
      default: return null;
    }
  };
  const cmd = o => {
    switch (o.type) {
      case 'command': return { type: 'command', command_id: o.command_id, to: hp_(o.to), created: o.created, title: '指令', priority: o.priority, needs_approval: !!o.needs_approval, source_meeting: o.source_meeting || null, project_id: o.project_id || undefined };
      case 'project': return { type: 'project', project_id: o.project_id, title: '專案', goal: '', lead: hp_(o.lead), members: hps(o.members), created: o.created, deadline: o.deadline || '' };
      case 'project_status': return { type: 'project_status', project_id: o.project_id, time: o.time, status: o.status, note: '' };
      case 'project_request': return { type: 'project_request', request_id: o.request_id, from: hp_(o.from), created: o.created, title: '專案請求', lead: hp_(o.lead), members: hps(o.members) };
      case 'project_decision': return { type: 'project_decision', request_id: o.request_id, time: o.time, decision: o.decision, project_id: o.project_id || null };
      case 'ack': return { type: 'ack', command_id: o.command_id, by: hp_(o.by), time: o.time, status: o.status, note: '' };
      case 'approval': return { type: 'approval', command_id: o.command_id, time: o.time, decision: o.decision };
      default: return null;
    }
  };
  return { generated: feed.generated, public: true, records: pick(feed.records, rec, true), meetings: pick(feed.meetings, meet), commands: pick(feed.commands, cmd) };
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

// ---------------------------------------------------------------- 授權檢查
// 看板讀得到資料、寫入卻出現「你沒有呼叫 DriveApp.Folder.createFile 的權限」時：
// 在編輯器上方的函式選單選 authorize → 按「執行」→ 授權畫面勾選「全部」權限 → 允許，
// 再到「部署 → 管理部署作業 → 編輯 → 版本選『新版本』→ 部署」。執行紀錄出現「寫入權限正常」就好了。
function authorize() {
  const names = Object.keys(FOLDERS).map(k => DriveApp.getFolderById(FOLDERS[k]).getName());
  const probe = DriveApp.createFile('agent-office-授權測試.txt', 'ok', 'text/plain');   // 建在「我的雲端硬碟」根目錄
  probe.setTrashed(true);                                                             // 立刻移到垃圾桶
  Logger.log('讀取正常：' + names.join('、') + '；寫入權限正常');
}

// ---------------------------------------------------------------- 寫入（管理模式）
const TZ = 'Asia/Taipei';
function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (x) { return out_({ ok: false, error: 'bad_request' }); }
  const props = PropertiesService.getScriptProperties(), key = props.getProperty('ADMIN_KEY');
  if (req && req.action === 'read') {   // 完整內容：讀取密碼或管理密碼都可以
    const rk = props.getProperty('READ_KEY');
    if (!req.key || (req.key !== rk && req.key !== key)) { Utilities.sleep(1000); return out_({ ok: false, error: 'wrong_key' }); }
    return ContentService.createTextOutput(feedText_(false)).setMimeType(ContentService.MimeType.JSON);
  }
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
      host: party_(req.host) || attendees[0], attendees: attendees, project_id: pid_(req.project_id), review: req.review !== false,
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
      priority: req.priority === 'high' ? 'high' : 'normal', source_meeting: null, project_id: pid_(req.project_id),
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

  // 老師核准／駁回代理人提出的會議請求（會議室/會議請求_<request_id>.json）。
  // 核准時用請求內容建立正式議程（老師可改主題、時限、主持人、與會者），並記下 decision 檔。
  decideMeetingRequest: req => {
    const rid = str_(req.request_id, 40);
    if (!/^R\d{14}[0-9a-z]{4}$/i.test(rid)) throw bad_('請求編號格式不對');
    const decision = req.decision === 'rejected' ? 'rejected' : req.decision === 'approved' ? 'approved' : '';
    if (!decision) throw bad_('decision 需為 approved 或 rejected');
    const folder = DriveApp.getFolderById(FOLDERS.meetings);
    if (folder.searchFiles('title contains "會議請求_' + rid + '_decision"').hasNext()) throw bad_('這個請求已經處理過了');
    const it = folder.getFilesByName('會議請求_' + rid + '.json');
    if (!it.hasNext()) throw bad_('找不到這個會議請求');
    const r = JSON.parse(it.next().getBlob().getDataAsString('UTF-8').replace(/^﻿/, ''));
    const t = now14_(), out = {};
    let mid = null;
    if (decision === 'approved') {
      const attendees = (arr_(req.attendees, 30).length ? arr_(req.attendees, 30) : arr_(r.attendees, 30)).map(party_).filter(Boolean);
      const from = party_(r.from);
      if (from && !attendees.some(p => p.account === from.account && (p.team || '') === (from.team || ''))) attendees.unshift(from);
      const title = str_(req.title, 60) || str_(r.title, 60);
      if (!title || !attendees.length) throw bad_('請求缺主題或與會者');
      const hours = Math.min(168, Math.max(1, Number(req.hours) || Number(r.hours) || 24));
      mid = 'M' + t.slice(0, 12) + rand4_();
      const agenda = {
        type: 'agenda', meeting_id: mid, title: title, goal: str_(r.goal, 500),
        agenda: arr_(r.agenda, 12).map(x => str_(x, 120)).filter(Boolean),
        host: party_(req.host) || party_(r.host) || from || attendees[0], attendees: attendees,
        created_by: '劉老師（看板，核准會議請求）', source_request: rid, requested_by: from, project_id: pid_(r.project_id), review: req.review !== false,
        created: t, deadline: fmt14_(new Date(Date.now() + hours * 3600000))
      };
      out.meeting = create_(FOLDERS.meetings, '會議_' + mid + '_agenda.json', agenda);
    }
    const obj = { type: 'request_decision', request_id: rid, by: { account: 'teacher', team: 'HUMAN', name: '劉老師' }, time: t,
      decision: decision, meeting_id: mid, note: str_(req.note, 300) };
    out.file = create_(FOLDERS.meetings, '會議請求_' + rid + '_decision_' + t + '_' + rand4_() + '.json', obj);
    return out;
  },

  // 老師裁示會議結論（議程 review: true 的會議）：approved 照結論的待辦派指令、amended 用老師修正過的待辦派指令、rejected 不派。
  // 指令由這裡建立（主持人不建），再新增一份 會議_<id>_decision_… 記下裁示與建立的指令。
  decideMinutes: req => {
    const mid = str_(req.meeting_id, 40);
    if (!/^M\d{12}[0-9a-z]{4}$/i.test(mid)) throw bad_('會議編號格式不對');
    const decision = ['approved', 'amended', 'rejected'].indexOf(req.decision) >= 0 ? req.decision : '';
    if (!decision) throw bad_('decision 需為 approved、amended 或 rejected');
    const folder = DriveApp.getFolderById(FOLDERS.meetings);
    if (folder.searchFiles('title contains "會議_' + mid + '_decision"').hasNext()) throw bad_('這場會議已經裁示過了');
    const read = name => { const it = folder.getFilesByName(name); return it.hasNext() ? JSON.parse(it.next().getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '')) : null; };
    const minutes = read('會議_' + mid + '_minutes.json'); if (!minutes) throw bad_('這場會議還沒有結論');
    const agenda = read('會議_' + mid + '_agenda.json') || {};
    if ((minutes.actions || []).some(x => x && x.command_id)) throw bad_('主持人已經派了指令，這場會議不用再裁示');
    const note = str_(req.note, 500);
    if (decision === 'rejected' && !note) throw bad_('不通過時請寫原因，主持人會依原因處理');
    const src = decision === 'amended' ? arr_(req.actions, 20) : decision === 'approved' ? arr_(minutes.actions, 20) : [];
    const t = now14_(), commands = [];
    src.forEach((a, i) => {
      const to = party_(a && a.to), task = str_(a && a.task, 1500); if (!to || !task) return;
      const id = 'C' + t + rand4_();
      const obj = { type: 'command', command_id: id, to: to, from: '會議 ' + mid + '（老師核准）', created: t,
        title: str_(a.title, 40) || task.slice(0, 20), instruction: task + (note ? '\n\n老師補充：' + note : ''),
        priority: a.priority === 'high' ? 'high' : 'normal', source_meeting: mid, project_id: pid_(agenda.project_id),
        needs_approval: a.needs_approval === true, approval_reason: str_(a.approval_reason, 200) };
      commands.push(create_(FOLDERS.commands, '指令_' + id + '.json', obj));
    });
    if (decision !== 'rejected' && !commands.length) throw bad_('沒有可以派出的待辦（請確認每一項都有負責人與內容）');
    const obj = { type: 'minutes_decision', meeting_id: mid, by: { account: 'teacher', team: 'HUMAN', name: '劉老師' }, time: t, decision: decision,
      note: note, actions: commands.map(c => ({ to: c.data.to, task: c.data.instruction, command_id: c.data.command_id })) };
    return { file: create_(FOLDERS.meetings, '會議_' + mid + '_decision_' + t + '_' + rand4_() + '.json', obj), commands: commands };
  },

  // 專案（指令資料夾/專案_<project_id>.json）：名稱、目標、負責人、成員、期限
  createProject: req => {
    const members = arr_(req.members, 30).map(party_).filter(Boolean), lead = party_(req.lead) || members[0];
    if (!str_(req.title, 40) || !lead) throw bad_('需要專案名稱與負責人');
    if (!members.some(p => p.account === lead.account && (p.team || '') === (lead.team || ''))) members.unshift(lead);
    return { file: create_(FOLDERS.commands, '專案_' + newPid_() + '.json', projectObj_(req, lead, members, null)) };
  },

  // 專案狀態（active 進行中／paused 暫停／done 完成），新增一份狀態檔，最新一筆為準
  setProjectStatus: req => {
    const pid = pid_(req.project_id); if (!pid) throw bad_('專案編號格式不對');
    const status = ['active', 'paused', 'done'].indexOf(req.status) >= 0 ? req.status : '';
    if (!status) throw bad_('status 需為 active、paused 或 done');
    const t = now14_();
    const obj = { type: 'project_status', project_id: pid, by: { account: 'teacher', team: 'HUMAN', name: '劉老師' }, time: t, status: status, note: str_(req.note, 300) };
    return { file: create_(FOLDERS.commands, '專案_' + pid + '_status_' + t + '_' + rand4_() + '.json', obj) };
  },

  // 老師核准／駁回代理人的專案請求（指令資料夾/專案請求_<request_id>.json），核准時建立專案
  decideProjectRequest: req => {
    const rid = str_(req.request_id, 40);
    if (!/^Q\d{14}[0-9a-z]{4}$/i.test(rid)) throw bad_('請求編號格式不對');
    const decision = req.decision === 'rejected' ? 'rejected' : req.decision === 'approved' ? 'approved' : '';
    if (!decision) throw bad_('decision 需為 approved 或 rejected');
    const folder = DriveApp.getFolderById(FOLDERS.commands);
    if (folder.searchFiles('title contains "專案請求_' + rid + '_decision"').hasNext()) throw bad_('這個請求已經處理過了');
    const it = folder.getFilesByName('專案請求_' + rid + '.json');
    if (!it.hasNext()) throw bad_('找不到這個專案請求');
    const r = JSON.parse(it.next().getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, ''));
    const t = now14_(), out = {};
    let pid = null;
    if (decision === 'approved') {
      const from = party_(r.from), members = arr_(r.members, 30).map(party_).filter(Boolean), lead = party_(r.lead) || from || members[0];
      if (!str_(r.title, 40) || !lead) throw bad_('請求缺專案名稱或負責人');
      if (!members.some(p => p.account === lead.account && (p.team || '') === (lead.team || ''))) members.unshift(lead);
      pid = newPid_();
      out.project = create_(FOLDERS.commands, '專案_' + pid + '.json', projectObj_(r, lead, members, rid));
      out.project.data.project_id = pid;
    }
    const obj = { type: 'project_decision', request_id: rid, by: { account: 'teacher', team: 'HUMAN', name: '劉老師' }, time: t,
      decision: decision, project_id: pid, note: str_(req.note, 300) };
    out.file = create_(FOLDERS.commands, '專案請求_' + rid + '_decision_' + t + '_' + rand4_() + '.json', obj);
    return out;
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
let lastPid_ = '';
function newPid_() { lastPid_ = 'P' + now14_() + rand4_(); return lastPid_; }
function projectObj_(src, lead, members, rid) {
  const days = Math.min(365, Math.max(0, Number(src.days) || 0));
  return { type: 'project', project_id: lastPid_, title: str_(src.title, 40), goal: str_(src.goal, 500), lead: lead, members: members,
    created_by: rid ? '劉老師（看板，核准專案請求）' : '劉老師（看板）', source_request: rid || null, requested_by: rid ? party_(src.from) : null,
    created: now14_(), deadline: days ? fmt14_(new Date(Date.now() + days * 86400000)) : '' };
}
const pid_ = v => (/^P\d{14}[0-9a-z]{4}$/i.test(String(v || '')) ? String(v) : null);
const str_ = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr_ = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const bad_ = msg => { const e = new Error(msg); e.code = 'bad_request'; return e; };
const now14_ = () => fmt14_(new Date());
const fmt14_ = d => Utilities.formatDate(d, TZ, 'yyyyMMddHHmmss');
const rand4_ = () => Math.random().toString(36).slice(2, 6);
function clearFeed_() { CacheService.getScriptCache().removeAll(['feed:n', 'feedp:n']); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
