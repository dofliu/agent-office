"""產生導覽影片的場景 HTML、storyboard.json 與 assets/*.jpg（從 raw/ 的截圖裁切）。

場景模板來自 intro-video 技能：設環境變數 INTRO_VIDEO_SKILL 指向技能資料夾。
raw/ 不在 repo 裡（截圖原檔太大）；沒有 raw/ 時只重產場景與 storyboard，沿用現有 assets/。
"""
import json, re, os
from pathlib import Path
from PIL import Image

SKILL = Path(os.environ.get('INTRO_VIDEO_SKILL', '~/.claude/skills/intro-video')).expanduser()
P = Path(__file__).resolve().parent
RAW, AS = P / 'raw', P / 'assets'
AS.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- assets
def jpg(src, name, box=None, width=None, q=88):
    im = Image.open(RAW / src).convert('RGB')
    if box: im = im.crop(box)
    if width and im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(AS / f'{name}.jpg', quality=q, optimize=True)
    return im.size

def content_height(src):   # trim white space at the bottom of tall drawer captures
    im = Image.open(RAW / src).convert('L'); w, h = im.size; px = im.load()
    for y in range(h - 1, 0, -8):
        if any(px[x, y] < 235 for x in range(20, w - 20, 6)): return min(h, y + 40)
    return h

sizes = {}
HAVE_RAW = RAW.is_dir()
for src, name in [] if not HAVE_RAW else [('floor.png', 'floor'), ('old_floor.png', 'old'), ('dash_full.png', 'dash'), ('room_doflab.png', 'doflab'),
                  ('room_dofgm.png', 'dofgm'), ('room_ncutpj.png', 'ncutpj'), ('room_shared.png', 'shared'), ('room_meet.png', 'meet'),
                  ('room_pantry.png', 'pantry'), ('onair.png', 'onair'), ('booth_w.png', 'booth'), ('desks_stand.png', 'desks'),
                  ('kanban.png', 'kanban'), ('trial.png', 'trial'), ('projector.png', 'projector'), ('studio_close.png', 'studio')]:
    sizes[name] = jpg(src, name)
if HAVE_RAW:
  sizes['menu_person'] = jpg('menu_person.png', 'menu_person', box=(60, 200, 900, 860))
  sizes['menu_device'] = jpg('menu_device.png', 'menu_device', box=(600, 0, 1560, 560))
  sizes['meeting'] = jpg('x2_meeting_safe.png', 'meeting', width=640, q=86)
  sizes['agenda'] = jpg('x2_meeting_safe.png', 'agenda', box=(0, 0, 998, 1420), width=620)
  sizes['minutes'] = jpg('x2_meeting_safe.png', 'minutes', box=(0, 860, 998, 1560), width=640)
  sizes['plan'] = jpg('x2_plan.png', 'plan', box=(0, 0, 1000, min(3000, content_height('x2_plan.png'))), width=560)
if not HAVE_RAW:   # 沒有截圖原檔：沿用 repo 裡的 assets/，版位依圖片實際尺寸
  sizes = {f.stem: Image.open(f).size for f in sorted(AS.glob('*.jpg'))}
print('assets', json.dumps(sizes) if HAVE_RAW else '沒有 raw/，沿用現有 assets/')

# ---------------------------------------------------------------- template
T = (SKILL / 'assets' / 'scene_template.html').read_text(encoding='utf-8')
T = T.replace('font-family:"Noto Sans CJK TC",', 'font-family:"Noto Sans CJK TC","WenQuanYi Zen Hei",')
HEAD, rest = T.split('/* ▼▼ 本景專屬 CSS 寫在這 ▼▼ */')
MID = rest.split('/* ▲▲ 本景專屬 CSS 到此 ▲▲ */')[1]
FX = re.search(r'<!-- 粒子層.*?</script>\n', MID, re.S).group(0)

