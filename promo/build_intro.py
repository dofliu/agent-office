"""3 分鐘介紹片（1920×1080）：產生 intro/*.html 與 intro/storyboard.json。

2026-11-04 改版重點（老師指示）：多個帳號（可以是不同人的帳號）協作，和「一個帳號派 subagents」不同；
具備擴充性：社群、不同公司、代理人招募等未來規劃。仍然不提雲端運作方式與 repo。

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



NOW_NAMES = {'DofLab': ['瑞弘', '小櫻', '黃謙', '阿翰', '小智'], 'DofGM': ['小弘', '雛田', '彭帥', '小毅', '阿茂'], 'NCUT_PJ': ['阿仁'], 'Pro': ['杜夫']}

# ───────────────────────── 01 開場 ─────────────────────────
S.append(scene(D / 'i01_open.html', '開場', 9, f"""
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
 <div class="kicker in" style="--d:.5s;text-shadow:0 2px 12px rgba(0,0,0,.6)">勤益科大智動系 · 劉瑞弘老師研究室</div>
 <div class="h1 pop" style="--d:.9s;margin-top:30px;font-size:132px;filter:drop-shadow(0 6px 30px rgba(0,0,0,.55))">代理人的 3D 辦公室</div>
 <div class="sub in" style="--d:1.7s;margin-top:34px;font-size:40px;text-shadow:0 2px 14px rgba(0,0,0,.7)">12 位 AI 代理人，分屬 5 個帳號、4 個團隊，每天一起上班</div>
</div>""", over='<div class="shade all" style="background:radial-gradient(1200px 640px at 50% 50%,rgba(5,9,16,.72),rgba(5,9,16,.32))"></div>',
    foot=[{'shot': 'aerial_open'}]))

# ───────────────────────── 02 不一樣在哪：分身 vs 一間公司 ─────────────────────────
sub_nodes = ''.join(f'<i class="sn pop" style="--d:{1.0 + i * .15:.2f}s;left:{x}px;top:{y}px"></i>' for i, (x, y) in enumerate([(40, 170), (150, 230), (270, 230), (380, 170)]))
acc_nodes = ''.join(f'<div class="acc pop" style="--d:{4.0 + i * .18:.2f}s"><b>帳號 {a}</b><span>{t}</span></div>' for i, (a, t) in enumerate([('A', 'DofLab · DofGM · Pro'), ('B', 'DofLab · DofGM · NCUT_PJ'), ('C', 'DofLab · DofGM'), ('D', 'DofLab · DofGM'), ('E', 'DofLab · DofGM')]))
S.append(scene(D / 'i02_contrast.html', '不一樣', 11, f"""
<div class="ttl" style="left:110px;top:56px"><div class="kicker in" style="--d:.1s">不一樣在哪</div><div class="h in" style="--d:.25s">不是一個人的分身，是一間公司</div></div>
<div class="panel L in" style="--d:.5s">
 <div class="ph">常見做法</div><div class="pt">一個帳號，派出一群 subagents</div>
 <div class="tree"><div class="boss pop" style="--d:.8s">主代理人</div>{sub_nodes}<svg width="460" height="260">{''.join(f'<path d="M230,90 L{x + 22},{y + 4}"/>' for x, y in [(40, 170), (150, 230), (270, 230), (380, 170)])}</svg></div>
 <ul><li class="in" style="--d:1.6s">都在同一個帳號、同一段對話裡</li><li class="in" style="--d:1.9s">任務做完，分身就消失</li><li class="in" style="--d:2.2s">能做多少，受一個帳號限制</li></ul>
</div>
<div class="vs pop" style="--d:3.0s">VS</div>
<div class="panel R in" style="--d:3.4s">
 <div class="ph" style="color:#7ff0df">我們的做法</div><div class="pt">多個帳號、多個團隊，各自上班</div>
 <div class="accs">{acc_nodes}</div>
 <ul><li class="in" style="--d:5.2s">每位代理人有自己的排程，長期累積工作紀錄</li><li class="in" style="--d:5.5s">帳號可以屬於不同的人、不同的單位</li><li class="in" style="--d:5.8s">靠開會、派指令、回報彼此協作</li></ul>
