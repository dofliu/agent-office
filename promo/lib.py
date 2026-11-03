"""兩支影片共用的場景工具：版面 CSS、元件、運鏡畫面播放器、跟著 3D 位置跑的標籤。

場景是獨立的 HTML（1920×1080 或 1080×1920），用 render.js 以虛擬時鐘逐格渲染。
運鏡畫面（work/footage/<鏡頭>/f_000001.jpg …）由 shots.js 拍；場景用 <canvas> 逐格畫上去，
標籤位置來自同一個鏡頭的 track.json（build 時直接寫進 HTML）。
"""
import json
from pathlib import Path

P = Path(__file__).resolve().parent
FOOT = P / 'work' / 'footage'
FONT = '"Noto Sans TC","Noto Sans CJK TC","WenQuanYi Zen Hei","PingFang TC","Microsoft JhengHei",sans-serif'
TEAM = {'DofLab': '#1f9ab8', 'DofGM': '#d0892a', 'NCUT_PJ': '#d0574b', 'Pro': '#8a66d6'}


def base_css(W, H):
    return f"""
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{W}px;height:{H}px;overflow:hidden;background:#070d17}}
body{{font-family:{FONT};color:#e8eef7;position:relative;-webkit-font-smoothing:antialiased}}
.bg{{position:absolute;inset:0;background:
 radial-gradient({W * .62:.0f}px {H * .74:.0f}px at 24% 18%,rgba(45,212,191,.14),transparent 62%),
 radial-gradient({W * .58:.0f}px {H * .7:.0f}px at 78% 82%,rgba(139,92,246,.15),transparent 60%),
 linear-gradient(160deg,#0d1b2e 0%,#070d17 58%,#05070d 100%)}}
.aur{{position:absolute;width:{max(W, H) * .78:.0f}px;height:{max(W, H) * .78:.0f}px;border-radius:50%;filter:blur(90px);opacity:.5;mix-blend-mode:screen}}
.aur.a{{background:radial-gradient(circle,rgba(45,212,191,.32),transparent 62%);left:-24%;top:-30%;animation:drift1 22s ease-in-out infinite alternate}}
.aur.b{{background:radial-gradient(circle,rgba(139,92,246,.30),transparent 62%);right:-27%;bottom:-32%;animation:drift2 26s ease-in-out infinite alternate}}
@keyframes drift1{{to{{transform:translate(150px,90px) scale(1.12)}}}}
@keyframes drift2{{to{{transform:translate(-130px,-80px) scale(1.08)}}}}
.grid{{position:absolute;inset:0;opacity:.05;background-image:linear-gradient(rgba(232,238,247,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(232,238,247,.5) 1px,transparent 1px);background-size:64px 64px}}
.vig{{position:absolute;inset:0;background:radial-gradient({W * .83:.0f}px {H * .93:.0f}px at 50% 46%,transparent 58%,rgba(0,0,0,.5) 100%);pointer-events:none;z-index:6}}
.stage{{position:absolute;inset:0;z-index:4;animation:cam var(--dur) ease-in-out both}}
@keyframes cam{{from{{transform:scale(1)}}to{{transform:scale(1.04)}}}}
.foot{{position:absolute;inset:0;width:{W}px;height:{H}px;z-index:1;display:block}}
.kicker{{font-size:28px;font-weight:700;letter-spacing:.42em;color:#2dd4bf;white-space:nowrap}}
.h1{{font-size:112px;font-weight:900;line-height:1.14;letter-spacing:.01em;
 background:linear-gradient(100deg,#f4f8ff 20%,#9be8db 55%,#c4b5fd 90%);-webkit-background-clip:text;background-clip:text;color:transparent;
 filter:drop-shadow(0 8px 40px rgba(45,212,191,.18))}}
.h{{font-size:72px;font-weight:900;line-height:1.12;white-space:nowrap;
 background:linear-gradient(100deg,#f4f8ff 20%,#9be8db 55%,#c4b5fd 90%);-webkit-background-clip:text;background-clip:text;color:transparent}}
.sub{{font-size:34px;font-weight:500;color:rgba(232,238,247,.86);line-height:1.55}}
.cap{{font-size:30px;color:rgba(232,238,247,.85);line-height:1.5}}
.chip{{display:inline-flex;align-items:center;gap:14px;padding:16px 32px;border-radius:999px;font-size:32px;font-weight:700;white-space:nowrap;
 background:rgba(20,32,52,.85);border:1.5px solid rgba(150,200,255,.24);box-shadow:0 14px 40px rgba(0,0,0,.45)}}
.tag{{display:inline-flex;align-items:center;gap:12px;padding:12px 24px;border-radius:999px;font-size:28px;font-weight:700;white-space:nowrap;
 background:rgba(10,18,32,.88);border:1.5px solid rgba(150,200,255,.3);box-shadow:0 12px 30px rgba(0,0,0,.45);color:#f4f8ff}}
.dot{{width:16px;height:16px;border-radius:50%;flex:none}}
.badge{{display:inline-block;padding:12px 26px;border-radius:12px;font-size:28px;font-weight:700;white-space:nowrap;
 background:rgba(45,212,191,.14);border:1.5px solid rgba(45,212,191,.45);color:#7ff0df}}
.pic{{position:absolute;border-radius:22px;overflow:hidden;background:#0b1220;border:1.5px solid rgba(150,200,255,.24);box-shadow:0 34px 90px rgba(0,0,0,.6)}}
.pic img{{display:block;width:100%;height:100%;object-fit:cover}}
.in{{opacity:0;animation:rise .9s cubic-bezier(.16,1,.3,1) both;animation-delay:var(--d,0s)}}
@keyframes rise{{from{{opacity:0;transform:translateY(46px)}}to{{opacity:1;transform:none}}}}
.pop{{opacity:0;animation:pop .75s cubic-bezier(.2,1.4,.35,1) both;animation-delay:var(--d,0s)}}
@keyframes pop{{from{{opacity:0;transform:scale(.55)}}to{{opacity:1;transform:scale(1)}}}}
.fade{{opacity:0;animation:fadein .8s ease both;animation-delay:var(--d,0s)}}
@keyframes fadein{{to{{opacity:1}}}}
/* 疊在運鏡畫面上的字：深色漸層底 */
.shade{{position:absolute;z-index:2;pointer-events:none}}
.shade.b{{left:0;right:0;bottom:0;height:{H * .46:.0f}px;background:linear-gradient(0deg,rgba(5,9,16,.88) 0%,rgba(5,9,16,.55) 45%,transparent 100%)}}
.shade.t{{left:0;right:0;top:0;height:{H * .36:.0f}px;background:linear-gradient(180deg,rgba(5,9,16,.82) 0%,rgba(5,9,16,.45) 50%,transparent 100%)}}
.shade.l{{left:0;top:0;bottom:0;width:{W * .5:.0f}px;background:linear-gradient(90deg,rgba(5,9,16,.86) 0%,rgba(5,9,16,.5) 55%,transparent 100%)}}
.shade.all{{inset:0;background:rgba(5,9,16,.55)}}
.ttl{{position:absolute;z-index:5;display:flex;flex-direction:column;gap:12px}}
.ttl .h{{filter:drop-shadow(0 4px 18px rgba(0,0,0,.6))}}
.ttl .sub{{text-shadow:0 2px 10px rgba(0,0,0,.7)}}
/* 跟著 3D 位置跑的標籤 */
.trk{{position:absolute;left:0;top:0;z-index:5;opacity:0;will-change:transform,opacity}}
.trk .tag{{position:absolute;left:0;bottom:40px;transform:translateX(-50%)}}
.trk i.pin{{position:absolute;left:-9px;top:-9px;width:18px;height:18px;border-radius:50%;background:#2dd4bf;box-shadow:0 0 0 6px rgba(45,212,191,.3),0 4px 12px rgba(0,0,0,.5)}}
.trk i.stem{{position:absolute;left:-1.5px;bottom:9px;width:3px;height:31px;background:linear-gradient(0deg,#2dd4bf,rgba(45,212,191,.2))}}
"""