COMMON_CSS = """
.title{position:absolute;left:110px;top:70px;display:flex;flex-direction:column;gap:14px}
.title .kicker{text-indent:0;letter-spacing:.42em;font-size:26px}
.title .h{font-size:74px;font-weight:900;line-height:1.1;background:linear-gradient(100deg,#f4f8ff 20%,#9be8db 55%,#c4b5fd 90%);-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap}
.cap{font-size:30px;color:rgba(232,238,247,.82);line-height:1.5}
.tag{display:inline-flex;align-items:center;gap:12px;padding:12px 24px;border-radius:999px;font-size:28px;font-weight:700;white-space:nowrap;
 background:rgba(10,18,32,.86);border:1.5px solid rgba(150,200,255,.28);box-shadow:0 12px 30px rgba(0,0,0,.45)}
.dot{width:16px;height:16px;border-radius:50%;flex:none}
.pic{position:absolute;border-radius:22px;overflow:hidden;background:#0b1220;border:1.5px solid rgba(150,200,255,.24);box-shadow:0 34px 90px rgba(0,0,0,.6)}
.pic img{display:block;width:100%;height:100%;object-fit:cover}
.lbl{position:absolute;left:18px;bottom:16px}
"""

def scene(name, dur, body, css='', fx=False, title=''):
    mid = MID if fx else MID.replace(FX, '')
    mid = mid.replace('--dur:7s', f'--dur:{dur}s')
    stage_open = '<div class="stage" style="z-index:2">'
    pre, post = mid.split(stage_open)
    post = post.split('<!-- ▲▲ 本景內容到此 ▲▲ -->')[1]
    html = HEAD.replace('<title>SceneXX 標題</title>', f'<title>{title or name}</title>') + COMMON_CSS + css + \
        '/* ▲▲ 本景專屬 CSS 到此 ▲▲ */' + pre + f'<div class="stage" style="z-index:2;--dur:{dur}s">\n' + body + '\n' + post
    # hero backgrounds / absolute layouts sit inside .stage; nothing else to patch
    (P / f'{name}.html').write_text(html, encoding='utf-8')
    return {'file': f'{name}.html', 'duration': dur}

TEAM = {'DofLab': '#1f9ab8', 'DofGM': '#d0892a', 'NCUT_PJ': '#d0574b', 'Pro': '#8a66d6'}
def chip(text, color, d, cls='pop', extra=''):
    return f'<span class="tag {cls}" style="--d:{d}s;{extra}"><i class="dot" style="background:{color}"></i>{text}</span>'

S = []
# 01 ── open
S.append(scene('s01_open', 7, f"""
<div class="hero-img"><img src="assets/floor.jpg"></div><div class="scrim"></div>
<div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center">
 <div class="kicker in" style="--d:.15s">DofLab · Agent Office</div>
 <div class="h1 pop" style="--d:.5s;margin-top:34px;font-size:136px">代理人的 3D 辦公室</div>
 <div class="sub in" style="--d:1.3s;margin-top:40px">12 位 Claude 代理人，在同一層樓開會、分工、改造辦公室</div>
</div>""", fx=True, title='開場'))

# 02 ── problem → shared space
cols = [('DofLab', ['小櫻', '佐助', '鹿丸', '鼬', '水門']), ('DofGM', ['雛田', '卡卡西', '綱手', '我愛羅', '大蛇丸']), ('NCUT_PJ', ['自來也']), ('Pro', ['鳴人'])]
colhtml, d = '', .5
for i, (team, names) in enumerate(cols):
    items = ''.join(chip(n, TEAM[team], round(d + j * .12, 2)) for j, n in enumerate(names)); d += .35
    colhtml += f'<div class="col" style="left:{170 + i * 410}px"><div class="th in" style="--d:{round(d - .4, 2)}s;color:{TEAM[team]}">{team}</div>{items}</div>'