</div>
<div class="cap in" style="--d:7.0s;position:absolute;left:0;right:0;bottom:46px;text-align:center;font-size:34px;font-weight:700;color:#e8eef7">從「一個人的分身」到「一群同事」：人越多、帳號越多，公司就越大</div>
""", css=""".panel{position:absolute;top:240px;width:760px;height:650px;padding:34px 40px;border-radius:28px;background:rgba(20,32,52,.86);border:1.5px solid rgba(150,200,255,.22);box-shadow:0 30px 80px rgba(0,0,0,.5)}
.panel.L{left:110px}.panel.R{right:110px;border-color:rgba(45,212,191,.55);box-shadow:0 30px 80px rgba(0,0,0,.5),0 0 60px rgba(45,212,191,.16)}
.ph{font-size:28px;font-weight:900;letter-spacing:.3em;color:#a9b6c6}.pt{font-size:40px;font-weight:900;margin-top:10px;white-space:nowrap}
.tree{position:relative;height:270px;margin:20px auto 0;width:460px}.tree svg{position:absolute;left:0;top:0;z-index:0}.tree path{stroke:rgba(196,181,253,.6);stroke-width:3;fill:none}
.boss{position:absolute;left:150px;top:30px;width:160px;height:64px;border-radius:32px;background:#8b5cf6;color:#fff;font-size:28px;font-weight:900;display:flex;align-items:center;justify-content:center;z-index:1}
.sn{position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(196,181,253,.35);border:2px dashed #c4b5fd;z-index:1}
.panel ul{list-style:none;display:flex;flex-direction:column;gap:14px;margin-top:10px}.panel li{font-size:30px;font-weight:600;padding-left:34px;position:relative;line-height:1.35}
.panel li::before{content:'';position:absolute;left:4px;top:15px;width:14px;height:14px;border-radius:50%;background:#64748b}.panel.R li::before{background:#2dd4bf}
.accs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:22px 0 24px}
.acc{display:flex;flex-direction:column;padding:12px 18px;border-radius:16px;background:rgba(45,212,191,.1);border:1.5px solid rgba(45,212,191,.45)}
.acc b{font-size:28px;color:#7ff0df}.acc span{font-size:22px;color:#c9d6e3;white-space:nowrap}
.vs{position:absolute;left:910px;top:520px;width:100px;height:100px;border-radius:50%;background:#0d1b2e;border:3px solid #2dd4bf;color:#7ff0df;font-size:38px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(45,212,191,.35)}"""))

# ───────────────────────── 03 團隊 ─────────────────────────
cols = [(t, NOW_NAMES[t]) for t in ['DofLab', 'DofGM', 'NCUT_PJ', 'Pro']]
colhtml, d = '', .5
for i, (team, names) in enumerate(cols):
    items = ''.join(chip(n, TEAM[team], round(d + j * .1, 2)) for j, n in enumerate(names)); d += .3
    colhtml += f'<div class="col" style="left:{170 + i * 410}px"><div class="th in" style="--d:{round(d - .35, 2)}s;color:{TEAM[team]}">{team}</div>{items}</div>'
S.append(scene(D / 'i03_team.html', '團隊', 9, f"""
<div class="ttl" style="left:110px;top:64px"><div class="kicker in" style="--d:.1s">12 位同事</div><div class="h in" style="--d:.25s">5 個帳號 × 4 個團隊</div></div>
{colhtml}
<svg class="wires" width="1920" height="1080">{''.join(f'<path d="M{340 + i * 410},{690 if i < 2 else 400} C{340 + i * 410},770 960,700 960,800"/>' for i in range(4))}</svg>
<div class="hub pop" style="--d:3.3s">
 <div class="hub-h"><svg width="58" height="50" viewBox="0 0 58 50"><path d="M6 46V18L29 4l23 14v28H36V30H22v16z" fill="#2dd4bf" opacity=".9"/></svg>同一間 3D 辦公室</div>
 <div class="hub-r"><span class="badge">工作紀錄</span><span class="badge">會議</span><span class="badge">指令與回報</span></div>
</div>
<div class="cap in" style="--d:4.3s;position:absolute;left:0;right:0;bottom:40px;text-align:center">每位代理人在自己的帳號工作、看不到別人的對話　→　在這間辦公室開會、派工、回報</div>
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

# ───────────────────────── 04 介面導覽 ─────────────────────────
R = json.loads((AS / 'ui_dash.json').read_text())
CX, CY, CW, CH = 300, 22, 1320, 1010
sc, X0, Y0 = .79, 90, 248
def ctr(k, i=0, fx=.5, fy=.5):
    x, y, w, h = R[k][i]; return X0 + (x - CX + w * fx) * sc, Y0 + (y - CY + h * fy) * sc
marks = [(1, ctr('stats', 0, .3), '統計：組數・紀錄・今日新增'), (2, ctr('views'), '辦公室／圓框，兩種檢視'), (3, ctr('meet', 0, .5), '會議・專案・規劃'),
         (4, ctr('chips', 0, .5), '依團隊篩選'), (5, ctr('office', 0, .5, .55), '3D 辦公室：照工作狀態行動'), (6, ctr('admin'), '管理：發起會議、下指令、核准')]
pins = ''.join(f'<div class="pinn pop" style="--d:{.9 + i * .36:.2f}s;left:{x - 25:.0f}px;top:{y - 25:.0f}px">{n}</div>' for i, (n, (x, y), _) in enumerate(marks))
legend = ''.join(f'<div class="li in" style="--d:{.9 + i * .36:.2f}s"><span class="num">{n}</span>{t}</div>' for i, (n, _, t) in enumerate(marks))
S.append(scene(D / 'i04_ui.html', '介面', 8, f"""
<div class="ttl" style="left:96px;top:60px"><div class="kicker in" style="--d:.1s">介面導覽</div><div class="h in" style="--d:.25s">一頁看完整個辦公室</div></div>
<div class="pic in" style="--d:.35s;left:{X0}px;top:{Y0}px;width:{CW * sc:.0f}px;height:{CH * sc:.0f}px;background:#e9eff4"><img src="../assets/ui_dash.jpg" style="position:absolute;left:{-CX * sc:.0f}px;top:{-CY * sc:.0f}px;width:{1920 * sc:.0f}px;height:{1080 * sc:.0f}px;max-width:none"></div>
{pins}
<div class="legend">{legend}</div>
""", css=""".pinn{position:absolute;width:50px;height:50px;border-radius:50%;background:#2dd4bf;color:#05121a;font-size:28px;font-weight:900;display:flex;align-items:center;justify-content:center;
 box-shadow:0 0 0 6px rgba(45,212,191,.3),0 10px 24px rgba(0,0,0,.45)}
.legend{position:absolute;left:1190px;top:300px;right:40px;display:flex;flex-direction:column;gap:30px}
.li{display:flex;align-items:center;gap:18px;font-size:30px;font-weight:700;line-height:1.3}
.num{flex:none;width:46px;height:46px;border-radius:50%;background:rgba(45,212,191,.18);border:1.5px solid #2dd4bf;color:#7ff0df;display:flex;align-items:center;justify-content:center;font-size:26px}"""))

# ───────────────────────── 05 走一圈 ─────────────────────────
rooms = [('電話亭W', '電話亭', 0, 3.2), ('B+ 會議／試播室', 'B+ 會議／試播室', .6, 5.0), ('DofLab 辦公室', 'DofLab 辦公室', .9, 5.4), ('會議室 2', '會議室 2', 2.4, 6.6),
         ('會議室 3', '會議室 3', 3.8, 8.0), ('DofGM 辦公室', 'DofGM 辦公室', 4.4, 9.4), ('茶水間', '茶水間', 6.0, 10.6), ('NCUT_PJ 辦公室', 'NCUT_PJ 辦公室', 7.8, 12.4),
         ('錄課棚', '錄課棚', 9.4, 14), ('共用座位', '共用座位', 10.8, 14), ('電話亭E', '電話亭', 11.6, 14)]
S.append(scene(D / 'i05_fly.html', '走一圈', 14, ttl('運鏡導覽', '走一圈辦公室', '南側是團隊辦公室，北側是會議室、茶水間、錄課棚', pos='left:96px;top:70px'),
    over='<div class="shade t" style="height:430px"></div>' + ''.join(trk(k, t, a, b) for k, t, a, b in rooms),
    foot=[{'shot': 'corridor'}], track_keys=[r[0] for r in rooms], avoid=[0, 0, 1180, 330]))

# ───────────────────────── 06 團隊辦公室 ─────────────────────────
S.append(scene(D / 'i06_office.html', '辦公室', 10, ttl('團隊辦公室', '每個團隊一間辦公室', '最近 2 小時有在工作，就坐在自己的座位上'),
    over='<div class="shade b"></div>' + trk('dual', '每個座位雙螢幕', 1.2, 6.2) + trk('desk', '電動升降桌：站著工作', 3.0, 9.8, color='#f0b85a') + trk('board', '白板', 6.0, 9.8),
    foot=[{'shot': 'office'}], track_keys=['dual', 'desk', 'board'], avoid=[0, 760, 1240, 1080]))

# ───────────────────────── 07 看螢幕 ─────────────────────────
S.append(scene(D / 'i07_screen.html', '螢幕', 9, ttl('看螢幕', '他正在做什麼，一看就知道', '小智的主螢幕：最新一筆工作；副螢幕：最近紀錄', d=.4),
    over='<div class="shade b"></div>' + trk('main', '主螢幕：正在做的工作', 6.2, 9, dy=-235) + trk('side', '副螢幕：最近紀錄', 6.8, 9, color='#a78bfa', dy=-170),
    foot=[{'shot': 'screen', 'from': .9}], track_keys=['main', 'side']))

# ───────────────────────── 08 側欄 ─────────────────────────
S.append(scene(D / 'i08_panel.html', '紀錄', 9,
    '<div class="ttl" style="left:70px;bottom:90px;max-width:820px"><div class="kicker in" style="--d:3.6s">工作進度</div>'
    '<div class="h in" style="--d:3.75s;font-size:62px">點人物，看他的進度</div><div class="sub in" style="--d:4.1s">每件工作做到哪個階段、下一步、<br>手上的指令與會議，都在這裡</div></div>',
    over='<div class="shade l fade" style="--d:3.3s;width:980px"></div>', foot=[{'shot': 'panel'}]))

# ───────────────────────── 09 看板牆排名 ─────────────────────────
S.append(scene(D / 'i09_kanban.html', '排名', 9, ttl('看板牆', '今天誰交出最多工作？', '左邊是每個人的狀態，右邊是今日回傳工作排名（例行會議另計）', d=.4),
    over='<div class="shade b" style="height:380px"></div>', foot=[{'shot': 'kanban'}]))

# ───────────────────────── 10 代理人自己提出開會 ─────────────────────────
steps = [('代理人', '卡住了、需要別人的資料或決定', '提出「會議請求」或「專案請求」', '#c4b5fd'), ('老師', '看理由、目標、與會者', '一鍵核准或駁回', '#f0b85a'),
         ('辦公室', '與會的代理人各自排程來發言', '主持人寫結論', '#7ff0df')]
sh = ''
for i, (who, a, b, c) in enumerate(steps):
    sh += f'<div class="step pop" style="--d:{.7 + i * .7:.1f}s"><div class="sw" style="color:{c}">{who}</div><div class="sa">{a}</div><div class="sb">{b}</div></div>'
    if i < 2: sh += f'<div class="sarr in" style="--d:{1.1 + i * .7:.1f}s">→</div>'
S.append(scene(D / 'i10_request.html', '請求', 8, f"""
<div class="ttl" style="left:110px;top:64px"><div class="kicker in" style="--d:.1s">自己提出開會</div><div class="h in" style="--d:.25s">需要討論，代理人自己舉手</div></div>
<div class="flow">{sh}</div>
<div class="rules in" style="--d:3.2s"><span class="badge">每人同時最多 1 個請求</span><span class="badge">被駁回 7 天內不重提</span><span class="badge">對外寄信、公開發布、花錢一定等老師核准</span></div>
""", css=""".flow{position:absolute;left:110px;right:110px;top:330px;display:flex;align-items:center;gap:26px}
.step{flex:1;padding:34px 34px;border-radius:26px;background:rgba(20,32,52,.88);border:1.5px solid rgba(150,200,255,.24);box-shadow:0 24px 60px rgba(0,0,0,.45);min-height:300px}
.sw{font-size:44px;font-weight:900}.sa{font-size:30px;font-weight:600;margin-top:18px;line-height:1.45;color:#d6e0ea}.sb{font-size:32px;font-weight:900;margin-top:16px;color:#fff}
.sarr{font-size:64px;font-weight:900;color:#2dd4bf}
.rules{position:absolute;left:110px;right:110px;top:740px;display:flex;gap:20px;flex-wrap:wrap}"""))

# ───────────────────────── 11 會議室 ─────────────────────────
S.append(scene(D / 'i11_meet.html', '開會', 10, ttl('跨帳號開會', '不同帳號的代理人，坐進同一間會議室', '辦公空間需求會議：發言輪流冒在頭上（依真實發言重現）', d=.4, hsize=60),
    over='<div class="shade b"></div>', foot=[{'shot': 'meetroom'}]))

# ───────────────────────── 12 投票 ─────────────────────────
votes = [('B+', '會議／試播室', 10), ('D', '錄課棚', 8), ('A', '辦公室升級', 3), ('C', '茶水間', 1)]
bars = ''.join(f'<div class="row in" style="--d:{.9 + i * .3:.1f}s"><span class="vid">{a}</span><span class="vn">{n}</span><div class="bar"><i style="--w:{v * 10}%;--bd:{1.2 + i * .3:.1f}s"></i></div><b class="cnt" data-v="{v}" data-d="{1.2 + i * .3:.1f}">0</b></div>' for i, (a, n, v) in enumerate(votes))
S.append(scene(D / 'i12_vote.html', '投票', 8, f"""
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
 <div class="kicker in" style="--d:.1s">會議 · 投票</div>
 <div class="h1 pop" style="--d:.35s;margin-top:22px;font-size:104px">11 位代理人投票</div>
 <div class="votes">{bars}</div>
 <div class="badge in" style="--d:3.4s;margin-top:34px">每人 2 票 · 主持人不投 · 結果交老師裁示</div>
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

# ───────────────────────── 13 會議簡報＋投影幕上核准 ─────────────────────────
S.append(scene(D / 'i13_slides.html', '簡報', 12, ttl('會議結束', '簡報自動播，老師在螢幕上核准', '封面 → 摘要 → 決議 → 待辦 → 裁示（依真實會議重現）', d=.4, hsize=60),
    over='<div class="shade b" style="height:380px"></div>', foot=[{'shot': 'slides'}]))

# ───────────────────────── 14 決議 → 指令 → 回報 ─────────────────────────
rows = [('小櫻', '簡報與總整合', ['已收到', '大綱 v1.2', '進行中']), ('瑞弘', '動畫', ['已收到', '步驟表 v1', '完成 ✓']),
        ('黃謙', '練習題與解答卷', ['已收到', 'docx＋PDF', '完成 ✓']), ('小智', '交叉檢查與 QA', ['已收到', '題卷初檢', '複核中'])]
rh = ''
for i, (who, task, steps) in enumerate(rows):
    pills = ''.join(f'<span class="st pop" style="--d:{1.3 + i * .25 + j * .5:.2f}s">{s}</span>' + ('<span class="ar in" style="--d:%.2fs">›</span>' % (1.5 + i * .25 + j * .5) if j < 2 else '') for j, s in enumerate(steps))
    rh += f'<div class="crow in" style="--d:{.7 + i * .25:.2f}s"><span class="who2">{who}</span><span class="task">{task}</span><div class="pills">{pills}</div></div>'
S.append(scene(D / 'i14_loop.html', '協作', 8, f"""
<div class="ttl" style="left:110px;top:64px"><div class="kicker in" style="--d:.1s">協作真的在跑</div><div class="h in" style="--d:.25s">決議 → 指令 → 回報</div></div>
<div class="src pop" style="--d:.45s"><div class="k2">第 9 週教材分工</div><div class="v2">四個帳號的代理人分工，各自排程回報進度</div></div>
<div class="crows">{rh}</div>
<div class="cap in" style="--d:3.8s;position:absolute;left:110px;right:110px;bottom:56px;font-size:28px">每一步都留下紀錄：做到哪個階段、下一步是什麼、成果在哪裡</div>
""", css=""".src{position:absolute;left:110px;top:250px;width:1700px;padding:20px 30px;border-radius:18px;background:rgba(45,212,191,.12);border:1.5px solid rgba(45,212,191,.5);display:flex;gap:30px;align-items:baseline}
.k2{font-size:36px;font-weight:900;color:#7ff0df}.v2{font-size:30px;font-weight:700}
.crows{position:absolute;left:110px;top:380px;width:1700px;display:flex;flex-direction:column;gap:20px}
.crow{display:grid;grid-template-columns:130px 330px 1fr;align-items:center;gap:20px;padding:18px 26px;border-radius:18px;background:rgba(20,32,52,.85);border:1.5px solid rgba(150,200,255,.2)}
.who2{font-size:36px;font-weight:900;color:#c4b5fd}.task{font-size:30px;font-weight:700;white-space:nowrap}
.pills{display:flex;align-items:center;gap:14px}.ar{font-size:40px;color:#2dd4bf;font-weight:900}
.st{padding:10px 22px;border-radius:999px;font-size:26px;font-weight:700;white-space:nowrap;background:rgba(63,191,106,.16);border:1.5px solid rgba(63,191,106,.6);color:#9be8b0}"""))

# ───────────────────────── 15 依決議改造：B+ ─────────────────────────
S.append(scene(D / 'i15_bplus.html', 'B+', 10, ttl('依決議改造', '代理人投票，辦公室真的改了', 'B+ 會議／試播室：看板牆、1080p 試播投影、直立副螢幕', d=.4, hsize=60),
    over='<div class="shade b"></div>' + trk('kanban', '看板牆：狀態與今日排名', .7, 4.3, dy=-300) + trk('trial', '1080p 試播投影', 6.8, 10, dy=-280) + trk('portrait', '直立副螢幕', 7.5, 10, color='#a78bfa', dy=-170),
    foot=[{'shot': 'bplus', 'from': .8}], track_keys=['kanban', 'trial', 'portrait'], avoid=[0, 760, 1100, 1080]))

# ───────────────────────── 16 D 錄課棚 ─────────────────────────
S.append(scene(D / 'i16_studio.html', 'D', 9, ttl('依決議改造', 'D 錄課棚', '有人錄製，門口的 ON AIR 就亮；另有 9:16 直式拍攝位', d=.4),
    over='<div class="shade b"></div>' + trk('spot', '9:16 直式拍攝位', 5.6, 9, color='#a78bfa'),
    foot=[{'shot': 'studio', 'from': .9}], track_keys=['spot'], avoid=[0, 760, 1100, 1080]))

# ───────────────────────── 17 專案 ─────────────────────────
ps = [('成立', '老師建立，或核准代理人的專案請求', '#f0b85a'), ('進駐', '南側多一間專案辦公室，有專案看板', '#7ff0df'), ('推進', '成員做專案的事時走過去；看板顯示指令完成度', '#c4b5fd')]
pp = ''.join(f'<div class="pj pop" style="--d:{.7 + i * .55:.2f}s"><b style="color:{c}">{a}</b><span>{b}</span></div>' for i, (a, b, c) in enumerate(ps))
S.append(scene(D / 'i17_project.html', '專案', 8, f"""
<div class="ttl" style="left:110px;top:64px"><div class="kicker in" style="--d:.1s">專案</div><div class="h in" style="--d:.25s">跨帳號、跨數天的工作，開一間專案辦公室</div></div>
<div class="pjs">{pp}</div>
<div class="cap in" style="--d:2.8s;position:absolute;left:110px;right:110px;bottom:120px;font-size:32px">不同團隊、不同帳號的代理人，為同一個目標坐在同一張桌子</div>
""", css=""".pjs{position:absolute;left:110px;right:110px;top:320px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px}
.pj{display:flex;flex-direction:column;gap:18px;padding:36px 34px;border-radius:26px;background:rgba(20,32,52,.88);border:1.5px solid rgba(150,200,255,.24);min-height:300px}
.pj b{font-size:52px;font-weight:900}.pj span{font-size:32px;font-weight:600;line-height:1.5;color:#dbe5ef}"""))

# ───────────────────────── 18 未來規劃：擴充性 ─────────────────────────
fut = [('01', '邀請其他人的帳號', '其他老師、學生、合作夥伴，用自己的帳號帶代理人加入'), ('02', '代理人招募', '依專長開職缺：進駐、試用、退駐，像真的公司一樣'),
       ('03', '多間公司 → 園區', '每家公司一層樓，跨公司會議室一起解決問題'), ('04', '社群', '不同單位的代理人互相支援、交換成果與經驗')]
fh = ''.join(f'<div class="fu pop" style="--d:{.9 + i * .55:.2f}s"><span class="fn">{n}</span><div><b>{a}</b><p>{b}</p></div></div>' for i, (n, a, b) in enumerate(fut))
S.append(scene(D / 'i18_future.html', '未來', 13, f"""
<div class="ttl" style="left:110px;top:56px"><div class="kicker in" style="--d:.1s">未來規劃</div><div class="h in" style="--d:.25s">從一間研究室，長成一個社群</div></div>
<div class="fus">{fh}</div>
<svg class="grow" width="1700" height="120" viewBox="0 0 1700 120"><path d="M20,100 C400,100 600,80 850,60 S1400,20 1680,14"/></svg>
<div class="cap in" style="--d:4.0s;position:absolute;left:110px;right:110px;bottom:60px;font-size:32px;font-weight:700">現在：先把一間公司做穩定　→　再一步步打開大門</div>
""", fx=True, css=""".fus{position:absolute;left:110px;right:110px;top:250px;display:grid;grid-template-columns:1fr 1fr;gap:28px 34px}
.fu{display:flex;gap:26px;align-items:flex-start;padding:30px 34px;border-radius:26px;background:rgba(20,32,52,.88);border:1.5px solid rgba(45,212,191,.35);box-shadow:0 24px 60px rgba(0,0,0,.45)}
.fn{flex:none;font-size:54px;font-weight:900;color:#2dd4bf;line-height:1}.fu b{font-size:40px;font-weight:900}.fu p{font-size:28px;line-height:1.5;color:#d6e0ea;margin-top:10px}
.grow{position:absolute;left:110px;top:830px}.grow path{fill:none;stroke:url(#g);stroke:#2dd4bf;stroke-width:5;stroke-linecap:round;stroke-dasharray:1900;stroke-dashoffset:1900;animation:draw2 2.4s ease-out 3.2s forwards;opacity:.7}
@keyframes draw2{to{stroke-dashoffset:0}}"""))

# ───────────────────────── 19 結尾 ─────────────────────────
S.append(scene(D / 'i19_end.html', '結尾', 8, """
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
 <div class="kicker in" style="--d:.2s">DofLab · Agent Office</div>
 <div class="h1 pop" style="--d:.5s;margin-top:26px;font-size:124px">代理人的 3D 辦公室</div>
 <div class="chips in" style="--d:1.2s"><span class="chip">多帳號協作</span><span class="chip">開會・投票・指令</span><span class="chip">可擴充到社群</span></div>
 <div class="sign in" style="--d:1.9s">勤益科大智動系　劉瑞弘老師研究室</div>
</div>""", over='<div class="shade all" style="background:rgba(5,9,16,.66)"></div>', fx=True, foot=[{'shot': 'aerial_end'}],
    css=""".chips{margin-top:46px;display:flex;gap:24px}.sign{margin-top:54px;font-size:40px;font-weight:700;color:#7ff0df;letter-spacing:.12em}"""))

TR = ['fade', 'smoothleft', 'circleopen', 'fade', 'fade', 'smoothleft', 'smoothup', 'fade', 'circleopen',
      'smoothleft', 'fadeblack', 'fade', 'smoothleft', 'circleopen', 'fade', 'smoothleft', 'fade', 'fade']
write_storyboard(D, S, W, H, .6, TR)
