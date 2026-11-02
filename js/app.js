// 雲端紀錄看板：資料、圓框檢視、側欄（唯讀）
(() => {
  // Settings live in config.js (window.AGENT_OFFICE_CONFIG).
  const CFG = window.AGENT_OFFICE_CONFIG || {};
  const LS_CACHE = 'agentoffice.cache.v1', LS_INT = 'cloudlog.interval', LS_TEAM = 'cloudlog.team';
  const HUES = ['--t0','--t1','--t2','--t3','--t4','--t5'];

  const $ = id => document.getElementById(id);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'style') n.setAttribute('style', v);
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of kids) if (c != null) n.append(c);
    return n;
  };
  const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const lsDel = k => { try { localStorage.removeItem(k); } catch {} };

  // ---------- state ----------
  let state = { files: {}, lastSync: 0, lastFull: 0 };
  try { const c = JSON.parse(lsGet(LS_CACHE) || 'null'); if (c && c.files) state = c; } catch {}
  state.mfiles = state.mfiles || {}; state.cfiles = state.cfiles || {};
  let intervalMin = Number(lsGet(LS_INT)) || 5;
  let teamFilter = lsGet(LS_TEAM) || 'all';
  let view = lsGet('cloudlog.view') === 'bubbles' ? 'bubbles' : 'office';
  let openMeet = null;
  let syncing = false, lastAttempt = 0, openAccount = null, blocked = false;
  let status = { kind: 'idle', text: '準備中…' };
  const prevLatest = {};      // account -> latest ts at previous render
  const freshSet = new Set(); // accounts that got a new record during this session
  let firstRenderDone = false;

  $('interval').value = String(intervalMin);
  if (CFG.adminUrl) { const a = $('adminLink'); if (a) { a.href = CFG.adminUrl; a.hidden = false; } }

  // ---------- parsing ----------
  function parseTime14(s) {
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(s).trim());
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 8, +m[5], +m[6]); // stored as Taipei time
  }
  function normalizeRec(o, f) {
    if (!o || typeof o !== 'object') return null;
    const account = String(o.account || o.email || o['帳號'] || '').trim().toLowerCase();
    if (!account) return null;
    let ts = NaN;
    const t = o.last_time || o.time || o.timestamp || o['時間'];
    if (t != null) { ts = parseTime14(t); if (isNaN(ts)) ts = Date.parse(t); }
    if (isNaN(ts)) { const m = /(\d{14})/.exec(f.title || ''); if (m) ts = parseTime14(m[1]); }
    if (isNaN(ts)) ts = Date.parse(f.modifiedTime) || 0;
    return {
      account,
      topic: String(o.topic || o['主題'] || '（未填主題）').trim(),
      content: String(o.content || o['內容'] || '').trim(),
      team: String(o.team || o.TEAM || o.Team || o['所屬'] || '').trim(),
      ts
    };
  }
  const parseRec = (o, f) => normalizeRec(o, f);
  const parseDoc = o => (o && typeof o === 'object' && typeof o.type === 'string') ? o : null;
  const partyKey = o => o ? String(o.account || '').trim().toLowerCase() + '|' + teamKey(o.team) : '';
  const isMe = (party, g) => !!party && String(party.account || '').trim().toLowerCase() === g.account && (!party.team || party.team === '*' || teamKey(party.team) === g.teamKey);
  const now14 = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return `${p.year}${p.month}${p.day}${p.hour === '24' ? '00' : p.hour}${p.minute}${p.second}`; };
  const rand4 = () => Math.random().toString(36).slice(2, 6).padEnd(4, 'x');
  const tsOf = (t, f) => { const v = parseTime14(t || ''); return isNaN(v) ? (Date.parse(f && f.modifiedTime) || 0) : v; };
  const teamKey = t => (t || '').replace(/^team\s+/i, '').trim().toLowerCase() || '—';

  // ---------- formatting ----------
  const fmtFull = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtClock = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' });
  function rel(ts) {
    const d = Date.now() - ts;
    if (d < 60e3) return '剛剛';
    if (d < 3600e3) return Math.floor(d / 60e3) + ' 分鐘前';
    if (d < 86400e3) return Math.floor(d / 3600e3) + ' 小時前';
    if (d < 7 * 86400e3) return Math.floor(d / 86400e3) + ' 天前';
    return fmtFull.format(ts).slice(0, 10);
  }

  // ---------- derive view model ----------
  function model() {
    const recs = [];
    for (const f of Object.values(state.files)) if (f.rec) recs.push({ ...f.rec, fileId: f.id, viewUrl: f.viewUrl, title: f.title });
    // team label = most common spelling of the key (without a "TEAM " prefix)
    const teamCounts = {}, spell = {};
    for (const r of recs) {
      const k = teamKey(r.team); teamCounts[k] = (teamCounts[k] || 0) + 1;
      const label = (r.team || '').replace(/^team\s+/i, '').trim() || '未標示';
      spell[k] = spell[k] || {}; spell[k][label] = (spell[k][label] || 0) + 1;
    }
    const teams = Object.keys(teamCounts).sort((a, b) => teamCounts[b] - teamCounts[a] || a.localeCompare(b));
    const teamInfo = {};
    teams.forEach((k, i) => {
      const label = Object.entries(spell[k]).sort((a, b) => b[1] - a[1])[0][0];
      teamInfo[k] = { key: k, label, hue: `var(${HUES[i % HUES.length]})`, count: teamCounts[k] };
    });
    const byAcc = {};
    for (const r of recs) { const k = r.account + '|' + teamKey(r.team); (byAcc[k] = byAcc[k] || []).push(r); }
    const weekAgo = Date.now() - 7 * 86400e3;
    const accounts = Object.entries(byAcc).map(([key, list]) => {
      list.sort((a, b) => b.ts - a.ts);
      const latest = list[0], tk = teamKey(latest.team);
      return { key, account: latest.account, teamKey: tk, list, latest, team: teamInfo[tk], total: list.length, week: list.filter(r => r.ts >= weekAgo).length };
    }).sort((a, b) => a.account.localeCompare(b.account) || a.team.label.localeCompare(b.team.label));
    // meetings
    const meetings = new Map();
    const mget = id => { if (!meetings.has(id)) meetings.set(id, { id, agenda: null, msgs: [], minutes: null }); return meetings.get(id); };
    for (const f of Object.values(state.mfiles)) { const o = f.rec; if (!o || !o.meeting_id) continue; const mt = mget(o.meeting_id);
      if (o.type === 'agenda') mt.agenda = { ...o, fileId: f.id, viewUrl: f.viewUrl, ts: tsOf(o.created, f) };
      else if (o.type === 'message') mt.msgs.push({ ...o, fileId: f.id, ts: tsOf(o.time, f) });
      else if (o.type === 'minutes') mt.minutes = { ...o, fileId: f.id, ts: tsOf(o.time, f) }; }
    const mlist = [...meetings.values()].filter(x => x.agenda || x.msgs.length).map(x => {
      x.msgs.sort((a, b) => a.ts - b.ts);
      x.title = (x.agenda && x.agenda.title) || x.id; x.open = !x.minutes;
      x.deadline = x.agenda ? parseTime14(x.agenda.deadline || '') : NaN; x.overdue = x.open && !isNaN(x.deadline) && Date.now() > x.deadline;
      x.lastTs = Math.max(x.agenda ? x.agenda.ts : 0, ...x.msgs.map(q => q.ts), x.minutes ? x.minutes.ts : 0);
      return x; }).sort((a, b) => (b.open - a.open) || (b.lastTs - a.lastTs));
    // commands
    const cmds = new Map();
    const cget = id => { if (!cmds.has(id)) cmds.set(id, { id, cmd: null, acks: [] }); return cmds.get(id); };
    for (const f of Object.values(state.cfiles)) { const o = f.rec; if (!o || !o.command_id) continue; const c = cget(o.command_id);
      if (o.type === 'command') c.cmd = { ...o, fileId: f.id, viewUrl: f.viewUrl, ts: tsOf(o.created, f) };
      else if (o.type === 'ack') c.acks.push({ ...o, ts: tsOf(o.time, f) }); }
    const clist = [...cmds.values()].filter(c => c.cmd).map(c => { c.acks.sort((a, b) => a.ts - b.ts); const last = c.acks[c.acks.length - 1]; c.status = last ? last.status : 'new'; c.note = last ? last.note : ''; return c; })
      .sort((a, b) => b.cmd.ts - a.cmd.ts);
    for (const a of accounts) {
      a.cmds = clist.filter(c => isMe(c.cmd.to, a));
      a.pending = a.cmds.filter(c => !['done', 'declined'].includes(c.status)).length;
      a.meetings = mlist.filter(x => x.agenda && (isMe(x.agenda.host, a) || (x.agenda.attendees || []).some(p => isMe(p, a))));
      let best = null;
      for (const x of mlist) for (const q of x.msgs) if (isMe(q.from, a) && (!best || q.ts > best.ts)) best = { ...q, meetingTitle: x.title };
      a.lastSay = best;
      a.meetMsg = best && Date.now() - best.ts < 45 * 60e3 ? best : null;
    }
    const today = fmtDay.format(Date.now());
    return { recs, meetings: mlist, commands: clist, teams: teams.map(k => teamInfo[k]), teamInfo, accounts, emails: new Set(recs.map(r => r.account)).size, today: recs.filter(r => fmtDay.format(r.ts) === today).length };
  }

  // ---------- render ----------
  const orbs = new Map();
  function seeded(str) { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => ((h = Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0) / 4294967296; }

  function render() {
    const m = model();
    $('sAcc').textContent = m.accounts.length || (Object.keys(state.files).length ? 0 : '–');
    $('sMail').textContent = m.recs.length ? m.emails : '–';
    $('sRec').textContent = m.recs.length || (Object.keys(state.files).length ? 0 : '–');
    $('sToday').textContent = m.recs.length ? m.today : '–';

    // team chips
    const chips = $('chips'); chips.replaceChildren();
    if (m.teams.length > 1) {
      const mk = (key, label, hue, count) => el('button', {
        class: 'chip', type: 'button', 'aria-pressed': String(teamFilter === key), style: hue ? `--hue:${hue}` : null,
        onclick: () => { teamFilter = key; lsSet(LS_TEAM, key); render(); }
      }, el('i'), label, count != null ? el('small', {}, String(count)) : null);
      chips.append(mk('all', '全部', null, null));
      for (const t of m.teams) chips.append(mk(t.key, t.label, t.hue, m.accounts.filter(a => a.teamKey === t.key).length));
    }
    if (teamFilter !== 'all' && !m.teamInfo[teamFilter]) teamFilter = 'all';

    // track new arrivals (only after first render, so a reload doesn't flag everything)
    for (const a of m.accounts) {
      if (firstRenderDone && prevLatest[a.key] != null && a.latest.ts > prevLatest[a.key]) freshSet.add(a.key);
      if (firstRenderDone && prevLatest[a.key] == null && Object.keys(prevLatest).length) freshSet.add(a.key);
      prevLatest[a.key] = a.latest.ts;
    }
    if (m.accounts.length) firstRenderDone = true;

    const stage = $('stage');
    const shown = m.accounts.filter(a => teamFilter === 'all' || a.teamKey === teamFilter);
    const officeBox = $('office');
    stage.hidden = view !== 'bubbles'; officeBox.hidden = view !== 'office';
    for (const b of document.querySelectorAll('.views button')) b.setAttribute('aria-selected', String(b.dataset.view === view));
    if (view === 'bubbles') layoutStage(shown.length); else layoutOffice();
    try { if (window.cloudlogOffice) window.cloudlogOffice.update(shown, { fresh: freshSet, active: view === 'office', meetings: m.meetings }); } catch (e) { console.error(e); }

    if (!shown.length) {
      orbs.clear();
      stage.replaceChildren(emptyState());
    } else {
      if (stage.querySelector('.empty')) stage.replaceChildren();
      const keep = new Set(shown.map(a => a.key));
      for (const [k, node] of orbs) if (!keep.has(k)) { node.remove(); orbs.delete(k); }
      shown.forEach((a, i) => {
        let node = orbs.get(a.key);
        if (!node) {
          const rnd = seeded(a.key);
          node = el('div', { class: 'orb', style: `--dur:${(6 + rnd() * 4).toFixed(2)}s;--delay:-${(rnd() * 6).toFixed(2)}s;--dx:${(rnd() * 14 - 7).toFixed(1)}px` });
          node.append(el('button', { class: 'bubble', type: 'button', onclick: () => openDrawer(a.key) }));
          orbs.set(a.key, node);
        }
        fillBubble(node.firstChild, a);
        if (stage.children[i] !== node) stage.insertBefore(node, stage.children[i] || null);
      });
    }
    if (openAccount && !drawerTyping()) renderDrawer(m);
    if (openMeet && !drawerTyping()) renderMeetDrawer(m);
    const mb = $('meetBtn'); if (mb) { const n = m.meetings.filter(x => x.open).length; mb.textContent = n ? `會議 ${n}` : '會議'; mb.classList.toggle('hot', n > 0); }
  }
  const drawerTyping = () => { const ae = document.activeElement; return !!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && $('drawerHost').contains(ae)); };
  function layoutOffice() {
    const o = $('office'); const phone = window.innerWidth < 620;
    if (document.body.classList.contains('focus')) { o.style.setProperty('--oh', (window.innerHeight - 8) + 'px'); return; }
    const top = o.getBoundingClientRect().top + window.scrollY;
    const h = Math.max(phone ? 340 : 420, Math.min(900, window.innerHeight - top - (phone ? 12 : 64)));
    o.style.setProperty('--oh', h + 'px');
  }
  $('meetBtn').addEventListener('click', () => openMeetings('list'));
  const setFocus = on => { document.body.classList.toggle('focus', on); $('oFull').setAttribute('aria-pressed', String(on)); $('oFull').textContent = on ? '結束全螢幕' : '全螢幕'; lsSet('cloudlog.focus', on ? '1' : '0'); render(); if (on) $('office').scrollIntoView({ block: 'start' }); };
  $('oFull').addEventListener('click', () => setFocus(!document.body.classList.contains('focus')));
  if (lsGet('cloudlog.focus') === '1') document.body.classList.add('focus');
  for (const b of document.querySelectorAll('.views button')) b.addEventListener('click', () => { view = b.dataset.view; lsSet('cloudlog.view', view); render(); });
  window.cloudlogBridge = { open: k => openDrawer(k), meetings: id => openMeetings(id), refresh: () => render() };

  const MIN_SLOTS = 15;
  function layoutStage(n) {
    const stage = $('stage');
    const W = stage.clientWidth, phone = W < 520, g = phone ? 8 : 20;
    const top = stage.getBoundingClientRect().top + window.scrollY;
    // phone: fit every circle actually shown on one screen; desktop: keep room for at least 15
    const H = Math.max(phone ? 220 : 300, window.innerHeight - top - (phone ? 16 : 70));
    const N = phone ? Math.max(1, n) : Math.max(MIN_SLOTS, n);
    const maxD = phone ? 170 : 196, minD = phone ? 84 : 116;
    let d = minD, cols = Math.max(1, Math.floor((W + g) / (minD + g)));
    for (let t = maxD; t >= minD; t -= 2) {
      const c = Math.max(1, Math.floor((W + g) / (t + g)));
      if (Math.ceil(N / c) * (t + g) - g <= H) { d = t; cols = c; break; }
    }
    cols = Math.max(1, Math.min(cols, Math.max(n, 1)));
    stage.style.setProperty('--d', d + 'px');
    stage.style.setProperty('--cols', String(cols));
    stage.style.setProperty('--g', g + 'px');
  }
  let rsT = 0;
  window.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => render(), 120); });

  function fillBubble(b, a) {
    b.style.setProperty('--hue', a.team ? a.team.hue : 'var(--t5)');
    b.classList.toggle('fresh', freshSet.has(a.key));
    b.setAttribute('aria-label', `${a.account}，${a.team ? a.team.label : ''}，最新：${a.latest.topic}，${rel(a.latest.ts)}。開啟最近 10 筆紀錄`);
    const live = Date.now() - a.latest.ts < 3600e3;
    b.replaceChildren(
      el('span', { class: 'team' }, a.team ? a.team.label : '未標示'),
      el('span', { class: 'topic' }, a.latest.topic),
      (() => { const i = a.account.indexOf('@'); return i > 0 ? el('span', { class: 'email' }, a.account.slice(0, i + 1), el('wbr'), a.account.slice(i + 1)) : el('span', { class: 'email' }, a.account); })(),
      el('span', { class: 'meta' }, live ? el('span', { class: 'live', 'aria-hidden': 'true' }) : null, `${rel(a.latest.ts)} · ${a.total} 筆`)
    );
  }

  function emptyState() {
    const box = el('div', { class: 'empty' });
    if (syncing || status.kind === 'busy') {
      box.append(el('div', { class: 'ghost', 'aria-hidden': 'true' }), el('b', {}, '正在讀取雲端紀錄資料夾…'), el('span', {}, status.text));
    } else if (status.kind === 'err') {
      box.append(el('b', {}, '目前沒有可顯示的紀錄'), el('span', {}, '請看上方提示處理連線後，按「立即更新」。'));
    } else if (Object.keys(state.files).length) {
      box.append(el('b', {}, '這個 TEAM 目前沒有帳號'), el('span', {}, '切換上方的 TEAM 篩選，或選「全部」。'));
    } else {
      box.append(el('b', {}, '資料夾裡還沒有紀錄'), el('span', {}, '代理人存入第一筆 JSON 後，下一次抓取就會出現在這裡。'));
    }
    return box;
  }

  // ---------- drawer (read-only: writes happen in the claude.ai console or through the agents' skill) ----------
  let lastFocus = null;
  function openDrawer(key) { lastFocus = document.activeElement; openMeet = null; openAccount = key; freshSet.delete(key); render(); }
  function openMeetings(id) { lastFocus = document.activeElement; openAccount = null; openMeet = id || 'list'; render(); }
  function closeDrawer() {
    openAccount = null; openMeet = null; $('drawerHost').replaceChildren();
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }
  const ST_ZH = { new: '待接收', received: '已收到', in_progress: '進行中', done: '完成', declined: '不做', blocked: '卡住' };
  const KIND_ZH = { opinion: '意見', question: '提問', answer: '回答', proposal: '提案', agree: '同意', disagree: '反對', info: '補充', instruction: '指示', action: '待辦' };
  const partyName = p => p ? (p.name || String(p.account || '').split('@')[0] || '—') : '—';
  const adminHint = what => el('p', { class: 'hint' }, `${what}請到`, CFG.adminUrl ? el('a', { href: CFG.adminUrl, target: '_blank', rel: 'noopener' }, ' claude.ai 管理台 ') : ' claude.ai 管理台 ', '操作，或在任一代理人的對話裡用「雲端會議」技能。');

  function renderDrawer(m) {
    const a = m.accounts.find(x => x.key === openAccount);
    const host = $('drawerHost');
    if (!a) { closeDrawer(); return; }
    const hue = a.team ? a.team.hue : 'var(--t5)';
    const items = a.list.slice(0, 10).map(r => {
      const t = m.teamInfo[teamKey(r.team)];
      return el('li', {},
        el('div', { class: 'when' }, fmtFull.format(r.ts), el('span', {}, '· ' + rel(r.ts)),
          t && teamKey(r.team) !== teamKey(a.latest.team) ? el('span', { class: 'team', style: `--hue:${t.hue}` }, t.label) : null),
        el('div', { class: 'r-topic' }, r.topic),
        r.content ? el('p', { class: 'r-content' }, r.content) : el('p', { class: 'r-content none' }, '這筆紀錄沒有填寫內容'));
    });
    const cmds = a.cmds.slice(0, 5).map(c => el('li', {},
      el('div', { class: 'c-row' }, el('span', { class: 'st st-' + c.status }, ST_ZH[c.status] || c.status), el('b', {}, c.cmd.title || '(無標題)'), el('span', { class: 'muted' }, rel(c.cmd.ts))),
      c.note ? el('p', { class: 'c-note' }, c.note) : null));
    const scroll = host.querySelector('.d-body')?.scrollTop || 0;
    const closeBtn = el('button', { class: 'close', type: 'button', 'aria-label': '關閉', onclick: closeDrawer }, '×');
    host.replaceChildren(
      el('div', { class: 'scrim', onclick: closeDrawer }),
      el('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'dTitle', style: `--hue:${hue}` },
        el('div', { class: 'd-head', style: `--hue:${hue}` },
          el('div', { class: 'avatar', 'aria-hidden': 'true' }, a.account.charAt(0).toUpperCase()),
          el('div', { class: 'd-title' },
            el('span', { class: 'email', id: 'dTitle' }, a.account),
            el('span', { class: 'sub' }, el('span', { class: 'team' }, a.team ? a.team.label : '未標示'), `共 ${a.total} 筆 · 近 7 天 ${a.week} 筆`)),
          el('div', { class: 'd-tools' }, closeBtn)),
        el('div', { class: 'd-body' },
          el('div', { class: 'sect cmdbox' },
            el('h2', {}, '指令', a.pending ? el('span', { class: 'badge' }, `待處理 ${a.pending}`) : null),
            cmds.length ? el('ul', { class: 'clist' }, ...cmds) : el('p', { class: 'hint' }, '目前沒有交給它的指令。'),
            adminHint('要下新指令，')),
          a.meetings.length ? el('div', { class: 'sect' }, el('h2', {}, '受邀的會議'),
            el('div', { class: 'chiplist' }, ...a.meetings.slice(0, 6).map(x => el('button', { class: 'mchip' + (x.open ? ' open' : ''), type: 'button', onclick: () => openMeetings(x.id) },
              (x.open ? '● ' : '') + x.title)))) : null,
          el('h2', {}, `最近 ${Math.min(10, a.list.length)} 筆紀錄`),
          el('ol', { class: 'tl' }, ...items)))
    );
    host.querySelector('.d-body').scrollTop = scroll;
    if (!host.contains(document.activeElement)) closeBtn.focus();
  }

  function renderMeetDrawer(m) {
    const host = $('drawerHost'), scroll = host.querySelector('.d-body')?.scrollTop || 0;
    const closeBtn = el('button', { class: 'close', type: 'button', 'aria-label': '關閉', onclick: closeDrawer }, '×');
    const x = openMeet !== 'list' ? m.meetings.find(q => q.id === openMeet) : null;
    let body;
    if (x) body = meetDetail(x, m);
    else {
      const items = m.meetings.slice(0, 30).map(q => el('li', {}, el('button', { class: 'mrow', type: 'button', onclick: () => { openMeet = q.id; render(); } },
        el('span', { class: 'st ' + (q.open ? (q.overdue ? 'st-blocked' : 'st-in_progress') : 'st-done') }, q.open ? (q.overdue ? '已過截止' : '進行中') : '已結束'),
        el('b', {}, q.title), el('span', { class: 'muted' }, `${q.msgs.length} 則 · ${rel(q.lastTs)}`))));
      body = el('div', {},
        el('p', { class: 'hint' }, '受邀的代理人在自己的排程執行「雲端會議」時讀取議程並發言；主持人收尾時寫下結論並把待辦變成指令。'),
        adminHint('要發起會議或以老師身分發言，'),
        items.length ? el('ul', { class: 'mlist' }, ...items) : el('p', { class: 'hint' }, '還沒有會議。'));
    }
    host.replaceChildren(
      el('div', { class: 'scrim', onclick: closeDrawer }),
      el('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mTitle' },
        el('div', { class: 'd-head' },
          x ? el('button', { class: 'btn sm', type: 'button', onclick: () => { openMeet = 'list'; render(); } }, '‹ 全部') : null,
          el('div', { class: 'd-title' }, el('span', { class: 'r-topic', id: 'mTitle' }, x ? x.title : '會議室'),
            el('span', { class: 'sub' }, x ? `${x.open ? '進行中' : '已結束'} · ${x.msgs.length} 則發言` : `${m.meetings.filter(q => q.open).length} 場進行中`)),
          el('div', { class: 'd-tools' }, closeBtn)),
        el('div', { class: 'd-body' }, body)));
    host.querySelector('.d-body').scrollTop = scroll;
    if (!host.contains(document.activeElement)) closeBtn.focus();
  }
  function meetDetail(x, m) {
    const ag = x.agenda || {};
    const att = (ag.attendees || []);
    const spoke = p => x.msgs.some(q => partyKey(q.from) === partyKey(p) || (String(q.from && q.from.account || '').toLowerCase() === String(p.account || '').toLowerCase() && !p.team));
    const byId = new Map(x.msgs.map(q => [q.msg_id, q]));
    const msgs = x.msgs.map(q => {
      const rp = q.reply_to ? byId.get(q.reply_to) : null;
      const human = q.from && q.from.team === 'HUMAN';
      return el('li', { class: human ? 'human' : '' },
        el('div', { class: 'when' }, el('b', { class: 'who' }, partyName(q.from)), q.from && q.from.team && !human ? el('span', { class: 'muted' }, q.from.team) : null,
          el('span', { class: 'kind' }, KIND_ZH[q.kind] || q.kind || ''), el('span', {}, fmtFull.format(q.ts).slice(5))),
        rp ? el('p', { class: 'quote' }, `回覆 ${partyName(rp.from)}：${String(rp.content || '').slice(0, 40)}…`) : null,
        (q.mentions || []).length ? el('p', { class: 'mention' }, (q.mentions || []).map(p => '@' + partyName(p)).join(' ')) : null,
        el('p', { class: 'r-content' }, q.content || ''));
    });
    const mins = x.minutes ? el('div', { class: 'minutes' }, el('h2', {}, '會議結論'), el('p', { class: 'r-content' }, x.minutes.summary || ''),
      (x.minutes.decisions || []).length ? el('ul', {}, ...(x.minutes.decisions || []).map(t => el('li', {}, t))) : null,
      (x.minutes.actions || []).length ? el('ul', { class: 'clist' }, ...(x.minutes.actions || []).map(ac => {
        const c = m.commands.find(cc => cc.id === ac.command_id);
        return el('li', {}, el('div', { class: 'c-row' }, el('span', { class: 'st st-' + (c ? c.status : 'new') }, ST_ZH[c ? c.status : 'new']), el('b', {}, partyName(ac.to)), el('span', {}, ac.task || ''))); })) : null) : null;
    return el('div', {},
      ag.goal ? el('p', { class: 'r-content' }, ag.goal) : null,
      (ag.agenda || []).length ? el('ol', { class: 'agenda' }, ...(ag.agenda || []).map(t => el('li', {}, t))) : null,
      el('p', { class: 'hint' }, `主持人：${partyName(ag.host)}${ag.host && ag.host.team ? '·' + ag.host.team : ''}　截止：${isNaN(x.deadline) ? '—' : fmtFull.format(x.deadline)}`),
      el('div', { class: 'chiplist' }, ...att.map(p => el('span', { class: 'mchip' + (spoke(p) ? ' open' : '') }, (spoke(p) ? '✓ ' : '') + partyName(p) + (p.team ? '·' + p.team : '')))),
      mins,
      el('h2', {}, `討論（${x.msgs.length}）`),
      msgs.length ? el('ol', { class: 'thread' }, ...msgs) : el('p', { class: 'hint' }, '還沒有人發言。受邀的代理人下次排程執行時會讀議程並發言。'));
  }

  // ---------- status / notices ----------
  function setStatus(kind, text) {
    status = { kind, text };
    const dot = $('syncDot'); dot.className = 'sync-dot' + (kind === 'ok' ? ' ok' : kind === 'busy' ? ' busy' : kind === 'err' ? ' err' : '');
    $('syncText').textContent = text;
    $('refresh').disabled = kind === 'busy';
  }
  function statusLine() {
    if (syncing) return;
    if (status.kind === 'err' && blocked) return;
    if (!state.lastSync) return;
    const next = Math.max(0, lastAttempt + intervalMin * 60e3 - Date.now());
    const mm = Math.floor(next / 60e3), ss = Math.floor(next % 60e3 / 1e3);
    setStatus('ok', `上次 ${fmtClock.format(state.lastSync)} · 下次 ${mm}:${String(ss).padStart(2, '0')}`);
  }
  function showNotice(msg, opts = {}) {
    const n = $('notice');
    if (!msg) { n.hidden = true; n.replaceChildren(); return; }
    n.className = 'notice' + (opts.bad ? ' bad' : '');
    n.replaceChildren(el('p', {}, msg));
    if (opts.action) n.append(el('button', { class: 'btn', type: 'button', onclick: opts.action.fn }, opts.action.label));
    n.hidden = false;
  }
  // ---------- data: one read-only JSON feed from the Apps Script web app (apps-script/Code.gs) ----------
  async function sync() {
    if (syncing) return;
    if (!CFG.endpoint) { setStatus('err', '未設定資料來源'); showNotice('還沒設定資料來源：請照 README 部署 Apps Script，並把網址填進 config.js 的 endpoint。', { bad: true }); blocked = true; render(); return; }
    syncing = true; lastAttempt = Date.now();
    setStatus('busy', '讀取雲端資料…');
    if (!Object.keys(state.files).length) render();
    try {
      const url = CFG.endpoint + (CFG.endpoint.includes('?') ? '&' : '?') + 'v=' + Date.now();
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      const conv = (arr, parse) => Object.fromEntries((arr || []).map(f => {
        const meta = { id: f.id, title: f.title, modifiedTime: f.modified, viewUrl: 'https://drive.google.com/file/d/' + f.id + '/view' };
        return [f.id, { ...meta, rec: f.data ? parse(f.data, meta) : null }]; }));
      state.files = conv(d.records, parseRec); state.mfiles = conv(d.meetings, parseDoc); state.cfiles = conv(d.commands, parseDoc);
      state.lastSync = Date.now(); state.lastFull = state.lastSync;
      lsSet(LS_CACHE, JSON.stringify(state));
      showNotice(null); blocked = false; syncing = false;
      statusLine(); render();
    } catch (e) {
      syncing = false;
      setStatus('err', state.lastSync ? `更新失敗 · 資料為 ${fmtClock.format(state.lastSync)} 的版本` : '更新失敗');
      showNotice(`讀不到雲端資料（${(e && e.message) || e}）。請確認 Apps Script 已部署成「所有人」可存取，且 config.js 的 endpoint 是最新的部署網址。畫面保留上次的資料，下次會再試。`);
      render();
    }
  }

  // ---------- schedule ----------
  $('refresh').addEventListener('click', () => sync(true));
  $('interval').addEventListener('change', e => { intervalMin = Number(e.target.value) || 5; lsSet(LS_INT, String(intervalMin)); statusLine(); });
  setInterval(() => {
    if (syncing) return;
    if (!document.hidden && !blocked && Date.now() >= lastAttempt + intervalMin * 60e3) sync();
    else statusLine();
  }, 1000);
  setInterval(() => { if (!syncing) render(); }, 30e3);   // keep "N 分鐘前" current
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() >= lastAttempt + intervalMin * 60e3) sync(); });

  // ---------- boot ----------
  render();
  if (state.lastSync) setStatus('idle', `顯示 ${fmtClock.format(state.lastSync)} 的資料，更新中…`);
  sync();
})();