S.append(scene('s02_problem', 8, f"""
<div class="title"><div class="kicker in" style="--d:.1s">問題</div><div class="h in" style="--d:.25s">彼此看不到的 12 位代理人</div></div>
{colhtml}
<svg class="wires" width="1920" height="1080">{''.join(f'<path d="M{340 + i * 410},{690 if i < 2 else 400} C{340 + i * 410},770 960,700 960,790"/>' for i in range(4))}</svg>
<div class="hub pop" style="--d:3.6s">
 <div class="hub-h"><svg width="56" height="48" viewBox="0 0 56 48"><path d="M4 8h18l6 6h24v30H4z" fill="#2dd4bf" opacity=".9"/></svg>Google Drive 共用資料夾</div>
 <div class="hub-r"><span class="badge">工作紀錄</span><span class="badge">會議室</span><span class="badge">指令</span></div>
</div>
<div class="cap in" style="--d:4.6s;position:absolute;left:0;right:0;bottom:44px;text-align:center">5 個帳號、4 個 TEAM 各自排程　→　唯一的共同空間：只新增、不修改的 JSON 檔</div>
""", css="""
.col{position:absolute;top:250px;width:360px;display:flex;flex-direction:column;align-items:flex-start;gap:14px}
.th{font-size:34px;font-weight:900;letter-spacing:.08em;margin-bottom:6px}
.wires{position:absolute;left:0;top:0;z-index:0}
.wires path{fill:none;stroke:rgba(45,212,191,.55);stroke-width:3;stroke-dasharray:900;stroke-dashoffset:900;animation:draw 1.4s ease-out 2.4s forwards}
@keyframes draw{to{stroke-dashoffset:0}}
.hub{position:absolute;left:560px;width:800px;top:790px;padding:28px 36px;border-radius:26px;display:flex;flex-direction:column;align-items:center;gap:20px;
 background:linear-gradient(165deg,rgba(24,38,62,.95),rgba(12,20,36,.96));border:1.5px solid rgba(45,212,191,.45);box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 60px rgba(45,212,191,.18)}
.hub-h{display:flex;align-items:center;gap:20px;font-size:40px;font-weight:900}
.hub-r{display:flex;gap:20px}
""", title='問題'))

# 03 ── interface tour on the real dashboard
cx0, cy0, sc = 300, 20, .80   # crop origin in the screenshot, display scale
marks = [(1, 1150, 58, '即時同步：每 5 分鐘讀一次雲端'), (2, 470, 135, '統計：組數、紀錄、今日新增'), (3, 895, 122, '辦公室／圓框兩種檢視'),
         (4, 1040, 124, '會議頁與規劃頁'), (5, 1360, 162, '依 TEAM 篩選'), (6, 960, 600, '3D 辦公室：人物依紀錄行動'), (7, 1560, 58, '管理模式：發起會議、下指令')]
pins = ''.join(f'<div class="pin pop" style="--d:{.9 + i * .38:.2f}s;left:{(x - cx0) * sc - 26:.0f}px;top:{(y - cy0) * sc - 26:.0f}px">{n}</div>' for i, (n, x, y, _) in enumerate(marks))
legend = ''.join(f'<div class="li in" style="--d:{.9 + i * .38:.2f}s"><span class="num">{n}</span>{t}</div>' for i, (n, _, _, t) in enumerate(marks))
S.append(scene('s03_ui', 8, f"""
<div class="title" style="top:56px"><div class="kicker in" style="--d:.1s">介面導覽</div><div class="h in" style="--d:.25s">整個介面，一頁看完</div></div>
<div class="scr in" style="--d:.35s"><div class="crop"><img src="assets/dash.jpg">{pins}</div></div>
<div class="legend">{legend}</div>
""", css=f"""
.scr{{position:absolute;left:90px;top:226px;width:{1320 * sc:.0f}px;height:{1010 * sc:.0f}px;border-radius:22px;overflow:hidden;border:1.5px solid rgba(150,200,255,.25);box-shadow:0 34px 90px rgba(0,0,0,.6);background:#e9eff4}}
.crop{{position:absolute;left:0;top:0;width:{1320 * sc:.0f}px;height:{1010 * sc:.0f}px}}
.crop img{{position:absolute;left:{-cx0 * sc:.0f}px;top:{-cy0 * sc:.0f}px;width:{1920 * sc:.0f}px;height:{1080 * sc:.0f}px}}
.pin{{position:absolute;width:52px;height:52px;border-radius:50%;background:#2dd4bf;color:#05121a;font-size:30px;font-weight:900;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 6px rgba(45,212,191,.28),0 10px 24px rgba(0,0,0,.4)}}
.legend{{position:absolute;left:1200px;top:250px;right:60px;display:flex;flex-direction:column;gap:22px}}
.li{{display:flex;align-items:center;gap:18px;font-size:29px;font-weight:700;line-height:1.3}}
.num{{flex:none;width:46px;height:46px;border-radius:50%;background:rgba(45,212,191,.18);border:1.5px solid #2dd4bf;color:#7ff0df;display:flex;align-items:center;justify-content:center;font-size:26px}}
""", title='介面'))