TEMPLATE = """<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><title>{title}</title>
<style>{css}</style></head>
<body style="--dur:{dur}s">
{back}
{foot}
<div class="stage">
{body}
</div>
{over}
<div class="vig"></div>
{scripts}
</body></html>"""

FX = """<canvas id="fx" style="position:absolute;inset:0;z-index:3;pointer-events:none"></canvas>
<script>
(()=>{const cv=document.getElementById('fx'),W=innerWidth,H=innerHeight;cv.width=W;cv.height=H;const cx=cv.getContext('2d');
let s=7;const R=()=>(s=(s*16807)%2147483647)/2147483647;
const P=[];for(let i=0;i<90;i++)P.push({x:R()*W,y:R()*H,r:.8+R()*2.6,s:.12+R()*.5,o:.12+R()*.4,hue:R()<.6?'45,212,191':'167,139,250',ph:R()*6.28});
function draw(){const t=performance.now()/1000;cx.clearRect(0,0,W,H);
 for(const p of P){const y=(p.y-t*38*p.s)%H,yy=y<0?y+H:y,x=p.x+Math.sin(t*.5+p.ph)*26,tw=.55+.45*Math.sin(t*1.7+p.ph*3);
  cx.beginPath();cx.arc(x,yy,p.r,0,6.283);cx.fillStyle=`rgba(${p.hue},${(p.o*tw).toFixed(3)})`;cx.fill();}
 requestAnimationFrame(draw);}
requestAnimationFrame(draw);})();
</script>"""

