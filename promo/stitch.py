"""把 capture_drawers.js 分段拍的會議紀錄接成一張長圖：raw/x2_meeting_parts/ → raw/x2_meeting_safe.png。

分享連結已在拍照時模糊（capture_drawers.js 的 blurLinks）。接完會另存 raw/check_links.png
（議程開頭那一段），請打開確認看不到 sk= 之類的網址再跑 build.py。
"""
import json
from pathlib import Path
from PIL import Image

RAW = Path(__file__).resolve().parent / 'raw'
d = RAW / 'x2_meeting_parts'
info = json.loads((d / 'parts.json').read_text())
s = 2   # deviceScaleFactor
head = Image.open(d / 'head.png').convert('RGB')
out = Image.new('RGB', (head.width, head.height + int(round(info['total'] * s))), 'white')
out.paste(head, (0, 0))
for p in info['parts']:
    out.paste(Image.open(d / p['f']).convert('RGB'), (0, head.height + int(round(p['top'] * s))))
out.save(RAW / 'x2_meeting_safe.png')
out.crop((0, 0, out.width, min(out.height, 1600))).save(RAW / 'check_links.png')
print('x2_meeting_safe.png', out.size, '→ 先檢查 raw/check_links.png')