# 04 ── team offices
grid = [('doflab', 'DofLab · 5 人'), ('dofgm', 'DofGM · 5 人'), ('ncutpj', 'NCUT_PJ · 自來也'), ('shared', 'Pro 鳴人 → 共用座位')]
cells = ''.join(f'<div class="pic pop" style="--d:{.4 + i * .3:.1f}s;left:{200 + (i % 2) * 780}px;top:{206 + (i // 2) * 410}px;width:700px;height:394px"><img src="assets/{n}.jpg"><div class="lbl">{chip(t, list(TEAM.values())[i], 0, cls="")}</div></div>' for i, (n, t) in enumerate(grid))
S.append(scene('s04_offices', 8, f"""
<div class="title" style="top:40px"><div class="kicker in" style="--d:.1s">團隊辦公室</div><div class="h in" style="--d:.25s">每個 TEAM 一間辦公室</div></div>
<div class="cap in" style="--d:.6s;position:absolute;left:1060px;top:52px;width:760px;font-size:28px">暱稱＋專屬 3D 外觀（小櫻、卡卡西、鳴人…）<br>email 與 TEAM 只在側欄顯示</div>
{cells}""", title='辦公室'))

# 04b ── shared rooms: pantry + meeting-room projector
S.append(scene('s04b_common', 7, f"""
<div class="title"><div class="kicker in" style="--d:.1s">公共空間</div><div class="h in" style="--d:.25s">茶水間與會議室</div></div>
<div class="pic pop" style="--d:.4s;left:110px;top:250px;width:1000px;height:563px"><img src="assets/pantry.jpg"><div class="lbl">{chip('茶水間：咖啡機・微波爐・冰箱・販賣機・水槽', '#88a7dc', 0, cls='')}</div></div>
<div class="pic pop" style="--d:.9s;left:1150px;top:250px;width:660px;height:371px"><img src="assets/projector.jpg"><div class="lbl">{chip('會議室投影幕：上一場結論', '#efab48', 0, cls='')}</div></div>
<div class="cap in" style="--d:1.5s;position:absolute;left:1150px;top:650px;width:660px;font-size:28px">休息中的代理人會走去茶水間用設備；開會時大家到會議室就座，頭上輪流冒出發言泡泡。</div>
<div class="row3">{chip('休息 → 茶水間', '#88a7dc', 2.2)}{chip('開會 → 會議室', '#efab48', 2.4)}{chip('點投影幕 → 打開會議', '#2dd4bf', 2.6)}</div>
""", css=""".row3{position:absolute;left:110px;top:868px;display:flex;gap:18px}""", title='公共空間'))

# 05 ── states + interaction
states =[('工作中', '#3fbf6a'), ('開會', '#efab48'), ('通話', '#e48ac4'), ('報告', '#a68cf4'), ('錄製', '#f0857a'), ('巡檢', '#3fc1d7'), ('休息', '#88a7dc'), ('閒置', '#8a96a3')]
st = ''.join(chip(t, c, round(2.2 + i * .14, 2)) for i, (t, c) in enumerate(states))
S.append(scene('s05_interact', 8, f"""
<div class="title"><div class="kicker in" style="--d:.1s">狀態與互動</div><div class="h in" style="--d:.25s">點一下，代理人就動</div></div>
<div class="pic pop" style="--d:.45s;left:110px;top:250px;width:860px;height:676px"><img src="assets/menu_person.jpg"><div class="lbl">{chip('點人物：打招呼、去茶水間、站著工作…', '#2dd4bf', 0, cls='')}</div></div>
<div class="pic pop" style="--d:.9s;left:1010px;top:250px;width:800px;height:467px"><img src="assets/menu_device.jpg"><div class="lbl">{chip('點設備：沖一杯咖啡、叫人來用', '#2dd4bf', 0, cls='')}</div></div>
<div class="states">{st}</div>
<div class="cap in" style="--d:3.6s;position:absolute;left:1010px;top:948px;width:820px;font-size:26px">人物依最新紀錄自動判斷狀態；互動只在畫面播放，不寫入雲端</div>
""", css=""".states{position:absolute;left:1010px;top:748px;width:820px;display:flex;flex-wrap:wrap;gap:14px}
.states .tag{font-size:26px;padding:10px 20px}""", title='互動'))

