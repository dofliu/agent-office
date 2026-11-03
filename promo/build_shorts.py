"""45 秒直式短片（YouTube Shorts，1080×1920）：產生 shorts/*.html 與 shorts/storyboard.json。

運鏡畫面先用 shots.js 拍好（p_ 開頭的鏡頭）。字放在畫面上半部：Shorts 下方約 1/4 與右側會被 YouTube 的按鈕、標題蓋住。
"""
from lib import P, scene, write_storyboard

D = P / 'shorts'
D.mkdir(exist_ok=True)
W, H = 1080, 1920
S = []
CSS = """
.top{position:absolute;left:60px;right:60px;top:150px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:18px;z-index:5}
.pill{display:inline-block;padding:12px 30px;border-radius:999px;font-size:34px;font-weight:800;letter-spacing:.08em;color:#05121a;background:#2dd4bf;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.sh{font-size:100px;font-weight:900;line-height:1.14;color:#fff;text-shadow:0 4px 0 rgba(5,9,16,.55),0 10px 40px rgba(0,0,0,.65)}
.ss{font-size:52px;font-weight:700;line-height:1.35;color:#eaf6ff;text-shadow:0 3px 18px rgba(0,0,0,.8)}
.note{font-size:34px;font-weight:600;color:rgba(232,238,247,.85);text-shadow:0 2px 12px rgba(0,0,0,.8)}
.shade.t{height:900px}
.lbl{position:absolute;z-index:5;display:inline-flex;align-items:center;gap:14px;padding:16px 30px;border-radius:999px;font-size:44px;font-weight:800;white-space:nowrap;
 background:rgba(10,18,32,.9);border:2px solid rgba(45,212,191,.6);color:#f4f8ff;box-shadow:0 14px 34px rgba(0,0,0,.5)}
.lbl i{width:22px;height:22px;border-radius:50%;flex:none}
"""
shade = '<div class="shade t"></div>'


def top(pill, h, s='', note='', d=.25):
    return (f'<div class="top">' + (f'<span class="pill pop" style="--d:{d}s">{pill}</span>' if pill else '')
            + f'<div class="sh pop" style="--d:{d + .2:.2f}s">{h}</div>'
            + (f'<div class="ss in" style="--d:{d + .55:.2f}s">{s}</div>' if s else '')
            + (f'<div class="note in" style="--d:{d + .9:.2f}s">{note}</div>' if note else '') + '</div>')


S.append(scene(D / 'v01_hook.html', '開場', 6.0, top('DofLab · Agent Office', '12 位 AI 代理人', '在同一間 3D 辦公室上班', d=.1),
               W=W, H=H, css=CSS, over=shade, foot=[{'shot': 'p_aerial'}]))
S.append(scene(D / 'v02_office.html', '辦公室', 5.5, top('', '每個團隊<br>一間辦公室', '有在工作，就坐在座位上'),
               W=W, H=H, css=CSS, over=shade, foot=[{'shot': 'p_office'}]))
S.append(scene(D / 'v03_screen.html', '螢幕', 5.5, top('', '看他的螢幕', '正在做什麼，一看就知道'),
               W=W, H=H, css=CSS, over=shade, foot=[{'shot': 'p_screen'}]))
S.append(scene(D / 'v04_circle.html', '圓框', 6.0,
               '<div class="top" style="top:110px"><div class="sh pop" style="--d:.2s;font-size:92px">一鍵切換圓框</div><div class="ss in" style="--d:.6s">12 人的狀態，一次看完</div></div>',
               W=W, H=H, css=CSS, foot=[{'shot': 'p_circle'}], box=[150, 420, 780, 1387]))
S.append(scene(D / 'v05_meet.html', '開會', 6.5, top('', '有事就開會', '提案・討論・投票', '依真實發言重現'),
               W=W, H=H, css=CSS, over=shade, foot=[{'shot': 'p_meet'}]))

votes = [('B+', '會議／試播室', 10), ('D', '錄課棚', 8), ('A', '辦公室升級', 3), ('C', '茶水間', 1)]
bars = ''.join(f'<div class="vrow in" style="--d:{.6 + i * .22:.2f}s"><div class="vh"><span class="vid">{a}</span><span class="vn">{n}</span><b class="cnt" data-v="{v}" data-d="{.9 + i * .22:.2f}">0</b></div>'
               f'<div class="bar"><i style="--w:{v * 10}%;--bd:{.9 + i * .22:.2f}s"></i></div></div>' for i, (a, n, v) in enumerate(votes))
