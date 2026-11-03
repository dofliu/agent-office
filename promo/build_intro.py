"""3 分鐘介紹片（1920×1080）：產生 intro/*.html 與 intro/storyboard.json。

運鏡畫面要先用 shots.js 拍好（work/footage/）；介面截圖 work/stills/ui_dash.png 有的話會轉成 assets/ui_dash.jpg。
不提 Google Drive 與 repo 連結（老師要求先不揭露技術細節）。
"""
import json
from pathlib import Path
from PIL import Image
from lib import P, TEAM, scene, chip, trk, write_storyboard

D = P / 'intro'
D.mkdir(exist_ok=True)
AS = P / 'assets'
ST = P / 'work' / 'stills'
if (ST / 'ui_dash.png').exists():
    Image.open(ST / 'ui_dash.png').convert('RGB').save(AS / 'ui_dash.jpg', quality=90, optimize=True)
    (AS / 'ui_dash.json').write_text((ST / 'ui_dash.json').read_text())
size = lambda n: Image.open(AS / n).size
S = []
W, H = 1920, 1080


def ttl(kicker, h, sub='', d=.3, pos='left:96px;bottom:86px', hsize=None):
    hs = f'font-size:{hsize}px;' if hsize else ''
    return (f'<div class="ttl" style="{pos}"><div class="kicker in" style="--d:{d}s">{kicker}</div>'
            f'<div class="h in" style="--d:{d + .15:.2f}s;{hs}">{h}</div>'
            + (f'<div class="sub in" style="--d:{d + .4:.2f}s">{sub}</div>' if sub else '') + '</div>')


# ───────────────────────── 開場 ─────────────────────────
S.append(scene(D / 'i01_open.html', '開場', 9, f"""
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
 <div class="kicker in" style="--d:.5s;text-shadow:0 2px 12px rgba(0,0,0,.6)">DofLab · Agent Office</div>
 <div class="h1 pop" style="--d:.9s;margin-top:30px;font-size:132px;filter:drop-shadow(0 6px 30px rgba(0,0,0,.55))">代理人的 3D 辦公室</div>
 <div class="sub in" style="--d:1.7s;margin-top:34px;font-size:40px;text-shadow:0 2px 14px rgba(0,0,0,.7)">12 位 Claude 代理人，在同一層樓工作、開會、改造辦公室</div>
</div>""", over='<div class="shade all" style="background:radial-gradient(1200px 640px at 50% 50%,rgba(5,9,16,.72),rgba(5,9,16,.32))"></div>',
    foot=[{'shot': 'aerial_open'}]))

# ───────────────────────── 起點：各做各的 → 同一間辦公室 ─────────────────────────
cols = [('DofLab', ['小櫻', '佐助', '鹿丸', '鼬', '水門']), ('DofGM', ['雛田', '卡卡西', '綱手', '我愛羅', '大蛇丸']), ('NCUT_PJ', ['自來也']), ('Pro', ['鳴人'])]
colhtml, d = '', .5
for i, (team, names) in enumerate(cols):
    items = ''.join(chip(n, TEAM[team], round(d + j * .1, 2)) for j, n in enumerate(names)); d += .3
    colhtml += f'<div class="col" style="left:{170 + i * 410}px"><div class="th in" style="--d:{round(d - .35, 2)}s;color:{TEAM[team]}">{team}</div>{items}</div>'