# 06 ── meeting called
facts = [('主題', '辦公室、會議室、茶水間、其他空間的需求'), ('主持', '綱手（DofGM）'), ('與會', '12 位代理人，跨 4 個 TEAM'), ('期限', '2 小時，各自每小時排程來發言'), ('目標', '提出需求 → 投票 → 決議交給老闆')]
fh = ''.join(f'<div class="fact in" style="--d:{.9 + i * .35:.2f}s"><span class="k">{k}</span><span class="v">{v}</span></div>' for i, (k, v) in enumerate(facts))
S.append(scene('s06_call', 8, f"""
<div class="title"><div class="kicker in" style="--d:.1s">會議 · 01 發起</div><div class="h in" style="--d:.25s">老師發起一場會議</div></div>
<div class="pic in" style="--d:.5s;left:120px;top:236px;width:{sizes['agenda'][0]}px;height:{min(sizes['agenda'][1], 780)}px"><img src="assets/agenda.jpg" style="object-fit:cover;object-position:top"></div>
<div class="facts">{fh}</div>""", css=""".facts{position:absolute;left:860px;top:300px;right:100px;display:flex;flex-direction:column;gap:26px}
.fact{display:flex;gap:26px;align-items:baseline;padding:22px 30px;border-radius:20px;background:rgba(20,32,52,.82);border:1.5px solid rgba(150,200,255,.2)}
.fact .k{flex:none;font-size:28px;font-weight:900;color:#2dd4bf;letter-spacing:.2em}.fact .v{font-size:34px;font-weight:700}""", title='發起會議'))

# 07 ── discussion (scrolling the real transcript)
props = [('A', '辦公室升級', '小櫻'), ('B', '會議室', '小櫻'), ('D', '錄課棚', '小櫻'), ('E', '檢核工作站', '水門'), ('F', '教材整合區', '佐助'),
         ('B+', '合併成會議／試播室', '雛田'), ('G', '專注區', '鳴人'), ('H', 'GPU 模擬運算站', '自來也'), ('I', '文件輸出站', '鼬')]
ph = ''.join(f'<div class="prop pop" style="--d:{.8 + i * .55:.2f}s"><span class="pid">{a}</span><span class="pn">{n}</span><span class="who">{w}</span></div>' for i, (a, n, w) in enumerate(props))
mh = sizes['meeting'][1]
S.append(scene('s07_discuss', 9, f"""
<div class="title"><div class="kicker in" style="--d:.1s">會議 · 02 討論</div><div class="h in" style="--d:.25s">18 則發言，9 個提案</div></div>
<div class="phone in" style="--d:.3s"><img src="assets/meeting.jpg"></div>
<div class="props">{ph}</div>
""", css=f""".phone{{position:absolute;left:120px;top:232px;width:640px;height:800px;border-radius:24px;overflow:hidden;background:#fff;border:1.5px solid rgba(150,200,255,.3);box-shadow:0 34px 90px rgba(0,0,0,.6)}}
.phone img{{position:absolute;left:0;top:0;width:640px;height:{mh}px;animation:scroll 8.2s cubic-bezier(.45,0,.55,1) .6s both}}
@keyframes scroll{{from{{transform:translateY(-480px)}}to{{transform:translateY(-{mh - 820}px)}}}}
.props{{position:absolute;left:830px;top:244px;right:90px;display:grid;grid-template-columns:1fr;gap:12px}}
.prop{{display:flex;align-items:center;gap:22px;padding:9px 24px;border-radius:18px;background:rgba(20,32,52,.85);border:1.5px solid rgba(150,200,255,.2)}}
.pid{{flex:none;min-width:70px;text-align:center;font-size:28px;font-weight:900;color:#05121a;background:#2dd4bf;border-radius:12px;padding:4px 10px}}
.pn{{font-size:29px;font-weight:700;flex:1;white-space:nowrap}}.who{{font-size:26px;color:#c4b5fd;white-space:nowrap}}""", title='討論'))

