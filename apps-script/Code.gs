/**
 * 雲端紀錄看板的唯讀資料來源（Google Apps Script 網頁應用程式）。
 *
 * 以部署者本人的身分讀取三個 Drive 資料夾中的 JSON 檔，合併成一份 JSON 回傳給看板。
 * 資料夾本身不需要公開；但部署成「所有人」可存取後，知道網址的人都讀得到這份彙整資料。
 *
 * 部署：擴充功能 → Apps Script（或 script.google.com 新專案）貼上本檔 →
 *       部署 → 新增部署作業 → 類型「網頁應用程式」→ 執行身分「我」、存取權「所有人」。
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