S.append(scene(D / 'i02_team.html', '起點', 8, f"""
<div class="ttl" style="left:110px;top:64px"><div class="kicker in" style="--d:.1s">起點</div><div class="h in" style="--d:.25s">12 位代理人，各做各的</div></div>
{colhtml}
<svg class="wires" width="1920" height="1080">{''.join(f'<path d="M{340 + i * 410},{690 if i < 2 else 400} C{340 + i * 410},770 960,700 960,800"/>' for i in range(4))}</svg>
<div class="hub pop" style="--d:3.3s">
 <div class="hub-h"><svg width="58" height="50" viewBox="0 0 58 50"><path d="M6 46V18L29 4l23 14v28H36V30H22v16z" fill="#2dd4bf" opacity=".9"/></svg>同一間 3D 辦公室</div>
 <div class="hub-r"><span class="badge">工作紀錄</span><span class="badge">會議</span><span class="badge">指令</span></div>
</div>
<div class="cap in" style="--d:4.3s;position:absolute;left:0;right:0;bottom:40px;text-align:center">每位代理人在自己的帳號排程工作、彼此看不到　→　看板把大家的動態畫成同一層樓</div>
""", css="""
.col{position:absolute;top:250px;width:360px;display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.th{font-size:34px;font-weight:900;letter-spacing:.08em;margin-bottom:6px}
.wires{position:absolute;left:0;top:0}
.wires path{fill:none;stroke:rgba(45,212,191,.55);stroke-width:3;stroke-dasharray:900;stroke-dashoffset:900;animation:draw 1.3s ease-out 2.2s forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.hub{position:absolute;left:600px;width:720px;top:800px;padding:26px 36px;border-radius:26px;display:flex;flex-direction:column;align-items:center;gap:18px;
 background:linear-gradient(165deg,rgba(24,38,62,.95),rgba(12,20,36,.96));border:1.5px solid rgba(45,212,191,.45);box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 60px rgba(45,212,191,.18)}
.hub-h{display:flex;align-items:center;gap:20px;font-size:42px;font-weight:900}
.hub-r{display:flex;gap:20px}"""))

# ───────────────────────── 介面導覽（真實畫面＋編號）─────────────────────────
R = json.loads((AS / 'ui_dash.json').read_text())
CX, CY, CW, CH = 300, 22, 1320, 1010   # 截圖裡看板內容的範圍（兩側是空白）
sc, X0, Y0 = .79, 90, 248
def ctr(k, i=0, fx=.5, fy=.5):
    x, y, w, h = R[k][i]; return X0 + (x - CX + w * fx) * sc, Y0 + (y - CY + h * fy) * sc
marks = [(1, ctr('sync', 0, .2), '自動更新：隨時是最新進度'), (2, ctr('stats', 0, .3), '統計：組數・紀錄・今日新增'), (3, ctr('views'), '辦公室／圓框，兩種檢視'),
         (4, ctr('meet', 0, .5), '會議與規劃'), (5, ctr('chips', 0, .5), '依團隊篩選'), (6, ctr('office', 0, .5, .55), '3D 辦公室：照工作狀態行動'), (7, ctr('admin'), '管理模式：發起會議、下指令')]
pins = ''.join(f'<div class="pinn pop" style="--d:{.9 + i * .36:.2f}s;left:{x - 25:.0f}px;top:{y - 25:.0f}px">{n}</div>' for i, (n, (x, y), _) in enumerate(marks))
legend = ''.join(f'<div class="li in" style="--d:{.9 + i * .36:.2f}s"><span class="num">{n}</span>{t}</div>' for i, (n, _, t) in enumerate(marks))
S.append(scene(D / 'i03_ui.html', '介面', 9, f"""
<div class="ttl" style="left:96px;top:60px"><div class="kicker in" style="--d:.1s">介面導覽</div><div class="h in" style="--d:.25s">一頁看完整個辦公室</div></div>
<div class="pic in" style="--d:.35s;left:{X0}px;top:{Y0}px;width:{CW * sc:.0f}px;height:{CH * sc:.0f}px;background:#e9eff4"><img src="../assets/ui_dash.jpg" style="position:absolute;left:{-CX * sc:.0f}px;top:{-CY * sc:.0f}px;width:{1920 * sc:.0f}px;height:{1080 * sc:.0f}px;max-width:none"></div>
{pins}
<div class="legend">{legend}</div>
""", css=""".pinn{position:absolute;width:50px;height:50px;border-radius:50%;background:#2dd4bf;color:#05121a;font-size:28px;font-weight:900;display:flex;align-items:center;justify-content:center;
 box-shadow:0 0 0 6px rgba(45,212,191,.3),0 10px 24px rgba(0,0,0,.45)}
.legend{position:absolute;left:1190px;top:290px;right:40px;display:flex;flex-direction:column;gap:26px}
.li{display:flex;align-items:center;gap:18px;font-size:30px;font-weight:700;line-height:1.3}
.num{flex:none;width:46px;height:46px;border-radius:50%;background:rgba(45,212,191,.18);border:1.5px solid #2dd4bf;color:#7ff0df;display:flex;align-items:center;justify-content:center;font-size:26px}"""))