# 運鏡畫面播放器：window.__FOOT = [{shot, at, from, rate, n, x, y, w, h}]，at 之後播這段；
# render.js 每格先呼叫 window.__frameReady()，等這一格的圖解碼畫好再截圖。
PLAYER = """<script>
(()=>{const F=window.__FOOT||[],cv=document.querySelector('canvas.foot');if(!cv)return;const cx=cv.getContext('2d');
let shown='';const cache=new Map();
window.__footAt=t=>{let seg=null;for(const s of F)if(t>=s.at-1e-6)seg=s;if(!seg)return null;
 const i=Math.max(1,Math.min(seg.n,Math.floor((seg.from+(t-seg.at)*(seg.rate||1))*30+1e-6)+1));return {seg,i};};
async function load(src){if(cache.has(src))return cache.get(src);const im=new Image();im.src=src;const p=im.decode().then(()=>im);cache.set(src,p);
 if(cache.size>8)cache.delete(cache.keys().next().value);return p;}
window.__frameReady=async()=>{const t=performance.now()/1000,a=window.__footAt(t);if(!a)return;
 const src='../work/footage/'+a.seg.shot+'/f_'+String(a.i).padStart(6,'0')+'.jpg';if(src===shown)return;
 const im=await load(src);const s=a.seg;cx.drawImage(im,s.sx||0,s.sy||0,s.sw||im.naturalWidth,s.sh||im.naturalHeight,0,0,cv.width,cv.height);shown=src;
 for(const n of ['','2']){const nx=window.__footAt(t+(n?2:1)/30);if(nx){const s2='../work/footage/'+nx.seg.shot+'/f_'+String(nx.i).padStart(6,'0')+'.jpg';load(s2);}}
 if(window.__trackUpdate)window.__trackUpdate(t,a);};
})();
</script>"""

# 跟著 3D 點跑的標籤：<div class="trk" data-k="名稱" data-on="開始秒" data-off="結束秒">…</div>
TRACKER = """<script>
(()=>{const T=window.__TRACK||{},els=[...document.querySelectorAll('.trk')];const W=innerWidth,H=innerHeight,AV=window.__AVOID||null;
window.__trackUpdate=(t,a)=>{const fr=(T[a.seg.shot]||[])[a.i-1]||{};const sc=(a.seg.scale||1),ox=a.seg.ox||0,oy=a.seg.oy||0;
 for(const el of els){const k=el.dataset.k,p=fr[k],on=+el.dataset.on,off=+(el.dataset.off||1e9);
  if(!p){el.style.opacity=0;continue;}const x=p[0]*sc+ox+(+el.dataset.dx||0),y=p[1]*sc+oy+(+el.dataset.dy||0);
  const m=+(el.dataset.m||120),edge=Math.min(x-m,W-m-x,y-140,H-60-y);let vis=p[2]&&edge>0?Math.min(1,edge/120):0;
  if(AV){const d=Math.max(AV[0]-x,x-AV[2],AV[1]-y,y-AV[3]);vis*=Math.min(1,Math.max(0,d/90));}
  const k1=Math.min(1,Math.max(0,(t-on)/.4)),k2=Math.min(1,Math.max(0,(off-t)/.4));
  el.style.opacity=(vis*k1*k2).toFixed(3);el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;}};
})();
</script>"""