S.append(scene(D / 'v06_vote.html', '投票', 5.5, f"""
<div class="top" style="top:200px"><div class="pill pop" style="--d:.1s">投票結果</div><div class="sh pop" style="--d:.3s">辦公室要怎麼改？</div></div>
<div class="votes">{bars}</div>
<div class="stamp">老闆核准 A・B+・D</div>
<script>
const cs=[...document.querySelectorAll('.cnt')];
function tick(){{const t=performance.now()/1000;for(const c of cs){{const v=+c.dataset.v,d=+c.dataset.d;const k=Math.min(1,Math.max(0,(t-d)/1.1));c.textContent=Math.round(v*(1-Math.pow(1-k,3)));}}requestAnimationFrame(tick);}}
requestAnimationFrame(tick);
</script>""", W=W, H=H, css=CSS + """.votes{position:absolute;left:80px;right:80px;top:520px;display:flex;flex-direction:column;gap:38px}
.vh{display:flex;align-items:baseline;gap:24px;margin-bottom:14px}.vid{font-size:64px;font-weight:900;color:#2dd4bf;min-width:110px}.vn{font-size:52px;font-weight:800;flex:1}
.cnt{font-size:72px;font-weight:900;font-variant-numeric:tabular-nums}
.bar{height:46px;border-radius:23px;background:rgba(232,238,247,.1);overflow:hidden}
.bar i{display:block;height:100%;width:0;border-radius:23px;background:linear-gradient(90deg,#2dd4bf,#a78bfa);animation:grow 1.1s cubic-bezier(.2,.9,.3,1) var(--bd) forwards}
@keyframes grow{to{width:var(--w)}}
.vrow:first-child .cnt{color:#7ff0df}
.stamp{position:absolute;left:0;right:0;margin:0 auto;width:760px;top:1330px;text-align:center;padding:24px 0;border:8px solid #3fbf6a;border-radius:22px;color:#3fbf6a;font-size:64px;font-weight:900;
 background:rgba(5,12,10,.85);transform:rotate(-6deg);opacity:0;animation:stamp .7s cubic-bezier(.2,1.4,.35,1) 3.3s forwards;box-shadow:0 20px 50px rgba(0,0,0,.5)}
@keyframes stamp{from{opacity:0;transform:rotate(-6deg) scale(2)}to{opacity:1;transform:rotate(-6deg) scale(1)}}"""))

S.append(scene(D / 'v07_upgrade.html', '改造', 7.0, top('', '辦公室真的改了', '依會議決議，一項一項做出來', d=.15)
               + '<div class="lbl" style="left:70px;top:1180px;animation:pop .75s cubic-bezier(.2,1.4,.35,1) .9s both,fadeout .35s ease 3.3s forwards"><i style="background:#e0463c"></i>D 錄課棚：ON AIR</div>'
               + '<div class="lbl pop" style="--d:4.1s;left:70px;top:1180px"><i style="background:#e0463c"></i>A 電話亭：紅燈＝通話中</div>',
               W=W, H=H, css=CSS + '@keyframes fadeout{to{opacity:0}}', over=shade, foot=[{'shot': 'p_studio', 'at': 0}, {'shot': 'p_booth', 'at': 3.6}]))
S.append(scene(D / 'v08_end.html', '結尾', 5.8, """
<div class="top" style="top:560px">
 <span class="pill pop" style="--d:.1s">DofLab · Agent Office</span>
 <div class="sh pop" style="--d:.35s;font-size:110px">代理人的<br>3D 辦公室</div>
 <div class="ss in" style="--d:.9s">開會・投票・分工・改造辦公室</div>
 <div class="note in" style="--d:1.4s;margin-top:30px;color:#7ff0df;font-size:44px;letter-spacing:.12em">DofLab　劉瑞弘</div>
</div>""", W=W, H=H, css=CSS, fx=True, over='<div class="shade all" style="background:rgba(5,9,16,.68)"></div>',
               foot=[{'shot': 'p_aerial', 'rate': .35}]))

write_storyboard(D, S, W, H, .4, ['fade', 'smoothup', 'circleopen', 'fade', 'fadeblack', 'fade', 'fade'])