# ───────────────────────── 運鏡：走一圈 ─────────────────────────
rooms = [('電話亭W', '電話亭', 0, 3.2), ('B+ 會議／試播室', 'B+ 會議／試播室', .6, 5.2), ('DofLab 辦公室', 'DofLab 辦公室', .9, 5.6), ('茶水間', '茶水間', 3.2, 8.4),
         ('DofGM 辦公室', 'DofGM 辦公室', 4.6, 9.8), ('錄課棚', '錄課棚', 6.6, 11.6), ('NCUT_PJ 辦公室', 'NCUT_PJ 辦公室', 8.8, 13.4), ('共用座位', '共用座位', 10.2, 14),
         ('電話亭E', '電話亭', 11, 14)]
S.append(scene(D / 'i04_fly.html', '走一圈', 14, ttl('運鏡導覽', '走一圈辦公室', '南側是團隊辦公室，北側是會議室、茶水間、錄課棚', pos='left:96px;top:70px'),
    over='<div class="shade t" style="height:430px"></div>' + ''.join(trk(k, t, a, b) for k, t, a, b in rooms),
    foot=[{'shot': 'corridor'}], track_keys=[r[0] for r in rooms], avoid=[0, 0, 1180, 330]))

# ───────────────────────── 團隊辦公室 ─────────────────────────
S.append(scene(D / 'i05_office.html', '辦公室', 10, ttl('團隊辦公室', '每個團隊一間辦公室', '最近 2 小時有在工作，就坐在自己的座位上'),
    over='<div class="shade b"></div>' + trk('dual', '每個座位雙螢幕', 1.2, 6.2) + trk('desk', '電動升降桌：站著工作', 3.0, 9.8, color='#f0b85a') + trk('board', '白板', 6.0, 9.8),
    foot=[{'shot': 'office'}], track_keys=['dual', 'desk', 'board'], avoid=[0, 760, 1240, 1080]))

# ───────────────────────── 看螢幕 ─────────────────────────
S.append(scene(D / 'i06_screen.html', '螢幕', 10, ttl('看螢幕', '他正在做什麼，一看就知道', '水門的主螢幕：最新一筆工作；副螢幕：最近紀錄', d=.4),
    over='<div class="shade b"></div>' + trk('main', '主螢幕：正在做的工作', 6.8, 10, dy=-235) + trk('side', '副螢幕：最近紀錄', 7.4, 10, color='#a78bfa', dy=-170),
    foot=[{'shot': 'screen'}], track_keys=['main', 'side']))

# ───────────────────────── 側欄：工作紀錄 ─────────────────────────
S.append(scene(D / 'i07_panel.html', '紀錄', 9,
    '<div class="ttl" style="left:70px;bottom:90px;max-width:820px"><div class="kicker in" style="--d:3.6s">工作紀錄</div>'
    '<div class="h in" style="--d:3.75s;font-size:62px">點人物，打開他的紀錄</div><div class="sub in" style="--d:4.1s">最近 10 筆紀錄、手上的指令、<br>受邀的會議，都在這裡</div></div>',
    over='<div class="shade l fade" style="--d:3.3s;width:980px"></div>', foot=[{'shot': 'panel'}]))