# 08 ── vote (the one dramatic scene)
votes = [('B+', '會議／試播室', 10), ('D', '錄課棚', 8), ('A', '辦公室升級', 3), ('C', '茶水間', 1)]
bars = ''.join(f'<div class="row in" style="--d:{.9 + i * .3:.1f}s"><span class="vid">{a}</span><span class="vn">{n}</span><div class="bar"><i style="--w:{v * 10}%;--bd:{1.2 + i * .3:.1f}s"></i></div><b class="cnt" data-v="{v}" data-d="{1.2 + i * .3:.1f}">0</b></div>' for i, (a, n, v) in enumerate(votes))
S.append(scene('s08_vote', 8, f"""
<div style="position:relative;z-index:2;width:1500px;display:flex;flex-direction:column;align-items:center">
 <div class="kicker in" style="--d:.1s">會議 · 03 投票</div>
 <div class="h1 pop" style="--d:.35s;margin-top:22px;font-size:104px">11 位代理人投票</div>
 <div class="votes">{bars}</div>
 <div class="badge in" style="--d:3.4s;margin-top:34px">每人 2 票 · 主持人未投</div>
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
@keyframes shake{0%,100%{transform:none}25%{transform:translateX(-6px) rotate(-2deg)}75%{transform:translateX(6px) rotate(2deg)}}""", title='投票'))

# 09 ── minutes → approval
S.append(scene('s09_decide', 8, f"""
<div class="title"><div class="kicker in" style="--d:.1s">會議 · 04 結論</div><div class="h in" style="--d:.25s">結論交給老闆裁示</div></div>
<div class="pic in" style="--d:.4s;left:120px;top:250px;width:{sizes['minutes'][0]}px;height:{sizes['minutes'][1]}px"><img src="assets/minutes.jpg"></div>
<div class="cap in" style="--d:1s;position:absolute;left:120px;top:{262 + sizes['minutes'][1]}px;width:640px">主持人綱手寫下結論，系統把待辦變成指令</div>
<div class="arrow in" style="--d:1.6s">→</div>
<div class="pic in" style="--d:1.9s;left:1000px;top:200px;width:{sizes['plan'][0]}px;height:820px"><img src="assets/plan.jpg" style="object-fit:cover;object-position:top"></div>
<div class="stamp pop" style="--d:3.4s">核准 A・B+・D</div>
""", css=""".arrow{position:absolute;left:820px;top:520px;font-size:120px;font-weight:900;color:#2dd4bf}
.stamp{position:absolute;left:1340px;top:700px;padding:22px 40px;border:6px solid #3fbf6a;border-radius:18px;color:#3fbf6a;font-size:52px;font-weight:900;white-space:nowrap;
 background:rgba(5,12,10,.82);transform:rotate(-8deg);box-shadow:0 20px 50px rgba(0,0,0,.5)}
.stamp.pop{animation:stamp .7s cubic-bezier(.2,1.4,.35,1) var(--d) both}
@keyframes stamp{from{opacity:0;transform:rotate(-8deg) scale(2.2)}to{opacity:1;transform:rotate(-8deg) scale(1)}}""", title='裁示'))

# 10 ── before / after
k, ox, oy = 1600 / 1920, 160, 132
def at(x, y): return f'left:{ox + x * k:.0f}px;top:{oy + y * k:.0f}px'
calls = [(352, 396, 'B+ 會議／試播室'), (1187, 345, 'D 錄課棚'), (70, 535, '電話亭'), (1808, 425, '電話亭'), (1036, 799, '雙螢幕＋升降桌')]
ch = ''.join(f'<div class="callout pop" style="--d:{5.0 + i * .25:.2f}s;{at(x, y)}"><span class="tag">{t}</span></div>' for i, (x, y, t) in enumerate(calls))
S.append(scene('s10_beforeafter', 9, f"""
<div class="title" style="top:44px;left:160px"><div class="h in" style="--d:.1s;font-size:58px">依決議改造的辦公室</div></div>
<div class="ba"><img class="old" src="assets/old.jpg"><img class="new" src="assets/floor.jpg"><div class="split"></div>
 <span class="tag side l">改造前</span><span class="tag side r">改造後</span></div>
{ch}""", css=f""".ba{{position:absolute;left:{ox}px;top:{oy}px;width:1600px;height:900px;border-radius:22px;overflow:hidden;border:1.5px solid rgba(150,200,255,.25);box-shadow:0 34px 90px rgba(0,0,0,.6)}}
.ba img{{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}}
.ba .new{{clip-path:inset(0 100% 0 0);animation:wipe 3s cubic-bezier(.65,0,.35,1) 1.3s forwards}}
@keyframes wipe{{to{{clip-path:inset(0 0 0 0)}}}}
.split{{position:absolute;top:0;bottom:0;left:0;width:6px;margin-left:-3px;background:#2dd4bf;box-shadow:0 0 30px #2dd4bf;animation:move 3s cubic-bezier(.65,0,.35,1) 1.3s forwards,fade .5s ease 4.3s forwards}}
@keyframes move{{to{{left:100%}}}}@keyframes fade{{to{{opacity:0}}}}
.side{{position:absolute;top:24px}}.side.l{{left:24px}}.side.r{{right:24px;opacity:0;animation:show .4s ease 4.2s forwards}}@keyframes show{{to{{opacity:1}}}}
.callout{{position:absolute;margin-left:-110px;margin-top:-30px}}
.callout .tag{{font-size:26px;padding:10px 20px;border-color:#2dd4bf;color:#9ff5e7}}""", title='前後'))

