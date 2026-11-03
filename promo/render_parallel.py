#!/usr/bin/env python3
"""平行渲染：每景一個獨立 Chromium（GPU 行程是單核瓶頸，多開幾個就能吃滿 CPU）。
沿用 intro-video 技能的 render_scenes.render_scene（虛擬時鐘逐格），只是同時跑多景。

用法：python3 render_parallel.py storyboard.json --workdir work/intro [--jobs 4] [--skip s01_open,...]
"""
import argparse, json, sys, time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

import os
SKILL = Path(os.environ.get('INTRO_VIDEO_SKILL', '~/.claude/skills/intro-video')).expanduser() / 'scripts'
sys.path.insert(0, str(SKILL))
import render_scenes as rs  # noqa: E402


def job(html, out, dur, fps, w, h, check):
    t = time.time()
    rs.render_scene(Path(html), Path(out), duration=dur, fps=fps, width=w, height=h)
    rs.dump_check_frame(Path(out), Path(check), at=dur * 0.85)
    return Path(out).name, time.time() - t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('storyboard', type=Path)
    ap.add_argument('--workdir', type=Path, required=True)
    ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--skip', default='')
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    sb = json.loads(a.storyboard.read_text(encoding='utf-8'))
    fps, w, h = int(sb.get('fps', 30)), int(sb.get('width', 1920)), int(sb.get('height', 1080))
    base = a.storyboard.parent
    a.workdir.mkdir(parents=True, exist_ok=True)
    skip = set(filter(None, a.skip.split(',')))
    only = set(filter(None, a.only.split(',')))
    todo = []
    for sc in sb['scenes']:
        stem = Path(sc['file']).stem
        if stem in skip or (only and stem not in only):
            continue
        todo.append((str((base / sc['file']).resolve()), str(a.workdir / f'{stem}.mp4'), float(sc['duration']),
                     fps, w, h, str(a.workdir / f'check_{stem}.png')))
    # 長的先跑，收尾比較整齊
    todo.sort(key=lambda t: -t[2])
    print(f'[parallel] {len(todo)} 景，{a.jobs} 個同時', flush=True)
    bad = 0
    with ProcessPoolExecutor(max_workers=a.jobs) as ex:
        futs = {ex.submit(job, *t): t[1] for t in todo}
        for f in as_completed(futs):
            try:
                name, sec = f.result()
                print(f'[parallel] ✓ {name}  {sec:.0f}s', flush=True)
            except Exception as e:  # noqa: BLE001
                bad += 1
                print(f'[parallel] 失敗 {futs[f]}: {e}', flush=True)
    print('[parallel] 完成' + (f'（{bad} 景失敗）' if bad else ''), flush=True)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