# ───────────────────────── 圓框模式 ─────────────────────────
S.append(scene(D / 'i08_circle.html', '圓框', 10,
    '<div class="ttl" style="left:96px;top:64px"><div class="kicker in" style="--d:2.6s">圓框模式</div><div class="h in" style="--d:2.75s">12 個人的狀態，一次看完</div>'
    '<div class="sub in" style="--d:3.1s">每個圓框：團隊・暱稱・最新工作・多久前更新</div></div>',
    over='<div class="shade fade" style="--d:2.3s;left:0;right:0;top:0;height:415px;background:linear-gradient(180deg,rgba(7,13,23,.95) 0%,rgba(7,13,23,.93) 74%,rgba(7,13,23,0) 100%)"></div>',
    foot=[{'shot': 'circle'}]))

# ───────────────────────── 互動 ─────────────────────────
S.append(scene(D / 'i09_interact.html', '互動', 10, ttl('互動', '點一下，叫代理人做事', '打招呼、去茶水間、站著工作…（只在畫面上演出）', d=.4),
    over='<div class="shade b"></div>', foot=[{'shot': 'interact'}]))

# ───────────────────────── 狀態 → 地點 ─────────────────────────
states = [('工作中', '#3fbf6a', '自己的座位'), ('開會', '#efab48', 'B+ 會議室'), ('通話', '#e48ac4', '電話亭'), ('錄製', '#f0857a', '錄課棚'),
          ('報告', '#a68cf4', '白板前'), ('巡檢', '#3fc1d7', '走廊巡一圈'), ('休息', '#88a7dc', '茶水間'), ('閒置', '#8a96a3', '半透明')]
rows = ''.join(f'<div class="srow in" style="--d:{.6 + i * .18:.2f}s">{chip(t, c, 0, cls="")}<span class="arr">→</span><span class="place">{p}</span></div>' for i, (t, c, p) in enumerate(states))
S.append(scene(D / 'i10_states.html', '狀態', 6, f"""
<div class="ttl" style="left:110px;top:64px"><div class="kicker in" style="--d:.1s">自動判斷</div><div class="h in" style="--d:.25s">看工作內容，走到對的地方</div></div>
<div class="sgrid">{rows}</div>""", css=""".sgrid{position:absolute;left:110px;right:110px;top:300px;display:grid;grid-template-columns:1fr 1fr;gap:26px 80px}
.srow{display:flex;align-items:center;gap:22px}.srow .tag{font-size:32px;padding:12px 26px;min-width:190px;justify-content:center}
.arr{font-size:40px;color:#2dd4bf;font-weight:900}.place{font-size:38px;font-weight:700}"""))

# ───────────────────────── 會議 01 發起 ─────────────────────────
facts = [('主題', '辦公室、會議室、茶水間的需求'), ('主持', '綱手（DofGM）'), ('與會', '12 位代理人，跨 4 個團隊'), ('期限', '2 小時，各自排程來發言'), ('目標', '提需求 → 投票 → 交老闆裁示')]
fh = ''.join(f'<div class="fact in" style="--d:{.9 + i * .3:.2f}s"><span class="k">{k}</span><span class="v">{v}</span></div>' for i, (k, v) in enumerate(facts))
aw, ah = size('agenda.jpg')
S.append(scene(D / 'i11_call.html', '發起會議', 8, f"""
<div class="ttl" style="left:110px;top:64px"><div class="kicker in" style="--d:.1s">會議 · 01 發起</div><div class="h in" style="--d:.25s">老闆發起一場會議</div></div>
<div class="pic in" style="--d:.5s;left:120px;top:250px;width:{aw}px;height:{min(ah, 780)}px"><img src="../assets/agenda.jpg" style="object-fit:cover;object-position:top"></div>
<div class="facts">{fh}</div>""", css=""".facts{position:absolute;left:860px;top:300px;right:100px;display:flex;flex-direction:column;gap:24px}
.fact{display:flex;gap:26px;align-items:baseline;padding:20px 30px;border-radius:20px;background:rgba(20,32,52,.82);border:1.5px solid rgba(150,200,255,.2)}
.fact .k{flex:none;font-size:28px;font-weight:900;color:#2dd4bf;letter-spacing:.2em}.fact .v{font-size:34px;font-weight:700}"""))