# 11 ── B+ room
S.append(scene('s11_bplus', 8, f"""
<div class="title"><div class="kicker in" style="--d:.1s">改造 · B+</div><div class="h in" style="--d:.25s">B+ 會議／試播室</div></div>
<div class="pic pop" style="--d:.4s;left:110px;top:250px;width:1100px;height:619px"><img src="assets/meet.jpg"></div>
<div class="pic pop" style="--d:1.2s;left:1250px;top:250px;width:560px;height:315px"><img src="assets/kanban.jpg"><div class="lbl">{chip('看板牆：即時狀態', '#2dd4bf', 0, cls='')}</div></div>
<div class="pic pop" style="--d:1.8s;left:1250px;top:590px;width:560px;height:315px"><img src="assets/trial.jpg"><div class="lbl">{chip('1080p 試播＋直立副螢幕', '#2dd4bf', 0, cls='')}</div></div>
<div class="row3">{chip('8 人座', '#a78bfa', 2.6)}{chip('觸控大螢幕', '#a78bfa', 2.8)}{chip('E 檢核＋F 整合併入', '#a78bfa', 3.0)}</div>
""", css=""".row3{position:absolute;left:110px;top:900px;display:flex;gap:18px}""", title='B+'))

# 12 ── D studio + A upgrade
trip = [('onair', 'D 錄課棚：收音・9:16・ON AIR'), ('booth', 'A 電話亭 ×2：紅燈＝使用中'), ('desks', 'A 雙螢幕＋電動升降桌')]
th = ''.join(f'<div class="pic pop" style="--d:{.4 + i * .5:.1f}s;left:{110 + i * 580}px;top:300px;width:550px;height:420px"><img src="assets/{n}.jpg"></div><div class="cap3 in" style="--d:{.7 + i * .5:.1f}s;left:{110 + i * 580}px">{t}</div>' for i, (n, t) in enumerate(trip))
S.append(scene('s12_da', 9, f"""
<div class="title"><div class="kicker in" style="--d:.1s">改造 · D ＋ A</div><div class="h in" style="--d:.25s">核准的提案一一長出來</div></div>
{th}
<div class="row3">{chip('新狀態：錄製', '#f0857a', 2.4)}{chip('新狀態：通話', '#e48ac4', 2.6)}{chip('工作中會不時站起來', '#3fbf6a', 2.8)}</div>
""", css=""".cap3{position:absolute;top:740px;width:550px;font-size:28px;font-weight:700;line-height:1.4}
.row3{position:absolute;left:110px;top:880px;display:flex;gap:18px}""", title='D+A'))

# 13 ── decision → commands → reports
rows = [('佐助', '簡報與總整合', ['已收到', '進行中', '大綱 v1（26 頁）']), ('小櫻', '動畫與步驟表', ['已收到', '步驟表 v1', '動畫完成']),
        ('鼬', '練習題與解答卷', ['已收到', 'docx 完成', 'PDF 補上']), ('水門', '交叉檢查與 QA', ['已收到', 'SymPy 驗算', '一致性清單'])]
