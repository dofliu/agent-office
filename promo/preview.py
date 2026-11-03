"""每景快速看 85% 時間點的畫面（不出影片）：python3 preview.py [s04b_common ...] → preview/*.png"""
import sys, json, importlib.util
from pathlib import Path
import os
SK = Path(os.environ.get('INTRO_VIDEO_SKILL', '~/.claude/skills/intro-video')).expanduser() / 'scripts' / 'render_scenes.py'
spec = importlib.util.spec_from_file_location('rs', SK); rs = importlib.util.module_from_spec(spec); spec.loader.exec_module(rs)
from playwright.sync_api import sync_playwright
P = Path(__file__).resolve().parent; out = P / 'preview'; out.mkdir(exist_ok=True)
sb = json.loads((P / 'storyboard.json').read_text())
only = sys.argv[1:] 
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=rs.find_chromium(), args=['--no-sandbox', '--disable-gpu'])
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.add_init_script(rs.VIRTUAL_CLOCK_JS)
    for sc in sb['scenes']:
        stem = Path(sc['file']).stem
        if only and stem not in only: continue
        pg.goto((P / sc['file']).resolve().as_uri(), wait_until='load'); pg.wait_for_timeout(300)
        t, target = 0, sc['duration'] * .85
        while t < target: pg.evaluate('(d)=>window.__advanceFrame&&window.__advanceFrame(d)', 100); t += .1
        pg.screenshot(path=str(out / f'{stem}.png')); print('preview', stem)
    b.close()