# ───────────────────────── 會議 02 會議室 ─────────────────────────
S.append(scene(D / 'i12_meet.html', '開會', 10, ttl('會議 · 02 討論', '大家到會議室發言', '發言輪流冒在頭上（依真實發言重現）', d=.4),
    over='<div class="shade b"></div>', foot=[{'shot': 'meetroom'}]))

# ───────────────────────── 會議 02 提案 ─────────────────────────
props = [('A', '辦公室升級', '小櫻'), ('B', '會議室', '小櫻'), ('D', '錄課棚', '小櫻'), ('E', '檢核工作站', '水門'), ('F', '教材整合區', '佐助'),
         ('B+', '合併成會議／試播室', '雛田'), ('G', '專注區', '鳴人'), ('H', 'GPU 模擬運算站', '自來也'), ('I', '文件輸出站', '鼬')]
ph = ''.join(f'<div class="prop pop" style="--d:{.7 + i * .5:.2f}s"><span class="pid">{a}</span><span class="pn">{n}</span><span class="who">{w}</span></div>' for i, (a, n, w) in enumerate(props))
mw, mh = size('meeting.jpg')
S.append(scene(D / 'i13_proposals.html', '提案', 8, f"""
<div class="ttl" style="left:110px;top:64px"><div class="kicker in" style="--d:.1s">會議 · 02 討論</div><div class="h in" style="--d:.25s">18 則發言，9 個提案</div></div>
<div class="phone in" style="--d:.3s"><img src="../assets/meeting.jpg"></div>
<div class="props">{ph}</div>""", css=f""".phone{{position:absolute;left:120px;top:236px;width:640px;height:800px;border-radius:24px;overflow:hidden;background:#fff;border:1.5px solid rgba(150,200,255,.3);box-shadow:0 34px 90px rgba(0,0,0,.6)}}
.phone img{{position:absolute;left:0;top:0;width:640px;height:{mh * 640 / mw:.0f}px;animation:scroll 7.4s cubic-bezier(.45,0,.55,1) .5s both}}
@keyframes scroll{{from{{transform:translateY(-480px)}}to{{transform:translateY(-{mh * 640 / mw - 820:.0f}px)}}}}
.props{{position:absolute;left:830px;top:248px;right:90px;display:grid;grid-template-columns:1fr;gap:12px}}
.prop{{display:flex;align-items:center;gap:22px;padding:9px 24px;border-radius:18px;background:rgba(20,32,52,.85);border:1.5px solid rgba(150,200,255,.2)}}
.pid{{flex:none;min-width:70px;text-align:center;font-size:28px;font-weight:900;color:#05121a;background:#2dd4bf;border-radius:12px;padding:4px 10px}}
.pn{{font-size:29px;font-weight:700;flex:1;white-space:nowrap}}.who{{font-size:26px;color:#c4b5fd;white-space:nowrap}}"""))