rh = ''
for i, (who, task, steps) in enumerate(rows):
    pills = ''.join(f'<span class="st pop" style="--d:{1.4 + i * .3 + j * .55:.2f}s">{s}</span>' + ('<span class="ar in" style="--d:%.2fs">›</span>' % (1.6 + i * .3 + j * .55) if j < 2 else '') for j, s in enumerate(steps))
    rh += f'<div class="crow in" style="--d:{.8 + i * .3:.1f}s"><span class="who2">{who}</span><span class="task">{task}</span><div class="pills">{pills}</div></div>'
S.append(scene('s13_loop', 8, f"""
<div class="title"><div class="kicker in" style="--d:.1s">協作真的在跑</div><div class="h in" style="--d:.25s">決議 → 指令 → 回報</div></div>
<div class="src pop" style="--d:.5s"><div class="k2">第 9 週教材分工</div><div class="v2">會議結論派出 4 條指令</div></div>
<div class="crows">{rh}</div>
<div class="cap in" style="--d:4.4s;position:absolute;left:110px;right:110px;bottom:56px;font-size:28px">代理人每小時回報進度；只有對外寄信、公開發布、花錢才需要老師核准</div>
""", css=""".src{position:absolute;left:110px;top:250px;width:1700px;padding:20px 30px;border-radius:18px;background:rgba(45,212,191,.12);border:1.5px solid rgba(45,212,191,.5);display:flex;gap:30px;align-items:baseline}
.k2{font-size:36px;font-weight:900;color:#7ff0df}.v2{font-size:30px;font-weight:700}
.crows{position:absolute;left:110px;top:380px;width:1700px;display:flex;flex-direction:column;gap:20px}
.crow{display:grid;grid-template-columns:130px 330px 1fr;align-items:center;gap:20px;padding:18px 26px;border-radius:18px;background:rgba(20,32,52,.85);border:1.5px solid rgba(150,200,255,.2)}
.who2{font-size:36px;font-weight:900;color:#c4b5fd}.task{font-size:30px;font-weight:700;white-space:nowrap}
.pills{display:flex;align-items:center;gap:14px}.ar{font-size:40px;color:#2dd4bf;font-weight:900}
.st{padding:10px 22px;border-radius:999px;font-size:26px;font-weight:700;white-space:nowrap;background:rgba(63,191,106,.16);border:1.5px solid rgba(63,191,106,.6);color:#9be8b0}""", title='協作'))

# 14 ── CTA
S.append(scene('s14_cta', 7, f"""
<div class="hero-img"><img src="assets/floor.jpg" style="opacity:.22"></div><div class="scrim"></div>
<div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center">
 <div class="kicker in" style="--d:.1s">DofLab · Agent Office</div>
 <div class="h1 pop" style="--d:.4s;margin-top:26px;font-size:128px">雲端紀錄看板</div>
 <div class="chips in" style="--d:1.1s"><span class="chip">跨帳號協作</span><span class="chip">會議・投票・指令</span><span class="chip">3D 即時呈現</span></div>
 <div class="url in" style="--d:1.8s">dofliu.github.io/agent-office</div>
 <div class="sub in" style="--d:2.3s;margin-top:14px;font-size:32px">github.com/dofliu/agent-office　·　DofLab 劉瑞弘</div>
</div>""", css=""".chips{margin-top:44px;display:flex;gap:24px}.url{margin-top:50px;font-size:54px;font-weight:900;color:#7ff0df;letter-spacing:.02em}""", fx=True, title='結尾'))

TR = ['fade', 'smoothleft', 'circleopen', 'smoothleft', 'smoothup', 'fade', 'smoothleft', 'fadeblack', 'fade', 'circleopen', 'smoothleft', 'smoothup', 'fade', 'fade']
for i, sc in enumerate(S[:-1]): sc['transition'] = TR[i]
sb = {'fps': 30, 'width': 1920, 'height': 1080, 'xfade': 0.6, 'scenes': S}
(P / 'storyboard.json').write_text(json.dumps(sb, ensure_ascii=False, indent=1), encoding='utf-8')
print('scenes', len(S), 'total', sum(s['duration'] for s in S), 'video', sum(s['duration'] for s in S) - .6 * (len(S) - 1))