def track_data(shots, keys=None):
    """把需要的鏡頭 track.json 讀進來（只留用得到的 key，數字取一位小數）。"""
    out = {}
    for s in shots:
        f = FOOT / s / 'track.json'
        if not f.exists():
            continue
        frames = json.loads(f.read_text())['frames']
        if keys:
            frames = [{k: v for k, v in fr.items() if k in keys} for fr in frames]
        out[s] = frames
    return out


def frames_of(shot):
    f = FOOT / shot / 'info.json'
    return json.loads(f.read_text())['frames'] if f.exists() else 9999


def scene(path, title, dur, body, W=1920, H=1080, css='', fx=False, foot=None, track_keys=None, back=True, over='', avoid=None, box=None):
    """寫一景 HTML。body 在會慢推的 .stage 裡；over 不會動（跟著 3D 跑的標籤、漸層底放這裡）。
    foot = [{'shot', 'at', 'from', 'rate'}...]（運鏡畫面），track_keys = 用到的標籤 key，avoid = 標籤要避開的方框 [x0,y0,x1,y1]，
    box = [x, y, w, h]：運鏡畫面縮小放在這個框裡（圓角、陰影），不給就滿版。"""
    scripts, foot_html = [], ''
    if avoid:
        scripts.append(f'<script>window.__AVOID={json.dumps(avoid)};</script>')
    if foot:
        segs = []
        for s in foot:
            s = {'at': 0, 'from': 0, 'rate': 1, **s}
            s['n'] = frames_of(s['shot'])
            segs.append(s)
        if box:
            x, y, w, h = box
            foot_html = (f'<canvas class="foot" width="{w}" height="{h}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;border-radius:34px;'
                         f'box-shadow:0 40px 110px rgba(0,0,0,.65),0 0 0 2px rgba(150,200,255,.28)"></canvas>')
        else:
            foot_html = f'<canvas class="foot" width="{W}" height="{H}"></canvas>'
        trk = track_data(sorted({s['shot'] for s in segs}), track_keys) if track_keys else {}
        scripts.append(f'<script>window.__FOOT={json.dumps(segs, ensure_ascii=False)};window.__TRACK={json.dumps(trk, ensure_ascii=False, separators=(",", ":"))};</script>')
        scripts.append(TRACKER)
        scripts.append(PLAYER)
    bg = '<div class="bg"></div><div class="aur a"></div><div class="aur b"></div><div class="grid"></div>' if back else ''
    if fx:
        bg += FX
    html = TEMPLATE.format(title=title, css=base_css(W, H) + css, dur=dur, back=bg, foot=foot_html, body=body, over=over, scripts='\n'.join(scripts))
    path.write_text(html, encoding='utf-8')
    return {'file': path.name, 'duration': dur}


def chip(text, color, d, cls='pop', extra='', size=''):
    st = f'--d:{d}s;{extra}' + (f'font-size:{size}px;' if size else '')
    return f'<span class="tag {cls}" style="{st}"><i class="dot" style="background:{color}"></i>{text}</span>'


def trk(key, text, on, off=99, color='#2dd4bf', dx=0, dy=0, size=None):
    st = f' style="font-size:{size}px"' if size else ''
    return (f'<div class="trk" data-k="{key}" data-on="{on}" data-off="{off}" data-dx="{dx}" data-dy="{dy}">'
            f'<i class="stem"></i><i class="pin" style="background:{color}"></i><span class="tag"{st}>{text}</span></div>')


def write_storyboard(dirp, scenes, W, H, xfade, transitions):
    for i, sc in enumerate(scenes[:-1]):
        sc['transition'] = transitions[i]
    sb = {'fps': 30, 'width': W, 'height': H, 'xfade': xfade, 'scenes': scenes}
    (dirp / 'storyboard.json').write_text(json.dumps(sb, ensure_ascii=False, indent=1), encoding='utf-8')
    total = sum(s['duration'] for s in scenes) - xfade * (len(scenes) - 1)
    print(f'{dirp.name}: {len(scenes)} 景，片長 {total:.1f} 秒')
    return total