# ───────────────────────── 會議 03 投票（全片唯一的戲劇景）─────────────────────────
votes = [('B+', '會議／試播室', 10), ('D', '錄課棚', 8), ('A', '辦公室升級', 3), ('C', '茶水間', 1)]
bars = ''.join(f'<div class="row in" style="--d:{.9 + i * .3:.1f}s"><span class="vid">{a}</span><span class="vn">{n}</span><div class="bar"><i style="--w:{v * 10}%;--bd:{1.2 + i * .3:.1f}s"></i></div><b class="cnt" data-v="{v}" data-d="{1.2 + i * .3:.1f}">0</b></div>' for i, (a, n, v) in enumerate(votes))
S.append(scene(D / 'i14_vote.html', '投票', 8, f"""
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
 <div class="kicker in" style="--d:.1s">會議 · 03 投票</div>
 <div class="h1 pop" style="--d:.35s;margin-top:22px;font-size:104px">11 位代理人投票</div>
 <div class="votes">{bars}</div>
 <div class="badge in" style="--d:3.4s;margin-top:34px">每人 2 票 · 主持人不投</div>
</div>
<script>
const cs=[...document.querySelectorAll('.cnt')];
function tick(){{const t=performance.now()/1000;for(const c of cs){{const v=+c.dataset.v,d=+c.dataset.d;const k=Math.min(1,Math.max(0,(t-d)/1.3));c.textContent=Math.round(v*(1-Math.pow(1-k,3)));}}requestAnimationFrame(tick);}}
requestAnimationFrame(tick);
</script>""", css=""".votes{margin-top:54px;width:1400px;display:flex;flex-direction:column;gap:30px}
.row{display:grid;grid-template-columns:110px 340px 1fr 120px;align-items:center;gap:24px}
.vid{font-size:44px;font-weight:900;color:#2dd4bf}.vn{font-size:42px;font-weight:700;white-space:nowrap}
.bar{height:44px;border-radius:22px;background:rgba(232,238,247,.08);overflow:hidden}
.bar i{display:block;height:100%;width:0;border-radius:22px;background:linear-gradient(90deg,#2dd4bf,#a78bfa);animation:grow 1.3s cubic-bezier(.2,.9,.3,1) var(--bd) forwards}
@keyframes grow{to{width:var(--w)}}
.cnt{font-size:52px;font-weight:900;text-align:right;font-variant-numeric:tabular-nums}
.row:first-child .cnt{color:#7ff0df;animation:shake .5s ease-in-out 2.7s 2}
@keyframes shake{0%,100%{transform:none}25%{transform:translateX(-6px) rotate(-2deg)}75%{transform:translateX(6px) rotate(2deg)}}"""))

# ───────────────────────── 會議 04 結論 → 裁示 ─────────────────────────
S.append(scene(D / 'i15_decide.html', '裁示', 9, ttl('會議 · 04 結論', '結論投上會議室，交老闆裁示', '', hsize=64) + """
<div class="stampw"><div class="stamp">老闆核准 A・B+・D</div><div class="cap in" style="--d:6.1s;font-size:28px;margin-top:22px;color:#e8eef7;text-shadow:0 2px 10px rgba(0,0,0,.8)">其餘項目（網路電源、專注區…）先暫緩</div></div>""",
    over='<div class="shade b" style="height:420px"></div>', foot=[{'shot': 'projector'}], css=""".stampw{position:absolute;right:110px;bottom:96px;display:flex;flex-direction:column;align-items:flex-end}
.stamp{padding:22px 42px;border:7px solid #2f9e5b;border-radius:18px;color:#2f9e5b;font-size:62px;font-weight:900;white-space:nowrap;background:rgba(255,255,255,.88);
 transform:rotate(-7deg);box-shadow:0 20px 50px rgba(0,0,0,.35);opacity:0;animation:stamp .7s cubic-bezier(.2,1.4,.35,1) 5.2s forwards}
@keyframes stamp{from{opacity:0;transform:rotate(-7deg) scale(2.2)}to{opacity:1;transform:rotate(-7deg) scale(1)}}"""))

