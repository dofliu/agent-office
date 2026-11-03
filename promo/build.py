"""產生兩支影片的場景：python3 build.py

1. raw/ 有截圖原檔時（capture.js、capture_drawers.js＋stitch.py 拍的），裁切成 assets/*.jpg；沒有就沿用 repo 裡的 assets/。
2. work/stills/ui_dash.png 有的話（shots.js 拍的介面截圖），轉成 assets/ui_dash.jpg。
3. 執行 build_intro.py（3 分鐘介紹片 → intro/）與 build_shorts.py（45 秒 Shorts → shorts/）。
"""
import runpy
from pathlib import Path
from PIL import Image

P = Path(__file__).resolve().parent
RAW, AS = P / 'raw', P / 'assets'
AS.mkdir(parents=True, exist_ok=True)


def jpg(src, name, box=None, width=None, q=88):
    im = Image.open(RAW / src).convert('RGB')
    if box: im = im.crop(box)
    if width and im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(AS / f'{name}.jpg', quality=q, optimize=True)


if RAW.is_dir():
    for src, name in [('floor.png', 'floor'), ('old_floor.png', 'old')]:
        if (RAW / src).exists(): jpg(src, name)
    if (RAW / 'x2_meeting_safe.png').exists():
        jpg('x2_meeting_safe.png', 'meeting', width=640, q=86)
        jpg('x2_meeting_safe.png', 'agenda', box=(0, 0, 998, 1420), width=620)
    print('assets：已從 raw/ 更新')
else:
    print('assets：沒有 raw/，沿用現有截圖')

runpy.run_path(str(P / 'build_intro.py'), run_name='__main__')
runpy.run_path(str(P / 'build_shorts.py'), run_name='__main__')