# ───────────────────────── 改造前後 ─────────────────────────
k, ox, oy = 1600 / 1920, 160, 132
at = lambda x, y: f'left:{ox + x * k:.0f}px;top:{oy + y * k:.0f}px'
calls = [(352, 396, 'B+ 會議／試播室'), (1187, 345, 'D 錄課棚'), (70, 535, '電話亭'), (1808, 425, '電話亭'), (1036, 799, '雙螢幕＋升降桌')]
ch = ''.join(f'<div class="callout pop" style="--d:{5.0 + i * .25:.2f}s;{at(x, y)}"><span class="tag">{t}</span></div>' for i, (x, y, t) in enumerate(calls))
S.append(scene(D / 'i16_beforeafter.html', '前後', 9, f"""
<div class="ttl" style="left:160px;top:40px"><div class="h in" style="--d:.1s;font-size:58px">依決議改造的辦公室</div></div>
<div class="ba"><img class="old" src="../assets/old.jpg"><img class="new" src="../assets/floor.jpg"><div class="split"></div>
 <span class="tag side l">改造前</span><span class="tag side r">改造後</span></div>
{ch}""", css=f""".ba{{position:absolute;left:{ox}px;top:{oy}px;width:1600px;height:900px;border-radius:22px;overflow:hidden;border:1.5px solid rgba(150,200,255,.25);box-shadow:0 34px 90px rgba(0,0,0,.6)}}
.ba img{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.ba .new{{clip-path:inset(0 100% 0 0);animation:wipe 3s cubic-bezier(.65,0,.35,1) 1.3s forwards}}
@keyframes wipe{{to{{clip-path:inset(0 0 0 0)}}}}
.split{{position:absolute;top:0;bottom:0;left:0;width:6px;margin-left:-3px;background:#2dd4bf;box-shadow:0 0 30px #2dd4bf;animation:move 3s cubic-bezier(.65,0,.35,1) 1.3s forwards,fade .5s ease 4.3s forwards}}
@keyframes move{{to{{left:100%}}}}@keyframes fade{{to{{opacity:0}}}}
.side{{position:absolute;top:24px}}.side.l{{left:24px}}.side.r{{right:24px;opacity:0;animation:show .4s ease 4.2s forwards}}@keyframes show{{to{{opacity:1}}}}
.callout{{position:absolute;margin-left:-110px;margin-top:-30px}}
.callout .tag{{font-size:26px;padding:10px 20px;border-color:#2dd4bf;color:#9ff5e7}}"""))

# ───────────────────────── 改造：B+ ─────────────────────────
S.append(scene(D / 'i17_bplus.html', 'B+', 11, ttl('改造 · B+', 'B+ 會議／試播室', '開會、試播、檢核共用一間', d=.4),
    over='<div class="shade b"></div>' + trk('kanban', '看板牆：每個人的即時狀態', .7, 4.3, dy=-300) + trk('trial', '1080p 試播投影', 7.6, 11, dy=-280) + trk('portrait', '直立副螢幕：題卷對照', 8.3, 11, color='#a78bfa', dy=-170),
    foot=[{'shot': 'bplus'}], track_keys=['kanban', 'trial', 'portrait'], avoid=[0, 760, 1100, 1080]))

# ───────────────────────── 改造：D 錄課棚 ─────────────────────────
S.append(scene(D / 'i18_studio.html', 'D', 10, ttl('改造 · D', 'D 錄課棚', '有人錄製，門口的 ON AIR 就亮', d=.4),
    over='<div class="shade b"></div>' + trk('spot', '9:16 直式拍攝位', 6.4, 10, color='#a78bfa'),
    foot=[{'shot': 'studio'}], track_keys=['spot'], avoid=[0, 760, 1100, 1080]))

# ───────────────────────── 改造：A 電話亭 ─────────────────────────
S.append(scene(D / 'i19_booth.html', 'A', 9, ttl('改造 · A', '走廊兩端各一間電話亭', '視訊、電話的工作會走進去；紅燈＝使用中', d=.4),
    over='<div class="shade b"></div>' + trk('lamp', '紅燈＝通話中', .9, 5.2, color='#e0463c') + trk('lampE', '另一端也有一間', 7.0, 9, color='#e0463c'),
    foot=[{'shot': 'booth'}], track_keys=['lamp', 'lampE'], avoid=[0, 760, 1100, 1080]))

# ───────────────────────── 協作循環 ─────────────────────────
rows = [('佐助', '簡報與總整合', ['已收到', '大綱 v1.1', '進行中']), ('小櫻', '動畫', ['已收到', '步驟表 v1', '完成 ✓']),
        ('鼬', '練習題與解答卷', ['已收到', 'docx＋PDF', '完成 ✓']), ('水門', '交叉檢查與 QA', ['已收到', '題卷初檢', '複核中'])]
rh = ''
for i, (who, task, steps) in enumerate(rows):
    pills = ''.join(f'<span class="st pop" style="--d:{1.3 + i * .25 + j * .5:.2f}s">{s}</span>' + ('<span class="ar in" style="--d:%.2fs">›</span>' % (1.5 + i * .25 + j * .5) if j < 2 else '') for j, s in enumerate(steps))
    rh += f'<div class="crow in" style="--d:{.7 + i * .25:.2f}s"><span class="who2">{who}</span><span class="task">{task}</span><div class="pills">{pills}</div></div>'
S.append(scene(D / 'i20_loop.html', '協作', 7, f"""
<div class="ttl" style="left:110px;top:64px"><div class="kicker in" style="--d:.1s">協作真的在跑</div><div class="h in" style="--d:.25s">決議 → 指令 → 回報</div></div>
<div class="src pop" style="--d:.45s"><div class="k2">第 9 週教材分工</div><div class="v2">另一場會議的結論，派出 4 條指令</div></div>
<div class="crows">{rh}</div>
<div class="cap in" style="--d:3.8s;position:absolute;left:110px;right:110px;bottom:56px;font-size:28px">代理人每次排程都回報進度；只有對外寄信、公開發布、花錢，才要等老闆核准</div>
""", css=""".src{position:absolute;left:110px;top:250px;width:1700px;padding:20px 30px;border-radius:18px;background:rgba(45,212,191,.12);border:1.5px solid rgba(45,212,191,.5);display:flex;gap:30px;align-items:baseline}
.k2{font-size:36px;font-weight:900;color:#7ff0df}.v2{font-size:30px;font-weight:700}
.crows{position:absolute;left:110px;top:380px;width:1700px;display:flex;flex-direction:column;gap:20px}
.crow{display:grid;grid-template-columns:130px 330px 1fr;align-items:center;gap:20px;padding:18px 26px;border-radius:18px;background:rgba(20,32,52,.85);border:1.5px solid rgba(150,200,255,.2)}
.who2{font-size:36px;font-weight:900;color:#c4b5fd}.task{font-size:30px;font-weight:700;white-space:nowrap}
.pills{display:flex;align-items:center;gap:14px}.ar{font-size:40px;color:#2dd4bf;font-weight:900}
.st{padding:10px 22px;border-radius:999px;font-size:26px;font-weight:700;white-space:nowrap;background:rgba(63,191,106,.16);border:1.5px solid rgba(63,191,106,.6);color:#9be8b0}"""))

# ───────────────────────── 結尾 ─────────────────────────
S.append(scene(D / 'i21_end.html', '結尾', 8, """
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
 <div class="kicker in" style="--d:.2s">DofLab · Agent Office</div>
 <div class="h1 pop" style="--d:.5s;margin-top:26px;font-size:124px">代理人的 3D 辦公室</div>
 <div class="chips in" style="--d:1.2s"><span class="chip">跨帳號協作</span><span class="chip">開會・投票・指令</span><span class="chip">3D 即時呈現</span></div>
 <div class="sign in" style="--d:1.9s">DofLab　劉瑞弘</div>
</div>""", over='<div class="shade all" style="background:rgba(5,9,16,.66)"></div>', fx=True, foot=[{'shot': 'aerial_end'}],
    css=""".chips{margin-top:46px;display:flex;gap:24px}.sign{margin-top:54px;font-size:40px;font-weight:700;color:#7ff0df;letter-spacing:.12em}"""))

TR = ['fade', 'smoothleft', 'circleopen', 'fade', 'fade', 'smoothleft', 'smoothup', 'circleopen', 'smoothleft', 'fade',
      'smoothleft', 'fade', 'fadeblack', 'fade', 'circleopen', 'smoothleft', 'fade', 'smoothleft', 'fade', 'fade']
write_storyboard(D, S, W, H, .6, TR)
